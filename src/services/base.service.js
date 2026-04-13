const mongoose = require('mongoose')

class BaseService {
    constructor(model) {
        this.model = model;
    }

    async getAll(filters = {}) {
        let populateFields = [];
        let includeDeleted = false;

        if (filters.populate) {
            populateFields = filters.populate.split(',').map(p => p.trim());
            delete filters.populate;
        }

        if (filters.include_deleted === 'true') {
            includeDeleted = true;
            delete filters.include_deleted;
        }

        const mongoFilters = {};

        Object.keys(filters).forEach(key => {
            if (key === 'populate') return;

            let value = filters[key];

            if (value === undefined || value === '') return;

            // Boolean conversion
            if (value === 'true') {
                value = true;
                mongoFilters[key] = value;
                return;
            }

            if (value === 'false') {
                value = false;
                mongoFilters[key] = value;
                return;
            }

            // Number conversion (ensure value is string before trim)
            if (typeof value === 'string' && value.trim() !== '' && !isNaN(value)) {
                value = Number(value);
                mongoFilters[key] = value;
                return;
            }

            //ObjectId
            if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)) {
                value = new mongoose.Types.ObjectId(value);
                mongoFilters[key] = value;
                return;
            }

            mongoFilters[key] = value;
        });

        // Excluir documentos eliminados por defecto (soft delete)
        // El cliente puede hacer ?include_deleted=true para verlos
        if (!includeDeleted && !mongoFilters.hasOwnProperty('is_deleted')) {
            mongoFilters.is_deleted = false;
        }

        const query = this.model.find(mongoFilters);
        populateFields.forEach(field => query.populate(field));

        return await query;
    }

    async get(id, populate = '') {
        const query = this.model.findById(id);
        if (populate) {
            const populateFields = populate.split(',').map(p => p.trim());
            populateFields.forEach(field => query.populate(field));
        }
        return await query;
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
