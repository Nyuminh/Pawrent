const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Vui lòng nhập họ tên'],
      trim: true,
      maxlength: [100, 'Họ tên không quá 100 ký tự'],
    },
    email: {
      type: String,
      required: [true, 'Vui lòng nhập email'],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Email không hợp lệ'],
    },
    phone: {
      type: String,
      match: [/^(\+84|0)\d{9,10}$/, 'Số điện thoại không hợp lệ'],
    },
    password: {
      type: String,
      required: [true, 'Vui lòng nhập mật khẩu'],
      minlength: [6, 'Mật khẩu tối thiểu 6 ký tự'],
      select: false, // Don't return password by default
    },
    avatar: {
      type: String,
      default: 'default-avatar.png',
    },
    role: {
      type: String,
      enum: ['user', 'vet', 'hotel_owner', 'admin'],
      default: 'user',
    },
    address: {
      type: String,
      trim: true,
    },
    subscription: {
      plan: {
        type: String,
        default: 'free',
      },
      name: {
        type: String,
        default: 'Miễn phí',
        trim: true,
      },
      durationUnit: {
        type: String,
        enum: ['month', 'year'],
        default: 'year',
      },
      startDate: Date,
      endDate: Date,
      isActive: {
        type: Boolean,
        default: false,
      },
      maxPets: {
        type: Number,
        default: 1,
      },
    },
    refreshToken: {
      type: String,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: Date,
    cart: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: [1, 'Số lượng phải lớn hơn hoặc bằng 1'],
          default: 1,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: Pets owned by user
UserSchema.virtual('pets', {
  ref: 'Pet',
  localField: '_id',
  foreignField: 'owner',
  justOne: false,
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate Access Token
UserSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

// Generate Refresh Token
UserSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { id: this._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE }
  );
};

// Check subscription status
UserSchema.methods.hasActiveSubscription = function () {
  if (this.subscription.plan === 'free') return true;
  return (
    this.subscription.isActive &&
    this.subscription.endDate &&
    new Date(this.subscription.endDate) > new Date()
  );
};

// Check feature access
UserSchema.methods.canAccessFeature = function (feature) {
  const plans = require('../config/plans');
  const currentPlan = this.subscription.plan !== 'free' && this.hasActiveSubscription()
    ? plans.PREMIUM
    : plans.FREE;
  return currentPlan.features.includes(feature);
};

module.exports = mongoose.model('User', UserSchema);
