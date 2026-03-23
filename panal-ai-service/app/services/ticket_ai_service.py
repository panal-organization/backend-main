from pydantic import ValidationError

from app.prompts.ticket_draft_prompt import build_ticket_draft_prompt
from app.schemas.tickets import DraftTicketRequest, DraftTicketResponse
from app.services.ollama_client import OllamaClient, OllamaClientError

AGENT_SYSTEM_PROMPT = """\
You are Panal, an intelligent support assistant integrated into the Panal workspace management platform.

Your role is to help support teams process and triage incoming problems by converting free-text
descriptions into structured, actionable ticket drafts.

Core principles:
- Always reply with valid JSON only — no markdown, no explanations, no extra text outside the JSON object.
- Be concise, accurate, and professional.
- Infer urgency and category from context when they are not explicitly stated.
- Keep ticket titles brief and descriptive; keep descriptions actionable.
- Never fabricate information that is not present in the original input.
- Use the language of the original input for titulo and descripcion.
"""


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
            model_output = await self.ollama_client.generate_json(
                prompt, system=AGENT_SYSTEM_PROMPT
            )
        except OllamaClientError as exc:
            raise TicketAIServiceError(str(exc)) from exc

        try:
            return DraftTicketResponse.model_validate(model_output)
        except ValidationError as exc:
            raise TicketAIServiceError(
                "Model output does not match DraftTicketResponse contract."
            ) from exc
