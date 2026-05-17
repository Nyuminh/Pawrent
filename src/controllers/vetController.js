const Vet = require('../models/Vet');
const Appointment = require('../models/Appointment');
const Pet = require('../models/Pet');

// ==================== VET PROFILE ====================

// @desc    Get all vets (public listing)
// @route   GET /api/v1/vets
// @access  Public
exports.getVets = async (req, res, next) => {
  try {
    const {
      specialization,
      species,
      city,
      isAvailableOnline,
      minRating,
      sortBy = '-rating.average',
      page = 1,
      limit = 20,
    } = req.query;

    // Only show verified vets in production, but allow all if no filter applied
    const query = { isActive: true };

    if (specialization) query.specializations = specialization;
    if (species) query.speciesExpertise = species;
    if (city) query['clinic.address.city'] = new RegExp(city, 'i');
    if (isAvailableOnline === 'true') query.isAvailableOnline = true;
    if (minRating) query['rating.average'] = { $gte: Number(minRating) };

    const total = await Vet.countDocuments(query);
    const vets = await Vet.find(query)
      .populate('user', 'fullName avatar email phone')
      .sort(sortBy)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: vets.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      data: vets,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single vet profile
// @route   GET /api/v1/vets/:id
// @access  Public
exports.getVet = async (req, res, next) => {
  try {
    const vet = await Vet.findById(req.params.id).populate(
      'user',
      'fullName avatar email phone'
    );

    if (!vet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bác sĩ thú y.',
      });
    }

    res.status(200).json({
      success: true,
      data: vet,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update vet profile
// @route   PUT /api/v1/vets/profile
// @access  Private (vet)
exports.updateVetProfile = async (req, res, next) => {
  try {
    const User = require('../models/User');
    
    let vet = await Vet.findOne({ user: req.user.id });

    if (!vet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hồ sơ bác sĩ thú y.',
      });
    }

    delete req.body.user;
    delete req.body.rating;
    delete req.body.isVerified;

    // Handle avatar upload from Cloudinary and sync with User table
    if (req.file) {
      req.body.avatar = req.file.path; // Cloudinary returns file.path as URL
      // Update avatar in User table to keep in sync
      await User.findByIdAndUpdate(req.user.id, { avatar: req.file.path }, {
        new: true,
        runValidators: true,
      });
    }

    vet = await Vet.findByIdAndUpdate(vet._id, req.body, {
      new: true,
      runValidators: true,
    });

    // Populate user info to return updated profile
    vet = await Vet.findById(vet._id).populate('user', 'fullName avatar email phone');

    res.status(200).json({
      success: true,
      message: 'Cập nhật hồ sơ thành công.',
      data: vet,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get recommended vets for a pet
// @route   GET /api/v1/vets/recommend/:petId
// @access  Private
exports.getRecommendedVets = async (req, res, next) => {
  try {
    const pet = await Pet.findOne({
      _id: req.params.petId,
      owner: req.user.id,
    });

    if (!pet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng.',
      });
    }

    // Find vets matching pet species and sort by rating
    const vets = await Vet.find({
      isActive: true,
      isVerified: true,
      speciesExpertise: pet.species,
    })
      .populate('user', 'fullName avatar')
      .sort('-rating.average -yearsOfExperience')
      .limit(10);

    res.status(200).json({
      success: true,
      count: vets.length,
      data: vets,
    });
  } catch (error) {
    next(error);
  }
};

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

    // Verify vet exists
    const vet = await Vet.findById(vetId);
    if (!vet || !vet.isActive) {
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

    // Determine fee
    const fee = appointmentType === 'online'
      ? vet.consultationFee.online
      : vet.consultationFee.inPerson;

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
        amount: fee,
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
      .populate({
        path: 'vet',
        select: 'clinic specializations consultationFee',
        populate: { path: 'user', select: 'fullName avatar' },
      })
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
    const vet = await Vet.findOne({ user: req.user.id });
    if (!vet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hồ sơ bác sĩ.',
      });
    }

    const { status, date, page = 1, limit = 20 } = req.query;
    const query = { vet: vet._id };
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
    const vet = await Vet.findOne({ user: req.user.id });
    const isOwner = appointment.user.toString() === req.user.id;
    const isVet = vet && appointment.vet.toString() === vet._id.toString();

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

    // Update vet rating
    const allReviews = await Appointment.find({
      vet: appointment.vet,
      'review.rating': { $exists: true },
    }).select('review.rating');

    const avgRating =
      allReviews.reduce((sum, a) => sum + a.review.rating, 0) / allReviews.length;

    await Vet.findByIdAndUpdate(appointment.vet, {
      'rating.average': Math.round(avgRating * 10) / 10,
      'rating.count': allReviews.length,
    });

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
