// --- OCR関連設定 ---
const OCR_GRID_DEFS = [
    { name: "決定力", r: 0, c: 0 }, { name: "ショートパス", r: 0, c: 1 }, { name: "突破力", r: 0, c: 2 }, { name: "タックル", r: 0, c: 3 }, { name: "ジャンプ", r: 0, c: 4 }, { name: "走力", r: 0, c: 5 },
    { name: "キック力", r: 1, c: 0 }, { name: "ロングパス", r: 1, c: 1 }, { name: "キープ力", r: 1, c: 2 }, { name: "パスカット", r: 1, c: 3 }, { name: "コンタクト", r: 1, c: 4 }, { name: "敏捷性", r: 1, c: 5 },
    { name: "冷静さ", r: 2, c: 0 }, { name: "キック精度", r: 2, c: 1 }, { name: "ボールタッチ", r: 2, c: 2 }, { name: "マーク", r: 2, c: 3 }, { name: "スタミナ", r: 2, c: 4 }
];

async function handleOCR(input) {
    const file = input.files[0];
    if (!file) return;
    const statusEl = document.getElementById('ocrStatus');
    statusEl.innerText = "読み取り中...";

    const img = new Image();
    img.onload = async () => {
        const scale = 3.5;
        const cvs = document.createElement('canvas');
        const ctx = cvs.getContext('2d');
        cvs.width = img.width * scale; 
        cvs.height = img.height * scale;
        ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
        
        const imageData = ctx.getImageData(0, 0, cvs.width, cvs.height);
        const d = imageData.data;
        const grayData = new Uint8Array(cvs.width * cvs.height);
        
        // グレースケール変換
        for (let i = 0; i < d.length; i += 4) {
            const b = (d[i] + d[i+1] + d[i+2]) / 3;
            grayData[i/4] = b;
        }

        // 1. グリッド(水平線)検出
        const scanL = Math.floor(cvs.width * 0.42), scanR = Math.floor(cvs.width * 0.98), scanW = scanR - scanL;
        const lineHits = [];
        for(let y=0; y < cvs.height; y++) {
            let count = 0;
            for(let x=scanL; x < scanR; x++) if(grayData[y * cvs.width + x] > 115) count++;
            if(count > scanW * 0.55) lineHits.push(y);
        }
        const rowYs = [];
        if(lineHits.length > 0) {
            let group = [lineHits[0]];
            for(let i=1; i < lineHits.length; i++){
                if(lineHits[i] - lineHits[i-1] < 20) group.push(lineHits[i]);
                else { rowYs.push(group[Math.floor(group.length/2)]); group = [lineHits[i]]; }
            }
            rowYs.push(group[Math.floor(group.length/2)]);
        }
        if(rowYs.length < 3) { statusEl.innerText = "グリッド検出失敗"; return; }
        const targetRows = rowYs.slice(-3);

        // 2. 列位置の確定
        let islands = [];
        const refY = targetRows[0] - Math.floor(80 * scale / 3), refH = Math.floor(60 * scale / 3);
        const hProj = new Array(scanW).fill(0);
        for(let x=0; x < scanW; x++) for(let y=refY; y < refY+refH; y++) if(grayData[y * cvs.width + (scanL+x)] > 120) hProj[x]++;
        
        let inIsland = false, sX = 0;
        for(let x=0; x < scanW; x++){
            if(!inIsland && hProj[x] > 2) { inIsland = true; sX = x; }
            else if(inIsland && hProj[x] <= 2) {
                let gap = 0; while(x+gap < scanW && hProj[x+gap] <= 2) gap++;
                if(gap < 20) x += gap;
                else { inIsland = false; if(x - sX > 100) islands.push({x: scanL + sX, w: x - sX}); }
            }
        }
        let xCoords = [];
        if (islands.length >= 2) {
            const pitch = (islands[islands.length-1].x - islands[0].x) / (islands.length-1);
            const startX = islands[0].x - (Math.round((islands[0].x - scanL) / pitch) * pitch);
            for(let c=0; c<6; c++) xCoords.push({ x: startX + (c * pitch), w: islands[0].w });
        } else { statusEl.innerText = "列位置特定失敗"; return; }

        // 3. OCRプロセス
        const worker = await Tesseract.createWorker('eng');
        await worker.setParameters({ tessedit_char_whitelist: '0123456789/', tessedit_pageseg_mode: '7' });

        for (let i = 0; i < OCR_GRID_DEFS.length; i++) {
            const def = OCR_GRID_DEFS[i];
            const xObj = xCoords[def.c];
            const cropW = Math.floor(xObj.w + 65), cropX = Math.floor(xObj.x - 48);
            const cropH = Math.floor(100 * scale / 3), cropY = targetRows[def.r] - cropH + 5;
            
            const process = async (thresh) => {
                const tCvs = document.createElement('canvas');
                tCvs.width = cropW + 100; tCvs.height = cropH + 100;
                const tCtx = tCvs.getContext('2d');
                tCtx.fillStyle = "white"; tCtx.fillRect(0,0,tCvs.width,tCvs.height);
                const sCvs = document.createElement('canvas');
                sCvs.width = cropW; sCvs.height = cropH;
                const sCtx = sCvs.getContext('2d');
                sCtx.drawImage(img, cropX/scale, cropY/scale, cropW/scale, cropH/scale, 0, 0, cropW, cropH);
                const sd = sCtx.getImageData(0,0,cropW,cropH);
                for(let j=0; j<sd.data.length; j+=4){
                    const v = ((sd.data[j]+sd.data[j+1]+sd.data[j+2])/3 > thresh) ? 0 : 255;
                    sd.data[j]=sd.data[j+1]=sd.data[j+2]=v;
                }
                const cutY = Math.floor(cropH * 0.85);
                for(let y=cutY; y<cropH; y++) for(let x=0; x<cropW; x++) {
                    const idx = (y*cropW+x)*4; sd.data[idx]=sd.data[idx+1]=sd.data[idx+2]=255;
                }
                sCtx.putImageData(sd, 0, 0);
                tCtx.drawImage(sCvs, 50, 50);
                const { data: { text } } = await worker.recognize(tCvs);
                return text.trim().replace(/[^0-9/]/g, '');
            };

            const r1 = await process(110);
            const r2 = await process(135);
            let clean = (r2.includes('/') && r2.length >= 5) ? r2 : r1;

            let n = "", m = "";
            if (clean.includes('/')) {
                const p = clean.split('/'); n = p[0].substring(0,3); m = p[1].substring(0,3);
            } else if (clean.length >= 5) {
                n = clean.substring(0,3); m = clean.substring(3,6);
            } else if (clean.length >= 3) {
                n = clean.substring(0,3);
            }

            if (n) document.getElementById(`now_${def.name}`).value = n;
            if (m) document.getElementById(`max_${def.name}`).value = m;
            statusEl.innerText = `解析中... (${i+1}/17)`;
        }

        statusEl.innerText = "解析完了";
        await worker.terminate();
        if (typeof updateCalc === 'function') updateCalc();
    };
    img.src = URL.createObjectURL(file);
}