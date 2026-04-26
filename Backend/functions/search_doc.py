
import json
import os
import re
from dotenv import load_dotenv
import functions.llm_adapter_async as genai
from langchain_community.tools import TavilySearchResults
from langchain_community.utilities import GoogleSerperAPIWrapper
# from duckduckgo_search import DDGS  # Install via `pip install duckduckgo-search`
# from duckduckgo_search.exceptions import DuckDuckGoSearchException
import asyncio

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

    
def tavily_search(query):
    """
    Perform a Tavily search and return relevant documents.
    """
    try:
        tavily_tool = TavilySearchResults()
        results = tavily_tool.run(query)
        return results
    except Exception as e:
        print(f"Tavily search failed: {e}")
        return []

async def generate_skill_resources(input_json):
    """
    Takes JSON data (string or dict) as input, extracts skills from the 'skill_gaps' areas,
    generates a learning workflow for each skill via a generative model, retrieves Tavily documents,
    and DuckDuckGo links, and returns a list of skills with their respective resources.

    Returns:
        A list of dictionaries in the format:
        [
            {
                "skill": "Skill Name",
                "documents": [
                    {"title": "Doc Title 1", "content": "Doc Content 1", "link": "Doc Link 1"},
                    ...
                ],
                "links": [
                    {"title": "Link Title 1", "link": "Link URL 1"},
                    ...
                ]
            },
            ...
        ]
    """
    # Load environment variables
    load_dotenv(override=True)

    # Parse input JSON if it is a string
    if isinstance(input_json, str):
        data = json.loads(input_json)
    else:
        data = input_json

    # Extract skills from the JSON data
    improvement_areas = data.get("skill_gaps", {}).get("areas", [])
    skills = [area["skill"] for area in improvement_areas if "skill" in area]
    
    generation_config = {
        "temperature": 0.2,       # More deterministic output
        "top_p": 0.95,
        "top_k": 64,
        "max_output_tokens": 3000 # Allows longer responses
    }
    model = genai.GenerativeModelAsync(
        model_name=os.getenv("LMSTUDIO_MODEL"),
        generation_config=generation_config
    )

    # Helper function: clean the generative model's JSON response
    def clean_json_response(response_text):
        cleaned_text = re.sub(r"```json|```", "", response_text).strip()
        return cleaned_text

    # Helper function: generate a workflow (list of concepts) for a given skill
    async def generate_workflow(skill):
        prompt = f"""Generate a structured JSON response for learning {skill}, listing essential concepts in a logical order. The response should follow this format:  
{{
  "skill": "{skill}",
  "concepts": [
    "keyword1",
    "keyword2",
    "keyword3"
    // up to a maximum of 10 keywords
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
                "concepts": [
                    f"{skill} fundamentals",
                    f"{skill} core concepts",
                    f"{skill} practical projects",
                ],
            }
            return json.dumps(fallback_payload, ensure_ascii=True)

    # For each skill, generate the workflow, Tavily documents, and DuckDuckGo links
    result = []
    for skill in skills:
        print(f"\nGenerating workflow for: {skill}")
        workflow_json = await generate_workflow(skill)

        try:
            workflow_data = json.loads(workflow_json)
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON for {skill}: {e}\nResponse: {workflow_json}")
            workflow_data = {
                "skill": skill,
                "concepts": [
                    f"{skill} fundamentals",
                    f"{skill} core concepts",
                    f"{skill} practical projects",
                ],
            }

        # Get list of concepts from the workflow
        concepts = workflow_data.get("concepts", [])

        # Generate Tavily documents
        tavily_query = f"{skill} learning blogs"
        # Tavily run is usually blocking, but for now we'll call it.
        # Ideally we'd use an async search tool.
        tavily_docs = tavily_search(tavily_query)

        # Generate links
        duckduckgo_query = f"find me blogs on topic {skill}"
        # llm_serper is also blocking
        links = llm_serper(duckduckgo_query)

        # Append results for the current skill
        result.append({
            "skill": skill,
            "documents": tavily_docs,
            "blogs": links
        })

    return result

# # Example usage
# if __name__ == "__main__":
#     sample_json = """
#     {
#       "score": {
#         "correct": 5,
#         "total": 10,
#         "percentage": 50
#       },
#       "assessed_level": "intermediate",
#       "question_feedback": [
#         {
#           "question_index": 0,
#           "is_correct": true,
#           "correct_answer": 1,
#           "explanation": "NumPy is the fundamental package for scientific computing in Python, providing support for large, multi-dimensional arrays and matrices."
#         }
#       ],
#       "skill_gaps": {
#         "overall": "Based on your assessment, we've identified areas for improvement",
#         "areas": [
#           {
#             "skill": "Data Analysis",
#             "level": "satisfactory"
#           },
#           {
#             "skill": "Programming",
#             "level": "needs improvement"
#           }
#         ]
#       },
#       "recommendations": [
#         {
#           "title": "Machine Learning Algorithms",
#           "type": "course"
#         }
#       ]
#     }
#     """
#     playlists = generate_skill_resources(sample_json)
#     print(json.dumps(playlists, indent=4))

# response=llm_serper("Data Science")
# print(response)