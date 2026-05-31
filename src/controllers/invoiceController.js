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

// POST /api/v1/invoices/subscription
exports.createInvoiceForSubscription = async (req, res, next) => {
  try {
    const { subscriptionPlan, currency = 'VND', dueDate } = req.body;
    if (!subscriptionPlan) return res.status(400).json({ success: false, message: 'subscriptionPlan is required' });
    const planKey = String(subscriptionPlan).toUpperCase();
    const plan = plans[planKey];
    if (!plan) return res.status(400).json({ success: false, message: 'Unknown subscription plan' });

    const price = plan.pricePerMonth || plan.pricePerYear || plan.price || 0;
    const invoiceItems = [{ type: 'subscription', name: `${plan.name} plan`, price, quantity: 1 }];
    const subtotal = price;
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
      subscriptionPlan: subscriptionPlan,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });

    return res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/invoices/booking
// NOTE: hotels do not require prepayment. This endpoint now creates an invoice for an appointment.
// It expects `appointmentId` in the body and will create an invoice linked to that appointment.
exports.createInvoiceForBooking = async (req, res, next) => {
  try {
    const { appointmentId, currency = 'VND', dueDate } = req.body;
    if (!appointmentId) return res.status(400).json({ success: false, message: 'appointmentId is required' });

    const appointmentIdTrimmed = String(appointmentId).trim();
    const appointment = await Appointment.findById(appointmentIdTrimmed).populate('service');
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
        appointmentId: appointmentIdTrimmed,
      });
    }

    const price = (appointment.service && appointment.service.price) || 0;
    const invoiceItems = [{ type: 'appointment', refId: appointment._id, name: `Appointment ${appointment._id}`, price, quantity: 1 }];
    const subtotal = price;
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
      appointment: appointment._id,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });

    return res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/invoices/service
exports.createInvoiceForService = async (req, res, next) => {
  try {
    const { serviceId, quantity = 1, currency = 'VND', dueDate } = req.body;
    if (!serviceId) return res.status(400).json({ success: false, message: 'serviceId is required' });

    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ success: false, message: 'Service not found' });

    const price = Number(service.price || 0);
    const qty = Number(quantity || 1);
    const invoiceItems = [{ type: 'service', refId: service._id, name: service.name || 'Service', price, quantity: qty }];
    const subtotal = price * qty;
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
      service: service._id,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });

    return res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/invoices/cart
exports.createInvoiceFromCart = async (req, res, next) => {
  try {
    // load user's cart
    await req.user.populate({ path: 'cart.product', select: 'name price' });
    const cart = req.user.cart || [];
    if (!cart.length) return res.status(400).json({ success: false, message: 'Cart is empty' });

    const invoiceItems = [];
    let subtotal = 0;
    cart.forEach((it) => {
      const product = it.product;
      const price = (product && product.price) ? Number(product.price) : 0;
      const qty = Number(it.quantity || 1);
      invoiceItems.push({ type: 'product', refId: product ? product._id : undefined, name: product ? product.name : 'Product', price, quantity: qty });
      subtotal += price * qty;
    });

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
      currency: req.body.currency || 'VND',
      cart: req.user._id,
    });

    return res.status(201).json({ success: true, data: invoice });
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

// GET /api/v1/invoices/:id/status
exports.getInvoiceStatus = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('payment');
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    if (req.user.role !== 'admin' && String(invoice.user) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    return res.status(200).json({ success: true, data: { status: invoice.status, payment: invoice.payment } });
  } catch (err) {
    next(err);
  }
};
