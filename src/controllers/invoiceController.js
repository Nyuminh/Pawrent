const Invoice = require('../models/Invoice');
const HotelBooking = require('../models/HotelBooking');
const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const Product = require('../models/Product');
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
      invoiceItems.push({ type: 'appointment', refId: appointment._id, name: appointment.service?.name || `Appointment ${appointment._id}`, price, quantity: 1 });
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
    const serviceName = appointment.service?.name || `Appointment ${appointment._id}`;
    const invoiceItems = [{ type: 'appointment', refId: appointment._id, name: serviceName, price, quantity: 1 }];
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

// POST /api/v1/invoices/products
exports.createInvoiceForProducts = async (req, res, next) => {
  try {
    const { products, currency = 'VND', dueDate, address } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, message: 'products is required and must be a non-empty array' });
    }

    const normalizedProducts = products.map((item) => ({
      productId: item && item.productId ? String(item.productId).trim() : '',
      quantity: Number(item && item.quantity !== undefined ? item.quantity : 1),
    }));

    if (normalizedProducts.some((item) => !item.productId)) {
      return res.status(400).json({ success: false, message: 'Each product must include a valid productId' });
    }

    const productIds = [...new Set(normalizedProducts.map((item) => item.productId))];
    const productDocs = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(productDocs.map((product) => [String(product._id), product]));

    const missingProductIds = productIds.filter((id) => !productMap.has(id));
    if (missingProductIds.length > 0) {
      return res.status(404).json({
        success: false,
        message: 'One or more products not found',
        productIds: missingProductIds,
      });
    }

    const invoiceItems = [];
    let subtotal = 0;

    normalizedProducts.forEach((item) => {
      const product = productMap.get(item.productId);
      const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
      const price = Number(product.price || 0);
      invoiceItems.push({
        type: 'product',
        refId: product._id,
        name: product.name,
        price,
        quantity,
      });
      subtotal += price * quantity;
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
      currency,
      address: address || undefined,
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
    if (req.user.role === 'admin' || req.user.role === 'vet') {
      query = {};
    } else {
      query = { user: req.user.id };
    }
    const invoices = await Invoice.find(query)
      .populate('user', 'fullName email phone address')
      .populate({
        path: 'appointment',
        populate: {
          path: 'service',
          select: 'name price'
        }
      })
      .sort({ createdAt: -1 });
    
    // Enhance invoice data with service name for appointment items
    const enhancedInvoices = invoices.map((invoice) => {
      const invoiceObj = invoice.toObject ? invoice.toObject() : invoice;
      
      if (invoiceObj.appointment && invoiceObj.appointment.service) {
        const serviceName = invoiceObj.appointment.service.name;
        // Update appointment invoice item name with service name
        invoiceObj.items = invoiceObj.items.map((item) => {
          if (item.type === 'appointment') {
            return {
              ...item,
              name: serviceName || item.name
            };
          }
          return item;
        });
      }
      
      return invoiceObj;
    });
    
    res.status(200).json({ success: true, count: enhancedInvoices.length, data: enhancedInvoices });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/invoices/:id
exports.getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('user', 'fullName email phone address')
      .populate('booking')
      .populate({
        path: 'appointment',
        populate: {
          path: 'service',
          select: 'name price'
        }
      })
      .populate('payment');
    
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    if (req.user.role !== 'admin' && req.user.role !== 'vet' && String(invoice.user) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Enhance with service name for appointment items
    let invoiceObj = invoice.toObject ? invoice.toObject() : invoice;
    if (invoiceObj.appointment && invoiceObj.appointment.service) {
      const serviceName = invoiceObj.appointment.service.name;
      invoiceObj.items = invoiceObj.items.map((item) => {
        if (item.type === 'appointment') {
          return {
            ...item,
            name: serviceName || item.name
          };
        }
        return item;
      });
    }

    res.status(200).json({ success: true, data: invoiceObj });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/invoices/:id/status
exports.getInvoiceStatus = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('payment');
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    if (req.user.role !== 'admin' && req.user.role !== 'vet' && String(invoice.user) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    return res.status(200).json({ success: true, data: { status: invoice.status, payment: invoice.payment } });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete invoice by ID
// @route   DELETE /api/v1/invoices/:id
// @access  Public
exports.deleteInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hóa đơn.',
      });
    }

    await Invoice.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Xóa hóa đơn thành công.',
    });
  } catch (error) {
    next(error);
  }
};
