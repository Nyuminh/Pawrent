const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Pet = require('../models/Pet');
const User = require('../models/User');
const appointmentSlots = require('../utils/appointmentSlots');

// ==================== APPOINTMENTS ====================

// @desc    Book appointment
// @route   POST /api/v1/appointments
// @access  Private
exports.createAppointment = async (req, res, next) => {
  try {
    const { pet: petId, vet: vetId, service, date, timeSlot, appointmentType, symptoms, notes } = req.body;

    // Validate required fields
    if (!vetId || !petId) {
      return res.status(400).json({
        success: false,
        message: vetId ? 'ID thú cưng không được để trống' : 'ID bác sĩ không được để trống',
      });
    }

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

    // Validate appointment date
    const appointmentDate = new Date(date);
    if (appointmentSlots.isPastDate(appointmentDate)) {
      return res.status(400).json({
        success: false,
        message: 'Không thể đặt lịch cho ngày trong quá khứ.',
      });
    }

    // Check for available slots (max 3 slots per time)
    const bookedAppointments = await Appointment.find({
      vet: vetId,
      date: {
        $gte: new Date(appointmentDate.toDateString()),
        $lt: new Date(new Date(appointmentDate.toDateString()).getTime() + 86400000),
      },
      'timeSlot.startTime': timeSlot.startTime,
      status: { $in: ['chờ_xác_nhận', 'đã_xác_nhận'] },
    });

    if (
      bookedAppointments.length >= appointmentSlots.MAX_SLOTS_PER_TIME
    ) {
      return res.status(400).json({
        success: false,
        message: `Khung giờ ${timeSlot.startTime} - ${timeSlot.endTime} đã đầy (${appointmentSlots.MAX_SLOTS_PER_TIME}/${appointmentSlots.MAX_SLOTS_PER_TIME}). Vui lòng chọn khung giờ khác.`,
        bookedSlots: bookedAppointments.length,
        maxSlots: appointmentSlots.MAX_SLOTS_PER_TIME,
      });
    }

    // Use default consultation fee (no longer using Vet model)
    const defaultFee = 300000; // 300k VND default

    const appointment = await Appointment.create({
      user: req.user.id,
      pet: petId,
      vet: vetId,
      service,
      appointmentType,
      date: new Date(date),
      timeSlot,
      symptoms,
      notes,
      fee: {
        amount: defaultFee,
        currency: 'VND',
      },
      commission: {
        rate: Number(process.env.VET_BOOKING_COMMISSION_RATE) || 0.10,
      },
    });

    // Populate and return the complete appointment data
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('pet', 'name species breed avatar')
      .populate('service', 'name price')
      .populate('vet', '_id fullName avatar email phone');

    res.status(201).json({
      success: true,
      message: 'Đặt lịch khám thành công!',
      data: populatedAppointment,
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
      .populate('service', 'name price')
      .populate('vet', '_id fullName avatar email phone')
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
      .populate('service', 'name price')
      .populate('vet', '_id fullName avatar email phone')
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
      .populate('service', 'name price')
      .populate('service', 'name price')
      .populate('vet', '_id fullName avatar email phone')
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
      'chờ_xác_nhận': ['đã_xác_nhận', 'đã_hủy'],
      'đã_xác_nhận': ['đang_khám', 'đã_hủy', 'không_đến'],
      'đang_khám': ['hoàn_thành'],
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

    if (status === 'đã_hủy') {
      appointment.cancellation = {
        cancelledBy: isVet ? 'bác_sĩ' : 'người_dùng',
        reason: cancellationReason,
        cancelledAt: new Date(),
      };
    }

    await appointment.save();

    const updatedAppointment = await Appointment.findById(appointment._id)
      .populate('pet', 'name species breed avatar')
      .populate('service', 'name price')
      .populate('vet', '_id fullName avatar email phone');

    res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái lịch hẹn thành công.',
      data: updatedAppointment,
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
      status: 'hoàn_thành',
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

    const reviewedAppointment = await Appointment.findById(appointment._id)
      .populate('pet', 'name species breed avatar')
      .populate('service', 'name price')
      .populate('vet', '_id fullName avatar email phone');

    res.status(200).json({
      success: true,
      message: 'Đánh giá thành công. Cảm ơn bạn!',
      data: reviewedAppointment,
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
    if (!['chờ_xác_nhận', 'đã_xác_nhận'].includes(appointment.status)) {
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

// @desc    Get available appointment slots for a specific date and vet
// @route   GET /api/v1/appointments/available-slots
// @access  Public
exports.getAvailableSlots = async (req, res, next) => {
  try {
    const { vetId, date, days = 7 } = req.query;

    // If specific date is provided
    if (date) {
      const appointmentDate = new Date(date);
      appointmentDate.setHours(0, 0, 0, 0);

      if (appointmentSlots.isPastDate(appointmentDate)) {
        return res.status(400).json({
          success: false,
          message: 'Không thể xem lịch cho ngày trong quá khứ.',
        });
      }

      // Verify vet exists if provided
      if (vetId) {
        const vet = await User.findById(vetId);
        if (!vet || vet.role !== 'vet') {
          return res.status(404).json({
            success: false,
            message: 'Không tìm thấy bác sĩ thú y.',
          });
        }

        // Get all booked appointments for this date and vet
        const bookedAppointments = await Appointment.find({
          vet: vetId,
          date: {
            $gte: appointmentDate,
            $lt: new Date(appointmentDate.getTime() + 86400000),
          },
          status: { $in: ['chờ_xác_nhận', 'đã_xác_nhận'] },
        });

        const availableSlots = appointmentSlots.getAvailableSlots(
          appointmentDate,
          bookedAppointments
        );

        return res.status(200).json({
          success: true,
          date: date,
          vetId: vetId,
          booked: bookedAppointments.length,
          slots: availableSlots,
        });
      }
    }

    // Get slots for multiple days (default: next 7 days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const numDays = Math.min(Number(days), 30); // Max 30 days

    const slotsMap = {};

    for (let i = 0; i < numDays; i++) {
      const currentDate = new Date(today);
      currentDate.setDate(currentDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD

      if (vetId) {
        // Get booked appointments for this date
        const bookedAppointments = await Appointment.find({
          vet: vetId,
          date: {
            $gte: currentDate,
            $lt: new Date(currentDate.getTime() + 86400000),
          },
          status: { $in: ['chờ_xác_nhận', 'đã_xác_nhận'] },
        });

        slotsMap[dateStr] = appointmentSlots.getAvailableSlots(
          currentDate,
          bookedAppointments
        );
      } else {
        slotsMap[dateStr] = appointmentSlots.generateDaySlots(currentDate);
      }
    }

    res.status(200).json({
      success: true,
      vetId: vetId || 'all',
      daysRequested: numDays,
      slots: slotsMap,
      maxSlotsPerTime: appointmentSlots.MAX_SLOTS_PER_TIME,
      slotDuration: appointmentSlots.SLOT_DURATION,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get appointment schedule calendar view
// @route   GET /api/v1/appointments/schedule/:vetId
// @access  Private
exports.getAppointmentSchedule = async (req, res, next) => {
  try {
    const { vetId } = req.params;
    const { month, year } = req.query;

    // Verify vet exists
    const vet = await User.findById(vetId);
    if (!vet || vet.role !== 'vet') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bác sĩ thú y.',
      });
    }

    const now = new Date();
    const targetMonth = Number(month) || now.getMonth() + 1;
    const targetYear = Number(year) || now.getFullYear();

    // Get all appointments for the month
    const monthStart = new Date(targetYear, targetMonth - 1, 1);
    const monthEnd = new Date(targetYear, targetMonth, 0);

    const appointments = await Appointment.find({
      vet: vetId,
      date: {
        $gte: monthStart,
        $lte: monthEnd,
      },
      status: { $in: ['chờ_xác_nhận', 'đã_xác_nhận', 'đang_khám'] },
    });

    // Group by date and time slot
    const schedule = {};
    appointments.forEach((apt) => {
      const dateStr = apt.date.toISOString().split('T')[0];
      if (!schedule[dateStr]) {
        schedule[dateStr] = {};
      }
      const timeSlot = apt.timeSlot.startTime;
      if (!schedule[dateStr][timeSlot]) {
        schedule[dateStr][timeSlot] = {
          startTime: apt.timeSlot.startTime,
          endTime: apt.timeSlot.endTime,
          booked: 0,
          appointments: [],
        };
      }
      schedule[dateStr][timeSlot].booked += 1;
      schedule[dateStr][timeSlot].appointments.push({
        id: apt._id,
        user: apt.user,
        pet: apt.pet,
        status: apt.status,
      });
    });

    // Convert to calendar format
    const calendarView = [];
    for (let day = 1; day <= monthEnd.getDate(); day++) {
      const date = new Date(targetYear, targetMonth - 1, day);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();

      calendarView.push({
        date: dateStr,
        dayOfWeek: dayOfWeek,
        dayOfWeekName: [
          'Chủ Nhật',
          'Thứ 2',
          'Thứ 3',
          'Thứ 4',
          'Thứ 5',
          'Thứ 6',
          'Thứ 7',
        ][dayOfWeek],
        slots: schedule[dateStr] || {},
      });
    }

    res.status(200).json({
      success: true,
      vet: {
        id: vet._id,
        name: vet.fullName,
        email: vet.email,
      },
      month: targetMonth,
      year: targetYear,
      calendar: calendarView,
      totalAppointments: appointments.length,
    });
  } catch (error) {
    next(error);
  }
};
