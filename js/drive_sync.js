// --- START OF FILE tra-sim-main/js/drive_sync.js ---

let tokenClient;
let gapiInited = false;
let gisInited = false;

// 1. ライブラリの初期化
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: GDRIVE_CONFIG.API_KEY,
            // discoveryDocs: GDRIVE_CONFIG.DISCOVERY_DOCS, // 自動ロードをやめて明示的にロードする
        });

        // Drive API v3 を明示的にロード
        // ConfigのURLを使用、なければ標準URLをフォールバックとして使用
        const discoveryUrl = (typeof GDRIVE_CONFIG !== 'undefined' && GDRIVE_CONFIG.DISCOVERY_DOCS) 
            ? GDRIVE_CONFIG.DISCOVERY_DOCS[0] 
            : 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
            
        await gapi.client.load(discoveryUrl);
        
        gapiInited = true;
        checkAuth();
    } catch (error) {
        console.error("GAPI Init Error:", error);
        updateStatus("API初期化エラー: " + JSON.stringify(error), false, false, true);
    }
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GDRIVE_CONFIG.CLIENT_ID,
        scope: GDRIVE_CONFIG.SCOPES,
        callback: '', // 定義時にコールバックを指定しない
    });
    gisInited = true;
    checkAuth();
}

function checkAuth() {
    if (gapiInited && gisInited) {
        // 認証チェック完了後の処理（必要であれば）
    }
}

// 2. 認証（ログイン）処理
function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        document.getElementById('gDriveAuthBtn').style.display = 'none';
        document.getElementById('gDriveActions').style.display = 'flex';
        updateStatus("ログインしました");
    };

    if (gapi.client.getToken() === null) {
        // トークンがなければプロンプトを表示
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        tokenClient.requestAccessToken({prompt: ''});
    }
}

function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        document.getElementById('gDriveAuthBtn').style.display = 'flex';
        document.getElementById('gDriveActions').style.display = 'none';
        updateStatus("ログアウトしました");
    }
}

// 3. 保存処理 (Backup)
async function saveToDrive() {
    updateStatus("保存中...", true);
    try {
        // APIロードチェック
        if (!gapi.client.drive) {
            throw new Error("Drive APIがロードされていません。ページをリロードしてください。");
        }

        // データをまとめる
        const data = {
            myCards: myCards,
            profiles: profiles,
            timestamp: new Date().toISOString(),
            version: "1.0"
        };
        const fileContent = JSON.stringify(data);
        const fileName = GDRIVE_CONFIG.BACKUP_FILE_NAME;

        // 既存ファイルを検索
        const fileId = await findFileId(fileName);

        const file = new Blob([fileContent], {type: 'application/json'});
        const metadata = {
            'name': fileName,
            'mimeType': 'application/json',
        };

        const accessToken = gapi.client.getToken().access_token;
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
        form.append('file', file);

        let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        let method = 'POST';

        if (fileId) {
            // 上書き (Update)
            url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
            method = 'PATCH';
            console.log("Existing file found. Updating...", fileId);
        }

        const response = await fetch(url, {
            method: method,
            headers: new Headers({'Authorization': 'Bearer ' + accessToken}),
            body: form
        });

        if (response.ok) {
            updateStatus("バックアップ完了！", false, true);
        } else {
            const errText = await response.text();
            throw new Error("Upload failed: " + errText);
        }

    } catch (err) {
        console.error(err);
        updateStatus("保存エラー: " + err.message, false, false, true);
    }
}

// 4. 復元処理 (Restore)
async function restoreFromDrive() {
    if(!confirm("現在のデータを上書きして復元しますか？")) return;
    
    updateStatus("検索中...", true);
    try {
        // APIロードチェック
        if (!gapi.client.drive) {
            throw new Error("Drive APIがロードされていません。ページをリロードしてください。");
        }

        const fileName = GDRIVE_CONFIG.BACKUP_FILE_NAME;
        const fileId = await findFileId(fileName);

        if (!fileId) {
            updateStatus("バックアップが見つかりません", false, false, true);
            return;
        }

        updateStatus("ダウンロード中...", true);
        
        // ファイル内容を取得
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });

        const data = response.result; // JSONオブジェクトとして取得される

        if (data && data.myCards) {
            // データ適用
            myCards = data.myCards || {};
            profiles = data.profiles || {};
            
            // LocalStorage保存
            localStorage.setItem('tra_my_cards', JSON.stringify(myCards));
            localStorage.setItem('tra_profiles', JSON.stringify(profiles));

            // 画面更新
            if (typeof renderInventory === 'function') renderInventory();
            if (typeof updateCalc === 'function') updateCalc();
            if (typeof renderDatabase === 'function') renderDatabase();

            updateStatus(`復元完了 (${new Date(data.timestamp).toLocaleString()})`, false, true);
        } else {
            throw new Error("データ形式が不正です");
        }

    } catch (err) {
        console.error(err);
        updateStatus("復元エラー: " + err.message, false, false, true);
    }
}

// Helper: ファイルID検索
async function findFileId(name) {
    // APIロードチェック
    if (!gapi.client.drive) {
        throw new Error("Drive API not loaded");
    }

    const response = await gapi.client.drive.files.list({
        q: `name = '${name}' and trashed = false`,
        fields: 'files(id, name)',
        spaces: 'drive'
    });
    
    // レスポンス構造チェック
    if (!response || !response.result || !response.result.files) {
        console.warn("Unexpected API response", response);
        return null;
    }

    const files = response.result.files;
    if (files && files.length > 0) {
        return files[0].id;
    }
    return null;
}

// Helper: ステータス表示
function updateStatus(msg, isLoading=false, isSuccess=false, isError=false) {
    const el = document.getElementById('driveStatus');
    if(!el) return;
    
    let icon = '';
    if(isLoading) icon = '<i class="fa-solid fa-spinner fa-spin"></i> ';
    if(isSuccess) icon = '<i class="fa-solid fa-check"></i> ';
    if(isError) icon = '<i class="fa-solid fa-triangle-exclamation"></i> ';
    
    el.innerHTML = icon + msg;
    el.style.color = isError ? '#ef4444' : (isSuccess ? '#22c55e' : '#fbbf24');
    
    if(isSuccess || isError) {
        setTimeout(() => { el.innerHTML = ''; }, 5000);
    }
}

window.addEventListener('load', () => {
    if(typeof gapi !== 'undefined') gapiLoaded();
    if(typeof google !== 'undefined') gisLoaded();
});