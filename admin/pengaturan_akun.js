// pengaturan_akun.js

let currentUserUID = "";

document.addEventListener("DOMContentLoaded", () => {
    // TAMPILKAN LOADING OVERLAY SAAT AWAL
    const loadingOverlay = document.getElementById("loadingOverlay");
    if(loadingOverlay) loadingOverlay.style.display = "flex";

    // TUNGGU FIREBASE SIAP
    const checkFirebase = setInterval(() => {
        if (window.FireBaseApp && window.FireBaseApp.auth && window.FireBaseApp.rtdb) {
            clearInterval(checkFirebase);
            initPage();
        }
    }, 100);
});

function initPage() {
    const auth = window.FireBaseApp.auth;

    // 1. CEK STATUS LOGIN
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUserUID = user.uid;
            loadUserData(user); // Load data dari database
        } else {
            window.location.href = "login_admin.html";
        }
    });
}

// === FUNGSI LOAD DATA ===
function loadUserData(user) {
    const db = window.FireBaseApp.rtdb;
    const loadingOverlay = document.getElementById("loadingOverlay");

    // Ambil data dari path 'users/' sesuai ID login
    db.ref("users/" + currentUserUID).once("value").then((snapshot) => {
        const data = snapshot.val() || {};
        
        // Fallback Nama: Jika di DB kosong, ambil dari nama email
        let displayName = data.nama || data.name;
        if (!displayName) {
            const emailName = user.email.split('@')[0];
            displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
        }

        // --- ISI FORM ---
        // Pastikan ID elemen sesuai dengan HTML yang saya berikan sebelumnya
        const inputNama = document.getElementById("namaLengkap");
        const inputEmail = document.getElementById("email");
        const inputHp = document.getElementById("noHp");
        const inputPeran = document.getElementById("peran");

        if(inputNama) inputNama.value = displayName;
        if(inputEmail) inputEmail.value = user.email; // Email dari Auth (lebih akurat)
        if(inputHp) inputHp.value = data.noHp || data.phone || "";
        if(inputPeran) inputPeran.value = data.role || "Admin";

        // --- UPDATE TAMPILAN AVATAR ---
        updateAvatarUI(displayName, data.photoUrl);

        // Hilangkan Loading
        if(loadingOverlay) loadingOverlay.style.display = "none";

    }).catch((error) => {
        console.error("Gagal ambil data:", error);
        if(loadingOverlay) loadingOverlay.style.display = "none";
    });
}

// === FUNGSI UPDATE TAMPILAN AVATAR ===
function updateAvatarUI(name, photoUrl) {
    const avatarBox = document.getElementById("avatarBox");
    if (!avatarBox) return;

    if (photoUrl) {
        // Jika ada URL foto, set sebagai background
        avatarBox.style.backgroundImage = `url('${photoUrl}')`;
        avatarBox.style.backgroundSize = "cover";
        avatarBox.style.backgroundPosition = "center";
        avatarBox.innerText = ""; // Hapus inisial huruf
    } else {
        // Jika tidak ada foto, tampilkan inisial
        avatarBox.style.backgroundImage = "none";
        avatarBox.innerText = name ? name.charAt(0).toUpperCase() : "A";
    }
}

// === FUNGSI UPDATE PROFIL (BUTTON SIMPAN) ===
// Pasang fungsi ini di window agar bisa dipanggil via onclick="updateProfile()" di HTML
window.updateProfile = function() {
    const db = window.FireBaseApp.rtdb;
    const btn = document.querySelector(".btn-green"); // Tombol simpan

    const nama = document.getElementById("namaLengkap").value;
    const hp = document.getElementById("noHp").value;

    if (!nama) { alert("Nama tidak boleh kosong!"); return; }

    // Ubah teks tombol
    const originalText = btn ? btn.innerText : "Simpan";
    if(btn) { btn.innerText = "Menyimpan..."; btn.disabled = true; }

    const updateData = {
        nama: nama,       // Simpan field 'nama'
        name: nama,       // Simpan field 'name' (untuk jaga-jaga kompatibilitas)
        noHp: hp,
        phone: hp
    };

    db.ref("users/" + currentUserUID).update(updateData)
    .then(() => {
        alert("Profil berhasil diperbarui!");
        // Update avatar inisial jika nama berubah (dan tidak ada foto)
        // Kita reload data sedikit untuk memastikan sinkron
        const avatarBox = document.getElementById("avatarBox");
        if(avatarBox && avatarBox.style.backgroundImage === "none") {
            avatarBox.innerText = nama.charAt(0).toUpperCase();
        }
    })
    .catch((error) => {
        console.error(error);
        alert("Gagal update: " + error.message);
    })
    .finally(() => {
        if(btn) { btn.innerText = originalText; btn.disabled = false; }
    });
};

