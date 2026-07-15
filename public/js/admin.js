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

  // Render Charts
  renderCharts(orders);
}

// ── CHARTS ──
let salesChartInstance = null;
let productsChartInstance = null;

function renderCharts(orders) {
  // 1. Process Data for Sales Chart
  const salesByDate = {};
  const sortedOrders = [...orders].reverse(); // oldest first for timeline
  
  sortedOrders.forEach(o => {
    let dateStr = 'Unknown';
    if (o.date) {
      dateStr = o.date.split(',')[0].trim();
    } else if (o.createdAt && o.createdAt._seconds) {
      dateStr = new Date(o.createdAt._seconds * 1000).toLocaleDateString('en-IN');
    }
    
    if (!salesByDate[dateStr]) salesByDate[dateStr] = 0;
    salesByDate[dateStr] += (o.total || 0);
  });

  const salesLabels = Object.keys(salesByDate).slice(-7); // Last 7 active days
  const salesData = salesLabels.map(label => salesByDate[label]);

  // 2. Process Data for Products Chart
  const productCounts = {};
  orders.forEach(o => {
    if (o.items && Array.isArray(o.items)) {
      o.items.forEach(itemStr => {
        let name = itemStr;
        let qty = 1;
        // Parse 'Product Name x2' format
        const match = itemStr.match(/(.*)\s+x(\d+)$/);
        if (match) {
          name = match[1].trim();
          qty = parseInt(match[2], 10);
        }
        if (!productCounts[name]) productCounts[name] = 0;
        productCounts[name] += qty;
      });
    }
  });

  const prodLabels = Object.keys(productCounts);
  const prodData = prodLabels.map(label => productCounts[label]);

  // 3. Render Sales Chart
  const ctxSales = document.getElementById('salesChart');
  if (ctxSales) {
    if (salesChartInstance) salesChartInstance.destroy();
    salesChartInstance = new Chart(ctxSales, {
      type: 'line',
      data: {
        labels: salesLabels,
        datasets: [{
          label: 'Revenue (₹)',
          data: salesData,
          borderColor: '#d4af37', // Gold
          backgroundColor: 'rgba(212, 175, 55, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)' } },
          x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.5)' } }
        }
      }
    });
  }

  // 4. Render Products Chart
  const ctxProd = document.getElementById('productsChart');
  if (ctxProd) {
    if (productsChartInstance) productsChartInstance.destroy();
    
    // Theme colors for doughnut
    const colors = ['#d4af37', '#2e4a3b', '#e4ede7', '#a0b0a5', '#6b8a76', '#1a2e24', '#f5f7f6'];
    
    productsChartInstance = new Chart(ctxProd, {
      type: 'doughnut',
      data: {
        labels: prodLabels,
        datasets: [{
          data: prodData,
          backgroundColor: colors.slice(0, prodLabels.length),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: 'rgba(255,255,255,0.7)' } }
        }
      }
    });
  }
}

// ── PRODUCTS TABLE ──
let allProducts = [];
let editProductId = null;

