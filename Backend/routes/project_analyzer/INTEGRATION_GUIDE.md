# � Project Analyzer - Integration Guide

Complete step-by-step guide to integrate the Project Analyzer module into your existing FastAPI project.

## 📋 Table of Contents

1. [Installation](#installation)
2. [Basic Setup](#basic-setup)
3. [Configuration](#configuration)
4. [Integration Options](#integration-options)
5. [API Usage](#api-usage)
6. [Error Handling](#error-handling)
7. [Performance](#performance)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Installation

### Step 1: Copy Module Files

Copy the entire `project_analyzer` module to your FastAPI project:

```bash
# If integrating into existing project
cp -r EXPORT_FOR_INTEGRATION /path/to/your/project/project_analyzer

# Or organize as submodule
mkdir -p your_project/modules
cp -r EXPORT_FOR_INTEGRATION /path/to/your/project/modules/project_analyzer
```

Your project structure will look like:
```
your_fastapi_project/
├── main.py                          # Your main FastAPI app
├── requirements.txt
├── .env
├── project_analyzer/               # ← NEW
│   ├── __init__.py
│   ├── analyzer.py
│   ├── router.py
│   ├── models.py
│   ├── github_utils.py
│   ├── .env_template
│   └── requirements_additions.txt
└── ... (your other code)
```

### Step 2: Install Dependencies

Add to your `requirements.txt`:

```txt
requests==2.31.0
GitPython==3.1.40
python-dotenv==1.0.0
```

Or directly with pip:
```bash
pip install requests GitPython python-dotenv
```

### Step 3: Update .env

Copy the template to your project root:

```bash
cp project_analyzer/.env_template .env
```

Edit `.env` with your configuration (see Configuration section below).

---

## ⚙️ Basic Setup

### Option A: Minimal Setup (Recommended)

Add to your `main.py`:

```python
from fastapi import FastAPI
from project_analyzer.router import router, initialize_analysis

app = FastAPI()

# Initialize on startup
@app.on_event("startup")
async def startup():
    initialize_analysis()

# Include all analysis endpoints
app.include_router(router)

# Your existing code...
```

This adds three endpoints:
- `GET /analyze/status` - Check AI provider status
- `POST /analyze/zip` - Analyze ZIP file
- `POST /analyze/github` - Analyze GitHub repo

### Option B: Nested Routes

Include under a prefix:

```python
from fastapi import FastAPI
from project_analyzer.router import router, initialize_analysis

app = FastAPI()

@app.on_event("startup")
async def startup():
    initialize_analysis()

# Routes available at /api/v1/analyze/*
app.include_router(
    router,
    prefix="/api/v1",
    tags=["Code Analysis"]
)
```

### Option C: Custom Initialization

For more control:

```python
from fastapi import FastAPI
from project_analyzer.router import initialize_analysis
from project_analyzer.analyzer import ProjectAnalyzer
from project_analyzer.github_utils import GitHubUtils

app = FastAPI()

# Initialize when needed
analyzer = None
github = None

@app.on_event("startup")
async def startup():
    global analyzer, github
    analyzer = ProjectAnalyzer()
    github = GitHubUtils()
    print(f"AI Status: {analyzer.get_status()}")

# Now use analyzer and github in your endpoints
@app.post("/my_analysis")
async def analyze_custom(data):
    result = await analyzer.analyze_project(files, {})
    return result
```

---

## 🔧 Configuration

### Environment Variables

Create `.env` in your project root:

```env
# ============================================
# AI Provider Configuration
# ============================================

# Google Gemini API (Optional - for cloud analysis)
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=auto

# LM Studio (Optional - for local analysis)  
LOCAL_LLM_URL=http://localhost:1234
MODEL_NAME=qwen2.5-coder-3b-instruct

# ============================================
# Analysis Tuning
# ============================================

# Determinism (0.0=always same, 1.0=random)
MODEL_TEMPERATURE=0.2

# Max response tokens (higher = longer analysis)
MODEL_MAX_TOKENS=3000
LOCAL_MODEL_MAX_TOKENS=1000

# Context budgets (token limits)
LOCAL_PROMPT_CHAR_BUDGET=3800
CHUNK_CHAR_BUDGET=2200
MAX_REVIEW_CHUNKS=20
```

### Configuration Scenarios

**Scenario 1: Cloud-Only (Recommended for Production)**
```env
GEMINI_API_KEY=abc123xyz...
LOCAL_LLM_URL=  # Leave empty
```

**Scenario 2: Local-Only (Recommended for Privacy)**
```env
GEMINI_API_KEY=  # Leave empty
LOCAL_LLM_URL=http://localhost:1234
MODEL_NAME=qwen2.5-coder-3b-instruct
```

**Scenario 3: Hybrid (Best Reliability)**
```env
GEMINI_API_KEY=abc123xyz...
LOCAL_LLM_URL=http://localhost:1234
# Will try Gemini first, fall back to LM Studio
```

### Getting API Keys

**Google Gemini:**
1. Go to https://aistudio.google.com/apikey
2. Click "Create API Key"
3. Copy and paste into GEMINI_API_KEY

**LM Studio:**
1. Download from https://lmstudio.ai
2. Launch the application
3. Load any model from the library
4. Default runs on http://localhost:1234

---

## 🔌 Integration Options

### Option 1: Direct Router Inclusion (Easiest)

```python
from fastapi import FastAPI
from project_analyzer.router import router, initialize_analysis

app = FastAPI()

@app.on_event("startup")
async def startup():
    initialize_analysis()

app.include_router(router)
```

**Endpoints Available:**
```
GET    /analyze/status
POST   /analyze/zip
POST   /analyze/github
```

### Option 2: Custom Endpoints

```python
from fastapi import FastAPI, UploadFile, File, Form
from project_analyzer.analyzer import ProjectAnalyzer
from project_analyzer.models import AnalysisRequest
import asyncio

app = FastAPI()
analyzer = None

@app.on_event("startup")
async def startup():
    global analyzer
    analyzer = ProjectAnalyzer()

@app.post("/custom/analyze")
async def custom_analysis(
    file: UploadFile = File(...),
    topic: str = Form(None)
):
    # Your custom logic here
    import zipfile
    import io
    
    # Read ZIP
    contents = await file.read()
    files_data = []
    
    with zipfile.ZipFile(io.BytesIO(contents)) as z:
        for name in z.namelist():
            try:
                content = z.read(name).decode('utf-8', errors='ignore')
                files_data.append({
                    'path': name,
                    'content': content,
                    'size': len(content),
                    'extension': name.split('.')[-1] if '.' in name else ''
                })
            except:
                pass
    
    # Analyze
    request = AnalysisRequest(
        project_topic=topic,
        problem_statement=None,
        custom_requirements=[]
    )
    
    result = await analyzer.analyze_project(files_data, request.dict())
    return result
```

### Option 3: Background Job Integration

With Celery:

```python
from celery import Celery
from project_analyzer.analyzer import ProjectAnalyzer
import json

celery = Celery('tasks')
analyzer = ProjectAnalyzer()

@celery.task
def analyze_project_async(files_json: str, request_dict: dict):
    """Analyze project in background"""
    files_data = json.loads(files_json)
    result = analyzer.analyze_project(files_data, request_dict)
    
    # Store result in database
    # save_analysis_result(result)
    
    return result

# In your FastAPI endpoint:
@app.post("/analyze/async")
async def start_analysis(request: AnalysisRequest):
    # Queue async job
    task = analyze_project_async.delay(files_json, request.dict())
    return {"task_id": task.id}

@app.get("/analyze/result/{task_id}")
async def get_result(task_id: str):
    from celery.result import AsyncResult
    result = AsyncResult(task_id)
    
    if result.ready():
        return result.result
    else:
        return {"status": "pending"}
```

### Option 4: WebSocket for Real-time Updates

```python
from fastapi import WebSocket

@app.websocket("/ws/analyze")
async def websocket_analyze(websocket: WebSocket):
    await websocket.accept()
    
    # Receive file data
    data = await websocket.receive_json()
    files_data = data['files']
    
    # Send status
    await websocket.send_json({"status": "analyzing", "progress": 0})
    
    # Analyze
    result = await analyzer.analyze_project(files_data, {})
    
    # Send result
    await websocket.send_json({"status": "complete", "result": result})
    
    await websocket.close()
```

---

## 📡 API Usage

### Endpoint 1: GET /analyze/status

Check AI provider availability.

**Response:**
```json
{
  "available": true,
  "gemini": {
    "configured": true,
    "model": "gemini-2.5-flash"
  },
  "lm_studio": {
    "connected": true,
    "url": "http://localhost:1234/v1"
  },
  "temperature": 0.2,
  "max_tokens": 3000
}
```

### Endpoint 2: POST /analyze/zip

Analyze a ZIP file containing source code.

**Form Parameters:**
```
file               - ZIP file (required)
project_topic      - What project does (optional)
problem_statement  - Problem it solves (optional)  
custom_requirements - Comma-separated list (optional)
```

**Example Request:**
```bash
curl -X POST http://localhost:8000/analyze/zip \
  -F "file=@myproject.zip" \
  -F "project_topic=Web Application" \
  -F "problem_statement=Build a task management system" \
  -F "custom_requirements=async/await,type hints,documentation"
```

**Response Format:**
```json
{
  "executive_summary": {...},
  "requirements_mapping": [...],
  "code_quality": {...},
  "improvements": [...],
  "architecture_review": {...},
  "performance_security": {...},
  "recommendations": {...},
  "final_verdict": {...},
  "file_statistics": {...}
}
```

### Endpoint 3: POST /analyze/github

Analyze a GitHub repository.

**Form Parameters:**
```
repo_url           - GitHub URL (required)
branch             - Branch to analyze (default: main)
project_topic      - Project description (optional)
problem_statement  - Problem statement (optional)
custom_requirements - Comma-separated list (optional)
```

**Example Request:**
```bash
curl -X POST http://localhost:8000/analyze/github \
  -F "repo_url=https://github.com/django/django" \
  -F "branch=main"
```

---

## ⚠️ Error Handling

### Common Errors and Solutions

**Error 1: "All AI providers failed"**
```python
# Check status first
@app.get("/check")
async def check():
    status = analyzer.get_status()
    if not status['available']:
        return {"error": "No AI provider available"}
    return {"ok": True}
```

**Error 2: "Invalid ZIP file"**
```python
# Validate before analysis
import zipfile

try:
    z = zipfile.ZipFile(file_path)
    z.testzip()  # Validates file
except zipfile.BadZipFile:
    return {"error": "Invalid ZIP file"}
```

**Error 3: "Failed to clone repository"**
```python
# Validate GitHub URL
import re

def is_valid_github_url(url):
    pattern = r'https://github\.com/[\w-]+/[\w.-]+'
    return bool(re.match(pattern, url))

if not is_valid_github_url(repo_url):
    return {"error": "Invalid GitHub URL"}
```

### Global Error Handler

```python
from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI()

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "error": str(exc),
            "type": type(exc).__name__
        }
    )
```

---

## ⚡ Performance

### Timeout Handling

Analysis can take 30-120 seconds depending on project size.

**For nginx/gunicorn:**
```python
from contextlib import asynccontextmanager
import asyncio

@app.post("/analyze/zip", timeout=180)  # 3 minute timeout
async def analyze_zip(...):
    ...
```

### Reduce Analysis Time

1. **Lower max_tokens:**
   ```env
   MODEL_MAX_TOKENS=1500
   ```

2. **Use faster model:**
   ```env
   MODEL_NAME=qwen2-0.5b  # Faster but lower quality
   ```

3. **Reduce review chunks:**
   ```env
   MAX_REVIEW_CHUNKS=10
   ```

### Scale with Background Jobs

```python
from rq import Queue
from redis import Redis

redis_conn = Redis()
q = Queue(connection=redis_conn)

@app.post("/analyze/async")
async def analyze_async(request: AnalysisRequest):
    job = q.enqueue(analyze_worker, request.dict())
    return {"job_id": job.id}
```

---

## 🔍 Troubleshooting

### Issue: "ModuleNotFoundError: No module named 'project_analyzer'"

```bash
# Solution 1: Install in development mode
pip install -e .

# Solution 2: Add to PYTHONPATH
export PYTHONPATH=$PYTHONPATH:/path/to/project

# Solution 3: Check import path
# In main.py, use correct path:
from project_analyzer.router import router
# or
from modules.project_analyzer.router import router  # if nested
```

### Issue: "CORS error when calling /analyze/zip"

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Issue: "Timeout: No response from LM Studio"

```bash
# Check if LM Studio is running
curl http://localhost:1234/v1/models

# Or use Gemini only
# Set GEMINI_API_KEY in .env and leave LOCAL_LLM_URL empty
```

### Issue: "Out of memory with large projects"

```python
# Reduce chunk budget in .env
CHUNK_CHAR_BUDGET=1000  # Process smaller chunks
LOCAL_PROMPT_CHAR_BUDGET=1500  # Smaller prompts

# Or limit file count
MAX_REVIEW_CHUNKS=5  # Review only 5 files
```

### Issue: "JSON parsing errors from AI"

The system has built-in fallback parsing. If still occurring:

```python
# Check model temperature (should be low)
MODEL_TEMPERATURE=0.1  # Lower = more deterministic

# Or try different model
MODEL_NAME=llama2  # Different model might produce better JSON
```

### Debug Mode

Enable verbose logging:

```python
import logging

logging.basicConfig(level=logging.DEBUG)

analyzer = ProjectAnalyzer()
# Now you'll see detailed logs
```

---

## 📖 Quick Reference

### File Upload (ZIP)
```python
@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    result = await analyzer.analyze_project(...)
    return result
```

### Check Status
```python
@app.get("/status")
async def status():
    return analyzer.get_status()
```

### Error Response
```json
{
  "error": "Error message",
  "type": "ErrorType",
  "status": "error"
}
```

### Success Response
```json
{
  "executive_summary": {...},
  "code_quality": {...},
  "final_verdict": {
    "score": 85,
    "grade": "B+"
  }
}
```

---

## 🎯 Next Steps

1. ✅ Copy files to your project
2. ✅ Install dependencies
3. ✅ Configure .env
4. ✅ Add to main.py
5. ✅ Test with: `curl http://localhost:8000/analyze/status`
6. ✅ Deploy!

Need help? Check:
- **README.md** - Feature overview
- **example_integration.py** - Working code examples
- **analyzer.py** - Docstrings for all methods
- **models.py** - Request/response schemas

Happy analyzing! 🚀
