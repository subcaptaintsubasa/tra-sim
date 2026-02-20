// --- データ取得・初期化 ---
async function fetchAllDB() {
    const ts = Date.now(), base = './data';
    try {
        const [c, s, a] = await Promise.all([ 
            fetch(`${base}/cards.json?t=${ts}`), 
            fetch(`${base}/skills.json?t=${ts}`), 
            fetch(`${base}/abilities.json?t=${ts}`) 
        ]);
        
        if(c.ok) cardsDB = await c.json(); 
        if(s.ok) skillsDB = await s.json(); 
        if(a.ok) abilitiesDB = await a.json();
        
        if (typeof renderCardList === 'function') renderCardList(); 
        if (typeof renderInventory === 'function') renderInventory(); 
        if (typeof renderSAList === 'function') renderSAList(); 
        if (typeof updateAutoComplete === 'function') updateAutoComplete(); 
        if (typeof updateCalc === 'function') updateCalc();
        
    } catch(e) { console.error(e); }
}

// --- インベントリ管理 ---
function saveInv() { 
    localStorage.setItem('tra_my_cards', JSON.stringify(myCards)); 
}

window.toggleOwn = (key, checked) => {
    if(!myCards[key]) myCards[key] = { level: 50 };
    myCards[key].owned = checked;
    saveInv(); 
    if (typeof renderInventory === 'function') renderInventory();
};

window.updateOwnLvl = (key, lvl) => {
    if(!myCards[key]) myCards[key] = { owned: true };
    myCards[key].level = lvl;
    saveInv();
};

window.invSetAll = (owned) => {
    cardsDB.forEach(c => {
        const key = c.name+"_"+c.title;
        const maxL = c.rarity==='SSR'?50:45;
        myCards[key] = { owned: owned, level: maxL };
    });
    saveInv(); 
    if (typeof renderInventory === 'function') renderInventory();
};

// --- GitHub API連携 ---
async function pushToGH(file, data, msg, rawContent = null) {
    const token = document.getElementById('ghToken').value;
    const repo = document.getElementById('ghRepo').value;
    
    if(!token || !repo) { 
        alert("GitHub設定が必要です"); 
        return false; 
    }
    
    // pathの調整: 通常は data/ だが、../ で始まる場合はルートからのパスとして扱う
    let path = `data/${file}`;
    if (file.startsWith('../')) {
        path = file.replace('../', '');
    }

    const url = `https://api.github.com/repos/${repo}/contents/${path}`;
    
    try {
        // 1. 既存ファイルのSHAを取得 (上書き用)
        const g = await fetch(url, { headers:{'Authorization':`token ${token}`} });
        const sha = g.ok ? (await g.json()).sha : null;
        
        // 2. コンテンツの準備
        // rawContent(Base64文字列)があればそれを優先、なければdata(JSON)をエンコード
        const content = rawContent 
            ? rawContent 
            : btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
            
        // 3. PUTリクエスト
        const res = await fetch(url, { 
            method:'PUT', 
            headers:{
                'Authorization':`token ${token}`,
                'Content-Type': 'application/json'
            }, 
            body: JSON.stringify({ 
                message: msg, 
                sha: sha, 
                content: content 
            }) 
        });
        
        return res.ok;
    } catch(e) { 
        console.error(e); 
        return false; 
    }
}

// --- カード保存 ---
async function saveCardToGH() {
    const name = document.getElementById('editName').value;
    const title = document.getElementById('editTitle').value; 
    if(!name) return;
    const stats={}; 
    document.querySelectorAll('.edit-val').forEach(i => {
        if(i.value) stats[i.dataset.stat] = parseFloat(i.value);
    });
    const bonuses = [];
    const rows = document.querySelectorAll('#editBonusList > div');
    rows.forEach(r => {
        const t = r.querySelector('.edit-b-type').value;
        const v = parseFloat(r.querySelector('.edit-b-val').value);
        if(t && v) bonuses.push({ type: t, value: v });
    });
    const legacyType = bonuses.length > 0 ? bonuses[0].type : "";
    const legacyVal = bonuses.length > 0 ? bonuses[0].value : 0;
    const nc = { 
        title, name, rarity: document.getElementById('editRarity').value, 
        bonuses: bonuses, bonus_type: legacyType, bonus_value: legacyVal,
        abilities: [document.getElementById('editAbilityName').value], stats 
    };
    const i = cardsDB.findIndex(x => x.name === name && x.title === title); 
    if(i >= 0) cardsDB[i] = nc; else cardsDB.push(nc);
    if(await pushToGH('cards.json', cardsDB, "Update Card")) { 
        alert("保存成功"); renderCardList(); renderInventory(); 
    }
}

async function deleteCard(idx) { 
    if(!confirm("削除しますか？")) return; 
    cardsDB.splice(idx,1); 
    await pushToGH('cards.json', cardsDB, "Delete Card"); 
    renderCardList(); renderInventory(); 
}

async function batchRegisterCards() { 
    try { 
        const d = JSON.parse(document.getElementById('aiPasteCard').value); 
        (Array.isArray(d) ? d : [d]).forEach(c => {
            const i = cardsDB.findIndex(x => x.name === c.name && x.title === c.title); 
            if(i >= 0) cardsDB[i] = c; else cardsDB.push(c);
        }); 
        await pushToGH('cards.json', cardsDB, "Bulk Update"); 
        alert("保存成功"); renderCardList(); renderInventory(); 
    } catch(e) { alert("JSONエラー"); } 
}

