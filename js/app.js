// --- Global State ---
// config.jsで定義されている変数はここで宣言しない (appMode, viewTypeなど)
var currentView = 'database';

// フィルタ条件
var dbFilter = { 
    text: '', 
    rarity: { SSR: true, SR: true }, 
    ownedOnly: false,
    hasSkill: false,
    hasAbility: false,
    pos: [], 
    style: [], 
    params: [], 
    paramLogic: 'OR',
    sortParams: [],
    useMyLevel: false
};

// 比較トレイ
var compareTray = []; 

// 現在表示中のモーダルアイテム
var currentModalItem = null;
// Viewモード詳細モーダル用の一時レベル
var currentViewLevel = 50; 
// 比較モーダル用のカード状態管理
var compCardStates = []; 

// --- Initialization ---
window.onload = async () => {
    console.log("App initializing...");
    try {
        // LocalStorageからデータロード
        myCards = JSON.parse(localStorage.getItem('tra_my_cards') || '{}');
        profiles = JSON.parse(localStorage.getItem('tra_profiles') || '{}');
        
        // 各種UI初期化関数が存在すれば実行
        if(typeof renderProfileSelector === 'function') renderProfileSelector();
        if(typeof initStatInputs === 'function') initStatInputs();
        if(typeof initPosSelect === 'function') initPosSelect();
        if(typeof initEditors === 'function') initEditors();
        
        // JSONデータ取得
        await fetchAllDB();
        
        // 開発者ログイン状態チェック
        if (typeof checkDevLogin === 'function') checkDevLogin();

        // 初期モード設定
        if (typeof setAppMode === 'function') setAppMode('view');
        
        // 初期ビュー設定
        switchView('database'); 
        
        // トレイUI更新
        updateTrayUI();

    } catch(e) {
        console.warn("初期化中にエラーが発生しましたが、続行します:", e);
    }
};

// --- UI Navigation ---
window.toggleDrawer = () => {
    document.getElementById('appDrawer').classList.toggle('open');
    document.getElementById('drawerOverlay').classList.toggle('open');
};

window.switchView = (viewId) => {
    document.querySelectorAll('.view-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.drawer-item').forEach(el => el.classList.remove('active'));
    
    const target = document.getElementById(`view-${viewId}`);
    if (target) target.classList.add('active');
    
    document.getElementById('appDrawer').classList.remove('open');
    document.getElementById('drawerOverlay').classList.remove('open');
    
    currentView = viewId;
    document.body.setAttribute('data-view', viewId);
    
    // ビューに応じた初期化
    if(viewId === 'database') renderDatabase();
    if(viewId === 'sim' && typeof updateCalc === 'function') updateCalc();
    if(viewId === 'admin-card' && typeof renderCardList === 'function') renderCardList();
    if(viewId === 'admin-skill' && typeof renderSAList === 'function') renderSAList();
};

// --- Mode Management ---
window.setAppMode = (mode) => {
    // config.jsのグローバル変数を更新
    if (typeof appMode !== 'undefined') appMode = mode;
    
    const btnView = document.getElementById('btnModeView');
    const btnMy = document.getElementById('btnModeMy');
    if(btnView) btnView.classList.toggle('active', mode === 'view');
    if(btnMy) btnMy.classList.toggle('active', mode === 'mycards');
    
    const btnViewType = document.getElementById('btnViewType');
    if(btnViewType) btnViewType.style.display = (mode === 'view') ? 'block' : 'none';

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

// --- Filter Modal Logic ---

// パラメータボタン生成関数
window.renderParamButtons = (targetId, nameAttr) => {
    const container = document.getElementById(targetId);
    if (!container) {
        console.error(`[Error] Target ID not found: ${targetId}`);
        return;
    }

    container.innerHTML = ''; // クリア

    // 順序定義（シミュレータ配置準拠 + GK）
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
        // 4文字以上は3文字に省略
        const labelText = s.length > 3 ? s.substring(0,3) : s;

        div.innerHTML = `<input type="checkbox" name="${nameAttr}" value="${s}" id="${id}"><label for="${id}">${labelText}</label>`;
        container.appendChild(div);
    });

    // 7列グリッドのレイアウト調整（20項目なので1つ余る）
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
    // フィルタ用とソート用、両方のボタン生成を実行
    renderParamButtons('filterParamsGrid', 'f_prm');
    renderParamButtons('sortParamsGrid', 's_prm');

    // 現在の状態をUIに反映
    document.getElementById('f_rar_SSR').checked = dbFilter.rarity.SSR;
    document.getElementById('f_rar_SR').checked = dbFilter.rarity.SR;
    document.getElementById('f_owned_only').checked = dbFilter.ownedOnly;
    
    if(document.getElementById('f_has_skill')) document.getElementById('f_has_skill').checked = dbFilter.hasSkill;
    if(document.getElementById('f_has_ability')) document.getElementById('f_has_ability').checked = dbFilter.hasAbility;
    if(document.getElementById('f_skill_text')) document.getElementById('f_skill_text').value = dbFilter.text; // テキスト検索もここで反映

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
    // クリックされたボタンをアクティブにする処理
    // eventオブジェクト経由で取得
    if (window.event && window.event.target && window.event.target.classList.contains('modal-tab-btn')) {
        window.event.target.classList.add('active');
    } else {
        // デフォルトで最初のタブボタンなどをアクティブにする場合のフォールバック
        const btns = document.querySelectorAll('.modal-tab-btn');
        if (tabName === 'filter' && btns[0]) btns[0].classList.add('active');
        if (tabName === 'sort' && btns[1]) btns[1].classList.add('active');
    }
};

