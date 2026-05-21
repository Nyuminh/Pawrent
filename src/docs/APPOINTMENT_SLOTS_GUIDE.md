/**
 * HƯỚNG DẪN SỬ DỤNG HỆ THỐNG ĐẶT LỊCH KHÁM
 * 
 * Hệ thống cung cấp các API để quản lý lịch khám với các tính năng:
 * - Khung giờ làm việc: 08:00 - 12:00 & 14:00 - 19:00 (Thứ 2 - Chủ Nhật)
 * - Mỗi lần khám: 30 phút
 * - Mỗi khung giờ: cho phép 3 slot đặt lịch
 */

// ============================================================
// 1. LẤY DANH SÁCH SLOT CÓ SẴN (Hiển thị trên UI)
// ============================================================

/**
 * API: GET /api/v1/appointments/available-slots
 * 
 * Trường hợp 1: Xem slot có sẵn cho một bác sĩ cụ thể trên một ngày
 * 
 * Request:
 * GET /api/v1/appointments/available-slots?vetId=123&date=2026-05-25
 * 
 * Response:
 * {
 *   "success": true,
 *   "date": "2026-05-25",
 *   "vetId": "123",
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
 *       "available": true,
 *       "booked": 0,
 *       "remainingSlots": 3
 *     },
 *     {
 *       "startTime": "09:00",
 *       "endTime": "09:30",
 *       "available": false,  // Đã đầy (3 slot)
 *       "booked": 3,
 *       "remainingSlots": 0
 *     },
 *     // ... các slot khác
 *   ]
 * }
 */

/**
 * Trường hợp 2: Xem slot có sẵn cho 7 ngày tới cho một bác sĩ
 * 
 * Request:
 * GET /api/v1/appointments/available-slots?vetId=123&days=7
 * 
 * Response:
 * {
 *   "success": true,
 *   "vetId": "123",
 *   "daysRequested": 7,
 *   "maxSlotsPerTime": 3,
 *   "slotDuration": 30,
 *   "slots": {
 *     "2026-05-21": [
 *       { "startTime": "08:00", "endTime": "08:30", "available": true, "booked": 1, "remainingSlots": 2 },
 *       { "startTime": "08:30", "endTime": "09:00", "available": true, "booked": 0, "remainingSlots": 3 },
 *       // ...
 *     ],
 *     "2026-05-22": [
 *       { "startTime": "08:00", "endTime": "08:30", "available": true, "booked": 0, "remainingSlots": 3 },
 *       // ...
 *     ],
 *     // ... các ngày khác
 *   }
 * }
 */

// ============================================================
// 2. ĐẶT LỊCH KHÁM
// ============================================================

/**
 * API: POST /api/v1/appointments
 * Authentication: Bắt buộc (User token)
 * 
 * Request Body:
 * {
 *   "pet": "66a1234567890abcdef12345",      // ID thú cưng của user
 *   "vet": "66b2345678901bcdef23456",       // ID bác sĩ thú y
 *   "appointmentType": "in_person",         // "in_person" hoặc "online"
 *   "date": "2026-05-25",                   // Định dạng: YYYY-MM-DD
 *   "timeSlot": {
 *     "startTime": "09:00",                 // Định dạng: HH:MM
 *     "endTime": "09:30"                    // Định dạng: HH:MM
 *   },
 *   "reason": "Khám tổng quát",             // Lý do khám
 *   "symptoms": ["ho", "sốt"]               // (Optional) Các triệu chứng
 * }
 * 
 * Success Response (201):
 * {
 *   "success": true,
 *   "message": "Đặt lịch khám thành công!",
 *   "data": {
 *     "_id": "66c3456789012cdef34567",
 *     "user": "66a1234567890abcdef12345",
 *     "pet": "66a1234567890abcdef12345",
 *     "vet": "66b2345678901bcdef23456",
 *     "appointmentType": "in_person",
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
 * Error Response (400):
 * {
 *   "success": false,
 *   "message": "Khung giờ 09:00 - 09:30 đã đầy (3/3). Vui lòng chọn khung giờ khác.",
 *   "bookedSlots": 3,
 *   "maxSlots": 3
 * }
 */

// ============================================================
// 3. XEM LỊCH KHÁM CỦA BÁC SĨ (Calendar View)
// ============================================================

