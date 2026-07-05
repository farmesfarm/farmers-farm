const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');

// Mock Database (Since Firebase isn't connected yet)
let products = [
  { id: 1, icon: '🫙', weight: '40g', name: 'Taster Pack', price: 120, note: '~20 cups · Perfect for first-timers', popular: false },
  { id: 2, icon: '🫙', weight: '100g', name: 'Starter Pack', price: 280, note: '~50 cups · Great for solo brewers', popular: false },
  { id: 3, icon: '🫙', weight: '250g', name: 'Classic Pack', price: 620, note: '~125 cups · Most popular choice', popular: true },
  { id: 4, icon: '🫙', weight: '500g', name: 'Family Pack', price: 1100, note: '~250 cups · For the whole family', popular: false },
  { id: 5, icon: '🏺', weight: '750g', name: 'Estate Pack', price: 1580, note: '~375 cups · Value for regulars', popular: false },
  { id: 6, icon: '🏺', weight: '1kg', name: 'Harvest Pack', price: 1999, note: '~500 cups · Best value per cup', popular: false },
];
let orders = [];
let customers = [];
let feedbacks = [];

// Initialize Razorpay (Dummy keys for now until provided)
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
});

// --- PRODUCTS ---
router.get('/products', (req, res) => {
  res.json(products);
});

router.post('/products', (req, res) => {
  const product = req.body;
  const index = products.findIndex(p => p.id === product.id);
  if (index !== -1) {
    products[index] = product; // Update
  } else {
    product.id = products.length ? Math.max(...products.map(p => p.id)) + 1 : 1;
    products.push(product);
  }
  res.json({ success: true, product });
});

router.delete('/products/:id', (req, res) => {
  products = products.filter(p => p.id !== parseInt(req.params.id));
  res.json({ success: true });
});

// --- ORDERS ---
router.get('/orders', (req, res) => {
  res.json(orders);
});

router.post('/orders', (req, res) => {
  const order = req.body;
  orders.unshift(order);
  res.json({ success: true, order });
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
