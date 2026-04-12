from pydantic import ValidationError

from app.prompts.ticket_classify_prompt import build_ticket_classify_prompt
from app.schemas.classify import TicketClassifyRequest, TicketClassifyResponse
from app.services.ollama_client import OllamaClient, OllamaClientError
from app.services.ticket_ai_service import AGENT_SYSTEM_PROMPT


class TicketClassifyServiceError(RuntimeError):
    pass


class TicketClassifyService:
    def __init__(self, ollama_client: OllamaClient) -> None:
        self.ollama_client = ollama_client

    @classmethod
    def from_settings(cls) -> "TicketClassifyService":
        return cls(ollama_client=OllamaClient.from_settings())

    async def classify_ticket(self, payload: TicketClassifyRequest) -> TicketClassifyResponse:
        prompt = build_ticket_classify_prompt(payload)

        try:
            model_output = await self.ollama_client.generate_json(
                prompt, system=AGENT_SYSTEM_PROMPT
            )
        except OllamaClientError as exc:
            raise TicketClassifyServiceError(str(exc)) from exc

        try:
            return TicketClassifyResponse.model_validate(model_output)
        except ValidationError as exc:
            raise TicketClassifyServiceError(
                "Model output does not match TicketClassifyResponse contract."
            ) from exc
