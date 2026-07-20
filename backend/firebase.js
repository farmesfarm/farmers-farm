const admin = require('firebase-admin');
const { cert } = require('firebase-admin/app');
const path = require('path');
const fs = require('fs');

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  const localKeyPath = path.join(__dirname, 'serviceAccountKey.json');
  if (fs.existsSync(localKeyPath)) {
    serviceAccount = require('./serviceAccountKey.json');
  } else {
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is missing.');
  }
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = admin.firestore();

module.exports = { admin, db };
