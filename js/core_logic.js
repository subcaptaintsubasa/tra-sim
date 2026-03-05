function getCardStatsAtLevel(card, level, targetPos, targetStyle, conditionMult) {
    const maxLevel = card.rarity === 'SSR' ? 50 : 45;
    const useLevel = Math.max(1, Math.min(maxLevel, level));
    const growthRate = card.growth_rate || 6;
    
    let bonusTotal = 0;

    // ★修正: ターゲットポジションに対応するボーナス群を取得
    // targetPos="LM" なら validPosBonuses=["LM", "WM", "SM"] となる
    let validPosBonuses = [targetPos];
    if (targetPos && typeof POS_BONUS_MAPPING !== 'undefined' && POS_BONUS_MAPPING[targetPos]) {
        validPosBonuses = validPosBonuses.concat(POS_BONUS_MAPPING[targetPos]);
    }

    // ボーナス計算
    if (card.bonuses && Array.isArray(card.bonuses) && card.bonuses.length > 0) {
        card.bonuses.forEach(b => {
            // 定義されたポジション群、またはスタイルが一致すれば加算
            if (validPosBonuses.includes(b.type) || b.type === targetStyle) {
                bonusTotal += b.value;
            }
        });
    } else if (card.bonus_type) {
        if (validPosBonuses.includes(card.bonus_type) || card.bonus_type === targetStyle) {
            bonusTotal += (card.bonus_value || 0);
        }
    }
    
    const bonusMult = 1 + (bonusTotal / 100);
    const result = {};

    for (let s in card.stats) {
        const d1 = card.stats[s];
        if (!d1) continue;

        const d1_int = Math.round(d1 * 10);
        const N = Math.round(d1 * growthRate);
        const growthMax = (N * 10 - d1_int);
        const growthCurrent = Math.floor(growthMax * (useLevel - 1) / (maxLevel - 1));
        const vBase_x10 = d1_int + growthCurrent;
        const val_x10 = Math.round(vBase_x10 * conditionMult * bonusMult);
        
        result[s] = val_x10;
    }
    return result;
}

// 重み取得ヘルパー
function getStatWeight(statName, mode, playStyle) {
    if (mode === 'balanced') return 1.0;
    if (mode === 'ovr') {
        const styleIcon = STYLE_ICONS[playStyle];
        const weights = OVR_WEIGHTS[styleIcon];
        return (weights && weights[statName] !== undefined) ? weights[statName] : 0;
    }
    if (mode === 'custom') {
        const idx = customWeightsOrder.indexOf(statName);
        if (idx === 0) return 10.0;
        if (idx === 1) return 8.0;
        if (idx === 2) return 6.0;
        if (idx === 3) return 4.0;
        if (idx === 4) return 2.0;
        return 1.0;
    }
    return 1.0;
}

window.runAutoSim = () => {
    if(cardsDB.length === 0) return alert("カードデータがありません。");
    
    const simPos = selectedPos;
    const simStyle = selectedStyle;
    if (!simPos || !simStyle) return alert("ポジションとスタイルを選択してください。");

    // 設定値取得
    const conditionMod = parseFloat(document.getElementById('conditionMod').value || 1.0);
    const targetPct = (parseInt(document.getElementById('targetPct').value) || 100) / 100;
    localStorage.setItem('tra_sim_target_pct', document.getElementById('targetPct').value);

    const isGK = (simPos === 'GK');
    const relevantStats = isGK 
        ? STATS.filter(s => !DEF_STATS.includes(s)).concat(GK_STATS) 
        : STATS;

    // 1. 候補カードのリストアップ
    const candidateCards = [];
    cardsDB.forEach((c, idx) => {
        const k = c.name + "_" + c.title;
        const inv = myCards[k];
        if (inv && inv.owned) {
            const rawVals = getCardStatsAtLevel(c, parseInt(inv.level), simPos, simStyle, conditionMod);
            const vals = {};
            relevantStats.forEach(s => { if (rawVals[s]) vals[s] = rawVals[s]; });
            
            candidateCards.push({
                originalIndex: idx,
                original: c,
                vals: vals,
                skillIds: (c.abilities||[]).map(ab => {
                    const n = (typeof ab === 'object') ? ab.name : ab;
                    const r = (typeof ab === 'object') ? ab.rarity : (c.rarity==='SSR'?'Gold':'Silver');
                    return `${n}::${r}`;
                })
            });
        }
    });

    if(candidateCards.length === 0) return alert("所持カードがありません。");

    // 2. 目標(Gap)と重み(Weight)の計算
    const gaps = {};
    const weights = {}; 

    relevantStats.forEach(s => {
        const now = (parseFloat(document.getElementById(`now_${s}`).value) || 0) * 10; 
        const max = (parseFloat(document.getElementById(`max_${s}`).value) || 0) * 10;
        let gap = 0;
        if (max > 0) gap = Math.max(0, (max * targetPct) - now);
        gaps[s] = gap;
        weights[s] = getStatWeight(s, currentSimMode, simStyle);
    });

    const calculateScore = (currentSums) => {
        let score = 0;
        relevantStats.forEach(s => {
            const gain = currentSums[s] || 0;
            const gap = gaps[s];
            const effectiveGain = Math.min(gain, gap);
            score += effectiveGain * weights[s];
        });
        return score;
    };

    // 3. ビームサーチ実行
    const BEAM_WIDTH = 200;
    let beam = [{ indices: [], sums: {}, score: 0, skillSet: new Set() }];

    for (let slot = 0; slot < 6; slot++) {
        let nextBeam = [];
        for (const node of beam) {
            for (let i = 0; i < candidateCards.length; i++) {
                const card = candidateCards[i];
                const newSums = { ...node.sums };
                for (const s in card.vals) newSums[s] = (newSums[s] || 0) + card.vals[s];
                const newSkillSet = new Set(node.skillSet);
                card.skillIds.forEach(id => newSkillSet.add(id));
                const newScore = calculateScore(newSums);

                nextBeam.push({
                    indices: [...node.indices, i],
                    sums: newSums,
                    score: newScore,
                    skillSet: newSkillSet
                });
            }
        }
        nextBeam.sort((a, b) => b.score - a.score);
        beam = nextBeam.slice(0, BEAM_WIDTH);
    }

    if (beam.length > 0) {
        const bestNode = beam[0];
        selectedSlots = bestNode.indices.map(idx => candidateCards[idx].original);
        updateCalc();
        const modeName = currentSimMode === 'balanced' ? 'バランス' : (currentSimMode === 'ovr' ? '総合値重視' : 'カスタム特化');
        alert(`【${modeName}モード】最適化完了\n評価スコア: ${bestNode.score.toFixed(0)}`);
    } else {
        alert("有効な組み合わせが見つかりませんでした。");
    }
};