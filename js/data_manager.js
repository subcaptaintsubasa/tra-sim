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
        
        if (g.status === 404) {
            alert("リポジトリが見つかりません(404)。\nconfig.js の GITHUB_REPO 設定、またはlocalStorageの 'gh_repo' が正しいか確認してください。\n現在の設定: " + repo);
            return false;
        }
        // ------------------------------------------

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
    if(!name) return alert("名前を入力してください");

    const btn = document.getElementById('btnSaveCard');
    if(btn) { btn.disabled = true; btn.innerText = "保存中..."; }

    try {
        // 1. 画像アップロード処理 (ファイルが選択されている場合のみ)
        const fileInput = document.getElementById('cardImgUpload');
        if (fileInput && fileInput.files[0]) {
            const file = fileInput.files[0];
            const fileName = `${name}_${title}.png`;
            
            const toBase64 = file => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = error => reject(error);
            });

            const contentBase64 = await toBase64(file);
            const imgRes = await pushToGH(`../img/cards/${fileName}`, null, `Add image: ${fileName}`, contentBase64);
            if (!imgRes) throw new Error("画像の保存に失敗しました");
        }

        // 2. JSONデータ構築
        const stats = {}; 
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
        // 互換性のため legacyType も残すが、基本は bonuses 配列を使用
        const legacyType = bonuses.length > 0 ? bonuses[0].type : "";
        const legacyVal = bonuses.length > 0 ? bonuses[0].value : 0;

        const growthRate = parseInt(document.getElementById('editGrowth').value);

        const nc = { 
            title, name, rarity: document.getElementById('editRarity').value, 
            bonuses: bonuses, bonus_type: legacyType, bonus_value: legacyVal,
            abilities: [document.getElementById('editAbilityName').value], 
            stats,
            growth_rate: growthRate
        };

        if (growthRate === 6) delete nc.growth_rate; // デフォルトは削除

        // 既存データの更新または新規追加
        // (カード名と称号が一致するものを更新)
        const i = cardsDB.findIndex(x => x.name === name && x.title === title); 
        if(i >= 0) cardsDB[i] = nc; else cardsDB.push(nc);

        // 3. JSON保存
        if(await pushToGH('cards.json', cardsDB, `Update Card: ${name}`)) { 
            alert("保存しました"); 
            renderCardList(); 
            // ナビゲーション状態更新
            currentEditCardIndex = (i >= 0) ? i : cardsDB.length - 1;
            isCardEditorDirty = false;
        }

    } catch (e) {
        console.error(e);
        alert("エラーが発生しました: " + e.message);
    } finally {
        if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> 保存 (画像+データ)'; }
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

// --- スキル/アビリティ保存 (連動更新機能付き) ---
window.saveSA = async () => { 
    const type = document.getElementById('saType').value;
    const newName = document.getElementById('saName').value; 
    const newRarity = document.getElementById('saRarity').value;
    
    // 編集前の情報を取得
    const editor = document.getElementById('saEditor');
    const originalName = editor.dataset.originalName;
    const originalRarity = editor.dataset.originalRarity;
    const isEditMode = editor.dataset.isEditMode === "true";

    if(!newName) return alert("名称を入力してください"); 

    // 保存ボタンを無効化
    const btn = document.querySelector('#saEditor button.btn-accent');
    if(btn) { btn.disabled = true; btn.innerText = "処理中..."; }

    try {
        // 1. スキル/アビリティDBの更新
        let targetDB = (type === 'skill') ? skillsDB : abilitiesDB;
        const fileName = (type === 'skill') ? 'skills.json' : 'abilities.json';

        // 新しいデータオブジェクト作成
        const data = { name: newName, rarity: newRarity }; 

        if(type === 'skill'){ 
            data.skill_type = document.getElementById('saSkillType').value;
            data.note = document.getElementById('saNote').value;
            data.area = Array.from(document.querySelectorAll('.area-cell')).map(c => c.classList.contains('active') ? 1 : 0); 
            const params = [];
            document.querySelectorAll('.param-input-group').forEach(grp => {
                const stat = grp.querySelector('select').value;
                const inputs = grp.querySelectorAll('input');
                const vals = Array.from(inputs).map(inp => parseFloat(inp.value)||0);
                if (stat) params.push({ stat: stat, values: vals });
            });
            data.params = params;
        } else { 
            data.condition = document.getElementById('saCondition').value; 
            const targets = [];
            document.querySelectorAll('.sa-param-check:checked').forEach(c => targets.push(c.value));
            data.targets = targets;
        }

        // DB操作: 編集モードでキー(名前orレアリティ)が変わった場合、古いデータを削除する
        if (isEditMode && (originalName !== newName || originalRarity !== newRarity)) {
            const delIdx = targetDB.findIndex(i => i.name === originalName && i.rarity === originalRarity);
            if (delIdx >= 0) targetDB.splice(delIdx, 1);
        }

        // 新規追加または上書き (同じキーがあれば上書き)
        const existIdx = targetDB.findIndex(i => i.name === newName && i.rarity === newRarity);
        if (existIdx >= 0) targetDB[existIdx] = data;
        else targetDB.push(data);

        // スキルDB保存
        await pushToGH(fileName, targetDB, `Update ${type}: ${newName} (${newRarity})`);


        // 2. カードデータの連動更新 (Cascade Update)
        // 編集モードの場合のみ、既存カードのリンクを書き換える
        if (isEditMode && confirm(`この${type}を持っているカードのデータも自動更新しますか？\n(対象: ${originalName})`)) {
            let updatedCardCount = 0;

            cardsDB.forEach(card => {
                if (!card.abilities || card.abilities.length === 0) return;

                let cardChanged = false;
                
                // abilities配列を走査して置換
                card.abilities = card.abilities.map(ab => {
                    // ケース1: 旧データ (文字列) の場合
                    // 元の名前と一致していれば、新仕様のオブジェクトに変換する
                    if (typeof ab === 'string') {
                        if (ab === originalName) {
                            cardChanged = true;
                            return { name: newName, rarity: newRarity };
                        }
                        return ab;
                    }

                    // ケース2: 新データ (オブジェクト) の場合
                    // 名前とレアリティが一致していれば、内容を更新する (名前変更などに対応)
                    if (ab.name === originalName && ab.rarity === originalRarity) {
                        cardChanged = true;
                        return { name: newName, rarity: newRarity };
                    }
                    
                    return ab;
                });

                if (cardChanged) updatedCardCount++;
            });

            if (updatedCardCount > 0) {
                // カードDB保存
                await pushToGH('cards.json', cardsDB, `Auto-update cards linked to ${newName}`);
                alert(`保存完了しました。\n関連するカード ${updatedCardCount}枚 の情報も更新しました。`);
            } else {
                alert("保存完了しました。(関連カードなし)");
            }
        } else {
            alert("保存完了しました。");
        }

        // 状態リセット
        renderSAList();
        updateAutoComplete();
        // 編集モードフラグクリア
        delete editor.dataset.originalName;
        delete editor.dataset.originalRarity;
        delete editor.dataset.isEditMode;

    } catch(e) {
        console.error(e);
        alert("エラーが発生しました: " + e.message);
    } finally {
        if(btn) { btn.disabled = false; btn.innerHTML = "保存"; }
    }
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