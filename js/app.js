// --- Global State ---
let currentView = 'database';
let dbFilter = { text: '', rarity: [], tags: [] };
let compareTray = []; // List of card objects

window.onload = async () => {
    // 設定読み込み
    document.getElementById('ghToken').value = localStorage.getItem('gh_token') || '';
    document.getElementById('ghRepo').value = localStorage.getItem('gh_repo') || '';
    
    // データ初期化
    myCards = JSON.parse(localStorage.getItem('tra_my_cards') || '{}');
    profiles = JSON.parse(localStorage.getItem('tra_profiles') || '{}');
    if(typeof renderProfileSelector === 'function') renderProfileSelector();
    
    // UI初期化 (ui_manager.jsの関数)
    if(typeof initStatInputs === 'function') initStatInputs();
    if(typeof initPosSelect === 'function') initPosSelect();
    if(typeof initEditors === 'function') initEditors();
    
    // データ取得開始
    await fetchAllDB();
    
    // 初期描画
    renderDatabase();
    updateTrayUI();
};

// --- Navigation ---
window.toggleDrawer = () => {
    document.getElementById('appDrawer').classList.toggle('open');
    document.getElementById('drawerOverlay').classList.toggle('open');
};

window.switchView = (viewId) => {
    // 以前のアクティブクラスを削除
    document.querySelectorAll('.view-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.drawer-item').forEach(el => el.classList.remove('active'));
    
    // 新しいビューを表示
    document.getElementById(`view-${viewId}`).classList.add('active');
    
    // ドロワーを閉じる
    document.getElementById('appDrawer').classList.remove('open');
    document.getElementById('drawerOverlay').classList.remove('open');
    
    currentView = viewId;
    
    // ビューごとの初期化
    if(viewId === 'database') renderDatabase();
    if(viewId === 'sim') {
        if(typeof updateCalc === 'function') updateCalc();
    }
    if(viewId === 'admin-card') {
        if(typeof renderCardList === 'function') renderCardList();
    }
    if(viewId === 'admin-skill') {
        if(typeof renderSAList === 'function') renderSAList();
    }
};

// --- Database Logic ---

// DB描画: お気に入り > ソート順 で表示
window.renderDatabase = () => {
    const grid = document.getElementById('dbGrid');
    if(!grid) return;
    grid.innerHTML = '';
    
    // 1. データ加工 (ソート用スコア付与)
    const list = cardsDB.map((card, idx) => {
        const key = card.name + "_" + card.title;
        const userData = myCards[key] || {};
        const isFav = !!userData.favorite;
        const isOwned = !!userData.owned;
        
        // フィルタリング
        if (dbFilter.text) {
            const search = dbFilter.text.toLowerCase();
            if (!card.name.toLowerCase().includes(search) && 
                !card.title.toLowerCase().includes(search)) return null;
        }
        
        return { original: card, idx, key, isFav, isOwned };
    }).filter(item => item !== null);
    
    // 2. ソート (お気に入り優先 -> レアリティ -> 名前)
    list.sort((a, b) => {
        if (a.isFav !== b.isFav) return b.isFav - a.isFav; // Fav First
        if (a.original.rarity !== b.original.rarity) return a.original.rarity === 'SSR' ? -1 : 1;
        return a.original.name.localeCompare(b.original.name, 'ja');
    });
    
    // 3. 描画
    list.forEach(item => {
        const c = item.original;
        const imgPath = `img/cards/${c.name}_${c.title}.png`;
        
        const el = document.createElement('div');
        el.className = `db-card ${item.isFav ? 'fav' : ''}`;
        el.onclick = () => openCardDetailModal(item);
        
        el.innerHTML = `
            <div class="fav-icon"><i class="fa-solid fa-heart"></i></div>
            <img src="${imgPath}" class="db-card-img" onerror="this.src='https://placehold.jp/300x400.png?text=No+Image'">
            <div class="db-info">
                <div class="db-name">${c.name}</div>
                <div class="db-badges">
                    <span class="badge ${c.rarity}">${c.rarity}</span>
                    ${item.isOwned ? '<span class="badge" style="background:#22c55e;color:#000;">所持</span>' : ''}
                </div>
            </div>
        `;
        grid.appendChild(el);
    });
};

// 検索フィルタ
window.filterDatabase = () => {
    const text = document.getElementById('globalSearch').value;
    dbFilter.text = text;
    renderDatabase();
};

// --- Card Detail Modal (Read Only & Actions) ---
let currentModalItem = null;

