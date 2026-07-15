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
  
  // Abandoned Cart Sync
  const customer = getLoggedInCustomer();
  if (customer && customer.email) {
    const total = c.reduce((sum, item) => sum + (item.price * item.qty), 0);
    fetch('/api/cart/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: customer.email,
        name: customer.name,
        items: c,
        total: total
      })
    }).catch(err => console.error('Cart sync error:', err));
  }
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
  if (customer.wishlist) {
    localStorage.setItem('ff_wishlist', JSON.stringify(customer.wishlist));
  } else {
    // If not in customer data, fetch it
    const token = localStorage.getItem('ff_customer_token');
    fetch('/api/customers/' + encodeURIComponent(customer.email) + '/wishlist', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(wishlist => {
        localStorage.setItem('ff_wishlist', JSON.stringify(wishlist));
        renderProducts();
      })
      .catch(console.error);
  }
}
function logoutCustomer() {
  localStorage.removeItem('ff_customer_session');
  localStorage.removeItem('ff_wishlist');
  renderProducts();
}

// ── PRELOADER ──
// Generate floating gold particles
(function initPreloaderParticles() {
  const container = document.getElementById('preloaderParticles');
  if (!container) return;
  const emojis = ['🍃', '✨', '🌿', '☕', '🌱'];
  for (let i = 0; i < 20; i++) {
    const el = document.createElement('div');
    el.className = 'pl-particle';
    const size = 4 + Math.random() * 6;
    el.style.cssText = `
      width: ${size}px; height: ${size}px;
      left: ${Math.random() * 100}%;
      bottom: -10px;
      animation-duration: ${5 + Math.random() * 8}s;
      animation-delay: ${Math.random() * 6}s;
      opacity: 0;
    `;
    container.appendChild(el);
  }
})();

window.addEventListener('load', () => {
  const preloader = document.getElementById('preloader');
  if (preloader) {
    setTimeout(() => {
      preloader.classList.add('hide');
      setTimeout(() => preloader.remove(), 900);
    }, 300);
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

  // Filter Listeners
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentCategory = btn.getAttribute('data-cat');
      document.querySelectorAll('.cat-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.borderColor = 'rgba(0,0,0,0.1)';
      });
      btn.classList.add('active');
      btn.style.background = 'var(--gold)';
      btn.style.borderColor = 'var(--gold)';
      renderProducts();
    });
  });
  const searchInput = document.getElementById('productSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchTerm = e.target.value;
      renderProducts();
    });
  }

  fetchProducts().then(() => renderProducts());
  
  // Fallback to hide preloader if window.load fails or takes too long
  const preloader = document.getElementById('preloader');
  if (preloader) {
    setTimeout(() => {
      preloader.classList.add('hide');
      setTimeout(() => preloader.remove(), 600);
    }, 1000);
  }

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
let currentSearchTerm = '';
let currentCategory = 'all';

function getWishlist() {
  return JSON.parse(localStorage.getItem('ff_wishlist')) || [];
}

function toggleWishlist(e, id) {
  e.stopPropagation();
  let wishlist = getWishlist();
  if (wishlist.includes(id)) {
    wishlist = wishlist.filter(item => item !== id);
  } else {
    wishlist.push(id);
  }
  localStorage.setItem('ff_wishlist', JSON.stringify(wishlist));
  renderProducts();

  const customer = getLoggedInCustomer();
  if (customer) {
    const token = localStorage.getItem('ff_customer_token');
    fetch('/api/customers/' + encodeURIComponent(customer.email) + '/wishlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ wishlist })
    }).catch(console.error);
  }
}

