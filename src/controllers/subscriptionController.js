const User = require('../models/User');
const plans = require('../config/plans');

function getPlanConfig(planSlug) {
  const normalizedPlan = String(planSlug || 'free').trim().toLowerCase();

  if (normalizedPlan === 'free') return plans.FREE;
  if (normalizedPlan.includes('plus')) return plans.PLUS;
  if (normalizedPlan.includes('vip') || normalizedPlan.includes('premium')) return plans.VIP || plans.PREMIUM;

  return plans[normalizedPlan.toUpperCase()] || plans.FREE;
}

function getPlanDetailsBySubscription(subscription) {
  return getPlanConfig(subscription?.plan);
}

function normalizePlanSlug(name) {
  return String(name).trim().toLowerCase().replace(/\s+/g, '_');
}

function getTargetUserId(req, requestedUserId) {
  const targetUserId = requestedUserId || req.user.id;

  if (
    requestedUserId &&
    String(requestedUserId) !== String(req.user.id) &&
    req.user.role !== 'admin'
  ) {
    return {
      error: {
        status: 403,
        message: 'Chỉ admin mới được nâng gói cho người dùng khác.',
      },
    };
  }

  return { targetUserId };
}

function calculateCarryoverMs(subscription, targetPlanSlug) {
  if (targetPlanSlug !== 'vip') return 0;
  if (!String(subscription?.plan || 'free').toLowerCase().includes('plus')) return 0;
  if (!subscription?.isActive || !subscription?.endDate) return 0;

  const remainingMs = new Date(subscription.endDate).getTime() - Date.now();
  return remainingMs > 0 ? remainingMs : 0;
}

async function getUserOrFail(userId) {
  const user = await User.findById(userId);

  if (!user) {
    return {
      error: {
        status: 404,
        message: 'Không tìm thấy người dùng.',
      },
    };
  }

  return { user };
}

async function upgradeSubscription(req, res, next, targetPlanSlug) {
  try {
    const { userId, additionalPets = 0, paymentMethod } = req.body;
    const targetUserResult = getTargetUserId(req, userId);

    if (targetUserResult.error) {
      return res.status(targetUserResult.error.status).json({
        success: false,
        message: targetUserResult.error.message,
      });
    }

    const userResult = await getUserOrFail(targetUserResult.targetUserId);
    if (userResult.error) {
      return res.status(userResult.error.status).json({
        success: false,
        message: userResult.error.message,
      });
    }

    const user = userResult.user;
    const planConfig = getPlanConfig(targetPlanSlug);
    const additionalPetCount = Number(additionalPets);

    if (!planConfig || targetPlanSlug === 'free') {
      return res.status(400).json({
        success: false,
        message: 'Gói nâng cấp không hợp lệ.',
      });
    }

    if (Number.isNaN(additionalPetCount) || additionalPetCount < 0) {
      return res.status(400).json({
        success: false,
        message: 'additionalPets không được nhỏ hơn 0.',
      });
    }

    const currentPlanSlug = String(user.subscription.plan || 'free').toLowerCase();
    const currentPlanTier = currentPlanSlug.includes('plus')
      ? 'plus'
      : currentPlanSlug.includes('vip') || currentPlanSlug.includes('premium')
        ? 'vip'
        : 'free';
    const hasActivePaidPlan = currentPlanSlug !== 'free' && user.hasActiveSubscription();

    if (targetPlanSlug === 'plus' && hasActivePaidPlan) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã có gói trả phí đang hoạt động.',
      });
    }

    if (targetPlanSlug === 'vip') {
      if (currentPlanTier === 'vip' && user.hasActiveSubscription()) {
        return res.status(400).json({
          success: false,
          message: 'Bạn đã có gói Vip đang hoạt động.',
        });
      }

      if (currentPlanTier !== 'plus' && hasActivePaidPlan) {
        return res.status(400).json({
          success: false,
          message: 'Chỉ được nâng lên Vip từ gói Plus hoặc gói đã hết hạn.',
        });
      }
    }

    const basePrice = targetPlanSlug === 'plus'
      ? planConfig.pricePerMonth
      : planConfig.pricePerYear;

    let totalPrice = basePrice;
    for (let i = 0; i < additionalPetCount; i++) {
      totalPrice += basePrice * planConfig.additionalPetMultiplier;
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    const durationMonths = targetPlanSlug === 'plus'
      ? planConfig.durationMonths.month
      : planConfig.durationMonths.year;

    endDate.setMonth(endDate.getMonth() + durationMonths);
    endDate.setTime(endDate.getTime() + calculateCarryoverMs(user.subscription, targetPlanSlug));

    const normalizedPlan = normalizePlanSlug(planConfig.name);
    const maxPets = planConfig.maxPets + additionalPetCount;

    user.subscription = {
      plan: normalizedPlan,
      name: planConfig.name,
      durationUnit: targetPlanSlug === 'plus' ? 'month' : 'year',
      startDate,
      endDate,
      isActive: true,
      maxPets,
    };

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: `Nâng cấp gói ${planConfig.name} thành công! 🎉`,
      data: {
        subscription: user.subscription,
        pricing: {
          basePrice,
          durationUnit: targetPlanSlug === 'plus' ? 'month' : 'year',
          additionalPets: additionalPetCount,
          totalPrice,
          currency: 'VND',
          paymentMethod: paymentMethod || 'pending',
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

// @desc    Get current subscription info
// @route   GET /api/v1/subscription
// @access  Private
exports.getSubscription = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const currentPlan = user.subscription.plan !== 'free' && user.hasActiveSubscription()
      ? getPlanDetailsBySubscription(user.subscription)
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
        plus: {
          ...plans.PLUS,
          description: 'Gói Plus – Dành cho 2 thú cưng, chu kỳ 1 tháng',
        },
        vip: {
          ...plans.VIP,
          description: 'Gói Vip – Dành cho 3 thú cưng, chu kỳ 1 năm',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upgrade to Plus
// @route   POST /api/v1/subscription/upgrade/plus
// @access  Private
exports.upgradePlusPlan = async (req, res, next) => {
  return upgradeSubscription(req, res, next, 'plus');
};

// @desc    Upgrade to Vip
// @route   POST /api/v1/subscription/upgrade/vip
// @access  Private
exports.upgradeVipPlan = async (req, res, next) => {
  return upgradeSubscription(req, res, next, 'vip');
};

// Backward-compatible alias for the old generic route
exports.upgradePlan = async (req, res, next) => {
  return upgradeSubscription(req, res, next, 'plus');
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
      message: `Đã hủy gia hạn. Gói ${user.subscription.name || 'dịch vụ'} sẽ hết hạn vào ngày ` +
        new Date(user.subscription.endDate).toLocaleDateString('vi-VN'),
      data: {
        subscription: user.subscription,
      },
    });
  } catch (error) {
    next(error);
  }
};
