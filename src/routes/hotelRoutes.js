const express = require('express');
const { protect, optionalAuth } = require('../middleware/auth');
const {
  createHotel,
  getHotels,
  getHotel,
  updateHotel,
  createBooking,
  getMyBookings,
  getHotelBookings,
  updateBookingStatus,
  reviewBooking,
} = require('../controllers/hotelController');

const router = express.Router();

// ===== HOTEL ROUTES =====
router.get('/', optionalAuth, getHotels);
router.get('/:id', optionalAuth, getHotel);
router.post('/', protect, createHotel);
router.put('/:id', protect, updateHotel);

module.exports = router;
