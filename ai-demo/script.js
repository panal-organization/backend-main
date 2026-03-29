const PLAN_URL = "http://127.0.0.1:3000/api/ai/agent/plan";
const CONTINUE_URL = "http://127.0.0.1:3000/api/ai/agent/continue";
const SESSION_STORAGE_KEY = "panal_ai_session_id";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const problemInput = document.getElementById("problemInput");
const generateBtn = document.getElementById("generateBtn");
const newConversationBtn = document.getElementById("newConversationBtn");
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
const toastContainer = document.getElementById("toastContainer");

let currentPlan = null;
let currentSessionId = getOrCreateSessionId();
let sessionHistory = [];
let activeConversationNonce = 0;

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
    persistSessionId(created);
    return created;
}

function persistSessionId(sessionId) {
    currentSessionId = sessionId;
    window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
}

function resetActionDetection() {
    actionDetectionBox.innerHTML = "";
    actionDetectionBox.classList.add("hidden");
}

function clearChatConversation() {
    const bubbles = chatArea.querySelectorAll(".bubble-wrapper");
    bubbles.forEach((bubble) => {
        if (bubble !== typingIndicator) {
            bubble.remove();
        }
    });
}

function resetConversationView() {
    hideError();
    setTyping(false);
    resetActionDetection();
    clearChatConversation();
    resultContent.innerHTML = "";
    resultCard.classList.add("hidden");
    setResultPlaceholderVisibility(true);
    sessionHistory = [];
    renderSessionHistory();
    problemInput.value = "";
    setAgentStatus(STATUS_COPY.initial);
}

