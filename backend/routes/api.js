const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Initialize Firebase Admin
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
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

// --- ADMIN LOGIN (Email only, no password, no OTP) ---
const ADMIN_EMAIL = 'admin@farmersfarm.in';

router.post('/admin/login', (req, res) => {
  const { email } = req.body;

  if (email && email.trim().toLowerCase() === ADMIN_EMAIL) {
    const token = process.env.ADMIN_TOKEN_SECRET || 'ff_super_secret_token_2026';
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Access denied.' });
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

router.post('/customers/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const snapshot = await db.collection('customers')
      .where('email', '==', email)
      .where('password', '==', password)
      .get();

    if (snapshot.empty) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    let customerData;
    snapshot.forEach(doc => {
      customerData = { id: doc.id, ...doc.data() };
    });

    res.json({ success: true, customer: customerData });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
