const app = require('./src/app');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    logger.info(`server_started`, { port: Number(PORT) });
});

process.on('unhandledRejection', (reason) => {
    logger.error('unhandled_rejection', {
        error: logger.serializeError(reason instanceof Error ? reason : new Error(String(reason)))
    });
});
process.on('uncaughtException', (error) => {
    logger.error('uncaught_exception', {
        error: logger.serializeError(error)
    });
});