window.applyFilters = () => {
    dbFilter.rarity.SSR = document.getElementById('f_rar_SSR').checked;
    dbFilter.rarity.SR = document.getElementById('f_rar_SR').checked;
    dbFilter.ownedOnly = document.getElementById('f_owned_only').checked;
    
    if(document.getElementById('f_has_skill')) dbFilter.hasSkill = document.getElementById('f_has_skill').checked;
    if(document.getElementById('f_has_ability')) dbFilter.hasAbility = document.getElementById('f_has_ability').checked;
    
    // スキル名テキスト検索 (index.htmlにある場合)
    if(document.getElementById('f_skill_text')) {
        dbFilter.skillText = document.getElementById('f_skill_text').value.trim().toLowerCase();
    }

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

window.resetFilters = () => {
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
    if(document.getElementById('globalSearch')) document.getElementById('globalSearch').value = '';
    
    renderDatabase();
    // モーダルが開いていればUIもリセット
    if (document.getElementById('filterModal').style.display === 'flex') {
        openFilterModal();
    }
};

window.filterDatabase = () => {
    const el = document.getElementById('globalSearch');
    if (el) {
        dbFilter.text = el.value;
        renderDatabase();
    }
};

// --- Database Render Logic ---
window.renderDatabase = () => {
    const grid = document.getElementById('dbGrid');
    if(!grid) return;
    
    grid.innerHTML = '';
    // viewType変数がundefinedの場合はデフォルト'grid'を使用
    const vType = (typeof viewType !== 'undefined') ? viewType : 'grid';
    grid.className = (vType === 'grid') ? 'card-grid-visual' : 'card-grid-list';
    
    // Active Filters Badge
    const afDiv = document.getElementById('activeFilters');
    if(afDiv) {
        afDiv.innerHTML = '';
        const badges = [];
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
        
        // --- 絞り込み ---
        
        // Text
        if (dbFilter.text) {
            const search = dbFilter.text.toLowerCase();
            if (!card.name.toLowerCase().includes(search) && !card.title.toLowerCase().includes(search)) return null;
        }
        // Rarity
        if (!dbFilter.rarity[card.rarity]) return null;
        // Owned
        if (dbFilter.ownedOnly && !isOwned) return null;

        // Skill/Ability Boolean Filter
        if (dbFilter.hasSkill) {
            const hasS = (card.abilities || []).some(aname => skillsDB.some(s => s.name === aname));
            if (!hasS) return null;
        }
        if (dbFilter.hasAbility) {
            const hasA = (card.abilities || []).some(aname => abilitiesDB.some(a => a.name === aname));
            if (!hasA) return null;
        }
        // Skill Text Filter
        if (dbFilter.skillText) {
            const hasSkillText = (card.abilities || []).some(a => a.toLowerCase().includes(dbFilter.skillText));
            if (!hasSkillText) return null;
        }

        // Pos & Style (OR Logic)
        const hasPosFilter = dbFilter.pos.length > 0;
        const hasStyleFilter = dbFilter.style.length > 0;
        
        if (hasPosFilter || hasStyleFilter) {
            let isMatch = false;
            const cBonuses = [];
            if(card.bonuses) card.bonuses.forEach(b => cBonuses.push(b.type));
            if(card.bonus_type) cBonuses.push(card.bonus_type);

            if (hasPosFilter) {
                isMatch = dbFilter.pos.some(p => {
                    let targets = [p];
                    if (typeof POS_BONUS_MAPPING !== 'undefined' && POS_BONUS_MAPPING[p]) targets = targets.concat(POS_BONUS_MAPPING[p]);
                    return cBonuses.some(cb => targets.includes(cb));
                });
            }
            if (!isMatch && hasStyleFilter) {
                isMatch = dbFilter.style.some(s => cBonuses.includes(s));
            }
            if (!isMatch) return null;
        }

        // Params Filter
        if (dbFilter.params.length > 0) {
            const stats = getCardStatsAtLevel(card, 50, null, null, 1.0);
            let matchCount = 0;
            dbFilter.params.forEach(p => { if((stats[p]||0) > 0) matchCount++; });
            
            if (dbFilter.paramLogic === 'AND') {
                if (matchCount < dbFilter.params.length) return null;
            } else {
                if (matchCount === 0) return null;
            }
        }

        // --- ソート用スコア計算 ---
        let sortScore = 0;
        if (dbFilter.sortParams.length > 0) {
            let level = (card.rarity==='SSR'?50:45);
            if (dbFilter.useMyLevel) {
                level = isOwned ? (parseInt(userData.level)||1) : 1;
            }
            // フィルタの先頭条件をボーナスとして適用
            const tPos = dbFilter.pos.length > 0 ? dbFilter.pos[0] : null;
            const tStyle = dbFilter.style.length > 0 ? dbFilter.style[0] : null;

            const stats = getCardStatsAtLevel(card, level, tPos, tStyle, 1.0);
            
            dbFilter.sortParams.forEach(p => {
                sortScore += (stats[p] || 0);
            });
        }

        return { original: card, idx, key, isFav, isOwned, sortScore };
    }).filter(item => item !== null);
    
    // Sort
    list.sort((a, b) => {
        if (dbFilter.sortParams.length > 0) {
            if (b.sortScore !== a.sortScore) return b.sortScore - a.sortScore;
        }
        if (a.isFav !== b.isFav) return b.isFav - a.isFav;
        if (a.original.rarity !== b.original.rarity) return a.original.rarity === 'SSR' ? -1 : 1;
        return a.original.name.localeCompare(b.original.name, 'ja');
    });
    
    // Render
    list.forEach(item => {
        const c = item.original;
        const imgPath = `img/cards/${c.name}_${c.title}.png`;
        const el = document.createElement('div');
        el.className = `db-card ${item.isFav ? 'fav' : ''}`;
        
        if (vType === 'grid') {
            el.innerHTML = `
                <div class="fav-icon"><i class="fa-solid fa-heart"></i></div>
                <img src="${imgPath}" class="db-card-img" loading="lazy" onerror="this.src='https://placehold.jp/333333/ffffff/300x400.png?text=No+Img'">
                <div class="db-info">
                    <div class="db-name">${c.name}</div>
                    <div class="db-badges">
                        <span class="badge ${c.rarity}">${c.rarity}</span>
                        ${item.isOwned ? '<span class="badge" style="background:#22c55e;color:#000;">所持</span>' : ''}
                        ${item.sortScore > 0 ? `<span style="color:#fbbf24;font-weight:bold;margin-left:2px;">${(item.sortScore/10).toFixed(1)}</span>` : ''}
                    </div>
                </div>
            `;
        } else {
            // List View
            let displayStats = [];
            if (dbFilter.sortParams.length > 0) {
                displayStats.push(`合計:${(item.sortScore/10).toFixed(1)}`);
            } else {
                const maxLvl = c.rarity === 'SSR' ? 50 : 45;
                const stats = getCardStatsAtLevel(c, maxLvl, null, null, 1.0);
                displayStats = Object.entries(stats)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 3)
                    .map(([k,v]) => `${k}:${(v/10).toFixed(0)}`);
            }
            const skillNames = c.abilities ? c.abilities.join(', ') : '';

            el.innerHTML = `
                <img src="${imgPath}" class="db-card-img" loading="lazy" onerror="this.src='https://placehold.jp/333333/ffffff/300x400.png?text=No+Img'">
                <div class="db-info">
                    <div style="display:flex; justify-content:space-between; width:100%;">
                        <div class="db-name" style="font-weight:bold;">${c.name} <span style="font-size:0.7em; color:#999;">${c.title}</span></div>
                        <div class="db-badges">
                            <span class="badge ${c.rarity}">${c.rarity}</span>
                            ${item.isOwned ? '<span class="badge" style="background:#22c55e;color:#000;">所持</span>' : ''}
                        </div>
                    </div>
                    <div class="list-stats">
                        ${displayStats.map(s => `<span>${s}</span>`).join('')}
                    </div>
                    <div class="list-skills" style="font-size:0.7rem; color:var(--skill); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${skillNames}
                    </div>
                </div>
            `;
        }
        
        el.onclick = () => {
            // config.jsのappModeを参照
            if (typeof appMode !== 'undefined' && appMode === 'view') {
                openViewDetailModal(item);
            } else {
                openCardDetailModal(item); // 互換性のため
            }
        };
        grid.appendChild(el);
    });
};

