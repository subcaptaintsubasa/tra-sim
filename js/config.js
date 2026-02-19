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

const POS_MAP = {
    "GK": ["スイーパーGK", "オーソドックスGK"],
    "CB": ["組立CB", "ストッパー"],
    "LB": ["守備的FB", "攻撃的FB"],
    "RB": ["守備的FB", "攻撃的FB"],
    "DM": ["ハードマーカー", "セントラルMF", "パサー"],
    "AM": ["セントラルMF", "パサー", "アタッカー"],
    "LM": ["ドリブラー", "サイドアタッカー"],
    "RM": ["ドリブラー", "サイドアタッカー"],
    "LW": ["ドリブラー", "サイドアタッカー"],
    "RW": ["ドリブラー", "サイドアタッカー"],
    "CF": ["ポストプレーヤー", "ラインブレイカー", "ストライカー"]
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
    "DM": "mf", "AM": "mf", "LM": "mf", "RM": "mf",
    "LW": "fw", "RW": "fw", "CF": "fw"
};

// --- グローバル変数 ---
let cardsDB = [];
let skillsDB = [];
let abilitiesDB = [];
let myCards = {};
let selectedSlots = Array(6).fill(null);
let activeSlotIndex = null;

// 追加：選択状態を保持する変数
let selectedPos = null;
let selectedStyle = null;
let selectedTargetSkills = [];
let selectedTargetAbilities = [];

// --- 既存のコードの下に追加 ---
let profiles = {}; // 保存された選手プロファイル { "名前": { "now_決定力": 100, ... } }