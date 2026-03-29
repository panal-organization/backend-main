function validateRequiredEnv() {
    const required = [
        'MONGODB_URI',
        'AI_SERVICE_URL',
        'AI_INTERNAL_API_KEY',
        'SMTP_HOST',
        'SMTP_PORT',
        'SMTP_USER',
        'SMTP_PASS',
        'SMTP_SECURE',
        'ADMIN_NOTIFICATION_EMAIL'
    ];

    const missing = required.filter((key) => {
        const value = process.env[key];
        return !value || !String(value).trim();
    });

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    const smtpPort = Number(process.env.SMTP_PORT);
    if (Number.isNaN(smtpPort) || smtpPort <= 0) {
        throw new Error('Invalid SMTP_PORT environment variable. It must be a valid positive number.');
    }
}

module.exports = {
    validateRequiredEnv
};
