require('dotenv').config();
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const BASE_URL = 'http://127.0.0.1:3000';
const FREE_PLAN_ID = '69a3de4281a5be4cb1bd8bc0';

const USERS = {
    premium: '699d2f62b00a373767e0adc1',
    free: '69aebe2dd2110d19adeffb69'
};

const PRIV_KEY = fs.readFileSync(path.join(__dirname, '../src/config/id_rsa_priv.pem'), 'utf8');

function issueBearer(userId) {
    const token = jwt.sign(
        { sub: userId, iat: Date.now() },
        PRIV_KEY,
        { expiresIn: '1d', algorithm: 'RS256' }
    );

    return `Bearer ${token}`;
}

async function postJson(route, { bearer, body }) {
    const response = await fetch(`${BASE_URL}${route}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: bearer
        },
        body: JSON.stringify(body)
    });

    const text = await response.text();
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (_error) {
        parsed = { raw: text };
    }

    return {
        status: response.status,
        body: parsed
    };
}

async function resolveWorkspaceIdForUser(userId) {
    const memberships = mongoose.connection.collection('workspaces_usuarios');
    const workspaces = mongoose.connection.collection('workspaces');

    const membership = await memberships.find({ usuario_id: new mongoose.Types.ObjectId(userId) })
        .sort({ createdAt: 1 })
        .limit(1)
        .next();

    if (membership && membership.workspace_id) {
        return membership.workspace_id.toString();
    }

    const adminWorkspace = await workspaces.find({
        admin_id: new mongoose.Types.ObjectId(userId),
        is_deleted: false
    }).sort({ created_at: 1 }).limit(1).next();

    if (adminWorkspace && adminWorkspace._id) {
        return adminWorkspace._id.toString();
    }

    return null;
}

function toIsoOrNull(value) {
    if (!value) {
        return null;
    }

    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) {
        return null;
    }

    return d.toISOString();
}

async function run() {
    const report = {
        baseUrl: BASE_URL,
        headersRequired: ['Content-Type: application/json', 'Authorization: Bearer <jwt>'],
        users: {},
        scenarios: [],
        createTicketValidation: null,
        observations: []
    };

    await mongoose.connect(process.env.MONGODB_URI);

    const usersCollection = mongoose.connection.collection('usuarios');
    const logsCollection = mongoose.connection.collection('ai_logs');
    const memoriesCollection = mongoose.connection.collection('agent_memories');
    const ticketsCollection = mongoose.connection.collection('tickets');

    const premiumWorkspaceId = await resolveWorkspaceIdForUser(USERS.premium);
    const freeWorkspaceId = await resolveWorkspaceIdForUser(USERS.free);

    report.users.premium = {
        userId: USERS.premium,
        workspaceId: premiumWorkspaceId
    };

    report.users.free = {
        userId: USERS.free,
        workspaceId: freeWorkspaceId
    };

    const premiumBearer = issueBearer(USERS.premium);
    const freeBearer = issueBearer(USERS.free);

    const scenario1Request = {
        route: '/api/ai/agent/plan',
        body: {
            text: 'dame un resumen de inventario',
            workspace_id: premiumWorkspaceId
        }
    };

    const scenario1Response = await postJson(scenario1Request.route, {
        bearer: premiumBearer,
        body: scenario1Request.body
    });

    const scenario1Pass = scenario1Response.status === 200 && !scenario1Response.body.blocked_reason;

    report.scenarios.push({
        id: 1,
        name: 'Usuario premium vigente',
        userId: USERS.premium,
        request: scenario1Request,
        response: scenario1Response,
        status: scenario1Pass ? 'PASS' : 'FAIL'
    });

    const scenario2Request = {
        route: '/api/ai/agent/plan',
        body: {
            text: 'dame un resumen de inventario',
            workspace_id: freeWorkspaceId || undefined
        }
    };

    const scenario2Response = await postJson(scenario2Request.route, {
        bearer: freeBearer,
        body: scenario2Request.body
    });

    const msg2 = (scenario2Response.body && (scenario2Response.body.message || '')).toLowerCase();
    const scenario2Pass = scenario2Response.status === 403 && (msg2.includes('plan') || msg2.includes('suscrip'));

    report.scenarios.push({
        id: 2,
        name: 'Usuario gratuito',
        userId: USERS.free,
        request: scenario2Request,
        response: scenario2Response,
        status: scenario2Pass ? 'PASS' : 'FAIL'
    });

    const premiumBefore = await usersCollection.findOne(
        { _id: new mongoose.Types.ObjectId(USERS.premium) },
        { projection: { plan_id: 1, plan_inicio: 1, plan_vence: 1, estatus: 1 } }
    );

    const originalPlanInicio = premiumBefore && Object.prototype.hasOwnProperty.call(premiumBefore, 'plan_inicio')
        ? premiumBefore.plan_inicio
        : undefined;
    const originalPlanVence = premiumBefore && Object.prototype.hasOwnProperty.call(premiumBefore, 'plan_vence')
        ? premiumBefore.plan_vence
        : undefined;

    const now = new Date();
    const expiredStart = new Date(now);
    expiredStart.setDate(expiredStart.getDate() - 60);
    const expiredEnd = new Date(now);
    expiredEnd.setDate(expiredEnd.getDate() - 1);

    await usersCollection.updateOne(
        { _id: new mongoose.Types.ObjectId(USERS.premium) },
        {
            $set: {
                plan_id: new mongoose.Types.ObjectId((premiumBefore.plan_id || '').toString()),
                plan_inicio: expiredStart,
                plan_vence: expiredEnd,
                estatus: true
            }
        }
    );

    const scenario3Request = {
        route: '/api/ai/agent/plan',
        body: {
            text: 'dame un resumen de inventario',
            workspace_id: premiumWorkspaceId
        }
    };

    const scenario3Response = await postJson(scenario3Request.route, {
        bearer: premiumBearer,
        body: scenario3Request.body
    });

    const msg3 = (scenario3Response.body && (scenario3Response.body.message || '')).toLowerCase();
    const scenario3Pass = scenario3Response.status === 403 && msg3.includes('suscrip');

    report.scenarios.push({
        id: 3,
        name: 'Usuario vencido (simulado temporalmente con rollback)',
        userId: USERS.premium,
        request: scenario3Request,
        response: scenario3Response,
        simulation: {
            plan_inicio: expiredStart.toISOString(),
            plan_vence: expiredEnd.toISOString()
        },
        status: scenario3Pass ? 'PASS' : 'FAIL'
    });

    await usersCollection.updateOne(
        { _id: new mongoose.Types.ObjectId(USERS.premium) },
        {
            $set: {
                plan_id: new mongoose.Types.ObjectId((premiumBefore.plan_id || '').toString()),
                estatus: premiumBefore.estatus !== false
            },
            ...(originalPlanInicio === undefined ? { $unset: { plan_inicio: '' } } : {}),
            ...(originalPlanInicio !== undefined ? { $set: { plan_inicio: originalPlanInicio } } : {}),
            ...(originalPlanVence === undefined ? { $unset: { plan_vence: '' } } : {}),
            ...(originalPlanVence !== undefined ? { $set: { plan_vence: originalPlanVence } } : {})
        }
    );

    await usersCollection.updateOne(
        { _id: new mongoose.Types.ObjectId(USERS.premium) },
        {
            $unset: {
                plan_inicio: '',
                plan_vence: ''
            },
            $set: {
                plan_id: new mongoose.Types.ObjectId((premiumBefore.plan_id || '').toString()),
                estatus: true
            }
        }
    );

    const scenario4Request = {
        route: '/api/ai/agent/plan',
        body: {
            text: 'dame un resumen de inventario',
            workspace_id: premiumWorkspaceId
        }
    };

    const scenario4Response = await postJson(scenario4Request.route, {
        bearer: premiumBearer,
        body: scenario4Request.body
    });

    const scenario4Pass = scenario4Response.status === 200;

    report.scenarios.push({
        id: 4,
        name: 'Usuario premium sin fechas (fallback)',
        userId: USERS.premium,
        request: scenario4Request,
        response: scenario4Response,
        simulation: {
            unsetFields: ['plan_inicio', 'plan_vence']
        },
        status: scenario4Pass ? 'PASS' : 'FAIL'
    });

    await usersCollection.updateOne(
        { _id: new mongoose.Types.ObjectId(USERS.premium) },
        {
            $set: {
                plan_id: new mongoose.Types.ObjectId((premiumBefore.plan_id || '').toString()),
                estatus: premiumBefore.estatus !== false,
                ...(originalPlanInicio !== undefined ? { plan_inicio: originalPlanInicio } : {}),
                ...(originalPlanVence !== undefined ? { plan_vence: originalPlanVence } : {})
            },
            ...(originalPlanInicio === undefined || originalPlanVence === undefined
                ? {
                    $unset: {
                        ...(originalPlanInicio === undefined ? { plan_inicio: '' } : {}),
                        ...(originalPlanVence === undefined ? { plan_vence: '' } : {})
                    }
                }
                : {})
        }
    );

    const createTicketText = `crea un ticket: E2E suscripcion ${Date.now()} validar usuario autenticado`;

    const createPlanRequest = {
        route: '/api/ai/agent/plan',
        body: {
            text: createTicketText,
            workspace_id: premiumWorkspaceId
        }
    };

    const createPlanResponse = await postJson(createPlanRequest.route, {
        bearer: premiumBearer,
        body: createPlanRequest.body
    });

    let continueResponse = null;
    let finalExecution = createPlanResponse.body;
    if (
        createPlanResponse.status === 200
        && createPlanResponse.body
        && createPlanResponse.body.requires_confirmation
        && createPlanResponse.body.ai_log_id
    ) {
        const continueRequest = {
            route: '/api/ai/agent/continue',
            body: {
                ai_log_id: createPlanResponse.body.ai_log_id
            }
        };

        continueResponse = await postJson(continueRequest.route, {
            bearer: premiumBearer,
            body: continueRequest.body
        });

        finalExecution = continueResponse.body;
    }

    let createdTicket = null;
    const createdTicketId = finalExecution
        && finalExecution.execution_result
        && finalExecution.execution_result.ticket_id
        ? finalExecution.execution_result.ticket_id
        : null;

    if (createdTicketId) {
        createdTicket = await ticketsCollection.findOne({ _id: new mongoose.Types.ObjectId(createdTicketId) });
    }

    const logId = (createPlanResponse.body && createPlanResponse.body.ai_log_id)
        || (continueResponse && continueResponse.body && continueResponse.body.ai_log_id)
        || null;

    let aiLog = null;
    if (logId && mongoose.Types.ObjectId.isValid(logId)) {
        aiLog = await logsCollection.findOne({ _id: new mongoose.Types.ObjectId(logId) });
    }

    const sessionId = (createPlanResponse.body && createPlanResponse.body.session_id)
        || (continueResponse && continueResponse.body && continueResponse.body.session_id)
        || null;

    let memory = null;
    if (sessionId) {
        memory = await memoriesCollection.findOne({
            user_id: new mongoose.Types.ObjectId(USERS.premium),
            workspace_id: new mongoose.Types.ObjectId(premiumWorkspaceId),
            session_id: sessionId
        });
    }

    const ticketUserMatch = Boolean(createdTicket && createdTicket.created_by && createdTicket.created_by.toString() === USERS.premium);
    const ticketWorkspaceMatch = Boolean(createdTicket && createdTicket.workspace_id && createdTicket.workspace_id.toString() === premiumWorkspaceId);
    const logUserMatch = Boolean(aiLog && aiLog.user_id && aiLog.user_id.toString() === USERS.premium);
    const logWorkspaceMatch = Boolean(aiLog && aiLog.workspace_id && aiLog.workspace_id.toString() === premiumWorkspaceId);
    const memoryUserMatch = Boolean(memory && memory.user_id && memory.user_id.toString() === USERS.premium);
    const memoryWorkspaceMatch = Boolean(memory && memory.workspace_id && memory.workspace_id.toString() === premiumWorkspaceId);

    report.createTicketValidation = {
        requestPlan: createPlanRequest,
        responsePlan: createPlanResponse,
        responseContinue: continueResponse,
        createdTicketId,
        ticketCreatedByAuthenticatedUser: ticketUserMatch,
        ticketWorkspaceMatchesAuthenticatedContext: ticketWorkspaceMatch,
        aiLogBoundToAuthenticatedUser: logUserMatch,
        aiLogBoundToAuthenticatedWorkspace: logWorkspaceMatch,
        memoryBoundToAuthenticatedUser: memoryUserMatch,
        memoryBoundToAuthenticatedWorkspace: memoryWorkspaceMatch,
        status: (createdTicketId && ticketUserMatch && ticketWorkspaceMatch && logUserMatch && logWorkspaceMatch)
            ? 'PASS'
            : 'FAIL'
    };

    const freeUserDoc = await usersCollection.findOne(
        { _id: new mongoose.Types.ObjectId(USERS.free) },
        { projection: { nombre: 1, correo: 1, plan_id: 1, plan_inicio: 1, plan_vence: 1, estatus: 1 } }
    );

    report.observations.push({
        key: 'free_user_snapshot',
        value: {
            userId: USERS.free,
            plan_id: freeUserDoc && freeUserDoc.plan_id ? freeUserDoc.plan_id.toString() : null,
            plan_inicio: toIsoOrNull(freeUserDoc && freeUserDoc.plan_inicio),
            plan_vence: toIsoOrNull(freeUserDoc && freeUserDoc.plan_vence),
            estatus: freeUserDoc ? freeUserDoc.estatus : null
        }
    });

    report.observations.push({
        key: 'expired_user_real_exists',
        value: false
    });

    report.observations.push({
        key: 'expired_user_test_strategy',
        value: 'Se simuló temporalmente vencimiento en usuario premium con rollback automático al estado original.'
    });

    console.log(JSON.stringify(report, null, 2));

    await mongoose.disconnect();
}

run().catch(async (error) => {
    console.error('E2E script failed:', error);
    try {
        await mongoose.disconnect();
    } catch (_error) {
        // ignore
    }
    process.exit(1);
});
