/**
 * words.js
 *
 * ============================================================================
 * 用語データの読み込みとフィルタリング
 * ============================================================================
 *
 * 設計意図:
 * - words.json を一度読み込んでメモリ上に保持
 * - フィルタ・検索・ソートのAPIを提供
 * - データの読み書きは storage.js とは独立（words は読み取り専用）
 *
 * 公開API:
 *   words.load()                                - データ読み込み（初回のみ実行）
 *   words.getAll()                              - 全用語取得
 *   words.getById(id)                           - 1件取得
 *   words.getByIds(ids)                         - 複数件取得
 *   words.filter(criteria)                      - 条件でフィルタ
 *   words.search(query)                         - キーワード検索
 *   words.getCategories()                       - カテゴリ一覧
 *   words.getSubcategories(category)            - サブカテゴリ一覧
 *   words.getRandomSample(count, criteria)      - ランダムサンプリング
 */

const WORDS_DATA_PATH = 'data/words.json';

// メモリ上のキャッシュ
let _termsCache = null;
let _loadPromise = null;

const words = {
  /**
   * データを読み込む（複数回呼んでも安全）
   */
  async load() {
    if (_termsCache) return _termsCache;

    if (!_loadPromise) {
      _loadPromise = (async () => {
        // パス解決: ルートからの相対パスにする
        const path = _resolvePath(WORDS_DATA_PATH);
        const response = await fetch(path);
        if (!response.ok) {
          throw new Error(`用語データの読み込みに失敗しました: ${response.status}`);
        }
        const data = await response.json();
        _termsCache = data.terms;
        return _termsCache;
      })();
    }

    return await _loadPromise;
  },

  /**
   * 全用語を取得
   */
  async getAll() {
    return await this.load();
  },

  /**
   * 用語IDで1件取得
   */
  async getById(id) {
    const all = await this.load();
    return all.find(t => t.id === id) || null;
  },

  /**
   * 複数IDで取得
   */
  async getByIds(ids) {
    const all = await this.load();
    const idSet = new Set(ids);
    return all.filter(t => idSet.has(t.id));
  },

  /**
   * 条件でフィルタ
   * @param criteria.categories: カテゴリ配列（OR条件）
   * @param criteria.subcategories: サブカテゴリ配列（OR条件）
   * @param criteria.levels: 難易度配列（OR条件）
   * @param criteria.statuses: 学習状況配列（要 progressMapも渡す）
   * @param criteria.progressMap: 進捗データ（statuses指定時に必要）
   */
  async filter(criteria = {}) {
    const all = await this.load();
    return all.filter(t => {
      if (criteria.categories?.length && !criteria.categories.includes(t.category)) return false;
      if (criteria.subcategories?.length && !criteria.subcategories.includes(t.subcategory)) return false;
      if (criteria.levels?.length && !criteria.levels.includes(t.level)) return false;
      if (criteria.statuses?.length && criteria.progressMap) {
        const progress = criteria.progressMap.get(t.id);
        const status = progress?.status || 'unmastered';
        if (!criteria.statuses.includes(status)) return false;
      }
      return true;
    });
  },

  /**
   * キーワード検索（英単語・日本語訳・解説に対して部分一致）
   */
  async search(query) {
    const all = await this.load();
    if (!query || !query.trim()) return all;

    const lowered = query.trim().toLowerCase();
    return all.filter(t =>
      t.english.toLowerCase().includes(lowered) ||
      t.japanese.includes(query.trim()) ||
      (t.description && t.description.includes(query.trim()))
    );
  },

  /**
   * 全カテゴリ一覧を取得（実データに基づく）
   */
  async getCategories() {
    const all = await this.load();
    return Array.from(new Set(all.map(t => t.category)));
  },

  /**
   * 指定カテゴリのサブカテゴリ一覧を取得
   */
  async getSubcategories(category) {
    const all = await this.load();
    const subs = all
      .filter(t => !category || t.category === category)
      .map(t => t.subcategory);
    return Array.from(new Set(subs));
  },

  /**
   * ランダムサンプリング（学習モードで使用）
   * @param count 取得したい用語数
   * @param criteria フィルタ条件（filterと同じ）
   */
  async getRandomSample(count, criteria = {}) {
    const filtered = await this.filter(criteria);
    if (filtered.length <= count) return _shuffle(filtered);

    const shuffled = _shuffle(filtered);
    return shuffled.slice(0, count);
  }
};

/**
 * 配列をシャッフル（Fisher-Yates）
 */
function _shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 現在のページからルートまでの相対パスを解決
 * （pages/ サブディレクトリにある場合は ../ を付ける）
 */
function _resolvePath(relativePath) {
  // 現在のURL pathnameを見て、pages/にいるかを判定
  const path = window.location.pathname;
  if (path.includes('/pages/')) {
    return '../' + relativePath;
  }
  return relativePath;
}

window.words = words;

// ----- カテゴリ・サブカテゴリ・難易度のラベル変換 -----

const CATEGORY_LABELS = {
  financial_accounting: '財務会計',
  management_accounting: '管理会計',
  audit_governance: '監査・ガバナンス',
  common: '共通用語'
};

const SUBCATEGORY_LABELS = {
  fs_overview: '財務諸表全体',
  income_statement: '損益計算書',
  comprehensive_income: '包括利益計算書',
  balance_sheet_assets: '貸借対照表（資産）',
  balance_sheet_liabilities: '貸借対照表（負債）',
  balance_sheet_equity: '貸借対照表（資本）',
  cash_flow_statement: 'キャッシュフロー計算書',
  changes_in_equity: '持分変動計算書',
  notes_policies: '注記・会計方針',
  revenue_recognition: '収益認識',
  financial_instruments: '金融商品',
  inventory: '棚卸資産',
  ppe_intangibles: '固定資産',
  consolidation: '連結会計',
  cost_accounting: '原価計算',
  standard_costing: '標準原価計算',
  cvp_analysis: 'CVP分析',
  budgeting: '予算管理',
  performance_evaluation: '業績評価',
  investment_decision: '投資意思決定',
  decision_making: '意思決定会計',
  audit_basics: '監査基本概念',
  audit_procedures: '監査手続',
  internal_control: '内部統制',
  corporate_governance: 'コーポレートガバナンス',
  risk_management: 'リスクマネジメント',
  conceptual_framework: '概念フレームワーク',
  basic_concepts: '基本会計概念',
  international_standards: '国際会計基準'
};

const LEVEL_LABELS = {
  beginner: '初級',
  basic: '基礎',
  intermediate: '中級',
  advanced: '上級'
};

// UI上の難易度表示は3段階に集約（要件定義書 v3.2 4.2節）
const LEVEL_DISPLAY_LABELS = {
  beginner: 'やさしい',
  basic: 'やさしい',
  intermediate: 'ふつう',
  advanced: 'むずかしい'
};

// UI表示3段階 -> 内部4段階へのマッピング
const LEVEL_DISPLAY_TO_INTERNAL = {
  easy: ['beginner', 'basic'],
  normal: ['intermediate'],
  hard: ['advanced']
};

window.CATEGORY_LABELS = CATEGORY_LABELS;
window.SUBCATEGORY_LABELS = SUBCATEGORY_LABELS;
window.LEVEL_LABELS = LEVEL_LABELS;
window.LEVEL_DISPLAY_LABELS = LEVEL_DISPLAY_LABELS;
window.LEVEL_DISPLAY_TO_INTERNAL = LEVEL_DISPLAY_TO_INTERNAL;
