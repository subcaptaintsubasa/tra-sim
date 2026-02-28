// --- START OF FILE tra-sim-main/js/config.js ---

// --- 定数定義 ---
const STATS = [
    "決定力", "ショートパス", "突破力", "タックル", "ジャンプ", "走力",
    "キック力", "ロングパス", "キープ力", "パスカット", "コンタクト", "敏捷性",
    "冷静さ", "キック精度", "ボールタッチ", "マーク", "スタミナ"
];

const GK_STATS = ["セービング", "反応速度", "1対1"];
const DEF_STATS = ["タックル", "パスカット", "マーク"];

const GK_MAP = {
    "タックル": "セービング",
    "パスカット": "反応速度",
    "マーク": "1対1"
};

// 正式名称でのポジション定義
const POS_MAP = {
    "GK": ["スイーパーGK", "オーソドックスGK"],
    "CB": ["組立CB", "ストッパー"],
    "LB": ["守備的FB", "攻撃的FB"],
    "RB": ["守備的FB", "攻撃的FB"],
    "DM": ["ハードマーカー", "セントラルMF", "パサー"],
    "AM": ["セントラルMF", "パサー", "アタッカー"],
    "LM": ["ドリブラー", "サイドアタッカー"],
    "RM": ["ドリブラー", "サイドアタッカー"],
    "LW": ["ドリブラー", "サイドアタッカー", "ストライカー"],
    "RW": ["ドリブラー", "サイドアタッカー", "ストライカー"],
    "CF": ["ポストプレーヤー", "ラインブレイカー", "ストライカー"]
};

// ポジション選択時、有効となるボーナス名称の包含定義
const POS_BONUS_MAPPING = {
    "LW": ["WF", "WG"],
    "RW": ["WF", "WG"],
    "LM": ["WM", "SM"],
    "RM": ["WM", "SM"],
    "LB": ["FB", "SB"],
    "RB": ["FB", "SB"],
    "CF": ["FW"],
    "AM": ["OMF"],
    "DM": ["DMF"],
    "CM": ["CMF"]
};

// --- プレイスタイルとアイコンの紐付け ---
const STYLE_ICONS = {
    "ストライカー": "ST",
    "ラインブレイカー": "LBK",
    "ポストプレーヤー": "PST",
    "ドリブラー": "DRB",
    "サイドアタッカー": "SAT",
    "アタッカー": "ATK",
    "パサー": "PAS",
    "セントラルMF": "CMF",
    "ハードマーカー": "HDM",
    "攻撃的FB": "AFB",
    "守備的FB": "DFB",
    "組立CB": "MCB",
    "ストッパー": "STP",
    "スイーパーGK": "SGK",
    "オーソドックスGK": "OGK"
};

// ポジションごとのグループ分け
const POS_GROUPS = {
    "GK": "gk",
    "CB": "df", "LB": "df", "RB": "df",
    "DM": "mf", "AM": "mf", "LM": "mf", "RM": "mf", "CM": "mf",
    "LW": "fw", "RW": "fw", "CF": "fw", "ST": "fw"
};

// --- Google Drive API Configuration ---
// GCPコンソールで取得した値を設定してください
const GDRIVE_CONFIG = {
    CLIENT_ID: '902045291413-obsbvg5h2mumi43fvanj8qrekedb3ute.apps.googleusercontent.com', 
    API_KEY: 'AIzaSyDSaGnBZwFFc4dOUSL9mMrI0v_lbSrP9aE',     
    SCOPES: 'https://www.googleapis.com/auth/drive.file',
    DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    BACKUP_FILE_NAME: 'tra_sim_backup.json'
};

// --- グローバル変数 ---
let cardsDB = [];
let skillsDB = [];
let abilitiesDB = [];
let myCards = {};
let selectedSlots = Array(6).fill(null);
let activeSlotIndex = null;

let selectedPos = null;
let selectedStyle = null;
let selectedTargetSkills = [];
let selectedTargetAbilities = [];

let profiles = {};

// --- グローバル変数 (追加) ---
let appMode = 'view'; // 'view' or 'mycards'
let viewType = 'grid'; // 'grid' or 'list'

// --- 既存の定数定義の下に追加 ---

// 比較テーブル用：パラメータ表示順（縦優先）
// OCRグリッドの「左の列から順に、上から下へ」の並び
const STATS_VERTICAL_ORDER = [
    "決定力", "キック力", "冷静さ",
    "ショートパス", "ロングパス", "キック精度",
    "突破力", "キープ力", "ボールタッチ",
    "タックル", "パスカット", "マーク",
    "ジャンプ", "コンタクト", "スタミナ",
    "走力", "敏捷性",
    // GK項目は別途対応または末尾に追加
    "セービング", "反応速度", "1対1"
];

// --- 既存の定数定義の下に追記 ---

// フィルタ画面用のパラメータ表示順（7列レイアウト用）
// [決定, Sパス, 突破, タックル, セービング, ジャンプ, 走力] ... の順
const FILTER_PARAM_ORDER = [
    "決定力", "ショートパス", "突破力", "タックル", "セービング", "ジャンプ", "走力",
    "キック力", "ロングパス", "キープ力", "パスカット", "反応速度", "コンタクト", "敏捷性",
    "冷静さ", "キック精度", "ボールタッチ", "マーク", "1対1", "スタミナ"
];

// --- GitHub設定 ---
// 開発者オプション用のリポジトリ指定 (ユーザー名/リポジトリ名)
const GITHUB_REPO = 'username/repository';