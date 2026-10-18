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
        history: [],
        expenses: [],
        shifts: []
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
    }
  }
}

function getDB() {
  const str = localStorage.getItem(STORAGE_KEY);
  const db = str ? JSON.parse(str) : { units: [], products: [], history: [], expenses: [] };
  if (!Array.isArray(db.expenses)) db.expenses = [];
  if (!Array.isArray(db.shifts)) db.shifts = [];
  return db;
}

function saveDB(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    if (error && error.name === 'QuotaExceededError') {
      alert('Penyimpanan browser penuh. Coba gunakan gambar yang lebih kecil atau hapus gambar yang tidak diperlukan.');
    } else {
      console.error('Gagal menyimpan data aplikasi.', error);
      alert('Data gagal disimpan. Periksa ruang penyimpanan browser lalu coba lagi.');
    }
    return false;
  }

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
  return true;
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

function inferUnitTypeFromName(name) {
  const normalized = (name || '').toLowerCase();
  const playStationMatch = normalized.match(/\bps\s*([345])\b/);
  if (playStationMatch) return `PS ${playStationMatch[1]}`;
  if (normalized.includes('tv')) return 'TV';
  return 'PS';
}

function getUnitType(unit) {
  const inferredType = inferUnitTypeFromName(unit.name);
  if (inferredType.startsWith('PS ')) return inferredType;
  return unit.type || inferredType;
}

function getUnitImageUrl(unit) {
  if (unit && unit.image) return unit.image;
  const unitType = getUnitType(unit);
  if (unitType === 'PS 3') return 'assets/console-ps3.svg';
  if (unitType === 'PS 4') return 'assets/console-ps4.svg';
  if (unitType === 'PS 5') return 'assets/console-ps5.svg';
  return 'assets/placeholder-unit.svg';
}

function getUnitDisplayName(name) {
  const tvNumber = (name || '').match(/\btv\s*0*(\d+)\b/i);
  if (tvNumber) return tvNumber[1].padStart(2, '0');
  const unitNumber = (name || '').match(/#\s*0*(\d+)\b/);
  if (unitNumber) return unitNumber[1].padStart(2, '0');
  if (/^\d+$/.test(name || '')) return name.padStart(2, '0');
  return name || '';
}

function updateAdminUnitNamePreview() {
  const category = document.getElementById('adminUnitCategory');
  const number = document.getElementById('adminUnitNumber');
  const preview = document.getElementById('adminUnitNamePreview');
  if (!category || !number || !preview) return;

  const enteredNumber = Number(number.value.trim() || '1');
  const unitNumber = Number.isInteger(enteredNumber) && enteredNumber >= 0
    ? String(enteredNumber).padStart(2, '0')
    : number.value.trim();
  preview.textContent = `Katalog: ${unitNumber} · ${category.options[category.selectedIndex].text}`;
  const imagePreview = document.getElementById('adminUnitImagePreview');
  const customImage = document.getElementById('adminUnitImage')?.value.trim();
  if (imagePreview && !customImage) imagePreview.src = getUnitImageUrl({ type: category.value, name: unitNumber });
}

// Global active modal unit
let activeUnitId = null;
let chosenDurationMinutes = 0;
let editingRentalDuration = false;
let activeTransactionId = null;
let editingProductId = null;
let editingUnitId = null;
let pendingAdminTab = null;
let expiryAlarmAudioContext = null;

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
    showAdminPanel('catalog');
    renderAdminProducts();
    renderAdminUnits();
    renderAdminDateData();
  }
}

function showAdminPanel(panelName, button) {
  document.querySelectorAll('.admin-panel').forEach(panel => {
    panel.hidden = panel.id !== `adminPanel${panelName.charAt(0).toUpperCase()}${panelName.slice(1)}`;
  });
  document.querySelectorAll('.admin-section-tab').forEach(tab => tab.classList.remove('active'));
  const activeButton = button || document.querySelector(`.admin-section-tab[onclick*="'${panelName}'"]`);
  if (activeButton) activeButton.classList.add('active');
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

    input.addEventListener('change', async function (event) {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        preview.src = fallbackSrc;
        const hidden = document.getElementById(hiddenId);
        if (hidden) hidden.value = '';
        return;
      }

      try {
        const bitmap = await createImageBitmap(file);
        const maxDimension = 1000;
        const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas gambar tidak tersedia.');
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();

        let imageData = canvas.toDataURL('image/webp', 0.8);
        if (!imageData.startsWith('data:image/webp;')) {
          imageData = canvas.toDataURL('image/jpeg', 0.8);
        }

        preview.src = imageData;
        const hidden = document.getElementById(hiddenId);
        if (hidden) hidden.value = imageData;
      } catch (error) {
        console.error('Gagal memproses gambar unggahan.', error);
        input.value = '';
        alert('Gambar tidak dapat diproses. Coba pilih gambar JPG, PNG, atau WebP yang valid.');
      }
    });
  };

  attachImagePreview('adminProdImageUpload', 'adminProdImage', 'adminProdImagePreview');
  attachImagePreview('editProdImageUpload', 'editProdImage', 'editProdImagePreview');
  attachImagePreview('adminUnitImageUpload', 'adminUnitImage', 'adminUnitImagePreview', 'assets/console-ps3.svg');
}

// Helpers
function formatRupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

function formatDurationDetail(totalSeconds) {
  const totalMinutes = Math.max(0, Math.floor(Number(totalSeconds || 0) / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) return `${hours} jam ${minutes} menit`;
  if (hours) return `${hours} jam`;
  return `${minutes} menit`;
}

function getTransactionPaidAmount(trx) {
  if (Array.isArray(trx.payments)) {
    return trx.payments.reduce((total, payment) => total + Math.max(0, Number(payment.amount) || 0), 0);
  }
  return Number.isFinite(Number(trx.paidAmount)) ? Number(trx.paidAmount) : Number(trx.totalCost) || 0;
}

function getTransactionPaymentSummary(trx) {
  if (!Array.isArray(trx.payments) || trx.payments.length === 0) {
    return getTransactionPaidAmount(trx) > 0
      ? `Pembayaran lama (${escapeReportHtml(trx.paymentMethod || 'tercatat lunas')})`
      : 'Belum ada pembayaran';
  }
  return trx.payments.map(payment => {
    const paymentTime = Number(payment.timestamp);
    const timeText = Number.isFinite(paymentTime) && paymentTime > 0
      ? new Date(paymentTime).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : 'waktu tidak tercatat';
    return `${escapeReportHtml(payment.method || 'Pembayaran')} ${formatRupiah(payment.amount)} · ${timeText}`;
  }).join('<br>');
}

function getTransactionRemainingAmount(trx) {
  return Math.max(0, (Number(trx.totalCost) || 0) - getTransactionPaidAmount(trx));
}

function isPaymentInHistoryPeriod(payment, transaction, filterKey, filterError) {
  if (filterError) return false;
  if (!filterKey || filterKey === 'all') return true;
  const range = getHistoryFilterDateRange(filterKey);
  if (!range.start || !range.end) return false;
  const timestamp = Number(payment.timestamp);
  const date = Number.isFinite(timestamp) && timestamp > 0
    ? new Date(timestamp)
    : transaction ? parseTransactionDate(transaction.date) : new Date(NaN);
  return !Number.isNaN(date.getTime()) && date >= range.start && date <= range.end;
}

function getCollectedPaymentsForPeriod(db, filterKey, filterError) {
  let total = 0;
  (db.history || []).forEach(trx => {
    if (Array.isArray(trx.payments)) {
      trx.payments.forEach(payment => {
        if (isPaymentInHistoryPeriod(payment, trx, filterKey, filterError)) {
          total += Math.max(0, Number(payment.amount) || 0);
        }
      });
    } else if (matchesHistoryFilter(trx, filterKey) && !filterError) {
      total += getTransactionPaidAmount(trx);
    }
  });
  (db.units || []).forEach(unit => {
    (unit.payments || []).forEach(payment => {
      if (isPaymentInHistoryPeriod(payment, null, filterKey, filterError)) {
        total += Math.max(0, Number(payment.amount) || 0);
      }
    });
  });
  return total;
}

function getPaymentReportRecords(db, filterKey, filterError) {
  const records = [];
  const addPayment = (payment, transaction, unitName) => {
    if (!isPaymentInHistoryPeriod(payment, transaction, filterKey, filterError)) return;
    const timestamp = Number(payment.timestamp);
    const date = Number.isFinite(timestamp) && timestamp > 0
      ? new Date(timestamp)
      : transaction ? parseTransactionDate(transaction.date) : new Date();
    records.push({
      date,
      transactionId: transaction ? transaction.id : 'Sesi berjalan',
      unitName: transaction ? transaction.unitName : unitName,
      method: payment.method || 'Tunai',
      amount: Math.max(0, Number(payment.amount) || 0),
      type: payment.type || 'legacy'
    });
  };

  (db.history || []).forEach(trx => {
    if (Array.isArray(trx.payments)) {
      trx.payments.forEach(payment => addPayment(payment, trx, trx.unitName));
    } else if (!filterError && matchesHistoryFilter(trx, filterKey) && getTransactionPaidAmount(trx) > 0) {
      addPayment({ amount: getTransactionPaidAmount(trx), method: trx.paymentMethod }, trx, trx.unitName);
    }
  });
  (db.units || []).forEach(unit => {
    (unit.payments || []).forEach(payment => addPayment(payment, null, `TV ${getUnitDisplayName(unit.name)}`));
  });
  return records;
}

function getTransactionItemSummary(trx) {
  return (trx.items || []).map(item =>
    `${item.category || 'Menu'}: ${item.name} × ${item.qty} (${formatRupiah((Number(item.price) || 0) * (Number(item.qty) || 0))})`
  ).join('; ');
}

function getTransactionItemBreakdown(trx) {
  const breakdown = {
    Minuman: { amount: 0, qty: 0 },
    Makanan: { amount: 0, qty: 0 },
    Snack: { amount: 0, qty: 0 }
  };
  (trx.items || []).forEach(item => {
    const category = breakdown[item.category] ? item.category : null;
    if (!category) return;
    const qty = Number(item.qty) || 0;
    breakdown[category].qty += qty;
    breakdown[category].amount += (Number(item.price) || 0) * qty;
  });
  return breakdown;
}

function getUnitPaidMenuAmount(unit) {
  return (unit.orderItems || []).reduce((total, item) => {
    const paidQty = Math.min(Number(item.qty) || 0, Math.max(0, Number(item.paidQty) || 0));
    return total + (Number(item.price) || 0) * paidQty;
  }, 0);
}

function getUnitUnpaidMenuAmount(unit) {
  return (unit.orderItems || []).reduce((total, item) => {
    const paidQty = Math.max(0, Math.min(Number(item.qty) || 0, Number(item.paidQty) || 0));
    const unpaidQty = Math.max(0, (Number(item.qty) || 0) - paidQty);
    return total + (Number(item.price) || 0) * unpaidQty;
  }, 0);
}

function getUnitPaidRentalAmount(unit) {
  if (Number.isFinite(Number(unit.rentalPaidAmount))) return Math.max(0, Number(unit.rentalPaidAmount));
  return (unit.payments || [])
    .filter(payment => payment.type === 'rental')
    .reduce((total, payment) => total + Math.max(0, Number(payment.amount) || 0), 0);
}

function getUnitOutstandingAmount(unit, rentalCost) {
  return Math.max(0, rentalCost - getUnitPaidRentalAmount(unit)) + getUnitUnpaidMenuAmount(unit);
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
  const alarmedUnits = window.__expiredUnitAlarms || {};

  db.units.forEach(unit => {
    if (unit.status !== 'running' || !unit.startTime || unit.targetMinutes <= 0) {
      delete warnedUnits[unit.id];
      delete alarmedUnits[unit.id];
      return;
    }

    const elapsedSec = Math.floor((Date.now() - unit.startTime) / 1000);
    const remainingSec = Math.max(0, (unit.targetMinutes * 60) - elapsedSec);
    const warningThresholdSec = 5 * 60;

    if (remainingSec === 0 && !alarmedUnits[unit.id]) {
      alarmedUnits[unit.id] = true;
      showWarningToast(`Waktu bermain TV ${getUnitDisplayName(unit.name)} sudah habis.`);
      playExpiryAlarm();
    }

    if (remainingSec <= warningThresholdSec && !warnedUnits[unit.id]) {
      warnedUnits[unit.id] = true;
      if (remainingSec > 0) {
        showWarningToast(`Waktu TV ${getUnitDisplayName(unit.name)} tinggal ${Math.max(1, Math.ceil(remainingSec / 60))} menit. Sudah mau selesai?`);
      }
    }

    if (remainingSec > warningThresholdSec) {
      delete warnedUnits[unit.id];
    }
  });

  window.__nearFinishWarnedUnits = warnedUnits;
  window.__expiredUnitAlarms = alarmedUnits;
}

function prepareExpiryAlarmAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return Promise.reject(new Error('Browser tidak mendukung Web Audio.'));

  if (!expiryAlarmAudioContext) expiryAlarmAudioContext = new AudioContextClass();
  if (expiryAlarmAudioContext.state === 'suspended') {
    return expiryAlarmAudioContext.resume();
  }
  if (expiryAlarmAudioContext.state !== 'running') {
    return Promise.reject(new Error(`Status audio tidak tersedia: ${expiryAlarmAudioContext.state}.`));
  }
  return Promise.resolve();
}

