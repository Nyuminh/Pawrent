const User = require('../models/User');
const FcmReport = require('../models/FcmReport');
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

// Helper: Lấy chuỗi ngày YYYY-MM-DD theo chuẩn múi giờ Thực Tế của Project (Thường là Asia/Ho_Chi_Minh)
// Giúp cho dữ liệu hiển thị API hoàn toàn khớp lịch với Firebase Console tại Việt Nam (Không bị lệch 14 tiếng)
const getLocalDateString = (d) => {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(d);
};

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

        // Chuyển hướng lưu file sang Cloudinary vì Firebase Storage chưa được kích hoạt
        const cloudinary = require('cloudinary').v2;
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });

        const streamUpload = (req) => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { resource_type: 'auto', folder: 'pawrent_documents' },
                    (error, result) => {
                        if (result) {
                            resolve(result);
                        } else {
                            reject(error);
                        }
                    }
                );
                const { Readable } = require('stream');
                Readable.from(req.file.buffer).pipe(stream);
            });
        };

        const result = await streamUpload(req);

        // Lưu thông tin PDF (Metadata) vào Firestore Database để GET ra sau này
        try {
            const { getFirestore } = require('firebase-admin/firestore');
            const firebaseApp = require('../config/firebase');
            await getFirestore(firebaseApp).collection('pdf_documents').add({
                name: req.file.originalname,
                url: result.secure_url,
                public_id: result.public_id,
                size: result.bytes,
                format: result.format,
                createdAt: new Date().toISOString()
            });
        } catch (dbErr) {
            console.error('Lưu metadata PDF thất bại (Sếp nhớ bật Firestore nha):', dbErr.message);
        }

        res.status(200).json({
            success: true,
            message: 'Né mượt Firebase Storage! Upload thành công lên Cloudinary!',
            data: {
                url: result.secure_url,
                public_id: result.public_id,
                fileName: result.public_id
            }
        });

    } catch (error) {
        console.error("Cloudinary Storage Error:", error);
        res.status(500).json({ success: false, message: 'Lỗi khi upload file lên Cloudinary.' });
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
            fcmOptions: { analyticsLabel: 'direct_msg_v1' }
        };

        const response = await getMessaging(app).sendEachForMulticast(message);

        // Ghi NGAY sends vào LocalDB = số tokens đã dispatch (real-time)
        // Không cần check successCount vì Firebase Console cũng tính cả lần gửi bị lỗi token
        const dateStr = getLocalDateString(new Date());
        await FcmReport.findOneAndUpdate(
            { date: dateStr },
            { $inc: { sends: user.fcmTokens.length } },
            { upsert: true, new: true }
        );

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
                fcmOptions: { analyticsLabel: 'broadcast_msg_v1' }
            };

            const response = await messaging.sendEachForMulticast(message);
            successCount += response.successCount;
            failureCount += response.failureCount;
        }

        // Ghi NGAY sends = tổng tokens đã dispatch (real-time), không phụ thuộc successCount
        // successCount = 0 vẫn ghi (token stale/invalid vẫn là 1 lần gửi thật)
        const dateStr = getLocalDateString(new Date());
        await FcmReport.findOneAndUpdate(
            { date: dateStr },
            { $inc: { sends: allTokens.length } },
            { upsert: true, new: true }
        );

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

