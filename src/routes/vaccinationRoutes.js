const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  getAllVaccinations,
  getVaccinationsByPet,
  getVaccination,
  createVaccination,
  updateVaccination,
  deleteVaccination,
} = require('../controllers/vaccinationController');

const router = express.Router();

const vacValidation = [
  body('pet').notEmpty().withMessage('Pet ID không được để trống'),
  body('vaccineName').notEmpty().withMessage('Tên vắc-xin không được để trống'),
  body('dateAdministered').notEmpty().withMessage('Ngày tiêm không được để trống').isISO8601().withMessage('Ngày tiêm phải là ISO8601'),
];

router.use(protect);

router.route('/')
  .get(getAllVaccinations)
  .post(vacValidation, validate, createVaccination);

router.route('/pet/:petId').get(getVaccinationsByPet);

router.route('/:id')
  .get(getVaccination)
  .put(updateVaccination)
  .delete(deleteVaccination);

module.exports = router;
