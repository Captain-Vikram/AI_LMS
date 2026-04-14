import hashlib
import numpy as np
from types import SimpleNamespace
from functions.llm_adapter import generate_text

class GoogleGenerativeAIEmbeddings:
    def __init__(self, model=None, api_key=None, google_api_key=None):
        self.model = model
        self.api_key = api_key or google_api_key

    def embed_documents(self, texts):
        # Deterministic, lightweight embedding: use md5 hash bytes -> float vector
        embeddings = []
        for t in texts:
            h = hashlib.md5(t.encode('utf-8')).digest()
            arr = np.frombuffer(h, dtype=np.uint8).astype(np.float32)
            # normalize
            norm = np.linalg.norm(arr)
            if norm == 0:
                norm = 1.0
            embeddings.append((arr / norm).tolist())
        return embeddings

class ChatGoogleGenerativeAI:
    def __init__(self, model=None, api_key=None, google_api_key=None, temperature=0.2, top_p=0.95, top_k=64, convert_system_message_to_human=True):
        self.model = model
        self.api_key = api_key or google_api_key
        self.temperature = temperature
        self.top_p = top_p
        self.top_k = top_k

    def invoke(self, prompt):
        text = generate_text(
            prompt_or_messages=prompt,
            model_name=self.model,
            generation_config={
                "temperature": self.temperature,
                "top_p": self.top_p,
            },
        )
        return SimpleNamespace(content=text)
