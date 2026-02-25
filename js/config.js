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

// 正式名称でのポジション定義とプレースタイルの候補
const POS_MAP = {
    "GK": ["スイーパーGK", "オーソドックスGK"],
    "CB": ["組立CB", "ストッパー"],
    "LB": ["守備的FB", "攻撃的FB"],
    "RB": ["守備的FB", "攻撃的FB"],
    "DM": ["ハードマーカー", "セントラルMF", "パサー"], // DMF -> DM
    "AM": ["セントラルMF", "パサー", "アタッカー"],     // OMF -> AM
    "LM": ["ドリブラー", "サイドアタッカー"],
    "RM": ["ドリブラー", "サイドアタッカー"],
    "LW": ["ドリブラー", "サイドアタッカー", "ストライカー"], // WG -> LW/RW
    "RW": ["ドリブラー", "サイドアタッカー", "ストライカー"],
    "CF": ["ポストプレーヤー", "ラインブレイカー", "ストライカー"]
};

// ★追加: ポジション選択時、有効となるボーナス名称の紐づけ
// 例: LWを選択した場合、ボーナスが「LW」「WF」「WG」のいずれかであれば有効とする
const POS_BONUS_MAPPING = {
    "LW": ["WF", "WG"],
    "RW": ["WF", "WG"],
    "LM": ["WM", "SM"],
    "RM": ["WM", "SM"],
    "LB": ["FB", "SB"],
    "RB": ["FB", "SB"],
    "CF": ["FW"], // 稀なケース用
    "AM": ["OMF"],
    "DM": ["DMF"],
    "CM": ["CMF"] // 一応定義
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