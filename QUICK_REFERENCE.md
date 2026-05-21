/**
 * 🚀 QUICK REFERENCE - HỆ THỐNG ĐẶT LỊCH KHÁM
 */

// ╔══════════════════════════════════════════════════════════╗
// ║              GIỜ LÀM VIỆC & CẤU HÌNH                   ║
// ╚══════════════════════════════════════════════════════════╝

Giờ làm việc:
  🕐 Sáng:  08:00 - 12:00 (4 giờ)
  🕐 Chiều: 14:00 - 19:00 (5 giờ)
  📅 Ngày: Thứ 2 - Chủ Nhật

Mỗi lịch hẹn:
  ⏱️  30 phút/lần
  📊 3 slots/khung giờ

Tính toán:
  👥 Tổng slots/ngày: 54 (24 sáng + 30 chiều)


// ╔══════════════════════════════════════════════════════════╗
// ║                      API ENDPOINTS                      ║
// ╚══════════════════════════════════════════════════════════╝

1️⃣  GET /api/v1/appointments/available-slots
    🔓 Public | 📊 Xem slot trống
    
    Parameters:
      vetId:  ID bác sĩ (bắt buộc để xem slot đã book)
      date:   YYYY-MM-DD (nếu không → xem N ngày)
      days:   7 (default, max 30)
    
    Example:
      ?vetId=123&date=2026-05-25
      ?vetId=123&days=7
    
    Response:
    {
      "success": true,
      "slots": {
        "08:00": {
          "available": true,
          "booked": 1,
          "remainingSlots": 2
        }
      }
    }

───────────────────────────────────────────────────────────

2️⃣  GET /api/v1/appointments/schedule/:vetId
    🔒 Protected | 📅 Xem lịch khám tháng
    
    Parameters:
      vetId: ID bác sĩ (in URL)
      month: 1-12 (optional)
      year:  YYYY (optional)
    
    Example:
      /schedule/123?month=5&year=2026
    
    Response:
    {
      "success": true,
      "vet": {name, email},
      "calendar": [
        {
          "date": "2026-05-01",
          "slots": {"08:00": {booked: 2}}
        }
      ]
    }

───────────────────────────────────────────────────────────

3️⃣  POST /api/v1/appointments
    🔒 Protected | 📝 Đặt lịch khám
    
    Request Body:
    {
      "pet": "ID_thú_cưng",
      "vet": "ID_bác_sĩ",
      "appointmentType": "in_person" | "online",
      "date": "2026-05-25",
      "timeSlot": {
        "startTime": "09:00",
        "endTime": "09:30"
      },
      "reason": "Lý do khám",
      "symptoms": ["ho", "sốt"]
    }
    
    Success: 201
    {
      "success": true,
      "message": "Đặt lịch khám thành công!",
      "data": {appointment}
    }
    
    Error: 400
    {
      "success": false,
      "message": "Khung giờ đã đầy (3/3)",
      "bookedSlots": 3,
      "maxSlots": 3
    }


// ╔══════════════════════════════════════════════════════════╗
// ║                    RESPONSE FIELDS                      ║
// ╚══════════════════════════════════════════════════════════╝

Slot Object:
  startTime:      "HH:MM"              (Giờ bắt đầu)
  endTime:        "HH:MM"              (Giờ kết thúc)
  available:      true|false           (Còn slot không?)
  booked:         0-3                  (Số người đã book)
  remainingSlots: 0-3                  (Số slot còn lại)

Appointment Object:
  _id:            String               (ID lịch hẹn)
  user:           ObjectId             (User)
  pet:            ObjectId             (Thú cưng)
  vet:            ObjectId             (Bác sĩ)
  date:           ISO Date             (Ngày)
  timeSlot:       {startTime, endTime} (Giờ)
  reason:         String               (Lý do)
  status:         String               (Trạng thái)
  fee:            {amount, currency}   (Phí khám)


// ╔══════════════════════════════════════════════════════════╗
// ║                  APPOINTMENT STATUS                     ║
// ╚══════════════════════════════════════════════════════════╝

chờ_xác_nhận    ➜ Chờ bác sĩ xác nhận
đã_xác_nhận     ➜ Bác sĩ đã xác nhận
đang_khám       ➜ Đang trong quá trình khám
hoàn_thành      ➜ Khám xong
đã_hủy          ➜ Đã hủy
không_đến       ➜ Không đến


