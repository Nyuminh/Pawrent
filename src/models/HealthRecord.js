const mongoose = require('mongoose');

const HealthRecordSchema = new mongoose.Schema(
  {
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pet',
      required: true,
    },
    vet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vet',
      required: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    examinationDate: {
      type: Date,
      required: true,
    },
    weight: {
      type: Number,
      description: 'Cân nặng (kg)',
    },
    temperature: {
      type: Number,
      description: 'Nhiệt độ (°C)',
    },
    generalAssessment: {
      type: String,
      description: 'Đánh giá sức khỏe cơ bản',
      maxlength: [2000, 'Đánh giá không quá 2000 ký tự'],
    },
    consultation: {
      type: String,
      description: 'Tư vấn từ bác sĩ',
      maxlength: [2000, 'Tư vấn không quá 2000 ký tự'],
    },
    images: [
      {
        type: String,
        description: 'URL hình ảnh kết quả khám (X-quang, Siêu âm, v.v)',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('HealthRecord', HealthRecordSchema);
