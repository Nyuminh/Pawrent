const User = require('../models/User');
const app = require('../config/firebase');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
const { getMessaging } = require('firebase-admin/messaging');
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

