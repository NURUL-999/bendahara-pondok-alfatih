/* ==========================================================================
   Alfatih - Bendahara | Application Logic
   ========================================================================== */

// OPSIONAL: Isi URL Firebase Realtime Database Anda di bawah ini (contoh: "https://nama-project-default-rtdb.firebaseio.com")
// agar akun & data keuangan tersinkron otomatis ke semua HP Wali Santri tanpa perlu link.
const CLOUD_DB_URL = 'https://bendahara-alfatih-pnb-default-rtdb.asia-southeast1.firebasedatabase.app';

const STORAGE_KEYS = {
  USERS: 'alfatih_bendahara_users_permanent',
  SANTRI: 'alfatih_bendahara_santri_v3',
  REPORTS: 'alfatih_bendahara_reports_v3',
  ACTIVE_SESSION: 'alfatih_bendahara_active_user_persistent'
};

const DEFAULT_USERS = [
  {
    username: 'riski_123',
    password: 'password123',
    fullName: 'Riski',
    role: 'admin',
    avatar: ''
  }
];

let registeredUsers = [];
let santriDirectory = [];
let reportItems = [];
let currentUser = null;

let activeSection = 'beranda';
let selectedSantriFilter = 'ALL';
let activeFormSantriName = '';
let activeFormBaseSaldo = 0;
let modalEditBaseSaldo = 0;
let isSantriSelectMode = false;
let selectedSantriForDelete = new Set();
let openSantriMenuName = null;
let selfieStream = null;
let pendingAvatarDataUrl = '';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCleanCloudEndpoint() {
  const trimmed = (CLOUD_DB_URL || '').trim().replace(/\/+$/, '');
  return trimmed ? `${trimmed}/alfatih_bendahara_store.json` : '';
}

async function pullCloudData() {
  const endpoint = getCleanCloudEndpoint();
  if (!endpoint) return false;
  try {
    const res = await fetch(endpoint, { cache: 'no-store' });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data || typeof data !== 'object') return false;

    if (Array.isArray(data.users) && data.users.length > 0) {
      data.users.forEach((cu) => {
        if (!cu || !cu.username) return;
        const idx = registeredUsers.findIndex(
          (lu) => lu.username.toLowerCase() === cu.username.toLowerCase()
        );
        if (idx !== -1) {
          registeredUsers[idx] = { ...registeredUsers[idx], ...cu };
        } else {
          registeredUsers.push({ avatar: '', bio: '', alamat: '', noHp: '', ...cu });
        }
      });
    }

    if (Array.isArray(data.santri)) {
      data.santri.forEach((s) => {
        if (s && !santriDirectory.some((ls) => ls.toLowerCase() === s.toLowerCase())) {
          santriDirectory.push(s);
        }
      });
    }

    if (Array.isArray(data.reports)) {
      reportItems = data.reports;
    }

    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(registeredUsers));
    localStorage.setItem(STORAGE_KEYS.SANTRI, JSON.stringify(santriDirectory));
    localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reportItems));
    return true;
  } catch (e) {
    return false;
  }
}

async function pushCloudData() {
  const endpoint = getCleanCloudEndpoint();
  if (!endpoint) return;
  try {
    await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        users: registeredUsers,
        santri: santriDirectory,
        reports: reportItems,
        updatedAt: Date.now()
      })
    });
  } catch (e) {}
}

// INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
  loadAppData();
  if (window.lucide) lucide.createIcons();

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.santri-menu-wrapper') && openSantriMenuName !== null) {
      openSantriMenuName = null;
      renderSantriDirectory();
    }
  });

  await pullCloudData();

  const savedSession = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
  if (savedSession) {
    try {
      const parsed = JSON.parse(savedSession);
      if (parsed && parsed.username) {
        const latestUser = registeredUsers.find(
          (u) => u.username.toLowerCase() === parsed.username.toLowerCase()
        );
        currentUser = latestUser ? { ...latestUser } : parsed;
        enterDashboard();
      }
    } catch (err) {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    }
  }
});

function loadAppData() {
  try {
    const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
    const storedSantri = localStorage.getItem(STORAGE_KEYS.SANTRI);
    const storedReports = localStorage.getItem(STORAGE_KEYS.REPORTS);

    registeredUsers = storedUsers ? JSON.parse(storedUsers) : [...DEFAULT_USERS];
    santriDirectory = storedSantri ? JSON.parse(storedSantri) : [];
    reportItems = storedReports ? JSON.parse(storedReports) : [];

    registeredUsers = registeredUsers.map((u) => ({
      avatar: '',
      bio: '',
      alamat: '',
      noHp: '',
      ...u
    }));
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(registeredUsers));
  } catch (e) {
    registeredUsers = [...DEFAULT_USERS];
    santriDirectory = [];
    reportItems = [];
  }
}

function saveAppData() {
  try {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(registeredUsers));
    localStorage.setItem(STORAGE_KEYS.SANTRI, JSON.stringify(santriDirectory));
    localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reportItems));
    pushCloudData();
  } catch (e) {
    showToast('Penyimpanan browser penuh. Gunakan foto dengan ukuran lebih kecil.', 'error');
  }
}

// FORMATTING & TOASTS
function formatRupiah(num) {
  const value = Number(num) || 0;
  return value < 0
    ? '-Rp ' + Math.abs(value).toLocaleString('id-ID')
    : 'Rp ' + value.toLocaleString('id-ID');
}

function formatNumberDots(num) {
  const value = Number(num) || 0;
  return value < 0
    ? '-' + Math.abs(value).toLocaleString('id-ID')
    : value.toLocaleString('id-ID');
}

function parseFormattedNumber(str) {
  if (!str) return 0;
  return parseInt(String(str).replace(/[^\d]/g, ''), 10) || 0;
}

