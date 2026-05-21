const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pet',
      required: true,
    },
    vet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    appointmentType: {
      type: String,
      enum: ['in_person', 'online'],
      required: [true, 'Vui lòng chọn hình thức khám'],
    },
    date: {
      type: Date,
      required: [true, 'Vui lòng chọn ngày khám'],
    },
    timeSlot: {
      startTime: {
        type: String,
        required: [true, 'Vui lòng chọn giờ bắt đầu'],
      },
      endTime: String,
    },
    reason: {
      type: String,
      required: [true, 'Vui lòng nhập lý do khám'],
      trim: true,
    },
    symptoms: [String],
    notes: String,
    status: {
      type: String,
      enum: [
        'chờ_xác_nhận',      // Chờ xác nhận
        'đã_xác_nhận',    // Đã xác nhận
        'đang_khám',  // Đang khám
        'hoàn_thành',    // Hoàn thành
        'đã_hủy',    // Đã hủy
        'không_đến',      // Không đến
      ],
      default: 'chờ_xác_nhận',
    },
    cancellation: {
      cancelledBy: {
        type: String,
        enum: ['người_dùng', 'bác_sĩ', 'hệ_thống'],
      },
      reason: String,
      cancelledAt: Date,
    },
    // Payment
    fee: {
      amount: Number,
      currency: { type: String, default: 'VND' },
      isPaid: { type: Boolean, default: false },
      paidAt: Date,
      paymentMethod: String,
    },
    // Commission for platform
    commission: {
      rate: { type: Number, default: 0.10 }, // 10%
      amount: Number,
    },
    // Review after appointment
    review: {
      rating: { type: Number, min: 1, max: 5 },
      comment: String,
      createdAt: Date,
    },
    // Health record linked
    healthRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HealthRecord',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
AppointmentSchema.index({ user: 1, status: 1, date: -1 });
AppointmentSchema.index({ vet: 1, date: 1, status: 1 });
AppointmentSchema.index({ pet: 1 });

// Calculate commission before save
AppointmentSchema.pre('save', function (next) {
  if (this.fee && this.fee.amount && this.commission) {
    this.commission.amount = Math.round(this.fee.amount * this.commission.rate);
  }
  next();
});

module.exports = mongoose.model('Appointment', AppointmentSchema);
