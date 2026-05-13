const Pet = require('../models/Pet');
const User = require('../models/User');

// @desc    Create a pet
// @route   POST /api/v1/pets
// @access  Private
exports.createPet = async (req, res, next) => {
  try {
    // Check pet limit based on subscription
    const petCount = await Pet.countDocuments({
      owner: req.user.id,
      isActive: true,
    });

    const maxPets = req.user.subscription.maxPets || 1;
    if (petCount >= maxPets) {
      return res.status(403).json({
        success: false,
        message: `Bạn đã đạt giới hạn ${maxPets} thú cưng. Nâng cấp gói Premium để thêm thú cưng.`,
        code: 'PET_LIMIT_REACHED',
      });
    }

    req.body.owner = req.user.id;
    const pet = await Pet.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Thêm thú cưng thành công!',
      data: pet,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all pets of current user
// @route   GET /api/v1/pets
// @access  Private
exports.getMyPets = async (req, res, next) => {
  try {
    const pets = await Pet.find({
      owner: req.user.id,
      isActive: true,
    }).sort('-createdAt');

    res.status(200).json({
      success: true,
      count: pets.length,
      data: pets,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single pet
// @route   GET /api/v1/pets/:id
// @access  Private
exports.getPet = async (req, res, next) => {
  try {
    const pet = await Pet.findOne({
      _id: req.params.id,
      owner: req.user.id,
    }).populate('healthRecords reminders');

    if (!pet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng.',
      });
    }

    res.status(200).json({
      success: true,
      data: pet,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update pet
// @route   PUT /api/v1/pets/:id
// @access  Private
exports.updatePet = async (req, res, next) => {
  try {
    let pet = await Pet.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!pet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng.',
      });
    }

    // Prevent changing owner
    delete req.body.owner;

    pet = await Pet.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: 'Cập nhật thú cưng thành công.',
      data: pet,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete pet (soft delete)
// @route   DELETE /api/v1/pets/:id
// @access  Private
exports.deletePet = async (req, res, next) => {
  try {
    const pet = await Pet.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!pet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng.',
      });
    }

    pet.isActive = false;
    await pet.save();

    res.status(200).json({
      success: true,
      message: 'Xóa thú cưng thành công.',
    });
  } catch (error) {
    next(error);
  }
};
