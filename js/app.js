// --- Global State ---
let currentView = 'database';
let dbFilter = { 
    text: '', 
    rarity: { SSR: true, SR: true }, 
    pos: { FW: false, MF: false, DF: false, GK: false }
};
let compareTray = []; // List of card objects

window.onload = async () => {
    document.getElementById('ghToken').value = localStorage.getItem('gh_token') || '';
    document.getElementById('ghRepo').value = localStorage.getItem('gh_repo') || '';
    
    myCards = JSON.parse(localStorage.getItem('tra_my_cards') || '{}');
    profiles = JSON.parse(localStorage.getItem('tra_profiles') || '{}');
    if(typeof renderProfileSelector === 'function') renderProfileSelector();
    
    if(typeof initStatInputs === 'function') initStatInputs();
    if(typeof initPosSelect === 'function') initPosSelect();
    if(typeof initEditors === 'function') initEditors();
    
    await fetchAllDB();
    renderDatabase();
    updateTrayUI();
};

window.toggleDrawer = () => {
    document.getElementById('appDrawer').classList.toggle('open');
    document.getElementById('drawerOverlay').classList.toggle('open');
};

window.switchView = (viewId) => {
    document.querySelectorAll('.view-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.drawer-item').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`view-${viewId}`).classList.add('active');
    document.getElementById('appDrawer').classList.remove('open');
    document.getElementById('drawerOverlay').classList.remove('open');
    
    currentView = viewId;
    
    if(viewId === 'database') renderDatabase();
    if(viewId === 'sim' && typeof updateCalc === 'function') updateCalc();
    if(viewId === 'admin-card' && typeof renderCardList === 'function') renderCardList();
    if(viewId === 'admin-skill' && typeof renderSAList === 'function') renderSAList();
};

