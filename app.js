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
    const h = Math.floor(remaining / 3600).toString().padStart(2, '0');
    const m = Math.floor((remaining % 3600) / 60).toString().padStart(2, '0');
    const s = (remaining % 60).toString().padStart(2, '0');
    return `Sisa ${h}:${m}:${s}`;
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
    if (isRunning) {
      card.addEventListener('click', event => {
        if (event.target.closest('button')) return;
        openRunningUnitDetails(unit.id);
      });
    }

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
          ${isRunning ? '<div class="unit-details-hint">Tekan kartu untuk rincian biaya</div>' : ''}
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

function openRunningUnitDetails(unitId) {
  const db = getDB();
  const unit = db.units.find(item => item.id === unitId);
  if (!unit || unit.status !== 'running') return;

  activeUnitId = unitId;

  const now = Date.now();
  const elapsedSec = Math.floor((now - unit.startTime) / 1000);
  const rentalCost = calculateCost(unit.ratePerHour, elapsedSec, unit.targetMinutes);
  const items = unit.orderItems || [];
  const itemsCost = items.reduce((total, item) => total + item.price * item.qty, 0);

  document.getElementById('runningDetailsUnitName').textContent = unit.name;
  const playMode = unit.targetMinutes > 0
    ? `${unit.targetMinutes} Menit (Paket)`
    : 'Mode LOSS';
  document.getElementById('runningDetailsDuration').textContent =
    `${formatRentalTimeRange(unit.startTime, now)} (Berjalan) • ${playMode} • ${formatTimer(elapsedSec, unit.targetMinutes)}`;
  document.getElementById('runningDetailsUnitRate').textContent = `${formatRupiah(unit.ratePerHour)} / jam`;
  document.getElementById('runningDetailsRentalCost').textContent = formatRupiah(rentalCost);
  document.getElementById('runningDetailsItemsCost').textContent = formatRupiah(itemsCost);
  document.getElementById('runningDetailsTotal').textContent = formatRupiah(rentalCost + itemsCost);

  const itemsList = document.getElementById('runningDetailsItemsList');
  itemsList.replaceChildren();
  if (items.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'receipt-items-empty';
    emptyMessage.textContent = 'Belum ada menu yang diambil.';
    itemsList.appendChild(emptyMessage);
  } else {
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'receipt-item';

      const details = document.createElement('div');
      details.className = 'receipt-item-details';
      const name = document.createElement('strong');
      name.textContent = item.name;
      const quantity = document.createElement('span');
      quantity.textContent = `${item.qty} x ${formatRupiah(item.price)}`;
      details.append(name, quantity);

      const subtotal = document.createElement('strong');
      subtotal.textContent = formatRupiah(item.price * item.qty);
      row.append(details, subtotal);
      itemsList.appendChild(row);
    });
  }

  document.getElementById('modalRunningDetails').classList.add('open');
}

function formatRentalTimeRange(startTime, endTime) {
  const formatTime = timestamp => new Date(timestamp).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });
  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
}

function addMenuFromRunningDetails() {
  if (!activeUnitId) return;
  closeAllModals();
  openOrderModal(activeUnitId);
}

