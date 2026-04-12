const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getSubscription,
  getPlans,
  upgradePlan,
  cancelSubscription,
} = require('../controllers/subscriptionController');

const router = express.Router();

// Public
router.get('/plans', getPlans);

// Protected
router.use(protect);
router.get('/', getSubscription);
router.post('/upgrade', upgradePlan);
router.post('/cancel', cancelSubscription);

module.exports = router;
