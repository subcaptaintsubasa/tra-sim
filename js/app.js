// --- Global State ---
var currentView = 'database';

// フィルタ条件
var dbFilter = { 
    text: '', 
    rarity: { SSR: true, SR: true }, 
    ownedOnly: false,
    hasSkill: false,
    hasAbility: false,
    skillText: '',
    pos: [], 
    style: [], 
    params: [], 
    paramLogic: 'OR',
    sortParams: [],
    useMyLevel: false
};

// 比較トレイ
var compareTray = []; 

// 一括操作モード用
var isSelectMode = false;
var selectedKeys = new Set();

// 現在表示中のモーダルアイテム
var currentModalItem = null;
var currentViewLevel = 50; 
var compCardStates = []; 

// --- Initialization ---
window.onload = async () => {
    console.log("App initializing...");
    try {
        // LocalStorageからデータロード
        myCards = JSON.parse(localStorage.getItem('tra_my_cards') || '{}');
        profiles = JSON.parse(localStorage.getItem('tra_profiles') || '{}');
        
        // 初期化関数
        if(typeof renderProfileSelector === 'function') renderProfileSelector();
        if(typeof initStatInputs === 'function') initStatInputs();
        if(typeof initPosSelect === 'function') initPosSelect();
        if(typeof initEditors === 'function') initEditors();
        
        // データ取得
        await fetchAllDB();
        
        // 開発者ログイン状態チェック
        if (typeof checkDevLogin === 'function') checkDevLogin();

        // 初期モード設定
        if (typeof setAppMode === 'function') setAppMode('view');
        
        // 初期ビュー設定
        switchView('database'); 
        
        updateTrayUI();

    } catch(e) {
        console.warn("初期化エラー:", e);
    }
};

// --- UI Navigation ---
window.toggleDrawer = () => {
    document.getElementById('appDrawer').classList.toggle('open');
    document.getElementById('drawerOverlay').classList.toggle('open');
};

window.switchView = (viewId) => {
    // コンテンツ切り替え
    document.querySelectorAll('.view-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.drawer-item').forEach(el => el.classList.remove('active'));
    
    const target = document.getElementById(`view-${viewId}`);
    if (target) target.classList.add('active');
    
    // ドロワーを閉じる
    document.getElementById('appDrawer').classList.remove('open');
    document.getElementById('drawerOverlay').classList.remove('open');
    
    currentView = viewId;
    document.body.setAttribute('data-view', viewId);
    
    // --- ヘッダーツール・トレイ・モード切替ボタンの表示制御 ---
    const tools = document.querySelector('.header-tools');
    const tray = document.getElementById('compareTray');
    const modeSwitch = document.querySelector('.mode-switch-container'); // 追加: モード切替ボタン
    
    if (viewId === 'database') {
        // 図鑑モードのみ表示
        if(tools) tools.style.display = 'flex';
        if(tray) tray.style.display = 'block'; 
        if(modeSwitch) modeSwitch.style.display = 'flex'; // 追加
        renderDatabase();
    } else {
        // それ以外は非表示
        if(tools) tools.style.display = 'none';
        if(tray) tray.style.display = 'none';
        if(modeSwitch) modeSwitch.style.display = 'none'; // 追加
    }
    // -------------------------------------------------------
    
    // ビューに応じた初期化処理
    if(viewId === 'sim' && typeof updateCalc === 'function') updateCalc();
    if(viewId === 'admin-card' && typeof renderCardList === 'function') renderCardList();
    if(viewId === 'admin-skill' && typeof renderSAList === 'function') renderSAList();
};

// --- Mode Management ---
window.setAppMode = (mode) => {
    if (typeof appMode !== 'undefined') appMode = mode;
    
    // タブボタンのスタイル切り替え
    const btnView = document.getElementById('btnModeView');
    const btnMy = document.getElementById('btnModeMy');
    if(btnView) btnView.classList.toggle('active', mode === 'view');
    if(btnMy) btnMy.classList.toggle('active', mode === 'mycards');
    
    // --- 1. ヘッダーUIの表示制御 ---
    const btnSelect = document.getElementById('btnSelectMode'); // 一括選択
    const btnFilter = document.getElementById('btnFilterOpen'); // フィルタ
    
    // 図鑑モード(view): フィルタ表示, 選択モード非表示
    // 所持モード(mycards): フィルタ非表示, 選択モード表示
    if(btnSelect) btnSelect.style.display = (mode === 'mycards') ? 'block' : 'none';
    if(btnFilter) btnFilter.style.display = (mode === 'view') ? 'block' : 'none';
    // ----------------------------

    const btnViewType = document.getElementById('btnViewType');
    if(btnViewType) btnViewType.style.display = 'block'; // 両方で表示

    renderDatabase();
};

window.toggleViewType = () => {
    if (typeof viewType !== 'undefined') {
        viewType = (viewType === 'grid') ? 'list' : 'grid';
        const btn = document.getElementById('btnViewType');
        if(btn) {
            btn.innerHTML = viewType === 'grid' ? '<i class="fa-solid fa-list"></i>' : '<i class="fa-solid fa-border-all"></i>';
        }
        renderDatabase();
    }
};

// --- Filter & Search Logic ---
window.filterDatabase = () => {
    const el = document.getElementById('globalSearch');
    const clrBtn = document.getElementById('searchClearBtn');
    
    if (el) {
        dbFilter.text = el.value;
        if(clrBtn) clrBtn.style.display = el.value.length > 0 ? 'block' : 'none';
        renderDatabase();
    }
};

window.clearSearch = () => {
    const el = document.getElementById('globalSearch');
    if(el) {
        el.value = '';
        filterDatabase();
        el.focus();
    }
};

