// ============================================================
// FIREBASE CONFIG — Hardcoded (shared by all users automatically)
// ============================================================
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyD6uF5P47ELA_OT_6MfI4Li_LPvMxbuBuU",
    authDomain: "harmonious-ledger.firebaseapp.com",
    projectId: "harmonious-ledger",
    storageBucket: "harmonious-ledger.firebasestorage.app",
    messagingSenderId: "952914566445",
    appId: "1:952914566445:web:55810c74048be3ab3787a4"
};

const Store = {
    db: null,
    isLoaded: false,
    state: {
        transactions: [],
        categories: [
            { id: 'c1', name: 'Comida',    sub: 'Alimentación y Restaurantes', icon: 'restaurant',    color: 'bg-green-100 text-green-800',   type: 'expense' },
            { id: 'c2', name: 'Ropa',      sub: 'Indumentaria y Calzado',      icon: 'checkroom',     color: 'bg-red-100 text-red-800',       type: 'expense' },
            { id: 'c3', name: 'Hogar',     sub: 'Mantenimiento y Servicios',   icon: 'home',          color: 'bg-blue-100 text-blue-800',     type: 'expense' },
            { id: 'c4', name: 'Transp.',   sub: 'Movilidad y Combustible',     icon: 'directions_car',color: 'bg-gray-200 text-gray-800',     type: 'expense' },
            { id: 'c5', name: 'Salud',     sub: 'Bienestar y Medicina',        icon: 'local_hospital', color: 'bg-teal-100 text-teal-800',   type: 'expense' },
            { id: 'c6', name: 'Salario',   sub: 'Ingresos Fijos',              icon: 'payments',      color: 'bg-emerald-100 text-emerald-800', type: 'income' },
        ],
        users: [
            { id: 'u1', name: 'Alejandro Silva', alias: 'Yo',      avatar: 'https://picsum.photos/seed/alejandro/100/100', email: 'alejandro.silva@unityledger.com' },
            { id: 'u2', name: 'Elena Martínez',  alias: 'Esposa',  avatar: 'https://picsum.photos/seed/elena2/100/100',   email: 'elena.mtz@unityledger.com' }
        ],
        currentUser: 'u1'
    },

    init() {
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(FIREBASE_CONFIG);
            }
            this.db = firebase.firestore();
            // Enable offline persistence so it works even with spotty connection
            this.db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
            this.setupRealtimeSync();
        } catch(e) {
            console.error("Firebase init error:", e);
            document.getElementById('global-spinner').innerHTML =
                `<div class="text-center p-8"><p class="text-red-500 font-bold text-lg">Error conectando a la Nube</p><p class="text-gray-500 text-sm mt-2">${e.message}</p><button onclick="location.reload()" class="mt-4 px-6 py-3 bg-primary text-white rounded-full font-bold">Reintentar</button></div>`;
        }
    },

    setupRealtimeSync() {
        let txFirstLoad   = true;
        let catFirstLoad  = true;

        // ── Transactions (real-time) ──────────────────────────────────────
        this.db.collection('transactions').onSnapshot(snapshot => {
            const newTxs = [];
            snapshot.forEach(doc => newTxs.push({ id: doc.id, ...doc.data() }));
            this.state.transactions = newTxs.sort((a, b) => new Date(b.date) - new Date(a.date));
            this.isLoaded = true;

            if (window.Controllers) window.Controllers.hideGlobalSpinner();

            if (!txFirstLoad) {
                this._softRefresh();
            } else {
                // First load: render the current page
                if (window.Router) window.Router.navigate(window.Router.currentRoute);
            }
            txFirstLoad = false;

        }, err => {
            console.error("Firestore error:", err);
            document.getElementById('global-spinner').innerHTML =
                `<div class="text-center p-8 max-w-sm">
                    <span class="material-symbols-outlined text-5xl text-red-400 mb-4 block">cloud_off</span>
                    <p class="font-bold text-primary text-lg">Error de permisos en Firebase</p>
                    <p class="text-gray-500 text-sm mt-2">Ve a tu proyecto en Firebase Console → Firestore Database → Rules y activa el <b>Modo de Prueba</b>.</p>
                    <button onclick="location.reload()" class="mt-6 px-6 py-3 bg-primary text-white rounded-full font-bold text-sm">Reintentar</button>
                </div>`;
            document.getElementById('global-spinner').style.display = 'flex';
            document.getElementById('global-spinner').classList.remove('opacity-0');
        });

        // ── Categories (real-time) ────────────────────────────────────────
        this.db.collection('categories').onSnapshot(snapshot => {
            if (snapshot.empty && catFirstLoad) {
                // Seed defaults on very first run
                const batch = this.db.batch();
                this.state.categories.forEach(c => batch.set(this.db.collection('categories').doc(c.id), c));
                batch.commit();
            } else {
                const newCats = [];
                snapshot.forEach(doc => newCats.push({ id: doc.id, ...doc.data() }));
                if (newCats.length > 0) this.state.categories = newCats;
            }
            if (!catFirstLoad) this._softRefresh();
            catFirstLoad = false;
        });
    },

    _softRefresh() {
        if (!window.Router || !window.Controllers) return;
        const route = window.Router.currentRoute;
        window.Controllers.showSyncPulse();

        if      (route === 'home')       window.Controllers.renderHome();
        else if (route === 'history'  && window._histRender) window._histRender();
        else if (route === 'analysis')   window.Controllers.renderAnalysisContent();
        else if (route === 'categories') window.Controllers.renderManageCats();
        else if (route === 'settings')   window.Controllers.renderSettings();
    },

    getTransactions() { return this.state.transactions; },

    addTransaction({ amount, type, categoryId, userId, date, note }) {
        return this.db.collection('transactions').add({
            amount: parseFloat(amount), type, categoryId, userId, date,
            note: note || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    },

    updateTransaction(id, { amount, note }) {
        return this.db.collection('transactions').doc(id).update({
            amount: parseFloat(amount),
            note: note !== undefined ? note.trim() : ''
        });
    },

    deleteTransaction(id) {
        return this.db.collection('transactions').doc(id).delete();
    },

    addCategory(name, icon, color, hexcode) {
        return this.db.collection('categories').add({
            name, sub: 'Categoría Compartida', icon, color, hex: hexcode, type: 'expense'
        });
    },

    deleteCategory(id) {
        return this.db.collection('categories').doc(id).delete();
    },

    updateUserName(userId, newName) {
        const u = this.state.users.find(x => x.id === userId);
        if (u) u.name = newName;
    },

    exportCSV() {
        if (this.state.transactions.length === 0) return null;
        const headers = ["ID","Fecha","Tipo","Monto","Concepto","UsuarioID","CategoríaID"];
        const rows = this.state.transactions.map(t =>
            [t.id, t.date, t.type, t.amount, `"${t.note}"`, t.userId, t.categoryId].join(',')
        );
        return encodeURI("data:text/csv;charset=utf-8," + headers.join(',') + "\n" + rows.join('\n'));
    },

    importFromCSV(csvText) {
        const lines = csvText.split(/\r?\n/);
        if (lines.length < 2) return 0;
        let c = 0;
        const batch = this.db.batch();
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].trim();
            if (!row) continue;
            let inQ = false, cur = '', parts = [];
            for (const ch of row) {
                if (ch === '"') inQ = !inQ;
                else if (ch === ',' && !inQ) { parts.push(cur); cur = ''; }
                else cur += ch;
            }
            parts.push(cur);
            if (parts.length >= 7) {
                batch.set(this.db.collection('transactions').doc(), {
                    date: parts[1], type: parts[2],
                    amount: parseFloat(parts[3]),
                    note: parts[4].replace(/^"|"$/g, '').trim(),
                    userId: parts[5], categoryId: parts[6]
                });
                c++;
            }
        }
        if (c > 0) batch.commit();
        return c;
    },

    disconnectCloud() {
        // In hardcoded mode, "disconnect" just reloads (config is in code, not localStorage)
        if (confirm("¿Seguro? Esto recargará la aplicación.")) location.reload();
    }
};

setTimeout(() => Store.init(), 100);
