const mongoose = require('mongoose');

const InvoiceItemSchema = new mongoose.Schema({
  type: { type: String },
  refId: { type: mongoose.Schema.Types.ObjectId },
  name: { type: String },
  price: { type: Number, required: true },
  quantity: { type: Number, default: 1 },
  color: { type: String },
  size: { type: String },
});

const InvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    items: [InvoiceItemSchema],
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, default: 'VND' },
    status: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
    cart: { type: mongoose.Schema.Types.ObjectId },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'HotelBooking' },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    subscriptionPlan: { type: String },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    address: { type: String, trim: true },
    dueDate: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invoice', InvoiceSchema);
