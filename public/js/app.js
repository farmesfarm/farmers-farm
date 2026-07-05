/* ═══════════════════════════════════════════════════════════════
   FARMERS FARM – 7 TEA AM  |  Main Application JS
   Customer Auth + Cart + Orders + Animations
   ═══════════════════════════════════════════════════════════════ */

// ── DEFAULT PRODUCTS ──
const DEFAULT_PRODUCTS = [
  { id: 1, icon: '🫙', weight: '40g', name: 'Taster Pack', price: 120, note: '~20 cups · Perfect for first-timers', popular: false },
  { id: 2, icon: '🫙', weight: '100g', name: 'Starter Pack', price: 280, note: '~50 cups · Great for solo brewers', popular: false },
  { id: 3, icon: '🫙', weight: '250g', name: 'Classic Pack', price: 620, note: '~125 cups · Most popular choice', popular: true },
  { id: 4, icon: '🫙', weight: '500g', name: 'Family Pack', price: 1100, note: '~250 cups · For the whole family', popular: false },
  { id: 5, icon: '🏺', weight: '750g', name: 'Estate Pack', price: 1580, note: '~375 cups · Value for regulars', popular: false },
  { id: 6, icon: '🏺', weight: '1kg', name: 'Harvest Pack', price: 1999, note: '~500 cups · Best value per cup', popular: false },
];

// ── DATA LAYER ──
let globalProductsCache = [];

async function fetchProducts() {
  try {
    const res = await fetch('/api/products');
    globalProductsCache = await res.json();
  } catch (err) {
    console.error('Error fetching products', err);
    globalProductsCache = DEFAULT_PRODUCTS;
  }
}

function getProducts() {
  return globalProductsCache.length ? globalProductsCache : DEFAULT_PRODUCTS;
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
  setTimeout(() => {
    const preloader = document.getElementById('preloader');
    if (preloader) {
      preloader.classList.add('hide');
      setTimeout(() => preloader.remove(), 600);
    }
  }, 2000);
});

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
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
  products.forEach(p => {
    const card = document.createElement('div');
    card.className = 'packet-card' + (p.popular ? ' popular' : '');
    card.innerHTML = `
      ${p.popular ? '<div class="popular-badge">Best Seller</div>' : ''}
      <span class="packet-icon">${p.icon}</span>
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
  document.getElementById('qvIcon').textContent = product.icon;
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
        <span class="cart-item-icon">${item.icon}</span>
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

// Finalize Order
document.getElementById('checkoutAddressForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const customer = getLoggedInCustomer();
  if (!customer || cart.length === 0) return;

  const address = document.getElementById('checkoutAddress').value.trim();
  const city = document.getElementById('checkoutCity').value.trim();
  const pin = document.getElementById('checkoutPin').value.trim();
  const lat = document.getElementById('checkoutLat').value;
  const lng = document.getElementById('checkoutLng').value;

  const totalPrice = cart.reduce((sum, c) => sum + (c.price * c.qty), 0);

  const btn = e.target.querySelector('button[type="submit"]');
  btn.innerHTML = 'Processing...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/payment/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: totalPrice })
    });
    const rzpOrder = await res.json();

    const options = {
      key: 'rzp_test_dummy', // Replace with real key in production
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      name: "Farmers Farm",
      description: "Tea Order",
      order_id: rzpOrder.id,
      handler: async function (response) {
        // Payment successful, now verify and save order
        const verifyRes = await fetch('/api/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(response)
        });
        
        if (verifyRes.ok) {
          const order = {
            id: 'ORD-' + Date.now().toString(36).toUpperCase(),
            date: new Date().toLocaleString('en-IN'),
            items: cart.map(c => `${c.weight} ${c.name} x${c.qty}`),
            total: totalPrice,
            customer: {
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
            },
            shipping: { address, city, pin, lat, lng },
            paymentId: response.razorpay_payment_id || 'test_payment'
          };
          
          await saveOrder(order);
          cart = [];
          saveCart(cart);
          updateCartUI();
          closeAddressModal();
          showCheckoutSuccess(order);
        } else {
          showToast('⚠️ Payment verification failed.');
        }
      },
      prefill: {
        name: customer.name,
        email: customer.email,
        contact: customer.phone
      },
      theme: { color: "#2E5E3E" },
      modal: {
        ondismiss: function() {
          btn.innerHTML = 'Confirm Order →';
          btn.disabled = false;
        }
      }
    };

    if (window.Razorpay) {
      const rzp = new Razorpay(options);
      rzp.open();
    } else {
      // Fallback if Razorpay script didn't load
      showToast('⚠️ Razorpay not loaded. Simulating order placement.');
      const order = {
        id: 'ORD-' + Date.now().toString(36).toUpperCase(),
        date: new Date().toLocaleString('en-IN'),
        items: cart.map(c => `${c.weight} ${c.name} x${c.qty}`),
        total: totalPrice,
        customer: { name: customer.name, email: customer.email, phone: customer.phone },
        shipping: { address, city, pin, lat, lng }
      };
      await saveOrder(order);
      cart = []; saveCart(cart); updateCartUI(); closeAddressModal(); showCheckoutSuccess(order);
    }
  } catch(err) {
    showToast('⚠️ Error initiating payment.');
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

  // Login form
  document.getElementById('loginFormContainer')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('clEmail').value.trim().toLowerCase();
    const pass = document.getElementById('clPass').value;
    
    try {
      const res = await fetch('/api/customers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        loginCustomer(data.customer);
        closeAuthModal();
        updateAuthUI();
        showToast('👋 Welcome back, ' + data.customer.name + '!');
      } else {
        showAuthError(data.error || 'Invalid email or password.');
      }
    } catch(err) {
      showAuthError('Server error. Try again.');
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
    if (pass.length < 4) {
      showAuthError('Password must be at least 4 characters.');
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
    const customer = getLoggedInCustomer();
    if (customer) {
      toggleUserDropdown();
    } else {
      openAuthModal();
    }
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
  const navUserBtn = document.getElementById('navUserBtn');
  const dropdown = document.getElementById('userDropdown');

  if (customer) {
    if (navUserBtn) {
      navUserBtn.textContent = customer.name.charAt(0).toUpperCase();
      navUserBtn.style.background = 'linear-gradient(135deg, var(--green-mid), var(--gold))';
      navUserBtn.style.color = '#fff';
      navUserBtn.style.width = '32px';
      navUserBtn.style.height = '32px';
      navUserBtn.style.borderRadius = '50%';
      navUserBtn.style.display = 'flex';
      navUserBtn.style.alignItems = 'center';
      navUserBtn.style.justifyContent = 'center';
      navUserBtn.style.fontSize = '14px';
      navUserBtn.style.fontWeight = '700';
      navUserBtn.title = customer.name;
    }
    if (dropdown) {
      document.getElementById('dropdownName').textContent = customer.name;
      document.getElementById('dropdownEmail').textContent = customer.email;
    }
  } else {
    if (navUserBtn) {
      navUserBtn.textContent = '👤';
      navUserBtn.style.background = 'none';
      navUserBtn.style.color = 'var(--mist)';
      navUserBtn.style.width = 'auto';
      navUserBtn.style.height = 'auto';
      navUserBtn.style.borderRadius = '0';
      navUserBtn.style.fontSize = '20px';
      navUserBtn.title = 'Login / Sign Up';
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
