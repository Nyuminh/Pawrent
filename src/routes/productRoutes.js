const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
  getAllProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  addReview,
  addToCart,
  getCart,
  removeFromCart,
} = require('../controllers/productController');

const router = express.Router();

// Validation rules
const createProductValidation = [
  body('name').notEmpty().withMessage('Tên sản phẩm không được để trống'),
  body('description').notEmpty().withMessage('Mô tả sản phẩm không được để trống'),
  body('category')
    .isIn(['gps_tracker', 'collar', 'food', 'toy', 'bed', 'grooming', 'health', 'clothing', 'accessory', 'other'])
    .withMessage('Danh mục sản phẩm không hợp lệ'),
  body('price').isFloat({ min: 0 }).withMessage('Giá phải là số dương'),
  body('petTypes')
    .isArray({ min: 1 })
    .withMessage('Phải chọn ít nhất 1 loại thú cưng'),
];

const reviewValidation = [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Xếp hạng phải từ 1 đến 5'),
  body('comment').notEmpty().withMessage('Nhận xét không được để trống'),
];

// Public routes
router.get('/', getAllProducts);
router.get('/cart', protect, getCart);
router.get('/:id', getProduct);

// Authenticated routes
router.post('/:id/cart', protect, addToCart);
router.delete('/:id/cart', protect, removeFromCart);
router.post('/:id/review', protect, reviewValidation, validate, addReview);

// Protected routes (admin only)
router.use(protect, authorize('admin'));
router.post('/', upload.array('images'), createProductValidation, validate, createProduct);
router.put('/:id', upload.array('images'), updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;
