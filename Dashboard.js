// ============================================================
// Dashboard.js — All-in-one logic untuk KosKu
// Firebase Auth + Realtime Database
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getDatabase, ref, set, get, update, onValue, remove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import {
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
    GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ══════════════════════════════════════════════════
// ① FIREBASE CONFIG
// ══════════════════════════════════════════════════
const firebaseConfig = {
    apiKey:            "AIzaSyAdZmcPxMvIVWLpDTHkE4FRtCmWWm1Ynso",
    authDomain:        "lastprojectce-2frpl.firebaseapp.com",
    databaseURL:       "https://lastprojectce-2frpl-default-rtdb.firebaseio.com",
    projectId:         "lastprojectce-2frpl",
    storageBucket:     "lastprojectce-2frpl.firebasestorage.app",
    messagingSenderId: "244081997580",
    appId:             "1:244081997580:web:966a9232c6d0f074b87b29",
    measurementId:     "G-48G1Q1PCHE"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);
const gProvider = new GoogleAuthProvider();

// ══════════════════════════════════════════════════
// ② KONSTANTA
// ══════════════════════════════════════════════════
const ADMIN_ACCOUNTS = [
    { username:"AzwarA1",  password:"Admin1Hebat", email:"azwara1@kosku-admin.com",  name:"Azwar"  },
    { username:"RonyA2",   password:"Admin2Hebat", email:"ronya2@kosku-admin.com",   name:"Rony"   },
    { username:"NuansaA3", password:"Admin3Hebat", email:"nuansaa3@kosku-admin.com", name:"Nuansa" },
    { username:"RaidA4",   password:"Admin4Hebat", email:"raida4@kosku-admin.com",   name:"Raid"   },
];

const ROOMS = [
    ...Array.from({length:10},(_,i)=>({
        id:`A${String(i+1).padStart(2,'0')}`, gender:'male',
        label:`Kamar A${String(i+1).padStart(2,'0')}`, genderLabel:'👨 Pria'
    })),
    ...Array.from({length:10},(_,i)=>({
        id:`B${String(i+1).padStart(2,'0')}`, gender:'female',
        label:`Kamar B${String(i+1).padStart(2,'0')}`, genderLabel:'👩 Wanita'
    })),
];

const PRICE_MONTHLY   = 1_000_000;
const PRICE_YEARLY    = 10_000_000;
const LATE_GRACE_DAYS = 3;
const FINE_RATE       = 0.05;

// ══════════════════════════════════════════════════
// ③ HELPERS
// ══════════════════════════════════════════════════
function el(id) { return document.getElementById(id); }

const fmtRp   = n => 'Rp ' + Number(n).toLocaleString('id-ID');
const fmtDate = ts => ts ? new Date(ts).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const daysBetween = (a,b) => Math.floor((b-a)/86400000);

function calcFine(tenant) {
    if (!tenant?.endDate || tenant.payStatus === 'lunas') return 0;
    const now = Date.now();
    if (now <= tenant.endDate) return 0;
    const over = daysBetween(tenant.endDate, now);
    if (over <= LATE_GRACE_DAYS) return 0;
    return Math.round(PRICE_MONTHLY * FINE_RATE * Math.ceil(over / 30));
}

function getPrice(type) {
    return type === 'yearly' ? PRICE_YEARLY : PRICE_MONTHLY;
}

function showToast(type, msg) {
    const elT  = el('toast');
    const icon = el('toast-icon');
    const txt  = el('toast-msg');
    elT.className = `toast t-${type}`;
    icon.innerText = type === 'ok' ? '✅' : '❌';
    txt.innerText  = msg;
    elT.classList.add('show');
    setTimeout(() => elT.classList.remove('show'), 3500);
}

function showAlert(id, type, msg) {
    const elA = el(id);
    if (!elA) return;
    elA.className = `alert-box ${type}`;
    elA.innerText = msg;
}
function clearAlert(id) {
    const elA = el(id);
    if (!elA) return;
    elA.className = 'alert-box';
    elA.innerText = '';
}

function setLoading(btnId, txtId, spinId, loading) {
    const btn  = el(btnId);
    const txt  = el(txtId);
    const spin = el(spinId);
    if (btn)  btn.disabled       = loading;
    if (txt)  txt.style.display  = loading ? 'none'  : 'inline';
    if (spin) spin.style.display = loading ? 'block' : 'none';
}

// ══════════════════════════════════════════════════
// ④ PAGE SYSTEM
// ══════════════════════════════════════════════════
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    el(id)?.classList.add('active');
}

// ══════════════════════════════════════════════════
// ⑤ SEED DATA (jalankan 1x dari console)
// ══════════════════════════════════════════════════
async function seedRooms() {
    const snap = await get(ref(db,'rooms'));
    if (snap.exists()) return;
    const updates = {};
    ROOMS.forEach(r => {
        updates[`rooms/${r.id}`] = {
            ...r, status:'empty', tenantUid:null, tenantName:null
        };
    });
    await update(ref(db), updates);
    console.log('[KosKu] 20 rooms seeded ✅');
}

async function seedAdmins() {
    for (const a of ADMIN_ACCOUNTS) {
        try {
            const cred = await createUserWithEmailAndPassword(auth, a.email, a.password);
            await updateProfile(cred.user, { displayName: a.name });
            await set(ref(db,`users/${cred.user.uid}`), {
                name:a.name, username:a.username, email:a.email,
                role:'admin', createdAt:Date.now()
            });
            await signOut(auth);
            console.log(`✅ Admin ${a.username} created`);
        } catch(e) {
            console.warn(`⚠ ${a.username}:`, e.message);
        }
    }
    console.log('[KosKu] Done! Sekarang jalankan: seedRooms()');
    alert('Semua admin berhasil dibuat!');
}