// @desc    DEBUG: Xem thang FcmReport trong MongoDB
// @route   GET /api/v1/firebase/fcm-debug
// @access  Public (tam thoi de debug)
exports.debugFcmReport = async (req, res) => {
    try {
        const FcmReport = require('../models/FcmReport');
        const today = getLocalDateString(new Date());
        const yesterday = getLocalDateString(new Date(Date.now() - 86400000));

        // Lay 10 ban ghi moi nhat
        const recent = await FcmReport.find().sort({ date: -1 }).limit(10).lean();
        const todayDoc = await FcmReport.findOne({ date: today }).lean();
        const yesterdayDoc = await FcmReport.findOne({ date: yesterday }).lean();

        res.status(200).json({
            success: true,
            debug: {
                serverTime: new Date().toISOString(),
                todayStr: today,
                yesterdayStr: yesterday,
                todayRecord: todayDoc,
                yesterdayRecord: yesterdayDoc,
                last10Records: recent
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};


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

// --- TỐI ƯU HOÁ API: Singleton ---
// Client Instances (Singleton) giúp giảm tải khởi tạo API Client, nhưng Realtime Fetching vẫn sẽ xảy ra mỗi Request!
// Client Instances (Singleton) để tái sử dụng thay vì khởi tạo lại tốn tài nguyên
let sharedFcmAuthClient = null;
let sharedGa4Client = null;


// @desc    7. FCM Dashboard: Báo cáo số liệu Cloud Messaging (Kết hợp LocalDB Real-time + FCM Delivery API Lịch sử)
// @route   GET /api/v1/firebase/fcm-board
// @access  Public
exports.getFcmBoard = async (req, res, next) => {
    try {
        const { GoogleAuth } = require('google-auth-library');
        const path = require('path');
        const fs = require('fs');
        const saPath = path.join(process.cwd(), 'src/config/serviceAccountKey.json');

        let projectId = null;
        if (fs.existsSync(saPath)) {
            projectId = require(saPath).project_id;
        }

        // ===== 1. Lấy dữ liệu Real-time từ MongoDB (FcmReport) =====
        const startDateStr = getLocalDateString(new Date(Date.now() - 90 * 86400000));
        const FcmReport = require('../models/FcmReport');
        const reports = await FcmReport.find({ date: { $gte: startDateStr } }).lean();
        const localMap = {};
        reports.forEach(r => { localMap[r.date] = r; });

        // ===== 2. Lấy dữ liệu Historical từ FCM Data API (Delay 3 ngày) =====
        const fcmApiByDate = {};
        if (projectId) {
            try {
                if (!sharedFcmAuthClient) {
                    const auth = new GoogleAuth({
                        keyFilename: saPath,
                        scopes: ['https://www.googleapis.com/auth/cloud-platform']
                    });
                    sharedFcmAuthClient = await auth.getClient();
                }
                const appsRes = await sharedFcmAuthClient.request({
                    url: `https://firebase.googleapis.com/v1beta1/projects/${projectId}/androidApps`
                });
                if (appsRes.data?.apps?.length > 0) {
                    await Promise.all(appsRes.data.apps.map(async (appItem) => {
                        try {
                            const fcmRes = await sharedFcmAuthClient.request({
                                url: `https://fcmdata.googleapis.com/v1beta1/projects/${projectId}/androidApps/${appItem.appId}/deliveryData`
                            });
                            (fcmRes.data?.androidDeliveryData || []).forEach(item => {
                                if (!item.date || !item.data) return;
                                const d = item.date;
                                const dStr = `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
                                if (!fcmApiByDate[dStr]) fcmApiByDate[dStr] = { sends: 0, received: 0 };
                                const sends = parseInt(item.data.countMessagesAccepted) || 0;
                                fcmApiByDate[dStr].sends += sends;
                                const pDelivered = item.data.deliveryPerformance?.percentDelivered || 0;
                                fcmApiByDate[dStr].received += Math.round(sends * pDelivered);
                            });
                        } catch (e) {
                            // Ignored per app error
                        }
                    }));
                }
            } catch (e) {
                console.error('[FCM API Error]:', e.message);
                sharedFcmAuthClient = null;
            }
        }

        // ===== 2.5 Lấy thêm Historical Impressions và Open từ GA4 =====
        const ga4ByDate = {};
        const { BetaAnalyticsDataClient } = require('@google-analytics/data');
        const propertyId = process.env.GA4_PROPERTY_ID;
        if (propertyId) {
            try {
                if (!sharedGa4Client) {
                    const options = process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
                        ? { credentials: { client_email: process.env.FIREBASE_CLIENT_EMAIL, private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') } }
                        : { keyFilename: saPath };
                    sharedGa4Client = new BetaAnalyticsDataClient(options);
                }
                const [gaRes] = await sharedGa4Client.runReport({
                    property: `properties/${propertyId}`,
                    dateRanges: [{ startDate: '90daysAgo', endDate: 'today' }],
                    dimensions: [{ name: 'eventName' }, { name: 'date' }],
                    metrics: [{ name: 'eventCount' }],
                    dimensionFilter: {
                        filter: {
                            fieldName: 'eventName',
                            inListFilter: { values: ['notification_receive', 'notification_open', 'notification_foreground'] }
                        }
                    }
                });
                (gaRes?.rows || []).forEach(row => {
                    const eventName = row.dimensionValues[0].value;
                    const dateRaw = row.dimensionValues[1].value;
                    const dStr = `${dateRaw.substring(0, 4)}-${dateRaw.substring(4, 6)}-${dateRaw.substring(6, 8)}`;
                    const count = parseInt(row.metricValues[0].value) || 0;
                    if (!ga4ByDate[dStr]) ga4ByDate[dStr] = { receive: 0, foreground: 0, openCount: 0 };
                    if (eventName === 'notification_receive') ga4ByDate[dStr].receive += count;
                    if (eventName === 'notification_foreground') ga4ByDate[dStr].foreground += count;
                    if (eventName === 'notification_open') ga4ByDate[dStr].openCount += count;
                });
            } catch (e) {
                console.error('[GA4 API Error]:', e.message);
                sharedGa4Client = null;
            }
        }

        // ===== 3. Tổng hợp 90 ngày (Ưu tiên MongoDB LocalDB vì Real-time) =====
        const chartData = [];
        let totalSends = 0, totalReceived = 0, totalImpressions = 0, totalOpened = 0;

        for (let i = 89; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dStr = getLocalDateString(d);

            const loc = localMap[dStr];
            const api = fcmApiByDate[dStr];
            const ga4 = ga4ByDate[dStr];

            // GA4 Impressions là receive trừ đi foreground (nếu là số dương)
            const ga4Impressions = ga4 ? Math.max(0, ga4.receive - ga4.foreground) : 0;

            // Real-time từ LocalDB + bù những ngày cũ từ API (FCM, GA4) nếu LocalDB chưa track
            const sends = Math.max(loc?.sends || 0, api?.sends || 0);
            const received = Math.max(loc?.received || 0, api?.received || 0, ga4?.receive || 0);
            const impressions = Math.max(loc?.impressions || 0, ga4Impressions); // FIX ISSUES
            const openCount = Math.max(loc?.openCount || 0, ga4?.openCount || 0); // LẤY GA4 OPENS LÀM NGUỒN CHÍNH XÁC


            totalSends += sends;
            totalReceived += received;
            totalImpressions += impressions;
            totalOpened += openCount;

            chartData.push({ date: dStr, sends, received, impressions, openCount });
        }

        res.status(200).json({
            success: true,
            message: 'FCM Report: Real-time (MongoDB) + Historical (Firebase API)',
            data: {
                totals: { sends: totalSends, received: totalReceived, impressions: totalImpressions, openCount: totalOpened },
                chartData
            }
        });
    } catch (error) {
        console.error('FCM Board Error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lấy báo cáo FCM.' });
    }
};


// ==========================================
// CƠ CHẾ MEMORY CACHE (Global RAM) GIÚP TẢI SIÊU TỐC API ANALYTICS
// ==========================================
let ga4Cache = {
    data: null,
    lastFetchTime: 0
};

// @desc    8. Analytics: Lấy toàn bộ data mới nhất từ Google Analytics (Firebase Analytics)
// @route   GET /api/v1/firebase/analytics
// @access  Public
exports.getAnalyticsData = async (req, res, next) => {
    try {
        const propertyId = process.env.GA4_PROPERTY_ID;

        if (!propertyId) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cấu hình GA4_PROPERTY_ID trong file .env để kết nối với Google Analytics 4 (Firebase).'
            });
        }

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

        const analyticsDataClient = new BetaAnalyticsDataClient(options);
        const property = `properties/${propertyId}`;
        const dateRanges = [{ startDate: '28daysAgo', endDate: 'yesterday' }];

        // Luôn gọi Realtime tươi (Rất nhanh ~100ms)
        const realtimePromise = analyticsDataClient.runRealtimeReport({
            property,
            metrics: [{ name: 'activeUsers' }],
            dimensions: [{ name: 'deviceCategory' }]
        }).catch(err => {
            console.error("Realtime Report Error:", err.message);
            return [{ rows: [] }];
        });

        const [[realtimeResp]] = await Promise.all([realtimePromise]);

        let realtimeActiveUsers = 0;
        if (realtimeResp && realtimeResp.rows) {
            realtimeActiveUsers = realtimeResp.rows.reduce((sum, row) => sum + (parseInt(row.metricValues[0].value) || 0), 0);
        }

        // KIỂM TRA MEMORY CACHE (Hạn sử dụng: 15 Phút) - Tăng tốc lên 0ms
        const CACHE_TTL = 15 * 60 * 1000;

        if (ga4Cache.data && (Date.now() - ga4Cache.lastFetchTime < CACHE_TTL)) {
            // Nối dữ liệu Realtime mới nhất vào Bản Cache cũ
            ga4Cache.data.realtimeData.usersInLast30Minutes = realtimeActiveUsers;

            return res.status(200).json({
                success: true,
                message: 'Load Firebase Analytics siêu tốc từ RAM Cache (0ms)!',
                data: ga4Cache.data
            });
        }

        // ====== NẾU CHƯA CÓ CACHE (HOẶC HẾT HẠN) MỚI CHẠY TẢI NẶNG ======
        const reqOverview = { property, dateRanges, metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }, { name: 'userEngagementDuration' }, { name: 'eventCount' }] };
        const reqLocations = { property, dateRanges, dimensions: [{ name: 'country' }], metrics: [{ name: 'activeUsers' }] };
        const reqDevices = { property, dateRanges, dimensions: [{ name: 'operatingSystem' }], metrics: [{ name: 'activeUsers' }] };
        const reqEvents = { property, dateRanges, dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }] };
        const reqScreens = {
            property,
            dateRanges,
            dimensions: [{ name: 'unifiedScreenClass' }],
            metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'eventCount' }, { name: 'bounceRate' }]
        };
        const reqActivity = { property, dateRanges, dimensions: [{ name: 'date' }], metrics: [{ name: 'active1DayUsers' }, { name: 'active7DayUsers' }, { name: 'active28DayUsers' }] };

        const [
            [overviewResp],
            [locationsResp],
            [devicesResp],
            [eventsResp],
            [screensResp],
            [activityResp]
        ] = await Promise.all([
            analyticsDataClient.runReport(reqOverview),
            analyticsDataClient.runReport(reqLocations),
            analyticsDataClient.runReport(reqDevices),
            analyticsDataClient.runReport(reqEvents),
            analyticsDataClient.runReport(reqScreens),
            analyticsDataClient.runReport(reqActivity)
        ]);

        const parseSimple = (resp, metricIndex = 0) => {
            if (!resp || !resp.rows) return [];
            return resp.rows.map(r => ({
                name: r.dimensionValues[0].value,
                count: parseInt(r.metricValues[metricIndex].value) || 0
            }));
        };

        let totalActiveUsers = 0, totalNewUsers = 0, totalEngagementDuration = 0, totalEventCount = 0;
        if (overviewResp && overviewResp.rows && overviewResp.rows.length > 0) {
            const row = overviewResp.rows[0];
            totalActiveUsers = parseInt(row.metricValues[0].value) || 0;
            totalNewUsers = parseInt(row.metricValues[1].value) || 0;
            totalEngagementDuration = parseInt(row.metricValues[2].value) || 0;
            totalEventCount = parseInt(row.metricValues[3].value) || 0;
        }

        let events = parseSimple(eventsResp);

        // Loại bỏ các sự kiện rác (auto-collected data) không cần hiển thị
        const spamEvents = ['user_engagement', 'session_start', 'os_update', 'app_exception', 'app_remove', 'app_clear_data', 'firebase_campaign', 'notification_foreground'];
        const receiveCount = events.find(e => e.name === 'notification_receive')?.count || 0;
        const foregroundCount = events.find(e => e.name === 'notification_foreground')?.count || 0;

        events = events.filter(e => !spamEvents.includes(e.name));

        if (receiveCount > 0 || foregroundCount > 0) {
            events.push({ name: 'impressions', count: Math.max(0, receiveCount - foregroundCount) });
        }

        let activityOverTime = [];
        if (activityResp && activityResp.rows) {
            activityOverTime = activityResp.rows.map(r => ({
                date: `${r.dimensionValues[0].value}`,
                active1Day: parseInt(r.metricValues[0].value) || 0,
                active7Days: parseInt(r.metricValues[1].value) || 0,
                active30Days: parseInt(r.metricValues[2].value) || 0
            })).sort((a, b) => a.date.localeCompare(b.date));
        }

        // Lấy danh sách Screens và lọc bỏ tab rác (chỉ lấy Class Name của Mobile App, loại bỏ Web URLs)
        let parsedScreens = screensResp && screensResp.rows ? screensResp.rows.map(r => ({
            screenName: r.dimensionValues[0].value,
            screenPageViews: parseInt(r.metricValues[0].value) || 0,
            activeUsers: parseInt(r.metricValues[1].value) || 0,
            eventCount: parseInt(r.metricValues[2].value) || 0,
            bounceRate: r.metricValues[3] ? (parseFloat(r.metricValues[3].value) * 100).toFixed(1) + '%' : '0.0%'
        })) : [];

        parsedScreens = parsedScreens.filter(s => {
            const name = s.screenName;
            if (!name || name === '(not set)') return false;
            // Loại bỏ các màn hình Web (chứa dấu xuyệt, http, khoảng trống, dấu gạch)
            if (name.includes('/') || name.includes('http') || name.includes('.') || name.includes('-') || name.includes(' ')) return false;
            // Tên Class của Flutter App thường là PascalCase (Viết hoa chữ đầu, không dấu)
            if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) return false;
            return true;
        });

        parsedScreens.sort((a, b) => b.screenPageViews - a.screenPageViews);

        // TỔNG HỢP VÀ LƯU RAM CACHE
        const finalData = {
            realtimeData: { usersInLast30Minutes: realtimeActiveUsers },
            overview: {
                activeUsers_30Days: totalActiveUsers,
                newUsers_30Days: totalNewUsers,
                averageEngagementSeconds: totalActiveUsers > 0 ? parseFloat((totalEngagementDuration / totalActiveUsers).toFixed(2)) : 0,
                totalEventCount_30Days: totalEventCount
            },
            userActivityOverTime: activityOverTime,
            demographics: {
                countries: parseSimple(locationsResp),
                operatingSystems: parseSimple(devicesResp),
            },
            topScreens: parsedScreens,
            eventscount: events
        };

        // Ghi lại Cache
        ga4Cache.data = finalData;
        ga4Cache.lastFetchTime = Date.now();

        res.status(200).json({
            success: true,
            message: 'Mô phỏng Firebase Overview Dashboard thành công (Fresh Fetch)!',
            data: finalData
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

// @desc    11. Tracker: Tính lượt Received và Opened cho thông báo (Tùy chọn cho Client gọi API)
// @route   POST /api/v1/firebase/track-notification
// @access  Public
exports.trackNotification = async (req, res, next) => {
    try {
        const { event } = req.body; // 'received', 'impressions' hoặc 'opened'

        if (!['received', 'impressions', 'opened'].includes(event)) {
            return res.status(400).json({ success: false, message: 'Loại sự kiện không hợp lệ, phải là "received", "impressions" hoặc "opened".' });
        }

        const dateStr = getLocalDateString(new Date());

        let updateField = {};
        if (event === 'received') updateField = { received: 1 };
        else if (event === 'impressions') updateField = { impressions: 1 };
        else updateField = { openCount: 1 };

        await FcmReport.findOneAndUpdate(
            { date: dateStr },
            { $inc: updateField },
            { upsert: true, new: true }
        );

        res.status(200).json({ success: true, message: 'Đã track thông báo thành công' });
    } catch (error) {
        console.error("Track Notification Error:", error);
        res.status(500).json({ success: false, message: 'Lỗi khi track thông báo FCM.' });
    }
};


// ==========================================
// THÊM 1: QUẢN LÝ TÀI LIỆU PDF TRÊN FIREBASE STORAGE
// ==========================================

exports.getFirebaseDocuments = async (req, res, next) => {
    try {
        const { getFirestore } = require('firebase-admin/firestore');
        const app = require('../config/firebase');
        const snapshot = await getFirestore(app).collection('pdf_documents').orderBy('createdAt', 'desc').get();
        const files = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            files.push({ id: doc.id, name: data.name, public_id: data.public_id, size: data.size, contentType: data.format, timeCreated: data.createdAt, publicUrl: data.url });
        });
        res.status(200).json({ success: true, message: 'Tải danh sách PDF từ Firestore thành công', count: files.length, data: files });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Lỗi khi lấy dữ liệu PDF từ Firestore. (Sếp bật Firestore chưa?)' });
    }
};

exports.deleteFirebaseDocument = async (req, res, next) => {
    try {
        const { fileName, public_id, id } = req.body;
        const targetId = public_id || fileName;
        if (targetId) {
            const cloudinary = require('cloudinary').v2;
            cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
            await cloudinary.uploader.destroy(targetId);
        }
        if (id) {
            const { getFirestore } = require('firebase-admin/firestore');
            const app = require('../config/firebase');
            await getFirestore(app).collection('pdf_documents').doc(id).delete();
        }
        res.status(200).json({ success: true, message: 'Đã dọn dẹp xoá PDF tận gốc trên Cloudinary & Firestore!' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Xóa Cloudinary thất bại.' });
    }
};

// ==========================================
// THÊM 2: HỆ THỐNG BÁO CÁO BUG ĐI THẲNG VÀO FIREBASE FIRESTORE
// ==========================================

exports.getFirebaseBugs = async (req, res, next) => {
    try {
        const { getFirestore } = require('firebase-admin/firestore');
        const app = require('../config/firebase');
        const db = getFirestore(app);

        const snapshot = await db.collection('bug_reports').orderBy('createdAt', 'desc').get();
        const bugs = [];
        snapshot.forEach(doc => {
            bugs.push({ id: doc.id, ...doc.data() });
        });
        res.status(200).json({ success: true, count: bugs.length, data: bugs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Lỗi đọc Firestore. Sếp hãy vào check xem đã [Bật/Create] Cloud Firestore trong Firebase Console chưa nhé!' });
    }
};

exports.reportFirebaseBug = async (req, res, next) => {
    try {
        const { title, description, priority, screenName } = req.body;
        let images = [];
        if (req.files && req.files.length > 0) {
            const cloudinary = require('cloudinary').v2;
            cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });

            // Dùng Promise.all để bắn Bơm Đa Luồng (Paralell) đẩy tốc độ Upload cực đại!
            const uploadPromises = req.files.map(file => {
                return new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream({ folder: 'pawrent_bugs' }, (error, result) => {
                        if (result) resolve(result.secure_url); else reject(error);
                    });
                    const { Readable } = require('stream');
                    Readable.from(file.buffer).pipe(stream);
                });
            });
            images = await Promise.all(uploadPromises);
        }

        const { getFirestore } = require('firebase-admin/firestore');
        const app = require('../config/firebase');
        const newBug = {
            title: title || 'Lỗi Ẩn Danh', description: description || 'Không có mô tả',
            priority: priority || 'Medium', screenName: screenName || 'Unknown',
            status: 'Pending', images, reportedBy: req.user ? req.user.id : 'Khách Test',
            createdAt: new Date().toISOString()
        };
        const docRef = await getFirestore(app).collection('bug_reports').add(newBug);
        res.status(201).json({ success: true, message: 'Đã báo cáo Bug lên thẳng Firestore Cloud (Ảnh dùng Cloudinary)!', data: { id: docRef.id, ...newBug } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Lỗi Tạo Bug. Cảm phiền sếp Đảm Bảo đã Bật Firestore Database!' });
    }
};

exports.updateFirebaseBugStatus = async (req, res, next) => {
    try {
        const { status, adminNotes } = req.body;
        const { getFirestore } = require('firebase-admin/firestore');
        const app = require('../config/firebase');
        const db = getFirestore(app);

        await db.collection('bug_reports').doc(req.params.id).update({
            status,
            adminNotes: adminNotes || '',
            updatedAt: new Date().toISOString()
        });

        res.status(200).json({ success: true, message: `Bug đã chuyển trạng thái thành ${status} trên Firestore` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Lỗi Cập Nhật Firestore.' });
    }
};

exports.deleteFirebaseBug = async (req, res, next) => {
    try {
        const { getFirestore } = require('firebase-admin/firestore');
        const app = require('../config/firebase');
        const db = getFirestore(app);
        await db.collection('bug_reports').doc(req.params.id).delete();
        res.status(200).json({ success: true, message: 'Đã diệt Bug khỏi thư viện Firestore hoàn toàn.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Xoá Firestore thất bại.' });
    }
};
