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
            <div id="gap_${s}" style="text-align:right; font-size:0.7rem; color:#64748b;">残: -</div>
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
    
    // 所持しているスキル/アビリティのセットを作成
    const ownedSkills = new Set();
    const ownedAbilities = new Set();
    if (onlyOwned) {
        Object.values(myCards).forEach(mc => {
            if (mc.owned) {
                // キーから名前を復元するのは困難なため、cardsDB全体を走査してownedなものを探す
                // ※少し非効率ですが、データ量が少なければ許容範囲
            }
        });
        // 効率化のため、cardsDBを回して myCards[key].owned をチェック
        cardsDB.forEach(c => {
            const key = c.name + "_" + c.title;
            if (myCards[key]?.owned && c.abilities) {
                c.abilities.forEach(a => {
                    // 名前だけでS/A区別がつかないため、両方のセット候補に入れる
                    ownedSkills.add(a);
                    ownedAbilities.add(a);
                });
            }
        });
    }

    const sContainer = document.getElementById('skillTargetContainer');
    if (sContainer) {
        sContainer.innerHTML = '';
        skillsDB.forEach(s => {
            if (onlyOwned && !ownedSkills.has(s.name)) return; // フィルタ
            const btn = document.createElement('button');
            const isSelected = selectedTargetSkills.includes(s.name);
            btn.className = `tag-btn-select ${isSelected ? 'selected-skill' : ''}`;
            btn.innerText = s.name;
            btn.onclick = () => toggleTarget('skill', s.name);
            sContainer.appendChild(btn);
        });
    }

    const aContainer = document.getElementById('abilityTargetContainer');
    if (aContainer) {
        aContainer.innerHTML = '';
        abilitiesDB.forEach(a => {
            if (onlyOwned && !ownedAbilities.has(a.name)) return; // フィルタ
            const btn = document.createElement('button');
            const isSelected = selectedTargetAbilities.includes(a.name);
            btn.className = `tag-btn-select ${isSelected ? 'selected-ability' : ''}`;
            btn.innerText = a.name;
            btn.onclick = () => toggleTarget('ability', a.name);
            aContainer.appendChild(btn);
        });
    }

    const l = document.getElementById('skillList'); 
    if (l) {
        l.innerHTML = ''; 
        [...skillsDB,...abilitiesDB].forEach(i => l.innerHTML += `<option value="${i.name}">`); 
    }

    const sSug = document.getElementById('styleSuggestions'); 
    if(sSug) { 
        sSug.innerHTML = ''; 
        Object.values(POS_MAP).flat().forEach(s => sSug.innerHTML += `<option value="${s}">`); 
        Object.keys(POS_MAP).forEach(p => sSug.innerHTML += `<option value="${p}">`); 
    }
};