async function renderProductsTable() {
  allProducts = await fetchAPI('/products') || [];
  const tbody = document.getElementById('productsBody');
  if (!tbody) return;
  if (allProducts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:rgba(228,237,231,0.35);">No products yet. Click "Add Product" to get started.</td></tr>`;
    return;
  }
  tbody.innerHTML = allProducts.map(p => `
    <tr>
      <td><img src="${p.image}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;" /></td>
      <td style="font-weight:600; color:var(--white);">${p.weight} ${p.name}</td>
      <td style="color:var(--gold); font-weight:600;">₹${p.price.toLocaleString('en-IN')}</td>
      <td style="font-size:12px; color:rgba(228,237,231,0.4); max-width:200px;">${p.note}</td>
      <td>${p.popular ? '<span class="table-badge badge-popular">⭐ Popular</span>' : '<span class="table-badge badge-new">Standard</span>'}</td>
      <td>
        <button class="btn-edit" onclick="editProduct('${p.id}')">Edit</button>
        <button class="btn-delete" onclick="deleteProduct('${p.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

window.editProduct = function(id) {
  const p = allProducts.find(x => x.id === id);
  if (p) openProductModal(p);
};

// ── PRODUCT MODAL ──
function initProductModal() {
  document.getElementById('addProductBtn')?.addEventListener('click', openProductModal);
  document.getElementById('modalClose')?.addEventListener('click', closeProductModal);
  document.getElementById('modalCancel')?.addEventListener('click', closeProductModal);
  document.getElementById('productForm')?.addEventListener('submit', saveProduct);
  document.getElementById('productModal')?.addEventListener('click', (e) => { if (e.target.id === 'productModal') closeProductModal(); });
}

function openProductModal(product = null) {
  const modal = document.getElementById('productModal');
  const title = document.getElementById('modalTitle');
  const form = document.getElementById('productForm');
  form.reset();
  
  if (product && product.id) {
    editProductId = product.id;
    title.textContent = 'Edit Product';
    document.getElementById('pWeight').value = product.weight || '';
    document.getElementById('pName').value = product.name || '';
    document.getElementById('pPrice').value = product.price || '';
    document.getElementById('pNote').value = product.note || '';
    document.getElementById('pPopular').value = product.popular ? 'yes' : 'no';
    document.getElementById('pImage').removeAttribute('required');
  } else {
    editProductId = null;
    title.textContent = 'Add New Product';
    document.getElementById('pImage').setAttribute('required', 'true');
  }
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
  } else if (!editProductId) {
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
    const url = editProductId ? `/api/products/${editProductId}` : '/api/products';
    const method = editProductId ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method: method,
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

// ── PROMO CODES ──
async function loadPromos() {
  const token = localStorage.getItem('ff_admin_token');
  try {
    const res = await fetch('/api/admin/promos', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load promos');
    const promos = await res.json();
    renderPromos(promos);
  } catch (err) {
    console.error(err);
  }
}

function renderPromos(promos) {
  const tbody = document.getElementById('promosBody');
  if (!tbody) return;
  if (promos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--mist);">No promo codes active.</td></tr>`;
    return;
  }
  tbody.innerHTML = promos.map(p => `
    <tr>
      <td><strong>${p.code}</strong></td>
      <td>${p.discountPercentage}%</td>
      <td><span class="status-badge status-pending">${p.active ? 'Active' : 'Inactive'}</span></td>
      <td>
        <button class="btn-cancel" onclick="deletePromo('${p.id}')" style="padding:4px 8px; font-size:12px;">Delete</button>
      </td>
    </tr>
  `).join('');
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

// ── PROMO CODES ──
async function loadPromos() {
  const token = localStorage.getItem('ff_admin_token');
  try {
    const res = await fetch('/api/admin/promos', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load promos');
    const promos = await res.json();
    renderPromos(promos);
  } catch (err) {
    console.error(err);
  }
}

function renderPromos(promos) {
  const tbody = document.getElementById('promosBody');
  if (!tbody) return;
  if (promos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--mist);">No promo codes active.</td></tr>`;
    return;
  }
  tbody.innerHTML = promos.map(p => `
    <tr>
      <td><strong>${p.code}</strong></td>
      <td>${p.discountPercentage}%</td>
      <td><span class="status-badge status-pending">${p.active ? 'Active' : 'Inactive'}</span></td>
      <td>
        <button class="btn-cancel" onclick="deletePromo('${p.id}')" style="padding:4px 8px; font-size:12px;">Delete</button>
      </td>
    </tr>
  `).join('');
}

document.getElementById('promoForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = document.getElementById('promoCode').value;
  const discountPercentage = document.getElementById('promoDiscount').value;
  const token = localStorage.getItem('ff_admin_token');
  try {
    const res = await fetch('/api/admin/promos', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ code, discountPercentage, active: true })
    });
    if (!res.ok) throw new Error('Failed to create promo');
    
    document.getElementById('promoCode').value = '';
    document.getElementById('promoDiscount').value = '';
    loadPromos();
  } catch (err) {
    console.error(err);
    alert('Failed to create promo code');
  }
});

