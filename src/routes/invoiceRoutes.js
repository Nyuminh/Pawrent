const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { createInvoice, getInvoices, getInvoiceById, createInvoiceForSubscription, createInvoiceForBooking, createInvoiceFromCart, createInvoiceForService, createInvoiceForProducts, deleteInvoice, updateInvoiceStatus } = require('../controllers/invoiceController');

router.use(protect);

router.route('/').post(createInvoice).get(getInvoices);
router.route('/subscription').post(createInvoiceForSubscription);
router.route('/booking').post(createInvoiceForBooking);
router.route('/cart').post(createInvoiceFromCart);
router.route('/service').post(createInvoiceForService);
router.route('/products').post(createInvoiceForProducts);
router.route('/:id').get(getInvoiceById).delete(deleteInvoice);
router.route('/:id/status').get(require('../controllers/invoiceController').getInvoiceStatus).patch(updateInvoiceStatus);

module.exports = router;
