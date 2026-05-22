const HealthRecord = require('../models/HealthRecord');
const Pet = require('../models/Pet');

// @desc    Create health record
// @route   POST /api/v1/health-records
// @access  Private (user & vet)
exports.createRecord = async (req, res, next) => {
  try {
    // Verify pet ownership
    const pet = await Pet.findOne({
      _id: req.body.pet,
      owner: req.user.id,
      isActive: true,
    });

    if (!pet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng hoặc bạn không có quyền.',
      });
    }

    req.body.owner = req.user.id;
    
    // Don't allow setting recordNumber
    delete req.body.recordNumber;

    const record = await HealthRecord.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Tạo hồ sơ sức khỏe thành công.',
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get health records for a pet
// @route   GET /api/v1/health-records/pet/:petId
// @access  Private
exports.getRecordsByPet = async (req, res, next) => {
  try {
    const { petId } = req.params;
    const {
      serviceType,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    // Verify ownership
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

    const query = { pet: petId, owner: req.user.id };

    if (serviceType) query.serviceType = serviceType;
    if (startDate || endDate) {
      query.examinationDate = {};
      if (startDate) query.examinationDate.$gte = new Date(startDate);
      if (endDate) query.examinationDate.$lte = new Date(endDate);
    }

    const total = await HealthRecord.countDocuments(query);
    const records = await HealthRecord.find(query)
      .populate('vet', 'fullName email clinic')
      .sort('-examinationDate')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: records.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      data: records,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single health record
// @route   GET /api/v1/health-records/:id
// @access  Private
exports.getRecord = async (req, res, next) => {
  try {
    const record = await HealthRecord.findOne({
      _id: req.params.id,
      owner: req.user.id,
    })
      .populate('pet', 'name species breed age healthStatus')
      .populate('vet', 'fullName email clinic');

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hồ sơ sức khỏe.',
      });
    }

    res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update health record
// @route   PUT /api/v1/health-records/:id
// @access  Private
exports.updateRecord = async (req, res, next) => {
  try {
    let record = await HealthRecord.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hồ sơ sức khỏe.',
      });
    }

    // Prevent changing pet/owner/recordNumber
    delete req.body.pet;
    delete req.body.owner;
    delete req.body.recordNumber;

    record = await HealthRecord.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate('vet', 'fullName email clinic');

    res.status(200).json({
      success: true,
      message: 'Cập nhật hồ sơ thành công.',
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete health record
// @route   DELETE /api/v1/health-records/:id
// @access  Private
exports.deleteRecord = async (req, res, next) => {
  try {
    const record = await HealthRecord.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hồ sơ sức khỏe.',
      });
    }

    await HealthRecord.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Xóa hồ sơ thành công.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get health summary for a pet
// @route   GET /api/v1/health-records/pet/:petId/summary
// @access  Private
exports.getHealthSummary = async (req, res, next) => {
  try {
    const { petId } = req.params;

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

    // Aggregate health data
    const [recordCounts, recentRecords, latestCheckup] = await Promise.all([
      HealthRecord.aggregate([
        { $match: { pet: pet._id } },
        { $group: { _id: '$serviceType', count: { $sum: 1 } } },
      ]),
      HealthRecord.find({ pet: petId })
        .sort('-examinationDate')
        .limit(5)
        .select('recordNumber serviceType diagnosis examinationDate'),
      HealthRecord.findOne({ pet: petId })
        .sort('-examinationDate')
        .select(
          'recordNumber examinationDate weight temperature diagnosis vet'
        )
        .populate('vet', 'fullName email'),
    ]);

    res.status(200).json({
      success: true,
      data: {
        pet: {
          id: pet._id,
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
          age: pet.age,
          healthStatus: pet.healthStatus,
        },
        stats: {
          totalRecords: recordCounts.reduce((sum, r) => sum + r.count, 0),
          byType: recordCounts,
        },
        latestCheckup,
        recentRecords,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get health records by date range
// @route   GET /api/v1/health-records/pet/:petId/reports
// @access  Private
exports.getRecordsReport = async (req, res, next) => {
  try {
    const { petId } = req.params;
    const { startDate, endDate } = req.query;

    // Verify ownership
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

    const query = { pet: petId };
    if (startDate || endDate) {
      query.examinationDate = {};
      if (startDate) query.examinationDate.$gte = new Date(startDate);
      if (endDate) query.examinationDate.$lte = new Date(endDate);
    }

    const records = await HealthRecord.find(query)
      .populate('vet', 'fullName email clinic')
      .sort('-examinationDate');

    res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    next(error);
  }
};
