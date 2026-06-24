const express = require('express');
const { protect, optionalAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
  createHotel,
  getHotels,
  getHotel,
  getMyHotels,
  updateHotel,
  deleteHotel,
  getRoomOccupancy,
} = require('../controllers/hotelController');

const router = express.Router();

// ===== HOTEL ROUTES =====
router.get('/', optionalAuth, getHotels);

// ===== MY HOTELS (hotel owner) =====
router.get('/my', protect, getMyHotels);

// ===== ROOM OCCUPANCY DASHBOARD =====
router.get('/:hotelId/rooms/occupancy', protect, getRoomOccupancy);

// ===== HOTEL DETAIL ROUTES =====
router.get('/:id', optionalAuth, getHotel);
router.post('/', protect, upload.array('images', 10), createHotel);
router.put('/:id', protect, upload.array('images', 10), updateHotel);
router.delete('/:id', protect, deleteHotel);

module.exports = router;