window.seedAdmins = seedAdmins;
window.seedRooms  = seedRooms;

// ══════════════════════════════════════════════════
// ⑥ STATE
// ══════════════════════════════════════════════════
let currentUser = null;
let currentRole = null;
let roomsData   = {};
let usersData   = {};

// ══════════════════════════════════════════════════
// ⑦ AUTH STATE
// ══════════════════════════════════════════════════
onAuthStateChanged(auth, async user => {
    if (!user) {
        showPage('page-landing');
        startLandingListener();
        return;
    }
    currentUser = user;
    const snap = await get(ref(db, `users/${user.uid}`));
    if (!snap.exists()) { await signOut(auth); return; }
    const userData = snap.val();
    currentRole = userData.role;

    // seedRooms only if rooms node is completely missing (first ever run)
    // Run in background — don't await, so it never blocks login
    get(ref(db, 'rooms/A01')).then(s => { if (!s.exists()) seedRooms(); });

    if (currentRole === 'admin') {
        el('admin-uname').innerText = userData.name || userData.username;
        showPage('page-admin');
        startAdminListeners();
        adminPanel('overview');
    } else {
        el('tenant-uname').innerText = userData.name || userData.username;
        showPage('page-tenant');
        startTenantListeners(user.uid);
        tenantPanel('status');
    }
    closeAuth();
});

// ══════════════════════════════════════════════════
// ⑧ LANDING — live stats listener
// ══════════════════════════════════════════════════
function startLandingListener() {
    onValue(ref(db,'rooms'), snap => {
        if (!snap.exists()) return;
        const rooms = Object.values(snap.val());
        const filled = rooms.filter(r => r.status === 'filled').length;
        const empty  = rooms.length - filled;
        const pct    = Math.round((filled / rooms.length) * 100);

        el('ls-filled').innerText = filled;
        el('ls-empty').innerText  = empty;

        const maleAvail   = rooms.filter(r => r.gender==='male'   && r.status==='empty').length;
        const femaleAvail = rooms.filter(r => r.gender==='female' && r.status==='empty').length;
        el('ls-male').innerText   = maleAvail;
        el('ls-female').innerText = femaleAvail;

        el('prev-filled').innerText = filled;
        el('prev-empty').innerText  = empty;
        el('prev-pct').innerText    = pct + '%';
    });
}

// ══════════════════════════════════════════════════
// ⑨ AUTH MODAL
// ══════════════════════════════════════════════════
function openAuth(tab = 'login') {
    el('auth-modal').classList.add('show');
    document.body.style.overflow = 'hidden';
    switchAuthTab(tab);
    clearAlert('auth-alert');
}
function closeAuth() {
    el('auth-modal').classList.remove('show');
    document.body.style.overflow = '';
}
function switchAuthTab(tab) {
    const isLogin = tab === 'login';
    el('auth-form-login').style.display    = isLogin ? 'block' : 'none';
    el('auth-form-register').style.display = isLogin ? 'none'  : 'block';
    el('atab-login').classList.toggle('active', isLogin);
    el('atab-register').classList.toggle('active', !isLogin);
    el('auth-subtitle').innerText = isLogin ? 'Masuk ke akun lo 👋' : 'Daftar sebagai penyewa 🏠';
    clearAlert('auth-alert');
}
function detectAdmin(val) {
    const isAdmin = ADMIN_ACCOUNTS.some(a => a.username.toLowerCase() === val.toLowerCase());
    el('admin-hint').style.display = isAdmin ? 'block' : 'none';
}

// ── Expose auth functions to window (required for onclick in HTML with type="module") ──
window.openAuth      = openAuth;
window.closeAuth     = closeAuth;
window.switchAuthTab = switchAuthTab;
window.detectAdmin   = detectAdmin;

window.handleLogin = async () => {
    const identifier = el('l-id').value.trim();
    const pw         = el('l-pw').value;
    if (!identifier || !pw) { showAlert('auth-alert','err','⚠️ Isi username/email dan password!'); return; }

    setLoading('l-btn','l-btn-txt','l-spin', true);
    clearAlert('auth-alert');

    try {
        const adminMatch = ADMIN_ACCOUNTS.find(a => a.username.toLowerCase() === identifier.toLowerCase());
        let email = identifier;

        if (adminMatch) {
            email = adminMatch.email;
        } else if (!identifier.includes('@')) {
            const snap = await get(ref(db,'users'));
            if (snap.exists()) {
                const found = Object.values(snap.val()).find(u => u.username === identifier.toLowerCase() && u.role === 'tenant');
                if (found) email = found.email;
                else {
                    showAlert('auth-alert','err','⚠️ Username tidak ditemukan!');
                    setLoading('l-btn','l-btn-txt','l-spin',false);
                    return;
                }
            }
        }
        await signInWithEmailAndPassword(auth, email, pw);
    } catch(e) {
        const msgs = {
            'auth/user-not-found':     '⚠️ Akun tidak ditemukan.',
            'auth/wrong-password':     '⚠️ Password salah.',
            'auth/invalid-credential': '⚠️ Email/password salah.',
            'auth/too-many-requests':  '⚠️ Terlalu banyak percobaan. Tunggu sebentar.',
        };
        showAlert('auth-alert','err', msgs[e.code] || `⚠️ ${e.message}`);
        setLoading('l-btn','l-btn-txt','l-spin', false);
    }
};

