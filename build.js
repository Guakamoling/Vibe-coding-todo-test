const fs = require('fs');

const configContent = `window.FIREBASE_CONFIG = {
    apiKey: "${process.env.FIREBASE_API_KEY || ''}",
    authDomain: "${process.env.FIREBASE_AUTH_DOMAIN || ''}",
    projectId: "${process.env.FIREBASE_PROJECT_ID || ''}",
    databaseURL: "${process.env.FIREBASE_DATABASE_URL || ''}",
    storageBucket: "${process.env.FIREBASE_STORAGE_BUCKET || ''}",
    messagingSenderId: "${process.env.FIREBASE_MESSAGING_SENDER_ID || ''}",
    appId: "${process.env.FIREBASE_APP_ID || ''}"
};`;

fs.writeFileSync('config.js', configContent);
console.log('Firebase config.js has been generated from environment variables.');