function renderProducts() {
  const grid = document.getElementById('packetsGrid');
  if (!grid) return;
  let products = getProducts();
  
  if (currentCategory !== 'all') {
    products = products.filter(p => {
      const catMatch = (p.category || '').toLowerCase() === currentCategory;
      const textMatch = (p.name + ' ' + p.note).toLowerCase().includes(currentCategory);
      return catMatch || textMatch;
    });
  }
  
  if (currentSearchTerm) {
    const term = currentSearchTerm.toLowerCase();
    products = products.filter(p => (p.name + ' ' + p.note).toLowerCase().includes(term));
  }

  grid.innerHTML = '';
  
  if (!Array.isArray(products) || products.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 60px; color: var(--gold); font-size: 20px;">No teas found matching your criteria.</div>';
    return;
  }

  const wishlist = getWishlist();

  products.forEach(p => {
    const isWished = wishlist.includes(p.id);
    const card = document.createElement('div');
    card.className = 'packet-card' + (p.popular ? ' popular' : '');
    card.innerHTML = `
      ${p.popular ? '<div class="popular-badge">Best Seller</div>' : ''}
      <button class="wishlist-btn ${isWished ? 'active' : ''}" onclick="toggleWishlist(event, '${p.id}')" style="position: absolute; top: 10px; right: 10px; background: rgba(255,255,255,0.2); backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.3); border-radius: 50%; width: 36px; height: 36px; font-size: 18px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s; z-index: 10; color: ${isWished ? 'var(--gold)' : 'white'};">${isWished ? '♥' : '♡'}</button>
      <img src="${p.image || '/images/pouch.png'}" alt="${p.name}" class="packet-image" />
      <div class="packet-weight">${p.weight}</div>
      <div class="packet-label">${p.name}</div>
      <div class="packet-price" id="price-${p.id}">₹${p.price.toLocaleString('en-IN')}</div>
      <select class="size-select" id="size-${p.id}" onchange="updatePrice('${p.id}', ${p.price})">
        <option value="" disabled selected>Select Pack Size</option>
        <option value="80 gm — Starter Pack" data-multiplier="1">80 gm — Starter Pack</option>
        <option value="240 gm — Classic Pack" data-multiplier="2.8">240 gm — Classic Pack</option>
        <option value="500 gm — Family Pack" data-multiplier="5.5">500 gm — Family Pack</option>
        <option value="1 kg — Harvest Pack" data-multiplier="10">1 kg — Harvest Pack</option>
      </select>
      <div class="packet-note">${p.note}</div>
      <button class="add-btn" onclick="addToCart('${p.id}')">Add to Cart</button>
    `;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.add-btn') || e.target.closest('.size-select') || e.target.closest('.wishlist-btn')) return;
      openQuickView(p);
    });
    grid.appendChild(card);
  });
}

window.updatePrice = function(id, basePrice) {
  const select = document.getElementById('size-' + id);
  if (!select) return;
  const multiplier = parseFloat(select.options[select.selectedIndex].getAttribute('data-multiplier'));
  const newPrice = Math.round(basePrice * multiplier);
  const priceEl = document.getElementById('price-' + id);
  if (priceEl) priceEl.innerText = '₹' + newPrice.toLocaleString('en-IN');
};

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
let appliedPromo = null;

function initCart() {
  cart = getCart();
  updateCartUI();
  document.getElementById('cartIcon')?.addEventListener('click', openCartDrawer);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCartDrawer);
  document.getElementById('cartClose')?.addEventListener('click', closeCartDrawer);
  document.getElementById('checkoutBtn')?.addEventListener('click', checkout);
  
  // Attach promo button listeners
  document.getElementById('applyPromoBtn')?.addEventListener('click', applyPromo);
  document.getElementById('applyPromoBtnCart')?.addEventListener('click', applyPromo);
}

function addToCart(productId) {
  const products = getProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return;
  
  const select = document.getElementById('size-' + productId);
  if (select && !select.value) {
    showToast('⚠️ Please select a size first!');
    return;
  }
  
  const size = select ? select.value : product.weight;
  const multiplier = select ? parseFloat(select.options[select.selectedIndex].getAttribute('data-multiplier')) : 1;
  const finalPrice = Math.round(product.price * multiplier);
  const cartKey = productId + '-' + size;

  const existing = cart.find(c => c.cartKey === cartKey);
  if (existing) { existing.qty++; } else { cart.push({ ...product, price: finalPrice, size: size, cartKey: cartKey, qty: 1 }); }
  saveCart(cart);
  updateCartUI();
  showToast('✅ ' + size + ' ' + product.name + ' added to cart!');
  const count = document.getElementById('cartCount');
  if (count) { count.classList.remove('bump'); void count.offsetWidth; count.classList.add('bump'); }
}

function removeFromCart(cartKey) {
  cart = cart.filter(c => c.cartKey !== cartKey);
  saveCart(cart); updateCartUI();
}

