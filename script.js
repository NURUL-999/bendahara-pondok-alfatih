/* ==========================================================================
   Alfatih - Bendahara | Application Logic
   ========================================================================== */

// 1. INITIAL DATA & LOCAL STORAGE KEYS
const STORAGE_KEYS = {
  USERS: 'alfatih_bendahara_users_v3',
  SANTRI: 'alfatih_bendahara_santri_v3',
  REPORTS: 'alfatih_bendahara_reports_v3',
  SESSION: 'alfatih_bendahara_session_v3'
};

const DEFAULT_USERS = [
  { username: 'riski_123', password: 'password123', fullName: 'Riski', role: 'admin' }
];

const DEFAULT_SANTRI = [];

const DEFAULT_REPORTS = [];

// Global State
let registeredUsers = [];
let santriDirectory = [];
let reportItems = [];
let currentUser = null;

let activeSection = 'beranda';
let selectedSantriFilter = 'ALL';
let activeFormSantriName = '';
let isSantriSelectMode = false;
let selectedSantriForDelete = new Set();
let openSantriMenuName = null;

// Safe HTML & Attribute Escaping
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 2. INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  loadAppData();
  if (window.lucide) {
    lucide.createIcons();
  }

  // Close open three-dot dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.santri-menu-wrapper')) {
      if (openSantriMenuName !== null) {
        openSantriMenuName = null;
        renderSantriDirectory();
      }
    }
  });

  // Restore session if available
  const savedSession = sessionStorage.getItem(STORAGE_KEYS.SESSION);
  if (savedSession) {
    try {
      currentUser = JSON.parse(savedSession);
      enterDashboard();
    } catch (err) {
      sessionStorage.removeItem(STORAGE_KEYS.SESSION);
    }
  }
});

function loadAppData() {
  try {
    const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
    const storedSantri = localStorage.getItem(STORAGE_KEYS.SANTRI);
    const storedReports = localStorage.getItem(STORAGE_KEYS.REPORTS);

    registeredUsers = storedUsers ? JSON.parse(storedUsers) : [...DEFAULT_USERS];
    santriDirectory = storedSantri ? JSON.parse(storedSantri) : [...DEFAULT_SANTRI];
    reportItems = storedReports ? JSON.parse(storedReports) : [...DEFAULT_REPORTS];
    saveAppData();
  } catch (e) {
    registeredUsers = [...DEFAULT_USERS];
    santriDirectory = [...DEFAULT_SANTRI];
    reportItems = [...DEFAULT_REPORTS];
  }
}

function saveAppData() {
  try {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(registeredUsers));
    localStorage.setItem(STORAGE_KEYS.SANTRI, JSON.stringify(santriDirectory));
    localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reportItems));
  } catch (e) {
    console.warn('LocalStorage tidak tersedia:', e);
  }
}

// 3. HELPER FORMATTING & TOASTS
function formatRupiah(num) {
  const value = Number(num) || 0;
  return 'Rp ' + value.toLocaleString('id-ID');
}

function formatNumberDots(num) {
  const value = Number(num) || 0;
  return value.toLocaleString('id-ID');
}

