const HealthRecord = require('../models/HealthRecord');
const Pet = require('../models/Pet');

// @desc    Create health record
// @route   POST /api/v1/health-records
// @access  Private
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
    const { recordType, startDate, endDate, page = 1, limit = 20 } = req.query;

    // Verify ownership
    const pet = await Pet.findOne({ _id: petId, owner: req.user.id, isActive: true });
    if (!pet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng.',
      });
    }

    const query = { pet: petId, owner: req.user.id };

    if (recordType) query.recordType = recordType;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const total = await HealthRecord.countDocuments(query);
    const records = await HealthRecord.find(query)
      .populate('vet', 'user clinic')
      .sort('-date')
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
    }).populate('vet');

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

    // Prevent changing pet/owner
    delete req.body.pet;
    delete req.body.owner;

    record = await HealthRecord.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

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

// @desc    Get vaccination history for a pet
// @route   GET /api/v1/health-records/pet/:petId/vaccinations
// @access  Private
exports.getVaccinations = async (req, res, next) => {
  try {
    const { petId } = req.params;

    const pet = await Pet.findOne({ _id: petId, owner: req.user.id, isActive: true });
    if (!pet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng.',
      });
    }

    const records = await HealthRecord.find({
      pet: petId,
      recordType: 'vaccination',
    }).sort('-date');

    // Find upcoming vaccinations
    const upcoming = records.filter(
      (r) => r.vaccination?.nextDueDate && new Date(r.vaccination.nextDueDate) > new Date()
    );

    res.status(200).json({
      success: true,
      data: {
        history: records,
        upcomingVaccinations: upcoming.map((r) => ({
          vaccineName: r.vaccination.vaccineName,
          nextDueDate: r.vaccination.nextDueDate,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get health summary for a pet
// @route   GET /api/v1/health-records/pet/:petId/summary
// @access  Private (Premium)
exports.getHealthSummary = async (req, res, next) => {
  try {
    const { petId } = req.params;

    const pet = await Pet.findOne({ _id: petId, owner: req.user.id, isActive: true });
    if (!pet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng.',
      });
    }

    // Aggregate health data
    const [recordCounts, weightHistory, recentRecords] = await Promise.all([
      HealthRecord.aggregate([
        { $match: { pet: pet._id } },
        { $group: { _id: '$recordType', count: { $sum: 1 } } },
      ]),
      HealthRecord.find({
        pet: petId,
        recordType: 'weight_check',
      })
        .sort('date')
        .select('date weightRecord'),
      HealthRecord.find({ pet: petId })
        .sort('-date')
        .limit(5)
        .select('recordType title date'),
    ]);

    res.status(200).json({
      success: true,
      data: {
        pet: {
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
          age: pet.age,
          healthStatus: pet.healthStatus,
        },
        recordCounts,
        weightHistory,
        recentRecords,
      },
    });
  } catch (error) {
    next(error);
  }
};
