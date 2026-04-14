import json
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

try:
    from pymongo import MongoClient
except Exception:
    MongoClient = None


DEFAULT_LMSTUDIO_URL = "http://127.0.0.1:1234"


def trim_text(value, limit=180):
    if value is None:
        return ""
    text = str(value).replace("\n", " ").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 3] + "..."


def parse_response_excerpt(response):
    try:
        data = response.json()
        return trim_text(json.dumps(data, ensure_ascii=True))
    except Exception:
        return trim_text(response.text)


def make_result(service, env_var, ok, status_code=None, detail=""):
    return {
        "service": service,
        "env_var": env_var,
        "ok": bool(ok),
        "status_code": status_code,
        "detail": trim_text(detail),
    }


def load_env_file():
    current = Path(__file__).resolve()
    candidates = [
        current.parents[2] / ".env",  # workspace root .env
        current.parents[1] / ".env",  # Backend/.env
        Path.cwd() / ".env",
    ]

    for candidate in candidates:
        if candidate.exists():
            load_dotenv(candidate, override=False)
            return str(candidate)

    load_dotenv(override=False)
    return "(default dotenv lookup)"


def run_http_check(service, env_var, secret_value, method, url, headers=None, body=None, expected_statuses=None):
    if expected_statuses is None:
        expected_statuses = {200}

    if not secret_value:
        return make_result(service, env_var, False, detail="Missing env value")

    try:
        response = requests.request(
            method=method,
            url=url,
            headers=headers or {},
            json=body,
            timeout=20,
        )
        ok = response.status_code in expected_statuses
        detail = "OK" if ok else parse_response_excerpt(response)
        return make_result(service, env_var, ok, response.status_code, detail)
    except requests.RequestException as exc:
        return make_result(
            service,
            env_var,
            False,
            detail=f"Network error: {exc.__class__.__name__}: {exc}",
        )


def _lmstudio_headers(token):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _extract_chat_text(payload):
    if isinstance(payload, dict):
        choices = payload.get("choices")
        if isinstance(choices, list) and choices:
            first = choices[0]
            if isinstance(first, dict):
                message = first.get("message")
                if isinstance(message, dict) and isinstance(message.get("content"), str):
                    return message["content"]
                if isinstance(first.get("text"), str):
                    return first["text"]

        for key in ("output_text", "text", "message", "response", "content"):
            if isinstance(payload.get(key), str):
                return payload[key]

    return ""


def _pick_first_model_id(payload):
    def pick_from_model_obj(model, loaded_only=False, llm_only=False):
        if not isinstance(model, dict):
            return None

        model_type = str(model.get("type") or "").lower()
        if llm_only and model_type and model_type != "llm":
            return None

        # Prefer explicitly loaded instances when available.
        loaded_instances = model.get("loaded_instances")
        if isinstance(loaded_instances, list):
            for instance in loaded_instances:
                if isinstance(instance, dict):
                    instance_id = instance.get("id") or instance.get("model")
                    if instance_id:
                        return str(instance_id)

        if loaded_only:
            return None

        # For native payloads, avoid selecting non-LLM keys.
        if model_type and model_type != "llm":
            model_id = model.get("id") or model.get("name")
        else:
            model_id = model.get("id") or model.get("name") or model.get("key")
        if model_id:
            return str(model_id)
        return None

    def extract_model_candidates(data):
        candidates = []
        if isinstance(data, dict):
            native_models = data.get("models")
            if isinstance(native_models, list):
                candidates.extend(model for model in native_models if isinstance(model, dict))

            data_models = data.get("data")
            if isinstance(data_models, list):
                candidates.extend(model for model in data_models if isinstance(model, dict))

            if isinstance(data_models, dict):
                for value in data_models.values():
                    if isinstance(value, list):
                        candidates.extend(model for model in value if isinstance(model, dict))
        elif isinstance(data, list):
            candidates.extend(model for model in data if isinstance(model, dict))
        return candidates

    candidates = extract_model_candidates(payload)

    # Pass 1: loaded instances (best for chat readiness)
    for model in candidates:
        model_id = pick_from_model_obj(model, loaded_only=True)
        if model_id:
            return model_id

    # Pass 2: LLM models from listings
    for model in candidates:
        model_id = pick_from_model_obj(model, llm_only=True)
        if model_id:
            return model_id

    # Pass 3: any other compatible id/name fallback
    for model in candidates:
        model_id = pick_from_model_obj(model)
        if model_id:
            return model_id

    return None


def run_lmstudio_models_check(base_url, token):
    headers = _lmstudio_headers(token)
    errors = []
    had_success_response = False

    for path in ("/api/v1/models", "/v1/models"):
        url = f"{base_url}{path}"
        try:
            response = requests.get(url, headers=headers, timeout=20)
            if response.status_code >= 400:
                errors.append(f"{path}: HTTP {response.status_code}")
                continue

            had_success_response = True

            payload = response.json()
            model_id = _pick_first_model_id(payload)
            if model_id:
                return make_result("LM Studio Models", "LMSTUDIO_URL", True, response.status_code, f"OK (model: {model_id})")

            errors.append(f"{path}: No model id found in response")
        except Exception as exc:
            errors.append(f"{path}: {exc.__class__.__name__}: {exc}")

    if had_success_response:
        return make_result("LM Studio Models", "LMSTUDIO_URL", False, detail="No models listed. Load a model in LM Studio.")

    return make_result("LM Studio Models", "LMSTUDIO_URL", False, detail=" | ".join(errors))


