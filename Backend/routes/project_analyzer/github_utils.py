"""GitHub Repository Utilities"""

import os
import shutil
from pathlib import Path
from typing import Dict, List

from git import Repo


class GitHubUtils:
    """Utilities for cloning and reading GitHub repositories"""
    
    def __init__(self, temp_dir: str = "./temp_repos"):
        """
        Initialize GitHub utilities
        
        Args:
            temp_dir: Directory to store cloned repositories
        """
        self.temp_dir = temp_dir
        os.makedirs(temp_dir, exist_ok=True)
    
    async def clone_repository(self, repo_url: str, branch: str = "main") -> str:
        """
        Clone a GitHub repository
        
        Args:
            repo_url: GitHub repository URL
            branch: Branch to clone (default: main)
            
        Returns:
            Local path to cloned repository
        """
        repo_name = repo_url.rstrip('/').split('/')[-1].replace('.git', '')
        local_path = os.path.join(self.temp_dir, repo_name)
        
        # Remove if exists
        if os.path.exists(local_path):
            shutil.rmtree(local_path)
        
        try:
            Repo.clone_from(repo_url, local_path, branch=branch, depth=1)
            return local_path
        except Exception as e:
            raise Exception(f"Failed to clone repository: {str(e)}")
    
    async def read_project_files(self, repo_path: str) -> List[Dict]:
        """
        Read all relevant project files from repository
        
        Args:
            repo_path: Path to repository
            
        Returns:
            List of file dictionaries with path, content, size, extension
        """
        files_data = []
        
        # Directories to exclude
        exclude_dirs = {
            '.git', '__pycache__', 'node_modules', 'dist', 'build', '.venv', 'env',
            '.next', 'coverage', '.pytest_cache', '.vscode', '.idea', 'venv'
        }
        
        # File extensions to exclude (binary, media, etc.)
        exclude_extensions = {
            '.pyc', '.pyo', '.so', '.dll', '.exe', '.jpg', '.jpeg', '.png', '.gif',
            '.webp', '.ico', '.mp4', '.mp3', '.wav', '.zip', '.tar', '.rar', '.7z',
            '.pdf', '.woff', '.woff2', '.ttf', '.bin', '.o', '.a'
        }
        
        for root, dirs, files in os.walk(repo_path):
            # Skip excluded directories
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            
            for file in files:
                file_path = os.path.join(root, file)
                extension = os.path.splitext(file)[1].lower()
                
                # Skip binary files
                if extension in exclude_extensions:
                    continue
                
                # Skip large files (>1MB)
                try:
                    if os.path.getsize(file_path) > 1024 * 1024:
                        continue
                except OSError:
                    continue
                
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    
                    relative_path = os.path.relpath(file_path, repo_path)
                    files_data.append({
                        'path': relative_path,
                        'content': content,
                        'size': len(content),
                        'extension': extension
                    })
                except Exception:
                    # Skip files that can't be read
                    continue
        
        return files_data
    
    async def cleanup(self, repo_path: str):
        """
        Clean up temporary repository
        
        Args:
            repo_path: Path to repository to delete
        """
        if os.path.exists(repo_path):
            shutil.rmtree(repo_path)
