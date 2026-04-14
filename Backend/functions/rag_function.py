import os
import json
import re
from typing import Dict, List, Any, Optional
from tenacity import retry, stop_after_attempt, wait_exponential
import numpy as np
from datetime import timedelta

# Langchain imports
from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS
from functions.langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from functions.transcript_utils import fetch_transcript_entries
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser


def extract_video_id(youtube_url):
    """
    Extract the video ID from a YouTube URL.
    Supports various YouTube URL formats.
    """
    # Regular expression to match various YouTube URL formats
    youtube_regex = (
        r'(https?://)?(www\.)?'
        r'(youtube|youtu|youtube-nocookie)\.(com|be)/'
        r'(watch\?v=|embed/|v/|.+\?v=)?([^&=%\?]{11})'
    )

    youtube_match = re.match(youtube_regex, youtube_url)

    if youtube_match:
        return youtube_match.group(6)

    return None


def format_timestamp(seconds):
    """
    Format seconds into HH:MM:SS timestamp.

    Args:
        seconds (float): Time in seconds

    Returns:
        str: Formatted timestamp
    """
    td = timedelta(seconds=int(seconds))
    hours, remainder = divmod(td.seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def get_transcript(video_id, languages=['en']):
    """
    Get the transcript for a YouTube video.
    Will try preferred languages first, but will use any available if those aren't found.

    Args:
        video_id (str): YouTube video ID
        languages (list): List of language codes to try, in order of preference

    Returns:
        list: List of transcript entries with 'timestamp' and 'text' keys
    """
    try:
        transcript_data = fetch_transcript_entries(video_id, languages)

        # Format the transcript data into a list of entries
        transcriptions = []
        for entry in transcript_data:
            start_time = float(entry.get('start', 0))
            # Convert seconds to HH:MM:SS format
            formatted_timestamp = format_timestamp(start_time)
            duration = float(entry.get('duration', 0) or 0)

            transcriptions.append({
                "timestamp": formatted_timestamp,
                "start_seconds": start_time,
                "duration": duration,
                "end_seconds": start_time + duration,
                "text": entry.get('text', '')
            })

        return transcriptions

    except Exception as e:
        raise Exception(f"Error retrieving transcript: {str(e)}")


def create_langchain_documents(transcriptions, chunk_size=5, chunk_overlap=1):
    """
    Convert transcript entries to LangChain Document objects with metadata.

    Args:
        transcriptions (list): List of transcript entries
        chunk_size (int): Number of transcript entries per chunk
        chunk_overlap (int): Number of overlapping entries between chunks

    Returns:
        list: List of LangChain Document objects
    """
    documents = []

    # Process transcript in chunks
    for i in range(0, len(transcriptions), chunk_size - chunk_overlap):
        # Get chunk entries
        chunk_entries = transcriptions[i:i + chunk_size]

        if not chunk_entries:
            continue

        # Combine text content from chunk
        chunk_text = " ".join([entry["text"] for entry in chunk_entries])

        # Get start and end times for chunk
        start_time = chunk_entries[0]["timestamp"]
        start_seconds = chunk_entries[0]["start_seconds"]
        end_time = chunk_entries[-1]["timestamp"]
        end_seconds = chunk_entries[-1]["end_seconds"]

        # Create Document with metadata
        doc = Document(
            page_content=chunk_text,
            metadata={
                "source": "youtube_transcript",
                "start_time": start_time,
                "end_time": end_time,
                "start_seconds": start_seconds,
                "end_seconds": end_seconds
            }
        )

        documents.append(doc)

    return documents


class YouTubeLangChainRAG:
    """Class for LangChain RAG-based Q&A on YouTube video transcripts"""

    def __init__(self, api_key=None, model_name=None):
        """Initialize the RAG Q&A with local model settings."""
        self.api_key = api_key
        self.model_name = model_name or os.getenv("LMSTUDIO_MODEL")

        # Initialize embedding model
        self.embedding_model = GoogleGenerativeAIEmbeddings(
            model="models/embedding-001",
            api_key=api_key
        )

        # Initialize LLM
        self.llm = ChatGoogleGenerativeAI(
            model=self.model_name,
            api_key=api_key,
            temperature=0.2,
            top_p=0.95,
            top_k=64,
            convert_system_message_to_human=True
        )

        # Set up RAG prompt
        self.rag_prompt = PromptTemplate.from_template(
            """
            You are an expert at answering questions based on video transcripts.

            The following are relevant sections from a YouTube video transcript:

            {context}

            Using ONLY the information provided in these transcript sections, answer the following question:

            Question: {question}

            In your answer:
            1. Be direct and to the point.
            2. Provide specific information from the transcript.
            3. Mention the specific timestamps where the information appears (these are included in the context).
            4. If the information isn't in the transcript, clearly state that.
            5. Structure your answer to clearly address the question.

            Format your answer with a clear main response first, followed by "TIMELINE REFERENCES:" that lists the specific parts of the video where the information was found.

            Answer:
            """
        )

        # Store video data
        self.video_data = {}

    def _classify_fallback_reason(self, error_message: str) -> str:
        lowered = (error_message or "").lower()
        if "lm studio" in lowered or "127.0.0.1:1234" in lowered or "connection refused" in lowered:
            return "LMSTUDIO_UNAVAILABLE"
        return "LLM_RESPONSE_FAILED"

    def _build_fallback_answer(self, question: str, relevant_docs: List[Document]) -> str:
        if not relevant_docs:
            return (
                "AI model service is temporarily unavailable, and no relevant transcript sections were found "
                "for this question right now. Please retry in a moment."
            )

        snippets = []
        for idx, doc in enumerate(relevant_docs[:3], start=1):
            start_time = doc.metadata.get("start_time", "00:00:00")
            end_time = doc.metadata.get("end_time", "00:00:00")
            text = " ".join((doc.page_content or "").split())
            if len(text) > 220:
                text = f"{text[:220]}..."
            snippets.append(f"{idx}. [{start_time} - {end_time}] {text}")

        return (
            "AI model service is currently unavailable, so this is a transcript-only fallback response.\n\n"
            f"Question: {question}\n\n"
            "Closest transcript sections:\n"
            + "\n".join(snippets)
            + "\n\nPlease ask again shortly for a full generated explanation."
        )

    def process_video(self, video_url, languages=['en'], force_refresh=False):
        """
        Process a video transcript and create a vector store.

        Args:
            video_url (str): YouTube video URL
            languages (list): List of language codes to try
            force_refresh (bool): Force refresh of existing data

        Returns:
            dict: Processed video data
        """
        # Extract video ID
        video_id = extract_video_id(video_url)
        if not video_id:
            raise ValueError("Invalid YouTube URL")

        # Check if video already processed
        if video_id in self.video_data and not force_refresh:
            return self.video_data[video_id]

        # Get video transcript
        transcriptions = get_transcript(video_id, languages)

        # Convert to LangChain documents
        documents = create_langchain_documents(transcriptions)

        # Create vector store
        vector_store = FAISS.from_documents(
            documents,
            self.embedding_model
        )

        # Store processed data
        self.video_data[video_id] = {
            "video_id": video_id,
            "video_url": video_url,
            "transcriptions": transcriptions,
            "documents": documents,
            "vector_store": vector_store
        }

        return self.video_data[video_id]

    def answer_question(self, video_url, question, languages=['en'], top_k=3):
        """
        Answer a question about a YouTube video using RAG.

        Args:
            video_url (str): YouTube video URL
            question (str): Question about the video
            languages (list): List of language codes to try
            top_k (int): Number of top chunks to retrieve

        Returns:
            dict: Answer with source timestamps
        """
        # Extract video ID
        video_id = extract_video_id(video_url)
        if not video_id:
            raise ValueError("Invalid YouTube URL")

        # Process video if not already processed
        if video_id not in self.video_data:
            self.process_video(video_url, languages)

        # Get video data
        video_data = self.video_data[video_id]

        # Get vector store
        vector_store = video_data["vector_store"]

        # Create retriever with top_k
        retriever = vector_store.as_retriever(
            search_type="similarity",
            search_kwargs={"k": top_k}
        )

        # Get relevant documents
        relevant_docs = retriever.get_relevant_documents(question)

        # Format context from relevant documents
        context = ""
        for i, doc in enumerate(relevant_docs):
            context += f"\n--- Chunk {i + 1} (Timestamp {doc.metadata['start_time']} - {doc.metadata['end_time']}) ---\n"
            context += doc.page_content + "\n"

        # Use the prompt template to format the prompt
        prompt = self.rag_prompt.format(
            context=context,
            question=question
        )

        # Extract source information from relevant documents
        sources = []
        for doc in relevant_docs:
            snippet_text = " ".join((doc.page_content or "").split())
            if len(snippet_text) > 300:
                snippet_text = f"{snippet_text[:300]}..."

            sources.append({
                "start_time": doc.metadata["start_time"],
                "end_time": doc.metadata["end_time"],
                "start_seconds": doc.metadata["start_seconds"],
                "end_seconds": doc.metadata["end_seconds"],
                "text": snippet_text,
            })

        fallback = False
        fallback_reason = None

        try:
            # Get answer from LLM
            answer = self.llm.invoke(prompt).content
        except Exception as exc:
            fallback = True
            fallback_reason = self._classify_fallback_reason(str(exc))
            answer = self._build_fallback_answer(question, relevant_docs)

        # Return answer with metadata
        return {
            "video_id": video_id,
            "video_url": video_url,
            "question": question,
            "answer": answer,
            "sources": sources,
            "fallback": fallback,
            "fallback_reason": fallback_reason,
        }