function getSantriSaldo(nama, excludeRecordId = null) {
  return reportItems
    .filter(
      (r) =>
        r.nama.toLowerCase() === nama.toLowerCase() &&
        (!excludeRecordId || r.id !== excludeRecordId)
    )
    .reduce((sum, r) => sum + (Number(r.masuk) || 0) - (Number(r.keluar) || 0), 0);
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const styles = {
    success: 'bg-emerald-800 text-white border-emerald-600',
    error: 'bg-rose-600 text-white border-rose-500',
    info: 'bg-slate-800 text-white border-slate-700'
  };
  toast.className = `pointer-events-auto px-4 py-3 rounded-2xl shadow-xl border text-xs sm:text-sm font-bold flex items-center gap-2.5 fade-in ${styles[type] || styles.info}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  btn.innerHTML = `<i data-lucide="${isPass ? 'eye-off' : 'eye'}" class="w-4 h-4"></i>`;
  if (window.lucide) lucide.createIcons();
}

function renderAvatarElement(el, avatarUrl, fallbackName) {
  if (!el) return;
  if (avatarUrl && avatarUrl.startsWith('data:image/')) {
    el.innerHTML = `<img src="${avatarUrl}" alt="${escapeHtml(fallbackName)}" class="w-full h-full object-cover" />`;
  } else {
    el.textContent = (fallbackName || 'U').charAt(0).toUpperCase();
  }
}

// AUTHENTICATION (MURNI USERNAME & PASSWORD)
function switchAuthView(viewName) {
  document.getElementById('view-login').classList.add('hidden');
  document.getElementById('view-register').classList.add('hidden');
  document.getElementById('view-reset').classList.add('hidden');
  document.getElementById(`view-${viewName}`).classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

async function handleLogin(event) {
  event.preventDefault();
  const usernameInput = document.getElementById('login-username').value.trim();
  const passwordInput = document.getElementById('login-password').value;
  const rememberChecked = document.getElementById('login-remember-device')?.checked ?? true;

  if (!usernameInput) {
    showToast('Silakan isi username terlebih dahulu.', 'error');
    return;
  }

  const loginBtn = document.getElementById('btn-login-submit');
  if (loginBtn) loginBtn.disabled = true;
  await pullCloudData();
  if (loginBtn) loginBtn.disabled = false;

  const matchedUser = registeredUsers.find(
    (u) => u.username.toLowerCase() === usernameInput.toLowerCase()
  );

  if (!matchedUser) {
    showToast('Username tidak ditemukan. Pastikan Admin sudah membuatkan akun dan memasukkan Username dengan benar.', 'error');
    return;
  }

  if (matchedUser.password !== passwordInput) {
    showToast('Kata sandi salah. Silakan periksa kembali kata sandi dari Admin.', 'error');
    return;
  }

  currentUser = { ...matchedUser };
  if (rememberChecked) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(currentUser));
  } else {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
  }
  showToast(`Selamat datang, ${currentUser.fullName}!`, 'success');
  enterDashboard();
}

function validateRegisterUsernameHint() {
  const role = document.getElementById('reg-role').value;
  const hint = document.getElementById('reg-username-hint');
  if (role === 'admin') {
    hint.textContent = 'Akun Admin wajib mengandung angka dan simbol (contoh: riski_123).';
    hint.className = 'text-[11px] text-amber-700 font-semibold mt-1';
  } else {
    hint.textContent = 'Gunakan nama santri pada username (contoh: sahal_123).';
    hint.className = 'text-[11px] text-slate-500 mt-1';
  }
}

function handleRegister(event) {
  event.preventDefault();
  const fullName = document.getElementById('reg-fullname').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const role = document.getElementById('reg-role').value;

  if (fullName.length < 2) {
    showToast('Nama lengkap minimal 2 karakter.', 'error');
    return;
  }
  if (password.length < 6) {
    showToast('Kata sandi minimal 6 karakter.', 'error');
    return;
  }
  if (role === 'admin' && (!/\d/.test(username) || !/[^a-zA-Z0-9]/.test(username))) {
    showToast('Username Admin wajib mengandung angka dan simbol (contoh: admin_01).', 'error');
    return;
  }
  if (registeredUsers.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    showToast('Username sudah digunakan. Pilih username lain.', 'error');
    return;
  }

  const newUser = { username, password, fullName, role, avatar: '', bio: '', alamat: '', noHp: '' };
  registeredUsers.push(newUser);

  if (role === 'user' && !santriDirectory.some((s) => s.toLowerCase() === fullName.toLowerCase())) {
    santriDirectory.push(fullName);
  }

  saveAppData();
  currentUser = { ...newUser };
  localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(currentUser));
  showToast('Akun berhasil dibuat!', 'success');
  enterDashboard();
}

function handleResetPassword(event) {
  event.preventDefault();
  const username = document.getElementById('reset-username').value.trim();
  const fullName = document.getElementById('reset-fullname').value.trim();
  const newPass = document.getElementById('reset-new-password').value;
  const confirmPass = document.getElementById('reset-confirm-password').value;

  const userIndex = registeredUsers.findIndex(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.fullName.toLowerCase() === fullName.toLowerCase()
  );

  if (userIndex === -1) {
    showToast('Data akun tidak cocok. Periksa kembali Username dan Nama Lengkap.', 'error');
    return;
  }
  if (newPass.length < 6) {
    showToast('Kata sandi baru minimal 6 karakter.', 'error');
    return;
  }
  if (newPass !== confirmPass) {
    showToast('Konfirmasi kata sandi tidak sama.', 'error');
    return;
  }

  registeredUsers[userIndex].password = newPass;
  saveAppData();
  document.getElementById('reset-form').reset();
  switchAuthView('login');
  document.getElementById('login-username').value = registeredUsers[userIndex].username;
  showToast('Password berhasil diperbarui! Silakan masuk.', 'success');
}

function loginDemo() {
  currentUser = { username: 'demo_admin#1', fullName: 'Pengunjung Demo', role: 'admin', isDemo: true, avatar: '' };
  localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(currentUser));
  showToast('Masuk dalam Mode Demo (Akses Penuh Cek Aplikasi).', 'info');
  enterDashboard();
}

function handleLogout() {
  closeSelfieCameraModal();
  currentUser = null;
  localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
  document.getElementById('app-wrapper').classList.add('hidden');
  document.getElementById('auth-wrapper').classList.remove('hidden');
  document.getElementById('login-form').reset();
  switchAuthView('login');
  showToast('Anda telah logout.', 'info');
}

// DASHBOARD & NAVIGATION
function updateSidebarUserBadge() {
  if (!currentUser) return;
  const isAdmin = currentUser.role === 'admin';
  renderAvatarElement(document.getElementById('sidebar-avatar'), currentUser.avatar, currentUser.fullName);
  document.getElementById('sidebar-user-name').textContent = currentUser.fullName;
  document.getElementById('sidebar-user-role').textContent = currentUser.isDemo
    ? 'Mode Demo (Admin)'
    : isAdmin ? 'Admin Bendahara' : 'Wali Santri';
  document.getElementById('mobile-role-subtitle').textContent = isAdmin ? 'Admin Bendahara' : 'Wali Santri';
}

function enterDashboard() {
  document.getElementById('auth-wrapper').classList.add('hidden');
  document.getElementById('app-wrapper').classList.remove('hidden');

  const isAdmin = currentUser.role === 'admin';
  updateSidebarUserBadge();

  document.getElementById('nav-daftar-santri').classList.toggle('hidden', !isAdmin);
  document.getElementById('nav-kelola-akun').classList.toggle('hidden', !isAdmin);
  document.getElementById('beranda-admin-actions').classList.toggle('hidden', !isAdmin);
  document.getElementById('col-aksi-header').classList.toggle('hidden', !isAdmin);

  selectedSantriFilter = isAdmin ? 'ALL' : resolveWaliSantriName(currentUser);
  navigateTo('beranda');
}

function resolveWaliSantriName(user) {
  if (!user) return '';
  const byFull = santriDirectory.find((s) => s.toLowerCase() === user.fullName.toLowerCase());
  if (byFull) return byFull;
  const baseUsername = user.username.split(/[^a-zA-Z]/)[0].toLowerCase();
  if (baseUsername) {
    const byUser = santriDirectory.find(
      (s) => s.toLowerCase().includes(baseUsername) || baseUsername.includes(s.toLowerCase())
    );
    if (byUser) return byUser;
  }
  return user.fullName;
}

function getScopedReports() {
  if (!currentUser) return [];
  if (currentUser.role === 'admin') return reportItems;
  const waliTarget = resolveWaliSantriName(currentUser).toLowerCase();
  return reportItems.filter((item) => item.nama.toLowerCase() === waliTarget);
}

function toggleMobileSidebar() {
  document.getElementById('sidebar').classList.toggle('-translate-x-full');
  document.getElementById('sidebar-backdrop').classList.toggle('hidden');
}

function navigateTo(sectionName) {
  if ((sectionName === 'daftar-santri' || sectionName === 'kelola-akun') && currentUser?.role !== 'admin') {
    sectionName = 'beranda';
  }
  activeSection = sectionName;

  document.querySelectorAll('.nav-item').forEach((btn) => btn.classList.remove('active'));
  const activeNavBtn = document.getElementById(`nav-${sectionName}`);
  if (activeNavBtn) activeNavBtn.classList.add('active');

  ['beranda', 'daftar-santri', 'hasil-laporan', 'kelola-akun', 'profil'].forEach((sec) => {
    document.getElementById(`section-${sec}`).classList.add('hidden');
  });
  document.getElementById(`section-${sectionName}`).classList.remove('hidden');

  const sidebar = document.getElementById('sidebar');
  if (!sidebar.classList.contains('-translate-x-full') && window.innerWidth < 1024) {
    toggleMobileSidebar();
  }

  if (sectionName === 'beranda') renderBeranda();
  else if (sectionName === 'daftar-santri') { backToDaftarSantriList(); renderSantriDirectory(); }
  else if (sectionName === 'hasil-laporan') renderHasilLaporanSection();
  else if (sectionName === 'kelola-akun') renderKelolaAkunList();
  else if (sectionName === 'profil') renderProfilSection();

  if (window.lucide) lucide.createIcons();
}

// BERANDA
function renderBeranda() {
  const scoped = getScopedReports();
  const isAdmin = currentUser.role === 'admin';

  document.getElementById('beranda-greeting').textContent = `Assalamu'alaikum, ${currentUser.fullName}`;
  document.getElementById('beranda-subtitle').textContent = isAdmin
    ? 'Ringkasan keseluruhan pemasukan, pengeluaran, dan saldo tabungan seluruh santri.'
    : `Pantauan perkembangan keuangan dan tabungan ananda ${resolveWaliSantriName(currentUser)}.`;

  const totalMasuk = scoped.reduce((sum, r) => sum + (Number(r.masuk) || 0), 0);
  const totalKeluar = scoped.reduce((sum, r) => sum + (Number(r.keluar) || 0), 0);

  document.getElementById('stat-total-masuk').textContent = formatRupiah(totalMasuk);
  document.getElementById('stat-total-keluar').textContent = formatRupiah(totalKeluar);
  document.getElementById('stat-sisa-saldo').textContent = formatRupiah(totalMasuk - totalKeluar);
  document.getElementById('stat-total-transaksi').textContent = scoped.length;

  const tbody = document.getElementById('beranda-recent-tbody');
  const recent = [...scoped].sort((a, b) => b.tanggal.localeCompare(a.tanggal)).slice(0, 5);

  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-400 text-sm">Belum ada catatan transaksi.</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map((item) => `
    <tr class="hover:bg-slate-50/80 transition">
      <td class="py-3.5 px-5 font-medium text-slate-600">${escapeHtml(item.tanggal)}</td>
      <td class="py-3.5 px-5 font-bold text-slate-900">${escapeHtml(item.nama)}</td>
      <td class="py-3.5 px-5 font-bold text-emerald-700">${item.masuk > 0 ? formatRupiah(item.masuk) : '-'}</td>
      <td class="py-3.5 px-5 font-bold text-rose-600">${item.keluar > 0 ? formatRupiah(item.keluar) : '-'}</td>
      <td class="py-3.5 px-5 text-slate-600">${escapeHtml(item.keterangan)}</td>
    </tr>
  `).join('');
}

// DAFTAR SANTRI
function findAccountForSantri(nama) {
  return registeredUsers.find(
    (u) => u.role === 'user' && (u.fullName.toLowerCase() === nama.toLowerCase() || u.username.toLowerCase().startsWith(nama.toLowerCase().split(' ')[0]))
  );
}

function renderSantriDirectory() {
  const grid = document.getElementById('santri-directory-grid');
  if (santriDirectory.length === 0) {
    grid.innerHTML = `<div class="col-span-full bg-white p-10 rounded-3xl border border-dashed border-slate-300 text-center"><p class="text-slate-500 font-semibold">Belum ada nama santri. Tambahkan nama santri baru di atas.</p></div>`;
    return;
  }

  grid.innerHTML = santriDirectory.map((nama, idx) => {
    const santriReports = reportItems.filter((r) => r.nama.toLowerCase() === nama.toLowerCase());
    const saldo = santriReports.reduce((s, r) => s + r.masuk - r.keluar, 0);
    const matchedAccount = findAccountForSantri(nama);
    const avatarHtml = matchedAccount?.avatar?.startsWith('data:image/')
      ? `<img src="${matchedAccount.avatar}" alt="${escapeHtml(nama)}" class="w-full h-full object-cover" />`
      : escapeHtml(nama.charAt(0).toUpperCase());
    const isChecked = selectedSantriForDelete.has(nama);
    const isMenuOpen = openSantriMenuName === nama;

    return `
      <div onclick="handleSantriCardClickByIndex(${idx})"
        class="relative bg-white p-5 rounded-3xl border ${isChecked ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20' : 'border-slate-200/90 hover:border-emerald-500'} shadow-sm hover:shadow-md transition cursor-pointer group">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            ${isSantriSelectMode
              ? `<input type="checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); toggleSelectSingleSantriByIndex(${idx})" class="w-5 h-5 rounded-md accent-rose-600 cursor-pointer shrink-0" />`
              : `<div class="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 group-hover:bg-emerald-700 group-hover:text-white font-extrabold text-base flex items-center justify-center transition shrink-0 overflow-hidden">${avatarHtml}</div>`
            }
            <div class="min-w-0">
              <h3 class="font-extrabold text-base text-slate-900 truncate group-hover:text-emerald-800 transition">${escapeHtml(nama)}</h3>
              <p class="text-xs text-slate-500 mt-0.5">${santriReports.length} catatan transaksi</p>
            </div>
          </div>
          <div class="santri-menu-wrapper relative" onclick="event.stopPropagation()">
            <button type="button" onclick="toggleSantriMenuByIndex(${idx})" class="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
              <i data-lucide="more-horizontal" class="w-5 h-5"></i>
            </button>
            ${isMenuOpen ? `
              <div class="absolute right-0 mt-1 w-40 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-20 fade-in">
                <button type="button" onclick="openSantriProfileModalByIndex(${idx})" class="w-full px-4 py-2 text-left text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2">
                  <i data-lucide="user-check" class="w-3.5 h-3.5 text-emerald-600"></i><span>Cek Profil</span>
                </button>
                <button type="button" onclick="confirmSingleDeleteSantriByIndex(${idx})" class="w-full px-4 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i><span>Hapus</span>
                </button>
              </div>` : ''}
          </div>
        </div>
        <div class="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span class="text-slate-400 font-semibold">Saldo Tabungan</span>
          <span class="font-extrabold text-emerald-700 text-sm">${formatRupiah(saldo)}</span>
        </div>
      </div>
    `;
  }).join('');
  if (window.lucide) lucide.createIcons();
}

function handleSantriCardClickByIndex(idx) {
  const nama = santriDirectory[idx];
  if (!nama) return;
  if (isSantriSelectMode) { toggleSelectSingleSantriByIndex(idx); return; }
  openTambahDataFormForSantri(nama);
}

function toggleSantriMenuByIndex(idx) {
  const nama = santriDirectory[idx];
  if (!nama) return;
  openSantriMenuName = openSantriMenuName === nama ? null : nama;
  renderSantriDirectory();
}

function addNewSantri() {
  const input = document.getElementById('new-santri-name');
  const nama = input.value.trim();
  if (!nama) { showToast('Masukkan nama santri terlebih dahulu.', 'error'); return; }
  if (santriDirectory.some((s) => s.toLowerCase() === nama.toLowerCase())) {
    showToast(`Santri atas nama "${nama}" sudah ada di daftar.`, 'error');
    return;
  }
  santriDirectory.push(nama);
  saveAppData();
  input.value = '';
  renderSantriDirectory();
  showToast(`Santri "${nama}" berhasil ditambahkan.`, 'success');
}

function toggleSantriSelectMode(forceState) {
  isSantriSelectMode = typeof forceState === 'boolean' ? forceState : !isSantriSelectMode;
  selectedSantriForDelete.clear();
  openSantriMenuName = null;
  document.getElementById('multi-delete-bar').classList.toggle('hidden', !isSantriSelectMode);
  updateSelectedSantriCount();
  renderSantriDirectory();
}

function toggleSelectSingleSantriByIndex(idx) {
  const nama = santriDirectory[idx];
  if (!nama) return;
  selectedSantriForDelete.has(nama) ? selectedSantriForDelete.delete(nama) : selectedSantriForDelete.add(nama);
  updateSelectedSantriCount();
  renderSantriDirectory();
}

function selectAllSantriForDelete() {
  if (selectedSantriForDelete.size === santriDirectory.length) selectedSantriForDelete.clear();
  else santriDirectory.forEach((n) => selectedSantriForDelete.add(n));
  updateSelectedSantriCount();
  renderSantriDirectory();
}

function updateSelectedSantriCount() {
  document.getElementById('selected-santri-count').textContent = `${selectedSantriForDelete.size} santri dipilih`;
}

function confirmBulkDeleteSantri() {
  if (selectedSantriForDelete.size === 0) { showToast('Pilih minimal satu santri.', 'error'); return; }
  const targets = Array.from(selectedSantriForDelete);
  openConfirmDeleteModal(`Hapus ${targets.length} santri terpilih beserta seluruh riwayat transaksinya?`, () => {
    const lowerSet = new Set(targets.map((n) => n.toLowerCase()));
    santriDirectory = santriDirectory.filter((n) => !lowerSet.has(n.toLowerCase()));
    reportItems = reportItems.filter((r) => !lowerSet.has(r.nama.toLowerCase()));
    saveAppData();
    toggleSantriSelectMode(false);
    showToast(`${targets.length} santri berhasil dihapus.`, 'success');
  });
}

function confirmSingleDeleteSantriByIndex(idx) {
  const nama = santriDirectory[idx];
  if (!nama) return;
  openSantriMenuName = null;
  renderSantriDirectory();
  openConfirmDeleteModal(`Hapus santri "${nama}" beserta seluruh catatan keuangannya?`, () => {
    santriDirectory = santriDirectory.filter((n) => n.toLowerCase() !== nama.toLowerCase());
    reportItems = reportItems.filter((r) => r.nama.toLowerCase() !== nama.toLowerCase());
    saveAppData();
    renderSantriDirectory();
    showToast(`Santri "${nama}" telah dihapus.`, 'success');
  });
}

function openSantriProfileModalByIndex(idx) {
  const nama = santriDirectory[idx];
  if (!nama) return;
  openSantriMenuName = null;
  renderSantriDirectory();

  const matchedAccount = findAccountForSantri(nama);
  const santriReports = reportItems.filter((r) => r.nama.toLowerCase() === nama.toLowerCase());
  const masuk = santriReports.reduce((s, r) => s + r.masuk, 0);
  const keluar = santriReports.reduce((s, r) => s + r.keluar, 0);

  renderAvatarElement(document.getElementById('profile-modal-avatar'), matchedAccount?.avatar || '', nama);
  document.getElementById('profile-modal-title').textContent = nama;
  document.getElementById('profile-modal-fullname').textContent = matchedAccount ? matchedAccount.fullName : nama;
  document.getElementById('profile-modal-username').textContent = matchedAccount ? matchedAccount.username : `${nama.toLowerCase().replace(/[^a-z0-9]/g, '_')}_santri`;
  document.getElementById('profile-modal-nohp').textContent = matchedAccount?.noHp || 'Belum diisi wali';
  document.getElementById('profile-modal-alamat').textContent = matchedAccount?.alamat || 'Belum diisi wali';
  document.getElementById('profile-modal-bio').textContent = matchedAccount?.bio || 'Belum diisi wali';
  document.getElementById('profile-modal-masuk').textContent = formatRupiah(masuk);
  document.getElementById('profile-modal-keluar').textContent = formatRupiah(keluar);
  document.getElementById('profile-modal-saldo').textContent = formatRupiah(masuk - keluar);

  const modal = document.getElementById('santri-profile-modal');
  modal.classList.remove('hidden');
  modal.classList.add('modal-open');
  if (window.lucide) lucide.createIcons();
}

function closeSantriProfileModal() {
  const modal = document.getElementById('santri-profile-modal');
  modal.classList.add('hidden');
  modal.classList.remove('modal-open');
}

function resetLaporanFormFields() {
  const form = document.getElementById('laporan-form');
  if (form) form.reset();
  document.getElementById('edit-record-id').value = '';
  document.getElementById('input-tanggal').value = new Date().toISOString().split('T')[0];
  document.getElementById('input-masuk').value = '';
  document.getElementById('input-keluar').value = '';
  document.getElementById('input-keterangan').value = '';
  const jumlahEl = document.getElementById('input-jumlah');
  jumlahEl.value = '';
  jumlahEl.className = 'w-full px-4 py-3 rounded-xl border-2 border-emerald-200 bg-emerald-50/60 text-emerald-900 font-extrabold text-base cursor-not-allowed';
  document.getElementById('kalkulator-formula-hint').textContent = '';
}

function openTambahDataFormForSantri(nama) {
  activeFormSantriName = nama;
  activeFormBaseSaldo = getSantriSaldo(nama);
  resetLaporanFormFields();
  document.getElementById('daftar-santri-list-view').classList.add('hidden');
  document.getElementById('daftar-santri-form-view').classList.remove('hidden');
  document.getElementById('form-santri-heading').textContent = `Tambah Data: ${nama}`;
  document.getElementById('form-saldo-awal-badge').textContent = formatRupiah(activeFormBaseSaldo);
  if (window.lucide) lucide.createIcons();
}

function backToDaftarSantriList() {
  activeFormSantriName = '';
  activeFormBaseSaldo = 0;
  resetLaporanFormFields();
  document.getElementById('daftar-santri-form-view').classList.add('hidden');
  document.getElementById('daftar-santri-list-view').classList.remove('hidden');
  renderSantriDirectory();
}

function handleNominalInput(inputEl) {
  const numeric = parseFormattedNumber(inputEl.value);
  inputEl.value = numeric > 0 ? formatNumberDots(numeric) : '';

  const masukVal = parseFormattedNumber(document.getElementById('input-masuk').value);
  const keluarVal = parseFormattedNumber(document.getElementById('input-keluar').value);
  const jumlahInput = document.getElementById('input-jumlah');
  const formulaHint = document.getElementById('kalkulator-formula-hint');

  if (masukVal === 0 && keluarVal === 0) {
    jumlahInput.value = '';
    formulaHint.textContent = '';
    return;
  }

  const hasilSaldo = activeFormBaseSaldo + masukVal - keluarVal;
  jumlahInput.value = formatNumberDots(hasilSaldo);
  jumlahInput.className = hasilSaldo < 0
    ? 'w-full px-4 py-3 rounded-xl border-2 border-rose-300 bg-rose-50 text-rose-700 font-extrabold text-base cursor-not-allowed'
    : 'w-full px-4 py-3 rounded-xl border-2 border-emerald-200 bg-emerald-50/60 text-emerald-900 font-extrabold text-base cursor-not-allowed';
  formulaHint.textContent = `${formatNumberDots(activeFormBaseSaldo)} + ${formatNumberDots(masukVal)} - ${formatNumberDots(keluarVal)} = ${formatNumberDots(hasilSaldo)}`;
}

function handleSaveLaporan(event) {
  event.preventDefault();
  if (!activeFormSantriName) return;

  const tanggal = document.getElementById('input-tanggal').value;
  const masuk = parseFormattedNumber(document.getElementById('input-masuk').value);
  const keluar = parseFormattedNumber(document.getElementById('input-keluar').value);
  const keterangan = document.getElementById('input-keterangan').value.trim();

  if (masuk === 0 && keluar === 0) { showToast('Isi nominal Masuk atau Keluar terlebih dahulu.', 'error'); return; }
  if ((masuk > 0 && masuk < 5000) || (keluar > 0 && keluar < 5000)) { showToast('Nominal transaksi minimal Rp 5.000.', 'error'); return; }

  const savedSantriName = activeFormSantriName;
  const saldoAkhir = activeFormBaseSaldo + masuk - keluar;

  reportItems.unshift({ id: 'rep-' + Date.now(), tanggal, nama: savedSantriName, masuk, keluar, jumlah: saldoAkhir, keterangan });
  saveAppData();
  resetLaporanFormFields();
  backToDaftarSantriList();
  showToast(`Data transaksi ${savedSantriName} disimpan! Saldo akhir: ${formatRupiah(saldoAkhir)}`, 'success');
}

// HASIL LAPORAN
function renderHasilLaporanSection() {
  const isAdmin = currentUser.role === 'admin';
  const pillsContainer = document.getElementById('hasil-laporan-santri-pills');
  if (!isAdmin) selectedSantriFilter = resolveWaliSantriName(currentUser);

  let pillsHtml = '';
  if (isAdmin) {
    const isAllActive = selectedSantriFilter === 'ALL';
    pillsHtml += `<button type="button" onclick="selectLaporanSantriFilter('ALL')" class="px-4 py-2 rounded-xl text-xs font-extrabold border transition ${isAllActive ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'}">Semua Santri (${reportItems.length})</button>`;
  }

  const displayedSantriList = isAdmin ? santriDirectory : [resolveWaliSantriName(currentUser)];
  displayedSantriList.forEach((nama, idx) => {
    const count = reportItems.filter((r) => r.nama.toLowerCase() === nama.toLowerCase()).length;
    const isActive = selectedSantriFilter.toLowerCase() === nama.toLowerCase();
    pillsHtml += `<button type="button" onclick="selectLaporanSantriFilterByIndex(${idx})" class="px-4 py-2 rounded-xl text-xs font-extrabold border transition ${isActive ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'}">${escapeHtml(nama)} (${count})</button>`;
  });

  pillsContainer.innerHTML = pillsHtml;
  renderHasilLaporanTable();
}

function selectLaporanSantriFilter(nama) {
  if (currentUser.role !== 'admin') return;
  selectedSantriFilter = nama;
  renderHasilLaporanSection();
}

function selectLaporanSantriFilterByIndex(idx) {
  if (currentUser.role !== 'admin') return;
  const nama = santriDirectory[idx];
  if (!nama) return;
  selectedSantriFilter = nama;
  renderHasilLaporanSection();
}

function getFilteredLaporanRows() {
  const scoped = getScopedReports();
  const searchQuery = (document.getElementById('laporan-search-input')?.value || '').toLowerCase().trim();
  return scoped.filter((item) => {
    const matchSantri = selectedSantriFilter === 'ALL' || item.nama.toLowerCase() === selectedSantriFilter.toLowerCase();
    const matchSearch = !searchQuery || item.nama.toLowerCase().includes(searchQuery) || item.tanggal.toLowerCase().includes(searchQuery) || item.keterangan.toLowerCase().includes(searchQuery);
    return matchSantri && matchSearch;
  });
}

function renderHasilLaporanTable() {
  const rows = getFilteredLaporanRows();
  const isAdmin = currentUser.role === 'admin';

  document.getElementById('active-filter-label').textContent = selectedSantriFilter === 'ALL' ? 'Menampilkan: Semua Santri' : `Menampilkan: ${selectedSantriFilter}`;
  const totalMasuk = rows.reduce((s, r) => s + r.masuk, 0);
  const totalKeluar = rows.reduce((s, r) => s + r.keluar, 0);

  document.getElementById('filtered-masuk').textContent = formatRupiah(totalMasuk);
  document.getElementById('filtered-keluar').textContent = formatRupiah(totalKeluar);
  document.getElementById('filtered-saldo').textContent = formatRupiah(totalMasuk - totalKeluar);

  const tbody = document.getElementById('hasil-laporan-tbody');
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${isAdmin ? 8 : 7}" class="py-10 text-center text-slate-400 text-sm">Tidak ada data laporan yang ditemukan.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((item, idx) => `
    <tr class="hover:bg-slate-50/90 transition">
      <td class="py-3.5 px-4 font-semibold text-slate-500">${idx + 1}</td>
      <td class="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">${escapeHtml(item.tanggal)}</td>
      <td class="py-3.5 px-4 font-bold text-slate-900">${escapeHtml(item.nama)}</td>
      <td class="py-3.5 px-4 font-bold text-emerald-700 whitespace-nowrap">${item.masuk > 0 ? formatRupiah(item.masuk) : '-'}</td>
      <td class="py-3.5 px-4 font-bold text-rose-600 whitespace-nowrap">${item.keluar > 0 ? formatRupiah(item.keluar) : '-'}</td>
      <td class="py-3.5 px-4 font-extrabold text-slate-800 whitespace-nowrap">${formatRupiah(item.jumlah)}</td>
      <td class="py-3.5 px-4 text-slate-600">${escapeHtml(item.keterangan)}</td>
      ${isAdmin ? `
        <td class="py-3.5 px-4 text-center whitespace-nowrap">
          <div class="inline-flex items-center gap-1.5">
            <button type="button" onclick="openEditRecordModal('${escapeHtml(item.id)}')" class="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition"><i data-lucide="pencil" class="w-4 h-4"></i></button>
            <button type="button" onclick="confirmDeleteRecord('${escapeHtml(item.id)}')" class="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
          </div>
        </td>` : ''}
    </tr>
  `).join('');
  if (window.lucide) lucide.createIcons();
}

// KELOLA AKUN (BUATKAN AKUN WALI SANTRI & BAGIKAN USERNAME + PASSWORD)
function handleAdminCreateUser(event) {
  event.preventDefault();
  const fullName = document.getElementById('admin-new-fullname').value.trim();
  const username = document.getElementById('admin-new-username').value.trim();
  const password = document.getElementById('admin-new-password').value;

  if (fullName.length < 2) { showToast('Nama lengkap minimal 2 karakter.', 'error'); return; }
  if (password.length < 6) { showToast('Kata sandi minimal 6 karakter.', 'error'); return; }
  if (registeredUsers.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    showToast('Username sudah terdaftar. Gunakan username lain.', 'error');
    return;
  }

  registeredUsers.push({ username, password, fullName, role: 'user', avatar: '', bio: '', alamat: '', noHp: '' });
  if (!santriDirectory.some((s) => s.toLowerCase() === fullName.toLowerCase())) {
    santriDirectory.push(fullName);
  }

  saveAppData();
  document.getElementById('admin-create-user-form').reset();
  renderKelolaAkunList();
  showToast(`Akun Wali Santri "${username}" berhasil dibuat! Silakan bagikan Username & Kata Sandi ke Wali Santri.`, 'success');
}

function renderKelolaAkunList() {
  const container = document.getElementById('kelola-akun-users-list');
  if (!container) return;

  const waliUsers = registeredUsers.filter((u) => u.role === 'user');
  if (waliUsers.length === 0) {
    container.innerHTML = `<div class="p-8 rounded-2xl border border-dashed border-slate-200 text-center text-xs sm:text-sm text-slate-400">Belum ada akun Wali Santri yang dibuat.</div>`;
    return;
  }

  container.innerHTML = waliUsers.map((u, idx) => `
    <div class="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-extrabold text-sm text-slate-900 truncate">${escapeHtml(u.fullName)}</span>
          <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Wali Santri</span>
        </div>
        <p class="text-xs text-slate-500 mt-1">
          Username: <span class="font-bold text-slate-700">${escapeHtml(u.username)}</span> &bull;
          Kata Sandi: <span class="font-bold text-slate-700">${escapeHtml(u.password)}</span>
        </p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button type="button" onclick="copyWaliCredentials(${idx})" class="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs">
          <i data-lucide="copy" class="w-3.5 h-3.5"></i><span>Salin Akun</span>
        </button>
        <button type="button" onclick="confirmDeleteWaliAccount(${idx})" class="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition" title="Hapus Akun">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `).join('');
  if (window.lucide) lucide.createIcons();
}

function copyWaliCredentials(waliIdx) {
  const waliUsers = registeredUsers.filter((u) => u.role === 'user');
  const target = waliUsers[waliIdx];
  if (!target) return;

  const credentialText = `Assalamu'alaikum Wali Santri ${target.fullName}.\nBerikut akun login aplikasi Alfatih - Bendahara:\nUsername: ${target.username}\nKata Sandi: ${target.password}`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(credentialText).then(() => {
      showToast(`Username & Kata Sandi milik ${target.fullName} berhasil disalin!`, 'success');
    });
  } else {
    prompt('Salin Username & Kata Sandi berikut untuk Wali Santri:', credentialText);
  }
}

