"""
Example: How to integrate the Project Analyzer into your existing FastAPI application
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import the analysis router
from project_analyzer.router import router as analysis_router, initialize_analysis

# Create your FastAPI app
app = FastAPI(title="My Awesome Project with Code Analysis")

# Add CORS if needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the analysis system
@app.on_event("startup")
async def startup_event():
    """Initialize analysis components on startup"""
    initialize_analysis()
    print("✅ Project analysis system initialized")

# Include the analysis router
# This will add endpoints:
# - POST /analyze/zip - Analyze ZIP files
# - POST /analyze/github - Analyze GitHub repositories
# - GET /analyze/status - Get AI provider status
app.include_router(analysis_router)

# Your other routes...
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Welcome to my API",
        "analysis_endpoints": {
            "upload_zip": "POST /analyze/zip",
            "github_repo": "POST /analyze/github",
            "status": "GET /analyze/status"
        }
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
