const axios = require('axios');
const crypto = require('crypto');

class SePayPgClient {
  /**
   * @param {object} opts
   * @param {'sandbox'|'production'} opts.env
   * @param {string} opts.merchant_id
   * @param {string} opts.secret_key
   */
  constructor({ env = 'sandbox', merchant_id, secret_key } = {}) {
    this.env = env === 'production' ? 'production' : 'sandbox';
    this.merchantId = merchant_id || '';
    this.secretKey = secret_key || '';

    this.apiBase = this.env === 'production' ? 'https://pgapi.sepay.vn' : 'https://pgapi-sandbox.sepay.vn';
    this.checkoutBase = this.env === 'production' ? 'https://pay.sepay.vn/v1/checkout/init' : 'https://pay-sandbox.sepay.vn/v1/checkout/init';

    this.http = axios.create({
      baseURL: this.apiBase,
      timeout: 10000,
      auth: { username: this.merchantId, password: this.secretKey },
    });
  }

  // --- Checkout helpers ---
  initCheckoutUrl() {
    return this.checkoutBase;
  }

  /**
   * Build fields for a one-time checkout form. Order of fields is important for signature.
   * @param {object} opts
   */
  initOneTimePaymentFields(opts = {}) {
    const fields = {
      merchant: this.merchantId,
      operation: opts.operation || 'PURCHASE',
      payment_method: opts.payment_method || 'BANK_TRANSFER',
      order_invoice_number: String(opts.order_invoice_number || ''),
      order_amount: String(opts.order_amount != null ? opts.order_amount : ''),
      currency: opts.currency || 'VND',
      order_description: opts.order_description || '',
      customer_id: opts.customer_id || '',
      success_url: opts.success_url || '',
      error_url: opts.error_url || '',
      cancel_url: opts.cancel_url || '',
    };

    if (opts.custom_data) fields.custom_data = String(opts.custom_data);

    fields.signature = this._buildSignature(fields);
    return fields;
  }

  _buildSignature(fields) {
    // Signing order MUST match SePay server expectations.
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
      'custom_data',
    ];

    const signedPayload = signedFieldOrder
      .filter((k) => fields[k] !== undefined && fields[k] !== null && String(fields[k]) !== '')
      .map((k) => `${k}=${fields[k]}`)
      .join(',');

    return crypto.createHmac('sha256', this.secretKey).update(signedPayload).digest('base64');
  }

  // --- Order / API helpers ---
  async orderAll(params = {}) {
    const resp = await this.http.get('/v1/orders', { params });
    return resp.data;
  }

  async orderRetrieve(orderInvoiceNumber) {
    const resp = await this.http.get(`/v1/orders/${encodeURIComponent(orderInvoiceNumber)}`);
    return resp.data;
  }

  async orderVoidTransaction(orderInvoiceNumber) {
    const resp = await this.http.post(`/v1/orders/${encodeURIComponent(orderInvoiceNumber)}/void`);
    return resp.data;
  }

  async orderCancel(orderInvoiceNumber) {
    const resp = await this.http.post(`/v1/orders/${encodeURIComponent(orderInvoiceNumber)}/cancel`);
    return resp.data;
  }
}

module.exports = { SePayPgClient };
