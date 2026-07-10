const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { OAuth2Client } = require('google-auth-library');

// OTP Storage (Email -> { otp, expiresAt })
const otpStorage = new Map();

// NodeMailer Setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Google Auth Setup
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID_HERE';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);


// Initialize Firebase Admin
const admin = require('firebase-admin');
const { cert } = require('firebase-admin/app');

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  serviceAccount = require('../serviceAccountKey.json');
}

admin.initializeApp({
  credential: cert(serviceAccount)
});
const db = admin.firestore();

// Setup Multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../public/images/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
});

// --- ADMIN LOGIN & MIDDLEWARE ---
const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const expectedToken = process.env.ADMIN_TOKEN_SECRET || 'ff_super_secret_token_2026';
  if (authHeader === `Bearer ${expectedToken}`) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized access' });
  }
};

// --- ADMIN LOGIN (Email + Password) ---
const ADMIN_CREDENTIALS = [
  { email: (process.env.ADMIN_EMAIL || 'admin@farmersfarm.in').toLowerCase(), pass: process.env.ADMIN_PASS },
  { email: (process.env.ADMIN_EMAIL_2 || '').toLowerCase(), pass: process.env.ADMIN_PASS_2 },
];

router.post('/admin/login', (req, res) => {
  const { email, password } = req.body;
  const inputEmail = (email || '').trim().toLowerCase();
  const inputPass = (password || '').trim();

  const match = ADMIN_CREDENTIALS.find(c => c.email && c.email === inputEmail && c.pass && c.pass === inputPass);

  if (match) {
    const token = process.env.ADMIN_TOKEN_SECRET || 'ff_super_secret_token_2026';
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Access denied. Invalid email or password.' });
  }
});

router.post('/admin/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  const storedData = otpStorage.get(email);

  if (!storedData) {
    return res.status(400).json({ error: 'No OTP requested or session expired.' });
  }

  if (Date.now() > storedData.expiresAt) {
    otpStorage.delete(email);
    return res.status(400).json({ error: 'OTP has expired. Please login again.' });
  }

  if (storedData.otp === otp) {
    otpStorage.delete(email);
    const token = process.env.ADMIN_TOKEN_SECRET || 'ff_super_secret_token_2026';
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Invalid OTP.' });
  }
});

