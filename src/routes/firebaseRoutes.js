const express = require('express');
const router = express.Router();
const multer = require('multer');

// Configure multer for memory storage (for uploading to Firebase Storage directly from buffer)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // no larger than 5mb
    },
});

const {
    firebaseLogin,
    uploadToStorage,
    sendNotification,
    logCrash,
    listFirebaseUsers
} = require('../controllers/firebaseController');

// Import authentication middleware if you want to protect certain routes
const { protect, authorize } = require('../middleware/auth');

// 1. Authentication
router.post('/login', firebaseLogin);

// 2. Storage
router.post('/upload', protect, upload.single('file'), uploadToStorage);

// 3. Cloud Messaging
router.post('/send-notification', protect, authorize('admin', 'vet'), sendNotification);

// 4. Crashlytics (dummy endpoint)
router.post('/log-crash', logCrash);

// 5. List Firebase Auth Users (Admin only)
router.get('/users', protect, authorize('admin'), listFirebaseUsers);

module.exports = router;
