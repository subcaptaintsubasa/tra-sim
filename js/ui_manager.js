// --- 初期化系 UI構築 ---

function initStatInputs() {
    const area = document.getElementById('statInputArea');
    if (!area) return;
    area.style.gridTemplateColumns = "repeat(6, 1fr)";
    area.innerHTML = '';

    const allToCreate = [...STATS, ...GK_STATS];
    const statElements = {};

    allToCreate.forEach(s => {
        const isGk = GK_STATS.includes(s);
        const isDef = DEF_STATS.includes(s);
        
        const wrapper = document.createElement('div');
        wrapper.id = `wrapper_${s}`;
        wrapper.className = `stat-item ${isGk ? 'gk-stat' : ''} ${isDef ? 'def-stat' : ''}`;
        wrapper.style.cssText = `background:#0f172a; padding:5px; border-radius:4px; ${isGk ? 'display:none;' : ''}`;
        
        wrapper.innerHTML = `
            <label>${s}</label>
            <div style="display:flex; gap:2px;">
                <input type="number" placeholder="現在" id="now_${s}" onchange="updateCalc()" style="font-size:0.7rem; padding:4px;">
                <input type="number" placeholder="最大" id="max_${s}" onchange="updateCalc()" style="font-size:0.7rem; padding:4px;">
            </div>
            <div id="gap_${s}" style="text-align:right; font-size:0.7rem; color:#64748b;">差: -</div>
        `;
        statElements[s] = wrapper;
    });

    for (let i = 0; i < 18; i++) {
        const cell = document.createElement('div');
        cell.style.minWidth = "0";
        
        if (i < STATS.length) {
            const sName = STATS[i];
            cell.appendChild(statElements[sName]);
            if (DEF_STATS.includes(sName)) {
                const gkName = GK_MAP[sName];
                cell.appendChild(statElements[gkName]);
            }
        }
        area.appendChild(cell);
    }
}

// --- ポジション/スタイル セレクター ---

function initPosSelect() {
    const grid = document.getElementById('posGrid');
    if (!grid) return;
    grid.innerHTML = '';
    Object.keys(POS_MAP).forEach(p => {
        const group = POS_GROUPS[p] || 'df';
        const chip = document.createElement('div');
        chip.className = 'pos-chip';
        chip.innerText = p;
        chip.dataset.pos = p;
        chip.dataset.group = group;
        chip.onclick = () => selectPos(p);
        grid.appendChild(chip);
    });
}

function selectPos(pos) {
    expandSelection(); // ★ ポジション変更時は必ず開く
    selectedPos = pos;
    selectedStyle = null; 

    document.querySelectorAll('.pos-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.pos === pos);
    });

    renderStyleOptions(pos);

    const isGK = (pos === 'GK');
    document.querySelectorAll('.gk-stat').forEach(el => el.style.display = isGK ? 'block' : 'none');
    document.querySelectorAll('.def-stat').forEach(el => el.style.display = isGK ? 'none' : 'block');

    updateCalc();
}

function renderStyleOptions(pos) {
    const grid = document.getElementById('styleGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const styles = POS_MAP[pos] || [];
    
    styles.forEach(s => {
        const iconCode = STYLE_ICONS[s] || 'ST';
        const card = document.createElement('div');
        card.className = 'style-card';
        card.innerHTML = `
            <img src="img/styles/${iconCode}.png" onerror="this.src='https://placehold.jp/24/333333/ffffff/60x40.png?text=${iconCode}'">
            <span>${s}</span>
        `;
        card.onclick = () => selectStyle(s);
        grid.appendChild(card);
    });
}

function selectStyle(style) {
    selectedStyle = style;
    document.querySelectorAll('.style-card').forEach(c => {
        c.classList.toggle('active', c.querySelector('span').innerText === style);
    });
    collapseSelection(); // ★ 選択完了したら閉じる

    updateCalc();
}
window.collapseSelection = () => {
    if(!selectedPos || !selectedStyle) return;
    
    const selDiv = document.getElementById('posStyleSelection');
    const sumDiv = document.getElementById('posStyleSummary');
    if(selDiv) selDiv.style.display = 'none';
    if(sumDiv) {
        sumDiv.style.display = 'flex';
        const iconCode = STYLE_ICONS[selectedStyle] || 'ST';
        document.getElementById('summaryText').innerText = `${selectedPos} / ${selectedStyle}`;
        const img = document.getElementById('summaryIcon');
        img.src = `img/styles/${iconCode}.png`;
        img.onerror = function() { 
            this.src = `https://placehold.jp/24/333333/ffffff/60x40.png?text=${iconCode}`; 
        };
    }
};

// ★ 追加: 再選択（展開）ロジック
window.expandSelection = () => {
    const selDiv = document.getElementById('posStyleSelection');
    const sumDiv = document.getElementById('posStyleSummary');
    if(selDiv) selDiv.style.display = 'block';
    if(sumDiv) sumDiv.style.display = 'none';
};

// --- ターゲットボタン選択 UI ---

window.updateAutoComplete = () => {
    // 3.2. 所持のみフィルタ
    const onlyOwned = document.getElementById('chkOnlyOwnedSkills')?.checked || false;
    
    // 所持しているスキル/アビリティのセットを作成 (ID形式: 名前::レアリティ)
    const ownedIds = new Set();
    if (onlyOwned) {
        cardsDB.forEach(c => {
            const key = c.name + "_" + c.title;
            if (myCards[key]?.owned && c.abilities) {
                c.abilities.forEach(ab => {
                    if (typeof ab === 'object') {
                        ownedIds.add(`${ab.name}::${ab.rarity}`);
                    } else {
                        // 旧データの場合は暫定的にGold/Silver両方を候補とする
                        // (あるいはカードレアリティから推測したものを入れるのが正確だが、
                        // ここでは「所持している可能性があるID」として広めに取る)
                        ownedIds.add(`${ab}::Gold`);
                        ownedIds.add(`${ab}::Silver`);
                    }
                });
            }
        });
    }

    const renderButtons = (containerId, db, selectedArray, type) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        
        db.forEach(item => {
            // 未更新データ(rarityなし)はGoldとして扱う
            const r = item.rarity || 'Gold';
            const saId = `${item.name}::${r}`;
            
            if (onlyOwned && !ownedIds.has(saId)) return;

            const btn = document.createElement('button');
            const isSelected = selectedArray.includes(saId);
            
            // レアリティクラス
            const rarityClass = `sa-${r.toLowerCase()}`;
            const selectedClass = type === 'skill' ? 'selected-skill' : 'selected-ability';
            
            btn.className = `tag-btn-select ${isSelected ? selectedClass : ''}`;
            
            // レアリティ色
            const rarityColor = r === 'Silver' ? '#cbd5e1' : (r === 'Bronze' ? '#d97706' : '#fbbf24');
            btn.style.borderLeft = `4px solid ${rarityColor}`;
            
            // 頭文字 (G, S, B) と名前
            btn.innerHTML = `<span style="font-size:0.6rem; opacity:0.7; margin-right:3px;">${r[0]}</span>${item.name}`;
            btn.onclick = () => toggleTarget(type, saId);
            container.appendChild(btn);
        });
    };

    renderButtons('skillTargetContainer', skillsDB, selectedTargetSkills, 'skill');
    renderButtons('abilityTargetContainer', abilitiesDB, selectedTargetAbilities, 'ability');

    const l = document.getElementById('skillList'); 
    if (l) {
        l.innerHTML = ''; 
        [...skillsDB,...abilitiesDB].forEach(i => l.innerHTML += `<option value="${i.name}">`); 
    }
};

