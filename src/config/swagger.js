const swaggerJsDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PAWRENT API Documentation',
      version: '1.0.0',
      description: 'API documentation cho ứng dụng quản lý sức khỏe thú cưng PAWRENT (PetTech)',
      contact: {
        name: 'PAWRENT Team',
        email: 'support@pawrent.vn',
      },
    },
    servers: [
      {
        url: '{protocol}://{host}:{port}/api/v1',
        description: 'Server hiện tại',
        variables: {
          protocol: {
            enum: ['http', 'https'],
            default: 'http'
          },
          host: {
            default: 'localhost'
          },
          port: {
            default: '5000'
          }
        }
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication API' },
      { name: 'Pets', description: 'Quản lý thiết bị định vị và thú cưng' },
      { name: 'Vets & Appointments', description: 'Hệ thống khám chữa bệnh' },
      { name: 'Health Records & Reminders', description: 'Sổ y tế điện tử' },
      { name: 'Hotels & Bookings', description: 'Đặt phòng khách sạn' },
      { name: 'Chatbot & Premium', description: 'Dịch vụ AI Chatbot và Đăng ký bản Premium' }
    ],
    paths: {
      '/auth/register': { post: { summary: 'Register a new user', tags: ['Auth'], responses: { 201: { description: 'User registered successfully' } } } },
      '/auth/login': { post: { summary: 'Login user', tags: ['Auth'], responses: { 200: { description: 'Login successful' } } } },
      '/pets': {
        get: { summary: 'Xem danh sách thú cưng', tags: ['Pets'], responses: { 200: { description: 'Danh sách pets' } } },
        post: { summary: 'Thêm thú cưng mới', tags: ['Pets'], responses: { 201: { description: 'Đã tạo' } } }
      },
      '/pets/{id}': {
        get: { summary: 'Lấy chi tiết 1 thú cưng', tags: ['Pets'], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Chi tiết thú cưng' } } }
      },
      '/pets/{id}/location': {
        get: { summary: 'Xem định vị thú cưng (GPS)', tags: ['Pets'], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Vị trí an toàn' } } }
      },
      '/vets': { get: { summary: 'Xem danh sách bác sĩ thú y', tags: ['Vets & Appointments'], responses: { 200: { description: 'Thành công' } } } },
      '/appointments': { post: { summary: 'Đặt lịch hẹn khám bệnh', tags: ['Vets & Appointments'], responses: { 201: { description: 'Thành công' } } } },
      '/health-records': {
        get: { summary: 'Lịch sử bệnh án điện tử', tags: ['Health Records & Reminders'], responses: { 200: { description: 'OK' } } },
        post: { summary: 'Cập nhật sổ sức khoẻ', tags: ['Health Records & Reminders'], responses: { 201: { description: 'OK' } } }
      },
      '/reminders': { get: { summary: 'Nhắc nhở chăm sóc định kỳ', tags: ['Health Records & Reminders'], responses: { 200: { description: 'Lấy danh sách thành công' } } } },
      '/hotels': { get: { summary: 'Danh sách Pet Hotel', tags: ['Hotels & Bookings'], responses: { 200: { description: 'Thành công' } } } },
      '/hotel-bookings': { post: { summary: 'Đặt khách sạn cho thú cưng', tags: ['Hotels & Bookings'], responses: { 201: { description: 'Đã book thành công' } } } },
      '/chat': { post: { summary: 'Trò chuyện và phân tích triệu chứng với AI', tags: ['Chatbot & Premium'], responses: { 200: { description: 'Phản hồi AI' } } } },
      '/subscription/plans': { get: { summary: 'Xem bảng giá các gói Premium', tags: ['Chatbot & Premium'], responses: { 200: { description: 'Thành công' } } } }
    }
  },
  apis: [], // Removed file scanning completely
};

const swaggerSpecs = swaggerJsDoc(options);

module.exports = swaggerSpecs;