def run_lmstudio_chat_check(base_url, token, model_name=None):
    headers = _lmstudio_headers(token)

    resolved_model = model_name
    if not resolved_model:
        # Try fetching model list first so chat has a valid model id.
        for path in ("/api/v1/models", "/v1/models"):
            try:
                response = requests.get(f"{base_url}{path}", headers=headers, timeout=20)
                if response.status_code == 200:
                    resolved_model = _pick_first_model_id(response.json())
                    if resolved_model:
                        break
            except Exception:
                pass

    if not resolved_model:
        return make_result(
            "LM Studio Chat",
            "LMSTUDIO_MODEL",
            False,
            detail="No model available. Load a model in LM Studio (LMSTUDIO_MODEL is optional).",
        )

    chat_payload = {
        "model": resolved_model,
        "messages": [{"role": "user", "content": "Reply with exactly: OK"}],
        "stream": False,
        "temperature": 0.0,
        "max_tokens": 16,
    }

    responses_payload = {
        "model": resolved_model,
        "input": "user: Reply with exactly: OK",
        "temperature": 0.0,
        "max_output_tokens": 16,
    }

    errors = []
    for path, payload in (
        ("/v1/chat/completions", chat_payload),
        ("/api/v1/chat/completions", chat_payload),
        ("/v1/responses", responses_payload),
        ("/api/v1/responses", responses_payload),
    ):
        url = f"{base_url}{path}"
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=40)
            if response.status_code >= 400:
                errors.append(f"{path}: HTTP {response.status_code} {trim_text(response.text)}")
                continue

            try:
                payload_json = response.json()
            except ValueError:
                payload_json = {}

            text = _extract_chat_text(payload_json)
            if text:
                return make_result("LM Studio Chat", "LMSTUDIO_MODEL", True, response.status_code, f"OK ({trim_text(text, 80)})")

            errors.append(f"{path}: Empty response text")
        except Exception as exc:
            errors.append(f"{path}: {exc.__class__.__name__}: {exc}")

    return make_result("LM Studio Chat", "LMSTUDIO_MODEL", False, detail=" | ".join(errors))


def run_mongo_check(mongo_uri):
    if not mongo_uri:
        return make_result("MongoDB", "MONGO_URI", False, detail="Missing env value")

    if MongoClient is None:
        return make_result("MongoDB", "MONGO_URI", False, detail="pymongo is not installed")

    client = None
    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        return make_result("MongoDB", "MONGO_URI", True, detail="OK")
    except Exception as exc:
        return make_result("MongoDB", "MONGO_URI", False, detail=f"Connection error: {exc}")
    finally:
        if client is not None:
            client.close()


def print_report(results, env_path):
    print(f"Loaded env from: {env_path}")
    print("")
    print(f"{'Service':<18} {'Env Var':<18} {'Result':<6} {'HTTP':<6} Detail")
    print("-" * 100)

    for item in results:
        service = item["service"]
        env_var = item["env_var"]
        result = "PASS" if item["ok"] else "FAIL"
        http_code = "-" if item["status_code"] is None else str(item["status_code"])
        detail = item["detail"]
        print(f"{service:<18} {env_var:<18} {result:<6} {http_code:<6} {detail}")

    passed = sum(1 for item in results if item["ok"])
    failed = len(results) - passed
    print("-" * 100)
    print(f"Passed: {passed}  Failed: {failed}  Total: {len(results)}")


def save_json_report(results):
    report_path = Path(__file__).resolve().parent / "test_env_apis_report.json"
    report_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    return str(report_path)


def main():
    env_path = load_env_file()

    lmstudio_url = (os.getenv("LMSTUDIO_URL") or DEFAULT_LMSTUDIO_URL).rstrip("/")
    lmstudio_token = os.getenv("LMSTUDIO_API_TOKEN") or os.getenv("LMSTUDIO_API_KEY")
    lmstudio_model = os.getenv("LMSTUDIO_MODEL")

    deepgram_api_key = os.getenv("DEEPGRAM_API_KEY")
    tavily_api_key = os.getenv("TAVILY_API_KEY")
    serper_api_key = os.getenv("SERPER_API_KEY")
    mongo_uri = os.getenv("MONGO_URI")

    checks = [
        run_lmstudio_models_check(base_url=lmstudio_url, token=lmstudio_token),
        run_lmstudio_chat_check(base_url=lmstudio_url, token=lmstudio_token, model_name=lmstudio_model),
        run_http_check(
            service="Deepgram",
            env_var="DEEPGRAM_API_KEY",
            secret_value=deepgram_api_key,
            method="GET",
            url="https://api.deepgram.com/v1/projects",
            headers={"Authorization": f"Token {deepgram_api_key}"},
            expected_statuses={200},
        ),
        run_http_check(
            service="Tavily",
            env_var="TAVILY_API_KEY",
            secret_value=tavily_api_key,
            method="POST",
            url="https://api.tavily.com/search",
            body={
                "api_key": tavily_api_key,
                "query": "health check",
                "max_results": 1,
                "search_depth": "basic",
            },
            expected_statuses={200},
        ),
        run_http_check(
            service="Serper",
            env_var="SERPER_API_KEY",
            secret_value=serper_api_key,
            method="POST",
            url="https://google.serper.dev/search",
            headers={
                "X-API-KEY": serper_api_key,
                "Content-Type": "application/json",
            },
            body={"q": "health check", "num": 1},
            expected_statuses={200},
        ),
        run_mongo_check(mongo_uri),
    ]

    print_report(checks, env_path)
    report_path = save_json_report(checks)
    print(f"JSON report saved to: {report_path}")

    has_failures = any(not item["ok"] for item in checks)
    return 1 if has_failures else 0


if __name__ == "__main__":
    sys.exit(main())
