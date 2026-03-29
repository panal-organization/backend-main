const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.initializeTransporter();
    }

    getConfigSummary() {
        return {
            SMTP_HOST: process.env.SMTP_HOST || null,
            SMTP_PORT: process.env.SMTP_PORT || null,
            SMTP_USER: process.env.SMTP_USER || null,
            SMTP_PASS: process.env.SMTP_PASS ? '[configured]' : null,
            SMTP_SECURE: process.env.SMTP_SECURE || null,
            ADMIN_NOTIFICATION_EMAIL: process.env.ADMIN_NOTIFICATION_EMAIL || null
        };
    }

    initializeTransporter() {
        try {
            const host = process.env.SMTP_HOST;
            const port = Number(process.env.SMTP_PORT) || 587;
            const secure = process.env.SMTP_SECURE === 'true';
            const user = process.env.SMTP_USER;

            console.log('[EmailService] SMTP config on init:', {
                host: host || '⚠️  undefined (will default to localhost)',
                port,
                secure,
                user: user || '⚠️  undefined'
            });

            this.transporter = nodemailer.createTransport({
                host,
                port,
                secure,
                auth: {
                    user,
                    pass: process.env.SMTP_PASS
                }
            });
        } catch (error) {
            console.error('⚠️  Error inicializando EmailService:', error.message);
            this.transporter = null;
        }
    }

    isConfigured() {
        return this.transporter && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
    }

    async verifyConnection() {
        if (!this.isConfigured()) {
            return {
                ok: false,
                error: 'SMTP no configurado completamente',
                config: this.getConfigSummary()
            };
        }

        try {
            await this.transporter.verify();
            return {
                ok: true,
                config: this.getConfigSummary()
            };
        } catch (error) {
            return {
                ok: false,
                error: error.message,
                code: error.code || null,
                response: error.response || null,
                config: this.getConfigSummary()
            };
        }
    }

    /**
     * Envía notificación de ticket creado al usuario y administrador
     * @param {Object} ticket - Documento del ticket creado
     * @param {string} userEmail - Email del usuario que creó el ticket
     * @param {string} userName - Nombre del usuario que creó el ticket
     */
    async sendTicketCreatedNotification({ ticket, userEmail, userName }) {
        if (!this.isConfigured()) {
            console.warn('⚠️  EmailService no está configurado. Saltando envío de notificaciones.', this.getConfigSummary());
            return {
                ok: false,
                reason: 'smtp_not_configured',
                deliveries: []
            };
        }

        const deliveries = [];

        try {
            const htmlContent = this.generateTicketEmailHTML({
                ticket,
                recipient: 'user',
                userName
            });

            console.log(`📧 Intentando enviar email al usuario: ${userEmail}`);
            const userDelivery = await this.sendEmail({
                to: userEmail,
                subject: '✓ Tu ticket ha sido creado en Panal',
                html: htmlContent,
                recipientName: userName
            });
            deliveries.push({ recipient: 'user', ...userDelivery });

            const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
            if (adminEmail) {
                console.log(`📧 Intentando enviar email al administrador: ${adminEmail}`);
                const adminHtmlContent = this.generateTicketEmailHTML({
                    ticket,
                    recipient: 'admin',
                    userName
                });

                const adminDelivery = await this.sendEmail({
                    to: adminEmail,
                    subject: `[PANAL] Nuevo ticket creado - #${ticket._id.toString().slice(-6).toUpperCase()}`,
                    html: adminHtmlContent,
                    recipientName: 'Administrador'
                });
                deliveries.push({ recipient: 'admin', ...adminDelivery });
            } else {
                console.warn('⚠️  ADMIN_NOTIFICATION_EMAIL no está configurado. No se envió notificación al administrador.');
            }

            return {
                ok: true,
                deliveries
            };
        } catch (error) {
            console.error('❌ Error enviando notificación de ticket:', {
                message: error.message,
                code: error.code || null,
                response: error.response || null
            });
            return {
                ok: false,
                reason: 'delivery_failed',
                error: {
                    message: error.message,
                    code: error.code || null,
                    response: error.response || null
                },
                deliveries
            };
        }
    }

    /**
     * Genera HTML profesional para el email del ticket
     */
    generateTicketEmailHTML({ ticket, recipient, userName }) {
        const priorityColors = {
            'BAJA': '#3498db',
            'ALTA': '#f39c12',
            'CRITICA': '#e74c3c'
        };

        const priorityBgColors = {
            'BAJA': '#e8f4f8',
            'ALTA': '#fef5e7',
            'CRITICA': '#fadbd8'
        };

        const priorityColor = priorityColors[ticket.prioridad] || '#95a5a6';
        const priorityBgColor = priorityBgColors[ticket.prioridad] || '#ecf0f1';

        const createdDate = new Date(ticket.createdAt || Date.now());
        const formattedDate = createdDate.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const ticketId = ticket._id.toString();
        const shortId = ticketId.slice(-6).toUpperCase();

        const isAdminRecipient = recipient === 'admin';

        return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f5f7fa;
            color: #2c3e50;
            line-height: 1.6;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            font-size: 24px;
            margin-bottom: 5px;
            font-weight: 600;
        }
        .header p {
            font-size: 14px;
            opacity: 0.9;
        }
        .content {
            padding: 30px 20px;
        }
        .greeting {
            font-size: 16px;
            color: #2c3e50;
            margin-bottom: 20px;
            line-height: 1.8;
        }
        .card {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
        }
        .card-title {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            color: #667eea;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }
        .card-content {
            font-size: 15px;
            color: #2c3e50;
            word-wrap: break-word;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 20px 0;
        }
        .info-item {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 15px;
        }
        .info-label {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            color: #7f8c8d;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }
        .info-value {
            font-size: 15px;
            color: #2c3e50;
            font-weight: 500;
        }
        .priority-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .priority-baja {
            background-color: #e8f4f8;
            color: #3498db;
            border: 1px solid #3498db;
        }
        .priority-alta {
            background-color: #fef5e7;
            color: #f39c12;
            border: 1px solid #f39c12;
        }
        .priority-critica {
            background-color: #fadbd8;
            color: #e74c3c;
            border: 1px solid #e74c3c;
        }
        .category-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            background-color: #e8f4f8;
            color: #667eea;
            letter-spacing: 0.5px;
        }
        .ticket-id {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 6px;
            text-align: center;
            margin: 20px 0;
            font-family: 'Monaco', 'Courier New', monospace;
        }
        .ticket-id-label {
            font-size: 11px;
            text-transform: uppercase;
            opacity: 0.8;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }
        .ticket-id-value {
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 2px;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            padding: 12px 30px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            margin-top: 20px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .footer {
            background-color: #f8f9fa;
            border-top: 1px solid #e9ecef;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #7f8c8d;
        }
        .footer p {
            margin: 5px 0;
        }
        .admin-note {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            font-size: 13px;
            color: #856404;
        }
        .admin-note strong {
            color: #745f24;
        }
        hr {
            border: none;
            border-top: 1px solid #e9ecef;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎟️  Panal</h1>
            <p>${isAdminRecipient ? 'Nuevo ticket creado en el sistema' : 'Tu ticket ha sido creado correctamente'}</p>
        </div>

        <div class="content">
            ${isAdminRecipient ? `
                <div class="admin-note">
                    <strong>Notificación de administrador:</strong> Un nuevo ticket ha sido creado por <strong>${userName}</strong>. Requerirá revisión y asignación.
                </div>
            ` : `
                <div class="greeting">
                    ¡Hola <strong>${userName}</strong>!<br><br>
                    Tu ticket de soporte ha sido creado correctamente en Panal. Te hemos asignado un número único para que puedas hacer seguimiento. El equipo de soporte revisará tu solicitud pronto.
                </div>
            `}

            <div class="ticket-id">
                <div class="ticket-id-label">Número de ticket</div>
                <div class="ticket-id-value">#${shortId}</div>
            </div>

            <div class="card">
                <div class="card-title">📋 Asunto del ticket</div>
                <div class="card-content">${this.escapeHtml(ticket.titulo)}</div>
            </div>

            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">⚡ Prioridad</div>
                    <div class="info-value">
                        <span class="priority-badge priority-${ticket.prioridad.toLowerCase()}">
                            ${ticket.prioridad}
                        </span>
                    </div>
                </div>
                <div class="info-item">
                    <div class="info-label">🏷️  Categoría</div>
                    <div class="info-value">
                        <span class="category-badge">${ticket.categoria}</span>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-title">📝 Descripción</div>
                <div class="card-content">${this.escapeHtml(ticket.descripcion).replace(/\n/g, '<br>')}</div>
            </div>

            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">📅 Fecha de creación</div>
                    <div class="info-value">${formattedDate}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">📊 Estado</div>
                    <div class="info-value">${ticket.estado || 'PENDIENTE'}</div>
                </div>
            </div>

            ${!isAdminRecipient ? `
                <div class="card">
                    <div class="card-title">💡 ¿Qué sigue?</div>
                    <div class="card-content">
                        <ul style="margin-left: 20px; color: #2c3e50;">
                            <li>Tu ticket ha sido asignado a nuestro equipo de soporte</li>
                            <li>Recibirás actualizaciones durante el proceso de resolución</li>
                            <li>Puedes hacer seguimiento usando tu número de ticket: <strong>#${shortId}</strong></li>
                        </ul>
                    </div>
                </div>
            ` : `
                <div class="card">
                    <div class="card-title">👤 Información del usuario</div>
                    <div class="card-content">
                        <strong>Usuario:</strong> ${this.escapeHtml(userName)}<br>
                        <strong>Email:</strong> ${this.escapeHtml(ticket.userEmail || 'No disponible')}
                    </div>
                </div>
            `}

            <hr>

            <p style="font-size: 13px; color: #2c3e50; text-align: center; margin-top: 20px;">
                Si tienes preguntas, responde a este correo o contáctanos desde la plataforma Panal.
            </p>
        </div>

        <div class="footer">
            <p><strong>Panal - Sistema de Gestión de Tickets</strong></p>
            <p>Este es un mensaje automático generado por el sistema Panal.</p>
            <p>Por favor, no respondas a este correo directamente si deseas añadir información a tu ticket.</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Envía un email genérico
     */
    async sendEmail({ to, subject, html, recipientName = 'Usuario' }) {
        if (!this.isConfigured()) {
            const error = new Error('EmailService no está configurado');
            error.code = 'SMTP_NOT_CONFIGURED';
            throw error;
        }

        try {
            const mailOptions = {
                from: `"Panal - Sistema de Soporte" <${process.env.SMTP_USER}>`,
                to,
                subject,
                html
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Email enviado correctamente a ${recipientName} (${to}): ${info.messageId}`);
            return {
                ok: true,
                to,
                recipientName,
                messageId: info.messageId
            };
        } catch (error) {
            console.error(`❌ Error enviando email a ${recipientName} (${to}):`, {
                message: error.message,
                code: error.code || null,
                response: error.response || null
            });
            throw error;
        }
    }

    /**
     * Escapa caracteres HTML para prevenir inyecciones
     */
    escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (char) => map[char]);
    }
}

module.exports = new EmailService();
