// --- GLOBAL VARIABLES ---
let currentUserAuth = null; // Data user dari Login (Auth)
let dbUserKey = null;       // Kunci unik di Database (contoh: PMB_1765...)
let currentUserData = null; // Data lengkap dari Database
const defaultFoto = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

// --- REFERENSI ELEMENT HTML ---
const fotoProfilImg = document.getElementById("fotoProfil");
const editBtn = document.getElementById("editBtn");
const logoutBtn = document.getElementById("logoutBtn");
const cameraBtn = document.getElementById("cameraBtn");
const inputGaleri = document.getElementById("inputGaleri");

const tabProfil = document.getElementById("tabProfil");
const tabPesanan = document.getElementById("tabPesanan");
const profilSection = document.getElementById("profilSection");
const pesananSection = document.getElementById("pesananSection");

// --- 1. INISIALISASI APLIKASI ---
document.addEventListener('DOMContentLoaded', () => {
    // Cek apakah Firebase sudah siap loading
    const checkFirebase = setInterval(() => {
        if (window.FireBaseApp && window.FireBaseApp.auth) {
            clearInterval(checkFirebase);
            initApp();
        }
    }, 100);
});

// --- Masukkan ini di dalam file Javascript halaman PROFIL ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cek apakah ada request khusus dari URL untuk buka tab pesanan
    const urlParams = new URLSearchParams(window.location.search);
    const tabRequest = urlParams.get('tab');

    // 2. Jika ada request "pesanan", otomatis klik tab tersebut
    if (tabRequest === 'pesanan') {
        console.log("🔄 Membuka Tab Pesanan Otomatis...");
        
        // Pastikan variabel 'tabPesanan' sudah didefinisikan di atas
        // atau ambil elemennya langsung:
        const btnTabPesanan = document.getElementById("tabPesanan");
        
        if (btnTabPesanan) {
            btnTabPesanan.click(); // <--- INI KUNCINYA (Simulasi Klik)
        }
    }
});

function initApp() {
    const auth = window.FireBaseApp.auth;
    
    // Listener Status Login
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log("Login terdeteksi:", user.email);
            currentUserAuth = user;
            
            // PENTING: Cari data detail di database berdasarkan Email
            findUserByEmail(user.email);
            
            // Update angka keranjang
            updateCartBadge();
        } else {
            // Jika tidak login, kembalikan ke halaman login
            console.warn("User belum login");
            window.location.href = "login_konsumen.html"; 
        }
    });
}

/* ============================================================
   2. LOGIKA MENCARI DATA USER (BY EMAIL)
   ============================================================ */
function findUserByEmail(email) {
    const rtdb = window.FireBaseApp.rtdb;
    // Arahkan ke folder 'pembeli' sesuai gambar database Anda
    const pembeliRef = rtdb.ref('pembeli');
    
    // Query mencari data yang email-nya sama
    pembeliRef.orderByChild('email').equalTo(email).on('value', (snapshot) => {
        if (snapshot.exists()) {
            // Data Ditemukan!
            const data = snapshot.val();
            // Ambil ID kuncinya (PMB_...)
            const key = Object.keys(data)[0];
            
            dbUserKey = key;           // Simpan kunci PMB...
            currentUserData = data[key]; // Simpan data user
            
            // Tampilkan Data ke Layar
            renderUserProfile(currentUserData);
            
            // Ambil Riwayat Pesanan menggunakan ID PMB ini
            listenToUserOrders(dbUserKey);
            
        } else {
            console.error("Email login benar, tapi data tidak ada di tabel 'pembeli'.");
            document.getElementById("email").value = email; // Setidaknya isi email
        }
    });
}

function renderUserProfile(data) {
    // 1. Isi Form Input
    // Menggunakan operator || agar tidak error jika kosong
    document.getElementById("nama").value = data.nama || "";
    document.getElementById("email").value = data.email || ""; 
    // Field di database Anda bernama 'telepon', tapi ID HTML-nya 'phone'
    document.getElementById("phone").value = data.telepon || data.no_hp || "";
    
    // Password kita samarkan
    document.getElementById("password").value = data.password || "";

    // 2. Tampilkan Foto Profil
    loadUserPhoto(data);

    // 3. Tampilkan Tanggal Bergabung
    const tglGabung = document.getElementById("tanggalBergabung");
    if (tglGabung && data.createdAt) {
        // Konversi angka timestamp ke format tanggal
        const date = new Date(Number(data.createdAt)); 
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        tglGabung.innerHTML = "📅 Bergabung: " + date.toLocaleDateString("id-ID", options);
    }
}

/* ============================================================
   3. LOGIKA FOTO PROFIL (LOAD & UPLOAD)
   ============================================================ */
function loadUserPhoto(data) {
    if (data.foto && data.foto !== "") {
        fotoProfilImg.src = data.foto;
    } else {
        fotoProfilImg.src = defaultFoto;
    }
}

