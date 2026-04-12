#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const Articulos = require('../src/models/articulos.model');

async function main() {
    if (!process.env.MONGODB_URI) {
        throw new Error('Missing MONGODB_URI environment variable');
    }

    await mongoose.connect(process.env.MONGODB_URI, {
        dbName: 'APLICACIONES'
    });

    try {
        const beforeMissing = await Articulos.countDocuments({
            $or: [
                { stock_actual: { $exists: false } },
                { stock_minimo: { $exists: false } },
                { unidad: { $exists: false } },
                { alerta_activa: { $exists: false } }
            ]
        });

        const docs = await Articulos.find({}, {
            stock_actual: 1,
            stock_minimo: 1,
            unidad: 1,
            alerta_activa: 1
        }).lean();

        const operations = docs
            .map((doc) => {
                const set = {};

                if (doc.stock_actual === undefined || doc.stock_actual === null) {
                    set.stock_actual = 0;
                }
                if (doc.stock_minimo === undefined || doc.stock_minimo === null) {
                    set.stock_minimo = 0;
                }
                if (!doc.unidad) {
                    set.unidad = 'unidad';
                }
                if (doc.alerta_activa === undefined || doc.alerta_activa === null) {
                    set.alerta_activa = false;
                }

                if (!Object.keys(set).length) {
                    return null;
                }

                return {
                    updateOne: {
                        filter: { _id: doc._id },
                        update: { $set: set }
                    }
                };
            })
            .filter(Boolean);

        const result = operations.length
            ? await Articulos.bulkWrite(operations)
            : { matchedCount: docs.length, modifiedCount: 0 };

        const afterMissing = await Articulos.countDocuments({
            $or: [
                { stock_actual: { $exists: false } },
                { stock_minimo: { $exists: false } },
                { unidad: { $exists: false } },
                { alerta_activa: { $exists: false } }
            ]
        });

        console.log(JSON.stringify({
            collection: 'articulos',
            matched: result.matchedCount,
            modified: result.modifiedCount,
            beforeMissing,
            afterMissing
        }, null, 2));
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error('[migrate-add-stock-fields] Error:', error.message);
    process.exit(1);
});
