const axios = require('axios');
const crypto = require('crypto');
const QRCode = require('qrcode');
const Payment = require('../models/Payment');

function getBaseUrl() {
  return (process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');
}

function getPublicBaseUrl(req) {
  const explicitFrontend = String(process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
  if (explicitFrontend) return explicitFrontend;

  const explicitBackend = String(process.env.BACKEND_URL || '').trim().replace(/\/$/, '');
  if (explicitBackend) return explicitBackend;

  if (req) {
    const forwardedProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
    const host = String(req.headers['x-forwarded-host'] || req.get('host') || '').split(',')[0].trim();
    if (host) return `${forwardedProto || 'https'}://${host}`.replace(/\/$/, '');
  }

  const vercelUrl = String(process.env.VERCEL_URL || '').trim().replace(/\/$/, '');
  if (vercelUrl) return `https://${vercelUrl}`;

  return 'https://example.com';
}

function isPlaceholderUrl(value) {
  if (!value) return false;
  return /your-domain\.com/i.test(String(value)) || /example\.com/i.test(String(value));
}

function resolveCallbackUrl(candidate, fallback) {
  if (!candidate || isPlaceholderUrl(candidate)) return fallback;
  return candidate;
}

function getSePayConfig() {
  const sePayEnv = String(process.env.SEPAY_ENV || '').toLowerCase();
  const merchantId = process.env.SEPAY_MERCHANT_ID || '';
  const secretKey = process.env.SEPAY_SECRET_KEY || '';
  const looksLikeLiveKeys = /^SP-LIVE-/i.test(merchantId) || /^spsk_live_/i.test(secretKey);
  const isProduction =
    sePayEnv === 'production' ||
    (sePayEnv === '' && (looksLikeLiveKeys || String(process.env.NODE_ENV || '').toLowerCase() === 'production'));
  return {
    merchantId,
    secretKey,
    checkoutEndpoint:
      process.env.SEPAY_CHECKOUT_URL ||
      (isProduction ? 'https://pay.sepay.vn/v1/checkout/init' : 'https://pay-sandbox.sepay.vn/v1/checkout/init'),
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildQrOptions() {
  return {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 512,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  };
}

function buildSePaySignature(fields, secretKey) {
  const signedFieldOrder = [
    'merchant',
    'operation',
    'payment_method',
    'order_invoice_number',
    'order_amount',
    'currency',
    'order_description',
    'customer_id',
    'success_url',
    'error_url',
    'cancel_url',
  ];

  const signedPayload = signedFieldOrder
    .filter((field) => fields[field] !== undefined && fields[field] !== null && fields[field] !== '')
    .map((field) => `${field}=${fields[field]}`)
    .join(',');

  return crypto.createHmac('sha256', secretKey).update(signedPayload).digest('base64');
}

function renderAutoSubmitPage({ title, message, action, fields }) {
  const inputs = Object.entries(fields)
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`)
    .join('');

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f7fb; color: #1f2937; }
    .card { width: min(92vw, 520px); background: #fff; border-radius: 20px; padding: 28px; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12); }
    h1 { margin: 0 0 10px; font-size: 24px; }
    p { margin: 0 0 18px; line-height: 1.6; color: #4b5563; }
    .hint { font-size: 14px; color: #6b7280; }
    button { appearance: none; border: 0; border-radius: 12px; background: #111827; color: #fff; padding: 12px 18px; font-size: 15px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <p class="hint">Nếu trình duyệt không tự chuyển hướng, bấm nút bên dưới.</p>
    <form id="sepay-form" method="POST" action="${escapeHtml(action)}">
      ${inputs}
      <button type="submit">Tiếp tục thanh toán</button>
    </form>
  </div>
  <script>
    document.getElementById('sepay-form').submit();
  </script>
</body>
</html>`;
}

function renderDebugPage({ action, fields }) {
  const inputs = Object.entries(fields)
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`)
    .join('');

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SePay Debug Checkout</title>
  <style>body{font-family:Arial,Helvetica,sans-serif;padding:20px;background:#f3f4f6}pre{background:#fff;padding:16px;border-radius:8px;overflow:auto}</style>
</head>
<body>
  <h1>SePay Debug Checkout</h1>
  <p>Action: <strong>${escapeHtml(action)}</strong></p>
  <h2>Fields</h2>
  <pre>${escapeHtml(JSON.stringify(fields, null, 2))}</pre>
  <form method="POST" action="${escapeHtml(action)}">
    ${inputs}
    <button type="submit">Gửi thử đến SePay</button>
  </form>
</body>
</html>`;
}

function renderStatusPage({ title, paymentId, initialMessage }) {
  const statusUrl = `/api/v1/payments/sepay/status/${encodeURIComponent(paymentId)}`;

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%); color: #0f172a; }
    .card { width: min(92vw, 540px); background: #fff; border-radius: 20px; padding: 28px; box-shadow: 0 24px 72px rgba(15, 23, 42, 0.15); }
    h1 { margin: 0 0 10px; font-size: 24px; }
    p { margin: 0 0 16px; line-height: 1.6; color: #475569; }
    .status { font-weight: 700; color: #111827; }
    .pending { color: #b45309; }
    .paid { color: #15803d; }
    .failed { color: #b91c1c; }
    .meta { font-size: 14px; color: #64748b; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p id="message">${escapeHtml(initialMessage)}</p>
    <p class="meta">Mã giao dịch: ${escapeHtml(paymentId)}</p>
    <p class="status pending" id="status">Đang kiểm tra...</p>
  </div>
  <script>
    const statusEl = document.getElementById('status');
    const messageEl = document.getElementById('message');

    async function refreshStatus() {
      try {
        const response = await fetch('${statusUrl}', { cache: 'no-store' });
        const payload = await response.json();
        const status = payload && payload.data ? payload.data.status : 'pending';

        statusEl.className = 'status ' + status;
        if (status === 'paid') {
          statusEl.textContent = 'Thanh toán thành công';
          messageEl.textContent = 'Hệ thống đã nhận xác nhận từ SePay. Bạn có thể quay lại ứng dụng để xem kết quả.';
          return true;
        }

        if (status === 'failed') {
          statusEl.textContent = 'Thanh toán thất bại';
          messageEl.textContent = 'Giao dịch chưa hoàn tất hoặc đã bị từ chối.';
          return true;
        }

        statusEl.textContent = 'Chưa ghi nhận thanh toán';
        return false;
      } catch (error) {
        statusEl.className = 'status pending';
        statusEl.textContent = 'Đang chờ phản hồi từ hệ thống';
        return false;
      }
    }

    refreshStatus();
    setInterval(refreshStatus, 2500);
  </script>
</body>
</html>`;
}

function normalizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  return { ...metadata };
}

function setSePayHtmlHeaders(res) {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; form-action 'self' https://pay.sepay.vn https://pay-sandbox.sepay.vn; connect-src 'self';"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

async function clearInvoiceCartIfPaid(invoice) {
  if (!invoice) return;

  const User = require('../models/User');

  // Case 1: invoice created from cart → clear entire cart
  if (invoice.cart) {
    await User.findByIdAndUpdate(invoice.cart, { $set: { cart: [] } });
    return;
  }

  // Case 2: invoice created from POST /invoices/products → remove only purchased products from cart
  if (invoice.user && Array.isArray(invoice.items) && invoice.items.length > 0) {
    const productRefIds = invoice.items
      .filter((item) => item.type === 'product' && item.refId)
      .map((item) => String(item.refId));

    if (productRefIds.length > 0) {
      await User.findByIdAndUpdate(invoice.user, {
        $pull: { cart: { product: { $in: productRefIds } } },
      });
    }
  }
}

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

// POST /api/v1/payments/sepay/checkout/init
// Creates a pending SePay payment and returns a QR URL + checkout page URL.
exports.createSePayPayment = async (req, res, next) => {
  try {
    const {
      amount: rawAmount,
      orderDescription = 'Thanh toan PAWRENT',
      paymentMethod = 'BANK_TRANSFER',
      operation = 'PURCHASE',
      customerId,
      successUrl,
      errorUrl,
      cancelUrl,
      metadata = {},
      invoiceId,
    } = req.body;

    const sePayConfig = getSePayConfig();
    if (!sePayConfig.merchantId || !sePayConfig.secretKey) {
      return res.status(500).json({
        success: false,
        message: 'Thiếu cấu hình SEPAY_MERCHANT_ID hoặc SEPAY_SECRET_KEY.',
      });
    }

    const normalizedMetadata = normalizeMetadata(metadata);
    let amount = rawAmount;

    if (!successUrl || !errorUrl || !cancelUrl) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng truyền successUrl, errorUrl và cancelUrl từ frontend.',
      });
    }

    if (invoiceId) {
      const Invoice = require('../models/Invoice');
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
      if (invoice.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'Invoice is not pending' });
      }

      amount = invoice.total;
      normalizedMetadata.invoiceId = invoice._id;
    }

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ.' });
    }

    const payment = await Payment.create({
      user: req.user ? req.user.id : undefined,
      amount: numericAmount,
      currency: 'VND',
      provider: 'sepay',
      status: 'pending',
      metadata: normalizedMetadata,
    });

    const paymentId = String(payment._id);
    const orderInvoiceNumber = `SP-${paymentId}`;
    const baseUrl = getBaseUrl();
    const checkoutPageUrl = `${baseUrl}/api/v1/payments/sepay/checkout/${paymentId}`;

    payment.providerPaymentId = orderInvoiceNumber;
    payment.checkoutUrl = checkoutPageUrl;
    payment.qrUrl = await QRCode.toDataURL(checkoutPageUrl, buildQrOptions());
    payment.metadata = {
      ...normalizedMetadata,
      sepay: {
        orderInvoiceNumber,
        orderDescription,
        paymentMethod,
        operation,
        customerId: customerId || null,
        successUrl,
        errorUrl,
        cancelUrl,
      },
    };
    await payment.save();

    if (normalizedMetadata.invoiceId) {
      const Invoice = require('../models/Invoice');
      const invoice = await Invoice.findById(normalizedMetadata.invoiceId);
      if (invoice) {
        invoice.payment = payment._id;
        await invoice.save();
      }
    }

    return res.status(201).json({
      success: true,
      paymentId: payment._id,
      provider: 'sepay',
      amount: payment.amount,
      checkoutPageUrl,
      qrDataUrl: payment.qrUrl,
      qrImageUrl: `${baseUrl}/api/v1/payments/sepay/qr/${payment._id}.png`,
      statusUrl: `${baseUrl}/api/v1/payments/sepay/status/${payment._id}`,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/payments/sepay/qr/:paymentId.png
// Returns a direct PNG QR image so clients can render/print it without data URL handling.
exports.renderSePayQrImage = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment || payment.provider !== 'sepay') {
      return res.status(404).send('Payment not found');
    }

    const qrBuffer = await QRCode.toBuffer(payment.checkoutUrl || `${getBaseUrl()}/api/v1/payments/sepay/checkout/${payment._id}`, buildQrOptions());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(qrBuffer);
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/payments/sepay/checkout/:paymentId
// Returns an auto-submitting HTML form that sends the browser to SePay checkout.
exports.renderSePayCheckoutPage = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment || payment.provider !== 'sepay') {
      return res.status(404).send('Payment not found');
    }

    setSePayHtmlHeaders(res);

    const sePayConfig = getSePayConfig();
    if (!sePayConfig.merchantId || !sePayConfig.secretKey) {
      return res.status(500).send('SePay is not configured');
    }

    const sepayMetadata = (payment.metadata && payment.metadata.sepay) || {};
    const publicBaseUrl = getPublicBaseUrl(req);
    const fields = {
      merchant: sePayConfig.merchantId,
      operation: sepayMetadata.operation || 'PURCHASE',
      payment_method: sepayMetadata.paymentMethod || 'BANK_TRANSFER',
      order_invoice_number: sepayMetadata.orderInvoiceNumber || `SP-${payment._id}`,
      order_amount: String(payment.amount),
      currency: payment.currency || 'VND',
      order_description: sepayMetadata.orderDescription || 'Thanh toan PAWRENT',
      success_url: resolveCallbackUrl(
        sepayMetadata.successUrl,
        `${publicBaseUrl}/api/v1/payments/sepay/return/success?paymentId=${payment._id}`
      ),
      error_url: resolveCallbackUrl(
        sepayMetadata.errorUrl,
        `${publicBaseUrl}/api/v1/payments/sepay/return/error?paymentId=${payment._id}`
      ),
      cancel_url: resolveCallbackUrl(
        sepayMetadata.cancelUrl,
        `${publicBaseUrl}/api/v1/payments/sepay/return/cancel?paymentId=${payment._id}`
      ),
    };

    if (sepayMetadata.customerId) {
      fields.customer_id = sepayMetadata.customerId;
    }

    fields.signature = buildSePaySignature(fields, sePayConfig.secretKey);

    // Debug logging for SePay integration problems (do not log secret keys)
    try {
      console.log('[SePay] checkoutEndpoint=', sePayConfig.checkoutEndpoint);
      console.log('[SePay] merchant=', sePayConfig.merchantId);
      console.log('[SePay] fields=', JSON.stringify(fields));
      console.log('[SePay] signature=', fields.signature);
    } catch (e) {
      /* ignore logging errors */
    }

    return res
      .status(200)
      .send(
        renderAutoSubmitPage({
          title: 'Chuyen huong den SePay',
          message: 'He thong dang mo trang thanh toan SePay cho giao dich nay.',
          action: sePayConfig.checkoutEndpoint,
          fields,
        })
      );
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/payments/sepay/status/:paymentId
// Lightweight polling endpoint for the frontend or the return page.
exports.getSePayPaymentStatus = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: payment._id,
        provider: payment.provider,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        checkoutUrl: payment.checkoutUrl,
        qrDataUrl: payment.qrUrl,
        invoiceId: payment.metadata && payment.metadata.invoiceId ? payment.metadata.invoiceId : undefined,
        updatedAt: payment.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/payments/sepay/return/:result
// Simple return page so customers have something to see after SePay redirects back.
exports.renderSePayReturnPage = async (req, res, next) => {
  try {
    const { paymentId } = req.query;
    if (!paymentId) {
      return res.status(400).send('Missing paymentId');
    }

    setSePayHtmlHeaders(res);

    const result = String(req.params.result || 'success');
    const payment = await Payment.findById(paymentId);
    if (payment && payment.provider === 'sepay' && ['error', 'cancel'].includes(result)) {
      payment.status = 'failed';
      payment.metadata = {
        ...(payment.metadata || {}),
        sepay: {
          ...((payment.metadata && payment.metadata.sepay) || {}),
          lastReturnResult: result,
        },
      };
      await payment.save();

      try {
        const Invoice = require('../models/Invoice');
        const invoiceId = payment.metadata && payment.metadata.invoiceId;
        if (invoiceId) {
          const invoice = await Invoice.findById(invoiceId);
          if (invoice) {
            invoice.status = 'cancelled';
            invoice.payment = payment._id;
            await invoice.save();
          }
        }
      } catch (invoiceErr) {
        console.error('SePay return invoice update error:', invoiceErr.message);
      }
    }

    const title = result === 'success' ? 'Thanh toan dang duoc xac nhan' : 'Ket qua thanh toan SePay';
    const message =
      result === 'success'
        ? 'SePay da chuyen huong ve he thong. Trang nay se tu dong kiem tra trang thai giao dich.'
        : 'Giao dịch đã quay lại hệ thống. Trang nay sẽ kiểm tra trạng thái của giao dịch.';

    return res.status(200).send(renderStatusPage({ title, paymentId, initialMessage: message }));
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/payments/sepay/webhook
// SePay IPN webhook: update payment and invoice status from payment notifications.
exports.sepayWebhook = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const order = payload.order || {};
    const transaction = payload.transaction || {};
    const orderInvoiceNumber = order.order_invoice_number || order.order_id || order.id;

    const payment = await Payment.findOne({
      $or: [
        { provider: 'sepay', providerPaymentId: orderInvoiceNumber },
        { 'metadata.sepay.orderInvoiceNumber': orderInvoiceNumber },
        { 'metadata.sepay.orderId': orderInvoiceNumber },
      ],
    });

    if (!payment) {
      return res.status(200).json({ success: true });
    }

    const notificationType = String(payload.notification_type || '').toUpperCase();
    const orderStatus = String(order.order_status || '').toUpperCase();
    const transactionStatus = String(transaction.transaction_status || '').toUpperCase();

    const isPaid =
      notificationType === 'ORDER_PAID' ||
      orderStatus === 'CAPTURED' ||
      transactionStatus === 'APPROVED' ||
      transactionStatus === 'SUCCESS';

    const isFailed =
      notificationType === 'ORDER_FAILED' ||
      ['DECLINED', 'CANCELLED', 'FAILED', 'VOIDED'].includes(orderStatus) ||
      ['DECLINED', 'FAILED'].includes(transactionStatus);

    if (isPaid) {
      payment.status = 'paid';
    } else if (isFailed) {
      payment.status = 'failed';
    }

    payment.metadata = {
      ...(payment.metadata || {}),
      sepay: {
        ...((payment.metadata && payment.metadata.sepay) || {}),
        lastNotification: payload,
      },
    };

    await payment.save();

    try {
      const Invoice = require('../models/Invoice');
      const invoiceId = payment.metadata && payment.metadata.invoiceId;
      if (invoiceId) {
        const invoice = await Invoice.findById(invoiceId);
        if (invoice) {
          invoice.payment = payment._id;
          invoice.status = payment.status === 'paid' ? 'paid' : payment.status === 'failed' ? 'cancelled' : invoice.status;
          await invoice.save();

          if (payment.status === 'paid') {
            await clearInvoiceCartIfPaid(invoice);
          }
        }
      }
    } catch (invoiceErr) {
      console.error('SePay invoice update error:', invoiceErr.message);
    }

    return res.status(200).json({ success: true });
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

          if (Number(resultCode) === 0 && p2.metadata && p2.metadata.invoiceId) {
            const Invoice = require('../models/Invoice');
            const invoice = await Invoice.findById(p2.metadata.invoiceId);
            if (invoice) {
              invoice.payment = p2._id;
              invoice.status = 'paid';
              await invoice.save();
              await clearInvoiceCartIfPaid(invoice);
            }
          }
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

        if (Number(resultCode) === 0) {
          await clearInvoiceCartIfPaid(invoice);
        }
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

// @desc    Get payment by invoice ID
// @route   GET /api/v1/payments/invoice/:invoiceId
// @access  Private
exports.getPaymentByInvoiceId = async (req, res, next) => {
  try {
    const { invoiceId } = req.params;

    const Invoice = require('../models/Invoice');
    const invoice = await Invoice.findById(invoiceId).populate('payment');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hóa đơn.',
      });
    }

    // Check permission - user can only view their own invoices
    if (invoice.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem hóa đơn này.',
      });
    }

    if (!invoice.payment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thanh toán cho hóa đơn này.',
      });
    }

    res.status(200).json({
      success: true,
      data: invoice.payment,
    });
  } catch (error) {
    next(error);
  }
};