// --- スキル/アビリティ保存 ---
window.saveSA = async () => { 
    const type = document.getElementById('saType').value;
    const name = document.getElementById('saName').value; 
    if(!name) return; 
    const tgts = Array.from(document.querySelectorAll('input[name="sa_tgt"]:checked')).map(c => c.value); 
    const data = { name, value: parseFloat(document.getElementById('saValue').value) || 0, targets: tgts }; 
    if(type === 'skill'){ 
        data.area = Array.from(document.querySelectorAll('.area-cell')).map(c => c.classList.contains('active') ? 1 : 0); 
        const i = skillsDB.findIndex(s => s.name === name); 
        if(i >= 0) skillsDB[i] = data; else skillsDB.push(data); 
        await pushToGH('skills.json', skillsDB, "Update Skill"); 
    } else { 
        data.condition = document.getElementById('saCondition').value; 
        const i = abilitiesDB.findIndex(a => a.name === name); 
        if(i >= 0) abilitiesDB[i] = data; else abilitiesDB.push(data); 
        await pushToGH('abilities.json', abilitiesDB, "Update Ability"); 
    } 
    alert("保存完了"); renderSAList(); updateAutoComplete(); 
};

window.deleteSA = async (type, name) => { 
    if(!confirm("削除？")) return; 
    if(type === 'skill') skillsDB = skillsDB.filter(s => s.name !== name); 
    else abilitiesDB = abilitiesDB.filter(a => a.name !== name); 
    await pushToGH(type === 'skill' ? 'skills.json' : 'abilities.json', type === 'skill' ? skillsDB : abilitiesDB, "Delete SA"); 
    renderSAList(); 
};

// --- プロファイル管理 ---
function saveProfilesToLocal() {
    localStorage.setItem('tra_profiles', JSON.stringify(profiles));
}

window.saveProfile = (name) => {
    const cleanName = (name || "").trim();
    if (!cleanName) {
        alert("保存名を入力してください");
        return false;
    }

    const data = {
        pos: selectedPos,     // ポジションを保存
        style: selectedStyle  // スタイルを保存
    };
    const allStats = [...STATS, ...GK_STATS];
    allStats.forEach(s => {
        const nEl = document.getElementById(`now_${s}`);
        const mEl = document.getElementById(`max_${s}`);
        if(nEl) data[`now_${s}`] = nEl.value;
        if(mEl) data[`max_${s}`] = mEl.value;
    });

    profiles[cleanName] = data;
    saveProfilesToLocal();
    alert(`「${cleanName}」を保存しました`);
    return true;
};

window.loadProfile = (name) => {
    if (!name || !profiles[name]) return;
    const data = profiles[name];

    // ポジションとスタイルを復元
    if (data.pos) {
        selectPos(data.pos);
        if (data.style) {
            selectStyle(data.style);
        }
    }

    // ステータス数値を復元
    for (let key in data) {
        if (key === 'pos' || key === 'style') continue;
        const el = document.getElementById(key);
        if (el) el.value = data[key];
    }
    if (typeof updateCalc === 'function') updateCalc();
};

window.deleteProfile = (name) => {
    if (!name) return;
    if (confirm(`「${name}」のデータを削除しますか？`)) {
        delete profiles[name];
        saveProfilesToLocal();
    }
};

window.exportBackup = () => {
    const backup = { profiles: profiles, myCards: myCards, timestamp: new Date().toLocaleString() };
    document.getElementById('backupArea').value = JSON.stringify(backup);
    alert("データを書き出しました。");
};

window.importBackup = () => {
    try {
        const json = document.getElementById('backupArea').value;
        if (!json) return alert("データを貼り付けてください");
        const data = JSON.parse(json);
        if (data.profiles) profiles = data.profiles;
        if (data.myCards) myCards = data.myCards;
        saveProfilesToLocal();
        saveInv();
        renderInventory();
        alert("復元完了。");
    } catch (e) { alert("JSONエラー"); }
};

// --- 画像アップロード機能 (Admin用) ---

window.uploadCardImage = async () => {
    const input = document.getElementById('cardImgUpload');
    const status = document.getElementById('imgUploadStatus');
    const name = document.getElementById('editName').value;
    const title = document.getElementById('editTitle').value;

    if (!input.files || !input.files[0]) {
        alert("画像ファイルを選択してください");
        return;
    }
    if (!name || !title) {
        alert("ファイル名を生成するため、先に「選手名」と「称号」を入力してください");
        return;
    }

    const file = input.files[0];
    const fileName = `${name}_${title}.png`; // ファイル名を自動生成
    status.innerText = "エンコード中...";

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            // DataURL形式 (data:image/png;base64,.....) からBase64部分だけ抽出
            const contentBase64 = e.target.result.split(',')[1];
            
            status.innerText = "アップロード中...";
            
            // GitHub APIへ送信
            // 画像は 'img/cards/' フォルダに保存
            const success = await pushToGH(
                `../img/cards/${fileName}`, // dataフォルダの一つ上(root)のimg/cardsへ
                null, // data引数はJSON用なのでnull
                `Add image: ${fileName}`,
                contentBase64 // 第4引数としてコンテンツを直接渡すよう pushToGH を拡張する必要あり
            );

            if (success) {
                status.innerText = "アップロード成功！";
                alert(`画像を保存しました: img/cards/${fileName}`);
            } else {
                status.innerText = "アップロード失敗";
            }
        } catch (err) {
            console.error(err);
            status.innerText = "エラー発生";
        }
    };
    reader.readAsDataURL(file);
};