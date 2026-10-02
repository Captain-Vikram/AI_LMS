# 🎯 Project Analyzer - Export Package

**AI-Powered Code Review System for FastAPI**

This is a complete, production-ready module for analyzing software projects using AI. It supports both cloud-based (Google Gemini) and local (LM Studio) analysis.

## ⭐ Features

✅ **Dual AI Providers**
- Google Gemini API (powerful cloud analysis)
- LM Studio (free, local, offline analysis)
- Automatic fallback between providers

✅ **Comprehensive Analysis**
- Executive summaries
- Requirements mapping
- Code quality assessment  
- Performance & security review
- Specific improvement suggestions with code examples
- Prioritized recommendations
- Overall scoring (0-100) and grading (A-F)

✅ **Multiple Input Methods**
- ZIP file upload
- GitHub repository analysis
- Custom requirements matching

✅ **Easy Integration**
- Drop-in FastAPI router
- Modular design
- Async/await support
- No database required
- CORS enabled

## 📦 What's Included

```
EXPORT_FOR_INTEGRATION/
├── analyzer.py                 # Core AI analyzer
├── github_utils.py             # GitHub cloning & reading
├── models.py                   # Pydantic models
├── router.py                   # FastAPI router
├── __init__.py                 # Python module init
├── .env_template               # Configuration template
├── requirements_additions.txt   # Dependencies to add
├── example_integration.py       # Integration example
├── INTEGRATION_GUIDE.md         # Full integration guide
└── README.md                    # This file
```

## 🚀 Quick Start

### 1. Copy to Your Project
```bash
# Copy the entire folder to your FastAPI project
cp -r EXPORT_FOR_INTEGRATION your_project/project_analyzer
```

### 2. Install Dependencies
```bash
pip install requests GitPython python-dotenv
```

### 3. Add to Your FastAPI App
```python
from fastapi import FastAPI
from project_analyzer.router import router, initialize_analysis

app = FastAPI()

@app.on_event("startup")
async def startup():
    initialize_analysis()

app.include_router(router)
```

### 4. Configure Environment
```bash
# Copy template
cp .env_template .env

# Edit .env with your settings
# - Set GEMINI_API_KEY for cloud analysis, OR
# - Configure LOCAL_LLM_URL for LM Studio
```

### 5. Test
```bash
curl http://localhost:8000/analyze/status
```

## 📊 API Endpoints

### POST /analyze/zip
Upload and analyze a ZIP file

**Form Data:**
- `file` (required): ZIP file with source code
- `project_topic` (optional): What the project does
- `problem_statement` (optional): Problem it solves
- `custom_requirements` (optional): Comma-separated requirements

**Example:**
```bash
curl -X POST http://localhost:8000/analyze/zip \
  -F "file=@project.zip" \
  -F "project_topic=Web App" \
  -F "problem_statement=Build a todo app"
```

### POST /analyze/github
Analyze a GitHub repository