// Event Klik Tombol Kamera
if (cameraBtn) {
    cameraBtn.onclick = () => {
        inputGaleri.click(); // Buka file manager
    };
}

// Event Saat File Dipilih
if (inputGaleri) {
    inputGaleri.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validasi Ukuran (Maks 2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert("Ukuran foto terlalu besar (Maks 2MB)");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const base64Img = evt.target.result;
            
            // 1. Update Tampilan Langsung (Supaya cepat)
            fotoProfilImg.src = base64Img;

            // 2. Simpan ke Database
            if (dbUserKey) {
                try {
                    await window.FireBaseApp.rtdb.ref('pembeli/' + dbUserKey).update({
                        foto: base64Img
                    });
                    // console.log("Foto tersimpan");
                } catch (err) {
                    alert("Gagal upload foto: " + err.message);
                    // Reset foto jika gagal
                    loadUserPhoto(currentUserData);
                }
            }
        };
        reader.readAsDataURL(file);
    };
}

/* ============================================================
   4. LOGIKA EDIT & SIMPAN DATA
   ============================================================ */
let isEditing = false;

if (editBtn) {
    editBtn.onclick = async () => {
        isEditing = !isEditing;
        
        // Input yang boleh diedit
        const inputs = [
            document.getElementById("nama"),
            document.getElementById("phone")
        ];

        // Ubah status disabled
        inputs.forEach(input => {
            input.disabled = !isEditing;
            input.style.border = isEditing ? "1px solid #16a34a" : "1px solid #ddd";
        });

        // Ubah Tampilan Tombol
        editBtn.classList.toggle("active", isEditing);

        if (isEditing) {
            // Mode Edit Aktif
            editBtn.innerHTML = "💾 Simpan";
            document.getElementById("nama").focus();
        } else {
            // Mode Simpan (User menekan Simpan)
            editBtn.innerHTML = "✏️ Edit";
            await saveProfileChanges();
        }
    };
}

async function saveProfileChanges() {
    if (!dbUserKey) return;

    const newNama = document.getElementById("nama").value;
    const newPhone = document.getElementById("phone").value;

    if (!newNama.trim()) {
        alert("Nama tidak boleh kosong");
        return;
    }

    try {
        // Update data ke node pembeli/[ID_PMB]
        await window.FireBaseApp.rtdb.ref('pembeli/' + dbUserKey).update({
            nama: newNama,
            telepon: newPhone
        });
        alert("✅ Data berhasil diperbarui!");
    } catch (error) {
        console.error(error);
        alert("❌ Gagal menyimpan data.");
    }
}

/* ============================================================
   5. LOGIKA RIWAYAT PESANAN
   ============================================================ */
function listenToUserOrders(pembeliId) {
    const rtdb = window.FireBaseApp.rtdb;
    const container = document.getElementById("pesananContainer");
    
    // Ambil order yang buyerId-nya == ID Pembeli (PMB_...)
    const ordersRef = rtdb.ref('orders').orderByChild('buyerId').equalTo(pembeliId);

    ordersRef.on('value', (snapshot) => {
        const orders = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                orders.push({ id: child.key, ...child.val() });
            });
            
            // Urutkan (Terbaru di atas)
            orders.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            
            renderOrdersHTML(orders);
        } else {
            container.innerHTML = `<div style="padding:40px; text-align:center; color:#888;">Belum ada riwayat pesanan.</div>`;
        }
    });
}
/* ============================================================
   FUNGSI RENDER PESANAN (VERSI LENGKAP & SUPORT BANYAK STATUS)
   ============================================================ */