function confirmDeleteWaliAccount(waliIdx) {
  const waliUsers = registeredUsers.filter((u) => u.role === 'user');
  const target = waliUsers[waliIdx];
  if (!target) return;

  openConfirmDeleteModal(`Hapus akun login milik "${target.fullName}" (@${target.username})?`, () => {
    registeredUsers = registeredUsers.filter((u) => u.username.toLowerCase() !== target.username.toLowerCase());
    saveAppData();
    renderKelolaAkunList();
    showToast(`Akun "${target.username}" telah dihapus.`, 'success');
  });
}

// PROFIL SAYA
function renderProfilSection() {
  if (!currentUser) return;
  const isAdmin = currentUser.role === 'admin';
  pendingAvatarDataUrl = currentUser.avatar || '';
  updateProfileAvatarPreview();

  document.getElementById('profil-display-name').textContent = currentUser.fullName;
  document.getElementById('profil-display-username').textContent = `@${currentUser.username}`;

  document.getElementById('profil-section-subtitle').textContent = isAdmin
    ? 'Atur foto profil (PP) akun Admin Bendahara Anda.'
    : 'Lengkapi foto profil, bio, alamat, dan nomor HP agar dapat dilihat oleh Admin.';
  document.getElementById('wali-profile-fields').classList.toggle('hidden', isAdmin);
  document.getElementById('admin-profile-note').classList.toggle('hidden', !isAdmin);
  document.getElementById('profil-save-btn-wrapper').classList.toggle('hidden', isAdmin);

  if (!isAdmin) {
    document.getElementById('profil-bio').value = currentUser.bio || '';
    document.getElementById('profil-alamat').value = currentUser.alamat || '';
    document.getElementById('profil-nohp').value = currentUser.noHp || '';
  }
  if (window.lucide) lucide.createIcons();
}