// --- View Mode Detail Modal ---

window.openViewDetailModal = (item) => {
    currentModalItem = item;
    const c = item.original;
    currentViewLevel = c.rarity === 'SSR' ? 50 : 45;

    const modal = document.getElementById('cardDetailModal');
    if (!modal) return;
    
    document.getElementById('cdmTitle').innerText = `[${c.rarity}] ${c.title}`;
    
    renderViewModalBody();
    updateDetailButtons(); 
    
    modal.style.display = 'flex';
};

window.renderViewModalBody = () => {
    if (!currentModalItem) return;
    const c = currentModalItem.original;
    const imgPath = `img/cards/${c.name}_${c.title}.png`;
    const stats = getCardStatsAtLevel(c, currentViewLevel, null, null, 1.0);

    const levels = (c.rarity === 'SSR') 
        ? [30, 35, 40, 45, 50] 
        : [25, 30, 35, 40, 45];
    const labels = ["無凸", "1凸", "2凸", "3凸", "完凸"];
    
    let btnHtml = '<div class="level-btn-group">';
    levels.forEach((lvl, idx) => {
        const active = (lvl === currentViewLevel) ? 'active' : '';
        btnHtml += `<button class="lvl-btn ${active}" onclick="updateViewLevel(${lvl})">${labels[idx]}<br>(Lv${lvl})</button>`;
    });
    btnHtml += '</div>';

    const body = document.getElementById('cdmBody');
    body.innerHTML = `
        <div style="display:flex; gap:15px; margin-bottom:10px;">
            <img src="${imgPath}" style="width:100px; height:133px; object-fit:cover; border-radius:6px; border:1px solid #444;" onerror="this.src='https://placehold.jp/100x133.png?text=NoImg'">
            <div style="flex:1;">
                <div style="font-weight:bold; font-size:1.1rem; line-height:1.3;">${c.name}</div>
                <div style="font-size:0.8rem; color:#ccc; margin-bottom:5px;">${c.title}</div>
                <div style="margin-top:5px;">
                    ${c.abilities?.map(a => `<span class="tag tag-skill">${a}</span>`).join(' ') || '<span style="color:#666;font-size:0.8rem">スキルなし</span>'}
                </div>
                <div style="margin-top:8px; font-size:0.75rem; color:#94a3b8;">
                    ボーナス: ${c.bonuses ? c.bonuses.map(b=>`${b.type}+${b.value}%`).join(', ') : (c.bonus_type ? `${c.bonus_type}+${c.bonus_value}%` : 'なし')}
                </div>
            </div>
        </div>
        ${btnHtml}
        <div style="background:#0f172a; padding:10px; border-radius:6px; border:1px solid #333;">
            <div class="stat-grid">
                ${Object.entries(c.stats || {}).map(([k,v]) => {
                    const val = stats[k] ? (stats[k] / 10).toFixed(1) : '-';
                    return `
                    <div style="display:flex; justify-content:space-between; font-size:0.75rem;">
                        <span style="color:#aaa;">${k}</span>
                        <span style="font-weight:bold; color:#fff;">${val}</span>
                    </div>`;
                }).join('')}
            </div>
        </div>
    `;
};

