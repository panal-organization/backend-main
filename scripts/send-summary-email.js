require('dotenv').config();
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const SUMMARY_PATH = path.join(__dirname, '../logs/incident-summary.txt');

function isEnabled() {
    return String(process.env.SUMMARY_EMAIL_ENABLED || 'false').toLowerCase() === 'true';
}

function required(value, name) {
    if (!value || !String(value).trim()) {
        throw new Error(`Falta variable de entorno: ${name}`);
    }
    return value;
}

async function send() {
    if (!isEnabled()) {
        console.log('SUMMARY_EMAIL_ENABLED=false. Envío opcional omitido.');
        return;
    }

    if (!fs.existsSync(SUMMARY_PATH)) {
        throw new Error(`No existe el resumen: ${SUMMARY_PATH}. Ejecuta primero scripts/log-summary.js`);
    }

    const smtpHost = required(process.env.SMTP_HOST, 'SMTP_HOST');
    const smtpPort = Number(required(process.env.SMTP_PORT, 'SMTP_PORT'));
    const smtpUser = required(process.env.SMTP_USER, 'SMTP_USER');
    const smtpPass = required(process.env.SMTP_PASS, 'SMTP_PASS');
    const smtpSecure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
    const to = process.env.SUMMARY_EMAIL_TO || process.env.ADMIN_NOTIFICATION_EMAIL;

    required(to, 'SUMMARY_EMAIL_TO o ADMIN_NOTIFICATION_EMAIL');

    const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
            user: smtpUser,
            pass: smtpPass
        }
    });

    const summary = fs.readFileSync(SUMMARY_PATH, 'utf8');
    const subject = `[Panal][Incidentes] Resumen ${new Date().toISOString()}`;

    await transporter.sendMail({
        from: smtpUser,
        to,
        subject,
        text: summary
    });

    console.log(`Resumen enviado por correo a: ${to}`);
}

send().catch((error) => {
    console.error('Error enviando resumen por correo:', error.message);
    process.exit(1);
});