function parseFormattedNumber(str) {
  if (!str) return 0;
  const cleaned = String(str).replace(/[^\d]/g, '');
  return parseInt(cleaned, 10) || 0;
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

// 4. AUTHENTICATION (LOGIN, CREATE ACCOUNT, RESET PASSWORD, DEMO)
function switchAuthView(viewName) {
  document.getElementById('view-login').classList.add('hidden');
  document.getElementById('view-register').classList.add('hidden');
  document.getElementById('view-reset').classList.add('hidden');

  document.getElementById(`view-${viewName}`).classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function handleLogin(event) {
  event.preventDefault();
  const usernameInput = document.getElementById('login-username').value.trim();
  const passwordInput = document.getElementById('login-password').value;

  if (!usernameInput) {
    showToast('Silakan isi username terlebih dahulu.', 'error');
    return;
  }

  const matchedUser = registeredUsers.find(
    (u) => u.username.toLowerCase() === usernameInput.toLowerCase()
  );

  // Jika belum terdaftar, arahkan ke halaman Create Account
  if (!matchedUser) {
    showToast('Akun belum terdaftar! Silakan buat akun terlebih dahulu.', 'error');
    switchAuthView('register');
    document.getElementById('reg-username').value = usernameInput.toLowerCase().replace(/\s+/g, '_');
    document.getElementById('reg-fullname').focus();
    return;
  }

  if (matchedUser.password !== passwordInput) {
    showToast('Kata sandi salah. Silakan coba lagi atau gunakan Reset Password.', 'error');
    return;
  }

  currentUser = { ...matchedUser };
  sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(currentUser));
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

  if (role === 'admin') {
    const hasNumber = /\d/.test(username);
    const hasSymbol = /[^a-zA-Z0-9]/.test(username);
    if (!hasNumber || !hasSymbol) {
      showToast('Username Admin wajib mengandung angka dan simbol (contoh: admin_01).', 'error');
      return;
    }
  }

  const exists = registeredUsers.some(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );
  if (exists) {
    showToast('Username sudah digunakan. Pilih username lain.', 'error');
    return;
  }

  const newUser = { username, password, fullName, role };
  registeredUsers.push(newUser);

  if (role === 'user') {
    const alreadyInSantri = santriDirectory.some(
      (s) => s.toLowerCase() === fullName.toLowerCase()
    );
    if (!alreadyInSantri) {
      santriDirectory.push(fullName);
    }
  }

  saveAppData();

  currentUser = { ...newUser };
  sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(currentUser));
  showToast('Akun berhasil dibuat! Mengarahkan ke aplikasi...', 'success');
  enterDashboard();
}

function handleResetPassword(event) {
  event.preventDefault();
  const username = document.getElementById('reset-username').value.trim();
  const fullName = document.getElementById('reset-fullname').value.trim();
  const newPass = document.getElementById('reset-new-password').value;
  const confirmPass = document.getElementById('reset-confirm-password').value;

  const userIndex = registeredUsers.findIndex(
    (u) =>
      u.username.toLowerCase() === username.toLowerCase() &&
      u.fullName.toLowerCase() === fullName.toLowerCase()
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
  document.getElementById('login-password').value = '';
  showToast('Password berhasil diperbarui! Silakan masuk.', 'success');
}

function loginDemo() {
  currentUser = {
    username: 'demo_admin#1',
    fullName: 'Pengunjung Demo',
    role: 'admin',
    isDemo: true
  };
  sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(currentUser));
  showToast('Masuk dalam Mode Demo (Akses Penuh Cek Aplikasi).', 'info');
  enterDashboard();
}

function handleLogout() {
  currentUser = null;
  sessionStorage.removeItem(STORAGE_KEYS.SESSION);
  document.getElementById('app-wrapper').classList.add('hidden');
  document.getElementById('auth-wrapper').classList.remove('hidden');
  document.getElementById('login-form').reset();
  switchAuthView('login');
  showToast('Anda telah keluar dari aplikasi.', 'info');
}

// 5. DASHBOARD & ROLE ACCESS CONTROL
function enterDashboard() {
  document.getElementById('auth-wrapper').classList.add('hidden');
  document.getElementById('app-wrapper').classList.remove('hidden');

  const isAdmin = currentUser.role === 'admin';

  document.getElementById('sidebar-avatar').textContent = currentUser.fullName.charAt(0).toUpperCase();
  document.getElementById('sidebar-user-name').textContent = currentUser.fullName;
  document.getElementById('sidebar-user-role').textContent = currentUser.isDemo
    ? 'Mode Demo (Admin)'
    : isAdmin
    ? 'Admin Bendahara'
    : 'Wali Santri';
  document.getElementById('mobile-role-subtitle').textContent = isAdmin ? 'Admin Bendahara' : 'Wali Santri';

  const navDaftarSantri = document.getElementById('nav-daftar-santri');
  const navKelolaAkun = document.getElementById('nav-kelola-akun');
  const berandaAdminActions = document.getElementById('beranda-admin-actions');
  const colAksiHeader = document.getElementById('col-aksi-header');

  if (isAdmin) {
    navDaftarSantri.classList.remove('hidden');
    navKelolaAkun.classList.remove('hidden');
    berandaAdminActions.classList.remove('hidden');
    colAksiHeader.classList.remove('hidden');
    selectedSantriFilter = 'ALL';
  } else {
    navDaftarSantri.classList.add('hidden');
    navKelolaAkun.classList.add('hidden');
    berandaAdminActions.classList.add('hidden');
    colAksiHeader.classList.add('hidden');
    selectedSantriFilter = resolveWaliSantriName(currentUser);
  }

  navigateTo('beranda');
}