window.handleRegister = async () => {
    const name = el('r-name').value.trim();
    const user = el('r-user').value.trim().toLowerCase();
    const email= el('r-email').value.trim();
    const pw   = el('r-pw').value;

    if (!name||!user||!email||!pw) { showAlert('auth-alert','err','⚠️ Semua field wajib diisi!'); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(user)) { showAlert('auth-alert','err','⚠️ Format username tidak valid!'); return; }
    if (pw.length < 6) { showAlert('auth-alert','err','⚠️ Password minimal 6 karakter!'); return; }

    setLoading('r-btn','r-btn-txt','r-spin', true);
    clearAlert('auth-alert');

    try {
        const snap = await get(ref(db,'users'));
        if (snap.exists() && Object.values(snap.val()).some(u => u.username === user)) {
            showAlert('auth-alert','err','⚠️ Username sudah dipakai!');
            setLoading('r-btn','r-btn-txt','r-spin',false);
            return;
        }

        const cred = await createUserWithEmailAndPassword(auth, email, pw);
        await updateProfile(cred.user, { displayName: name });
        await set(ref(db,`users/${cred.user.uid}`), {
            name, username:user, email, role:'tenant',
            roomId:null, payStatus:'belum', createdAt:Date.now()
        });
        showToast('ok', `🎉 Akun ${name} berhasil dibuat!`);
    } catch(e) {
        const msgs = {
            'auth/email-already-in-use': '⚠️ Email sudah dipakai.',
            'auth/invalid-email':        '⚠️ Format email tidak valid.',
            'auth/weak-password':        '⚠️ Password terlalu lemah.',
        };
        showAlert('auth-alert','err', msgs[e.code] || `⚠️ ${e.message}`);
        setLoading('r-btn','r-btn-txt','r-spin',false);
    }
};

window.handleGoogle = async () => {
    clearAlert('auth-alert');
    try {
        const result = await signInWithPopup(auth, gProvider);
        const user   = result.user;
        const snap   = await get(ref(db,`users/${user.uid}`));
        if (!snap.exists()) {
            await set(ref(db,`users/${user.uid}`), {
                name:user.displayName||'', username:user.email.split('@')[0].toLowerCase(),
                email:user.email, role:'tenant', roomId:null, payStatus:'belum', createdAt:Date.now()
            });
        }
    } catch(e) {
        if (e.code !== 'auth/popup-closed-by-user')
            showAlert('auth-alert','err', `⚠️ Google login gagal: ${e.message}`);
    }
};

window.doLogout = async () => {
    await signOut(auth);
    showPage('page-landing');
    startLandingListener();
    showToast('ok','👋 Berhasil keluar.');
};

// Close modal on overlay click
setTimeout(() => {
    el('auth-modal')?.addEventListener('click', e => {
        if (e.target === el('auth-modal')) closeAuth();
    });
}, 100);

// ══════════════════════════════════════════════════
// ⑩ ADMIN — LISTENERS & PANELS
// ══════════════════════════════════════════════════
function startAdminListeners() {
    onValue(ref(db,'rooms'), snap => {
        roomsData = snap.exists() ? snap.val() : {};
        renderAdminRooms();
        renderOverview();
    });
    onValue(ref(db,'users'), snap => {
        usersData = snap.exists() ? snap.val() : {};
        renderTenants();
        renderPayments();
    });
}

window.adminPanel = id => {
    document.querySelectorAll('[id^="apanel-"]').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('[id^="anav-"]').forEach(b => b.classList.remove('active'));
    el(`apanel-${id}`)?.classList.add('active');
    el(`anav-${id}`)?.classList.add('active');
};

// ── OVERVIEW ──
function renderOverview() {
    const rooms  = Object.values(roomsData);
    const filled = rooms.filter(r => r.status==='filled').length;
    const empty  = rooms.length - filled;
    const tenants= Object.values(usersData).filter(u => u.role==='tenant' && u.roomId);
    const overdue= tenants.filter(u => calcFine(u) > 0).length;

    el('ov-filled').innerText  = filled;
    el('ov-empty').innerText   = empty;
    el('ov-overdue').innerText = overdue;
    el('ov-occ-label').innerText = `${filled} dari ${rooms.length} kamar terisi`;
    el('ov-occ-bar').style.width = rooms.length ? `${Math.round(filled/rooms.length*100)}%` : '0%';

    const maleRooms   = rooms.filter(r => r.gender==='male');
    const femaleRooms = rooms.filter(r => r.gender==='female');
    el('ov-male-rooms').innerHTML   = maleRooms.map(r => miniRoomCard(r)).join('');
    el('ov-female-rooms').innerHTML = femaleRooms.map(r => miniRoomCard(r)).join('');
}

function miniRoomCard(r) {
    const tenant = r.tenantUid ? Object.values(usersData).find(u=>u.roomId===r.id) : null;
    const fine   = tenant ? calcFine(tenant) : 0;
    const cls    = r.status==='empty' ? 'rc-empty' : fine>0 ? 'rc-overdue' : 'rc-filled';
    const status = r.status==='empty' ? '<span style="color:var(--green)">Kosong</span>'
                 : fine>0             ? '<span style="color:var(--red)">Menunggak</span>'
                 :                      '<span style="color:var(--accent)">Terisi</span>';
    return `<div class="room-card ${cls}" onclick="openRoomModal('${r.id}')">
        <div class="room-card-id">${r.id}</div>
        <div class="room-card-status">${status}</div>
    </div>`;
}

