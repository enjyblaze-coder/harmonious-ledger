const Store = {
    db: null,
    isLoaded: false,
    state: {
        transactions: [],
        categories: [
            { id: 'c1', name: 'Comida', sub: 'Alimentación y Restaurantes', icon: 'restaurant', color: 'bg-green-100 text-green-800', type: 'expense' },
            { id: 'c2', name: 'Ropa', sub: 'Indumentaria y Calzado', icon: 'checkroom', color: 'bg-red-100 text-red-800', type: 'expense' },
            { id: 'c3', name: 'Hogar', sub: 'Mantenimiento y Servicios', icon: 'home', color: 'bg-blue-100 text-blue-800', type: 'expense' },
            { id: 'c4', name: 'Transp.', sub: 'Movilidad y Combustible', icon: 'directions_car', color: 'bg-gray-200 text-gray-800', type: 'expense' },
            { id: 'c5', name: 'Salud', sub: 'Bienestar y Medicina', icon: 'local_hospital', color: 'bg-teal-100 text-teal-800', type: 'expense' },
            { id: 'c6', name: 'Salario Libre', sub: 'Ingresos Fijos', icon: 'payments', color: 'bg-emerald-100 text-emerald-800', type: 'income' },
        ],
        users: [
            { id: 'u1', name: 'Alejandro Silva', alias: 'Yo', avatar: 'https://picsum.photos/seed/alejandro/100/100', email: 'alejandro.silva@unityledger.com' },
            { id: 'u2', name: 'Elena Martínez', alias: 'Esposa', avatar: 'https://picsum.photos/seed/elena2/100/100', email: 'elena.mtz@unityledger.com' }
        ],
        currentUser: 'u1'
    },

    init() {
        const configStr = localStorage.getItem('hl_firebase_config');
        if(!configStr) {
             document.getElementById('firebase-setup-modal').classList.remove('hidden');
             return;
        }
        try {
            const config = JSON.parse(configStr);
            if (!firebase.apps.length) {
                firebase.initializeApp(config);
            }
            this.db = firebase.firestore();
            this.setupRealtimeSync();
        } catch(e) {
            alert("Configuración de Nube inválida. Reiniciando... Error: " + e.message);
            localStorage.removeItem('hl_firebase_config');
            location.reload();
        }
    },

    setupRealtimeSync() {
        let txFirstLoad = true;
        let catFirstLoad = true;

        // REAL-TIME transactions listener
        this.db.collection('transactions').onSnapshot(snapshot => {
            const newTxs = [];
            snapshot.forEach(doc => newTxs.push({ id: doc.id, ...doc.data() }));
            this.state.transactions = newTxs.sort((a, b) => new Date(b.date) - new Date(a.date));
            this.isLoaded = true;

            if (window.Controllers) window.Controllers.hideGlobalSpinner();

            if (!txFirstLoad) {
                // Soft re-render: only refresh data sections, no full navigation re-init
                this._softRefresh();
            }
            txFirstLoad = false;
        }, error => {
            console.error("Firestore transactions error:", error);
            alert("Error de permisos en Firebase. Configura Firestore en Modo Prueba (Test Mode).");
        });

        // REAL-TIME categories listener
        this.db.collection('categories').onSnapshot(snapshot => {
            if (snapshot.empty && catFirstLoad) {
                // Seed default categories to Firestore on first run
                this.state.categories.forEach(c => this.db.collection('categories').doc(c.id).set(c));
            } else {
                const newCats = [];
                snapshot.forEach(doc => newCats.push({ id: doc.id, ...doc.data() }));
                if (newCats.length > 0) this.state.categories = newCats;
            }
            if (!catFirstLoad) {
                this._softRefresh();
            }
            catFirstLoad = false;
        });
    },

    /**
     * Soft refresh: re-renders only the content of the currently active view
     * without destroying/recreating the entire page (avoids breaking Chart.js instances and event listeners).
     */
    _softRefresh() {
        if (!window.Router || !window.Controllers) return;
        const route = window.Router.currentRoute;

        // Show a small cloud sync indicator
        window.Controllers.showSyncPulse();

        if (route === 'home') {
            window.Controllers.renderHome();
        } else if (route === 'history') {
            if (window._histRender) window._histRender();
        } else if (route === 'analysis') {
            window.Controllers.renderAnalysisContent();
        } else if (route === 'categories') {
            window.Controllers.renderManageCats();
        } else if (route === 'settings') {
            window.Controllers.renderSettings();
        }
    },

    disconnectCloud() {
        localStorage.removeItem('hl_firebase_config');
        location.reload();
    },

    getTransactions() { return this.state.transactions; },

    addTransaction({ amount, type, categoryId, userId, date, note }) {
        return this.db.collection('transactions').add({
            amount: parseFloat(amount),
            type,
            categoryId,
            userId,
            date,
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
        const headers = ["ID", "Fecha", "Tipo", "Monto", "Concepto", "UsuarioID", "CategoríaID"];
        const rows = this.state.transactions.map(t =>
            [t.id, t.date, t.type, t.amount, `"${t.note}"`, t.userId, t.categoryId].join(',')
        );
        return encodeURI("data:text/csv;charset=utf-8," + headers.join(',') + "\n" + rows.join('\n'));
    },

    importFromCSV(csvText) {
        let lines = csvText.split(/\r?\n/);
        if (lines.length < 2) return 0;
        let c = 0;
        const batch = this.db.batch();
        for (let i = 1; i < lines.length; i++) {
            let row = lines[i].trim();
            if (!row) continue;
            let inQuotes = false; let current = ''; let parts = [];
            for (let char of row) {
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) { parts.push(current); current = ''; }
                else current += char;
            }
            parts.push(current);
            if (parts.length >= 7) {
                const docRef = this.db.collection('transactions').doc();
                batch.set(docRef, {
                    date: parts[1],
                    type: parts[2],
                    amount: parseFloat(parts[3]),
                    note: parts[4].replace(/^"|"$/g, '').trim(),
                    userId: parts[5],
                    categoryId: parts[6]
                });
                c++;
            }
        }
        if (c > 0) batch.commit();
        return c;
    }
};

setTimeout(() => Store.init(), 100);
