const mongoose = require('mongoose');

const VaccinationSchema = new mongoose.Schema(
  {
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pet',
      required: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
    },
    vaccineName: {
      type: String,
      required: [true, 'Vui lòng nhập tên vắc-xin'],
      trim: true,
    },
    dateAdministered: {
      type: Date,
      required: [true, 'Vui lòng nhập ngày tiêm'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Vaccination', VaccinationSchema);
