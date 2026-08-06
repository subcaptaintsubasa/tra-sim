window.selectTargetRarity = (rarity) => {
    selectedTargetRarity = rarity;
    document.querySelectorAll('[id^="btnRarity"]').forEach(btn => btn.classList.remove('active'));
    document.getElementById('btnRarity' + rarity).classList.add('active');
    if (typeof updateCalc === 'function') updateCalc();
};

window.toggleManualGapMode = () => {
    isManualGapMode = !isManualGapMode;
    const container = document.getElementById('manualInputContainer');
    if (container) {
        container.style.display = isManualGapMode ? 'block' : 'none';
    }
    if (typeof updateCalc === 'function') updateCalc();
};

// --- モーダル順位表示用ステート ---
let currentRankGroup = 'all'; // 'all', 'pos', 'style'
let currentRankUseBonus = false;

window.toggleRankGroup = () => {
    const groups = ['all', 'pos', 'style'];
    const labels = { 'all': '[ 全カード ]', 'pos': '[ ポジション別 ]', 'style': '[ スタイル別 ]' };
    let idx = groups.indexOf(currentRankGroup);
    idx = (idx + 1) % groups.length;
    currentRankGroup = groups[idx];
    
    const btn = document.getElementById('rankGroupBtn');
    if (btn) btn.innerText = labels[currentRankGroup];
    
    refreshDetailStatsDisplay(); // 後述の再描画関数
};

window.toggleRankBonus = (checked) => {
    currentRankUseBonus = checked;
    refreshDetailStatsDisplay();
};

window.currentRankTotal = 0; // 分母保持用のグローバル変数