function toggleTarget(type, saId) {
    if (type === 'skill') {
        if (selectedTargetSkills.includes(saId)) {
            selectedTargetSkills = selectedTargetSkills.filter(id => id !== saId);
        } else if (selectedTargetSkills.length < 3) {
            selectedTargetSkills.push(saId);
        }
    } else {
        if (selectedTargetAbilities.includes(saId)) {
            selectedTargetAbilities = selectedTargetAbilities.filter(id => id !== saId);
        } else if (selectedTargetAbilities.length < 3) {
            selectedTargetAbilities.push(saId);
        }
    }
    updateAutoComplete();
    updateCalc();
}

// --- メイン計算 & 描画トリガー ---

window.updateCalc = () => {
    const condMult = parseFloat(document.getElementById('conditionMod').value);
    const pos = selectedPos;
    const style = selectedStyle;
    
    if (!pos || !style) {
        renderResults({}, {}, []); // saMapを空オブジェクトに
        renderSimSlots(null, null);
        return;
    }

    const isGK = (pos === 'GK');
    const totals_x10 = {};
    
    // スキル情報を収集するマップ (Key: "名前::レアリティ", Value: {name, rarity, maxSkillLv})
    const saMap = {};

    selectedSlots.forEach((card) => {
        if (!card) return;
        const key = card.name + "_" + card.title;
        const invData = myCards[key];
        const cardLevel = (invData && invData.level) ? parseInt(invData.level) : (card.rarity === 'SSR' ? 50 : 45);

        // ステータス計算
        const vals = getCardStatsAtLevel(card, cardLevel, pos, style, condMult);
        for(let s in vals) {
            if (isGK && DEF_STATS.includes(s)) continue;
            if (!isGK && GK_STATS.includes(s)) continue;
            totals_x10[s] = (totals_x10[s] || 0) + vals[s];
        }

        // スキル情報の正規化とレベル抽出
        if(card.abilities && card.abilities.length > 0) {
            const skillLv = getSkillLevelFromCardLevel(card.rarity, cardLevel);
            
            card.abilities.forEach(ab => {
                const isObj = (typeof ab === 'object' && ab !== null);
                const saName = isObj ? ab.name : ab;
                const saRarity = isObj ? ab.rarity : (card.rarity === 'SSR' ? 'Gold' : 'Silver');
                
                const saKey = `${saName}::${saRarity}`;
                
                // 同じスキルが複数カードにある場合、高い方のスキルレベルを採用
                if (!saMap[saKey] || saMap[saKey].level < skillLv) {
                    saMap[saKey] = {
                        name: saName,
                        rarity: saRarity,
                        level: skillLv
                    };
                }
            });
        }
    });

    // 必須項目の充足チェック (Key形式で比較)
    const missingTargets = [
        ...selectedTargetSkills.filter(id => !saMap[id]),
        ...selectedTargetAbilities.filter(id => !saMap[id])
    ];

    renderResults(totals_x10, saMap, missingTargets);
    renderSimSlots(pos, style);
};

// --- js/core_logic.js (renderResults) ---

function renderResults(totals_x10, saMap, missingTargets) {
    const resDiv = document.getElementById('totalResults');
    if (!resDiv) return;
    resDiv.innerHTML = '';

    const pos = selectedPos;
    if (!pos) {
        resDiv.innerHTML = '<p style="font-size:0.7rem; color:#64748b;">ポジションを選択してください</p>';
        return;
    }

    const isGK = (pos === 'GK');
    const displayOrder = isGK 
        ? STATS.filter(s => !DEF_STATS.includes(s)).concat(GK_STATS)
        : STATS;

    let totalGain = 0;
    let totalGap = 0;
    let totalSatisfied = 0;
    let rowsHtml = '';
    
    displayOrder.forEach(s => {
        const now = parseFloat(document.getElementById(`now_${s}`).value) || 0;
        const max = parseFloat(document.getElementById(`max_${s}`).value) || 0;
        const targetPct = (parseInt(document.getElementById('targetPct').value) || 100) / 100;
        const targetVal = max * targetPct;
        const gap = Math.max(0, targetVal - now);
        const gain = (totals_x10[s] || 0) / 10;
        
        if (max > 0) {
            totalGap += gap;
            totalGain += gain;
            totalSatisfied += Math.min(gain, gap);
        }

        const remain = Math.max(0, gap - gain);
        let pct = (gap > 0) ? Math.min(100, (gain / gap) * 100) : 100;
        let barClass = 'res-bar-fill';
        if (gain > gap && gap > 0) barClass += ' overflow';
        if (pct >= 100) barClass += ' complete';

        if (max === 0 && gain === 0) return;

        rowsHtml += `
            <div class="res-row">
                <div class="res-name">${s}</div>
                <div class="res-val" style="color:${gain>0?'#fff':'#666'}">+${gain.toFixed(0)}</div>
                <div class="res-bar-container">
                    <div class="${barClass}" style="width:${pct}%"></div>
                </div>
                <div class="res-remain">${remain > 0 ? '残'+remain.toFixed(0) : 'OK'}</div>
            </div>
        `;
    });

    const totalPct = (totalGap > 0) ? (totalSatisfied / totalGap * 100) : 0;
    const summaryHtml = `
        <div class="res-summary">
            <div class="res-sum-title">目標達成率</div>
            <div class="res-sum-val">${totalPct.toFixed(1)}%</div>
            <div class="res-sum-sub">上昇合計: ${totalGain.toFixed(0)} / 必要合計: ${totalGap.toFixed(0)}</div>
        </div>
    `;

    resDiv.innerHTML = summaryHtml + rowsHtml;

    // スキル表示（既存ロジック維持）
    const saDiv = document.getElementById('saResults');
    if (!saDiv) return;
    let header = '<h4>習得スキル/アビ</h4>';
    if(missingTargets.length > 0) {
        header += `<div style="color:#ef4444; font-size:0.7rem;">⚠ 未充足あり</div>`;
    } else if (selectedTargetSkills.length > 0 || selectedTargetAbilities.length > 0) {
        header += `<div style="color:var(--accent); font-size:0.7rem;">✔ 必須項目を全て充足</div>`;
    }
    saDiv.innerHTML = header;

    Object.values(saMap).forEach(item => {
        const isS = !!skillsDB.find(s => s.name === item.name);
        const type = isS ? 'S' : 'A';
        const saId = `${item.name}::${item.rarity}`;
        const isTarget = selectedTargetSkills.includes(saId) || selectedTargetAbilities.includes(saId);
        const hlStyle = isTarget ? 'border:1px solid var(--accent); background:rgba(34,197,94,0.1);' : '';
        const rarityClass = item.rarity ? `sa-${item.rarity.toLowerCase()}` : '';
        
        saDiv.innerHTML += `
        <div class="clickable-sa" onclick="openSaModal('${item.name}', '${item.rarity}', ${item.level})" style="display:flex; align-items:center; margin-bottom:5px; width:100%; padding:6px; border-radius:4px; border:1px solid #334155; background:#1e293b; ${hlStyle}">
            <span class="sa-badge ${rarityClass}">${type}</span>
            <b style="font-size:0.85rem; flex:1;">${item.name}</b>
            <span style="font-size:0.7rem; color:var(--primary); font-weight:bold;">Lv.${item.level}</span>
        </div>`;
    });
}
function renderSimSlots(pos, style) {
    const g = document.getElementById('simSlots');
    if (!g) return;
    g.innerHTML = '';
        selectedSlots.forEach((c, i) => {
        const div = document.createElement('div');
        // ★変更: 新しい関数を呼ぶ
        div.onclick = () => startSimCardSelection(i);
        
        if (c) {
            div.className = 'slot-active';
            div.style.cssText = "height:90px; border-radius:8px; cursor:pointer;";
            
            // ボーナス計算
            let bVal = 0;
            if (pos && style) {
                if (c.bonuses && Array.isArray(c.bonuses) && c.bonuses.length > 0) {
                    c.bonuses.forEach(b => { 
                        if(b.type===pos || b.type===style) bVal += b.value; 
                    });
                } else if (c.bonus_type) {
                    if(c.bonus_type === pos || c.bonus_type === style) bVal += (c.bonus_value||0);
                }
            }
            const bText = bVal > 0 ? `+${bVal}%` : '';
            const bDisplay = bVal > 0 ? `<div class="slot-badge">${bText}</div>` : '';
            const imgPath = `img/cards/${c.name}_${c.title}.png`;

            div.innerHTML = `
                <img src="${imgPath}" class="slot-bg-img" onerror="this.src='https://placehold.jp/333333/ffffff/100x133.png?text=NoImg'">
                ${bDisplay}
                <div class="slot-overlay">
                    <div style="font-weight:bold;">${c.name}</div>
                    <div style="font-size:0.6rem; opacity:0.8;">${c.title}</div>
                </div>
            `;
        } else {
            div.className = 'slot-empty';
            // style指定はCSSクラス(.slot-empty)に任せるため削除し、クラスのみ適用
            div.removeAttribute('style'); 
            
            div.innerHTML = `
                <div style="font-size:1.2rem; font-weight:bold; color:#444;">${i+1}</div>
                <span style="font-size:0.65rem; color:#666; margin-top:5px;">タップで<br>選択</span>
            `;
        }
        g.appendChild(div);
    });
}

