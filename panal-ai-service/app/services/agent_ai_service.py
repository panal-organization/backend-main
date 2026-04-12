from pydantic import ValidationError

from app.prompts.agent_decide_prompt import build_agent_decide_prompt
from app.schemas.agent import AgentDecideRequest, AgentDecideResponse
from app.services.ollama_client import OllamaClient, OllamaClientError

AGENT_ROUTER_SYSTEM_PROMPT = """\
You are the Panal AI Router. Your only responsibility is to read user input and decide
which action should be executed. You must always reply with a single valid JSON object.

Rules:
- action must be exactly one of: draft, classify, summary
- confidence is a float from 0.0 to 1.0 representing your certainty
- Return ONLY the JSON object — no markdown, no explanation, no extra text
"""


class AgentAIServiceError(RuntimeError):
    pass


class AgentAIService:
    def __init__(self, ollama_client: OllamaClient) -> None:
        self.ollama_client = ollama_client

    @classmethod
    def from_settings(cls) -> "AgentAIService":
        return cls(ollama_client=OllamaClient.from_settings())

    async def decide_action(self, payload: AgentDecideRequest) -> AgentDecideResponse:
        prompt = build_agent_decide_prompt(payload.text, payload.context)

        try:
            model_output = await self.ollama_client.generate_json(
                prompt, system=AGENT_ROUTER_SYSTEM_PROMPT
            )
        except OllamaClientError as exc:
            raise AgentAIServiceError(str(exc)) from exc

        try:
            return AgentDecideResponse.model_validate(model_output)
        except ValidationError as exc:
            raise AgentAIServiceError(
                "Model output does not match AgentDecideResponse contract."
            ) from exc
