/* ==========================================================================
   words-data.js - ワイヤーフレーム用ダミーデータ
   ※ 本実装時には data/words.json として外部ファイル化する
   ========================================================================== */

const SAMPLE_WORDS = [
  { id: "t020", english: "Revenue", japanese: "売上高", category: "financial_accounting", subcategory: "income_statement", level: "beginner", description: "企業の主たる営業活動から生じる収入の総額", status: "mastered", recentAnswers: [true, true, true, true, true] },
  { id: "t021", english: "Cost of sales", japanese: "売上原価", category: "financial_accounting", subcategory: "income_statement", level: "beginner", description: "売上に対応する商品・製品の原価", status: "mastered", recentAnswers: [true, true, true, false, true] },
  { id: "t022", english: "Gross profit", japanese: "売上総利益", category: "financial_accounting", subcategory: "income_statement", level: "beginner", description: "売上高から売上原価を差し引いた利益", status: "learning", recentAnswers: [true, false, true, true] },
  { id: "t034", english: "Net income", japanese: "当期純利益", category: "financial_accounting", subcategory: "income_statement", level: "beginner", description: "全ての収益から全ての費用を差し引いた最終利益", status: "mastered", recentAnswers: [true, true, true] },
  { id: "t080", english: "Cash and cash equivalents", japanese: "現金及び現金同等物", category: "financial_accounting", subcategory: "balance_sheet_assets", level: "beginner", description: "現金および容易に換金できる短期投資", status: "learning", recentAnswers: [true, false, true] },
  { id: "t081", english: "Trade receivables", japanese: "売掛金", category: "financial_accounting", subcategory: "balance_sheet_assets", level: "beginner", description: "商品・サービスの提供により発生した未回収の代金請求権", status: "learning", recentAnswers: [false, true] },
  { id: "t085", english: "Inventories", japanese: "棚卸資産", category: "financial_accounting", subcategory: "balance_sheet_assets", level: "basic", description: "販売目的で保有する商品や製品、原材料等", status: "unmastered", recentAnswers: [false, false] },
  { id: "t088", english: "Goodwill", japanese: "のれん", category: "financial_accounting", subcategory: "balance_sheet_assets", level: "basic", description: "企業買収時に発生する超過収益力", status: "unmastered", recentAnswers: [] },
  { id: "t090", english: "Property, plant and equipment", japanese: "有形固定資産", category: "financial_accounting", subcategory: "balance_sheet_assets", level: "basic", description: "事業の用に供する物理的形態を持つ固定資産", status: "unmastered", recentAnswers: [false] },
  { id: "t124", english: "Trade payables", japanese: "買掛金", category: "financial_accounting", subcategory: "balance_sheet_liabilities", level: "beginner", description: "商品・サービスの仕入により発生した未払の代金支払義務", status: "learning", recentAnswers: [true, true, false] },
  { id: "t150", english: "Equity", japanese: "資本 / 持分", category: "financial_accounting", subcategory: "balance_sheet_equity", level: "beginner", description: "資産から負債を差し引いた純資産", status: "mastered", recentAnswers: [true, true, true] },
  { id: "t153", english: "Retained earnings", japanese: "利益剰余金", category: "financial_accounting", subcategory: "balance_sheet_equity", level: "basic", description: "過年度から累積された利益のうち配当等で社外流出していない部分", status: "unmastered", recentAnswers: [] },
  { id: "t174", english: "Depreciation", japanese: "減価償却", category: "financial_accounting", subcategory: "cash_flow_statement", level: "beginner", description: "有形固定資産の取得原価を耐用年数にわたって費用配分する手続き", status: "learning", recentAnswers: [true, false, true, true] },
  { id: "t250", english: "Cost accounting", japanese: "原価計算", category: "management_accounting", subcategory: "cost_accounting", level: "basic", description: "製品やサービスの原価を計算する会計手法", status: "unmastered", recentAnswers: [] },
  { id: "t256", english: "Variable cost", japanese: "変動費", category: "management_accounting", subcategory: "cost_accounting", level: "basic", description: "操業度に比例して変動する原価", status: "unmastered", recentAnswers: [] },
  { id: "t291", english: "Break-even point", japanese: "損益分岐点", category: "management_accounting", subcategory: "cvp_analysis", level: "basic", description: "利益がゼロとなる売上高の水準", status: "unmastered", recentAnswers: [] },
  { id: "t370", english: "Audit", japanese: "監査", category: "audit_governance", subcategory: "audit_basics", level: "beginner", description: "財務諸表の適正性に対する独立した第三者による検証", status: "unmastered", recentAnswers: [] },
  { id: "t410", english: "Internal control", japanese: "内部統制", category: "audit_governance", subcategory: "internal_control", level: "basic", description: "業務の適正性を確保するための仕組み", status: "unmastered", recentAnswers: [] },
  { id: "t464", english: "Fair value", japanese: "公正価値", category: "common", subcategory: "conceptual_framework", level: "basic", description: "市場参加者間で行われる秩序ある取引における公正な価値", status: "unmastered", recentAnswers: [] },
  { id: "t475", english: "Asset", japanese: "資産", category: "common", subcategory: "basic_concepts", level: "beginner", description: "過去の事象の結果として企業が支配している経済的資源", status: "mastered", recentAnswers: [true, true, true] },
];

const CATEGORY_LABELS = {
  financial_accounting: "財務会計",
  management_accounting: "管理会計",
  audit_governance: "監査・ガバナンス",
  common: "共通用語"
};

const SUBCATEGORY_LABELS = {
  income_statement: "損益計算書",
  comprehensive_income: "包括利益計算書",
  balance_sheet_assets: "貸借対照表（資産）",
  balance_sheet_liabilities: "貸借対照表（負債）",
  balance_sheet_equity: "貸借対照表（資本）",
  cash_flow_statement: "キャッシュフロー計算書",
  cost_accounting: "原価計算",
  cvp_analysis: "CVP分析",
  audit_basics: "監査基本概念",
  internal_control: "内部統制",
  conceptual_framework: "概念フレームワーク",
  basic_concepts: "基本会計概念"
};

const LEVEL_LABELS = {
  beginner: "初級",
  basic: "基礎",
  intermediate: "中級",
  advanced: "上級"
};

const LEVEL_DISPLAY = {
  beginner: "やさしい",
  basic: "やさしい",
  intermediate: "ふつう",
  advanced: "むずかしい"
};
