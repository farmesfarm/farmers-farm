/* ═══════════════════════════════════════════════════════════════
   FARMERS FARM – Admin Dashboard JS
   Auth + Product CRUD + Orders (with customer info) + Feedbacks
   ═══════════════════════════════════════════════════════════════ */

// ── ADMIN CREDENTIALS ──
const ADMIN_EMAIL = 'admin@farmersfarm.in';
const ADMIN_PASS = 'farm@2026';
const SESSION_KEY = 'ff_admin_session';

// ── DEFAULT PRODUCTS ──
const DEFAULT_PRODUCTS = [
  { id: 1, icon: '🫙', weight: '40g', name: 'Taster Pack', price: 120, note: '~20 cups · Perfect for first-timers', popular: false },
  { id: 2, icon: '🫙', weight: '100g', name: 'Starter Pack', price: 280, note: '~50 cups · Great for solo brewers', popular: false },
  { id: 3, icon: '🫙', weight: '250g', name: 'Classic Pack', price: 620, note: '~125 cups · Most popular choice', popular: true },
  { id: 4, icon: '🫙', weight: '500g', name: 'Family Pack', price: 1100, note: '~250 cups · For the whole family', popular: false },
  { id: 5, icon: '🏺', weight: '750g', name: 'Estate Pack', price: 1580, note: '~375 cups · Value for regulars', popular: false },
  { id: 6, icon: '🏺', weight: '1kg', name: 'Harvest Pack', price: 1999, note: '~500 cups · Best value per cup', popular: false },
];

// ── DATA HELPERS ──
function getProducts() {
  let p = JSON.parse(localStorage.getItem('ff_products'));
  if (!p || p.length === 0) { localStorage.setItem('ff_products', JSON.stringify(DEFAULT_PRODUCTS)); p = DEFAULT_PRODUCTS; }
  return p;
}
function saveProducts(p) { localStorage.setItem('ff_products', JSON.stringify(p)); }
function getOrders() { return JSON.parse(localStorage.getItem('ff_orders')) || []; }
function getFeedbacks() { return JSON.parse(localStorage.getItem('ff_feedbacks')) || []; }
function getCustomers() { return JSON.parse(localStorage.getItem('ff_customers')) || []; }

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  checkSession();
  initLogin();
  initSidebar();
  initProductModal();
});

// ── AUTH ──
function checkSession() {
  if (localStorage.getItem(SESSION_KEY) === 'active') showDashboard();
  else showLogin();
}

function showLogin() {
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('dashboard').classList.remove('active');
}

function showDashboard() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('dashboard').classList.add('active');
  loadDashboardData();
  switchPage('overview');
}

function initLogin() {
  document.getElementById('loginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value;
    const errorEl = document.getElementById('loginError');
    if (email === ADMIN_EMAIL && pass === ADMIN_PASS) {
      localStorage.setItem(SESSION_KEY, 'active');
      errorEl.classList.remove('show');
      showDashboard();
    } else {
      errorEl.textContent = '❌ Invalid email or password. Please try again.';
      errorEl.classList.add('show');
    }
  });
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  showLogin();
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPass').value = '';
}

// ── SIDEBAR ──
function initSidebar() {
  document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
    link.addEventListener('click', () => switchPage(link.dataset.page));
  });
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
}

