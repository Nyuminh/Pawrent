const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getDashboard,
  getUsers,
  updateUser,
  verifyVet,
  verifyHotel,
} = require('../controllers/adminController');

const router = express.Router();

// All admin routes require auth + admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/dashboard', getDashboard);
router.get('/users', getUsers);
router.put('/users/:id', updateUser);
router.put('/vets/:id/verify', verifyVet);
router.put('/hotels/:id/verify', verifyHotel);

module.exports = router;
