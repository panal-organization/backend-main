from pydantic import ValidationError

from app.prompts.ticket_draft_prompt import build_ticket_draft_prompt
from app.schemas.tickets import DraftTicketRequest, DraftTicketResponse
from app.services.ollama_client import OllamaClient, OllamaClientError


class TicketAIServiceError(RuntimeError):
    pass


class TicketAIService:
    def __init__(self, ollama_client: OllamaClient) -> None:
        self.ollama_client = ollama_client

    @classmethod
    def from_settings(cls) -> "TicketAIService":
        return cls(ollama_client=OllamaClient.from_settings())

    async def generate_ticket_draft(self, payload: DraftTicketRequest) -> DraftTicketResponse:
        prompt = build_ticket_draft_prompt(payload)

        try:
            model_output = await self.ollama_client.generate_json(prompt)
        except OllamaClientError as exc:
            raise TicketAIServiceError(str(exc)) from exc

        try:
            return DraftTicketResponse.model_validate(model_output)
        except ValidationError as exc:
            raise TicketAIServiceError(
                "Model output does not match DraftTicketResponse contract."
            ) from exc
