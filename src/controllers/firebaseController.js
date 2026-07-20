const User = require('../models/User');
const app = require('../config/firebase');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
const { getMessaging } = require('firebase-admin/messaging');
const { getRemoteConfig } = require('firebase-admin/remote-config');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const jwt = require('jsonwebtoken');

// Tối ưu hóa: Warm-up Firebase Cert Cache ngay khi khởi động server
// Bằng cách tung 1 fake token lúc server vừa chạy, Firebase SDK sẽ gọi API tải sẵn bộ Key (JWKS) từ Google.
// Qua đó, người dùng thực sự ĐẦU TIÊN bấm Đăng Nhập sẽ không phải chịu độ trễ 500ms-800ms chờ tải Key nữa!
getAuth(app).verifyIdToken('warmup-cache-token').catch(() => {
    console.log('⚡ Đã preload Firebase Google Keys để tăng tốc Đăng Nhập');
});

// Helper: Send token response
const sendTokenResponse = async (user, statusCode, res, message, extraUpdates = {}) => {
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    const lastLogin = new Date();

    // TỐI ƯU HÓA: Gom lại thành DƯY NHẤT 1 lần ghi (Write) xuống Database (Tiết kiệm trễ 100-200ms)
    await User.updateOne(
        { _id: user._id },
        { $set: { refreshToken, lastLogin, ...extraUpdates } }
    );

    const userData = user.toObject ? user.toObject() : { ...user };
    delete userData.password;
    delete userData.refreshToken;
    userData.lastLogin = lastLogin;

    res.status(statusCode).json({
        success: true,
        message,
        data: {
            user: userData,
            accessToken,
            refreshToken,
            tokenType: 'Bearer',
            expiresIn: process.env.JWT_EXPIRE,
        },
    });
};

// @desc    1. Authentication: Login with Firebase Google Auth & Save FCM Token
// @route   POST /api/v1/firebase/login
// @access  Public
exports.firebaseLogin = async (req, res, next) => {
    try {
        const { idToken, fcmToken } = req.body;

        if (!idToken) {
            return res.status(400).json({ success: false, message: 'Google ID Token from Firebase is required.' });
        }

        // Verify token with Firebase Admin
        const decodedToken = await getAuth(app).verifyIdToken(idToken);
        const { uid: firebaseUid, email, name: fullName, picture: avatar } = decodedToken;

        // Check if user exists by firebaseUid or email
        let user = await User.findOne({
            $or: [{ firebaseUid }, { email }]
        });

        if (!user) {
            // Create new user
            user = await User.create({
                firebaseUid,
                email,
                fullName: fullName || 'Người dùng Google',
                avatar: avatar || 'default-avatar.png',
                isGoogleLogin: true,
                role: 'user',
                subscription: { plan: 'free', name: 'Miễn phí', durationUnit: 'year', isActive: true, maxPets: 1 }
            });
        } else {
            // Tối ưu hóa: Không gọi .save() tốn kém ở đây nữa, gom vào xử lý trong một Update Query duy nhất bên dưới
            let updates = {};

            if (!user.firebaseUid) {
                updates.firebaseUid = firebaseUid;
                updates.isGoogleLogin = true;
            }

            if (!user.avatar || user.avatar === 'default-avatar.png') {
                updates.avatar = avatar;
            }

            if (fcmToken && (!user.fcmTokens || !user.fcmTokens.includes(fcmToken))) {
                updates.fcmTokens = [...(user.fcmTokens || []), fcmToken];
            }

            if (!user.isActive) {
                return res.status(401).json({
                    success: false,
                    message: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ admin.',
                });
            }

            // Gửi Token và gộp cục updates này vào chung 1 Request DB Cực Nhanh!
            await sendTokenResponse(user, 200, res, 'Đăng nhập Google qua Firebase thành công!', updates);
            return;
        }

        // Trường hợp là New User, không có extra updatess
        await sendTokenResponse(user, 200, res, 'Đăng ký & Đăng nhập Google thành công!');
    } catch (error) {
        console.error("Firebase Login Error:", error);
        res.status(401).json({ success: false, message: 'Xác thực Firebase thất bại hoặc Token không hợp lệ.' });
    }
};

