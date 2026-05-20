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
  updateCart,
} = require('../controllers/productController');

const router = express.Router();

// Middleware để parse petTypes từ string thành array
const parsePetTypes = (req, res, next) => {
  if (req.body.petTypes) {
    if (typeof req.body.petTypes === 'string') {
      // Nếu là JSON array string: ["dog","cat"]
      try {
        req.body.petTypes = JSON.parse(req.body.petTypes);
      } catch (e) {
        // Nếu là chuỗi ngăn bởi dấu phẩy: dog,cat,bird
        req.body.petTypes = req.body.petTypes.split(',').map(s => s.trim());
      }
    }
  }
  next();
};

// Middleware để parse JSON fields từ string
const parseJSONFields = (req, res, next) => {
  const jsonFields = ['stock', 'specifications', 'discount'];
  jsonFields.forEach(field => {
    if (req.body[field] && typeof req.body[field] === 'string') {
      try {
        req.body[field] = JSON.parse(req.body[field]);
      } catch (e) {
        // Nếu parse lỗi, giữ nguyên string
      }
    }
  });
  next();
};

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
router.put('/:id/cart', protect, updateCart);
router.delete('/:id/cart', protect, removeFromCart);
router.post('/:id/review', protect, reviewValidation, validate, addReview);

// Protected routes (admin only)
router.use(protect, authorize('admin'));
router.post('/', upload.array('images'), parseJSONFields, parsePetTypes, createProductValidation, validate, createProduct);
router.put('/:id', upload.array('images'), parseJSONFields, parsePetTypes, updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;
