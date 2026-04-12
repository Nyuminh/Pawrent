const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  createReminder,
  getMyReminders,
  getUpcoming,
  getReminder,
  updateReminder,
  completeReminder,
  deleteReminder,
} = require('../controllers/reminderController');

const router = express.Router();

// Validation
const reminderValidation = [
  body('pet').notEmpty().withMessage('ID thú cưng không được để trống'),
  body('type').notEmpty().withMessage('Loại nhắc nhở không được để trống'),
  body('title').notEmpty().withMessage('Tiêu đề không được để trống'),
  body('scheduledDate').notEmpty().withMessage('Ngày hẹn không được để trống'),
  body('scheduledTime').notEmpty().withMessage('Giờ hẹn không được để trống'),
];

// All routes require auth
router.use(protect);

router.get('/upcoming', getUpcoming);

router.route('/')
  .get(getMyReminders)
  .post(reminderValidation, validate, createReminder);

router.route('/:id')
  .get(getReminder)
  .put(updateReminder)
  .delete(deleteReminder);

router.put('/:id/complete', completeReminder);

module.exports = router;
