const { initializeApp, getApps, cert } = require('firebase-admin/app');
const path = require('path');
const fs = require('fs');

// Thử 2 đường dẫn phổ biến đề phòng __dirname bị lỗi khi build
const serviceAccountPath1 = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccountPath2 = path.join(process.cwd(), 'src/config/serviceAccountKey.json');

let app;

if (getApps().length === 0) {
    try {
        let credentialOptions;

        if (fs.existsSync(serviceAccountPath1)) {
            const serviceAccount = require(serviceAccountPath1);
            credentialOptions = cert(serviceAccount);
        } else if (fs.existsSync(serviceAccountPath2)) {
            const serviceAccount = require(serviceAccountPath2);
            credentialOptions = cert(serviceAccount);
        } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
            credentialOptions = cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            });
        } else {
            throw new Error('Không tìm thấy serviceAccountKey.json hoặc biến môi trường Firebase.');
        }

        app = initializeApp({
            credential: credentialOptions,
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID || 'your-project-id'}.appspot.com`,
        });
        console.log('🔥 Firebase Admin initialized successfully');
    } catch (error) {
        console.error('❌ Firebase Admin initialization error:', error.message);
    }
} else {
    app = getApps()[0];
}

module.exports = app;