function continueRunningUnitToPayment() {
  const unitId = activeUnitId;
  closeAllModals();
  openStopModal(unitId);
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
  const customInput = document.getElementById('customDurationInput');
  const customValue = customInput ? customInput.value.trim() : '';
  if (customValue) {
    const customMinutes = Number(customValue);
    if (!Number.isInteger(customMinutes) || customMinutes < 1) {
      alert('Masukkan durasi custom minimal 1 menit.');
      return;
    }
    chosenDurationMinutes = customMinutes;
  }

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
    const unit = db.units.find(item => item.id === activeUnitId);
    const orderedItem = unit && (unit.orderItems || []).find(item => item.id === product.id);
    const orderedQty = orderedItem ? orderedItem.qty : 0;
    return `
      <div class="order-product-item">
        <img class="order-product-thumb" src="${getProductImageUrl(product)}" alt="${product.name}">
        <div class="order-product-info">
          <div class="order-product-heading">
            <div class="order-product-name">${product.name}</div>
            <span class="order-product-taken">Diambil: ${orderedQty}</span>
          </div>
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
  listEl.querySelectorAll('.order-product-qty').forEach(input => {
    input.addEventListener('input', updateSelectedOrderCount);
  });
  updateSelectedOrderCount();
}

function updateSelectedOrderCount() {
  const selectedCount = Array.from(document.querySelectorAll('.order-product-qty'))
    .reduce((total, input) => total + (parseInt(input.value, 10) || 0), 0);
  const button = document.getElementById('addSelectedItemsButton');
  if (!button) return;
  button.disabled = selectedCount === 0;
  button.textContent = selectedCount > 0
    ? `+ Tambahkan ${selectedCount} Item`
    : '+ Pilih Menu Terlebih Dahulu';
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
  updateSelectedOrderCount();
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
  document.getElementById('modalOrderItem').classList.add('open');
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
  renderUnits();
  document.querySelectorAll('.order-product-qty').forEach(input => { input.value = 0; });
  const categoryFilter = document.getElementById('orderCategoryFilter');
  renderOrderProductList(categoryFilter ? categoryFilter.value : 'Semua');
  alert(`${totalSelectedText.slice(0, -2)} berhasil ditambahkan ke ${unit.name}`);
}

// Modal Selesai & Bayar
function openStopModal(unitId) {
  const db = getDB();
  const unit = db.units.find(u => u.id === unitId);
  if (!unit) return;

  activeUnitId = unitId;
  const endTime = Date.now();
  const elapsedSec = Math.floor((endTime - unit.startTime) / 1000);
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
  document.getElementById('receiptDuration').textContent =
    `${formatRentalTimeRange(unit.startTime, endTime)} • ${durDesc}`;
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
  const endTime = Date.now();
  const elapsedSec = Math.floor((endTime - unit.startTime) / 1000);
  const rentalCost = calculateCost(unit.ratePerHour, elapsedSec, unit.targetMinutes);
  const items = unit.orderItems || [];
  const itemsCost = items.reduce((acc, it) => acc + (it.price * it.qty), 0);
  const grandTotal = rentalCost + itemsCost;

  let durDesc = unit.targetMinutes > 0 ? `${unit.targetMinutes} Menit` : `Mode LOSS (${Math.ceil(elapsedSec / 60)} mnt)`;

  // Add transaction to history
  const now = new Date(endTime);
  const dateStr = now.toLocaleDateString('id-ID') + ' ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const trx = {
    id: 'TRX-' + Date.now().toString().slice(-6),
    date: dateStr,
    unitName: unit.name,
    durationText: `${durDesc} • ${formatRentalTimeRange(unit.startTime, endTime)}`,
    startTime: unit.startTime,
    endTime: endTime,
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

  if (filterKey === 'range') {
    const startInput = document.getElementById('historyStartDate');
    const endInput = document.getElementById('historyEndDate');
    const startValue = startInput ? startInput.value : '';
    const endValue = endInput ? endInput.value : '';
    if (!startValue || !endValue) return { start: null, end: null };

    const [startYear, startMonth, startDay] = startValue.split('-').map(Number);
    const [endYear, endMonth, endDay] = endValue.split('-').map(Number);
    return {
      start: new Date(startYear, startMonth - 1, startDay),
      end: new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999)
    };
  }

  return ranges[filterKey] || { start: null, end: null };
}

function getHistoryFilterError(filterKey) {
  if (filterKey !== 'range') return '';

  const startInput = document.getElementById('historyStartDate');
  const endInput = document.getElementById('historyEndDate');
  const startValue = startInput ? startInput.value : '';
  const endValue = endInput ? endInput.value : '';
  if (!startValue || !endValue) return 'Pilih tanggal awal dan tanggal akhir untuk melihat rekap.';
  if (startValue > endValue) return 'Tanggal awal tidak boleh melewati tanggal akhir.';
  return '';
}

function matchesHistoryFilter(trx, filterKey) {
  if (!filterKey || filterKey === 'all') return true;

  const date = parseTransactionDate(trx.date);
  if (Number.isNaN(date.getTime())) return false;

  const range = getHistoryFilterDateRange(filterKey);
  if (!range.start || !range.end) return true;

  return date >= range.start && date <= range.end;
}

function updateHistoryFilterControls() {
  const filterSelect = document.getElementById('historyFilterSelect');
  const dateRange = document.getElementById('historyDateRange');
  if (filterSelect && dateRange) {
    dateRange.style.display = filterSelect.value === 'range' ? 'flex' : 'none';
  }
  renderHistory();
}

function getFilteredHistory() {
  const db = getDB();
  const filterSelect = document.getElementById('historyFilterSelect');
  const filterKey = filterSelect ? filterSelect.value : 'all';
  const filterError = getHistoryFilterError(filterKey);
  return {
    history: filterError ? [] : db.history.filter(trx => matchesHistoryFilter(trx, filterKey)),
    filterKey,
    filterError
  };
}

function renderHistory() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  const { history: filteredHistory, filterError } = getFilteredHistory();
  const filterMessage = document.getElementById('historyFilterMessage');
  if (filterMessage) filterMessage.textContent = filterError;

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

function escapeReportHtml(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return text.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function getReportPeriodLabel(filterKey) {
  if (filterKey !== 'range') {
    const labels = {
      all: 'Semua Waktu',
      today: 'Hari Ini',
      week: 'Minggu Ini',
      month: 'Bulan Ini',
      year: 'Tahun Ini'
    };
    return labels[filterKey] || 'Semua Waktu';
  }

  const startValue = document.getElementById('historyStartDate').value;
  const endValue = document.getElementById('historyEndDate').value;
  return `${startValue} sampai ${endValue}`;
}

function exportHistoryReport(format) {
  const { history, filterKey, filterError } = getFilteredHistory();
  if (filterError) {
    alert(filterError);
    return;
  }

  const totals = history.reduce((sum, trx) => ({
    rental: sum.rental + Number(trx.rentalCost || 0),
    items: sum.items + Number(trx.itemsCost || 0),
    total: sum.total + Number(trx.totalCost || 0)
  }), { rental: 0, items: 0, total: 0 });

  const transactionRows = history.map(trx => {
    const itemDetails = (trx.items || [])
      .map(item => `${item.name} x${item.qty}`)
      .join(', ');
    return `
      <tr>
        <td>${escapeReportHtml(trx.id)}</td>
        <td>${escapeReportHtml(trx.date)}</td>
        <td>${escapeReportHtml(trx.unitName)}</td>
        <td>${escapeReportHtml(trx.durationText)}</td>
        <td>${escapeReportHtml(itemDetails || '-')}</td>
        <td>${Number(trx.rentalCost || 0)}</td>
        <td>${Number(trx.itemsCost || 0)}</td>
        <td>${Number(trx.totalCost || 0)}</td>
        <td>${escapeReportHtml(trx.paymentMethod)}</td>
      </tr>`;
  }).join('');

  const title = `Rekap Riwayat Transaksi - ${getReportPeriodLabel(filterKey)}`;
  const documentHtml = `<!DOCTYPE html>
    <html lang="id">
    <head><meta charset="UTF-8"><title>${escapeReportHtml(title)}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#1f2937}
        h1{font-size:20px}p{margin:6px 0}
        table{border-collapse:collapse;width:100%;margin-top:18px}
        th,td{border:1px solid #9ca3af;padding:7px;text-align:left}
        th{background:#e5e7eb} .summary{margin-top:14px}
      </style>
    </head>
    <body>
      <h1>${escapeReportHtml(title)}</h1>
      <p>Periode: ${escapeReportHtml(getReportPeriodLabel(filterKey))}</p>
      <div class="summary">
        <p>Jumlah Transaksi: ${history.length}</p>
        <p>Pendapatan Rental PS: Rp ${totals.rental.toLocaleString('id-ID')}</p>
        <p>Pendapatan Menu: Rp ${totals.items.toLocaleString('id-ID')}</p>
        <p><strong>Total Omset: Rp ${totals.total.toLocaleString('id-ID')}</strong></p>
      </div>
      <table>
        <thead><tr>
          <th>ID Transaksi</th><th>Waktu</th><th>Unit</th><th>Durasi</th>
          <th>Menu yang Diambil</th><th>Biaya Rental (Rp)</th><th>Biaya Menu (Rp)</th>
          <th>Total Bayar (Rp)</th><th>Metode Pembayaran</th>
        </tr></thead>
        <tbody>${transactionRows || '<tr><td colspan="9">Tidak ada transaksi pada periode ini.</td></tr>'}</tbody>
        <tfoot><tr>
          <th colspan="5">TOTAL</th><th>${totals.rental}</th><th>${totals.items}</th>
          <th>${totals.total}</th><th></th>
        </tr></tfoot>
      </table>
    </body></html>`;

  const isExcel = format === 'excel';
  const extension = isExcel ? 'xls' : 'doc';
  const mimeType = isExcel ? 'application/vnd.ms-excel;charset=utf-8' : 'application/msword;charset=utf-8';
  const now = new Date();
  const fileDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const fileName = `rekap_riwayat_${fileDate}.${extension}`;
  const blob = new Blob(['\ufeff', documentHtml], { type: mimeType });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
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
    const runningDetailsModal = document.getElementById('modalRunningDetails');
    if (runningDetailsModal && runningDetailsModal.classList.contains('open') && activeUnitId) {
      openRunningUnitDetails(activeUnitId);
    }
  }
}, 1000);

// Init on start
window.addEventListener('DOMContentLoaded', async () => {
  await initDatabase();
  bindProductImageUpload();
  switchTab('kasir');
});
