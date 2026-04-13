const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../../logs');
const backendLogPath = path.join(logsDir, 'backend.log');

function ensureLogDir() {
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
}

function serializeError(error) {
    if (!error) {
        return null;
    }

    return {
        name: error.name,
        message: error.message,
        stack: error.stack
    };
}

function writeLog(level, message, meta = {}) {
    ensureLogDir();

    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...meta
    };

    fs.appendFileSync(backendLogPath, `${JSON.stringify(entry)}\n`, 'utf8');

    const printable = `[${entry.timestamp}] [${level.toUpperCase()}] ${message}`;
    if (level === 'error') {
        console.error(printable);
    } else {
        console.log(printable);
    }
}

module.exports = {
    info: (message, meta) => writeLog('info', message, meta),
    warn: (message, meta) => writeLog('warn', message, meta),
    error: (message, meta) => writeLog('error', message, meta),
    serializeError,
    backendLogPath
};
