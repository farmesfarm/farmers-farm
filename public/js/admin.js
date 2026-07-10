/* ═══════════════════════════════════════════════════════════════
   FARMERS FARM – Admin Dashboard JS
   Auth + Product CRUD + Orders (with customer info) + Feedbacks
   ═══════════════════════════════════════════════════════════════ */

// ── ADMIN CREDENTIALS ──
const SESSION_KEY = 'ff_admin_session';
const TOKEN_KEY = 'ff_admin_token';

// ── DATA HELPERS (Async) ──
async function fetchAPI(endpoint, options = {}) {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = { ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const res = await fetch('/api' + endpoint, { ...options, headers });
    return await res.json();
  } catch(e) {
    console.error('API Error:', e);
    return null;
  }
}

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
  switchPage('overview');
}

let loginStep = 1;

function initLogin() {
  document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPass').value.trim();
    const errorEl = document.getElementById('loginError');
    const submitBtn = document.getElementById('loginSubmitBtn');

    submitBtn.textContent = 'Signing In...';
    submitBtn.disabled = true;

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok && data.success && data.token) {
        localStorage.setItem(SESSION_KEY, 'active');
        localStorage.setItem(TOKEN_KEY, data.token);
        errorEl.classList.remove('show');
        showDashboard();
      } else {
        errorEl.textContent = data.error || '❌ Access denied.';
        errorEl.classList.add('show');
      }
    } catch(err) {
      errorEl.textContent = '❌ Error connecting to server.';
      errorEl.classList.add('show');
    } finally {
      submitBtn.textContent = 'Sign In →';
      submitBtn.disabled = false;
    }
  });
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TOKEN_KEY);
  showLogin();
  document.getElementById('loginEmail').value = '';
  const passEl = document.getElementById('loginPass');
  if (passEl) passEl.value = '';
}

// ── SIDEBAR ──
function initSidebar() {
  document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
    link.addEventListener('click', () => switchPage(link.dataset.page));
  });
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
}

async function switchPage(page) {
  document.querySelectorAll('.sidebar-link[data-page]').forEach(l => l.classList.toggle('active', l.dataset.page === page));
  document.querySelectorAll('.admin-page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
  if (page === 'overview') await loadDashboardData();
  if (page === 'products') await renderProductsTable();
  if (page === 'orders') await renderOrders();
  if (page === 'feedbacks') await renderFeedbacks();
  if (page === 'complaints') await renderComplaints();
  if (page === 'customers') await renderCustomers();
}

// ── OVERVIEW ──
async function loadDashboardData() {
  const products = await fetchAPI('/products') || [];
  const orders = await fetchAPI('/orders') || [];
  const feedbacks = await fetchAPI('/feedbacks') || [];
  const customers = await fetchAPI('/customers') || [];

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
  
  const complaintsCount = orders.filter(o => o.complaint).length;
  const complaintBadge = document.getElementById('complaintsBadge');
  if (complaintBadge) { complaintBadge.textContent = complaintsCount; complaintBadge.style.display = complaintsCount > 0 ? 'inline' : 'none'; }
}

// ── PRODUCTS TABLE ──
async function renderProductsTable() {
  const products = await fetchAPI('/products') || [];
  const tbody = document.getElementById('productsBody');
  if (!tbody) return;
  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:rgba(228,237,231,0.35);">No products yet. Click "Add Product" to get started.</td></tr>`;
    return;
  }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td><img src="${p.image}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;" /></td>
      <td style="font-weight:600; color:var(--white);">${p.weight} ${p.name}</td>
      <td style="color:var(--gold); font-weight:600;">₹${p.price.toLocaleString('en-IN')}</td>
      <td style="font-size:12px; color:rgba(228,237,231,0.4); max-width:200px;">${p.note}</td>
      <td>${p.popular ? '<span class="table-badge badge-popular">⭐ Popular</span>' : '<span class="table-badge badge-new">Standard</span>'}</td>
      <td>
        <button class="btn-delete" onclick="deleteProduct(${p.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

// ── PRODUCT MODAL ──
function initProductModal() {
  document.getElementById('addProductBtn')?.addEventListener('click', openProductModal);
  document.getElementById('modalClose')?.addEventListener('click', closeProductModal);
  document.getElementById('modalCancel')?.addEventListener('click', closeProductModal);
  document.getElementById('productForm')?.addEventListener('submit', saveProduct);
  document.getElementById('productModal')?.addEventListener('click', (e) => { if (e.target.id === 'productModal') closeProductModal(); });
}

function openProductModal() {
  const modal = document.getElementById('productModal');
  const title = document.getElementById('modalTitle');
  title.textContent = 'Add New Product';
  document.getElementById('productForm').reset();
  modal.classList.add('open');
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('open');
}

async function saveProduct(e) {
  e.preventDefault();
  
  const fileInput = document.getElementById('pImage');
  const formData = new FormData();
  if (fileInput.files.length > 0) {
    formData.append('image', fileInput.files[0]);
  } else {
    alert('Please upload an image.');
    return;
  }
  
  formData.append('weight', document.getElementById('pWeight').value.trim());
  formData.append('name', document.getElementById('pName').value.trim());
  formData.append('price', document.getElementById('pPrice').value);
  formData.append('note', document.getElementById('pNote').value.trim());
  formData.append('popular', document.getElementById('pPopular').value === 'yes');
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.textContent = 'Saving...';
  submitBtn.disabled = true;

  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    
    if (res.ok) {
      closeProductModal();
      await renderProductsTable();
      await loadDashboardData();
    } else {
      alert('Failed to save product');
    }
  } catch(err) {
    console.error(err);
    alert('Error saving product');
  } finally {
    submitBtn.textContent = 'Save Product';
    submitBtn.disabled = false;
  }
}