function playExpiryAlarmTone() {
  if (!expiryAlarmAudioContext) return;

  const context = expiryAlarmAudioContext;
  const startAt = context.currentTime;
  [0, 0.62, 1.24, 1.86].forEach((offset, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const toneStart = startAt + offset;
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(index % 2 === 0 ? 980 : 1320, toneStart);
    gain.gain.setValueAtTime(0.001, toneStart);
    gain.gain.exponentialRampToValueAtTime(0.95, toneStart + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, toneStart + 0.48);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(toneStart);
    oscillator.stop(toneStart + 0.5);
  });
}

function playExpiryAlarm() {
  if (typeof navigator.vibrate === 'function') navigator.vibrate([180, 100, 180]);

  if (!expiryAlarmAudioContext) {
    showWarningToast('Waktu habis, tetapi suara tidak aktif. Periksa izin audio browser dan volume laptop.');
    return;
  }

  prepareExpiryAlarmAudio()
    .then(playExpiryAlarmTone)
    .catch(error => {
      console.error('Tidak dapat membunyikan alarm waktu habis.', error);
      showWarningToast('Waktu habis. Alarm getar aktif, tetapi suara diblokir browser atau perangkat.');
    });
}

// --- TAB 1: KASIR ---
function renderUnits() {
  const db = getDB();
  const grid = document.getElementById('unitsGrid');
  if (!grid) return;
  renderCashierAttendant(db);
  grid.innerHTML = '';

  const availableCount = db.units.filter(unit => unit.status !== 'running').length;
  const runningCount = db.units.length - availableCount;
  const availableCountElement = document.getElementById('unitCountAvailable');
  const runningCountElement = document.getElementById('unitCountRunning');
  if (availableCountElement) availableCountElement.textContent = availableCount;
  if (runningCountElement) runningCountElement.textContent = runningCount;

  const unitSearch = (document.getElementById('unitSearch')?.value || '').trim().toLocaleLowerCase('id-ID');
  const categoryFilter = document.getElementById('unitCategoryFilter')?.value || 'all';
  const unitNameCollator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' });
  const units = [...db.units].sort((a, b) => {
    const getGroup = unit => {
      if (unit.status !== 'running') return 2;
      return Number(unit.targetMinutes) > 0 ? 0 : 1;
    };
    const groupDifference = getGroup(a) - getGroup(b);
    if (groupDifference !== 0) return groupDifference;

    if (getGroup(a) === 0) {
      const remainingA = Math.max(0, Number(a.targetMinutes) * 60 - Math.floor((Date.now() - Number(a.startTime)) / 1000));
      const remainingB = Math.max(0, Number(b.targetMinutes) * 60 - Math.floor((Date.now() - Number(b.startTime)) / 1000));
      if (remainingA !== remainingB) return remainingA - remainingB;
    }

    return unitNameCollator.compare(a.name, b.name);
  }).filter(unit => {
    const matchesSearch = !unitSearch || getUnitDisplayName(unit.name).toLocaleLowerCase('id-ID').includes(unitSearch);
    const matchesCategory = categoryFilter === 'all' || getUnitType(unit) === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (units.length === 0) {
    grid.innerHTML = '<div class="unit-empty-state"><strong>Unit tidak ditemukan</strong><span>Coba ubah nomor TV atau kategori PlayStation.</span></div>';
    return;
  }

  units.forEach(unit => {
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
    const outstandingAmount = getUnitOutstandingAmount(unit, rentalCost);

    const unitType = getUnitType(unit);

    card.innerHTML = `
      <div>
        <div class="unit-image">
          <img src="${getUnitImageUrl(unit)}" alt="Ilustrasi konsol ${unitType}">
        </div>
        <div class="unit-header">
          <div class="unit-title">${getUnitDisplayName(unit.name)}</div>
          <span class="badge ${isRunning ? 'badge-running' : 'badge-ready'}">
            ${isRunning ? (unit.targetMinutes === 0 ? 'LOSS · Berjalan' : `Paket ${unit.targetMinutes} menit`) : 'Siap digunakan'}
          </span>
        </div>
        <div class="unit-rate">Tarif: ${formatRupiah(unit.ratePerHour)} / jam</div>
        
        <div class="timer-box">
          ${isRunning ? `
            <div class="timer-caption">${unit.targetMinutes > 0 ? 'Sisa waktu' : 'Durasi berjalan'}</div>
            <div class="timer-val">${timerLabel.replace(/^Sisa /, '')}</div>
            <div class="cost-caption">Sisa tagihan</div>
            <div class="cost-val">${formatRupiah(outstandingAmount)}</div>
          ` : `
            <div class="ready-message"><span class="ready-indicator"></span>Unit siap untuk disewakan</div>
          `}
          ${itemsCost > 0 ? `<div class="orders-tag">+ Minuman/Snack: ${formatRupiah(itemsCost)}</div>` : ''}
          ${isRunning ? `<div class="orders-tag">Total berjalan: ${formatRupiah(totalCurrentCost)}</div>` : ''}
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
  const paidMenuAmount = getUnitPaidMenuAmount(unit);
  const unpaidMenuAmount = getUnitUnpaidMenuAmount(unit);
  const paidRentalAmount = getUnitPaidRentalAmount(unit);
  const outstandingAmount = getUnitOutstandingAmount(unit, rentalCost);

  document.getElementById('runningDetailsUnitName').textContent = getUnitDisplayName(unit.name);
  const rentalLabel = document.getElementById('runningDetailsRentalLabel');
  if (rentalLabel) rentalLabel.textContent = Number(unit.targetMinutes) > 0 ? 'Biaya Rental Paket:' : 'Biaya Rental LOSS:';
  const playMode = unit.targetMinutes > 0
    ? `${unit.targetMinutes} Menit (Paket)`
    : 'Mode LOSS';
  document.getElementById('runningDetailsDuration').textContent =
    `${formatRentalTimeRange(unit.startTime, now)} (Berjalan) • ${playMode} • ${formatTimer(elapsedSec, unit.targetMinutes)}`;
  document.getElementById('runningDetailsUnitRate').textContent = `${formatRupiah(unit.ratePerHour)} / jam`;
  document.getElementById('runningDetailsRentalCost').textContent = formatRupiah(rentalCost);
  document.getElementById('runningDetailsItemsCost').textContent = formatRupiah(itemsCost);
  document.getElementById('runningDetailsTotal').textContent = formatRupiah(outstandingAmount);
  const paidLabel = document.getElementById('runningDetailsPaidItems');
  if (paidLabel) paidLabel.textContent = formatRupiah(paidMenuAmount + paidRentalAmount);
  const paidRentalLabel = document.getElementById('runningDetailsPaidRental');
  if (paidRentalLabel) paidRentalLabel.textContent = formatRupiah(paidRentalAmount);
  const unpaidMenuLabel = document.getElementById('runningDetailsUnpaidItems');
  if (unpaidMenuLabel) unpaidMenuLabel.textContent = formatRupiah(unpaidMenuAmount);
  const rentalPaymentButton = document.getElementById('payRunningRentalButton');
  if (rentalPaymentButton) rentalPaymentButton.hidden = !(Number(unit.targetMinutes) > 0 && rentalCost > paidRentalAmount);
  const menuPaymentButton = document.getElementById('payRunningMenuButton');
  if (menuPaymentButton) menuPaymentButton.hidden = unpaidMenuAmount <= 0;

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
      const paidQty = Math.max(0, Math.min(Number(item.qty) || 0, Number(item.paidQty) || 0));
      const unpaidQty = Math.max(0, (Number(item.qty) || 0) - paidQty);
      quantity.textContent = `${item.category || 'Menu'} · ${paidQty} lunas${unpaidQty ? `, ${unpaidQty} belum dibayar` : ''}`;
      details.append(name, quantity);

      const subtotal = document.createElement('strong');
      subtotal.textContent = `Sisa ${formatRupiah(item.price * unpaidQty)}`;
      row.append(details, subtotal);
      itemsList.appendChild(row);
    });
  }

  const paidMenuSummary = document.createElement('p');
  paidMenuSummary.className = 'receipt-items-payment-summary';
  paidMenuSummary.textContent = `Menu lunas: ${formatRupiah(paidMenuAmount)} · Menu belum dibayar: ${formatRupiah(unpaidMenuAmount)}`;
  itemsList.appendChild(paidMenuSummary);

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

function editRunningUnitDuration() {
  const unitId = activeUnitId;
  closeAllModals();
  openStartModal(unitId);
}

function openRunningRentalPaymentModal() {
  const db = getDB();
  const unit = db.units.find(item => item.id === activeUnitId);
  if (!unit || unit.status !== 'running' || Number(unit.targetMinutes) <= 0) return;
  const rentalCost = calculateCost(unit.ratePerHour, 0, unit.targetMinutes);
  const outstandingRental = Math.max(0, rentalCost - getUnitPaidRentalAmount(unit));
  if (outstandingRental <= 0) return;

  document.getElementById('runningRentalPaymentSummary').textContent =
    `TV ${getUnitDisplayName(unit.name)} · Sisa rental paket ${formatRupiah(outstandingRental)}`;
  const amountInput = document.getElementById('runningRentalPaymentAmount');
  amountInput.max = outstandingRental;
  amountInput.value = outstandingRental;
  document.getElementById('modalRunningRentalPayment').classList.add('open');
}

function openRunningMenuPaymentModal() {
  const db = getDB();
  const unit = db.units.find(item => item.id === activeUnitId);
  if (!unit || unit.status !== 'running') return;

  document.getElementById('runningMenuPaymentSummary').textContent =
    `TV ${getUnitDisplayName(unit.name)} · Pilih jumlah menu yang ingin dibayar sekarang.`;
  const itemsContainer = document.getElementById('runningMenuPaymentItems');
  itemsContainer.replaceChildren();
  (unit.orderItems || []).forEach((item, index) => {
    const qty = Math.max(0, Number(item.qty) || 0);
    const paidQty = Math.max(0, Math.min(qty, Number(item.paidQty) || 0));
    const unpaidQty = qty - paidQty;
    if (unpaidQty === 0) return;

    const row = document.createElement('div');
    row.className = 'running-menu-payment-row';
    const details = document.createElement('div');
    details.className = 'receipt-item-details';
    const name = document.createElement('strong');
    name.textContent = item.name;
    const outstanding = document.createElement('span');
    outstanding.textContent = `${unpaidQty} belum dibayar · ${formatRupiah((Number(item.price) || 0) * unpaidQty)}`;
    details.append(name, outstanding);

    const quantityInput = document.createElement('input');
    quantityInput.type = 'number';
    quantityInput.className = 'form-control running-menu-payment-qty';
    quantityInput.dataset.itemIndex = String(index);
    quantityInput.min = '0';
    quantityInput.max = String(unpaidQty);
    quantityInput.step = '1';
    quantityInput.value = '0';
    quantityInput.setAttribute('aria-label', `Jumlah ${item.name} yang dibayar`);
    quantityInput.addEventListener('input', updateRunningMenuPaymentTotal);

    row.append(details, quantityInput);
    itemsContainer.appendChild(row);
  });

  if (!itemsContainer.children.length) {
    alert('Tidak ada menu yang belum dibayar.');
    return;
  }
  document.getElementById('runningMenuPaymentTotal').textContent = formatRupiah(0);
  document.getElementById('modalRunningMenuPayment').classList.add('open');
}

function updateRunningMenuPaymentTotal() {
  const db = getDB();
  const unit = db.units.find(item => item.id === activeUnitId);
  if (!unit) return;

  const total = Array.from(document.querySelectorAll('.running-menu-payment-qty')).reduce((sum, input) => {
    const index = Number(input.dataset.itemIndex);
    const item = unit.orderItems[index];
    const qty = Math.max(0, Math.min(Number(input.max) || 0, Number(input.value) || 0));
    return sum + qty * (Number(item.price) || 0);
  }, 0);
  document.getElementById('runningMenuPaymentTotal').textContent = formatRupiah(total);
}

function recordRunningMenuPayment() {
  const db = getDB();
  const unit = db.units.find(item => item.id === activeUnitId);
  if (!unit || unit.status !== 'running') return;

  const selectedItems = Array.from(document.querySelectorAll('.running-menu-payment-qty'))
    .map(input => {
      const index = Number(input.dataset.itemIndex);
      const item = unit.orderItems[index];
      const qty = Number(input.value);
      const unpaidQty = Math.max(0, (Number(item.qty) || 0) - Math.max(0, Number(item.paidQty) || 0));
      return { item, qty, unpaidQty };
    });
  if (selectedItems.some(({ qty, unpaidQty }) => !Number.isSafeInteger(qty) || qty < 0 || qty > unpaidQty)) {
    alert('Jumlah menu yang dibayar tidak valid. Periksa kembali jumlah yang dipilih.');
    return;
  }

  const paymentAmount = selectedItems.reduce((total, { item, qty }) => total + qty * (Number(item.price) || 0), 0);
  if (!Number.isSafeInteger(paymentAmount) || paymentAmount <= 0) {
    alert('Pilih jumlah menu yang akan dibayar terlebih dahulu.');
    return;
  }

  selectedItems.forEach(({ item, qty }) => {
    item.paidQty = (Number(item.paidQty) || 0) + qty;
  });
  if (!Array.isArray(unit.payments)) unit.payments = [];
  unit.payments.push({
    amount: paymentAmount,
    method: document.getElementById('runningMenuPaymentMethod').value,
    type: 'menu',
    timestamp: Date.now()
  });
  if (!saveDB(db)) return;

  closeAllModals();
  renderUnits();
  openRunningUnitDetails(unit.id);
}

function recordRunningRentalPayment() {
  const db = getDB();
  const unit = db.units.find(item => item.id === activeUnitId);
  if (!unit || unit.status !== 'running' || Number(unit.targetMinutes) <= 0) {
    alert('Pembayaran rental di muka hanya tersedia untuk sesi paket berdurasi.');
    return;
  }

  const rentalCost = calculateCost(unit.ratePerHour, 0, unit.targetMinutes);
  const alreadyPaid = getUnitPaidRentalAmount(unit);
  const outstandingRental = Math.max(0, rentalCost - alreadyPaid);
  const amount = Number(document.getElementById('runningRentalPaymentAmount').value);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > outstandingRental) {
    alert(`Pembayaran rental harus berupa angka bulat antara Rp 1 dan ${formatRupiah(outstandingRental)}.`);
    return;
  }

  if (!Array.isArray(unit.payments)) unit.payments = [];
  unit.payments.push({
    amount,
    method: document.getElementById('runningRentalPaymentMethod').value,
    type: 'rental',
    timestamp: Date.now()
  });
  unit.rentalPaidAmount = alreadyPaid + amount;
  if (!saveDB(db)) return;

  closeAllModals();
  renderUnits();
  openRunningUnitDetails(unit.id);
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
  editingRentalDuration = unit.status === 'running';
  if (editingRentalDuration) {
    if (!requireAttendantForTransaction(unit, db)) return;
  } else if (!requireActiveAttendantShift()) {
    return;
  }

  activeUnitId = unitId;
  chosenDurationMinutes = editingRentalDuration ? Number(unit.targetMinutes) || 0 : 0;

  const customInput = document.getElementById('customDurationInput');
  if (customInput) customInput.value = editingRentalDuration && unit.targetMinutes > 0 ? unit.targetMinutes : '';

  document.getElementById('startUnitTitle').textContent = `${editingRentalDuration ? 'Edit Durasi' : 'Mulai Rental'} - TV ${getUnitDisplayName(unit.name)}`;
  document.getElementById('startUnitRate').textContent = `Tarif: ${formatRupiah(unit.ratePerHour)} / jam`;
  const startButton = document.getElementById('confirmStartRentalButton');
  if (startButton) startButton.textContent = editingRentalDuration ? 'Simpan Durasi Baru' : 'Mulai Main Sekarang';
  const initialOrders = document.getElementById('initialRentalOrders');
  if (initialOrders) initialOrders.hidden = editingRentalDuration;
  const rentalPrepayment = document.getElementById('startRentalPrepayment');
  if (rentalPrepayment) rentalPrepayment.hidden = editingRentalDuration;
  const startRentalPaidNow = document.getElementById('startRentalPaidNow');
  if (startRentalPaidNow) startRentalPaidNow.checked = false;
  const durationNote = document.getElementById('durationEditNote');
  if (durationNote) {
    const elapsedMinutes = Math.ceil((Date.now() - Number(unit.startTime || Date.now())) / 60000);
    durationNote.hidden = !editingRentalDuration;
    durationNote.textContent = unit.targetMinutes > 0
      ? `Durasi berjalan ${formatDurationDetail((Date.now() - unit.startTime) / 1000)}. Durasi paket hanya dapat diperpanjang (minimal ${unit.targetMinutes} menit).`
      : `Mode LOSS sudah berjalan ${elapsedMinutes} menit. Durasi yang dipilih akan ditambahkan setelah waktu yang sudah berjalan.`;
  }

  // Reset duration button active
  document.querySelectorAll('.duration-buttons .d-btn').forEach(button => {
    button.classList.remove('selected');
    button.disabled = editingRentalDuration && Number(unit.targetMinutes) > 0 && Number(button.dataset.mins) === 0;
  });
  const def = document.querySelector(`.duration-buttons .d-btn[data-mins="${chosenDurationMinutes}"]`)
    || document.querySelector('.duration-buttons .d-btn[data-mins="0"]');
  if (def) def.classList.add('selected');
  updateStartRentalPrepaymentOption();
  if (!editingRentalDuration) {
    renderInitialRentalProducts();
  }

  document.getElementById('modalStartRental').classList.add('open');
}

function selectDuration(mins, btnElement) {
  chosenDurationMinutes = mins;
  const customInput = document.getElementById('customDurationInput');
  if (customInput) customInput.value = '';
  if (mins <= 0) {
    const paidNow = document.getElementById('startRentalPaidNow');
    if (paidNow) paidNow.checked = false;
  }
  document.querySelectorAll('.duration-buttons .d-btn').forEach(b => b.classList.remove('selected'));
  if (btnElement) btnElement.classList.add('selected');
  updateStartRentalPrepaymentOption();
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
  updateStartRentalPrepaymentOption();
}

function updateStartRentalPrepaymentOption() {
  const section = document.getElementById('startRentalPrepayment');
  if (!section) return;
  const amountLabel = document.getElementById('startRentalPrepaymentAmount');
  const methodGroup = document.getElementById('startRentalPaymentMethodGroup');
  const paidNow = document.getElementById('startRentalPaidNow');
  const available = !editingRentalDuration && chosenDurationMinutes > 0;
  section.hidden = !available;
  if (methodGroup) methodGroup.hidden = !available || !paidNow || !paidNow.checked;
  if (amountLabel && available) {
    const db = getDB();
    const unit = db.units.find(item => item.id === activeUnitId);
    amountLabel.textContent = unit
      ? `Biaya paket ${formatDurationDetail(chosenDurationMinutes * 60)}: ${formatRupiah(calculateCost(unit.ratePerHour, 0, chosenDurationMinutes))}`
      : '';
  }
}

function confirmStartRental() {
  const activeShift = getActiveAttendantShift(getDB());
  const currentDb = getDB();
  const currentUnit = currentDb.units.find(u => u.id === activeUnitId);
  if (!currentUnit || (editingRentalDuration
    ? !requireAttendantForTransaction(currentUnit, currentDb)
    : !activeShift)) {
    if (!editingRentalDuration) requireActiveAttendantShift();
    return;
  }
  if (!editingRentalDuration) {
    prepareExpiryAlarmAudio().catch(error => {
      console.error('Tidak dapat mengaktifkan audio alarm.', error);
      showWarningToast('Suara alarm belum aktif. Periksa izin audio browser dan volume laptop.');
    });
  }

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
  if (!unit) return;

  if (editingRentalDuration) {
    const elapsedMinutes = Math.ceil((Date.now() - Number(unit.startTime)) / 60000);
    if (Number(unit.targetMinutes) > 0) {
      unit.targetMinutes = chosenDurationMinutes > 0
        ? Math.max(Number(unit.targetMinutes), chosenDurationMinutes, elapsedMinutes)
        : Number(unit.targetMinutes);
    } else {
      unit.targetMinutes = chosenDurationMinutes > 0 ? elapsedMinutes + chosenDurationMinutes : 0;
    }
    if (window.__nearFinishWarnedUnits) delete window.__nearFinishWarnedUnits[unit.id];
    if (window.__expiredUnitAlarms) delete window.__expiredUnitAlarms[unit.id];
  } else {
    const initialItems = Array.from(document.querySelectorAll('.start-order-product-qty'))
      .map(input => ({ id: input.dataset.productId, qty: Number(input.value) || 0 }))
      .filter(item => item.qty > 0);
    if (!validateOrderStock(db, initialItems)) return;

    unit.status = 'running';
    unit.startTime = Date.now();
    unit.targetMinutes = chosenDurationMinutes;
    unit.orderItems = [];
    unit.payments = [];
    delete unit.rentalPaidAmount;
    unit.shiftId = activeShift.id;
    unit.attendantName = activeShift.staffName;
    appendOrderItems(db, unit, initialItems);
    if (chosenDurationMinutes > 0 && document.getElementById('startRentalPaidNow').checked) {
      const rentalAmount = calculateCost(unit.ratePerHour, 0, chosenDurationMinutes);
      unit.rentalPaidAmount = rentalAmount;
      unit.payments.push({
        amount: rentalAmount,
        method: document.getElementById('startRentalPaymentMethod').value,
        type: 'rental',
        timestamp: Date.now()
      });
    }
  }
  if (!saveDB(db)) return;
  editingRentalDuration = false;
  closeAllModals();
  renderUnits();
}

// Modal Tambah Item Minuman / Makanan ke PS yang sedang main
function renderInitialRentalProducts() {
  const list = document.getElementById('initialRentalProductList');
  if (!list) return;
  const db = getDB();
  list.innerHTML = db.products.map(product => {
    const stockValue = productStockValue(product);
    const max = stockValue === null ? 999 : Math.max(0, stockValue);
    return `<div class="initial-order-row">
      <span><strong>${escapeReportHtml(product.name)}</strong><small>${escapeReportHtml(product.category)} · ${formatRupiah(product.price)}${stockValue === null ? '' : ` · Stok ${stockValue}`}</small></span>
      <input class="form-control start-order-product-qty" type="number" data-product-id="${escapeReportHtml(product.id)}" value="0" min="0" max="${max}" aria-label="Jumlah ${escapeReportHtml(product.name)}">
    </div>`;
  }).join('') || '<p>Belum ada menu yang tersedia.</p>';
}

function validateOrderStock(db, selectedItems) {
  for (const item of selectedItems) {
    const product = db.products.find(candidate => candidate.id === item.id);
    if (!product) {
      alert('Ada menu yang sudah tidak tersedia. Muat ulang daftar menu lalu coba lagi.');
      return false;
    }
    const stockValue = productStockValue(product);
    if (!Number.isInteger(item.qty) || item.qty < 1 || (stockValue !== null && stockValue < item.qty)) {
      alert(`Stok ${product.name} tidak mencukupi${stockValue === null ? '.' : `! Sisa stok hanya ${stockValue}.`}`);
      return false;
    }
  }
  return true;
}

function appendOrderItems(db, unit, selectedItems) {
  selectedItems.forEach(item => {
    const product = db.products.find(candidate => candidate.id === item.id);
    if (!product) return;
    const stockValue = productStockValue(product);
    if (stockValue !== null) product.stock = stockValue - item.qty;

    const existingItem = (unit.orderItems || []).find(ordered => ordered.id === product.id);
    if (existingItem) {
      existingItem.qty += item.qty;
      existingItem.paidQty = Number(existingItem.paidQty) || 0;
      if (!existingItem.category) existingItem.category = product.category;
    } else {
      unit.orderItems.push({
        id: product.id,
        name: product.name,
        category: product.category,
        price: Number(product.price) || 0,
        qty: item.qty,
        paidQty: 0
      });
    }
  });
}

function renderOrderProductList(filter = 'Semua') {
  const db = getDB();
  const listEl = document.getElementById('orderProductList');
  if (!listEl) return;
  const searchInput = document.getElementById('orderProductSearch');
  const search = searchInput ? searchInput.value.trim().toLocaleLowerCase('id-ID') : '';

  const products = filter === 'Semua'
    ? db.products
    : db.products.filter(product => product.category === filter);
  const visibleProducts = products.filter(product => !search
    || `${product.name} ${product.category}`.toLocaleLowerCase('id-ID').includes(search));

  if (visibleProducts.length === 0) {
    listEl.innerHTML = `<p class="order-product-empty">${products.length ? 'Menu tidak ditemukan. Coba kata kunci lain.' : 'Tidak ada item di kategori ini.'}</p>`;
    updateSelectedOrderCount();
    return;
  }

  listEl.innerHTML = visibleProducts.map(product => {
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
  if (!requireAttendantForTransaction(unit)) return;

  activeUnitId = unitId;
  document.getElementById('orderUnitTitle').textContent = `Tambah Item: TV ${getUnitDisplayName(unit.name)}`;
  const searchInput = document.getElementById('orderProductSearch');
  if (searchInput) {
    searchInput.value = '';
    searchInput.oninput = () => {
      const categoryFilter = document.getElementById('orderCategoryFilter');
      renderOrderProductList(categoryFilter ? categoryFilter.value : 'Semua');
    };
    searchInput.onkeydown = event => {
      if (event.key === 'Enter') event.preventDefault();
    };
  }
  const feedback = document.getElementById('orderProductFeedback');
  if (feedback) feedback.textContent = '';

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
  if (!requireAttendantForTransaction(unit)) return;

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

  if (!validateOrderStock(db, selectedItems)) return;
  if (!unit.orderItems) unit.orderItems = [];
  appendOrderItems(db, unit, selectedItems);

  if (!saveDB(db)) return;
  renderUnits();
  document.querySelectorAll('.order-product-qty').forEach(input => { input.value = 0; });
  const categoryFilter = document.getElementById('orderCategoryFilter');
  renderOrderProductList(categoryFilter ? categoryFilter.value : 'Semua');
  const feedback = document.getElementById('orderProductFeedback');
  if (feedback) {
    const totalCount = selectedItems.reduce((total, item) => total + item.qty, 0);
    feedback.textContent = `${totalCount} item berhasil ditambahkan ke TV ${getUnitDisplayName(unit.name)} sebagai tagihan.`;
  }
}

// Modal Selesai & Bayar
function openStopModal(unitId) {
  const db = getDB();
  const unit = db.units.find(u => u.id === unitId);
  if (!unit) return;
  if (!requireAttendantForTransaction(unit)) return;

  activeUnitId = unitId;
  const endTime = Date.now();
  const elapsedSec = Math.floor((endTime - unit.startTime) / 1000);
  const rentalCost = calculateCost(unit.ratePerHour, elapsedSec, unit.targetMinutes);
  const items = unit.orderItems || [];
  const itemsCost = items.reduce((acc, it) => acc + (it.price * it.qty), 0);
  const grandTotal = rentalCost + itemsCost;
  const paidAmount = (unit.payments || []).reduce((total, payment) => total + (Number(payment.amount) || 0), 0);

  let durDesc = '';
  if (unit.targetMinutes > 0) {
    durDesc = `${formatDurationDetail(unit.targetMinutes * 60)} (Paket) · ${formatDurationDetail(elapsedSec)} dimainkan`;
  } else {
    durDesc = `Mode LOSS (${formatDurationDetail(elapsedSec)})`;
  }

  document.getElementById('receiptUnitName').textContent = `TV ${getUnitDisplayName(unit.name)}`;
  document.getElementById('receiptDuration').textContent =
    `${formatRentalTimeRange(unit.startTime, endTime)} • ${durDesc}`;
  document.getElementById('receiptRentalCost').textContent = formatRupiah(rentalCost);
  document.getElementById('receiptItemsCost').textContent = formatRupiah(itemsCost);
  document.getElementById('receiptTotal').textContent = formatRupiah(grandTotal);
  document.getElementById('receiptAlreadyPaid').textContent = formatRupiah(paidAmount);
  document.getElementById('receiptOutstanding').textContent = formatRupiah(Math.max(0, grandTotal - paidAmount));
  document.getElementById('modalStopRental').classList.add('open');
}

function processPayment() {
  const db = getDB();
  const unit = db.units.find(u => u.id === activeUnitId);
  if (!unit) return;
  if (!requireAttendantForTransaction(unit, db)) return;

  const checkoutMethod = document.getElementById('paymentMethodSelect').value;
  const endTime = Date.now();
  const elapsedSec = Math.floor((endTime - unit.startTime) / 1000);
  const rentalCost = calculateCost(unit.ratePerHour, elapsedSec, unit.targetMinutes);
  const items = unit.orderItems || [];
  const itemsCost = items.reduce((acc, it) => acc + (it.price * it.qty), 0);
  const grandTotal = rentalCost + itemsCost;
  if (!Array.isArray(unit.payments)) unit.payments = [];
  const paidBeforeCheckout = unit.payments.reduce((total, payment) => total + (Number(payment.amount) || 0), 0);
  const outstandingBeforeCheckout = Math.max(0, grandTotal - paidBeforeCheckout);
  const checkoutAmount = outstandingBeforeCheckout;
  if (checkoutAmount > 0) {
    unit.payments.push({
      amount: checkoutAmount,
      method: checkoutMethod,
      type: 'checkout',
      timestamp: Date.now()
    });
  }
  const paidAmount = unit.payments.reduce((total, payment) => total + (Number(payment.amount) || 0), 0);
  const remainingAmount = Math.max(0, grandTotal - paidAmount);
  const paymentMethods = [...new Set(unit.payments.map(payment => payment.method).filter(Boolean))];
  const paymentMethod = paymentMethods.join(' + ') || 'Belum dibayar';

  let durDesc = unit.targetMinutes > 0
    ? `${formatDurationDetail(unit.targetMinutes * 60)} (Paket) · ${formatDurationDetail(elapsedSec)} dimainkan`
    : `Mode LOSS (${formatDurationDetail(elapsedSec)})`;

  // Add transaction to history
  const now = new Date(endTime);
  const dateStr = now.toLocaleDateString('id-ID') + ' ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const assignedShift = db.shifts.find(shift => shift.id === unit.shiftId);
  const activeShift = assignedShift || getActiveAttendantShift(db);
  const trx = {
    id: 'TRX-' + Date.now().toString().slice(-6),
    date: dateStr,
    shiftId: activeShift ? activeShift.id : null,
    attendantName: activeShift ? activeShift.staffName : '',
    unitName: `TV ${getUnitDisplayName(unit.name)}`,
    durationText: `${durDesc} • ${formatRentalTimeRange(unit.startTime, endTime)}`,
    startTime: unit.startTime,
    endTime: endTime,
    rentalCost: rentalCost,
    itemsCost: itemsCost,
    items: items.map(item => ({ ...item, category: item.category || 'Lainnya' })),
    totalCost: grandTotal,
    paidAmount,
    remainingAmount,
    payments: unit.payments,
    paymentMethod: paymentMethod
  };

  db.history.unshift(trx);

  // Reset unit
  unit.status = 'ready';
  unit.startTime = null;
  unit.targetMinutes = 0;
  unit.orderItems = [];
  unit.payments = [];
  delete unit.rentalPaidAmount;
  delete unit.shiftId;
  delete unit.attendantName;

  if (!saveDB(db)) return;
  closeAllModals();
  renderUnits();
  renderHistory();
  alert(`Transaksi selesai. Total tagihan: ${formatRupiah(grandTotal)}, sudah dibayar: ${formatRupiah(paidAmount)}, sisa: ${formatRupiah(remainingAmount)}.`);
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
}

function openReceivePaymentModal(transactionId) {
  const trx = getDB().history.find(item => item.id === transactionId);
  if (!trx) return;
  const remainingAmount = getTransactionRemainingAmount(trx);
  if (remainingAmount <= 0) {
    alert('Tagihan transaksi ini sudah lunas.');
    return;
  }
  activeTransactionId = transactionId;
  document.getElementById('receivePaymentSummary').textContent =
    `${trx.id} · ${trx.unitName} · Sisa ${formatRupiah(remainingAmount)}`;
  const amountInput = document.getElementById('receivePaymentAmount');
  amountInput.max = remainingAmount;
  amountInput.value = remainingAmount;
  document.getElementById('modalReceivePayment').classList.add('open');
}

function recordOutstandingPayment() {
  const db = getDB();
  const trx = db.history.find(item => item.id === activeTransactionId);
  if (!trx) {
    alert('Transaksi tidak ditemukan. Muat ulang riwayat dan coba kembali.');
    return;
  }
  const amount = Number(document.getElementById('receivePaymentAmount').value);
  const remainingAmount = getTransactionRemainingAmount(trx);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > remainingAmount) {
    alert(`Pembayaran harus berupa angka bulat antara Rp 1 dan ${formatRupiah(remainingAmount)}.`);
    return;
  }

  if (!Array.isArray(trx.payments)) {
    trx.payments = getTransactionPaidAmount(trx) > 0
      ? [{ amount: getTransactionPaidAmount(trx), method: trx.paymentMethod || 'Tunai', type: 'legacy', timestamp: null }]
      : [];
  }
  const method = document.getElementById('receivePaymentMethod').value;
  trx.payments.push({ amount, method, type: 'receivable', timestamp: Date.now() });
  trx.paidAmount = getTransactionPaidAmount(trx);
  trx.remainingAmount = Math.max(0, Number(trx.totalCost) - trx.paidAmount);
  const methods = [...new Set(trx.payments.map(payment => payment.method).filter(Boolean))];
  trx.paymentMethod = methods.join(' + ') || method;
  if (!saveDB(db)) return;
  activeTransactionId = null;
  closeAllModals();
  renderHistory();
  renderAdminHistory();
  renderAdminAttendantShifts();
}

function getActiveAttendantShift(db) {
  return db.shifts.find(shift => shift.endTime === null || shift.endTime === undefined) || null;
}

function renderCashierAttendant(db = getDB()) {
  const activeShift = getActiveAttendantShift(db);
  const status = document.getElementById('cashierAttendantStatus');
  const nameInput = document.getElementById('cashierAttendantNameInput');
  const finishButton = document.getElementById('finishAttendantShiftButton');
  const historyInput = document.getElementById('attendantNameInput');
  const cashierSubmit = nameInput && nameInput.form
    ? nameInput.form.querySelector('button[type="submit"]')
    : null;

  if (status) {
    status.textContent = activeShift
      ? `${activeShift.staffName} sedang bertugas sejak ${formatAttendantShiftTime(activeShift.startTime)}.`
      : 'Masukkan nama karyawan sebelum memulai transaksi.';
  }
  if (finishButton) finishButton.hidden = !activeShift;
  if (cashierSubmit) cashierSubmit.textContent = activeShift ? 'Ganti Petugas' : 'Mulai Shift';
  if (historyInput && activeShift && document.activeElement !== historyInput) {
    historyInput.value = activeShift.staffName;
  } else if (historyInput && !activeShift && document.activeElement !== historyInput) {
    historyInput.value = '';
  }
}

function requireActiveAttendantShift() {
  if (getActiveAttendantShift(getDB())) return true;
  const message = 'Transaksi belum bisa dimulai. Isi nama karyawan yang jaga terlebih dahulu.';
  const status = document.getElementById('cashierAttendantStatus');
  if (status) status.textContent = message;
  showWarningToast(message);
  const input = document.getElementById('cashierAttendantNameInput');
  if (input) input.focus();
  return false;
}

function requireAttendantForTransaction(unit, db = getDB()) {
  if (getActiveAttendantShift(db)) return true;
  const assignedShift = unit && db.shifts.find(shift => shift.id === unit.shiftId);
  if (assignedShift) return true;
  return requireActiveAttendantShift();
}

function endAttendantShift() {
  const db = getDB();
  const activeShift = getActiveAttendantShift(db);
  if (!activeShift) return;

  activeShift.endTime = Date.now();
  saveDB(db);
  renderHistory();
  renderAdminDateData();
  renderUnits();
}

function setAttendantShift(event, inputId = 'attendantNameInput') {
  event.preventDefault();
  const input = document.getElementById(inputId);
  const staffName = input ? input.value.trim() : '';
  if (!staffName) {
    alert('Nama petugas harus diisi.');
    return;
  }

  const db = getDB();
  const activeShift = getActiveAttendantShift(db);
  if (activeShift && activeShift.staffName.trim().toLocaleLowerCase('id-ID') === staffName.toLocaleLowerCase('id-ID')) {
    alert('Petugas tersebut sudah tercatat sedang jaga.');
    return;
  }

  const now = Date.now();
  if (activeShift) activeShift.endTime = now;
  db.shifts.push({
    id: `SHIFT-${now}-${Math.random().toString(36).slice(2, 8)}`,
    staffName,
    startTime: now,
    endTime: null
  });
  saveDB(db);

  if (input) input.value = '';
  renderHistory();
  renderAdminDateData();
  renderUnits();
}

function formatAttendantShiftTime(timestamp) {
  if (timestamp === null || timestamp === undefined || timestamp === '' || !Number.isFinite(Number(timestamp))) return '-';
  return new Date(Number(timestamp)).toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// --- TAB 2: RIWAYAT & KEUANGAN ---
function parseTransactionDate(dateStr) {
  if (!dateStr) return new Date(NaN);

  const match = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s*(\d{1,2})[:.](\d{2})?)?/);
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

function parseExpenseDate(dateValue) {
  if (!dateValue) return new Date(NaN);
  const match = String(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date(NaN);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
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
    dateRange.style.display = filterSelect.value === 'range' ? 'grid' : 'none';
  }
  renderHistory();
}

function openDatePicker(inputId) {
  const dateInput = document.getElementById(inputId);
  if (!dateInput) return;

  dateInput.focus();
  if (typeof dateInput.showPicker === 'function') {
    dateInput.showPicker();
  } else {
    dateInput.click();
  }
}

function getFilteredHistory(db = getDB()) {
  const filterSelect = document.getElementById('historyFilterSelect');
  const filterKey = filterSelect ? filterSelect.value : 'all';
  const filterError = getHistoryFilterError(filterKey);
  return {
    history: filterError ? [] : db.history.filter(trx => matchesHistoryFilter(trx, filterKey)),
    expenses: filterError ? [] : db.expenses.filter(expense => {
      if (filterKey === 'all') return true;
      const date = parseExpenseDate(expense.date);
      if (Number.isNaN(date.getTime())) return false;
      const range = getHistoryFilterDateRange(filterKey);
      return !range.start || !range.end || (date >= range.start && date <= range.end);
    }),
    filterKey,
    filterError
  };
}

function renderAttendantShifts(shifts, history, filterKey, filterError) {
  const db = getDB();
  const activeShift = getActiveAttendantShift(db);
  const currentStatus = document.getElementById('currentAttendantStatus');
  const nameInput = document.getElementById('attendantNameInput');
  const tbody = document.getElementById('attendantShiftTableBody');
  if (!tbody) return;

  if (currentStatus) {
    currentStatus.textContent = activeShift
      ? `${activeShift.staffName} — mulai jaga ${formatAttendantShiftTime(activeShift.startTime)}`
      : 'Belum ada petugas yang tercatat sedang jaga.';
  }
  if (nameInput && activeShift && document.activeElement !== nameInput) {
    nameInput.value = activeShift.staffName;
  }

  const createShiftTotals = () => ({
    count: 0,
    total: 0,
    rental: 0,
    items: { Minuman: { amount: 0, qty: 0 }, Makanan: { amount: 0, qty: 0 }, Snack: { amount: 0, qty: 0 } }
  });
  const totalsByShift = new Map();
  const unassigned = createShiftTotals();
  const knownShiftIds = new Set(shifts.map(shift => shift.id));
  history.forEach(trx => {
    const totals = knownShiftIds.has(trx.shiftId)
      ? (totalsByShift.get(trx.shiftId) || createShiftTotals())
      : unassigned;
    totals.count += 1;
    totals.total += Number(trx.totalCost) || 0;
    totals.rental += Number(trx.rentalCost) || 0;
    const itemBreakdown = getTransactionItemBreakdown(trx);
    Object.keys(totals.items).forEach(category => {
      totals.items[category].amount += itemBreakdown[category].amount;
      totals.items[category].qty += itemBreakdown[category].qty;
    });
    if (knownShiftIds.has(trx.shiftId)) totalsByShift.set(trx.shiftId, totals);
  });

  const range = filterError ? null : getHistoryFilterDateRange(filterKey);
  const visibleShifts = shifts.filter(shift => {
    const startTime = Number(shift.startTime);
    const endTime = shift.endTime === null || shift.endTime === undefined
      ? Date.now()
      : Number(shift.endTime);
    const overlapsPeriod = !filterError && (filterKey === 'all' || !range || !range.start || !range.end
      || (startTime <= range.end.getTime() && endTime >= range.start.getTime()));
    return (activeShift && activeShift.id === shift.id) || overlapsPeriod || (!filterError && totalsByShift.has(shift.id));
  }).sort((a, b) => Number(b.startTime) - Number(a.startTime));

  tbody.innerHTML = '';
  visibleShifts.forEach(shift => {
    const totals = totalsByShift.get(shift.id) || createShiftTotals();
    const isActive = activeShift && activeShift.id === shift.id;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${escapeReportHtml(shift.staffName)}</strong>${isActive ? ' <span class="badge badge-running">Aktif</span>' : ''}</td>
      <td>${escapeReportHtml(formatAttendantShiftTime(shift.startTime))}</td>
      <td>${isActive ? 'Sedang jaga' : escapeReportHtml(formatAttendantShiftTime(shift.endTime))}</td>
      <td>${totals.count}</td>
      <td><strong>${formatRupiah(totals.total)}</strong></td>
      <td>${formatRupiah(totals.rental)}</td>
      <td>${formatRupiah(totals.items.Minuman.amount)} (${totals.items.Minuman.qty})</td>
      <td>${formatRupiah(totals.items.Makanan.amount)} (${totals.items.Makanan.qty})</td>
      <td>${formatRupiah(totals.items.Snack.amount)} (${totals.items.Snack.qty})</td>
    `;
    tbody.appendChild(row);
  });

  if (unassigned.count > 0) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>Petugas belum tercatat</strong></td>
      <td>-</td>
      <td>-</td>
      <td>${unassigned.count}</td>
      <td><strong>${formatRupiah(unassigned.total)}</strong></td>
      <td>${formatRupiah(unassigned.rental)}</td>
      <td>${formatRupiah(unassigned.items.Minuman.amount)} (${unassigned.items.Minuman.qty})</td>
      <td>${formatRupiah(unassigned.items.Makanan.amount)} (${unassigned.items.Makanan.qty})</td>
      <td>${formatRupiah(unassigned.items.Snack.amount)} (${unassigned.items.Snack.qty})</td>
    `;
    tbody.appendChild(row);
  }

  if (tbody.children.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="padding:16px; text-align:center; color:#94a3b8;">Belum ada data masa jaga pada periode ini.</td></tr>';
  }
}

function renderHistory() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  const db = getDB();
  const { history: filteredHistory, expenses: filteredExpenses, filterKey, filterError } = getFilteredHistory(db);
  const filterMessage = document.getElementById('historyFilterMessage');
  if (filterMessage) filterMessage.textContent = filterError;

  tbody.innerHTML = '';

  const totalOmset = getCollectedPaymentsForPeriod(db, filterKey, filterError);
  let totalBilled = 0;
  let totalRental = 0;
  const totalExpenses = filteredExpenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);

  filteredHistory.forEach(trx => {
    const itemSummary = getTransactionItemSummary(trx);
    const paidAmount = getTransactionPaidAmount(trx);
    const remainingAmount = getTransactionRemainingAmount(trx);
    totalBilled += Number(trx.totalCost) || 0;
    totalRental += Number(trx.rentalCost) || 0;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${trx.id}</strong></td>
      <td><strong>${trx.date}</strong></td>
      <td>${escapeReportHtml(trx.attendantName || 'Belum tercatat')}</td>
      <td><strong>${trx.unitName}</strong><br><small>${trx.durationText}</small></td>
      <td>${formatRupiah(trx.rentalCost)}</td>
      <td>${formatRupiah(trx.itemsCost)}<br><small>${escapeReportHtml(itemSummary || 'Tidak ada menu')}</small></td>
      <td><strong style="color:#1d4ed8;">${formatRupiah(trx.totalCost)}</strong></td>
      <td>${formatRupiah(paidAmount)}<br><small>${getTransactionPaymentSummary(trx)}</small></td>
      <td>${remainingAmount > 0 ? `<strong>${formatRupiah(remainingAmount)}</strong><br><button class="btn btn-success" onclick="openReceivePaymentModal('${escapeReportHtml(trx.id)}')">Catat Bayar</button>` : formatRupiah(0)}</td>
      <td><span class="badge ${trx.paymentMethod === 'QRIS' ? 'badge-running' : 'badge-ready'}">${escapeReportHtml(trx.paymentMethod || '-')}</span></td>
    `;
    tbody.appendChild(row);
  });

  if (filteredHistory.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="padding: 20px; text-align: center; color: #64748b;">
          Tidak ada transaksi untuk periode yang dipilih.
        </td>
      </tr>
    `;
  }

  document.getElementById('statTotalOmset').textContent = formatRupiah(totalOmset);
  document.getElementById('statTotalBilled').textContent = formatRupiah(totalBilled);
  document.getElementById('statTotalRental').textContent = formatRupiah(totalRental);
  document.getElementById('statTotalTrx').textContent = filteredHistory.length;
  document.getElementById('statTotalExpense').textContent = formatRupiah(totalExpenses);
  document.getElementById('statNetCashflow').textContent = formatRupiah(totalOmset - totalExpenses);
  renderAttendantShifts(getDB().shifts, filteredHistory, filterKey, filterError);
  renderExpenseHistory(filteredExpenses);
}

function renderExpenseHistory(expenses) {
  const tbody = document.getElementById('expenseTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  expenses.forEach(expense => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeReportHtml(expense.date)}</td>
      <td>${escapeReportHtml(expense.category)}</td>
      <td>${escapeReportHtml(expense.description || '-')}</td>
      <td>${formatRupiah(expense.amount)}</td>
    `;
    tbody.appendChild(row);
  });

  if (expenses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="padding:16px; text-align:center; color:#94a3b8;">Belum ada pengeluaran pada periode ini.</td></tr>';
  }
}

