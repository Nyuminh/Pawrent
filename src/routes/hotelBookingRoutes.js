const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  createBooking,
  getMyBookings,
  getHotelBookings,
  updateBookingStatus,
  reviewBooking,
} = require('../controllers/hotelController');

const router = express.Router();

// Validation
const bookingValidation = [
  body('hotel').notEmpty().withMessage('ID khách sạn không được để trống'),
  body('roomType')
    .isIn(['standard', 'deluxe', 'vip', 'suite'])
    .withMessage('Loại phòng không hợp lệ'),
  body('checkIn').notEmpty().withMessage('Ngày check-in không được để trống'),
  body('checkOut').notEmpty().withMessage('Ngày check-out không được để trống'),
];

// All routes require auth
router.use(protect);

router.route('/')
  .get(getMyBookings)
  .post(bookingValidation, validate, createBooking);

router.get('/hotel/:hotelId', getHotelBookings);
router.put('/:id/status', updateBookingStatus);
router.post('/:id/review', reviewBooking);

module.exports = router;
