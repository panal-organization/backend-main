const BaseService = require('./base.service');
const Workspaces = require('../models/workspaces.model');
const WorkspacesUsuarios = require('../models/workspaces_usuarios.model');

class WorkspacesService extends BaseService {
    constructor() {
        super(Workspaces);
    }

    async joinByCode(codigo, usuario_id) {
        // 1. Buscar el workspace por el código
        const workspace = await Workspaces.findOne({ codigo, is_deleted: false });

        if (!workspace) {
            const error = new Error('Código de espacio de trabajo no válido');
            error.status = 404;
            throw error;
        }

        // 2. Verificar si el usuario ya es miembro
        const existingMembership = await WorkspacesUsuarios.findOne({
            workspace_id: workspace._id,
            usuario_id: usuario_id
        });

        if (existingMembership) {
            const error = new Error('Ya eres miembro de este espacio de trabajo');
            error.status = 400;
            throw error;
        }

        // 3. Crear la relación
        const membership = new WorkspacesUsuarios({
            workspace_id: workspace._id,
            usuario_id: usuario_id
        });

        await membership.save();

        return {
            message: 'Te has unido correctamente al espacio de trabajo',
            workspace: {
                _id: workspace._id,
                nombre: workspace.nombre
            }
        };
    }
}

module.exports = new WorkspacesService();