**Form Data:**
- `repo_url` (required): GitHub URL (e.g., https://github.com/user/repo)
- `branch` (optional): Branch to analyze (default: main)
- `project_topic` (optional): Project description
- `problem_statement` (optional): Problem statement
- `custom_requirements` (optional): Comma-separated requirements

**Example:**
```bash
curl -X POST http://localhost:8000/analyze/github \
  -F "repo_url=https://github.com/facebook/react" \
  -F "branch=main"
```

### GET /analyze/status
Check AI provider status

**Response:**
```json
{
  "available": true,
  "gemini": {"configured": true, "model": "gemini-2.5-flash"},
  "lm_studio": {"connected": true, "url": "http://localhost:1234/v1"}
}
```

## 📋 Response Format

All analysis endpoints return:
```json
{
  "executive_summary": {
    "description": "What the project does",
    "problem_solved": "Main problem it solves",
    "overall_assessment": "Excellent/Good/Needs Improvement"
  },
  "requirements_mapping": [
    {
      "requirement": "Feature name",
      "implemented": "Yes/No/Partially",
      "quality": "Excellent/Good/Poor"
    }
  ],
  "code_quality": {
    "strengths": ["Strength 1", "Strength 2"],
    "weaknesses": [
      {
        "issue": "Issue description",
        "location": "File name",
        "problem": "Why it's a problem",
        "impact": "High/Medium/Low"
      }
    ]
  },
  "improvements": [
    {
      "title": "Specific improvement",
      "location": "File",
      "current_code": "Current implementation",
      "problem": "What's wrong",
      "suggested_fix": "Better implementation",
      "priority": "High/Medium/Low",
      "effort_hours": 2
    }
  ],
  "final_verdict": {
    "score": 75,
    "grade": "B",
    "summary": "Overall assessment",
    "next_steps": "Recommended actions"
  }
}
```

## ⚙️ Configuration

### Environment Variables

```env
# Google Gemini API (Optional - Cloud Analysis)
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=auto

# LM Studio (Optional - Local Analysis)
LOCAL_LLM_URL=http://localhost:1234
MODEL_NAME=qwen2.5-coder-3b-instruct

# Analysis Settings
MODEL_TEMPERATURE=0.2           # 0.0-1.0
MODEL_MAX_TOKENS=3000           # Max response size
LOCAL_MODEL_MAX_TOKENS=1000
LOCAL_PROMPT_CHAR_BUDGET=3800
CHUNK_CHAR_BUDGET=2200
MAX_REVIEW_CHUNKS=20
```

### Provider Setup

**For Google Gemini:**
1. Get API key: https://aistudio.google.com/apikey
2. Add to .env: `GEMINI_API_KEY=your_key`

**For LM Studio:**
1. Download: https://lmstudio.ai
2. Start application and load a model
3. Ensure running on http://localhost:1234

**For Both (Recommended):**
- Configure both in .env
- System tries Gemini first, falls back to LM Studio

## 🔗 Integration Examples

### Example 1: Simple Router Inclusion
```python
from fastapi import FastAPI
from project_analyzer.router import router, initialize_analysis

app = FastAPI()

@app.on_event("startup")
async def startup():
    initialize_analysis()

app.include_router(router)  # Adds /analyze/* endpoints
```

### Example 2: Custom Integration
```python
from project_analyzer.analyzer import ProjectAnalyzer
from project_analyzer.github_utils import GitHubUtils

analyzer = ProjectAnalyzer()
github = GitHubUtils()

@app.post("/my_analysis")
async def analyze_custom(file_data):
    result = await analyzer.analyze_project(file_data, {})
    # Custom processing...
    return result
```

### Example 3: Background Jobs
```python
from celery import Celery
from project_analyzer.analyzer import ProjectAnalyzer

celery = Celery()
analyzer = ProjectAnalyzer()

@celery.task
def analyze_async(files, req):
    result = analyzer.analyze_project(files, req)
    # Save to database
    store_result(result)
```

## 🐛 Troubleshooting

### "All AI providers failed"
```
✅ Solution:
1. Check GEMINI_API_KEY in .env (if using Gemini)
2. Start LM Studio and load a model
3. Verify LM Studio: curl http://localhost:1234/v1/models
```

### "No readable files found"
```
✅ Solution:
1. ZIP must contain text source files (.py, .js, .ts, etc.)
2. Check file sizes (max 1MB per file)
3. Avoid binary-only projects
```

### "Failed to clone repository"
```
✅ Solution:
1. Verify GitHub URL format: https://github.com/user/repo
2. Repository must be public or you need auth token
3. Branch must exist (default: main)
```

### Timeout or "Request took too long"
```
✅ Solution:
1. Reduce MODEL_MAX_TOKENS in .env
2. Use a faster AI model
3. Restart LM Studio or Gemini service
```

## 📚 Documentation

- **INTEGRATION_GUIDE.md** - Complete integration instructions
- **example_integration.py** - Full working example
- **analyzer.py** - Detailed docstrings
- **router.py** - Endpoint documentation

## 🎯 Use Cases

- 📝 Code review automation
- 🎓 Student project feedback
- 🏢 Team code quality assessment
- 📊 Portfolio project analysis
- 🤖 Automated quality gates in CI/CD
- 🔍 Architecture review
- 🚀 Performance and security audits

## 💡 Pro Tips

1. **Start with LM Studio** - It's free and runs locally
2. **Use Gemini for complex projects** - Better quality on large codebases
3. **Hybrid mode is best** - Configure both for reliability
4. **Lower temperature for consistency** - Use 0.1-0.3 for reviews
5. **Increase max_tokens for large projects** - Default 3000 might be low
6. **Run in background** - Analyses can take 30-120 seconds

## 📦 Module Size

- Total: ~50KB
- No external database required
- Stateless - scales horizontally
- Can run on serverless platforms

## 🔐 Security

- ✅ No data sent anywhere (LM Studio local option)
- ✅ API keys from environment only
- ✅ CORS configurable
- ✅ Rate limiting ready
- ✅ File upload validation

## 🌟 Features Comparison

| Feature | LM Studio | Gemini |
|---------|-----------|--------|
| Cost | Free | Free tier + paid |
| Speed | Fast | Varies |
| Quality | Good | Excellent |
| Privacy | 100% | Google has data |
| Offline | ✅ | ❌ |
| No API key | ✅ | ❌ |

## 📞 Support

1. Check **INTEGRATION_GUIDE.md** for detailed help
2. Review **example_integration.py** for working code
3. Check logs in your FastAPI application
4. Verify provider status: `GET /analyze/status`

## 📄 License

Use in your projects with attribution appreciated.

## 🎉 Ready?

1. Copy files to your project
2. Install dependencies
3. Configure .env
4. Add to FastAPI app
5. Start analyzing!

**Happy coding! 🚀**
