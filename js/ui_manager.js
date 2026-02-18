// --- 初期化系 UI構築 ---
function initStatInputs() {
    const area = document.getElementById('statInputArea');
    STATS.forEach(s => {
        const isGk = GK_STATS.includes(s);
        area.innerHTML += `
            <div class="stat-item ${isGk?'gk-stat':''}" style="background:#0f172a; padding:5px; border-radius:4px;">
                <label>${s}</label>
                <div style="display:flex; gap:2px;">
                    <input type="number" placeholder="現在" id="now_${s}" onchange="updateCalc()" style="font-size:0.7rem; padding:4px;">
                    <input type="number" placeholder="最大" id="max_${s}" onchange="updateCalc()" style="font-size:0.7rem; padding:4px;">
                </div>
                <div id="gap_${s}" style="text-align:right; font-size:0.7rem; color:#64748b;">残: -</div>
            </div>`;
    });
}

function initPosSelect() {
    const sel = document.getElementById('simPos');
    Object.keys(POS_MAP).forEach(p => sel.innerHTML += `<option value="${p}">${p}</option>`);
    updateStyleOptions();
}

function updateStyleOptions() {
    const pos = document.getElementById('simPos').value;
    const styleSel = document.getElementById('simStyle');
    styleSel.innerHTML = "";
    (POS_MAP[pos] || []).forEach(s => styleSel.innerHTML += `<option value="${s}">${s}</option>`);
    updateCalc();
}

function initEditors() {
    const grid = document.getElementById('editStatsGrid');
    STATS.forEach(s => grid.innerHTML += `<div class="stat-item ${GK_STATS.includes(s)?'gk-stat':''}"><label>${s}</label><input type="number" step="0.1" class="edit-val" data-stat="${s}"></div>`);
    
    const saTgt = document.getElementById('saTargets');
    STATS.forEach(s => saTgt.innerHTML += `<label style="font-size:0.7rem;"><input type="checkbox" value="${s}" name="sa_tgt"> ${s}</label>`);
    
    const areaGrid = document.getElementById('saAreaGrid');
    for(let i=0; i<9; i++) areaGrid.innerHTML += `<div class="area-cell" onclick="this.classList.toggle('active')"></div>`;
}

// --- メイン計算 & 描画トリガー ---
window.updateCalc = () => {
    const condMult = parseFloat(document.getElementById('conditionMod').value);
    const pos = document.getElementById('simPos').value;
    const style = document.getElementById('simStyle').value;
    const targetSkill = document.getElementById('targetSkillInput').value;

    const totals_x10 = {};
    const saList = new Set();
    let hasTargetSkill = false;

    // 現在セットされているカードスロットから計算
    selectedSlots.forEach((card, idx) => {
        if (!card) return;
        const key = card.name + "_" + card.title;
        const invData = myCards[key];
        // 所持情報があればそのレベル、なければレアリティ最大値を使用
        const level = (invData && invData.level) ? parseInt(invData.level) : (card.rarity==='SSR'?50:45);

        // core_logic.js の関数を使用
        const vals = getCardStatsAtLevel(card, level, pos, style, condMult);
        
        for(let s in vals) {
            totals_x10[s] = (totals_x10[s] || 0) + vals[s];
        }

        if(card.abilities && card.abilities.length > 0) {
            card.abilities.forEach(a => {
                saList.add(a);
                if(a === targetSkill) hasTargetSkill = true;
            });
        }
    });

    renderResults(totals_x10, saList, targetSkill, hasTargetSkill);
    renderSimSlots(pos, style);
};