window.resetFilters = () => {
    // 1. フィルタ条件変数の初期化
    dbFilter = { 
        text: '', 
        rarity: { SSR: true, SR: true }, 
        ownedOnly: false,
        hasSkill: false,
        hasAbility: false,
        skillText: '',
        pos: [], 
        style: [], 
        params: [], 
        paramLogic: 'OR',
        sortParams: [],
        useMyLevel: false
    };

    // 2. 検索バーの表示リセット
    const searchEl = document.getElementById('globalSearch');
    if (searchEl) {
        searchEl.value = '';
        const clrBtn = document.getElementById('searchClearBtn');
        if(clrBtn) clrBtn.style.display = 'none';
    }

    // 3. モーダル内のUI要素(チェックボックス等)を初期状態に戻す
    // 全てのチェックボックスをOFF
    document.querySelectorAll('#filterModal input[type="checkbox"]').forEach(el => {
        el.checked = false;
    });
    // 初期値がONのものを設定
    if(document.getElementById('f_rar_SSR')) document.getElementById('f_rar_SSR').checked = true;
    if(document.getElementById('f_rar_SR')) document.getElementById('f_rar_SR').checked = true;
    
    // ラジオボタンをORに戻す
    const radioOr = document.querySelector('input[name="f_logic"][value="OR"]');
    if(radioOr) radioOr.checked = true;

    // 4. リスト再描画
    renderDatabase();
};
// --- Database Render Logic ---
window.renderDatabase = () => {
    const grid = document.getElementById('dbGrid');
    if(!grid) return;
    
    grid.innerHTML = '';
    const vType = (typeof viewType !== 'undefined') ? viewType : 'grid';
    grid.className = (vType === 'grid') ? 'card-grid-visual' : 'card-grid-list';
    
    const currentMode = (typeof appMode !== 'undefined') ? appMode : 'view';
    document.body.setAttribute('data-app-mode', currentMode);
    
    // ボディに選択モード属性を付与(CSS制御用)
    document.body.setAttribute('data-select-mode', isSelectMode);

    // Active Filters Badge
    const afDiv = document.getElementById('activeFilters');
    if(afDiv) {
        afDiv.innerHTML = '';
        const badges = [];
        if(currentMode === 'mycards') badges.push("モード: 所持/育成");
        if(isSelectMode) badges.push("★ 選択モード中"); // バッジ追加
        if(dbFilter.ownedOnly) badges.push("所持のみ");
        if(dbFilter.hasSkill) badges.push("スキル所持");
        if(dbFilter.hasAbility) badges.push("アビリティ所持");
        if(dbFilter.skillText) badges.push(`Skill:"${dbFilter.skillText}"`);
        if(dbFilter.pos.length) badges.push(`Pos:${dbFilter.pos.join(',')}`);
        if(dbFilter.style.length) badges.push(`Style:${dbFilter.style.join(',')}`);
        if(dbFilter.sortParams.length) badges.push(`Sort:${dbFilter.sortParams.join('+')}`);
        
        afDiv.innerHTML = badges.map(l => `<span class="tag" style="background:#334155;">${l}</span>`).join('');
    }

    const list = cardsDB.map((card, idx) => {
        const key = card.name + "_" + card.title;
        const userData = myCards[key] || {};
        const isOwned = !!userData.owned;
        const isFav = !!userData.favorite;
        
        // Filter Checks
        if (dbFilter.text) {
            const search = dbFilter.text.toLowerCase();
            if (!card.name.toLowerCase().includes(search) && !card.title.toLowerCase().includes(search)) return null;
        }
        if (!dbFilter.rarity[card.rarity]) return null;
        if (dbFilter.ownedOnly && !isOwned) return null;

        if (dbFilter.hasSkill && !(card.abilities || []).some(a => skillsDB.some(s => s.name === a))) return null;
        if (dbFilter.hasAbility && !(card.abilities || []).some(a => abilitiesDB.some(ab => ab.name === a))) return null;
        if (dbFilter.skillText && !(card.abilities || []).some(a => a.toLowerCase().includes(dbFilter.skillText))) return null;

        if (dbFilter.pos.length > 0 || dbFilter.style.length > 0) {
            let isMatch = false;
            const cBonuses = [];
            if(card.bonuses) card.bonuses.forEach(b => cBonuses.push(b.type));
            if(card.bonus_type) cBonuses.push(card.bonus_type);

            if (dbFilter.pos.length > 0) {
                isMatch = dbFilter.pos.some(p => {
                    let targets = [p];
                    if (typeof POS_BONUS_MAPPING !== 'undefined' && POS_BONUS_MAPPING[p]) targets = targets.concat(POS_BONUS_MAPPING[p]);
                    return cBonuses.some(cb => targets.includes(cb));
                });
            }
            if (!isMatch && dbFilter.style.length > 0) {
                isMatch = dbFilter.style.some(s => cBonuses.includes(s));
            }
            if (!isMatch) return null;
        }

        if (dbFilter.params.length > 0) {
            const stats = getCardStatsAtLevel(card, 50, null, null, 1.0);
            let matchCount = 0;
            dbFilter.params.forEach(p => { if((stats[p]||0) > 0) matchCount++; });
            if (dbFilter.paramLogic === 'AND') { if (matchCount < dbFilter.params.length) return null; }
            else { if (matchCount === 0) return null; }
        }

        let sortScore = 0;
        if (dbFilter.sortParams.length > 0) {
            let level = (card.rarity==='SSR'?50:45);
            if (dbFilter.useMyLevel) level = isOwned ? (parseInt(userData.level)||1) : 1;
            const tPos = dbFilter.pos[0] || null;
            const tStyle = dbFilter.style[0] || null;
            const stats = getCardStatsAtLevel(card, level, tPos, tStyle, 1.0);
            dbFilter.sortParams.forEach(p => sortScore += (stats[p] || 0));
        }

        return { original: card, idx, key, isFav, isOwned, sortScore, level: (userData.level || 1) };
    }).filter(item => item !== null);
    
    // Sort Logic
    list.sort((a, b) => {
        if (currentMode === 'mycards') {
            if (a.isOwned !== b.isOwned) return b.isOwned - a.isOwned;
        }
        if (dbFilter.sortParams.length > 0) {
            if (b.sortScore !== a.sortScore) return b.sortScore - a.sortScore;
        }
        if (a.isFav !== b.isFav) return b.isFav - a.isFav;
        if (a.original.rarity !== b.original.rarity) return a.original.rarity === 'SSR' ? -1 : 1;
        return a.original.name.localeCompare(b.original.name, 'ja');
    });

    // グローバル変数に保存（全選択機能用）
window.lastRenderedItems = list;
    
    // Render
    list.forEach(item => {
        const c = item.original;
        const imgPath = `img/cards/${c.name}_${c.title}.png`;
        const el = document.createElement('div');
        
        // 選択モード時は .bulk-selected クラスを付与
        const isSelected = isSelectMode && selectedKeys.has(item.key);
        el.className = `db-card ${item.isFav ? 'fav' : ''} ${item.isOwned ? 'owned' : 'unowned'} ${isSelected ? 'bulk-selected' : ''}`;
        
        if (vType === 'grid') {
            el.innerHTML = `
                <div class="fav-icon"><i class="fa-solid fa-heart"></i></div>
                <img src="${imgPath}" class="db-card-img" loading="lazy" onerror="this.src='https://placehold.jp/333333/ffffff/300x400.png?text=No+Img'">
                <div class="db-info">
                    <div class="db-name">${c.name}</div>
                    <div class="db-badges">
                        <span class="badge ${c.rarity}">${c.rarity}</span>
                        ${item.isOwned ? `<span class="badge" style="background:#22c55e;color:#000;">Lv.${item.level}</span>` : ''}
                        ${item.sortScore > 0 ? `<span style="color:#fbbf24;font-weight:bold;margin-left:2px;">${(item.sortScore/10).toFixed(1)}</span>` : ''}
                    </div>
                </div>
            `;
        } else {
            let displayStats = [];
            if (dbFilter.sortParams.length > 0) {
                displayStats.push(`合計:${(item.sortScore/10).toFixed(1)}`);
            } else {
                const dLvl = (currentMode === 'mycards' && item.isOwned) ? item.level : (c.rarity==='SSR'?50:45);
                const stats = getCardStatsAtLevel(c, dLvl, null, null, 1.0);
                displayStats = Object.entries(stats).sort(([,a], [,b]) => b - a).slice(0, 3).map(([k,v]) => `${k}:${(v/10).toFixed(0)}`);
            }
            el.innerHTML = `
                <img src="${imgPath}" class="db-card-img" loading="lazy" onerror="this.src='https://placehold.jp/333333/ffffff/300x400.png?text=No+Img'">
                <div class="db-info">
                    <div style="display:flex; justify-content:space-between; width:100%;">
                        <div class="db-name" style="font-weight:bold;">${c.name} <span style="font-size:0.7em; color:#999;">${c.title}</span></div>
                        <div class="db-badges">
                            <span class="badge ${c.rarity}">${c.rarity}</span>
                            ${item.isOwned ? `<span class="badge" style="background:#22c55e;color:#000;">Lv.${item.level}</span>` : ''}
                        </div>
                    </div>
                    <div class="list-stats">${displayStats.map(s => `<span>${s}</span>`).join('')}</div>
                    <div class="list-skills" style="font-size:0.7rem; color:var(--skill); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${(c.abilities||[]).join(', ')}</div>
                </div>
            `;
        }
        
        el.onclick = () => {
            if (isSelectMode) {
                // 選択モード: 選択状態をトグル
                toggleBulkSelect(item.key);
            } else {
                // 通常モード: 詳細モーダル
                if (currentMode === 'mycards') openMyCardDetailModal(item);
                else openViewDetailModal(item);
            }
        };
        grid.appendChild(el);
    });
};

