const PLAN_URL = "http://127.0.0.1:3000/api/ai/agent/plan";
const SAVE_URL = "http://127.0.0.1:3000/api/tickets/from-ai-draft";
const SESSION_STORAGE_KEY = "panal_ai_session_id";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const problemInput = document.getElementById("problemInput");
const generateBtn = document.getElementById("generateBtn");
const errorBox = document.getElementById("errorBox");
const chatArea = document.getElementById("chatArea");
const typingIndicator = document.getElementById("typingIndicator");
const actionDetectionBox = document.getElementById("actionDetectionBox");
const resultCard = document.getElementById("resultCard");
const resultContent = document.getElementById("resultContent");
const resultPlaceholder = document.getElementById("resultPlaceholder");
const agentStatusBox = document.getElementById("agentStatusBox");
const agentStatusText = document.getElementById("agentStatusText");
const sessionHistoryCard = document.getElementById("sessionHistoryCard");
const sessionHistoryList = document.getElementById("sessionHistoryList");

let currentPlan = null;
let currentSessionId = getOrCreateSessionId();
let sessionHistory = [];

function generateSessionId() {
    if (window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }

    const randomPart = Math.random().toString(36).slice(2, 10);
    return `sess_${Date.now()}_${randomPart}`;
}

function getOrCreateSessionId() {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) {
        return existing;
    }

    const created = generateSessionId();
    window.localStorage.setItem(SESSION_STORAGE_KEY, created);
    return created;
}

// ── Quick actions mapping ──────────────────────────────────────────────────────
const QUICK_PROMPTS = {
    draft: "La impresora del área de recepción no funciona y nadie puede imprimir",
    summary: "Dame un resumen de los tickets del día de hoy",
    classify: "Clasifica este ticket como soporte urgente: el servidor de base dato cae cada hora",
};

const STATUS_COPY = {
    initial: "Listo para analizar tu solicitud.",
    sending: "Analizando tu solicitud...",
    planReady: "Plan generado correctamente.",
    waitingConfirmation: "Esperando tu confirmación para ejecutar la acción.",
    savingTicket: "Guardando ticket en el sistema...",
    completed: "Acción completada correctamente.",
    error: "Ocurrió un problema al procesar tu solicitud. Intenta nuevamente.",
    unknownIntent: "No pude identificar claramente la acción solicitada.",
    missingConfirmation: "Revisa el plan y confirma para continuar.",
    byIntent: {
        draft: {
            planning: "Estoy preparando un borrador de ticket...",
            ready: "Ya tengo listo un borrador para tu revisión."
        },
        summary: {
            planning: "Estoy analizando los tickets del workspace...",
            ready: "Ya preparé un resumen con los puntos más relevantes."
        },
        classify: {
            planning: "Estoy clasificando el problema...",
            ready: "Ya identifiqué prioridad y categoría sugeridas."
        },
        create_ticket: {
            planning: "Estoy preparando un plan seguro para crear el ticket...",
            ready: "El ticket requiere tu confirmación antes de guardarse."
        }
    }
};

document.querySelectorAll(".quick-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
        const prompt = QUICK_PROMPTS[btn.dataset.action];
        if (prompt) {
            problemInput.value = prompt;
            problemInput.focus();
            const len = problemInput.value.length;
            problemInput.setSelectionRange(len, len);
        }
    });
});

// ── Chat helpers ───────────────────────────────────────────────────────────────
function addBubble(text, type) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("bubble-wrapper",
        type === "user" ? "bubble-wrapper-user" : "bubble-wrapper-ai");

    if (type === "ai") {
        const label = document.createElement("span");
        label.className = "bubble-label";
        label.textContent = "IA Panal";
        wrapper.appendChild(label);
    }

    const bubble = document.createElement("article");
    bubble.classList.add("bubble", type === "user" ? "bubble-user" : "bubble-ai");
    bubble.textContent = text;
    wrapper.appendChild(bubble);

    chatArea.insertBefore(wrapper, typingIndicator);
    wrapper.scrollIntoView({ behavior: "smooth", block: "end" });
}

function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
}

function hideError() {
    errorBox.textContent = "";
    errorBox.classList.add("hidden");
}

function setTyping(isTyping) {
    typingIndicator.classList.toggle("hidden", !isTyping);
    generateBtn.disabled = isTyping;
    if (isTyping) {
        typingIndicator.scrollIntoView({ behavior: "smooth", block: "end" });
    }
}