function changeQty(cartKey, delta) {
  const item = cart.find(c => c.cartKey === cartKey);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) { removeFromCart(cartKey); return; }
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
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-name" style="font-size: 13px; color: var(--gold-dark); margin-top: 4px;">Size: ${item.size || item.weight}</div>
          <div class="cart-item-price">₹${(item.price * item.qty).toLocaleString('en-IN')}</div>
        </div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="changeQty('${item.cartKey}', -1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${item.cartKey}', 1)">+</button>
        </div>
      </div>
    `).join('');
  }

  const totalEl = document.getElementById('cartTotal');
  const totalPriceNum = cart.reduce((sum, c) => sum + (c.price * c.qty), 0);
  let finalPrice = totalPriceNum;
  let discountText = '';

  if (appliedPromo && totalPriceNum > 0) {
    const discountAmount = (totalPriceNum * appliedPromo.discountPercentage) / 100;
    finalPrice = totalPriceNum - discountAmount;
    discountText = `<div style="font-size:13px; color:#2ecc71; margin-bottom:4px;">Discount (${appliedPromo.promoCode}): -₹${Math.round(discountAmount).toLocaleString('en-IN')}</div>`;
  } else {
    appliedPromo = null;
  }

  if (totalEl) {
    if (appliedPromo) {
      totalEl.innerHTML = `${discountText}<strong>₹${Math.round(finalPrice).toLocaleString('en-IN')}</strong> <del style="font-size:13px; color:var(--mist); font-weight:normal; margin-left:6px;">₹${totalPriceNum.toLocaleString('en-IN')}</del>`;
    } else {
      totalEl.textContent = '₹' + totalPriceNum.toLocaleString('en-IN');
    }
  }
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;
}

async function applyPromo() {
  const codeInput = document.getElementById('promoInput') || document.getElementById('promoInputCart');
  if (!codeInput) return;
  
  const code = codeInput.value.trim();
  const msgEl = document.getElementById('promoMessage') || document.getElementById('promoMessageCart');
  
  if (!code) {
    if(msgEl) msgEl.innerHTML = '<span style="color:#e74c3c;">Please enter a promo code</span>';
    return;
  }

  const totalPrice = cart.reduce((sum, c) => sum + (c.price * c.qty), 0);
  if (totalPrice === 0) return;

  try {
    if(msgEl) msgEl.innerHTML = '<span style="color:var(--gold);">Applying...</span>';
    const res = await fetch('/api/promos/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, total: totalPrice })
    });
    const data = await res.json();
    
    if (res.ok && data.success) {
      appliedPromo = data;
      if(msgEl) msgEl.innerHTML = `<span style="color:#2ecc71;">🎉 ${data.discountPercentage}% off applied successfully!</span>`;
      updateCartUI();
    } else {
      appliedPromo = null;
      if(msgEl) msgEl.innerHTML = `<span style="color:#e74c3c;">${data.error || 'Invalid code'}</span>`;
      updateCartUI();
    }
  } catch (err) {
    console.error(err);
    if(msgEl) msgEl.innerHTML = `<span style="color:#e74c3c;">Error applying code</span>`;
  }
}

function openCartDrawer() {
  window.location.href = '/cart.html';
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
  const addrOverlay = document.getElementById('addressOverlay');
  if (addrOverlay) {
    addrOverlay.classList.add('open');
  } else {
    // If we are not on cart.html, redirect there
    window.location.href = '/cart.html';
  }
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

  const paymentMethodRadio = document.querySelector('input[name="paymentMethod"]:checked');
  const paymentMethod = paymentMethodRadio ? paymentMethodRadio.value : 'cod';

  if (paymentMethod === 'online') {
    showToast('⚠️ Online Payment is currently being set up. Please choose Cash on Delivery.');
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  btn.innerHTML = '⏳ Placing Order...';
  btn.disabled = true;

  try {
    // Save order directly for COD
    // Calculate discount for saving
    const baseTotal = cart.reduce((sum, c) => sum + (c.price * c.qty), 0);
    const discountAmount = appliedPromo ? (baseTotal * appliedPromo.discountPercentage) / 100 : 0;
    const finalTotal = baseTotal - discountAmount;

    const order = {
      id: 'ORD-' + Date.now().toString(36).toUpperCase(),
      date: new Date().toLocaleString('en-IN'),
      items: cart.map(c => `${c.weight} ${c.name} x${c.qty}`),
      subtotal: baseTotal,
      promoCode: appliedPromo ? appliedPromo.promoCode : null,
      discount: Math.round(discountAmount),
      total: Math.round(finalTotal),
      paymentMethod: 'COD',
      paymentId: null,
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
    btn.innerHTML = '📦 Place Order →';
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
  if (window.location.pathname.includes('/cart.html')) {
    window.location.href = '/';
  }
}

// --- PHOTO REVIEWS ---
async function fetchRecentReviews() {
  try {
    const res = await fetch('/api/reviews');
    const reviews = await res.json();
    const grid = document.getElementById('reviewsGrid');
    if (!grid) return;
    
    if (reviews.length === 0) {
      grid.innerHTML = '<p style="color:var(--charcoal); opacity:0.8; text-align:center; grid-column:1/-1;">No reviews yet. Be the first!</p>';
      return;
    }
    
    let html = '';
    reviews.forEach(r => {
      const stars = '⭐'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
      const photoHtml = r.photoUrl ? `<div style="height:150px; overflow:hidden; border-radius:4px; margin-bottom:12px;"><img src="${r.photoUrl}" style="width:100%; height:100%; object-fit:cover;"></div>` : '';
      
      html += `
        <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:20px;">
          ${photoHtml}
          <div style="margin-bottom:8px; font-size:18px;">${stars}</div>
          <p style="font-size:14px; margin-bottom:12px;">"${r.comment}"</p>
          <div style="font-size:12px; color:var(--gold); font-weight:600;">— ${r.name}</div>
          <div style="font-size:11px; color:var(--mist); margin-top:4px;">${r.date || ''}</div>
        </div>
      `;
    });
    grid.innerHTML = html;
  } catch (err) {
    console.error('Error fetching reviews:', err);
  }
}

function openPhotoReviewModal() {
  const select = document.getElementById('photoReviewProduct');
  select.innerHTML = '<option value="">Select Product...</option>';
  getProducts().forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name + (p.size ? ` (${p.size})` : '');
    select.appendChild(opt);
  });
  document.getElementById('photoReviewForm').reset();
  document.getElementById('photoReviewModalOverlay').classList.add('open');
}

function closePhotoReviewModal() {
  document.getElementById('photoReviewModalOverlay').classList.remove('open');
}

async function submitPhotoReview(e) {
  e.preventDefault();
  const form = document.getElementById('photoReviewForm');
  const btn = document.getElementById('photoReviewSubmitBtn');
  const productId = document.getElementById('photoReviewProduct').value;
  
  const formData = new FormData();
  formData.append('name', document.getElementById('photoReviewName').value);
  formData.append('rating', document.getElementById('photoReviewRating').value);
  formData.append('comment', document.getElementById('photoReviewComment').value);
  
  const fileInput = document.getElementById('photoReviewPhoto');
  if (fileInput.files[0]) {
    formData.append('photo', fileInput.files[0]);
  }
  
  btn.innerHTML = 'Submitting...';
  btn.disabled = true;
  
  try {
    const res = await fetch(`/api/products/${productId}/reviews`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      showToast('⭐ Photo Review Submitted!');
      closePhotoReviewModal();
      fetchRecentReviews();
    } else {
      showToast('⚠️ Error: ' + data.error);
    }
  } catch (err) {
    showToast('⚠️ Server error submitting review.');
  } finally {
    btn.innerHTML = 'Submit Review';
    btn.disabled = false;
  }
}

// ── MY ORDERS MODAL ──
window.openMyOrdersModal = async function() {
  const customer = getLoggedInCustomer();
  if (!customer) {
    openAuthModal();
    return;
  }
  
  const overlay = document.getElementById('myOrdersOverlay');
  const container = document.getElementById('myOrdersList');
  if (!overlay || !container) return;
  
  overlay.classList.add('open');
  container.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--mist);">⏳ Loading orders...</div>';
  
  try {
    const res = await fetch('/api/orders/customer/' + encodeURIComponent(customer.email));
    const orders = await res.json();
    
    if (orders.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--mist);">📦 You have not placed any orders yet.</div>';
      return;
    }
    
    orders.sort((a, b) => {
      let tA = a.createdAt ? a.createdAt._seconds : 0;
      let tB = b.createdAt ? b.createdAt._seconds : 0;
      return tB - tA;
    });

    container.innerHTML = orders.map(o => `
      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 15px; margin-bottom: 15px;">
        <div style="display:flex; justify-content:space-between; margin-bottom: 10px;">
          <strong style="color:var(--gold); font-size:14px;">${o.id}</strong>
          <span style="background:var(--black); padding: 2px 8px; border-radius: 4px; font-size: 11px; color: var(--mist);">${o.status || 'Pending'}</span>
        </div>
        <div style="font-size: 13px; color: var(--mist); margin-bottom: 8px;">Date: ${o.date}</div>
        <div style="font-size: 14px; color: var(--white); margin-bottom: 15px;">
          ${o.items.join('<br>')}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-weight: 600; color: var(--white);">Total: ₹${o.total.toLocaleString('en-IN')}</div>
          <button onclick="reorderItems('${o.id}')" style="background: var(--gold); color: var(--black); border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px;">🔄 Re-order</button>
        </div>
      </div>
    `).join('');
    
    window.currentCustomerOrders = orders;
    
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div style="text-align:center; padding: 20px; color: #e74c3c;">Failed to load orders.</div>';
  }
};

window.closeMyOrdersModal = function() {
  document.getElementById('myOrdersOverlay')?.classList.remove('open');
};

window.reorderItems = function(orderId) {
  const orders = window.currentCustomerOrders || [];
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  
  const allProducts = getProducts();
  let addedCount = 0;
  
  order.items.forEach(itemStr => {
    let qty = 1;
    let namePart = itemStr;
    const qtyMatch = itemStr.match(/(.*)\s+x(\d+)$/);
    if (qtyMatch) {
      namePart = qtyMatch[1].trim();
      qty = parseInt(qtyMatch[2], 10);
    }
    
    let matchedProduct = null;
    let matchedSize = null;
    
    for (const p of allProducts) {
      if (namePart.includes(p.name)) {
        matchedProduct = p;
        if (namePart.includes('250g')) matchedSize = '250g';
        else if (namePart.includes('500g')) matchedSize = '500g';
        else if (namePart.includes('1kg')) matchedSize = '1kg';
        else matchedSize = p.weight;
        break;
      }
    }
    
    if (matchedProduct) {
      let multiplier = 1;
      if (matchedSize === '500g') multiplier = 1.9;
      if (matchedSize === '1kg') multiplier = 3.7;
      
      const finalPrice = Math.round(matchedProduct.price * multiplier);
      const cartKey = matchedProduct.id + '-' + matchedSize;
      
      const existing = cart.find(c => c.cartKey === cartKey);
      if (existing) { 
        existing.qty += qty; 
      } else { 
        cart.push({ ...matchedProduct, price: finalPrice, size: matchedSize, cartKey: cartKey, qty: qty }); 
      }
      addedCount++;
    }
  });
  
  if (addedCount > 0) {
    saveCart(cart);
    updateCartUI();
    closeMyOrdersModal();
    showToast('✅ Items added to cart!');
    setTimeout(openCartDrawer, 500);
  } else {
    showToast('⚠️ Could not match items to current products.');
  }
};

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

// ── MY ACCOUNT ──
window.openAccountModal = function() {
  document.getElementById('accountOverlay')?.classList.add('open');
  const customer = getLoggedInCustomer();
  if (!customer) {
    document.getElementById('myOrdersList').innerHTML = '<div style="text-align:center; padding: 20px; color: var(--mist);">Please login to view your account.</div>';
    document.getElementById('myWishlistGrid').innerHTML = '<div style="text-align:center; padding: 20px; color: var(--mist); grid-column: 1/-1;">Please login to view your wishlist.</div>';
    return;
  }
  
  fetchAndRenderMyOrders();
  renderMyWishlist();
  
  document.getElementById('profileName').value = customer.name || '';
  document.getElementById('profileAddress').value = customer.address || '';
  document.getElementById('profileCity').value = customer.city || '';
  document.getElementById('profilePin').value = customer.pin || '';
};

window.closeAccountModal = function() {
  document.getElementById('accountOverlay')?.classList.remove('open');
};

window.switchAccountTab = function(tab) {
  document.querySelectorAll('.account-tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.account-tab-btn').forEach(el => {
    el.classList.remove('active');
    el.style.color = 'var(--mist)';
  });
  
  document.getElementById('accountTab-' + tab).classList.add('active');
  const btn = Array.from(document.querySelectorAll('.account-tab-btn')).find(b => b.innerText.toLowerCase().includes(tab));
  if(btn) {
    btn.classList.add('active');
    btn.style.color = 'var(--gold)';
  }
};

window.saveProfile = async function(e) {
  e.preventDefault();
  const customer = getLoggedInCustomer();
  if(!customer) return;
  
  const updatedData = {
    name: document.getElementById('profileName').value,
    address: document.getElementById('profileAddress').value,
    city: document.getElementById('profileCity').value,
    pin: document.getElementById('profilePin').value
  };
  
  const token = localStorage.getItem('ff_customer_token');
  try {
    const res = await fetch('/api/customers/' + encodeURIComponent(customer.email), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updatedData)
    });
    if(res.ok) {
      showToast('✅ Profile updated successfully!');
      const newCustomer = { ...customer, ...updatedData };
      localStorage.setItem('ff_customer', JSON.stringify(newCustomer));
    } else {
      showToast('⚠️ Failed to update profile');
    }
  } catch(err) {
    showToast('⚠️ Error updating profile');
  }
};

function renderMyWishlist() {
  const container = document.getElementById('myWishlistGrid');
  const wishlistIds = getWishlist();
  if(wishlistIds.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding: 30px; color: rgba(228,237,231,0.5); grid-column: 1/-1;">Your wishlist is empty. 🌿</div>';
    return;
  }
  
  const products = getProducts();
  const wishProducts = products.filter(p => wishlistIds.includes(p.id));
  
  container.innerHTML = wishProducts.map(p => `
    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; text-align: center; position: relative;">
      <button onclick="toggleWishlist(event, '${p.id}'); setTimeout(renderMyWishlist, 100);" style="position: absolute; top: 5px; right: 5px; background: transparent; border: none; color: var(--gold); font-size: 18px; cursor: pointer;">✕</button>
      <img src="${p.image || '/images/pouch.png'}" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 10px;">
      <div style="font-size: 13px; color: white; font-weight: 600;">${p.name}</div>
      <div style="color: var(--gold); font-size: 12px; margin-top: 5px;">₹${p.price}</div>
      <button onclick="addToCart('${p.id}'); showToast('Added to Cart');" style="margin-top: 10px; background: var(--gold); border: none; color: black; font-size: 11px; padding: 5px 10px; border-radius: 4px; cursor: pointer; width: 100%;">Move to Cart</button>
    </div>
  `).join('');
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
                ${o.review ? `<span style="font-size: 12px; color: var(--gold);">⭐ Reviewed (${o.review.rating}/5)</span>` : `<button onclick="openReviewModal('${o.id}')" style="background: none; border: 1px solid var(--gold); color: var(--gold); padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">⭐ Review</button>`}`
                ${o.complaint ? `<span style="font-size: 12px; color: #e74c3c;">⚠️ Complaint Filed</span>` : `<button onclick="openComplaintModal('${o.id}')" style="background: none; border: 1px solid #e74c3c; color: #e74c3c; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">⚠️ Complain</button>`}`
              : `<span style="font-size: 12px; color: var(--mist);">Options available after delivery</span>`}
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

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('reviewsGrid')) {
    fetchRecentReviews();
  }
});

// --- SERVICE WORKER REGISTRATION (PWA) ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      }, err => {
        console.log('ServiceWorker registration failed: ', err);
      });
  });
}

// --- NEWSLETTER SUBSCRIPTION ---
window.handleSubscribe = async function(e) {
  e.preventDefault();
  const email = document.getElementById('subscribeEmail').value;
  if(!email) return;
  
  const btn = e.target.querySelector('button[type="submit"]');
  btn.innerHTML = '...';
  btn.disabled = true;
  
  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (res.ok) {
      showToast('🎉 Thank you for subscribing to our Newsletter!');
      document.getElementById('subscribeEmail').value = '';
    } else {
      showToast('⚠️ Could not subscribe, please try again.');
    }
  } catch (err) {
    showToast('⚠️ Error connecting to server.');
  } finally {
    btn.innerHTML = 'Subscribe';
    btn.disabled = false;
  }
};

// --- LIVE ORDER NOTIFICATION SIMULATOR ---
const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Surat'];
const times = ['just now', '1 minute ago', '2 minutes ago', '5 minutes ago', '10 minutes ago'];
function showLiveOrderPopup() {
  const popup = document.getElementById('liveOrderPopup');
  if(!popup) return;
  
  const randomCity = cities[Math.floor(Math.random() * cities.length)];
  const randomTime = times[Math.floor(Math.random() * times.length)];
  
  document.getElementById('liveOrderText').innerHTML = `Someone from <b>${randomCity}</b> bought 7 TEA AM`;
  document.getElementById('liveOrderTime').innerText = randomTime;
  
  // Slide in
  popup.style.left = '20px';
  
  // Hide after 5 seconds
  setTimeout(() => {
    popup.style.left = '-350px';
  }, 5000);
}

// Start live order notifications
if (document.getElementById('liveOrderPopup')) {
  setTimeout(() => {
    showLiveOrderPopup();
    // Then show every 25-45 seconds randomly
    setInterval(() => {
      showLiveOrderPopup();
    }, Math.floor(Math.random() * 20000) + 25000);
  }, 3000); // Initial popup after 3 seconds
}
