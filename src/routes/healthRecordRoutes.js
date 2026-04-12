const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, requirePremium } = require('../middleware/auth');
const {
  createRecord,
  getRecordsByPet,
  getRecord,
  updateRecord,
  deleteRecord,
  getVaccinations,
  getHealthSummary,
} = require('../controllers/healthRecordController');

const router = express.Router();

// Validation
const recordValidation = [
  body('pet').notEmpty().withMessage('ID thú cưng không được để trống'),
  body('recordType').notEmpty().withMessage('Loại hồ sơ không được để trống'),
  body('title').notEmpty().withMessage('Tiêu đề không được để trống'),
];

// All routes require auth
router.use(protect);

router.post('/', recordValidation, validate, createRecord);

router.get('/pet/:petId', getRecordsByPet);
router.get('/pet/:petId/vaccinations', getVaccinations);
router.get('/pet/:petId/summary', requirePremium('full_health_record'), getHealthSummary);

router.route('/:id')
  .get(getRecord)
  .put(updateRecord)
  .delete(deleteRecord);

module.exports = router;
