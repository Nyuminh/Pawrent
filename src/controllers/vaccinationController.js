const Vaccination = require('../models/Vaccination');
const Pet = require('../models/Pet');

// @desc Get all vaccinations for current user (all pets)
// @route GET /api/v1/vaccinations
// @access Private
exports.getAllVaccinations = async (req, res, next) => {
  try {
    // Find pets belonging to user
    const pets = await Pet.find({ owner: req.user.id, isActive: true }).select('_id');
    const petIds = pets.map(p => p._id);

    const vaccinations = await Vaccination.find({ pet: { $in: petIds }, isActive: true })
      .sort('-dateAdministered')
      .populate('pet', 'name species')
      .populate('appointment');

    res.status(200).json({ success: true, count: vaccinations.length, data: vaccinations });
  } catch (error) {
    next(error);
  }
};

// @desc Get vaccinations by pet id
// @route GET /api/v1/vaccinations/pet/:petId
// @access Private
exports.getVaccinationsByPet = async (req, res, next) => {
  try {
    const { petId } = req.params;
    const pet = await Pet.findOne({ _id: petId, owner: req.user.id, isActive: true });
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng.' });
    }

    const vaccinations = await Vaccination.find({ pet: petId, isActive: true })
      .sort('-dateAdministered')
      .populate('appointment');

    res.status(200).json({ success: true, count: vaccinations.length, data: vaccinations });
  } catch (error) {
    next(error);
  }
};

// @desc Get single vaccination
// @route GET /api/v1/vaccinations/:id
// @access Private
exports.getVaccination = async (req, res, next) => {
  try {
    const vac = await Vaccination.findById(req.params.id).populate('pet', 'name species').populate('appointment');
    if (!vac) return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi tiêm.' });

    // verify ownership
    if (vac.pet && vac.pet._id) {
      const ownerPet = await Pet.findOne({ _id: vac.pet._id, owner: req.user.id });
      if (!ownerPet) return res.status(403).json({ success: false, message: 'Không có quyền truy cập.' });
    }

    res.status(200).json({ success: true, data: vac });
  } catch (error) {
    next(error);
  }
};

// @desc Create vaccination record
// @route POST /api/v1/vaccinations
// @access Private
exports.createVaccination = async (req, res, next) => {
  try {
    const { pet, appointment, vaccineName, dateAdministered } = req.body;

    if (!pet || !vaccineName || !dateAdministered) {
      return res.status(400).json({ success: false, message: 'Thiếu pet, vaccineName hoặc dateAdministered.' });
    }

    // Verify pet ownership
    const petDoc = await Pet.findOne({ _id: pet, owner: req.user.id, isActive: true });
    if (!petDoc) return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng.' });

    const data = { pet, vaccineName, dateAdministered, createdBy: req.user.id };
    if (appointment) data.appointment = appointment;

    const vac = await Vaccination.create(data);

    res.status(201).json({ success: true, message: 'Tạo bản ghi tiêm thành công.', data: vac });
  } catch (error) {
    next(error);
  }
};

// @desc Update vaccination
// @route PUT /api/v1/vaccinations/:id
// @access Private
exports.updateVaccination = async (req, res, next) => {
  try {
    let vac = await Vaccination.findById(req.params.id);
    if (!vac) return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi tiêm.' });

    // verify ownership
    const petOwner = await Pet.findOne({ _id: vac.pet, owner: req.user.id });
    if (!petOwner) return res.status(403).json({ success: false, message: 'Không có quyền truy cập.' });

    const { vaccineName, dateAdministered, appointment } = req.body;
    if (vaccineName) vac.vaccineName = vaccineName;
    if (dateAdministered) vac.dateAdministered = dateAdministered;
    if (appointment) vac.appointment = appointment;

    vac = await vac.save();
    res.status(200).json({ success: true, message: 'Cập nhật thành công.', data: vac });
  } catch (error) {
    next(error);
  }
};

// @desc Delete vaccination
// @route DELETE /api/v1/vaccinations/:id
// @access Private
exports.deleteVaccination = async (req, res, next) => {
  try {
    const vac = await Vaccination.findById(req.params.id);
    if (!vac) return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi tiêm.' });

    const petOwner = await Pet.findOne({ _id: vac.pet, owner: req.user.id });
    if (!petOwner) return res.status(403).json({ success: false, message: 'Không có quyền truy cập.' });

    await Vaccination.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: 'Xóa bản ghi tiêm thành công.' });
  } catch (error) {
    next(error);
  }
};
