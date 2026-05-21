/**
 * HƯỚNG DẪN TEST API ĐẶT LỊCH KHÁM
 * 
 * Sử dụng cURL, Postman hoặc bất kỳ HTTP Client nào
 */

// ============================================================
// 1. TEST GET AVAILABLE SLOTS CHO MỘT NGÀY CỤ THỂ
// ============================================================

/**
 * URL: http://localhost:3000/api/v1/appointments/available-slots
 * Method: GET
 * Parameters:
 *   - vetId: ID của bác sĩ (bắt buộc để xem số slot còn trống)
 *   - date: Ngày cần xem (định dạng: YYYY-MM-DD)
 * 
 * cURL Command:
 */
curl "http://localhost:3000/api/v1/appointments/available-slots?vetId=66b2345678901bcdef23456&date=2026-05-25"

/**
 * Response Example:
 * {
 *   "success": true,
 *   "date": "2026-05-25",
 *   "vetId": "66b2345678901bcdef23456",
 *   "booked": 2,
 *   "slots": [
 *     {
 *       "startTime": "08:00",
 *       "endTime": "08:30",
 *       "available": true,
 *       "booked": 1,
 *       "remainingSlots": 2
 *     },
 *     {
 *       "startTime": "08:30",
 *       "endTime": "09:00",
 *       "available": false,
 *       "booked": 3,
 *       "remainingSlots": 0
 *     },
 *     ...
 *   ]
 * }
 */

// ============================================================
// 2. TEST GET AVAILABLE SLOTS CHO 7 NGÀY TỚI
// ============================================================

/**
 * cURL Command:
 */
curl "http://localhost:3000/api/v1/appointments/available-slots?vetId=66b2345678901bcdef23456&days=7"

/**
 * Response Example:
 * {
 *   "success": true,
 *   "vetId": "66b2345678901bcdef23456",
 *   "daysRequested": 7,
 *   "maxSlotsPerTime": 3,
 *   "slotDuration": 30,
 *   "slots": {
 *     "2026-05-21": [
 *       { "startTime": "08:00", "endTime": "08:30", "available": true, "booked": 0, "remainingSlots": 3 },
 *       { "startTime": "08:30", "endTime": "09:00", "available": true, "booked": 1, "remainingSlots": 2 },
 *       ...
 *     ],
 *     "2026-05-22": [...],
 *     ...
 *   }
 * }
 */

// ============================================================
// 3. TEST ĐẶT LỊCH KHÁM
// ============================================================

/**
 * URL: http://localhost:3000/api/v1/appointments
 * Method: POST
 * Headers:
 *   - Content-Type: application/json
 *   - Authorization: Bearer <user_token>
 * 
 * cURL Command:
 */
curl -X POST "http://localhost:3000/api/v1/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "pet": "66a1234567890abcdef12345",
    "vet": "66b2345678901bcdef23456",
    "appointmentType": "in_person",
    "date": "2026-05-25",
    "timeSlot": {
      "startTime": "09:00",
      "endTime": "09:30"
    },
    "reason": "Khám tổng quát",
    "symptoms": ["ho", "sốt"]
  }'

/**
 * Success Response (201):
 * {
 *   "success": true,
 *   "message": "Đặt lịch khám thành công!",
 *   "data": {
 *     "_id": "66c3456789012cdef34567",
 *     "user": "66a1234567890abcdef12345",
 *     "pet": "66a1234567890abcdef12345",
 *     "vet": "66b2345678901bcdef23456",
 *     "date": "2026-05-25T00:00:00.000Z",
 *     "timeSlot": {
 *       "startTime": "09:00",
 *       "endTime": "09:30"
 *     },
 *     "reason": "Khám tổng quát",
 *     "status": "chờ_xác_nhận",
 *     "fee": {
 *       "amount": 300000,
 *       "currency": "VND"
 *     }
 *   }
 * }
 * 
 * Error Response (400) - Slot đầy:
 * {
 *   "success": false,
 *   "message": "Khung giờ 09:00 - 09:30 đã đầy (3/3). Vui lòng chọn khung giờ khác.",
 *   "bookedSlots": 3,
 *   "maxSlots": 3
 * }
 */

// ============================================================
// 4. TEST XEM LỊCH KHÁM CỦA BÁC SĨ (CALENDAR VIEW)
// ============================================================

/**
 * URL: http://localhost:3000/api/v1/appointments/schedule/:vetId
 * Method: GET
 * Headers:
 *   - Authorization: Bearer <token>
 * Parameters (optional):
 *   - month: Số tháng (1-12)
 *   - year: Năm
 * 
 * cURL Command:
 */
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  "http://localhost:3000/api/v1/appointments/schedule/66b2345678901bcdef23456?month=5&year=2026"

/**
 * Response Example:
 * {
 *   "success": true,
 *   "vet": {
 *     "id": "66b2345678901bcdef23456",
 *     "name": "Dr. Nguyễn Văn A",
 *     "email": "doctor@clinic.com"
 *   },
 *   "month": 5,
 *   "year": 2026,
 *   "totalAppointments": 45,
 *   "calendar": [
 *     {
 *       "date": "2026-05-01",
 *       "dayOfWeek": 5,
 *       "dayOfWeekName": "Thứ 6",
 *       "slots": {
 *         "08:00": {
 *           "startTime": "08:00",
 *           "endTime": "08:30",
 *           "booked": 2,
 *           "appointments": [...]
 *         }
 *       }
 *     }
 *   ]
 * }
 */

