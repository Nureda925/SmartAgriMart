/* =========================================
   1. SETUP & HELPER FUNCTIONS
   ========================================= */

let allProducts = []; // Variabel global untuk menampung data produk

// Format Angka ke Rupiah (Contoh: Rp 15.000)
function formatRupiah(angka) {
    if (!angka && angka !== 0) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(angka);
}

// Fungsi menunggu Firebase siap
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
   2. LOAD DATA DARI FIREBASE (RTDB)
   ========================================= */

async function loadProducts() {
    const container = document.getElementById("produkContainer");
    
    // Tampilkan loading sementara
    if(container) container.innerHTML = '<p style="text-align:center; padding:20px;">Memuat produk...</p>';

    await waitForFirebase(); 
    
    if (!container) return; 

    // Referensi ke database 'products'
    const dbRef = window.FireBaseApp.rtdb.ref('products');

    // QUERY: Ambil data produk yang statusnya 'approved'
    dbRef.orderByChild('status').equalTo('approved').on('value', (snapshot) => {
        allProducts = []; // Reset array

        if (!snapshot.exists()) {
            renderProduk([]); // Render empty state jika tidak ada data
            return;
        }

        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            allProducts.push({
                id: childSnapshot.key,
                nama: data.nama,
                deskripsi: data.deskripsi || "Kualitas terbaik dari petani lokal.",
                harga: parseInt(data.harga) || 0,
                stok: parseInt(data.stok) || 0,
                gambar: data.gambar || 'https://via.placeholder.com/150'
            });
        });

        renderProduk(allProducts);

    }, (error) => {
        console.error("Error loading products:", error);
        container.innerHTML = `<p style="color:red; text-align:center;">Gagal memuat produk. Periksa koneksi internet.</p>`;
    });
}

/* =========================================
   3. RENDER TAMPILAN (DOM MANIPULATION)
   ========================================= */

function renderProduk(items) {
    const container = document.getElementById("produkContainer");
    if(!container) return;

    container.innerHTML = ""; // Bersihkan isi container

    // --- LOGIKA EMPTY STATE BARU ---
    if (items.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🍃</div>
            <h3>Belum Ada Produk Segar</h3>
            <p>Petani kami sedang memanen sayuran terbaik. Silakan cek kembali nanti ya!</p>
          </div>
        `;
        
        // Ubah layout container agar pesan di tengah
        container.classList.remove('product-grid');
        container.classList.add('container-empty');

        // Pasang event listener untuk tombol refresh (karena onclick di HTML string tidak disarankan)
        document.getElementById('refreshBtn').addEventListener('click', loadProducts);
        return;
    }

    // Jika ada produk, kembalikan layout grid
    container.classList.remove('container-empty');
    container.classList.add('product-grid');

    let html = "";
    items.forEach(p => {
        // Logika Stok
        const isHabis = p.stok <= 0;
        const btnClass = isHabis ? 'btn-keranjang disabled' : 'btn-keranjang pesan-btn';
        const btnStyle = isHabis ? 'background:#ccc; cursor:not-allowed;' : '';
        const btnText = isHabis ? 'Stok Habis' : '🛒 Tambah';
        const btnAttr = isHabis ? 'disabled' : `
            data-id="${p.id}" 
            data-name="${p.nama}" 
            data-price="${p.harga}" 
            data-img="${p.gambar}"`;

        html += `
          <div class="card">
            <div style="height:200px; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#f9f9f9; position:relative;">
                <img src="${p.gambar}" alt="${p.nama}" style="width:100%; height:100%; object-fit:cover;">
                ${isHabis ? '<div style="position:absolute; background:rgba(0,0,0,0.5); color:white; padding:5px 10px; border-radius:4px;">Habis</div>' : ''}
            </div>
            <div class="card-content">
              <h3>${p.nama}</h3>
              <p style="font-size:12px; color:#666; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 36px; margin-bottom:10px;">
                ${p.deskripsi}
              </p>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                 <span class="price" style="font-weight:bold; color:#22c55e; font-size:16px;">${formatRupiah(p.harga)}</span>
                 <span class="stock" style="font-size:12px; color:${isHabis ? 'red' : '#64748b'};">Stok: ${p.stok}</span>
              </div>
              <button class="${btnClass}" style="${btnStyle}" ${btnAttr}>
                ${btnText}
              </button>
            </div>
          </div>
        `;
    });

    container.innerHTML = html;
    attachOrderButtons();
}

/* =========================================
   4. FITUR KERANJANG (LOCALSTORAGE)
   ========================================= */

function updateCartBadge() {
    const badge = document.getElementById("cart-count");
    if (!badge) return;

    const pesanan = JSON.parse(localStorage.getItem("pesanan")) || [];
    const totalQty = pesanan.reduce((total, item) => total + item.jumlah, 0);

    if (totalQty > 0) {
        badge.textContent = totalQty;
        badge.style.display = "inline-flex"; // Gunakan inline-flex agar bulat sempurna
    } else {
        badge.style.display = "none";
    }
}

function attachOrderButtons() {
    // Gunakan event delegation atau pasang listener langsung
    document.querySelectorAll(".pesan-btn").forEach(btn => {
        btn.addEventListener("click", function () {
            const productId = this.dataset.id;
            const namaProduk = this.dataset.name;
            const hargaProduk = parseInt(this.dataset.price);
            const gambarProduk = this.dataset.img;

            let pesanan = JSON.parse(localStorage.getItem("pesanan")) || [];
            
            // Cek duplikasi produk
            const existingIndex = pesanan.findIndex(p => p.id === productId);

            if (existingIndex > -1) {
                pesanan[existingIndex].jumlah += 1;
            } else {
                pesanan.push({
                    id: productId,
                    nama: namaProduk,
                    harga: hargaProduk,
                    gambar: gambarProduk,
                    jumlah: 1,
                    tanggal: new Date().toLocaleString()
                });
            }

            localStorage.setItem("pesanan", JSON.stringify(pesanan));
            updateCartBadge();
            
            // Opsional: Animasi atau Feedback Visual
            const originalText = this.innerHTML;
            this.innerHTML = "✅ Masuk Keranjang";
            this.style.background = "#16a34a";
            setTimeout(() => {
                this.innerHTML = originalText;
                this.style.background = ""; // Reset ke CSS awal
            }, 1000);
        });
    });
}

/* =========================================
   5. FITUR PENCARIAN (SEARCH)
   ========================================= */

function setupSearch() {
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("keyup", function (e) {
            const keyword = e.target.value.toLowerCase();
            
            const filteredProducts = allProducts.filter(p => 
                p.nama.toLowerCase().includes(keyword) || 
                p.deskripsi.toLowerCase().includes(keyword)
            );

            renderProduk(filteredProducts);
        });
    }
}

/* =========================================
   6. INISIALISASI
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    updateCartBadge();
    setupSearch();
});