const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
  createPet,
  getMyPets,
  getPet,
  updatePet,
  deletePet,
  getAllPetsForVet,
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

// Route for vet to get all pets
router.get('/all', authorize('vet'), getAllPetsForVet);

router.route('/')
  .get(getMyPets)
  .post(upload.single('avatar'), petValidation, validate, createPet);

router.route('/:id')
  .get(getPet)
  .put(upload.single('avatar'), updatePet)
  .delete(deletePet);

module.exports = router;
