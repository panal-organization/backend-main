const logger = require('../utils/logger');

module.exports = function requestLogger(req, res, next) {
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
        const finishedAt = process.hrtime.bigint();
        const durationMs = Number(finishedAt - startedAt) / 1000000;

        logger.info('http_request', {
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: Number(durationMs.toFixed(2)),
            ip: req.ip,
            userAgent: req.get('user-agent') || 'unknown'
        });
    });

    next();
};