// --- MyCards Modal ---
window.openMyCardDetailModal = (item, fromSim = false) => {
    currentModalItem = item;
    const c = item.original;
    const userData = myCards[item.key] || { owned: false, level: 1, favorite: false };
    
    const modal = document.getElementById('cardDetailModal');
    if (!modal) return;
    modal.classList.add('mycards-mode');
    
    document.getElementById('cdmTitle').innerText = `[${c.rarity}] ${c.title} (育成)`;
    renderMyCardModalBody(userData);

    // --- 4. シミュレータからの呼び出し時のフッター制御 ---
    const footer = modal.querySelector('.modal-footer');
    if (fromSim) {
        footer.innerHTML = `
            <button class="btn btn-accent" style="width:100%; font-size:1.1rem; padding:12px;" onclick="setSimSlotFromModal()">
                <i class="fa-solid fa-check"></i> このカードをセット
            </button>
        `;
    } 
    // ---------------------------------------------------
    
    modal.style.display = 'flex';
};

window.renderMyCardModalBody = (userData) => {
    if (!currentModalItem) return;
    const c = currentModalItem.original;
    const imgPath = `img/cards/${c.name}_${c.title}.png`;
    const currentLevel = userData.owned ? parseInt(userData.level) : 1;
    const maxLevel = c.rarity === 'SSR' ? 50 : 45;
    const stats = getCardStatsAtLevel(c, currentLevel, null, null, 1.0);

    const levels = (c.rarity === 'SSR') ? [30, 35, 40, 45, 50] : [25, 30, 35, 40, 45];
    const labels = ["無凸", "1凸", "2凸", "3凸", "完凸"];
    
    let presetBtns = '<div class="level-btn-group">';
    levels.forEach((lvl, idx) => {
        const active = (lvl === currentLevel) ? 'active' : '';
        presetBtns += `<button class="lvl-btn ${active}" data-lvl="${lvl}" onclick="updateMyCardLevel(${lvl})">${labels[idx]}<br>(${lvl})</button>`;
    });
    presetBtns += '</div>';

    const favIconClass = userData.favorite ? "fa-solid" : "fa-regular";

    const body = document.getElementById('cdmBody');
    body.innerHTML = `
        <div style="display:flex; gap:15px; margin-bottom:10px;">
            <div class="card-img-container">
                <img src="${imgPath}" style="width:100%; height:100%; object-fit:cover; border-radius:6px; border:1px solid #444;" onerror="this.src='https://placehold.jp/100x133.png?text=NoImg'">
                <div class="card-fav-overlay" onclick="toggleMyCardFavFromModal(this)"><i class="${favIconClass} fa-heart"></i></div>
            </div>
            <div style="flex:1;">
                <div style="font-weight:bold; font-size:1.1rem; line-height:1.3;">${c.name}</div>
                <div style="font-size:0.8rem; color:#ccc; margin-bottom:5px;">${c.title}</div>
                <div style="margin-top:5px; font-size:0.75rem; color:#94a3b8;">${(c.abilities||[]).map(a => `<span class="tag tag-skill">${a}</span>`).join(' ')}</div>
            </div>
        </div>
        <div id="levelControlArea" class="level-slider-container" style="${!userData.owned ? 'opacity:0.5; pointer-events:none;' : ''}">
            <div class="level-control-row">
                <label style="font-size:0.8rem; color:#ccc;">レベル設定</label>
                <span class="level-display">Lv.<span id="mcLevelVal">${currentLevel}</span></span>
            </div>
            <input type="range" id="mcLevelSlider" class="level-slider" min="1" max="${maxLevel}" value="${currentLevel}" oninput="updateMyCardLevel(this.value, true)" onchange="saveInv()">
            <div style="margin-top:5px;">${presetBtns}</div>
        </div>
        <div style="background:#0f172a; padding:10px; border-radius:6px; border:1px solid #333;">
            <div class="stat-grid" id="mcStatGrid">${renderStatGridHTML(c.stats, stats)}</div>
        </div>
    `;

    const footer = document.querySelector('#cardDetailModal .modal-footer');
    const btnClass = userData.owned ? 'btn-accent' : 'btn-primary';
    const btnIcon = userData.owned ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-plus"></i>';
    const btnText = userData.owned ? '所持しています' : '未所持にする';

    footer.innerHTML = `
        <button class="btn btn-icon" onclick="addToTrayFromDetail()"><i class="fa-solid fa-scale-balanced"></i> 比較</button>
        <button id="btnToggleOwnFooter" class="btn ${btnClass}" onclick="toggleMyCardOwnedFromModal()">
            ${btnIcon} <span id="btnToggleOwnText">${btnText}</span>
        </button>
    `;
};

