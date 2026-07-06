const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'VND' },
  provider: { type: String, required: true },
  providerPaymentId: { type: String },
  checkoutUrl: { type: String },
  qrUrl: { type: String },
  status: { type: String, enum: ['pending', 'paid', 'failed', 'cod'], default: 'pending' },
  metadata: { type: mongoose.Schema.Types.Mixed },
  expiresAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);
