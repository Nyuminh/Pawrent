const express = require('express');
const { body, validationResult } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
  register,
  registerHotelOwner,
  login,
  refreshToken,
  logout,
  getMe,
  updateProfile,
  changePassword,
  getAllVets,
} = require('../controllers/authController');

const router = express.Router();

// Custom validator for conditional vet fields
const validateVetFieldsIfNeeded = (req, res, next) => {
  // Since vets are now just users with vet role, no special validation needed
  next();
};

// Validation rules for user registration
const registerValidation = [
  body('fullName').notEmpty().withMessage('Họ tên không được để trống').trim(),
  body('email').isEmail().withMessage('Email không hợp lệ').normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu tối thiểu 6 ký tự'),
  body('phone')
    .optional()
    .matches(/^(\+84|0)\d{9,10}$/)
    .withMessage('Số điện thoại không hợp lệ'),
  body('role')
    .optional()
    .isIn(['user', 'vet'])
    .withMessage('Role không hợp lệ. Chỉ được phép là user hoặc vet'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Email không hợp lệ').normalizeEmail(),
  body('password').notEmpty().withMessage('Mật khẩu không được để trống'),
];

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication API
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Đăng ký tài khoản người dùng hoặc bác sĩ thú y
 *     description: |
 *       Đăng ký tài khoản mới. Nếu role = 'vet', bạn có thể cung cấp thông tin chuyên môn trong cùng một request.
 *       
 *       **Người dùng thường (role: user):**
 *       - Chỉ cần: fullName, email, password
 *       - Tùy chọn: phone, role
 *       
 *       **Bác sĩ thú y (role: vet):**
 *       - Bắt buộc: fullName, email, password, licenseNumber, specializations, yearsOfExperience, clinic
 *       - Tùy chọn: phone, speciesExpertise, isAvailableOnline, bio, education, consultationFee
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, email, password]
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: Nguyễn Văn A
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               phone:
 *                 type: string
 *                 example: "0901234567"
 *               password:
 *                 type: string
 *                 example: "123456"
 *               role:
 *                 type: string
 *                 enum: [user, vet]
 *                 default: user
 *                 description: "Vai trò người dùng (user: người nuôi thú cưng, vet: bác sĩ)"
 *               licenseNumber:
 *                 type: string
 *                 description: "Bắt buộc nếu role = vet. Số giấy phép hành nghề"
 *                 example: "DV-2024-001234"
 *               specializations:
 *                 type: array
 *                 description: "Bắt buộc nếu role = vet. Danh sách chuyên môn"
 *                 items:
 *                   type: string
 *                   enum: [general, surgery, dentistry, dermatology, cardiology, orthopedics, ophthalmology, neurology, oncology, emergency, nutrition, behavioral, exotic]
 *                 example: ["general", "surgery"]
 *               yearsOfExperience:
 *                 type: number
 *                 description: "Bắt buộc nếu role = vet. Số năm kinh nghiệm"
 *                 example: 5
 *               clinic:
 *                 type: object
 *                 description: "Bắt buộc nếu role = vet"
 *                 required: [name]
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "Phòng khám thú cưng Hà Nội"
 *                   address:
 *                     type: object
 *                     properties:
 *                       street:
 *                         type: string
 *                       city:
 *                         type: string
 *                       district:
 *                         type: string
 *                       ward:
 *                         type: string
 *                   phone:
 *                     type: string
 *               speciesExpertise:
 *                 type: array
 *                 description: "Tùy chọn cho vet. Các loài thú cưng chuyên gia"
 *                 items:
 *                   type: string
 *                   enum: [dog, cat, bird, hamster, rabbit, fish, reptile, other]
 *                 example: ["dog", "cat"]
 *               isAvailableOnline:
 *                 type: boolean
 *                 description: "Tùy chọn cho vet. Có khám tuyến trực tuyến không"
 *                 default: false
 *               bio:
 *                 type: string
 *                 description: "Tùy chọn cho vet. Tiểu sử (tối đa 1000 ký tự)"
 *               consultationFee:
 *                 type: object
 *                 description: "Tùy chọn cho vet. Phí khám chữa"
 *                 properties:
 *                   inPerson:
 *                     type: number
 *                     example: 300000
 *                   online:
 *                     type: number
 *                     example: 200000
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                     vetProfile:
 *                       type: object
 *                       description: "Chỉ có mặt nếu role = vet"
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         description: Yêu cầu không hợp lệ
 *       409:
 *         description: Email hoặc licenseNumber đã tồn tại
 */
router.post('/register', registerValidation, validateVetFieldsIfNeeded, validate, register);

// Hotel owner registration
const hotelOwnerValidation = [
  body('fullName').notEmpty().withMessage('Tên chủ khách sạn không được để trống'),
  body('email')
    .isEmail()
    .withMessage('Email không hợp lệ')
    .normalizeEmail(),
  body('phone')
    .matches(/^(\+84|0)\d{9,10}$/)
    .withMessage('Số điện thoại không hợp lệ'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
  body('hotelName')
    .notEmpty()
    .withMessage('Tên khách sạn không được để trống'),
  body('hotelDescription')
    .notEmpty()
    .withMessage('Mô tả khách sạn không được để trống')
    .isLength({ min: 20 })
    .withMessage('Mô tả phải có ít nhất 20 ký tự'),
  body('address.street')
    .notEmpty()
    .withMessage('Địa chỉ (đường) không được để trống'),
  body('address.city')
    .notEmpty()
    .withMessage('Thành phố không được để trống'),
];

router.post('/register-hotel-owner', hotelOwnerValidation, validate, registerHotelOwner);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post('/login', loginValidation, validate, login);
router.post('/refresh-token', refreshToken);
router.get('/vets', getAllVets);

// Protected routes
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/profile', protect, upload.single('avatar'), updateProfile);
router.put('/change-password', protect, changePassword);

module.exports = router;
