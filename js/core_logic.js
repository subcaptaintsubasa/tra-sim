// --- 計算コアロジック ---

/**
 * カードの特定レベルにおけるステータスを算出
 * @param {Object} card - カードデータ
 * @param {number} level - 現在レベル
 * @param {string} targetPos - 育成ポジション
 * @param {string} targetStyle - 育成プレイスタイル
 * @param {number} conditionMult - コンディション倍率
 */
function getCardStatsAtLevel(card, level, targetPos, targetStyle, conditionMult) {
    const maxLevel = card.rarity === 'SSR' ? 50 : 45;
    const useLevel = Math.max(1, Math.min(maxLevel, level));
    
    let bonusTotal = 0;
    // 互換性維持: 旧データ形式(bonus_type)と新データ形式(bonuses配列)の両方をチェック
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
        
        // 四捨五入のタイミングはゲーム仕様に準拠（x10で計算して整数化）
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

        return {
            id: idx,
            original: c,
            vals: filteredVals
        };
    }).filter(x => x !== null);

    if(ownedCards.length === 0) return alert("所持カードが選択されていません。「所持カード」タブで設定してください。");

    // 2. ターゲット（必須項目）と目標Gapの整理
    const targetPct = parseInt(document.getElementById('targetPct').value) / 100;
    const allTargets = [...selectedTargetSkills, ...selectedTargetAbilities];
    
    const gaps = {};
    const relevantStats = isGK ? STATS.filter(s => !DEF_STATS.includes(s)).concat(GK_STATS) : STATS;

    relevantStats.forEach(s => {
        const now = parseFloat(document.getElementById(`now_${s}`).value) || 0;
        const max = parseFloat(document.getElementById(`max_${s}`).value) || 0;
        gaps[s] = (max > 0) ? Math.max(0, max - now) * targetPct : 999999;
    });

    // スコア計算用：Gapを埋めるほど加点（過剰分は加点しない）
    const getScore = (sums) => {
        let sc = 0; 
        relevantStats.forEach(s => {
            sc += Math.min((sums[s]||0)/10, gaps[s]);
        }); 
        return sc;
    };

    // 3. ビームサーチによる探索
    // WIDTHを広げると精度が上がるが重くなる
    const WIDTH = 300;
    let beam = [{ idxs: [], sums: {}, score: 0, covered: new Set() }];

    for(let step = 0; step < 6; step++) {
        let next = [];
        for(const node of beam) {
            for(const card of ownedCards) {
                // 重複選択を許容する仕様
                const nSums = { ...node.sums };
                for(const s in card.vals) nSums[s] = (nSums[s]||0) + card.vals[s];
                
                // カバーしているターゲットを更新
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
        
        // ソート：1.カバーしているターゲット数が多い順 2.ステータススコアが高い順
        next.sort((a,b) => {
            if(a.covered.size !== b.covered.size) return b.covered.size - a.covered.size;
            return b.score - a.score;
        });
        
        // 同一の組み合わせ（カード順不同）を間引く場合はここで処理するが、今回はシンプルにWIDTHでカット
        beam = next.slice(0, WIDTH);
    }

    // 4. 結果の適用
    if(beam.length > 0) {
        const best = beam[0];
        selectedSlots = best.idxs.map(i => cardsDB[i]);
        if (typeof updateCalc === 'function') updateCalc();
        
        if (allTargets.length > 0 && best.covered.size < allTargets.length) {
            const missingCount = allTargets.length - best.covered.size;
            alert(`最適化完了。注意：必須項目のうち ${missingCount}個 を埋めることができませんでした。 (スコア: ${best.score.toFixed(1)})`);
        } else {
            alert(`最適化完了！ (スコア: ${best.score.toFixed(1)})`);
        }
    } else {
        alert("有効な組み合わせが見つかりませんでした。");
    }
};