// ── ROOMS GRID ──
let roomFilter = 'all';
window.filterRooms = f => {
    roomFilter = f;
    ['all','male','female','empty'].forEach(x => {
        const btn = el(`rf-${x}`);
        if (!btn) return;
        btn.className = f===x ? 'btn-primary' : 'btn-secondary';
        btn.style.cssText = 'font-size:.78rem;padding:8px 16px';
    });
    renderAdminRooms();
};

function renderAdminRooms() {
    const container = el('rooms-grid'); if (!container) return;
    let rooms = Object.values(roomsData);
    if (roomFilter==='male')   rooms = rooms.filter(r=>r.gender==='male');
    if (roomFilter==='female') rooms = rooms.filter(r=>r.gender==='female');
    if (roomFilter==='empty')  rooms = rooms.filter(r=>r.status==='empty');

    container.innerHTML = rooms.map(r => {
        const tenant = r.tenantUid ? Object.values(usersData).find(u=>u.roomId===r.id) : null;
        const fine   = tenant ? calcFine(tenant) : 0;
        const cls    = r.status==='empty' ? 'rc-empty' : fine>0 ? 'rc-overdue' : 'rc-filled';
        const statusTxt = r.status==='empty' ? `<span class="badge badge-green">Kosong</span>`
                        : fine>0             ? `<span class="badge badge-red">Menunggak</span>`
                        :                      `<span class="badge badge-orange">Terisi</span>`;
        const tenantTxt = tenant ? `<div style="font-size:.65rem;color:var(--muted);margin-top:6px">${tenant.name}</div>` : '';
        return `<div class="room-card ${cls}" onclick="openRoomModal('${r.id}')" style="min-height:90px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px">
            <div class="room-card-id">${r.id}</div>
            <div class="room-card-gender" style="font-size:.6rem;color:var(--muted)">${r.genderLabel}</div>
            ${statusTxt}
            ${tenantTxt}
        </div>`;
    }).join('');
}

// ── ROOM MODAL ──
let selectedRoomId = null;

window.openRoomModal = roomId => {
    const room = roomsData[roomId]; if (!room) return;
    selectedRoomId = roomId;
    if (room.status === 'empty') openAssignModal(roomId);
    else openEvictModal(roomId);
};

// ── ASSIGN MODAL ──
window.openAssignModal = async roomId => {
    const room = roomsData[roomId]; if (!room) return;
    el('assign-room-label').innerText = `${room.label} (${room.genderLabel})`;
    clearAlert('assign-alert');

    const freeTenants = Object.entries(usersData)
        .filter(([,u]) => u.role==='tenant' && !u.roomId)
        .map(([uid,u]) => `<option value="${uid}">${u.name} (@${u.username})</option>`)
        .join('');

    el('assign-tenant-select').innerHTML = freeTenants
        ? `<option value="">-- Pilih Penyewa --</option>${freeTenants}`
        : `<option value="">Tidak ada penyewa tersedia</option>`;

    const today = new Date();
    const yyyy  = today.getFullYear(), mm = String(today.getMonth()+1).padStart(2,'0'), dd = String(today.getDate()).padStart(2,'0');
    el('assign-start').value = `${yyyy}-${mm}-${dd}`;
    const end = new Date(today); end.setMonth(end.getMonth()+1);
    const ey  = end.getFullYear(), em = String(end.getMonth()+1).padStart(2,'0'), ed = String(end.getDate()).padStart(2,'0');
    el('assign-end').value = `${ey}-${em}-${ed}`;
    updateAssignPrice();

    el('assign-modal').classList.add('show');
};

window.closeAssignModal = () => el('assign-modal').classList.remove('show');

window.updateAssignPrice = () => {
    const type = el('assign-type')?.value || 'monthly';
    el('assign-price-display').innerText = fmtRp(getPrice(type));
};

function getRoomGender(roomId) {
    return roomId?.startsWith('A') ? 'male' : 'female';
}

