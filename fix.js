const fs = require('fs');
const content = fs.readFileSync('public/js/app.js', 'utf8');
const lines = content.split('\n');

const missingCode = `// ── TESTIMONIAL AUTO-SCROLL ──
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
        'Authorization': \`Bearer \${token}\`
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
  
  container.innerHTML = wishProducts.map(p => \`
    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; text-align: center; position: relative;">
      <button onclick="toggleWishlist(event, '\${p.id}'); setTimeout(renderMyWishlist, 100);" style="position: absolute; top: 5px; right: 5px; background: transparent; border: none; color: var(--gold); font-size: 18px; cursor: pointer;">✕</button>
      <img src="\${p.image || '/images/pouch.png'}" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 10px;">
      <div style="font-size: 13px; color: white; font-weight: 600;">\${p.name}</div>
      <div style="color: var(--gold); font-size: 12px; margin-top: 5px;">₹\${p.price}</div>
      <button onclick="addToCart('\${p.id}'); showToast('Added to Cart');" style="margin-top: 10px; background: var(--gold); border: none; color: black; font-size: 11px; padding: 5px 10px; border-radius: 4px; cursor: pointer; width: 100%;">Move to Cart</button>
    </div>
  \`).join('');
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
      
      return \`
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(228,237,231,0.1); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 10px;">
            <div>
              <div style="font-size: 14px; font-weight: bold; color: var(--gold);">\${o.id}</div>
              <div style="font-size: 12px; color: var(--mist);">\${o.date}</div>
            </div>
            <div>
              <span style="background: \${statusColor}22; color: \${statusColor}; border: 1px solid \${statusColor}; border-radius: 12px; padding: 4px 10px; font-size: 12px; font-weight: bold;">
                \${o.status || 'Pending'}
              </span>
            </div>
          </div>
          <div style="font-size: 14px; color: var(--white); margin-bottom: 10px; line-height: 1.5;">
            \${o.items.join('<br>')}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; gap: 10px;">
              \${o.status === 'Delivered' ? \`
                \${o.review ? \`<span style="font-size: 12px; color: var(--gold);">⭐ Reviewed (\${o.review.rating}/5)</span>\` : \`<button onclick="openReviewModal('\${o.id}')" style="background: none; border: 1px solid var(--gold); color: var(--gold); padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">⭐ Review</button>\`}\`
                \${o.complaint ? \`<span style="font-size: 12px; color: #e74c3c;">⚠️ Complaint Filed</span>\` : \`<button onclick="openComplaintModal('\${o.id}')" style="background: none; border: 1px solid #e74c3c; color: #e74c3c; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">⚠️ Complain</button>\`}\`
              : \`<span style="font-size: 12px; color: var(--mist);">Options available after delivery</span>\`}
            </div>
            <div style="text-align: right; font-weight: bold; color: var(--gold);">
              Total: ₹\${o.total.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      \`;
    }).join('');
    
  } catch(err) {
    console.error(err);
    container.innerHTML = '<div style="text-align:center; padding: 20px; color: #e74c3c;">Failed to load orders. Please try again later.</div>';
  }
}
`;

lines.splice(1070, 9, missingCode);
fs.writeFileSync('public/js/app.js', lines.join('\n'));
console.log('Fixed app.js successfully!');