// @desc    2. Storage: Upload file to Firebase Storage
// @route   POST /api/v1/firebase/upload
// @access  Private
exports.uploadToStorage = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn một file để upload.' });
        }

        const bucket = getStorage(app).bucket();
        const fileName = `uploads/${Date.now()}_${req.file.originalname}`;
        const file = bucket.file(fileName);

        await file.save(req.file.buffer, {
            metadata: {
                contentType: req.file.mimetype,
            },
            public: true, // Make file public if bucket allows it
        });

        // You can get the signed URL or public URL
        // Public URL format (if bucket is public):
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

        res.status(200).json({
            success: true,
            message: 'Upload file lên Firebase Storage thành công!',
            data: {
                url: publicUrl,
                fileName
            }
        });

    } catch (error) {
        console.error("Firebase Storage Error:", error);
        res.status(500).json({ success: false, message: 'Lỗi khi upload file lên Firebase Storage.' });
    }
};

// @desc    3. Cloud Messaging (FCM): Send push notification
// @route   POST /api/v1/firebase/send-notification
// @access  Private/Admin
exports.sendNotification = async (req, res, next) => {
    try {
        const { userId, title, body, data } = req.body;

        if (!userId || !title || !body) {
            return res.status(400).json({ success: false, message: 'Cần cung cấp userId, title và body.' });
        }

        const user = await User.findById(userId);
        if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
            return res.status(404).json({ success: false, message: 'Người dùng không tồn tại hoặc chưa có FCM Token.' });
        }

        const message = {
            notification: { title, body },
            data: data || {},
            tokens: user.fcmTokens,
        };

        const response = await getMessaging(app).sendEachForMulticast(message);

        // Optionally handle failed tokens (e.g., remove invalid ones from DB)

        res.status(200).json({
            success: true,
            message: 'Gửi thông báo thành công!',
            data: response
        });
    } catch (error) {
        console.error("Firebase FCM Error:", error);
        res.status(500).json({ success: false, message: 'Lỗi khi gửi thông báo FCM.' });
    }
};

// @desc    3b. Cloud Messaging (FCM): QUA ĐÂY! Gửi Push cho TOÀN BỘ hệ thống (Broadcast)
// @route   POST /api/v1/firebase/send-notification-all
// @access  Private/Admin
exports.sendBroadcastNotification = async (req, res, next) => {
    try {
        const { title, body, data } = req.body;

        if (!title || !body) {
            return res.status(400).json({ success: false, message: 'Cần cung cấp title và body của thông báo.' });
        }

        // Lấy tất cả user có trường fcmTokens và mảng không bị rỗng
        const users = await User.find({ fcmTokens: { $exists: true, $not: { $size: 0 } } }).select('fcmTokens').lean();

        let allTokens = [];
        users.forEach(u => allTokens.push(...u.fcmTokens));

        // Loại bỏ token trùng lặp (ví dụ 1 user đăng nhập nhiều lần trên 1 máy bằng nhiều nick)
        allTokens = [...new Set(allTokens)];

        if (allTokens.length === 0) {
            return res.status(404).json({ success: false, message: 'Chưa có thiết bị nào trong hệ thống, không thể gửi.' });
        }

        const messaging = getMessaging(app);

        // Chia thành từng mảng nhỏ (Chunking) vì Firebase giới hạn mảng tokens tối đa = 500 cái mỗi lần gọi API
        const chunkSize = 500;
        let successCount = 0;
        let failureCount = 0;

        for (let i = 0; i < allTokens.length; i += chunkSize) {
            const chunk = allTokens.slice(i, i + chunkSize);
            const message = {
                notification: { title, body },
                data: data || {},
                tokens: chunk,
            };

            const response = await messaging.sendEachForMulticast(message);
            successCount += response.successCount;
            failureCount += response.failureCount;
        }

        res.status(200).json({
            success: true,
            message: 'Đã gửi thông báo Broadcast (Toàn hệ thống) thành công!',
            data: {
                totalTargetedDevices: allTokens.length,
                successCount,
                failureCount
            }
        });
    } catch (error) {
        console.error("Firebase FCM Broadcast Error:", error);
        res.status(500).json({ success: false, message: 'Lỗi khi gửi thông báo Broadcast toàn hệ thống.' });
    }
};