window.openCardDetailModal = (item) => {
    currentModalItem = item;
    const c = item.original;
    
    document.getElementById('cdmTitle').innerText = `[${c.rarity}] ${c.title}`;
    const body = document.getElementById('cdmBody');
    const imgPath = `img/cards/${c.name}_${c.title}.png`;

    // 詳細内容の構築
    body.innerHTML = `
        <div style="display:flex; gap:10px; margin-bottom:10px;">
            <img src="${imgPath}" style="width:100px; height:133px; object-fit:cover; border-radius:6px; border:1px solid #444;" onerror="this.src='https://placehold.jp/100x133.png?text=NoImg'">
            <div>
                <div style="font-weight:bold; font-size:1.1rem;">${c.name}</div>
                <div style="font-size:0.8rem; color:#ccc;">${c.title}</div>
                <div style="margin-top:5px;">
                    ${c.abilities?.map(a => `<span class="tag tag-skill">${a}</span>`).join(' ') || ''}
                </div>
            </div>
        </div>
        <div style="font-size:0.8rem; color:#888; border-top:1px solid #333; padding-top:10px;">
            ※詳細ステータス・Lv変更は「シミュレータ」または「比較機能」で確認できます
        </div>
    `;
    
    // ボタン状態更新
    updateDetailButtons();
    
    document.getElementById('cardDetailModal').style.display = 'flex';
};

window.closeCardDetailModal = () => {
    document.getElementById('cardDetailModal').style.display = 'none';
    currentModalItem = null;
    renderDatabase(); // グリッドを更新
};

function updateDetailButtons() {
    if (!currentModalItem) return;
    
    // お気に入りボタン
    const btnFav = document.getElementById('btnFav');
    if (currentModalItem.isFav) {
        btnFav.innerHTML = '<i class="fa-solid fa-heart"></i> お気に入り済';
        btnFav.classList.add('active');
    } else {
        btnFav.innerHTML = '<i class="fa-regular fa-heart"></i> お気に入り';
        btnFav.classList.remove('active');
    }

    // 所持ボタン
    const btnOwned = document.getElementById('btnOwned');
    if (currentModalItem.isOwned) {
        btnOwned.innerHTML = '所持済';
        btnOwned.style.background = '#22c55e';
        btnOwned.style.color = '#fff';
    } else {
        btnOwned.innerHTML = '未所持';
        btnOwned.style.background = '#334155';
        btnOwned.style.color = '#fff';
    }
}

// アクション: お気に入り切り替え
window.toggleDetailFav = () => {
    if(!currentModalItem) return;
    const key = currentModalItem.key;
    
    if(!myCards[key]) myCards[key] = { owned: false, level: 50 };
    myCards[key].favorite = !myCards[key].favorite;
    
    // 状態更新
    currentModalItem.isFav = myCards[key].favorite;
    saveInv(); // data_manager.jsの関数
    updateDetailButtons();
};

// アクション: 所持切り替え
window.toggleDetailOwned = () => {
    if(!currentModalItem) return;
    const key = currentModalItem.key;
    
    if(!myCards[key]) myCards[key] = { level: 50 };
    myCards[key].owned = !myCards[key].owned;
    
    currentModalItem.isOwned = myCards[key].owned;
    saveInv();
    updateDetailButtons();
};

// アクション: トレイに追加
window.addToTrayFromDetail = () => {
    if(!currentModalItem) return;
    addToTray(currentModalItem.original);
    closeCardDetailModal();
    document.getElementById('compareTray').classList.add('open');
};

// --- Tray Logic ---
window.toggleTray = () => {
    document.getElementById('compareTray').classList.toggle('open');
};

window.addToTray = (card) => {
    const key = card.name + "_" + card.title;
    // 重複チェック
    if(compareTray.find(c => (c.name + "_" + c.title) === key)) return;
    
    if(compareTray.length >= 5) {
        alert("比較リストは最大5枚までです");
        return;
    }
    
    compareTray.push(card);
    updateTrayUI();
};

window.updateTrayUI = () => {
    const list = document.getElementById('trayList');
    const count = document.getElementById('trayCount');
    count.innerText = `比較リスト (${compareTray.length})`;
    
    list.innerHTML = '';
    if(compareTray.length === 0) {
        list.innerHTML = '<div class="tray-placeholder" style="color:#666; font-size:0.8rem;">カードを追加してください</div>';
        return;
    }
    
    compareTray.forEach((c, idx) => {
        const imgPath = `img/cards/${c.name}_${c.title}.png`;
        const div = document.createElement('div');
        div.className = 'tray-item';
        div.innerHTML = `<img src="${imgPath}" title="${c.name}" onerror="this.src='https://placehold.jp/40x40.png'">`;
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

// --- Misc: コンディション変更 (Sim用) ---
window.changeCondition = (val, btn) => {
    document.querySelectorAll('.cond-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('conditionMod').value = val;
    if (typeof updateCalc === 'function') updateCalc();
};