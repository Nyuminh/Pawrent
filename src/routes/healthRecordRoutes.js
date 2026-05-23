const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
  getAllHealthRecords,
  getHealthRecordsByPetId,
  getHealthRecordsByAppointmentId,
  getHealthRecordById,
  createHealthRecord,
  updateHealthRecord,
  deleteHealthRecord,
} = require('../controllers/healthRecordController');

const router = express.Router();

// Validation
const healthRecordValidation = [
  body('pet').notEmpty().withMessage('Pet ID không được để trống'),
  body('vet').notEmpty().withMessage('Vet ID không được để trống'),
  body('service').notEmpty().withMessage('Service ID không được để trống'),
  body('examinationDate')
    .notEmpty()
    .withMessage('Ngày khám không được để trống')
    .isISO8601()
    .withMessage('Ngày khám phải là định dạng ISO8601'),
  body('weight')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Cân nặng phải lớn hơn 0'),
  body('temperature')
    .optional()
    .isFloat({ min: 0, max: 50 })
    .withMessage('Nhiệt độ phải từ 0 đến 50°C'),
];

// All routes require auth
router.use(protect);

router.route('/')
  .get(getAllHealthRecords)
  .post(upload.array('images', 10), healthRecordValidation, validate, createHealthRecord);

router.route('/pet/:petId')
  .get(getHealthRecordsByPetId);

router.route('/appointment/:appointmentId')
  .get(getHealthRecordsByAppointmentId);

router.route('/:id')
  .get(getHealthRecordById)
  .put(upload.array('images', 10), updateHealthRecord)
  .delete(deleteHealthRecord);

module.exports = router;