// ============================================================
// 5. TEST POSTMAN COLLECTION
// ============================================================

/**
 * Tạo Postman Collection với các requests:
 */

{
  "info": {
    "name": "Appointment Booking API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Available Slots (Single Day)",
      "request": {
        "method": "GET",
        "url": {
          "raw": "{{base_url}}/api/v1/appointments/available-slots?vetId={{vet_id}}&date=2026-05-25",
          "host": ["{{base_url}}"],
          "path": ["api", "v1", "appointments", "available-slots"],
          "query": [
            { "key": "vetId", "value": "{{vet_id}}" },
            { "key": "date", "value": "2026-05-25" }
          ]
        }
      }
    },
    {
      "name": "Get Available Slots (7 Days)",
      "request": {
        "method": "GET",
        "url": {
          "raw": "{{base_url}}/api/v1/appointments/available-slots?vetId={{vet_id}}&days=7",
          "host": ["{{base_url}}"],
          "path": ["api", "v1", "appointments", "available-slots"],
          "query": [
            { "key": "vetId", "value": "{{vet_id}}" },
            { "key": "days", "value": "7" }
          ]
        }
      }
    },
    {
      "name": "Book Appointment",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "Authorization",
            "value": "Bearer {{user_token}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"pet\": \"{{pet_id}}\",\n  \"vet\": \"{{vet_id}}\",\n  \"appointmentType\": \"in_person\",\n  \"date\": \"2026-05-25\",\n  \"timeSlot\": {\n    \"startTime\": \"09:00\",\n    \"endTime\": \"09:30\"\n  },\n  \"reason\": \"Khám tổng quát\",\n  \"symptoms\": []\n}"
        },
        "url": {
          "raw": "{{base_url}}/api/v1/appointments",
          "host": ["{{base_url}}"],
          "path": ["api", "v1", "appointments"]
        }
      }
    },
    {
      "name": "Get Vet Schedule",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{admin_token}}"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/v1/appointments/schedule/{{vet_id}}?month=5&year=2026",
          "host": ["{{base_url}}"],
          "path": ["api", "v1", "appointments", "schedule", "{{vet_id}}"],
          "query": [
            { "key": "month", "value": "5" },
            { "key": "year", "value": "2026" }
          ]
        }
      }
    }
  ]
}

// ============================================================
// 6. TESTING SCENARIOS
// ============================================================

/**
 * Scenario 1: Đặt lịch khám thành công
 * 1. Gọi GET /available-slots để xem slot trống
 * 2. Chọn slot có available: true
 * 3. Gọi POST /appointments để đặt lịch
 * ✅ Expected: Status 201, "Đặt lịch khám thành công!"
 */

/**
 * Scenario 2: Slot đã đầy (3/3)
 * 1. Gọi GET /available-slots để xem slot
 * 2. Chọn slot có available: false
 * 3. Gọi POST /appointments với slot đầy
 * ❌ Expected: Status 400, "Khung giờ này đã đầy"
 */

/**
 * Scenario 3: Đặt lịch cho ngày quá khứ
 * 1. Gọi POST /appointments với date trong quá khứ
 * ❌ Expected: Status 400, "Không thể đặt lịch cho ngày trong quá khứ"
 */

/**
 * Scenario 4: Xem lịch khám của bác sĩ
 * 1. Gọi GET /schedule/:vetId?month=5&year=2026
 * ✅ Expected: Status 200, Calendar view với tất cả lịch hẹn
 */

/**
 * Scenario 5: Múltiple bookings cùng slot (tối đa 3)
 * 1. Đặt lịch slot 1 - User 1 ✅
 * 2. Đặt lịch slot 1 - User 2 ✅
 * 3. Đặt lịch slot 1 - User 3 ✅
 * 4. Đặt lịch slot 1 - User 4 ❌ "Slot đã đầy"
 */

// ============================================================
// 7. ENVIRONMENT VARIABLES FOR POSTMAN
// ============================================================

/**
 * Thiết lập Environment Variables trong Postman:
 * 
 * base_url: http://localhost:3000
 * vet_id: 66b2345678901bcdef23456 (ID của bác sĩ)
 * pet_id: 66a1234567890abcdef12345 (ID của thú cưng)
 * user_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (User JWT token)
 * admin_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (Admin JWT token)
 */

// ============================================================
// 8. DEBUGGING TIPS
// ============================================================

/**
 * Nếu nhận được lỗi:
 * 
 * 1. "Cannot GET /api/v1/appointments/available-slots"
 *    → Kiểm tra routes có load appointmentRoutes chưa
 *    → Kiểm tra trong server.js: app.use('/api/v1/appointments', appointmentRoutes);
 * 
 * 2. "appointmentSlots is not defined"
 *    → Kiểm tra import: const appointmentSlots = require('../utils/appointmentSlots');
 * 
 * 3. "Invalid time format"
 *    → Đảm bảo timeSlot có cả startTime và endTime
 *    → Format: "HH:MM" (24-hour)
 * 
 * 4. "Khung giờ ngoài thời gian làm việc"
 *    → Kiểm tra slot có nằm trong giờ làm việc không
 *    → Sáng: 08:00-12:00, Chiều: 14:00-19:00
 * 
 * 5. Slot không hiển thị trong getAvailableSlots
 *    → Kiểm tra ngày là Thứ 2-Chủ Nhật chưa (WORKING_DAYS)
 *    → Kiểm tra ngày không phải quá khứ
 */