window.updateMyCardLevel = (newLevel, isSliderInput = false) => {
    if (!currentModalItem) return;
    const level = parseInt(newLevel);
    const key = currentModalItem.key;
    const c = currentModalItem.original;
    
    if (!myCards[key]) myCards[key] = { owned: true, favorite: false };
    myCards[key].level = level;
    if (!myCards[key].owned) myCards[key].owned = true;

    if (!isSliderInput) saveInv();

    // DOM更新
    document.getElementById('mcLevelVal').innerText = level;
    const slider = document.getElementById('mcLevelSlider');
    if(slider && !isSliderInput) slider.value = level;

    const stats = getCardStatsAtLevel(c, level, null, null, 1.0);
    document.getElementById('mcStatGrid').innerHTML = renderStatGridHTML(c.stats, stats);

    document.querySelectorAll('.lvl-btn').forEach(btn => {
        const btnLvl = parseInt(btn.dataset.lvl);
        if(btnLvl === level) btn.classList.add('active'); else btn.classList.remove('active');
    });
};

window.toggleMyCardOwnedFromModal = () => {
    if (!currentModalItem) return;
    const key = currentModalItem.key;
    if (!myCards[key]) myCards[key] = { level: (currentModalItem.original.rarity==='SSR'?50:45), favorite: false };
    
    const isNowOwned = !myCards[key].owned;
    myCards[key].owned = isNowOwned;
    saveInv();

    const lvlArea = document.getElementById('levelControlArea');
    if(lvlArea) {
        lvlArea.style.opacity = isNowOwned ? '1' : '0.5';
        lvlArea.style.pointerEvents = isNowOwned ? 'auto' : 'none';
    }

    const btn = document.getElementById('btnToggleOwnFooter');
    if(btn) {
        if(isNowOwned) {
            btn.className = "btn btn-accent";
            btn.innerHTML = '<i class="fa-solid fa-check"></i> <span id="btnToggleOwnText">所持しています</span>';
        } else {
            btn.className = "btn btn-primary";
            btn.innerHTML = '<i class="fa-solid fa-plus"></i> <span id="btnToggleOwnText">未所持にする</span>';
        }
    }
    renderDatabase();
};

window.toggleMyCardFavFromModal = (element) => {
    if (!currentModalItem) return;
    const key = currentModalItem.key;
    if (!myCards[key]) myCards[key] = { level: 1, owned: false };
    myCards[key].favorite = !myCards[key].favorite;
    saveInv();
    const icon = element.querySelector('i');
    icon.className = myCards[key].favorite ? "fa-solid fa-heart" : "fa-regular fa-heart";
};

