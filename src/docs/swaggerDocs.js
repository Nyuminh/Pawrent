/**
 * @swagger
 * tags:
 *   - name: Pets
 *     description: Quản lý thú cưng
 *   - name: Vets & Appointments
 *     description: Hệ thống khám chữa bệnh
 *   - name: Health Records
 *     description: Sổ y tế - Hồ sơ khám chữa bệnh
 *   - name: Vaccines
 *     description: Quản lý hồ sơ tiêm phòng (tách riêng)
 *   - name: Hotels & Bookings
 *     description: Đặt phòng khách sạn
 *   - name: Products
 *     description: Bán và quản lý sản phẩm cho thú cưng
 *   - name: Chatbot & Premium
 *     description: Dịch vụ AI Chatbot và Đăng ký bản Premium
 *   - name: Admin
 *     description: Quản lý hệ thống (yêu cầu role admin)
 * 
 * paths:
 *   /pets:
 *     get:
 *       summary: Xem danh sách thú cưng
 *       tags: [Pets]
 *       responses:
 *         200:
 *           description: Danh sách pets
 *     post:
 *       summary: Thêm thú cưng mới
 *       tags: [Pets]
 *       responses:
 *         201:
 *           description: Đã tạo
 *   /pets/{id}:
 *     get:
 *       summary: Lấy chi tiết 1 thú cưng
 *       tags: [Pets]
 *       parameters:
 *         - in: path
 *           name: id
 *           required: true
 *           schema:
 *             type: string
 *       responses:
 *         200:
 *           description: Chi tiết thú cưng
 *   /auth/vets:
 *     get:
 *       summary: Xem danh sách bác sĩ thú y
 *       tags: [Vets & Appointments]
 *       responses:
 *         200:
 *           description: Thành công
 *   /appointments:
 *     post:
 *       summary: Đặt lịch hẹn khám bệnh
 *       tags: [Vets & Appointments]
 *       responses:
 *         201:
 *           description: Thành công
 *   /health-records:
 *     get:
 *       summary: Lịch sử bệnh án điện tử
 *       tags: [Health Records]
 *       responses:
 *         200:
 *           description: OK
 *     post:
 *       summary: Tạo hồ sơ sức khỏe (khám chữa bệnh)
 *       tags: [Health Records]
 *       responses:
 *         201:
 *           description: OK
 *   /vaccines:
 *     get:
 *       summary: Danh sách hồ sơ tiêm phòng
 *       tags: [Vaccines]
 *       responses:
 *         200:
 *           description: OK
 *     post:
 *       summary: Tạo hồ sơ tiêm phòng (hỗ trợ mảng)
 *       tags: [Vaccines]
 *       responses:
 *         201:
 *           description: OK
 *   /vaccines/all:
 *     get:
 *       summary: Lấy tất cả vaccine (Vet only)
 *       tags: [Vaccines]
 *       responses:
 *         200:
 *           description: OK
 *   /vaccines/pet/{petId}:
 *     get:
 *       summary: Vaccine của thú cưng
 *       tags: [Vaccines]
 *       parameters:
 *         - in: path
 *           name: petId
 *           required: true
 *           schema:
 *             type: string
 *       responses:
 *         200:
 *           description: OK
 *   /reminders:
 *     get:
 *       summary: Nhắc nhở chăm sóc định kỳ
 *       tags: [Health Records]
 *       responses:
 *         200:
 *           description: Lấy danh sách thành công
 *   /hotels:
 *     get:
 *       summary: Danh sách Pet Hotel
 *       tags: [Hotels & Bookings]
 *       responses:
 *         200:
 *           description: Thành công
 *   /hotel-bookings:
 *     post:
 *       summary: Đặt khách sạn cho thú cưng
 *       tags: [Hotels & Bookings]
 *       responses:
 *         201:
 *           description: Đã book thành công
 *   /chat:
 *     post:
 *       summary: Trò chuyện và phân tích triệu chứng với AI
 *       tags: [Chatbot & Premium]
 *       responses:
 *         200:
 *           description: Phản hồi AI
 *   /subscription/plans:
 *     get:
 *       summary: Xem bảng giá các gói Premium
 *       tags: [Chatbot & Premium]
 *       responses:
 *         200:
 *           description: Thành công
 */
