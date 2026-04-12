const express = require('express');
const { protect, requirePremium } = require('../middleware/auth');
const {
  sendMessage,
  getChatHistory,
  getChatSession,
  endChatSession,
} = require('../controllers/chatController');

const router = express.Router();

// All routes require auth + premium
router.use(protect);

router.post('/', requirePremium('ai_chatbot'), sendMessage);
router.get('/history', getChatHistory);
router.get('/:sessionId', getChatSession);
router.put('/:sessionId/end', endChatSession);

module.exports = router;
