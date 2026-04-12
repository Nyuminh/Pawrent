const mongoose = require('mongoose');

const HealthRecordSchema = new mongoose.Schema(
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
    recordType: {
      type: String,
      required: [true, 'Vui lòng chọn loại hồ sơ'],
      enum: [
        'vaccination',       // Tiêm phòng
        'deworming',         // Tẩy giun
        'medical_exam',      // Khám bệnh
        'surgery',           // Phẫu thuật
        'treatment',         // Điều trị
        'lab_result',        // Kết quả xét nghiệm
        'weight_check',      // Cân nặng
        'dental',            // Nha khoa
        'other',
      ],
    },
    title: {
      type: String,
      required: [true, 'Vui lòng nhập tiêu đề'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      required: [true, 'Vui lòng nhập ngày'],
      default: Date.now,
    },
    // Vaccination details
    vaccination: {
      vaccineName: String,
      batchNumber: String,
      nextDueDate: Date,
      manufacturer: String,
    },
    // Deworming details
    deworming: {
      medicineName: String,
      dosage: String,
      nextDueDate: Date,
    },
    // Medical exam / Treatment
    medical: {
      diagnosis: String,
      symptoms: [String],
      treatment: String,
      prescriptions: [
        {
          medicineName: String,
          dosage: String,
          frequency: String, // e.g., "2 times/day"
          duration: String,  // e.g., "7 days"
          notes: String,
        },
      ],
    },
    // Weight check
    weightRecord: {
      weight: Number,
      unit: { type: String, default: 'kg' },
    },
    // Vet information
    vet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vet',
    },
    vetName: String,
    clinicName: String,
    // Attachments (images, documents)
    attachments: [
      {
        fileName: String,
        fileUrl: String,
        fileType: String,
      },
    ],
    cost: {
      amount: Number,
      currency: { type: String, default: 'VND' },
    },
    notes: String,
  },
  {
    timestamps: true,
  }
);

// Indexes
HealthRecordSchema.index({ pet: 1, recordType: 1, date: -1 });
HealthRecordSchema.index({ owner: 1 });

module.exports = mongoose.model('HealthRecord', HealthRecordSchema);
