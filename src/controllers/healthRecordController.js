const HealthRecord = require('../models/HealthRecord');
const Pet = require('../models/Pet');
const Appointment = require('../models/Appointment');

// @desc    Get all health records (for current user's pets)
// @route   GET /api/v1/health-records
// @access  Private
exports.getAllHealthRecords = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, sortBy = '-createdAt' } = req.query;

    // Get all pets of current user
    const userPets = await Pet.find({ owner: req.user.id, isActive: true });
    const petIds = userPets.map(pet => pet._id);

    // Find health records for these pets
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const startIndex = (pageNum - 1) * limitNum;

    let query = HealthRecord.find({ pet: { $in: petIds }, isActive: true });
    
    const total = await HealthRecord.countDocuments(query);
    const healthRecords = await query
      .sort(sortBy)
      .skip(startIndex)
      .limit(limitNum)
      .populate('pet', 'name species')
      .populate('vet', 'name specialization email')
      .populate('service', 'name price');

    res.status(200).json({
      success: true,
      count: healthRecords.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      data: healthRecords,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get health records by pet ID
// @route   GET /api/v1/health-records/pet/:petId
// @access  Private
exports.getHealthRecordsByPetId = async (req, res, next) => {
  try {
    const { petId } = req.params;
    const { page = 1, limit = 20, sortBy = '-createdAt' } = req.query;

    // Check if pet belongs to current user
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

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const startIndex = (pageNum - 1) * limitNum;

    let query = HealthRecord.find({ pet: petId, isActive: true });

    const total = await HealthRecord.countDocuments(query);
    const healthRecords = await query
      .sort(sortBy)
      .skip(startIndex)
      .limit(limitNum)
      .populate('vet', 'name specialization email')
      .populate('service', 'name price');

    res.status(200).json({
      success: true,
      count: healthRecords.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      data: healthRecords,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single health record
// @route   GET /api/v1/health-records/:id
// @access  Private
exports.getHealthRecordById = async (req, res, next) => {
  try {
    const healthRecord = await HealthRecord.findById(req.params.id)
      .populate('pet', 'name species owner')
      .populate('vet', 'name specialization email')
      .populate('service', 'name price')
      .populate('appointment');

    if (!healthRecord) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy kết quả khám.',
      });
    }

    // Check if user is pet owner
    if (healthRecord.pet.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập kết quả khám này.',
      });
    }

    res.status(200).json({
      success: true,
      data: healthRecord,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create health record
// @route   POST /api/v1/health-records
// @access  Private
exports.createHealthRecord = async (req, res, next) => {
  try {
    let {
      pet,
      appointment,
      service,
      examinationDate,
      weight,
      temperature,
      generalAssessment,
      consultation,
    } = req.body;
    let vet = req.body.vet;

    // Handle multiple image uploads
    const images = [];
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((file) => {
        images.push(file.path);
      });
    }

    // Determine pet existence/ownership based on role
    let petData;
    if (req.user.role === 'admin') {
      // admin can create for any pet
      petData = await Pet.findOne({ _id: pet, isActive: true });
    } else if (req.user.role === 'vet') {
      // vet may create for any pet but must be the acting vet
      const vetIdStr = String(vet || req.user.id);
      if (String(req.user.id) !== vetIdStr) {
        return res.status(403).json({
          success: false,
          message: 'Vet phải là người thực hiện thao tác.',
        });
      }
      vet = vetIdStr;
      petData = await Pet.findOne({ _id: pet, isActive: true });
    } else {
      // regular owner: pet must belong to current user
      petData = await Pet.findOne({ _id: pet, owner: req.user.id, isActive: true });
    }

    if (!petData) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng.',
      });
    }

    const healthRecordData = {
      pet,
      vet,
      appointment,
      service,
      examinationDate,
      weight,
      temperature,
      generalAssessment,
      consultation,
      images,
      isActive: true,
    };

    const healthRecord = await HealthRecord.create(healthRecordData);

    // If appointment exists, link it
    if (appointment) {
      await Appointment.findByIdAndUpdate(appointment, {
        healthRecord: healthRecord._id,
        status: 'hoàn_thành',
      });
    }

    // Populate the created record
    const result = await HealthRecord.findById(healthRecord._id)
      .populate('pet', 'name species')
      .populate('vet', 'name specialization email')
      .populate('service', 'name price');

    res.status(201).json({
      success: true,
      message: 'Tạo kết quả khám thành công!',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update health record
// @route   PUT /api/v1/health-records/:id
// @access  Private
exports.updateHealthRecord = async (req, res, next) => {
  try {
    let healthRecord = await HealthRecord.findById(req.params.id);

    if (!healthRecord) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy kết quả khám.',
      });
    }

    // Permission check:
    // - admin: allowed
    // - vet: allowed if they are the vet on the record
    // - owner: allowed if they own the pet
    if (req.user.role === 'admin') {
      // allowed
    } else if (req.user.role === 'vet') {
      if (!healthRecord.vet || String(healthRecord.vet) !== String(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền cập nhật kết quả khám này.',
        });
      }
    } else {
      // regular owner
      const pet = await Pet.findOne({ _id: healthRecord.pet, owner: req.user.id });
      if (!pet) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền cập nhật kết quả khám này.',
        });
      }
    }

    const {
      examinationDate,
      weight,
      temperature,
      generalAssessment,
      consultation,
    } = req.body;

    // Update basic fields
    if (examinationDate) healthRecord.examinationDate = examinationDate;
    if (weight !== undefined) healthRecord.weight = weight;
    if (temperature !== undefined) healthRecord.temperature = temperature;
    if (generalAssessment) healthRecord.generalAssessment = generalAssessment;
    if (consultation) healthRecord.consultation = consultation;

    // Handle image updates
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const newImages = [];
      req.files.forEach((file) => {
        newImages.push(file.path);
      });
      healthRecord.images = newImages;
    }

    healthRecord = await healthRecord.save();

    // Populate after update
    const result = await HealthRecord.findById(healthRecord._id)
      .populate('pet', 'name species')
      .populate('vet', 'name specialization email')
      .populate('service', 'name price');

    res.status(200).json({
      success: true,
      message: 'Cập nhật kết quả khám thành công!',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete health record (soft delete)
// @route   DELETE /api/v1/health-records/:id
// @access  Private
exports.deleteHealthRecord = async (req, res, next) => {
  try {
    const healthRecord = await HealthRecord.findById(req.params.id);

    if (!healthRecord) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy kết quả khám.',
      });
    }

    // Permission check for delete (mirror update rules)
    if (req.user.role === 'admin') {
      // allowed
    } else if (req.user.role === 'vet') {
      if (!healthRecord.vet || String(healthRecord.vet) !== String(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền xóa kết quả khám này.',
        });
      }
    } else {
      const pet = await Pet.findOne({ _id: healthRecord.pet, owner: req.user.id });
      if (!pet) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền xóa kết quả khám này.',
        });
      }
    }

    healthRecord.isActive = false;
    await healthRecord.save();

    res.status(200).json({
      success: true,
      message: 'Xóa kết quả khám thành công!',
    });
  } catch (error) {
    next(error);
  }
};
