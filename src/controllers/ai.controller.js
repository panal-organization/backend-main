const { AIService } = require('../services');
const Workspaces = require('../models/workspaces.model');
const WorkspacesUsuarios = require('../models/workspaces_usuarios.model');

class AIController {
    async createTicketDraft(req, res) {
        try {
            const userId = req.jwt?.sub;
            const { text, workspace_id: requestedWorkspaceId } = req.body;

            if (!userId) {
                return res.status(401).json({ message: 'Usuario no autenticado' });
            }

            if (typeof text !== 'string' || !text.trim()) {
                return res.status(400).json({ message: 'El campo text es requerido' });
            }

            const workspaceId = await this.resolveWorkspaceId(userId, requestedWorkspaceId);
            const draft = await AIService.createTicketDraft({
                text: text.trim(),
                userId,
                workspaceId
            });

            return res.status(200).json(draft);
        } catch (error) {
            return res.status(error.status || 500).json({ message: error.message });
        }
    }

    async resolveWorkspaceId(userId, requestedWorkspaceId) {
        if (requestedWorkspaceId) {
            const membership = await WorkspacesUsuarios.findOne({
                workspace_id: requestedWorkspaceId,
                usuario_id: userId
            });

            if (membership) {
                return requestedWorkspaceId;
            }

            const adminWorkspace = await Workspaces.findOne({
                _id: requestedWorkspaceId,
                admin_id: userId,
                is_deleted: false
            });

            if (adminWorkspace) {
                return requestedWorkspaceId;
            }

            const error = new Error('El usuario no pertenece al workspace indicado');
            error.status = 403;
            throw error;
        }

        const membership = await WorkspacesUsuarios.findOne({ usuario_id: userId }).sort({ createdAt: 1 });

        if (membership?.workspace_id) {
            return membership.workspace_id.toString();
        }

        const adminWorkspace = await Workspaces.findOne({ admin_id: userId, is_deleted: false }).sort({ created_at: 1 });

        if (adminWorkspace?._id) {
            return adminWorkspace._id.toString();
        }

        const error = new Error('No se encontro un workspace para el usuario autenticado');
        error.status = 404;
        throw error;
    }
}

module.exports = new AIController();