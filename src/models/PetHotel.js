const mongoose = require('mongoose');

const PetHotelSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Vui lòng nhập tên khách sạn'],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
    },
    description: {
      type: String,
      required: [true, 'Vui lòng nhập mô tả'],
      maxlength: [2000, 'Mô tả không quá 2000 ký tự'],
    },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      district: String,
      ward: String,
    },
    phone: {
      type: String,
      required: [true, 'Vui lòng nhập số điện thoại'],
    },
    email: String,
    // Services
    services: [
      {
        name: String,
        description: String,
        price: Number,
        currency: { type: String, default: 'VND' },
      },
    ],
    // Giá mỗi đêm
    price: {
      type: Number,
      default: 0,
    },
    // Images
    images: [
      {
        url: String,
        caption: String,
      },
    ],
    // Operating hours
    operatingHours: {
      checkIn: String,  // "14:00"
      checkOut: String, // "12:00"
      isOpen24h: { type: Boolean, default: false },
    },
    // Ratings
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    // Policies
    policies: {
      cancellationHours: { type: Number, default: 24 },
      requireVaccination: { type: Boolean, default: true },
      maxPetWeight: Number,
      additionalNotes: String,
    },
    // Platform commission
    commissionRate: {
      type: Number,
      default: 0.15, // 15%
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Generate slug
PetHotelSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    const slugify = require('slugify');
    this.slug = slugify(this.name, { lower: true, strict: true }) + '-' + Date.now().toString(36);
  }
  next();
});

// Indexes
PetHotelSchema.index({ 'address.city': 1, isActive: 1 });
PetHotelSchema.index({ 'rating.average': -1 });

module.exports = mongoose.model('PetHotel', PetHotelSchema);
