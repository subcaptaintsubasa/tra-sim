// --- core_logic.js ---

/**
 * カードの特定レベルにおけるステータスを算出
 */
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
    
    const simPos = selectedPos;
    const simStyle = selectedStyle;
    
    if (!simPos || !simStyle) {
        return alert("ポジションとスタイルを選択してください。");
    }

    // 安全に値を取得するヘルパー
    const getVal = (id, defaultVal = 0) => {
        const el = document.getElementById(id);
        return el ? el.value : defaultVal;
    };

    const conditionMod = parseFloat(getVal('conditionMod', 1.0));
    const isGK = (simPos === 'GK');

    // 1. 所持済みカードの有効ステータスを事前に計算
    const ownedCards = cardsDB.map((c, idx) => {
        const k = c.name + "_" + c.title;
        const inv = myCards[k];
        if (!inv || !inv.owned) return null;
        
        const rawVals = getCardStatsAtLevel(c, parseInt(inv.level), simPos, simStyle, conditionMod);
        const filteredVals = {};
        for (let s in rawVals) {
            if (isGK && DEF_STATS.includes(s)) continue;
            if (!isGK && GK_STATS.includes(s)) continue;
            filteredVals[s] = rawVals[s];
        }

        return { id: idx, original: c, vals: filteredVals };
    }).filter(x => x !== null);

    if(ownedCards.length === 0) return alert("所持カードが選択されていません。「所持カード」タブで設定してください。");

    // 2. ターゲット（必須項目）と目標Gapの整理
    const targetPct = parseInt(getVal('targetPct', 100)) / 100;
    const allTargets = [...selectedTargetSkills, ...selectedTargetAbilities];
    
    const gaps = {};
    const relevantStats = isGK ? STATS.filter(s => !DEF_STATS.includes(s)).concat(GK_STATS) : STATS;

    relevantStats.forEach(s => {
        const now = parseFloat(getVal(`now_${s}`, 0)) || 0;
        const max = parseFloat(getVal(`max_${s}`, 0)) || 0;
        gaps[s] = (max > 0) ? Math.max(0, max - now) * targetPct : 999999;
    });

    const getScore = (sums) => {
        let sc = 0; 
        relevantStats.forEach(s => {
            sc += Math.min((sums[s]||0)/10, gaps[s]);
        }); 
        return sc;
    };

    // 3. ビームサーチによる探索
    const WIDTH = 300;
    let beam = [{ idxs: [], sums: {}, score: 0, covered: new Set() }];

    for(let step = 0; step < 6; step++) {
        let next = [];
        for(const node of beam) {
            for(const card of ownedCards) {
                const nSums = { ...node.sums };
                for(const s in card.vals) nSums[s] = (nSums[s]||0) + card.vals[s];
                
                const nCovered = new Set(node.covered);
                if(card.original.abilities) {
                    card.original.abilities.forEach(a => {
                        if(allTargets.includes(a)) nCovered.add(a);
                    });
                }

                next.push({ 
                    idxs: [...node.idxs, card.id], 
                    sums: nSums, 
                    score: getScore(nSums),
                    covered: nCovered
                });
            }
        }
        next.sort((a,b) => {
            if(a.covered.size !== b.covered.size) return b.covered.size - a.covered.size;
            return b.score - a.score;
        });
        beam = next.slice(0, WIDTH);
    }

    if(beam.length > 0) {
        const best = beam[0];
        selectedSlots = best.idxs.map(i => cardsDB[i]);
        if (typeof updateCalc === 'function') updateCalc();
        
        if (allTargets.length > 0 && best.covered.size < allTargets.length) {
            alert(`最適化完了。注意：一部の必須項目を埋めることができませんでした。`);
        } else {
            alert(`最適化完了！ (スコア: ${best.score.toFixed(1)})`);
        }
    }
};