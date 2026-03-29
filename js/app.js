// Store is loaded globally
window.Store = Store; 

const Router = {
    currentRoute: 'home',
    init() {
        window.Router = this;
        this.navigate('home');
        Controllers.initGlobal();
    },
    navigate(pageId, extraParam = null) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
            setTimeout(() => { if(!page.classList.contains('active')) page.style.display = 'none'; }, 300);
        });

        document.querySelectorAll('.nav-btn').forEach(nav => {
            nav.classList.remove('text-primary');
            nav.classList.add('text-gray-400');
            nav.querySelector('.material-symbols-outlined').classList.remove('filled');
        });

        const activeNav = document.getElementById(`nav-${pageId}`);
        if(activeNav) {
            activeNav.classList.remove('text-gray-400');
            activeNav.classList.add('text-primary');
            activeNav.querySelector('.material-symbols-outlined').classList.add('filled');
        }

        const targetPage = document.getElementById(`page-${pageId}`);
        if(targetPage) {
            targetPage.style.display = 'block';
            setTimeout(() => targetPage.classList.add('active'), 10);
        }

        const topBar = document.getElementById('top-bar');
        const titleM = document.getElementById('header-title');
        const backBtn = document.getElementById('btn-back');
        const avatarCont = document.getElementById('header-avatar-container');
        
        if (pageId === 'home') {
            topBar.classList.add('hidden');
        } else {
            topBar.classList.remove('hidden');
        }

        const titleMap = { 'home': 'Dashboard', 'register': 'Registrar', 'history': 'Historial', 'analysis': 'Análisis', 'categories': 'Gestión de Categorías', 'settings': 'Configuración' };
        titleM.innerText = titleMap[pageId] || '';

        // Toggles Back Button vs Avatar based on root views
        const rootPages = ['home', 'register', 'history', 'analysis'];
        if(rootPages.includes(pageId)) {
            backBtn.classList.add('hidden');
            avatarCont.classList.remove('hidden');
        } else {
            backBtn.classList.remove('hidden');
            avatarCont.classList.add('hidden');
        }

        backBtn.onclick = () => window.history.back() || this.navigate('home');

        this.currentRoute = pageId;

        // Destroy existing charts to prevent overlap
        if(Controllers.barChartInstance) { Controllers.barChartInstance.destroy(); Controllers.barChartInstance = null; }
        if(Controllers.pieChartInstance) { Controllers.pieChartInstance.destroy(); Controllers.pieChartInstance = null; }

        if(pageId === 'home') Controllers.renderHome();
        if(pageId === 'register') Controllers.initRegister(extraParam);
        if(pageId === 'history') Controllers.initHistory();
        if(pageId === 'analysis') Controllers.initAnalysis();
        if(pageId === 'categories') Controllers.initCategories();
        if(pageId === 'settings') Controllers.renderSettings();
    }
};

