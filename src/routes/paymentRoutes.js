const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
	createMomoPayment,
	momoWebhook,
	createSePayPayment,
	renderSePayCheckoutPage,
	getSePayPaymentStatus,
	renderSePayReturnPage,
	sepayWebhook,
} = require('../controllers/paymentController');

// Create MoMo payment and return QR / payUrl
router.post('/momo/create', protect, createMomoPayment);

// MoMo webhook (no auth)
router.post('/momo/webhook', momoWebhook);

// SePay payment flow
router.post('/sepay/checkout/init', protect, createSePayPayment);
router.get('/sepay/checkout/:paymentId', renderSePayCheckoutPage);
router.get('/sepay/status/:paymentId', getSePayPaymentStatus);
router.get('/sepay/return/:result', renderSePayReturnPage);
router.post('/sepay/webhook', sepayWebhook);

module.exports = router;
