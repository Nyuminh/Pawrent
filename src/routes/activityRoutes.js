const express = require('express');
const { protect, requirePremium } = require('../middleware/auth');
const {
  logActivity,
  getActivityLogs,
  getWeeklyReport,
  getMonthlyReport,
} = require('../controllers/activityController');

const router = express.Router();

// All routes require auth
router.use(protect);

router.post('/', logActivity);
router.get('/:petId', getActivityLogs);
router.get('/:petId/report/weekly', requirePremium('weekly_monthly_reports'), getWeeklyReport);
router.get('/:petId/report/monthly', requirePremium('weekly_monthly_reports'), getMonthlyReport);

module.exports = router;