// --- 在庫・管理系描画 ---

window.renderInventory = () => {
    const div = document.getElementById('invList');
    if (!div) return;
    div.innerHTML = '';
    cardsDB.forEach((c, idx) => {
        const key = c.name + "_" + c.title;
        const data = myCards[key] || { owned: false, level: c.rarity==='SSR'?50:45 };
        const maxL = c.rarity==='SSR'?50:45;
        div.innerHTML += `
        <div class="inv-item ${data.owned?'owned':'unowned'}">
            <input type="checkbox" class="inv-check" onchange="toggleOwn('${key}', this.checked)" ${data.owned?'checked':''}>
            <div style="font-size:0.8rem; font-weight:bold; margin-right:20px;">${c.name}</div>
            <div style="font-size:0.65rem; color:#aaa; margin-bottom:5px;">${c.title}</div>
            <div style="display:flex; align-items:center; gap:5px;">
                <span style="font-size:0.7rem;">Lv</span>
                <input type="number" min="1" max="${maxL}" value="${data.level}" 
                    style="width:45px; padding:2px; font-size:0.75rem;" 
                    onchange="updateOwnLvl('${key}', this.value)" ${!data.owned?'disabled':''}>
            </div>
        </div>`;
    });
};

window.renderCardList = () => { 
    const l = document.getElementById('masterList'); 
    if (!l) return;
    l.innerHTML = ''; 
    
    // インデックス逆順（新しい順）等が見やすいが、仕様書通りインデックス順で表示
    cardsDB.forEach((c, idx) => {
        const imgPath = `img/cards/${c.name}_${c.title}.png`;
        const div = document.createElement('div');
        div.className = 'admin-card-item';
        div.innerHTML = `
            <img src="${imgPath}" class="admin-card-thumb" onerror="this.src='https://placehold.jp/333333/ffffff/100x133.png?text=NoImg'">
            <div style="padding:5px; font-size:0.75rem; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${c.name}
            </div>
            <div style="padding:0 5px 25px 5px; font-size:0.6rem; color:#aaa; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${c.title}
            </div>
            <div class="admin-card-tools">
                <button class="btn btn-sm btn-primary" onclick="loadCardToEditor(cardsDB[${idx}])">編集</button>
                <button class="btn btn-sm" style="background:#ef4444;" onclick="deleteCard(${idx})">削除</button>
            </div>
        `;
        l.appendChild(div);
    });
};

window.renderSAList = () => { 
    const l = document.getElementById('saList'); 
    if (!l) return;
    l.innerHTML = ''; 
    
    const renderItem = (item, type) => {
        // 旧データ判定
        const isLegacy = !item.rarity || (type==='skill' && !item.params);
        const warning = isLegacy ? '<i class="fa-solid fa-triangle-exclamation warning-icon" title="旧データ: 要更新"></i>' : '';
        const rarityClass = item.rarity ? `sa-${item.rarity.toLowerCase()}` : '';
        const rarityLabel = item.rarity ? item.rarity[0] : '-';
        
        // ユニークID生成 (名前+レアリティ)
        const uid = `${type}::${item.name}::${item.rarity||'legacy'}`;

        return `
        <div class="list-item">
            <div style="display:flex; align-items:center;">
                <span class="sa-type-badge ${rarityClass}">${rarityLabel}</span>
                <span class="tag ${type==='skill'?'tag-skill':'tag-ability'}">${type==='skill'?'S':'A'}</span>
                <span style="font-weight:bold; font-size:0.85rem;">${item.name}</span>
                ${warning}
            </div>
            <div style="display:flex;gap:5px;">
                <button class="btn-edit" onclick="loadSA('${type}','${item.name}', '${item.rarity||''}')">編集</button>
                <button class="btn-edit" style="background:#ef4444;" onclick="deleteSA('${type}','${item.name}', '${item.rarity||''}')">削除</button>
            </div>
        </div>`;
    };

    skillsDB.forEach(s => l.innerHTML += renderItem(s, 'skill')); 
    abilitiesDB.forEach(a => l.innerHTML += renderItem(a, 'ability')); 
};

window.initEditors = () => {
    const grid = document.getElementById('editStatsGrid');
    if (grid) {
        const allStats = [...new Set([...STATS, ...GK_STATS])];
        grid.innerHTML = '';
        allStats.forEach(s => grid.innerHTML += `<div class="stat-item ${GK_STATS.includes(s)?'gk-stat':''}"><label>${s}</label><input type="number" step="0.1" class="edit-val" data-stat="${s}"></div>`);
    }
    
    // アビリティ用パラメータチェックボックス生成
    const saChecks = document.getElementById('saParamChecks');
    if (saChecks) {
        saChecks.innerHTML = '';
        const allParams = [...STATS, ...GK_STATS];
        allParams.forEach(s => {
            saChecks.innerHTML += `<label style="font-size:0.7rem; display:flex; align-items:center; gap:4px;"><input type="checkbox" value="${s}" class="sa-param-check"> ${s}</label>`;
        });
    }
    
     const areaGrid = document.getElementById('saAreaGrid');
    if (areaGrid) {
        areaGrid.innerHTML = '';
        for(let i=0; i<9; i++) areaGrid.innerHTML += `<div class="area-cell" onclick="this.classList.toggle('active')"></div>`;
    }
};

window.toggleSaEditorMode = () => {
    const type = document.getElementById('saType').value;
    document.getElementById('abilityEditorArea').style.display = (type === 'ability') ? 'block' : 'none';
    document.getElementById('skillEditorArea').style.display = (type === 'skill') ? 'block' : 'none';
    
    // 旧ターゲット表示の制御
    const legacy = document.getElementById('saTargetsLegacy');
    if(legacy) legacy.style.display = 'none';
};

// --- Admin: Skill Linker Logic ---

// 編集中のスキルリスト (一時保存用)
let currentEditingSkills = []; 