window.renderDatabase = () => {
    const grid = document.getElementById('dbGrid');
    if(!grid) return;
    grid.innerHTML = '';
    
    const list = cardsDB.map((card, idx) => {
        const key = card.name + "_" + card.title;
        const userData = myCards[key] || {};
        const isFav = !!userData.favorite;
        const isOwned = !!userData.owned;
        
        if (dbFilter.text) {
            const search = dbFilter.text.toLowerCase();
            if (!card.name.toLowerCase().includes(search) && 
                !card.title.toLowerCase().includes(search)) return null;
        }

        if (!dbFilter.rarity[card.rarity]) return null;

        const posKeys = Object.keys(dbFilter.pos).filter(k => dbFilter.pos[k]);
        if (posKeys.length > 0) {
            let hasPos = false;
            const groupMap = {
                "FW": ["CF", "RW", "LW", "ST", "ストライカー", "ウイング"],
                "MF": ["AM", "DM", "LM", "RM", "CMF", "パサー"],
                "DF": ["CB", "LB", "RB", "SB", "DF", "ストッパー"],
                "GK": ["GK", "キーパー"]
            };
            
            let cardPosTags = [];
            if(card.bonuses) cardPosTags = card.bonuses.map(b => b.type);
            else if(card.bonus_type) cardPosTags = [card.bonus_type];
            
            posKeys.forEach(pk => {
                const targetWords = groupMap[pk] || [];
                cardPosTags.forEach(tag => {
                    if(targetWords.some(w => tag.includes(w))) hasPos = true;
                });
                if(pk === 'GK' && card.stats && card.stats["セービング"]) hasPos = true;
            });

            if (!hasPos) return null;
        }
        
        return { original: card, idx, key, isFav, isOwned };
    }).filter(item => item !== null);
    
    list.sort((a, b) => {
        if (a.isFav !== b.isFav) return b.isFav - a.isFav;
        if (a.original.rarity !== b.original.rarity) return a.original.rarity === 'SSR' ? -1 : 1;
        return a.original.name.localeCompare(b.original.name, 'ja');
    });
    
    list.forEach(item => {
        const c = item.original;
        const imgPath = `img/cards/${c.name}_${c.title}.png`;
        
        const el = document.createElement('div');
        el.className = `db-card ${item.isFav ? 'fav' : ''}`;
        el.onclick = () => openCardDetailModal(item);
        
        el.innerHTML = `
            <div class="fav-icon"><i class="fa-solid fa-heart"></i></div>
            <img src="${imgPath}" class="db-card-img" loading="lazy" onerror="this.src='https://placehold.jp/333333/ffffff/300x400.png?text=No+Image'">
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

window.filterDatabase = () => {
    dbFilter.text = document.getElementById('globalSearch').value;
    renderDatabase();
};

window.openFilterModal = () => {
    document.getElementById('fil_rar_SSR').checked = dbFilter.rarity.SSR;
    document.getElementById('fil_rar_SR').checked = dbFilter.rarity.SR;
    document.getElementById('fil_pos_FW').checked = dbFilter.pos.FW;
    document.getElementById('fil_pos_MF').checked = dbFilter.pos.MF;
    document.getElementById('fil_pos_DF').checked = dbFilter.pos.DF;
    document.getElementById('fil_pos_GK').checked = dbFilter.pos.GK;
    document.getElementById('filterModal').style.display = 'flex';
};

window.closeFilterModal = () => {
    document.getElementById('filterModal').style.display = 'none';
};

window.applyFilters = () => {
    dbFilter.rarity.SSR = document.getElementById('fil_rar_SSR').checked;
    dbFilter.rarity.SR = document.getElementById('fil_rar_SR').checked;
    dbFilter.pos.FW = document.getElementById('fil_pos_FW').checked;
    dbFilter.pos.MF = document.getElementById('fil_pos_MF').checked;
    dbFilter.pos.DF = document.getElementById('fil_pos_DF').checked;
    dbFilter.pos.GK = document.getElementById('fil_pos_GK').checked;
    renderDatabase();
    closeFilterModal();
};

window.resetFilters = () => {
    dbFilter.rarity = { SSR: true, SR: true };
    dbFilter.pos = { FW: false, MF: false, DF: false, GK: false };
    document.getElementById('globalSearch').value = '';
    dbFilter.text = '';
    openFilterModal();
    renderDatabase();
};

// --- Card Detail Modal ---
let currentModalItem = null;

window.openCardDetailModal = (item) => {
    currentModalItem = item;
    const c = item.original;
    
    document.getElementById('cdmTitle').innerText = `[${c.rarity}] ${c.title}`;
    const body = document.getElementById('cdmBody');
    const imgPath = `img/cards/${c.name}_${c.title}.png`;

    // ★ 修正: シミュレータと同じ計算ロジック(core_logic.js)を使用
    // ポジションボーナス等は乗せず、素の最大値(LvMax, Cond1.0)を算出
    const maxLvl = c.rarity === 'SSR' ? 50 : 45;
    const maxStats = getCardStatsAtLevel(c, maxLvl, null, null, 1.0);

    body.innerHTML = `
        <div style="display:flex; gap:15px; margin-bottom:15px;">
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
        <div style="background:#0f172a; padding:10px; border-radius:6px; border:1px solid #333;">
            <h5 style="margin:0 0 5px 0; color:var(--primary); font-size:0.8rem;">Lv.${maxLvl} ステータス (素)</h5>
            <div class="stat-grid">
                ${Object.entries(c.stats || {}).map(([k,v]) => {
                    // ★ 修正: maxStatsを使用
                    const val = maxStats[k] ? (maxStats[k] / 10).toFixed(1) : '-';
                    return `
                    <div style="display:flex; justify-content:space-between; font-size:0.75rem;">
                        <span style="color:#aaa;">${k}</span>
                        <span>${val}</span>
                    </div>`;
                }).join('')}
            </div>
        </div>
    `;
    
    updateDetailButtons();
    document.getElementById('cardDetailModal').style.display = 'flex';
};

window.closeCardDetailModal = () => {
    document.getElementById('cardDetailModal').style.display = 'none';
    currentModalItem = null;
    renderDatabase();
};

function updateDetailButtons() {
    if (!currentModalItem) return;
    
    const btnFav = document.getElementById('btnFav');
    if (currentModalItem.isFav) {
        btnFav.innerHTML = '<i class="fa-solid fa-heart"></i> お気に入り済';
        btnFav.classList.add('active');
    } else {
        btnFav.innerHTML = '<i class="fa-regular fa-heart"></i> お気に入り';
        btnFav.classList.remove('active');
    }

    const btnOwned = document.getElementById('btnOwned');
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

// --- Tray & Comparison Logic ---

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
    const count = document.getElementById('trayCount');
    count.innerText = `比較リスト (${compareTray.length})`;
    
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

// --- Comparison Execution ---

window.runComparison = () => {
    if(compareTray.length < 1) return alert("比較するカードを選択してください");
    document.getElementById('compLevelSlider').value = 50;
    updateComparisonTable(50);
    document.getElementById('comparisonModal').style.display = 'flex';
};

window.updateComparisonTable = (level) => {
    const table = document.getElementById('compTable');
    document.getElementById('compLevelVal').innerText = level;
    
    table.innerHTML = '';
    
    // Header
    let thead = `<thead><tr><th>項目</th>`;
    compareTray.forEach(c => {
        const imgPath = `img/cards/${c.name}_${c.title}.png`;
        thead += `
            <th>
                <div class="comp-card-header">
                    <img src="${imgPath}" onerror="this.src='https://placehold.jp/50x65.png'">
                    <div class="comp-card-name">${c.name}</div>
                </div>
            </th>`;
    });
    thead += `</tr></thead>`;
    table.innerHTML += thead;
    
    // Body (正確な計算ロジックを使用)
    const hasGK = compareTray.some(c => c.bonuses?.some(b => b.type.includes('GK')) || c.bonus_type?.includes('GK'));
    const allStats = [...new Set([...STATS, ...(hasGK ? GK_STATS : [])])];
    
    // 各カードのステータスを計算 (core_logic.js利用)
    const cardStats = compareTray.map(c => {
        return getCardStatsAtLevel(c, level, null, null, 1.0);
    });

    let tbody = `<tbody>`;
    allStats.forEach(statName => {
        let maxVal = -1;
        cardStats.forEach(st => {
            if(st[statName] && st[statName] > maxVal) maxVal = st[statName];
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
    
    tbody += `<tr><td>スキル</td>`;
    compareTray.forEach(c => {
        const skills = c.abilities || [];
        tbody += `<td style="font-size:0.65rem; white-space:normal; min-width:100px;">
            ${skills.map(s => `<div class="tag tag-skill" style="display:inline-block; margin:1px;">${s}</div>`).join('')}
        </td>`;
    });
    tbody += `</tr></tbody>`;
    table.innerHTML += tbody;
};

window.changeCondition = (val, btn) => {
    document.querySelectorAll('.cond-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('conditionMod').value = val;
    if (typeof updateCalc === 'function') updateCalc();
};