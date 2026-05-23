const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { createInvoice, getInvoices, getInvoiceById } = require('../controllers/invoiceController');

router.use(protect);

router.route('/').post(createInvoice).get(getInvoices);
router.route('/:id').get(getInvoiceById);

module.exports = router;