// --- View Modal (Old) & Common ---
window.openViewDetailModal = (item) => {
    currentModalItem = item;
    const c = item.original;
    currentViewLevel = c.rarity === 'SSR' ? 50 : 45;
    const modal = document.getElementById('cardDetailModal');
    if (!modal) return;
    
    modal.classList.remove('mycards-mode');
    document.getElementById('cdmTitle').innerText = `[${c.rarity}] ${c.title}`;
    
    renderViewModalBody();
    
    // Viewモード用フッター
    modal.querySelector('.modal-footer').innerHTML = `
        <button class="btn btn-icon" id="btnFav" onclick="toggleDetailFav()"><i class="fa-regular fa-heart"></i> お気に入り</button>
        <button class="btn btn-icon" onclick="addToTrayFromDetail()"><i class="fa-solid fa-scale-balanced"></i> 比較</button>
        <button class="btn btn-primary" id="btnOwned" onclick="toggleDetailOwned()" style="flex:1;">所持にする</button>
    `;
    updateDetailButtons();
    modal.style.display = 'flex';
};

window.renderViewModalBody = () => {
    if (!currentModalItem) return;
    const c = currentModalItem.original;
    const imgPath = `img/cards/${c.name}_${c.title}.png`;
    const stats = getCardStatsAtLevel(c, currentViewLevel, null, null, 1.0);
    const levels = (c.rarity === 'SSR') ? [30, 35, 40, 45, 50] : [25, 30, 35, 40, 45];
    const labels = ["無凸", "1凸", "2凸", "3凸", "完凸"];
    
    let btnHtml = '<div class="level-btn-group">';
    levels.forEach((lvl, idx) => {
        const active = (lvl === currentViewLevel) ? 'active' : '';
        btnHtml += `<button class="lvl-btn ${active}" onclick="updateViewLevel(${lvl})">${labels[idx]}<br>(Lv${lvl})</button>`;
    });
    btnHtml += '</div>';

    document.getElementById('cdmBody').innerHTML = `
        <div style="display:flex; gap:15px; margin-bottom:10px;">
            <img src="${imgPath}" style="width:100px; height:133px; object-fit:cover; border-radius:6px; border:1px solid #444;" onerror="this.src='https://placehold.jp/100x133.png?text=NoImg'">
            <div style="flex:1;">
                <div style="font-weight:bold; font-size:1.1rem; line-height:1.3;">${c.name}</div>
                <div style="font-size:0.8rem; color:#ccc; margin-bottom:5px;">${c.title}</div>
                <div style="margin-top:5px;">${(c.abilities||[]).map(a => `<span class="tag tag-skill">${a}</span>`).join(' ')}</div>
                <div style="margin-top:8px; font-size:0.75rem; color:#94a3b8;">
                    ボーナス: ${c.bonuses ? c.bonuses.map(b=>`${b.type}+${b.value}%`).join(', ') : (c.bonus_type ? `${c.bonus_type}+${c.bonus_value}%` : 'なし')}
                </div>
            </div>
        </div>
        ${btnHtml}
        <div style="background:#0f172a; padding:10px; border-radius:6px; border:1px solid #333;">
            <div class="stat-grid">${renderStatGridHTML(c.stats, stats)}</div>
        </div>
    `;
};

window.updateViewLevel = (lvl) => {
    currentViewLevel = lvl;
    renderViewModalBody();
};

window.closeCardDetailModal = () => {
    const modal = document.getElementById('cardDetailModal');
    if(modal) {
        modal.style.display = 'none';
        modal.classList.remove('mycards-mode');
        // Viewモード用に×ボタンを戻す
        const closeBtn = modal.querySelector('.modal-header .btn-close');
        if(closeBtn) closeBtn.style.display = 'block';
    }
    currentModalItem = null;
    renderDatabase();
};

function updateDetailButtons() {
    if (!currentModalItem) return;
    const btnFav = document.getElementById('btnFav');
    if(btnFav) {
        if (currentModalItem.isFav) { btnFav.innerHTML = '<i class="fa-solid fa-heart"></i> 済'; btnFav.classList.add('active'); } 
        else { btnFav.innerHTML = '<i class="fa-regular fa-heart"></i> お気に入り'; btnFav.classList.remove('active'); }
    }
    const btnOwned = document.getElementById('btnOwned');
    if(btnOwned) {
        if (currentModalItem.isOwned) { btnOwned.innerHTML = '所持済'; btnOwned.style.background = '#22c55e'; btnOwned.style.color = '#000'; } 
        else { btnOwned.innerHTML = '未所持にする'; btnOwned.style.background = '#334155'; btnOwned.style.color = '#fff'; }
    }
}

window.toggleDetailFav = () => {
    if(!currentModalItem) return;
    const key = currentModalItem.key;
    if(!myCards[key]) myCards[key] = { owned: false, level: 50 };
    myCards[key].favorite = !myCards[key].favorite;
    currentModalItem.isFav = myCards[key].favorite;
    saveInv(); updateDetailButtons();
};

window.toggleDetailOwned = () => {
    if(!currentModalItem) return;
    const key = currentModalItem.key;
    if(!myCards[key]) myCards[key] = { level: 50 };
    myCards[key].owned = !myCards[key].owned;
    currentModalItem.isOwned = myCards[key].owned;
    saveInv(); updateDetailButtons();
};

window.addToTrayFromDetail = () => {
    if(!currentModalItem) return;
    addToTray(currentModalItem.original);
    closeCardDetailModal();
    document.getElementById('compareTray').classList.add('open');
};