function updateProfileAvatarPreview() {
  renderAvatarElement(document.getElementById('profil-avatar-preview'), pendingAvatarDataUrl, currentUser?.fullName || 'U');
  document.getElementById('btn-remove-avatar').classList.toggle('hidden', !(pendingAvatarDataUrl && pendingAvatarDataUrl.startsWith('data:image/')));
}

function triggerAlbumUpload() {
  const input = document.getElementById('profil-file-album');
  if (input) { input.value = ''; input.click(); }
}

function handleProfileImageFileChange(event) {
  const file = event.target.files?.[0];
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 320;
      let w = img.width, h = img.height;
      if (w > h && w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
      else if (h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      applyNewProfileAvatar(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function applyNewProfileAvatar(dataUrl) {
  pendingAvatarDataUrl = dataUrl;
  updateProfileAvatarPreview();
  if (currentUser) {
    currentUser.avatar = dataUrl;
    syncCurrentUserToStorage();
    updateSidebarUserBadge();
    showToast('Foto profil berhasil diperbarui!', 'success');
  }
}

function removeProfileAvatar() {
  pendingAvatarDataUrl = '';
  updateProfileAvatarPreview();
  if (currentUser) {
    currentUser.avatar = '';
    syncCurrentUserToStorage();
    updateSidebarUserBadge();
    showToast('Foto profil dihapus.', 'info');
  }
}

function syncCurrentUserToStorage() {
  if (!currentUser) return;
  const idx = registeredUsers.findIndex((u) => u.username.toLowerCase() === currentUser.username.toLowerCase());
  if (idx !== -1) { registeredUsers[idx] = { ...registeredUsers[idx], ...currentUser }; saveAppData(); }
  if (localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION)) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(currentUser));
  }
}

function handleSaveProfile(event) {
  event.preventDefault();
  if (!currentUser) return;
  if (currentUser.role !== 'admin') {
    currentUser.bio = document.getElementById('profil-bio').value.trim();
    currentUser.alamat = document.getElementById('profil-alamat').value.trim();
    currentUser.noHp = document.getElementById('profil-nohp').value.trim();
  }
  currentUser.avatar = pendingAvatarDataUrl;
  syncCurrentUserToStorage();
  updateSidebarUserBadge();
  showToast('Profil berhasil disimpan!', 'success');
}

async function openSelfieCameraModal() {
  const modal = document.getElementById('selfie-camera-modal');
  const video = document.getElementById('selfie-video');
  if (!navigator.mediaDevices?.getUserMedia) {
    const camInput = document.getElementById('profil-file-camera');
    if (camInput) { camInput.value = ''; camInput.click(); }
    return;
  }
  try {
    selfieStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }, audio: false });
    video.srcObject = selfieStream;
    modal.classList.remove('hidden');
    modal.classList.add('modal-open');
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    const camInput = document.getElementById('profil-file-camera');
    if (camInput) { camInput.value = ''; camInput.click(); }
  }
}