function setResultPlaceholderVisibility(isVisible) {
    if (!resultPlaceholder) {
        return;
    }

    resultPlaceholder.classList.toggle("hidden", !isVisible);
}

function setAgentStatus(status) {
    if (!agentStatusBox || !agentStatusText) {
        return;
    }

    agentStatusText.textContent = status;
    agentStatusBox.classList.remove("hidden");
}

function confidenceToPercent(confidence) {
    if (typeof confidence !== "number" || Number.isNaN(confidence)) {
        return "-";
    }

    return `${(confidence * 100).toFixed(0)}%`;
}

function getStatusCopy(intent, stage) {
    const intentMessages = STATUS_COPY.byIntent[intent];
    if (intentMessages && intentMessages[stage]) {
        return intentMessages[stage];
    }

    if (stage === "planning") {
        return STATUS_COPY.sending;
    }

    if (stage === "ready") {
        return STATUS_COPY.planReady;
    }

    return STATUS_COPY.planReady;
}

function mapFriendlyError(rawMessage) {
    const message = (rawMessage || "").toLowerCase();
    if (/intenci[óo]n no soportada|acci[óo]n no reconocida|no soportada por/.test(message)) {
        return STATUS_COPY.unknownIntent;
    }
    if (/confirmaci[óo]n|confirmar/.test(message)) {
        return STATUS_COPY.missingConfirmation;
    }

    return STATUS_COPY.error;
}

function sanitizeInline(value) {
    if (typeof value !== "string" || !value.trim()) {
        return "-";
    }

    return value;
}

function deriveAction(plan) {
    if (!plan || typeof plan !== "object") {
        return "none";
    }

    if (plan.intent === "create_ticket" && plan.requires_confirmation) {
        return "create_ticket_pending_confirmation";
    }

    if (Array.isArray(plan.steps) && plan.steps.length > 0) {
        return plan.steps.map((step) => `${step.tool || "tool"}:${step.status || "ready"}`).join(" | ");
    }

    return plan.intent || "none";
}

function pushSessionHistory({ userText, intent, action }) {
    sessionHistory.push({
        userText: sanitizeInline(userText),
        intent: sanitizeInline(intent),
        action: sanitizeInline(action),
        createdAt: new Date().toISOString()
    });

    sessionHistory = sessionHistory.slice(-3);
    renderSessionHistory();
}

function updateLastHistoryAction(action) {
    if (!sessionHistory.length) {
        return;
    }

    const lastIndex = sessionHistory.length - 1;
    sessionHistory[lastIndex].action = sanitizeInline(action);
    renderSessionHistory();
}

function renderSessionHistory() {
    if (!sessionHistoryCard || !sessionHistoryList) {
        return;
    }

    sessionHistoryList.innerHTML = "";
    if (!sessionHistory.length) {
        sessionHistoryCard.classList.add("hidden");
        return;
    }

    sessionHistory.forEach((entry) => {
        const item = document.createElement("li");
        item.className = "session-history-item";

        const text = document.createElement("p");
        text.className = "session-history-text";
        text.textContent = entry.userText;

        const meta = document.createElement("div");
        meta.className = "session-history-meta";

        const intentChip = document.createElement("span");
        intentChip.className = "history-chip";
        intentChip.textContent = `intent: ${entry.intent}`;

        const actionChip = document.createElement("span");
        actionChip.className = "history-chip";
        actionChip.textContent = `acción: ${entry.action}`;

        meta.appendChild(intentChip);
        meta.appendChild(actionChip);

        item.appendChild(text);
        item.appendChild(meta);
        sessionHistoryList.appendChild(item);
    });

    sessionHistoryCard.classList.remove("hidden");
}

function showActionDetection(action, confidence) {
    const actionLabels = {
        draft: "Crear ticket",
        summary: "Resumen de tickets",
        classify: "Clasificación de tickets",
        create_ticket: "Creación de ticket",
    };

    const label = actionLabels[action] || action;
    const confPercent = confidenceToPercent(confidence).replace("%", "");

    actionDetectionBox.innerHTML = `
        <span class=\"action-detection-icon\">🤖</span>
        <span class=\"action-detection-text\">
            Detecté que quieres: <strong>${label}</strong>
            <span class=\"action-detection-confidence\">${confPercent}% seguro</span>
        </span>
    `;
    actionDetectionBox.classList.remove("hidden");
    actionDetectionBox.scrollIntoView({ behavior: "smooth", block: "end" });
}

