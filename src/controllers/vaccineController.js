const Vaccine = require('../models/Vaccine');
const Pet = require('../models/Pet');

// @desc    Create vaccine record(s)
// @route   POST /api/v1/vaccines
// @access  Private (user & vet)
// @param   vaccines: Array of vaccine objects
exports.createVaccines = async (req, res, next) => {
  try {
    const { vaccines } = req.body;

    if (!Array.isArray(vaccines) || vaccines.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp mảng vaccine hợp lệ.',
      });
    }

    // Verify pet ownership for each vaccine
    const vaccineRecords = [];
    for (const vaccine of vaccines) {
      // Verify pet exists and belongs to user
      const pet = await Pet.findOne({
        _id: vaccine.pet,
        owner: req.user.id,
        isActive: true,
      });

      if (!pet) {
        return res.status(404).json({
          success: false,
          message: `Thú cưng ${vaccine.pet} không tồn tại hoặc bạn không có quyền.`,
        });
      }

      // Create vaccine record
      vaccineRecords.push({
        ...vaccine,
        pet: vaccine.pet,
        owner: req.user.id,
        createdBy: req.user.role === 'vet' ? 'vet' : 'user',
      });
    }

    const createdVaccines = await Vaccine.insertMany(vaccineRecords);

    res.status(201).json({
      success: true,
      message: `Tạo ${createdVaccines.length} vaccine thành công.`,
      data: createdVaccines,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all vaccines (vet role)
// @route   GET /api/v1/vaccines/all
// @access  Private (vet only)
exports.getAllVaccines = async (req, res, next) => {
  try {
    // Check if user is vet
    if (req.user.role !== 'vet') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ bác sĩ thú y có thể xem tất cả vaccine.',
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.pet) filter.pet = req.query.pet;
    if (req.query.owner) filter.owner = req.query.owner;
    if (req.query.vaccineType) filter.vaccineType = req.query.vaccineType;

    const total = await Vaccine.countDocuments(filter);
    const vaccines = await Vaccine.find(filter)
      .populate('pet', 'name species breed avatar')
      .populate('owner', 'fullName email phone')
      .populate('vet', 'fullName email clinic')
      .sort('-vaccinationDate')
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: vaccines.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: vaccines,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get vaccines by pet
// @route   GET /api/v1/vaccines/pet/:petId
// @access  Private (owner of pet)
exports.getVaccinesByPet = async (req, res, next) => {
  try {
    const { petId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Verify pet ownership
    const pet = await Pet.findOne({
      _id: petId,
      owner: req.user.id,
      isActive: true,
    });

    if (!pet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng.',
      });
    }

    const total = await Vaccine.countDocuments({ pet: petId });
    const vaccines = await Vaccine.find({ pet: petId })
      .populate('vet', 'fullName email clinic')
      .sort('-vaccinationDate')
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: vaccines.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: vaccines,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single vaccine
// @route   GET /api/v1/vaccines/:id
// @access  Private (pet owner or vet)
exports.getVaccine = async (req, res, next) => {
  try {
    const vaccine = await Vaccine.findById(req.params.id)
      .populate('pet', 'name species breed avatar')
      .populate('owner', 'fullName email phone')
      .populate('vet', 'fullName email clinic');

    if (!vaccine) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy vaccine.',
      });
    }

    // Check authorization
    if (
      req.user.id !== vaccine.owner.toString() &&
      req.user.role !== 'vet'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem vaccine này.',
      });
    }

    res.status(200).json({
      success: true,
      data: vaccine,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update vaccine
// @route   PUT /api/v1/vaccines/:id
// @access  Private (pet owner or vet)
exports.updateVaccine = async (req, res, next) => {
  try {
    let vaccine = await Vaccine.findById(req.params.id);

    if (!vaccine) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy vaccine.',
      });
    }

    // Check authorization
    if (req.user.id !== vaccine.owner.toString() && req.user.role !== 'vet') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật vaccine này.',
      });
    }

    // Prevent changing pet and owner
    delete req.body.pet;
    delete req.body.owner;
    delete req.body.recordNumber; // Cannot update record number
    delete req.body.createdBy;

    vaccine = await Vaccine.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate('pet', 'name species breed')
      .populate('vet', 'fullName email');

    res.status(200).json({
      success: true,
      message: 'Cập nhật vaccine thành công.',
      data: vaccine,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete vaccine
// @route   DELETE /api/v1/vaccines/:id
// @access  Private (pet owner or vet)
exports.deleteVaccine = async (req, res, next) => {
  try {
    const vaccine = await Vaccine.findById(req.params.id);

    if (!vaccine) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy vaccine.',
      });
    }

    // Check authorization
    if (req.user.id !== vaccine.owner.toString() && req.user.role !== 'vet') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa vaccine này.',
      });
    }

    await Vaccine.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Xóa vaccine thành công.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get upcoming vaccines
// @route   GET /api/v1/vaccines/pet/:petId/upcoming
// @access  Private (pet owner)
exports.getUpcomingVaccines = async (req, res, next) => {
  try {
    const { petId } = req.params;

    // Verify pet ownership
    const pet = await Pet.findOne({
      _id: petId,
      owner: req.user.id,
      isActive: true,
    });

    if (!pet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng.',
      });
    }

    const now = new Date();
    const vaccines = await Vaccine.find({
      pet: petId,
      nextDueDate: { $gte: now },
    })
      .sort('nextDueDate')
      .populate('vet', 'fullName email clinic');

    res.status(200).json({
      success: true,
      count: vaccines.length,
      data: vaccines,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get overdue vaccines
// @route   GET /api/v1/vaccines/pet/:petId/overdue
// @access  Private (pet owner)
exports.getOverdueVaccines = async (req, res, next) => {
  try {
    const { petId } = req.params;

    // Verify pet ownership
    const pet = await Pet.findOne({
      _id: petId,
      owner: req.user.id,
      isActive: true,
    });

    if (!pet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng.',
      });
    }

    const now = new Date();
    const vaccines = await Vaccine.find({
      pet: petId,
      nextDueDate: { $lt: now },
      isCompleted: false,
    })
      .sort('nextDueDate')
      .populate('vet', 'fullName email clinic');

    res.status(200).json({
      success: true,
      count: vaccines.length,
      data: vaccines,
    });
  } catch (error) {
    next(error);
  }
};
