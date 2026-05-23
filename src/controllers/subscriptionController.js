const User = require('../models/User');
const plans = require('../config/plans');

// @desc    Get current subscription info
// @route   GET /api/v1/subscription
// @access  Private
exports.getSubscription = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    const currentPlan = user.subscription.plan !== 'free' && user.hasActiveSubscription()
      ? plans.PREMIUM
      : plans.FREE;

    res.status(200).json({
      success: true,
      data: {
        currentPlan: user.subscription,
        planDetails: currentPlan,
        isActive: user.hasActiveSubscription(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get available plans
// @route   GET /api/v1/subscription/plans
// @access  Public
exports.getPlans = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        free: {
          ...plans.FREE,
          description: 'Gói miễn phí – Tính năng cơ bản cho 1 thú cưng',
        },
        premium: {
          ...plans.PREMIUM,
          description: 'Gói Premium – Đầy đủ tính năng, AI tư vấn, cá nhân hóa lịch chăm sóc',
          additionalPetInfo: 'Thú cưng thứ 2 = 150% giá, không phải 200%',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upgrade to Premium
// @route   POST /api/v1/subscription/upgrade
// @access  Private
exports.upgradePlan = async (req, res, next) => {
  try {
    const { name, durationUnit = 'year', additionalPets = 0, paymentMethod } = req.body;

    const user = await User.findById(req.user.id);

    if (user.subscription.plan !== 'free' && user.hasActiveSubscription()) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã có gói trả phí đang hoạt động.',
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên gói (name).',
      });
    }

    if (!['month', 'year'].includes(durationUnit)) {
      return res.status(400).json({
        success: false,
        message: 'durationUnit chỉ nhận month hoặc year.',
      });
    }

    if (Number(additionalPets) < 0) {
      return res.status(400).json({
        success: false,
        message: 'additionalPets không được nhỏ hơn 0.',
      });
    }

    // Calculate pricing
    const basePrice = durationUnit === 'month'
      ? plans.PREMIUM.pricePerMonth
      : plans.PREMIUM.pricePerYear;
    let totalPrice = basePrice;
    const maxPets = 1 + Number(additionalPets);

    // Additional pets: 150% for each extra pet
    for (let i = 0; i < Number(additionalPets); i++) {
      totalPrice += basePrice * plans.PREMIUM.additionalPetMultiplier;
    }

    // In real app, process payment here
    // For now, simulate success

    const normalizedPlan = name.trim().toLowerCase().replace(/\s+/g, '_');
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + plans.PREMIUM.durationMonths[durationUnit]);

    user.subscription = {
      plan: normalizedPlan,
      name: name.trim(),
      durationUnit,
      startDate,
      endDate,
      isActive: true,
      maxPets,
    };

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: `Nâng cấp gói ${name.trim()} thành công! 🎉`,
      data: {
        subscription: user.subscription,
        pricing: {
          basePrice,
          durationUnit,
          additionalPets,
          totalPrice,
          currency: 'VND',
          paymentMethod: paymentMethod || 'pending',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel subscription
// @route   POST /api/v1/subscription/cancel
// @access  Private
exports.cancelSubscription = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.subscription.plan === 'free') {
      return res.status(400).json({
        success: false,
        message: 'Bạn đang sử dụng gói miễn phí.',
      });
    }

    // Don't immediately cancel, let it expire
    user.subscription.isActive = false;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Đã hủy gia hạn. Gói Premium sẽ hết hạn vào ngày ' +
        new Date(user.subscription.endDate).toLocaleDateString('vi-VN'),
      data: {
        subscription: user.subscription,
      },
    });
  } catch (error) {
    next(error);
  }
};
