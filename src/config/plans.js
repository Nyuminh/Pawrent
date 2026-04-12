// Subscription plan definitions
module.exports = {
  FREE: {
    name: 'Free',
    maxPets: 1,
    features: [
      'basic_reminders',
      'basic_health_record',
    ],
    price: 0,
    durationMonths: null, // unlimited
  },
  PREMIUM: {
    name: 'Premium',
    maxPets: 1,
    features: [
      'unlimited_reminders',
      'full_health_record',
      'ai_chatbot',
      'personalized_care',
      'vet_booking_priority',
      'weekly_monthly_reports',
      'long_term_history',
      'partner_vouchers',
      'smart_alerts',
      'activity_history_6months',
      'health_charts',
    ],
    pricePerYear: 499000, // VND
    additionalPetMultiplier: 1.5, // 150% for 2nd pet
    durationMonths: 12,
  },
};
