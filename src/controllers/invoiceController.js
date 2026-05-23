const Invoice = require('../models/Invoice');
const HotelBooking = require('../models/HotelBooking');
const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const plans = require('../config/plans');

function makeInvoiceNumber() {
  return `INV-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
}

// POST /api/v1/invoices
exports.createInvoice = async (req, res, next) => {
  try {
    const { items, bookingId, appointmentId, subscriptionPlan, currency = 'VND', dueDate } = req.body;

    const invoiceItems = [];
    let subtotal = 0;

    if (bookingId) {
      const booking = await HotelBooking.findById(bookingId);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
      const price = (booking.pricing && booking.pricing.total) || 0;
      invoiceItems.push({ type: 'booking', refId: booking._id, name: `Hotel booking ${booking._id}`, price, quantity: 1 });
      subtotal += price;
    }

    if (appointmentId) {
      const appointment = await Appointment.findById(appointmentId).populate('service');
      if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
      const price = (appointment.service && appointment.service.price) || 0;
      invoiceItems.push({ type: 'appointment', refId: appointment._id, name: `Appointment ${appointment._id}`, price, quantity: 1 });
      subtotal += price;
    }

    if (subscriptionPlan) {
      const planKey = String(subscriptionPlan).toUpperCase();
      const plan = plans[planKey];
      if (!plan) return res.status(400).json({ success: false, message: 'Unknown subscription plan' });
      // choose price field available
      const price = plan.pricePerMonth || plan.pricePerYear || plan.price || 0;
      invoiceItems.push({ type: 'subscription', name: `${plan.name} plan`, price, quantity: 1 });
      subtotal += price;
    }

    if (items && Array.isArray(items)) {
      items.forEach((it) => {
        const price = Number(it.price || 0);
        const qty = Number(it.quantity || 1);
        invoiceItems.push({ type: it.type || 'item', refId: it.refId, name: it.name || 'Item', price, quantity: qty });
        subtotal += price * qty;
      });
    }

    const tax = 0;
    const discount = 0;
    const total = subtotal - discount + tax;

    const invoice = await Invoice.create({
      invoiceNumber: makeInvoiceNumber(),
      user: req.user ? req.user.id : undefined,
      items: invoiceItems,
      subtotal,
      tax,
      discount,
      total,
      currency,
      booking: bookingId || undefined,
      appointment: appointmentId || undefined,
      subscriptionPlan: subscriptionPlan || undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });

    res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/invoices
exports.getInvoices = async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role === 'admin') {
      query = {};
    } else {
      query = { user: req.user.id };
    }
    const invoices = await Invoice.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: invoices.length, data: invoices });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/invoices/:id
exports.getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('booking').populate('appointment').populate('payment');
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    if (req.user.role !== 'admin' && String(invoice.user) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    res.status(200).json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
};
