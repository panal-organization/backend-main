const mongoose = require('mongoose');
const Tickets = require('../models/tickets.model');
const Workspaces = require('../models/workspaces.model');
const WorkspacesUsuarios = require('../models/workspaces_usuarios.model');
const Usuarios = require('../models/usuarios.model');
const EmailService = require('./email.service');

const ALLOWED_PRIORITIES = ['BAJA', 'ALTA', 'CRITICA'];
const ALLOWED_CATEGORIES = ['SOPORTE', 'MEJORA'];
const ALLOWED_INPUT_KEYS = ['titulo', 'descripcion', 'prioridad', 'categoria'];

class TicketsFromAIService {
    async createFromDraft({ draft, jwtUserId, aiLogId }) {
        this.validateDraftInput(draft);

        const actor = await this.resolveActorContext({
            jwtUserId,
            demoModeEnabled: process.env.AI_DEMO_MODE === 'true',
            demoUserId: process.env.AI_DEMO_USER_ID,
            demoWorkspaceId: process.env.AI_DEMO_WORKSPACE_ID
        });

        const payload = {
            titulo: draft.titulo.trim(),
            descripcion: draft.descripcion.trim(),
            prioridad: draft.prioridad,
            categoria: draft.categoria,
            estado: 'PENDIENTE',
            foto: null,
            is_deleted: false,
            comentarios: [],
            created_by: actor.userId,
            workspace_id: actor.workspaceId
        };

        const ticket = await Tickets.create(payload);

        console.log(`🎫 Ticket creado desde IA: ${ticket._id} | usuario=${actor.userId} | workspace=${actor.workspaceId}`);
        console.log(`📨 Disparando flujo de notificación por email para ticket ${ticket._id}`);
        this.sendTicketNotificationAsync({ ticket, userId: actor.userId });

        return ticket;
    }

    /**
     * Envía notificación de email de forma asincrónica sin bloquear
     */
    async sendTicketNotificationAsync({ ticket, userId }) {
        try {
            console.log(`🔎 Buscando correo del usuario ${userId} para ticket ${ticket._id}`);
            const user = await Usuarios.findById(userId);

            if (!user || !user.correo) {
                console.warn(`⚠️  No se pudo obtener email para usuario ${userId}`);
                return;
            }

            console.log(`👤 Usuario resuelto para notificaciones: ${user.nombre || 'Sin nombre'} <${user.correo}>`);

            const ticketData = {
                ...ticket.toObject(),
                userEmail: user.correo
            };

            const notificationResult = await EmailService.sendTicketCreatedNotification({
                ticket: ticketData,
                userEmail: user.correo,
                userName: user.nombre
            });

            if (notificationResult?.ok) {
                console.log(`✅ Flujo de notificación completado para ticket ${ticket._id}`);
                return;
            }

            console.warn(`⚠️  Flujo de notificación finalizó con problemas para ticket ${ticket._id}:`, notificationResult);
        } catch (error) {
            console.error(`❌ Error en envío de notificación de email para ticket ${ticket._id}:`, {
                message: error.message,
                code: error.code || null,
                response: error.response || null
            });
        }
    }

    validateDraftInput(draft) {
        if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
            const error = new Error('Body invalido: se requiere un objeto JSON');
            error.status = 400;
            throw error;
        }

        const unknownKeys = Object.keys(draft).filter((key) => !ALLOWED_INPUT_KEYS.includes(key));
        if (unknownKeys.length > 0) {
            const error = new Error(`Campos no permitidos: ${unknownKeys.join(', ')}`);
            error.status = 400;
            throw error;
        }

        if (typeof draft.titulo !== 'string' || !draft.titulo.trim()) {
            const error = new Error('El campo titulo es requerido');
            error.status = 400;
            throw error;
        }

        if (typeof draft.descripcion !== 'string' || !draft.descripcion.trim()) {
            const error = new Error('El campo descripcion es requerido');
            error.status = 400;
            throw error;
        }

        if (!ALLOWED_PRIORITIES.includes(draft.prioridad)) {
            const error = new Error(`prioridad invalida. Permitidas: ${ALLOWED_PRIORITIES.join(', ')}`);
            error.status = 400;
            throw error;
        }

        if (!ALLOWED_CATEGORIES.includes(draft.categoria)) {
            const error = new Error(`categoria invalida. Permitidas: ${ALLOWED_CATEGORIES.join(', ')}`);
            error.status = 400;
            throw error;
        }
    }

    async resolveActorContext({ jwtUserId, demoModeEnabled, demoUserId, demoWorkspaceId }) {
        if (jwtUserId) {
            const workspaceId = await this.resolveWorkspaceIdForUser(jwtUserId);
            return {
                userId: jwtUserId,
                workspaceId,
                source: 'jwt'
            };
        }

        if (!demoModeEnabled) {
            const error = new Error('Ruta disponible con JWT o con AI_DEMO_MODE=true');
            error.status = 403;
            throw error;
        }

        if (!demoUserId || !demoWorkspaceId) {
            const error = new Error('AI_DEMO_USER_ID o AI_DEMO_WORKSPACE_ID no esta configurado');
            error.status = 500;
            throw error;
        }

        if (!mongoose.Types.ObjectId.isValid(demoUserId) || !mongoose.Types.ObjectId.isValid(demoWorkspaceId)) {
            const error = new Error('AI_DEMO_USER_ID o AI_DEMO_WORKSPACE_ID tiene formato invalido');
            error.status = 500;
            throw error;
        }

        await this.assertUserInWorkspace(demoUserId, demoWorkspaceId);

        return {
            userId: demoUserId,
            workspaceId: demoWorkspaceId,
            source: 'demo'
        };
    }

    async resolveWorkspaceIdForUser(userId) {
        const membership = await WorkspacesUsuarios.findOne({ usuario_id: userId }).sort({ createdAt: 1 });

        if (membership?.workspace_id) {
            return membership.workspace_id.toString();
        }

        const adminWorkspace = await Workspaces.findOne({ admin_id: userId, is_deleted: false }).sort({ created_at: 1 });

        if (adminWorkspace?._id) {
            return adminWorkspace._id.toString();
        }

        const error = new Error('No se encontro un workspace para el usuario');
        error.status = 404;
        throw error;
    }

    async assertUserInWorkspace(userId, workspaceId) {
        const membership = await WorkspacesUsuarios.findOne({
            workspace_id: workspaceId,
            usuario_id: userId
        });

        if (membership) {
            return;
        }

        const adminWorkspace = await Workspaces.findOne({
            _id: workspaceId,
            admin_id: userId,
            is_deleted: false
        });

        if (!adminWorkspace) {
            const error = new Error('El usuario no pertenece al workspace configurado para guardar tickets');
            error.status = 403;
            throw error;
        }
    }
}

module.exports = new TicketsFromAIService();