// 1. 検索機能
window.searchSkillCandidates = (text) => {
    const container = document.getElementById('skillSuggestions');
    if (!text) {
        container.style.display = 'none';
        return;
    }

    const search = text.toLowerCase();
    
    // スキルDBとアビリティDBを結合して検索
    // mapで種別(S/A)を付与しておく
    const candidates = [
        ...skillsDB.map(s => ({...s, type: 'S'})),
        ...abilitiesDB.map(a => ({...a, type: 'A'}))
    ].filter(item => item.name.toLowerCase().includes(search));

    container.innerHTML = '';
    
    if (candidates.length === 0) {
        container.innerHTML = '<div style="padding:8px; color:#aaa; font-size:0.7rem;">一致なし</div>';
    } else {
        candidates.forEach(item => {
            const div = document.createElement('div');
            div.className = 'skill-suggestion-item';
            
            // レアリティ表示
            const r = item.rarity || 'Gold'; // デフォルトGold
            const rClass = `sa-${r.toLowerCase()}`;
            
            div.innerHTML = `
                <span class="sa-badge ${rClass}">${item.type}</span>
                <span style="font-weight:bold;">${item.name}</span>
                <span style="font-size:0.65rem; color:#aaa; margin-left:auto;">${r}</span>
            `;
            
            div.onclick = () => {
                addSkillToCard(item.name, r);
                container.style.display = 'none';
                document.getElementById('skillSearchInput').value = ''; // 入力クリア
            };
            
            container.appendChild(div);
        });
    }
    
    container.style.display = 'block';
};

// 候補以外をクリックしたら閉じる処理
document.addEventListener('click', (e) => {
    const wrapper = document.querySelector('.skill-selector-container');
    if (wrapper && !wrapper.contains(e.target)) {
        document.getElementById('skillSuggestions').style.display = 'none';
    }
});

// 2. 追加処理
window.addSkillToCard = (name, rarity) => {
    // 重複チェック
    const exists = currentEditingSkills.some(s => s.name === name && s.rarity === rarity);
    if (exists) return;

    currentEditingSkills.push({ name, rarity });
    renderLinkedSkills();
};

// 3. 削除処理
window.removeSkillFromCard = (index) => {
    currentEditingSkills.splice(index, 1);
    renderLinkedSkills();
};

// 4. 描画処理
window.renderLinkedSkills = () => {
    const list = document.getElementById('linkedSkillsList');
    if (!list) return;
    list.innerHTML = '';

    currentEditingSkills.forEach((item, idx) => {
        const div = document.createElement('div');
        const r = item.rarity || 'Gold';
        // 左線の色クラス
        const borderClass = r === 'Silver' ? 'bd-silver' : (r === 'Bronze' ? 'bd-bronze' : 'bd-gold');
        // バッジクラス
        const badgeClass = `sa-${r.toLowerCase()}`;
        
        // SかAか判定 (DB検索)
        const isS = skillsDB.some(s => s.name === item.name && s.rarity === item.rarity);
        const typeLabel = isS ? 'S' : 'A';

        div.className = `linked-skill-tag ${borderClass}`;
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <span class="sa-badge ${badgeClass}">${typeLabel}</span>
                <span style="font-weight:bold; font-size:0.8rem;">${item.name}</span>
            </div>
            <button class="remove-skill-btn" onclick="removeSkillFromCard(${idx})">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
        list.appendChild(div);
    });
};

    // --- Admin: Image Preview Logic ---
window.previewCardImage = (input) => {
    const file = input.files[0];
    const preview = document.getElementById('editCardPreview');
    if (!file || !preview) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        preview.src = e.target.result;
        preview.style.display = 'block';
        preview.nextElementSibling.style.display = 'none';
    };
    reader.readAsDataURL(file);
};

// --- Admin: Card Navigation ---
let currentEditCardIndex = -1;
let isCardEditorDirty = false;

// フォームの入力監視を追加
function watchCardFormChanges() {
    const inputs = document.querySelectorAll('.card-input, .edit-val, .edit-b-val, #cardImgUpload');
    inputs.forEach(input => {
        input.addEventListener('change', () => { isCardEditorDirty = true; });
        input.addEventListener('input', () => { isCardEditorDirty = true; });
    });
}

window.navigateCard = (direction) => {
    if (isCardEditorDirty) {
        if (!confirm("変更が保存されていませんが移動しますか？")) return;
    }

    if (cardsDB.length === 0) return;

    // 未選択時は先頭へ
    if (currentEditCardIndex === -1) {
        currentEditCardIndex = 0;
    } else {
        currentEditCardIndex += direction;
    }

    // ループ制御
    if (currentEditCardIndex < 0) currentEditCardIndex = cardsDB.length - 1;
    if (currentEditCardIndex >= cardsDB.length) currentEditCardIndex = 0;

    loadCardToEditor(cardsDB[currentEditCardIndex]);
};

window.showTab = (id) => { 
    document.querySelectorAll('.content').forEach(c => c.classList.remove('active')); 
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); 
    const targetContent = document.getElementById(id);
    if (targetContent) targetContent.classList.add('active'); 
    const btn = document.querySelector(`.tab-btn[onclick="showTab('${id}')"]`);
    if(btn) btn.classList.add('active');
};

window.toggleDisp = (id) => { 
    const e = document.getElementById(id); 
    if (e) e.style.display = e.style.display === 'none' ? 'block' : 'none'; 
};

window.openModal = (i) => { 
    activeSlotIndex = i; 
    const m = document.getElementById('modalList'); 
    m.innerHTML = '<div class="card-box" onclick="selectSlot(null)">（空）</div>'; 
    cardsDB.forEach((c, idx) => { 
        if(myCards[c.name+"_"+c.title]?.owned){ 
            m.innerHTML += `<div class="card-box" onclick="selectSlot(${idx})">${c.title}<br><b>${c.name}</b></div>`; 
        }
    }); 
    document.getElementById('cardModal').style.display = 'block'; 
};

window.selectSlot = (i) => { 
    selectedSlots[activeSlotIndex] = i === null ? null : cardsDB[i]; 
    document.getElementById('cardModal').style.display = 'none'; 
    updateCalc(); 
};

window.loadCardToEditor = (d) => {
    // インデックス特定
    if(d) {
        currentEditCardIndex = cardsDB.findIndex(x => x.name === d.name && x.title === d.title);
    } else {
        currentEditCardIndex = -1;
    }
    document.getElementById('editIndexDisplay').innerText = currentEditCardIndex !== -1 ? currentEditCardIndex : 'NEW';

    // フォームリセット
    isCardEditorDirty = false;
    document.getElementById('cardImgUpload').value = ''; // ファイル選択リセット

    if(!d) {
        // 新規作成時の初期化
        document.querySelectorAll('.edit-val').forEach(i => i.value = '');
        document.getElementById('editName').value = '';
        document.getElementById('editTitle').value = '';
        document.getElementById('editBonusList').innerHTML = '';
        document.getElementById('editGrowth').value = "6"; 
        
        // スキルリストリセット (新規作成時は空)
        currentEditingSkills = [];
        renderLinkedSkills();

        // プレビューリセット
        const prev = document.getElementById('editCardPreview');
        prev.src = '';
        prev.style.display = 'none';
        prev.nextElementSibling.style.display = 'block';
        
        watchCardFormChanges();
        showTab('admin-card');
        return;
    }

    // 既存データロード
    document.getElementById('editName').value = d.name;
    document.getElementById('editTitle').value = d.title;
    document.getElementById('editRarity').value = d.rarity;
    document.getElementById('editGrowth').value = d.growth_rate || "6";

    // --- スキルリストの展開 (新旧データ構造対応) ---
    currentEditingSkills = []; // 初期化
    
    if (d.abilities && Array.isArray(d.abilities)) {
        d.abilities.forEach(ab => {
            if (typeof ab === 'object' && ab !== null) {
                // 新データ構造 ({name, rarity})
                currentEditingSkills.push({ name: ab.name, rarity: ab.rarity });
            } else {
                // 旧データ構造 (文字列のみ) -> カードのレアリティから推測して変換
                // SSRならGold, それ以外(SR)ならSilverとする
                const guessedRarity = (d.rarity === 'SSR') ? 'Gold' : 'Silver';
                currentEditingSkills.push({ name: ab, rarity: guessedRarity });
            }
        });
    }
    renderLinkedSkills(); // 描画実行
    // ----------------------------------
    
    // ステータス
    document.querySelectorAll('.edit-val').forEach(i => i.value = d.stats[i.dataset.stat] || '');
    
    // ボーナス
    const bList = document.getElementById('editBonusList');
    bList.innerHTML = '';
    if (d.bonuses) {
        d.bonuses.forEach(b => addBonusRow(b.type, b.value));
    } else if (d.bonus_type) {
        addBonusRow(d.bonus_type, d.bonus_value);
    }

    // 画像プレビュー (GitHub URL)
    const prev = document.getElementById('editCardPreview');
    prev.src = `img/cards/${d.name}_${d.title}.png`;
    prev.style.display = 'block';
    prev.nextElementSibling.style.display = 'none';

    // スクロール
    document.getElementById('cardEditor').scrollIntoView({behavior: "smooth"});
    
    watchCardFormChanges();
    showTab('admin-card');
};

