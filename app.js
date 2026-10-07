// Database state handling (JSON in localStorage)
const STORAGE_KEY = 'RENTAL_PS_DB_V1';

// Seed Initial Data if empty
async function initDatabase() {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (!existing) {
    try {
      const resp = await fetch('/api/db');
      if (resp.ok) {
        const seed = await resp.json();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        return;
      }
    } catch (e) {
      // ignore and fallback below
    }

    try {
      const resp = await fetch('data.json');
      const seed = await resp.json();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return;
    } catch (e) {
      // Fallback if opened without local HTTP server
      const defaultData = {
        units: [
          { id: "u1", name: "PS 4 #1", type: "PS4", ratePerHour: 8000, status: "ready", startTime: null, targetMinutes: 0, orderItems: [] },
          { id: "u2", name: "PS 4 #2", type: "PS4", ratePerHour: 8000, status: "ready", startTime: null, targetMinutes: 0, orderItems: [] },
          { id: "u3", name: "PS 3 #1", type: "PS3", ratePerHour: 5000, status: "ready", startTime: null, targetMinutes: 0, orderItems: [] },
          { id: "u4", name: "PS 3 #2", type: "PS3", ratePerHour: 5000, status: "ready", startTime: null, targetMinutes: 0, orderItems: [] },
          { id: "u5", name: "PS 3 #3", type: "PS3", ratePerHour: 5000, status: "ready", startTime: null, targetMinutes: 0, orderItems: [] },
          { id: "u6", name: "PS 3 #4", type: "PS3", ratePerHour: 5000, status: "ready", startTime: null, targetMinutes: 0, orderItems: [] }
        ],
        products: [
          { id: "p1", name: "Kopi Hitam / Tubruk", category: "Minuman", price: 4000, stock: 25 },
          { id: "p2", name: "Es Teh Manis", category: "Minuman", price: 3000, stock: 50 },
          { id: "p3", name: "Nutrisari / Jeruk Dingin", category: "Minuman", price: 4000, stock: 30 },
          { id: "p4", name: "Mie Instan Rebus / Goreng", category: "Makanan", price: 7000, stock: 20 },
          { id: "p5", name: "Mie Instan + Telur", category: "Makanan", price: 10000, stock: 15 },
          { id: "p6", name: "Keripik / Snack Ringan", category: "Snack", price: 2000, stock: 40 }
        ],
        history: []
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
    }
  }
}

function getDB() {
  const str = localStorage.getItem(STORAGE_KEY);
  return str ? JSON.parse(str) : { units: [], products: [], history: [] };
}

function saveDB(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  try {
    fetch('/api/db', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }).catch(() => {
      // ignore when run without local server
    });
  } catch (error) {
    // ignore when browser environment does not allow fetch
  }
}

function productStockValue(product) {
  if (!product) return null;
  if (product.stock === null || product.stock === undefined || product.stock === '') return null;
  const parsed = Number(product.stock);
  return Number.isFinite(parsed) ? parsed : null;
}

function getProductImageUrl(product) {
  if (product && product.image) return product.image;
  return 'assets/placeholder-product.svg';
}

function getUnitImageUrl(unit) {
  if (unit && unit.image) return unit.image;
  return 'assets/placeholder-unit.svg';
}

function inferUnitTypeFromName(name) {
  const normalized = (name || '').toLowerCase();
  if (normalized.includes('tv')) return 'TV';
  return 'PS';
}

// Global active modal unit
let activeUnitId = null;
let chosenDurationMinutes = 0;
let editingProductId = null;
let editingUnitId = null;
let pendingAdminTab = null;

// Ganti sandi sesuai keinginan Anda di sini
const ADMIN_PIN = "160107";

function activateTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

  const target = document.getElementById(`tab-${tabName}`);
  if (target) target.classList.add('active');

  const btn = document.getElementById(`btn-nav-${tabName}`);
  if (btn) btn.classList.add('active');

  if (tabName === 'kasir') renderUnits();
  if (tabName === 'riwayat') renderHistory();
  if (tabName === 'admin') {
    renderAdminProducts();
    renderAdminUnits();
    renderAdminHistory();
  }
}