function resolveWaliSantriName(user) {
  if (!user) return '';
  const byFull = santriDirectory.find(
    (s) => s.toLowerCase() === user.fullName.toLowerCase()
  );
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
  if (currentUser.role === 'admin') {
    return reportItems;
  }
  const waliTarget = resolveWaliSantriName(currentUser).toLowerCase();
  return reportItems.filter((item) => item.nama.toLowerCase() === waliTarget);
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  sidebar.classList.toggle('-translate-x-full');
  backdrop.classList.toggle('hidden');
}

function navigateTo(sectionName) {
  if ((sectionName === 'daftar-santri' || sectionName === 'kelola-akun') && currentUser?.role !== 'admin') {
    sectionName = 'beranda';
  }

  activeSection = sectionName;

  document.querySelectorAll('.nav-item').forEach((btn) => btn.classList.remove('active'));
  const activeNavBtn = document.getElementById(`nav-${sectionName}`);
  if (activeNavBtn) activeNavBtn.classList.add('active');

  document.getElementById('section-beranda').classList.add('hidden');
  document.getElementById('section-daftar-santri').classList.add('hidden');
  document.getElementById('section-hasil-laporan').classList.add('hidden');
  document.getElementById('section-kelola-akun').classList.add('hidden');

  document.getElementById(`section-${sectionName}`).classList.remove('hidden');

  const sidebar = document.getElementById('sidebar');
  if (!sidebar.classList.contains('-translate-x-full') && window.innerWidth < 1024) {
    toggleMobileSidebar();
  }

  if (sectionName === 'beranda') {
    renderBeranda();
  } else if (sectionName === 'daftar-santri') {
    backToDaftarSantriList();
    renderSantriDirectory();
  } else if (sectionName === 'hasil-laporan') {
    renderHasilLaporanSection();
  }

  if (window.lucide) lucide.createIcons();
}

