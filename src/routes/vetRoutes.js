const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const {
  registerVet,
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
router.post('/register', protect, registerVet);
router.put('/profile', protect, authorize('vet'), updateVetProfile);
router.get('/recommend/:petId', protect, getRecommendedVets);

module.exports = router;

// ===== APPOINTMENT ROUTES (separate file) =====
// Exported separately for clarity