async function deletePromo(id) {
  if (!confirm('Are you sure you want to delete this promo code?')) return;
  const token = localStorage.getItem('ff_admin_token');
  try {
    const res = await fetch(`/api/admin/promos/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      loadPromos();
    }
  } catch (err) {
    console.error(err);
    alert('Failed to delete promo code');
  }
}

// Ensure promos, reviews, and blogs are loaded when dashboard loads
const originalLoadDashboardData = loadDashboardData;
loadDashboardData = async function() {
  await originalLoadDashboardData();
  await loadPromos();
  await loadReviews();
  await loadBlogs();
  await loadSubscribers();
};

// ── REVIEWS ──
async function loadReviews() {
  const token = localStorage.getItem('ff_admin_token');
  try {
    const res = await fetch('/api/admin/reviews', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load reviews');
    const reviews = await res.json();
    renderAdminReviews(reviews);
  } catch (err) {
    console.error(err);
  }
}

function renderAdminReviews(reviews) {
  const tbody = document.getElementById('reviewsBody');
  if (!tbody) return;
  if (reviews.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--mist);">No photo reviews found.</td></tr>`;
    return;
  }
  tbody.innerHTML = reviews.map(r => `
    <tr>
      <td>${r.photoUrl ? `<img src="${r.photoUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;">` : 'No Photo'}</td>
      <td>${r.productId}</td>
      <td><strong>${r.name}</strong></td>
      <td>${'⭐'.repeat(r.rating)}</td>
      <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${r.comment}">${r.comment}</td>
      <td>
        <button class="btn-cancel" onclick="deleteReview('${r.id}')" style="padding:4px 8px; font-size:12px;">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function deleteReview(id) {
  if (!confirm('Are you sure you want to delete this review?')) return;
  const token = localStorage.getItem('ff_admin_token');
  try {
    const res = await fetch(`/api/admin/reviews/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      loadReviews();
    }
  } catch (err) {
    console.error(err);
    alert('Failed to delete review');
  }
}

// ── BLOGS & SEO ──
async function loadBlogs() {
  try {
    const res = await fetch('/api/blogs');
    if (!res.ok) throw new Error('Failed to load blogs');
    const blogs = await res.json();
    renderAdminBlogs(blogs);
  } catch (err) {
    console.error(err);
  }
}

function renderAdminBlogs(blogs) {
  const tbody = document.getElementById('blogsBody');
  if (!tbody) return;
  if (blogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--mist);">No blog posts found.</td></tr>`;
    return;
  }
  tbody.innerHTML = blogs.map(b => `
    <tr>
      <td><strong>${b.title}</strong></td>
      <td>/blog/${b.slug}</td>
      <td>${b.createdAt ? new Date(b.createdAt._seconds ? b.createdAt._seconds * 1000 : b.createdAt).toLocaleDateString() : ''}</td>
      <td>
        <a href="/blog/${b.slug}" target="_blank" class="btn" style="padding:4px 8px; font-size:12px; text-decoration:none; margin-right:8px;">View</a>
        <button class="btn-cancel" onclick="deleteBlog('${b.id}')" style="padding:4px 8px; font-size:12px;">Delete</button>
      </td>
    </tr>
  `).join('');
}

function openBlogModal() {
  document.getElementById('blogForm').reset();
  document.getElementById('blogModalOverlay').classList.add('open');
}

function closeBlogModal() {
  document.getElementById('blogModalOverlay').classList.remove('open');
}

document.getElementById('blogForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = localStorage.getItem('ff_admin_token');
  const payload = {
    title: document.getElementById('blogTitle').value,
    slug: document.getElementById('blogSlug').value,
    imageUrl: document.getElementById('blogImageUrl').value,
    excerpt: document.getElementById('blogExcerpt').value,
    content: document.getElementById('blogContent').value,
    metaDescription: document.getElementById('blogMeta').value,
    keywords: document.getElementById('blogKeywords').value
  };

  try {
    const res = await fetch('/api/admin/blogs', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to save blog');
    
    closeBlogModal();
    loadBlogs();
  } catch (err) {
    console.error(err);
    alert('Failed to save blog post');
  }
});

async function deleteBlog(id) {
  if (!confirm('Are you sure you want to delete this blog post?')) return;
  const token = localStorage.getItem('ff_admin_token');
  try {
    const res = await fetch(`/api/admin/blogs/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      loadBlogs();
    }
  } catch (err) {
    console.error(err);
    alert('Failed to delete blog');
  }
}