function openAdminLoginModal() {
  pendingAdminTab = 'admin';
  const errorEl = document.getElementById('adminLoginError');
  if (errorEl) errorEl.textContent = '';
  const input = document.getElementById('adminLoginPin');
  if (input) {
    input.value = '';
    input.focus();
  }
  document.getElementById('modalAdminLogin').classList.add('open');
}

function submitAdminLogin(event) {
  if (event) event.preventDefault();
  const input = document.getElementById('adminLoginPin');
  const errorEl = document.getElementById('adminLoginError');
  const enteredPin = input ? input.value.trim() : '';

  if (enteredPin !== ADMIN_PIN) {
    if (errorEl) errorEl.textContent = 'PIN salah! Silakan coba lagi.';
    return;
  }

  closeAllModals();
  if (pendingAdminTab) {
    activateTab(pendingAdminTab);
    pendingAdminTab = null;
  }
}

// Tabs Navigation dengan proteksi sandi
function switchTab(tabName) {
  if (tabName === 'admin') {
    openAdminLoginModal();
    return;
  }

  activateTab(tabName);
}

function bindProductImageUpload() {
  const attachImagePreview = (inputId, hiddenId, previewId, fallbackSrc = 'assets/placeholder-product.svg') => {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;

    input.addEventListener('change', function (event) {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        preview.src = fallbackSrc;
        const hidden = document.getElementById(hiddenId);
        if (hidden) hidden.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = function (e) {
        preview.src = e.target.result;
        const hidden = document.getElementById(hiddenId);
        if (hidden) hidden.value = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  attachImagePreview('adminProdImageUpload', 'adminProdImage', 'adminProdImagePreview');
  attachImagePreview('editProdImageUpload', 'editProdImage', 'editProdImagePreview');
  attachImagePreview('adminUnitImageUpload', 'adminUnitImage', 'adminUnitImagePreview', 'assets/placeholder-unit.svg');
  attachImagePreview('editUnitImageUpload', 'editUnitImage', 'editUnitImagePreview', 'assets/placeholder-unit.svg');
}

// Helpers
function formatRupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

function calculateCost(ratePerHour, elapsedSec, targetMinutes) {
  if (targetMinutes > 0) {
    return Math.round((targetMinutes / 60) * ratePerHour);
  }
  // Mode LOSS: hitungan proporsional per detik
  return Math.round((elapsedSec / 3600) * ratePerHour);
}

function formatTimer(elapsedSec, targetMinutes) {
  if (targetMinutes > 0) {
    const remaining = Math.max(0, (targetMinutes * 60) - elapsedSec);
    const m = Math.floor(remaining / 60).toString().padStart(2, '0');
    const s = (remaining % 60).toString().padStart(2, '0');
    return `Sisa ${m}:${s}`;
  }
  const h = Math.floor(elapsedSec / 3600).toString().padStart(2, '0');
  const m = Math.floor((elapsedSec % 3600) / 60).toString().padStart(2, '0');
  const s = (elapsedSec % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function showWarningToast(message) {
  const toast = document.getElementById('unitWarningToast');
  if (!toast) {
    alert(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showWarningToast.timeoutId);
  showWarningToast.timeoutId = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

function checkNearFinishWarnings() {
  const db = getDB();
  const warnedUnits = window.__nearFinishWarnedUnits || {};

  db.units.forEach(unit => {
    if (unit.status !== 'running' || !unit.startTime || unit.targetMinutes <= 0) {
      delete warnedUnits[unit.id];
      return;
    }

    const elapsedSec = Math.floor((Date.now() - unit.startTime) / 1000);
    const remainingSec = Math.max(0, (unit.targetMinutes * 60) - elapsedSec);
    const warningThresholdSec = 5 * 60;

    if (remainingSec <= warningThresholdSec && !warnedUnits[unit.id]) {
      warnedUnits[unit.id] = true;
      showWarningToast(`Waktu ${unit.name} tinggal ${Math.max(1, Math.ceil(remainingSec / 60))} menit. Sudah mau selesai?`);
    }

    if (remainingSec > warningThresholdSec) {
      delete warnedUnits[unit.id];
    }
  });

  window.__nearFinishWarnedUnits = warnedUnits;
}

// --- TAB 1: KASIR ---
function renderUnits() {
  const db = getDB();
  const grid = document.getElementById('unitsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  db.units.forEach(unit => {
    const isRunning = unit.status === 'running';
    const card = document.createElement('div');
    card.className = `unit-card ${isRunning ? 'running' : ''}`;

    let elapsedSec = 0;
    let rentalCost = 0;
    let timerLabel = 'Tersedia';

    if (isRunning && unit.startTime) {
      elapsedSec = Math.floor((Date.now() - unit.startTime) / 1000);
      rentalCost = calculateCost(unit.ratePerHour, elapsedSec, unit.targetMinutes);
      timerLabel = formatTimer(elapsedSec, unit.targetMinutes);
    }

    const itemsCost = (unit.orderItems || []).reduce((acc, item) => acc + (item.price * item.qty), 0);
    const totalCurrentCost = rentalCost + itemsCost;

    const unitType = inferUnitTypeFromName(unit.name);

    card.innerHTML = `
      <div>
        <div class="unit-image">
          <img src="${getUnitImageUrl(unit)}" alt="${unit.name}">
        </div>
        <div class="unit-header">
          <div class="unit-title">${unit.name}</div>
          <span class="badge ${unitType === 'TV' ? 'badge-ready' : 'badge-running'}" style="margin-top:6px; display:inline-block;">
            ${unitType}
          </span>
          <span class="badge ${isRunning ? 'badge-running' : 'badge-ready'}" style="margin-left:6px;">
            ${isRunning ? (unit.targetMinutes === 0 ? 'LOSS' : unit.targetMinutes + 'm') : 'Tersedia'}
          </span>
        </div>
        <div class="unit-rate">Tarif: ${formatRupiah(unit.ratePerHour)} / jam</div>
        
        <div class="timer-box">
          <div class="timer-val">${isRunning ? timerLabel : '00:00:00'}</div>
          <div class="cost-val">${isRunning ? formatRupiah(totalCurrentCost) : 'Siap Pakai'}</div>
          ${itemsCost > 0 ? `<div class="orders-tag">+ Minuman/Snack: ${formatRupiah(itemsCost)}</div>` : ''}
        </div>
      </div>

      <div class="card-actions">
        ${!isRunning ? `
          <button class="btn btn-primary" onclick="openStartModal('${unit.id}')">▶ Mulai</button>
        ` : `
          <button class="btn btn-secondary" onclick="openOrderModal('${unit.id}')">➕ Item</button>
          <button class="btn btn-danger" onclick="openStopModal('${unit.id}')">⏹ Selesai</button>
        `}
      </div>
    `;

    grid.appendChild(card);
  });
}

// Modal Mulai
function openStartModal(unitId) {
  const db = getDB();
  const unit = db.units.find(u => u.id === unitId);
  if (!unit) return;

  activeUnitId = unitId;
  chosenDurationMinutes = 0;

  const customInput = document.getElementById('customDurationInput');
  if (customInput) customInput.value = '';

  document.getElementById('startUnitTitle').textContent = `Mulai Rental - ${unit.name}`;
  document.getElementById('startUnitRate').textContent = `Tarif: ${formatRupiah(unit.ratePerHour)} / jam`;

  // Reset duration button active
  document.querySelectorAll('.duration-buttons .d-btn').forEach(b => b.classList.remove('selected'));
  const def = document.querySelector('.duration-buttons .d-btn[data-mins="0"]');
  if (def) def.classList.add('selected');

  document.getElementById('modalStartRental').classList.add('open');
}

function selectDuration(mins, btnElement) {
  chosenDurationMinutes = mins;
  const customInput = document.getElementById('customDurationInput');
  if (customInput) customInput.value = '';
  document.querySelectorAll('.duration-buttons .d-btn').forEach(b => b.classList.remove('selected'));
  if (btnElement) btnElement.classList.add('selected');
}

function applyCustomDuration() {
  const input = document.getElementById('customDurationInput');
  if (!input) return;

  const customMinutes = parseInt(input.value, 10);
  if (!Number.isFinite(customMinutes) || customMinutes < 1) {
    alert('Masukkan durasi custom minimal 1 menit.');
    return;
  }

  chosenDurationMinutes = customMinutes;
  document.querySelectorAll('.duration-buttons .d-btn').forEach(b => b.classList.remove('selected'));
  input.value = customMinutes;
}

function confirmStartRental() {
  const db = getDB();
  const unit = db.units.find(u => u.id === activeUnitId);
  if (unit) {
    unit.status = 'running';
    unit.startTime = Date.now();
    unit.targetMinutes = chosenDurationMinutes;
    unit.orderItems = [];
    saveDB(db);
    closeAllModals();
    renderUnits();
  }
}

// Modal Tambah Item Minuman / Makanan ke PS yang sedang main
function renderOrderProductList(filter = 'Semua') {
  const db = getDB();
  const listEl = document.getElementById('orderProductList');
  if (!listEl) return;

  const products = filter === 'Semua'
    ? db.products
    : db.products.filter(product => product.category === filter);

  if (products.length === 0) {
    listEl.innerHTML = '<p style="margin:0; color:#94a3b8; font-size:12px;">Tidak ada item di kategori ini.</p>';
    return;
  }

  listEl.innerHTML = products.map(product => {
    const stockValue = productStockValue(product);
    const stockText = stockValue === null ? 'Stok tak terbatas' : `Stok: ${stockValue}`;
    return `
      <div class="order-product-item">
        <img class="order-product-thumb" src="${getProductImageUrl(product)}" alt="${product.name}">
        <div class="order-product-info">
          <div class="order-product-name">${product.name}</div>
          <div class="order-product-meta">${product.category} • ${formatRupiah(product.price)} • ${stockText}</div>
        </div>
        <div class="order-product-controls">
          <button type="button" class="order-qty-control" onclick="adjustOrderQty('${product.id}', -1)">-</button>
          <input type="number" class="order-product-qty form-control" data-product-id="${product.id}" value="0" min="0" max="${stockValue === null ? 999 : stockValue}" />
          <button type="button" class="order-qty-control" onclick="adjustOrderQty('${product.id}', 1)">+</button>
        </div>
      </div>
    `;
  }).join('');
}

function adjustOrderQty(productId, delta) {
  const qtyInputs = document.querySelectorAll('.order-product-qty');
  const target = Array.from(qtyInputs).find(input => input.dataset.productId === productId);
  if (!target) return;

  const db = getDB();
  const product = db.products.find(item => item.id === productId);
  const stockValue = product ? productStockValue(product) : null;
  const currentValue = parseInt(target.value, 10) || 0;
  const nextValue = Math.max(0, currentValue + delta);

  if (stockValue !== null && nextValue > stockValue) {
    alert(`Stok tidak mencukupi! Sisa stok hanya ${stockValue}.`);
    return;
  }

  target.value = nextValue;
}

function openOrderModal(unitId) {
  const db = getDB();
  const unit = db.units.find(u => u.id === unitId);
  if (!unit) return;

  activeUnitId = unitId;
  document.getElementById('orderUnitTitle').textContent = `Tambah Item: ${unit.name}`;

  const categoryFilter = document.getElementById('orderCategoryFilter');
  if (categoryFilter) {
    categoryFilter.value = 'Semua';
    categoryFilter.onchange = function () {
      renderOrderProductList(this.value);
    };
  }

  renderOrderProductList('Semua');
  renderActiveOrderItems(unit);
  document.getElementById('modalOrderItem').classList.add('open');
}

function renderActiveOrderItems(unit) {
  const listEl = document.getElementById('activeOrderList');
  if (!listEl) return;
  const items = unit.orderItems || [];
  if (items.length === 0) {
    listEl.innerHTML = '<p style="color:#94a3b8; font-size:12px; margin-top:8px;">Belum ada pesanan tambahan.</p>';
    return;
  }

  let html = '<div style="margin-top:10px; font-size:13px;"><strong>Pesanan Unit Ini:</strong>';
  items.forEach((it, idx) => {
    html += `<div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f1f5f9;">
      <span>${it.name} x${it.qty}</span>
      <span>${formatRupiah(it.price * it.qty)}</span>
    </div>`;
  });
  html += '</div>';
  listEl.innerHTML = html;
}

function addSelectedItemsToUnit() {
  const db = getDB();
  const unit = db.units.find(u => u.id === activeUnitId);
  if (!unit) return;

  const selectedItems = Array.from(document.querySelectorAll('.order-product-qty'))
    .map(input => ({
      id: input.dataset.productId,
      qty: parseInt(input.value, 10) || 0
    }))
    .filter(item => item.qty > 0);

  if (selectedItems.length === 0) {
    alert('Pilih minimal satu item untuk ditambahkan.');
    return;
  }

  for (const item of selectedItems) {
    const product = db.products.find(p => p.id === item.id);
    if (!product) continue;

    const stockValue = productStockValue(product);
    if (stockValue !== null && stockValue < item.qty) {
      alert(`Stok ${product.name} tidak mencukupi! Sisa stok hanya ${stockValue}.`);
      return;
    }
  }

  let totalSelectedText = '';

  selectedItems.forEach(item => {
    const product = db.products.find(p => p.id === item.id);
    if (!product) return;

    const stockValue = productStockValue(product);
    if (stockValue !== null) {
      product.stock = stockValue - item.qty;
    }

    if (!unit.orderItems) unit.orderItems = [];
    const existingItem = unit.orderItems.find(i => i.id === product.id);
    if (existingItem) {
      existingItem.qty += item.qty;
    } else {
      unit.orderItems.push({
        id: product.id,
        name: product.name,
        price: product.price,
        qty: item.qty
      });
    }

    totalSelectedText += `${product.name} x${item.qty}, `;
  });

  saveDB(db);
  renderActiveOrderItems(unit);
  renderUnits();
  document.querySelectorAll('.order-product-qty').forEach(input => { input.value = 0; });
  alert(`${totalSelectedText.slice(0, -2)} berhasil ditambahkan ke ${unit.name}`);
}

// Modal Selesai & Bayar
function openStopModal(unitId) {
  const db = getDB();
  const unit = db.units.find(u => u.id === unitId);
  if (!unit) return;

  activeUnitId = unitId;
  const elapsedSec = Math.floor((Date.now() - unit.startTime) / 1000);
  const rentalCost = calculateCost(unit.ratePerHour, elapsedSec, unit.targetMinutes);
  const items = unit.orderItems || [];
  const itemsCost = items.reduce((acc, it) => acc + (it.price * it.qty), 0);
  const grandTotal = rentalCost + itemsCost;

  let durDesc = '';
  if (unit.targetMinutes > 0) {
    durDesc = `${unit.targetMinutes} Menit (Paket)`;
  } else {
    const mins = Math.ceil(elapsedSec / 60);
    durDesc = `Mode LOSS (${mins} Menit)`;
  }

  document.getElementById('receiptUnitName').textContent = unit.name;
  document.getElementById('receiptDuration').textContent = durDesc;
  document.getElementById('receiptRentalCost').textContent = formatRupiah(rentalCost);
  document.getElementById('receiptItemsCost').textContent = formatRupiah(itemsCost);
  document.getElementById('receiptTotal').textContent = formatRupiah(grandTotal);

  document.getElementById('modalStopRental').classList.add('open');
}

function processPayment() {
  const db = getDB();
  const unit = db.units.find(u => u.id === activeUnitId);
  if (!unit) return;

  const paymentMethod = document.getElementById('paymentMethodSelect').value;
  const elapsedSec = Math.floor((Date.now() - unit.startTime) / 1000);
  const rentalCost = calculateCost(unit.ratePerHour, elapsedSec, unit.targetMinutes);
  const items = unit.orderItems || [];
  const itemsCost = items.reduce((acc, it) => acc + (it.price * it.qty), 0);
  const grandTotal = rentalCost + itemsCost;

  let durDesc = unit.targetMinutes > 0 ? `${unit.targetMinutes} Menit` : `Mode LOSS (${Math.ceil(elapsedSec / 60)} mnt)`;

  // Add transaction to history
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID') + ' ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const trx = {
    id: 'TRX-' + Date.now().toString().slice(-6),
    date: dateStr,
    unitName: unit.name,
    durationText: durDesc,
    rentalCost: rentalCost,
    itemsCost: itemsCost,
    items: items,
    totalCost: grandTotal,
    paymentMethod: paymentMethod
  };

  db.history.unshift(trx);

  // Reset unit
  unit.status = 'ready';
  unit.startTime = null;
  unit.targetMinutes = 0;
  unit.orderItems = [];

  saveDB(db);
  closeAllModals();
  renderUnits();
  alert(`Pembayaran Sukses! Total: ${formatRupiah(grandTotal)} (${paymentMethod})`);
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
}

// --- TAB 2: RIWAYAT & KEUANGAN ---
function parseTransactionDate(dateStr) {
  if (!dateStr) return new Date(NaN);

  const match = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\s*(\d{1,2})[:.](\d{2})?/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const hours = parseInt(match[4], 10) || 0;
    const minutes = parseInt(match[5], 10) || 0;
    const fullYear = year < 100 ? 2000 + year : year;
    return new Date(fullYear, month, day, hours, minutes);
  }

  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? new Date(NaN) : parsed;
}

function getHistoryFilterDateRange(filterKey) {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfYear = new Date(today.getFullYear(), 0, 1);

  const startOfWeek = new Date(today);
  const day = startOfWeek.getDay();
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  startOfWeek.setDate(today.getDate() + diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const ranges = {
    today: { start: startOfDay, end: new Date(today.getTime()) },
    week: { start: startOfWeek, end: new Date(today.getTime()) },
    month: { start: startOfMonth, end: new Date(today.getTime()) },
    year: { start: startOfYear, end: new Date(today.getTime()) }
  };

  return ranges[filterKey] || { start: null, end: null };
}

function matchesHistoryFilter(trx, filterKey) {
  if (!filterKey || filterKey === 'all') return true;

  const date = parseTransactionDate(trx.date);
  if (Number.isNaN(date.getTime())) return true;

  const range = getHistoryFilterDateRange(filterKey);
  if (!range.start || !range.end) return true;

  return date >= range.start && date <= range.end;
}

function renderHistory() {
  const db = getDB();
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  const filterSelect = document.getElementById('historyFilterSelect');
  const filterKey = filterSelect ? filterSelect.value : 'all';
  const filteredHistory = db.history.filter(trx => matchesHistoryFilter(trx, filterKey));

  tbody.innerHTML = '';

  let totalOmset = 0;
  let totalRental = 0;
  let totalFnb = 0;

  filteredHistory.forEach(trx => {
    totalOmset += trx.totalCost;
    totalRental += trx.rentalCost;
    totalFnb += trx.itemsCost;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${trx.id}</strong></td>
      <td><strong>${trx.date}</strong></td>
      <td><strong>${trx.unitName}</strong><br><small>${trx.durationText}</small></td>
      <td>${formatRupiah(trx.rentalCost)}</td>
      <td>${formatRupiah(trx.itemsCost)}</td>
      <td><strong style="color:#1d4ed8;">${formatRupiah(trx.totalCost)}</strong></td>
      <td><span class="badge ${trx.paymentMethod === 'QRIS' ? 'badge-running' : 'badge-ready'}">${trx.paymentMethod}</span></td>
    `;
    tbody.appendChild(row);
  });

  if (filteredHistory.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="padding: 20px; text-align: center; color: #64748b;">
          Tidak ada transaksi untuk periode yang dipilih.
        </td>
      </tr>
    `;
  }

  document.getElementById('statTotalOmset').textContent = formatRupiah(totalOmset);
  document.getElementById('statTotalRental').textContent = formatRupiah(totalRental);
  document.getElementById('statTotalFnb').textContent = formatRupiah(totalFnb);
  document.getElementById('statTotalTrx').textContent = filteredHistory.length;
}

function deleteHistoryTransaction(id) {
  if (!confirm('Hapus transaksi ini dari riwayat?')) return;

  const db = getDB();
  db.history = db.history.filter(trx => trx.id !== id);
  saveDB(db);
  renderHistory();
  renderAdminHistory();
}

function renderAdminHistory() {
  const db = getDB();
  const tbody = document.getElementById('adminHistoryTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  db.history.forEach(trx => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${trx.id}</strong></td>
      <td>${trx.date}</td>
      <td>${trx.unitName}<br><small>${trx.durationText}</small></td>
      <td>${formatRupiah(trx.totalCost)}</td>
      <td><span class="badge ${trx.paymentMethod === 'QRIS' ? 'badge-running' : 'badge-ready'}">${trx.paymentMethod}</span></td>
      <td>
        <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteHistoryTransaction('${trx.id}')">Hapus</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function exportDatabaseJSON() {
  const db = getDB();
  const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", jsonStr);
  dlAnchor.setAttribute("download", `database_rental_${Date.now()}.json`);
  dlAnchor.click();
}

// --- TAB 3: ADMIN & PENGATURAN ---
function renderAdminProducts() {
  const db = getDB();
  const tbody = document.getElementById('adminProductTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  db.products.forEach(p => {
    const stockText = productStockValue(p) === null ? 'Tanpa stok' : `${productStockValue(p)} pcs`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="product-cell">
          <img class="product-thumb" src="${getProductImageUrl(p)}" alt="${p.name}">
          <div class="product-meta">
            <strong>${p.name}</strong>
          </div>
        </div>
      </td>
      <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">${p.category}</span></td>
      <td>${formatRupiah(p.price)}</td>
      <td>${stockText}</td>
      <td style="display:flex; gap:8px;">
        <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="openEditProductModal('${p.id}')">Edit</button>
        <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteProduct('${p.id}')">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAdminUnits() {
  const db = getDB();
  const tbody = document.getElementById('adminUnitTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  db.units.forEach(u => {
    const unitType = inferUnitTypeFromName(u.name);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${u.name}</strong></td>
      <td><span class="badge ${unitType === 'TV' ? 'badge-ready' : 'badge-running'}">${unitType}</span></td>
      <td>${formatRupiah(u.ratePerHour)} / jam</td>
      <td style="display:flex; gap:8px;">
        <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="openEditUnitModal('${u.id}')">Edit</button>
        <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteUnit('${u.id}')">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function addNewProduct(e) {
  e.preventDefault();
  const db = getDB();
  const name = document.getElementById('adminProdName').value.trim();
  const category = document.getElementById('adminProdCategory').value;
  const price = parseInt(document.getElementById('adminProdPrice').value) || 0;
  const image = document.getElementById('adminProdImage').value.trim();
  const rawStock = document.getElementById('adminProdStock').value.trim();
  const stock = rawStock === '' ? null : parseInt(rawStock, 10);

  if (!name || price <= 0) {
    alert('Nama produk dan harga harus diisi valid.');
    return;
  }

  if (rawStock !== '' && (Number.isNaN(stock) || stock < 0)) {
    alert('Stok opsional harus bernilai angka valid atau dikosongkan.');
    return;
  }

  const newProd = {
    id: 'p' + Date.now(),
    name,
    category,
    price,
    image: image || '',
    stock: stock === null ? null : stock
  };

  db.products.push(newProd);
  saveDB(db);

  document.getElementById('adminProdName').value = '';
  document.getElementById('adminProdPrice').value = '';
  document.getElementById('adminProdStock').value = '';
  document.getElementById('adminProdImage').value = '';
  document.getElementById('adminProdImageUpload').value = '';
  const prodPreview = document.getElementById('adminProdImagePreview');
  if (prodPreview) prodPreview.src = 'assets/placeholder-product.svg';

  renderAdminProducts();
  alert('Produk berhasil ditambahkan!');
}

function addNewUnit(e) {
  e.preventDefault();
  const db = getDB();
  const name = document.getElementById('adminUnitName').value.trim();
  const type = inferUnitTypeFromName(name);
  const rate = parseInt(document.getElementById('adminUnitRate').value) || 0;

  if (!name || rate <= 0) {
    alert('Nama unit dan tarif per jam harus diisi dengan valid.');
    return;
  }

  const newUnit = {
    id: 'u' + Date.now(),
    name,
    type,
    image: document.getElementById('adminUnitImage').value.trim(),
    ratePerHour: rate,
    status: 'ready',
    startTime: null,
    targetMinutes: 0,
    orderItems: []
  };

  db.units.push(newUnit);
  saveDB(db);

  document.getElementById('adminUnitName').value = '';
  document.getElementById('adminUnitImage').value = '';
  document.getElementById('adminUnitRate').value = '';
  document.getElementById('adminUnitImageUpload').value = '';
  const unitPreview = document.getElementById('adminUnitImagePreview');
  if (unitPreview) unitPreview.src = 'assets/placeholder-unit.svg';

  renderAdminUnits();
  renderUnits();
  alert('Unit PS berhasil ditambahkan!');
}

function deleteProduct(id) {
  if (!confirm('Hapus produk ini?')) return;
  const db = getDB();
  db.products = db.products.filter(p => p.id !== id);
  saveDB(db);
  renderAdminProducts();
}

function openEditProductModal(id) {
  const db = getDB();
  const product = db.products.find(p => p.id === id);
  if (!product) return;

  editingProductId = id;
  document.getElementById('editProdName').value = product.name;
  document.getElementById('editProdCategory').value = product.category || 'Minuman';
  document.getElementById('editProdImage').value = product.image || '';
  document.getElementById('editProdImageUpload').value = '';
  const prodPreview = document.getElementById('editProdImagePreview');
  if (prodPreview) prodPreview.src = product.image || 'assets/placeholder-product.svg';
  document.getElementById('editProdPrice').value = product.price;
  document.getElementById('editProdStock').value = productStockValue(product) === null ? '' : productStockValue(product);
  document.getElementById('modalEditProduct').classList.add('open');
}

function saveProductEdit(e) {
  e.preventDefault();
  const db = getDB();
  const product = db.products.find(p => p.id === editingProductId);
  if (!product) return;

  const name = document.getElementById('editProdName').value.trim();
  const category = document.getElementById('editProdCategory').value;
  const price = parseInt(document.getElementById('editProdPrice').value) || 0;
  const rawStock = document.getElementById('editProdStock').value.trim();
  const stock = rawStock === '' ? null : parseInt(rawStock, 10);

  if (!name || price <= 0) {
    alert('Nama produk dan harga harus valid.');
    return;
  }

  if (rawStock !== '' && (Number.isNaN(stock) || stock < 0)) {
    alert('Stok opsional harus angka valid atau dikosongkan.');
    return;
  }

  product.name = name;
  product.category = category;
  product.price = price;
  product.image = document.getElementById('editProdImage').value.trim();
  product.stock = stock === null ? null : stock;

  saveDB(db);
  closeAllModals();
  renderAdminProducts();
  alert('Item berhasil diperbarui!');
}

function openEditUnitModal(id) {
  const db = getDB();
  const unit = db.units.find(u => u.id === id);
  if (!unit) return;

  editingUnitId = id;
  document.getElementById('editUnitName').value = unit.name;
  document.getElementById('editUnitType').value = unit.type || inferUnitTypeFromName(unit.name);
  document.getElementById('editUnitImage').value = unit.image || '';
  document.getElementById('editUnitImageUpload').value = '';
  const unitPreview = document.getElementById('editUnitImagePreview');
  if (unitPreview) unitPreview.src = unit.image || 'assets/placeholder-unit.svg';
  document.getElementById('editUnitRate').value = unit.ratePerHour;
  document.getElementById('modalEditUnit').classList.add('open');
}

function saveUnitEdit(e) {
  e.preventDefault();
  const db = getDB();
  const unit = db.units.find(u => u.id === editingUnitId);
  if (!unit) return;

  const name = document.getElementById('editUnitName').value.trim();
  const type = inferUnitTypeFromName(name);
  const rate = parseInt(document.getElementById('editUnitRate').value) || 0;

  if (!name || rate <= 0) {
    alert('Nama unit dan tarif per jam harus valid.');
    return;
  }

  unit.name = name;
  unit.type = type;
  unit.image = document.getElementById('editUnitImage').value.trim();
  unit.ratePerHour = rate;

  saveDB(db);
  closeAllModals();
  renderAdminUnits();
  renderUnits();
  alert('Unit PS berhasil diperbarui!');
}

function deleteUnit(id) {
  if (!confirm('Hapus unit PS ini?')) return;
  const db = getDB();
  db.units = db.units.filter(unit => unit.id !== id);
  saveDB(db);
  renderAdminUnits();
  renderUnits();
}

// Timer Realtime Loop
setInterval(() => {
  const currentActiveTab = document.querySelector('.tab-content.active');
  if (currentActiveTab && currentActiveTab.id === 'tab-kasir') {
    checkNearFinishWarnings();
    renderUnits();
  }
}, 1000);

// Init on start
window.addEventListener('DOMContentLoaded', async () => {
  await initDatabase();
  bindProductImageUpload();
  switchTab('kasir');
});
