from __future__ import annotations

from langchain_text_splitters import RecursiveCharacterTextSplitter


def split_text(text: str, *, chunk_size: int, chunk_overlap: int) -> list[str]:
    if not text.strip():
        return []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    return [chunk.strip() for chunk in splitter.split_text(text) if chunk.strip()]
