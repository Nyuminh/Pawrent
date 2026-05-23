const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { createMomoPayment, momoWebhook } = require('../controllers/paymentController');

// Create MoMo payment and return QR / payUrl
router.post('/momo/create', protect, createMomoPayment);

// MoMo webhook (no auth)
router.post('/momo/webhook', momoWebhook);

module.exports = router;
