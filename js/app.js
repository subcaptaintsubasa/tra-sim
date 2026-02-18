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