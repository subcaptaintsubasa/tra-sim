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
    const sContainer = document.getElementById('skillTargetContainer');
    if (sContainer) {
        sContainer.innerHTML = '';
        skillsDB.forEach(s => {
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
        const hlStyle = isTarget ? 'border:1px solid var(--accent); padding:2px; background:rgba(34,197,94,0.1);' : '';
        
        if(s) {
            let areaH = '<div class="sa-result-area">';
            (s.area || Array(9).fill(0)).forEach(v => areaH += `<div class="sa-result-cell ${v?'active':''}"></div>`);
            saDiv.innerHTML += `<div style="display:flex; align-items:center; margin-bottom:5px; width:100%; ${hlStyle}">${areaH}<div style="flex:1; min-width:0; white-space:nowrap;"><span class="tag tag-skill">S</span><b>${name}</b><br><small>${s.value}%</small></div></div>`;
        }
        if(a) saDiv.innerHTML += `<div style="margin-bottom:5px; width:100%; white-space:nowrap; ${hlStyle}"><span class="tag tag-ability">A</span><b>${name}</b><br><small>${a.condition || ''}</small></div>`;
    });
}

function renderSimSlots(pos, style) {
    const g = document.getElementById('simSlots');
    if (!g) return;
    g.innerHTML = '';
    selectedSlots.forEach((c, i) => {
        let h = `枠 ${i+1}`;
        if (c) {
            let bVal = 0;
            if (pos && style) {
                if(c.bonus_type === pos || c.bonus_type === style) bVal += (c.bonus_value||0);
                if(c.bonuses) c.bonuses.forEach(b => { if(b.type===pos || b.type===style) bVal += b.value; });
            }
            const bDisplay = bVal > 0 ? `<div class="bonus-on" style="font-size:0.6rem;">Bonus +${bVal}%</div>` : `<div class="bonus-off" style="font-size:0.6rem;">No Bonus</div>`;
            h = `<div style="font-weight:bold;font-size:0.7rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;">${c.name}</div>${bDisplay}`;
        }
        g.innerHTML += `<div onclick="openModal(${i})" class="${c?'slot-active':'slot-empty'}" style="height:65px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;text-align:center;padding:2px;">${h}</div>`;
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
        return;
    }
    document.getElementById('editName').value = d.name;
    document.getElementById('editTitle').value = d.title;
    document.getElementById('editRarity').value = d.rarity;
    document.getElementById('editAbilityName').value = d.abilities[0] || '';
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