// 6. BERANDA RENDERING
function renderBeranda() {
  const scoped = getScopedReports();
  const isAdmin = currentUser.role === 'admin';

  document.getElementById('beranda-greeting').textContent = `Assalamu'alaikum, ${currentUser.fullName}`;
  document.getElementById('beranda-subtitle').textContent = isAdmin
    ? 'Ringkasan keseluruhan pemasukan, pengeluaran, dan saldo tabungan seluruh santri.'
    : `Pantauan perkembangan keuangan dan tabungan ananda ${resolveWaliSantriName(currentUser)}.`;

  const totalMasuk = scoped.reduce((sum, r) => sum + (Number(r.masuk) || 0), 0);
  const totalKeluar = scoped.reduce((sum, r) => sum + (Number(r.keluar) || 0), 0);
  const saldo = totalMasuk - totalKeluar;

  document.getElementById('stat-total-masuk').textContent = formatRupiah(totalMasuk);
  document.getElementById('stat-total-keluar').textContent = formatRupiah(totalKeluar);
  document.getElementById('stat-sisa-saldo').textContent = formatRupiah(saldo);
  document.getElementById('stat-total-transaksi').textContent = scoped.length;

  const tbody = document.getElementById('beranda-recent-tbody');
  const recent = [...scoped].sort((a, b) => b.tanggal.localeCompare(a.tanggal)).slice(0, 5);

  if (recent.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-slate-400 text-sm">Belum ada catatan transaksi.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = recent
    .map(
      (item) => `
      <tr class="hover:bg-slate-50/80 transition">
        <td class="py-3.5 px-5 font-medium text-slate-600">${escapeHtml(item.tanggal)}</td>
        <td class="py-3.5 px-5 font-bold text-slate-900">${escapeHtml(item.nama)}</td>
        <td class="py-3.5 px-5 font-bold text-emerald-700">${item.masuk > 0 ? formatRupiah(item.masuk) : '-'}</td>
        <td class="py-3.5 px-5 font-bold text-rose-600">${item.keluar > 0 ? formatRupiah(item.keluar) : '-'}</td>
        <td class="py-3.5 px-5 text-slate-600">${escapeHtml(item.keterangan)}</td>
      </tr>
    `
    )
    .join('');
}

// 7. DAFTAR SANTRI & INPUT DATA (ADMIN)
function renderSantriDirectory() {
  const grid = document.getElementById('santri-directory-grid');

  if (santriDirectory.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full bg-white p-10 rounded-3xl border border-dashed border-slate-300 text-center">
        <p class="text-slate-500 font-semibold">Belum ada nama santri. Tambahkan nama santri baru di atas.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = santriDirectory
    .map((nama, idx) => {
      const santriReports = reportItems.filter((r) => r.nama.toLowerCase() === nama.toLowerCase());
      const masuk = santriReports.reduce((s, r) => s + r.masuk, 0);
      const keluar = santriReports.reduce((s, r) => s + r.keluar, 0);
      const saldo = masuk - keluar;

      const isChecked = selectedSantriForDelete.has(nama);
      const isMenuOpen = openSantriMenuName === nama;

      return `
        <div onclick="handleSantriCardClickByIndex(${idx})"
          class="relative bg-white p-5 rounded-3xl border ${
            isChecked ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20' : 'border-slate-200/90 hover:border-emerald-500'
          } shadow-sm hover:shadow-md transition cursor-pointer group">
          
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              ${
                isSantriSelectMode
                  ? `<input type="checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); toggleSelectSingleSantriByIndex(${idx})"
                      class="w-5 h-5 rounded-md accent-rose-600 cursor-pointer shrink-0" />`
                  : `<div class="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 group-hover:bg-emerald-700 group-hover:text-white font-extrabold text-base flex items-center justify-center transition shrink-0">
                      ${escapeHtml(nama.charAt(0).toUpperCase())}
                    </div>`
              }
              <div class="min-w-0">
                <h3 class="font-extrabold text-base text-slate-900 truncate group-hover:text-emerald-800 transition">${escapeHtml(nama)}</h3>
                <p class="text-xs text-slate-500 mt-0.5">${santriReports.length} catatan transaksi</p>
              </div>
            </div>

            <!-- Horizontal Three-Dot Menu (...) -->
            <div class="santri-menu-wrapper relative" onclick="event.stopPropagation()">
              <button type="button" onclick="toggleSantriMenuByIndex(${idx})"
                class="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" title="Opsi Santri">
                <i data-lucide="more-horizontal" class="w-5 h-5"></i>
              </button>

              ${
                isMenuOpen
                  ? `<div class="absolute right-0 mt-1 w-40 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-20 fade-in">
                      <button type="button" onclick="openSantriProfileModalByIndex(${idx})"
                        class="w-full px-4 py-2 text-left text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2">
                        <i data-lucide="user-check" class="w-3.5 h-3.5 text-emerald-600"></i>
                        <span>Cek Profil</span>
                      </button>
                      <button type="button" onclick="confirmSingleDeleteSantriByIndex(${idx})"
                        class="w-full px-4 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        <span>Hapus</span>
                      </button>
                    </div>`
                  : ''
              }
            </div>
          </div>

          <div class="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span class="text-slate-400 font-semibold">Saldo Tabungan</span>
            <span class="font-extrabold text-emerald-700 text-sm">${formatRupiah(saldo)}</span>
          </div>
        </div>
      `;
    })
    .join('');

  if (window.lucide) lucide.createIcons();
}

function handleSantriCardClickByIndex(idx) {
  const nama = santriDirectory[idx];
  if (!nama) return;
  if (isSantriSelectMode) {
    toggleSelectSingleSantriByIndex(idx);
    return;
  }
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

  if (!nama) {
    showToast('Masukkan nama santri terlebih dahulu.', 'error');
    return;
  }

  const exists = santriDirectory.some((s) => s.toLowerCase() === nama.toLowerCase());
  if (exists) {
    showToast(`Santri atas nama "${nama}" sudah ada di daftar.`, 'error');
    return;
  }

  santriDirectory.push(nama);
  saveAppData();
  input.value = '';
  renderSantriDirectory();
  showToast(`Santri "${nama}" berhasil ditambahkan.`, 'success');
}

// Multi-Delete Mode
function toggleSantriSelectMode(forceState) {
  isSantriSelectMode = typeof forceState === 'boolean' ? forceState : !isSantriSelectMode;
  selectedSantriForDelete.clear();
  openSantriMenuName = null;

  const bar = document.getElementById('multi-delete-bar');
  if (isSantriSelectMode) {
    bar.classList.remove('hidden');
  } else {
    bar.classList.add('hidden');
  }

  updateSelectedSantriCount();
  renderSantriDirectory();
}

function toggleSelectSingleSantriByIndex(idx) {
  const nama = santriDirectory[idx];
  if (!nama) return;
  if (selectedSantriForDelete.has(nama)) {
    selectedSantriForDelete.delete(nama);
  } else {
    selectedSantriForDelete.add(nama);
  }
  updateSelectedSantriCount();
  renderSantriDirectory();
}

function selectAllSantriForDelete() {
  if (selectedSantriForDelete.size === santriDirectory.length) {
    selectedSantriForDelete.clear();
  } else {
    santriDirectory.forEach((n) => selectedSantriForDelete.add(n));
  }
  updateSelectedSantriCount();
  renderSantriDirectory();
}

function updateSelectedSantriCount() {
  document.getElementById('selected-santri-count').textContent = `${selectedSantriForDelete.size} santri dipilih`;
}

function confirmBulkDeleteSantri() {
  if (selectedSantriForDelete.size === 0) {
    showToast('Pilih minimal satu santri yang ingin dihapus.', 'error');
    return;
  }

  const targets = Array.from(selectedSantriForDelete);
  openConfirmDeleteModal(
    `Hapus ${targets.length} santri terpilih beserta seluruh riwayat transaksinya?`,
    () => {
      const lowerSet = new Set(targets.map((n) => n.toLowerCase()));
      santriDirectory = santriDirectory.filter((n) => !lowerSet.has(n.toLowerCase()));
      reportItems = reportItems.filter((r) => !lowerSet.has(r.nama.toLowerCase()));
      saveAppData();
      toggleSantriSelectMode(false);
      showToast(`${targets.length} santri berhasil dihapus.`, 'success');
    }
  );
}

function confirmSingleDeleteSantriByIndex(idx) {
  const nama = santriDirectory[idx];
  if (!nama) return;
  openSantriMenuName = null;
  renderSantriDirectory();

  openConfirmDeleteModal(
    `Hapus santri "${nama}" beserta seluruh catatan keuangannya?`,
    () => {
      santriDirectory = santriDirectory.filter((n) => n.toLowerCase() !== nama.toLowerCase());
      reportItems = reportItems.filter((r) => r.nama.toLowerCase() !== nama.toLowerCase());
      saveAppData();
      renderSantriDirectory();
      showToast(`Santri "${nama}" telah dihapus.`, 'success');
    }
  );
}

// Cek Profil Modal
function openSantriProfileModalByIndex(idx) {
  const nama = santriDirectory[idx];
  if (!nama) return;
  openSantriMenuName = null;
  renderSantriDirectory();

  const matchedAccount = registeredUsers.find(
    (u) =>
      u.fullName.toLowerCase() === nama.toLowerCase() ||
      u.username.toLowerCase().startsWith(nama.toLowerCase().split(' ')[0])
  );

  const generatedUsername = matchedAccount
    ? matchedAccount.username
    : `${nama.toLowerCase().replace(/[^a-z0-9]/g, '_')}_santri`;

  const santriReports = reportItems.filter((r) => r.nama.toLowerCase() === nama.toLowerCase());
  const masuk = santriReports.reduce((s, r) => s + r.masuk, 0);
  const keluar = santriReports.reduce((s, r) => s + r.keluar, 0);
  const saldo = masuk - keluar;

  document.getElementById('profile-modal-avatar').textContent = nama.charAt(0).toUpperCase();
  document.getElementById('profile-modal-title').textContent = nama;
  document.getElementById('profile-modal-fullname').textContent = matchedAccount ? matchedAccount.fullName : nama;
  document.getElementById('profile-modal-username').textContent = generatedUsername;
  document.getElementById('profile-modal-masuk').textContent = formatRupiah(masuk);
  document.getElementById('profile-modal-keluar').textContent = formatRupiah(keluar);
  document.getElementById('profile-modal-saldo').textContent = formatRupiah(saldo);

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

// Form Tambah Data (Tanpa Kolom Nama)
function openTambahDataFormForSantri(nama) {
  activeFormSantriName = nama;
  document.getElementById('daftar-santri-list-view').classList.add('hidden');
  document.getElementById('daftar-santri-form-view').classList.remove('hidden');

  document.getElementById('form-santri-heading').textContent = `Tambah Data: ${nama}`;
  document.getElementById('laporan-form').reset();
  document.getElementById('edit-record-id').value = '';
  document.getElementById('input-tanggal').value = new Date().toISOString().split('T')[0];
  document.getElementById('input-jumlah').value = '0';
  if (window.lucide) lucide.createIcons();
}

function backToDaftarSantriList() {
  activeFormSantriName = '';
  document.getElementById('daftar-santri-form-view').classList.add('hidden');
  document.getElementById('daftar-santri-list-view').classList.remove('hidden');
  renderSantriDirectory();
}

function handleNominalInput(inputEl) {
  const numeric = parseFormattedNumber(inputEl.value);
  inputEl.value = numeric > 0 ? formatNumberDots(numeric) : '';

  const masukVal = parseFormattedNumber(document.getElementById('input-masuk').value);
  const keluarVal = parseFormattedNumber(document.getElementById('input-keluar').value);
  const total = masukVal + keluarVal;
  document.getElementById('input-jumlah').value = formatNumberDots(total);
}

function handleSaveLaporan(event) {
  event.preventDefault();
  if (!activeFormSantriName) return;

  const tanggal = document.getElementById('input-tanggal').value;
  const masuk = parseFormattedNumber(document.getElementById('input-masuk').value);
  const keluar = parseFormattedNumber(document.getElementById('input-keluar').value);
  const keterangan = document.getElementById('input-keterangan').value.trim();

  if (masuk === 0 && keluar === 0) {
    showToast('Isi nominal Masuk atau Keluar terlebih dahulu.', 'error');
    return;
  }

  if ((masuk > 0 && masuk < 5000) || (keluar > 0 && keluar < 5000)) {
    showToast('Nominal transaksi minimal Rp 5.000.', 'error');
    return;
  }

  const newRecord = {
    id: 'rep-' + Date.now(),
    tanggal,
    nama: activeFormSantriName,
    masuk,
    keluar,
    jumlah: masuk + keluar,
    keterangan
  };

  reportItems.unshift(newRecord);
  saveAppData();

  showToast(`Data transaksi untuk ${activeFormSantriName} berhasil disimpan!`, 'success');
  backToDaftarSantriList();
}

// 8. HASIL LAPORAN, FILTER & EXPORT (EXCEL / PDF)
function renderHasilLaporanSection() {
  const isAdmin = currentUser.role === 'admin';
  const pillsContainer = document.getElementById('hasil-laporan-santri-pills');

  if (!isAdmin) {
    selectedSantriFilter = resolveWaliSantriName(currentUser);
  }

  let pillsHtml = '';
  if (isAdmin) {
    const isAllActive = selectedSantriFilter === 'ALL';
    pillsHtml += `
      <button type="button" onclick="selectLaporanSantriFilter('ALL')"
        class="px-4 py-2 rounded-xl text-xs font-extrabold border transition ${
          isAllActive
            ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'
        }">
        Semua Santri (${reportItems.length})
      </button>
    `;
  }

  const displayedSantriList = isAdmin
    ? santriDirectory
    : [resolveWaliSantriName(currentUser)];

  displayedSantriList.forEach((nama, idx) => {
    const count = reportItems.filter((r) => r.nama.toLowerCase() === nama.toLowerCase()).length;
    const isActive = selectedSantriFilter.toLowerCase() === nama.toLowerCase();

    pillsHtml += `
      <button type="button" onclick="selectLaporanSantriFilterByIndex(${idx})"
        class="px-4 py-2 rounded-xl text-xs font-extrabold border transition ${
          isActive
            ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'
        }">
        ${escapeHtml(nama)} (${count})
      </button>
    `;
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
    const matchSantri =
      selectedSantriFilter === 'ALL' ||
      item.nama.toLowerCase() === selectedSantriFilter.toLowerCase();

    const matchSearch =
      !searchQuery ||
      item.nama.toLowerCase().includes(searchQuery) ||
      item.tanggal.toLowerCase().includes(searchQuery) ||
      item.keterangan.toLowerCase().includes(searchQuery);

    return matchSantri && matchSearch;
  });
}

function renderHasilLaporanTable() {
  const rows = getFilteredLaporanRows();
  const isAdmin = currentUser.role === 'admin';

  document.getElementById('active-filter-label').textContent =
    selectedSantriFilter === 'ALL' ? 'Menampilkan: Semua Santri' : `Menampilkan: ${selectedSantriFilter}`;

  const totalMasuk = rows.reduce((s, r) => s + r.masuk, 0);
  const totalKeluar = rows.reduce((s, r) => s + r.keluar, 0);
  const saldo = totalMasuk - totalKeluar;

  document.getElementById('filtered-masuk').textContent = formatRupiah(totalMasuk);
  document.getElementById('filtered-keluar').textContent = formatRupiah(totalKeluar);
  document.getElementById('filtered-saldo').textContent = formatRupiah(saldo);

  const tbody = document.getElementById('hasil-laporan-tbody');
  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${isAdmin ? 8 : 7}" class="py-10 text-center text-slate-400 text-sm">
          Tidak ada data laporan yang ditemukan.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows
    .map((item, idx) => {
      const actionCell = isAdmin
        ? `<td class="py-3.5 px-4 text-center whitespace-nowrap">
            <div class="inline-flex items-center gap-1.5">
              <button type="button" onclick="openEditRecordModal('${escapeHtml(item.id)}')"
                class="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition" title="Edit">
                <i data-lucide="pencil" class="w-4 h-4"></i>
              </button>
              <button type="button" onclick="confirmDeleteRecord('${escapeHtml(item.id)}')"
                class="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition" title="Hapus">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </td>`
        : '';

      return `
        <tr class="hover:bg-slate-50/90 transition">
          <td class="py-3.5 px-4 font-semibold text-slate-500">${idx + 1}</td>
          <td class="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">${escapeHtml(item.tanggal)}</td>
          <td class="py-3.5 px-4 font-bold text-slate-900">${escapeHtml(item.nama)}</td>
          <td class="py-3.5 px-4 font-bold text-emerald-700 whitespace-nowrap">${item.masuk > 0 ? formatRupiah(item.masuk) : '-'}</td>
          <td class="py-3.5 px-4 font-bold text-rose-600 whitespace-nowrap">${item.keluar > 0 ? formatRupiah(item.keluar) : '-'}</td>
          <td class="py-3.5 px-4 font-extrabold text-slate-800 whitespace-nowrap">${formatRupiah(item.jumlah)}</td>
          <td class="py-3.5 px-4 text-slate-600">${escapeHtml(item.keterangan)}</td>
          ${actionCell}
        </tr>
      `;
    })
    .join('');

  if (window.lucide) lucide.createIcons();
}

// 9. KELOLA AKUN (ADMIN BUATKAN AKUN PENGGUNA & ADMIN)
function handleAdminCreateUser(event) {
  event.preventDefault();
  const fullName = document.getElementById('admin-new-fullname').value.trim();
  const username = document.getElementById('admin-new-username').value.trim();
  const password = document.getElementById('admin-new-password').value;
  const role = document.getElementById('admin-new-role').value;

  if (fullName.length < 2) {
    showToast('Nama lengkap minimal 2 karakter.', 'error');
    return;
  }

  if (password.length < 6) {
    showToast('Kata sandi minimal 6 karakter.', 'error');
    return;
  }

  if (role === 'admin') {
    const hasNumber = /\d/.test(username);
    const hasSymbol = /[^a-zA-Z0-9]/.test(username);
    if (!hasNumber || !hasSymbol) {
      showToast('Username Admin wajib mengandung angka dan simbol (contoh: admin_01).', 'error');
      return;
    }
  }

  const exists = registeredUsers.some(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );
  if (exists) {
    showToast('Username sudah terdaftar. Gunakan username lain.', 'error');
    return;
  }

  registeredUsers.push({ username, password, fullName, role });

  if (role === 'user') {
    const alreadyInSantri = santriDirectory.some(
      (s) => s.toLowerCase() === fullName.toLowerCase()
    );
    if (!alreadyInSantri) {
      santriDirectory.push(fullName);
    }
  }

  saveAppData();
  document.getElementById('admin-create-user-form').reset();
  showToast(`Akun "${username}" untuk ${fullName} berhasil dibuat!`, 'success');
}

// Edit & Delete Record (Admin)
function openEditRecordModal(id) {
  const item = reportItems.find((r) => r.id === id);
  if (!item) return;

  document.getElementById('modal-edit-id').value = item.id;
  document.getElementById('modal-edit-nama').value = item.nama;
  document.getElementById('modal-edit-tanggal').value = item.tanggal;
  document.getElementById('modal-edit-masuk').value = item.masuk > 0 ? formatNumberDots(item.masuk) : '';
  document.getElementById('modal-edit-keluar').value = item.keluar > 0 ? formatNumberDots(item.keluar) : '';
  document.getElementById('modal-edit-jumlah').value = formatNumberDots(item.jumlah);
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
  document.getElementById('modal-edit-jumlah').value = formatNumberDots(m + k);
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

  if (masuk === 0 && keluar === 0) {
    showToast('Nominal Masuk atau Keluar tidak boleh kosong semua.', 'error');
    return;
  }

  if ((masuk > 0 && masuk < 5000) || (keluar > 0 && keluar < 5000)) {
    showToast('Nominal minimal Rp 5.000.', 'error');
    return;
  }

  reportItems[idx] = {
    ...reportItems[idx],
    tanggal,
    masuk,
    keluar,
    jumlah: masuk + keluar,
    keterangan
  };

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

// Generic Confirm Delete Modal
function openConfirmDeleteModal(message, onConfirmCallback) {
  document.getElementById('confirm-delete-message').textContent = message;
  const modal = document.getElementById('confirm-delete-modal');
  modal.classList.remove('hidden');
  modal.classList.add('modal-open');

  const yesBtn = document.getElementById('btn-confirm-delete-yes');
  yesBtn.onclick = () => {
    closeConfirmDeleteModal();
    onConfirmCallback();
  };
}

function closeConfirmDeleteModal() {
  const modal = document.getElementById('confirm-delete-modal');
  modal.classList.add('hidden');
  modal.classList.remove('modal-open');
}

// 10. EXPORT EXCEL & EXPORT PDF
function getExportFilename(extension) {
  if (currentUser && currentUser.role !== 'admin') {
    const cleanName = currentUser.fullName.trim().replace(/[\\/:*?"<>|]/g, '_');
    return `${cleanName}.${extension}`;
  }
  const suffix =
    selectedSantriFilter === 'ALL'
      ? 'Semua_Santri'
      : selectedSantriFilter.replace(/[\\/:*?"<>|]/g, '_');
  return `Alfatih_Bendahara_${suffix}.${extension}`;
}

function exportToExcel() {
  const rows = getFilteredLaporanRows();
  if (rows.length === 0) {
    showToast('Tidak ada data untuk diekspor ke Excel.', 'error');
    return;
  }

  const sheetData = rows.map((r, i) => ({
    No: i + 1,
    Tanggal: r.tanggal,
    'Nama Santri': r.nama,
    'Masuk (Rp)': r.masuk,
    'Keluar (Rp)': r.keluar,
    'Jumlah (Rp)': r.jumlah,
    Keterangan: r.keterangan
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Santri');

  XLSX.writeFile(workbook, getExportFilename('xlsx'));
  showToast('File Excel berhasil diunduh.', 'success');
}

function exportToPDF() {
  const rows = getFilteredLaporanRows();
  if (rows.length === 0) {
    showToast('Tidak ada data untuk diekspor ke PDF.', 'error');
    return;
  }

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
  const subTitle =
    selectedSantriFilter === 'ALL'
      ? 'Laporan Keuangan & Tabungan Seluruh Santri'
      : `Laporan Keuangan & Tabungan Santri: ${selectedSantriFilter}`;
  doc.text(subTitle, pageWidth / 2, 24, { align: 'center' });

  doc.setDrawColor(200, 200, 200);
  doc.line(14, 28, pageWidth - 14, 28);

  const tableBody = rows.map((r, i) => [
    i + 1,
    r.tanggal,
    r.nama,
    r.masuk > 0 ? formatRupiah(r.masuk) : '-',
    r.keluar > 0 ? formatRupiah(r.keluar) : '-',
    formatRupiah(r.jumlah),
    r.keterangan
  ]);

  const totalMasuk = rows.reduce((s, r) => s + r.masuk, 0);
  const totalKeluar = rows.reduce((s, r) => s + r.keluar, 0);
  const saldo = totalMasuk - totalKeluar;

  doc.autoTable({
    startY: 33,
    head: [['No', 'Tanggal', 'Nama Santri', 'Masuk', 'Keluar', 'Jumlah', 'Keterangan']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [6, 95, 70],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.8
    },
    foot: [
      ['', '', 'TOTAL', formatRupiah(totalMasuk), formatRupiah(totalKeluar), `Saldo: ${formatRupiah(saldo)}`, '']
    ],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 9
    }
  });

  const finalY = doc.lastAutoTable.finalY || 120;
  const pageHeight = doc.internal.pageSize.getHeight();
  let signY = finalY + 18;

  if (signY + 30 > pageHeight) {
    doc.addPage();
    signY = 30;
  }

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