// --- Helper Functions ---
function renderStatGridHTML(baseStats, currentStats) {
    return Object.entries(baseStats || {}).map(([k,v]) => {
        const val = currentStats[k] ? (currentStats[k] / 10).toFixed(1) : '-';
        return `<div style="display:flex; justify-content:space-between; font-size:0.75rem;"><span style="color:#aaa;">${k}</span><span style="font-weight:bold; color:#fff;">${val}</span></div>`;
    }).join('');
}

// --- Comparison (Same as before) ---
window.runComparison = () => {
    if(compareTray.length < 1) return alert("比較するカードを選択してください");
    compCardStates = compareTray.map(c => ({ id: c.name + "_" + c.title, level: c.rarity === 'SSR' ? 50 : 45 }));
    updateComparisonTable();
    document.getElementById('comparisonModal').style.display = 'flex';
};

window.updateComparisonTable = () => {
    const table = document.getElementById('compTable');
    if(!table) return;
    table.innerHTML = '';
    
    let thead = `<thead><tr><th style="min-width:80px;">項目</th>`;
    compareTray.forEach((c, idx) => {
        const state = compCardStates[idx];
        const imgPath = `img/cards/${c.name}_${c.title}.png`;
        const levels = c.rarity === 'SSR' ? [30,35,40,45,50] : [25,30,35,40,45];
        const labels = ["0","1","2","3","完"];
        let btnHtml = `<div class="comp-lvl-btns">` + levels.map((lvl, i) => `<button class="comp-lvl-btn ${lvl===state.level?'active':''}" onclick="updateCompCardLevel(${idx}, ${lvl})">${labels[i]}</button>`).join('') + `</div>`;
        thead += `<th><div class="comp-card-header"><img src="${imgPath}" onerror="this.src='https://placehold.jp/50x65.png'"><div class="comp-card-name">${c.name}</div><div class="comp-card-ctrl"><span style="font-size:0.6rem;">Lv.${state.level}</span>${btnHtml}</div></div></th>`;
    });
    thead += `</tr></thead>`;
    table.innerHTML += thead;

    const cardStats = compareTray.map((c, idx) => getCardStatsAtLevel(c, compCardStates[idx].level, null, null, 1.0));
    const order = (typeof STATS_VERTICAL_ORDER !== 'undefined') ? STATS_VERTICAL_ORDER : ["決定力","キック力","走力"]; // Fallback

    let tbody = `<tbody>`;
    order.forEach(statName => {
        const isAllZero = cardStats.every(st => !st[statName]);
        if (isAllZero) return;
        let maxVal = -1;
        cardStats.forEach(st => { if((st[statName]||0) > maxVal) maxVal = st[statName]||0; });
        let row = `<tr><td>${statName}</td>`;
        cardStats.forEach(st => {
            const val = st[statName] || 0;
            const classAttr = (val > 0 && val === maxVal) ? 'comp-val comp-win' : 'comp-val';
            row += `<td class="${classAttr}" style="${val===0?'color:#444;':''}">${val > 0 ? (val/10).toFixed(1) : '-'}</td>`;
        });
        row += `</tr>`;
        tbody += row;
    });
    // Skills
    tbody += `<tr><td>スキル</td>` + compareTray.map(c => `<td style="font-size:0.6rem; white-space:normal; vertical-align:top;">${(c.abilities||[]).map(s=>`<div class="tag tag-skill" style="margin-bottom:2px;">${s}</div>`).join('')}</td>`).join('') + `</tr></tbody>`;
    table.innerHTML += tbody;
};

window.updateCompCardLevel = (idx, lvl) => { compCardStates[idx].level = lvl; updateComparisonTable(); };

// --- Tray & Misc ---
window.toggleTray = () => document.getElementById('compareTray').classList.toggle('open');
window.addToTray = (card) => {
    const key = card.name + "_" + card.title;
    if(compareTray.find(c => (c.name + "_" + c.title) === key)) return;
    if(compareTray.length >= 5) return alert("比較リストは最大5枚までです");
    compareTray.push(card);
    updateTrayUI();
};
window.updateTrayUI = () => {
    const list = document.getElementById('trayList');
    document.getElementById('trayCount').innerText = `比較リスト (${compareTray.length})`;
    list.innerHTML = '';
    if(compareTray.length === 0) { list.innerHTML = '<div class="tray-placeholder">カードをドロップ</div>'; return; }
    compareTray.forEach((c, idx) => {
        const div = document.createElement('div');
        div.className = 'tray-item';
        div.innerHTML = `<img src="img/cards/${c.name}_${c.title}.png" onerror="this.src='https://placehold.jp/40x40.png'">`;
        div.onclick = () => { if(confirm('リストから削除しますか？')) { compareTray.splice(idx, 1); updateTrayUI(); } };
        list.appendChild(div);
    });
};
window.clearTray = () => { compareTray = []; updateTrayUI(); };

// --- Admin Logic (Merged) ---
window.openDevModal = () => {
    if(localStorage.getItem('gh_token')) {
        if(confirm("現在ログイン中です。ログアウトしますか？")) logoutDev();
        return;
    }
    const modal = document.getElementById('devAuthModal');
    if(modal) modal.style.display = 'flex';
};

window.submitDevAuth = () => {
    const token = document.getElementById('devAuthToken').value.trim();
    const repo = document.getElementById('devAuthRepo').value.trim();
    if(!token || !repo) return alert("TokenとRepositoryを入力してください");
    localStorage.setItem('gh_token', token);
    localStorage.setItem('gh_repo', repo);
    document.getElementById('devAuthModal').style.display = 'none';
    alert("認証情報を保存しました");
    checkDevLogin();
};

