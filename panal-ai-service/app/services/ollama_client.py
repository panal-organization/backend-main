import json

import httpx

from app.core.config import get_settings


class OllamaClientError(RuntimeError):
    pass


class OllamaClient:
    def __init__(self, base_url: str, model: str, timeout_seconds: float = 60.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_seconds = timeout_seconds

    @classmethod
    def from_settings(cls) -> "OllamaClient":
        settings = get_settings()
        return cls(
            base_url=settings.ollama_base_url,
            model=settings.ollama_model,
            timeout_seconds=settings.ollama_timeout_seconds,
        )

    async def generate_json(self, prompt: str, system: str | None = None) -> dict:
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
        }
        if system:
            payload["system"] = system

        url = f"{self.base_url}/api/generate"

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise OllamaClientError(f"Failed to call Ollama: {exc}") from exc

        try:
            data = response.json()
        except json.JSONDecodeError as exc:
            raise OllamaClientError("Ollama response is not valid JSON.") from exc

        raw_response = data.get("response")
        if not isinstance(raw_response, str):
            raise OllamaClientError("Ollama response missing 'response' text payload.")

        try:
            parsed = json.loads(raw_response)
        except json.JSONDecodeError as exc:
            raise OllamaClientError("Model output is not valid JSON.") from exc

        if not isinstance(parsed, dict):
            raise OllamaClientError("Model output must be a JSON object.")

        return parsed