window.updateViewLevel = (lvl) => {
    currentViewLevel = lvl;
    renderViewModalBody();
};

window.closeCardDetailModal = () => {
    document.getElementById('cardDetailModal').style.display = 'none';
    currentModalItem = null;
    renderDatabase(); 
};

function updateDetailButtons() {
    if (!currentModalItem) return;
    const btnFav = document.getElementById('btnFav');
    if(btnFav) {
        if (currentModalItem.isFav) {
            btnFav.innerHTML = '<i class="fa-solid fa-heart"></i> お気に入り済';
            btnFav.classList.add('active');
        } else {
            btnFav.innerHTML = '<i class="fa-regular fa-heart"></i> お気に入り';
            btnFav.classList.remove('active');
        }
    }
    const btnOwned = document.getElementById('btnOwned');
    if(btnOwned) {
        if (currentModalItem.isOwned) {
            btnOwned.innerHTML = '所持済';
            btnOwned.style.background = '#22c55e';
            btnOwned.style.color = '#000';
        } else {
            btnOwned.innerHTML = '未所持にする';
            btnOwned.style.background = '#334155';
            btnOwned.style.color = '#fff';
        }
    }
}

window.toggleDetailFav = () => {
    if(!currentModalItem) return;
    const key = currentModalItem.key;
    if(!myCards[key]) myCards[key] = { owned: false, level: 50 };
    myCards[key].favorite = !myCards[key].favorite;
    currentModalItem.isFav = myCards[key].favorite;
    saveInv();
    updateDetailButtons();
};