function closeSelfieCameraModal() {
  if (selfieStream) { selfieStream.getTracks().forEach((t) => t.stop()); selfieStream = null; }
  const video = document.getElementById('selfie-video');
  if (video) video.srcObject = null;
  const modal = document.getElementById('selfie-camera-modal');
  if (modal) { modal.classList.add('hidden'); modal.classList.remove('modal-open'); }
}

function captureSelfieSnapshot() {
  const video = document.getElementById('selfie-video');
  const canvas = document.getElementById('selfie-canvas');
  if (!video || !canvas || !video.videoWidth) return;
  const size = Math.min(video.videoWidth, video.videoHeight);
  canvas.width = 320; canvas.height = 320;
  const ctx = canvas.getContext('2d');
  ctx.translate(320, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, (video.videoWidth - size) / 2, (video.videoHeight - size) / 2, size, size, 0, 0, 320, 320);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  closeSelfieCameraModal();
  applyNewProfileAvatar(dataUrl);
}

// EDIT & DELETE RECORD
function openEditRecordModal(id) {
  const item = reportItems.find((r) => r.id === id);
  if (!item) return;
  modalEditBaseSaldo = getSantriSaldo(item.nama, item.id);
  document.getElementById('modal-edit-id').value = item.id;
  document.getElementById('modal-edit-nama').value = item.nama;
  document.getElementById('modal-edit-tanggal').value = item.tanggal;
  document.getElementById('modal-edit-masuk').value = item.masuk > 0 ? formatNumberDots(item.masuk) : '';
  document.getElementById('modal-edit-keluar').value = item.keluar > 0 ? formatNumberDots(item.keluar) : '';
  document.getElementById('modal-edit-jumlah').value = formatNumberDots(modalEditBaseSaldo + (Number(item.masuk) || 0) - (Number(item.keluar) || 0));
  document.getElementById('modal-edit-keterangan').value = item.keterangan;

  const modal = document.getElementById('edit-record-modal');
  modal.classList.remove('hidden');
  modal.classList.add('modal-open');
}