const Controllers = {
    currentAnMonth: null,
    barChartInstance: null,
    pieChartInstance: null,
    
    initGlobal() {
        window.Controllers = this;
        // Wire up CSV file import listener
        document.getElementById('import-csv-file').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if(!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const text = ev.target.result;
                const count = Store.importFromCSV(text);
                if(count > 0) this.notify(`¡${count} transacciones importadas a la Nube!`);
                else this.notify('No se encontraron transacciones válidas en el CSV.');
                e.target.value = '';
            };
            reader.readAsText(file);
        });
    },
    hideGlobalSpinner() {
        const s = document.getElementById('global-spinner');
        if(s) { s.classList.add('opacity-0'); setTimeout(() => s.style.display = 'none', 300); }
    },
    showSyncPulse() {
        // Show a subtle "cloud synced" notification when a remote update arrives
        const existing = document.getElementById('sync-pulse');
        if(existing) return; // don't stack them
        const el = document.createElement('div');
        el.id = 'sync-pulse';
        el.className = 'fixed top-20 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2 bg-white border border-gray-200 text-primary text-xs font-bold px-4 py-2 rounded-full shadow-lg transition-all duration-300 opacity-0';
        el.innerHTML = '<span class="material-symbols-outlined text-[15px] text-green-500">cloud_done</span> Sincronizado';
        document.body.appendChild(el);
        setTimeout(() => el.classList.remove('opacity-0'), 10);
        setTimeout(() => { el.classList.add('opacity-0'); setTimeout(() => el.remove(), 300); }, 2500);
    },
    toggleAdvancedFilters() {
        const panel = document.getElementById('hist-advanced-filters');
        panel.classList.toggle('hidden');
    },
    clearHistoryFilters() {
        document.getElementById('hist-filter-start').value = '';
        document.getElementById('hist-filter-end').value = '';
        document.getElementById('hist-filter-user').value = 'all';
        document.querySelectorAll('.ftype-btn').forEach(b => {
            b.classList.toggle('bg-primary', b.dataset.ftype === 'all');
            b.classList.toggle('text-white', b.dataset.ftype === 'all');
            b.classList.toggle('bg-gray-100', b.dataset.ftype !== 'all');
            b.classList.toggle('text-gray-600', b.dataset.ftype !== 'all');
        });
        if(window._histRender) window._histRender();
    },
    saveFirebaseConfig() {
        const input = document.getElementById('firebase-config-input').value;
        try {
            const match = input.match(/\{[\s\S]*\}/);
            if(!match) throw new Error("No se encontró el objeto JSON");
            const fn = new Function("return " + match[0]);
            const configObj = fn();
            if(!configObj.apiKey) throw new Error("Falta apiKey");
            
            localStorage.setItem('hl_firebase_config', JSON.stringify(configObj));
            location.reload();
        } catch(e) {
            alert("Error leyendo configuración. Pega el objeto completo { apiKey: ... }. Detalles: " + e.message);
        }
    },
    disconnectCloud() {
        if(confirm("ATENCIÓN: Esto desvinculará esta PC de la base de datos de tu Nube compartida. Podrás volver a ingresar tu código más tarde. ¿Deseas desconectar?")) {
            Store.disconnectCloud();
        }
    },
    notify(msg) {
        const t = document.getElementById('toast-container');
        const d = document.createElement('div');
        d.className = 'bg-gray-800 text-white text-xs font-bold px-4 py-3 rounded-full shadow-2xl opacity-0 translate-y-4 transition-all duration-300 pointer-events-auto';
        d.innerText = msg;
        t.appendChild(d);
        setTimeout(() => { d.classList.remove('opacity-0', 'translate-y-4'); }, 10);
        setTimeout(() => { d.classList.add('opacity-0', '-translate-y-4'); setTimeout(() => d.remove(), 300); }, 3000);
    },
    formatDate(ds) {
        return new Date(ds).toLocaleDateString('es-ES', { month: 'short', day: 'numeric'});
    },
    formatCurrency(amt) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amt);
    },
    
    // DASHBOARD
    renderHome() {
        const txs = Store.state.transactions;
        const currentMonthStr = new Date().toISOString().substring(0,7);
        let inc=0, exp=0, lastMExp=0;
        
        const lastMonthDate = new Date(); lastMonthDate.setMonth(lastMonthDate.getMonth()-1);
        const lastMonthStr = lastMonthDate.toISOString().substring(0,7);

        txs.forEach(t => {
            const ym = t.date.substring(0,7);
            if(ym === currentMonthStr) { t.type === 'income' ? inc += t.amount : exp += t.amount; }
            if(ym === lastMonthStr && t.type === 'expense') { lastMExp += t.amount; }
        });

        document.getElementById('dash-balance').innerText = this.formatCurrency(inc - exp);
        document.getElementById('dash-income').innerText = this.formatCurrency(inc);
        document.getElementById('dash-expense').innerText = this.formatCurrency(exp);

        const trendEl = document.getElementById('dash-trend');
        if(lastMExp === 0 && exp > 0) trendEl.innerText = 'Nuevo mes activo';
        else if(lastMExp === 0) trendEl.innerText = 'Sin data previa';
        else {
             const diff = ((exp - lastMExp) / lastMExp) * 100;
             trendEl.innerText = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}% vs anterior`;
             trendEl.parentElement.className = diff > 0 ? 'flex items-center gap-2 text-secondary font-semibold bg-red-50 w-fit px-3 py-1.5 rounded-full' : 'flex items-center gap-2 text-green-600 font-semibold bg-green-50 w-fit px-3 py-1.5 rounded-full';
             trendEl.parentElement.querySelector('span').innerText = diff > 0 ? 'arrow_upward' : 'arrow_downward';
        }

        document.getElementById('dash-users-avatars').innerHTML = Store.state.users.map(u => `<img src="${u.avatar}" class="w-10 h-10 rounded-full border-2 border-white object-cover" />`).join('');
        document.getElementById('dash-chart-current').innerText = this.formatCurrency(exp);

        // CHART.JS Bar Chart
        let weeks = { 1: 0, 2: 0, 3: 0, 4: 0 };
        txs.filter(t => t.date.substring(0,7) === currentMonthStr && t.type==='expense').forEach(t => {
             const d = parseInt(t.date.split('-')[2]); let w = Math.ceil(d / 7); if(w>4) w=4;
             weeks[w] += t.amount;
        });

        const ctxBar = document.getElementById('dashBarCanvas').getContext('2d');
        const currentWeek = Math.ceil(new Date().getDate() / 7);
        const barColors = [1,2,3,4].map(w => w === currentWeek ? '#161c54' : '#bdc2ff');
        
        Chart.defaults.font.family = "'Inter', sans-serif";
        this.barChartInstance = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: ['SEM 1', 'SEM 2', 'SEM 3', 'SEM 4'],
                datasets: [{
                    data: [weeks[1], weeks[2], weeks[3], weeks[4]],
                    backgroundColor: barColors,
                    borderRadius: 4,
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(c) { return '$' + c.raw.toFixed(2); }}} },
                scales: {
                    x: { grid: { display: false }, border: { display: false }, ticks: { font: { weight: 'bold', size: 9 }, color: '#777681'} },
                    y: { display: false, beginAtZero: true }
                }
            }
        });

        const listDiv = document.getElementById('dash-recent-list');
        listDiv.innerHTML = txs.slice(0, 4).map(t => this.createTxCard(t)).join('') || '<p class="text-sm text-gray-400 py-4 text-center">Sin actividad.</p>';
    },

    createTxCard(t) {
        const cat = Store.state.categories.find(c => c.id === t.categoryId) || { name: 'Otro', icon: 'label', color: 'bg-gray-100 text-gray-500' };
        const u = Store.state.users.find(x => x.id === t.userId);
        const isInc = t.type === 'income';
        const isToday = t.date === new Date().toISOString().split('T')[0];
        
        return `<div onclick="Controllers.openEditModal('${t.id}')" class="bg-white p-4 rounded-xl flex items-center justify-between shadow-sm relative overflow-hidden active:scale-[0.98] cursor-pointer border border-gray-50 hover:border-gray-100 transition-all">
                <div class="flex items-center gap-4 relative z-10 w-full">
                    <div class="w-12 h-12 rounded-[0.85rem] flex items-center justify-center shrink-0 ${cat.color}">
                        <span class="material-symbols-outlined">${cat.icon}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-headline font-bold text-[15px] text-primary truncate">${t.note || cat.name}</p>
                        <p class="text-[11px] text-gray-500 font-medium flex items-center gap-1.5 mt-0.5">
                            <span class="w-1.5 h-1.5 rounded-full ${isInc ? 'bg-green-400' : 'bg-secondary'}"></span>
                            ${isToday ? 'Hace Poco' : this.formatDate(t.date)} • ${u ? u.alias : ''}
                        </p>
                    </div>
                    <div class="text-right shrink-0">
                        <p class="font-headline font-bold text-[16px] ${isInc ? 'text-green-600' : 'text-secondary'}">
                            ${isInc ? '+' : '-'}${this.formatCurrency(t.amount)}
                        </p>
                    </div>
                </div>
            </div>`;
    },

    openEditModal(id) {
        const t = Store.state.transactions.find(x => x.id === id);
        if(!t) return;
        document.getElementById('edit-tx-id').value = id;
        document.getElementById('edit-tx-amount').value = t.amount;
        document.getElementById('edit-tx-note').value = t.note;
        
        const m = document.getElementById('edit-modal');
        const mc = document.getElementById('edit-modal-content');
        m.classList.remove('hidden');
        setTimeout(() => { m.classList.remove('opacity-0'); mc.classList.remove('translate-y-full'); }, 10);
    },
    
    closeEditModal() {
        const m = document.getElementById('edit-modal');
        const mc = document.getElementById('edit-modal-content');
        m.classList.add('opacity-0'); mc.classList.add('translate-y-full');
        setTimeout(() => { m.classList.add('hidden'); }, 300);
    },

    saveEditModal() {
        const id = document.getElementById('edit-tx-id').value;
        const amt = document.getElementById('edit-tx-amount').value;
        const note = document.getElementById('edit-tx-note').value;
        if(amt) {
            Store.updateTransaction(id, { amount: amt, note });
            this.closeEditModal();
            this.notify("Cambios Guardados");
            Router.navigate(Router.currentRoute);
        }
    },
    
    deleteFromModal() {
        const id = document.getElementById('edit-tx-id').value;
        if(confirm("¿Eliminar definitivamente?")) {
             Store.deleteTransaction(id);
             this.closeEditModal();
             this.notify("Transacción eliminada");
             Router.navigate(Router.currentRoute);
        }
    },

    // REGISTER
    initRegister(typeParam = 'expense') {
        let currentType = typeParam;
        
        document.getElementById('reg-users').innerHTML = Store.state.users.map(u => `<button data-uid="${u.id}" class="user-select-btn flex text-left items-center gap-3 p-3 bg-white rounded-xl shadow-sm border-2 ${u.id === Store.state.currentUser ? 'border-primary ring-2 ring-primary/10' : 'border-transparent hover:border-gray-200'} transition-all outline-none">
                <div class="w-8 h-8 rounded-full overflow-hidden shrink-0"><img src="${u.avatar}" class="w-full h-full object-cover"></div>
                <div class="flex flex-col"><span class="font-bold text-[13px] text-primary leading-tight">${u.alias}</span><span class="text-[9px] text-gray-400 font-bold uppercase">${u.name.split(' ')[0]}</span></div>
            </button>`).join('');

        let currentUid = Store.state.currentUser;
        document.querySelectorAll('.user-select-btn').forEach(btn => {
            btn.onclick = () => { currentUid = btn.dataset.uid; document.querySelectorAll('.user-select-btn').forEach(b => {b.classList.replace('border-primary', 'border-transparent'); b.classList.remove('ring-2', 'ring-primary/10');}); btn.classList.replace('border-transparent', 'border-primary'); btn.classList.add('ring-2', 'ring-primary/10'); }
        });

        const typeBtns = document.querySelectorAll('#reg-type-selector button');
        const updateType = (type) => {
            currentType = type;
            typeBtns[0].className = type === 'expense' ? "flex-1 py-3 px-6 rounded-full font-headline font-bold text-sm bg-secondary text-white shadow-md transition-all outline-none" : "flex-1 py-3 px-6 rounded-full font-headline font-bold text-sm text-gray-500 hover:bg-white transition-all outline-none";
            typeBtns[1].className = type === 'income' ? "flex-1 py-3 px-6 rounded-full font-headline font-bold text-sm bg-emerald-600 text-white shadow-md transition-all outline-none" : "flex-1 py-3 px-6 rounded-full font-headline font-bold text-sm text-gray-500 hover:bg-white transition-all outline-none";
            this.renderRegCategories(type);
        };
        typeBtns[0].onclick = () => updateType('expense'); typeBtns[1].onclick = () => updateType('income');
        updateType(currentType);

        if(!document.getElementById('reg-date').value) document.getElementById('reg-date').value = new Date().toISOString().split('T')[0];

        document.getElementById('reg-btn-save').onclick = () => {
             const amt = document.getElementById('reg-amount').value;
             const note = document.getElementById('reg-note').value;
             const date = document.getElementById('reg-date').value;
             const activeCat = document.querySelector('.reg-cat.active-c');
             if(!amt || !activeCat || !date) return this.notify("Falta monto o categoría");
             
             Store.addTransaction({ amount: amt, type: currentType, categoryId: activeCat.dataset.id, userId: currentUid, date, note });
             document.getElementById('reg-amount').value = ''; document.getElementById('reg-note').value = '';
             this.notify("Transacción guardada con éxito");
             Router.navigate('home');
        };
    },

    renderRegCategories(type) {
        const catContainer = document.getElementById('reg-categories');
        const cats = Store.state.categories.filter(c => c.type === type);
        catContainer.innerHTML = cats.map((c) => `<div data-id="${c.id}" class="reg-cat aspect-square flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-gray-100 shadow-sm transition-all cursor-pointer">
                <span class="material-symbols-outlined text-3xl mb-2 text-gray-400">${c.icon}</span>
                <span class="text-[10px] font-bold text-gray-500 text-center uppercase tracking-tight">${c.name}</span>
            </div>`).join('') + `<div onclick="Router.navigate('categories')" class="aspect-square flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 transition-all cursor-pointer">
                <span class="material-symbols-outlined text-3xl mb-1 text-gray-400">add</span>
                <span class="text-[10px] font-bold text-gray-500 uppercase">Crear</span>
            </div>`;

        document.querySelectorAll('.reg-cat').forEach(el => {
            el.onclick = () => {
                document.querySelectorAll('.reg-cat').forEach(e => { e.classList.remove('active-c', 'ring-2', 'ring-primary/20', 'bg-blue-50'); e.classList.add('bg-white'); e.querySelector('span').classList.replace('text-primary', 'text-gray-400'); e.querySelectorAll('span')[1].classList.replace('text-primary', 'text-gray-500');});
                el.classList.add('active-c', 'ring-2', 'ring-primary/20', 'bg-blue-50'); el.classList.remove('bg-white');
                el.querySelector('span').classList.replace('text-gray-400', 'text-primary'); el.querySelectorAll('span')[1].classList.replace('text-gray-500', 'text-primary');
            }
        });
    },

    // HISTORY
    initHistory() {
        let currentFilter = 'all';
        let currentTypeFilter = 'all';
        const listDiv = document.getElementById('hist-list');

        // Populate user filter dropdown
        const userSel = document.getElementById('hist-filter-user');
        userSel.innerHTML = '<option value="all">Cualquier Usuario</option>' +
            Store.state.users.map(u => `<option value="${u.id}">${u.name} (${u.alias})</option>`).join('');
        
        const render = () => {
             let filtered = Store.getTransactions();
             const searchQ = document.getElementById('hist-search').value.toLowerCase();
             const startD = document.getElementById('hist-filter-start').value;
             const endD = document.getElementById('hist-filter-end').value;
             const userFilter = document.getElementById('hist-filter-user').value;

             // Quick-pill filter
             if(currentFilter === 'month') {
                 const cm = new Date().toISOString().substring(0,7);
                 filtered = filtered.filter(t => t.date.substring(0,7) === cm);
             } else if(currentFilter === 'income') {
                 filtered = filtered.filter(t => t.type === 'income');
             }
             
             // Advanced filters
             if(startD) filtered = filtered.filter(t => t.date >= startD);
             if(endD)   filtered = filtered.filter(t => t.date <= endD);
             if(userFilter !== 'all') filtered = filtered.filter(t => t.userId === userFilter);
             if(currentTypeFilter !== 'all') filtered = filtered.filter(t => t.type === currentTypeFilter);
             if(searchQ) {
                 filtered = filtered.filter(t => (t.note||'').toLowerCase().includes(searchQ) ||
                     (Store.state.categories.find(c=>c.id===t.categoryId)?.name||'').toLowerCase().includes(searchQ));
             }

             if(!filtered.length) { listDiv.innerHTML = '<p class="text-center text-gray-500 font-bold py-10">No hay movimientos.</p>'; return; }

             const grouped = {};
             filtered.forEach(t => { if(!grouped[t.date]) grouped[t.date]=[]; grouped[t.date].push(t); });
             const today = new Date().toISOString().split('T')[0];
             const yd = new Date(Date.now() - 86400000).toISOString().split('T')[0];

             listDiv.innerHTML = Object.keys(grouped).sort((a,b)=>new Date(b)-new Date(a)).map(dateStr => {
                 let title = dateStr === today ? 'HOY, ' + this.formatDate(dateStr) :
                             dateStr === yd ? 'AYER, ' + this.formatDate(dateStr) :
                             this.formatDate(dateStr).toUpperCase();
                 return `<div>
                        <h3 class="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-3 px-2">${title}</h3>
                        <div class="space-y-3">${grouped[dateStr].map(t => this.createTxCard(t)).join('')}</div>
                    </div>`;
             }).join('');
        };

        window._histRender = render;
        document.getElementById('hist-search').oninput = render;
        document.getElementById('hist-filter-start').onchange = render;
        document.getElementById('hist-filter-end').onchange = render;
        document.getElementById('hist-filter-user').onchange = render;

        // ftype (type) buttons in advanced panel
        document.querySelectorAll('.ftype-btn').forEach(btn => {
            btn.onclick = () => {
                currentTypeFilter = btn.dataset.ftype;
                document.querySelectorAll('.ftype-btn').forEach(b => {
                    b.classList.toggle('bg-primary', b === btn);
                    b.classList.toggle('text-white', b === btn);
                    b.classList.toggle('bg-gray-100', b !== btn);
                    b.classList.toggle('text-gray-600', b !== btn);
                });
                render();
            };
        });

        // Quick-pill filter buttons
        document.querySelectorAll('.filter-pill').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.filter-pill').forEach(b => {
                    b.classList.remove('bg-primary', 'text-white', 'shadow-sm');
                    b.classList.add('bg-gray-200', 'text-gray-600');
                });
                btn.classList.add('bg-primary', 'text-white', 'shadow-sm');
                btn.classList.remove('bg-gray-200', 'text-gray-600');
                currentFilter = btn.dataset.filter;
                render();
            };
        });
        render();
    },

    // ANALYSIS
    initAnalysis() {
        if(!this.currentAnMonth) this.currentAnMonth = new Date().toISOString().substring(0,7);
        this.renderAnalysisContent();
        
        const dropbtn = document.getElementById('an-month-selector');
        dropbtn.onclick = null;
        dropbtn.onclick = () => { 
             const dd = document.getElementById('an-month-dropdown');
             dd.classList.toggle('hidden'); 
        }
    },
    
    changeAnMonth(type) {
        document.getElementById('an-month-dropdown').classList.add('hidden');
        if(type === 'current') this.currentAnMonth = new Date().toISOString().substring(0,7);
        else {
            const d = new Date(); d.setMonth(d.getMonth()-1);
            this.currentAnMonth = d.toISOString().substring(0,7);
        }
        this.renderAnalysisContent();
    },

    renderAnalysisContent() {
        const dateObj = new Date(this.currentAnMonth + "-02T00:00:00");
        const monthName = dateObj.toLocaleDateString('es-ES', { month: 'long' });
        document.getElementById('an-month-title').innerText = `${monthName} ${dateObj.getFullYear()}`;
        
        const currentTxs = Store.getTransactions().filter(t => t.date.substring(0,7) === this.currentAnMonth);
        
        const prevDate = new Date(dateObj);
        prevDate.setMonth(prevDate.getMonth() - 1);
        const prevAnMonth = prevDate.toISOString().substring(0,7);
        const prevTxs = Store.getTransactions().filter(t => t.date.substring(0,7) === prevAnMonth);

        let totalExp = 0;
        let catGroups = {};
        let userGroups = {};
        Store.state.users.forEach(u => userGroups[u.id] = 0);

        currentTxs.forEach(t => {
            if(t.type === 'expense') {
                totalExp += t.amount;
                if(!catGroups[t.categoryId]) catGroups[t.categoryId] = 0;
                catGroups[t.categoryId] += t.amount;
                if(userGroups[t.userId] !== undefined) userGroups[t.userId] += t.amount;
            }
        });

        let prevCatGroups = {};
        prevTxs.forEach(t => {
            if(t.type === 'expense') {
                if(!prevCatGroups[t.categoryId]) prevCatGroups[t.categoryId] = 0;
                prevCatGroups[t.categoryId] += t.amount;
            }
        });

        document.getElementById('an-total-overlay').innerText = this.formatCurrency(totalExp).replace('.00','');

        let legendHtml = '';
        let topListHtml = '';
        let sortedCats = Object.keys(catGroups).sort((a,b) => catGroups[b] - catGroups[a]);
        const strokeColors = ['#161c54', '#9d4042', '#6cb170', '#cbd5e1', '#46464f', '#777681'];
        
        let chartDataPoints = [];
        let chartBackgrounds = [];

        sortedCats.forEach((catId, index) => {
            const cat = Store.state.categories.find(c => c.id === catId);
            const amt = catGroups[catId];
            const prevAmt = prevCatGroups[catId] || 0;
            const percNumber = totalExp > 0 ? (amt / totalExp) * 100 : 0;
            const sColor = cat.hex || strokeColors[index % strokeColors.length];

            chartDataPoints.push(amt);
            chartBackgrounds.push(sColor);

            legendHtml += `<div class="flex items-center gap-2 pl-2"><div class="w-3 h-3 rounded-full shrink-0" style="background-color: ${sColor}"></div><span class="text-[13px] text-gray-600 font-medium truncate">${cat.name} <span class="text-gray-400">(${Math.round(percNumber)}%)</span></span></div>`;
            
            if(index < 4) {
                 let trendText = 'IGUAL QUE MES ANT.';
                 let trendColor = 'text-gray-400';
                 if (prevAmt === 0 && amt > 0) {
                     trendText = 'NUEVO GASTO'; trendColor = 'text-gray-400';
                 } else if (prevAmt > 0) {
                     let diff = ((amt - prevAmt) / prevAmt) * 100;
                     if(diff > 0) { trendText = `+${Math.round(diff)}% VS MES ANT.`; trendColor = 'text-red-600'; }
                     else if (diff < 0) { trendText = `${Math.round(diff)}% VS MES ANT.`; trendColor = 'text-green-500'; }
                 }

                 topListHtml += `<div class="bg-white p-5 rounded-[1.5rem] flex items-center justify-between shadow-sm border border-gray-100 relative overflow-hidden">
                  <div class="absolute left-0 top-0 bottom-0 w-[6px]" style="background-color:${sColor}"></div>
                  <div class="flex items-center gap-4 pl-2">
                    <div class="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-primary"><span class="material-symbols-outlined">${cat.icon}</span></div>
                    <div>
                      <p class="font-headline font-bold text-primary text-[15px]">${cat.name}</p>
                      <p class="text-[11px] text-gray-500 font-medium">${currentTxs.filter(x=>x.categoryId===catId).length} transacciones</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="font-headline font-bold text-[17px] text-primary">${this.formatCurrency(amt)}</p>
                    <p class="text-[9px] font-extrabold tracking-tight mt-0.5 ${trendColor}">${trendText}</p>
                  </div>
                </div>`;
            }
        });
        
        const ctxPie = document.getElementById('anPieCanvas').getContext('2d');
        if(this.pieChartInstance) { this.pieChartInstance.destroy(); }
        
        if (totalExp === 0) {
            chartDataPoints = [1];
            chartBackgrounds = ['#f3f4f6'];
            legendHtml = '<p class="text-xs w-full text-center text-gray-400 col-span-2 py-4">Sin gastos.</p>';
        }

        this.pieChartInstance = new Chart(ctxPie, {
            type: 'doughnut',
            data: {
                labels: totalExp === 0 ? ['Vacio'] : sortedCats.map(cid => Store.state.categories.find(c=>c.id===cid).name),
                datasets: [{
                    data: chartDataPoints,
                    backgroundColor: chartBackgrounds,
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                cutout: '76%', responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: totalExp > 0, callbacks: { label: function(c) { return '$' + c.raw.toFixed(2); }}} },
                animation: { animateScale: true, animateRotate: true }
            }
        });

        document.getElementById('an-legend').innerHTML = legendHtml;
        document.getElementById('an-top-categories').innerHTML = topListHtml;

        document.getElementById('an-users-progress').innerHTML = Store.state.users.map(u => {
            const up = userGroups[u.id] || 0;
            const p = totalExp>0 ? (up/totalExp)*100 : 0;
            return `<div class="space-y-3">
              <div class="flex justify-between items-center px-1">
                <div class="flex items-center gap-3">
                  <img src="${u.avatar}" class="w-8 h-8 rounded-full border border-gray-200 object-cover shadow-sm" />
                  <span class="font-body font-semibold text-[15px] text-primary">${u.name.split(' ')[0]}</span>
                </div>
                <span class="font-headline font-bold text-[15px] text-primary">${this.formatCurrency(up)}</span>
              </div>
              <div class="h-3 w-full bg-gray-200 rounded-full overflow-hidden shadow-inner">
                <div class="h-full bg-primary rounded-full transition-all duration-1000" style="width: ${p}%"></div>
              </div>
            </div>`;
        }).join('');
    },

    // CATEGORIES
    initCategories() {
        this.renderManageCats();
        let selectedIcon = 'category';
        let selectedColor = 'bg-red-100 text-red-800';
        let selectedHex = '#f87171'; // default red bg mapped to hex

        document.querySelectorAll('.icon-opt').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.icon-opt').forEach(b => {b.classList.remove('bg-white', 'text-primary', 'ring-primary'); b.classList.add('text-gray-500')});
                btn.classList.add('bg-white', 'text-primary', 'ring-primary'); btn.classList.remove('text-gray-500');
                selectedIcon = btn.dataset.icon;
            }
        });
        document.querySelectorAll('.color-opt').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.color-opt').forEach(b => b.classList.replace('ring-primary', 'ring-transparent'));
                btn.classList.replace('ring-transparent', 'ring-primary');
                selectedColor = btn.dataset.color;
                selectedHex = btn.dataset.hex;
            }
        });

        this.createCategory = () => {
            const name = document.getElementById('new-cat-name').value;
            if(!name) return this.notify("El nombre es obligatorio");
            Store.addCategory(name, selectedIcon, selectedColor, selectedHex);
            document.getElementById('new-cat-name').value = '';
            this.notify("Categoría Creada Exitosamente");
            this.renderManageCats();
        };
    },

    renderManageCats() {
        document.getElementById('cat-manage-count').innerText = Store.state.categories.length + ' Activas';
        document.getElementById('cat-manage-list').innerHTML = Store.state.categories.map(c => `<div class="bg-white p-4 rounded-xl flex items-center justify-between group hover:shadow-md transition-shadow border border-gray-100">
                  <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-lg ${c.color} flex items-center justify-center shrink-0">
                      <span class="material-symbols-outlined">${c.icon}</span>
                    </div>
                    <div>
                      <p class="font-headline font-bold text-primary leading-tight">${c.name}</p>
                      <p class="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest mt-0.5">${c.sub}</p>
                    </div>
                  </div>
                  <div class="flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onclick="Controllers.notify('Edita desde Ajustes')" class="p-2 rounded-lg hover:bg-gray-50 text-gray-400 active:scale-90"><span class="material-symbols-outlined text-xl">edit</span></button>
                    ${c.id.startsWith('c') && c.id.length < 4 ? '' : `<button onclick="Controllers.delCategory('${c.id}')" class="p-2 rounded-lg hover:bg-red-50 text-secondary active:scale-90"><span class="material-symbols-outlined text-xl">delete</span></button>`}
                  </div>
             </div>`).join('');
    },

    delCategory(id) {
        if(confirm("¿Seguro que deseas eliminarla?")) { Store.deleteCategory(id); this.renderManageCats(); this.notify("Eliminada"); }
    },

    // SETTINGS / EXPORTS
    renderSettings() {
        document.getElementById('set-cat-count').innerText = `${Store.state.categories.length} Categorías activas`;
        document.getElementById('set-profiles-container').innerHTML = Store.state.users.map(u => `<div class="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
                <div class="flex items-center gap-5">
                    <div class="w-20 h-20 rounded-full overflow-hidden ring-4 ring-gray-50 relative shrink-0">
                        <img src="${u.avatar}" class="w-full h-full object-cover">
                    </div>
                    <div class="space-y-0.5">
                        <span class="text-[9px] font-extrabold uppercase tracking-widest text-${u.id==='u1'?'primary':'secondary'} opacity-70">${u.id==='u1' ? 'Mi Perfil' : 'Perfil de Esposa'}</span>
                        <h3 class="font-headline text-lg font-bold text-primary leading-none" id="label-name-${u.id}">${u.name}</h3>
                        <p class="text-[11px] text-gray-500 font-medium">${u.email}</p>
                    </div>
                </div>
                <div class="mt-6 grid grid-cols-1 gap-2 border-t border-gray-50 pt-4">
                    <button onclick="Controllers.changeName('${u.id}')" class="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group outline-none">
                        <div class="flex items-center gap-3">
                            <span class="material-symbols-outlined text-primary">person</span>
                            <span class="font-semibold text-[13px] text-gray-700">Cambiar Nombre</span>
                        </div>
                        <span class="material-symbols-outlined text-gray-300 group-hover:translate-x-1 transition-transform">chevron_right</span>
                    </button>
                </div>
            </div>`).join('');
    },

    changeName(uid) {
        const u = Store.state.users.find(x=>x.id===uid);
        const nn = prompt("Ingresa el nuevo nombre:", u.name);
        if(nn && nn.trim()) { Store.updateUserName(uid, nn.trim()); this.renderSettings(); this.notify("Nombre Actualizado"); }
    },

    exportData() {
        const uri = Store.exportCSV();
        if(!uri) return this.notify("No hay datos para exportar");
        const link = document.createElement("a");
        link.setAttribute("href", uri);
        link.setAttribute("download", "harmonious_ledger_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.notify("Descarga CSV Iniciada");
    }
};

document.addEventListener('DOMContentLoaded', () => { Router.init(); });