// @desc    4. Crashlytics: Log custom crash from backend (or acknowledge client crash)
// @route   POST /api/v1/firebase/log-crash
// @access  Public
// Note: Firebase Crashlytics is a client-side SDK. There is no official backend API to log crashes directly into Crashlytics.
// This endpoint serves to receive fatal errors from the client if needed, or simply documents the usage.
exports.logCrash = async (req, res, next) => {
    try {
        const { error, platform, route, userId } = req.body;

        console.error(`🔴 [CLIENT CRASH] Platform: ${platform}, Route: ${route}, User: ${userId}`);
        console.error(`Details: ${error}`);

        // Here you could send this to your own Discord/Slack webhook or backend logger.
        // For Crashlytics, the client Flutter app should automatically catch and log it using FirebaseCrashlytics.instance.

        res.status(200).json({
            success: true,
            message: 'Đã ghi nhận log lỗi (Lưu ý: Crashlytics chuẩn sẽ tự động gửi log từ client).',
        });
    } catch (error) {
        next(error);
    }
};

// @desc    5. List all Firebase Auth users (Admin SDK)
// @route   GET /api/v1/firebase/users
// @access  Private/Admin
exports.listFirebaseUsers = async (req, res, next) => {
    try {
        const maxResults = Math.min(Number(req.query.limit) || 100, 1000);
        const pageToken = req.query.pageToken || undefined;

        // Firebase Admin SDK: listUsers trả về tối đa 1000 user mỗi lần gọi
        const listUsersResult = await getAuth(app).listUsers(maxResults, pageToken);

        const users = listUsersResult.users.map((userRecord) => ({
            uid: userRecord.uid,
            email: userRecord.email || null,
            displayName: userRecord.displayName || null,
            photoURL: userRecord.photoURL || null,
            phoneNumber: userRecord.phoneNumber || null,
            emailVerified: userRecord.emailVerified,
            disabled: userRecord.disabled,
            createdAt: userRecord.metadata.creationTime,
            lastSignedIn: userRecord.metadata.lastSignInTime,
            providerData: userRecord.providerData.map((p) => ({
                providerId: p.providerId,
                email: p.email,
                displayName: p.displayName,
            })),
        }));

        res.status(200).json({
            success: true,
            count: users.length,
            // nextPageToken dùng để gọi trang tiếp theo (pagination)
            nextPageToken: listUsersResult.pageToken || null,
            data: users,
        });
    } catch (error) {
        console.error('List Firebase Users Error:', error);
        next(error);
    }
};

// @desc    6. Remote Config: Lấy config template từ Firebase
// @route   GET /api/v1/firebase/remote-config
// @access  Public hoặc Private
exports.getRemoteConfigData = async (req, res, next) => {
    try {
        const template = await getRemoteConfig(app).getTemplate();
        res.status(200).json({
            success: true,
            message: 'Lấy Remote Config thành công',
            data: template
        });
    } catch (error) {
        console.error('Remote Config Error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lấy Remote Config.' });
    }
};

