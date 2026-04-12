import json

from app.schemas.summary import TicketSummaryRequest


def build_ticket_summary_prompt(payload: TicketSummaryRequest) -> str:
    output_contract = {
        "resumen": "string",
        "tickets_criticos": 0,
        "problemas_recurrentes": ["string"],
        "recomendacion": "string",
    }

    tickets_json = json.dumps(
        [
            {
                "titulo": t.titulo,
                "descripcion": t.descripcion,
                "estado": t.estado,
                "prioridad": t.prioridad,
                "categoria": t.categoria,
            }
            for t in payload.tickets
        ],
        ensure_ascii=False,
        indent=2,
    )

    return (
        "Analyze the following tickets and generate a comprehensive summary report.\n\n"
        "Strict output rules:\n"
        "1) Return only valid JSON.\n"
        "2) Do not include markdown, explanations, comments, or extra keys.\n"
        "3) Use exactly this JSON object shape:\n"
        f"{json.dumps(output_contract, ensure_ascii=True)}\n"
        "4) resumen: A 2-3 sentence summary of the ticket status and trends.\n"
        "5) tickets_criticos: Count of tickets with prioridad='CRITICA'.\n"
        "6) problemas_recurrentes: List of recurring issues or patterns (max 5).\n"
        "7) recomendacion: Actionable recommendation for the team (1-2 sentences).\n\n"
        f"Scope: {payload.scope.value}\n"
        f"Total tickets: {len(payload.tickets)}\n\n"
        "Tickets data:\n"
        f"{tickets_json}\n"
    )
