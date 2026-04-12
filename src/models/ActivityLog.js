const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema(
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
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // Location tracking
    locations: [
      {
        lat: Number,
        lng: Number,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    // Activity summary
    activity: {
      totalDistance: { type: Number, default: 0 }, // meters
      totalSteps: { type: Number, default: 0 },
      activeMinutes: { type: Number, default: 0 },
      restMinutes: { type: Number, default: 0 },
      caloriesBurned: { type: Number, default: 0 },
    },
    // Anomaly detection
    anomaly: {
      isDetected: { type: Boolean, default: false },
      type: {
        type: String,
        enum: ['low_activity', 'excessive_activity', 'unusual_location', 'none'],
        default: 'none',
      },
      description: String,
      alertSent: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ActivityLogSchema.index({ pet: 1, date: -1 });
ActivityLogSchema.index({ owner: 1, date: -1 });

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
