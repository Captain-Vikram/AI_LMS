import asyncio
import httpx
import json
import re
import os
import logging
from typing import List, Dict, Any, Optional
import functions.llm_adapter_async as genai

logger = logging.getLogger(__name__)

async def check_url_liveness(url: str, timeout: int = 5) -> bool:
    """
    Check if a URL is alive using a lightweight HEAD request with a
    GET fallback. Adds a friendly User-Agent and a small retry/backoff
    to reduce false negatives from transient network issues or
    servers that block HEAD requests.
    """
    if not url or not url.startswith("http"):
        return False

    headers = {
        "User-Agent": os.getenv(
            "LIVENESS_USER_AGENT",
            "Mozilla/5.0 (compatible; SkillMaster/1.0; +https://example.com)",
        )
    }

    max_attempts = int(os.getenv("LIVENESS_MAX_RETRIES", "2"))
    backoff_base = 0.3

    # Try a small number of attempts before giving up
    for attempt in range(1, max_attempts + 1):
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
                response = await client.head(url, headers=headers)

                # If server blocks HEAD (405) or returns forbidden (403) or not found (404), try GET
                if response.status_code in (403, 404, 405):
                    try:
                        response = await client.get(url, headers=headers)
                    except Exception:
                        # If GET also fails, let outer exception handling catch and retry
                        raise

                return response.status_code < 400

        except Exception as e:
            # Log at debug for early attempts, info when finally failing
            if attempt < max_attempts:
                logger.debug("Liveness check attempt %d failed for %s: %s", attempt, url, e)
                await asyncio.sleep(backoff_base * attempt)
            else:
                logger.info("Liveness check failed for %s: %s", url, e)
                return False

async def rank_resources(topic: str, resources: List[Dict[str, Any]], model_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Use a fast LLM (Haiku) to score Title + Description pairs against the original topic.
    Returns resources with a 'relevance_score' attached.
    """
    if not resources:
        return []

    model_name = model_name or os.getenv("LMSTUDIO_MODEL_FALLBACK") or os.getenv("LMSTUDIO_MODEL")
    model = genai.GenerativeModelAsync(model_name)

    # Prepare resources for the prompt
    resource_list_str = ""
    for idx, res in enumerate(resources):
        title = res.get("title") or res.get("concept") or "Untitled"
        desc = res.get("description") or res.get("content") or ""
        resource_list_str += f"ID: {idx}\nTitle: {title}\nDescription: {desc[:200]}\n---\n"

    prompt = f"""You are a relevance scoring assistant. Rate how relevant each of the following resources is to the topic: "{topic}".
Assign a score from 1 to 5, where:
1: Completely irrelevant
2: Tangentially related but poor quality/not helpful
3: Relevant and helpful
4: Highly relevant and authoritative
5: Perfect match for learning this specific topic

Resources:
{resource_list_str}

Return your response as a JSON object where keys are the resource IDs and values are the integer scores.
Example: {{"0": 4, "1": 2, "2": 5}}

Return ONLY the JSON.
"""

    try:
        response = await model.generate_content(prompt)
        text = response.text.strip()
        
        # Clean JSON
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].strip()
        
        scores = json.loads(text)
        
        scored_resources = []
        for idx, res in enumerate(resources):
            score = scores.get(str(idx), 3) # Default to 3 if missing
            res["relevance_score"] = int(score)
            scored_resources.append(res)
            
        return scored_resources
    except Exception as e:
        logger.warning("Ranking failed: %s", e)
        # Attach default score if ranking fails
        for res in resources:
            res["relevance_score"] = res.get("relevance_score", 3)
        return resources

def deduplicate_resources(resources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Remove duplicate resources based on URL normalization.
    """
    seen_urls = set()
    unique_resources = []
    
    for res in resources:
        url = res.get("url") or res.get("youtube_link") or res.get("link")
        if not url:
            continue
            
        # Basic normalization: remove trailing slash, query params (optional)
        normalized_url = str(url).strip().lower().rstrip("/")
        
        if normalized_url not in seen_urls:
            seen_urls.add(normalized_url)
            unique_resources.append(res)
            
    return unique_resources

async def filter_pipeline(topic: str, resources: List[Dict[str, Any]], min_score: int = 3) -> List[Dict[str, Any]]:
    """
    Full pipeline: deduplicate -> liveness check -> rank -> filter.
    """
    # 1. Deduplicate
    resources = deduplicate_resources(resources)
    
    # 2. Liveness Check (Parallelized, limited concurrency)
    urls = [res.get("url") or res.get("youtube_link") or res.get("link", "") for res in resources]
    concurrency = int(os.getenv("LIVENESS_CONCURRENCY", "10"))
    logger.debug("Running liveness checks with concurrency=%d for %d resources", concurrency, len(urls))

    sem = asyncio.Semaphore(concurrency)

    async def _sem_check(u: str) -> bool:
        if not u or not str(u).startswith("http"):
            return False
        await sem.acquire()
        try:
            return await check_url_liveness(u)
        finally:
            sem.release()

    liveness_results = await asyncio.gather(*[_sem_check(u) for u in urls])

    alive_resources = [res for res, is_alive in zip(resources, liveness_results) if is_alive]
    
    # 3. Re-rank (Batched)
    ranked_resources = await rank_resources(topic, alive_resources)
    
    # 4. Filter by score
    final_resources = [res for res in ranked_resources if res.get("relevance_score", 0) >= min_score]
    
    return final_resources
