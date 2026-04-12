const mongoose = require('mongoose');

const VetSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    licenseNumber: {
      type: String,
      required: [true, 'Vui lòng nhập số giấy phép hành nghề'],
      unique: true,
    },
    specializations: {
      type: [String],
      required: [true, 'Vui lòng nhập chuyên môn'],
      enum: [
        'general',          // Đa khoa
        'surgery',          // Phẫu thuật
        'dentistry',        // Nha khoa
        'dermatology',      // Da liễu
        'cardiology',       // Tim mạch
        'orthopedics',      // Chỉnh hình
        'ophthalmology',    // Mắt
        'neurology',        // Thần kinh
        'oncology',         // Ung bướu
        'emergency',        // Cấp cứu
        'nutrition',        // Dinh dưỡng
        'behavioral',       // Hành vi
        'exotic',           // Thú cưng ngoại lai
      ],
    },
    // Species the vet specializes in
    speciesExpertise: {
      type: [String],
      enum: ['dog', 'cat', 'bird', 'hamster', 'rabbit', 'fish', 'reptile', 'other'],
      default: ['dog', 'cat'],
    },
    yearsOfExperience: {
      type: Number,
      required: [true, 'Vui lòng nhập số năm kinh nghiệm'],
      min: 0,
    },
    education: [
      {
        degree: String,
        school: String,
        year: Number,
      },
    ],
    clinic: {
      name: {
        type: String,
        required: [true, 'Vui lòng nhập tên phòng khám'],
      },
      address: {
        street: String,
        city: String,
        district: String,
        ward: String,
        coordinates: {
          lat: Number,
          lng: Number,
        },
      },
      phone: String,
    },
    // Working hours
    workingHours: [
      {
        dayOfWeek: {
          type: Number, // 0=Sun,...6=Sat
          required: true,
        },
        startTime: String, // "08:00"
        endTime: String,   // "17:00"
        isOpen: { type: Boolean, default: true },
      },
    ],
    // Consultation
    consultationFee: {
      inPerson: { type: Number, default: 0 },
      online: { type: Number, default: 0 },
      currency: { type: String, default: 'VND' },
    },
    isAvailableOnline: {
      type: Boolean,
      default: false,
    },
    bio: {
      type: String,
      maxlength: [1000, 'Giới thiệu không quá 1000 ký tự'],
    },
    // Ratings
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    // Subscription status (B2B)
    subscription: {
      plan: {
        type: String,
        enum: ['basic', 'professional', 'premium'],
        default: 'basic',
      },
      isActive: { type: Boolean, default: true },
      startDate: Date,
      endDate: Date,
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

// Indexes
VetSchema.index({ specializations: 1 });
VetSchema.index({ speciesExpertise: 1 });
VetSchema.index({ 'clinic.address.city': 1 });
VetSchema.index({ 'rating.average': -1 });
VetSchema.index({ isVerified: 1, isActive: 1 });

module.exports = mongoose.model('Vet', VetSchema);
