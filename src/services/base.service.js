class BaseService {
    constructor(model) {
        this.model = model;
    }

    async getAll() {
        return await this.model.find();
    }

    async get(id) {
        return await this.model.findById(id);
    }

    async create(entity) {
        return await this.model.create(entity);
    }

    async update(id, entity) {
        const item = await this.model.findById(id);
        if (!item) return null;
        item.set(entity);
        return await item.save();
    }

    async delete(id) {
        return await this.model.findByIdAndDelete(id);
    }
}

module.exports = BaseService;
