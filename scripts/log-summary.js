require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LOGS_DIR = path.join(__dirname, '../logs');
const BACKEND_LOG_PATH = path.join(LOGS_DIR, 'backend.log');
const OUTPUT_PATH = path.join(LOGS_DIR, 'incident-summary.txt');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const LOG_LINES = Number(process.env.LOG_SUMMARY_LINES || 250);
const INCLUDE_DOCKER_LOGS = String(process.env.LOG_SUMMARY_INCLUDE_DOCKER || 'true').toLowerCase() === 'true';

function ensureLogsDir() {
    if (!fs.existsSync(LOGS_DIR)) {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
}

function tailText(text, lines) {
    return text.split(/\r?\n/).filter(Boolean).slice(-lines).join('\n');
}

function readBackendLogSnippet() {
    if (!fs.existsSync(BACKEND_LOG_PATH)) {
        return '[backend.log no encontrado]';
    }

    const content = fs.readFileSync(BACKEND_LOG_PATH, 'utf8');
    return tailText(content, LOG_LINES);
}

function readDockerLogs(container, lines = 80) {
    try {
        return execSync(`docker logs --tail ${lines} ${container}`, {
            stdio: ['ignore', 'pipe', 'pipe'],
            encoding: 'utf8'
        });
    } catch (error) {
        return `[No se pudieron leer logs de ${container}: ${error.message}]`;
    }
}

function fallbackSummary(rawText) {
    const lines = rawText.split(/\r?\n/).filter(Boolean);
    const errors = lines.filter((line) => /"level":"error"|\berror\b|\bexception\b/i.test(line)).length;
    const warns = lines.filter((line) => /"level":"warn"|\bwarn\b|\bwarning\b/i.test(line)).length;

    return [
        'Resumen ejecutivo: análisis local sin LLM (fallback).',
        `Top issues: ${errors} líneas de error y ${warns} líneas de advertencia detectadas en la ventana analizada.`,
        `Severidad: ${errors > 0 ? 'ALTA' : warns > 0 ? 'MEDIA' : 'BAJA'}.`,
        'Causa probable: revisar los eventos más recientes y correlacionar con deploy o cambios de configuración.',
        'Recomendación: validar /health, revisar contenedores en docker compose y depurar errores de aplicación más recientes.'
    ].join('\n');
}

async function askOllama(logText) {
    const prompt = [
        'Analiza los siguientes logs técnicos y responde en español con formato estricto:',
        '1) Resumen ejecutivo',
        '2) Top issues',
        '3) Severidad (ALTA/MEDIA/BAJA)',
        '4) Causa probable',
        '5) Recomendación accionable',
        '',
        'Logs:',
        logText
    ].join('\n');

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            prompt,
            stream: false,
            options: {
                temperature: 0.2,
                num_predict: 500
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Ollama respondió ${response.status}`);
    }

    const payload = await response.json();
    return payload.response || '';
}

(async () => {
    ensureLogsDir();

    const backendSnippet = readBackendLogSnippet();
    const dockerBackend = INCLUDE_DOCKER_LOGS ? readDockerLogs('panal-backend') : '[docker backend logs omitidos]';
    const dockerMongo = INCLUDE_DOCKER_LOGS ? readDockerLogs('panal-mongo') : '[docker mongo logs omitidos]';

    const consolidated = [
        '=== BACKEND FILE LOGS ===',
        backendSnippet,
        '',
        '=== DOCKER LOGS: panal-backend ===',
        dockerBackend,
        '',
        '=== DOCKER LOGS: panal-mongo ===',
        dockerMongo
    ].join('\n');

    let summary;
    try {
        summary = await askOllama(consolidated);
    } catch (error) {
        summary = `${fallbackSummary(consolidated)}\n\n[Fallback activado: ${error.message}]`;
    }

    const report = [
        `Fecha: ${new Date().toISOString()}`,
        `Modelo: ${OLLAMA_MODEL}`,
        '',
        summary,
        '',
        '---',
        'Fuente: scripts/log-summary.js'
    ].join('\n');

    fs.writeFileSync(OUTPUT_PATH, report, 'utf8');
    console.log(`Resumen de incidentes guardado en: ${OUTPUT_PATH}`);
})();
