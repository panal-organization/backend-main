const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const AIController = require('../controllers/ai.controller');

const router = Router();

router.post('/tickets/draft', authMiddleware, AIController.createTicketDraft.bind(AIController));

module.exports = router;