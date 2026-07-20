const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { db } = require('./firebase');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ── CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://farmersfarm.in',
  'https://www.farmersfarm.in'
];
if (process.env.RAILWAY_STATIC_URL) allowedOrigins.push(`https://${process.env.RAILWAY_STATIC_URL}`);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('railway.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// ── Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Route for admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// SSR Route for Blog Posts (SEO)
app.get('/blog/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    const snapshot = await db.collection('blogs').where('slug', '==', slug).get();
    if (snapshot.empty) {
      return res.status(404).send('Blog Post Not Found');
    }
    const blog = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    
    // Read the base blog.html template
    const templatePath = path.join(__dirname, '../public/blog.html');
    if (!fs.existsSync(templatePath)) {
      return res.status(404).send('Template Not Found');
    }
    
    let html = fs.readFileSync(templatePath, 'utf8');
    
    // Inject SEO Meta Tags
    html = html.replace('<title>Blog - Farmers Farm</title>', `<title>${blog.title} - Farmers Farm</title>`);
    html = html.replace('<!-- SEO_META_TAGS -->', `
      <meta name="description" content="${blog.metaDescription || blog.excerpt || blog.title}">
      <meta name="keywords" content="${blog.keywords || ''}">
      <meta property="og:title" content="${blog.title}">
      <meta property="og:description" content="${blog.metaDescription || blog.excerpt || blog.title}">
      <meta property="og:image" content="${blog.imageUrl || ''}">
    `);
    
    // Inject the blog content directly to HTML
    html = html.replace('<!-- BLOG_SSR_CONTENT -->', `
      <div class="blog-ssr-container">
        <h1 class="blog-ssr-title">${blog.title}</h1>
        ${blog.imageUrl ? `<img src="${blog.imageUrl}" class="blog-ssr-image" alt="${blog.title}">` : ''}
        <div class="blog-ssr-body">${blog.content}</div>
      </div>
      <script>window.INITIAL_BLOG_DATA = ${JSON.stringify(blog)};</script>
    `);
    
    res.send(html);
  } catch (error) {
    console.error('SSR Error:', error);
    res.status(500).send('Server Error');
  }
});

// Blog Listing Page
app.get('/blogs', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/blog.html'));
});

// Catch-all route to serve the frontend
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS: Origin not allowed.' });
  }
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🌐 CORS allows any origin dynamically`);
});
