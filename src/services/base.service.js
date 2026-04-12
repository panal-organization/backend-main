const mongoose = require('mongoose')

class BaseService {
    constructor(model) {
        this.model = model;
    }

    async getAll(filters = {}) {
        let populateFields = [];
        if (filters.populate) {
            populateFields = filters.populate.split(',').map(p => p.trim());
            delete filters.populate;
        }

        const mongoFilters = {};

        Object.keys(filters).forEach(key => {
            if (key === 'populate') return; // Ensure it's not included in filters

            let value = filters[key];

            if (value === undefined || value === '') return;

            //Boolean conversion
            if (value === 'true') {
                value = true;
            } else if (value === 'false') {
                value = false;
            }
            //Number conversion (ensure value is string before trim)
            else if (typeof value === 'string' && value.trim() !== '' && !isNaN(value)) {
                value = Number(value);
            }

            //ObjectId
            else if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)) {
                value = new mongoose.Types.ObjectId(value);
            }

            mongoFilters[key] = value;
        });

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