window.doAssign = async () => {
    const tenantUid = el('assign-tenant-select').value;
    const roomId    = selectedRoomId;
    const room      = roomsData[roomId];

    if (!tenantUid) { showAlert('assign-alert','err','⚠️ Pilih penyewa dulu!'); return; }
    if (!room)      { showAlert('assign-alert','err','⚠️ Kamar tidak valid!'); return; }

    // Validasi gender
    const tenant      = usersData[tenantUid];
    const roomGender  = getRoomGender(roomId);
    const tenantGender= tenant?.gender;

    if (tenantGender && tenantGender !== roomGender) {
        const roomLabel   = roomGender   === 'male' ? '👨 Pria' : '👩 Wanita';
        const tenantLabel = tenantGender === 'male' ? '👨 Pria' : '👩 Wanita';
        showAlert('assign-alert','err',
            `⚠️ Kamar ${roomId} adalah zona ${roomLabel}, tapi penyewa ini terdaftar sebagai ${tenantLabel}. Tidak bisa di-assign!`
        );
        return;
    }

    if (!tenantGender) {
        showAlert('assign-alert','warn',
            `⚠️ Gender penyewa belum diset. Pastikan kamar ${roomId} (${roomGender==='male'?'Pria':'Wanita'}) sesuai.`
        );
        await new Promise(r => setTimeout(r, 1500));
    }

    const type     = el('assign-type').value;
    const startStr = el('assign-start').value;
    const endStr   = el('assign-end').value;

    if (!startStr) { showAlert('assign-alert','err','⚠️ Isi tanggal masuk!'); return; }
    if (!endStr)   { showAlert('assign-alert','err','⚠️ Isi tanggal selesai!'); return; }

    const startTs = new Date(startStr).getTime();
    const endTs   = new Date(endStr).getTime();
    if (endTs <= startTs) { showAlert('assign-alert','err','⚠️ Tanggal selesai harus setelah tanggal masuk!'); return; }

    setLoading('assign-btn','assign-btn-txt','assign-spin', true);

    try {
        const price   = getPrice(type);
        const updates = {};

        updates[`rooms/${roomId}/status`]     = 'filled';
        updates[`rooms/${roomId}/tenantUid`]  = tenantUid;
        updates[`rooms/${roomId}/tenantName`] = tenant?.name || '';

        updates[`users/${tenantUid}/roomId`]    = roomId;
        updates[`users/${tenantUid}/rentType`]  = type;
        updates[`users/${tenantUid}/startDate`] = startTs;
        updates[`users/${tenantUid}/endDate`]   = endTs;
        updates[`users/${tenantUid}/price`]     = price;
        updates[`users/${tenantUid}/payStatus`] = 'pending';
        updates[`users/${tenantUid}/fineAmount`]= 0;

        const histKey = `paymentHistory/${tenantUid}/${Date.now()}`;
        updates[histKey] = {
            type:'assign', roomId, rentType:type, price,
            startDate:startTs, endDate:endTs,
            adminNote:`Check-in oleh Admin`, timestamp:Date.now()
        };

        await update(ref(db), updates);
        showToast('ok', `✅ ${tenant?.name} berhasil di-assign ke ${roomId}`);
        window.closeAssignModal();
    } catch(e) {
        showAlert('assign-alert','err', `⚠️ Gagal: ${e.message}`);
    } finally {
        setLoading('assign-btn','assign-btn-txt','assign-spin', false);
    }
};

// ── EVICT MODAL ──
window.openEvictModal = roomId => {
    const room = roomsData[roomId]; if (!room) return;
    selectedRoomId = roomId;
    const tenant = Object.values(usersData).find(u => u.roomId === roomId);
    el('evict-room-label').innerText  = room.label;
    el('evict-tenant-name').innerText = tenant?.name || '---';
    el('evict-modal').classList.add('show');
};
window.closeEvictModal = () => el('evict-modal').classList.remove('show');

window.doEvict = async () => {
    const room        = roomsData[selectedRoomId]; if (!room) return;
    const tenantEntry = Object.entries(usersData).find(([,u])=>u.roomId===selectedRoomId);
    if (!tenantEntry) { window.closeEvictModal(); return; }

    const [tenantUid, tenant] = tenantEntry;
    try {
        const updates = {};
        updates[`rooms/${selectedRoomId}/status`]     = 'empty';
        updates[`rooms/${selectedRoomId}/tenantUid`]  = null;
        updates[`rooms/${selectedRoomId}/tenantName`] = null;
        updates[`users/${tenantUid}/roomId`]          = null;
        updates[`users/${tenantUid}/rentType`]        = null;
        updates[`users/${tenantUid}/startDate`]       = null;
        updates[`users/${tenantUid}/endDate`]         = null;
        updates[`users/${tenantUid}/price`]           = null;
        updates[`users/${tenantUid}/payStatus`]       = 'belum';
        updates[`users/${tenantUid}/fineAmount`]      = 0;

        const histKey = `paymentHistory/${tenantUid}/${Date.now()}`;
        updates[histKey] = {
            type:'checkout', roomId:selectedRoomId,
            note:`Check-out dari ${selectedRoomId} oleh Admin`,
            timestamp:Date.now()
        };

        await update(ref(db), updates);
        showToast('ok', `✅ Penyewa berhasil dilepas dari ${selectedRoomId}`);
        window.closeEvictModal();
    } catch(e) {
        showToast('err', `❌ Gagal: ${e.message}`);
    }
};

// ── TENANTS TABLE ──
function renderTenants() {
    const tbody = el('tenants-tbody'); if (!tbody) return;
    const tenants = Object.entries(usersData).filter(([,u])=>u.role==='tenant');

    if (!tenants.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted)">Belum ada penyewa terdaftar.</td></tr>`;
        return;
    }

    tbody.innerHTML = tenants.map(([uid,u]) => {
        const fine     = calcFine(u);
        const statusBadge = !u.roomId ? `<span class="badge badge-gray">Belum Check-in</span>`
            : u.payStatus==='lunas'   ? `<span class="badge badge-green">Lunas</span>`
            :                          `<span class="badge badge-yellow">Pending</span>`;
        const fineBadge = fine>0 ? `<span class="badge badge-red">${fmtRp(fine)}</span>` : `<span class="badge badge-gray">—</span>`;
        const roomBadge = u.roomId ? `<span class="badge badge-orange">${u.roomId}</span>` : `<span class="badge badge-gray">—</span>`;
        const periode   = u.startDate && u.endDate ? `${fmtDate(u.startDate)} → ${fmtDate(u.endDate)}` : '—';
        const tipeSewa  = u.rentType ? (u.rentType==='monthly'?'Bulanan':'Tahunan') : '—';

        return `<tr>
            <td><strong>${u.name}</strong></td>
            <td style="color:var(--muted)">@${u.username}</td>
            <td>${roomBadge}</td>
            <td style="font-size:.75rem">${periode}</td>
            <td>${tipeSewa}</td>
            <td>${statusBadge}</td>
            <td>${fineBadge}</td>
            <td>
                ${u.roomId && u.payStatus!=='lunas'
                    ? `<button class="btn-green" onclick="confirmPayment('${uid}')">✅ Lunas</button>`
                    : u.roomId ? `<button class="btn-secondary" style="font-size:.72rem;padding:6px 12px" onclick="resetPayment('${uid}')">🔄 Reset</button>` : ''}
            </td>
        </tr>`;
    }).join('');
}