// @desc    6b. Remote Config: Cập nhật giá trị và Publish lên Firebase
// @route   PUT /api/v1/firebase/remote-config
// @access  Private/Admin
exports.updateRemoteConfig = async (req, res, next) => {
    try {
        const updates = req.body; // Gửi lên object ví dụ: { "app_theme_event": "TET" }

        if (!updates || Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: 'Vui lòng truyền các tham số cần cập nhật.' });
        }

        const remoteConfig = getRemoteConfig(app);

        // 1. Lấy template cấu hình hiện tại đang có trên Firebase
        const template = await remoteConfig.getTemplate();

        // 2. Thay đổi giá trị (Default Value) của các tham số
        for (const [key, value] of Object.entries(updates)) {
            // Nếu tham số chưa tồn tại, khởi tạo nó
            if (!template.parameters[key]) {
                template.parameters[key] = {
                    defaultValue: { value: String(value) }
                };
            } else {
                // Nếu đã có, chỉ ghi đè giá trị
                template.parameters[key].defaultValue = { value: String(value) };
            }
        }

        // 3. Publish (Áp dụng) template mới lên Firebase
        const updatedTemplate = await remoteConfig.publishTemplate(template);

        res.status(200).json({
            success: true,
            message: 'Cập nhật và Publish Remote Config thành công!',
            data: updatedTemplate // Dữ liệu version mới
        });
    } catch (error) {
        console.error('Update Remote Config Error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi publish Remote Config.',
            error: error.message
        });
    }
};

// @desc    7. FCM Dashboard: Thống kê báo cáo Cloud Messaging (Mock)
// @route   GET /api/v1/firebase/fcm-board
// @access  Public
exports.getFcmBoard = async (req, res, next) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Lấy dữ liệu thống kê FCM Reports thành công!',
            data: {
                totals: {
                    sends: 27,
                    received: 0,
                    impressions: 0,
                    openCount: 0
                },
                // Dữ liệu mô phỏng cho biểu đồ (Chart)
                chartData: [
                    { date: '2026-07-15', sends: 0, received: 0, impressions: 0, openCount: 0 },
                    { date: '2026-07-16', sends: 2, received: 0, impressions: 0, openCount: 0 },
                    { date: '2026-07-17', sends: 5, received: 0, impressions: 0, openCount: 0 },
                    { date: '2026-07-18', sends: 0, received: 0, impressions: 0, openCount: 0 },
                    { date: '2026-07-19', sends: 20, received: 0, impressions: 0, openCount: 0 }
                ]
            }
        });
    } catch (error) {
        console.error("FCM Board Error:", error);
        res.status(500).json({ success: false, message: 'Lỗi khi lấy thông tin báo cáo FCM.' });
    }
};

