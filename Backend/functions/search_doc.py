
import json
import os
import re
from dotenv import load_dotenv
import functions.llm_adapter_async as genai
from langchain_community.tools import TavilySearchResults
from langchain_community.utilities import GoogleSerperAPIWrapper
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import asyncio
from typing import Optional

def llm_serper(query):
    serper_key = os.getenv("SERPER_API_KEY")
    if not serper_key:
        print("Warning: SERPER_API_KEY not found in .env file. Search may not work.")
        return []
    search = GoogleSerperAPIWrapper(serper_api_key=serper_key)
    results = search.results(query)
    organic_results = results.get("organic", [])
    links = [result.get("link") for result in organic_results if "link" in result]
    return links

def get_web_links(query):
    try:
        return llm_serper(query)
    except Exception:
        return []

def _sync_tavily_search(query: str, search_depth: str = "advanced", max_results: int = 5):
    """
    Synchronous Tavily search call.
    """
    try:
        # bias towards educational/official docs
        bias_query = f"{query} site:*.edu OR site:*.gov OR site:developer.mozilla.org OR site:github.com OR site:stackoverflow.com"
        tavily_tool = TavilySearchResults(search_depth=search_depth, max_results=max_results)
        return tavily_tool.run(bias_query)
    except Exception as e:
        print(f"Tavily biased search failed: {e}, falling back to basic")
        tavily_tool = TavilySearchResults(max_results=max_results)
        return tavily_tool.run(query)

async def safe_tavily_search_async(query: str, search_depth: str = "advanced", max_results: int = 5, timeout: int = 20):
    """
    Perform a Tavily search with retry, timeout, and thread safety.
    """
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_sync_tavily_search, query, search_depth, max_results),
            timeout=timeout
        )
    except Exception as e:
        print(f"Safe Tavily search failed for '{query}': {e}")
        return []

from functions.filter_utils import filter_pipeline