window.addBonusRow = (type='', val='') => {
    const div = document.createElement('div');
    div.style.cssText = "display:flex; gap:5px; margin-bottom:3px;";
    div.innerHTML = `<input class="edit-b-type" placeholder="条件(CF等)" value="${type}" list="styleSuggestions">
                     <input class="edit-b-val" type="number" placeholder="%" value="${val}" style="width:60px;">
                     <button class="btn btn-sm" style="background:#ef4444;" onclick="this.parentElement.remove()">×</button>`;
    document.getElementById('editBonusList').appendChild(div);
};

// --- スキル/アビリティ編集系 ---

window.toggleSaEditorMode = () => {
    const type = document.getElementById('saType').value;
    document.getElementById('abilityEditorArea').style.display = (type === 'ability') ? 'block' : 'none';
    document.getElementById('skillEditorArea').style.display = (type === 'skill') ? 'block' : 'none';
    // 旧ターゲット表示はとりあえず残すが非推奨
    document.getElementById('saTargetsLegacy').style.display = 'none'; 
};

window.setAbilityCondition = (cond) => {
    document.getElementById('saCondition').value = cond;
    document.querySelectorAll('.cond-select-btn').forEach(btn => {
        btn.classList.toggle('active', btn.innerText === cond);
    });
};

window.addSkillParamRow = (target='', vals=[]) => {
    const container = document.getElementById('saParamRows');
    const div = document.createElement('div');
    div.className = 'param-input-group';
    
    // パラメータ選択肢生成
    let options = STATS.map(s => `<option>${s}</option>`).join('');
    // GK用も追加
    options += GK_STATS.map(s => `<option>${s}</option>`).join('');

    const v1 = vals[0] || ''; const v2 = vals[1] || ''; const v3 = vals[2] || '';
    const v4 = vals[3] || ''; const v5 = vals[4] || '';

    div.innerHTML = `
        <select style="font-size:0.7rem; padding:2px;"><option value="">Param</option>${options}</select>
        <input type="number" placeholder="L1" value="${v1}">
        <input type="number" placeholder="L2" value="${v2}">
        <input type="number" placeholder="L3" value="${v3}">
        <input type="number" placeholder="L4" value="${v4}">
        <input type="number" placeholder="L5" value="${v5}">
        <button class="btn btn-sm" style="background:#ef4444; padding:0;" onclick="this.parentElement.remove()">×</button>
    `;
    
    // Select値セット
    if(target) div.querySelector('select').value = target;
    
    container.appendChild(div);
};

window.loadSA = (type, name, rarity) => { 
    const db = type === 'skill' ? skillsDB : abilitiesDB;
    // 名前とレアリティで検索
    const item = db.find(i => i.name === name && (!rarity || i.rarity === rarity)); 
    if(!item) return; 

    // --- 変更前の情報を保持 ---
    const editor = document.getElementById('saEditor');
    editor.dataset.originalName = item.name;
    // ★重要修正: レアリティがない場合は空文字をセットする (勝手にGoldにしない)
    editor.dataset.originalRarity = item.rarity || ""; 
    editor.dataset.isEditMode = "true";
    // ------------------------

    document.getElementById('saType').value = type;
    document.getElementById('saName').value = item.name; 
    
    // UI上の選択肢は、データにレアリティがなければデフォルト(Gold)を表示しておく
    document.getElementById('saRarity').value = item.rarity || 'Gold';

    toggleSaEditorMode();

    if (type === 'skill') {
        document.getElementById('saSkillType').value = item.skill_type || '';
        document.getElementById('saNote').value = item.note || '';
        
        const pContainer = document.getElementById('saParamRows');
        pContainer.innerHTML = '';
        if (item.params && Array.isArray(item.params)) {
            item.params.forEach(p => addSkillParamRow(p.stat, p.values));
        } else if (item.value && item.targets) {
            // 旧データ互換
            item.targets.forEach(t => addSkillParamRow(t, [item.value, item.value, item.value, item.value, item.value]));
        } else {
            addSkillParamRow();
        }

        const cells = document.querySelectorAll('.area-cell'); 
        cells.forEach((c, idx) => { 
            c.classList.remove('active'); 
            if(item.area?.[idx]) c.classList.add('active'); 
        });

    } else {
        // Ability
        setAbilityCondition(item.condition || '');
        // チェックボックス反映
        document.querySelectorAll('.sa-param-check').forEach(c => {
            c.checked = (item.targets && item.targets.includes(c.value));
        });
    }

    showTab('admin-skill');
};

window.toggleAreaGrid = () => { 
    const areaCont = document.getElementById('areaContainer');
    if (areaCont) areaCont.style.display = document.getElementById('saType').value === 'skill' ? 'block' : 'none'; 
};

window.renderProfileSelector = () => {
    const select = document.getElementById('profileSelect');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">-- 保存済み選手を読込 --</option>';
    Object.keys(profiles).sort().forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.innerText = name;
        select.appendChild(opt);
    });
    select.value = current;
};

window.openSaveModal = () => {
    const modal = document.getElementById('profileModal');
    const title = document.getElementById('profileModalTitle');
    const content = document.getElementById('profileModalContent');
    title.innerText = "現在のステータスを保存";
    content.innerHTML = `
        <div style="margin-bottom:10px;">
            <label style="font-size:0.75rem; color:#94a3b8;">保存名 (例: ハーランドLv1)</label>
            <input type="text" id="modalProfileName" placeholder="名前を入力..." style="margin-top:5px;">
        </div>
        <button class="btn btn-accent" onclick="execSaveProfile()">保存する</button>
    `;
    modal.style.display = 'flex'; 
    document.getElementById('modalProfileName').focus();
};

window.openLoadModal = () => {
    const modal = document.getElementById('profileModal');
    const title = document.getElementById('profileModalTitle');
    const content = document.getElementById('profileModalContent');
    title.innerText = "保存済みデータの読込";
    content.innerHTML = `<div id="profileLoadList" style="display:flex; flex-direction:column; gap:5px;"></div>`;
    const list = document.getElementById('profileLoadList');
    const keys = Object.keys(profiles || {}).sort();
    if(keys.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:20px; color:#64748b; font-size:0.8rem;">保存されたデータがありません</div>`;
    } else {
        keys.forEach(name => {
            const row = document.createElement('div');
            row.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#0f172a; padding:8px; border-radius:6px; border:1px solid #334155;";
            row.innerHTML = `
                <div style="font-weight:bold; font-size:0.9rem; cursor:pointer; flex:1;" onclick="execLoadProfile('${name}')">${name}</div>
                <button class="btn btn-sm" style="width:auto; background:#ef4444; margin-left:10px;" onclick="execDeleteProfile('${name}')">削除</button>
            `;
            list.appendChild(row);
        });
    }
    modal.style.display = 'flex';
};