// ── Chip factory ───────────────────────────────────────────────────────────────
const PRIORITY_CLASS = {
    BAJA: "chip-priority--baja",
    ALTA: "chip-priority--alta",
    CRITICA: "chip-priority--critica",
};
const CATEGORY_CLASS = {
    SOPORTE: "chip-category--soporte",
    MEJORA: "chip-category--mejora",
};

function renderChip(text, type) {
    const chip = document.createElement("span");
    chip.className = "chip";
    if (type === "priority") {
        chip.classList.add(PRIORITY_CLASS[text] ?? "chip-priority--baja");
    } else if (type === "category") {
        chip.classList.add(CATEGORY_CLASS[text] ?? "chip-category--soporte");
    } else {
        chip.classList.add("chip-tag");
    }
    chip.textContent = text;
    return chip;
}

function renderSteps(steps) {
    if (!Array.isArray(steps) || steps.length === 0) {
        return "<li class=\"plan-step\">Sin pasos</li>";
    }

    return steps.map((step) => {
        const status = step.status || "ready";
        return `
            <li class="plan-step">
                <span class="plan-step-tool">${step.tool}</span>
                <span class="plan-step-status plan-step-status--${status}">${status}</span>
            </li>
        `;
    }).join("");
}

function renderPlanHeader(plan) {
    return `
        <div class="plan-box">
            <div class="draft-header">
                <div class="draft-header-left">
                    <span class="draft-badge">Plan IA</span>
                    <h2>Plan de ejecución: ${plan.intent}</h2>
                </div>
                <span class="draft-confidence-badge">
                    Confianza: <strong>${confidenceToPercent(plan.confidence)}</strong>
                </span>
            </div>
            <div class="traceability-grid">
                <div class="traceability-item">
                    <span class="traceability-label">Intent detectado</span>
                    <span class="traceability-value">${sanitizeInline(plan.intent)}</span>
                </div>
                <div class="traceability-item">
                    <span class="traceability-label">Confidence</span>
                    <span class="traceability-value">${confidenceToPercent(plan.confidence)}</span>
                </div>
                <div class="traceability-item">
                    <span class="traceability-label">ai_log_id</span>
                    <span class="traceability-value traceability-value-code">${sanitizeInline(plan.ai_log_id || "N/A")}</span>
                </div>
                <div class="traceability-item">
                    <span class="traceability-label">session_id</span>
                    <span class="traceability-value traceability-value-code">${sanitizeInline(plan.session_id || currentSessionId || "N/A")}</span>
                </div>
            </div>
            <p class="plan-message">${plan.message || "Plan generado"}</p>
            <div class="draft-meta-item draft-meta-item-wide">
                <span class="draft-meta-label">Pasos</span>
                <ul class="plan-steps">${renderSteps(plan.steps)}</ul>
            </div>
        </div>
    `;
}

function renderDraftPreview(preview) {
    return `
        <div class="draft-header">
            <div class="draft-header-left">
                <span class="draft-badge">Preview borrador</span>
                <h2>${preview.titulo || "-"}</h2>
            </div>
        </div>
        <p class="draft-descripcion">${preview.descripcion || "-"}</p>
        <div class="draft-meta">
            <div class="draft-meta-item">
                <span class="draft-meta-label">Prioridad</span>
                <div id="previewPrioridad"></div>
            </div>
            <div class="draft-meta-item">
                <span class="draft-meta-label">Categoría</span>
                <div id="previewCategoria"></div>
            </div>
        </div>
    `;
}

function renderSummaryPreview(preview) {
    return `
        <div class="draft-header">
            <div class="draft-header-left">
                <span class="draft-badge">Preview resumen</span>
                <h2>Resumen de tickets</h2>
            </div>
        </div>
        <p class="draft-descripcion">${preview.resumen || "Sin resumen disponible"}</p>
    `;
}

