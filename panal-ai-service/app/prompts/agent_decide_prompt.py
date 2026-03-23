def build_agent_decide_prompt(text: str, context: list[dict] | None = None) -> str:
    context_lines: list[str] = []
    for entry in context or []:
        role = str(entry.get("role", "unknown"))
        entry_text = str(entry.get("text", "")).strip()
        intent = entry.get("intent")
        result_summary = entry.get("result_summary")

        if not entry_text:
            continue

        line = f"- {role}: {entry_text}"
        if intent:
            line += f" | intent={intent}"
        if result_summary:
            line += f" | result={result_summary}"
        context_lines.append(line)

    context_block = "\n".join(context_lines) if context_lines else "- (no recent context)"

    return (
        "Classify the following user input into exactly one of the three available actions.\n\n"
        "Available actions:\n"
        '  "draft"    — The user describes a technical problem, incident, or malfunction '
        "that requires a support ticket to be created.\n"
        '  "classify" — The user wants to categorize, label, or triage an existing ticket '
        "or problem description.\n"
        '  "summary"  — The user wants a summary, overview, or report about recent tickets '
        "or incidents.\n\n"
        "Output contract (return ONLY this JSON object, nothing else):\n"
        '{"action": "<draft|classify|summary>", "confidence": <float 0.0-1.0>}\n\n'
        "Recent conversation context (most recent first/last mix, use it to resolve references like 'crealo', 'clasificalo', 'resumelo', 'ese ticket'):\n"
        f"{context_block}\n\n"
        "User input:\n"
        f"{text}\n"
    )
