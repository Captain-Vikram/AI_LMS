import hashlib
import numpy as np
from types import SimpleNamespace
from functions.llm_adapter import generate_text
from functions.llm_adapter_async import generate_text_async

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

    def _gen_config(self):
        return {"temperature": self.temperature, "top_p": self.top_p}

    def invoke(self, prompt):
        """Sync call — only use outside async context (e.g. LangChain sync chains)."""
        text = generate_text(
            prompt_or_messages=prompt,
            model_name=self.model,
            generation_config=self._gen_config(),
        )
        return SimpleNamespace(content=text)

    async def ainvoke(self, prompt):
        """Async call — routes through generate_text_async (LM Studio → cloud fallback)."""
        text = await generate_text_async(
            prompt_or_messages=prompt,
            model_name=self.model,
            generation_config=self._gen_config(),
        )
        return SimpleNamespace(content=text)