window.toggleDetailOwned = () => {
    if(!currentModalItem) return;
    const key = currentModalItem.key;
    if(!myCards[key]) myCards[key] = { level: 50 };
    myCards[key].owned = !myCards[key].owned;
    currentModalItem.isOwned = myCards[key].owned;
    saveInv();
    updateDetailButtons();
};

window.addToTrayFromDetail = () => {
    if(!currentModalItem) return;
    addToTray(currentModalItem.original);
    closeCardDetailModal();
    document.getElementById('compareTray').classList.add('open');
};

// --- Comparison Logic (Vertical Layout) ---

window.runComparison = () => {
    if(compareTray.length < 1) return alert("比較するカードを選択してください");
    
    // 初期化
    compCardStates = compareTray.map(c => ({
        id: c.name + "_" + c.title,
        level: c.rarity === 'SSR' ? 50 : 45
    }));

    updateComparisonTable();
    document.getElementById('comparisonModal').style.display = 'flex';
};

window.updateComparisonTable = () => {
    const table = document.getElementById('compTable');
    if(!table) return;
    table.innerHTML = '';
    
    // Header Row
    let thead = `<thead><tr><th style="min-width:80px;">項目</th>`;
    compareTray.forEach((c, idx) => {
        const state = compCardStates[idx];
        const imgPath = `img/cards/${c.name}_${c.title}.png`;
        const levels = c.rarity === 'SSR' ? [30,35,40,45,50] : [25,30,35,40,45];
        const labels = ["0","1","2","3","完"];
        
        let btnHtml = `<div class="comp-lvl-btns">`;
        levels.forEach((lvl, i) => {
            const active = (lvl === state.level) ? 'active' : '';
            btnHtml += `<button class="comp-lvl-btn ${active}" onclick="updateCompCardLevel(${idx}, ${lvl})">${labels[i]}</button>`;
        });
        btnHtml += `</div>`;

        thead += `
            <th>
                <div class="comp-card-header">
                    <img src="${imgPath}" onerror="this.src='https://placehold.jp/50x65.png'">
                    <div class="comp-card-name">${c.name}</div>
                    <div class="comp-card-ctrl">
                        <span style="font-size:0.6rem;">Lv.${state.level}</span>
                        ${btnHtml}
                    </div>
                </div>
            </th>`;
    });
    thead += `</tr></thead>`;
    table.innerHTML += thead;

    // Data Calculation
    const cardStats = compareTray.map((c, idx) => {
        const lvl = compCardStates[idx].level;
        return getCardStatsAtLevel(c, lvl, null, null, 1.0);
    });

    // Vertical Order Definition (Same as config.js logic)
    const order = (typeof STATS_VERTICAL_ORDER !== 'undefined') 
        ? STATS_VERTICAL_ORDER 
        : [
            "決定力", "キック力", "冷静さ",
            "ショートパス", "ロングパス", "キック精度",
            "突破力", "キープ力", "ボールタッチ",
            "タックル", "パスカット", "マーク",
            "ジャンプ", "コンタクト", "スタミナ",
            "走力", "敏捷性",
            "セービング", "反応速度", "1対1"
        ];

    let tbody = `<tbody>`;
    order.forEach(statName => {
        // 全員0ならスキップ
        const isAllZero = cardStats.every(st => !st[statName]);
        if (isAllZero) return;

        let maxVal = -1;
        cardStats.forEach(st => {
            if((st[statName]||0) > maxVal) maxVal = st[statName]||0;
        });

        let row = `<tr><td>${statName}</td>`;
        cardStats.forEach(st => {
            const val = st[statName] || 0;
            const displayVal = (val / 10).toFixed(1);
            const isWin = (val > 0 && val === maxVal);
            const style = val === 0 ? 'color:#444;' : '';
            const classAttr = isWin ? 'comp-val comp-win' : 'comp-val';
            row += `<td class="${classAttr}" style="${style}">${val > 0 ? displayVal : '-'}</td>`;
        });
        row += `</tr>`;
        tbody += row;
    });

    // Skills Row
    tbody += `<tr><td>スキル</td>`;
    compareTray.forEach(c => {
        tbody += `<td style="font-size:0.6rem; white-space:normal; vertical-align:top;">
            ${(c.abilities||[]).map(s => `<div class="tag tag-skill" style="margin-bottom:2px;">${s}</div>`).join('')}
        </td>`;
    });
    tbody += `</tr></tbody>`;
    table.innerHTML += tbody;
};

