const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const nodemailer = require('nodemailer');

// Mock Database (Since Firebase isn't connected yet)
const path = require('path');
const fs = require('fs');
const multer = require('multer');

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

// Mock Database (Since Firebase isn't connected yet)
let products = [];
let orders = [];
let customers = [];
let feedbacks = [];

// Initialize Razorpay (Dummy keys for now until provided)
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

// --- OTP STORAGE (In-memory) ---
const otpStorage = new Map(); // Stores: email => { otp, expiresAt }

router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;

  // Yahan aap 2-4 ya jitne chahein admin accounts add kar sakte hain
  const validAdmins = [
    { email: process.env.ADMIN_EMAIL || 'admin@farmersfarm.in', password: process.env.ADMIN_PASS || 'farm@2026' },
    { email: 'akash@farmersfarm.in', password: 'akashpassword' },
    { email: 'ansh@farmersfarm.in', password: '[ansh]' }
  ];

  // Check if entered email and password matches any in our list
  const matchedAdmin = validAdmins.find(admin => admin.email === email && admin.password === password);

  if (matchedAdmin) {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
    
    otpStorage.set(email, { otp, expiresAt });
    
    // Configure Email Transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    try {
      if(process.env.EMAIL_USER && process.env.EMAIL_USER !== 'your_gmail@gmail.com') {
        await transporter.sendMail({
          from: `"Farmers Farm Admin" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Your Admin Login OTP',
          text: `Your OTP for Admin Dashboard is: ${otp}. It is valid for 10 minutes.`,
          html: `<h3>Admin Login OTP</h3><p>Your OTP for Farmers Farm Admin Dashboard is: <strong>${otp}</strong>.</p><p>It is valid for 10 minutes.</p>`
        });
      } else {
        // If email is not configured, we print the OTP to the console for testing
        console.log(`\n\n[DEVELOPMENT MODE] OTP for ${email} is: ${otp}\n\n`);
      }
      res.json({ success: true, step: 'otp' });
    } catch (err) {
      console.error('Email sending failed:', err);
      res.status(500).json({ error: 'Failed to send OTP email. Check terminal for DEV mode OTP.' });
    }
  } else {
    res.status(401).json({ error: 'Invalid admin credentials' });
  }
});

// --- ADMIN VERIFY OTP ---
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
    // Success - OTP matched!
    otpStorage.delete(email); // Clear OTP after success
    const token = process.env.ADMIN_TOKEN_SECRET || 'ff_super_secret_token_2026';
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Invalid OTP.' });
  }
});

// --- PRODUCTS ---
router.get('/products', (req, res) => {
  res.json(products);
});

// Admin: Add Product
router.post('/products', verifyAdmin, upload.single('image'), (req, res) => {
  const { name, weight, price, note, popular } = req.body;
  const image = req.file ? `/images/uploads/${req.file.filename}` : '/images/pouch.png';

  const newProduct = {
    id: Date.now(),
    name,
    weight,
    price: Number(price),
    note,
    popular: popular === 'true',
    image
  };

  products.push(newProduct);
  res.status(201).json({ success: true, product: newProduct });
});

// Admin: Delete Product
router.delete('/products/:id', verifyAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  products = products.filter(p => p.id !== id);
  res.json({ success: true });
});

// Duplicate routes removed

// --- ORDERS ---
router.get('/orders', (req, res) => {
  res.json(orders);
});

router.post('/orders', (req, res) => {
  const order = req.body;
  order.status = 'Pending'; // Default status
  orders.unshift(order);
  res.json({ success: true, order });
});

router.put('/orders/:id/status', verifyAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const order = orders.find(o => o.id === id);
  if (order) {
    order.status = status;
    res.json({ success: true, order });
  } else {
    res.status(404).json({ error: 'Order not found' });
  }
});

router.get('/orders/customer/:email', (req, res) => {
  const { email } = req.params;
  const customerOrders = orders.filter(o => o.customer && o.customer.email === email);
  res.json(customerOrders);
});

router.post('/orders/:id/review', (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;
  const order = orders.find(o => o.id === id);
  if (order) {
    order.review = { rating, comment, date: new Date().toLocaleString('en-IN') };
    res.json({ success: true, order });
  } else {
    res.status(404).json({ error: 'Order not found' });
  }
});

router.post('/orders/:id/complaint', (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const order = orders.find(o => o.id === id);
  if (order) {
    order.complaint = { text, date: new Date().toLocaleString('en-IN') };
    res.json({ success: true, order });
  } else {
    res.status(404).json({ error: 'Order not found' });
  }
});

// --- CUSTOMERS ---
router.get('/customers', (req, res) => {
  res.json(customers);
});

router.post('/customers', (req, res) => {
  const customer = req.body;
  if (!customers.find(c => c.email === customer.email)) {
    customers.push(customer);
    res.json({ success: true, customer });
  } else {
    res.status(400).json({ error: 'Customer already exists' });
  }
});

router.post('/customers/login', (req, res) => {
  const { email, password } = req.body;
  const customer = customers.find(c => c.email === email && c.password === password);
  if (customer) {
    res.json({ success: true, customer });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// --- FEEDBACKS ---
router.get('/feedbacks', (req, res) => {
  res.json(feedbacks);
});

router.post('/feedbacks', (req, res) => {
  feedbacks.unshift(req.body);
  res.json({ success: true });
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
  // In a real app, you would verify the signature here using crypto
  // const crypto = require('crypto');
  // const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  // const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
  // hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
  // const generated_signature = hmac.digest('hex');
  // if (generated_signature === razorpay_signature) { res.json({ success: true }) }

  // Mock success for now
  res.json({ success: true });
});

module.exports = router;