// ╔══════════════════════════════════════════════════════════╗
// ║                   COMMON ERRORS                         ║
// ╚══════════════════════════════════════════════════════════╝

❌ 400: "Khung giờ này đã đầy (3/3)"
   → Slot đầy, chọn khung khác

❌ 400: "Không thể đặt lịch cho ngày trong quá khứ"
   → Date phải >= ngày hôm nay

❌ 404: "Không tìm thấy thú cưng"
   → Pet không tồn tại hoặc không thuộc user

❌ 404: "Không tìm thấy bác sĩ thú y"
   → Vet không tồn tại hoặc không có role vet

❌ 401: "Unauthorized"
   → Token hết hạn hoặc không hợp lệ


// ╔══════════════════════════════════════════════════════════╗
// ║                     cURL EXAMPLES                       ║
// ╚══════════════════════════════════════════════════════════╝

🔍 Xem slot trống (1 ngày):
curl "http://localhost:3000/api/v1/appointments/available-slots?vetId=123&date=2026-05-25"

🔍 Xem slot trống (7 ngày):
curl "http://localhost:3000/api/v1/appointments/available-slots?vetId=123&days=7"

📅 Xem lịch tháng:
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/v1/appointments/schedule/123?month=5&year=2026"

📝 Đặt lịch khám:
curl -X POST "http://localhost:3000/api/v1/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "pet": "123",
    "vet": "456",
    "appointmentType": "in_person",
    "date": "2026-05-25",
    "timeSlot": {"startTime": "09:00", "endTime": "09:30"},
    "reason": "Khám tổng quát"
  }'


// ╔══════════════════════════════════════════════════════════╗
// ║                  CONFIGURATION                          ║
// ╚══════════════════════════════════════════════════════════╝

File cấu hình: src/utils/appointmentSlots.js

WORKING_HOURS = {
  morning:   {start: 8,  end: 12},  // 08:00-12:00
  afternoon: {start: 14, end: 19}   // 14:00-19:00
}

SLOT_DURATION = 30          // phút
MAX_SLOTS_PER_TIME = 3      // max appointments/slot
WORKING_DAYS = [1-6, 0]     // Mon-Sun


// ╔══════════════════════════════════════════════════════════╗
// ║                  FRONTEND INTEGRATION                   ║
// ╚══════════════════════════════════════════════════════════╝

1. Lấy danh sách slot:
   fetch('/api/v1/appointments/available-slots?vetId=ID&days=7')

2. Hiển thị calendar grid

3. User chọn slot (available: true)

4. POST /api/v1/appointments với slot đã chọn

5. Show success/error message

📌 Template HTML: src/templates/appointment-booking.html


// ╔══════════════════════════════════════════════════════════╗
// ║                  BOOKING FLOW                          ║
// ╚══════════════════════════════════════════════════════════╝

User Journey:
  1. Chọn bác sĩ
       ⬇
  2. Xem danh sách slot (GET /available-slots)
       ⬇
  3. Chọn ngày + giờ
       ⬇
  4. Chọn thú cưng
       ⬇
  5. Nhập lý do khám
       ⬇
  6. Đặt lịch (POST /appointments)
       ⬇
  7. Confirm thành công


// ╔══════════════════════════════════════════════════════════╗
// ║                  DOCUMENTATION FILES                    ║
// ╚══════════════════════════════════════════════════════════╝

📚 Chi tiết: src/docs/APPOINTMENT_SLOTS_GUIDE.md
🧪 Test:     src/docs/API_TESTING_GUIDE.md
📄 Changes:  APPOINTMENT_SYSTEM_CHANGES.md (root)
🎨 Template: src/templates/appointment-booking.html


// ╔══════════════════════════════════════════════════════════╗
// ║                  KEY FUNCTIONS                          ║
// ╚══════════════════════════════════════════════════════════╝

generateDaySlots(date)
  → Tạo tất cả slots cho 1 ngày

getAvailableSlots(date, bookedSlots)
  → Lấy danh sách slot + thông tin availability

isSlotAvailable(startTime, bookedCount)
  → Kiểm tra slot còn trống?

generateMultipleDaysSlots(days)
  → Tạo slots cho N ngày

formatTimeSlot(startTime, endTime)
  → Format thời gian: "HH:MM - HH:MM"

isPastDate(date)
  → Kiểm tra ngày quá khứ?


✅ Tất cả chức năng sẵn sàng sử dụng!
📖 Xem chi tiết trong các file documentation
