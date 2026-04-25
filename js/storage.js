/**
 * storage.js
 *
 * ============================================================================
 * データ永続化の抽象化レイヤー（Repository Pattern）
 * ============================================================================
 *
 * 設計意図:
 * - ここを経由してのみデータアクセスを行う
 * - 第一弾: IndexedDBに直接保存
 * - 将来: この内部実装をfetch APIに差し替えるだけで、サーバー連携可能になる
 * - 呼び出し側のコードは変更不要（要件定義書 v3.2 6.3節 Repository Pattern）
 *
 * 公開API:
 *   storage.init()                          - DB初期化
 *   storage.getProgress(termId)             - 1用語の学習進捗を取得
 *   storage.getAllProgress()                - 全用語の学習進捗を取得
 *   storage.saveProgress(termId, progress)  - 学習進捗を保存
 *   storage.getStats()                      - 全体統計を取得
 *   storage.saveStats(stats)                - 全体統計を保存
 *   storage.getMeta()                       - ユーザーメタ情報（userId等）を取得
 *   storage.resetAll()                      - 全データをリセット
 *   storage.exportAll()                     - 全データをJSON形式でエクスポート
 */

const STORAGE_DB_NAME = 'AccountingVocabApp';
const STORAGE_DB_VERSION = 1;
const STORE_PROGRESS = 'progress';   // 用語ごとの進捗
const STORE_STATS = 'stats';         // 全体統計（単一レコード）
const STORE_META = 'meta';           // ユーザーメタ情報（userId等）

const SCHEMA_VERSION = 1;            // データスキーマのバージョン（将来マイグレーション用）

// シングルトンとしてのDB接続を保持
let _dbPromise = null;

/**
 * IndexedDBに接続する。初回はストアを作成。
 */
function _openDB() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(STORAGE_DB_NAME, STORAGE_DB_VERSION);

    request.onerror = () => reject(new Error('IndexedDBのオープンに失敗しました'));
    request.onsuccess = () => resolve(request.result);

    // スキーマ作成・マイグレーション
    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
        // 進捗ストア: termIdをキーとする
        db.createObjectStore(STORE_PROGRESS, { keyPath: 'termId' });
      }
      if (!db.objectStoreNames.contains(STORE_STATS)) {
        // 統計ストア: 単一レコードで'global'をキーとする
        db.createObjectStore(STORE_STATS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        // メタ情報ストア: 'user'をキーとする
        db.createObjectStore(STORE_META, { keyPath: 'id' });
      }
    };
  });

  return _dbPromise;
}

/**
 * 単一レコードの取得
 */
async function _getRecord(storeName, key) {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * ストア内の全レコード取得
 */
async function _getAllRecords(storeName) {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 単一レコードの保存（新規/更新）
 */
async function _putRecord(storeName, record) {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * ストアの全クリア
 */
async function _clearStore(storeName) {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * ランダムなゲストIDを生成
 */
function _generateGuestId() {
  const random = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now().toString(36);
  return `guest_${timestamp}_${random}`;
}

/**
 * 公開オブジェクト
 */
const storage = {
  /**
   * 初期化。初回起動時のメタ情報セットアップ等を行う。
   */
  async init() {
    let meta = await _getRecord(STORE_META, 'user');

    if (!meta) {
      // 初回起動: ユーザーメタ情報を作成
      meta = {
        id: 'user',
        userId: _generateGuestId(),
        schemaVersion: SCHEMA_VERSION,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await _putRecord(STORE_META, meta);
    }

    return meta;
  },

  /**
   * 1用語の学習進捗を取得
   * @returns 進捗オブジェクト、または初期値
   */
  async getProgress(termId) {
    const record = await _getRecord(STORE_PROGRESS, termId);
    if (record) return record;

    // 初期値
    return {
      termId,
      status: 'unmastered',
      totalAnswered: 0,
      totalCorrect: 0,
      recentAnswers: [],
      consecutiveCorrect: 0,
      selfReportedSkipDays: [],
      firstAnsweredAt: null,
      lastAnsweredAt: null,
      masteredAt: null
    };
  },

  /**
   * 全用語の学習進捗を取得
   * @returns Map<termId, progress>
   */
  async getAllProgress() {
    const records = await _getAllRecords(STORE_PROGRESS);
    const map = new Map();
    records.forEach(r => map.set(r.termId, r));
    return map;
  },

  /**
   * 学習進捗を保存
   */
  async saveProgress(termId, progress) {
    const record = { ...progress, termId };
    await _putRecord(STORE_PROGRESS, record);
  },

  /**
   * 全体統計を取得
   */
  async getStats() {
    const record = await _getRecord(STORE_STATS, 'global');
    if (record) return record;

    return {
      id: 'global',
      totalAnswered: 0,
      totalCorrect: 0,
      learningDays: 0,
      lastActiveDate: null,
      dailyActivity: {}
    };
  },

  /**
   * 全体統計を保存
   */
  async saveStats(stats) {
    const record = { ...stats, id: 'global' };
    await _putRecord(STORE_STATS, record);
  },

  /**
   * ユーザーメタ情報を取得
   */
  async getMeta() {
    return await _getRecord(STORE_META, 'user');
  },

  /**
   * 全データをリセット
   */
  async resetAll() {
    await _clearStore(STORE_PROGRESS);
    await _clearStore(STORE_STATS);
    await _clearStore(STORE_META);
    // 次回 init() でメタが再作成される
  },

  /**
   * 全データをJSON形式でエクスポート（ユーザーがデータを持ち帰れる権利のため）
   */
  async exportAll() {
    const meta = await this.getMeta();
    const progress = await this.getAllProgress();
    const stats = await this.getStats();

    return {
      exportedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      meta,
      progress: Array.from(progress.values()),
      stats
    };
  }
};

// グローバル公開
window.storage = storage;
