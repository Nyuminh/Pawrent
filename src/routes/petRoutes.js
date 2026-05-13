const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  createPet,
  getMyPets,
  getPet,
  updatePet,
  deletePet,
} = require('../controllers/petController');

const router = express.Router();

// Validation
const petValidation = [
  body('name').notEmpty().withMessage('Tên thú cưng không được để trống'),
  body('species')
    .notEmpty()
    .withMessage('Loại thú cưng không được để trống')
    .isIn(['dog', 'cat', 'bird', 'hamster', 'rabbit', 'fish', 'other'])
    .withMessage('Loại thú cưng không hợp lệ'),
];

// All routes require auth
router.use(protect);

router.route('/')
  .get(getMyPets)
  .post(petValidation, validate, createPet);

router.route('/:id')
  .get(getPet)
  .put(updatePet)
  .delete(deletePet);

module.exports = router;
