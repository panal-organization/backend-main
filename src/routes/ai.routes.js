const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const optionalAuthMiddleware = require('../middlewares/optional-auth.middleware');
const AIController = require('../controllers/ai.controller');

const router = Router();

// Agent router: decide action and execute it (JWT optional, falls back to demo mode)
router.post('/agent', optionalAuthMiddleware, AIController.routeAgent.bind(AIController));
router.post('/agent/plan', optionalAuthMiddleware, AIController.planAgent.bind(AIController));
router.post('/agent/continue', optionalAuthMiddleware, AIController.continueAgentPlan.bind(AIController));

// Ruta protegida con JWT
router.post('/tickets/draft', authMiddleware, AIController.createTicketDraft.bind(AIController));

// Ruta de demo (sin autenticación, controlada por AI_DEMO_MODE)
router.post('/tickets/draft-demo', AIController.createTicketDraftDemo.bind(AIController));

module.exports = router;