// --- Global State ---
var currentView = 'database';

// 代用カード検索用ステート
var substituteSearch = { 
    active: false, 
    targetCard: null, 
    criteria: 'params', 
    ownedOnly: false, 
    useBonus: false 
};

// フィルタ条件
var dbFilter = { 
    text: '', 
    rarity: { SSR: true, SR: true }, 
    ownedOnly: false,
    hasSkill: false,
    hasAbility: false,
    hasSpecial: false,
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

// シミュレータ選択モード管理
var simSelectState = { active: false, slotIndex: null };

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
        
        // シミュレータ目標値のキャッシュ読込
        const cachedTarget = localStorage.getItem('tra_sim_target_pct');
        if (cachedTarget) {
            const el = document.getElementById('targetPct');
            const disp = document.getElementById('targetPctDisp');
            if(el && disp) {
                el.value = cachedTarget;
                disp.innerText = cachedTarget;
            }
        }

        // 初期モード設定
        if (typeof setAppMode === 'function') setAppMode('view');
        
        // --- スマホシミュレーター用 初期設定を追加 ---
        document.body.setAttribute('data-mobile-sim', 'manual');
        document.body.classList.add('sim-no-result');
        // ----------------------------------------

        // 初期ビュー設定
        switchView('database');

        // 初期化関数
        if(typeof renderProfileSelector === 'function') renderProfileSelector();
        if(typeof initStatInputs === 'function') initStatInputs();
        if(typeof initPosSelect === 'function') initPosSelect();
        if(typeof initEditors === 'function') initEditors();
        
        // PWA Service Worker登録 & 更新チェック
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').then(reg => {
                console.log('SW registered!', reg);
                // 更新が見つかった場合の処理
                reg.onupdatefound = () => {
                    const installingWorker = reg.installing;
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                // 新しいコンテンツが利用可能。sw.jsでskipWaitingしているので、
                                // ここではユーザーに通知するか、自動リロードする。
                                console.log('New content is available; please refresh.');
                                // 今回はシンプルにリロードはユーザー任せ、あるいは次回の起動で適用
                            } else {
                                console.log('Content is cached for offline use.');
                            }
                        }
                    };
                };
            });
            
            // 新しいSWが制御を開始したらリロードする（即時更新のため）
            let refreshing;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (refreshing) return;
                window.location.reload();
                refreshing = true;
            });
        }

        // データ取得
        // データ取得
        await fetchAllDB();
        
        // 新カードアナウンスのチェック
        if (typeof checkNewCards === 'function') checkNewCards();
        
        // --- Firebase Push通知 初期化 ---
        if (typeof firebase !== 'undefined' && typeof FIREBASE_CONFIG !== 'undefined') {
            try {
                // Firebaseの初期化
                if (!firebase.apps.length) {
                    firebase.initializeApp(FIREBASE_CONFIG);
                }
                const messaging = firebase.messaging();

                // ユーザーに通知の許可をリクエスト
                Notification.requestPermission().then((permission) => {
                    if (permission === 'granted') {
                        console.log('通知が許可されました。');
                        
                        // ★修正：既存の sw.js を明示的に指定してトークンを取得する
                        navigator.serviceWorker.ready.then((registration) => {
                            messaging.getToken({ 
                                vapidKey: FIREBASE_VAPID_KEY,
                                serviceWorkerRegistration: registration 
                            }).then((currentToken) => {
                                if (currentToken) {
                                    console.log('Firebase Token取得成功');
                                    // ★テスト用：取得したトークンをコピーできるように画面に表示する
                                    //prompt("【テスト用】Firebaseのトークンが取得できました。これをコピーして、Firebaseコンソールの「テストメッセージの送信」に貼り付けてください。", currentToken);
                                }
                            }).catch((err) => {
                                console.error('トークン取得エラー: ', err);
                                alert('通知の設定エラー(Token): ' + err.message);
                            });
                        });
                    }
                });

                // アプリを画面で開いている最中に通知を受信した時の処理
                messaging.onMessage((payload) => {
                    console.log('アプリ起動中に通知を受信: ', payload);
                    alert(`【お知らせ】\n${payload.notification.title}\n${payload.notification.body}`);
                });

            } catch(e) {
                console.warn("Firebase初期化エラー:", e);
            }
        }
        
        // 開発者ログイン状態チェック
        if (typeof checkDevLogin === 'function') checkDevLogin();

        // 初期モード設定
        if (typeof setAppMode === 'function') setAppMode('view');
        
        // 初期ビュー設定
        switchView('database'); 
        
        updateTrayUI();

        // --- モーダルオーバーレイの背景クリックで閉じる処理を一括登録 ---
        document.querySelectorAll('.modal-overlay, #profileModal, #cardModal').forEach(overlay => {
            overlay.addEventListener('click', function(e) {
                // オーバーレイの背景（黒い部分）自体がクリックされたか判定
                if (e.target === this) {
                    const closeBtn = this.querySelector('.btn-close');
                    const iconCloseBtn = this.querySelector('.modal-tab-header .icon-btn'); // フィルタモーダル等の×ボタン
                    
                    if (closeBtn && closeBtn.style.display !== 'none') {
                        closeBtn.click();
                    } else if (iconCloseBtn) {
                        iconCloseBtn.click();
                    } else if (this.id === 'filterModal') {
                        if (typeof closeFilterModal === 'function') closeFilterModal();
                    } else if (this.id === 'cardDetailModal') {
                        if (typeof closeCardDetailModal === 'function') closeCardDetailModal();
                    } else if (this.id === 'warningModal') {
                        if (typeof closeWarningModal === 'function') closeWarningModal();
                    } else if (this.id === 'newCardAnnounceModal') {
                        if (typeof closeNewCardAnnounceModal === 'function') closeNewCardAnnounceModal();
                    } else if (this.id === 'profileModal') {
                        if (typeof closeProfileModal === 'function') closeProfileModal();
                    } else if (this.id === 'cardModal') {
                        this.style.display = 'none';
                    } else if (this.id === 'infoAnnounceModal') {
                        if (typeof closeInfoAnnounceModal === 'function') closeInfoAnnounceModal();
                    }
                }
            });
        });

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
    // 一括選択モード中は切り替え禁止
    if (isSelectMode) return; 

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

    // MyCardsモードに切り替えたらフィルタをリセット
    if (mode === 'mycards') {
        resetFilters();
    }

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
        hasSpecial: false,
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
// --- js/app.js ---