window.closeProfileModal = () => {
    document.getElementById('profileModal').style.display = 'none';
};

window.execSaveProfile = () => {
    const name = document.getElementById('modalProfileName').value;
    if(saveProfile(name)) {
        closeProfileModal();
    }
};

window.execLoadProfile = (name) => {
    loadProfile(name);
    closeProfileModal();
};

window.execDeleteProfile = (name) => {
    deleteProfile(name);
    openLoadModal(); 
};

// --- Global Variables for Inventory ---
let invSortType = 'rarity'; // 'rarity' or 'name'
let isBulkMode = false;
let tempMyCards = {}; // 一括編集用の一時データ
let longPressTimer = null;
let isLongPress = false;
let currentDetailCard = null; // 現在モーダルで表示中のカード情報

// --- ツールバー操作 ---
function toggleSortMode() {
    invSortType = (invSortType === 'rarity') ? 'name' : 'rarity';
    document.getElementById('sortToggleBtn').innerText = 
        `並び順: ${invSortType === 'rarity' ? 'レアリティ' : '名前'}`;
    renderInventory();
}

// --- ソートロジック ---
function getSortedCards() {
    const groupByOwned = document.getElementById('groupByOwnedCheck').checked;
    
    // インデックス付きのオブジェクト配列を作成
    let list = cardsDB.map((c, idx) => {
        const key = c.name + "_" + c.title;
        const owned = isBulkMode 
            ? (tempMyCards[key]?.owned || false)
            : (myCards[key]?.owned || false);
        return { ...c, idx, owned, key };
    });

    list.sort((a, b) => {
        // 1. 所持優先 (GroupByOwnedがONの場合)
        if (groupByOwned) {
            if (a.owned !== b.owned) return b.owned - a.owned; // true(=1)が先
        }

        // 2. 指定されたソート順
        if (invSortType === 'rarity') {
            // SSR -> SR
            if (a.rarity !== b.rarity) return a.rarity === 'SSR' ? -1 : 1;
            // 同じレアリティなら名前順
            return a.name.localeCompare(b.name, 'ja');
        } else {
            // 名前順
            return a.name.localeCompare(b.name, 'ja');
        }
    });
    return list;
}

// --- メイン描画関数 (renderInventory) ---
window.renderInventory = () => {
    const grid = document.getElementById('invGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const list = getSortedCards();

    list.forEach(item => {
        // データの取得
        const invData = isBulkMode 
            ? (tempMyCards[item.key] || { level: (item.rarity==='SSR'?50:45) }) 
            : (myCards[item.key] || { level: (item.rarity==='SSR'?50:45) });
        
        const isOwned = item.owned;
        
                const imgPath = `img/cards/${item.name}_${item.title}.png`;
        
        const el = document.createElement('div');
        el.className = `inv-card ${isOwned ? 'owned' : 'unowned'}`;
        if (isBulkMode && isOwned) el.classList.add('bulk-selected');

        // imgタグを作成し、onerrorイベントで読み込み失敗時(画像未登録時)の表示を切り替える
        el.innerHTML = `
            <img src="${imgPath}" class="inv-card-img" 
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" 
                 alt="${item.name}">
            <div class="inv-card-placeholder" style="display:none;">
                ${item.name}<br><span style="font-size:0.6rem">${item.title}</span>
            </div>
            <div class="badge-rarity ${item.rarity}">${item.rarity}</div>
            ${isOwned ? `<div class="badge-level">Lv.${invData.level}</div>` : ''}
        `;

        // イベントリスナー (長押し vs タップ)
        addPressEvents(el, item);

        grid.appendChild(el);
    });
};

// --- タップ/長押し判定ロジック ---
function addPressEvents(element, item) {
    const startPress = (e) => {
        // 右クリック等は無視
        if (e.type === 'mousedown' && e.button !== 0) return;
        
        isLongPress = false;
        longPressTimer = setTimeout(() => {
            isLongPress = true;
            // 長押しアクション実行
            handleLongPress(item);
        }, 500); // 0.5秒で長押し認定
    };

    const endPress = (e) => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        // 長押しでなかった場合のみ、タップ処理
        if (!isLongPress) {
            handleTap(item);
        }
        isLongPress = false; // リセット
    };

    const cancelPress = () => {
        if (longPressTimer) clearTimeout(longPressTimer);
        isLongPress = false;
    };

    // マウス・タッチ両対応
    element.addEventListener('mousedown', startPress);
    element.addEventListener('touchstart', startPress, {passive: true});
    
    element.addEventListener('mouseup', endPress);
    element.addEventListener('touchend', endPress);
    
    element.addEventListener('mouseleave', cancelPress);
    element.addEventListener('touchmove', cancelPress); // 指が動いたらキャンセル
}

// アクション分岐
function handleTap(item) {
    if (isBulkMode) {
        // 一括モード: 選択トグル (データ更新)
        toggleTempOwnership(item.key);
    } else {
        // 通常モード: 詳細モーダル
        openDetailModal(item.idx);
    }
}

function handleLongPress(item) {
    // どちらのモードでも詳細モーダルを開く
    // (バイブレーション等のフィードバックがあると良い)
    if (navigator.vibrate) navigator.vibrate(30);
    openDetailModal(item.idx);
}


// --- 一括選択モード制御 ---
window.startBulkMode = () => {
    isBulkMode = true;
    // myCardsのディープコピーを作成
    tempMyCards = JSON.parse(JSON.stringify(myCards));
    
    document.getElementById('bulkActions').style.display = 'flex';
    document.getElementById('btnBulkStart').style.display = 'none';
    
    // グリッド再描画 (スタイル変更のため)
    renderInventory();
};

window.commitBulkMode = () => {
    // 変更を本番データに反映
    myCards = JSON.parse(JSON.stringify(tempMyCards));
    saveInv(); // LocalStorageへ保存
    
    // シミュレーション再計算
    if (typeof updateCalc === 'function') updateCalc();
    
    endBulkMode();
};

window.cancelBulkMode = () => {
    tempMyCards = {}; // 破棄
    endBulkMode();
};

function endBulkMode() {
    isBulkMode = false;
    document.getElementById('bulkActions').style.display = 'none';
    document.getElementById('btnBulkStart').style.display = 'block';
    renderInventory();
}

function toggleTempOwnership(key) {
    if (!tempMyCards[key]) tempMyCards[key] = { level: 50, owned: false }; // 初期化
    tempMyCards[key].owned = !tempMyCards[key].owned;
    
    // 再描画 (全体再描画は重い可能性があるが、グリッド数が少なければOK。
    // パフォーマンス問題が出る場合はDOM要素を直接操作する)
    renderInventory(); 
}

window.bulkSelectAll = (toState) => {
    cardsDB.forEach(c => {
        const key = c.name + "_" + c.title;
        if (!tempMyCards[key]) tempMyCards[key] = { level: (c.rarity==='SSR'?50:45) };
        tempMyCards[key].owned = toState;
    });
    renderInventory();
};