window.refreshDetailStatsDisplay = () => {
    if (!currentModalItem) return;
    window.currentRankTotal = 0; // リセット
    const isMyCard = document.getElementById('cardDetailModal').classList.contains('mycards-mode');
    if (isMyCard) {
        const c = currentModalItem.original;
        const currentLevel = myCards[currentModalItem.key]?.level || 1;
        const stats = getCardStatsAtLevel(c, currentLevel, null, null, 1.0);
        document.getElementById('mcStatGrid').innerHTML = renderStatGridHTML(c.stats, stats, currentModalItem.key, c);
    } else {
        const c = currentModalItem.original;
        const stats = getCardStatsAtLevel(c, currentViewLevel, null, null, 1.0);
        const grid = document.querySelector('#cardDetailModal .stat-grid');
        if (grid) grid.innerHTML = renderStatGridHTML(c.stats, stats, currentModalItem.key, c);
    }

    // 分母の更新
    const totalEl = document.getElementById('rankTotalCount');
    if (totalEl && window.currentRankTotal > 0) {
        totalEl.innerText = `(全${window.currentRankTotal}枚)`;
    } else if (totalEl) {
        totalEl.innerText = '';
    }
};

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
        
        // スマホ手動用インライン表示：+値と残りをdivで明確に分ける
        wrapper.innerHTML = `
            <label>${s}</label>
            <div class="stat-input-row" style="display:flex; gap:2px;">
                <input type="number" placeholder="現在" id="now_${s}" onchange="updateCalc()" style="font-size:0.7rem; padding:4px;">
                <input type="number" placeholder="最大" id="max_${s}" onchange="updateCalc()" style="font-size:0.7rem; padding:4px;">
            </div>
            <div id="gap_${s}" class="stat-gap" style="text-align:right; font-size:0.7rem; color:#64748b; display:none;">差: -</div>
            <!-- インライン結果表示用 (スマホ手動モード時のみ表示) -->
            <div id="inline_res_${s}" class="inline-stat-res">
                <div id="inline_gain_${s}" style="color:var(--primary); font-weight:bold;">+0</div>
                <div id="inline_remain_${s}" style="color:#94a3b8;">残0</div>
            </div>
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
        const nationText = selectedNation ? ` (${selectedNation})` : '';
        document.getElementById('summaryText').innerText = `${selectedPos} / ${selectedStyle}${nationText}`;
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
    const onlyOwned = document.getElementById('chkOnlyOwnedSkills')?.checked || false;
    
    const ownedIds = new Set();
    if (onlyOwned) {
        cardsDB.forEach(c => {
            const key = c.name + "_" + c.title;
            if (myCards[key]?.owned && c.abilities) {
                c.abilities.forEach(ab => {
                    if (typeof ab === 'object') {
                        ownedIds.add(`${ab.name}::${ab.rarity}`);
                    } else {
                        ownedIds.add(`${ab}::Gold`);
                        ownedIds.add(`${ab}::Silver`);
                    }
                });
            }
        });
    }

    const RARITY_ORDER = { "Rainbow": 4, "Gold": 3, "Silver": 2, "Bronze": 1 };

    const renderButtons = (containerId, db, selectedArray, type) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        
        const isSkill = (type === 'skill');

        // ★レアリティ降順 (Rainbow > Gold > Silver > Bronze) ソート
        const sortedDb = [...db].sort((a, b) => {
            const rA = RARITY_ORDER[a.rarity || 'Gold'] || 0;
            const rB = RARITY_ORDER[b.rarity || 'Gold'] || 0;
            if (rA !== rB) return rB - rA;
            return a.name.localeCompare(b.name, 'ja');
        });

        let count = 0;
        sortedDb.forEach(item => {
            const r = item.rarity || 'Gold';
            const saId = `${item.name}::${r}`;
            
            if (onlyOwned && !ownedIds.has(saId)) return;
            if (!checkSaMatchesSimFilter(item, isSkill)) return; // ★S/A単体フィルタ

            count++;
            const btn = document.createElement('button');
            const isSelected = selectedArray.includes(saId);
            
            const selectedClass = type === 'skill' ? 'selected-skill' : 'selected-ability';
            btn.className = `tag-btn-select ${isSelected ? selectedClass : ''}`;
            
            const rarityColor = r === 'Rainbow' ? '#ec4899' : (r === 'Silver' ? '#cbd5e1' : (r === 'Bronze' ? '#d97706' : '#fbbf24'));
            btn.style.borderLeft = `4px solid ${rarityColor}`;
            
            btn.innerHTML = `<span style="font-size:0.6rem; opacity:0.7; margin-right:3px;">${r[0]}</span>${item.name}`;
            btn.onclick = () => toggleTarget(type, saId);
            container.appendChild(btn);
        });

        if (count === 0) {
            container.innerHTML = '<div style="font-size:0.75rem; color:#64748b; padding:5px;">該当なし</div>';
        }
    };

    renderButtons('skillTargetContainer', skillsDB, selectedTargetSkills, 'skill');
    renderButtons('abilityTargetContainer', abilitiesDB, selectedTargetAbilities, 'ability');

    const l = document.getElementById('skillList'); 
    if (l) {
        l.innerHTML = ''; 
        [...skillsDB,...abilitiesDB].forEach(i => l.innerHTML += `<option value="${i.name}">`); 
    }

    // ★メイン画面サマリーバッジの更新
    renderSimTargetSummaryBadges();
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
        renderResults({}, {}, [], {});
        renderSimSlots(null, null);
        return;
    }

    const isGK = (pos === 'GK');
    const totals_x10 = {};
    const specialEffects_x10 = {};
    
    const saMap = {};

    selectedSlots.forEach((card) => {
        if (!card) return;
        const key = card.name + "_" + card.title;
        const invData = myCards[key];
        const cardLevel = (invData && invData.level) ? parseInt(invData.level) : (card.rarity === 'SSR' ? 50 : 45);

        // ステータス計算 (国籍ボーナス考慮)
        const vals = getCardStatsAtLevel(card, cardLevel, pos, style, condMult, selectedNation);
        for(let s in vals) {
            if (isGK && DEF_STATS.includes(s)) continue;
            if (!isGK && GK_STATS.includes(s)) continue;
            totals_x10[s] = (totals_x10[s] || 0) + vals[s];
        }

        if (vals._special_effects) {
            for (let se in vals._special_effects) {
                specialEffects_x10[se] = (specialEffects_x10[se] || 0) + vals._special_effects[se];
            }
        }

        if(card.abilities && card.abilities.length > 0) {
            const skillLv = getSkillLevelFromCardLevel(card.rarity, cardLevel);
            
            card.abilities.forEach(ab => {
                const isObj = (typeof ab === 'object' && ab !== null);
                const saName = isObj ? ab.name : ab;
                const saRarity = isObj ? ab.rarity : (card.rarity === 'SSR' ? 'Gold' : 'Silver');
                
                const saKey = `${saName}::${saRarity}`;
                
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

    const missingTargets = [
        ...selectedTargetSkills.filter(id => !saMap[id]),
        ...selectedTargetAbilities.filter(id => !saMap[id])
    ];

    renderResults(totals_x10, saMap, missingTargets, specialEffects_x10);
    renderSimSlots(pos, style);
};


window.renderResults = (totals_x10, saMap, missingTargets, specialEffects_x10 = {}) => {
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
    let totalOvrGain = 0; // 上昇総合値の合計用

    let rowsHtml = '';
    
    // Gapと最大Gap(100%時)を取得
    const gapData = calculateTargetGaps();
    const gaps = gapData.gaps;
    const maxGaps = gapData.maxGaps;
    const targetPct = (parseInt(document.getElementById('targetPct').value) || 100) / 100;

    COMP_CATEGORIES.forEach(cat => {
        cat.stats.forEach(s => {
            if (!displayOrder.includes(s)) return;
            
            const gap = Math.round((gaps[s] || 0) / 10); 
            const maxGap = Math.round((maxGaps[s] || 0) / 10); 
            const actualGain = (totals_x10[s] || 0) / 10; // 計算用の正確な数値
            const gain = Math.round(actualGain); // 表示用の四捨五入された数値
            
            if (gap > 0) {
                totalGap += gap;
                totalSatisfied += Math.min(gain, gap);
            }
            
            if (actualGain > 0) {
                totalGain += gain;
                // 上昇総合値の計算 (パラメータ上昇値 × 重み ÷ 13)
                const weight = getStatWeight(s, 'ovr', selectedStyle);
                totalOvrGain += actualGain * (weight / 13);
            }

            const remain = Math.max(0, maxGap - gain);
            let fillPct = (maxGap > 0) ? (gain / maxGap) * 100 : 0;
            let targetLinePct = targetPct * 100;

            let barClass = 'res-bar-fill';
            if (gain > maxGap && maxGap > 0) barClass += ' overflow'; 
            if (gain >= gap && gap > 0) barClass += ' complete'; 

            if (maxGap === 0 && gain === 0) return;

            const catBadge = `<span style="display:inline-block; width:34px; font-size:0.55rem; font-weight:bold; background:rgba(255,255,255,0.1); color:${cat.color}; text-align:center; border-radius:3px; margin-right:4px; padding:2px 0; border:1px solid ${cat.color}; flex-shrink:0;">${cat.label}</span>`;

            rowsHtml += `
                <div class="res-row">
                    <div class="res-name" style="display:flex; align-items:center;">
                        ${catBadge}
                        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.65rem;">${s}</span>
                    </div>
                    <div class="res-val" style="color:${gain>0?'#fff':'#666'}">+${gain.toFixed(0)}</div>
                    <div class="res-bar-container">
                        <div class="${barClass}" style="width:${fillPct}%; border-radius:3px;"></div>
                        <div class="res-bar-target-marker" style="left:${targetLinePct}%;"></div>
                    </div>
                    <div class="res-remain">${maxGap > 0 ? (remain > 0 ? '残'+remain.toFixed(0) : 'MAX') : '対象外'}</div>
                </div>
            `;
        });
    });

    const totalPct = (totalGap > 0) ? (totalSatisfied / totalGap * 100) : 0;
    
    // 合計値を合算後に小数切り捨て
    const finalOvrGain = Math.floor(totalOvrGain);

    const summaryHtml = `
        <div class="res-summary">
            <div class="res-sum-title">目標達成率</div>
            <div class="res-sum-val">${totalPct.toFixed(1)}%</div>
            <div class="res-sum-sub">上昇数値合計: ${totalGain.toFixed(0)} / 上昇総合値: ${finalOvrGain}</div>
        </div>
    `;

    let seHtml = '';
    const seKeys = Object.keys(specialEffects_x10);
    if (seKeys.length > 0) {
        seHtml += '<div style="margin-top: 10px; padding: 5px 10px; background: rgba(0, 242, 255, 0.1); border: 1px solid var(--primary); border-radius: 6px;">';
        seHtml += '<div style="font-size:0.75rem; color:var(--primary); font-weight:bold; margin-bottom: 3px;">特殊効果</div>';
        seKeys.forEach(k => {
            seHtml += `<div style="display:flex; justify-content:space-between; font-size:0.75rem; border-bottom:1px dashed #334155; padding:2px 0;">
                <span style="color:#fbbf24;">${k}</span>
                <span style="font-weight:bold; color:#fff;">+${(specialEffects_x10[k]/10).toFixed(1)}</span>
            </div>`;
        });
        seHtml += '</div>';
    }

    resDiv.innerHTML = summaryHtml + rowsHtml + seHtml;

    // スキル表示
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
};

function renderSimSlots(pos, style) {
    const g = document.getElementById('simSlots');
    if (!g) return;
    g.innerHTML = '';
    selectedSlots.forEach((c, i) => {
        const div = document.createElement('div');
        
        div.onclick = () => {
            const isMobileAuto = window.innerWidth <= 768 && document.body.getAttribute('data-mobile-sim') === 'auto';
            if (isMobileAuto && c) {
                openAutoSimResultModal(c, i); 
            } else {
                startSimCardSelection(i);
            }
        };
        
        if (c) {
            div.className = 'slot-active';
            
            let bVal = 0;
            let validPosBonuses = [pos];
            if (pos && typeof POS_BONUS_MAPPING !== 'undefined' && POS_BONUS_MAPPING[pos]) {
                validPosBonuses = validPosBonuses.concat(POS_BONUS_MAPPING[pos]);
            }

            if (pos && style) {
                if (c.bonuses && Array.isArray(c.bonuses) && c.bonuses.length > 0) {
                    c.bonuses.forEach(b => { 
                        if(validPosBonuses.includes(b.type) || b.type === style || (selectedNation && b.type === selectedNation)) bVal += b.value; 
                    });
                } else if (c.bonus_type) {
                    if(validPosBonuses.includes(c.bonus_type) || c.bonus_type === style || (selectedNation && c.bonus_type === selectedNation)) bVal += (c.bonus_value||0);
                }
            }
            const bText = bVal > 0 ? `+${bVal}%` : '';
            const bDisplay = bVal > 0 ? `<div class="slot-badge" style="top:22px;">${bText}</div>` : '';
            const clearBtn = `<div class="slot-clear-btn" onclick="clearSimSlot(event, ${i})"><i class="fa-solid fa-xmark"></i></div>`;
            const imgPath = `img/cards/${c.name}_${c.title}.png`;

            div.innerHTML = `
                <img src="${imgPath}" class="slot-bg-img" onerror="this.src='https://placehold.jp/333333/ffffff/100x133.png?text=NoImg'">
                ${clearBtn}
                ${bDisplay}
                <div class="slot-overlay">
                    <div style="font-weight:bold;">${c.name}</div>
                    <div style="font-size:0.6rem; opacity:0.8;">${c.title}</div>
                </div>
            `;
        } else {
            div.className = 'slot-empty';
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

// --- 【書き換え対象】window.initEditors ---
window.initEditors = () => {
    const grid = document.getElementById('editStatsGrid');
    if (grid) {
        grid.innerHTML = '';
        const order = [
            "決定力", "ショートパス", "突破力", "タックル", "セービング", "ジャンプ", "走力",
            "キック力", "ロングパス", "キープ力", "パスカット", "反応速度", "コンタクト", "敏捷性",
            "冷静さ", "キック精度", "ボールタッチ", "マーク", "1対1", "スタミナ", ""
        ];
        order.forEach(s => {
            if (s === "") {
                grid.innerHTML += `<div></div>`;
            } else {
                grid.innerHTML += `<div class="stat-item"><label>${s}</label><input type="number" step="0.1" class="edit-val" data-stat="${s}"></div>`;
            }
        });
    }

    const editPosGrid = document.getElementById('editPosGroup');
    if (editPosGrid) {
        editPosGrid.innerHTML = '';
        Object.keys(POS_MAP).forEach(p => {
            const group = POS_GROUPS[p] || 'df';
            const chip = document.createElement('div');
            chip.className = 'pos-chip';
            chip.innerText = p;
            chip.dataset.pos = p;
            chip.dataset.group = group;
            chip.onclick = () => toggleEditPos(p, chip);
            editPosGrid.appendChild(chip);
        });
        updateEditStyleOptions();
    }
    
    // アビリティ用対象パラメータボタン生成 (7列グリッド)
    const saChecks = document.getElementById('saParamChecks');
    if (saChecks) {
        saChecks.innerHTML = '';
        const order = [
            "決定力", "ショートパス", "突破力", "タックル", "セービング", "ジャンプ", "走力",
            "キック力", "ロングパス", "キープ力", "パスカット", "反応速度", "コンタクト", "敏捷性",
            "冷静さ", "キック精度", "ボールタッチ", "マーク", "1対1", "スタミナ"
        ];
        order.forEach(s => {
            const div = document.createElement('div');
            div.className = 'chk-btn param';
            div.innerHTML = `<input type="checkbox" name="sa_ability_param" value="${s}" id="sa_ab_prm_${s}"><label for="sa_ab_prm_${s}">${s}</label>`;
            saChecks.appendChild(div);
        });
    }
    
    // 発動エリア 9分割グリッド
    const areaGrid = document.getElementById('saAreaGrid');
    if (areaGrid) {
        areaGrid.innerHTML = '';
        for(let i=0; i<9; i++) areaGrid.innerHTML += `<div class="area-cell" onclick="this.classList.toggle('active')"></div>`;
    }

    // パスターゲット用 9分割グリッド
    const passGrid = document.getElementById('saPassTargetGrid');
    if (passGrid) {
        passGrid.innerHTML = '';
        for(let i=0; i<9; i++) passGrid.innerHTML += `<div class="area-cell" onclick="this.classList.toggle('active')"></div>`;
    }
    
    renderSkillTypeBtnChips(); // スキル種類ボタン群のレンダリング
    
    // パラメータ初期1枠配置
    const pContainer = document.getElementById('saParamRows');
    if (pContainer && pContainer.children.length === 0) {
        addSkillParamRow();
    }

    switchAdminSaTab('skill'); // デフォルトはスキル編集
};

// --- 管理画面UIトグル・動的生成用のヘルパー関数 ---
window.selectEditRarity = (rarity) => {
    document.querySelectorAll('#editRarityGroup .sim-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.innerText === rarity);
    });
    document.getElementById('editRarity').value = rarity;
};

window.toggleEditPos = (pos, btn) => {
    btn.classList.toggle('active');
    updateEditStyleOptions();
};

window.updateEditStyleOptions = () => {
    const activePos = Array.from(document.querySelectorAll('#editPosGroup .pos-chip.active')).map(b => b.dataset.pos);
    
    // 選択されたポジションから候補となるスタイルを抽出
    const stylesSet = new Set();
    activePos.forEach(p => {
        if (POS_MAP[p]) POS_MAP[p].forEach(s => stylesSet.add(s));
    });
    
    // ポジションが未選択の場合は全スタイルを表示
    let availableStyles = Array.from(stylesSet);
    if (activePos.length === 0) {
        Object.values(POS_MAP).forEach(arr => arr.forEach(s => stylesSet.add(s)));
        availableStyles = Array.from(stylesSet);
    }
    
    const currentStyleInput = document.getElementById('editPlayStyle');
    let currentStyle = currentStyleInput.value;
    
    // 選択中のスタイルが現在の候補になければクリア
    if (currentStyle && !availableStyles.includes(currentStyle)) {
        currentStyle = "";
        currentStyleInput.value = "";
    }

    const grid = document.getElementById('editStyleGroup');
    if (!grid) return;
    grid.innerHTML = '';
    
    availableStyles.forEach(s => {
        const iconCode = STYLE_ICONS[s] || 'ST';
        const card = document.createElement('div');
        card.className = `style-card ${s === currentStyle ? 'active' : ''}`;
        card.innerHTML = `
            <img src="img/styles/${iconCode}.png" onerror="this.src='https://placehold.jp/24/333333/ffffff/60x40.png?text=${iconCode}'">
            <span>${s}</span>
        `;
        card.onclick = () => selectEditStyle(s);
        grid.appendChild(card);
    });

    updateStyleBonusButtonName(currentStyle);
};

window.selectEditStyle = (style) => {
    document.getElementById('editPlayStyle').value = style;
    document.querySelectorAll('#editStyleGroup .style-card').forEach(c => {
        c.classList.toggle('active', c.querySelector('span').innerText === style);
    });
    updateStyleBonusButtonName(style);
};

window.updateStyleBonusButtonName = (style) => {
    const btn = document.getElementById('btnAddStyleBonus');
    if (btn) {
        btn.innerText = style ? `+ ${style}` : '+ ｽﾀｲﾙ';
    }
};

window.addPlayStyleBonus = () => {
    const style = document.getElementById('editPlayStyle').value;
    if (style) {
        addBonusRow(style, 20); // デフォルト20%
    } else {
        alert("メインプレースタイルを選択してください。");
    }
};

// UIトグル用のヘルパー関数追加
window.selectEditRarity = (rarity) => {
    document.querySelectorAll('#editRarityGroup .sim-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.innerText === rarity);
    });
    document.getElementById('editRarity').value = rarity;
};

window.toggleEditPos = (pos, btn) => {
    btn.classList.toggle('active');
};

window.addPlayStyleBonus = () => {
    const style = document.getElementById('editPlayStyle').value;
    if (style) {
        addBonusRow(style, 30); // デフォルト30%
    } else {
        alert("メインプレースタイルを選択してください。");
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

    // --- Admin: Image Preview & AI Crop Logic ---
window.previewCardImage = async (input) => {
    const file = input.files[0];
    const preview = document.getElementById('editCardPreview');
    if (!file || !preview) return;

    // UIを処理中に変更
    const noImgDiv = preview.nextElementSibling;
    preview.style.display = 'none';
    noImgDiv.style.display = 'block';
    noImgDiv.innerText = "AI切り抜き中...";

    const API_KEY = "ot0IHY7JRkXgOG0NH9f9";
    const MODEL_ID = "sakatsuku-card-cutter/3";

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Image = e.target.result.split(',')[1];

        try {
            // Roboflow API呼び出し
            const response = await axios({
                method: "POST",
                url: `https://serverless.roboflow.com/${MODEL_ID}`,
                params: { api_key: API_KEY },
                data: base64Image,
                headers: { "Content-Type": "application/x-www-form-urlencoded" }
            });

            const predictions = response.data.predictions;
            
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                if (predictions && predictions.length > 0) {
                    // 検出された中で一番面積が大きいものを採用する
                    let bestPred = predictions[0];
                    let maxArea = 0;
                    predictions.forEach(p => {
                        const area = p.width * p.height;
                        if (area > maxArea) {
                            maxArea = area;
                            bestPred = p;
                        }
                    });

                    // Canvasで切り抜き
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    canvas.width = bestPred.width;
                    canvas.height = bestPred.height;

                    ctx.drawImage(
                        img,
                        bestPred.x - bestPred.width / 2, bestPred.y - bestPred.height / 2,
                        bestPred.width, bestPred.height,
                        0, 0, bestPred.width, bestPred.height
                    );
                    
                    // 切り抜いた画像をプレビューにセット (DataURL化)
                    preview.src = canvas.toDataURL('image/png');
                } else {
                    // カードが検出されなかった場合はそのまま表示
                    alert("カードが自動検出されませんでした。そのままの画像を使用します。");
                    preview.src = e.target.result;
                }
                
                preview.style.display = 'block';
                noImgDiv.style.display = 'none';
                noImgDiv.innerText = "No Image"; // テキストをリセット
            };
        } catch (err) {
            console.error("AI切り抜きエラー:", err);
            alert("AI切り抜きでエラーが発生しました。そのままの画像を使用します。");
            preview.src = e.target.result;
            preview.style.display = 'block';
            noImgDiv.style.display = 'none';
            noImgDiv.innerText = "No Image";
        }
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
    document.getElementById('cardImgUpload').value = ''; 

    if(!d) {
        // 新規作成時の初期化
        document.querySelectorAll('.edit-val').forEach(i => i.value = '');
        document.getElementById('editName').value = '';
        document.getElementById('editTitle').value = '';
        document.getElementById('editBonusList').innerHTML = '';
        document.getElementById('editSpecialEffectList').innerHTML = '';
        document.getElementById('editGrowth').value = "6"; 
        selectEditRarity('SSR');
        
        // ポジションとスタイルをリセット
        document.querySelectorAll('#editPosGroup .pos-chip').forEach(btn => btn.classList.remove('active'));
        document.getElementById('editPlayStyle').value = "";
        updateEditStyleOptions();
        
        // スキルリストリセット
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
    
    // 称号から 【 】 を除外して表示
    let title = d.title || "";
    if (title.startsWith("【") && title.endsWith("】")) {
        title = title.substring(1, title.length - 1);
    }
    document.getElementById('editTitle').value = title;
    
    selectEditRarity(d.rarity);
    document.getElementById('editGrowth').value = d.growth_rate || "6";

    // ポジションの復元
    const positions = d.positions || [];
    document.querySelectorAll('#editPosGroup .pos-chip').forEach(btn => {
        btn.classList.toggle('active', positions.includes(btn.dataset.pos));
    });
    
    // 選択されたポジションをもとにスタイル候補を生成
    updateEditStyleOptions();

    // プレースタイルの推測または復元
    let pStyle = d.play_style || "";
    if (!pStyle && d.bonuses && d.bonuses.length > 0) {
        pStyle = d.bonuses[0].type; 
    } else if (!pStyle && d.bonus_type) {
        pStyle = d.bonus_type; 
    }
    if (pStyle) {
        selectEditStyle(pStyle);
    }

    // スキルリストの展開
    currentEditingSkills = []; 
    if (d.abilities && Array.isArray(d.abilities)) {
        d.abilities.forEach(ab => {
            if (typeof ab === 'object' && ab !== null) {
                currentEditingSkills.push({ name: ab.name, rarity: ab.rarity });
            } else {
                const guessedRarity = (d.rarity === 'SSR') ? 'Gold' : 'Silver';
                currentEditingSkills.push({ name: ab, rarity: guessedRarity });
            }
        });
    }
    renderLinkedSkills(); 
    
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

    // 特殊効果
    const seList = document.getElementById('editSpecialEffectList');
    seList.innerHTML = '';
    if (d.special_effects) {
        d.special_effects.forEach(se => addSpecialEffectRow(se.type, se.value));
    }

    // 画像プレビュー
    const prev = document.getElementById('editCardPreview');
    prev.src = `img/cards/${d.name}_${d.title}.png`;
    prev.style.display = 'block';
    prev.nextElementSibling.style.display = 'none';

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

window.addSpecialEffectRow = (type='覚醒Pt', val='') => {
    const div = document.createElement('div');
    div.style.cssText = "display:flex; gap:5px; margin-bottom:3px;";
    div.innerHTML = `<select class="edit-se-type" style="flex:1;">
                        <option value="覚醒Pt" ${type==='覚醒Pt'?'selected':''}>覚醒Pt</option>
                     </select>
                     <input class="edit-se-val" type="number" placeholder="数値" value="${val}" style="width:60px;">
                     <button class="btn btn-sm" style="background:#ef4444;" onclick="this.parentElement.remove()">×</button>`;
    document.getElementById('editSpecialEffectList').appendChild(div);
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

// --- 【書き換え対象】addSkillParamRow ---
window.addSkillParamRow = (target='', vals=[]) => {
    const container = document.getElementById('saParamRows');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'param-input-group';
    
    const v1 = vals[0] || ''; const v2 = vals[1] || ''; const v3 = vals[2] || '';
    const v4 = vals[3] || ''; const v5 = vals[4] || '';

    const labelText = target ? target : "パラメータを選択";
    const textStyle = target ? "color:#fff; font-weight:bold;" : "color:#94a3b8;";

    div.innerHTML = `
        <button class="btn btn-sm param-select-trigger" data-stat="${target}" onclick="openParamSelectDialog(this)" style="font-size:0.7rem; padding:4px 2px; background:#0f172a; border:1px solid #475569; ${textStyle} text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
            ${labelText}
        </button>
        <input type="number" placeholder="L1" value="${v1}">
        <input type="number" placeholder="L2" value="${v2}">
        <input type="number" placeholder="L3" value="${v3}">
        <input type="number" placeholder="L4" value="${v4}">
        <input type="number" placeholder="L5" value="${v5}">
        <button class="btn btn-sm" style="background:#ef4444; padding:0;" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(div);
};

// --- 【書き換え対象】window.loadSA ---
window.loadSA = (type, name, rarity) => { 
    const db = type === 'skill' ? skillsDB : abilitiesDB;
    const item = db.find(i => i.name === name && (!rarity || i.rarity === rarity)); 
    if(!item) return; 

    const editor = document.getElementById('saEditor');
    editor.dataset.originalName = item.name;
    editor.dataset.originalRarity = item.rarity || ""; 
    editor.dataset.isEditMode = "true";

    switchAdminSaTab(type);

    if (type === 'skill') {
        document.getElementById('saName').value = item.name;
        setSaBtnChipVal('saRarity', item.rarity || 'Gold');
        
        // 1. フォーメーション条件 (複数)
        setSaBtnChipMultiVals('saFormPos', item.formation_condition || []);
        
        // 2. 発動エリア
        const cells = document.querySelectorAll('#saAreaGrid .area-cell'); 
        cells.forEach((c, idx) => { 
            c.classList.remove('active'); 
            if(item.area?.[idx]) c.classList.add('active'); 
        });

        // 3. 発動条件
        setSaBtnChipVal('saSkillType', item.skill_type || ALL_SKILL_TYPES[0]);
        
        // シチュエーション (複数対応・旧データ互換)
        let situations = [];
        if (Array.isArray(item.situation)) {
            situations = item.situation;
        } else if (item.situation) {
            situations = [item.situation];
        }
        situations.forEach(s => addCustomSituationCandidateWithVal(s));
        setSaBtnChipMultiVals('saSituation', situations);

        // 4. 効果
        const pContainer = document.getElementById('saParamRows');
        pContainer.innerHTML = '';
        if (item.params && Array.isArray(item.params) && item.params.length > 0) {
            item.params.forEach(p => addSkillParamRow(p.stat, p.values));
        } else {
            addSkillParamRow();
        }
        
        // 追加効果 (複数対応・旧データ互換)
        let addEffects = [];
        if (Array.isArray(item.additional_effect)) {
            addEffects = item.additional_effect;
        } else if (item.additional_effect) {
            addEffects = [item.additional_effect];
        }
        setSaBtnChipMultiVals('saAddEffect', addEffects);

        // 5. パスターゲット
        if (item.pass_target) {
            if (item.pass_target.pos && item.pass_target.pos.length > 0) {
                setPassTargetMode('pos');
                setSaBtnChipMultiVals('saPassPos', item.pass_target.pos);
            } else if (item.pass_target.area) {
                setPassTargetMode('area');
                const pCells = document.querySelectorAll('#saPassTargetGrid .area-cell');
                pCells.forEach((c, idx) => {
                    c.classList.remove('active');
                    if (item.pass_target.area[idx]) c.classList.add('active');
                });
            } else {
                setPassTargetMode('none');
            }

            // 優先スキル (複数対応・旧データ互換)
            let priorities = [];
            if (Array.isArray(item.pass_target.priority_skill_type)) {
                priorities = item.pass_target.priority_skill_type;
            } else if (item.pass_target.priority_skill_type) {
                priorities = [item.pass_target.priority_skill_type];
            }
            setSaBtnChipMultiVals('saPassPriority', priorities);
        } else {
            setPassTargetMode('none');
            setSaBtnChipMultiVals('saPassPriority', []);
        }

        document.getElementById('saNote').value = item.note || '';

    } else {
        // Ability
        document.getElementById('saAbilityNameInput').value = item.name;
        setSaBtnChipVal('saAbilityRarity', item.rarity || 'Gold');
        setAbilityCondition(item.condition || '');
        
        document.querySelectorAll('input[name="sa_ability_param"]').forEach(c => {
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
// --- 【書き換え対象】window.openSaModal ---
window.openSaModal = (name, rarity = null, level = 1) => {
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
    const skillLv = Math.max(1, Math.min(5, level));

    const modal = document.getElementById('saModal');
    const headerTitle = document.getElementById('saModalTitle');
    const body = modal.querySelector('.modal-body');

    headerTitle.innerText = `${name} (Lv.${skillLv})`;

    const badgeClass = `sa-badge sa-${itemRarity.toLowerCase()}`;
    const typeLabel = isSkill ? 'SKILL' : 'ABILITY';

    let html = `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px; border-bottom:1px solid #334155; padding-bottom:8px;">
            <span class="${badgeClass}" style="font-size:0.9rem; padding:4px 8px;">${typeLabel}</span>
            <div style="font-weight:bold; font-size:1.2rem; flex:1;">${target.name}</div>
        </div>
    `;

    if (isSkill) {
        // 1. フォーメーション条件
        if (target.formation_condition && target.formation_condition.length > 0) {
            html += `<div style="margin-bottom:8px;">
                <label style="font-size:0.7rem; color:#94a3b8; display:block; margin-bottom:2px;">【フォーメーション条件】</label>
                <div style="font-size:0.8rem; color:#fbbf24; font-weight:bold;"><i class="fa-solid fa-users"></i> ${target.formation_condition.join('/')}が存在</div>
            </div>`;
        }

        // 2. 発動条件
        const situations = Array.isArray(target.situation) ? target.situation : (target.situation ? [target.situation] : []);
        html += `<div style="margin-bottom:8px;">
            <label style="font-size:0.7rem; color:#94a3b8; display:block; margin-bottom:2px;">【発動条件】</label>
            <div style="display:flex; flex-wrap:wrap; gap:4px;">`;
        if (target.skill_type) html += `<span class="tag tag-skill">${target.skill_type}</span>`;
        situations.forEach(st => {
            html += `<span class="tag" style="background:#334155; color:#fff;">${st}</span>`;
        });
        html += `</div></div>`;

        // 3. 効果
        html += `<div style="margin-bottom:8px;">
            <label style="font-size:0.7rem; color:#94a3b8; display:block; margin-bottom:2px;">【効果】</label>
            <div class="card-box" style="margin-bottom:0;">`;
        if (target.params && target.params.length > 0) {
            target.params.forEach(p => {
                const val = p.values[skillLv - 1] !== undefined ? p.values[skillLv - 1] : (p.values[0] || 0);
                html += `
                <div class="sa-modal-param-row">
                    <span style="color:#ccc;">${p.stat}</span>
                    <span class="sa-modal-val">+${val}%</span>
                </div>`;
            });
        }
        
        // 追加効果 (複数誘発)
        const addEffects = Array.isArray(target.additional_effect) ? target.additional_effect : (target.additional_effect ? [target.additional_effect] : []);
        if (addEffects.length > 0) {
            const addStr = addEffects.map(e => `誘発：${e}`).join(' / ');
            html += `<div style="margin-top:6px; border-top:1px dashed #444; padding-top:4px; font-size:0.8rem; color:var(--primary); font-weight:bold;">${addStr}</div>`;
        }
        html += `</div></div>`;

        // 4. パスターゲット (テキスト情報)
        if (target.pass_target) {
            let ptText = '';
            if (target.pass_target.pos && target.pass_target.pos.length > 0) {
                ptText += `ターゲット: ${target.pass_target.pos.join('/')}`;
            }
            
            const priorities = Array.isArray(target.pass_target.priority_skill_type) ? target.pass_target.priority_skill_type : (target.pass_target.priority_skill_type ? [target.pass_target.priority_skill_type] : []);
            if (priorities.length > 0) {
                if (ptText) ptText += ' / ';
                ptText += `優先：${priorities.join('・')}スキル所持`;
            }
            if (ptText) {
                html += `<div style="margin-bottom:8px;">
                    <label style="font-size:0.7rem; color:#94a3b8; display:block; margin-bottom:2px;">【パスターゲット】</label>
                    <div class="card-box" style="margin-bottom:0; font-size:0.75rem; color:#a78bfa;">
                        <div><i class="fa-solid fa-location-crosshairs"></i> ${ptText}</div>
                    </div>
                </div>`;
            }
        }

        // 5. 発動エリア ＆ パスターゲットエリア 統合グリッド
        const hasArea = !!target.area;
        const hasPassArea = !!(target.pass_target && target.pass_target.area);

        if (hasArea || hasPassArea) {
            html += `<div style="text-align:center; margin-top:10px;">
                <label style="font-size:0.7rem; color:#94a3b8; display:block; margin-bottom:4px;">【対象エリア】</label>
                <div class="area-grid" id="saModalAreaGridRender" style="margin:0 auto;"></div>
                
                <!-- 凡例 (レジェンド) -->
                <div style="display:flex; justify-content:center; align-items:center; gap:12px; font-size:0.65rem; color:#ccc; margin-top:6px;">
                    <span style="display:inline-flex; align-items:center; gap:3px;">
                        <span style="width:10px; height:10px; background:#fbbf24; border-radius:2px; display:inline-block;"></span> 発動エリア
                    </span>
                    <span style="display:inline-flex; align-items:center; gap:3px;">
                        <i class="fa-solid fa-bullseye" style="color:#ef4444; font-size:0.8rem;"></i> パスターゲット
                    </span>
                </div>
            </div>`;
        }

    } else {
        // ABILITY
        const condition = target.condition || 'なし';
        html += `
        <div style="margin-bottom:8px;">
            <label style="font-size:0.7rem; color:#94a3b8; display:block; margin-bottom:2px;">【発動条件】</label>
            <div class="card-box" style="margin-bottom:0; background:rgba(167, 139, 250, 0.1); border-color:var(--ability);">
                <div style="font-weight:bold; font-size:0.9rem; color:var(--ability);">${condition}</div>
            </div>
        </div>`;

        const table = ABILITY_GROWTH_TABLE[itemRarity] || ABILITY_GROWTH_TABLE["Gold"];
        const val = table[skillLv - 1];

        html += `<div>
            <label style="font-size:0.7rem; color:#94a3b8; display:block; margin-bottom:2px;">【効果】</label>
            <div class="card-box">`;
        if (target.targets && target.targets.length > 0) {
            target.targets.forEach(t => {
                html += `<div class="sa-modal-param-row"><span style="color:#ccc;">${t}</span><span class="sa-modal-val">+${val}</span></div>`;
            });
        }
        html += `</div></div>`;
    }

    body.innerHTML = html;

    // グリッド描画 (発動エリア:黄色塗りつぶし / パスターゲット:赤い的マーク)
    setTimeout(() => {
        if (isSkill && (target.area || (target.pass_target && target.pass_target.area))) {
            const grid = document.getElementById('saModalAreaGridRender');
            if (grid) {
                grid.innerHTML = '';
                for (let i = 0; i < 9; i++) {
                    const isArea = !!(target.area && target.area[i] === 1);
                    const isPassArea = !!(target.pass_target && target.pass_target.area && target.pass_target.area[i] === 1);
                    
                    const cell = document.createElement('div');
                    cell.className = 'area-cell';
                    cell.style.display = 'flex';
                    cell.style.alignItems = 'center';
                    cell.style.justifyContent = 'center';
                    
                    if (isArea) {
                        cell.style.background = '#fbbf24'; // 発動エリア: 黄色塗りつぶし
                        cell.style.border = '1px solid #fff';
                    }
                    
                    if (isPassArea) {
                        // パスターゲット: 赤色の的アイコン
                        cell.innerHTML = `<i class="fa-solid fa-bullseye" style="color:#ef4444; font-size:1.1rem; filter:drop-shadow(0 0 2px #000);"></i>`;
                    }
                    
                    grid.appendChild(cell);
                }
            }
        }
    }, 0);

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

// --- js/ui_manager.js ---

// モード切替
window.setSimMode = (mode) => {
    currentSimMode = mode;
    
    // ボタンのスタイル更新（レアリティボタンを巻き込まないように修正）
    ['Balanced', 'Ovr', 'Custom'].forEach(m => {
        const btn = document.getElementById(`btnMode${m}`);
        if(btn) btn.classList.remove('active');
    });
    
    const activeBtn = document.getElementById(`btnMode${mode.charAt(0).toUpperCase() + mode.slice(1)}`);
    if(activeBtn) activeBtn.classList.add('active');
    
    // カスタム設定ボタンの表示制御
    const btnConfig = document.getElementById('btnCustomConfig');
    if(btnConfig) btnConfig.style.display = (mode === 'custom') ? 'block' : 'none';

    // ★新規追加: 総合値モード用クレジットリンクの表示制御
    const creditsLink = document.getElementById('ovrCreditsLink');
    if(creditsLink) creditsLink.style.display = (mode === 'ovr') ? 'block' : 'none';
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

// --- js/ui_manager.js 末尾に追加 ---

// クレジットモーダル制御
window.openCreditsModal = () => {
    document.getElementById('creditsModal').style.display = 'flex';
};

window.closeCreditsModal = () => {
    document.getElementById('creditsModal').style.display = 'none';
};

// --- スマホ用 シミュレーターモード制御 ---
window.setMobileSimMode = (mode) => {
    // manual or auto
    document.body.setAttribute('data-mobile-sim', mode);
    
    // ボタンの見た目切り替え
    const btnManual = document.getElementById('btnSimManual');
    const btnAuto = document.getElementById('btnSimAuto');
    if (btnManual) btnManual.classList.toggle('active', mode === 'manual');
    if (btnAuto) btnAuto.classList.toggle('active', mode === 'auto');

    // 初期化 (自動モードにした時は左に戻す)
    document.body.classList.remove('sim-slide-right');
};

window.slideSimPane = (direction) => {
    if (direction === 'right') {
        document.body.classList.add('sim-slide-right');
    } else {
        document.body.classList.remove('sim-slide-right');
    }
};

window.openMobileTargetModal = () => {
    const src = document.getElementById('simTargets');
    const dest = document.getElementById('mobileTargetModalBody');
    if (src && dest) {
        // DOM移動 (中身のイベントも維持される)
        dest.appendChild(src);
        src.style.display = 'block'; 
    }
    document.getElementById('mobileTargetModal').style.display = 'flex';
};

window.closeMobileTargetModal = () => {
    const src = document.getElementById('simTargets');
    const origParent = document.getElementById('simPaneLeft');
    if (src && origParent) {
        // スマホ用の特定要素の手前に戻す
        const ref = document.querySelector('.mobile-target-btn-container');
        origParent.insertBefore(src, ref);
        src.style.display = ''; 
    }
    document.getElementById('mobileTargetModal').style.display = 'none';
};

// 自動モード結果専用モーダル
let autoSimCurrentCardKey = null;

window.openAutoSimResultModal = (card, slotIndex) => {
    const key = card.name + "_" + card.title;
    autoSimCurrentCardKey = key;
    const invData = myCards[key] || { level: 1, favorite: false };
    const level = invData.level;

    const modal = document.getElementById('autoSimResultModal');
    document.getElementById('asrmTitle').innerText = `[${card.rarity}] ${card.name}`;
    
    const btnFav = document.getElementById('asrmBtnFav');
    if (btnFav) {
        if (invData.favorite) { btnFav.innerHTML = '<i class="fa-solid fa-heart"></i> 登録中'; btnFav.classList.add('active'); } 
        else { btnFav.innerHTML = '<i class="fa-regular fa-heart"></i> お気に入り'; btnFav.classList.remove('active'); }
    }

    const imgPath = `img/cards/${card.name}_${card.title}.png`;
    
    let bHtml = '';
    const pos = selectedPos;
    const style = selectedStyle;
    
    let validPosBonuses = [pos];
    if (pos && typeof POS_BONUS_MAPPING !== 'undefined' && POS_BONUS_MAPPING[pos]) {
        validPosBonuses = validPosBonuses.concat(POS_BONUS_MAPPING[pos]);
    }

    if (card.bonuses && Array.isArray(card.bonuses)) {
        bHtml = card.bonuses.map(b => {
            const isActive = validPosBonuses.includes(b.type) || b.type === style || (selectedNation && b.type === selectedNation);
            const cName = isActive ? 'bonus-highlight' : 'bonus-inactive';
            return `<span class="tag ${cName}" style="margin-right:4px;">${b.type}+${b.value}%</span>`;
        }).join('');
    } else if (card.bonus_type) {
        const isActive = validPosBonuses.includes(card.bonus_type) || card.bonus_type === style || (selectedNation && card.bonus_type === selectedNation);
        const cName = isActive ? 'bonus-highlight' : 'bonus-inactive';
        bHtml = `<span class="tag ${cName}">${card.bonus_type}+${card.bonus_value}%</span>`;
    }
    if (!bHtml) bHtml = '<span style="font-size:0.7rem; color:#666;">なし</span>';

    let skillListHtml = '';
    const skillLv = getSkillLevelFromCardLevel(card.rarity, level);
    if (card.abilities && card.abilities.length > 0) {
        card.abilities.forEach(ab => {
            const isObj = (typeof ab === 'object' && ab !== null);
            const saName = isObj ? ab.name : ab;
            const saRarity = isObj ? ab.rarity : (card.rarity === 'SSR' ? 'Gold' : 'Silver');
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

    const stats = getCardStatsAtLevel(card, level, null, null, 1.0);
    const statHtml = renderStatGridHTML(card.stats, stats);
    
    let totalStat = 0;
    Object.keys(stats).forEach(k => { if([...STATS, ...GK_STATS].includes(k)) totalStat += stats[k]; });
    totalStat = Math.round(totalStat / 10);

    document.getElementById('asrmBody').innerHTML = `
        <div style="display:flex; gap:15px; margin-bottom:10px;">
            <img src="${imgPath}" style="width:90px; height:120px; object-fit:cover; border-radius:6px; border:1px solid #444;" onerror="this.src='https://placehold.jp/90x120.png?text=NoImg'">
            <div style="flex:1;">
                <div style="font-weight:bold; font-size:1.1rem; line-height:1.3;">${card.name}</div>
                <div style="font-size:0.7rem; color:#fbbf24; margin-bottom:5px;">計算適用Lv: ${level}</div>
                <div style="margin-bottom:8px;">${bHtml}</div>
                <div>${skillListHtml}</div>
            </div>
        </div>
        <div style="background:#0f172a; padding:10px; border-radius:6px; border:1px solid #333;">
            <div style="font-size:0.8rem; font-weight:bold; color:var(--primary); margin-bottom:5px; text-align:right;">総合計: ${totalStat}</div>
            <div class="stat-grid">${statHtml}</div>
        </div>
    `;

    modal.style.display = 'flex';
};

window.toggleAutoSimResultFav = () => {
    if(!autoSimCurrentCardKey) return;
    if(!myCards[autoSimCurrentCardKey]) myCards[autoSimCurrentCardKey] = { level: 1, owned: false };
    myCards[autoSimCurrentCardKey].favorite = !myCards[autoSimCurrentCardKey].favorite;
    saveInv(); 
    
    const btnFav = document.getElementById('asrmBtnFav');
    if(btnFav) {
        if (myCards[autoSimCurrentCardKey].favorite) { btnFav.innerHTML = '<i class="fa-solid fa-heart"></i> 登録中'; btnFav.classList.add('active'); } 
        else { btnFav.innerHTML = '<i class="fa-regular fa-heart"></i> お気に入り'; btnFav.classList.remove('active'); }
    }
};

// --- シミュレータ スロットクリア機能 ---
window.clearAllSimSlots = () => {
    selectedSlots = Array(6).fill(null);
    updateCalc();
};

window.clearSimSlot = (e, idx) => {
    e.stopPropagation(); // モーダルが開くのを防ぐ
    selectedSlots[idx] = null;
    updateCalc();
};

// 各列に対応するパラメータをトグル（全選択/全解除）する関数
window.toggleSortColumn = (colIdx, event) => {
    if (event) event.preventDefault();
    const order = [
        "決定力", "ショートパス", "突破力", "タックル", "セービング", "ジャンプ", "走力",
        "キック力", "ロングパス", "キープ力", "パスカット", "反応速度", "コンタクト", "敏捷性",
        "冷静さ", "キック精度", "ボールタッチ", "マーク", "1対1", "スタミナ"
    ];
    
    // colIdx (0~6) に対応する列内のパラメータを抽出
    const colParams = [];
    for (let r = 0; r < 3; r++) {
        const idx = r * 7 + colIdx;
        if (idx < order.length) {
            colParams.push(order[idx]);
        }
    }
    
    const inputs = colParams.map(s => document.getElementById(`s_prm_${s}`)).filter(el => el !== null);
    const allChecked = inputs.every(el => el.checked);
    
    inputs.forEach(el => {
        el.checked = !allChecked;
    });
};

// ソート用パラメータをすべて選択/解除する関数
window.toggleSortAllParams = (checked) => {
    document.querySelectorAll('input[name="s_prm"]').forEach(el => {
        el.checked = checked;
    });
};

// --- 比較結果の画像出力 ---
window.exportComparisonImage = () => {
    if (typeof html2canvas === 'undefined') {
        alert("画像生成ライブラリが読み込まれていません。通信環境を確認してください。");
        return;
    }

    const exportContainer = document.createElement('div');
    
    // テーブルのクローン作成を先に行う
    const tableClone = document.getElementById('compTable').cloneNode(true);

    // 画像出力用の表示切り替え
    const noExports = tableClone.querySelectorAll('.no-export');
    noExports.forEach(el => el.remove());
    const exportOnlys = tableClone.querySelectorAll('.export-only');
    exportOnlys.forEach(el => el.style.display = 'block');

    // 実際に表示されているカードの列数を確認（1列目は項目名）
    const cardCols = tableClone.querySelectorAll('th').length - 1; 
    const isOneOnOne = (cardCols === 2); // PC/モバイル問わず、2枚なら縦長扱い
    
    if (isOneOnOne) {
        exportContainer.style.width = '900px';
        exportContainer.style.padding = '30px';
    } else {
        exportContainer.style.width = '1200px';
        exportContainer.style.padding = '20px';
    }

    exportContainer.style.position = 'absolute';
    exportContainer.style.top = '-9999px';
    exportContainer.style.left = '-9999px';
    exportContainer.style.background = '#0f172a';
    exportContainer.style.color = '#f1f5f9';
    exportContainer.style.boxSizing = 'border-box';
    exportContainer.style.display = 'flex';
    exportContainer.style.flexDirection = 'column';

    // 左上の空きセルにロゴを挿入
    const firstTh = tableClone.querySelector('th');
    if (firstTh) {
        firstTh.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding: 10px;">
                <img src="icon-192.png" style="width: 72px; height: 72px; border-radius: 12px; margin-bottom: 8px;">
                <div style="font-size:0.9em; color:#94a3b8; font-weight:normal; line-height:1;">powered by traindex</div>
            </div>
        `;
    }

    // スタイルをインラインに固定化
    tableClone.style.width = '100%';
    tableClone.style.borderCollapse = 'collapse';
    tableClone.style.background = '#1e293b';
    tableClone.style.borderRadius = '10px';
    tableClone.style.overflow = 'hidden';

    // 人数に応じた動的スケール調整
    let fontSize = '16px';
    if (!isOneOnOne) {
        if (cardCols >= 6) fontSize = '11px';
        else if (cardCols >= 4) fontSize = '13px';
    } else {
        fontSize = '20px'; 
    }
    tableClone.style.fontSize = fontSize;

    const ths = tableClone.querySelectorAll('th');
    ths.forEach(th => {
        th.style.borderBottom = '2px solid #475569';
        th.style.padding = '10px';
    });

    const tds = tableClone.querySelectorAll('td');
    tds.forEach(td => {
        td.style.borderBottom = '1px solid #334155';
        td.style.borderRight = '1px solid #334155';
        td.style.padding = '10px 5px';
    });

    exportContainer.appendChild(tableClone);
    document.body.appendChild(exportContainer);

    // html2canvas 実行
    html2canvas(exportContainer, {
        backgroundColor: '#0f172a',
        scale: 1,
        useCORS: true
    }).then(canvas => {
        document.body.removeChild(exportContainer);
        const link = document.createElement('a');
        link.download = `traindex_comparison_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }).catch(err => {
        console.error(err);
        alert("画像出力に失敗しました。");
        document.body.removeChild(exportContainer);
    });
};

// --- 国籍ドロップダウン初期化（DBに存在する国のみ抽出） ---
window.initNationSelect = () => {
    const select = document.getElementById('simNationSelect');
    if (!select) return;

    const presentNations = new Set();
    cardsDB.forEach(c => {
        if (c.bonuses && Array.isArray(c.bonuses)) {
            c.bonuses.forEach(b => {
                if (ALL_NATIONS.includes(b.type) || Object.values(NATION_REGIONS).some(arr => arr.includes(b.type))) {
                    presentNations.add(b.type);
                }
            });
        } else if (c.bonus_type) {
            if (ALL_NATIONS.includes(c.bonus_type) || Object.values(NATION_REGIONS).some(arr => arr.includes(c.bonus_type))) {
                presentNations.add(c.bonus_type);
            }
        }
    });

    select.innerHTML = '<option value="">指定なし</option>';

    Object.keys(NATION_REGIONS).forEach(region => {
        const nationsInRegion = NATION_REGIONS[region].filter(n => presentNations.has(n));
        if (nationsInRegion.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = region;
            nationsInRegion.forEach(n => {
                const opt = document.createElement('option');
                opt.value = n;
                opt.innerText = n;
                optgroup.appendChild(opt);
            });
            select.appendChild(optgroup);
        }
    });

    const otherNations = Array.from(presentNations).filter(n => !ALL_NATIONS.includes(n));
    if (otherNations.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = "その他";
        otherNations.forEach(n => {
            const opt = document.createElement('option');
            opt.value = n;
            opt.innerText = n;
            optgroup.appendChild(opt);
        });
        select.appendChild(optgroup);
    }
};

window.selectNation = (nation) => {
    selectedNation = nation || null;
    if (typeof collapseSelection === 'function' && selectedPos && selectedStyle) {
        collapseSelection();
    }
    updateCalc();
};

// --- Admin: 国ボーナスモーダル制御 ---
window.openNationBonusModal = () => {
    const body = document.getElementById('nationBonusModalBody');
    if (!body) return;
    body.innerHTML = '';

    Object.keys(NATION_REGIONS).forEach(region => {
        const regDiv = document.createElement('div');
        regDiv.style.cssText = 'margin-bottom:12px;';
        regDiv.innerHTML = `<div style="font-size:0.75rem; color:var(--primary); font-weight:bold; margin-bottom:6px; border-bottom:1px dashed #334155; padding-bottom:2px;">${region}</div>`;
        
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap:6px;';

        NATION_REGIONS[region].forEach(nation => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-sm';
            btn.style.cssText = 'background:#1e293b; border:1px solid #475569; color:#f1f5f9; padding:6px 4px; font-size:0.75rem;';
            btn.innerText = nation;
            btn.onclick = () => selectNationBonus(nation);
            grid.appendChild(btn);
        });

        regDiv.appendChild(grid);
        body.appendChild(regDiv);
    });

    document.getElementById('nationBonusModal').style.display = 'flex';
};

window.closeNationBonusModal = () => {
    document.getElementById('nationBonusModal').style.display = 'none';
};

window.selectNationBonus = (nation) => {
    addBonusRow(nation, 10);
    closeNationBonusModal();
};

// --- シミュレーター用 国籍選択モーダル制御 ---
window.openSimNationModal = () => {
    const body = document.getElementById('simNationModalBody');
    if (!body) return;
    body.innerHTML = '';

    // 指定なし（解除）ボタン
    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn btn-sm';
    clearBtn.style.cssText = 'background:#334155; color:#fff; width:100%; padding:10px; margin-bottom:15px; font-weight:bold;';
    clearBtn.innerText = '指定なし（国籍ボーナスなし）';
    clearBtn.onclick = () => {
        selectNation('');
        closeSimNationModal();
    };
    body.appendChild(clearBtn);

    // cardsDBにボーナスとして存在する国のみ抽出
    const presentNations = new Set();
    cardsDB.forEach(c => {
        if (c.bonuses && Array.isArray(c.bonuses)) {
            c.bonuses.forEach(b => {
                if (ALL_NATIONS.includes(b.type) || Object.values(NATION_REGIONS).some(arr => arr.includes(b.type))) {
                    presentNations.add(b.type);
                }
            });
        } else if (c.bonus_type) {
            if (ALL_NATIONS.includes(c.bonus_type) || Object.values(NATION_REGIONS).some(arr => arr.includes(c.bonus_type))) {
                presentNations.add(c.bonus_type);
            }
        }
    });

    // 地域ごとに対象国があるエリアのみ表示
    Object.keys(NATION_REGIONS).forEach(region => {
        const nationsInRegion = NATION_REGIONS[region].filter(n => presentNations.has(n));
        
        if (nationsInRegion.length > 0) {
            const regDiv = document.createElement('div');
            regDiv.style.cssText = 'margin-bottom:12px;';
            regDiv.innerHTML = `<div style="font-size:0.75rem; color:var(--primary); font-weight:bold; margin-bottom:6px; border-bottom:1px dashed #334155; padding-bottom:2px;">${region}</div>`;
            
            const grid = document.createElement('div');
            grid.style.cssText = 'display:grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap:6px;';

            nationsInRegion.forEach(nation => {
                const btn = document.createElement('button');
                const isSelected = (selectedNation === nation);
                btn.className = 'btn btn-sm';
                btn.style.cssText = isSelected 
                    ? 'background:var(--accent); border:1px solid var(--accent); color:#fff; padding:6px 4px; font-size:0.75rem; font-weight:bold;'
                    : 'background:#1e293b; border:1px solid #475569; color:#f1f5f9; padding:6px 4px; font-size:0.75rem;';
                btn.innerText = nation;
                btn.onclick = () => {
                    selectNation(nation);
                    closeSimNationModal();
                };
                grid.appendChild(btn);
            });

            regDiv.appendChild(grid);
            body.appendChild(regDiv);
        }
    });

    // 地域定義外でDBにある国があれば「その他」として表示
    const otherNations = Array.from(presentNations).filter(n => !ALL_NATIONS.includes(n));
    if (otherNations.length > 0) {
        const regDiv = document.createElement('div');
        regDiv.style.cssText = 'margin-bottom:12px;';
        regDiv.innerHTML = `<div style="font-size:0.75rem; color:var(--primary); font-weight:bold; margin-bottom:6px; border-bottom:1px dashed #334155; padding-bottom:2px;">その他</div>`;
        
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap:6px;';

        otherNations.forEach(nation => {
            const btn = document.createElement('button');
            const isSelected = (selectedNation === nation);
            btn.className = 'btn btn-sm';
            btn.style.cssText = isSelected 
                ? 'background:var(--accent); border:1px solid var(--accent); color:#fff; padding:6px 4px; font-size:0.75rem; font-weight:bold;'
                : 'background:#1e293b; border:1px solid #475569; color:#f1f5f9; padding:6px 4px; font-size:0.75rem;';
            btn.innerText = nation;
            btn.onclick = () => {
                selectNation(nation);
                closeSimNationModal();
            };
            grid.appendChild(btn);
        });

        regDiv.appendChild(grid);
        body.appendChild(regDiv);
    }

    document.getElementById('simNationModal').style.display = 'flex';
};

window.closeSimNationModal = () => {
    document.getElementById('simNationModal').style.display = 'none';
};

window.selectNation = (nation) => {
    selectedNation = nation || null;
    
    // UIボタンテキストの更新
    const textSpan = document.getElementById('simNationText');
    if (textSpan) {
        textSpan.innerText = selectedNation || '指定なし';
        textSpan.style.color = selectedNation ? 'var(--primary)' : '#fff';
        textSpan.style.fontWeight = selectedNation ? 'bold' : 'normal';
    }

    if (typeof collapseSelection === 'function' && selectedPos && selectedStyle) {
        collapseSelection();
    }
    updateCalc();
};

window.initNationSelect = () => {
    selectNation(selectedNation || '');
};

// --- シミュレーター必須項目 サマリーバッジ描画 ---
window.renderSimTargetSummaryBadges = () => {
    const container = document.getElementById('simTargetBadges');
    if (!container) return;
    container.innerHTML = '';

    const allTargets = [
        ...selectedTargetSkills.map(id => ({ id, type: 'skill' })),
        ...selectedTargetAbilities.map(id => ({ id, type: 'ability' }))
    ];

    if (allTargets.length === 0) {
        container.innerHTML = '<span style="font-size:0.75rem; color:#64748b;">(指定なし)</span>';
        return;
    }

    allTargets.forEach(item => {
        const [name, rarity] = item.id.split('::');
        const isS = (item.type === 'skill');
        const badge = document.createElement('span');
        const rarityClass = `sa-${rarity.toLowerCase()}`;
        badge.className = `tag`;
        badge.style.cssText = 'background:#1e293b; border:1px solid #334155; color:#fff; padding:4px 8px; font-size:0.75rem; display:inline-flex; align-items:center; gap:5px;';
        badge.innerHTML = `
            <span class="sa-badge ${rarityClass}">${isS?'S':'A'}</span>
            <span>${name}</span>
            <i class="fa-solid fa-xmark" style="cursor:pointer; color:#ef4444;" onclick="toggleTarget('${item.type}', '${item.id}')"></i>
        `;
        container.appendChild(badge);
    });
};

// --- シミュレーター用 必須項目指定 タブ＆モーダル制御 ---
let currentSimTargetTab = 'skill'; // 'skill' or 'ability'

window.switchSimTargetTab = (type) => {
    currentSimTargetTab = type;
    
    // タブハイライト
    const btnSkill = document.getElementById('tabBtnSimSkill');
    const btnAbility = document.getElementById('tabBtnSimAbility');
    if (btnSkill) btnSkill.classList.toggle('active', type === 'skill');
    if (btnAbility) btnAbility.classList.toggle('active', type === 'ability');

    // リストコンテンツ表示切り替え
    const skillContent = document.getElementById('simTargetSkillTabContent');
    const abilityContent = document.getElementById('simTargetAbilityTabContent');
    if (skillContent) skillContent.style.display = (type === 'skill') ? 'block' : 'none';
    if (abilityContent) abilityContent.style.display = (type === 'ability') ? 'block' : 'none';

    // 絞り込みパネル内のグループ表示切り替え
    const stGroup = document.getElementById('simSaSkillTypeGroup');
    const cdGroup = document.getElementById('simSaCondGroup');
    if (stGroup) stGroup.style.display = (type === 'skill') ? 'block' : 'none';
    if (cdGroup) cdGroup.style.display = (type === 'ability') ? 'block' : 'none';

    updateAutoComplete();
};

window.openSimTargetModal = () => {
    initSimSaFilterContainers();
    switchSimTargetTab(currentSimTargetTab);
    document.getElementById('simTargetModal').style.display = 'flex';
};

window.closeSimTargetModal = () => {
    document.getElementById('simTargetModal').style.display = 'none';
};

// 旧関数互換エイリアス
window.openMobileTargetModal = window.openSimTargetModal;
window.closeMobileTargetModal = window.closeSimTargetModal;

// --- S/A単体 絞り込みロジック ---
let simSaFilter = {
    rarities: [],
    skillTypes: [],
    conditions: [],
    targetStats: []
};

function checkSaMatchesSimFilter(item, isSkill) {
    const r = item.rarity || 'Gold';

    if (simSaFilter.rarities.length > 0 && !simSaFilter.rarities.includes(r)) return false;

    if (isSkill && simSaFilter.skillTypes.length > 0) {
        if (!item.skill_type || !simSaFilter.skillTypes.includes(item.skill_type)) return false;
    }

    if (!isSkill && simSaFilter.conditions.length > 0) {
        if (!item.condition || !simSaFilter.conditions.includes(item.condition)) return false;
    }

    if (simSaFilter.targetStats.length > 0) {
        let statsInSa = [];
        if (isSkill && item.params) {
            statsInSa = item.params.map(p => p.stat);
        } else if (!isSkill && item.targets) {
            statsInSa = item.targets;
        }
        const hasStat = simSaFilter.targetStats.some(st => statsInSa.includes(st));
        if (!hasStat) return false;
    }

    return true;
}

function initSimSaFilterContainers() {
    // スキルタイプ
    const stSet = new Set();
    skillsDB.forEach(s => { if (s.skill_type) stSet.add(s.skill_type); });
    const stContainer = document.getElementById('simSaSkillTypeContainer');
    if (stContainer && stContainer.children.length === 0) {
        Array.from(stSet).forEach((st, idx) => {
            const id = `ssast_${idx}`;
            const div = document.createElement('div');
            div.className = 'chk-btn';
            div.innerHTML = `<input type="checkbox" name="sim_sast" value="${st}" id="${id}" onchange="applySimSaFilter()"><label for="${id}">${st}</label>`;
            stContainer.appendChild(div);
        });
    }

    // 発動条件
    const cdSet = new Set();
    abilitiesDB.forEach(a => { if (a.condition) cdSet.add(a.condition); });
    const cdContainer = document.getElementById('simSaCondContainer');
    if (cdContainer && cdContainer.children.length === 0) {
        Array.from(cdSet).forEach((cd, idx) => {
            const id = `ssacd_${idx}`;
            const div = document.createElement('div');
            div.className = 'chk-btn';
            div.innerHTML = `<input type="checkbox" name="sim_sacd" value="${cd}" id="${id}" onchange="applySimSaFilter()"><label for="${id}">${cd}</label>`;
            cdContainer.appendChild(div);
        });
    }

    // 上昇パラメータ
    const paramContainer = document.getElementById('simSaParamContainer');
    if (paramContainer && paramContainer.children.length === 0) {
        const order = [
            "決定力", "ショートパス", "突破力", "タックル", "セービング", "ジャンプ", "走力",
            "キック力", "ロングパス", "キープ力", "パスカット", "反応速度", "コンタクト", "敏捷性",
            "冷静さ", "キック精度", "ボールタッチ", "マーク", "1対1", "スタミナ"
        ];
        order.forEach(s => {
            const div = document.createElement('div');
            div.className = 'chk-btn param';
            const id = `ssap_${s}`;
            div.innerHTML = `<input type="checkbox" name="sim_saparam" value="${s}" id="${id}" onchange="applySimSaFilter()"><label for="${id}">${s}</label>`;
            paramContainer.appendChild(div);
        });
    }
}

window.toggleSimSaFilterPanel = () => {
    const panel = document.getElementById('simSaFilterPanel');
    const btn = document.getElementById('btnToggleSimSaFilter');
    const skillContainer = document.getElementById('skillTargetContainer');
    const abilityContainer = document.getElementById('abilityTargetContainer');

    if (panel) {
        const isOpening = !panel.classList.contains('open');
        panel.classList.toggle('open', isOpening);
        
        if (btn) {
            btn.classList.toggle('active', isOpening);
            if (isOpening) {
                btn.innerHTML = '<i class="fa-solid fa-xmark"></i> 閉じる';
                btn.style.background = '#ef4444';
                btn.style.borderColor = '#ef4444';
                btn.style.color = '#fff';
            } else {
                btn.innerHTML = '<i class="fa-solid fa-filter"></i> 絞り込み';
                btn.style.background = '#334155';
                btn.style.borderColor = '#475569';
                btn.style.color = '#fff';
            }
        }

        // 絞り込みパネルの開閉状態を要素に反映
        if (skillContainer) skillContainer.classList.toggle('compact-view', isOpening);
        if (abilityContainer) abilityContainer.classList.toggle('compact-view', isOpening);
    }
};

window.applySimSaFilter = () => {
    const getChecks = (name) => {
        const arr = [];
        document.querySelectorAll(`input[name="${name}"]:checked`).forEach(el => arr.push(el.value));
        return arr;
    };

    simSaFilter = {
        rarities: getChecks('sim_sar'),
        skillTypes: getChecks('sim_sast'),
        conditions: getChecks('sim_sacd'),
        targetStats: getChecks('sim_saparam')
    };

    updateAutoComplete();
};

window.resetSimSaFilter = () => {
    document.querySelectorAll('#simSaFilterPanel input[type="checkbox"]').forEach(el => el.checked = false);
    simSaFilter = { rarities: [], skillTypes: [], conditions: [], targetStats: [] };
    updateAutoComplete();
};

// --- 【新規追加】管理画面 スキル/アビリティサブタブ切替 & ボタンチップ制御 ---
let currentAdminSaTab = 'skill';

window.switchAdminSaTab = (tab) => {
    currentAdminSaTab = tab;
    
    const btnSkill = document.getElementById('btnAdminSaTabSkill');
    const btnAbility = document.getElementById('btnAdminSaTabAbility');
    if (btnSkill) btnSkill.classList.toggle('active', tab === 'skill');
    if (btnAbility) btnAbility.classList.toggle('active', tab === 'ability');

    const skillForm = document.getElementById('skillAdminForm');
    const abilityForm = document.getElementById('abilityAdminForm');
    if (skillForm) skillForm.style.display = (tab === 'skill') ? 'block' : 'none';
    if (abilityForm) abilityForm.style.display = (tab === 'ability') ? 'block' : 'none';
};

// ボタンチップの単一選択
window.selectSaBtnChip = (btn) => {
    const group = btn.dataset.group;
    document.querySelectorAll(`.sa-btn-chip[data-group="${group}"]`).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
};

// ボタンチップの複数選択トグル
window.toggleSaBtnChipMulti = (btn) => {
    btn.classList.toggle('active');
};

// 選択されたボタンの値を取得
function getSaBtnChipVal(group) {
    const active = document.querySelector(`.sa-btn-chip[data-group="${group}"].active`);
    return active ? active.dataset.val : "";
}

function getSaBtnChipMultiVals(group) {
    const actives = document.querySelectorAll(`.sa-btn-chip[data-group="${group}"].active`);
    return Array.from(actives).map(b => b.dataset.val);
}

function setSaBtnChipVal(group, val) {
    document.querySelectorAll(`.sa-btn-chip[data-group="${group}"]`).forEach(b => {
        b.classList.toggle('active', b.dataset.val === (val || ""));
    });
}

function setSaBtnChipMultiVals(group, vals = []) {
    document.querySelectorAll(`.sa-btn-chip[data-group="${group}"]`).forEach(b => {
        b.classList.toggle('active', vals.includes(b.dataset.val));
    });
}

// カスタムシチュエーション候補の追加
window.addCustomSituationCandidate = () => {
    const input = document.getElementById('saCustomSituationInput');
    const val = input ? input.value.trim() : "";
    if (!val) return;

    const group = document.getElementById('saSituationBtnGroup');
    if (!group) return;

    const exists = Array.from(group.querySelectorAll('.sa-btn-chip')).some(b => b.dataset.val === val);
    if (!exists) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm sa-btn-chip active';
        btn.dataset.group = 'saSituation';
        btn.dataset.val = val;
        btn.innerText = val;
        btn.onclick = function() { selectSaBtnChip(this); };
        
        group.querySelectorAll('.sa-btn-chip').forEach(b => b.classList.remove('active'));
        group.appendChild(btn);
    } else {
        setSaBtnChipVal('saSituation', val);
    }
    input.value = '';
};

function addCustomSituationCandidateWithVal(val) {
    const input = document.getElementById('saCustomSituationInput');
    if (input) input.value = val;
    addCustomSituationCandidate();
}

// パスターゲットモード切替
let currentPassTargetMode = 'none';
window.setPassTargetMode = (mode) => {
    currentPassTargetMode = mode;
    ['None', 'Pos', 'Area'].forEach(m => {
        const btn = document.getElementById(`btnPassTargetMode${m}`);
        if (btn) btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`btnPassTargetMode${mode.charAt(0).toUpperCase() + mode.slice(1)}`);
    if (activeBtn) activeBtn.classList.add('active');

    const posArea = document.getElementById('passTargetPosArea');
    const gridArea = document.getElementById('passTargetGridArea');
    if (posArea) posArea.style.display = (mode === 'pos') ? 'block' : 'none';
    if (gridArea) gridArea.style.display = (mode === 'area') ? 'block' : 'none';
};

// --- 【新規追加】スキル種類マスターリスト & パラメータ選択ダイアログ制御 ---
const ALL_SKILL_TYPES = [
    "シュート", "ダイレクトシュート", "ロングシュート", "直接FK", 
    "トラップ", "ドリブル", "ショートパス", "ロングパス", "クロス", 
    "パス", "パスを届けるFK", "タックル", "パスカット", "GKセーブ"
];

// --- 【書き換え対象】renderSkillTypeBtnChips & addCustomSituationCandidate ---
function renderSkillTypeBtnChips() {
    const groups = [
        { id: 'saSkillTypeBtnGroup', groupName: 'saSkillType', prefix: '', isMulti: false },
        { id: 'saAddEffectBtnGroup', groupName: 'saAddEffect', prefix: '誘発: ', isMulti: true },
        { id: 'saPassPrioritySkillGroup', groupName: 'saPassPriority', prefix: '優先: ', isMulti: true }
    ];

    groups.forEach(g => {
        const container = document.getElementById(g.id);
        if (!container) return;
        container.innerHTML = '';

        ALL_SKILL_TYPES.forEach((st, idx) => {
            const btn = document.createElement('button');
            btn.className = `btn btn-sm sa-btn-chip ${(!g.isMulti && idx === 0) ? 'active' : ''}`;
            btn.dataset.group = g.groupName;
            btn.dataset.val = st;
            btn.innerText = `${g.prefix}${st}`;
            btn.onclick = function() { 
                if (g.isMulti) {
                    toggleSaBtnChipMulti(this);
                } else {
                    selectSaBtnChip(this);
                }
            };
            container.appendChild(btn);
        });
    });
}

// カスタムシチュエーション候補の追加 (複数選択対応)
window.addCustomSituationCandidate = () => {
    const input = document.getElementById('saCustomSituationInput');
    const val = input ? input.value.trim() : "";
    if (!val) return;

    const group = document.getElementById('saSituationBtnGroup');
    if (!group) return;

    const exists = Array.from(group.querySelectorAll('.sa-btn-chip')).some(b => b.dataset.val === val);
    if (!exists) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm sa-btn-chip active';
        btn.dataset.group = 'saSituation';
        btn.dataset.val = val;
        btn.innerText = val;
        btn.onclick = function() { toggleSaBtnChipMulti(this); };
        group.appendChild(btn);
    } else {
        const btn = Array.from(group.querySelectorAll('.sa-btn-chip')).find(b => b.dataset.val === val);
        if (btn) btn.classList.add('active');
    }
    input.value = '';
};

// パラメータ選択ダイアログ制御
let currentEditingParamBtn = null;

window.openParamSelectDialog = (btnEl) => {
    currentEditingParamBtn = btnEl;
    const container = document.getElementById('saParamSelectGrid');
    if (container && container.children.length === 0) {
        container.innerHTML = '';
        const order = [
            "決定力", "ショートパス", "突破力", "タックル", "セービング", "ジャンプ", "走力",
            "キック力", "ロングパス", "キープ力", "パスカット", "反応速度", "コンタクト", "敏捷性",
            "冷静さ", "キック精度", "ボールタッチ", "マーク", "1対1", "スタミナ"
        ];
        order.forEach(s => {
            const div = document.createElement('div');
            div.className = 'chk-btn param';
            div.innerHTML = `<label style="padding:10px 2px; font-size:0.75rem;" onclick="selectParamFromDialog('${s}')">${s}</label>`;
            container.appendChild(div);
        });
    }
    document.getElementById('skillParamSelectModal').style.display = 'flex';
};

window.closeParamSelectDialog = () => {
    document.getElementById('skillParamSelectModal').style.display = 'none';
    currentEditingParamBtn = null;
};

window.selectParamFromDialog = (statName) => {
    if (currentEditingParamBtn) {
        currentEditingParamBtn.innerText = statName;
        currentEditingParamBtn.dataset.stat = statName;
        currentEditingParamBtn.style.color = '#fff';
        currentEditingParamBtn.style.fontWeight = 'bold';
    }
    closeParamSelectDialog();
};