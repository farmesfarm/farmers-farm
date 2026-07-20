const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { OAuth2Client } = require('google-auth-library');
const cloudinary = require('cloudinary').v2;

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  if (process.env.NODE_ENV === 'production') throw new Error('Cloudinary environment variables are missing.');
  console.warn('WARNING: Cloudinary environment variables are missing.');
}
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dummy',
  api_key: process.env.CLOUDINARY_API_KEY || 'dummy',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'dummy'
});

// Multer Setup for In-Memory Uploads (Reviews)
const reviewStorage = multer.memoryStorage();
const reviewUpload = multer({ storage: reviewStorage });
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
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// --- EMAIL NOTIFICATION SERVICE ---
const sendOrderEmail = async (toEmail, subject, text) => {
  console.log(`[EMAIL INITIATED] Attempting to send email to: ${toEmail}`);
  if (!toEmail) {
    console.log('[EMAIL ABORTED] No email address provided.');
    return;
  }
  try {
    // Format text to HTML to avoid Spam filters
    const htmlContent = text.replace(/\n/g, '<br>');
    await transporter.sendMail({
      from: `"Farmers Farm" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: subject,
      html: `<div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #2D5A27;">Farmers Farm</h2>
              <p>${htmlContent}</p>
             </div>`
    });
    console.log(`✉️ [EMAIL SENT] Successfully sent to ${toEmail}`);
  } catch (err) {
    console.error(`✉️ [EMAIL FAILED] Could not send to ${toEmail}:`, err);
  }
};

// Initialize Firebase Admin
const { admin, db } = require('../firebase');

// Setup Multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Initialize Razorpay
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  if (process.env.NODE_ENV === 'production') throw new Error('Razorpay keys are missing.');
  console.warn('WARNING: Razorpay keys are missing.');
}
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy',
});

// Admin Token Setup
if (!process.env.ADMIN_TOKEN_SECRET) {
  if (process.env.NODE_ENV === 'production') throw new Error('ADMIN_TOKEN_SECRET is missing.');
  console.warn('WARNING: ADMIN_TOKEN_SECRET is missing.');
}
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || 'ff_super_secret_token_2026';

// --- ADMIN LOGIN & MIDDLEWARE ---
const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const expectedToken = ADMIN_TOKEN_SECRET;
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
    const token = ADMIN_TOKEN_SECRET;
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
    const token = ADMIN_TOKEN_SECRET;
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
  let image = '/images/pouch.png';
  
  if (req.file) {
    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder: 'farmers-farm' }, (error, result) => {
          if (result) resolve(result);
          else reject(error);
        });
        stream.end(req.file.buffer);
      });
      image = result.secure_url;
    } catch (err) {
      console.error('Cloudinary Upload Error:', err);
      return res.status(500).json({ error: 'Image upload to Cloudinary failed.' });
    }
  }

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

router.put('/products/:id', verifyAdmin, upload.single('image'), async (req, res) => {
  const { name, weight, price, note, popular } = req.body;
  const updateData = {
    name,
    weight,
    price: Number(price),
    note,
    popular: popular === 'true'
  };

  if (req.file) {
    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder: 'farmers-farm' }, (error, result) => {
          if (result) resolve(result);
          else reject(error);
        });
        stream.end(req.file.buffer);
      });
      updateData.image = result.secure_url;
    } catch (err) {
      console.error('Cloudinary Upload Error:', err);
      return res.status(500).json({ error: 'Image upload to Cloudinary failed.' });
    }
  }

  try {
    const id = req.params.id;
    await db.collection('products').doc(id).update(updateData);
    res.json({ success: true, product: { id, ...updateData } });
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

// --- PROMO CODES ---
router.get('/admin/promos', verifyAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('promos').get();
    const promos = [];
    snapshot.forEach(doc => {
      promos.push({ id: doc.id, ...doc.data() });
    });
    res.json(promos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/promos', verifyAdmin, async (req, res) => {
  const { code, discountPercentage, active } = req.body;
  if (!code || !discountPercentage) {
    return res.status(400).json({ error: 'Code and discount percentage are required' });
  }
  
  try {
    const promoCode = code.toUpperCase().trim();
    await db.collection('promos').doc(promoCode).set({
      code: promoCode,
      discountPercentage: Number(discountPercentage),
      active: active !== false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/admin/promos/:id', verifyAdmin, async (req, res) => {
  try {
    await db.collection('promos').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/promos/validate', async (req, res) => {
  const { code, total } = req.body;
  if (!code) return res.status(400).json({ error: 'Code is required' });
  
  try {
    const promoCode = code.toUpperCase().trim();
    const doc = await db.collection('promos').doc(promoCode).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Invalid Promo Code' });
    }
    
    const data = doc.data();
    if (!data.active) {
      return res.status(400).json({ error: 'Promo Code is no longer active' });
    }
    
    const discountAmount = (total * data.discountPercentage) / 100;
    const finalTotal = total - discountAmount;
    
    res.json({ 
      success: true, 
      promoCode: data.code,
      discountPercentage: data.discountPercentage,
      discountAmount,
      finalTotal 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ABANDONED CART RECOVERY ---
router.post('/cart/sync', async (req, res) => {
  const { email, name, items, total } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    if (!items || items.length === 0) {
      // If cart is emptied, remove the tracking
      await db.collection('abandoned_carts').doc(email).delete();
    } else {
      // Update cart state
      await db.collection('abandoned_carts').doc(email).set({
        email,
        name,
        items,
        total,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        recoveryEmailSent: false
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    // Save order using its generated ORD-XXXX ID as the document ID
    await db.collection('orders').doc(order.id).set(order);
    
    // Clear abandoned cart if it exists
    if (order.customer?.email) {
      await db.collection('abandoned_carts').doc(order.customer.email).delete().catch(() => {});
    }
    
    // Send Order Confirmation Email
    const email = order.customer?.email;
    const subject = `Order Confirmed - Farmers Farm (#${order.id})`;
    const message = `Hi ${order.customer?.name || 'Customer'},\n\nYour order #${order.id} for Farmers Farm has been confirmed! 🌿\n\nTotal: ₹${order.total.toLocaleString('en-IN')}\nPayment: ${order.paymentMethod}\n\nWe will notify you once it's shipped. Thank you!`;
    sendOrderEmail(email, subject, message);

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/orders/:id/status', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    // Find the order by its custom ID (ORD-XXXX)
    const snapshot = await db.collection('orders').where('id', '==', id).get();
    let docRef;
    let orderData;

    if (!snapshot.empty) {
      docRef = snapshot.docs[0].ref;
      orderData = snapshot.docs[0].data();
    } else {
      // Fallback: Check if it exists by document ID
      const doc = await db.collection('orders').doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Order not found' });
      }
      docRef = doc.ref;
      orderData = doc.data();
    }

    await docRef.update({ status });
    
    // Send Email notification
    const email = orderData.customer?.email;
    const subject = `Order Update - Farmers Farm (#${id})`;
    let message = `Update on your Farmers Farm order #${id}: \n\nYour order is now ${status}.`;
    if (status === 'Shipped') {
      message += ` 🚚 It is on its way to you!`;
    } else if (status === 'Delivered') {
      message += ` ✅ It has been delivered. Enjoy your tea! 🍵`;
    }
    sendOrderEmail(email, subject, message);

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

// --- PRODUCT REVIEWS (PHOTO REVIEWS) ---
router.post('/products/:id/reviews', reviewUpload.single('photo'), async (req, res) => {
  const { id } = req.params; // Product ID
  const { rating, comment, name } = req.body;
  
  try {
    const reviewData = {
      productId: id,
      name: name || 'Anonymous',
      rating: parseInt(rating) || 5,
      comment: comment || '',
      date: new Date().toLocaleString('en-IN'),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (req.file) {
      try {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream({ folder: 'farmers-farm/reviews' }, (error, result) => {
            if (result) resolve(result);
            else reject(error);
          });
          stream.end(req.file.buffer);
        });
        reviewData.photoUrl = result.secure_url;
      } catch (err) {
        console.error('Cloudinary Review Upload Error:', err);
        return res.status(500).json({ error: 'Image upload to Cloudinary failed.' });
      }
    }

    const docRef = await db.collection('product_reviews').add(reviewData);
    res.json({ success: true, review: { id: docRef.id, ...reviewData } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/products/:id/reviews', async (req, res) => {
  const { id } = req.params;
  try {
    const snapshot = await db.collection('product_reviews')
      .where('productId', '==', id)
      .orderBy('createdAt', 'desc')
      .get();
      
    const reviews = [];
    snapshot.forEach(doc => {
      reviews.push({ id: doc.id, ...doc.data() });
    });
    res.json(reviews);
  } catch (error) {
    // If index is missing, fallback without orderBy
    try {
       const snapshot = await db.collection('product_reviews').where('productId', '==', id).get();
       const reviews = [];
       snapshot.forEach(doc => reviews.push({ id: doc.id, ...doc.data() }));
       res.json(reviews.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch(err) {
       res.status(500).json({ error: err.message });
    }
  }
});

router.get('/admin/reviews', verifyAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('product_reviews').orderBy('createdAt', 'desc').get();
    const reviews = [];
    snapshot.forEach(doc => reviews.push({ id: doc.id, ...doc.data() }));
    res.json(reviews);
  } catch (error) {
    try {
      const snapshot = await db.collection('product_reviews').get();
      const reviews = [];
      snapshot.forEach(doc => reviews.push({ id: doc.id, ...doc.data() }));
      res.json(reviews);
    } catch(err) {
      res.status(500).json({ error: err.message });
    }
  }
});

router.get('/reviews', async (req, res) => {
  try {
    const snapshot = await db.collection('product_reviews').orderBy('createdAt', 'desc').limit(20).get();
    const reviews = [];
    snapshot.forEach(doc => reviews.push({ id: doc.id, ...doc.data() }));
    res.json(reviews);
  } catch (error) {
    try {
      const snapshot = await db.collection('product_reviews').get();
      const reviews = [];
      snapshot.forEach(doc => reviews.push({ id: doc.id, ...doc.data() }));
      res.json(reviews.slice(0, 20));
    } catch(err) {
      res.status(500).json({ error: err.message });
    }
  }
});

router.delete('/admin/reviews/:id', verifyAdmin, async (req, res) => {
  try {
    await db.collection('product_reviews').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- BLOGS & SEO ---
router.get('/blogs', async (req, res) => {
  try {
    const snapshot = await db.collection('blogs').orderBy('createdAt', 'desc').get();
    const blogs = [];
    snapshot.forEach(doc => blogs.push({ id: doc.id, ...doc.data() }));
    res.json(blogs);
  } catch (error) {
    try {
      const snapshot = await db.collection('blogs').get();
      const blogs = [];
      snapshot.forEach(doc => blogs.push({ id: doc.id, ...doc.data() }));
      res.json(blogs);
    } catch(err) {
      res.status(500).json({ error: err.message });
    }
  }
});

router.get('/blogs/:slug', async (req, res) => {
  try {
    const snapshot = await db.collection('blogs').where('slug', '==', req.params.slug).get();
    if (snapshot.empty) return res.status(404).json({ error: 'Blog not found' });
    res.json({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/blogs', verifyAdmin, async (req, res) => {
  try {
    const { title, slug, content, excerpt, metaDescription, keywords, imageUrl } = req.body;
    const blogData = {
      title,
      slug,
      content,
      excerpt,
      metaDescription,
      keywords,
      imageUrl,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    const docRef = await db.collection('blogs').add(blogData);
    res.json({ success: true, blog: { id: docRef.id, ...blogData } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/admin/blogs/:id', verifyAdmin, async (req, res) => {
  try {
    await db.collection('blogs').doc(req.params.id).delete();
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
    // Send email in the background without awaiting it to speed up UI response
    transporter.sendMail({
      from: `"Farmers Farm" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Login OTP for Farmers Farm',
      html: `<h3>Welcome to Farmers Farm!</h3><p>Your OTP for login is: <strong style="font-size:24px;">${otp}</strong></p><p>This OTP is valid for 10 minutes.</p>`
    }).catch(error => console.error('Background Error sending OTP:', error));
    
    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error in request OTP:', error);
    res.status(500).json({ error: 'Failed to request OTP' });
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
      snapshot.forEach(doc => { customerData = { id: doc.id, ...doc.data() }; });
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

// --- CUSTOMER PROFILE & WISHLIST ---
router.post('/customers/:email/wishlist', async (req, res) => {
  const { wishlist } = req.body;
  const email = req.params.email.toLowerCase();
  try {
    const snapshot = await db.collection('customers').where('email', '==', email).get();
    if (snapshot.empty) return res.status(404).json({ error: 'Customer not found' });
    
    const customerId = snapshot.docs[0].id;
    await db.collection('customers').doc(customerId).update({ wishlist: wishlist || [] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/customers/:email/wishlist', async (req, res) => {
  const email = req.params.email.toLowerCase();
  try {
    const snapshot = await db.collection('customers').where('email', '==', email).get();
    if (snapshot.empty) return res.status(404).json({ error: 'Customer not found' });
    
    const customerData = snapshot.docs[0].data();
    res.json(customerData.wishlist || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/customers/:email', async (req, res) => {
  const email = req.params.email.toLowerCase();
  const updateData = req.body;
  try {
    const snapshot = await db.collection('customers').where('email', '==', email).get();
    if (snapshot.empty) return res.status(404).json({ error: 'Customer not found' });
    
    const customerId = snapshot.docs[0].id;
    await db.collection('customers').doc(customerId).update(updateData);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

  // If no Razorpay keys, return COD mock
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return res.json({
      id: 'cod_' + Date.now(),
      amount: amount * 100,
      currency: 'INR',
      cod: true
    });
  }

  try {
    const options = {
      amount: Math.round(amount * 100), // Amount in paise
      currency: 'INR',
      receipt: 'receipt_' + Date.now(),
    };
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error('Razorpay Order Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/payment/verify', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  // If no keys configured, just pass through
  if (!process.env.RAZORPAY_KEY_SECRET) {
    return res.json({ success: true });
  }

  try {
    const crypto = require('crypto');
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

// --- ABANDONED CART BACKGROUND JOB ---
// Runs every 30 minutes to check for abandoned carts older than 2 hours
async function processAbandonedCarts() {
  console.log('[CRON] Checking for abandoned carts...');
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const snapshot = await db.collection('abandoned_carts')
      .where('recoveryEmailSent', '==', false)
      .get();
      
    if (snapshot.empty) return;
    
    for (const doc of snapshot.docs) {
      try {
        const cart = doc.data();
        // Check if lastUpdated is older than 2 hours
        const lastUpdatedDate = cart.lastUpdated?.toDate ? cart.lastUpdated.toDate() : new Date();
        if (lastUpdatedDate < twoHoursAgo) {
          const email = cart.email;
          const name = cart.name || 'Tea Lover';
          const subject = `Did you forget something, ${name}? 🌿`;
          
          let itemsHtml = cart.items.map(i => `<li>${i.name} (${i.size || i.weight}) x${i.qty}</li>`).join('');
          
          const message = `
            Hi ${name},<br><br>
            We noticed you left some delicious tea in your cart at Farmers Farm.<br>
            We've saved your selections so you can easily complete your purchase whenever you're ready.<br><br>
            <b>Your Cart:</b><br>
            <ul>${itemsHtml}</ul><br>
            <b>Total:</b> ₹${cart.total.toLocaleString('en-IN')}<br><br>
            <a href="${process.env.APP_URL || 'https://farmersfarm.in'}/cart.html" style="background:#d4af37; color:#111; padding:10px 20px; text-decoration:none; font-weight:bold; border-radius:4px;">Complete Purchase</a><br><br>
            Warmly,<br>
            Farmers Farm Team
          `;
          
          await sendOrderEmail(email, subject, message);
          await doc.ref.update({ recoveryEmailSent: true });
        }
      } catch (innerErr) {
        console.error(`Error processing abandoned cart for doc ${doc.id}:`, innerErr);
      }
    }
  } catch (err) {
    console.error('Error running abandoned cart job:', err);
  }
}

// Run every 30 minutes
setInterval(processAbandonedCarts, 30 * 60 * 1000);

// Manual trigger for Admin
router.post('/admin/trigger-abandoned-carts', verifyAdmin, async (req, res) => {
  try {
    await processAbandonedCarts();
    res.json({ success: true, message: 'Abandoned cart job triggered.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- NEWSLETTER SUBSCRIPTION ---
router.post('/subscribe', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const snapshot = await db.collection('subscribers').where('email', '==', email.toLowerCase()).get();
    if (!snapshot.empty) {
      return res.json({ success: true, message: 'Already subscribed' });
    }
    await db.collection('subscribers').add({
      email: email.toLowerCase(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/subscribers', verifyAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('subscribers').orderBy('createdAt', 'desc').get();
    const subs = [];
    snapshot.forEach(doc => subs.push({ id: doc.id, ...doc.data() }));
    res.json(subs);
  } catch (err) {
    try {
      const snapshot = await db.collection('subscribers').get();
      const subs = [];
      snapshot.forEach(doc => subs.push({ id: doc.id, ...doc.data() }));
      res.json(subs);
    } catch (fallbackErr) {
      res.status(500).json({ error: fallbackErr.message });
    }
  }
});

module.exports = router;