// === FUNGSI UBAH PASSWORD ===
window.updatePassword = function() {
    const auth = window.FireBaseApp.auth;
    const p1 = document.getElementById("sandiBaru").value;
    const p2 = document.getElementById("konfirmasiSandi").value;

    if (p1.length < 6) return alert("Sandi minimal 6 karakter!");
    if (p1 !== p2) return alert("Konfirmasi sandi tidak cocok!");

    if (!confirm("Apakah Anda yakin ingin mengubah kata sandi?")) return;

    const user = auth.currentUser;
    if(user) {
        user.updatePassword(p1)
        .then(() => {
            alert("Sandi berhasil diubah! Silakan login ulang.");
            return auth.signOut();
        })
        .then(() => {
            window.location.href = "login_admin.html";
        })
        .catch((error) => {
            if (error.code === 'auth/requires-recent-login') {
                alert("Demi keamanan, silakan Logout dan Login kembali sebelum mengubah sandi.");
            } else {
                alert("Gagal: " + error.message);
            }
        });
    }
};

// === FUNGSI UPLOAD FOTO (OPSIONAL / JIKA HTML MENDUKUNG) ===
// Fungsi ini hanya akan jalan jika Anda menambahkan <input type="file" id="uploadFoto"> di HTML
function setupUploadListener() {
    const inputFoto = document.getElementById("uploadFoto");
    if(!inputFoto) return; // Jika tidak ada elemen input file, skip

    inputFoto.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Cek Storage
        if (!window.FireBaseApp.storage) {
            alert("Firebase Storage belum diaktifkan di firebase-config.js");
            return;
        }

        const storage = window.FireBaseApp.storage;
        const db = window.FireBaseApp.rtdb;
        const avatarBox = document.getElementById("avatarBox");
        
        // Feedback visual
        if(avatarBox) avatarBox.innerText = "...";

        // Upload
        const storageRef = storage.ref().child("profile_photos/" + currentUserUID);
        storageRef.put(file).then((snapshot) => {
            return snapshot.ref.getDownloadURL();
        })
        .then((url) => {
            // Simpan URL ke database users
            return db.ref("users/" + currentUserUID).update({ photoUrl: url })
                .then(() => url);
        })
        .then((url) => {
            updateAvatarUI(document.getElementById("namaLengkap").value, url);
            alert("Foto berhasil diupload!");
        })
        .catch((err) => {
            console.error(err);
            alert("Gagal upload foto: " + err.message);
            // Revert tampilan
            const currentName = document.getElementById("namaLengkap").value;
            updateAvatarUI(currentName, null);
        });
    });
}

// Panggil setup upload listener (siapa tahu nanti Anda tambah tombol upload)
document.addEventListener("DOMContentLoaded", setupUploadListener);


// === LOGIKA LOGOUT ===
window.openLogoutPopup = function() { 
    const modal = document.getElementById("logoutModal");
    if(modal) modal.style.display = "flex"; 
};

window.closeLogoutPopup = function() { 
    const modal = document.getElementById("logoutModal");
    if(modal) modal.style.display = "none"; 
};

window.confirmLogout = function() {
    if (window.FireBaseApp && window.FireBaseApp.auth) {
        window.FireBaseApp.auth.signOut().then(() => {
            window.location.href = 'login_admin.html';
        });
    }
};

window.onclick = function(event) {
    const modal = document.getElementById("logoutModal");
    if (event.target == modal) closeLogoutPopup();
};