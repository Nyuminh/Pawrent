const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Pet = require('../models/Pet');
const User = require('../models/User');

// ==================== APPOINTMENTS ====================

// @desc    Book appointment
// @route   POST /api/v1/appointments
// @access  Private
exports.createAppointment = async (req, res, next) => {
  try {
    const { pet: petId, vet: vetId, date, timeSlot, appointmentType, reason, symptoms } = req.body;

    // Verify pet ownership
    const pet = await Pet.findOne({ _id: petId, owner: req.user.id, isActive: true });
    if (!pet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng.',
      });
    }

    // Verify vet exists and has vet role
    const vet = await User.findById(vetId);
    if (!vet || vet.role !== 'vet' || !vet.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bác sĩ thú y.',
      });
    }

    // Check for conflicting appointments
    const conflict = await Appointment.findOne({
      vet: vetId,
      date: new Date(date),
      'timeSlot.startTime': timeSlot.startTime,
      status: { $in: ['pending', 'confirmed'] },
    });

    if (conflict) {
      return res.status(400).json({
        success: false,
        message: 'Khung giờ này đã được đặt. Vui lòng chọn giờ khác.',
      });
    }

    // Use default consultation fee (no longer using Vet model)
    const defaultFee = 300000; // 300k VND default

    const appointment = await Appointment.create({
      user: req.user.id,
      pet: petId,
      vet: vetId,
      appointmentType,
      date: new Date(date),
      timeSlot,
      reason,
      symptoms,
      fee: {
        amount: defaultFee,
        currency: 'VND',
      },
      commission: {
        rate: Number(process.env.VET_BOOKING_COMMISSION_RATE) || 0.10,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Đặt lịch khám thành công!',
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's appointments
// @route   GET /api/v1/appointments
// @access  Private
exports.getMyAppointments = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = { user: req.user.id };
    if (status) query.status = status;

    const total = await Appointment.countDocuments(query);
    const appointments = await Appointment.find(query)
      .populate('pet', 'name species breed avatar')
      .populate('vet', 'fullName avatar email phone')
      .sort('-date')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: appointments.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all appointments (admin)
// @route   GET /api/v1/appointments/all
// @access  Private (admin)
exports.getAllAppointments = async (req, res, next) => {
  try {
    const {
      status,
      vet,
      user,
      date,
      id,
      appointmentId,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (vet) query.vet = vet;
    if (user) query.user = user;

    const appointmentFilterId = id || appointmentId;
    if (appointmentFilterId) {
      if (!mongoose.isValidObjectId(appointmentFilterId)) {
        return res.status(400).json({
          success: false,
          message: 'ID lịch hẹn không hợp lệ.',
        });
      }
      query._id = appointmentFilterId;
    }

    if (date) {
      const d = new Date(date);
      query.date = {
        $gte: d,
        $lt: new Date(d.getTime() + 86400000),
      };
    }

    const total = await Appointment.countDocuments(query);
    const appointments = await Appointment.find(query)
      .populate('user', 'fullName phone email')
      .populate('pet', 'name species breed avatar')
      .populate('vet', 'fullName avatar email phone')
      .sort('-date')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: appointments.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get vet's appointments (for vet users)
// @route   GET /api/v1/appointments/vet
// @access  Private (vet)
exports.getVetAppointments = async (req, res, next) => {
  try {
    // Check if user is a vet
    if (req.user.role !== 'vet') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ bác sĩ thú y mới có thể xem lịch hẹn của mình.',
      });
    }

    const { status, date, page = 1, limit = 20 } = req.query;
    const query = { vet: req.user.id };
    if (status) query.status = status;
    if (date) {
      const d = new Date(date);
      query.date = {
        $gte: d,
        $lt: new Date(d.getTime() + 86400000),
      };
    }

    const total = await Appointment.countDocuments(query);
    const appointments = await Appointment.find(query)
      .populate('user', 'fullName phone email')
      .populate('pet', 'name species breed gender dateOfBirth weight healthStatus allergies')
      .sort('date timeSlot.startTime')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: appointments.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get appointments for a specific vet ID
// @route   GET /api/v1/appointments/vet/:vetId
// @access  Private (admin)
exports.getVetAppointmentsById = async (req, res, next) => {
  try {
    const { status, date, page = 1, limit = 20 } = req.query;
    const { vetId } = req.params;

    if (!mongoose.isValidObjectId(vetId)) {
      return res.status(400).json({
        success: false,
        message: 'ID bác sĩ không hợp lệ.',
      });
    }

    // Verify vet exists and has vet role
    const vet = await User.findById(vetId);
    if (!vet || vet.role !== 'vet') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bác sĩ thú y.',
      });
    }

    const query = { vet: vetId };
    if (status) query.status = status;
    if (date) {
      const d = new Date(date);
      query.date = {
        $gte: d,
        $lt: new Date(d.getTime() + 86400000),
      };
    }

    const total = await Appointment.countDocuments(query);
    const appointments = await Appointment.find(query)
      .populate('user', 'fullName phone email')
      .populate('pet', 'name species breed gender dateOfBirth weight healthStatus allergies')
      .sort('date timeSlot.startTime')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: appointments.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update appointment status
// @route   PUT /api/v1/appointments/:id/status
// @access  Private
exports.updateAppointmentStatus = async (req, res, next) => {
  try {
    const { status, cancellationReason } = req.body;

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn.',
      });
    }

    // Check permission
    const isOwner = appointment.user.toString() === req.user.id;
    const isVet = req.user.role === 'vet' && appointment.vet.toString() === req.user.id;

    if (!isOwner && !isVet && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thay đổi lịch hẹn này.',
      });
    }

    // Validate status transitions
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['in_progress', 'cancelled', 'no_show'],
      in_progress: ['completed'],
    };

    if (
      validTransitions[appointment.status] &&
      !validTransitions[appointment.status].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: `Không thể chuyển trạng thái từ '${appointment.status}' sang '${status}'.`,
      });
    }

    appointment.status = status;

    if (status === 'cancelled') {
      appointment.cancellation = {
        cancelledBy: isVet ? 'vet' : 'user',
        reason: cancellationReason,
        cancelledAt: new Date(),
      };
    }

    await appointment.save();

    res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái lịch hẹn thành công.',
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Review appointment
// @route   POST /api/v1/appointments/:id/review
// @access  Private
exports.reviewAppointment = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;

    const appointment = await Appointment.findOne({
      _id: req.params.id,
      user: req.user.id,
      status: 'completed',
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn đã hoàn thành.',
      });
    }

    if (appointment.review && appointment.review.rating) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã đánh giá lịch hẹn này.',
      });
    }

    appointment.review = {
      rating,
      comment,
      createdAt: new Date(),
    };
    await appointment.save();

    res.status(200).json({
      success: true,
      message: 'Đánh giá thành công. Cảm ơn bạn!',
      data: appointment.review,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete appointment
// @route   DELETE /api/v1/appointments/:id
// @access  Private
exports.deleteAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn.',
      });
    }

    // Check permission
    const isOwner = appointment.user.toString() === req.user.id;
    
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa lịch hẹn này.',
      });
    }

    // Only allow deletion for pending or confirmed appointments
    if (!['pending', 'confirmed'].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể xóa lịch hẹn đang chờ xác nhận hoặc đã xác nhận.',
      });
    }

    await Appointment.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Xóa lịch hẹn thành công.',
    });
  } catch (error) {
    next(error);
  }
};
