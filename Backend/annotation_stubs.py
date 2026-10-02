"""Auto-generate minimal Pydantic request-model stubs for missing `*Request` names.

This script is imported early from `main.py` to create permissive BaseModel
stubs in `builtins` for any `*Request` identifier found across the codebase.

It is a pragmatic compatibility shim to allow the app to import route modules
when a dedicated shared `schemas` module is absent.
"""
from __future__ import annotations

from pathlib import Path
import re
import builtins
from typing import Set


try:
    import pydantic
    from pydantic import BaseModel
    PYDANTIC_V2 = int(getattr(pydantic, "__version__", "0").split(".")[0]) >= 2
except Exception:
    # Pydantic not available in this environment; fall back to lightweight placeholders
    BaseModel = object
    PYDANTIC_V2 = False

PROJECT_ROOT = Path(__file__).resolve().parent.parent
REQUEST_RE = re.compile(r"\b([A-Za-z_][A-Za-z0-9_]*)Request\b")


def find_request_names() -> Set[str]:
    names: Set[str] = set()
    for p in PROJECT_ROOT.rglob("*.py"):
        # skip venv and hidden folders
        if any(part.startswith(".") for part in p.parts):
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for m in REQUEST_RE.finditer(text):
            names.add(m.group(1))
    return names


def create_stub(name: str):
    if hasattr(builtins, name):
        return
    if BaseModel is object:
        # Fallback: attach a lightweight placeholder class with dict() support
        class _Fallback:
            def __init__(self, **kwargs):
                self.__dict__.update(kwargs)

            def dict(self):
                return dict(self.__dict__)

        setattr(builtins, name, _Fallback)
        return

    attrs = {"__module__": "annotation_stubs"}
    if PYDANTIC_V2:
        attrs["model_config"] = {"extra": "allow"}
    else:
        attrs["Config"] = type("Config", (), {"extra": "allow"})

    cls = type(name, (BaseModel,), attrs)
    setattr(builtins, name, cls)


def ensure_stubs():
    names = find_request_names()
    for n in sorted(names):
        create_stub(n)
    print(f"[annotation_stubs] Created {len(names)} request-model stubs (pydantic_v2={PYDANTIC_V2})")


if __name__ == "__main__":
    ensure_stubs()


ensure_stubs()
