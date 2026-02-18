// --- 計算コアロジック ---

function getCardStatsAtLevel(card, level, targetPos, targetStyle, conditionMult) {
    const maxLevel = card.rarity === 'SSR' ? 50 : 45;
    const useLevel = Math.max(1, Math.min(maxLevel, level));
    
    let bonusTotal = 0;
    if (card.bonus_type) {
        if (card.bonus_type === targetPos || card.bonus_type === targetStyle) {
            bonusTotal += (card.bonus_value || 0);
        }
    }
    if (card.bonuses && Array.isArray(card.bonuses)) {
        card.bonuses.forEach(b => {
            if (b.type === targetPos || b.type === targetStyle) {
                bonusTotal += b.value;
            }
        });
    }
    
    const bonusMult = 1 + (bonusTotal / 100);
    const result = {};

    for (let s in card.stats) {
        const d1 = card.stats[s];
        if (!d1) continue;

        const d1_int = Math.round(d1 * 10);
        const N = Math.round(d1 * 6);
        
        const growthMax = (N * 10 - d1_int);
        const growthCurrent = Math.floor(growthMax * (useLevel - 1) / (maxLevel - 1));
        const vBase_x10 = d1_int + growthCurrent;
        const val_x10 = Math.round(vBase_x10 * conditionMult * bonusMult);
        
        result[s] = val_x10;
    }
    return result;
}

// --- オート編成 (最適化アルゴリズム) ---
window.runAutoSim = () => {
    if(cardsDB.length === 0) return alert("カードデータがありません。");
    
    const simPos = document.getElementById('simPos').value;
    const simStyle = document.getElementById('simStyle').value;
    const conditionMod = parseFloat(document.getElementById('conditionMod').value);
    const isGK = (simPos === 'GK');

    // 所持済みカードのみを抽出
    const ownedCards = cardsDB.map((c, idx) => {
        const k = c.name + "_" + c.title;
        const inv = myCards[k];
        if (!inv || !inv.owned) return null;
        
        // ポジションに応じて不要なステータスを計算対象から除外した値を保持
        const rawVals = getCardStatsAtLevel(c, parseInt(inv.level), simPos, simStyle, conditionMod);
        const filteredVals = {};
        for (let s in rawVals) {
            if (isGK && DEF_STATS.includes(s)) continue;
            if (!isGK && GK_STATS.includes(s)) continue;
            filteredVals[s] = rawVals[s];
        }

        return {
            id: idx,
            original: c,
            vals: filteredVals
        };
    }).filter(x => x !== null);

    if(ownedCards.length === 0) return alert("所持カードが選択されていません。「所持カード」タブで設定してください。");

    const targetSkill = document.getElementById('targetSkillInput').value;
    const targetPct = parseInt(document.getElementById('targetPct').value) / 100;
    
    // ターゲットステータス（Gap）の整理
    const gaps = {};
    const relevantStats = isGK ? STATS.filter(s => !DEF_STATS.includes(s)).concat(GK_STATS) : STATS;

    relevantStats.forEach(s => {
        const now = parseFloat(document.getElementById(`now_${s}`).value) || 0;
        const max = parseFloat(document.getElementById(`max_${s}`).value) || 0;
        gaps[s] = (max > 0) ? Math.max(0, max - now) * targetPct : 999999;
    });

    const getScore = (sums) => {
        let sc = 0; 
        relevantStats.forEach(s => {
            sc += Math.min((sums[s]||0)/10, gaps[s]);
        }); 
        return sc;
    };

    let candidateRoots = [];
    if (targetSkill) {
        // スキル保持者を検索
        const skillHolders = ownedCards.filter(c => c.original.abilities && c.original.abilities.includes(targetSkill));
        if (skillHolders.length === 0) return alert(`スキル「${targetSkill}」を持つ所持カードがありません。`);
        
        skillHolders.forEach(holder => {
            candidateRoots.push({
                fixed: [holder],
                pool: ownedCards
            });
        });
    } else {
        candidateRoots.push({ fixed: [], pool: ownedCards });
    }

    let bestResult = null;
    let maxScore = -1;

    candidateRoots.forEach(root => {
        let beam = [{ idxs: root.fixed.map(x=>x.id), sums: {}, score: 0 }];
        
        if(root.fixed.length > 0) {
             root.fixed.forEach(f => {
                 for(let s in f.vals) beam[0].sums[s] = (beam[0].sums[s]||0) + f.vals[s];
             });
             beam[0].score = getScore(beam[0].sums);
        }

        const slotsToFill = 6 - root.fixed.length;
        const WIDTH = 500;

        for(let step=0; step < slotsToFill; step++) {
            let next = [];
            for(const node of beam) {
                for(const card of root.pool) {
                    // 同一カードの重複制限を解除 (node.idxs.includes のチェックを削除)
                    const nSums = { ...node.sums };
                    for(const s in card.vals) nSums[s] = (nSums[s]||0) + card.vals[s];
                    
                    next.push({ 
                        idxs: [...node.idxs, card.id], 
                        sums: nSums, 
                        score: getScore(nSums) 
                    });
                }
            }
            next.sort((a,b) => b.score - a.score);
            beam = next.slice(0, WIDTH);
        }

        if(beam.length > 0 && beam[0].score > maxScore) {
            maxScore = beam[0].score;
            bestResult = beam[0];
        }
    });

    if(bestResult) {
        selectedSlots = bestResult.idxs.map(i => cardsDB[i]);
        if (typeof updateCalc === 'function') updateCalc();
        alert(`最適化完了 (スコア: ${maxScore.toFixed(1)})`);
    } else {
        alert("有効な組み合わせが見つかりませんでした。");
    }
};