window.updateCompCardLevel = (idx, lvl) => {
    compCardStates[idx].level = lvl;
    updateComparisonTable();
};

// --- Misc ---
window.changeCondition = (val, btn) => {
    document.querySelectorAll('.cond-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('conditionMod').value = val;
    if (typeof updateCalc === 'function') updateCalc();
};

window.toggleTray = () => {
    document.getElementById('compareTray').classList.toggle('open');
};

window.addToTray = (card) => {
    const key = card.name + "_" + card.title;
    if(compareTray.find(c => (c.name + "_" + c.title) === key)) return;
    if(compareTray.length >= 5) return alert("比較リストは最大5枚までです");
    compareTray.push(card);
    updateTrayUI();
};

window.updateTrayUI = () => {
    const list = document.getElementById('trayList');
    if(!list) return;
    const count = document.getElementById('trayCount');
    if(count) count.innerText = `比較リスト (${compareTray.length})`;
    
    list.innerHTML = '';
    if(compareTray.length === 0) {
        list.innerHTML = '<div class="tray-placeholder">カードをドロップ</div>';
        return;
    }
    compareTray.forEach((c, idx) => {
        const imgPath = `img/cards/${c.name}_${c.title}.png`;
        const div = document.createElement('div');
        div.className = 'tray-item';
        div.innerHTML = `<img src="${imgPath}" onerror="this.src='https://placehold.jp/40x40.png'">`;
        div.onclick = () => {
            if(confirm('リストから削除しますか？')) {
                compareTray.splice(idx, 1);
                updateTrayUI();
            }
        };
        list.appendChild(div);
    });
};

window.clearTray = () => {
    compareTray = [];
    updateTrayUI();
};

// Fallback logic
window.openCardDetailModal = window.openViewDetailModal;

// Google Drive Auth related global helpers (if drive_sync.js not loaded or fails)
// エラー回避のためのダミー関数定義
if (typeof checkDevLogin === 'undefined') window.checkDevLogin = () => {};
if (typeof handleOCR === 'undefined') window.handleOCR = () => {};
if (typeof renderProfileSelector === 'undefined') window.renderProfileSelector = () => {};
if (typeof saveInv === 'undefined') window.saveInv = () => { localStorage.setItem('tra_my_cards', JSON.stringify(myCards)); };