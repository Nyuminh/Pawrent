const express = require('express');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
  getVets,
  getVet,
  updateVetProfile,
  getRecommendedVets,
  createAppointment,
  getMyAppointments,
  getVetAppointments,
  updateAppointmentStatus,
  reviewAppointment,
} = require('../controllers/vetController');

const router = express.Router();

// ===== VET PROFILES =====
router.get('/', optionalAuth, getVets);
router.get('/:id', optionalAuth, getVet);

// Protected vet routes
// PUT /profile để cập nhật hồ sơ bác sĩ (sau khi đã đăng ký bằng POST /auth/register)
router.put('/profile', protect, authorize('vet'), upload.single('avatar'), updateVetProfile);
router.get('/recommend/:petId', protect, getRecommendedVets);

module.exports = router;

// ===== APPOINTMENT ROUTES (separate file) =====
// Exported separately for clarity

module.exports = router;

// ===== APPOINTMENT ROUTES (separate file) =====
// Exported separately for clarity