async function deleteProduct(id) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  try {
    await fetchAPI('/products/' + id, { method: 'DELETE' });
    await renderProductsTable();
    await loadDashboardData();
  } catch(e) {
    console.error(e);
  }
}

// ── ORDERS ──
async function renderOrders() {
  const orders = await fetchAPI('/orders') || [];
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

    const statusOptions = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    const statusSelect = `
      <select onchange="updateOrderStatus('${o.id}', this.value)" style="margin-left: 10px; padding: 4px; border-radius: 4px; border: 1px solid var(--gold); background: var(--black); color: var(--gold);">
        ${statusOptions.map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    `;

    let feedbackHtml = '';
    if (o.review || o.complaint) {
      feedbackHtml += `<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.05);">`;
      if (o.review) {
        feedbackHtml += `<div style="margin-bottom: 8px; font-size: 13px;">
          <strong style="color: var(--gold);">⭐ Review (${o.review.rating}/5):</strong> 
          <span style="color: var(--white);">${o.review.comment}</span> 
          <span style="color: var(--mist); font-size: 11px;">(${o.review.date})</span>
        </div>`;
      }
      if (o.complaint) {
        feedbackHtml += `<div style="font-size: 13px;">
          <strong style="color: #e74c3c;">⚠️ Complaint:</strong> 
          <span style="color: var(--white);">${o.complaint.text}</span> 
          <span style="color: var(--mist); font-size: 11px;">(${o.complaint.date})</span>
        </div>`;
      }
      feedbackHtml += `</div>`;
    }

    return `
    <div class="order-card">
      <div class="order-header">
        <div><span class="order-id">${o.id}</span> ${statusSelect}</div>
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
      ${feedbackHtml}
    </div>
  `}).join('');
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const res = await fetch('/api/orders/' + orderId + '/status', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      alert('Order status updated successfully!');
      await loadDashboardData();
    } else {
      alert('Failed to update status.');
    }
  } catch(e) {
    console.error(e);
    alert('Error updating status.');
  }
}

// ── FEEDBACKS ──
async function renderFeedbacks() {
  const feedbacks = await fetchAPI('/feedbacks') || [];
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

// ── COMPLAINTS ──
async function renderComplaints() {
  const orders = await fetchAPI('/orders') || [];
  const container = document.getElementById('complaintsContainer');
  if (!container) return;
  const complaints = orders.filter(o => o.complaint);
  
  if (complaints.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon" style="color:var(--mist);">✅</div><p>No complaints reported! Everything is smooth.</p></div>`;
    return;
  }
  container.innerHTML = complaints.map(o => `
    <div class="feedback-card" style="border-left: 4px solid #e74c3c;">
      <div class="feedback-meta">
        <span>👤 <strong>${o.customer ? o.customer.name : 'Unknown'}</strong></span>
        <span>📞 ${o.customer ? o.customer.phone : 'Unknown'}</span>
        <span>📦 Order ID: ${o.id}</span>
        <span>🕐 ${o.complaint.date}</span>
      </div>
      <div class="feedback-message" style="color: #e74c3c; font-weight: 500;">
        " ${o.complaint.text} "
      </div>
    </div>
  `).join('');
}

// ── CUSTOMERS ──
async function renderCustomers() {
  const customers = await fetchAPI('/customers') || [];
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

