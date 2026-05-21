/**
 * Appointment Slots Utility
 * Generates available appointment slots based on working hours and slot duration
 */

const WORKING_HOURS = {
  morning: { start: 8, end: 12 }, // 08:00 - 12:00
  afternoon: { start: 14, end: 19 }, // 14:00 - 19:00
};

const SLOT_DURATION = 30; // minutes
const MAX_SLOTS_PER_TIME = 3; // maximum 3 appointments per 30-min slot
const WORKING_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun (0=Sunday)

/**
 * Generate all available time slots for a given date
 * @param {Date} date - The date to generate slots for
 * @returns {Array} Array of time slot objects {startTime: "HH:MM", endTime: "HH:MM"}
 */
function generateDaySlots(date) {
  const slots = [];
  const dayOfWeek = date.getDay();

  // Check if it's a working day (Mon-Sun)
  if (!WORKING_DAYS.includes(dayOfWeek)) {
    return slots;
  }

  // Morning slots (08:00 - 12:00)
  for (let hour = WORKING_HOURS.morning.start; hour < WORKING_HOURS.morning.end; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_DURATION) {
      const startHour = String(hour).padStart(2, '0');
      const startMin = String(minute).padStart(2, '0');
      const endTime = new Date(date);
      endTime.setHours(hour, minute + SLOT_DURATION);

      slots.push({
        startTime: `${startHour}:${startMin}`,
        endTime: `${String(endTime.getHours()).padStart(2, '0')}:${String(
          endTime.getMinutes()
        ).padStart(2, '0')}`,
      });
    }
  }

  // Afternoon slots (14:00 - 19:00)
  for (let hour = WORKING_HOURS.afternoon.start; hour < WORKING_HOURS.afternoon.end; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_DURATION) {
      const startHour = String(hour).padStart(2, '0');
      const startMin = String(minute).padStart(2, '0');
      const endTime = new Date(date);
      endTime.setHours(hour, minute + SLOT_DURATION);

      slots.push({
        startTime: `${startHour}:${startMin}`,
        endTime: `${String(endTime.getHours()).padStart(2, '0')}:${String(
          endTime.getMinutes()
        ).padStart(2, '0')}`,
      });
    }
  }

  return slots;
}

/**
 * Get available slots for a specific date and vet
 * @param {Date} date - The date to check
 * @param {Array} bookedSlots - Array of booked appointment objects with timeSlot
 * @returns {Array} Array of available slots with booking count
 */
function getAvailableSlots(date, bookedSlots = []) {
  const allSlots = generateDaySlots(date);

  return allSlots.map((slot) => {
    // Count how many appointments are booked for this time slot
    const bookedCount = bookedSlots.filter(
      (booked) => booked.timeSlot.startTime === slot.startTime
    ).length;

    return {
      ...slot,
      available: bookedCount < MAX_SLOTS_PER_TIME,
      booked: bookedCount,
      remainingSlots: MAX_SLOTS_PER_TIME - bookedCount,
    };
  });
}

/**
 * Check if a time slot is available (has less than MAX_SLOTS_PER_TIME bookings)
 * @param {String} startTime - Slot start time in HH:MM format
 * @param {Number} bookedCount - Number of already booked slots
 * @returns {Boolean}
 */
function isSlotAvailable(startTime, bookedCount = 0) {
  return bookedCount < MAX_SLOTS_PER_TIME;
}

/**
 * Get slots for next N days (for UI calendar)
 * @param {Number} days - Number of days to generate slots for
 * @returns {Object} Object with dates as keys and slot arrays as values
 */
function generateMultipleDaysSlots(days = 7) {
  const slotsMap = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

    slotsMap[dateStr] = generateDaySlots(date);
  }

  return slotsMap;
}

/**
 * Format time slot for display
 * @param {String} startTime - Start time in HH:MM format
 * @param {String} endTime - End time in HH:MM format
 * @returns {String} Formatted time string "HH:MM - HH:MM"
 */
function formatTimeSlot(startTime, endTime) {
  return `${startTime} - ${endTime}`;
}

/**
 * Check if date is in the past
 * @param {Date} date - Date to check
 * @returns {Boolean}
 */
function isPastDate(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  return checkDate < today;
}

module.exports = {
  generateDaySlots,
  getAvailableSlots,
  isSlotAvailable,
  generateMultipleDaysSlots,
  formatTimeSlot,
  isPastDate,
  SLOT_DURATION,
  MAX_SLOTS_PER_TIME,
  WORKING_HOURS,
};