// ── PAYMENTS TABLE ──
function renderPayments() {
    const tbody = el('payments-tbody'); if (!tbody) return;
    const tenants = Object.entries(usersData).filter(([,u])=>u.role==='tenant' && u.roomId);

    let totalFine = 0, lunas = 0, pending = 0;

    if (!tenants.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted)">Belum ada penyewa aktif.</td></tr>`;
    } else {
        tbody.innerHTML = tenants.map(([uid,u]) => {
            const fine  = calcFine(u);
            totalFine  += fine;
            if (u.payStatus==='lunas') lunas++; else pending++;

            const statusBadge = u.payStatus==='lunas'
                ? `<span class="badge badge-green">Lunas</span>`
                : fine>0 ? `<span class="badge badge-red">Menunggak</span>`
                :           `<span class="badge badge-yellow">Pending</span>`;

            return `<tr>
                <td><strong>${u.name}</strong></td>
                <td><span class="badge badge-orange">${u.roomId}</span></td>
                <td>${fmtRp(u.price||0)}</td>
                <td style="font-size:.78rem">${fmtDate(u.endDate)}</td>
                <td>${statusBadge}</td>
                <td>${fine>0 ? `<span style="color:var(--red);font-weight:700">${fmtRp(fine)}</span>` : '—'}</td>
                <td>
                    ${u.payStatus!=='lunas'
                        ? `<button class="btn-green" onclick="confirmPayment('${uid}')">✅ Konfirmasi Lunas</button>`
                        : `<button class="btn-secondary" style="font-size:.72rem;padding:6px 12px" onclick="resetPayment('${uid}')">🔄 Reset</button>`}
                </td>
            </tr>`;
        }).join('');
    }

    el('pay-lunas').innerText  = lunas;
    el('pay-pending').innerText= pending;
    el('pay-denda').innerText  = fmtRp(totalFine);
}

async function addPaymentLog(tenantUid, type, note, extra = {}) {
    const logRef = ref(db, `paymentHistory/${tenantUid}/${Date.now()}`);
    await set(logRef, { type, note, timestamp:Date.now(), ...extra });
}

window.confirmPayment = async uid => {
    try {
        const u    = usersData[uid];
        const fine = calcFine(u);
        const total= (u?.price||0) + fine;
        await update(ref(db,`users/${uid}`), { payStatus:'lunas', fineAmount:0 });
        await addPaymentLog(uid, 'lunas', `Pembayaran dikonfirmasi lunas oleh Admin`, {
            roomId:u?.roomId, amount:u?.price||0, fine, total,
            period:`${fmtDate(u?.startDate)} → ${fmtDate(u?.endDate)}`
        });
        showToast('ok', '✅ Pembayaran dikonfirmasi lunas!');
    } catch(e) { showToast('err','❌ Gagal konfirmasi.'); }
};

window.resetPayment = async uid => {
    try {
        const u = usersData[uid];
        await update(ref(db,`users/${uid}`), { payStatus:'pending' });
        await addPaymentLog(uid, 'reset', `Status pembayaran di-reset ke pending oleh Admin`, { roomId:u?.roomId });
        showToast('ok', '🔄 Status reset ke pending.');
    } catch(e) { showToast('err','❌ Gagal reset.'); }
};

// ── PAYMENT HISTORY MODAL ──
window.showPaymentHistory = async uid => {
    const u    = usersData[uid];
    const snap = await get(ref(db, `paymentHistory/${uid}`));
    const logs = snap.exists() ? Object.values(snap.val()).sort((a,b)=>b.timestamp-a.timestamp) : [];

    el('history-modal-name').innerText = u?.name || '---';
    el('history-list').innerHTML = logs.length
        ? logs.map(log => {
            const typeMap = {
                lunas:    { icon:'✅', label:'Lunas',     color:'var(--green)'  },
                reset:    { icon:'🔄', label:'Reset',     color:'var(--yellow)' },
                assign:   { icon:'🏠', label:'Check-in',  color:'var(--accent)' },
                checkout: { icon:'🚪', label:'Check-out', color:'var(--muted)'  },
                denda:    { icon:'⚠️', label:'Denda',     color:'var(--red)'    },
            };
            const t = typeMap[log.type] || { icon:'📋', label:log.type, color:'var(--text)' };
            return `<div style="display:flex;gap:12px;align-items:flex-start;padding:14px;background:var(--surface2);border-radius:14px;border:1px solid var(--border)">
                <div style="font-size:1.4rem;flex-shrink:0">${t.icon}</div>
                <div style="flex:1">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                        <span style="font-weight:800;color:${t.color}">${t.label}</span>
                        <span style="font-size:.68rem;color:var(--muted)">${fmtDate(log.timestamp)}</span>
                    </div>
                    <div style="font-size:.78rem;color:var(--muted)">${log.note||''}</div>
                    ${log.roomId ? `<div style="font-size:.7rem;margin-top:4px"><span class="badge badge-orange">${log.roomId}</span></div>` : ''}
                    ${log.total  ? `<div style="font-size:.75rem;color:var(--text);margin-top:4px">Total: <strong>${fmtRp(log.total)}</strong>${log.fine>0?` (termasuk denda ${fmtRp(log.fine)})`:''}` : ''}
                    ${log.period ? `<div style="font-size:.7rem;color:var(--muted);margin-top:2px">Periode: ${log.period}</div>` : ''}
                </div>
            </div>`;
        }).join('')
        : `<div style="text-align:center;padding:32px;color:var(--muted)">Belum ada riwayat pembayaran.</div>`;

    el('history-modal')?.classList.add('show');
};

