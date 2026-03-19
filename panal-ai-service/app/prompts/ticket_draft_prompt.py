import json

from app.schemas.tickets import DraftTicketRequest


def build_ticket_draft_prompt(payload: DraftTicketRequest) -> str:
    allowed_priorities = [item.value for item in payload.allowed_priorities]
    allowed_categories = [item.value for item in payload.allowed_categories]

    output_contract = {
        "titulo": "string",
        "descripcion": "string",
        "prioridad": "BAJA | ALTA | CRITICA",
        "categoria": "SOPORTE | MEJORA",
        "tags": ["string"],
        "confidence": 0.0,
    }

    return (
        "You are a ticket drafting assistant for Panal. "
        "Convert free text into a structured ticket draft.\n\n"
        "Strict output rules:\n"
        "1) Return only valid JSON.\n"
        "2) Do not include markdown, explanations, comments, or extra keys.\n"
        "3) Use exactly this JSON object shape:\n"
        f"{json.dumps(output_contract, ensure_ascii=True)}\n"
        f"4) prioridad must be one of: {allowed_priorities}.\n"
        f"5) categoria must be one of: {allowed_categories}.\n"
        "6) confidence must be a float between 0.0 and 1.0.\n"
        "7) tags must be a JSON array of short strings; use empty array if none.\n"
        "8) Keep titulo concise and descripcion actionable.\n\n"
        "Context:\n"
        f"workspace_id: {payload.workspace_id}\n"
        f"user_id: {payload.user_id}\n"
        f"allowed_priorities: {allowed_priorities}\n"
        f"allowed_categories: {allowed_categories}\n\n"
        "Free text input:\n"
        f"{payload.text}\n"
    )
