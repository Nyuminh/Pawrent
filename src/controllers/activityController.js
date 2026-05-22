const ActivityLog = require('../models/ActivityLog');
const Pet = require('../models/Pet');

// @desc    Log activity data (from tracking device)
// @route   POST /api/v1/activity
// @access  Private
exports.logActivity = async (req, res, next) => {
  try {
    const { petId, locations, activity, date } = req.body;

    const pet = await Pet.findOne({ _id: petId, owner: req.user.id, isActive: true });
    if (!pet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng.',
      });
    }

    const log = await ActivityLog.create({
      pet: petId,
      owner: req.user.id,
      date: date || new Date(),
      locations,
      activity,
    });

    // Anomaly detection
    if (activity) {
      const avgActivity = await ActivityLog.aggregate([
        { $match: { pet: pet._id } },
        {
          $group: {
            _id: null,
            avgDistance: { $avg: '$activity.totalDistance' },
            avgActiveMinutes: { $avg: '$activity.activeMinutes' },
          },
        },
      ]);

      if (avgActivity.length > 0) {
        const avg = avgActivity[0];
        if (
          activity.totalDistance < avg.avgDistance * 0.3 &&
          activity.activeMinutes < avg.avgActiveMinutes * 0.3
        ) {
          log.anomaly = {
            isDetected: true,
            type: 'low_activity',
            description: `Hoạt động của ${pet.name} thấp hơn bình thường đáng kể.`,
            alertSent: true,
          };
          await log.save();
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Ghi nhận hoạt động thành công.',
      data: log,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get activity logs for a pet
// @route   GET /api/v1/activity/:petId
// @access  Private
exports.getActivityLogs = async (req, res, next) => {
  try {
    const { petId } = req.params;
    const { startDate, endDate, page = 1, limit = 30 } = req.query;

    const pet = await Pet.findOne({ _id: petId, owner: req.user.id, isActive: true });
    if (!pet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng.',
      });
    }

    const query = { pet: petId, owner: req.user.id };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const total = await ActivityLog.countDocuments(query);
    const logs = await ActivityLog.find(query)
      .sort('-date')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: logs.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      data: logs,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get weekly activity report
// @route   GET /api/v1/activity/:petId/report/weekly
// @access  Private (Premium)
exports.getWeeklyReport = async (req, res, next) => {
  try {
    const { petId } = req.params;
    const pet = await Pet.findOne({ _id: petId, owner: req.user.id, isActive: true });
    if (!pet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng.',
      });
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const report = await ActivityLog.aggregate([
      {
        $match: {
          pet: pet._id,
          date: { $gte: oneWeekAgo },
        },
      },
      {
        $group: {
          _id: null,
          totalDistance: { $sum: '$activity.totalDistance' },
          totalActiveMinutes: { $sum: '$activity.activeMinutes' },
          totalCalories: { $sum: '$activity.caloriesBurned' },
          avgDailyDistance: { $avg: '$activity.totalDistance' },
          avgDailyActiveMinutes: { $avg: '$activity.activeMinutes' },
          anomalyCount: {
            $sum: { $cond: ['$anomaly.isDetected', 1, 0] },
          },
          daysTracked: { $sum: 1 },
        },
      },
    ]);

    const dailyBreakdown = await ActivityLog.find({
      pet: petId,
      date: { $gte: oneWeekAgo },
    })
      .sort('date')
      .select('date activity anomaly');

    res.status(200).json({
      success: true,
      data: {
        pet: { name: pet.name, species: pet.species },
        period: {
          start: oneWeekAgo,
          end: new Date(),
        },
        summary: report[0] || {
          totalDistance: 0,
          totalActiveMinutes: 0,
          totalCalories: 0,
          avgDailyDistance: 0,
          avgDailyActiveMinutes: 0,
          anomalyCount: 0,
          daysTracked: 0,
        },
        dailyBreakdown,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get monthly activity report
// @route   GET /api/v1/activity/:petId/report/monthly
// @access  Private (Premium)
exports.getMonthlyReport = async (req, res, next) => {
  try {
    const { petId } = req.params;
    const pet = await Pet.findOne({ _id: petId, owner: req.user.id, isActive: true });
    if (!pet) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng.',
      });
    }

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const report = await ActivityLog.aggregate([
      {
        $match: {
          pet: pet._id,
          date: { $gte: oneMonthAgo },
        },
      },
      {
        $group: {
          _id: {
            week: { $week: '$date' },
          },
          totalDistance: { $sum: '$activity.totalDistance' },
          totalActiveMinutes: { $sum: '$activity.activeMinutes' },
          totalCalories: { $sum: '$activity.caloriesBurned' },
          avgDailyDistance: { $avg: '$activity.totalDistance' },
          anomalyCount: {
            $sum: { $cond: ['$anomaly.isDetected', 1, 0] },
          },
          daysTracked: { $sum: 1 },
        },
      },
      { $sort: { '_id.week': 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        pet: { name: pet.name, species: pet.species },
        period: {
          start: oneMonthAgo,
          end: new Date(),
        },
        weeklyBreakdown: report,
      },
    });
  } catch (error) {
    next(error);
  }
};