function toggleTarget(type, name) {
    if (type === 'skill') {
        if (selectedTargetSkills.includes(name)) {
            selectedTargetSkills = selectedTargetSkills.filter(n => n !== name);
        } else if (selectedTargetSkills.length < 3) {
            selectedTargetSkills.push(name);
        }
    } else {
        if (selectedTargetAbilities.includes(name)) {
            selectedTargetAbilities = selectedTargetAbilities.filter(n => n !== name);
        } else if (selectedTargetAbilities.length < 3) {
            selectedTargetAbilities.push(name);
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
        renderResults({}, new Set(), []);
        renderSimSlots(null, null);
        return;
    }

    const isGK = (pos === 'GK');
    const totals_x10 = {};
    const saList = new Set();

    selectedSlots.forEach((card) => {
        if (!card) return;
        const key = card.name + "_" + card.title;
        const invData = myCards[key];
        const level = (invData && invData.level) ? parseInt(invData.level) : (card.rarity==='SSR'?50:45);

        const vals = getCardStatsAtLevel(card, level, pos, style, condMult);
        
        for(let s in vals) {
            if (isGK && DEF_STATS.includes(s)) continue;
            if (!isGK && GK_STATS.includes(s)) continue;
            totals_x10[s] = (totals_x10[s] || 0) + vals[s];
        }

        if(card.abilities && card.abilities.length > 0) {
            card.abilities.forEach(a => saList.add(a));
        }
    });

    const missingTargets = [
        ...selectedTargetSkills.filter(name => !saList.has(name)),
        ...selectedTargetAbilities.filter(name => !saList.has(name))
    ];

    renderResults(totals_x10, saList, missingTargets);
    renderSimSlots(pos, style);
};

function renderResults(totals_x10, saList, missingTargets) {
    const resDiv = document.getElementById('totalResults');
    if (!resDiv) return;
    resDiv.innerHTML = '<h4>特練 上昇値 vs Gap</h4>';
    
    const pos = selectedPos;
    if (!pos) {
        resDiv.innerHTML += '<p style="font-size:0.7rem; color:#64748b;">ポジションとスタイルを選択してください</p>';
        return;
    }
    const isGK = (pos === 'GK');

    const currentViewStats = STATS.filter(s => !DEF_STATS.includes(s));
    if (isGK) currentViewStats.push(...GK_STATS);
    else currentViewStats.push(...DEF_STATS);

    const displayOrder = [...STATS].filter(s => currentViewStats.includes(s) || (isGK && GK_MAP[s]));

    displayOrder.forEach(sOrig => {
        const s = (isGK && GK_MAP[sOrig]) ? GK_MAP[sOrig] : sOrig;
        if (!currentViewStats.includes(s)) return;

        const now = parseFloat(document.getElementById(`now_${s}`).value) || 0;
        const max = parseFloat(document.getElementById(`max_${s}`).value) || 0;
        const gap = (max > 0 && now > 0) ? (max - now) : null;
        
        const gapEl = document.getElementById(`gap_${s}`);
        if(gapEl) {
            if(gap !== null) { 
                gapEl.innerHTML = `残: <b>${gap.toFixed(1)}</b>`; 
                gapEl.style.color = "#fbbf24"; 
            } else { 
                gapEl.innerHTML = `残: -`; 
                gapEl.style.color = "#64748b"; 
            }
        }

        if(totals_x10[s] > 0) {
            const finalVal = totals_x10[s] / 10;
            let color = "#fff", note = "";
            if(gap !== null) {
                if(finalVal > gap) { 
                    color = "#ef4444"; 
                    note = ` (${(finalVal-gap).toFixed(1)}過剰)`; 
                }
                else if(finalVal >= gap * 0.9) color = "#22c55e";
            }
            resDiv.innerHTML += `<div style="display:flex; justify-content:space-between; font-size:0.85rem; border-bottom:1px solid #333; padding:2px 0;"><span>${s}</span><b style="color:${color}">+${finalVal.toFixed(1)}${note}</b></div>`; 
        }
    });

    const saDiv = document.getElementById('saResults');
    if (!saDiv) return;
    let header = '<h4>予定スキル/アビ</h4>';
    
    if(missingTargets.length > 0) {
        header += `<div style="color:#ef4444; font-size:0.7rem;">⚠ 不足: ${missingTargets.join(', ')}</div>`;
    } else if (selectedTargetSkills.length > 0 || selectedTargetAbilities.length > 0) {
        header += `<div style="color:var(--accent); font-size:0.7rem;">✔ 必須項目を全て充足</div>`;
    }
    saDiv.innerHTML = header;

    saList.forEach(name => {
        const s = skillsDB.find(i=>i.name===name), a = abilitiesDB.find(i=>i.name===name);
        const isTarget = selectedTargetSkills.includes(name) || selectedTargetAbilities.includes(name);
        const hlStyle = isTarget ? 'border:1px solid var(--accent); background:rgba(34,197,94,0.1);' : '';
        
        // 【修正】詳細テキスト（valueやcondition）を削除し、タグと名前のみにする
        if(s) {
            saDiv.innerHTML += `
            <div class="clickable-sa" onclick="openSaModal('${name}')" style="display:flex; align-items:center; margin-bottom:5px; width:100%; padding:6px; border-radius:4px; border:1px solid #334155; background:#1e293b; ${hlStyle}">
                <span class="tag tag-skill" style="margin-right:8px;">S</span>
                <b style="font-size:0.85rem;">${name}</b>
            </div>`;
        }
        if(a) {
            saDiv.innerHTML += `
            <div class="clickable-sa" onclick="openSaModal('${name}')" style="display:flex; align-items:center; margin-bottom:5px; width:100%; padding:6px; border-radius:4px; border:1px solid #334155; background:#1e293b; ${hlStyle}">
                <span class="tag tag-ability" style="margin-right:8px;">A</span>
                <b style="font-size:0.85rem;">${name}</b>
            </div>`;
        }
    });
}
function renderSimSlots(pos, style) {
    const g = document.getElementById('simSlots');
    if (!g) return;
    g.innerHTML = '';
    selectedSlots.forEach((c, i) => {
        const div = document.createElement('div');
        // 4. クリックで新ピッカーを開く
        div.onclick = () => openSimCardPicker(i); 
        
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
            div.style.cssText = "height:90px; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; text-align:center; padding:2px;";
            div.innerHTML = `枠 ${i+1}<br><span style="font-size:0.7rem; color:#666;">タップして選択</span>`;
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
    cardsDB.forEach((c,idx) => l.innerHTML += `<div class="list-item"><b>${c.name}</b><div style="display:flex;gap:5px;"><button class="btn-edit" onclick="loadCardToEditor(cardsDB[${idx}])">編集</button><button class="btn-edit" style="background:#ef4444;" onclick="deleteCard(${idx})">削除</button></div></div>`); 
};

window.renderSAList = () => { 
    const l = document.getElementById('saList'); 
    if (!l) return;
    l.innerHTML = ''; 
    skillsDB.forEach(s => l.innerHTML += `<div class="list-item"><span><span class="tag tag-skill">S</span>${s.name}</span><div style="display:flex;gap:5px;"><button class="btn-edit" onclick="loadSA('skill','${s.name}')">編集</button><button class="btn-edit" style="background:#ef4444;" onclick="deleteSA('skill','${s.name}')">削除</button></div></div>`); 
    abilitiesDB.forEach(a => l.innerHTML += `<div class="list-item"><span><span class="tag tag-ability">A</span>${a.name}</span><div style="display:flex;gap:5px;"><button class="btn-edit" onclick="loadSA('ability','${a.name}')">編集</button><button class="btn-edit" style="background:#ef4444;" onclick="deleteSA('ability','${a.name}')">削除</button></div></div>`); 
};

window.initEditors = () => {
    const grid = document.getElementById('editStatsGrid');
    if (!grid) return;
    const allStats = [...new Set([...STATS, ...GK_STATS])];
    grid.innerHTML = '';
    allStats.forEach(s => grid.innerHTML += `<div class="stat-item ${GK_STATS.includes(s)?'gk-stat':''}"><label>${s}</label><input type="number" step="0.1" class="edit-val" data-stat="${s}"></div>`);
    
    const saTgt = document.getElementById('saTargets');
    if (saTgt) {
        saTgt.innerHTML = '';
        allStats.forEach(s => saTgt.innerHTML += `<label style="font-size:0.7rem;"><input type="checkbox" value="${s}" name="sa_tgt"> ${s}</label>`);
    }
    
    const areaGrid = document.getElementById('saAreaGrid');
    if (areaGrid) {
        areaGrid.innerHTML = '';
        for(let i=0; i<9; i++) areaGrid.innerHTML += `<div class="area-cell" onclick="this.classList.toggle('active')"></div>`;
    }
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
    if(!d) {
        document.querySelectorAll('.edit-val').forEach(i => i.value = '');
        document.getElementById('editBonusList').innerHTML = '';
        document.getElementById('editGrowth').value = "6"; // 新規作成時はデフォルト6倍
        return;
    }
    document.getElementById('editName').value = d.name;
    document.getElementById('editTitle').value = d.title;
    document.getElementById('editRarity').value = d.rarity;
    
    document.getElementById('editGrowth').value = d.growth_rate || "6";

    document.getElementById('editAbilityName').value = d.abilities ? d.abilities[0] : '';
    document.querySelectorAll('.edit-val').forEach(i => i.value = d.stats[i.dataset.stat] || '');
    const bList = document.getElementById('editBonusList');
    bList.innerHTML = '';
    if (d.bonuses) {
        d.bonuses.forEach(b => addBonusRow(b.type, b.value));
    } else if (d.bonus_type) {
        addBonusRow(d.bonus_type, d.bonus_value);
    }
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

window.loadSA = (type, name) => { 
    const db = type === 'skill' ? skillsDB : abilitiesDB;
    const item = db.find(i => i.name === name); 
    if(!item) return; 
    document.getElementById('saType').value = type; 
    toggleAreaGrid(); 
    document.getElementById('saName').value = item.name; 
    document.getElementById('saValue').value = item.value || ''; 
    document.getElementById('saCondition').value = item.condition || ''; 
    document.querySelectorAll('input[name="sa_tgt"]').forEach(c => c.checked = item.targets?.includes(c.value)); 
    const cells = document.querySelectorAll('.area-cell'); 
    cells.forEach((c, idx) => { 
        c.classList.remove('active'); 
        if(type === 'skill' && item.area?.[idx]) c.classList.add('active'); 
    }); 
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

window.openSaModal = (name) => {
    // データベースから検索
    const skill = skillsDB.find(s => s.name === name);
    const ability = abilitiesDB.find(a => a.name === name);
    const target = skill || ability;

    if (!target) return; // データがない場合は何もしない

    const isSkill = !!skill;

    // タイトルと種別
    document.getElementById('saModalTitle').innerText = name;
    const typeEl = document.getElementById('saModalType');
    typeEl.className = `tag ${isSkill ? 'tag-skill' : 'tag-ability'}`;
    typeEl.innerText = isSkill ? 'SKILL' : 'ABILITY';

    // 数値
    document.getElementById('saModalValue').innerText = 
        (target.value ? target.value : '0') + (isSkill ? '%' : '');

    // 対象ステータス
    document.getElementById('saModalTargets').innerText = 
        (target.targets && target.targets.length > 0) ? target.targets.join(', ') : 'なし';

    // 条件 (アビリティのみ)
    const condBox = document.getElementById('saModalConditionBox');
    if (!isSkill && target.condition) {
        condBox.style.display = 'block';
        document.getElementById('saModalCondition').innerText = target.condition;
    } else {
        condBox.style.display = 'none';
    }

    // エリア (スキルのみ)
    const areaBox = document.getElementById('saModalAreaBox');
    if (isSkill && target.area) {
        areaBox.style.display = 'block';
        const grid = document.getElementById('saModalAreaGrid');
        grid.innerHTML = '';
        target.area.forEach(isActive => {
            grid.innerHTML += `<div class="area-cell ${isActive ? 'active' : ''}"></div>`;
        });
    } else {
        areaBox.style.display = 'none';
    }

    // 表示
    document.getElementById('saModal').style.display = 'flex';
};

window.closeSaModal = () => {
    document.getElementById('saModal').style.display = 'none';
};

window.openSimCardPicker = (slotIndex) => {
    activeSlotIndex = slotIndex; // 選択中のスロット番号を保存
    const modal = document.getElementById('simCardPickerModal');
    modal.style.display = 'flex';
    document.getElementById('simPickerSearch').value = ''; // 検索リセット
    renderSimCardPicker();
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
        
        // カードクリック時の動作: 詳細モーダルを開き、セットボタンを表示させる
        el.onclick = () => {
            // itemオブジェクト構造を openMyCardDetailModal が期待する形に合わせる
            // (renderDatabaseで生成されるオブジェクトと同等にする)
            const modalItem = { 
                original: c, 
                key: item.key, 
                isOwned: true, 
                level: item.level 
            };
            openMyCardDetailModal(modalItem, true); // true = fromSim
        };

        el.innerHTML = `
            <img src="${imgPath}" class="db-card-img" loading="lazy" onerror="this.src='https://placehold.jp/100x133.png?text=NoImg'">
            <div class="db-info">
                <div class="db-name">${c.name}</div>
                <div class="db-badges">
                    <span class="badge ${c.rarity}">${c.rarity}</span>
                    <span class="badge" style="background:#22c55e;color:#000;">Lv.${item.level}</span>
                </div>
            </div>
        `;
        grid.appendChild(el);
    });
};

