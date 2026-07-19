const { initializeApp, getApps, cert } = require('firebase-admin/app');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.resolve(__dirname, './serviceAccountKey.json');

let app;

if (getApps().length === 0) {
    try {
        let credentialOptions;

        if (fs.existsSync(serviceAccountPath)) {
            const serviceAccount = require(serviceAccountPath);
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
