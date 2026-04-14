require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Connect to database
connectDB();

const app = express();

// ==================== SECURITY MIDDLEWARE ====================

// Helmet - secure HTTP headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: function (origin, callback) {
      callback(null, origin || '*');
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
  },
});
app.use('/api/', limiter);

// Auth-specific rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Quá nhiều lần đăng nhập. Vui lòng thử lại sau 15 phút.',
  },
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);

// ==================== BODY PARSING ====================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize data against NoSQL injection
app.use(mongoSanitize());

// Logging (dev only)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Static files
app.use('/uploads', express.static('uploads'));

// ==================== ROUTES ====================

app.use('/api/v1/auth', require('./routes/authRoutes'));
app.use('/api/v1/pets', require('./routes/petRoutes'));
app.use('/api/v1/health-records', require('./routes/healthRecordRoutes'));
app.use('/api/v1/reminders', require('./routes/reminderRoutes'));
app.use('/api/v1/vets', require('./routes/vetRoutes'));
app.use('/api/v1/appointments', require('./routes/appointmentRoutes'));
app.use('/api/v1/hotels', require('./routes/hotelRoutes'));
app.use('/api/v1/hotel-bookings', require('./routes/hotelBookingRoutes'));
app.use('/api/v1/chat', require('./routes/chatRoutes'));
app.use('/api/v1/activity', require('./routes/activityRoutes'));
app.use('/api/v1/subscription', require('./routes/subscriptionRoutes'));
app.use('/api/v1/admin', require('./routes/adminRoutes'));
// Swagger UI Route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }'
}));

// ==================== API INFO ====================

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🐾 PAWRENT API - PetTech Platform',
    tagline: 'An toàn cho Boss – An tâm cho Sen',
    version: '1.0.0',
    documentation: '/api-docs',
    endpoints: {
      auth: '/api/v1/auth',
      pets: '/api/v1/pets',
      healthRecords: '/api/v1/health-records',
      reminders: '/api/v1/reminders',
      vets: '/api/v1/vets',
      appointments: '/api/v1/appointments',
      hotels: '/api/v1/hotels',
      hotelBookings: '/api/v1/hotel-bookings',
      chat: '/api/v1/chat',
      activity: '/api/v1/activity',
      subscription: '/api/v1/subscription',
      admin: '/api/v1/admin',
    },
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} không tồn tại.`,
  });
});

// Global error handler
app.use(errorHandler);

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production') {
  const server = app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════╗
    ║                                           ║
    ║   🐾 PAWRENT API Server                  ║
    ║   Mode: ${process.env.NODE_ENV || 'development'}                     ║
    ║   Port: ${PORT}                              ║
    ║   URL:  http://localhost:${PORT}              ║
    ║                                           ║
    ║   "An toàn cho Boss – An tâm cho Sen"     ║
    ║                                           ║
    ╚═══════════════════════════════════════════╝
    `);
  });
}

// Graceful shutdown
process.on('unhandledRejection', (err) => {
  console.error(`❌ Unhandled Rejection: ${err.message}`, err);
  // NOT EXITING process on Vercel to prevent 500 error crashes
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received.');
});

module.exports = app;