function renderAdminExpenses() {
  const db = getDB();
  const tbody = document.getElementById('adminExpenseTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const expenses = db.expenses.filter(expense => {
    if (getAdminDateFilterError()) return false;
    const { startValue, endValue } = getAdminDateRange();
    if (!startValue && !endValue) return true;
    const date = parseExpenseDate(expense.date);
    const bounds = getAdminDateBounds();
    return Boolean(bounds && !Number.isNaN(date.getTime()) && date >= bounds.start && date <= bounds.end);
  });
  expenses.forEach(expense => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeReportHtml(expense.date)}</td>
      <td>${escapeReportHtml(expense.category)}</td>
      <td>${escapeReportHtml(expense.description || '-')}</td>
      <td>${formatRupiah(expense.amount)}</td>
      <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteExpense('${escapeReportHtml(expense.id)}')">Hapus</button></td>
    `;
    tbody.appendChild(row);
  });

  if (expenses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding:16px; text-align:center; color:#94a3b8;">Tidak ada pengeluaran pada tanggal yang dipilih.</td></tr>';
  }
}

function addExpense(event) {
  event.preventDefault();
  const date = document.getElementById('expenseDate').value;
  const category = document.getElementById('expenseCategory').value.trim();
  const description = document.getElementById('expenseDescription').value.trim();
  const amount = Number(document.getElementById('expenseAmount').value);

  if (!date || !category || !Number.isSafeInteger(amount) || amount <= 0) {
    alert('Tanggal, kategori, dan jumlah pengeluaran harus diisi dengan benar.');
    return;
  }

  const db = getDB();
  db.expenses.unshift({
    id: `EXP-${Date.now()}`,
    date,
    category,
    description,
    amount
  });
  saveDB(db);

  document.getElementById('expenseCategory').value = '';
  document.getElementById('expenseDescription').value = '';
  document.getElementById('expenseAmount').value = '';
  renderHistory();
  renderAdminExpenses();
}

function deleteExpense(id) {
  if (!confirm('Hapus catatan pengeluaran ini?')) return;
  const db = getDB();
  db.expenses = db.expenses.filter(expense => expense.id !== id);
  saveDB(db);
  renderHistory();
  renderAdminExpenses();
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

function getAttendantShiftReportRows(history, shifts = getDB().shifts) {
  const shiftsById = new Map(shifts.map(shift => [shift.id, shift]));
  const totalsByShift = new Map();

  history.forEach(trx => {
    const shift = shiftsById.get(trx.shiftId);
    const name = shift ? shift.staffName : (trx.attendantName || 'Petugas belum tercatat');
    const key = shift ? shift.id : `legacy:${name}`;
    const totals = totalsByShift.get(key) || {
      name,
      startTime: shift ? shift.startTime : null,
      endTime: shift ? shift.endTime : null,
      count: 0,
      total: 0,
      rental: 0,
      items: { Minuman: { amount: 0, qty: 0 }, Makanan: { amount: 0, qty: 0 }, Snack: { amount: 0, qty: 0 } }
    };
    totals.count += 1;
    totals.total += Number(trx.totalCost) || 0;
    totals.rental += Number(trx.rentalCost) || 0;
    const itemBreakdown = getTransactionItemBreakdown(trx);
    Object.keys(totals.items).forEach(category => {
      totals.items[category].amount += itemBreakdown[category].amount;
      totals.items[category].qty += itemBreakdown[category].qty;
    });
    totalsByShift.set(key, totals);
  });

  return Array.from(totalsByShift.values())
    .sort((a, b) => {
      if (a.startTime === null) return 1;
      if (b.startTime === null) return -1;
      return Number(b.startTime) - Number(a.startTime);
    });
}

function escapeXml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function excelColumnName(column) {
  let name = '';
  while (column > 0) {
    const remainder = (column - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    column = Math.floor((column - 1) / 26);
  }
  return name;
}

function excelDateSerial(date) {
  const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return (localDate.getTime() - new Date(1899, 11, 30).getTime()) / 86400000
    + (date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()) / 86400;
}

function excelXmlCell(cell, rowIndex, columnIndex) {
  const reference = `${excelColumnName(columnIndex + 1)}${rowIndex + 1}`;
  const style = cell.style ? ` s="${cell.style}"` : '';
  if (cell.formula) {
    return `<c r="${reference}"${style}><f>${escapeXml(cell.formula)}</f><v>0</v></c>`;
  }
  if (cell.type === 'number') {
    return `<c r="${reference}"${style}><v>${Number(cell.value) || 0}</v></c>`;
  }
  return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`;
}