function switchPage(page) {
  document.querySelectorAll('.sidebar-link[data-page]').forEach(l => l.classList.toggle('active', l.dataset.page === page));
  document.querySelectorAll('.admin-page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
  if (page === 'overview') loadDashboardData();
  if (page === 'products') renderProductsTable();
  if (page === 'orders') renderOrders();
  if (page === 'feedbacks') renderFeedbacks();
  if (page === 'customers') renderCustomers();
}

// ── OVERVIEW ──
function loadDashboardData() {
  const products = getProducts();
  const orders = getOrders();
  const feedbacks = getFeedbacks();
  const customers = getCustomers();

  document.getElementById('statProducts').textContent = products.length;
  document.getElementById('statOrders').textContent = orders.length;
  document.getElementById('statFeedbacks').textContent = feedbacks.length;
  document.getElementById('statCustomers').textContent = customers.length;

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  document.getElementById('statRevenue').textContent = '₹' + totalRevenue.toLocaleString('en-IN');

  const orderBadge = document.getElementById('ordersBadge');
  if (orderBadge) { orderBadge.textContent = orders.length; orderBadge.style.display = orders.length > 0 ? 'inline' : 'none'; }
  const feedbackBadge = document.getElementById('feedbacksBadge');
  if (feedbackBadge) { feedbackBadge.textContent = feedbacks.length; feedbackBadge.style.display = feedbacks.length > 0 ? 'inline' : 'none'; }
}

// ── PRODUCTS TABLE ──
function renderProductsTable() {
  const products = getProducts();
  const tbody = document.getElementById('productsBody');
  if (!tbody) return;
  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:rgba(228,237,231,0.35);">No products yet. Click "Add Product" to get started.</td></tr>`;
    return;
  }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td><span class="table-icon">${p.icon}</span></td>
      <td style="font-weight:600; color:var(--white);">${p.weight} ${p.name}</td>
      <td style="color:var(--gold); font-weight:600;">₹${p.price.toLocaleString('en-IN')}</td>
      <td style="font-size:12px; color:rgba(228,237,231,0.4); max-width:200px;">${p.note}</td>
      <td>${p.popular ? '<span class="table-badge badge-popular">⭐ Popular</span>' : '<span class="table-badge badge-new">Standard</span>'}</td>
      <td>
        <button class="btn-edit" onclick="editProduct(${p.id})">Edit</button>
        <button class="btn-delete" onclick="deleteProduct(${p.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

// ── PRODUCT MODAL ──
let editingProductId = null;
function initProductModal() {
  document.getElementById('addProductBtn')?.addEventListener('click', () => openProductModal());
  document.getElementById('modalClose')?.addEventListener('click', closeProductModal);
  document.getElementById('modalCancel')?.addEventListener('click', closeProductModal);
  document.getElementById('productForm')?.addEventListener('submit', saveProduct);
  document.getElementById('productModal')?.addEventListener('click', (e) => { if (e.target.id === 'productModal') closeProductModal(); });
}

function openProductModal(product = null) {
  const modal = document.getElementById('productModal');
  const title = document.getElementById('modalTitle');
  if (product) {
    editingProductId = product.id;
    title.textContent = 'Edit Product';
    document.getElementById('pIcon').value = product.icon;
    document.getElementById('pWeight').value = product.weight;
    document.getElementById('pName').value = product.name;
    document.getElementById('pPrice').value = product.price;
    document.getElementById('pNote').value = product.note;
    document.getElementById('pPopular').value = product.popular ? 'yes' : 'no';
  } else {
    editingProductId = null;
    title.textContent = 'Add New Product';
    document.getElementById('productForm').reset();
    document.getElementById('pIcon').value = '🫙';
  }
  modal.classList.add('open');
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('open');
  editingProductId = null;
}

function saveProduct(e) {
  e.preventDefault();
  const products = getProducts();
  const data = {
    icon: document.getElementById('pIcon').value || '🫙',
    weight: document.getElementById('pWeight').value.trim(),
    name: document.getElementById('pName').value.trim(),
    price: parseInt(document.getElementById('pPrice').value) || 0,
    note: document.getElementById('pNote').value.trim(),
    popular: document.getElementById('pPopular').value === 'yes',
  };
  if (!data.weight || !data.name || !data.price) { alert('Please fill in Weight, Name, and Price.'); return; }

  if (editingProductId) {
    const idx = products.findIndex(p => p.id === editingProductId);
    if (idx !== -1) products[idx] = { ...products[idx], ...data };
  } else {
    const maxId = products.reduce((max, p) => Math.max(max, p.id), 0);
    products.push({ id: maxId + 1, ...data });
  }
  saveProducts(products);
  closeProductModal();
  renderProductsTable();
  loadDashboardData();
}

function editProduct(id) {
  const p = getProducts().find(p => p.id === id);
  if (p) openProductModal(p);
}

function deleteProduct(id) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  let products = getProducts().filter(p => p.id !== id);
  saveProducts(products);
  renderProductsTable();
  loadDashboardData();
}

// ── ORDERS (with customer info) ──
function renderOrders() {
  const orders = getOrders();
  const container = document.getElementById('ordersContainer');
  if (!container) return;
  if (orders.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📦</div><p>No orders received yet.</p></div>`;
    return;
  }
  container.innerHTML = orders.map(o => {
    let shippingHtml = '';
    if (o.shipping) {
      const mapLink = o.shipping.lat ? `<a href="https://www.google.com/maps?q=${o.shipping.lat},${o.shipping.lng}" target="_blank" style="color:var(--gold);text-decoration:none;">📍 View on Map</a>` : '';
      shippingHtml = `
        <div style="font-size:12px; color:rgba(228,237,231,0.6); margin-top:10px; padding:10px; background:rgba(255,255,255,0.02); border-radius:8px;">
          <div style="margin-bottom:4px;"><strong style="color:var(--mist);">Delivery Address:</strong> ${o.shipping.address}, ${o.shipping.city} - ${o.shipping.pin}</div>
          ${mapLink}
        </div>
      `;
    }

    return `
    <div class="order-card">
      <div class="order-header">
        <span class="order-id">${o.id}</span>
        <span class="order-date">${o.date}</span>
      </div>
      <div class="order-items">${o.items.join(' · ')}</div>
      <div class="order-total">Total: ₹${o.total.toLocaleString('en-IN')}</div>
      ${o.customer ? `
        <div class="order-customer">
          👤 <strong>${o.customer.name}</strong> · 📧 ${o.customer.email} · 📱 ${o.customer.phone}
        </div>
      ` : ''}
      ${shippingHtml}
    </div>
  `}).join('');
}

// ── FEEDBACKS ──
function renderFeedbacks() {
  const feedbacks = getFeedbacks();
  const container = document.getElementById('feedbacksContainer');
  if (!container) return;
  if (feedbacks.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">💬</div><p>No feedback received yet.</p></div>`;
    return;
  }
  container.innerHTML = feedbacks.map(f => `
    <div class="feedback-card">
      <div class="feedback-meta">
        <span>👤 <strong>${f.name}</strong></span>
        <span>📞 ${f.contact}</span>
        ${f.city ? '<span>📍 ' + f.city + '</span>' : ''}
        ${f.packet ? '<span>📦 ' + f.packet + '</span>' : ''}
        <span>🕐 ${f.date}</span>
      </div>
      <div class="feedback-message">"${f.message}"</div>
    </div>
  `).join('');
}

// ── CUSTOMERS ──
function renderCustomers() {
  const customers = getCustomers();
  const container = document.getElementById('customersContainer');
  if (!container) return;
  if (customers.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👥</div><p>No registered customers yet.</p></div>`;
    return;
  }
  container.innerHTML = customers.map(c => `
    <div class="feedback-card">
      <div class="feedback-meta">
        <span>👤 <strong>${c.name}</strong></span>
        <span>📧 ${c.email}</span>
        <span>📱 ${c.phone}</span>
        <span>🕐 ${new Date(c.createdAt).toLocaleDateString('en-IN')}</span>
      </div>
    </div>
  `).join('');
}