window.closeHistoryModal = () => el('history-modal')?.classList.remove('show');
el('history-modal')?.addEventListener('click', e => { if(e.target===el('history-modal')) window.closeHistoryModal(); });

// ══════════════════════════════════════════════════
// ⑪ TENANT — LISTENERS & PANELS
// (single definition — no duplicate, no re-assignment)
// ══════════════════════════════════════════════════
function startTenantListeners(uid) {
    onValue(ref(db,`users/${uid}`), snap => {
        if (!snap.exists()) return;
        const u = snap.val();
        renderTenantStatus(u);
        renderTenantBilling(u);
        // Fine notification banner
        if (u.roomId) showFineNotif(u);
        else { const b = el('fine-banner'); if (b) b.style.display = 'none'; }
    });
    onValue(ref(db,'rooms'), snap => {
        if (!snap.exists()) return;
        renderTenantKosInfo(snap.val());
    });
}

window.tenantPanel = id => {
    document.querySelectorAll('[id^="tpanel-"]').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('[id^="tnav-"]').forEach(b => b.classList.remove('active'));
    el(`tpanel-${id}`)?.classList.add('active');
    el(`tnav-${id}`)?.classList.add('active');
};

function renderTenantStatus(u) {
    if (!u.roomId) {
        el('t-no-room').style.display  = 'block';
        el('t-has-room').style.display = 'none';
        return;
    }
    el('t-no-room').style.display  = 'none';
    el('t-has-room').style.display = 'block';

    const fine      = calcFine(u);
    const remaining = u.endDate ? daysBetween(Date.now(), u.endDate) : 0;
    const statusCard= el('t-status-card');

    if (fine > 0) {
        statusCard.className = 'status-big danger';
        el('t-status-icon').innerText  = '⚠️';
        el('t-status-detail').innerText= `Kamu menunggak! Denda: ${fmtRp(fine)}`;
    } else if (remaining <= 7 && remaining >= 0) {
        statusCard.className = 'status-big warn';
        el('t-status-icon').innerText  = '⏰';
        el('t-status-detail').innerText= `Sewa lo hampir habis dalam ${remaining} hari!`;
    } else if (remaining < 0) {
        statusCard.className = 'status-big danger';
        el('t-status-icon').innerText  = '❌';
        el('t-status-detail').innerText= `Masa sewa lo sudah habis!`;
    } else {
        statusCard.className = 'status-big ok';
        el('t-status-icon').innerText  = '✅';
        el('t-status-detail').innerText= `Sewa lo aktif. Sisa ${remaining} hari.`;
    }

    el('t-room-id').innerText      = u.roomId;
    el('t-room-gender').innerText  = u.roomId?.startsWith('A') ? '👨 Zona Pria' : '👩 Zona Wanita';
    el('t-days-left').innerText    = remaining >= 0 ? remaining : 0;
    el('t-rent-type').innerText    = u.rentType==='yearly' ? 'Tahunan' : 'Bulanan';
    el('t-pay-status-val').innerText= u.payStatus==='lunas' ? '✅ Lunas' : fine>0 ? '⚠️ Denda' : '⏳ Pending';
    el('t-start-date').innerText   = fmtDate(u.startDate);
    el('t-end-date').innerText     = fmtDate(u.endDate);
    el('t-price').innerText        = fmtRp(u.price||0);
}

