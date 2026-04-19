FROM python:3.10-slim

# Set the working directory
WORKDIR /app

# System deps used by portable RAG speech/media workflows
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ffmpeg \
	&& rm -rf /var/lib/apt/lists/*

ENV PORTABLE_DATA_DIR=/app/data/portable_rag

# Copy only requirements first to leverage Docker cache
COPY requirements.txt ./

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the FastAPI port
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]