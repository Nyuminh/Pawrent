const User = require('../models/User');
const Pet = require('../models/Pet');
const Vet = require('../models/Vet');
const PetHotel = require('../models/PetHotel');
const Appointment = require('../models/Appointment');
const HotelBooking = require('../models/HotelBooking');
//commit
// @desc    Get dashboard statistics
// @route   GET /api/v1/admin/dashboard
// @access  Private (admin)
exports.getDashboard = async (req, res, next) => {
  try {
    const Invoice = require('../models/Invoice');

    // 1. User stats: total, breakdown by role
    const [totalUsers, usersByRole] = await Promise.all([
      User.countDocuments({ role: { $nin: ['vet', 'admin'] } }),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ])
    ]);

    const userBreakdown = {
      user: 0,
      vet: 0,
      hotel_owner: 0,
      admin: 0
    };
    usersByRole.forEach(r => {
      if (r._id) {
        userBreakdown[r._id] = r.count;
      }
    });

    // Monthly user trends (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const userMonthlyTrendsRaw = await User.aggregate([
      { $match: { role: { $nin: ['vet', 'admin'] }, createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Other simple counts
    const [totalPets, totalVets, totalHotels, totalAppointments, totalBookings] = await Promise.all([
      Pet.countDocuments({ isActive: true }),
      Vet.countDocuments({ isActive: true }),
      PetHotel.countDocuments({ isActive: true }),
      Appointment.countDocuments(),
      HotelBooking.countDocuments()
    ]);

    // 2. Revenue stats (Invoices & Hotel Bookings)
    // Paid invoices by type
    const invoiceRevenueAllTime = await Invoice.aggregate([
      { $match: { status: 'paid' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.type',
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          quantity: { $sum: '$items.quantity' }
        }
      }
    ]);

    // Paid Hotel Bookings all time
    const hotelRevenueAllTime = await HotelBooking.aggregate([
      { $match: { 'payment.status': 'paid' } },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$pricing.total' },
          count: { $sum: 1 }
        }
      }
    ]);

    let productRevenue = 0;
    let serviceRevenue = 0;

    invoiceRevenueAllTime.forEach(item => {
      const rev = item.revenue || 0;
      if (item._id === 'product') {
        productRevenue += rev;
      } else {
        serviceRevenue += rev;
      }
    });

    if (hotelRevenueAllTime.length > 0) {
      serviceRevenue += hotelRevenueAllTime[0].revenue || 0;
    }

    const totalRevenue = productRevenue + serviceRevenue;

    // Monthly breakdown (last 12 months)
    const invoiceRevenueMonthly = await Invoice.aggregate([
      { $match: { status: 'paid', createdAt: { $gte: twelveMonthsAgo } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            type: '$items.type'
          },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          quantity: { $sum: '$items.quantity' }
        }
      }
    ]);

    const hotelRevenueMonthly = await HotelBooking.aggregate([
      { $match: { 'payment.status': 'paid', createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$pricing.total' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Merge monthly statistics
    const monthlyStats = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyStats[key] = {
        month: key,
        totalRevenue: 0,
        productRevenue: 0,
        serviceRevenue: 0,
        productQuantity: 0,
        serviceQuantity: 0
      };
    }

    // Populate user registration trends into the monthlyStats
    const userMonthlyTrends = [];
    const userMonthlyMap = {};
    userMonthlyTrendsRaw.forEach(item => {
      const year = item._id.year;
      const month = String(item._id.month).padStart(2, '0');
      const key = `${year}-${month}`;
      userMonthlyMap[key] = item.count;
    });

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      userMonthlyTrends.push({
        month: key,
        count: userMonthlyMap[key] || 0
      });
    }

    invoiceRevenueMonthly.forEach(item => {
      const year = item._id.year;
      const month = String(item._id.month).padStart(2, '0');
      const key = `${year}-${month}`;

      if (monthlyStats[key]) {
        const rev = item.revenue || 0;
        const qty = item.quantity || 0;

        if (item._id === 'product') {
          monthlyStats[key].productRevenue += rev;
          monthlyStats[key].productQuantity += qty;
        } else {
          monthlyStats[key].serviceRevenue += rev;
          monthlyStats[key].serviceQuantity += qty;
        }
        monthlyStats[key].totalRevenue += rev;
      }
    });

    hotelRevenueMonthly.forEach(item => {
      const year = item._id.year;
      const month = String(item._id.month).padStart(2, '0');
      const key = `${year}-${month}`;

      if (monthlyStats[key]) {
        const rev = item.revenue || 0;
        const count = item.count || 0;

        monthlyStats[key].serviceRevenue += rev;
        monthlyStats[key].serviceQuantity += count;
        monthlyStats[key].totalRevenue += rev;
      }
    });

    const monthlyRevenueData = Object.values(monthlyStats).sort((a, b) => a.month.localeCompare(b.month));

    // 3. Featured Products, Services & Hotels (Top 5)
    // Products
    const topProducts = await Invoice.aggregate([
      { $match: { status: 'paid' } },
      { $unwind: '$items' },
      { $match: { 'items.type': 'product' } },
      {
        $group: {
          _id: '$items.refId',
          name: { $first: '$items.name' },
          quantitySold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      { $sort: { quantitySold: -1 } },
      { $limit: 5 }
    ]);

    // Services (appointment, service)
    const paidServiceInvoices = await Invoice.find({
      status: 'paid',
      'items.type': { $in: ['service', 'appointment'] }
    });

    const appointmentIds = [];
    paidServiceInvoices.forEach(inv => {
      inv.items.forEach(item => {
        if (item.type === 'appointment' && item.refId) {
          appointmentIds.push(item.refId);
        }
      });
    });

    const appointments = await Appointment.find({ _id: { $in: appointmentIds } })
      .populate('service', 'name');

    const appointmentToServiceMap = {};
    appointments.forEach(app => {
      if (app.service) {
        appointmentToServiceMap[app._id.toString()] = {
          serviceId: app.service._id.toString(),
          name: app.service.name
        };
      }
    });

    const serviceStats = {};
    paidServiceInvoices.forEach(inv => {
      inv.items.forEach(item => {
        if (item.type === 'service' || item.type === 'appointment') {
          let serviceId = null;
          let serviceName = item.name;

          if (item.type === 'appointment' && item.refId) {
            const mapped = appointmentToServiceMap[item.refId.toString()];
            if (mapped) {
              serviceId = mapped.serviceId;
              serviceName = mapped.name;
            } else {
              serviceId = item.refId.toString();
            }
          } else if (item.refId) {
            serviceId = item.refId.toString();
          }

          if (serviceId) {
            if (!serviceStats[serviceId]) {
              serviceStats[serviceId] = {
                _id: serviceId,
                name: serviceName || 'Dịch vụ không tên',
                quantitySold: 0,
                revenue: 0
              };
            }
            serviceStats[serviceId].quantitySold += item.quantity || 1;
            serviceStats[serviceId].revenue += (item.price || 0) * (item.quantity || 1);
          }
        }
      });
    });

    const topServices = Object.values(serviceStats)
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 5);

    // Hotels (bookings)
    const topHotelsRaw = await HotelBooking.aggregate([
      { $match: { 'payment.status': 'paid' } },
      {
        $group: {
          _id: '$hotel',
          quantitySold: { $sum: 1 },
          revenue: { $sum: '$pricing.total' }
        }
      },
      { $sort: { quantitySold: -1 } },
      { $limit: 5 }
    ]);

    // Populate hotel names
    let topHotels = [];
    if (topHotelsRaw.length > 0) {
      topHotels = await PetHotel.populate(topHotelsRaw, { path: '_id', select: 'name' });
      topHotels = topHotels.map(h => ({
        id: h._id?._id || h._id,
        name: h._id?.name || `Khách sạn ${h._id}`,
        quantitySold: h.quantitySold,
        revenue: h.revenue
      }));
    }

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          breakdown: userBreakdown,
          monthlyTrends: userMonthlyTrends
        },
        pets: totalPets,
        vets: totalVets,
        hotels: totalHotels,
        appointments: totalAppointments,
        bookings: totalBookings,
        revenue: {
          totalRevenue,
          productRevenue,
          serviceRevenue,
          monthlyBreakdown: monthlyRevenueData
        },
        featured: {
          products: topProducts.map(p => ({
            id: p._id,
            name: p.name || 'Sản phẩm không tên',
            quantitySold: p.quantitySold,
            revenue: p.revenue
          })),
          services: topServices.map(s => ({
            id: s._id,
            name: s.name || 'Dịch vụ không tên',
            quantitySold: s.quantitySold,
            revenue: s.revenue
          })),
          hotels: topHotels
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users
// @route   GET /api/v1/admin/users
// @access  Private (admin)
exports.getUsers = async (req, res, next) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (role) query.role = role;
    if (search) {
      query.$or = [
        { fullName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user (by admin)
// @route   PUT /api/v1/admin/users/:id
// @access  Private (admin)
exports.updateUser = async (req, res, next) => {
  try {
    const { role, isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role, isActive },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật người dùng thành công.',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user (by admin)
// @route   DELETE /api/v1/admin/users/:id
// @access  Private (admin)
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Xóa người dùng thành công.',
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user subscription
// @route   PUT /api/v1/admin/users/:id/subscription
// @access  Private (admin)
exports.updateUserSubscription = async (req, res, next) => {
  try {
    const { plan, isActive, maxPets, startDate, endDate } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng.',
      });
    }

    // Update subscription fields
    if (plan !== undefined) {
      if (!['free', 'plus', 'vip'].includes(plan)) {
        return res.status(400).json({
          success: false,
          message: 'Gói phải là "free", "plus" hoặc "vip".',
        });
      }
      user.subscription.plan = plan;
    }

    if (isActive !== undefined) {
      user.subscription.isActive = isActive;
    }

    if (maxPets !== undefined) {
      if (typeof maxPets !== 'number' || maxPets < 0) {
        return res.status(400).json({
          success: false,
          message: 'maxPets phải là số >= 0.',
        });
      }
      user.subscription.maxPets = maxPets;
    }

    if (startDate !== undefined) {
      user.subscription.startDate = new Date(startDate);
    }

    if (endDate !== undefined) {
      user.subscription.endDate = new Date(endDate);
    }

    await user.save({ validateBeforeSave: true });

    res.status(200).json({
      success: true,
      message: 'Cập nhật gói subscription thành công.',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify vet
// @route   PUT /api/v1/admin/vets/:id/verify
// @access  Private (admin)
exports.verifyVet = async (req, res, next) => {
  try {
    const vet = await Vet.findByIdAndUpdate(
      req.params.id,
      { isVerified: req.body.isVerified },
      { new: true }
    );

    if (!vet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bác sĩ thú y.',
      });
    }

    res.status(200).json({
      success: true,
      message: `Bác sĩ đã được ${req.body.isVerified ? 'xác minh' : 'hủy xác minh'}.`,
      data: vet,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify hotel
// @route   PUT /api/v1/admin/hotels/:id/verify
// @access  Private (admin)
exports.verifyHotel = async (req, res, next) => {
  try {
    const hotel = await PetHotel.findByIdAndUpdate(
      req.params.id,
      { isVerified: req.body.isVerified },
      { new: true }
    );

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách sạn.',
      });
    }

    res.status(200).json({
      success: true,
      message: `Khách sạn đã được ${req.body.isVerified ? 'xác minh' : 'hủy xác minh'}.`,
      data: hotel,
    });
  } catch (error) {
    next(error);
  }
};