/**
 * API: GET /api/v1/appointments/schedule/:vetId
 * Authentication: Bắt buộc (Vet or Admin token)
 * 
 * Request:
 * GET /api/v1/appointments/schedule/66b2345678901bcdef23456?month=5&year=2026
 * 
 * Response:
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
 *       "dayOfWeek": 5,  // 0=Sunday, 1=Monday, etc.
 *       "dayOfWeekName": "Thứ 6",
 *       "slots": {
 *         "08:00": {
 *           "startTime": "08:00",
 *           "endTime": "08:30",
 *           "booked": 2,  // 2/3 slots
 *           "appointments": [
 *             {
 *               "id": "66c1111111111111111111",
 *               "user": "66a1111111111111111111",
 *               "pet": "66a2222222222222222222",
 *               "status": "đã_xác_nhận"
 *             },
 *             {
 *               "id": "66c2222222222222222222",
 *               "user": "66a3333333333333333333",
 *               "pet": "66a4444444444444444444",
 *               "status": "chờ_xác_nhận"
 *             }
 *           ]
 *         },
 *         "08:30": {
 *           "startTime": "08:30",
 *           "endTime": "09:00",
 *           "booked": 3,  // 3/3 slots (FULL)
 *           "appointments": [...]
 *         }
 *       }
 *     },
 *     // ... các ngày khác trong tháng
 *   ]
 * }
 */

// ============================================================
// 4. CẬP NHẬT TRẠNG THÁI LỊCH KHÁM
// ============================================================

/**
 * API: PUT /api/v1/appointments/:id/status
 * Authentication: Bắt buộc
 * 
 * Các trạng thái hợp lệ:
 * - chờ_xác_nhận: Đang chờ bác sĩ xác nhận
 * - đã_xác_nhận: Bác sĩ đã xác nhận
 * - đang_khám: Đang trong quá trình khám
 * - hoàn_thành: Khám xong
 * - đã_hủy: Đã hủy
 * 
 * Request:
 * PUT /api/v1/appointments/66c3456789012cdef34567/status
 * {
 *   "status": "đã_xác_nhận"
 * }
 * 
 * Để hủy lịch:
 * {
 *   "status": "đã_hủy",
 *   "cancellationReason": "Bệnh nhân yêu cầu hủy"
 * }
 */

// ============================================================
// 5. VÍ DỤ CÀI ĐẶT LỄ TẠIREACT COMPONENT
// ============================================================

/*
import React, { useState, useEffect } from 'react';

// Lấy danh sách slot có sẵn
const AppointmentBooking = ({ vetId }) => {
  const [availableSlots, setAvailableSlots] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAvailableSlots();
  }, [vetId]);

  const fetchAvailableSlots = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/appointments/available-slots?vetId=${vetId}&days=7`
      );
      const data = await response.json();
      setAvailableSlots(data.slots);
    } catch (error) {
      console.error('Error fetching slots:', error);
    }
    setLoading(false);
  };

  const handleBookAppointment = async (timeSlot) => {
    try {
      const response = await fetch('/api/v1/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pet: selectedPetId,
          vet: vetId,
          appointmentType: 'in_person',
          date: selectedDate,
          timeSlot: {
            startTime: timeSlot.startTime,
            endTime: timeSlot.endTime
          },
          reason: 'Khám tổng quát',
          symptoms: []
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('Đặt lịch thành công!');
        fetchAvailableSlots(); // Refresh slots
      } else {
        alert(`Lỗi: ${data.message}`);
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
    }
  };

  return (
    <div className="appointment-booking">
      <h2>Đặt lịch khám</h2>
      
      {/* Calendar Grid */}
      <div className="calendar">
        {Object.entries(availableSlots).map(([date, slots]) => (
          <div key={date} className="day-card">
            <h4>{date}</h4>
            <div className="slots-grid">
              {slots.map((slot, idx) => (
                <button
                  key={idx}
                  className={`slot ${!slot.available ? 'full' : ''}`}
                  onClick={() => handleBookAppointment(slot)}
                  disabled={!slot.available}
                >
                  <div>{slot.startTime} - {slot.endTime}</div>
                  <div className="slot-info">
                    {slot.booked}/{slot.remainingSlots + slot.booked}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AppointmentBooking;
*/

// ============================================================
// 6. THÔNG TIN CẤU HÌNH
// ============================================================

/*
Giờ làm việc:
- Sáng: 08:00 - 12:00
- Chiều: 14:00 - 19:00
- Áp dụng: Thứ 2 - Chủ Nhật

Thống kê slot:
- Thời lượng mỗi khám: 30 phút
- Slots cho mỗi khung giờ: 3
- Tổng slots/ngày: 
  * Sáng: 4 khung x 3 slots = 12 slots
  * Chiều: 5 khung x 3 slots = 15 slots
  * Tổng cộng: 27 slots/ngày

Để thay đổi cấu hình, cập nhật file: src/utils/appointmentSlots.js
- WORKING_HOURS: Điều chỉnh giờ làm việc
- SLOT_DURATION: Điều chỉnh thời gian mỗi khám (tính bằng phút)
- MAX_SLOTS_PER_TIME: Điều chỉnh số slot tối đa/khung giờ
- WORKING_DAYS: Điều chỉnh ngày làm việc
*/
