import logging
from pydantic import ValidationError

from app.core.config import get_settings
from app.prompts.ticket_summary_prompt import build_ticket_summary_prompt
from app.schemas.summary import TicketSummaryRequest, TicketSummaryResponse
from app.services.ollama_client import OllamaClient, OllamaClientError

logger = logging.getLogger(__name__)

TICKET_SUMMARY_SYSTEM_PROMPT = (
    "You are Panal's ticket analysis assistant. Your role is to analyze support tickets "
    "and generate concise, actionable summaries identifying patterns, critical issues, "
    "and recommendations. You respond only with valid JSON, no markdown or explanations."
)


class TicketSummaryServiceError(Exception):
    pass


class TicketSummaryService:
    def __init__(self, ollama_client: OllamaClient):
        self.ollama = ollama_client

    @staticmethod
    def from_settings() -> "TicketSummaryService":
        settings = get_settings()
        ollama = OllamaClient(base_url=settings.ollama_base_url, model=settings.ollama_model)
        return TicketSummaryService(ollama)

    async def generate_summary(self, payload: TicketSummaryRequest) -> TicketSummaryResponse:
        """Generate a summary of tickets with analysis and recommendations."""
        if not payload.tickets:
            raise TicketSummaryServiceError("No tickets provided for summary generation")

        try:
            prompt = build_ticket_summary_prompt(payload)
            logger.info(
                f"Generating summary for {len(payload.tickets)} tickets (scope: {payload.scope.value})"
            )

            response_json = await self.ollama.generate_json(
                prompt=prompt, system=TICKET_SUMMARY_SYSTEM_PROMPT
            )

            summary_data = TicketSummaryResponse.model_validate(response_json)
            logger.info(
                f"Summary generated successfully: {len(summary_data.problemas_recurrentes)} patterns found"
            )
            return summary_data

        except OllamaClientError as e:
            logger.error(f"Ollama client error during summary generation: {e}")
            raise TicketSummaryServiceError(f"Failed to generate summary: {str(e)}") from e
        except ValidationError as e:
            logger.error(f"Invalid response schema for summary: {e}")
            raise TicketSummaryServiceError(f"Invalid summary response format: {str(e)}") from e
        except Exception as e:
            logger.error(f"Unexpected error during summary generation: {e}")
            raise TicketSummaryServiceError(f"Unexpected error: {str(e)}") from e
