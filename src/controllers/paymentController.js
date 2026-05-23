const axios = require('axios');
const crypto = require('crypto');
const QRCode = require('qrcode');
const Payment = require('../models/Payment');

// POST /api/v1/payments/momo/create
// Requires env: MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, MOMO_SECRET_KEY, MOMO_ENDPOINT, BACKEND_URL, FRONTEND_URL
exports.createMomoPayment = async (req, res, next) => {
  try {
    let { amount, orderInfo = 'Thanh toán PAWRENT', metadata = {}, invoiceId } = req.body;

    // If invoiceId provided, use invoice total
    if (invoiceId) {
      const Invoice = require('../models/Invoice');
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
      if (invoice.status !== 'pending') return res.status(400).json({ success: false, message: 'Invoice is not pending' });
      amount = invoice.total;
      metadata.invoiceId = invoice._id;
    }

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ.' });
    }

    const partnerCode = process.env.MOMO_PARTNER_CODE;
    const accessKey = process.env.MOMO_ACCESS_KEY;
    const secretKey = process.env.MOMO_SECRET_KEY;
    const endpoint = process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create';
    const returnUrl = process.env.FRONTEND_URL || 'https://example.com/pay-success';
    const notifyUrl = `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/v1/payments/momo/webhook`;

    // create DB record (pending)
    const payment = await Payment.create({
      user: req.user ? req.user.id : undefined,
      amount: Number(amount),
      currency: 'VND',
      provider: 'momo',
      status: 'pending',
      metadata,
    });

    const orderId = `pawrent_${payment._id}`;
    const requestId = `req_${Date.now()}`;
    const requestType = 'captureWallet';

    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=&ipnUrl=${notifyUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${returnUrl}&requestId=${requestId}&requestType=${requestType}`;
    const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

    const payload = {
      partnerCode,
      accessKey,
      requestId,
      amount: String(amount),
      orderId,
      orderInfo,
      redirectUrl: returnUrl,
      ipnUrl: notifyUrl,
      extraData: '',
      requestType,
      signature,
    };

    const { data } = await axios.post(endpoint, payload, { timeout: 10000 });

    if (!data || (data.errorCode && Number(data.errorCode) !== 0)) {
      payment.status = 'failed';
      await payment.save();
      return res.status(500).json({ success: false, message: 'Không thể tạo payment tại MoMo', detail: data });
    }

    const payUrl = data.payUrl || data.qrUrl || data.deeplink;
    let qrDataUrl = null;
    if (payUrl) {
      qrDataUrl = await QRCode.toDataURL(payUrl);
    }

    payment.providerPaymentId = data.requestId || data.orderId || data.transId || '';
    payment.qrUrl = qrDataUrl;
    await payment.save();

    // link payment -> invoice if present
    if (metadata && metadata.invoiceId) {
      const Invoice = require('../models/Invoice');
      const inv = await Invoice.findById(metadata.invoiceId);
      if (inv) {
        inv.payment = payment._id;
        await inv.save();
      }
    }

    return res.status(201).json({ success: true, paymentId: payment._id, payUrl, qrDataUrl });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/payments/momo/webhook
// MoMo will send POST notifications here; verify and update payment status
exports.momoWebhook = async (req, res, next) => {
  try {
    const body = req.body;
    // Example fields: resultCode, orderId, requestId, amount, signature
    const { resultCode, orderId } = body;

    // find local payment by orderId
    const payment = await Payment.findOne({ $or: [{ 'metadata.orderId': orderId }, { providerPaymentId: orderId }, { 'metadata.order_id': orderId }] });
    if (!payment) {
      // try to parse id from prefix
      if (orderId && orderId.startsWith('pawrent_')) {
        const id = orderId.replace('pawrent_', '');
        const p2 = await Payment.findById(id);
        if (p2) {
          if (Number(resultCode) === 0) p2.status = 'paid'; else p2.status = 'failed';
          await p2.save();
        }
      }
      return res.json({ success: true });
    }

    if (Number(resultCode) === 0) payment.status = 'paid'; else payment.status = 'failed';
    await payment.save();

    // If payment linked to invoice, mark invoice paid
    try {
      const Invoice = require('../models/Invoice');
      let invoice = null;
      if (payment.metadata && payment.metadata.invoiceId) {
        invoice = await Invoice.findById(payment.metadata.invoiceId);
      }
      // fallback: if orderId format pawrent_<paymentId> and invoice linked
      if (!invoice && orderId && orderId.startsWith('pawrent_')) {
        const pid = orderId.replace('pawrent_', '');
        const p = await Payment.findById(pid);
        if (p && p.metadata && p.metadata.invoiceId) invoice = await Invoice.findById(p.metadata.invoiceId);
      }

      if (invoice) {
        invoice.status = Number(resultCode) === 0 ? 'paid' : 'cancelled';
        invoice.payment = payment._id;
        await invoice.save();
      }
    } catch (e) {
      // ignore invoice update errors
      console.error('Invoice update error', e.message);
    }

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
