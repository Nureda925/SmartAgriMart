// auth.js - Authentication helpers for SmartAgriMart
// Cocok dengan konfigurasi: firebase-config.js (menggunakan .rtdb)

console.log('auth.js loaded (Corrected for rtdb)');

window.SAMAuth = window.SAMAuth || {};
window.SAMRoles = window.SAMRoles || {};

(function() {
  // Fungsi menunggu Firebase siap (karena diload dinamis di config)
  function waitForFirebase() {
    return new Promise((resolve) => {
      const check = () => {
        // Cek apakah FireBaseApp dan auth sudah tersedia
        if (window.FireBaseApp && window.FireBaseApp.auth && window.FireBaseApp.rtdb) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  // Sign in with email and password
  SAMAuth.signInWithEmail = async function(email, password) {
    await waitForFirebase();
    return window.FireBaseApp.auth.signInWithEmailAndPassword(email, password);
  };

  // Sign out
  SAMAuth.signOut = async function() {
    await waitForFirebase();
    return window.FireBaseApp.auth.signOut();
  };

  // On auth state changed
  SAMAuth.onAuthStateChanged = function(callback) {
    waitForFirebase().then(() => {
        window.FireBaseApp.auth.onAuthStateChanged(callback);
    });
  };

  // Get current user
  SAMAuth.getCurrentUser = function() {
    return window.FireBaseApp ? window.FireBaseApp.auth.currentUser : null;
  };

  // Sign up with email and password
  SAMAuth.signUpWithEmail = async function(email, password) {
    await waitForFirebase();
    return window.FireBaseApp.auth.createUserWithEmailAndPassword(email, password);
  };

  // --- BAGIAN INI SUDAH DISESUAIKAN DENGAN VARIABLE 'rtdb' ANDA ---
  
  // Ambil profil user dari Realtime Database
  SAMRoles.getUserProfile = async function(uid) {
    await waitForFirebase();
    try {
      // PERUBAHAN PENTING: Menggunakan .rtdb (bukan .db) sesuai config Anda
      const snapshot = await window.FireBaseApp.rtdb.ref('users/' + uid).once('value');
      
      const data = snapshot.val();
      console.log('Mengecek UID:', uid);
      console.log('Data dari Realtime DB:', data);
      
      return snapshot.exists() ? data : null;
    } catch (e) {
      console.error('Error getting profile:', e);
      return null;
    }
  };

  // Update profil user di Realtime Database
  SAMRoles.updateUserProfile = async function(uid, data) {
    await waitForFirebase();
    // PERUBAHAN PENTING: Menggunakan .rtdb
    return window.FireBaseApp.rtdb.ref('users/' + uid).update(data);
  };

  // Cek Role (Helper)
  SAMRoles.checkRole = async function(requiredRole) {
    const user = SAMAuth.getCurrentUser();
    if (!user) return false;
    const profile = await SAMRoles.getUserProfile(user.uid);
    return profile && profile.role === requiredRole;
  };

})();

// Set global immediately
window.SAMAuth = SAMAuth;
window.SAMRoles = SAMRoles;