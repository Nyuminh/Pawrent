const User = require('../models/User');
const Pet = require('../models/Pet');
const Vet = require('../models/Vet');
const PetHotel = require('../models/PetHotel');
const Appointment = require('../models/Appointment');
const HotelBooking = require('../models/HotelBooking');

// @desc    Get dashboard statistics
// @route   GET /api/v1/admin/dashboard
// @access  Private (admin)
exports.getDashboard = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalPets,
      totalVets,
      totalHotels,
      totalAppointments,
      totalBookings,
      premiumUsers,
      recentUsers,
    ] = await Promise.all([
      User.countDocuments(),
      Pet.countDocuments({ isActive: true }),
      Vet.countDocuments({ isActive: true }),
      PetHotel.countDocuments({ isActive: true }),
      Appointment.countDocuments(),
      HotelBooking.countDocuments(),
      User.countDocuments({ 'subscription.plan': 'premium', 'subscription.isActive': true }),
      User.find().sort('-createdAt').limit(10).select('fullName email role createdAt'),
    ]);

    // Revenue from appointments
    const appointmentRevenue = await Appointment.aggregate([
      { $match: { 'fee.isPaid': true } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$fee.amount' },
          totalCommission: { $sum: '$commission.amount' },
        },
      },
    ]);

    // Revenue from hotel bookings
    const hotelRevenue = await HotelBooking.aggregate([
      { $match: { 'payment.status': 'paid' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$pricing.total' },
          totalCommission: { $sum: '$pricing.commission.amount' },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: { total: totalUsers, premium: premiumUsers },
        pets: totalPets,
        vets: totalVets,
        hotels: totalHotels,
        appointments: totalAppointments,
        bookings: totalBookings,
        revenue: {
          appointments: appointmentRevenue[0] || { totalRevenue: 0, totalCommission: 0 },
          hotels: hotelRevenue[0] || { totalRevenue: 0, totalCommission: 0 },
        },
        recentUsers,
      },
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