function renderTenantBilling(u) {
    if (!u.roomId) {
        el('t-bill-no-room').style.display = 'block';
        el('t-bill-content').style.display = 'none';
        return;
    }
    el('t-bill-no-room').style.display = 'none';
    el('t-bill-content').style.display = 'block';

    const fine  = calcFine(u);
    const total = (u.price||0) + fine;

    el('t-bill-amount').innerText = fmtRp(u.price||0);
    el('t-bill-fine').innerText   = fmtRp(fine);
    el('t-bill-total').innerText  = fmtRp(total);

    const rows = [
        { label:'Harga Sewa', val:fmtRp(u.price||0), color:'var(--text)' },
        { label:'Tipe Sewa',  val:u.rentType==='yearly'?'Tahunan (10 bulan harga)':'Bulanan', color:'var(--muted)' },
        { label:'Jatuh Tempo',val:fmtDate(u.endDate), color:'var(--text)' },
        { label:'Status Bayar',val:u.payStatus==='lunas'?'✅ Lunas':'⏳ Menunggu Konfirmasi Admin', color:u.payStatus==='lunas'?'var(--green)':'var(--yellow)' },
        fine>0 ? { label:'Denda (5%/bulan)', val:fmtRp(fine), color:'var(--red)' }   : null,
        fine>0 ? { label:'TOTAL', val:fmtRp(total), color:'var(--accent)' } : null,
    ].filter(Boolean);

    el('t-bill-rows').innerHTML = rows.map(r=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:1px solid var(--border)">
            <span style="color:var(--muted);font-size:.82rem">${r.label}</span>
            <span style="font-weight:700;color:${r.color}">${r.val}</span>
        </div>`).join('');
}

function renderTenantKosInfo(rooms) {
    const list   = Object.values(rooms);
    const filled = list.filter(r=>r.status==='filled').length;
    const empty  = list.length - filled;
    const pct    = Math.round(filled/list.length*100);

    el('ti-filled').innerText = filled;
    el('ti-empty').innerText  = empty;
    el('ti-pct').innerText    = pct + '%';

    const roomCard = r => `<div style="background:var(--surface2);border:1px solid ${r.status==='empty'?'rgba(34,197,94,.25)':'rgba(249,115,22,.2)'};border-radius:10px;padding:10px;text-align:center">
        <div style="font-weight:800;font-size:.82rem">${r.id}</div>
        <div style="font-size:.6rem;margin-top:4px;font-weight:700;color:${r.status==='empty'?'var(--green)':'var(--accent)'}">${r.status==='empty'?'Kosong':'Terisi'}</div>
    </div>`;

    el('ti-male-grid').innerHTML   = list.filter(r=>r.gender==='male').map(roomCard).join('');
    el('ti-female-grid').innerHTML = list.filter(r=>r.gender==='female').map(roomCard).join('');
}

// ── FINE NOTIFICATION BANNER ──
function showFineNotif(tenant) {
    const banner = el('fine-banner');
    if (!banner) return;

    const fine      = calcFine(tenant);
    const remaining = tenant.endDate ? daysBetween(Date.now(), tenant.endDate) : null;

    if (fine > 0) {
        el('fine-banner-icon').innerText = '🚨';
        el('fine-banner-msg').innerHTML  =
            `Kamu memiliki <strong>denda ${fmtRp(fine)}</strong> karena terlambat bayar. Segera hubungi admin!`;
        banner.className     = 'fine-banner danger';
        banner.style.display = 'flex';
    } else if (remaining !== null && remaining <= 7 && remaining >= 0) {
        el('fine-banner-icon').innerText = '⏰';
        el('fine-banner-msg').innerHTML  =
            `Sewa lo akan berakhir dalam <strong>${remaining} hari</strong> (${fmtDate(tenant.endDate)}). Segera perpanjang!`;
        banner.className     = 'fine-banner warn';
        banner.style.display = 'flex';
    } else if (remaining !== null && remaining < 0 && fine === 0) {
        el('fine-banner-icon').innerText = '⚠️';
        el('fine-banner-msg').innerHTML  =
            `Masa sewa lo sudah berakhir. Denda akan berlaku dalam <strong>${LATE_GRACE_DAYS - Math.abs(remaining)} hari</strong> lagi.`;
        banner.className     = 'fine-banner warn';
        banner.style.display = 'flex';
    } else {
        banner.style.display = 'none';
    }
}

// ══════════════════════════════════════════════════
// ⑫ FORM UI HELPERS
// ══════════════════════════════════════════════════
window.togglePw = (id, btn) => {
    const input = el(id);
    const show  = input.type === 'password';
    input.type  = show ? 'text' : 'password';
    btn.innerText = show ? '🙈' : '👁';
};

window.chkUsername = val => {
    const elU = el('r-user-chk');
    const ok  = /^[a-z0-9_]{3,20}$/.test(val.toLowerCase());
    elU.innerText   = val ? (ok ? '✅ Format username valid' : '⚠️ 3-20 karakter, a-z/0-9/_ saja') : '';
    elU.style.color = ok ? 'var(--green)' : '#f97316';
};

window.chkStrength = pw => {
    let s = 0;
    if (pw.length>=6) s++; if (pw.length>=10) s++;
    if (/[A-Z]/.test(pw)) s++; if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    const lvl = [
        {p:'0%',  c:'transparent', t:''},
        {p:'20%', c:'#ef4444',     t:'😬 Terlalu lemah'},
        {p:'45%', c:'#f97316',     t:'😐 Lumayan'},
        {p:'70%', c:'#eab308',     t:'🙂 Cukup kuat'},
        {p:'88%', c:'#22c55e',     t:'😎 Kuat'},
        {p:'100%',c:'#16a34a',     t:'🔒 Sangat kuat!'},
    ][s] || {p:'0%',c:'transparent',t:''};
    el('s-fill').style.cssText = `width:${lvl.p};background:${lvl.c}`;
    const lbl = el('s-lbl');
    lbl.innerText   = lvl.t;
    lbl.style.color = lvl.c;
};

// Close modals on overlay click
el('assign-modal')?.addEventListener('click', e => { if (e.target===el('assign-modal')) window.closeAssignModal(); });
el('evict-modal')?.addEventListener('click',  e => { if (e.target===el('evict-modal'))  window.closeEvictModal();  });

// Enter key in auth forms
document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const modalOpen = el('auth-modal')?.classList.contains('show');
    if (!modalOpen) return;
    const loginVis = el('auth-form-login')?.style.display !== 'none';
    const regVis   = el('auth-form-register')?.style.display !== 'none';
    if (loginVis) window.handleLogin();
    else if (regVis) window.handleRegister();
});