window.logoutDev = () => {
    localStorage.removeItem('gh_token');
    localStorage.removeItem('gh_repo');
    alert("ログアウトしました");
    checkDevLogin();
    switchView('database');
};

window.checkDevLogin = () => {
    const hasAuth = !!localStorage.getItem('gh_token');
    const adminLinks = document.getElementById('adminLinks');
    const loginBtn = document.getElementById('devLoginBtn');
    if(adminLinks) adminLinks.style.display = hasAuth ? 'block' : 'none';
    if(loginBtn) loginBtn.innerHTML = hasAuth ? '<i class="fa-solid fa-user-shield"></i> 開発者: ログイン中' : '<i class="fa-solid fa-terminal"></i> 開発者オプション';
};

// Fallback for missing funcs
window.openCardDetailModal = (item) => {
    if (typeof appMode !== 'undefined' && appMode === 'mycards') openMyCardDetailModal(item);
    else openViewDetailModal(item);
};

// --- Filter Modal Logic (Restored) ---

window.renderParamButtons = (targetId, nameAttr) => {
    const container = document.getElementById(targetId);
    if (!container) return;
    container.innerHTML = ''; 

    // パラメータ順序定義
    const order = [
        "決定力", "ショートパス", "突破力", "タックル", "セービング", "ジャンプ", "走力",
        "キック力", "ロングパス", "キープ力", "パスカット", "反応速度", "コンタクト", "敏捷性",
        "冷静さ", "キック精度", "ボールタッチ", "マーク", "1対1", "スタミナ"
    ];
    const gkStats = ["セービング", "反応速度", "1対1"];

    order.forEach(s => {
        const div = document.createElement('div');
        const isGk = gkStats.includes(s);
        div.className = `chk-btn param ${isGk ? 'param-gk' : ''}`;
        const id = `${nameAttr}_${s}`;
        const labelText = s.length > 3 ? s.substring(0,3) : s;
        div.innerHTML = `<input type="checkbox" name="${nameAttr}" value="${s}" id="${id}"><label for="${id}">${labelText}</label>`;
        container.appendChild(div);
    });

    // レイアウト調整（空セル）
    if (order.length % 7 !== 0) {
        const emptyCount = 7 - (order.length % 7);
        for(let i=0; i<emptyCount; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'chk-btn';
            emptyDiv.style.visibility = 'hidden';
            container.appendChild(emptyDiv);
        }
    }
};

window.openFilterModal = () => {
    // ボタン生成
    renderParamButtons('filterParamsGrid', 'f_prm');
    renderParamButtons('sortParamsGrid', 's_prm');

    // 現在の状態をUIに反映
    document.getElementById('f_rar_SSR').checked = dbFilter.rarity.SSR;
    document.getElementById('f_rar_SR').checked = dbFilter.rarity.SR;
    document.getElementById('f_owned_only').checked = dbFilter.ownedOnly;
    
    if(document.getElementById('f_has_skill')) document.getElementById('f_has_skill').checked = dbFilter.hasSkill;
    if(document.getElementById('f_has_ability')) document.getElementById('f_has_ability').checked = dbFilter.hasAbility;

    const setChecks = (name, vals) => {
        document.querySelectorAll(`input[name="${name}"]`).forEach(el => {
            el.checked = vals.includes(el.value);
        });
    };
    setChecks('f_pos', dbFilter.pos);
    setChecks('f_sty', dbFilter.style);
    setChecks('f_prm', dbFilter.params);
    setChecks('s_prm', dbFilter.sortParams);
    
    const radio = document.querySelector(`input[name="f_logic"][value="${dbFilter.paramLogic}"]`);
    if(radio) radio.checked = true;

    if(document.getElementById('s_use_my_level')) 
        document.getElementById('s_use_my_level').checked = dbFilter.useMyLevel;

    document.getElementById('filterModal').style.display = 'flex';
    switchFilterTab('filter');
};

window.closeFilterModal = () => {
    document.getElementById('filterModal').style.display = 'none';
};

