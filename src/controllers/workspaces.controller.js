const BaseController = require('./base.controller');
const WorkspacesService = require('../services/workspaces.service');

class WorkspacesController extends BaseController {
    constructor() {
        super(WorkspacesService);
    }

    async joinByCode(req, res) {
        const { usuario_id, codigo } = req.body;

        try {
            if (!codigo) {
                return res.status(400).json({ message: 'El código es requerido' });
            }

            const result = await WorkspacesService.joinByCode(codigo, usuario_id);
            return res.status(200).json(result);
        } catch (error) {
            return res.status(error.status || 500).json({ message: error.message });
        }
    }
}

module.exports = new WorkspacesController();