function closeEditRecordModal() {
  const modal = document.getElementById('edit-record-modal');
  modal.classList.add('hidden');
  modal.classList.remove('modal-open');
}

function handleModalNominalInput(inputEl) {
  const numeric = parseFormattedNumber(inputEl.value);
  inputEl.value = numeric > 0 ? formatNumberDots(numeric) : '';
  const m = parseFormattedNumber(document.getElementById('modal-edit-masuk').value);
  const k = parseFormattedNumber(document.getElementById('modal-edit-keluar').value);
  document.getElementById('modal-edit-jumlah').value = formatNumberDots(modalEditBaseSaldo + m - k);
}

function handleUpdateRecord(event) {
  event.preventDefault();
  const id = document.getElementById('modal-edit-id').value;
  const idx = reportItems.findIndex((r) => r.id === id);
  if (idx === -1) return;

  const tanggal = document.getElementById('modal-edit-tanggal').value;
  const masuk = parseFormattedNumber(document.getElementById('modal-edit-masuk').value);
  const keluar = parseFormattedNumber(document.getElementById('modal-edit-keluar').value);
  const keterangan = document.getElementById('modal-edit-keterangan').value.trim();

  if (masuk === 0 && keluar === 0) { showToast('Nominal Masuk atau Keluar tidak boleh kosong semua.', 'error'); return; }
  if ((masuk > 0 && masuk < 5000) || (keluar > 0 && keluar < 5000)) { showToast('Nominal minimal Rp 5.000.', 'error'); return; }

  reportItems[idx] = { ...reportItems[idx], tanggal, masuk, keluar, jumlah: modalEditBaseSaldo + masuk - keluar, keterangan };
  saveAppData();
  closeEditRecordModal();
  renderHasilLaporanSection();
  showToast('Catatan transaksi berhasil diperbarui.', 'success');
}