function renderClassifyPreview(preview) {
    return `
        <div class="draft-header">
            <div class="draft-header-left">
                <span class="draft-badge">Preview clasificación</span>
                <h2>Clasificación del problema</h2>
            </div>
            <span class="draft-confidence-badge">
                Confianza: <strong>${typeof preview.confidence === "number" ? (preview.confidence * 100).toFixed(0) : "-"}%</strong>
            </span>
        </div>
        <div class="draft-meta">
            <div class="draft-meta-item">
                <span class="draft-meta-label">Prioridad</span>
                <div id="classifyPreviewPrioridad"></div>
            </div>
            <div class="draft-meta-item">
                <span class="draft-meta-label">Categoría</span>
                <div id="classifyPreviewCategoria"></div>
            </div>
            <div class="draft-meta-item draft-meta-item-wide">
                <span class="draft-meta-label">Justificación</span>
                <p class="summary-recomendacion">${preview.justificacion || "Sin justificación disponible"}</p>
            </div>
        </div>
    `;
}

function renderConfirmationCard(preview) {
    return `
        <div class="confirmation-card">
            <div class="draft-header">
                <div class="draft-header-left">
                    <span class="draft-badge">Confirmación requerida</span>
                    <h2>Creación segura de ticket</h2>
                </div>
            </div>

            ${renderDraftPreview(preview)}

            <div class="draft-footer">
                <button id="confirmCreateBtn" class="btn-confirm">
                    <span aria-hidden="true">✔</span> Confirmar creación del ticket
                </button>
            </div>

            <div id="confirmLoadingBox" class="loading hidden" aria-live="polite">
                <span class="spinner" aria-hidden="true"></span>
                <span>Creando ticket en MongoDB...</span>
            </div>

            <div id="confirmErrorBox" class="error hidden" role="alert"></div>

            <div id="confirmSuccessBox" class="success hidden" role="status">
                <span class="success-icon" aria-hidden="true">✔</span>
                <div>
                    <strong>Ticket creado correctamente</strong>
                    <p id="confirmTicketId"></p>
                </div>
            </div>
        </div>
    `;
}

function renderPlan(plan) {
    let previewHtml = "";

    if (plan.intent === "create_ticket" && plan.requires_confirmation && plan.draft_preview) {
        previewHtml = renderConfirmationCard(plan.draft_preview);
    } else if (plan.draft_preview) {
        previewHtml = renderDraftPreview(plan.draft_preview);
    } else if (plan.summary_preview) {
        previewHtml = renderSummaryPreview(plan.summary_preview);
    } else if (plan.classify_preview) {
        previewHtml = renderClassifyPreview(plan.classify_preview);
    }

    resultContent.innerHTML = `${renderPlanHeader(plan)}${previewHtml}`;

    if (plan.draft_preview) {
        const previewPrioridad = document.getElementById("previewPrioridad");
        const previewCategoria = document.getElementById("previewCategoria");
        if (previewPrioridad) {
            previewPrioridad.innerHTML = "";
            previewPrioridad.appendChild(renderChip(plan.draft_preview.prioridad || "BAJA", "priority"));
        }
        if (previewCategoria) {
            previewCategoria.innerHTML = "";
            previewCategoria.appendChild(renderChip(plan.draft_preview.categoria || "SOPORTE", "category"));
        }
    }

    if (plan.classify_preview) {
        const classifyPreviewPrioridad = document.getElementById("classifyPreviewPrioridad");
        const classifyPreviewCategoria = document.getElementById("classifyPreviewCategoria");
        if (classifyPreviewPrioridad) {
            classifyPreviewPrioridad.innerHTML = "";
            classifyPreviewPrioridad.appendChild(renderChip(plan.classify_preview.prioridad || "BAJA", "priority"));
        }
        if (classifyPreviewCategoria) {
            classifyPreviewCategoria.innerHTML = "";
            classifyPreviewCategoria.appendChild(renderChip(plan.classify_preview.categoria || "SOPORTE", "category"));
        }
    }

    if (plan.intent === "create_ticket" && plan.requires_confirmation && plan.draft_preview) {
        const confirmCreateBtn = document.getElementById("confirmCreateBtn");
        if (confirmCreateBtn) {
            confirmCreateBtn.addEventListener("click", () => executeConfirmedAction(plan.draft_preview, plan.ai_log_id));
        }
    }

    resultCard.classList.remove("hidden");
    setResultPlaceholderVisibility(false);
    resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ── Error parser ───────────────────────────────────────────────────────────────
async function parseErrorResponse(response) {
    try {
        const body = await response.json();
        if (body?.message) return body.message;
        if (body?.detail) return body.detail;
    } catch (_) { }
    return `Error ${response.status}: No fue posible procesar la respuesta`;
}

// ── Handle plan response ───────────────────────────────────────────────────────
async function handleAgentResponse() {
    hideError();
    const text = problemInput.value.trim();

    if (!text) {
        showError(STATUS_COPY.error);
        return;
    }

    addBubble(text, "user");
    setAgentStatus(STATUS_COPY.sending);
    setTyping(true);
    resultCard.classList.add("hidden");
    setResultPlaceholderVisibility(true);

    try {
        const response = await fetch(PLAN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text,
                session_id: currentSessionId,
            }),
        });

        if (!response.ok) {
            throw new Error(await parseErrorResponse(response));
        }

        const plan = await response.json();
        currentPlan = plan;

        setAgentStatus(getStatusCopy(plan.intent, "planning"));

        if (plan.session_id && typeof plan.session_id === "string") {
            currentSessionId = plan.session_id;
            window.localStorage.setItem(SESSION_STORAGE_KEY, currentSessionId);
        }

        showActionDetection(plan.intent, plan.confidence);

        if (plan.intent === "create_ticket" && plan.requires_confirmation) {
            setAgentStatus(STATUS_COPY.waitingConfirmation);
            addBubble("Revisa el plan y confirma para continuar.", "ai");
        } else {
            setAgentStatus(getStatusCopy(plan.intent, "ready"));
            addBubble(STATUS_COPY.planReady, "ai");
        }

        renderPlan(plan);
        pushSessionHistory({
            userText: text,
            intent: plan.intent,
            action: deriveAction(plan)
        });

        if (!(plan.intent === "create_ticket" && plan.requires_confirmation)) {
            setAgentStatus(STATUS_COPY.completed);
        }

        problemInput.value = "";
    } catch (error) {
        showError(mapFriendlyError(error.message));
        setAgentStatus(STATUS_COPY.error);
        setResultPlaceholderVisibility(true);
    } finally {
        setTyping(false);
    }
}