// --- 結果表示レンダリング ---
function renderResults(totals_x10, saList, targetSkill, hasTargetSkill) {
    const resDiv = document.getElementById('totalResults');
    resDiv.innerHTML = '<h4>特練 上昇値 vs Gap</h4>';
    
    STATS.forEach(s => {
        const now = parseFloat(document.getElementById(`now_${s}`).value) || 0;
        const max = parseFloat(document.getElementById(`max_${s}`).value) || 0;
        const gap = (max > 0 && now > 0) ? (max - now) : null;
        
        const gapEl = document.getElementById(`gap_${s}`);
        if(gap !== null) { 
            gapEl.innerHTML = `残: <b>${gap.toFixed(1)}</b>`; 
            gapEl.style.color = "#fbbf24"; 
        } else { 
            gapEl.innerHTML = `残: -`; 
            gapEl.style.color = "#64748b"; 
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
    let header = '<h4>予定スキル/アビ</h4>';
    if(targetSkill && !hasTargetSkill) header += `<div style="color:red; font-size:0.7rem;">⚠ 必須スキル「${targetSkill}」が含まれていません</div>`;
    else if(targetSkill) header += `<div style="color:var(--accent); font-size:0.7rem;">✔ 必須スキル「${targetSkill}」OK</div>`;
    saDiv.innerHTML = header;

    saList.forEach(name => {
        const s = skillsDB.find(i=>i.name===name), a = abilitiesDB.find(i=>i.name===name);
        const isTarget = (name === targetSkill);
        const hlStyle = isTarget ? 'border:1px solid var(--accent); padding:2px;' : '';
        
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
    g.innerHTML = '';
    selectedSlots.forEach((c, i) => {
        let h = `枠 ${i+1}`;
        if (c) {
            let bVal = 0;
            // ボーナス表示計算
            if(c.bonus_type === pos || c.bonus_type === style) bVal += (c.bonus_value||0);
            if(c.bonuses) c.bonuses.forEach(b => { if(b.type===pos || b.type===style) bVal += b.value; });
            
            const bDisplay = bVal > 0 ? `<div class="bonus-on" style="font-size:0.6rem;">Bonus +${bVal}%</div>` : `<div class="bonus-off" style="font-size:0.6rem;">No Bonus</div>`;
            h = `<div style="font-weight:bold;font-size:0.7rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;">${c.name}</div>${bDisplay}`;
        }
        g.innerHTML += `<div onclick="openModal(${i})" class="${c?'slot-active':'slot-empty'}" style="height:65px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;text-align:center;padding:2px;">${h}</div>`;
    });
}

// --- インベントリ表示 ---
window.renderInventory = () => {
    const div = document.getElementById('invList');
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

// --- リスト表示・オートコンプリート更新 ---
window.renderCardList = () => { 
    const l = document.getElementById('masterList'); 
    l.innerHTML = ''; 
    cardsDB.forEach((c,idx) => l.innerHTML += `<div class="list-item"><b>${c.name}</b><div style="display:flex;gap:5px;"><button class="btn-edit" onclick="loadCardToEditor(cardsDB[${idx}])">編集</button><button class="btn-edit" style="background:#ef4444;" onclick="deleteCard(${idx})">削除</button></div></div>`); 
};

window.renderSAList = () => { 
    const l = document.getElementById('saList'); 
    l.innerHTML = ''; 
    skillsDB.forEach(s => l.innerHTML += `<div class="list-item"><span><span class="tag tag-skill">S</span>${s.name}</span><div style="display:flex;gap:5px;"><button class="btn-edit" onclick="loadSA('skill','${s.name}')">編集</button><button class="btn-edit" style="background:#ef4444;" onclick="deleteSA('skill','${s.name}')">削除</button></div></div>`); 
    abilitiesDB.forEach(a => l.innerHTML += `<div class="list-item"><span><span class="tag tag-ability">A</span>${a.name}</span><div style="display:flex;gap:5px;"><button class="btn-edit" onclick="loadSA('ability','${a.name}')">編集</button><button class="btn-edit" style="background:#ef4444;" onclick="deleteSA('ability','${a.name}')">削除</button></div></div>`); 
};

window.updateAutoComplete = () => { 
    const l = document.getElementById('skillList'); 
    l.innerHTML = ''; 
    [...skillsDB,...abilitiesDB].forEach(i => l.innerHTML += `<option value="${i.name}">`); 
    
    const sSug = document.getElementById('styleSuggestions'); 
    if(sSug) { 
        sSug.innerHTML = ''; 
        Object.values(POS_MAP).flat().forEach(s => sSug.innerHTML += `<option value="${s}">`); 
        Object.keys(POS_MAP).forEach(p => sSug.innerHTML += `<option value="${p}">`); 
    }
};

// --- UI操作ヘルパー (タブ、モーダル、編集エディタ) ---
window.showTab = (id) => { 
    document.querySelectorAll('.content').forEach(c => c.classList.remove('active')); 
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
    // イベント発生元がボタンの場合のみactiveクラス付与(簡易実装)
    if(event && event.target && event.target.classList.contains('tab-btn')) {
        event.target.classList.add('active');
    } else {
        // 初期ロード時などボタンクリック以外の場合、IDに対応するボタンを探す
        const btn = document.querySelector(`.tab-btn[onclick="showTab('${id}')"]`);
        if(btn) btn.classList.add('active');
    }
};

window.toggleDisp = (id) => { 
    const e = document.getElementById(id); 
    e.style.display = e.style.display === 'none' ? 'grid' : 'none'; 
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

// --- Admin Editor Helpers ---
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
};

window.addBonusRow = (type='', val='') => {
    const div = document.createElement('div');
    div.style.cssText = "display:flex; gap:5px; margin-bottom:3px;";
    div.innerHTML = `<input class="edit-b-type" placeholder="条件(CF,ストライカー等)" value="${type}" list="styleSuggestions">
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
};

window.toggleAreaGrid = () => { 
    document.getElementById('areaContainer').style.display = document.getElementById('saType').value === 'skill' ? 'block' : 'none'; 
};