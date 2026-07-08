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
} = require('../controllers/hotelController');

const router = express.Router();

// Helper: multer upload tùy chọn - nếu không có file thì vẫn tiếp tục bình thường
const optionalUpload = (req, res, next) => {
  upload.array('images', 10)(req, res, (err) => {
    if (err) {
      // Chỉ reject nếu lỗi thực sự (sai format, quá size) - không reject nếu không có file
      if (err.message && err.message.includes('Chỉ hỗ trợ')) {
        return res.status(400).json({ success: false, message: err.message });
      }
    }
    next();
  });
};

// ===== HOTEL ROUTES =====
router.get('/', optionalAuth, getHotels);

// ===== MY HOTELS (hotel owner) =====
router.get('/my', protect, getMyHotels);

// ===== HOTEL DETAIL ROUTES =====
router.get('/:id', optionalAuth, getHotel);
router.post('/', protect, optionalUpload, createHotel);
router.put('/:id', protect, optionalUpload, updateHotel);
router.delete('/:id', protect, deleteHotel);

module.exports = router;