// @desc    8. Analytics: Lấy toàn bộ data Realtime từ Google Analytics (Firebase Analytics)
// @route   GET /api/v1/firebase/analytics
// @access  Public
exports.getAnalyticsData = async (req, res, next) => {
    try {
        const propertyId = process.env.GA4_PROPERTY_ID; // Cần cấu hình GA4_PROPERTY_ID trong .env

        if (!propertyId) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cấu hình GA4_PROPERTY_ID trong file .env để kết nối với Google Analytics 4 (Firebase).'
            });
        }

        // Khởi tạo thông tin xác thực cho Analytics API
        const options = {};
        if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
            options.credentials = {
                client_email: process.env.FIREBASE_CLIENT_EMAIL,
                private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            };
        } else {
            const path = require('path');
            const fs = require('fs');
            const saPath = path.join(process.cwd(), 'src/config/serviceAccountKey.json');
            if (fs.existsSync(saPath)) {
                options.keyFilename = saPath;
            }
        }

        // Khởi tạo Client
        const analyticsDataClient = new BetaAnalyticsDataClient(options);
        const property = `properties/${propertyId}`;

        // 1. By Location (Country / City)
        const locationsPromise = analyticsDataClient.runRealtimeReport({
            property,
            dimensions: [{ name: 'country' }, { name: 'city' }],
            metrics: [{ name: 'activeUsers' }],
        });

        // 2. By Device Category (Mobi/Desktop/Tablet)
        const devicesPromise = analyticsDataClient.runRealtimeReport({
            property,
            dimensions: [{ name: 'deviceCategory' }],
            metrics: [{ name: 'activeUsers' }],
        });

        // 3. By Event Name (Tracking Event Firebase phát sinh trong 30p qua)
        const eventsPromise = analyticsDataClient.runRealtimeReport({
            property,
            dimensions: [{ name: 'eventName' }],
            metrics: [{ name: 'eventCount' }],
        });

        // 4. By Screen Name
        const screensPromise = analyticsDataClient.runRealtimeReport({
            property,
            dimensions: [{ name: 'unifiedScreenName' }],
            metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
        });

        // Chạy đồng thời cả 4 truy vấn để tăng tốc
        const [
            [locationsResp],
            [devicesResp],
            [eventsResp],
            [screensResp]
        ] = await Promise.all([locationsPromise, devicesPromise, eventsPromise, screensPromise]);

        // Helper Map Format Data
        const parseSimple = (resp) => {
            if (!resp.rows) return [];
            return resp.rows.map(r => ({
                name: r.dimensionValues[0].value,
                count: parseInt(r.metricValues[0].value)
            }));
        };

        const locations = locationsResp.rows ? locationsResp.rows.map(r => ({
            country: r.dimensionValues[0].value,
            city: r.dimensionValues[1].value,
            activeUsers: parseInt(r.metricValues[0].value)
        })) : [];

        const screens = screensResp.rows ? screensResp.rows.map(r => ({
            screenName: r.dimensionValues[0].value,
            activeUsers: parseInt(r.metricValues[0].value),
            screenPageViews: parseInt(r.metricValues[1].value)
        })) : [];

        const devices = parseSimple(devicesResp);
        const events = parseSimple(eventsResp);

        // Tổng số Active User (lấy tổng từ Locations)
        const totalActive = locations.reduce((sum, curr) => sum + curr.activeUsers, 0);

        res.status(200).json({
            success: true,
            message: 'Lấy dữ liệu toàn cảnh Realtime Analytics thực tế thành công!',
            data: {
                overview: {
                    totalActiveUsers: totalActive,
                    totalEventsLogged: events.reduce((s, e) => s + e.count, 0)
                },
                locations,
                devices,
                screens,
                events
            }
        });
    } catch (error) {
        console.error("Realtime Analytics Error:", error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy thông tin Google Analytics.',
            error: error.message
        });
    }
};

// @desc    9. Khóa / Mở Khóa tài khoản Firebase Auth
// @route   PUT /api/v1/firebase/users/:uid/status
// @access  Private/Admin
exports.updateFirebaseUserStatus = async (req, res, next) => {
    try {
        const { uid } = req.params;
        const { disabled } = req.body;

        if (typeof disabled !== 'boolean') {
            return res.status(400).json({ success: false, message: 'Tham số disabled phải là true hoặc false.' });
        }

        const userRecord = await getAuth(app).updateUser(uid, { disabled });

        res.status(200).json({
            success: true,
            message: disabled ? 'Đã vô hiệu hóa/Khóa tài khoản thành công.' : 'Đã mở khóa tài khoản thành công.',
            data: userRecord
        });
    } catch (error) {
        console.error("Change Status Firebase User Error:", error);
        res.status(500).json({ success: false, message: 'Lỗi khi vô hiệu hóa tài khoản Firebase.', error: error.message });
    }
};

// @desc    10. Xóa vĩnh viễn tài khoản Firebase Auth
// @route   DELETE /api/v1/firebase/users/:uid
// @access  Private/Admin
exports.deleteFirebaseUser = async (req, res, next) => {
    try {
        const { uid } = req.params;

        await getAuth(app).deleteUser(uid);

        res.status(200).json({
            success: true,
            message: 'Đã xóa hoàn toàn tài khoản khỏi hệ thống Firebase Authentication.'
        });
    } catch (error) {
        console.error("Delete Firebase User Error:", error);
        res.status(500).json({ success: false, message: 'Lỗi khi xóa tài khoản Firebase.', error: error.message });
    }
};
