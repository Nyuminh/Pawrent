const express = require('express');
const { body, validationResult } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  updateProfile,
  changePassword,
} = require('../controllers/authController');

const router = express.Router();

// Custom validator for conditional vet fields
const validateVetFieldsIfNeeded = (req, res, next) => {
  const { role } = req.body;
  
  if (role === 'vet') {
    // Vet registration requires these fields
    const errors = [];

    if (!req.body.licenseNumber || typeof req.body.licenseNumber !== 'string' || req.body.licenseNumber.trim() === '') {
      errors.push('Số giấy phép hành nghề không được để trống');
    }

    if (!Array.isArray(req.body.specializations) || req.body.specializations.length === 0) {
      errors.push('Chuyên môn phải là mảng với ít nhất 1 mục');
    }

    if (typeof req.body.yearsOfExperience !== 'number' || req.body.yearsOfExperience < 0) {
      errors.push('Số năm kinh nghiệm phải là số >= 0');
    }

    if (!req.body.clinic || !req.body.clinic.name || typeof req.body.clinic.name !== 'string' || req.body.clinic.name.trim() === '') {
      errors.push('Tên phòng khám không được để trống');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu bác sĩ không hợp lệ',
        errors,
      });
    }
  }

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

// Protected routes
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);

module.exports = router;
