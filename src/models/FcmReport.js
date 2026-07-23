const mongoose = require('mongoose');

const FcmReportSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
        unique: true, // Format: YYYY-MM-DD
    },
    sends: {
        type: Number,
        default: 0
    },
    received: {
        type: Number,
        default: 0
    },
    impressions: {
        type: Number,
        default: 0
    },
    openCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('FcmReport', FcmReportSchema);
