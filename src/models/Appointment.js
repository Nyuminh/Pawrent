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
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
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

module.exports = mongoose.model('Appointment', AppointmentSchema);