function excelXmlSheet(rows, options = {}) {
  const sheetRows = rows.map((row, rowIndex) =>
    `<row r="${rowIndex + 1}"${options.rowHeights && options.rowHeights[rowIndex + 1] ? ` ht="${options.rowHeights[rowIndex + 1]}" customHeight="1"` : ''}>${row.map((cell, columnIndex) => excelXmlCell(cell, rowIndex, columnIndex)).join('')}</row>`
  ).join('');
  const columns = options.widths
    ? `<cols>${options.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const merges = options.merges && options.merges.length
    ? `<mergeCells count="${options.merges.length}">${options.merges.map(reference => `<mergeCell ref="${reference}"/>`).join('')}</mergeCells>`
    : '';
  const autoFilter = options.autoFilter
    ? `<autoFilter ref="${options.autoFilter}"/>`
    : '';
  const freezeRows = Number.isInteger(options.freezeRows) ? options.freezeRows : 1;
  const sheetView = freezeRows > 0
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      ${sheetView}<sheetFormatPr defaultRowHeight="20"/>${columns}<sheetData>${sheetRows}</sheetData>${autoFilter}${merges}
    </worksheet>`;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZipBlob(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  files.forEach(file => {
    const name = encoder.encode(file.name);
    const content = encoder.encode(file.content);
    const checksum = crc32(content);
    const localHeader = new Uint8Array(30 + name.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, content.length, true);
    localView.setUint32(22, content.length, true);
    localView.setUint16(26, name.length, true);
    localHeader.set(name, 30);
    localParts.push(localHeader, content);

    const centralHeader = new Uint8Array(46 + name.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, content.length, true);
    centralView.setUint32(24, content.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, localOffset, true);
    centralHeader.set(name, 46);
    centralParts.push(centralHeader);

    localOffset += localHeader.length + content.length;
  });

  const centralDirectory = new Uint8Array(centralParts.reduce((total, part) => total + part.length, 0));
  let centralOffset = 0;
  centralParts.forEach(part => {
    centralDirectory.set(part, centralOffset);
    centralOffset += part.length;
  });
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, localOffset, true);

  const zipParts = [...localParts, centralDirectory, endRecord];
  const zipBlob = new Blob(zipParts, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  return zipBlob;
}

function createExcelReport(history, expenses, periodLabel, shifts = getDB().shifts, collectedTotal = null, paymentRecords = []) {
  const sortedHistory = [...history].sort((a, b) => parseTransactionDate(a.date) - parseTransactionDate(b.date));
  const sortedExpenses = [...expenses].sort((a, b) => parseExpenseDate(a.date) - parseExpenseDate(b.date));
  const dates = new Map();
  const months = new Map();

  sortedHistory.forEach(trx => {
    const date = parseTransactionDate(trx.date);
    if (Number.isNaN(date.getTime())) return;
    const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    dates.set(dayKey, date);
    months.set(dayKey.slice(0, 7), true);
  });
  sortedExpenses.forEach(expense => {
    const date = parseExpenseDate(expense.date);
    if (Number.isNaN(date.getTime())) return;
    dates.set(expense.date, date);
    months.set(expense.date.slice(0, 7), true);
  });
  paymentRecords.forEach(payment => {
    if (Number.isNaN(payment.date.getTime())) return;
    const dayKey = `${payment.date.getFullYear()}-${String(payment.date.getMonth() + 1).padStart(2, '0')}-${String(payment.date.getDate()).padStart(2, '0')}`;
    dates.set(dayKey, payment.date);
    months.set(dayKey.slice(0, 7), true);
  });

  const textCell = value => ({ value: value === null || value === undefined ? '' : String(value), type: 'string' });
  const numberCell = (value, style = 2) => ({ value: Number(value) || 0, type: 'number', style });
  const formulaCell = formula => ({ value: 0, type: 'number', style: 2, formula });
  const dateCell = (date, includeTime = true) => ({
    value: excelDateSerial(date),
    type: 'number',
    style: includeTime ? 1 : 4
  });
  const headerRow = labels => labels.map(label => ({ ...textCell(label), style: 3 }));

  const transactionRows = sortedHistory.map(trx => {
    const date = parseTransactionDate(trx.date);
    const dayKey = Number.isNaN(date.getTime())
      ? ''
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return [
      textCell(trx.id),
      Number.isNaN(date.getTime()) ? textCell(trx.date) : dateCell(date),
      Number.isNaN(date.getTime()) ? textCell('') : dateCell(date, false),
      textCell(dayKey ? dayKey.slice(0, 7) : ''),
      textCell(trx.unitName),
      textCell(trx.durationText),
      textCell(getTransactionItemSummary(trx)),
      numberCell(trx.rentalCost),
      numberCell(trx.totalCost),
      textCell(trx.paymentMethod),
      textCell(trx.attendantName || shifts.find(shift => shift.id === trx.shiftId)?.staffName || 'Petugas belum tercatat'),
      numberCell(getTransactionPaidAmount(trx))
    ];
  });
  const expenseRows = sortedExpenses.map(expense => {
    const date = parseExpenseDate(expense.date);
    const dayKey = Number.isNaN(date.getTime()) ? '' : expense.date;
    return [
      textCell(expense.id),
      dayKey ? dateCell(date, false) : textCell(expense.date),
      dayKey ? dateCell(date, false) : textCell(''),
      textCell(dayKey ? dayKey.slice(0, 7) : ''),
      textCell(expense.category),
      textCell(expense.description),
      numberCell(expense.amount)
    ];
  });
  const paymentRows = paymentRecords.map(payment => [
    dateCell(payment.date),
    dateCell(payment.date, false),
    textCell(`${payment.date.getFullYear()}-${String(payment.date.getMonth() + 1).padStart(2, '0')}`),
    textCell(payment.transactionId),
    textCell(payment.unitName),
    textCell(payment.method),
    numberCell(payment.amount),
    textCell(payment.type)
  ]);

  const transactionEnd = Math.max(2, transactionRows.length + 1);
  const expenseEnd = Math.max(2, expenseRows.length + 1);
  const paymentEnd = Math.max(2, paymentRows.length + 1);
  const dailyRows = Array.from(dates.keys()).sort().map(dayKey => ({ dayKey, date: dates.get(dayKey) }));
  const dailyDataRows = dailyRows.map((item, index) => {
    const rowNumber = index + 2;
    return [
      dateCell(item.date, false),
      formulaCell(`SUMIF(Penerimaan!$B$2:$B$${paymentEnd},$A${rowNumber},Penerimaan!$G$2:$G$${paymentEnd})`),
      formulaCell(`SUMIF(Pengeluaran!$C$2:$C$${expenseEnd},$A${rowNumber},Pengeluaran!$G$2:$G$${expenseEnd})`),
      formulaCell(`B${rowNumber}-C${rowNumber}`)
    ];
  });
  const monthDataRows = Array.from(months.keys()).sort().map((monthKey, index) => {
    const rowNumber = index + 2;
    return [
      textCell(monthKey),
      formulaCell(`SUMIF(Penerimaan!$C$2:$C$${paymentEnd},$A${rowNumber},Penerimaan!$G$2:$G$${paymentEnd})`),
      formulaCell(`SUMIF(Pengeluaran!$D$2:$D$${expenseEnd},$A${rowNumber},Pengeluaran!$G$2:$G$${expenseEnd})`),
      formulaCell(`B${rowNumber}-C${rowNumber}`)
    ];
  });
  const totalFormula = (rowCount, column, firstDataRow = 2) => rowCount > 0
    ? formulaCell(`SUM(${excelColumnName(column)}${firstDataRow}:${excelColumnName(column)}${firstDataRow + rowCount - 1})`)
    : numberCell(0);
  const summaryRows = (headers, dataRows) => [
    headerRow(headers),
    ...dataRows,
    [textCell('TOTAL'), totalFormula(dataRows.length, 2), totalFormula(dataRows.length, 3), totalFormula(dataRows.length, 4)]
  ];
  const transactionSheetRows = [
    headerRow(['ID Transaksi', 'Tanggal & Waktu', 'Tanggal Rekap', 'Bulan Rekap', 'Unit', 'Durasi', 'Menu', 'Rental (Rp)', 'Total Tagihan (Rp)', 'Metode', 'Petugas', 'Sudah Dibayar (Rp)']),
    ...transactionRows,
    [
      textCell('TOTAL'), textCell(''), textCell(''), textCell(''), textCell(''), textCell(''), textCell(''),
      totalFormula(transactionRows.length, 8), totalFormula(transactionRows.length, 9), textCell(''), textCell(''),
      totalFormula(transactionRows.length, 12)
    ]
  ];
  const expenseSheetRows = [
    headerRow(['ID Pengeluaran', 'Tanggal', 'Tanggal Rekap', 'Bulan Rekap', 'Kategori', 'Keterangan', 'Jumlah Keluar (Rp)']),
    ...expenseRows,
    [textCell('TOTAL'), textCell(''), textCell(''), textCell(''), textCell(''), textCell(''), totalFormula(expenseRows.length, 7)]
  ];
  const paymentSheetRows = [
    headerRow(['Tanggal & Waktu', 'Tanggal Rekap', 'Bulan Rekap', 'ID Transaksi', 'Unit', 'Metode', 'Jumlah Diterima (Rp)', 'Jenis Pembayaran']),
    ...paymentRows,
    [
      textCell('TOTAL'), textCell(''), textCell(''), textCell(''), textCell(''), textCell(''),
      totalFormula(paymentRows.length, 7), textCell('')
    ]
  ];
  const reportHeader = labels => labels.map(label => ({ ...textCell(label), style: 3 }));
  const reportSection = label => [{ ...textCell(label), style: 7 }, ...Array.from({ length: 8 }, () => textCell(''))];
  const reportTitleRow = [
    { ...textCell('REKAP LAPORAN KEUANGAN'), style: 5 },
    ...Array.from({ length: 8 }, () => textCell(''))
  ];
  const reportSubtitleRow = [
    { ...textCell(`Periode: ${periodLabel}`), style: 6 },
    ...Array.from({ length: 8 }, () => textCell(''))
  ];
  const mainReportRows = [
    reportTitleRow,
    reportSubtitleRow,
    Array.from({ length: 9 }, () => textCell('')),
    reportSection('RINGKASAN PEMASUKAN & PENGELUARAN'),
    reportHeader(['Keterangan', 'Jumlah (Rp)', '', '', '', '', '', '', '']),
    [{ ...textCell('Pendapatan Rental PS'), style: 8 }, formulaCell(`SUM(Transaksi!$H$2:$H$${transactionEnd})`)],
    [{ ...textCell('Total Tagihan'), style: 8 }, formulaCell(`SUM(Transaksi!$I$2:$I$${transactionEnd})`)],
    [{ ...textCell('Total Pengeluaran'), style: 8 }, formulaCell(`SUM(Pengeluaran!$G$2:$G$${expenseEnd})`)],
    [{ ...textCell('Saldo Bersih'), style: 9 }, { ...formulaCell('B10-B8'), style: 9 }],
    [{ ...textCell('Total Sudah Dibayar'), style: 8 }, numberCell(collectedTotal === null
      ? sortedHistory.reduce((sum, trx) => sum + getTransactionPaidAmount(trx), 0)
      : collectedTotal)],
    Array.from({ length: 9 }, () => textCell('')),
    reportSection('RINCIAN TRANSAKSI'),
    reportHeader(['ID Transaksi', 'Waktu', 'Unit', 'Durasi', 'Menu yang Diambil', 'Biaya Rental (Rp)', 'Total Tagihan (Rp)', 'Sudah Dibayar (Rp)', 'Metode Pembayaran']),
    ...sortedHistory.map(trx => {
      const date = parseTransactionDate(trx.date);
      return [
        textCell(trx.id),
        Number.isNaN(date.getTime()) ? textCell(trx.date) : dateCell(date),
        textCell(trx.unitName),
        textCell(trx.durationText),
        textCell(getTransactionItemSummary(trx) || '-'),
        numberCell(trx.rentalCost),
        numberCell(trx.totalCost),
        numberCell(getTransactionPaidAmount(trx)),
        textCell(trx.paymentMethod)
      ];
    }),
    [
      { ...textCell('TOTAL'), style: 9 },
      ...Array.from({ length: 4 }, () => textCell('')),
      { ...totalFormula(transactionRows.length, 6, 14), style: 9 },
      { ...totalFormula(transactionRows.length, 7, 14), style: 9 },
      { ...totalFormula(transactionRows.length, 8, 14), style: 9 },
      textCell('')
    ]
  ];
  const attendantShiftRows = getAttendantShiftReportRows(history, shifts).map(shift => [
    textCell(shift.name),
    shift.startTime !== null && shift.startTime !== undefined && shift.startTime !== ''
      && Number.isFinite(Number(shift.startTime))
      ? dateCell(new Date(Number(shift.startTime)))
      : textCell('-'),
    shift.endTime === null || shift.endTime === undefined
      ? textCell('Sedang jaga')
      : Number.isFinite(Number(shift.endTime)) ? dateCell(new Date(Number(shift.endTime))) : textCell('-'),
    numberCell(shift.count),
    numberCell(shift.total),
    numberCell(shift.rental),
    numberCell(shift.items.Minuman.amount),
    numberCell(shift.items.Makanan.amount),
    numberCell(shift.items.Snack.amount)
  ]);
  const attendantShiftSheetRows = [
    headerRow(['Nama Petugas', 'Mulai Jaga', 'Selesai Jaga', 'Jumlah Transaksi', 'Total Omzet (Rp)', 'Rental PS (Rp)', 'Minuman (Rp)', 'Makanan (Rp)', 'Snack (Rp)']),
    ...attendantShiftRows,
    [
      textCell('TOTAL'),
      textCell(''),
      textCell(''),
      attendantShiftRows.length ? formulaCell(`SUM(D2:D${attendantShiftRows.length + 1})`) : numberCell(0),
      attendantShiftRows.length ? formulaCell(`SUM(E2:E${attendantShiftRows.length + 1})`) : numberCell(0),
      ...['F', 'G', 'H', 'I'].map(column => attendantShiftRows.length
        ? formulaCell(`SUM(${column}2:${column}${attendantShiftRows.length + 1})`)
        : numberCell(0))
    ]
  ];
  const sheets = [
    { name: 'Rekap Utama', rows: mainReportRows, options: { widths: [22, 21, 18, 26, 38, 20, 20, 22, 22], merges: ['A1:I1', 'A2:I2', 'A4:I4', 'A12:I12'], autoFilter: `A13:I${Math.max(13, transactionRows.length + 13)}`, freezeRows: 2, rowHeights: { 1: 34, 2: 24, 3: 10, 4: 26, 11: 10, 12: 26 } } },
    { name: 'Rekap Harian', rows: summaryRows(['Tanggal', 'Pemasukan (Rp)', 'Pengeluaran (Rp)', 'Saldo Bersih (Rp)'], dailyDataRows), options: { widths: [20, 24, 24, 24] } },
    { name: 'Rekap Bulanan', rows: summaryRows(['Bulan', 'Pemasukan (Rp)', 'Pengeluaran (Rp)', 'Saldo Bersih (Rp)'], monthDataRows), options: { widths: [20, 24, 24, 24] } },
    { name: 'Rekap Shift', rows: attendantShiftSheetRows, options: { widths: [24, 22, 22, 20, 24, 20, 20, 20, 20], autoFilter: `A1:I${Math.max(1, attendantShiftRows.length + 1)}` } },
    { name: 'Transaksi', rows: transactionSheetRows, options: { widths: [18, 22, 15, 12, 20, 28, 40, 18, 22, 18, 24, 22], autoFilter: `A1:L${Math.max(1, transactionRows.length + 1)}` } },
    { name: 'Penerimaan', rows: paymentSheetRows, options: { widths: [22, 16, 14, 22, 20, 18, 22, 20], autoFilter: `A1:H${Math.max(1, paymentRows.length + 1)}` } },
    { name: 'Pengeluaran', rows: expenseSheetRows, options: { widths: [18, 16, 16, 12, 24, 40, 22], autoFilter: `A1:G${Math.max(1, expenseRows.length + 1)}` } }
  ];

  const sheetReferences = sheets.map((sheet, index) =>
    `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  ).join('');
  const worksheetFiles = sheets.map((sheet, index) => ({
    name: `xl/worksheets/sheet${index + 1}.xml`,
    content: excelXmlSheet(sheet.rows, sheet.options)
  }));
  const workbookFiles = [
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
          <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
          <Default Extension="xml" ContentType="application/xml"/>
          <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
          <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
          ${sheets.map((sheet, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
        </Types>`
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
        </Relationships>`
    },
    {
      name: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <sheets>${sheetReferences}</sheets><calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>
        </workbook>`
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          ${sheets.map((sheet, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}
          <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
        </Relationships>`
    },
    {
      name: 'xl/styles.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;Rp&quot; #,##0;[Red]-&quot;Rp&quot; #,##0"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy"/></numFmts>
          <fonts count="5"><font><sz val="10"/><color rgb="FF1E293B"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><i/><sz val="10"/><color rgb="FF64748B"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FF0F172A"/><name val="Arial"/></font></fonts>
          <fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD4AF37"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF7D6"/><bgColor indexed="64"/></patternFill></fill></fills>
          <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border></borders>
          <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
          <cellXfs count="10"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="1" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="1" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="4" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf></cellXfs>
          <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
        </styleSheet>`
    },
    ...worksheetFiles
  ];
  return createZipBlob(workbookFiles);
}

function downloadReportFile(content, mimeType, fileName) {
  const blob = content instanceof Blob ? content : new Blob(['\ufeff', content], { type: mimeType });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

function exportHistoryReport(format) {
  const db = getDB();
  const { history, expenses, filterKey, filterError } = getFilteredHistory(db);
  if (filterError) {
    alert(filterError);
    return;
  }
  const shifts = db.shifts;
  const attendantShiftRows = getAttendantShiftReportRows(history, shifts);

  const expenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const totals = history.reduce((sum, trx) => ({
    rental: sum.rental + Number(trx.rentalCost || 0),
    total: sum.total + Number(trx.totalCost || 0)
  }), { rental: 0, total: 0 });
  totals.paid = getCollectedPaymentsForPeriod(db, filterKey, filterError);
  totals.expenses = expenseTotal;
  totals.net = totals.paid - expenseTotal;
  const paymentRecords = getPaymentReportRecords(db, filterKey, filterError);

  const now = new Date();
  const fileDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (format === 'excel') {
    const workbook = createExcelReport(history, expenses, getReportPeriodLabel(filterKey), shifts, totals.paid, paymentRecords);
    downloadReportFile(workbook, workbook.type, `rekap_keuangan_${fileDate}.xlsx`);
    return;
  }

  const transactionRows = history.map(trx => {
    const itemDetails = getTransactionItemSummary(trx);
    return `
      <tr>
        <td>${escapeReportHtml(trx.id)}</td>
        <td>${escapeReportHtml(trx.date)}</td>
        <td>${escapeReportHtml(trx.attendantName || shifts.find(shift => shift.id === trx.shiftId)?.staffName || 'Petugas belum tercatat')}</td>
        <td>${escapeReportHtml(trx.unitName)}</td>
        <td>${escapeReportHtml(trx.durationText)}</td>
        <td>${escapeReportHtml(itemDetails || '-')}</td>
        <td>${Number(trx.rentalCost || 0)}</td>
        <td>${Number(trx.totalCost || 0)}</td>
        <td>${getTransactionPaidAmount(trx)}</td>
        <td>${getTransactionPaymentSummary(trx)}</td>
        <td>${escapeReportHtml(trx.paymentMethod)}</td>
      </tr>`;
  }).join('');
  const attendantShiftTableRows = attendantShiftRows.map(shift => `
    <tr>
      <td>${escapeReportHtml(shift.name)}</td>
      <td>${escapeReportHtml(shift.startTime !== null && shift.startTime !== undefined && shift.startTime !== ''
        && Number.isFinite(Number(shift.startTime)) ? formatAttendantShiftTime(shift.startTime) : '-')}</td>
      <td>${escapeReportHtml(shift.endTime === null || shift.endTime === undefined ? 'Sedang jaga' : formatAttendantShiftTime(shift.endTime))}</td>
      <td>${shift.count}</td>
      <td>Rp ${shift.total.toLocaleString('id-ID')}</td>
      <td>Rp ${shift.rental.toLocaleString('id-ID')}</td>
      <td>Rp ${shift.items.Minuman.amount.toLocaleString('id-ID')} (${shift.items.Minuman.qty})</td>
      <td>Rp ${shift.items.Makanan.amount.toLocaleString('id-ID')} (${shift.items.Makanan.qty})</td>
      <td>Rp ${shift.items.Snack.amount.toLocaleString('id-ID')} (${shift.items.Snack.qty})</td>
    </tr>`).join('');
  const expenseRows = expenses.map(expense => `
    <tr>
      <td>${escapeReportHtml(expense.date)}</td>
      <td>${escapeReportHtml(expense.category)}</td>
      <td>${escapeReportHtml(expense.description || '-')}</td>
      <td>Rp ${Number(expense.amount || 0).toLocaleString('id-ID')}</td>
    </tr>`).join('');
  const paymentRows = paymentRecords.map(payment => `
    <tr>
      <td>${escapeReportHtml(payment.date.toLocaleString('id-ID'))}</td>
      <td>${escapeReportHtml(payment.transactionId)}</td>
      <td>${escapeReportHtml(payment.unitName)}</td>
      <td>${escapeReportHtml(payment.type)}</td>
      <td>${escapeReportHtml(payment.method)}</td>
      <td>Rp ${payment.amount.toLocaleString('id-ID')}</td>
    </tr>`).join('');

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
        <p><strong>Total Tagihan: Rp ${totals.total.toLocaleString('id-ID')}</strong></p>
        <p>Total Sudah Dibayar: Rp ${totals.paid.toLocaleString('id-ID')}</p>
        <p>Total Pengeluaran: Rp ${totals.expenses.toLocaleString('id-ID')}</p>
        <p><strong>Saldo Bersih: Rp ${totals.net.toLocaleString('id-ID')}</strong></p>
      </div>
      <h2>Rekap Jaga Petugas</h2>
      <table>
        <thead><tr><th>Nama Petugas</th><th>Mulai Jaga</th><th>Selesai Jaga</th><th>Jumlah Transaksi</th><th>Omzet Keseluruhan</th><th>Rental PS</th><th>Minuman</th><th>Makanan</th><th>Snack</th></tr></thead>
        <tbody>${attendantShiftTableRows || '<tr><td colspan="9">Tidak ada transaksi pada periode ini.</td></tr>'}</tbody>
        <tfoot><tr><th colspan="3">TOTAL</th><th>${attendantShiftRows.reduce((sum, shift) => sum + shift.count, 0)}</th><th>Rp ${attendantShiftRows.reduce((sum, shift) => sum + shift.total, 0).toLocaleString('id-ID')}</th><th>Rp ${attendantShiftRows.reduce((sum, shift) => sum + shift.rental, 0).toLocaleString('id-ID')}</th><th>Rp ${attendantShiftRows.reduce((sum, shift) => sum + shift.items.Minuman.amount, 0).toLocaleString('id-ID')}</th><th>Rp ${attendantShiftRows.reduce((sum, shift) => sum + shift.items.Makanan.amount, 0).toLocaleString('id-ID')}</th><th>Rp ${attendantShiftRows.reduce((sum, shift) => sum + shift.items.Snack.amount, 0).toLocaleString('id-ID')}</th></tr></tfoot>
      </table>
      <table>
        <thead><tr>
          <th>ID Transaksi</th><th>Waktu</th><th>Petugas</th><th>Unit</th><th>Durasi</th>
          <th>Menu yang Diambil</th><th>Biaya Rental (Rp)</th>
          <th>Total Tagihan (Rp)</th><th>Sudah Dibayar (Rp)</th><th>Rincian Pembayaran</th><th>Metode Pembayaran</th>
        </tr></thead>
        <tbody>${transactionRows || '<tr><td colspan="11">Tidak ada transaksi pada periode ini.</td></tr>'}</tbody>
        <tfoot><tr>
          <th colspan="6">TOTAL</th><th>${totals.rental}</th>
          <th>${totals.total}</th><th>${totals.paid}</th><th></th><th></th>
        </tr>        </tfoot>
      </table>
      <h2>Rincian Uang Diterima</h2>
      <table>
        <thead><tr><th>Waktu Pembayaran</th><th>ID Transaksi</th><th>Unit</th><th>Jenis</th><th>Metode</th><th>Jumlah</th></tr></thead>
        <tbody>${paymentRows || '<tr><td colspan="6">Tidak ada pembayaran pada periode ini.</td></tr>'}</tbody>
        <tfoot><tr><th colspan="5">TOTAL DITERIMA</th><th>Rp ${paymentRecords.reduce((sum, payment) => sum + payment.amount, 0).toLocaleString('id-ID')}</th></tr></tfoot>
      </table>
      <h2>Pengeluaran</h2>
      <table>
        <thead><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th>Jumlah Keluar</th></tr></thead>
        <tbody>${expenseRows || '<tr><td colspan="4">Tidak ada pengeluaran pada periode ini.</td></tr>'}</tbody>
        <tfoot><tr><th colspan="3">TOTAL PENGELUARAN</th><th>Rp ${totals.expenses.toLocaleString('id-ID')}</th></tr></tfoot>
      </table>
    </body></html>`;

  downloadReportFile(documentHtml, 'application/msword;charset=utf-8', `rekap_riwayat_${fileDate}.doc`);
}

function deleteHistoryTransaction(id) {
  if (!confirm('Hapus transaksi ini dari riwayat?')) return;

  const db = getDB();
  db.history = db.history.filter(trx => trx.id !== id);
  saveDB(db);
  renderHistory();
  renderAdminHistory();
  renderAdminAttendantShifts();
}

function getAdminDateRange() {
  const startInput = document.getElementById('adminStartDate');
  const endInput = document.getElementById('adminEndDate');
  return {
    startValue: startInput ? startInput.value : '',
    endValue: endInput ? endInput.value : ''
  };
}

function getAdminDateBounds() {
  const { startValue, endValue } = getAdminDateRange();
  if (!startValue || !endValue || startValue > endValue) return null;
  const [startYear, startMonth, startDay] = startValue.split('-').map(Number);
  const [endYear, endMonth, endDay] = endValue.split('-').map(Number);
  return {
    start: new Date(startYear, startMonth - 1, startDay),
    end: new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999)
  };
}

function getAdminDateFilterError() {
  const { startValue, endValue } = getAdminDateRange();
  if (!startValue && !endValue) return '';
  if (!startValue || !endValue) return 'Pilih tanggal awal dan tanggal akhir untuk melihat data.';
  if (startValue > endValue) return 'Tanggal awal tidak boleh melewati tanggal akhir.';
  return '';
}

function matchesAdminDate(value, isTimestamp = false) {
  const { startValue, endValue } = getAdminDateRange();
  if (!startValue && !endValue) return true;
  if (!startValue || !endValue || startValue > endValue) return false;

  const date = isTimestamp ? new Date(Number(value)) : parseTransactionDate(value);
  if (Number.isNaN(date.getTime())) return false;
  const bounds = getAdminDateBounds();
  return Boolean(bounds && date >= bounds.start && date <= bounds.end);
}

function getAdminFilteredTransactions(db = getDB()) {
  if (getAdminDateFilterError()) return [];
  return db.history.filter(trx => matchesAdminDate(trx.date));
}

function renderAdminDateData() {
  const message = document.getElementById('adminDateFilterMessage');
  const { startValue, endValue } = getAdminDateRange();
  const filterError = getAdminDateFilterError();
  if (message) {
    message.textContent = filterError || (!startValue && !endValue
      ? 'Menampilkan semua tanggal.'
      : `Menampilkan data ${startValue} sampai ${endValue}.`);
    message.classList.toggle('error', Boolean(filterError));
    message.classList.toggle('success', !filterError && Boolean(startValue && endValue));
  }
  renderAdminAttendantShifts();
  renderAdminHistory();
  renderAdminExpenses();
}

function clearAdminDateFilter() {
  const startInput = document.getElementById('adminStartDate');
  const endInput = document.getElementById('adminEndDate');
  if (startInput) startInput.value = '';
  if (endInput) endInput.value = '';
  const message = document.getElementById('adminDateFilterMessage');
  if (message) {
    message.textContent = 'Menampilkan semua tanggal.';
    message.classList.remove('error', 'success');
  }
  renderAdminDateData();
}

function renderAdminHistory() {
  const db = getDB();
  const tbody = document.getElementById('adminHistoryTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const history = getAdminFilteredTransactions(db);
  history.forEach(trx => {
    const remainingAmount = getTransactionRemainingAmount(trx);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${trx.id}</strong></td>
      <td>${trx.date}</td>
      <td>${escapeReportHtml(trx.unitName)}<br><small>${escapeReportHtml(trx.durationText)}</small><br><small>${escapeReportHtml(getTransactionItemSummary(trx) || 'Tidak ada menu')}</small></td>
      <td>${formatRupiah(trx.totalCost)}</td>
      <td>${formatRupiah(getTransactionPaidAmount(trx))}<br><small>${getTransactionPaymentSummary(trx)}</small></td>
      <td>${formatRupiah(remainingAmount)}</td>
      <td><span class="badge ${trx.paymentMethod === 'QRIS' ? 'badge-running' : 'badge-ready'}">${trx.paymentMethod}</span></td>
      <td>
        ${remainingAmount > 0 ? `<button class="btn btn-success" onclick="openReceivePaymentModal('${escapeReportHtml(trx.id)}')">Catat Bayar</button>` : ''}
        <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteHistoryTransaction('${trx.id}')">Hapus</button>
      </td>
    `;
    tbody.appendChild(row);
  });
  if (history.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="padding:16px; text-align:center; color:#94a3b8;">Tidak ada transaksi pada tanggal yang dipilih.</td></tr>';
  }
}

function renderAdminAttendantShifts() {
  const db = getDB();
  const tbody = document.getElementById('adminAttendantShiftTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const history = getAdminFilteredTransactions(db);
  const filterError = getAdminDateFilterError();
  const activeShift = getActiveAttendantShift(db);
  const visibleShifts = db.shifts.filter(shift => {
    if (filterError) return false;
    const { startValue, endValue } = getAdminDateRange();
    if (!startValue && !endValue) return true;
    const bounds = getAdminDateBounds();
    if (!bounds) return false;
    const start = bounds.start.getTime();
    const end = bounds.end.getTime();
    const shiftStart = Number(shift.startTime);
    const shiftEnd = shift.endTime === null || shift.endTime === undefined ? Date.now() : Number(shift.endTime);
    return (shiftStart <= end && shiftEnd >= start)
      || history.some(trx => trx.shiftId === shift.id);
  }).sort((a, b) => Number(b.startTime) - Number(a.startTime));

  visibleShifts.forEach(shift => {
    const transactions = history.filter(trx => trx.shiftId === shift.id);
    const total = transactions.reduce((sum, trx) => sum + (Number(trx.totalCost) || 0), 0);
    const rental = transactions.reduce((sum, trx) => sum + (Number(trx.rentalCost) || 0), 0);
    const breakdown = transactions.reduce((result, trx) => {
      const items = getTransactionItemBreakdown(trx);
      Object.keys(result).forEach(category => {
        result[category].amount += items[category].amount;
        result[category].qty += items[category].qty;
      });
      return result;
    }, { Minuman: { amount: 0, qty: 0 }, Makanan: { amount: 0, qty: 0 }, Snack: { amount: 0, qty: 0 } });
    const isActive = activeShift && activeShift.id === shift.id;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${escapeReportHtml(shift.staffName)}</strong>${isActive ? ' <span class="badge badge-running">Aktif</span>' : ''}</td>
      <td>${escapeReportHtml(formatAttendantShiftTime(shift.startTime))}</td>
      <td>${isActive ? 'Sedang jaga' : escapeReportHtml(formatAttendantShiftTime(shift.endTime))}</td>
      <td>${transactions.length}</td>
      <td><strong>${formatRupiah(total)}</strong></td>
      <td>${formatRupiah(rental)}</td>
      <td>${formatRupiah(breakdown.Minuman.amount)} (${breakdown.Minuman.qty})</td>
      <td>${formatRupiah(breakdown.Makanan.amount)} (${breakdown.Makanan.qty})</td>
      <td>${formatRupiah(breakdown.Snack.amount)} (${breakdown.Snack.qty})</td>
      <td class="admin-action-cell">
        <button class="btn btn-secondary" onclick="editAttendantShift('${escapeReportHtml(shift.id)}')">Edit</button>
        <button class="btn btn-danger" onclick="deleteAttendantShift('${escapeReportHtml(shift.id)}')">Hapus</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  if (visibleShifts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="padding:16px; text-align:center; color:#94a3b8;">Tidak ada riwayat jaga pada tanggal yang dipilih.</td></tr>';
  }
}

function editAttendantShift(id) {
  const db = getDB();
  const shift = db.shifts.find(item => item.id === id);
  if (!shift) return;

  const staffName = window.prompt('Edit nama petugas:', shift.staffName);
  if (staffName === null) return;
  const trimmedName = staffName.trim();
  if (!trimmedName) {
    alert('Nama petugas tidak boleh kosong.');
    return;
  }

  shift.staffName = trimmedName;
  db.history.forEach(trx => {
    if (trx.shiftId === id) trx.attendantName = trimmedName;
  });
  saveDB(db);
  renderAdminAttendantShifts();
  renderHistory();
}

function deleteAttendantShift(id) {
  const db = getDB();
  const shift = db.shifts.find(item => item.id === id);
  if (!shift) return;

  const linkedTransactions = db.history.filter(trx => trx.shiftId === id);
  const confirmation = linkedTransactions.length > 0
    ? `Hapus masa jaga ${shift.staffName}? Transaksi tetap disimpan dan akan dihitung sebagai petugas belum tercatat.`
    : `Hapus masa jaga ${shift.staffName}?`;
  if (!confirm(confirmation)) return;

  db.history.forEach(trx => {
    if (trx.shiftId === id) trx.shiftId = null;
  });
  db.shifts = db.shifts.filter(item => item.id !== id);
  saveDB(db);
  renderAdminAttendantShifts();
  renderHistory();
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
    const unitType = getUnitType(u);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${getUnitDisplayName(u.name)}</strong></td>
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
  const type = document.getElementById('adminUnitCategory').value;
  const rawNumber = document.getElementById('adminUnitNumber').value.trim();
  const number = Number(rawNumber);
  const name = String(number).padStart(2, '0');
  const rate = parseInt(document.getElementById('adminUnitRate').value) || 0;

  if (!Number.isInteger(number) || number < 1 || rate <= 0) {
    alert('Nomor unit dan tarif per jam harus diisi dengan valid.');
    return;
  }

  if (db.units.some(unit => Number(getUnitDisplayName(unit.name)) === number)) {
    alert(`Nomor TV ${number} sudah terdaftar. Pilih nomor TV yang belum digunakan.`);
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
  if (!saveDB(db)) return;

  document.getElementById('adminUnitNumber').value = '';
  updateAdminUnitNamePreview();
  document.getElementById('adminUnitImage').value = '';
  document.getElementById('adminUnitImageUpload').value = '';
  document.getElementById('adminUnitImagePreview').src = getUnitImageUrl({ type, name });
  document.getElementById('adminUnitRate').value = '';

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
  document.getElementById('editUnitName').value = getUnitDisplayName(unit.name);
  document.getElementById('editUnitType').value = getUnitType(unit);
  document.getElementById('editUnitRate').value = unit.ratePerHour;
  document.getElementById('modalEditUnit').classList.add('open');
}

function saveUnitEdit(e) {
  e.preventDefault();
  const db = getDB();
  const unit = db.units.find(u => u.id === editingUnitId);
  if (!unit) return;

  const name = document.getElementById('editUnitName').value.trim();
  const type = document.getElementById('editUnitType').value;
  const number = Number(name);
  const rate = parseInt(document.getElementById('editUnitRate').value) || 0;

  if (!Number.isInteger(number) || number < 1 || rate <= 0) {
    alert('Nomor TV dan tarif per jam harus valid.');
    return;
  }

  if (db.units.some(otherUnit => otherUnit.id !== unit.id && Number(getUnitDisplayName(otherUnit.name)) === number)) {
    alert(`Nomor TV ${String(number).padStart(2, '0')} sudah digunakan.`);
    return;
  }

  unit.name = String(number).padStart(2, '0');
  unit.type = type;
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
  checkNearFinishWarnings();
  const currentActiveTab = document.querySelector('.tab-content.active');
  if (currentActiveTab && currentActiveTab.id === 'tab-kasir') {
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
  document.getElementById('unitSearch').addEventListener('input', renderUnits);
  document.getElementById('unitCategoryFilter').addEventListener('change', renderUnits);
  document.getElementById('adminUnitCategory').addEventListener('change', updateAdminUnitNamePreview);
  document.getElementById('adminUnitNumber').addEventListener('input', updateAdminUnitNamePreview);
  updateAdminUnitNamePreview();
  const adminStartDate = document.getElementById('adminStartDate');
  const adminEndDate = document.getElementById('adminEndDate');
  if (adminStartDate && adminEndDate) {
    const today = new Date();
    const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    adminStartDate.value = todayValue;
    adminEndDate.value = todayValue;
  }
  const expenseDate = document.getElementById('expenseDate');
  if (expenseDate) {
    const today = new Date();
    expenseDate.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }
  switchTab('kasir');
});