// --- 詳細モーダル制御 ---
window.openDetailModal = (idx) => {
    const card = cardsDB[idx];
    if (!card) return;
    
    const key = card.name + "_" + card.title;
    // モードに応じて参照先を変える
    const sourceData = isBulkMode ? tempMyCards : myCards;
    const invData = sourceData[key] || { owned: false, level: (card.rarity==='SSR'?50:45) };
    
    currentDetailCard = { ...card, key, invData }; // 状態保持

    // UI反映
    document.getElementById('dmTitle').innerText = card.title;
    document.getElementById('dmName').innerText = card.name;
    document.getElementById('dmRarityBadge').className = `tag badge-rarity ${card.rarity}`;
    document.getElementById('dmRarityBadge').innerText = card.rarity;
    
        const imgContainer = document.getElementById('dmCardImage');
    const imgPath = `img/cards/${card.name}_${card.title}.png`;

    // 既存の "NO IMAGE" テキスト等をクリアして img タグを挿入
    imgContainer.innerHTML = `
        <img src="${imgPath}" style="width:100%; height:100%; object-fit:cover;" 
             onerror="this.style.display='none'; this.parentElement.innerText='NO IMAGE';">
    `;
    
    // 所持スイッチ
    const check = document.getElementById('dmOwnedCheck');
    check.checked = invData.owned;
    
    // レベル設定ボタン生成
    renderLevelPresets(card.rarity, invData.level);
    
    // ステータス & スキル描画
    updateDetailStats();
    renderDetailSkills(card);

    // モーダル表示
    document.getElementById('detailModal').style.display = 'flex';
};

window.closeDetailModal = () => {
    document.getElementById('detailModal').style.display = 'none';
    currentDetailCard = null;
    // 閉じた後にグリッドを更新 (レベル変更などを反映)
    renderInventory();
    if (!isBulkMode) {
        saveInv(); // 通常モードなら即保存
        if (typeof updateCalc === 'function') updateCalc();
    }
};

function renderLevelPresets(rarity, currentLevel) {
    const presets = (rarity === 'SSR') 
        ? [1, 30, 35, 40, 45, 50] 
        : [1, 25, 30, 35, 40, 45];
    
    const container = document.getElementById('dmLevelPresets');
    container.innerHTML = '';
    
    presets.forEach(lvl => {
        const btn = document.createElement('button');
        btn.className = `preset-btn ${parseInt(currentLevel) === lvl ? 'active' : ''}`;
        btn.innerText = `Lv.${lvl}`;
        btn.onclick = () => setDetailLevel(lvl);
        container.appendChild(btn);
    });

    // スライダー同期
    const slider = document.getElementById('dmLevelSlider');
    slider.max = (rarity === 'SSR') ? 50 : 45;
    slider.value = currentLevel;
    document.getElementById('dmLevelVal').innerText = currentLevel;
}

window.updateDmLevelFromSlider = (val) => {
    setDetailLevel(parseInt(val));
};

function setDetailLevel(lvl) {
    if (!currentDetailCard) return;
    currentDetailCard.invData.level = lvl;
    
    // データ更新
    const sourceData = isBulkMode ? tempMyCards : myCards;
    if (!sourceData[currentDetailCard.key]) {
        sourceData[currentDetailCard.key] = { owned: false };
    }
    sourceData[currentDetailCard.key].level = lvl;

    // UI更新
    document.getElementById('dmLevelVal').innerText = lvl;
    renderLevelPresets(currentDetailCard.rarity, lvl); // ボタンのアクティブ切り替え
    updateDetailStats(); // ステータス数値更新
}

window.updateDmOwnership = () => {
    if (!currentDetailCard) return;
    const isOwned = document.getElementById('dmOwnedCheck').checked;
    currentDetailCard.invData.owned = isOwned;
    
    const sourceData = isBulkMode ? tempMyCards : myCards;
    if (!sourceData[currentDetailCard.key]) {
        sourceData[currentDetailCard.key] = { level: 50 }; // 新規ならデフォルト
    }
    sourceData[currentDetailCard.key].owned = isOwned;
};

function updateDetailStats() {
    if (!currentDetailCard) return;
    // ステータス計算 (既存ロジック流用)
    // モーダル内ではポジション補正なしの素ステータスを表示するか、
    // 現在選択中のポジションがあればそれを適用するか。
    // ここでは「素ステータス」を表示する方針で実装します。
    
    const lvl = currentDetailCard.invData.level;
    document.getElementById('dmStatLv').innerText = lvl;
    
    // ポジション指定なしで計算 (ボーナスなし)
    const stats = getCardStatsAtLevel(currentDetailCard, lvl, null, null, 1.0);
    
    const grid = document.getElementById('dmStatsGrid');
    grid.innerHTML = '';
    
    for (let [key, val] of Object.entries(stats)) {
        const div = document.createElement('div');
        div.style.cssText = "background:#0f172a; padding:4px; border-radius:4px; text-align:center;";
        div.innerHTML = `<div style="font-size:0.6rem; color:#94a3b8;">${key}</div><div style="font-weight:bold;">${(val/10).toFixed(1)}</div>`;
        grid.appendChild(div);
    }
}

