const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getDashboard,
  getUsers,
  updateUser,
  deleteUser,
  updateUserSubscription,
  verifyVet,
  verifyHotel,
} = require('../controllers/adminController');
const { getAllPets } = require('../controllers/petController');

const router = express.Router();

// All admin routes require auth + admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/dashboard', getDashboard);
router.get('/users', getUsers);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.put('/users/:id/subscription', updateUserSubscription);
router.put('/vets/:id/verify', verifyVet);
router.put('/hotels/:id/verify', verifyHotel);
router.get('/pets', getAllPets);

module.exports = router;