async def generate_skill_resources(input_json, stop_event: Optional[asyncio.Event] = None):
    """
    Takes JSON data (string or dict) as input, extracts skills from the 'skill_gaps' areas,
    generates a learning workflow for each skill via a generative model, retrieves Tavily documents,
    and DuckDuckGo links, and returns a list of skills with their respective resources.
    """
    # Load environment variables
    load_dotenv(override=True)

    # Parse input JSON if it is a string
    if isinstance(input_json, str):
        try:
            data = json.loads(input_json)
        except json.JSONDecodeError:
            data = {}
    else:
        data = input_json

    # Extract skills from the JSON data
    improvement_areas = data.get("skill_gaps", {}).get("areas", [])
    skills = [area["skill"] for area in improvement_areas if "skill" in area]
    
    if not skills:
        # Phase 5: Classroom Support
        focus_areas = data.get("focus_areas", [])
        if isinstance(focus_areas, list) and focus_areas:
            skills = [str(f) for f in focus_areas if f]
        elif data.get("subject"):
            skills = [str(data.get("subject"))]
    
    if not skills:
        return []
    if stop_event and stop_event.is_set():
        return []
    assessed_level = data.get("assessed_level", "intermediate")
    target_bloom = data.get("bloom_level", "apply")
    
    generation_config = {
        "temperature": 0.2,
        "top_p": 0.95,
        "top_k": 64,
        "max_output_tokens": 3000
    }

    # Helper function: clean the generative model's JSON response
    def clean_json_response(response_text):
        cleaned_text = re.sub(r"```json|```", "", response_text).strip()
        return cleaned_text

    # Helper function: generate a workflow (list of subtopics) for a given skill
    async def generate_workflow(skill):
        if stop_event and stop_event.is_set():
            return json.dumps({"skill": skill, "subtopics": []})

        model = genai.GenerativeModelAsync(
            model_name=os.getenv("LMSTUDIO_MODEL"),
            generation_config=generation_config
        )
        
        prompt = f"""You are an expert curriculum designer. Generate a structured learning path for the skill: "{skill}".
The student's current assessed level is: {assessed_level}.
The target Bloom's Taxonomy level is: {target_bloom}.

Behavioral Instructions:
- If target_bloom is "remember" or "understand": Focus on definitions, core concepts, and introductory overviews.
- If target_bloom is "apply" or "analyze": Prioritize resources that provide worked examples, case studies, and practical exercises.
- If target_bloom is "evaluate" or "create": Suggest advanced architectural deep-dives, critique-based content, and project-based learning.

For this skill, provide 4-6 key subtopics. For each subtopic, provide:
1. 'difficulty': "foundational", "intermediate", or "advanced"
2. 'reason': A short explanation of why this is included for this level.
3. 'queries': Exactly 3 search queries: 
   - A 'precise' query (highly specific, e.g. "React useEffect dependency array depth")
   - A 'broad' query (contextual, e.g. "React hooks advanced patterns")
   - A 'fallback' query (general topic, e.g. "React performance optimization")

Return valid JSON in this exact schema:
{{
  "skill": "{skill}",
  "subtopics": [
    {{
      "name": "Subtopic Name",
      "difficulty": "foundational",
      "reason": "...",
      "queries": ["precise", "broad", "fallback"]
    }}
  ]
}}
"""
        try:
            response = await model.generate_content(prompt)
            raw_text = response.text.strip()
            print(f"\nRaw response for {skill}:\n{raw_text}")
            return clean_json_response(raw_text)
        except Exception as exc:
            print(f"Workflow generation failed for {skill}: {exc}")
            fallback_payload = {
                "skill": skill,
                "subtopics": [
                    {
                        "name": f"{skill} Fundamentals",
                        "difficulty": "foundational",
                        "reason": "Essential base knowledge",
                        "queries": [f"{skill} comprehensive guide", f"{skill} tutorial", f"{skill} basics"]
                    }
                ],
            }
            return json.dumps(fallback_payload)

    async def process_single_skill(skill: str):
        try:
            print(f"\nGenerating workflow for: {skill}")
            workflow_json = await generate_workflow(skill)

            try:
                workflow_data = json.loads(workflow_json)
            except json.JSONDecodeError:
                workflow_data = {"skill": skill, "subtopics": []}

            subtopics = workflow_data.get("subtopics", [])
            if not subtopics: # Final fallback if JSON was invalid
                 subtopics = [{
                    "name": f"{skill} Overview",
                    "difficulty": "intermediate",
                    "reason": "General coverage of the skill",
                    "queries": [f"{skill} guide", f"{skill} explained", skill]
                 }]

            all_tavily_docs = []
            all_serper_links = []
            
            for subtopic in subtopics:
                if stop_event and stop_event.is_set():
                    break
                sub_name = subtopic["name"]
                queries = subtopic.get("queries", [])
                
                subtopic_docs = []
                queries_used = []
                
                for q in queries:
                    if stop_event and stop_event.is_set():
                        break
                    print(f"Searching Tavily for subtopic '{sub_name}' with query: {q}")
                    docs = await safe_tavily_search_async(q)
                    if stop_event and stop_event.is_set():
                        break
                    if docs:
                        subtopic_docs.extend(docs)
                        queries_used.append(q)
                        if len(subtopic_docs) >= 3:
                            break
                
                if not subtopic_docs:
                    fallback_q = f"{skill} {sub_name} tutorial"
                    print(f"Fallback search for '{sub_name}': {fallback_q}")
                    subtopic_docs.extend(await safe_tavily_search_async(fallback_q))
                    queries_used.append(fallback_q)

                for d in subtopic_docs:
                    d["blueprint_subtopic"] = sub_name
                    d["search_query_used"] = queries_used[0] if queries_used else "fallback"
                    d["difficulty_tag"] = subtopic.get("difficulty", "intermediate")
                
                all_tavily_docs.extend(subtopic_docs)

                serper_q = queries[0] if queries else f"{skill} {sub_name}"
                links = llm_serper(serper_q)
                for l in links:
                    all_serper_links.append({
                        "url": l,
                        "title": f"{sub_name} reference",
                        "blueprint_subtopic": sub_name,
                        "difficulty_tag": subtopic.get("difficulty", "intermediate")
                    })

            print(f"Filtering {len(all_tavily_docs)} Tavily docs and {len(all_serper_links)} Serper links for {skill}...")
            
            combined_articles = []
            for d in all_tavily_docs:
                combined_articles.append({
                    "url": d.get("url") or d.get("link"),
                    "title": d.get("title"),
                    "content": d.get("content"),
                    "blueprint_subtopic": d.get("blueprint_subtopic"),
                    "search_query_used": d.get("search_query_used"),
                    "difficulty_tag": d.get("difficulty_tag")
                })
            combined_articles.extend(all_serper_links)
            
            # Fallback if no articles retrieved
            if not combined_articles:
                from urllib.parse import quote_plus
                combined_articles.append({
                    "url": f"https://en.wikipedia.org/wiki/{quote_plus(skill)}",
                    "title": f"{skill} - Wikipedia Overview",
                    "content": f"A comprehensive reference document covering details of {skill}.",
                    "blueprint_subtopic": f"{skill} Overview",
                    "search_query_used": "fallback",
                    "difficulty_tag": "intermediate"
                })

            if stop_event and stop_event.is_set():
                filtered_articles = []
            else:
                filtered_articles = await filter_pipeline(skill, combined_articles)
                if not filtered_articles and combined_articles:
                    print(f"Filter pipeline rejected all articles for {skill}. Falling back to unfiltered articles.")
                    filtered_articles = combined_articles

            # Segregate blogs and documents
            docs_list = []
            blogs_list = []
            blog_keywords = {"blog", "medium.com", "dev.to", "hashnode", "substack", "wp-", "blogspot"}
            
            for article in filtered_articles[:15]:
                url_str = (article.get("url") or "").lower()
                is_blog = any(kw in url_str for kw in blog_keywords)
                if is_blog:
                    blogs_list.append(article.get("url"))
                else:
                    docs_list.append(article)

            return {
                "skill": skill,
                "subtopics": subtopics,
                "documents": docs_list,
                "blogs": blogs_list
            }
        except Exception as e:
            print(f"Failed to process skill resources for '{skill}': {e}")
            return {
                "skill": skill,
                "subtopics": [],
                "documents": [],
                "blogs": []
            }

    # Parallelize skills
    tasks = [process_single_skill(skill) for skill in skills]
    results = await asyncio.gather(*tasks)
    return results