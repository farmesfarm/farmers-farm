/* ═══════════════════════════════════════════════════════════════
   FARMERS FARM – 7 TEA AM  |  Main Application JS
   Customer Auth + Cart + Orders + Animations
   ═══════════════════════════════════════════════════════════════ */

// ── DEFAULT PRODUCTS ──
// Removed as per dynamic admin requirement

// ── DATA LAYER ──
let globalProductsCache = [];

async function fetchProducts() {
  try {
    const res = await fetch('/api/products');
    globalProductsCache = await res.json();
  } catch (err) {
    console.error('Error fetching products', err);
    globalProductsCache = [];
  }
}

function getProducts() {
  return globalProductsCache;
}

function getCart() {
  return JSON.parse(localStorage.getItem('ff_cart')) || [];
}
function saveCart(c) {
  localStorage.setItem('ff_cart', JSON.stringify(c));
}

async function saveOrder(order) {
  try {
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });
  } catch (err) {
    console.error(err);
  }
}

async function saveFeedback(feedback) {
  try {
    await fetch('/api/feedbacks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedback)
    });
  } catch (err) {
    console.error(err);
  }
}

// ── CUSTOMER AUTH ──
// Customer sessions will still use localStorage for the token/ID for simplicity,
// but actual auth goes to the backend.
function getLoggedInCustomer() {
  const customerJSON = localStorage.getItem('ff_customer_session');
  return customerJSON ? JSON.parse(customerJSON) : null;
}
function loginCustomer(customer) {
  localStorage.setItem('ff_customer_session', JSON.stringify(customer));
}
function logoutCustomer() {
  localStorage.removeItem('ff_customer_session');
}

// ── PRELOADER ──
window.addEventListener('load', () => {
  const preloader = document.getElementById('preloader');
  if (preloader) {
    preloader.classList.add('hide');
    setTimeout(() => preloader.remove(), 600);
  }
});

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  // Theme Toggle
  document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    document.documentElement.setAttribute('data-theme', isLight ? 'dark' : 'light');
  });

  const leafBg = document.getElementById('leafBg');
  if (leafBg) {
    const symbols = ['🍃','🌿','🍵','🌱','✨'];
    for (let i = 0; i < 18; i++) {
      const el = document.createElement('div');
      el.className = 'leaf';
      el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      el.style.left = Math.random() * 100 + '%';
      el.style.animationDuration = (8 + Math.random() * 14) + 's';
      el.style.animationDelay = (Math.random() * 12) + 's';
      el.style.fontSize = (16 + Math.random() * 24) + 'px';
      leafBg.appendChild(el);
    }
  }

  await fetchProducts();
  renderProducts();
  initScrollAnimations();
  initNavScroll();
  initHamburger();
  initCart();
  initBackToTop();
  initCursorSparkle();
  initTestimonialScroll();
  initCounters();
  initCustomerAuth();
});

// ── RENDER PRODUCTS ──
function renderProducts() {
  const grid = document.getElementById('packetsGrid');
  if (!grid) return;
  const products = getProducts();
  grid.innerHTML = '';
  
  if (!Array.isArray(products) || products.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 60px; color: var(--gold); font-size: 20px;">Premium products are brewing! Check back later.</div>';
    return;
  }

  products.forEach(p => {
    const card = document.createElement('div');
    card.className = 'packet-card' + (p.popular ? ' popular' : '');
    card.innerHTML = `
      ${p.popular ? '<div class="popular-badge">Best Seller</div>' : ''}
      <img src="${p.image || '/images/pouch.png'}" alt="${p.name}" class="packet-image" />
      <div class="packet-weight">${p.weight}</div>
      <div class="packet-label">${p.name}</div>
      <div class="packet-price">₹${p.price.toLocaleString('en-IN')}</div>
      <div class="packet-note">${p.note}</div>
      <button class="add-btn" onclick="addToCart(${p.id})">Add to Cart</button>
    `;
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('add-btn')) return;
      openQuickView(p);
    });
    grid.appendChild(card);
  });
}

// ── QUICK VIEW ──
function openQuickView(product) {
  const overlay = document.getElementById('quickviewOverlay');
  const imgEl = document.getElementById('qvIcon');
  if(imgEl) {
    imgEl.outerHTML = `<img src="${product.image || '/images/pouch.png'}" id="qvIcon" alt="Product" class="qv-image" />`;
  }
  document.getElementById('qvWeight').textContent = product.weight;
  document.getElementById('qvName').textContent = product.name;
  document.getElementById('qvPrice').textContent = '₹' + product.price.toLocaleString('en-IN');
  document.getElementById('qvDesc').textContent = product.note;
  document.getElementById('qvAddBtn').onclick = () => { addToCart(product.id); closeQuickView(); };
  overlay.classList.add('open');
}
function closeQuickView() {
  document.getElementById('quickviewOverlay').classList.remove('open');
}