function confirmDeleteRecord(id) {
  openConfirmDeleteModal('Apakah Anda yakin ingin menghapus catatan transaksi ini?', () => {
    reportItems = reportItems.filter((r) => r.id !== id);
    saveAppData();
    renderHasilLaporanSection();
    showToast('Catatan transaksi dihapus.', 'success');
  });
}

function openConfirmDeleteModal(message, onConfirmCallback) {
  document.getElementById('confirm-delete-message').textContent = message;
  const modal = document.getElementById('confirm-delete-modal');
  modal.classList.remove('hidden');
  modal.classList.add('modal-open');
  document.getElementById('btn-confirm-delete-yes').onclick = () => {
    closeConfirmDeleteModal();
    onConfirmCallback();
  };
}

function closeConfirmDeleteModal() {
  const modal = document.getElementById('confirm-delete-modal');
  modal.classList.add('hidden');
  modal.classList.remove('modal-open');
}

// EXPORT EXCEL & PDF
function getExportFilename(extension) {
  if (currentUser && currentUser.role !== 'admin') {
    return `${currentUser.fullName.trim().replace(/[\\/:*?"<>|]/g, '_')}.${extension}`;
  }
  const suffix = selectedSantriFilter === 'ALL' ? 'Semua_Santri' : selectedSantriFilter.replace(/[\\/:*?"<>|]/g, '_');
  return `Alfatih_Bendahara_${suffix}.${extension}`;
}

function exportToExcel() {
  const rows = getFilteredLaporanRows();
  if (rows.length === 0) { showToast('Tidak ada data untuk diekspor ke Excel.', 'error'); return; }
  const sheetData = rows.map((r, i) => ({
    No: i + 1, Tanggal: r.tanggal, 'Nama Santri': r.nama, 'Masuk (Rp)': r.masuk, 'Keluar (Rp)': r.keluar, 'Jumlah / Saldo (Rp)': r.jumlah, Keterangan: r.keterangan
  }));
  const worksheet = XLSX.utils.json_to_sheet(sheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Santri');
  XLSX.writeFile(workbook, getExportFilename('xlsx'));
  showToast('File Excel berhasil diunduh.', 'success');
}

function exportToPDF() {
  const rows = getFilteredLaporanRows();
  if (rows.length === 0) { showToast('Tidak ada data untuk diekspor ke PDF.', 'error'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(6, 95, 70);
  doc.text('Alfatih - Bendahara', pageWidth / 2, 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(selectedSantriFilter === 'ALL' ? 'Laporan Keuangan & Tabungan Seluruh Santri' : `Laporan Keuangan & Tabungan Santri: ${selectedSantriFilter}`, pageWidth / 2, 24, { align: 'center' });

  doc.setDrawColor(200, 200, 200);
  doc.line(14, 28, pageWidth - 14, 28);

  const totalMasuk = rows.reduce((s, r) => s + r.masuk, 0);
  const totalKeluar = rows.reduce((s, r) => s + r.keluar, 0);

  doc.autoTable({
    startY: 33,
    head: [['No', 'Tanggal', 'Nama Santri', 'Masuk', 'Keluar', 'Jumlah', 'Keterangan']],
    body: rows.map((r, i) => [i + 1, r.tanggal, r.nama, r.masuk > 0 ? formatRupiah(r.masuk) : '-', r.keluar > 0 ? formatRupiah(r.keluar) : '-', formatRupiah(r.jumlah), r.keterangan]),
    theme: 'grid',
    headStyles: { fillColor: [6, 95, 70], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 8.5, cellPadding: 2.8 },
    foot: [['', '', 'TOTAL', formatRupiah(totalMasuk), formatRupiah(totalKeluar), `Saldo: ${formatRupiah(totalMasuk - totalKeluar)}`, '']],
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 9 }
  });

  const finalY = doc.lastAutoTable.finalY || 120;
  let signY = finalY + 18;
  if (signY + 30 > doc.internal.pageSize.getHeight()) { doc.addPage(); signY = 30; }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('Mengetahui,', pageWidth / 2, signY, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('Muhammad Galih Assyafi', pageWidth / 2, signY + 22, { align: 'center' });

  doc.save(getExportFilename('pdf'));
  showToast('File PDF berhasil diunduh.', 'success');
}
