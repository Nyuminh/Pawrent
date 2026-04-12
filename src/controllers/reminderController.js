const Reminder = require('../models/Reminder');
const Pet = require('../models/Pet');

// @desc    Create reminder
// @route   POST /api/v1/reminders
// @access  Private
exports.createReminder = async (req, res, next) => {
  try {
    // Verify pet ownership
    const pet = await Pet.findOne({
      _id: req.body.pet,
      owner: req.user.id,
      isActive: true,
    });

    if (!pet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng.',
      });
    }

    // Check reminder limit for free users
    if (req.user.subscription.plan === 'free') {
      const reminderCount = await Reminder.countDocuments({
        owner: req.user.id,
        status: { $in: ['pending', 'snoozed'] },
      });
      if (reminderCount >= 5) {
        return res.status(403).json({
          success: false,
          message: 'Gói miễn phí chỉ cho phép tối đa 5 nhắc nhở. Nâng cấp Premium để thêm.',
          code: 'REMINDER_LIMIT_REACHED',
        });
      }
    }

    req.body.owner = req.user.id;
    const reminder = await Reminder.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Tạo nhắc nhở thành công.',
      data: reminder,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all reminders for current user
// @route   GET /api/v1/reminders
// @access  Private
exports.getMyReminders = async (req, res, next) => {
  try {
    const {
      pet,
      type,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const query = { owner: req.user.id };

    if (pet) query.pet = pet;
    if (type) query.type = type;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.scheduledDate = {};
      if (startDate) query.scheduledDate.$gte = new Date(startDate);
      if (endDate) query.scheduledDate.$lte = new Date(endDate);
    }

    const total = await Reminder.countDocuments(query);
    const reminders = await Reminder.find(query)
      .populate('pet', 'name species breed avatar')
      .sort('scheduledDate')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: reminders.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      data: reminders,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get upcoming reminders (today + next 7 days)
// @route   GET /api/v1/reminders/upcoming
// @access  Private
exports.getUpcoming = async (req, res, next) => {
  try {
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const reminders = await Reminder.find({
      owner: req.user.id,
      status: 'pending',
      scheduledDate: { $gte: now, $lte: nextWeek },
    })
      .populate('pet', 'name species avatar')
      .sort('scheduledDate scheduledTime');

    // Group by date
    const grouped = {};
    reminders.forEach((r) => {
      const dateKey = r.scheduledDate.toISOString().split('T')[0];
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(r);
    });

    res.status(200).json({
      success: true,
      count: reminders.length,
      data: grouped,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single reminder
// @route   GET /api/v1/reminders/:id
// @access  Private
exports.getReminder = async (req, res, next) => {
  try {
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      owner: req.user.id,
    }).populate('pet', 'name species breed');

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhắc nhở.',
      });
    }

    res.status(200).json({
      success: true,
      data: reminder,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update reminder
// @route   PUT /api/v1/reminders/:id
// @access  Private
exports.updateReminder = async (req, res, next) => {
  try {
    let reminder = await Reminder.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhắc nhở.',
      });
    }

    delete req.body.owner;
    delete req.body.pet;

    reminder = await Reminder.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: 'Cập nhật nhắc nhở thành công.',
      data: reminder,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark reminder as completed
// @route   PUT /api/v1/reminders/:id/complete
// @access  Private
exports.completeReminder = async (req, res, next) => {
  try {
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhắc nhở.',
      });
    }

    reminder.status = 'completed';
    reminder.completedAt = new Date();
    await reminder.save();

    // If recurring, create next occurrence
    if (reminder.isRecurring && reminder.recurrence) {
      const nextDate = calculateNextDate(reminder);
      if (nextDate && (!reminder.recurrence.endDate || nextDate <= new Date(reminder.recurrence.endDate))) {
        await Reminder.create({
          pet: reminder.pet,
          owner: reminder.owner,
          type: reminder.type,
          title: reminder.title,
          description: reminder.description,
          scheduledDate: nextDate,
          scheduledTime: reminder.scheduledTime,
          isRecurring: true,
          recurrence: reminder.recurrence,
          notification: reminder.notification,
          isPersonalized: reminder.isPersonalized,
          personalizedReason: reminder.personalizedReason,
          priority: reminder.priority,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Đã hoàn thành nhắc nhở.',
      data: reminder,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete reminder
// @route   DELETE /api/v1/reminders/:id
// @access  Private
exports.deleteReminder = async (req, res, next) => {
  try {
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhắc nhở.',
      });
    }

    await Reminder.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Xóa nhắc nhở thành công.',
    });
  } catch (error) {
    next(error);
  }
};

// Helper: Calculate next recurring date
function calculateNextDate(reminder) {
  const current = new Date(reminder.scheduledDate);
  const { frequency, interval = 1 } = reminder.recurrence;

  switch (frequency) {
    case 'daily':
      current.setDate(current.getDate() + interval);
      break;
    case 'weekly':
      current.setDate(current.getDate() + 7 * interval);
      break;
    case 'biweekly':
      current.setDate(current.getDate() + 14);
      break;
    case 'monthly':
      current.setMonth(current.getMonth() + interval);
      break;
    case 'quarterly':
      current.setMonth(current.getMonth() + 3);
      break;
    case 'yearly':
      current.setFullYear(current.getFullYear() + interval);
      break;
    default:
      return null;
  }
  return current;
}