// --- PRODUCTS ---
router.get('/products', async (req, res) => {
  try {
    const snapshot = await db.collection('products').get();
    const products = [];
    snapshot.forEach(doc => {
      products.push({ id: doc.id, ...doc.data() });
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/products', verifyAdmin, upload.single('image'), async (req, res) => {
  const { name, weight, price, note, popular } = req.body;
  const image = req.file ? `/images/uploads/${req.file.filename}` : '/images/pouch.png';

  const newProduct = {
    name,
    weight,
    price: Number(price),
    note,
    popular: popular === 'true',
    image
  };

  try {
    const docRef = await db.collection('products').add(newProduct);
    res.status(201).json({ success: true, product: { id: docRef.id, ...newProduct } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/products/:id', verifyAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    await db.collection('products').doc(id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ORDERS ---
router.get('/orders', async (req, res) => {
  try {
    // Return newest orders first
    const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();
    const orders = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    res.json(orders);
  } catch (error) {
    try {
      const snapshot = await db.collection('orders').get();
      const orders = [];
      snapshot.forEach(doc => {
        orders.push({ id: doc.id, ...doc.data() });
      });
      res.json(orders);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
});

router.post('/orders', async (req, res) => {
  const order = req.body;
  order.status = 'Pending';
  order.createdAt = admin.firestore.FieldValue.serverTimestamp();

  try {
    const docRef = await db.collection('orders').add(order);
    res.json({ success: true, order: { id: docRef.id, ...order } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/orders/:id/status', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    await db.collection('orders').doc(id).update({ status });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/orders/customer/:email', async (req, res) => {
  const { email } = req.params;
  try {
    const snapshot = await db.collection('orders').where('customer.email', '==', email).get();
    const orders = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/orders/:id/review', async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;
  try {
    await db.collection('orders').doc(id).update({
      review: { rating, comment, date: new Date().toLocaleString('en-IN') }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/orders/:id/complaint', async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  try {
    await db.collection('orders').doc(id).update({
      complaint: { text, date: new Date().toLocaleString('en-IN') }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- CUSTOMERS ---
router.get('/customers', async (req, res) => {
  try {
    const snapshot = await db.collection('customers').get();
    const customers = [];
    snapshot.forEach(doc => {
      customers.push({ id: doc.id, ...doc.data() });
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/customers', async (req, res) => {
  const customer = req.body;
  try {
    // Check if customer exists
    const snapshot = await db.collection('customers').where('email', '==', customer.email).get();
    if (!snapshot.empty) {
      return res.status(400).json({ error: 'Customer already exists' });
    }

    customer.createdAt = admin.firestore.FieldValue.serverTimestamp();
    const docRef = await db.collection('customers').add(customer);
    res.json({ success: true, customer: { id: docRef.id, ...customer } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- CUSTOMER AUTH: OTP ---
router.post('/customers/request-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStorage.set(email.toLowerCase(), { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

  try {
    await transporter.sendMail({
      from: `"Farmers Farm" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Login OTP for Farmers Farm',
      html: `<h3>Welcome to Farmers Farm!</h3><p>Your OTP for login is: <strong style="font-size:24px;">${otp}</strong></p><p>This OTP is valid for 10 minutes.</p>`
    });
    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Failed to send OTP email' });
  }
});

router.post('/customers/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  const storedData = otpStorage.get(email.toLowerCase());

  if (!storedData || Date.now() > storedData.expiresAt || storedData.otp !== otp) {
    return res.status(401).json({ error: 'Invalid or expired OTP' });
  }

  otpStorage.delete(email.toLowerCase());

  try {
    let customerData;
    const snapshot = await db.collection('customers').where('email', '==', email.toLowerCase()).get();
    
    if (snapshot.empty) {
      // Create new customer if they don't exist
      const newCustomer = { email: email.toLowerCase(), name: email.split('@')[0], createdAt: admin.firestore.FieldValue.serverTimestamp() };
      const docRef = await db.collection('customers').add(newCustomer);
      customerData = { id: docRef.id, ...newCustomer };
    } else {
      snapshot.forEach(doc => { customerData = { id: docRef.id, ...doc.data() }; });
    }
    res.json({ success: true, customer: customerData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- CUSTOMER AUTH: GOOGLE LOGIN ---
router.post('/customers/google-login', async (req, res) => {
  const { credential } = req.body;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const email = payload.email.toLowerCase();
    const name = payload.name;

    let customerData;
    const snapshot = await db.collection('customers').where('email', '==', email).get();
    if (snapshot.empty) {
      const newCustomer = { email, name, createdAt: admin.firestore.FieldValue.serverTimestamp() };
      const docRef = await db.collection('customers').add(newCustomer);
      customerData = { id: docRef.id, ...newCustomer };
    } else {
      snapshot.forEach(doc => { customerData = { id: doc.id, ...doc.data() }; });
    }
    res.json({ success: true, customer: customerData });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(401).json({ error: 'Google authentication failed' });
  }
});

// --- FEEDBACKS ---
router.get('/feedbacks', async (req, res) => {
  try {
    const snapshot = await db.collection('feedbacks').orderBy('createdAt', 'desc').get();
    const feedbacks = [];
    snapshot.forEach(doc => {
      feedbacks.push({ id: doc.id, ...doc.data() });
    });
    res.json(feedbacks);
  } catch (error) {
    try {
      const snapshot = await db.collection('feedbacks').get();
      const feedbacks = [];
      snapshot.forEach(doc => {
        feedbacks.push({ id: doc.id, ...doc.data() });
      });
      res.json(feedbacks);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
});

router.post('/feedbacks', async (req, res) => {
  const feedback = req.body;
  feedback.createdAt = admin.firestore.FieldValue.serverTimestamp();
  try {
    await db.collection('feedbacks').add(feedback);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- RAZORPAY PAYMENTS ---
router.post('/payment/create', async (req, res) => {
  const { amount } = req.body;

  try {
    const options = {
      amount: amount * 100, // Amount in paise
      currency: "INR",
      receipt: "receipt_order_" + Date.now(),
    };

    // In a real scenario with valid keys, this creates an order on Razorpay
    // const order = await razorpay.orders.create(options);

    // For now, we mock the order creation if using dummy keys
    const order = {
      id: "order_" + Date.now(),
      amount: options.amount,
      currency: "INR"
    };

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/payment/verify', (req, res) => {
  res.json({ success: true });
});

module.exports = router;
