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

let currentPlan = null;
let currentSessionId = getOrCreateSessionId();

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

function showActionDetection(action, confidence) {
    const actionLabels = {
        draft: "Crear ticket",
        summary: "Resumen de tickets",
        classify: "Clasificación de tickets",
        create_ticket: "Creación de ticket",
    };

    const label = actionLabels[action] || action;
    const confPercent = (confidence * 100).toFixed(0);

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
                    Confianza: <strong>${typeof plan.confidence === "number" ? (plan.confidence * 100).toFixed(0) : "-"}%</strong>
                </span>
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
        showError("Escribe algo para que el agente pueda ayudarte.");
        return;
    }

    addBubble(text, "user");
    setTyping(true);
    resultCard.classList.add("hidden");

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

        if (plan.session_id && typeof plan.session_id === "string") {
            currentSessionId = plan.session_id;
            window.localStorage.setItem(SESSION_STORAGE_KEY, currentSessionId);
        }

        showActionDetection(plan.intent, plan.confidence);

        if (plan.intent === "create_ticket" && plan.requires_confirmation) {
            addBubble("Preparé un plan seguro. Revisa el borrador y confirma si deseas crear el ticket.", "ai");
        } else {
            addBubble("Plan generado y preview listo.", "ai");
        }

        renderPlan(plan);

        problemInput.value = "";
    } catch (error) {
        showError(error.message || "No se pudo conectar con el backend.");
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

        if (currentPlan && currentPlan.intent === "create_ticket") {
            currentPlan.requires_confirmation = false;
        }
    } catch (error) {
        confirmErrorBox.textContent = error.message || "No se pudo crear el ticket.";
        confirmErrorBox.classList.remove("hidden");
        confirmCreateBtn.disabled = false;
    } finally {
        confirmLoadingBox.classList.add("hidden");
    }
}

// ── Event listeners ────────────────────────────────────────────────────────────
generateBtn.addEventListener("click", handleAgentResponse);

problemInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAgentResponse();
});
