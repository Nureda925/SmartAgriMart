/* =========================================
   1. HELPER FUNCTIONS (FORMAT DATA)
   ========================================= */

// Format Angka ke Rupiah (Contoh: Rp 15.000)
function formatRupiah(angka) {
    if (!angka && angka !== 0) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(angka);
}

// Format Tanggal dari Timestamp (Contoh: 12 Des 2025, 14:30)
function formatTanggal(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp); 
    return date.toLocaleString('id-ID', { 
        day: 'numeric', month: 'short', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
    });
}

/* =========================================
   2. INITIALIZE & LISTEN DATA (REALTIME DB)
   ========================================= */

// Fungsi untuk memastikan Firebase sudah siap sebelum mengambil data
function waitForFirebase() {
    return new Promise((resolve) => {
        const check = () => {
            // Mengecek apakah global object FireBaseApp dari firebase-config.js sudah ada
            if (window.FireBaseApp && window.FireBaseApp.rtdb && window.FireBaseApp.auth) {
                resolve();
            } else {
                setTimeout(check, 100); // Cek lagi setiap 100ms
            }
        };
        check();
    });
}

// Fungsi Utama: Memuat dan Mendengarkan Data Produk Pending
async function loadProdukPending() {
    await waitForFirebase(); // Tunggu koneksi stabil
    
    const produkList = document.getElementById("produkList");
    const dbRef = window.FireBaseApp.rtdb.ref('products');

    // QUERY: Ambil data di tabel 'products' yang field 'status' == 'pending'
    // Listener .on() membuat data update otomatis (realtime) tanpa refresh page
    dbRef.orderByChild('status').equalTo('pending').on('value', (snapshot) => {
        
        produkList.innerHTML = ''; // Bersihkan container sebelum render ulang

        // Jika tidak ada data
        if (!snapshot.exists()) {
            produkList.innerHTML = `
                <div style="width:100%; text-align:center; padding: 40px; color: #888;">
                    <i class="fas fa-clipboard-check" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p>Tidak ada produk tertunda saat ini.</p>
                </div>`;
            return;
        }

        // Konversi snapshot object ke array agar bisa disortir
        const items = [];
        snapshot.forEach((childSnapshot) => {
            items.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });

        // Urutkan: Terbaru di atas (berdasarkan createdAt)
        items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        // Render HTML Card
        items.forEach((p) => {
            // Gunakan gambar placeholder jika gambar rusak/kosong
            const gambarSrc = p.gambar || 'https://via.placeholder.com/150?text=No+Image';
            const namaPetani = p.farmerId || 'Petani'; 

            // Template Literal HTML (Sesuai struktur CSS Anda)
            const cardHtml = `
              <div class="product-card">
                <img src="${gambarSrc}" alt="${p.nama}">
        
                <div class="product-info">
                  <h3>
                    ${p.nama} 
                    <span class="status" style="background:#fff3cd; color:#856404; padding:2px 6px; font-size:10px; border-radius:4px; vertical-align:middle; margin-left:5px;">TERTUNDA</span>
                  </h3>
                  <small style="color:#666;">ID Petani: ${namaPetani}</small>
        
                  <div class="product-details">
                    <p>Harga : <span class="harga" style="font-weight:bold; color:#28a745;">${formatRupiah(p.harga)}</span></p>
                    <p>Stok : <span>${p.stok}</span></p>
                    <p>Tanggal : <span>${formatTanggal(p.createdAt)}</span></p>
                    <p style="font-size:12px; color:#555; margin-top:8px; font-style:italic; line-height:1.4;">
                        "${p.deskripsi ? (p.deskripsi.length > 50 ? p.deskripsi.substring(0,50)+'...' : p.deskripsi) : '-'}"
                    </p>
                  </div>
                </div>
        
                <div class="product-footer">
                  <button class="btn btn-green" onclick="setujui('${p.id}')">
                    <i class="fas fa-check"></i> Setujui
                  </button>
                  <button class="btn btn-red" onclick="tolak('${p.id}')">
                    <i class="fas fa-times"></i> Tolak
                  </button>
                </div>
              </div>
            `;
            
            // Masukkan ke dalam container
            produkList.innerHTML += cardHtml;
        });
    }, (error) => {
        console.error("Error fetching data:", error);
        produkList.innerHTML = `<p style="color:red; text-align:center;">Gagal memuat data. Periksa koneksi internet.</p>`;
    });
}

/* =========================================
   3. ACTION FUNCTIONS (UPDATE STATUS)
   ========================================= */

// Fungsi Setujui Produk
window.setujui = function(productId) {
    if(confirm("Yakin ingin menyetujui produk ini agar tampil di katalog?")) {
        const updates = {};
        updates['/status'] = 'approved';
        updates['/approvedAt'] = firebase.database.ServerValue.TIMESTAMP; // Gunakan waktu server

        window.FireBaseApp.rtdb.ref('products/' + productId).update(updates)
        .then(() => {
            console.log(`Produk ${productId} disetujui.`);
            // Tidak perlu alert/reload, UI akan update otomatis karena listener .on()
        })
        .catch((error) => {
            alert("Gagal update: " + error.message);
        });
    }
};

// Fungsi Tolak Produk
window.tolak = function(productId) {
    if(confirm("Yakin ingin menolak produk ini? Produk akan dikembalikan ke status Ditolak.")) {
        const updates = {};
        updates['/status'] = 'rejected';
        updates['/rejectedAt'] = firebase.database.ServerValue.TIMESTAMP;

        window.FireBaseApp.rtdb.ref('products/' + productId).update(updates)
        .then(() => {
            console.log(`Produk ${productId} ditolak.`);
        })
        .catch((error) => {
            alert("Gagal update: " + error.message);
        });
    }
};

/* =========================================
   4. LOGOUT & MODAL LOGIC
   ========================================= */

// Buka Modal Logout
window.openLogoutPopup = function() {
    const modal = document.getElementById("logoutModal");
    if(modal) modal.style.display = "flex";
};

// Tutup Modal Logout
window.closeLogoutPopup = function() {
    const modal = document.getElementById("logoutModal");
    if(modal) modal.style.display = "none";
};

// Eksekusi Logout Firebase
window.confirmLogout = function() {
    if (window.FireBaseApp && window.FireBaseApp.auth) {
        window.FireBaseApp.auth.signOut().then(() => {
            // Redirect ke halaman login admin
            window.location.href = 'login_admin.html';
        }).catch((err) => {
            console.error("Logout Error:", err);
            alert("Terjadi kesalahan saat logout.");
        });
    } else {
        // Fallback jika firebase belum load tapi user ingin keluar
        window.location.href = 'login_admin.html';
    }
};

// Event Listener: Tutup modal saat klik area gelap di luar modal
window.onclick = function(event) {
    const modal = document.getElementById("logoutModal");
    if (event.target == modal) {
        modal.style.display = "none";
    }
};

/* =========================================
   5. EXECUTE ON LOAD
   ========================================= */

// Jalankan fungsi load data saat HTML selesai dimuat
document.addEventListener('DOMContentLoaded', loadProdukPending);