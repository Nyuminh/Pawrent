const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const {
  createAppointment,
  getMyAppointments,
  getAllAppointments,
  getVetAppointments,
  getVetAppointmentsById,
  updateAppointmentStatus,
  reviewAppointment,
  deleteAppointment,
  getAvailableSlots,
  getAppointmentSchedule,
} = require('../controllers/vetController');

const router = express.Router();

// Validation
const appointmentValidation = [
  body('pet').notEmpty().withMessage('ID thú cưng không được để trống'),
  body('vet').notEmpty().withMessage('ID bác sĩ không được để trống'),
  body('appointmentType')
    .isIn(['in_person', 'online'])
    .withMessage('Hình thức khám không hợp lệ'),
  body('date').notEmpty().withMessage('Ngày khám không được để trống'),
  body('timeSlot.startTime').notEmpty().withMessage('Giờ bắt đầu không được để trống'),
  body('timeSlot.endTime').notEmpty().withMessage('Giờ kết thúc không được để trống'),
];

// Public routes
router.get('/available-slots', getAvailableSlots);

// All routes after this require auth
router.use(protect);

router.get('/all', getAllAppointments);
router.get('/schedule/:vetId', getAppointmentSchedule);

router.route('/')
  .get(getMyAppointments)
  .post(appointmentValidation, validate, createAppointment);

router.get('/vet', authorize('vet'), getVetAppointments);
router.get('/vet/:vetId', getVetAppointmentsById);

router.put('/:id/status', updateAppointmentStatus);
router.post('/:id/review', reviewAppointment);
router.delete('/:id', deleteAppointment);

module.exports = router;