// ── CART SYSTEM ──
let cart = [];
function initCart() {
  cart = getCart();
  updateCartUI();
  document.getElementById('cartIcon')?.addEventListener('click', openCartDrawer);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCartDrawer);
  document.getElementById('cartClose')?.addEventListener('click', closeCartDrawer);
  document.getElementById('checkoutBtn')?.addEventListener('click', checkout);
}

function addToCart(productId) {
  const products = getProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const existing = cart.find(c => c.id === productId);
  if (existing) { existing.qty++; } else { cart.push({ ...product, qty: 1 }); }
  saveCart(cart);
  updateCartUI();
  showToast('✅ ' + product.weight + ' ' + product.name + ' added to cart!');
  const count = document.getElementById('cartCount');
  if (count) { count.classList.remove('bump'); void count.offsetWidth; count.classList.add('bump'); }
}

function removeFromCart(productId) {
  cart = cart.filter(c => c.id !== productId);
  saveCart(cart); updateCartUI();
}

function changeQty(productId, delta) {
  const item = cart.find(c => c.id === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) { removeFromCart(productId); return; }
  saveCart(cart); updateCartUI();
}

function updateCartUI() {
  const count = document.getElementById('cartCount');
  const totalItems = cart.reduce((sum, c) => sum + c.qty, 0);
  const totalPrice = cart.reduce((sum, c) => sum + (c.price * c.qty), 0);
  if (count) { count.textContent = totalItems; count.classList.toggle('show', totalItems > 0); }

  const cartItemsEl = document.getElementById('cartItems');
  if (!cartItemsEl) return;

  if (cart.length === 0) {
    cartItemsEl.innerHTML = `<div class="cart-empty"><span class="cart-empty-icon">🛒</span><p>Your cart is empty</p></div>`;
  } else {
    cartItemsEl.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img src="${item.image || '/images/pouch.png'}" class="cart-item-image" alt="${item.name}" />
        <div class="cart-item-info">
          <div class="cart-item-name">${item.weight} ${item.name}</div>
          <div class="cart-item-price">₹${(item.price * item.qty).toLocaleString('en-IN')}</div>
        </div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
        </div>
      </div>
    `).join('');
  }

  const totalEl = document.getElementById('cartTotal');
  if (totalEl) totalEl.textContent = '₹' + totalPrice.toLocaleString('en-IN');
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;
}

function openCartDrawer() {
  document.getElementById('cartOverlay')?.classList.add('open');
  document.getElementById('cartDrawer')?.classList.add('open');
}
function closeCartDrawer() {
  document.getElementById('cartOverlay')?.classList.remove('open');
  document.getElementById('cartDrawer')?.classList.remove('open');
}

function checkout() {
  if (cart.length === 0) return;

  // Check if customer is logged in
  const customer = getLoggedInCustomer();
  if (!customer) {
    closeCartDrawer();
    showToast('⚠️ Please login first to place an order.');
    setTimeout(() => openAuthModal(), 500);
    return;
  }

  // Open address modal instead of directly placing order
  closeCartDrawer();
  document.getElementById('addressOverlay')?.classList.add('open');
}

function closeAddressModal() {
  document.getElementById('addressOverlay')?.classList.remove('open');
}

// Location API integration
document.getElementById('getLocationBtn')?.addEventListener('click', () => {
  const btn = document.getElementById('getLocationBtn');
  btn.innerHTML = '<span class="loc-icon">⏳</span> Fetching location...';
  
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        document.getElementById('checkoutLat').value = position.coords.latitude;
        document.getElementById('checkoutLng').value = position.coords.longitude;
        btn.innerHTML = '<span class="loc-icon">✅</span> Location Secured';
        btn.style.borderColor = 'var(--gold)';
        btn.style.color = 'var(--gold)';
        showToast('📍 GPS Location added to your order!');
      },
      (error) => {
        btn.innerHTML = '<span class="loc-icon">📍</span> Try Again';
        showToast('⚠️ Could not fetch location. Please type your address manually.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  } else {
    showToast('⚠️ Geolocation is not supported by your browser.');
  }
});

// Finalize Order – COD / Online Payment
document.getElementById('checkoutAddressForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const customer = getLoggedInCustomer();
  if (!customer || cart.length === 0) return;

  const address = document.getElementById('checkoutAddress').value.trim();
  const city    = document.getElementById('checkoutCity').value.trim();
  const pin     = document.getElementById('checkoutPin').value.trim();
  const lat     = document.getElementById('checkoutLat').value;
  const lng     = document.getElementById('checkoutLng').value;

  if (!address || !city || !pin) {
    showToast('⚠️ Please fill in all address fields.');
    return;
  }
  if (!/^\d{6}$/.test(pin)) {
    showToast('⚠️ Please enter a valid 6-digit PIN code.');
    return;
  }

  const totalPrice = cart.reduce((sum, c) => sum + (c.price * c.qty), 0);

  const btn = e.target.querySelector('button[type="submit"]');
  btn.innerHTML = '⏳ Placing Order...';
  btn.disabled = true;

  try {
    // Step 1: Get payment mode from server
    const payRes = await fetch('/api/payment/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: totalPrice })
    });
    const payData = await payRes.json();

    if (!payRes.ok || !payData.success) {
      throw new Error(payData.error || 'Payment initiation failed.');
    }

    // Step 2: Verify (COD always passes, Razorpay sends real data)
    const verifyRes = await fetch('/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: payData.mode })
    });
    const verifyData = await verifyRes.json();

    if (!verifyRes.ok || !verifyData.success) {
      throw new Error('Payment verification failed.');
    }

    // Step 3: Save order to Firestore
    const order = {
      id: 'ORD-' + Date.now().toString(36).toUpperCase(),
      date: new Date().toLocaleString('en-IN'),
      items: cart.map(c => `${c.weight} ${c.name} x${c.qty}`),
      total: totalPrice,
      paymentMethod: payData.mode === 'online' ? 'Online' : 'COD',
      paymentId: verifyData.paymentId || null,
      customer: { name: customer.name, email: customer.email, phone: customer.phone },
      shipping: { address, city, pin, lat, lng }
    };

    await saveOrder(order);
    cart = [];
    saveCart(cart);
    updateCartUI();
    closeAddressModal();
    showCheckoutSuccess(order);
  } catch (err) {
    console.error(err);
    showToast('⚠️ ' + (err.message || 'Error placing order. Please try again.'));
    btn.innerHTML = 'Confirm Order →';
    btn.disabled = false;
  }
});

function showCheckoutSuccess(order) {
  const overlay = document.getElementById('checkoutOverlay');
  if (!overlay) return;
  document.getElementById('checkoutOrderId').textContent = order.id;
  document.getElementById('checkoutOrderTotal').textContent = '₹' + order.total.toLocaleString('en-IN');
  overlay.classList.add('open');
}
function closeCheckoutSuccess() {
  document.getElementById('checkoutOverlay')?.classList.remove('open');
}

// ── CUSTOMER AUTH ──
function initCustomerAuth() {
  updateAuthUI();

  // Auth modal tabs
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.auth-modal .auth-form').forEach(f => f.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.form)?.classList.add('active');
      document.getElementById('authError')?.classList.remove('show');
    });
  });

  // Send OTP
  document.getElementById('sendOtpBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('clEmail').value.trim().toLowerCase();
    if (!email) return showAuthError('Please enter your email first.');
    
    document.getElementById('sendOtpBtn').textContent = 'Sending...';
    try {
      const res = await fetch('/api/customers/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        document.getElementById('otpStep1').style.display = 'none';
        document.getElementById('otpStep2').style.display = 'block';
        document.getElementById('authError').classList.remove('show');
        showToast('OTP sent to your email!');
      } else {
        showAuthError(data.error || 'Failed to send OTP.');
      }
    } catch(err) {
      showAuthError('Server error. Try again.');
    } finally {
      document.getElementById('sendOtpBtn').textContent = 'Send OTP →';
    }
  });

  // Verify OTP (Login form submit)
  document.getElementById('loginFormContainer')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('clEmail').value.trim().toLowerCase();
    const otp = document.getElementById('clOtp').value.trim();
    
    document.getElementById('customerLoginForm').textContent = 'Verifying...';
    try {
      const res = await fetch('/api/customers/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        loginCustomer(data.customer);
        closeAuthModal();
        updateAuthUI();
        showToast('👋 Welcome, ' + data.customer.name + '!');
      } else {
        showAuthError(data.error || 'Invalid or expired OTP.');
      }
    } catch(err) {
      showAuthError('Server error. Try again.');
    } finally {
      document.getElementById('customerLoginForm').textContent = 'Verify OTP & Login';
    }
  });

  // Signup form
  document.getElementById('signupFormContainer')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('csName').value.trim();
    const email = document.getElementById('csEmail').value.trim().toLowerCase();
    const phone = document.getElementById('csPhone').value.trim();
    const pass = document.getElementById('csPass').value;

    if (!name || !email || !phone || !pass) {
      showAuthError('Please fill in all fields.');
      return;
    }
    if (pass.length < 6) {
      showAuthError('Password must be at least 6 characters.');
      return;
    }

    const newCustomer = {
      id: 'cust_' + Date.now().toString(36),
      name, email, phone, password: pass,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        loginCustomer(data.customer);
        closeAuthModal();
        updateAuthUI();
        showToast('🎉 Welcome to Farmers Farm, ' + name + '!');
      } else {
        showAuthError(data.error || 'Signup failed.');
      }
    } catch(err) {
      showAuthError('Server error.');
    }
  });

  // User icon click
  document.getElementById('navUserBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleUserDropdown();
  });

  // Close dropdown on outside click
  document.addEventListener('click', () => {
    document.getElementById('userDropdown')?.classList.remove('show');
  });

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    logoutCustomer();
    updateAuthUI();
    document.getElementById('userDropdown')?.classList.remove('show');
    showToast('👋 Logged out successfully.');
  });

  // Auth modal close
  document.getElementById('authOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'authOverlay') closeAuthModal();
  });
  document.getElementById('authModalClose')?.addEventListener('click', closeAuthModal);
}

function openAuthModal() {
  document.getElementById('authOverlay')?.classList.add('open');
  // Reset forms
  document.getElementById('customerLoginForm')?.reset();
  document.getElementById('customerSignupForm')?.reset();
  document.getElementById('authError')?.classList.remove('show');
}
function closeAuthModal() {
  document.getElementById('authOverlay')?.classList.remove('open');
}

// ── GOOGLE LOGIN CALLBACK ──
window.handleGoogleLogin = async function(response) {
  try {
    const res = await fetch('/api/customers/google-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      loginCustomer(data.customer);
      closeAuthModal();
      updateAuthUI();
      showToast('👋 Welcome, ' + data.customer.name + '!');
    } else {
      showAuthError(data.error || 'Google login failed.');
    }
  } catch(err) {
    showAuthError('Server error during Google login.');
  }
};

function showAuthError(msg) {
  const el = document.getElementById('authError');
  if (el) { el.textContent = '❌ ' + msg; el.classList.add('show'); }
}

function toggleUserDropdown() {
  const dropdown = document.getElementById('userDropdown');
  dropdown?.classList.toggle('show');
}

function updateAuthUI() {
  const customer = getLoggedInCustomer();
  const navUserIcon = document.getElementById('navUserIcon');
  const loggedInView = document.getElementById('dropdownLoggedInView');
  const loggedOutView = document.getElementById('dropdownLoggedOutView');

  if (customer) {
    if (navUserIcon) {
      navUserIcon.textContent = customer.name.charAt(0).toUpperCase();
      navUserIcon.style.background = 'linear-gradient(135deg, var(--green-mid), var(--gold))';
      navUserIcon.style.color = '#fff';
      navUserIcon.style.fontSize = '14px';
      navUserIcon.style.fontWeight = '700';
    }
    if (loggedInView && loggedOutView) {
      loggedInView.style.display = 'block';
      loggedOutView.style.display = 'none';
      document.getElementById('dropdownName').textContent = customer.name;
      document.getElementById('dropdownEmail').textContent = customer.email;
    }
  } else {
    if (navUserIcon) {
      navUserIcon.textContent = '👤';
      navUserIcon.style.background = 'none';
      navUserIcon.style.color = 'var(--mist)';
      navUserIcon.style.fontSize = '20px';
    }
    if (loggedInView && loggedOutView) {
      loggedInView.style.display = 'none';
      loggedOutView.style.display = 'block';
    }
  }
}

// ── TOAST ──
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ── FEEDBACK SUBMIT ──
function submitFeedback() {
  const name = document.getElementById('fname').value.trim();
  const contact = document.getElementById('fcontact').value.trim();
  const city = document.getElementById('fcity').value.trim();
  const packet = document.getElementById('fpacket').value;
  const msg = document.getElementById('fmsg').value.trim();

  if (!name || !contact || !msg) {
    showToast('⚠️ Please fill in all required fields.');
    return;
  }
  saveFeedback({ name, contact, city, packet, message: msg, date: new Date().toLocaleString('en-IN') });
  showToast('🙏 Thank you, ' + name + '! We\'ll be in touch soon.');
  document.getElementById('fname').value = '';
  document.getElementById('fcontact').value = '';
  document.getElementById('fcity').value = '';
  document.getElementById('fmsg').value = '';
  document.getElementById('fpacket').value = '';
}

// ── SCROLL ANIMATIONS ──
function initScrollAnimations() {
  const reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
  if (reveals.length === 0) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  reveals.forEach(el => observer.observe(el));
}

// ── NAV SCROLL ──
function initNavScroll() {
  const nav = document.querySelector('nav');
  const sections = document.querySelectorAll('section[id]');
  const links = document.querySelectorAll('.nav-links a');
  window.addEventListener('scroll', () => {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 60);
    let current = '';
    sections.forEach(s => { if (window.scrollY >= s.offsetTop - 100) current = s.id; });
    links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + current));
  });
}

// ── HAMBURGER ──
function initHamburger() {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.querySelector('.nav-links');
  if (!hamburger || !navLinks) return;
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navLinks.classList.toggle('open');
  });
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => { hamburger.classList.remove('active'); navLinks.classList.remove('open'); });
  });
}

// ── BACK TO TOP ──
function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;
  window.addEventListener('scroll', () => btn.classList.toggle('show', window.scrollY > 500));
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ── CURSOR SPARKLE ──
function initCursorSparkle() {
  if (window.innerWidth < 768) return;
  let lastX = 0, lastY = 0, throttle = false;
  document.addEventListener('mousemove', (e) => {
    if (throttle) return;
    throttle = true;
    setTimeout(() => throttle = false, 60);
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    lastX = e.clientX; lastY = e.clientY;
    if (dist < 10) return;
    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle';
    sparkle.style.left = e.clientX + 'px';
    sparkle.style.top = e.clientY + 'px';
    document.body.appendChild(sparkle);
    setTimeout(() => sparkle.remove(), 600);
  });
}

// ── TESTIMONIAL AUTO-SCROLL ──
function initTestimonialScroll() {
  const track = document.getElementById('testimonialTrack');
  if (!track) return;
  const dots = document.querySelectorAll('.testimonial-dot');
  let currentSlide = 0;
  const cardWidth = 344;
  function scrollToSlide(i) {
    currentSlide = i;
    track.scrollTo({ left: i * cardWidth, behavior: 'smooth' });
    dots.forEach((d, idx) => d.classList.toggle('active', idx === i));
  }
  setInterval(() => { currentSlide = (currentSlide + 1) % dots.length; scrollToSlide(currentSlide); }, 4000);
  dots.forEach((d, i) => d.addEventListener('click', () => scrollToSlide(i)));
}

// ── ANIMATED COUNTERS ──
function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length === 0) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.counted) {
        entry.target.dataset.counted = 'true';
        animateCounter(entry.target);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(el => observer.observe(el));
}

function animateCounter(el) {
  const target = el.dataset.count;
  const suffix = el.dataset.suffix || '';
  const prefix = el.dataset.prefix || '';
  if (isNaN(parseInt(target))) { el.textContent = target; return; }
  const num = parseInt(target);
  const duration = 1500;
  const start = performance.now();
  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(eased * num);
    el.textContent = prefix + current.toLocaleString('en-IN') + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ── MY ORDERS ──
function openMyOrdersModal() {
  document.getElementById('myOrdersOverlay')?.classList.add('open');
  fetchAndRenderMyOrders();
}

function closeMyOrdersModal() {
  document.getElementById('myOrdersOverlay')?.classList.remove('open');
}

async function fetchAndRenderMyOrders() {
  const container = document.getElementById('myOrdersList');
  const customer = getLoggedInCustomer();
  
  if (!customer) {
    container.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--mist);">Please login to view your orders.</div>';
    return;
  }
  
  container.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--gold);">Loading your orders...</div>';
  
  try {
    const res = await fetch('/api/orders/customer/' + encodeURIComponent(customer.email));
    if (!res.ok) throw new Error('Network response was not ok');
    const orders = await res.json();
    
    if (orders.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding: 30px; color: rgba(228,237,231,0.5);">No orders found. Time to stock up on some tea! ☕</div>';
      return;
    }
    
    container.innerHTML = orders.map(o => {
      let statusColor = '#f39c12'; // default orange/yellow
      if (o.status === 'Processing') statusColor = '#3498db'; // blue
      else if (o.status === 'Shipped') statusColor = '#9b59b6'; // purple
      else if (o.status === 'Delivered') statusColor = '#2ecc71'; // green
      else if (o.status === 'Cancelled') statusColor = '#e74c3c'; // red
      
      return `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(228,237,231,0.1); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 10px;">
            <div>
              <div style="font-size: 14px; font-weight: bold; color: var(--gold);">${o.id}</div>
              <div style="font-size: 12px; color: var(--mist);">${o.date}</div>
            </div>
            <div>
              <span style="background: ${statusColor}22; color: ${statusColor}; border: 1px solid ${statusColor}; border-radius: 12px; padding: 4px 10px; font-size: 12px; font-weight: bold;">
                ${o.status || 'Pending'}
              </span>
            </div>
          </div>
          <div style="font-size: 14px; color: var(--white); margin-bottom: 10px; line-height: 1.5;">
            ${o.items.join('<br>')}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; gap: 10px;">
              ${o.status === 'Delivered' ? `
                ${o.review ? `<span style="font-size: 12px; color: var(--gold);">⭐ Reviewed (${o.review.rating}/5)</span>` : `<button onclick="openReviewModal('${o.id}')" style="background: none; border: 1px solid var(--gold); color: var(--gold); padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">⭐ Review</button>`}
                ${o.complaint ? `<span style="font-size: 12px; color: #e74c3c;">⚠️ Complaint Filed</span>` : `<button onclick="openComplaintModal('${o.id}')" style="background: none; border: 1px solid #e74c3c; color: #e74c3c; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">⚠️ Complain</button>`}
              ` : `<span style="font-size: 12px; color: var(--mist);">Options available after delivery</span>`}
            </div>
            <div style="text-align: right; font-weight: bold; color: var(--gold);">
              Total: ₹${o.total.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      `;
    }).join('');
    
  } catch(err) {
    console.error(err);
    container.innerHTML = '<div style="text-align:center; padding: 20px; color: #e74c3c;">Failed to load orders. Please try again later.</div>';
  }
}

// ── ORDER REVIEWS & COMPLAINTS ──
function openReviewModal(orderId) {
  document.getElementById('reviewOrderId').value = orderId;
  document.getElementById('reviewOrderTitle').textContent = 'For Order ' + orderId;
  document.getElementById('reviewForm').reset();
  document.getElementById('reviewOverlay')?.classList.add('open');
}

function closeReviewModal() {
  document.getElementById('reviewOverlay')?.classList.remove('open');
}

function openComplaintModal(orderId) {
  document.getElementById('complaintOrderId').value = orderId;
  document.getElementById('complaintOrderTitle').textContent = 'For Order ' + orderId;
  document.getElementById('complaintForm').reset();
  document.getElementById('complaintOverlay')?.classList.add('open');
}

function closeComplaintModal() {
  document.getElementById('complaintOverlay')?.classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('reviewForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('reviewOrderId').value;
    const rating = document.getElementById('reviewRating').value;
    const comment = document.getElementById('reviewComment').value.trim();
    
    const btn = e.target.querySelector('button[type="submit"]');
    btn.innerHTML = 'Submitting...';
    btn.disabled = true;

    try {
      const res = await fetch('/api/orders/' + id + '/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment })
      });
      if (res.ok) {
        showToast('⭐ Thank you for your review!');
        closeReviewModal();
        fetchAndRenderMyOrders(); // Refresh to show "Reviewed"
      } else {
        showToast('⚠️ Error submitting review.');
      }
    } catch(err) {
      showToast('⚠️ Server error.');
    } finally {
      btn.innerHTML = 'Submit Review';
      btn.disabled = false;
    }
  });

  document.getElementById('complaintForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('complaintOrderId').value;
    const text = document.getElementById('complaintText').value.trim();
    
    const btn = e.target.querySelector('button[type="submit"]');
    btn.innerHTML = 'Submitting...';
    btn.disabled = true;

    try {
      const res = await fetch('/api/orders/' + id + '/complaint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        showToast('⚠️ Complaint registered. We will contact you soon.');
        closeComplaintModal();
        fetchAndRenderMyOrders(); // Refresh to show "Complaint Filed"
      } else {
        showToast('⚠️ Error submitting complaint.');
      }
    } catch(err) {
      showToast('⚠️ Server error.');
    } finally {
      btn.innerHTML = 'Submit Complaint';
      btn.disabled = false;
    }
  });
});