function renderDetailSkills(card) {
    const list = document.getElementById('dmSkillList');
    list.innerHTML = '';
    
    if (card.abilities && card.abilities.length > 0) {
        card.abilities.forEach(name => {
            const skill = skillsDB.find(s => s.name === name);
            
            const row = document.createElement('div');
            // クリック可能に見えるクラスとイベントを追加
            row.className = 'sa-row clickable-sa';
            row.style.padding = "8px";
            row.style.borderBottom = "1px solid #334155";
            
            row.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div>
                        <span class="tag ${skill ? 'tag-skill' : 'tag-ability'}">${skill?'S':'A'}</span>
                        <span style="font-weight:bold;">${name}</span>
                    </div>
                    <span style="font-size:0.8rem; color:#94a3b8;">▶ 詳細</span>
                </div>
            `;
            
            // タップでモーダル展開
            row.onclick = (e) => {
                e.stopPropagation(); // 親要素への伝播を防ぐ
                openSaModal(name);
            };
            
            list.appendChild(row);
        });
    } else {
        list.innerHTML = '<span style="font-size:0.8rem; color:#666;">なし</span>';
    }
}

// --- スキル/アビリティ詳細モーダル (レベル連動版) ---
window.openSaModal = (name, rarity = null, level = 1) => {
    // 1. データ検索
    let skill = null, ability = null;
    if (rarity) {
        skill = skillsDB.find(s => s.name === name && s.rarity === rarity);
        ability = abilitiesDB.find(a => a.name === name && a.rarity === rarity);
    }
    if (!skill && !ability) {
        skill = skillsDB.find(s => s.name === name);
        ability = abilitiesDB.find(a => a.name === name);
    }

    const target = skill || ability;
    if (!target) return;

    const isSkill = !!skill;
    const itemRarity = target.rarity || (rarity || 'Gold');
    const skillLv = Math.max(1, Math.min(5, level)); // 1~5の範囲

    const modal = document.getElementById('saModal');
    const headerTitle = document.getElementById('saModalTitle');
    const body = modal.querySelector('.modal-body');

    headerTitle.innerText = `${name} (Lv.${skillLv})`;

    const badgeClass = `sa-badge sa-${itemRarity.toLowerCase()}`;
    const typeLabel = isSkill ? 'SKILL' : 'ABILITY';

    let html = `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:15px; border-bottom:1px solid #334155; padding-bottom:10px;">
            <span class="${badgeClass}" style="font-size:0.9rem; padding:4px 8px;">${typeLabel}</span>
            <div style="font-weight:bold; font-size:1.2rem;">${target.name}</div>
        </div>
    `;

    if (isSkill) {
        // --- SKILL の表示 ---
        if (target.note) html += `<div style="font-size:0.8rem; color:#ccc; margin-bottom:10px; white-space:pre-wrap;">${target.note}</div>`;
        
        html += `<div class="card-box">`;
        if (target.params && target.params.length > 0) {
            target.params.forEach(p => {
                // レベルに応じた値を取得
                const val = p.values[skillLv - 1] !== undefined ? p.values[skillLv - 1] : (p.values[0] || 0);
                html += `
                <div class="sa-modal-param-row">
                    <span style="color:#ccc;">${p.stat}</span>
                    <span class="sa-modal-val">+${val}%</span>
                </div>`;
            });
        } else {
            // 旧データ互換
            const legacyVal = target.value || 0;
            html += `<div class="sa-modal-param-row"><span style="color:#ccc;">効果</span><span class="sa-modal-val">+${legacyVal}%</span></div>`;
        }
        html += `</div>`;

        if (target.area) {
            html += `<div style="text-align:center; margin-top:15px;">
                <label style="font-size:0.7rem; color:#94a3b8;">発動エリア</label>
                <div class="area-grid" id="saModalAreaGridRender" style="margin:5px auto;"></div>
            </div>`;
        }
    } else {
        // --- ABILITY の表示 ---
        const condition = target.condition || 'なし';
        html += `
        <div class="card-box" style="margin-bottom:10px; background:rgba(167, 139, 250, 0.1); border-color:var(--ability);">
            <label style="font-size:0.7rem; color:var(--ability);">発動条件</label>
            <div style="font-weight:bold; font-size:0.9rem;">${condition}</div>
        </div>`;

        // レアリティとLvに基づいた固定テーブル参照
        const table = ABILITY_GROWTH_TABLE[itemRarity] || ABILITY_GROWTH_TABLE["Gold"];
        const val = table[skillLv - 1];

        html += `<div class="card-box"><label style="font-size:0.7rem; color:#94a3b8; margin-bottom:5px; display:block;">効果パラメータ</label>`;
        if (target.targets && target.targets.length > 0) {
            target.targets.forEach(t => {
                html += `<div class="sa-modal-param-row"><span style="color:#ccc;">${t}</span><span class="sa-modal-val">+${val}</span></div>`;
            });
        }
        html += `</div>`;
    }

    body.innerHTML = html;

    // エリアの描画
    if (isSkill && target.area) {
        setTimeout(() => {
            const grid = document.getElementById('saModalAreaGridRender');
            if (grid) {
                grid.innerHTML = '';
                target.area.forEach(isActive => {
                    grid.innerHTML += `<div class="area-cell ${isActive ? 'active' : ''}"></div>`;
                });
            }
        }, 0);
    }
    modal.style.display = 'flex';
};

window.closeSaModal = () => {
    document.getElementById('saModal').style.display = 'none';
};

// シミュレータからのカード選択開始
window.startSimCardSelection = (slotIndex) => {
    simSelectState.active = true;
    simSelectState.slotIndex = slotIndex;
    
    // UI制御用属性セット
    document.body.setAttribute('data-sim-selecting', 'true');
    
    // 強制的に所持カードモードへ
    setAppMode('mycards');
    
    // 画面をDBビューへ切り替え
    switchView('database');
    
    // 検索窓をクリアしておく
    clearSearch();
};

// 選択キャンセル
window.cancelSimCardSelection = () => {
    simSelectState.active = false;
    simSelectState.slotIndex = null;
    
    document.body.removeAttribute('data-sim-selecting');
    
    // シミュレータへ戻る
    switchView('sim');
};

window.renderSimCardPicker = () => {
    const grid = document.getElementById('simPickerGrid');
    const searchText = document.getElementById('simPickerSearch').value.toLowerCase();
    grid.innerHTML = '';

    // 所持カードのみ対象にする
    const list = cardsDB.map((c, idx) => {
        const key = c.name + "_" + c.title;
        const userData = myCards[key];
        if (!userData || !userData.owned) return null; // 未所持は除外
        if (searchText && !c.name.toLowerCase().includes(searchText)) return null;
        
        return { original: c, key, idx, level: userData.level };
    }).filter(i => i !== null);

    // ソート: レベル順 -> レアリティ順
    list.sort((a,b) => b.level - a.level || (a.original.rarity==='SSR'?-1:1));

    if(list.length === 0) {
        grid.innerHTML = '<div style="color:#ccc; text-align:center; grid-column:1/-1;">所持カードが見つかりません</div>';
        return;
    }

    list.forEach(item => {
        const c = item.original;
        const imgPath = `img/cards/${c.name}_${c.title}.png`;
        const el = document.createElement('div');
        el.className = 'db-card owned';
        el.style.border = '1px solid #444';
        
        // カードクリック時の動作
        el.onclick = () => {
            // ★追加: 邪魔になるので選択モーダル(ピッカー)を閉じる
            document.getElementById('simCardPickerModal').style.display = 'none';

            const modalItem = { 
                original: c, 
                key: item.key, 
                isOwned: true, 
                level: item.level 
            };
            openMyCardDetailModal(modalItem, true); // true = fromSim
        };

        // HTML構造をCSSに合わせてシンプル化
        el.innerHTML = `
            <img src="${imgPath}" class="db-card-img" loading="lazy" onerror="this.src='https://placehold.jp/100x133.png?text=NoImg'">
            <div class="db-info">
                <div class="db-name">${c.name}</div>
                <div style="font-size:0.6rem; color:#fbbf24;">Lv.${item.level}</div>
            </div>
        `;
        grid.appendChild(el);
    });
};

// --- js/ui_manager.js 末尾に追加 ---

// --- 育成モード & 結果表示拡張 ---

// 現在のシミュレーションモード
let currentSimMode = 'balanced';
let customWeightsOrder = []; // ["決定力", "走力", ...] 

// モード切替
window.setSimMode = (mode) => {
    currentSimMode = mode;
    
    // ボタンのスタイル更新
    document.querySelectorAll('.sim-mode-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btnMode${mode.charAt(0).toUpperCase() + mode.slice(1)}`).classList.add('active');
    
    // カスタム設定ボタンの表示制御
    const btnConfig = document.getElementById('btnCustomConfig');
    if(btnConfig) btnConfig.style.display = (mode === 'custom') ? 'block' : 'none';
};

// カスタム設定モーダル制御
window.openCustomWeightModal = () => {
    const container = document.getElementById('customWeightRows');
    container.innerHTML = '';
    
    // 対象ステータス一覧
    const isGK = (selectedPos === 'GK');
    const stats = isGK 
        ? STATS.filter(s => !DEF_STATS.includes(s)).concat(GK_STATS)
        : STATS;

    for(let i=1; i<=5; i++) {
        const row = document.createElement('div');
        row.className = 'cw-row';
        
        let options = `<option value="">-- 指定なし --</option>`;
        stats.forEach(s => {
            // 既に保存されている設定があれば反映
            const isSelected = (customWeightsOrder[i-1] === s) ? 'selected' : '';
            options += `<option value="${s}" ${isSelected}>${s}</option>`;
        });

        row.innerHTML = `
            <div class="cw-rank">${i}位</div>
            <select class="cw-select" id="cw_rank_${i}">${options}</select>
        `;
        container.appendChild(row);
    }
    
    document.getElementById('customWeightModal').style.display = 'flex';
};

window.closeCustomWeightModal = () => {
    document.getElementById('customWeightModal').style.display = 'none';
};

window.saveCustomWeights = () => {
    customWeightsOrder = [];
    for(let i=1; i<=5; i++) {
        const val = document.getElementById(`cw_rank_${i}`).value;
        if(val) customWeightsOrder.push(val);
    }
    closeCustomWeightModal();
    alert("設定を保存しました。");
};