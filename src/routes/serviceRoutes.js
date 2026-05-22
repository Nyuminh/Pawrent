const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  permanentlyDeleteService,
} = require('../controllers/serviceController');

const router = express.Router();

// Validation
const serviceValidation = [
  body('name').notEmpty().withMessage('Tên dịch vụ không được để trống'),
  body('description').notEmpty().withMessage('Mô tả dịch vụ không được để trống'),
  body('price')
    .notEmpty()
    .withMessage('Giá dịch vụ không được để trống')
    .isFloat({ min: 0 })
    .withMessage('Giá dịch vụ phải lớn hơn 0'),
  body('promotion')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Khuyến mãi phải từ 0 đến 100%'),
];

// Public routes (no auth required)
router.get('/', getAllServices);
router.get('/:id', getServiceById);

// All routes after this require auth
router.use(protect);

// Admin routes
router.post('/', authorize('admin'), upload.array('images', 10), serviceValidation, validate, createService);

router.put('/:id', authorize('admin'), upload.array('images', 10), updateService);

router.delete('/:id', authorize('admin'), deleteService);

router.delete('/:id/permanent', authorize('admin'), permanentlyDeleteService);

module.exports = router;
