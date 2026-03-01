const mongoose = require('mongoose')

class BaseService {
    constructor(model) {
        this.model = model;
    }

    async getAll(filters = {}) {
        const mongoFilters = {};

        Object.keys(filters).forEach(key => {
            let value = filters[key];

            if (value === undefined || value === '') return;

            //Boolean
            if (value === 'true') value = true;
            if (value === 'false') value = false;

            //Number
            else if (!isNaN(value) && value.trim() !== '') {
                value = Number(value);
            }

            //ObjectId
            else if (mongoose.Types.ObjectId.isValid(value)) {
                value = new mongoose.Types.ObjectId(value);
            }

            mongoFilters[key] = value;
        });

        return await this.model.find(mongoFilters);
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