window.switchFilterTab = (tabName) => {
    document.querySelectorAll('.filter-tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(`tab-${tabName}`).style.display = 'block';
    
    document.querySelectorAll('.modal-tab-btn').forEach(el => el.classList.remove('active'));
    // クリックされたボタンをアクティブ化（eventが取れない場合は簡易処理）
    const btns = document.querySelectorAll('.modal-tab-btn');
    if (tabName === 'filter' && btns[0]) btns[0].classList.add('active');
    if (tabName === 'sort' && btns[1]) btns[1].classList.add('active');
};

window.applyFilters = () => {
    dbFilter.rarity.SSR = document.getElementById('f_rar_SSR').checked;
    dbFilter.rarity.SR = document.getElementById('f_rar_SR').checked;
    dbFilter.ownedOnly = document.getElementById('f_owned_only').checked;
    
    if(document.getElementById('f_has_skill')) dbFilter.hasSkill = document.getElementById('f_has_skill').checked;
    if(document.getElementById('f_has_ability')) dbFilter.hasAbility = document.getElementById('f_has_ability').checked;

    const getChecks = (name) => {
        const arr = [];
        document.querySelectorAll(`input[name="${name}"]:checked`).forEach(el => arr.push(el.value));
        return arr;
    };
    dbFilter.pos = getChecks('f_pos');
    dbFilter.style = getChecks('f_sty');
    dbFilter.params = getChecks('f_prm');
    
    const logicEl = document.querySelector('input[name="f_logic"]:checked');
    dbFilter.paramLogic = logicEl ? logicEl.value : 'OR';

    dbFilter.sortParams = getChecks('s_prm');
    
    if(document.getElementById('s_use_my_level'))
        dbFilter.useMyLevel = document.getElementById('s_use_my_level').checked;

    renderDatabase();
    closeFilterModal();
};

// --- Simulator Condition Logic ---
window.changeCondition = (val, btn) => {
    // UIの切り替え
    document.querySelectorAll('.cond-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // 値の更新
    document.getElementById('conditionMod').value = val;
    
    // 再計算
    if (typeof updateCalc === 'function') updateCalc();
};

// --- Bulk Selection Mode Logic (Phase 4) ---

window.toggleSelectMode = () => {
    isSelectMode = !isSelectMode;
    selectedKeys.clear(); // モード切替時にリセット
    
    // UI制御
    const bar = document.getElementById('bulkActionBar');
    const btn = document.getElementById('btnSelectMode');
    const tray = document.getElementById('compareTray');
    
    if (isSelectMode) {
        if(bar) bar.classList.add('active');
        if(btn) btn.classList.add('active');
        if(tray) tray.style.display = 'none'; // トレイを隠す
    } else {
        if(bar) bar.classList.remove('active');
        if(btn) btn.classList.remove('active');
        if(tray) tray.style.display = 'block'; // トレイを戻す
    }
    
    // 表示更新
    updateBulkCount();
    renderDatabase();
};

window.toggleBulkSelect = (key) => {
    if (selectedKeys.has(key)) {
        selectedKeys.delete(key);
    } else {
        selectedKeys.add(key);
    }
    // 全体再描画は重いので、DOMのクラスだけ操作して最適化
    // (renderDatabaseのロジックと整合性を取るため、今回はシンプルに再描画を呼ぶ形でも可。
    //  ただし、スムーズな動作のためにrenderDatabaseを呼びます)
    renderDatabase(); 
    updateBulkCount();
};

window.updateBulkCount = () => {
    const el = document.getElementById('bulkCount');
    if(el) el.innerText = selectedKeys.size;
};

window.execBulkAction = (action, value) => {
    if (selectedKeys.size === 0) return alert("カードが選択されていません");
    if (!confirm(`${selectedKeys.size}枚のカードを更新しますか？`)) return;

    selectedKeys.forEach(key => {
        // データがなければ作成
        if (!myCards[key]) {
            // 元カード情報を探す (少し非効率だが安全策)
            const [name, title] = key.split('_'); 
            const card = cardsDB.find(c => c.name === name && c.title === title);
            const defaultLvl = (card && card.rarity === 'SSR') ? 50 : 45;
            myCards[key] = { owned: false, level: defaultLvl, favorite: false };
        }

        if (action === 'owned') {
            myCards[key].owned = value;
        } else if (action === 'level_max') {
            // 所持状態にしてレベルMAXへ
            myCards[key].owned = true;
            // カード情報からレアリティ判定が必要
            const [name, title] = key.split('_'); 
            const card = cardsDB.find(c => c.name === name && c.title === title);
            myCards[key].level = (card && card.rarity === 'SSR') ? 50 : 45;
        }
    });

    saveInv(); // 保存
    
    alert("更新しました");
    toggleSelectMode(); // 完了したらモード終了
};

window.setSimSlotFromModal = () => {
    if (!currentModalItem || activeSlotIndex === null) return;
    // スロットにセット
    selectedSlots[activeSlotIndex] = currentModalItem.original;
    
    // 関連モーダルをすべて閉じる
    closeCardDetailModal();
    document.getElementById('simCardPickerModal').style.display = 'none';
    
    // 再計算
    updateCalc();
};

/* --- 以下、v1.1 一括操作機能の拡張 (新規追加) --- */

// 1. 全選択 / 全解除
window.toggleBulkSelectAll = (doSelect) => {
    // ステップ1で保存したリストを使用
    if (typeof window.lastRenderedItems === 'undefined' || !window.lastRenderedItems) {
        return alert("リストが見つかりません");
    }

    if (doSelect) {
        // 現在表示されている全てのカードのキーを選択セットに追加
        window.lastRenderedItems.forEach(item => {
            selectedKeys.add(item.key);
        });
    } else {
        // 全解除
        selectedKeys.clear();
    }
    
    // 画面更新
    renderDatabase();
    updateBulkCount();
};

// 2. レベル変更モーダルを開く
window.openBulkLevelModal = () => {
    if (selectedKeys.size === 0) return alert("カードが選択されていません");
    
    // モーダルのスライダー等を初期化
    const defaultVal = 50;
    document.getElementById('bulkLevelSlider').value = defaultVal;
    document.getElementById('bulkLevelVal').innerText = defaultVal;
    
    document.getElementById('bulkLevelModal').style.display = 'flex';
};

// 3. モーダル内の数値を更新 (ボタン/スライダー用)
window.setBulkLevelVal = (val) => {
    document.getElementById('bulkLevelSlider').value = val;
    document.getElementById('bulkLevelVal').innerText = val;
};

// 4. 一括レベル適用実行
window.applyBulkLevel = () => {
    const lvl = parseInt(document.getElementById('bulkLevelSlider').value);
    
    if (!confirm(`${selectedKeys.size}枚のカードを Lv.${lvl} に設定しますか？`)) return;
    
    selectedKeys.forEach(key => {
        if (!myCards[key]) {
            // 未所持データなら新規作成して所持済みにする
            myCards[key] = { owned: true, level: lvl, favorite: false };
        } else {
            // 既存データならレベル更新＆所持済みにする
            myCards[key].level = lvl;
            myCards[key].owned = true; 
        }
    });
    
    saveInv(); // 保存
    
    document.getElementById('bulkLevelModal').style.display = 'none'; // モーダル閉じる
    alert("更新しました");
    
    // 一括モードを終了して一覧を更新
    toggleSelectMode();
};