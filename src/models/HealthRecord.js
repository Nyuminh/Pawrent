const mongoose = require('mongoose');

const HealthRecordSchema = new mongoose.Schema(
  {
    // Auto-generated medical record number
    recordNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pet',
      required: [true, 'Vui lòng chọn thú cưng'],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    serviceType: {
      type: String,
      enum: [
        'general_exam',       // Khám tổng quát
        'vaccination',        // Tiêm phòng
        'deworming',         // Tẩy giun
        'surgery',           // Phẫu thuật
        'treatment',         // Điều trị
        'lab_result',        // Kết quả xét nghiệm
        'dental',            // Nha khoa
        'other',
      ],
      required: [true, 'Vui lòng chọn loại dịch vụ'],
    },
    examinationDate: {
      type: Date,
      required: [true, 'Vui lòng chọn ngày khám'],
    },
    weight: {
      type: Number,
      description: 'Cân nặng (kg)',
    },
    temperature: {
      type: Number,
      description: 'Thân nhiệt (°C)',
    },
    diagnosis: {
      type: String,
      required: [true, 'Vui lòng nhập chẩn đoán'],
      trim: true,
    },
    treatment: {
      type: String,
      required: [true, 'Vui lòng mô tả phương pháp điều trị'],
      trim: true,
    },
    prescription: {
      type: String,
      description: 'Liệt kê thuốc, liều lượng, cách dùng',
      trim: true,
    },
    nextCheckupDate: {
      type: Date,
      description: 'Ngày tái khám',
    },
    vet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vet',
      required: [true, 'Vui lòng chọn bác sĩ điều trị'],
    },
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
    notes: {
      type: String,
      trim: true,
      description: 'Ghi chú thêm',
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to generate recordNumber
HealthRecordSchema.pre('save', async function (next) {
  if (!this.recordNumber) {
    const count = await mongoose.model('HealthRecord').countDocuments();
    const timestamp = Date.now().toString().slice(-6);
    this.recordNumber = `HRD-${timestamp}-${count + 1}`;
  }
  next();
});

// Indexes
HealthRecordSchema.index({ pet: 1, examinationDate: -1 });
HealthRecordSchema.index({ owner: 1 });
HealthRecordSchema.index({ vet: 1 });
HealthRecordSchema.index({ recordNumber: 1 });

module.exports = mongoose.model('HealthRecord', HealthRecordSchema);
