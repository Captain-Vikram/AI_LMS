"""FastAPI router for project analysis endpoints"""

import shutil
import zipfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from routes.project_analyzer.analyzer import ProjectAnalyzer
from routes.project_analyzer.github_utils import GitHubUtils

# Initialize router
router = APIRouter(prefix="/api/project-analyzer", tags=["analysis"])

# Initialize utilities (can be passed in if needed)
analyzer = None
github_utils = None


def initialize_analysis(upload_dir: Path = Path("./uploads")):
    """
    Initialize the analysis router
    
    Args:
        upload_dir: Directory for temporary uploads
    """
    global analyzer, github_utils
    analyzer = ProjectAnalyzer()
    github_utils = GitHubUtils()
    upload_dir.mkdir(exist_ok=True)


@router.get("/status")
async def get_analysis_status():
    """Get current AI provider status"""
    if not analyzer:
        initialize_analysis()
    return analyzer.get_status()


@router.post("/zip")
async def analyze_zip_file(
    file: UploadFile = File(...),
    project_topic: Optional[str] = Form(None),
    problem_statement: Optional[str] = Form(None),
    custom_requirements: Optional[str] = Form(None),
):
    """
    Analyze uploaded ZIP file
    
    Args:
        file: ZIP file to analyze
        project_topic: Optional project topic
        problem_statement: Optional problem statement
        custom_requirements: Optional comma-separated requirements
        
    Returns:
        Analysis results
    """
    if not analyzer:
        initialize_analysis()
    
    temp_zip_path = None
    extract_path = None
    
    try:
        # Validate file
        if not file.filename or not file.filename.endswith('.zip'):
            raise HTTPException(status_code=400, detail="Only ZIP files are allowed")
        
        # Create upload directory
        upload_dir = Path("./uploads")
        upload_dir.mkdir(exist_ok=True)
        
        # Save uploaded zip
        safe_name = Path(file.filename).name
        temp_zip_path = upload_dir / safe_name
        with open(temp_zip_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Extract zip
        extract_path = upload_dir / f"extracted_{safe_name.replace('.zip', '')}"
        extract_path.mkdir(exist_ok=True)
        
        with zipfile.ZipFile(temp_zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_path)
        
        # Read project files
        files_data = await read_project_files(extract_path)
        
        if not files_data:
            raise HTTPException(status_code=400, detail="No readable files found in ZIP")
        
        # Prepare analysis request
        analysis_req = {
            'project_topic': project_topic,
            'problem_statement': problem_statement,
            'custom_requirements': [
                req.strip() for req in (custom_requirements or "").split(',') if req.strip()
            ]
        }
        
        # Analyze project
        result = await analyzer.analyze_project(files_data, analysis_req)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error analyzing ZIP: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Cleanup
        if temp_zip_path and temp_zip_path.exists():
            temp_zip_path.unlink()
        if extract_path and extract_path.exists():
            shutil.rmtree(extract_path)


@router.post("/github")
async def analyze_github_repo(
    repo_url: str = Form(...),
    branch: Optional[str] = Form("main"),
    project_topic: Optional[str] = Form(None),
    problem_statement: Optional[str] = Form(None),
    custom_requirements: Optional[str] = Form(None),
):
    """
    Analyze GitHub repository
    
    Args:
        repo_url: GitHub repository URL
        branch: Branch to analyze (default: main)
        project_topic: Optional project topic
        problem_statement: Optional problem statement
        custom_requirements: Optional comma-separated requirements
        
    Returns:
        Analysis results
    """
    if not analyzer or not github_utils:
        initialize_analysis()
    
    repo_path = None
    
    try:
        # Validate URL
        if not repo_url.startswith(('https://github.com/', 'http://github.com/')):
            raise HTTPException(status_code=400, detail="Invalid GitHub URL")
        
        # Clone repository
        repo_path = await github_utils.clone_repository(repo_url, branch or "main")
        
        # Read project files
        files_data = await github_utils.read_project_files(repo_path)
        
        if not files_data:
            raise HTTPException(status_code=400, detail="No readable files found in repository")
        
        # Prepare analysis request
        analysis_req = {
            'project_topic': project_topic,
            'problem_statement': problem_statement,
            'custom_requirements': [
                req.strip() for req in (custom_requirements or "").split(',') if req.strip()
            ]
        }
        
        # Analyze project
        result = await analyzer.analyze_project(files_data, analysis_req)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error analyzing GitHub repo: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Cleanup
        if repo_path:
            await github_utils.cleanup(repo_path)


async def read_project_files(project_path: Path) -> list:
    """
    Read all project files from directory
    
    Args:
        project_path: Path to project directory
        
    Returns:
        List of file dictionaries
    """
    files_data = []
    exclude_extensions = {
        '.pyc', '.pyo', '.so', '.dll', '.exe', '.jpg', '.jpeg', '.png', '.gif',
        '.webp', '.ico', '.mp4', '.mp3', '.wav', '.zip', '.tar', '.rar', '.7z'
    }
    exclude_dirs = {
        'node_modules', '__pycache__', 'dist', 'build', '.git', '.venv', 'env',
        '.next', 'coverage', 'venv'
    }
    
    for file_path in project_path.rglob("*"):
        # Skip excluded directories
        if any(excluded in file_path.parts for excluded in exclude_dirs):
            continue
        
        if file_path.is_file():
            extension = file_path.suffix.lower()
            
            if extension in exclude_extensions:
                continue
            
            # Skip files larger than 1MB
            try:
                if file_path.stat().st_size > 1024 * 1024:
                    continue
            except OSError:
                continue
            
            try:
                # Try to read as text
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                relative_path = str(file_path.relative_to(project_path))
                files_data.append({
                    'path': relative_path,
                    'content': content[:10000],  # Limit content
                    'size': len(content),
                    'extension': extension
                })
            except Exception:
                # Skip files that can't be read
                continue
    
    return files_data
