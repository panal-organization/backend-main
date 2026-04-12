import json

from app.schemas.classify import TicketClassifyRequest


def build_ticket_classify_prompt(payload: TicketClassifyRequest) -> str:
    output_contract = {
        "prioridad": "BAJA | ALTA | CRITICA",
        "categoria": "SOPORTE | MEJORA",
        "justificacion": "string",
        "confidence": 0.0,
    }

    input_data = {
        "titulo": payload.titulo,
        "descripcion": payload.descripcion,
    }

    return (
        "Classify the following support problem into priority and category.\n\n"
        "Strict output rules:\n"
        "1) Return only valid JSON.\n"
        "2) Do not include markdown, explanations, comments, or extra keys.\n"
        "3) Use exactly this JSON object shape:\n"
        f"{json.dumps(output_contract, ensure_ascii=True)}\n"
        "4) prioridad must be one of: BAJA, ALTA, CRITICA.\n"
        "5) categoria must be one of: SOPORTE, MEJORA.\n"
        "6) justificacion must briefly explain why the classification was chosen.\n"
        "7) confidence must be a float between 0.0 and 1.0.\n\n"
        "Problem data:\n"
        f"{json.dumps(input_data, ensure_ascii=False, indent=2)}\n"
    )
