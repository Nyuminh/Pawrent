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
    sendBroadcastNotification,
    logCrash,
    listFirebaseUsers,
    getRemoteConfigData,
    updateRemoteConfig,
    getFcmBoard,
    getAnalyticsData,
    updateFirebaseUserStatus,
    deleteFirebaseUser,
    trackNotification,
    getFirebaseDocuments,
    deleteFirebaseDocument,
    getFirebaseBugs,
    reportFirebaseBug,
    updateFirebaseBugStatus,
    deleteFirebaseBug,
    debugFcmReport
} = require('../controllers/firebaseController');

// Import authentication middleware if you want to protect certain routes
const { protect, authorize } = require('../middleware/auth');

// 1. Authentication
router.post('/login', firebaseLogin);

// 2. Storage & PDF Documents
router.post('/upload', protect, upload.single('file'), uploadToStorage);
router.get('/documents', getFirebaseDocuments); // Liệt kê PDF Document từ Firebase Storage
router.delete('/documents', protect, authorize('admin'), deleteFirebaseDocument); // Xoá file PDF trên Bucket

// 3. Cloud Messaging
router.post('/send-notification', protect, authorize('admin', 'vet'), sendNotification);
router.post('/send-notification-all', protect, authorize('admin'), sendBroadcastNotification);
router.post('/track-notification', trackNotification);

// 4. Bug Reports & Crashlytics (Sử dụng Firebase Firestore / Storage)
router.post('/log-crash', logCrash);
router.get('/bug-reports', getFirebaseBugs);
router.post('/bug-reports', protect, upload.array('images', 5), reportFirebaseBug);
router.patch('/bug-reports/:id', protect, authorize('admin'), updateFirebaseBugStatus);
router.delete('/bug-reports/:id', protect, authorize('admin'), deleteFirebaseBug);

// 5. User Management (Admin only)
router.get('/users', protect, authorize('admin'), listFirebaseUsers);
router.put('/users/:uid/status', protect, authorize('admin'), updateFirebaseUserStatus);
router.delete('/users/:uid', protect, authorize('admin'), deleteFirebaseUser);

// 6. Remote Config
router.get('/remote-config', getRemoteConfigData);
router.put('/remote-config', updateRemoteConfig); // Thêm tính năng thay đổi & Publish

// 7. FCM Dashboard
router.get('/fcm-board', getFcmBoard);
router.get('/fcm-debug', debugFcmReport); // DEBUG: xem thang MongoDB FcmReport

// 8. Analytics Data
router.get('/analytics', getAnalyticsData);

module.exports = router;
