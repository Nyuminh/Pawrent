const mongoose = require('mongoose');

const PetSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Vui lòng nhập tên thú cưng'],
      trim: true,
      maxlength: [50, 'Tên thú cưng không quá 50 ký tự'],
    },
    species: {
      type: String,
      required: [true, 'Vui lòng chọn loại thú cưng'],
      enum: ['dog', 'cat', 'bird', 'hamster', 'rabbit', 'fish', 'other'],
    },
    breed: {
      type: String,
      trim: true,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'unknown'],
      default: 'unknown',
    },
    age: {
      type: Number,
      description: 'Tuổi (năm)',
      min: [0, 'Tuổi phải lớn hơn 0'],
    },
    weight: {
      type: Number,
      min: [0, 'Cân nặng phải lớn hơn 0'],
    },
    color: String,
    avatar: {
      type: String,
      default: 'default-pet.png',
    },
    microchipId: {
      type: String,
      sparse: true,
    },
    isNeutered: {
      type: Boolean,
      default: false,
    },
    allergies: [String],
    specialNotes: String,
    healthStatus: {
      type: String,
      enum: ['healthy', 'sick', 'recovering', 'chronic'],
      default: 'healthy',
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

// Virtual: Age calculation
PetSchema.virtual('ageDisplay').get(function () {
  return this.age ? `${this.age} tuổi` : 'Chưa xác định';
});

// Virtual: Health records
PetSchema.virtual('healthRecords', {
  ref: 'HealthRecord',
  localField: '_id',
  foreignField: 'pet',
  justOne: false,
});

// Virtual: Reminders
PetSchema.virtual('reminders', {
  ref: 'Reminder',
  localField: '_id',
  foreignField: 'pet',
  justOne: false,
});

// Index for search
PetSchema.index({ owner: 1, isActive: 1 });
PetSchema.index({ species: 1, breed: 1 });

module.exports = mongoose.model('Pet', PetSchema);