function startNewConversation() {
    activeConversationNonce += 1;
    currentPlan = null;
    persistSessionId(generateSessionId());
    resetConversationView();
    problemInput.focus();
    showToast("Se inició una nueva conversación.", "info");
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
    blocked: "Solicitud atendida con políticas de seguridad.",
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
        },
        sensitive_request: {
            planning: "Estoy validando la solicitud con políticas de seguridad...",
            ready: "No puedo proporcionar contraseñas ni credenciales."
        },
        abusive_request: {
            planning: "Estoy revisando la solicitud...",
            ready: "Puedo ayudarte si describes el problema de forma profesional."
        },
        out_of_scope: {
            planning: "Estoy validando el alcance de la solicitud...",
            ready: "Solo puedo ayudar con soporte técnico y tickets dentro de Panal."
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
function formatTime(timestamp) {
    const date = timestamp ? new Date(timestamp) : new Date();
    if (Number.isNaN(date.getTime())) {
        return "--:--";
    }

    return new Intl.DateTimeFormat("es-MX", {
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}

function formatIntentLabel(intent) {
    const labels = {
        draft: "Borrador",
        summary: "Resumen",
        classify: "Clasificación",
        create_ticket: "Crear ticket",
        sensitive_request: "Solicitud sensible",
        abusive_request: "Lenguaje no permitido",
        out_of_scope: "Fuera de alcance"
    };

    return labels[intent] || sanitizeInline(intent);
}

function formatActionLabel(action) {
    if (!action || action === "none") {
        return "Sin acción";
    }

    if (action.startsWith("ticket_created:")) {
        return `Ticket creado · ${action.split(":")[1] || "sin ID"}`;
    }

    if (action === "plan_continued") {
        return "Plan continuado";
    }

    if (action === "plan_waiting_confirmation") {
        return "Pendiente de confirmación";
    }

    return action
        .split(" | ")
        .map((step) => step.replace(/_/g, " "))
        .join(" · ");
}

function deriveHistoryStatus(action) {
    const normalized = sanitizeInline(action).toLowerCase();

    if (normalized.includes("blocked:")) {
        return { label: "Bloqueado", tone: "warning" };
    }

    if (normalized.includes("ticket_created:")) {
        return { label: "Ticket creado", tone: "success" };
    }

    if (normalized.includes("requires_confirmation") || normalized.includes("waiting_confirmation")) {
        return { label: "Esperando confirmación", tone: "warning" };
    }

    if (normalized.includes("running")) {
        return { label: "En progreso", tone: "info" };
    }

    if (normalized.includes("completed") || normalized.includes("plan_continued")) {
        return { label: "Completado", tone: "success" };
    }

    return { label: "Registrado", tone: "neutral" };
}

function addBubble(text, type) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("bubble-wrapper",
        type === "user" ? "bubble-wrapper-user" : "bubble-wrapper-ai");

    const meta = document.createElement("div");
    meta.className = "bubble-meta";

    const author = document.createElement("span");
    author.className = "bubble-author";
    author.textContent = type === "user" ? "Tú" : "IA Panal";

    const timestamp = document.createElement("time");
    timestamp.className = "bubble-time";
    timestamp.dateTime = new Date().toISOString();
    timestamp.textContent = formatTime(timestamp.dateTime);

    meta.appendChild(author);
    meta.appendChild(timestamp);
    wrapper.appendChild(meta);

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

// ── Toast system ───────────────────────────────────────────────────────────────
function showToast(message, type = "info", duration = 4000) {
    if (!toastContainer) return;

    const icons = { success: "✔", info: "✦", warning: "⚠", error: "✕" };

    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.innerHTML = `
        <span class="toast-icon" aria-hidden="true">${icons[type] || "✦"}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" type="button" aria-label="Cerrar notificación">✕</button>
    `;

    toastContainer.appendChild(toast);

    let dismissTimer;

    const dismiss = () => {
        clearTimeout(dismissTimer);
        if (toast.classList.contains("toast--exit")) return;
        toast.classList.add("toast--exit");
        toast.addEventListener("animationend", () => toast.remove(), { once: true });
    };

    toast.querySelector(".toast-close").addEventListener("click", dismiss);
    dismissTimer = setTimeout(dismiss, duration);
    toast.addEventListener("mouseenter", () => clearTimeout(dismissTimer));
    toast.addEventListener("mouseleave", () => { dismissTimer = setTimeout(dismiss, 1500); });
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

    if (["sensitive_request", "abusive_request", "out_of_scope"].includes(plan.intent)) {
        return `blocked:${plan.blocked_reason || plan.intent}`;
    }

    if (plan.intent === "create_ticket" && plan.requires_confirmation) {
        return "create_ticket_pending_confirmation";
    }

    const steps = Array.isArray(plan.plan) ? plan.plan : plan.steps;
    if (Array.isArray(steps) && steps.length > 0) {
        return steps.map((step) => `${step.tool || "tool"}:${step.status || "ready"}`).join(" | ");
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

        const marker = document.createElement("span");
        marker.className = "session-history-marker";
        marker.setAttribute("aria-hidden", "true");

        const content = document.createElement("div");
        content.className = "session-history-content";

        const header = document.createElement("div");
        header.className = "session-history-top";

        const title = document.createElement("p");
        title.className = "session-history-text";
        title.textContent = entry.userText;

        const time = document.createElement("time");
        time.className = "session-history-time";
        time.dateTime = entry.createdAt;
        time.textContent = formatTime(entry.createdAt);

        header.appendChild(title);
        header.appendChild(time);

        const details = document.createElement("div");
        details.className = "session-history-details";

        const intentRow = document.createElement("div");
        intentRow.className = "session-history-row";
        intentRow.innerHTML = `
            <span class="session-history-label">Intent detectado</span>
            <span class="session-history-value">${formatIntentLabel(entry.intent)}</span>
        `;

        const actionRow = document.createElement("div");
        actionRow.className = "session-history-row";
        actionRow.innerHTML = `
            <span class="session-history-label">Acción tomada</span>
            <span class="session-history-value">${formatActionLabel(entry.action)}</span>
        `;

        const status = deriveHistoryStatus(entry.action);
        const statusRow = document.createElement("div");
        statusRow.className = "session-history-row";
        statusRow.innerHTML = `
            <span class="session-history-label">Estado final</span>
            <span class="history-status history-status--${status.tone}">${status.label}</span>
        `;

        details.appendChild(intentRow);
        details.appendChild(actionRow);
        details.appendChild(statusRow);

        content.appendChild(header);
        content.appendChild(details);

        item.appendChild(marker);
        item.appendChild(content);
        sessionHistoryList.appendChild(item);
    });

    sessionHistoryCard.classList.remove("hidden");
}

function isBlockedIntent(intent) {
    return ["sensitive_request", "abusive_request", "out_of_scope"].includes(intent);
}

function showActionDetection(action, confidence) {
    const actionLabels = {
        draft: "Crear ticket",
        summary: "Resumen de tickets",
        classify: "Clasificación de tickets",
        create_ticket: "Creación de ticket",
        sensitive_request: "Solicitud sensible bloqueada",
        abusive_request: "Lenguaje no permitido",
        out_of_scope: "Solicitud fuera de alcance",
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

    const statusIcons = {
        pending: "⏳",
        running: "◌",
        completed: "✔",
        requires_confirmation: "⏸",
        ready: "✔"
    };

    const statusLabels = {
        pending: "Pendiente",
        running: "En curso",
        completed: "Completado",
        requires_confirmation: "Requiere confirmación",
        ready: "Listo"
    };

    return steps.map((step, index) => {
        const status = step.status || "ready";
        const icon = statusIcons[status] || "•";
        return `
            <li class="plan-step" data-tool="${step.tool}">
                <span class="plan-step-index">${index + 1}</span>
                <div class="plan-step-body">
                    <span class="plan-step-tool">${step.tool}</span>
                    <span class="plan-step-helper">Paso del flujo del agente</span>
                </div>
                <span class="plan-step-status plan-step-status--${status}">${icon} ${statusLabels[status] || status}</span>
            </li>
        `;
    }).join("");
}

function renderPlanHeader(plan) {
    const steps = Array.isArray(plan.plan) ? plan.plan : plan.steps;

    return `
        <div class="plan-box">
            <div class="draft-header">
                <div class="draft-header-left">
                    <span class="draft-badge">Plan IA</span>
                    <h2>Plan de ejecución</h2>
                    <p class="plan-intent-line">Objetivo detectado: <strong>${sanitizeInline(plan.intent)}</strong></p>
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
            <div class="plan-steps-card draft-meta-item draft-meta-item-wide">
                <div class="plan-steps-heading">
                    <span class="draft-meta-label">Pasos del flujo</span>
                    <span class="plan-steps-count">${Array.isArray(steps) ? steps.length : 0} pasos</span>
                </div>
                <ul class="plan-steps">${renderSteps(steps)}</ul>
            </div>
        </div>
    `;
}

function renderDraftPreview(preview) {
    return `
        <div class="preview-card">
            <div class="draft-header">
                <div class="draft-header-left">
                    <span class="draft-badge">Preview borrador</span>
                    <h2>${preview.titulo || "-"}</h2>
                </div>
            </div>
            <p class="draft-descripcion">${preview.descripcion || "-"}</p>
            <div class="draft-meta draft-meta--preview">
                <div class="draft-meta-item draft-meta-item--card">
                    <span class="draft-meta-label">Prioridad</span>
                    <div id="previewPrioridad" class="preview-chip-slot"></div>
                </div>
                <div class="draft-meta-item draft-meta-item--card">
                    <span class="draft-meta-label">Categoría</span>
                    <div id="previewCategoria" class="preview-chip-slot"></div>
                </div>
            </div>
        </div>
    `;
}

function renderSummaryPreview(preview) {
    return `
        <div class="preview-card">
            <div class="draft-header">
                <div class="draft-header-left">
                    <span class="draft-badge">Preview resumen</span>
                    <h2>Resumen de tickets</h2>
                </div>
            </div>
            <p class="draft-descripcion">${preview.resumen || "Sin resumen disponible"}</p>
        </div>
    `;
}

function renderClassifyPreview(preview) {
    return `
        <div class="preview-card">
            <div class="draft-header">
                <div class="draft-header-left">
                    <span class="draft-badge">Preview clasificación</span>
                    <h2>Clasificación del problema</h2>
                </div>
                <span class="draft-confidence-badge">
                    Confianza: <strong>${typeof preview.confidence === "number" ? (preview.confidence * 100).toFixed(0) : "-"}%</strong>
                </span>
            </div>
            <div class="draft-meta draft-meta--preview">
                <div class="draft-meta-item draft-meta-item--card">
                    <span class="draft-meta-label">Prioridad</span>
                    <div id="classifyPreviewPrioridad" class="preview-chip-slot"></div>
                </div>
                <div class="draft-meta-item draft-meta-item--card">
                    <span class="draft-meta-label">Categoría</span>
                    <div id="classifyPreviewCategoria" class="preview-chip-slot"></div>
                </div>
                <div class="draft-meta-item draft-meta-item-wide draft-meta-item--card">
                    <span class="draft-meta-label">Justificación</span>
                    <p class="summary-recomendacion">${preview.justificacion || "Sin justificación disponible"}</p>
                </div>
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
                    <p class="confirmation-lead">El agente ya preparó el borrador. Revisa la información y confirma para ejecutar este paso.</p>
                </div>
            </div>

            <div class="confirmation-notice">
                <span class="confirmation-notice-icon" aria-hidden="true">⏸</span>
                <div>
                    <strong>Este flujo requiere una acción tuya</strong>
                    <p>El ticket no se guardará hasta que confirmes explícitamente la creación.</p>
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

function renderBlockedCard(plan) {
    return `
        <div class="blocked-card blocked-card--${plan.blocked_reason || "default"}">
            <div class="blocked-card-icon" aria-hidden="true">⚠</div>
            <div class="blocked-card-body">
                <span class="draft-badge">Solicitud bloqueada</span>
                <h2>${formatIntentLabel(plan.intent)}</h2>
                <p class="draft-descripcion">${plan.message || STATUS_COPY.blocked}</p>
                <div class="blocked-guidance">
                    <span class="draft-meta-label">Qué sí puedo hacer</span>
                    <p>${plan.guidance || "Puedo ayudarte con tickets, clasificación y resúmenes de soporte dentro de Panal."}</p>
                </div>
            </div>
        </div>
    `;
}

function renderPlan(plan) {
    let previewHtml = "";

    if (isBlockedIntent(plan.intent)) {
        previewHtml = renderBlockedCard(plan);
    } else if (plan.intent === "create_ticket" && plan.requires_confirmation && plan.draft_preview) {
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
            confirmCreateBtn.addEventListener("click", () => executeConfirmedAction(plan.ai_log_id));
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
    const requestNonce = activeConversationNonce;
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
        if (requestNonce !== activeConversationNonce) {
            return;
        }

        currentPlan = plan;

        setAgentStatus(getStatusCopy(plan.intent, "planning"));

        if (plan.session_id && typeof plan.session_id === "string") {
            persistSessionId(plan.session_id);
        }

        showActionDetection(plan.intent, plan.confidence);

        if (isBlockedIntent(plan.intent)) {
            setAgentStatus(getStatusCopy(plan.intent, "ready"));
            addBubble(plan.message || STATUS_COPY.blocked, "ai");
            showToast(plan.message || STATUS_COPY.blocked, "warning", 6000);
        } else if (plan.intent === "create_ticket" && plan.requires_confirmation) {
            setAgentStatus(STATUS_COPY.waitingConfirmation);
            addBubble("Revisa el plan y confirma para continuar.", "ai");
            showToast("Plan generado. Revisa y confirma para guardar el ticket.", "warning", 6000);
        } else {
            setAgentStatus(getStatusCopy(plan.intent, "ready"));
            addBubble(STATUS_COPY.planReady, "ai");
            showToast(getStatusCopy(plan.intent, "ready"), "success");
        }

        renderPlan(plan);
        pushSessionHistory({
            userText: text,
            intent: plan.intent,
            action: deriveAction(plan)
        });

        if (isBlockedIntent(plan.intent)) {
            setAgentStatus(STATUS_COPY.blocked);
        } else if (!(plan.intent === "create_ticket" && plan.requires_confirmation)) {
            setAgentStatus(STATUS_COPY.completed);
        }

        problemInput.value = "";
    } catch (error) {
        showError(mapFriendlyError(error.message));
        setAgentStatus(STATUS_COPY.error);
        setResultPlaceholderVisibility(true);
        showToast(mapFriendlyError(error.message), "error");
    } finally {
        setTyping(false);
    }
}

// ── Execute confirmed action ───────────────────────────────────────────────────
async function executeConfirmedAction(aiLogId) {
    const confirmErrorBox = document.getElementById("confirmErrorBox");
    const confirmLoadingBox = document.getElementById("confirmLoadingBox");
    const confirmSuccessBox = document.getElementById("confirmSuccessBox");
    const confirmTicketId = document.getElementById("confirmTicketId");
    const confirmCreateBtn = document.getElementById("confirmCreateBtn");

    if (!aiLogId || !confirmCreateBtn) return;

    const requestNonce = activeConversationNonce;

    confirmErrorBox.classList.add("hidden");
    confirmSuccessBox.classList.add("hidden");
    confirmLoadingBox.classList.remove("hidden");
    confirmCreateBtn.disabled = true;
    setAgentStatus(STATUS_COPY.savingTicket);

    try {
        const response = await fetch(CONTINUE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ai_log_id: aiLogId,
            }),
        });

        if (!response.ok) throw new Error(await parseErrorResponse(response));

        const continuation = await response.json();
        if (requestNonce !== activeConversationNonce) {
            return;
        }

        const ticketId = continuation?.execution_result?.ticket_id;
        const requiresMoreConfirmation = Boolean(continuation?.requires_confirmation);

        if (!requiresMoreConfirmation) {
            confirmSuccessBox.classList.remove("hidden");
            confirmTicketId.textContent = ticketId ? `ID: ${ticketId}` : "Plan continuado sin ticket final.";
            confirmCreateBtn.innerHTML = ticketId ? "✔ Ticket creado" : "✔ Plan continuado";
            setAgentStatus(STATUS_COPY.completed);
            addBubble(
                ticketId
                    ? `Ticket creado correctamente. ticket_id: ${ticketId}`
                    : "Plan continuado correctamente.",
                "ai"
            );
            if (ticketId) {
                showToast(`Ticket creado correctamente · ID: ${ticketId}`, "success", 6000);
                updateLastHistoryAction(`ticket_created:${ticketId}`);
            } else {
                showToast("Acción completada correctamente.", "success");
                updateLastHistoryAction("plan_continued");
            }
        } else {
            confirmCreateBtn.disabled = false;
            confirmCreateBtn.innerHTML = "✔ Confirmar siguiente paso";
            setAgentStatus(STATUS_COPY.waitingConfirmation);
            addBubble("Se completaron pasos intermedios; se requiere nueva confirmación.", "ai");
            showToast("Se completaron pasos intermedios. Se requiere nueva confirmación.", "warning", 6000);
            updateLastHistoryAction("plan_waiting_confirmation");
        }

        if (continuation && typeof continuation === "object") {
            currentPlan = continuation;
            renderPlan(currentPlan);
        }
    } catch (error) {
        confirmErrorBox.textContent = mapFriendlyError(error.message);
        confirmErrorBox.classList.remove("hidden");
        confirmCreateBtn.disabled = false;
        setAgentStatus(STATUS_COPY.waitingConfirmation);
        showToast(mapFriendlyError(error.message), "error");
    } finally {
        confirmLoadingBox.classList.add("hidden");
    }
}

// ── Event listeners ────────────────────────────────────────────────────────────
generateBtn.addEventListener("click", handleAgentResponse);
newConversationBtn.addEventListener("click", startNewConversation);

problemInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAgentResponse();
});

resetConversationView();
