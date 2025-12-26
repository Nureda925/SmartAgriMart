/* =========================================
   1. HELPER FUNCTIONS (Format & Security)
   ========================================= */

// Format Rupiah
function formatRupiah(angka, prefix) {
    if (!angka && angka !== 0) return '';
    var number_string = angka.toString().replace(/[^,\d]/g, ''),
        split = number_string.split(','),
        sisa = split[0].length % 3,
        rupiah = split[0].substr(0, sisa),
        ribuan = split[0].substr(sisa).match(/\d{3}/gi);

    if (ribuan) {
        separator = sisa ? '.' : '';
        rupiah += separator + ribuan.join('.');
    }
    rupiah = split[1] != undefined ? rupiah + ',' + split[1] : rupiah;
    return prefix == undefined ? rupiah : (rupiah ? 'Rp ' + rupiah : '');
}

// Mencegah XSS
function escapeHtml(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/* =========================================
   2. INITIAL STATE & FIREBASE SETUP
   ========================================= */

let produk = [];
let orders = [];
let currentUserUid = null;

// Cek Ketersediaan Firebase
function waitForFirebase() {
    return new Promise((resolve) => {
        const check = () => {
            if (window.FireBaseApp && window.FireBaseApp.rtdb && window.FireBaseApp.auth) {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

/* =========================================
   3. DATA LISTENERS (REALTIME DATABASE)
   ========================================= */

function listenToProducts() {
    if (!currentUserUid) return;
    const dbRef = FireBaseApp.rtdb.ref('products');
    
    // Ambil data produk berdasarkan farmerId
    dbRef.orderByChild('farmerId').equalTo(currentUserUid).on('value', (snapshot) => {
        produk = [];
        snapshot.forEach((child) => {
            produk.push({
                id: child.key,
                ...child.val()
            });
        });
        produk.reverse(); // Produk terbaru di atas
        renderProduk();
    });
}

function listenToOrders() {
    if (!currentUserUid) return;
    const dbRef = FireBaseApp.rtdb.ref('orders');

    // Ambil order yang ditujukan ke penjual ini (sellerId)
    // Pastikan saat pembeli checkout, field 'sellerId' tersimpan di data order
    dbRef.orderByChild('sellerId').equalTo(currentUserUid).on('value', (snapshot) => {
        orders = [];
        snapshot.forEach((child) => {
            orders.push({
                id: child.key,
                ...child.val()
            });
        });
        renderTable();
    });
}

/* =========================================
   4. DOM & EVENT LISTENERS
   ========================================= */

document.addEventListener('DOMContentLoaded', async () => {
    // A. Setup Tabs
    const produkTab = document.getElementById("produkTab");
    const pesananTab = document.getElementById("pesananTab");
    
    if (produkTab && pesananTab) {
        produkTab.addEventListener("click", () => switchTab('produk'));
        pesananTab.addEventListener("click", () => switchTab('pesanan'));
    }

    // B. Setup Input Harga (Auto Format)
    ['hargaProduk', 'editHarga'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('keyup', function(e) {
                this.value = formatRupiah(this.value, 'Rp');
            });
        }
    });

    // C. Setup Logic Popup & Tombol
    setupPopupEvents();

    // D. Tunggu Firebase Siap
    await waitForFirebase();
    
    // E. Cek Login Session
    // PENTING: Pastikan saat Login, kamu menyimpan 'petaniId' ke localStorage
    const storedUid = localStorage.getItem("petaniId"); 
    
    if(storedUid) {
        currentUserUid = storedUid;
        console.log("Login sebagai:", currentUserUid);
        listenToProducts();
        listenToOrders();
    } else {
        // Jika testing tanpa login, comment baris alert di bawah dan set ID manual:
        // currentUserUid = "petani_test_123"; listenToProducts(); listenToOrders();
        alert("Sesi habis. Silakan login kembali.");
        window.location.href = "login.html"; 
    }
});

function switchTab(tabName) {
    if (tabName === 'produk') {
        document.getElementById("produkTab").classList.add("active");
        document.getElementById("pesananTab").classList.remove("active");
        document.getElementById("produkContent").style.display = "block";
        document.getElementById("pesananContent").style.display = "none";
    } else {
        document.getElementById("pesananTab").classList.add("active");
        document.getElementById("produkTab").classList.remove("active");
        document.getElementById("produkContent").style.display = "none";
        document.getElementById("pesananContent").style.display = "block";
        renderTable();
    }
}

/* =========================================
   5. LOGIC UI (RENDER & CRUD)
   ========================================= */

// --- FUNGSI GLOBAL (Dipanggil dari HTML onclick) ---

window.tambahProduk = function() {
    resetFormTambah();
    document.getElementById("popupTambah").style.display = "flex";
};

window.openEditProduk = function(id) {
    const p = produk.find(item => item.id === id);
    if (!p) return;

    // Hanya blokir jika status Approved.
    // Rejected & Pending boleh lewat.
    if (p.status === 'approved') {
        alert("Produk sudah disetujui dan tayang, tidak dapat diedit lagi.");
        return;
    }

    currentEditId = id;
    // Isi form dengan data lama
    document.getElementById("editNama").value = p.nama;
    document.getElementById("editDeskripsi").value = p.deskripsi;
    document.getElementById("editHarga").value = formatRupiah(p.harga, 'Rp');
    document.getElementById("editStok").value = p.stok;
    document.getElementById("previewEditGambar").src = p.gambar;
    
    document.getElementById("popupEdit").style.display = "flex";
};

let currentHapusId = null;
window.openHapusProduk = function(id) {
    currentHapusId = id;
    document.getElementById("popupHapus").style.display = "flex";
};

// --- LOGIC INTERNAL ---

function renderProduk() {
    const container = document.getElementById("produkList");
    if (!container) return;

    if (produk.length === 0) {
        container.innerHTML = `<div class="empty-state" style="text-align:center; padding: 40px;">
            <p>Belum ada produk.</p>
        </div>`;
        return;
    }

    let html = `<div class="produk-grid">`;
    produk.forEach((p) => {
        let statusClass = p.status === 'approved' ? 'approved' : (p.status === 'rejected' ? 'rejected' : 'pending');
        let statusText = p.status === 'approved' ? 'Disetujui' : (p.status === 'rejected' ? 'Ditolak (Perbaiki Data)' : 'Menunggu');

        // --- LOGIKA TOMBOL ---
        // Jika Approved: DISABLE (Mati)
        // Jika Rejected atau Pending: ENABLE (Hidup)
        const isApproved = p.status === 'approved';
        
        const editBtnAttr = isApproved 
            ? `disabled style="background-color: #ccc; cursor: not-allowed; opacity: 0.6;" title="Produk disetujui tidak dapat diedit"` 
            : `onclick="openEditProduk('${p.id}')"`;
        
        // Tambahan visual: Beri border merah jika rejected agar petani sadar harus edit
        const cardStyle = p.status === 'rejected' ? 'border: 1px solid #f44336;' : '';

        html += `
            <div class="produk-card" style="${cardStyle}">
                <img src="${p.gambar}" alt="${escapeHtml(p.nama)}">
                <div class="info">
                    <h4>${escapeHtml(p.nama)}</h4>
                    <p class="desc">${escapeHtml(p.deskripsi).substring(0, 50)}...</p>
                    <div class="price">${formatRupiah(p.harga, 'Rp')}</div>
                    <small>Stok: ${p.stok}</small>
                    <span class="status-label ${statusClass}">${statusText}</span>
                    ${p.status === 'rejected' ? '<small style="color:red; display:block; margin-top:5px;">Silakan edit untuk ajukan ulang</small>' : ''}
                </div>
                <div class="actions">
                    <button class="edit-btn" ${editBtnAttr}>Edit</button>
                    <button class="delete-btn" onclick="openHapusProduk('${p.id}')">Hapus</button>
                </div>
            </div>`;
    });
    html += `</div>`;
    container.innerHTML = html;
}

function setupPopupEvents() {
    // Tutup Popup
    document.querySelectorAll('.popup-box .cancel, #btnBatal, #btnBatalEdit, #btnTidakHapus, #btnTutupDetail').forEach(btn => {
        btn.onclick = function() {
            this.closest('.popup-overlay').style.display = 'none';
        };
    });

    window.tutupPopup = () => document.getElementById("popupDetail").style.display = "none";

    // Handle Image Preview
    setupImagePreview('gambarProduk', 'previewGambar');
    setupImagePreview('editGambar', 'previewEditGambar');

    // 1. Action Tambah Produk
    document.getElementById("btnTambahProduk").onclick = () => {
        const data = ambilDataForm("namaProduk", "deskripsiProduk", "hargaProduk", "stokProduk", "previewGambar");
        if(!data) return;

        FireBaseApp.rtdb.ref('products').push({
            farmerId: currentUserUid,
            ...data,
            status: "pending",
            createdAt: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            alert("Produk berhasil ditambahkan!");
            document.getElementById("popupTambah").style.display = "none";
        });
    };

    // 2. Action Simpan Edit
    // Di dalam fungsi setupPopupEvents() ...

    // 2. Action Simpan Edit (DIPERBARUI)
    document.getElementById("btnSimpanEdit").onclick = () => {
        if(!currentEditId) return;
        
        // Ambil data dari form
        const data = ambilDataForm("editNama", "editDeskripsi", "editHarga", "editStok", "previewEditGambar");
        if(!data) return;

        data.status = "pending"; 
        
        // Opsional: Tambahkan waktu update agar Admin tahu ini data baru
        data.updatedAt = firebase.database.ServerValue.TIMESTAMP;

        FireBaseApp.rtdb.ref(`products/${currentEditId}`).update(data)
        .then(() => {
            alert("Perubahan disimpan! Produk dikirim kembali ke Admin untuk konfirmasi.");
            document.getElementById("popupEdit").style.display = "none";
        })
        .catch((error) => {
            console.error("Error updating:", error);
            alert("Gagal mengupdate produk.");
        });
    };

    // 3. Action Hapus
    document.getElementById("btnYaHapus").onclick = () => {
        if(!currentHapusId) return;
        FireBaseApp.rtdb.ref(`products/${currentHapusId}`).remove()
        .then(() => {
            alert("Produk dihapus!");
            document.getElementById("popupHapus").style.display = "none";
        });
    };
}

// Helper: Image Preview & Base64
function setupImagePreview(inputId, imgId) {
    const input = document.getElementById(inputId);
    if(input) {
        input.addEventListener("change", function() {
            const file = this.files[0];
            if (file) {
                // Validasi ukuran (Max 500KB agar RTDB tidak berat)
                if(file.size > 500 * 1024) {
                    alert("Ukuran gambar terlalu besar! Maksimal 500KB.");
                    this.value = ""; 
                    return;
                }
                const reader = new FileReader();
                reader.onload = e => document.getElementById(imgId).src = e.target.result;
                reader.readAsDataURL(file);
            }
        });
    }
}

// Helper: Ambil Data Form
function ambilDataForm(idNama, idDesk, idHarga, idStok, idImg) {
    const nama = document.getElementById(idNama).value.trim();
    const deskripsi = document.getElementById(idDesk).value.trim();
    const hargaStr = document.getElementById(idHarga).value.replace(/[^0-9]/g, '');
    const stok = parseInt(document.getElementById(idStok).value) || 0;
    const gambar = document.getElementById(idImg).src;

    if (!nama || !hargaStr) {
        alert("Nama dan Harga wajib diisi!");
        return null;
    }
    
    return {
        nama,
        deskripsi,
        harga: parseInt(hargaStr),
        stok,
        gambar
    };
}

function resetFormTambah() {
    document.getElementById("namaProduk").value = "";
    document.getElementById("deskripsiProduk").value = "";
    document.getElementById("hargaProduk").value = "";
    document.getElementById("stokProduk").value = "";
    document.getElementById("previewGambar").src = "https://cdn-icons-png.flaticon.com/512/685/685686.png";
    document.getElementById("gambarProduk").value = "";
}

/* =========================================
   6. ORDER LOGIC (Perbaikan Nama Pembeli - Email Dihilangkan)
   ========================================= */

// Fungsi untuk mencari nama pembeli di node 'pembeli' jika data nama tidak ada di order
async function getBuyerName(buyerId) {
    if (!buyerId) return 'N/A';
    try {
        // Mengambil field 'nama' dari node 'pembeli/{buyerId}'
        const snapshot = await FireBaseApp.rtdb.ref(`pembeli/${buyerId}/nama`).once('value');
        return snapshot.val() || 'Pembeli';
    } catch (e) {
        return 'ID Pembeli: ' + buyerId.substring(0, 8);
    }
}

function formatStatus(status) {
    const map = {
        waiting: "Menunggu Konfirmasi",
        accepted: "Dikemas",
        ready: "Siap Diambil", // <-- TAMBAHAN BARU
        rejected: "Ditolak",
        finished: "Selesai"
    };
    return map[status] || status;
}

function renderTable() {
    const tbody = document.getElementById("orderBody");
    if (!tbody) return;

    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px;">Belum ada pesanan masuk.</td></tr>`;
        return;
    }

    // Sort Descending (Terbaru diatas)
    orders.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Gunakan Promise.all untuk menunggu nama pembeli selesai di-fetch
    const rowsPromise = orders.map(async (order) => {
        // Tampilkan teks status bahasa Indonesia
        let statusText = formatStatus(order.status);
        let statusBadge = `<span class="status ${order.status}">${statusText.toUpperCase()}</span>`;
        
        let buttons = '';

        // Tentukan Nama Pembeli
        const buyerName = escapeHtml(order.buyer || await getBuyerName(order.buyerId)); 

        // --- LOGIKA TOMBOL STATUS (ALUR BARU) ---
        
        // 1. Jika pesanan baru masuk (Waiting)
        if(order.status === 'waiting') {
            buttons = `
                <button onclick="updateStatusPesanan('${order.id}', 'accepted')" style="background:#2196F3;color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;margin-right:5px;">✔ Terima (Proses)</button>
                <button onclick="updateStatusPesanan('${order.id}', 'rejected')" style="background:#f44336;color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer">✖ Tolak</button>
            `;
        } 
        // 2. Jika sedang diproses (Accepted) -> Ubah jadi SIAP
        else if (order.status === 'accepted') {
             buttons = `
                <button onclick="updateStatusPesanan('${order.id}', 'ready')" style="background:#FF9800;color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer">📦 Siap Diambil</button>
             `;
        } 
        // 3. Jika sudah siap (Ready) -> Ubah jadi SELESAI
        else if (order.status === 'ready') {
             buttons = `
                <button onclick="updateStatusPesanan('${order.id}', 'finished')" style="background:#4CAF50;color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer">✅ Pesanan Selesai</button>
             `;
        }
        // 4. Jika Selesai/Ditolak -> Hanya tombol detail
        else {
             buttons = `<button onclick="lihatPesanan('${order.id}')" style="background:#777;color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer">👁️</button>`;
        }
        
        return `
            <tr>
                <td>${order.id.substring(0,8)}...</td>
                <td><strong>${buyerName}</strong></td> 
                <td>${formatRupiah(order.total, 'Rp')}</td>
                <td>${order.date || new Date(order.timestamp).toLocaleDateString('id-ID')}</td>
                <td>${statusBadge}</td>
                <td><div class="action-box">${buttons}</div></td>
            </tr>`;
    });
    
    // Tunggu semua baris selesai dibuat
    Promise.all(rowsPromise).then(rows => {
        tbody.innerHTML = rows.join("");
    });
}

window.updateStatusPesanan = function(id, status) {
    if(!confirm(`Ubah status menjadi ${status}?`)) return;
    
    FireBaseApp.rtdb.ref(`orders/${id}/status`).set(status)
    .then(() => alert("Status berhasil diupdate!"))
    .catch(e => console.error(e));
};

window.lihatPesanan = function(id) {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    document.getElementById("p_id").innerText = order.id;
    document.getElementById("p_buyer").innerText = order.buyer || '—';
    document.getElementById("p_email").innerText = order.email || '—';

    document.getElementById("p_date").innerText =
        order.date ||
        (order.timestamp
            ? new Date(order.timestamp).toLocaleString('id-ID')
            : '—');

    // ✅ STATUS (FIX TOTAL)
    const statusEl = document.getElementById("p_status");
    const status = (order.status || "").toLowerCase();
    statusEl.innerText = formatStatus(status);
    statusEl.className = `status-badge ${status}`;

    document.getElementById("p_total").innerText =
        formatRupiah(order.total, 'Rp');

    const itemsHTML = order.items
        ? order.items.map(i => `
            <li>
                <span class="item-name">${escapeHtml(i.nama)}</span>
                <span class="item-qty">x${i.qty}</span>
                <span class="item-price">
                    ${formatRupiah(i.subtotal || (i.harga * i.qty), 'Rp')}
                </span>
            </li>
        `).join('')
        : '<li>-</li>';

    document.getElementById("p_items").innerHTML = itemsHTML;

    document.getElementById("popupDetail").style.display = "flex";
};