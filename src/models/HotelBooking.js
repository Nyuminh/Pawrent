const mongoose = require('mongoose');

const HotelBookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PetHotel',
      required: true,
    },
    roomType: {
      type: String,
      enum: ['standard', 'deluxe', 'vip', 'suite'],
      required: [true, 'Vui lòng chọn loại phòng'],
    },
    checkIn: {
      type: Date,
      required: [true, 'Vui lòng chọn ngày check-in'],
    },
    checkOut: {
      type: Date,
      required: [true, 'Vui lòng chọn ngày check-out'],
    },
    // Additional services booked
    additionalServices: [
      {
        serviceId: mongoose.Schema.Types.ObjectId,
        serviceName: String,
        price: Number,
        quantity: { type: Number, default: 1 },
      },
    ],
    specialRequests: String,
    // Pricing
    pricing: {
      nightlyRate: Number,
      numberOfNights: Number,
      roomTotal: Number,
      servicesTotal: Number,
      subtotal: Number,
      commission: {
        rate: Number,
        amount: Number,
      },
      total: Number,
      currency: { type: String, default: 'VND' },
    },
    // Payment
    payment: {
      method: {
        type: String,
        enum: ['cash', 'bank_transfer', 'credit_card', 'e_wallet', 'momo', 'zalopay'],
      },
      status: {
        type: String,
        enum: ['pending', 'paid', 'refunded', 'failed'],
        default: 'pending',
      },
      transactionId: String,
      paidAt: Date,
    },
    status: {
      type: String,
      enum: [
        'pending',     // Chờ xác nhận
        'confirmed',   // Đã xác nhận
        'checked_in',  // Đã check-in
        'checked_out', // Đã check-out
        'cancelled',   // Đã hủy
        'no_show',     // Không đến
      ],
      default: 'pending',
    },
    cancellation: {
      cancelledBy: String,
      reason: String,
      cancelledAt: Date,
      refundAmount: Number,
    },
    // Review
    review: {
      rating: { type: Number, min: 1, max: 5 },
      comment: String,
      createdAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Calculate pricing before save
HotelBookingSchema.pre('save', function (next) {
  if (this.checkIn && this.checkOut && this.pricing) {
    const nights = Math.ceil(
      (new Date(this.checkOut) - new Date(this.checkIn)) / (1000 * 60 * 60 * 24)
    );
    this.pricing.numberOfNights = nights;
    this.pricing.roomTotal = (this.pricing.nightlyRate || 0) * nights;

    let servicesTotal = 0;
    if (this.additionalServices && this.additionalServices.length > 0) {
      servicesTotal = this.additionalServices.reduce(
        (sum, s) => sum + (s.price || 0) * (s.quantity || 1),
        0
      );
    }
    this.pricing.servicesTotal = servicesTotal;
    this.pricing.subtotal = this.pricing.roomTotal + servicesTotal;

    if (this.pricing.commission && this.pricing.commission.rate) {
      this.pricing.commission.amount = Math.round(
        this.pricing.subtotal * this.pricing.commission.rate
      );
    }
    this.pricing.total = this.pricing.subtotal;
  }
  next();
});

// Indexes
HotelBookingSchema.index({ user: 1, status: 1 });
HotelBookingSchema.index({ hotel: 1, status: 1, checkIn: 1 });
HotelBookingSchema.index({ pet: 1 });

module.exports = mongoose.model('HotelBooking', HotelBookingSchema);