window.renderDatabase = () => {
    const grid = document.getElementById('dbGrid');
    if(!grid) return;
    
    grid.innerHTML = '';
    const vType = (typeof viewType !== 'undefined') ? viewType : 'grid';
    grid.className = (vType === 'grid') ? 'card-grid-visual' : 'card-grid-list';
    
    const currentMode = (typeof appMode !== 'undefined') ? appMode : 'view';
    document.body.setAttribute('data-app-mode', currentMode);
    document.body.setAttribute('data-select-mode', isSelectMode);

    // Active Filters Badge
    const afDiv = document.getElementById('activeFilters');
    if(afDiv) {
        afDiv.innerHTML = '';
        const badges = [];

        // 代用検索バッジ
        if (substituteSearch.active && substituteSearch.targetCard) {
            const critName = substituteSearch.criteria === 'params' ? 'パラメータ' : (substituteSearch.criteria === 'skills' ? 'スキル/アビ' : '特殊効果');
            const targetName = substituteSearch.targetCard.original.name;
            afDiv.innerHTML += `
                <span class="tag" style="background:var(--primary); color:#000; cursor:pointer; font-weight:bold;" onclick="clearSubstituteSearch()">
                    🔍 代用検索: ${targetName} (${critName}) <i class="fa-solid fa-xmark"></i>
                </span>
            `;
        }

        if(currentMode === 'mycards') badges.push("モード: 所持/育成");
        if(isSelectMode) badges.push("★ 選択モード中");
        if(dbFilter.ownedOnly) badges.push("所持のみ");
        if(dbFilter.hasSkill) badges.push("スキル所持");
        if(dbFilter.hasAbility) badges.push("アビリティ所持");
        if(dbFilter.hasSpecial) badges.push("覚醒Pt所持");
        if(dbFilter.skillText) badges.push(`Skill:"${dbFilter.skillText}"`);
        if(dbFilter.pos.length) badges.push(`Pos:${dbFilter.pos.join(',')}`);
        if(dbFilter.style.length) badges.push(`Style:${dbFilter.style.join(',')}`);
        if(dbFilter.sortParams.length) badges.push(`Sort:${dbFilter.sortParams.join('+')}`);
        
        afDiv.innerHTML += badges.map(l => `<span class="tag" style="background:#334155;">${l}</span>`).join('');
    }

    // ヘルパー: スキル名を取り出す
    const getSaName = (item) => (typeof item === 'object' && item !== null) ? item.name : item;

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

        if (dbFilter.hasSkill && !(card.abilities || []).some(a => skillsDB.some(s => s.name === getSaName(a)))) return null;
        if (dbFilter.hasAbility && !(card.abilities || []).some(a => abilitiesDB.some(ab => ab.name === getSaName(a)))) return null;
        if (dbFilter.hasSpecial && !(card.special_effects && card.special_effects.some(se => se.type === '覚醒Pt'))) return null;
        if (dbFilter.skillText && !(card.abilities || []).some(a => getSaName(a).toLowerCase().includes(dbFilter.skillText))) return null;

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
        let substScore = 0;

        // 代用検索処理
        if (substituteSearch.active && substituteSearch.targetCard) {
            if (substituteSearch.ownedOnly && !isOwned) return null;
            // 検索元自身は除外する
            if (key === substituteSearch.targetCard.key) return null;

            const targetObj = { original: card, key: key, level: (userData.level || (card.rarity==='SSR'?50:45)) };
            substScore = calculateSubstituteScore(substituteSearch.targetCard, targetObj, substituteSearch.criteria, substituteSearch.useBonus);
            
            if (substScore <= 0) return null; // 0%は非表示にする
        } else if (dbFilter.sortParams.length > 0) {
            if (dbFilter.useMyLevel && !isOwned) {
                sortScore = 0;
            } else {
                let level = (card.rarity==='SSR'?50:45);
                if (dbFilter.useMyLevel && isOwned) level = (parseInt(userData.level)||1);
                
                const tPos = dbFilter.pos[0] || null;
                const tStyle = dbFilter.style[0] || null;
                const stats = getCardStatsAtLevel(card, level, tPos, tStyle, 1.0);
                dbFilter.sortParams.forEach(p => sortScore += (stats[p] || 0));
            }
        }

        return { original: card, idx, key, isFav, isOwned, sortScore, substScore, level: (userData.level || 1) };
    }).filter(item => item !== null);
    
    // Sort Logic
    list.sort((a, b) => {
        if (substituteSearch.active) {
            return b.substScore - a.substScore; // 代用検索はスコア降順
        }
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

    window.lastRenderedItems = list;
    
    // Render
    list.forEach(item => {
        const c = item.original;
        const imgPath = `img/cards/${c.name}_${c.title}.png`;
        const el = document.createElement('div');
        
        const isSelected = isSelectMode && selectedKeys.has(item.key);
        el.className = `db-card ${item.isFav ? 'fav' : ''} ${item.isOwned ? 'owned' : 'unowned'} ${isSelected ? 'bulk-selected' : ''}`;
        
        if (vType === 'grid') {
            let substBadge = substituteSearch.active ? `<span class="badge" style="background:var(--primary);color:#000;">一致:${item.substScore.toFixed(1)}%</span>` : '';
            el.innerHTML = `
                <div class="fav-icon"><i class="fa-solid fa-heart"></i></div>
                <img src="${imgPath}" class="db-card-img" loading="lazy" onerror="this.src='https://placehold.jp/333333/ffffff/300x400.png?text=No+Img'">
                <div class="db-info">
                    <div class="db-name">${c.name}</div>
                    <div class="db-badges">
                        <span class="badge ${c.rarity}">${c.rarity}</span>
                        ${item.isOwned ? `<span class="badge" style="background:#22c55e;color:#000;">Lv.${item.level}</span>` : ''}
                        ${item.sortScore > 0 ? `<span style="color:#fbbf24;font-weight:bold;margin-left:2px;">${(item.sortScore/10).toFixed(1)}</span>` : ''}
                        ${substBadge}
                    </div>
                </div>
            `;
        } else {
            let displayStats = [];
            if (substituteSearch.active) {
                displayStats.push(`一致率: ${item.substScore.toFixed(1)}%`);
            } else if (dbFilter.sortParams.length > 0) {
                displayStats.push(`合計:${(item.sortScore/10).toFixed(1)}`);
            } else {
                const dLvl = (currentMode === 'mycards' && item.isOwned) ? item.level : (c.rarity==='SSR'?50:45);
                const stats = getCardStatsAtLevel(c, dLvl, null, null, 1.0);
                displayStats = Object.entries(stats).sort(([,a], [,b]) => b - a).slice(0, 3).map(([k,v]) => `${k}:${(v/10).toFixed(0)}`);
            }
            
            // Skill Tag Generation
            const skillsHtml = (c.abilities || []).map(ab => {
                let name, rarity;
                if (typeof ab === 'object' && ab !== null) {
                    name = ab.name;
                    rarity = ab.rarity || 'Gold';
                } else {
                    name = ab;
                    rarity = (c.rarity === 'SSR') ? 'Gold' : 'Silver';
                }
                const isSkill = !!skillsDB.find(s => s.name === name);
                const typeChar = isSkill ? 'S' : 'A';
                const typeClass = isSkill ? 'type-S' : 'type-A';
                const borderClass = rarity === 'Silver' ? 'bd-silver' : (rarity === 'Bronze' ? 'bd-bronze' : 'bd-gold');

                return `<div class="skill-tag-chip ${borderClass}"><span class="skill-type-icon ${typeClass}">${typeChar}</span>${name}</div>`;
            }).join('');
            
            el.innerHTML = `
                <img src="${imgPath}" class="db-card-img" loading="lazy" onerror="this.src='https://placehold.jp/333333/ffffff/300x400.png?text=No+Img'">
                <div class="db-info" style="overflow:hidden;">
                    <div style="display:flex; justify-content:space-between; width:100%;">
                        <div class="db-name" style="font-weight:bold;">${c.name} <span style="font-size:0.7em; color:#999;">${c.title}</span></div>
                        <div class="db-badges">
                            <span class="badge ${c.rarity}">${c.rarity}</span>
                            ${item.isOwned ? `<span class="badge" style="background:#22c55e;color:#000;">Lv.${item.level}</span>` : ''}
                        </div>
                    </div>
                    <div class="list-stats" style="margin-bottom:4px;">${displayStats.map(s => `<span style="${substituteSearch.active ? 'color:var(--primary); font-weight:bold;' : ''}">${s}</span>`).join('')}</div>
                    <div class="skill-tag-container">${skillsHtml || '<span style="font-size:0.7rem; color:#666;">なし</span>'}</div>
                </div>
            `;
        }
        
        el.onclick = () => {
            if (simSelectState.active) {
                const modalItem = { original: c, key: item.key, isOwned: true, level: item.level };
                openMyCardDetailModal(modalItem, true);
                return;
            }
            if (isSelectMode) {
                toggleBulkSelect(item.key);
            } else {
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
    
    document.getElementById('cdmTitle').innerText = `[${c.rarity}] ${c.name}`;
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
    const rarity = c.rarity; // 'SSR' or 'SR'
    
    // カード情報から「スキルのレアリティ」を推測 (現状カードデータにはないため、カードのレアリティに合わせる運用とする)
    // ※Admin運用で「カードレアリティ=スキルレアリティ」とする前提。
    // 金=SSR, 銀=SR とする。
    const saRarity = (rarity === 'SSR') ? 'Gold' : 'Silver'; 

    const imgPath = `img/cards/${c.name}_${c.title}.png`;
    const currentLevel = userData.owned ? parseInt(userData.level) : 1;
    const maxLevel = c.rarity === 'SSR' ? 50 : 45;
    const stats = getCardStatsAtLevel(c, currentLevel, null, null, 1.0);

    // スキルLv計算
    const skillLv = getSkillLevelFromCardLevel(rarity, currentLevel);

    const levels = (c.rarity === 'SSR') ? [30, 35, 40, 45, 50] : [25, 30, 35, 40, 45];
    const labels = ["無凸", "1凸", "2凸", "3凸", "完凸"];
    
    let presetBtns = '<div class="level-btn-group">';
    levels.forEach((lvl, idx) => {
        const active = (lvl === currentLevel) ? 'active' : '';
        presetBtns += `<button class="lvl-btn ${active}" data-lvl="${lvl}" onclick="updateMyCardLevel(${lvl})">${labels[idx]}<br>(${lvl})</button>`;
    });
    presetBtns += '</div>';

    // スキルリスト生成 (新旧データ構造両対応)
    let skillListHtml = '';
    if (c.abilities && c.abilities.length > 0) {
        c.abilities.forEach(ab => {
            // abが文字列なら旧データ、オブジェクトなら新データ
            const isObj = (typeof ab === 'object' && ab !== null);
            const saName = isObj ? ab.name : ab;
            const saRarity = isObj ? ab.rarity : (rarity === 'SSR' ? 'Gold' : 'Silver'); // 旧データはカードに合わせる

            const isS = !!skillsDB.find(s => s.name === saName); // バッジ表示用の簡易判定
            const typeBadge = `<span class="sa-badge sa-${saRarity.toLowerCase()}">${isS ? 'S' : 'A'}</span>`;
            
            skillListHtml += `
            <div class="modal-skill-row" onclick="openSaModal('${saName}', '${saRarity}', ${skillLv})">
                ${typeBadge}
                <span style="font-weight:bold; flex:1;">${saName}</span>
                <span class="modal-skill-lv">Lv.${skillLv}</span>
            </div>`;
        });
    }

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
                <div style="margin-top:5px;">${skillListHtml}</div>
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
            <div id="mcTotalStat" style="font-size:0.8rem; font-weight:bold; color:var(--primary); margin-bottom:5px; text-align:right;"></div>
            <div class="stat-grid" id="mcStatGrid">${renderStatGridHTML(c.stats, stats)}</div>
            <div id="mcSpecialEffects">${renderSpecialEffectsHTML(stats._special_effects)}</div>
        </div>
    `;
    
    // 初回描画時の合計値セット
    let totalStat = 0;
    Object.keys(stats).forEach(k => { if([...STATS, ...GK_STATS].includes(k)) totalStat += stats[k]; });
    document.getElementById('mcTotalStat').innerText = `総合計: ${Math.round(totalStat / 10)}`;
    
    // フッター更新 (既存コードと同じなので省略)
    const footer = document.querySelector('#cardDetailModal .modal-footer');
    // ... (footer生成コードは既存維持)
    const btnClass = userData.owned ? 'btn-accent' : 'btn-primary';
    const btnIcon = userData.owned ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-plus"></i>';
    const btnText = userData.owned ? '所持しています' : '所持に変更';

    footer.innerHTML = `
        <button class="btn btn-icon" onclick="openSubstituteModal()" style="white-space: nowrap;"><i class="fa-solid fa-magnifying-glass"></i> 代用検索</button>
        <button class="btn btn-icon" onclick="addToTrayFromDetail()" style="white-space: nowrap;"><i class="fa-solid fa-scale-balanced"></i> 比較</button>
        <button id="btnToggleOwnFooter" class="btn ${btnClass}" onclick="toggleMyCardOwnedFromModal()" style="flex: 2; padding: 10px 5px;">
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
    
    // 合計値再計算
    let totalStat = 0;
    Object.keys(stats).forEach(k => { if([...STATS, ...GK_STATS].includes(k)) totalStat += stats[k]; });
    const totalEl = document.getElementById('mcTotalStat');
    if(totalEl) totalEl.innerText = `総合計: ${Math.round(totalStat / 10)}`;

    document.getElementById('mcStatGrid').innerHTML = renderStatGridHTML(c.stats, stats);
    const seDiv = document.getElementById('mcSpecialEffects');
    if(seDiv) seDiv.innerHTML = renderSpecialEffectsHTML(stats._special_effects);

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
            btn.innerHTML = '<i class="fa-solid fa-check"></i> <span id="btnToggleOwnText">所持</span>';
        } else {
            btn.className = "btn btn-primary";
            btn.innerHTML = '<i class="fa-solid fa-plus"></i> <span id="btnToggleOwnText">未所持</span>';
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
    document.getElementById('cdmTitle').innerText = `[${c.rarity}] ${c.name}`;
    
    renderViewModalBody();
    
    // Viewモード用フッター
    modal.querySelector('.modal-footer').innerHTML = `
        <button class="btn btn-icon" id="btnFav" onclick="toggleDetailFav()" style="white-space: nowrap;"><i class="fa-regular fa-heart"></i> お気に入り</button>
        <button class="btn btn-icon" onclick="openSubstituteModal()" style="white-space: nowrap;"><i class="fa-solid fa-magnifying-glass"></i> 代用検索</button>
        <button class="btn btn-icon" onclick="addToTrayFromDetail()" style="white-space: nowrap;"><i class="fa-solid fa-scale-balanced"></i> 比較</button>
        <button class="btn btn-primary" id="btnOwned" onclick="toggleDetailOwned()" style="flex:2; padding: 10px 5px;">所持にする</button>
    `;
    updateDetailButtons();
    modal.style.display = 'flex';
};

window.renderViewModalBody = () => {
    if (!currentModalItem) return;
    const c = currentModalItem.original;
    const rarity = c.rarity;
    const saRarity = (rarity === 'SSR') ? 'Gold' : 'Silver'; 
    const imgPath = `img/cards/${c.name}_${c.title}.png`;
    const stats = getCardStatsAtLevel(c, currentViewLevel, null, null, 1.0);
    const skillLv = getSkillLevelFromCardLevel(rarity, currentViewLevel);

    const levels = (c.rarity === 'SSR') ? [30, 35, 40, 45, 50] : [25, 30, 35, 40, 45];
    const labels = ["無凸", "1凸", "2凸", "3凸", "完凸"];
    
    let btnHtml = '<div class="level-btn-group">';
    levels.forEach((lvl, idx) => {
        const active = (lvl === currentViewLevel) ? 'active' : '';
        btnHtml += `<button class="lvl-btn ${active}" onclick="updateViewLevel(${lvl})">${labels[idx]}<br>(Lv${lvl})</button>`;
    });
    btnHtml += '</div>';

    // スキルリスト生成 (新旧データ構造両対応)
    let skillListHtml = '';
    if (c.abilities && c.abilities.length > 0) {
        c.abilities.forEach(ab => {
            const isObj = (typeof ab === 'object' && ab !== null);
            const saName = isObj ? ab.name : ab;
            const saRarity = isObj ? ab.rarity : (rarity === 'SSR' ? 'Gold' : 'Silver');

            const isS = !!skillsDB.find(s => s.name === saName);
            const typeBadge = `<span class="sa-badge sa-${saRarity.toLowerCase()}">${isS ? 'S' : 'A'}</span>`;
            
            skillListHtml += `
            <div class="modal-skill-row" onclick="openSaModal('${saName}', '${saRarity}', ${skillLv})">
                ${typeBadge}
                <span style="font-weight:bold; flex:1;">${saName}</span>
                <span class="modal-skill-lv">Lv.${skillLv}</span>
            </div>`;
        });
    }

    document.getElementById('cdmBody').innerHTML = `
        <div style="display:flex; gap:15px; margin-bottom:10px;">
            <img src="${imgPath}" style="width:100px; height:133px; object-fit:cover; border-radius:6px; border:1px solid #444;" onerror="this.src='https://placehold.jp/100x133.png?text=NoImg'">
            <div style="flex:1;">
                <div style="font-weight:bold; font-size:1.1rem; line-height:1.3;">${c.name}</div>
                <div style="font-size:0.8rem; color:#ccc; margin-bottom:5px;">${c.title}</div>
                <div style="margin-top:5px;">${skillListHtml}</div>
                <div style="margin-top:8px; font-size:0.75rem; color:#94a3b8;">
                    ボーナス: ${c.bonuses ? c.bonuses.map(b=>`${b.type}+${b.value}%`).join(', ') : (c.bonus_type ? `${c.bonus_type}+${c.bonus_value}%` : 'なし')}
                </div>
            </div>
        </div>
        ${btnHtml}
        <div style="background:#0f172a; padding:10px; border-radius:6px; border:1px solid #333;">
            <div style="font-size:0.8rem; font-weight:bold; color:var(--primary); margin-bottom:5px; text-align:right;">総合計: <span id="viewTotalStat"></span></div>
            <div class="stat-grid">${renderStatGridHTML(c.stats, stats)}</div>
            ${renderSpecialEffectsHTML(stats._special_effects)}
        </div>
    `;
    
    // 合計値計算セット
    let totalStat = 0;
    Object.keys(stats).forEach(k => { if([...STATS, ...GK_STATS].includes(k)) totalStat += stats[k]; });
    document.getElementById('viewTotalStat').innerText = Math.round(totalStat / 10);
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
        if (currentModalItem.isFav) { btnFav.innerHTML = '<i class="fa-solid fa-heart"></i> 登録中'; btnFav.classList.add('active'); } 
        else { btnFav.innerHTML = '<i class="fa-regular fa-heart"></i> お気に入り'; btnFav.classList.remove('active'); }
    }
    const btnOwned = document.getElementById('btnOwned');
    if(btnOwned) {
        if (currentModalItem.isOwned) { btnOwned.innerHTML = '所持'; btnOwned.style.background = '#22c55e'; btnOwned.style.color = '#000'; } 
        else { btnOwned.innerHTML = '未所持'; btnOwned.style.background = '#334155'; btnOwned.style.color = '#fff'; }
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

function renderSpecialEffectsHTML(calculatedSE) {
    if (!calculatedSE || Object.keys(calculatedSE).length === 0) return '';
    let html = '<div style="margin-top:8px; border-top:1px dashed #334155; padding-top:8px;">';
    html += '<div style="font-size:0.7rem; color:#94a3b8; margin-bottom:4px;">特殊効果</div>';
    Object.entries(calculatedSE).forEach(([k, v]) => {
        html += `<div style="display:flex; justify-content:space-between; font-size:0.75rem;"><span style="color:#fbbf24;">${k}</span><span style="font-weight:bold; color:#fff;">${(v/10).toFixed(1)}</span></div>`;
    });
    html += '</div>';
    return html;
}
// --- Comparison (Same as before) ---
let compGlobalBonusOn = false;

window.toggleCompGlobalBonus = (isOn) => {
    compGlobalBonusOn = isOn;
    updateComparisonTable();
};

window.toggleCompCardBonus = (idx, bIdx, isOn) => {
    if(compGlobalBonusOn) return; // 一括ONの時は個別の操作を無視
    compCardStates[idx].activeBonuses[bIdx] = isOn;
    updateComparisonTable();
};

window.runComparison = () => {
    if(compareTray.length < 1) return alert("比較するカードを選択してください");
    compGlobalBonusOn = false; // 開くたびに一括ボーナスをOFFにリセット
    compCardStates = compareTray.map(c => {
        const state = { 
            id: c.name + "_" + c.title, 
            level: c.rarity === 'SSR' ? 50 : 45,
            activeBonuses: {} 
        };
        // 初期状態では全てのボーナスをOFFにする
        const bonusesList = [];
        if (c.bonuses && c.bonuses.length > 0) {
            c.bonuses.forEach(b => bonusesList.push(b));
        } else if (c.bonus_type) {
            bonusesList.push({ type: c.bonus_type, value: c.bonus_value || 0 });
        }
        bonusesList.forEach((_, i) => state.activeBonuses[i] = false);
        return state;
    });
    updateComparisonTable();
    document.getElementById('comparisonModal').style.display = 'flex';
};

window.updateComparisonTable = () => {
    const table = document.getElementById('compTable');
    if(!table) return;
    table.innerHTML = '';
    
    // ヘッダー生成 (一括ボーナストグル追加)
    let thead = `<thead>
        <tr>
            <th style="min-width:120px;">
                <div style="display:flex; flex-direction:column; align-items:flex-start; gap:6px; font-size:0.75rem; color:var(--primary); font-weight:bold;">
                    <div>一括ボーナス適用</div>
                    <label class="toggle-switch">
                        <input type="checkbox" id="compGlobalBonus" ${compGlobalBonusOn ? 'checked' : ''} onchange="toggleCompGlobalBonus(this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </th>`;
            
    compareTray.forEach((c, idx) => {
        const state = compCardStates[idx];
        const imgPath = `img/cards/${c.name}_${c.title}.png`;
        const levels = c.rarity === 'SSR' ? [30,35,40,45,50] : [25,30,35,40,45];
        const labels = ["0","1","2","3","完"];
        let btnHtml = `<div class="comp-lvl-btns">` + levels.map((lvl, i) => `<button class="comp-lvl-btn ${lvl===state.level?'active':''}" onclick="updateCompCardLevel(${idx}, ${lvl})">${labels[i]}</button>`).join('') + `</div>`;
        
        // ボーナスリストの生成
        const bonusesList = [];
        if (c.bonuses && c.bonuses.length > 0) {
            c.bonuses.forEach(b => bonusesList.push(b));
        } else if (c.bonus_type) {
            bonusesList.push({ type: c.bonus_type, value: c.bonus_value || 0 });
        }

        // 個別ボーナストグル生成
        const disabled = compGlobalBonusOn ? 'disabled' : '';
        const opacity = compGlobalBonusOn ? '0.4' : '1';
        
        let bToggleHtml = `<div style="margin-top:6px; opacity:${opacity}; background:#0f172a; border-radius:4px; padding:4px; text-align:center;">`;
        
        if (bonusesList.length === 0) {
            bToggleHtml += `<div style="font-size:0.55rem; color:#94a3b8; margin-bottom:4px;">ボーナスなし</div>`;
        } else {
            bonusesList.forEach((b, bIdx) => {
                const isChecked = compGlobalBonusOn || state.activeBonuses[bIdx];
                bToggleHtml += `
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                        <span style="font-size:0.55rem; color:#94a3b8; line-height:1.1; text-align:left; word-break:break-all;">${b.type}+${b.value}%</span>
                        <label class="toggle-switch" style="${disabled ? 'cursor:not-allowed;' : 'cursor:pointer;'} transform:scale(0.8); margin-left:4px; flex-shrink:0;">
                            <input type="checkbox" ${isChecked ? 'checked' : ''} ${disabled} onchange="toggleCompCardBonus(${idx}, ${bIdx}, this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                `;
            });
        }
        bToggleHtml += `</div>`;

        thead += `<th><div class="comp-card-header"><img src="${imgPath}" onerror="this.src='https://placehold.jp/50x65.png'"><div class="comp-card-name">${c.name}</div><div class="comp-card-ctrl"><span style="font-size:0.6rem;">Lv.${state.level}</span>${btnHtml}${bToggleHtml}</div></div></th>`;
    });
    thead += `</tr></thead>`;
    table.innerHTML += thead;

    // 各カードのステータス取得 (ボーナス適用処理)
    const cardStats = compareTray.map((c, idx) => {
        const state = compCardStates[idx];
        const rawStats = getCardStatsAtLevel(c, state.level, null, null, 1.0);
        
        // ボーナスリスト生成
        const bonusesList = [];
        if (c.bonuses && c.bonuses.length > 0) {
            c.bonuses.forEach(b => bonusesList.push(b));
        } else if (c.bonus_type) {
            bonusesList.push({ type: c.bonus_type, value: c.bonus_value || 0 });
        }

        // 有効なボーナス数値を加算する
        let bonusTotal = 0;
        let isAnyBonusActive = false;

        bonusesList.forEach((b, bIdx) => {
            if (compGlobalBonusOn || state.activeBonuses[bIdx]) {
                bonusTotal += b.value;
                isAnyBonusActive = true;
            }
        });

        if (!isAnyBonusActive) return rawStats; // 適用するボーナスがない場合はそのまま返す
        
        const bonusMult = 1 + (bonusTotal / 100);
        const bonusStats = {};
        for(let s in rawStats) {
            if(s === '_special_effects') {
                bonusStats[s] = rawStats[s];
                continue;
            }
            bonusStats[s] = Math.round(rawStats[s] * bonusMult);
        }
        return bonusStats;
    });

    // カテゴリ定義
    const COMP_CATEGORIES = [
        { label: 'SHO', color: '#ef4444', stats: ['決定力', 'キック力', '冷静さ'] },
        { label: 'PAS', color: '#eab308', stats: ['ショートパス', 'ロングパス', 'キック精度'] },
        { label: 'DRB', color: '#22c55e', stats: ['突破力', 'キープ力', 'ボールタッチ'] },
        { label: 'DEF①', color: '#3b82f6', stats: ['タックル', 'パスカット', 'マーク'] },
        { label: 'DEF②', color: '#8b5cf6', stats: ['セービング', '反応速度', '1対1'] },
        { label: 'PHY', color: '#f97316', stats: ['ジャンプ', 'コンタクト', 'スタミナ'] },
        { label: 'SPD', color: '#06b6d4', stats: ['走力', '敏捷性'] }
    ];

    let tbody = `<tbody>`;
    COMP_CATEGORIES.forEach(cat => {
        cat.stats.forEach(statName => {
            const isAllZero = cardStats.every(st => !(st[statName] > 0));
            if (isAllZero) return; // 誰も数値を持っていないステータスは非表示

            let row = `<tr>`;
            const catBadge = `<span style="display:inline-block; width:38px; font-size:0.6rem; font-weight:bold; background:rgba(255,255,255,0.1); color:${cat.color}; text-align:center; border-radius:3px; margin-right:6px; padding:2px 0; border:1px solid ${cat.color};">${cat.label}</span>`;
            row += `<td style="text-align:left;"><div style="display:flex; align-items:center;">${catBadge} <span>${statName}</span></div></td>`;
            
            let maxVal = -1;
            cardStats.forEach(st => { if((st[statName]||0) > maxVal) maxVal = st[statName]||0; });
            
            cardStats.forEach(st => {
                const val = st[statName] || 0;
                const classAttr = (val > 0 && val === maxVal) ? 'comp-val comp-win' : 'comp-val';
                row += `<td class="${classAttr}" style="${val===0?'color:#444;':''}">${val > 0 ? (val/10).toFixed(1) : '-'}</td>`;
            });
            row += `</tr>`;
            tbody += row;
        });
    });
    
    // スキル / アビリティ行 (クリックでモーダル展開)
    const skillBadge = `<span style="display:inline-block; width:38px; font-size:0.6rem; font-weight:bold; background:#334155; color:#fff; text-align:center; border-radius:3px; margin-right:6px; padding:2px 0;">SKL</span>`;
    tbody += `<tr><td style="text-align:left;"><div style="display:flex; align-items:center;">${skillBadge} <span>スキル</span></div></td>` + compareTray.map((c, idx) => {
        const state = compCardStates[idx];
        const skillLv = getSkillLevelFromCardLevel(c.rarity, state.level);

        const skillHtml = (c.abilities||[]).map(s => {
            let name, rarity;
            if (typeof s === 'object' && s !== null) {
                name = s.name; rarity = s.rarity;
            } else {
                name = s; rarity = (c.rarity === 'SSR') ? 'Gold' : 'Silver'; 
            }
            
            const isSkill = !!skillsDB.find(k => k.name === name);
            const tagClass = isSkill ? 'tag-skill' : 'tag-ability';
            const borderCol = rarity === 'Silver' ? '#cbd5e1' : (rarity === 'Bronze' ? '#d97706' : '#fbbf24');
            
            return `<div class="tag ${tagClass}" style="margin-bottom:3px; border-left:3px solid ${borderCol}; text-align:left; cursor:pointer;" onclick="openSaModal('${name}', '${rarity}', ${skillLv})">${name}</div>`;
        }).join('');
        return `<td style="font-size:0.6rem; white-space:normal; vertical-align:top;">${skillHtml}</td>`;
    }).join('') + `</tr></tbody>`;
    
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


// Fallback for missing funcs
window.openCardDetailModal = (item) => {
    if (typeof appMode !== 'undefined' && appMode === 'mycards') openMyCardDetailModal(item);
    else openViewDetailModal(item);
};

// --- Filter Modal Logic (Restored) ---

// --- フィルタボタン生成関数 (修正版: 文字数制限を撤廃) ---
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
        
        // ★修正: 文字数制限を削除し、そのままの名前(s)を表示する
        const labelText = s; 
        
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
    if(document.getElementById('f_has_special')) document.getElementById('f_has_special').checked = dbFilter.hasSpecial;

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
    if(document.getElementById('f_has_special')) dbFilter.hasSpecial = document.getElementById('f_has_special').checked;

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

// カードセット実行
window.setSimSlotFromModal = () => {
    if (!currentModalItem || simSelectState.slotIndex === null) return;
    
    // スロットにセット
    selectedSlots[simSelectState.slotIndex] = currentModalItem.original;
    
    // モーダルを閉じる
    closeCardDetailModal();
    
    // 選択モード終了して戻る
    cancelSimCardSelection(); // フラグ解除とView戻しを兼用
    
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

// 2. レベル変更モーダルを開く (修正版)
window.openBulkLevelModal = () => {
    // 選択チェック
    if (selectedKeys.size === 0) return alert("カードが選択されていません");
    
    // ★修正: スライダー初期化コードを削除し、単にモーダルを開くだけにする
    document.getElementById('bulkLevelModal').style.display = 'flex';
};

// 3. モーダル内の数値を更新 (ボタン/スライダー用)
window.setBulkLevelVal = (val) => {
    document.getElementById('bulkLevelSlider').value = val;
    document.getElementById('bulkLevelVal').innerText = val;
};

// 4. 一括凸適用実行 (新規追加)
window.applyBulkLimitBreak = (lbIndex) => {
    // lbIndex: 0=無凸 ... 4=完凸
    if (!confirm(`${selectedKeys.size}枚のカードを ${lbIndex}凸 相当のレベルに設定しますか？\n(SSRならLv${lbIndex*5+30}, SRならLv${lbIndex*5+25})`)) return;
    
    selectedKeys.forEach(key => {
        // カード情報を取得
        const [name, title] = key.split('_'); 
        const card = cardsDB.find(c => c.name === name && c.title === title);
        const rarity = card ? card.rarity : 'SSR'; // デフォルトSSR扱い
        
        let newLvl = 1;
        if (rarity === 'SSR') {
            // SSR: 30, 35, 40, 45, 50
            newLvl = 30 + (lbIndex * 5);
        } else {
            // SR: 25, 30, 35, 40, 45
            newLvl = 25 + (lbIndex * 5);
        }

        if (!myCards[key]) {
            myCards[key] = { owned: true, level: newLvl, favorite: false };
        } else {
            myCards[key].level = newLvl;
            myCards[key].owned = true; 
        }
    });
    
    saveInv(); // 保存
    
    document.getElementById('bulkLevelModal').style.display = 'none'; 
    alert("更新しました");
    
    toggleSelectMode();
};

// --- 汎用警告モーダル制御システム ---

// 警告キュー (複数の警告が重なった場合に順番に表示するため)
let warningQueue = [];
let isWarningModalOpen = false;
let currentWarningId = null; // 現在表示中の警告ID

// 警告を表示する関数
// id: LocalStorageに保存するキー (例: 'warn_mobile')
// title: タイトル
// msg: メッセージ本文
// force: trueなら「次回から表示しない」を無視して強制表示 (オプション)
window.showWarning = (id, title, msg, force = false) => {
    // 既に「表示しない」設定済みならスキップ (force=true以外)
    if (!force && localStorage.getItem('tra_hide_' + id)) {
        return;
    }
    
    // キューに追加して処理開始
    warningQueue.push({ id, title, msg });
    processWarningQueue();
};

function processWarningQueue() {
    if (isWarningModalOpen || warningQueue.length === 0) return;

    const warn = warningQueue.shift();
    currentWarningId = warn.id;
    isWarningModalOpen = true;

    const modal = document.getElementById('warningModal');
    const titleEl = document.getElementById('warnModalTitle');
    const msgEl = document.getElementById('warnModalMessage');
    const chk = document.getElementById('chkDontShowAgain');
    const chkLabel = document.querySelector('label[for="chkDontShowAgain"]');

    if (modal && titleEl && msgEl) {
        titleEl.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${warn.title}`;
        msgEl.innerHTML = warn.msg;
        
        // チェックボックスのリセットとUI調整
        if (chk) chk.checked = false;
        
        // FontAwesomeのアイコン切り替えロジック
        if (chk && chkLabel) {
            chk.onchange = function() {
                const icon = this.checked ? '<i class="fa-solid fa-square-check" style="color:var(--primary)"></i>' : '<i class="fa-regular fa-square"></i>';
                chkLabel.innerHTML = `${icon} 次回から表示しない`;
            };
            // 初期状態
            chkLabel.innerHTML = '<i class="fa-regular fa-square"></i> 次回から表示しない';
        }

        modal.style.display = 'flex';
    } else {
        // モーダルがない場合はアラートで代用し、次へ
        alert(`【${warn.title}】\n${warn.msg}`);
        isWarningModalOpen = false;
        processWarningQueue();
    }
}

window.closeWarningModal = () => {
    const modal = document.getElementById('warningModal');
    const chk = document.getElementById('chkDontShowAgain');

    if (chk && chk.checked && currentWarningId) {
        localStorage.setItem('tra_hide_' + currentWarningId, 'true');
    }

    if (modal) modal.style.display = 'none';
    isWarningModalOpen = false;
    currentWarningId = null;

    // 次の警告があれば表示
    setTimeout(processWarningQueue, 300);
};

// OCRボタンのラッパー関数 (HTML側のonclickをこれに置き換える想定)
window.startOcrWithWarning = () => {
    const showOcrFunc = () => { document.getElementById('ocrUpload').click(); };

    // 警告済みかチェック
    if (localStorage.getItem('tra_hide_warn_ocr')) {
        showOcrFunc();
    } else {
        // Warningを表示し、閉じた後にファイル選択を開く必要はないが、
        // ユーザーフロー的には「警告を見てOKなら押す」形にするため、
        // ここでは警告を表示するだけにする。
        // ただし、この実装だと「OKを押した後に自動でファイルが開く」のはブラウザのセキュリティ制限(ユーザーアクション必須)に引っかかる可能性があるため、
        // 「確認しました」を押しただけではファイル選択が開かない。
        // よって、今回は「警告を表示」し、次回以降非表示にする運用とする。
        
        // ※モーダルの構造上、コールバックを持たせるのが複雑になるため、
        // 簡易的に「警告を表示」-> ユーザーが閉じる -> ユーザーがもう一度ボタンを押す、というフロー、
        // または今回だけ `alert` + `confirm` で済ませる手もあるが、
        // 要件通り「チェックしたら表示しなくなる系ダイアログ」を使うため、
        // showWarningを呼び出す。
        
        // ★修正案: ファイル選択ダイアログはJSから非同期で開けないことが多いので、
        // 「警告を見る」ボタンと「ファイル選択」ボタンを分けるか、
        // 初回は警告のみ出して「閉じてからもう一度押してください」とするのが安全。
        
        showWarning(
            'warn_ocr',
            'OCR機能の注意',
            'この機能は画面比率 <b>16:9</b> のスクリーンショットを基準に作成されています。<br>お使いの端末や解像度によっては正しく読み取れない場合があります。<br>画像の読み取り制度は8～9割です。誤って読み取った箇所は手動での修正をお願いします。<br>あらかじめご了承ください。'
        );
        
        // 警告が表示された場合でも、裏でclickイベントを発火させるのはリスクがあるため、
        // ここでは「警告が出た場合は処理を中断（次回から出ない）」とするか、
        // 警告ダイアログの「確認」ボタンにコールバックを仕込む必要がある。
        // 今回の `processWarningQueue` はシンプル設計なので、
        // 以下のロジックを追加して対応する。
    }
};

// キュー処理にコールバック機能を追加拡張（既存関数をオーバーライド）
// 上記の processWarningQueue を少し修正して、閉じたときのアクションを追加できるようにします。
// ですが、今回は「警告を表示する」ことが主目的なので、
// OCRボタンを押したとき -> 未確認なら警告表示(ファイル選択は開かない) -> 確認済みならファイル選択開く
// という挙動にします。
window.handleOcrClick = () => {
    if (!localStorage.getItem('tra_hide_warn_ocr')) {
        showWarning(
            'warn_ocr',
            'OCR機能の注意',
            'この機能は画面比率 <b>16:9</b> のスクリーンショットを基準に作成されています。<br>お使いの端末や解像度によっては正しく読み取れない場合があります。<br>あらかじめご了承ください。<br><br><span style="color:#fbbf24; font-size:0.8rem;">※確認後、もう一度ボタンを押してください。</span>'
        );
    } else {
        document.getElementById('ocrUpload').click();
    }
};

// ==========================================
// --- v1.9 新機能ロジック ---
// ==========================================

// --- 新規追加カードのアナウンス機能 ---
let newCardsToAnnounce = [];

function checkNewCards() {
    let viewedCardsStr = localStorage.getItem('tra_viewed_cards');
    newCardsToAnnounce = [];

    if (!viewedCardsStr) {
        // 初回アクセス: 基準数(INITIAL_CARD_COUNT)を超える分を新カードとする
        if (cardsDB.length > INITIAL_CARD_COUNT) {
            newCardsToAnnounce = cardsDB.slice(INITIAL_CARD_COUNT);
        }
        // 今のINITIAL_CARD_COUNTまでのカードを「確認済み」として保存
        let initialViewed = cardsDB.slice(0, INITIAL_CARD_COUNT).map(c => c.name + "_" + c.title);
        localStorage.setItem('tra_viewed_cards', JSON.stringify(initialViewed));
    } else {
        // 2回目以降
        let viewedArray = JSON.parse(viewedCardsStr);
        cardsDB.forEach(c => {
            const key = c.name + "_" + c.title;
            if (!viewedArray.includes(key)) {
                newCardsToAnnounce.push(c);
            }
        });
    }

    if (newCardsToAnnounce.length > 0) {
        renderNewCardAnnounceModal();
    }
}

function renderNewCardAnnounceModal() {
    const body = document.getElementById('newCardAnnounceBody');
    body.innerHTML = '';
    
    newCardsToAnnounce.forEach(c => {
        const imgPath = `img/cards/${c.name}_${c.title}.png`;
        const el = document.createElement('div');
        el.className = 'db-card';
        el.style.border = '1px solid #444';
        el.innerHTML = `
            <img src="${imgPath}" class="db-card-img" loading="lazy" onerror="this.src='https://placehold.jp/100x133.png?text=NoImg'">
            <div class="db-info">
                <div class="db-name">${c.name}</div>
                <div class="db-badges">
                    <span class="badge ${c.rarity}">${c.rarity}</span>
                </div>
            </div>
        `;
        body.appendChild(el);
    });

    document.getElementById('newCardAnnounceModal').style.display = 'flex';
}

window.closeNewCardAnnounceModal = () => {
    let viewedCards = JSON.parse(localStorage.getItem('tra_viewed_cards') || '[]');
    newCardsToAnnounce.forEach(c => {
        const key = c.name + "_" + c.title;
        if (!viewedCards.includes(key)) {
            viewedCards.push(key);
        }
    });
    localStorage.setItem('tra_viewed_cards', JSON.stringify(viewedCards));
    document.getElementById('newCardAnnounceModal').style.display = 'none';
};

// --- 代用カード検索機能 ---

window.openSubstituteModal = () => {
    if (!currentModalItem) return;
    substituteSearch.targetCard = currentModalItem;
    document.getElementById('substituteSearchModal').style.display = 'flex';
    toggleSubstBonusOption();
};

window.closeSubstituteSearchModal = () => {
    document.getElementById('substituteSearchModal').style.display = 'none';
};

window.toggleSubstBonusOption = () => {
    const criteriaEl = document.querySelector('input[name="subst_criteria"]:checked');
    if(!criteriaEl) return;
    const criteria = criteriaEl.value;
    const bonusWrap = document.getElementById('subst_bonus_wrap');
    if (bonusWrap) {
        bonusWrap.style.display = (criteria === 'params') ? 'block' : 'none';
    }
};

window.execSubstituteSearch = () => {
    substituteSearch.criteria = document.querySelector('input[name="subst_criteria"]:checked').value;
    substituteSearch.ownedOnly = document.getElementById('subst_owned_only').checked;
    substituteSearch.useBonus = document.getElementById('subst_use_bonus').checked;
    substituteSearch.active = true;

    closeSubstituteSearchModal();
    closeCardDetailModal(); // 詳細画面を閉じる

    // 通常のフィルタをリセットして競合を防ぐ
    resetFilters();
    substituteSearch.active = true; // resetFiltersで消えるため再度trueに
    
    // スクロールを上部に戻す
    window.scrollTo(0,0);

    renderDatabase();
};

window.clearSubstituteSearch = () => {
    substituteSearch.active = false;
    substituteSearch.targetCard = null;
    renderDatabase();
};

// スコア計算ロジック (0〜100を返す)
function calculateSubstituteScore(baseCardObj, targetCardObj, criteria, useBonus) {
    const baseC = baseCardObj.original;
    const targetC = targetCardObj.original;

    if (criteria === 'params') {
        // パラメータ比較 (コサイン類似度 + 差の割合)
        const baseLevel = baseCardObj.level || (baseC.rarity === 'SSR' ? 50 : 45);
        const targetLevel = targetCardObj.level || (targetC.rarity === 'SSR' ? 50 : 45);

        let basePos = null, baseStyle = null;
        let targetPos = null, targetStyle = null;

        if (useBonus) {
            // 元カードのボーナスとポジションを特定
            baseStyle = baseC.bonuses && baseC.bonuses.length > 0 ? baseC.bonuses[0].type : baseC.bonus_type;
            basePos = Object.keys(POS_MAP).find(p => POS_MAP[p].includes(baseStyle)) || null;

            // ターゲットカードも、元カードと同じ環境(basePos, baseStyle)で起用されたと仮定して計算する。
            // これにより、元カードと同じ種類のボーナスのみが計算に含まれる。
            targetPos = basePos;
            targetStyle = baseStyle;
        }

        const baseStats = getCardStatsAtLevel(baseC, baseLevel, basePos, baseStyle, 1.0);
        const targetStats = getCardStatsAtLevel(targetC, targetLevel, targetPos, targetStyle, 1.0);

        const allStats = [...STATS, ...GK_STATS];
        
        let dotProduct = 0, normBase = 0, normTarget = 0;
        let sumBase = 0, sumTarget = 0;

        allStats.forEach(s => {
            const baseVal = (baseStats[s] || 0);
            const targetVal = (targetStats[s] || 0);

            // 【修正】対象カードの数値が元カードを上回る場合、あふれた分を切り捨て（元カードの数値にキャップ）
            // これにより、上位互換カードがペナルティを受けず、一致率100%に近づく
            const cappedTargetVal = Math.min(targetVal, baseVal);

            // 0除算防止およびペナルティ緩和のための基礎値+10
            const vB = baseVal + 10;
            const vT = cappedTargetVal + 10;

            dotProduct += vB * vT;
            normBase += vB * vB;
            normTarget += vT * vT;

            sumBase += vB;
            sumTarget += vT;
        });
        if (normBase === 0 || normTarget === 0) return 0;

        const cosineSim = dotProduct / (Math.sqrt(normBase) * Math.sqrt(normTarget));
        
        let magnitudeSim = 0;
        if (sumBase > 0) {
            const diffRatio = Math.abs(sumBase - sumTarget) / sumBase;
            magnitudeSim = Math.max(0, 1 - diffRatio);
        }

        // 類似度70%, スケール30%
        return (cosineSim * 0.7 + magnitudeSim * 0.3) * 100;

    } else if (criteria === 'skills') {
        // スキル名比較
        const getSaNames = (c) => (c.abilities || []).map(a => typeof a === 'object' ? a.name : a);
        const baseSa = getSaNames(baseC);
        const targetSa = getSaNames(targetC);

        if (baseSa.length === 0) return 0;

        let matchCount = 0;
        baseSa.forEach(bName => {
            if (targetSa.includes(bName)) matchCount++;
        });

        return (matchCount / baseSa.length) * 100;

    } else if (criteria === 'special') {
        // 特殊効果比較
        const getSeTypeVal = (c) => {
            let res = {};
            (c.special_effects || []).forEach(se => res[se.type] = se.value);
            return res;
        };

        const baseSe = getSeTypeVal(baseC);
        const targetSe = getSeTypeVal(targetC);
        const baseKeys = Object.keys(baseSe);

        if (baseKeys.length === 0) return 0;

        let totalScore = 0;
        baseKeys.forEach(k => {
            if (targetSe[k]) {
                const ratio = Math.min(1, targetSe[k] / baseSe[k]);
                totalScore += ratio;
            }
        });

        return (totalScore / baseKeys.length) * 100;
    }
    return 0;
}

// --- 全体お知らせモーダル 制御 ---
window.closeInfoAnnounceModal = () => {
    if (typeof infoDB !== 'undefined' && infoDB) {
        localStorage.setItem('tra_read_info_id', infoDB.id);
    }
    document.getElementById('infoAnnounceModal').style.display = 'none';
};