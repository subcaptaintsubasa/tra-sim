window.onload = async () => {
    // LocalStorageから設定を読み込み
    document.getElementById('ghToken').value = localStorage.getItem('gh_token') || '';
    document.getElementById('ghRepo').value = localStorage.getItem('gh_repo') || '';
    myCards = JSON.parse(localStorage.getItem('tra_my_cards') || '{}');

    // UIコンポーネントの構築
    initStatInputs();
    initPosSelect();
    initEditors();
    
    // データの取得を開始 (data_manager.js)
    await fetchAllDB();

    // GitHub設定入力の保存イベントリスナー
    const tokenInput = document.getElementById('ghToken');
    const repoInput = document.getElementById('ghRepo');
    
    if(tokenInput) {
        tokenInput.addEventListener('change', (e) => localStorage.setItem('gh_token', e.target.value));
    }
    if(repoInput) {
        repoInput.addEventListener('change', (e) => localStorage.setItem('gh_repo', e.target.value));
    }
};

// --- 管理者モード（隠しコマンド）の実装：不沈艦バージョン ---
(function() {
    let isWaitingMode = false;
    let commandIndex = 0;
    let longPressTimer = null;
    let waitingTimeout = null;

    const KONAMI_CODE = [
        "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", 
        "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", 
        "b", "a"
    ];

    // モードを終了して画面を隠す（成功か10秒経過時のみ実行）
    function closeWaitingMode() {
        isWaitingMode = false;
        commandIndex = 0;
        if (waitingTimeout) clearTimeout(waitingTimeout);
        const statusEl = document.getElementById('admin-status');
        if (statusEl) {
            statusEl.style.display = 'none';
            statusEl.innerText = "コマンド入力待機中... (10秒以内に入力)"; // 文言を戻す
        }
    }

    function activateAdminMode() {
        document.body.classList.add('admin-mode');
        alert("管理者モードが有効になりました！");
        if (typeof showTab === 'function') showTab('admin-card');
        closeWaitingMode();
    }

    window.addEventListener('keydown', (e) => {
        // 押しっぱなしによる連続入力は無視
        if (e.repeat) return;

        // 1. EnterかSpaceを1.5秒長押し判定
        if (!isWaitingMode && (e.key === "Enter" || e.key === " ")) {
            if (!longPressTimer) {
                longPressTimer = setTimeout(() => {
                    isWaitingMode = true;
                    commandIndex = 0;
                    const statusEl = document.getElementById('admin-status');
                    if (statusEl) statusEl.style.display = 'block';
                    
                    // 10秒経つまでは、何をしても絶対に閉じない設定
                    if (waitingTimeout) clearTimeout(waitingTimeout);
                    waitingTimeout = setTimeout(closeWaitingMode, 10000);
                }, 1500);
            }
            return;
        }

        // 2. コマンド入力判定（待機モード中）
        if (isWaitingMode) {
            // 待機モード中は、EnterやSpace、その他のキーが押されても「無視」するだけで「終了」はさせない
            
            // 矢印キーで画面が動くのだけ止める
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                e.preventDefault();
            }

            const inputKey = e.key.toLowerCase();
            const targetKey = KONAMI_CODE[commandIndex].toLowerCase();

            if (inputKey === targetKey) {
                // 正解のキーが押された
                commandIndex++;
                
                // 画面に進捗を出す（デバッグ用兼ユーザー案内）
                const statusEl = document.getElementById('admin-status');
                if (statusEl) statusEl.innerText = `入力中... (${commandIndex} / 10)`;

                if (commandIndex === KONAMI_CODE.length) {
                    activateAdminMode();
                }
            } else if (["arrowup", "arrowdown", "arrowleft", "arrowright", "b", "a"].includes(inputKey)) {
                // コマンドに使うキーを「間違えた順番」で押したら、カウントだけ0に戻す（画面は閉じない）
                commandIndex = 0;
                const statusEl = document.getElementById('admin-status');
                if (statusEl) statusEl.innerText = "ミス！最初から入力：↑↑↓↓←→←→BA";
            }
            // それ以外のキー（Enterなど）は、押されても「完全に無視」して何もしない
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === "Enter" || e.key === " ") {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }
    });
})();