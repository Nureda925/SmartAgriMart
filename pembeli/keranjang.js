/* =========================================
   1. SETUP & HELPER FUNCTIONS
   ========================================= */

let pesanan = JSON.parse(localStorage.getItem("pesanan")) || [];

// Format Rupiah
function formatRupiah(angka) {
    if (!angka && angka !== 0) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(angka);
}

// Tunggu Library Firebase Siap
function waitForFirebase() {
    return new Promise((resolve) => {
        const check = () => {
            if (window.FireBaseApp && window.FireBaseApp.rtdb) {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

/* =========================================
   2. RENDER KERANJANG (Tampilan UI)
   ========================================= */

function renderCart() {
    const container = document.getElementById("cart-content");
    
    // Jika keranjang kosong
    if (pesanan.length === 0) {
        container.innerHTML = `
            <div class="empty-cart" style="text-align:center; padding:50px;">
                <div style="font-size:50px;">🛍️</div>
                <h2>Keranjang belanja Anda kosong</h2>
                <p>Mulailah menambahkan sayuran segar ke keranjang!</p>
                <button onclick="window.location.href='produk.html'" style="padding:10px 20px; background:#28a745; color:white; border:none; border-radius:5px; cursor:pointer; margin-top:10px;">
                    Mulai Belanja →
                </button>
            </div>
        `;
        return;
    }

    let total = 0;
    let itemsHTML = '';

    pesanan.forEach((item, index) => {
        let hargaAngka = item.harga;
        if (typeof item.harga === 'string') {
            hargaAngka = parseInt(item.harga.replace(/[^0-9]/g, ''));
        }

        const subtotal = hargaAngka * item.jumlah;
        total += subtotal;

        itemsHTML += `
            <div class="cart-card" style="display:flex; gap:15px; background:white; padding:15px; margin-bottom:15px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1); align-items:center;">
                <img src="${item.gambar}" alt="${item.nama}" style="width:80px; height:80px; object-fit:cover; border-radius:5px;">
                <div class="cart-info" style="flex:1;">
                    <h3 style="margin:0 0 5px 0;">${item.nama}</h3>
                    <p class="price" style="margin:0; color:#28a745;">${formatRupiah(hargaAngka)} / item</p>
                    <div class="qty-box" style="margin-top:10px;">
                        <button onclick="ubahQty(${index}, -1)" style="width:30px;">−</button>
                        <span style="margin:0 10px;">${item.jumlah}</span>
                        <button onclick="ubahQty(${index}, 1)" style="width:30px;">+</button>
                    </div>
                </div>
                <div style="text-align:right;">
                    <div class="subtotal" style="font-weight:bold; margin-bottom:10px;">${formatRupiah(subtotal)}</div>
                    <button class="remove-btn" onclick="hapusItem(${index})" style="background:none; border:none; color:red; cursor:pointer;">🗑️ Hapus</button>
                </div>
            </div>
        `;
    });

    const layoutHTML = `
        <div class="cart-layout" style="display:flex; flex-wrap:wrap; gap:20px;">
            <div class="cart-items" style="flex:2; min-width:300px;">
                ${itemsHTML}
            </div>
            <div class="summary-box" style="flex:1; background:white; padding:20px; border-radius:8px; height:fit-content; box-shadow:0 1px 3px rgba(0,0,0,0.1); min-width:250px;">
                <h3>Ringkasan Pesanan</h3>
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <span>Subtotal</span>
                    <span id="subtotal">${formatRupiah(total)}</span>
                </div>
                <hr style="margin:10px 0; border:0; border-top:1px solid #eee;">
                <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:1.2rem; margin-bottom:20px;">
                    <span>Total</span>
                    <span id="total">${formatRupiah(total)}</span>
                </div>
                <button class="btn-pesan" onclick="pesanSekarang()" style="width:100%; padding:12px; background:#28a745; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold; font-size:1rem;">
                    Pesan Sekarang
                </button>
                <button class="btn-lanjut" onclick="window.location.href='produk.html'" style="width:100%; padding:10px; background:white; border:1px solid #ddd; border-radius:5px; cursor:pointer; margin-top:10px;">
                    Lanjutkan Belanja
                </button>
            </div>
        </div>
    `;

    container.innerHTML = layoutHTML;
}

// Fungsi Ubah Quantity
window.ubahQty = function(index, value) {
    if (!pesanan[index].jumlah) pesanan[index].jumlah = 1;
    pesanan[index].jumlah += value;
    if (pesanan[index].jumlah < 1) pesanan[index].jumlah = 1;
    localStorage.setItem("pesanan", JSON.stringify(pesanan));
    renderCart();
    updateCartBadge();
};

// Fungsi Hapus Item
window.hapusItem = function(index) {
    if(confirm("Hapus produk ini?")) {
        pesanan.splice(index, 1);
        localStorage.setItem("pesanan", JSON.stringify(pesanan));
        renderCart();
        updateCartBadge();
    }
};

// Fungsi Update Badge Icon Keranjang
function updateCartBadge() {
    const badge = document.getElementById("cart-count");
    if(badge) {
        const total = pesanan.reduce((sum, item) => sum + item.jumlah, 0);
        badge.innerText = total > 0 ? total : 0;
        badge.style.display = total > 0 ? 'inline-flex' : 'none';
    }
}

/* =========================================
   3. CHECKOUT & PENGURANGAN STOK
   ========================================= */

window.pesanSekarang = async function() {
    console.log("🚀 Tombol Pesan Ditekan");
    
    // 1. Validasi Login (Menggunakan data LocalStorage)
    const sessionData = localStorage.getItem("pembeliData");
    const sessionKey = localStorage.getItem("pembeliKey"); // Kunci ID user

    if (!sessionData || !sessionKey) {
        alert("Silakan login terlebih dahulu untuk memesan!");
        window.location.href = "login_konsumen.html"; 
        return;
    }

    const user = JSON.parse(sessionData);

    if (pesanan.length === 0) {
        alert("Keranjang kosong!");
        return;
    }

    if (!confirm("Proses pesanan sekarang?")) return;

    // Kunci tombol agar tidak diklik 2 kali
    const btnPesan = document.querySelector('.btn-pesan');
    if(btnPesan) {
        btnPesan.innerHTML = "⏳ Memproses...";
        btnPesan.disabled = true;
    }

    // 2. Tunggu koneksi Firebase
    await waitForFirebase();

    try {
        console.log("📦 Mulai Cek Stok & Transaksi...");
        const ordersBySeller = {}; 

        // --- TAHAP A: KURANGI STOK DI DATABASE ---
        for (const item of pesanan) {
            const productRef = window.FireBaseApp.rtdb.ref('products/' + item.id);

            // Transaction: Cara aman mengurangi angka di database
            await productRef.transaction((product) => {
                if (!product) return product; // Jika produk tidak ditemukan/dihapus

                if (product.stok < item.jumlah) {
                    // Jika stok kurang, batalkan transaksi dengan Error
                    throw new Error(`Stok "${product.nama}" habis atau tidak cukup!`);
                }

                // Kurangi Stok
                product.stok -= item.jumlah;
                return product;
            });
        }
        
        // --- TAHAP B: SIAPKAN DATA PESANAN ---
        for (const item of pesanan) {
            // Ambil detail terbaru (untuk cari tahu siapa penjualnya/Petani)
            const snapshot = await window.FireBaseApp.rtdb.ref('products/' + item.id).get();
            let sellerId = "ADMIN"; 
            
            if (snapshot.exists()) {
                const val = snapshot.val();
                if (val.farmerId) sellerId = val.farmerId;
            }

            if (!ordersBySeller[sellerId]) ordersBySeller[sellerId] = [];

            // Bersihkan format harga
            let hargaAngka = item.harga;
            if (typeof item.harga === 'string') {
                hargaAngka = parseInt(item.harga.replace(/[^0-9]/g, ''));
            }

            ordersBySeller[sellerId].push({
                nama: item.nama,
                gambar: item.gambar,
                harga: hargaAngka,
                qty: item.jumlah,
                subtotal: hargaAngka * item.jumlah
            });
        }

        // --- TAHAP C: KIRIM KE DATABASE 'ORDERS' ---
        const promises = [];
        const tanggalSekarang = new Date().toLocaleString("id-ID", {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        for (const [sellerId, items] of Object.entries(ordersBySeller)) {
            const totalOrder = items.reduce((sum, i) => sum + i.subtotal, 0);

            const orderData = {
                orderId: "ORD-" + Date.now() + Math.floor(Math.random() * 1000), 
                
                // DATA PENTING AGAR MUNCUL DI PROFIL
                buyerId: sessionKey,    // ID Database User (PMB_...)
                buyer: user.nama || user.email, 
                email: user.email,
                total: totalOrder, 
                date: tanggalSekarang,
                timestamp: firebase.database.ServerValue.TIMESTAMP, 
                status: "waiting", 
                sellerId: sellerId,
                items: items
            };
            
            // Simpan ke Tabel Orders
            const pushPromise = window.FireBaseApp.rtdb.ref('orders').push(orderData);
            promises.push(pushPromise);
        }

        await Promise.all(promises);

        // --- SUKSES ---
        console.log("✅ Pesanan Berhasil!");
        alert("✅ Pesanan Berhasil Dibuat!");
        localStorage.removeItem("pesanan"); // Kosongkan keranjang
        window.location.href = "profile.html?tab=pesanan"; // Arahkan ke profil untuk lihat pesanan

    } catch (error) {
        console.error("❌ Error Checkout:", error);
        alert("Gagal memproses pesanan: " + error.message);
        
        // Kembalikan tombol jika gagal
        if(btnPesan) {
            btnPesan.innerHTML = "Pesan Sekarang";
            btnPesan.disabled = false;
        }
    }
};

// Jalankan saat halaman siap
document.addEventListener('DOMContentLoaded', () => {
    renderCart();
    updateCartBadge();
});