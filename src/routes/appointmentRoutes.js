const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const {
  createAppointment,
  getMyAppointments,
  getAllAppointments,
  getVetAppointments,
  updateAppointmentStatus,
  reviewAppointment,
  deleteAppointment,
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
  body('reason').notEmpty().withMessage('Lý do khám không được để trống'),
];

// All routes require auth
router.use(protect);

router.get('/all', authorize('admin'), getAllAppointments);

router.route('/')
  .get(getMyAppointments)
  .post(appointmentValidation, validate, createAppointment);

router.get('/vet', authorize('vet'), getVetAppointments);

router.put('/:id/status', updateAppointmentStatus);
router.post('/:id/review', reviewAppointment);
router.delete('/:id', deleteAppointment);

module.exports = router;