// ── Execute confirmed action ───────────────────────────────────────────────────
async function executeConfirmedAction(draftPreview, aiLogId) {
    const confirmErrorBox = document.getElementById("confirmErrorBox");
    const confirmLoadingBox = document.getElementById("confirmLoadingBox");
    const confirmSuccessBox = document.getElementById("confirmSuccessBox");
    const confirmTicketId = document.getElementById("confirmTicketId");
    const confirmCreateBtn = document.getElementById("confirmCreateBtn");

    if (!draftPreview || !confirmCreateBtn) return;

    confirmErrorBox.classList.add("hidden");
    confirmLoadingBox.classList.remove("hidden");
    confirmCreateBtn.disabled = true;
    setAgentStatus(STATUS_COPY.savingTicket);

    try {
        const response = await fetch(SAVE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                titulo: draftPreview.titulo,
                descripcion: draftPreview.descripcion,
                prioridad: draftPreview.prioridad,
                categoria: draftPreview.categoria,
                ai_log_id: aiLogId,
            }),
        });

        if (!response.ok) throw new Error(await parseErrorResponse(response));

        const ticket = await response.json();
        confirmSuccessBox.classList.remove("hidden");
        confirmTicketId.textContent = "ID: " + ticket._id;
        confirmCreateBtn.innerHTML = "✔ Ticket creado";
        setAgentStatus(STATUS_COPY.completed);
        addBubble(`Ticket creado correctamente. ticket_id: ${ticket._id}`, "ai");
        updateLastHistoryAction(`ticket_created:${ticket._id}`);

        if (currentPlan && currentPlan.intent === "create_ticket") {
            currentPlan.requires_confirmation = false;
        }
    } catch (error) {
        confirmErrorBox.textContent = mapFriendlyError(error.message);
        confirmErrorBox.classList.remove("hidden");
        confirmCreateBtn.disabled = false;
        setAgentStatus(STATUS_COPY.waitingConfirmation);
    } finally {
        confirmLoadingBox.classList.add("hidden");
    }
}

// ── Event listeners ────────────────────────────────────────────────────────────
generateBtn.addEventListener("click", handleAgentResponse);

problemInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAgentResponse();
});

setAgentStatus(STATUS_COPY.initial);
setResultPlaceholderVisibility(true);
