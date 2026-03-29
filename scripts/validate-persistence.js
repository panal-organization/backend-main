#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const Tickets = require('../src/models/tickets.model');
const AILogs = require('../src/models/ai_logs.model');

async function main() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'APLICACIONES' });

    const now = new Date();
    const since = new Date(now.getTime() - 20 * 60 * 1000); // last 20 min

    const tickets = await Tickets.find({ is_deleted: false, created_at: { $gte: since } }).sort({ created_at: -1 }).lean();
    console.log('TICKETS_RECENT=' + tickets.length);
    tickets.forEach((t, i) => {
        const desc = (t.descripcion || '').replace(/\n/g, ' ').slice(0, 80);
        console.log(`T${i + 1}=${t._id}|${t.titulo}|${t.prioridad}|${t.categoria}|${t.estado}|${desc}`);
    });

    const logs = await AILogs.find({ created_at: { $gte: since } }).sort({ created_at: -1 }).lean();
    console.log('LOGS_RECENT=' + logs.length);
    logs.forEach((l, i) => {
        console.log(`L${i + 1}=${l._id}|intent=${l.intent}|source=${l.source}|executed=${l.executed}|confidence=${l.confidence}`);
    });

    const autoTickets = await Tickets.find({ titulo: 'Artículo sin stock', prioridad: 'CRITICA', is_deleted: false }).sort({ created_at: -1 }).lean();
    console.log('AUTO_TICKETS_TOTAL=' + autoTickets.length);
    autoTickets.forEach((t, i) => {
        const desc = (t.descripcion || '').split('\n')[0].slice(0, 80);
        console.log(`AT${i + 1}=${t._id}|${t.estado}|${t.prioridad}|${t.categoria}|${desc}`);
    });

    await mongoose.disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
