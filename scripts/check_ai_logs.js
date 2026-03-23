require('dotenv').config();
const mongoose = require('mongoose');
const AILogs = require('../src/models/ai_logs.model');

const ids = process.argv.slice(2);

async function run() {
    if (!ids.length) {
        throw new Error('Debes enviar al menos un ai_log_id');
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const docs = await AILogs.find({ _id: { $in: ids } }).lean();
    const normalized = docs.map((doc) => ({
        id: doc._id.toString(),
        user_id: doc.user_id?.toString?.() || doc.user_id,
        workspace_id: doc.workspace_id?.toString?.() || doc.workspace_id,
        mode: doc.mode,
        source: doc.source,
        intent: doc.intent,
        confidence: doc.confidence,
        requires_confirmation: doc.requires_confirmation,
        executed: doc.executed,
        execution_result: doc.execution_result,
        steps: doc.steps,
        preview_resumen: doc.preview_resumen,
        created_at: doc.created_at
    }));

    console.log(JSON.stringify(normalized, null, 2));
    await mongoose.disconnect();
}

run().catch(async (error) => {
    console.error(error);
    try {
        await mongoose.disconnect();
    } catch (_) {
        // ignore disconnect errors on failure path
    }
    process.exit(1);
});
