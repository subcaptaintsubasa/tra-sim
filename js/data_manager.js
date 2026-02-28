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
    // 変更: 画面入力ではなくlocalStorageから取得
    const token = localStorage.getItem('gh_token');
    const repo = localStorage.getItem('gh_repo');
    
    if(!token || !repo) { 
        alert("開発者認証がされていません。メニューの「開発者オプション」からログインしてください。"); 
        return false; 
    }
    
    let path = `data/${file}`;
    if (file.startsWith('../')) {
        path = file.replace('../', '');
    }

    const url = `https://api.github.com/repos/${repo}/contents/${path}`;
    
    try {
        const g = await fetch(url, { headers:{'Authorization':`token ${token}`} });
        
        // 認証エラーチェック
        if (g.status === 401 || g.status === 403) {
            alert("GitHub認証に失敗しました。トークンを確認してください。");
            return false;
        }

        const sha = g.ok ? (await g.json()).sha : null;
        
        const content = rawContent 
            ? rawContent 
            : btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
            
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
        
        if (!res.ok) {
            const errJson = await res.json();
            throw new Error(errJson.message || "Update Failed");
        }
        
        return true;
    } catch(e) { 
        console.error(e); 
        alert("エラーが発生しました: " + e.message);
        return false; 
    }
}

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

    const growthRate = parseInt(document.getElementById('editGrowth').value);

    const nc = { 
        title, name, rarity: document.getElementById('editRarity').value, 
        bonuses: bonuses, bonus_type: legacyType, bonus_value: legacyVal,
        abilities: [document.getElementById('editAbilityName').value], stats,
        growth_rate: growthRate
    };

    if (growthRate === 6) {
        delete nc.growth_rate;
    }

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
        pos: selectedPos,
        style: selectedStyle
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

    if (data.pos) {
        selectPos(data.pos);
        if (data.style) {
            selectStyle(data.style);
        }
    }

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
    const fileName = `${name}_${title}.png`;
    status.innerText = "エンコード中...";

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const contentBase64 = e.target.result.split(',')[1];
            
            status.innerText = "アップロード中...";
            
            const success = await pushToGH(
                `../img/cards/${fileName}`,
                null,
                `Add image: ${fileName}`,
                contentBase64
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

window.batchRegisterSA = async () => {
    try {
        const json = document.getElementById('aiPasteSA').value;
        if (!json) return alert("JSONデータを入力してください");
        
        const data = JSON.parse(json);
        const list = Array.isArray(data) ? data : [data];
        
        let sCount = 0, aCount = 0;
        
        list.forEach(item => {
            if (!item.name) return;

            if (item.area && Array.isArray(item.area)) {
                const i = skillsDB.findIndex(x => x.name === item.name);
                if (i >= 0) skillsDB[i] = item; else skillsDB.push(item);
                sCount++;
            } else {
                const i = abilitiesDB.findIndex(x => x.name === item.name);
                if (i >= 0) abilitiesDB[i] = item; else abilitiesDB.push(item);
                aCount++;
            }
        });

        if (sCount > 0) await pushToGH('skills.json', skillsDB, "Bulk SA Update (Skills)");
        if (aCount > 0) await pushToGH('abilities.json', abilitiesDB, "Bulk SA Update (Abilities)");
        
        alert(`保存完了 (Skill: ${sCount}件, Ability: ${aCount}件)`);
        renderSAList();
        updateAutoComplete();
    } catch (e) {
        console.error(e);
        alert("JSONエラー: 形式が正しくありません\n" + e.message);
    }
};

// --- 開発者認証機能 (追加) ---

window.openDevModal = () => {
    // 既にログイン済みならログアウト確認
    if(localStorage.getItem('gh_token')) {
        if(confirm("現在ログイン中です。ログアウトしますか？")) {
            logoutDev();
        }
        return;
    }
    const modal = document.getElementById('devAuthModal');
    if(modal) modal.style.display = 'flex';
};

window.submitDevAuth = () => {
    const token = document.getElementById('devAuthToken').value.trim();
    // Repo入力取得を廃止し、定数を使用
    if (typeof GITHUB_REPO === 'undefined') {
        return alert("設定エラー: GITHUB_REPO が定義されていません。config.jsを確認してください。");
    }
    const repo = GITHUB_REPO;
    
    if(!token) {
        alert("Tokenを入力してください");
        return;
    }
    
    localStorage.setItem('gh_token', token);
    localStorage.setItem('gh_repo', repo); // 互換性のため保存しておく
    
    document.getElementById('devAuthModal').style.display = 'none';
    alert("認証情報を保存しました");
    checkDevLogin();
};

window.logoutDev = () => {
    localStorage.removeItem('gh_token');
    localStorage.removeItem('gh_repo');
    alert("ログアウトしました");
    checkDevLogin();
    if (typeof switchView === 'function') switchView('database');
};

window.checkDevLogin = () => {
    const hasAuth = !!localStorage.getItem('gh_token');
    const adminLinks = document.getElementById('adminLinks');
    const loginBtn = document.getElementById('devLoginBtn');
    
    if(adminLinks) adminLinks.style.display = hasAuth ? 'block' : 'none';
    
    if(loginBtn) {
        loginBtn.innerHTML = hasAuth 
            ? '<i class="fa-solid fa-user-shield"></i> 開発者: ログイン中' 
            : '<i class="fa-solid fa-terminal"></i> 開発者オプション';
    }
};