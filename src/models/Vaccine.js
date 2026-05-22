const mongoose = require('mongoose');

const VaccineSchema = new mongoose.Schema(
  {
    // Auto-generated vaccine record number
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
    vet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vet',
    },
    vaccineName: {
      type: String,
      required: [true, 'Vui lòng nhập tên vaccine'],
      trim: true,
    },
    vaccineType: {
      type: String,
      enum: [
        'rabies',              // Dại
        'distemper',           // Thương hàn
        'parvovirus',          // Parvovirus
        'feline_leukemia',     // Bạch cầu mèo
        'feline_viral',        // Vi-rút hô hấp mèo
        'leptospirosis',       // Leptospirosis
        'bordetella',          // Bordetella
        'other',
      ],
      required: [true, 'Vui lòng chọn loại vaccine'],
    },
    vaccinationDate: {
      type: Date,
      required: [true, 'Vui lòng chọn ngày tiêm'],
    },
    batchNumber: String,
    manufacturer: String,
    nextDueDate: {
      type: Date,
      required: [true, 'Vui lòng nhập ngày tái tiêm'],
    },
    weight: {
      type: Number,
      description: 'Cân nặng lúc tiêm (kg)',
    },
    temperature: {
      type: Number,
      description: 'Thân nhiệt lúc tiêm (°C)',
    },
    clinicName: String,
    notes: String,
    side_effects: String,
    isCompleted: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: String,
      enum: ['user', 'vet'],
      default: 'user',
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to generate recordNumber
VaccineSchema.pre('save', async function (next) {
  if (!this.recordNumber) {
    const count = await mongoose.model('Vaccine').countDocuments();
    const timestamp = Date.now().toString().slice(-6);
    this.recordNumber = `VAC-${timestamp}-${count + 1}`;
  }
  next();
});

// Indexes
VaccineSchema.index({ pet: 1, vaccinationDate: -1 });
VaccineSchema.index({ owner: 1 });
VaccineSchema.index({ vet: 1 });
VaccineSchema.index({ recordNumber: 1 });

module.exports = mongoose.model('Vaccine', VaccineSchema);