function renderOrdersHTML(orders) {
    const container = document.getElementById("pesananContainer");
    
    if (!orders || orders.length === 0) {
        container.innerHTML = `<div style="padding:40px; text-align:center; color:#888;">Belum ada riwayat pesanan.</div>`;
        return;
    }

    container.innerHTML = orders.map(p => {
        // 1. Ambil status dan ubah ke huruf kecil
        const s = String(p.status || "").toLowerCase();
        
        // DEBUG: Cek console untuk melihat status asli dari database
        console.log(`[DEBUG] ID: ${p.orderId} | Status: "${s}"`);

        // 2. Default (Jika status tidak dikenali)
        let stClass = "status-proses"; 
        let stText = "⏳ Diproses";

        // 3. LOGIKA PENCOCOKAN STATUS

        // A. MENUNGGU (Waiting)
        if (s === 'waiting' || s === 'menunggu' || s === 'pending') {
            stClass = "status-menunggu";
            stText = "🕒 Menunggu Konfirmasi";
        }
        
        // B. DIPROSES (Accepted)
        else if (s === 'accepted' || s === 'diproses' || s === 'sedang dikemas' || s === 'dikemas') {
            stClass = "status-proses";
            stText = "👨‍🌾 Sedang Disiapkan";
        }
        
        // C. SIAP DIAMBIL (Ready)
        // Pastikan kata 'ready' ada disini
        else if (s === 'ready' || s.includes('siap') || s.includes('diantar')) {
            stClass = "status-siap";
            stText = "📦 Siap Diambil";
        }
        
        // D. SELESAI (Finished) <--- PERBAIKAN DISINI
        // Kita tambahkan 'finished' agar cocok dengan data dari Petani
        else if (s === 'finished' || s === 'done' || s.includes('selesai') || s === 'completed') {
            stClass = "status-selesai";
            stText = "✅ Selesai";
        }
        
        // E. BATAL (Rejected)
        else if (s === 'rejected' || s.includes('batal') || s.includes('tolak')) {
            stClass = "status-dibatalkan";
            stText = "❌ Dibatalkan";
        }

        // --- RENDER HTML KARTU ---
        
        const totalRp = parseInt(p.total || 0).toLocaleString('id-ID');
        const itemsList = (p.items || []).map(i => `
            <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:5px; color:#555;">
                <span>${i.nama} x ${i.qty}</span>
                <span>Rp${parseInt(i.harga * i.qty).toLocaleString('id-ID')}</span>
            </div>
        `).join("");
        
        let tgl = p.date || "-";

        return `
            <div class="pesanan-card" style="background:white; border:1px solid #eee; border-radius:10px; padding:15px; margin-bottom:15px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; margin-bottom:12px; align-items:center;">
                    <div>
                        <strong style="display:block; font-size:14px; color:#333;">Order #${p.orderId || ""}</strong>
                        <small style="color:#999; font-size:11px;">${tgl}</small>
                    </div>
                    <span class="${stClass}" style="padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; color: white;">
                        ${stText}
                    </span>
                </div>
                <hr style="border:0; border-top:1px dashed #eee; margin:10px 0;">
                <div style="margin-bottom:12px;">${itemsList}</div>
                <div style="text-align:right;">
                    <strong style="color:#16a34a; font-size:15px;">Total: Rp${totalRp}</strong>
                </div>
            </div>
        `;
    }).join("");

    addDynamicStyles(); // Pastikan CSS warnanya dimuat
}

// Pastikan fungsi CSS ini juga ada di file profil Anda
function addDynamicStyles() {
    if (document.getElementById("status-colors-css")) return;
    const style = document.createElement('style');
    style.id = "status-colors-css";
    style.innerHTML = `
        .status-menunggu { background-color: #f59e0b; }
        .status-proses { background-color: #3b82f6; }
        .status-siap { background-color: #10b981; }  /* Hijau Teal */
        .status-selesai { background-color: #15803d; } /* Hijau Tua */
        .status-dibatalkan { background-color: #ef4444; }
    `;
    document.head.appendChild(style);
}

/* ============================================================
   6. UI HELPERS (TAB, LOGOUT, DLL)
   ============================================================ */

// Tab Switch
tabProfil.onclick = () => {
    tabProfil.classList.add("active"); tabPesanan.classList.remove("active");
    profilSection.classList.add("active"); pesananSection.classList.remove("active");
};
tabPesanan.onclick = () => {
    tabPesanan.classList.add("active"); tabProfil.classList.remove("active");
    pesananSection.classList.add("active"); profilSection.classList.remove("active");
};

// Logout System
const popupLogout = document.getElementById("popupLogout");
const confirmLogout = document.getElementById("confirmLogout");
const cancelLogout = document.getElementById("cancelLogout");

if (logoutBtn) logoutBtn.onclick = () => popupLogout.style.display = "flex";
if (cancelLogout) cancelLogout.onclick = () => popupLogout.style.display = "none";

if (confirmLogout) confirmLogout.onclick = async () => {
    try {
        await window.FireBaseApp.auth.signOut();
        // Bersihkan data lokal jika ada
        localStorage.removeItem("pembeliData");
        window.location.href = "login_konsumen.html";
    } catch (e) {
        alert("Gagal Logout: " + e.message);
    }
};

// Password Toggle (Lihat Password)
const togglePw = document.getElementById("togglePw");
const pwInput = document.getElementById("password");
if (togglePw) {
    togglePw.onclick = () => {
        const type = pwInput.type === "password" ? "text" : "password";
        pwInput.type = type;
    };
}

// Update Badge Keranjang (Dari LocalStorage)
function updateCartBadge() {
    const badge = document.getElementById("cart-count");
    if (!badge) return;
    
    const keranjang = JSON.parse(localStorage.getItem("pesanan")) || [];
    const total = keranjang.reduce((sum, item) => sum + (item.jumlah || 1), 0);
    
    badge.textContent = total;
    badge.style.display = total > 0 ? "inline-block" : "none";
}