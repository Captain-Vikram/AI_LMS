import streamlit as st
from streamlit_ace import st_ace
import docker
import tempfile
import os

st.title("Docker-based Python Code Runner with Ace Editor")

st.write(
    "Enter your Python code below using the Ace Editor. This editor supports syntax highlighting, auto-indentation, and more."
)

# Use Ace Editor widget from streamlit-ace for a rich code editing experience
python_code = st_ace(
    language="python",  # Set language for syntax highlighting
    theme="monokai",  # Choose your preferred theme
    keybinding="vscode",  # Use VSCode-like keybindings
    font_size=14,  # Set font size
    tab_size=4,  # Set tab size for indentation
    wrap=True,  # Wrap long lines
    auto_update=True,  # Update code variable in real-time
    height=300,  # Editor height in pixels
    placeholder="Type your Python code here..."
)

if st.button("Run Code"):
    if not python_code or python_code.strip() == "":
        st.error("Please enter some code before running.")
    else:
        # Create a temporary directory to store the code file
        with tempfile.TemporaryDirectory() as tmpdir:
            code_file = os.path.join(tmpdir, "code.py")
            with open(code_file, "w") as f:
                f.write(python_code)

            # Initialize Docker client
            client = docker.from_env()

            # Command to run the Python file inside the container
            run_command = "python /code/code.py"

            try:
                # Run the Docker container with the temporary directory mounted to /code
                output = client.containers.run(
                    image="python:3.10",  # Specify desired Python version
                    command=run_command,
                    volumes={tmpdir: {'bind': '/code', 'mode': 'rw'}},
                    remove=True,  # Automatically remove the container when done
                    stdout=True,
                    stderr=True,
                )
                st.subheader("Output:")
                st.code(output.decode("utf-8"))
            except docker.errors.ContainerError as ce:
                st.error("Error during code execution:")
                st.error(ce.stderr.decode("utf-8"))
            except Exception as e:
                st.error(f"Unexpected error: {e}")

st.markdown(
    """
---
*How It Works:*
1. *Ace Editor:*  
   The Ace Editor widget provides a feature-rich code editing interface (with proper indentation, syntax highlighting, etc.).
2. *Temporary File:*  
   The app writes the user's Python code to a temporary file.
3. *Docker Container:*  
   A Docker container based on the official Python image runs the code. The temporary directory is mounted into the container.
4. *Execution & Output:*  
   The command python /code/code.py is executed inside the container, and the output (or any errors) is captured and displayed.

Ensure Docker is installed, running, and accessible from your local machine.
"""
)