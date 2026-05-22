const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  createRecord,
  getRecordsByPet,
  getRecord,
  updateRecord,
  deleteRecord,
  getHealthSummary,
  getRecordsReport,
} = require('../controllers/healthRecordController');

const router = express.Router();

// Validation
const recordValidation = [
  body('pet').notEmpty().withMessage('ID thú cưng không được để trống'),
  body('serviceType').notEmpty().withMessage('Loại dịch vụ không được để trống'),
  body('diagnosis').notEmpty().withMessage('Chẩn đoán không được để trống'),
  body('treatment').notEmpty().withMessage('Phương pháp điều trị không được để trống'),
  body('examinationDate').notEmpty().withMessage('Ngày khám không được để trống'),
  body('vet').notEmpty().withMessage('Bác sĩ điều trị không được để trống'),
];

// All routes require auth
router.use(protect);

// Create health record
router.post('/', recordValidation, validate, createRecord);

// Get health records by pet
router.get('/pet/:petId', getRecordsByPet);

// Get health summary for pet
router.get('/pet/:petId/summary', getHealthSummary);

// Get health records by date range
router.get('/pet/:petId/reports', getRecordsReport);

// Get/Update/Delete single health record
router.route('/:id')
  .get(getRecord)
  .put(updateRecord)
  .delete(deleteRecord);

module.exports = router;
