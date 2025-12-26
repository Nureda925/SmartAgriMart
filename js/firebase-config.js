// firebase-config.js
// ===============================
// Firebase v9 COMPAT (AMAN)
// ===============================

(function () {

  // 🔑 KONFIGURASI
  const firebaseConfig = {
    apiKey: "AIzaSyAwM2mZMtBPhsGYlvabfmCzLLhZZdLrpuE",
    authDomain: "smartagrimart-20670.firebaseapp.com",
    databaseURL: "https://smartagrimart-20670-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "smartagrimart-20670",
    storageBucket: "smartagrimart-20670.appspot.com",
    messagingSenderId: "222437324720",
    appId: "1:222437324720:web:2792c23c235b2c80410875"
  };

  // ===============================
  // LOAD FIREBASE CORE
  // ===============================
  const appScript = document.createElement("script");
  appScript.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js";

  appScript.onload = () => {
    // 1. LOAD AUTH
    const authScript = document.createElement("script");
    authScript.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js";

    authScript.onload = () => {
      // 2. LOAD DATABASE
      const dbScript = document.createElement("script");
      dbScript.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js";

      dbScript.onload = () => {
        // 3. LOAD STORAGE (TAMBAHAN BARU UNTUK FOTO)
        const storageScript = document.createElement("script");
        storageScript.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js";

        storageScript.onload = () => {
             // INIT APP (ANTI DOUBLE INIT)
            if (!firebase.apps.length) {
              firebase.initializeApp(firebaseConfig);
            }

            // 🔥 GLOBAL OBJECT (DIPAKAI SEMUA JS)
            window.FireBaseApp = {
              app: firebase.app(),
              auth: firebase.auth(),
              rtdb: firebase.database(),
              storage: firebase.storage() // Tambahan akses storage
            };

            console.log("🔥 Firebase Auth, RTDB, & Storage siap!");
        };
        document.head.appendChild(storageScript);
      };
      document.head.appendChild(dbScript);
    };
    document.head.appendChild(authScript);
  };
  document.head.appendChild(appScript);

})();