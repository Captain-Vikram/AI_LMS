"""
Project Analyzer Module - AI-Powered Code Review Assistant
Supports both Google Gemini API and Local LM Studio
"""

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv

load_dotenv(override=True)


class ProjectAnalyzer:
    """Main analyzer class supporting multiple AI providers"""
    
    def __init__(self):
        """Initialize analyzer with Gemini and LM Studio support"""
        # Gemini Configuration
        self.gemini_api_key = os.getenv("GOOGLE_API_KEY", os.getenv("GEMINI_API_KEY", "")).strip()
        self.gemini_model = os.getenv("GEMINI_MODEL", "auto").strip() or "auto"
        self.gemini_api_base = "https://generativelanguage.googleapis.com/v1beta"
        self._resolved_gemini_model: Optional[str] = None
        self._available_gemini_models: Optional[List[str]] = None

        # Local LM Studio Configuration
        self.local_llm_url = os.getenv("LOCAL_LLM_URL", "http://localhost:1234")
        self.model_name = os.getenv("MODEL_NAME", "qwen2.5-coder-3b-instruct")
        self.temperature = float(os.getenv("MODEL_TEMPERATURE", "0.2"))
        self.max_tokens = int(os.getenv("MODEL_MAX_TOKENS", "3000"))
        self.local_max_tokens = int(os.getenv("LOCAL_MODEL_MAX_TOKENS", "1000"))
        self.local_prompt_char_budget = int(os.getenv("LOCAL_PROMPT_CHAR_BUDGET", "3800"))
        self.chunk_char_budget = int(os.getenv("CHUNK_CHAR_BUDGET", "2200"))
        self.max_chunks = int(os.getenv("MAX_REVIEW_CHUNKS", "20"))

        # Check availability
        self.lm_studio_available = self._check_lm_studio()
        self.is_available = bool(self.gemini_api_key) or self.lm_studio_available

        print(f"[AI] Gemini configured: {'yes' if self.gemini_api_key else 'no'}")
        print(f"[AI] LM Studio connected: {'yes' if self.lm_studio_available else 'no'}")

    def _check_lm_studio(self) -> bool:
        """Check if LM Studio is available"""
        try:
            response = requests.get(f"{self.local_llm_url}/v1/models", timeout=4)
            return response.status_code == 200
        except requests.RequestException:
            return False

    def get_status(self) -> Dict[str, Any]:
        """Get current AI provider status"""
        self.lm_studio_available = self._check_lm_studio()
        self.is_available = bool(self.gemini_api_key) or self.lm_studio_available
        return {
            "available": self.is_available,
            "gemini": {
                "configured": bool(self.gemini_api_key),
                "model": self._resolved_gemini_model or self.gemini_model,
            },
            "lm_studio": {
                "connected": self.lm_studio_available,
                "url": f"{self.local_llm_url}/v1",
                "model": self.model_name,
            },
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }

    async def analyze_project(self, files_data: List[Dict], analysis_request: Dict) -> Dict:
        """
        Analyze project files using available AI providers
        
        Args:
            files_data: List of file dictionaries with 'path', 'content', 'size', 'extension'
            analysis_request: Dict with 'project_topic', 'problem_statement', 'custom_requirements'
            
        Returns:
            Analysis result dictionary
        """
        if not files_data:
            return self._error_response(
                "No readable files were found. Upload a ZIP or repository containing text source files."
            )

        # Build prompts
        prompt = self._build_prompt(files_data, analysis_request)
        
        # Try Gemini first if configured
        if self.gemini_api_key:
            result, error = self._call_gemini(prompt)
            if result:
                parsed = self._parse_json_response(result)
                if parsed:
                    return parsed
        
        # Fall back to LM Studio
        self.lm_studio_available = self._check_lm_studio()
        if self.lm_studio_available:
            result, error = self._call_lm_studio(prompt)
            if result:
                parsed = self._parse_json_response(result)
                if parsed:
                    return parsed
        
        # Return error if all providers failed
        return self._error_response(
            "All AI providers failed. Check Gemini API key or start LM Studio."
        )

    def _build_prompt(self, files_data: List[Dict], analysis_request: Dict) -> str:
        """Build comprehensive analysis prompt"""
        context_parts = []
        
        # File overview
        context_parts.append(f"## Project Files ({len(files_data)} total)\n")
        
        # Group by type
        files_by_type = {}
        for file in files_data:
            ext = file['extension'] or 'none'
            if ext not in files_by_type:
                files_by_type[ext] = []
            files_by_type[ext].append(file)
        
        context_parts.append("### File Structure:")
        for ext, files in sorted(files_by_type.items()):
            context_parts.append(f"- {ext}: {len(files)} files")
        
        # Include important files
        context_parts.append("\n### Key Files:\n")
        priority_keywords = ['app', 'main', 'index', 'component', 'page', 'route', 'server', 'api']
        sorted_files = sorted(files_data, key=lambda f: 
            any(keyword in f['path'].lower() for keyword in priority_keywords), reverse=True)
        
        for file in sorted_files[:15]:
            context_parts.append(f"\n#### {file['path']}")
            context_parts.append(f"```{file['extension'][1:] if file['extension'].startswith('.') else 'txt'}")
            content = file['content'][:2000]
            if len(file['content']) > 2000:
                content += "\n... (truncated)"
            context_parts.append(content)
            context_parts.append("```")
        
        context = "\n".join(context_parts)
        
        # Build complete prompt
        return f"""Analyze this software project and provide detailed feedback.

## PROJECT FILES
{context}

## REQUIREMENTS
Topic: {analysis_request.get('project_topic', 'Not specified')}
Problem: {analysis_request.get('problem_statement', 'Not specified')}
Custom Requirements: {analysis_request.get('custom_requirements', [])}

## RESPONSE FORMAT (Valid JSON only)
{{
  "executive_summary": {{
    "description": "What the project does (1-2 sentences)",
    "problem_solved": "The main problem it solves",
    "overall_assessment": "Excellent/Good/Needs Improvement"
  }},
  "requirements_mapping": [
    {{
      "requirement": "Specific requirement",
      "implemented": "Yes/No/Partially",
      "implementation_details": "How it's implemented",
      "quality": "Excellent/Good/Poor",
      "missing_elements": "What's missing"
    }}
  ],
  "what_user_built": {{
    "successful": ["Feature 1", "Feature 2"],
    "missing": ["Missing feature"],
    "incomplete": ["Incomplete feature"]
  }},
  "code_quality": {{
    "strengths": ["Strength 1", "Strength 2"],
    "weaknesses": [
      {{"issue": "Issue", "location": "File", "problem": "Why", "impact": "High/Medium/Low"}}
    ]
  }},
  "improvements": [
    {{
      "title": "Improvement title",
      "location": "File name",
      "current_code": "Problematic code",
      "problem": "What's wrong",
      "suggested_fix": "Fixed code",
      "priority": "High/Medium/Low",
      "effort_hours": 1
    }}
  ],
  "architecture_review": {{
    "patterns_used": ["Pattern 1"],
    "organization": "Good/Poor",
    "scalability": "Assessment",
    "maintainability": "Assessment"
  }},
  "performance_security": {{
    "performance_issues": ["Issue 1"],
    "security_concerns": ["Concern 1"]
  }},
  "recommendations": {{
    "high_priority": ["Must fix"],
    "medium_priority": ["Should fix"],
    "low_priority": ["Nice to have"]
  }},
  "final_verdict": {{
    "score": 75,
    "grade": "B",
    "summary": "Overall assessment",
    "next_steps": "What to do next"
  }}
}}

Provide ONLY valid JSON with no additional text."""

    def _call_gemini(self, prompt: str) -> Tuple[Optional[str], Optional[str]]:
        """Call Google Gemini API"""
        try:
            model = self._resolved_gemini_model or self.gemini_model
            if model.lower() == "auto":
                model, error = self._resolve_gemini_model()
                if not model:
                    return None, error
            
            response = requests.post(
                f"{self.gemini_api_base}/models/{model}:generateContent",
                params={"key": self.gemini_api_key},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": self.temperature,
                        "maxOutputTokens": self.max_tokens,
                        "responseMimeType": "application/json",
                    },
                },
                timeout=120,
            )
            
            if response.status_code != 200:
                return None, f"HTTP {response.status_code}"
            
            data = response.json()
            parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            text = "".join(part.get("text", "") for part in parts).strip()
            return text or None, None if text else "Empty response"
        except requests.RequestException as e:
            return None, str(e)

    def _resolve_gemini_model(self) -> Tuple[Optional[str], Optional[str]]:
        """Resolve available Gemini model"""
        try:
            response = requests.get(
                f"{self.gemini_api_base}/models",
                params={"key": self.gemini_api_key},
                timeout=30,
            )
            if response.status_code != 200:
                return None, "Could not list Gemini models"
            
            models = response.json().get("models", [])
            usable = [
                m.get("name", "").replace("models/", "")
                for m in models
                if "generateContent" in m.get("supportedGenerationMethods", [])
            ]
            
            if usable:
                # Prefer flash models
                for name in usable:
                    if "flash" in name.lower():
                        return name, None
                return usable[0], None
            
            return None, "No usable Gemini models found"
        except requests.RequestException as e:
            return None, str(e)

    def _call_lm_studio(self, prompt: str) -> Tuple[Optional[str], Optional[str]]:
        """Call LM Studio locally"""
        try:
            response = requests.post(
                f"{self.local_llm_url}/v1/chat/completions",
                json={
                    "model": self.model_name,
                    "messages": [
                        {"role": "system", "content": "Return only valid JSON."},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": self.temperature,
                    "max_tokens": self.local_max_tokens,
                    "stream": False,
                },
                headers={"Content-Type": "application/json"},
                timeout=180,
            )
            
            if response.status_code != 200:
                return None, f"HTTP {response.status_code}"
            
            data = response.json()
            text = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            return text or None, None if text else "Empty response"
        except requests.RequestException as e:
            return None, str(e)

    def _parse_json_response(self, response: str) -> Optional[Dict]:
        """Parse JSON from AI response"""
        try:
            # Clean up response
            response = response.strip()
            response = re.sub(r'```json\s*', '', response)
            response = re.sub(r'```\s*', '', response)
            
            # Find JSON object
            start = response.find('{')
            if start == -1:
                return None
            
            brace_count = 0
            end = start
            for i, char in enumerate(response[start:], start):
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end = i + 1
                        break
            
            json_str = response[start:end]
            result = json.loads(json_str)
            return result
        except (json.JSONDecodeError, ValueError):
            return None

    def _error_response(self, error_msg: str) -> Dict:
        """Return error response"""
        return {
            "executive_summary": {
                "description": "Analysis failed",
                "problem_solved": "Unable to analyze",
                "overall_assessment": "Needs Improvement"
            },
            "error": error_msg,
            "file_statistics": {
                "total_files": 0,
                "file_types": {}
            }
        }
