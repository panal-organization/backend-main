#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');

const DB_NAME = 'APLICACIONES';
const TARGET_COLLECTIONS = [
    'articulos',
    'almacens',
    'articulos_propiedades',
    'plantillas',
    'propiedades',
    'plantilla_propiedades'
];

const STOCK_FIELDS_TO_CHECK = [
    'cantidad',
    'stock',
    'existencia',
    'minimo',
    'almacen_id',
    'estado',
    'nombre',
    'descripcion'
];

function safePrint(obj) {
    console.log(JSON.stringify(obj, null, 2));
}

function summarizeDocs(docs, maxDocs = 3) {
    return docs.slice(0, maxDocs).map((doc) => {
        const clone = { ...doc };
        if (clone._id && typeof clone._id === 'object' && clone._id.toString) {
            clone._id = clone._id.toString();
        }
        return clone;
    });
}

function collectFields(docs) {
    const fields = new Set();
    docs.forEach((doc) => {
        Object.keys(doc || {}).forEach((key) => fields.add(key));
    });
    return Array.from(fields).sort();
}

async function inspectCollection(db, collectionName) {
    const collection = db.collection(collectionName);
    const count = await collection.countDocuments();
    const sampleLimit = Math.min(count, 30);
    const sample = sampleLimit > 0
        ? await collection.find({}, { projection: {} }).limit(sampleLimit).toArray()
        : [];

    return {
        collection: collectionName,
        count,
        fields: collectFields(sample),
        sample: summarizeDocs(sample)
    };
}

async function inspectRelationships(db) {
    const articulos = db.collection('articulos');
    const almacens = db.collection('almacens');
    const articulosPropiedades = db.collection('articulos_propiedades');
    const propiedades = db.collection('propiedades');
    const plantillaPropiedades = db.collection('plantilla_propiedades');
    const plantillas = db.collection('plantillas');

    const [
        articulosCount,
        almacensCount,
        articulosPropCount,
        propiedadesCount,
        plantillaPropCount,
        plantillasCount
    ] = await Promise.all([
        articulos.countDocuments(),
        almacens.countDocuments(),
        articulosPropiedades.countDocuments(),
        propiedades.countDocuments(),
        plantillaPropiedades.countDocuments(),
        plantillas.countDocuments()
    ]);

    const articulosWithAlmacen = await articulos.countDocuments({ almacen_id: { $exists: true, $ne: null } });
    const articulosWithoutAlmacen = await articulos.countDocuments({
        $or: [
            { almacen_id: { $exists: false } },
            { almacen_id: null }
        ]
    });

    const brokenArticuloAlmacen = await articulos.aggregate([
        { $match: { almacen_id: { $exists: true, $ne: null } } },
        {
            $lookup: {
                from: 'almacens',
                localField: 'almacen_id',
                foreignField: '_id',
                as: 'almacen_ref'
            }
        },
        { $match: { almacen_ref: { $size: 0 } } },
        { $count: 'total' }
    ]).toArray();

    const brokenArticuloPropArticulo = await articulosPropiedades.aggregate([
        {
            $lookup: {
                from: 'articulos',
                localField: 'articulo_id',
                foreignField: '_id',
                as: 'articulo_ref'
            }
        },
        { $match: { articulo_ref: { $size: 0 } } },
        { $count: 'total' }
    ]).toArray();

    const brokenArticuloPropPropiedad = await articulosPropiedades.aggregate([
        {
            $lookup: {
                from: 'propiedades',
                localField: 'propiedad_id',
                foreignField: '_id',
                as: 'propiedad_ref'
            }
        },
        { $match: { propiedad_ref: { $size: 0 } } },
        { $count: 'total' }
    ]).toArray();

    const brokenPlantillaPropPlantilla = await plantillaPropiedades.aggregate([
        {
            $lookup: {
                from: 'plantillas',
                localField: 'plantilla_id',
                foreignField: '_id',
                as: 'plantilla_ref'
            }
        },
        { $match: { plantilla_ref: { $size: 0 } } },
        { $count: 'total' }
    ]).toArray();

    const brokenPlantillaPropPropiedad = await plantillaPropiedades.aggregate([
        {
            $lookup: {
                from: 'propiedades',
                localField: 'propiedad_id',
                foreignField: '_id',
                as: 'propiedad_ref'
            }
        },
        { $match: { propiedad_ref: { $size: 0 } } },
        { $count: 'total' }
    ]).toArray();

    return {
        counts: {
            articulos: articulosCount,
            almacens: almacensCount,
            articulos_propiedades: articulosPropCount,
            propiedades: propiedadesCount,
            plantilla_propiedades: plantillaPropCount,
            plantillas: plantillasCount
        },
        articulos_almacens: {
            articulosWithAlmacen,
            articulosWithoutAlmacen,
            brokenReferences: brokenArticuloAlmacen[0]?.total || 0
        },
        articulos_articulos_propiedades: {
            totalLinks: articulosPropCount,
            brokenArticuloRefs: brokenArticuloPropArticulo[0]?.total || 0,
            brokenPropiedadRefs: brokenArticuloPropPropiedad[0]?.total || 0
        },
        plantillas_propiedades: {
            totalLinks: plantillaPropCount,
            brokenPlantillaRefs: brokenPlantillaPropPlantilla[0]?.total || 0,
            brokenPropiedadRefs: brokenPlantillaPropPropiedad[0]?.total || 0
        }
    };
}

async function inspectStockFieldPresence(db) {
    const collections = ['articulos', 'almacens'];
    const result = {};

    for (const name of collections) {
        const collection = db.collection(name);
        const sample = await collection.find({}).limit(100).toArray();
        const fields = collectFields(sample);

        result[name] = {
            found: STOCK_FIELDS_TO_CHECK.filter((field) => fields.includes(field)),
            missing: STOCK_FIELDS_TO_CHECK.filter((field) => !fields.includes(field))
        };
    }

    return result;
}

async function main() {
    if (!process.env.MONGODB_URI) {
        throw new Error('Missing MONGODB_URI environment variable');
    }

    await mongoose.connect(process.env.MONGODB_URI, {
        dbName: DB_NAME
    });

    try {
        const db = mongoose.connection.db;
        const existingCollections = await db.listCollections({}, { nameOnly: true }).toArray();
        const existingNames = existingCollections.map((c) => c.name);

        const targetAvailability = TARGET_COLLECTIONS.map((name) => ({
            collection: name,
            exists: existingNames.includes(name)
        }));

        const collectionReports = [];
        for (const collectionName of TARGET_COLLECTIONS) {
            if (!existingNames.includes(collectionName)) {
                collectionReports.push({
                    collection: collectionName,
                    count: 0,
                    fields: [],
                    sample: [],
                    warning: 'Collection does not exist in database'
                });
                continue;
            }
            collectionReports.push(await inspectCollection(db, collectionName));
        }

        const relationships = await inspectRelationships(db);
        const stockFieldPresence = await inspectStockFieldPresence(db);

        safePrint({
            database: DB_NAME,
            targetAvailability,
            collectionReports,
            stockFieldPresence,
            relationships
        });
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error('[inspect-inventory-collections] Error:', error.message);
    process.exit(1);
});
