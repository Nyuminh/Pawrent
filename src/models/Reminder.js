const mongoose = require('mongoose');

const ReminderSchema = new mongoose.Schema(
  {
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pet',
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      required: [true, 'Vui lòng chọn loại nhắc nhở'],
      enum: [
        'vaccination',  // Tiêm phòng
        'medicine',     // Uống thuốc
        'deworming',    // Tẩy giun
        'bathing',      // Tắm, vệ sinh
        'walking',      // Dắt đi dạo
        'feeding',      // Cho ăn
        'grooming',     // Cắt tỉa lông
        'vet_visit',    // Khám bác sĩ
        'weight_check', // Kiểm tra cân nặng
        'custom',       // Tùy chỉnh
      ],
    },
    title: {
      type: String,
      required: [true, 'Vui lòng nhập tiêu đề'],
      trim: true,
    },
    description: String,
    // Scheduling
    scheduledDate: {
      type: Date,
      required: [true, 'Vui lòng chọn ngày'],
    },
    scheduledTime: {
      type: String, // HH:mm format
      required: [true, 'Vui lòng chọn giờ'],
    },
    // Recurrence
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurrence: {
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'custom'],
      },
      interval: {
        type: Number, // Every X days/weeks/months
        default: 1,
      },
      endDate: Date,
      daysOfWeek: [Number], // 0=Sun, 1=Mon, ..., 6=Sat
    },
    // Status
    status: {
      type: String,
      enum: ['pending', 'completed', 'missed', 'cancelled', 'snoozed'],
      default: 'pending',
    },
    completedAt: Date,
    // Notification settings
    notification: {
      enabled: { type: Boolean, default: true },
      beforeMinutes: { type: Number, default: 30 }, // remind X min before
      channels: {
        type: [String],
        enum: ['push', 'email', 'sms'],
        default: ['push'],
      },
    },
    // Personalization (premium feature)
    isPersonalized: {
      type: Boolean,
      default: false,
    },
    personalizedReason: String, // e.g., "Based on breed Golden Retriever, age 2 years"
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ReminderSchema.index({ owner: 1, status: 1, scheduledDate: 1 });
ReminderSchema.index({ pet: 1, type: 1 });
ReminderSchema.index({ scheduledDate: 1, status: 1 });

module.exports = mongoose.model('Reminder', ReminderSchema);
