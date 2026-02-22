class BaseController {
    constructor(service) {
        this.service = service;
    }

    async getAll(req, res) {
        try {
            const items = await this.service.getAll();
            return res.json(items);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    async get(req, res) {
        const { id } = req.params;
        try {
            const item = await this.service.get(id);
            if (!item) return res.status(404).json({ message: 'No encontrado' });
            return res.json(item);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    async create(req, res) {
        const { body } = req;
        try {
            const item = await this.service.create(body);
            return res.status(201).json(item);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }

    async update(req, res) {
        const { id } = req.params;
        const { body } = req;
        try {
            const item = await this.service.update(id, body);
            if (!item) return res.status(404).json({ message: 'No encontrado' });
            return res.json(item);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }

    async delete(req, res) {
        const { id } = req.params;
        try {
            const item = await this.service.delete(id);
            if (!item) return res.status(404).json({ message: 'No encontrado' });
            return res.json({ message: 'Eliminado correctamente' });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
}

module.exports = BaseController;
