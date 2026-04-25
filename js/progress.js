/**
 * progress.js
 *
 * ============================================================================
 * 学習進捗の管理
 * ============================================================================
 *
 * 設計意図:
 * - 要件定義書 v3.2 4.6節「学習進捗判定ロジック」の実装
 * - 状態は「未習得 / 習得済み」の2段階
 * - storage.js を経由してデータを永続化
 *
 * 公開API:
 *   progress.recordAnswer(termId, correct)  - 解答を記録（4択・スペル並べ用）
 *   progress.recordSelfReportedSkip(termId) - 自己申告スキップを記録（カードめくり用）
 *   progress.getStatus(termId)              - 1用語の現在状態を取得
 *   progress.getAllProgress()               - 全進捗をMap形式で取得
 *   progress.getOverallStats()              - 全体統計を取得
 *   progress.getCategoryStats(allTerms)     - カテゴリ別の統計を取得
 *   progress.getRecentActivity(days)        - 直近N日間の学習量
 */

const RECENT_ANSWERS_LIMIT = 5;        // 直近何回の正解状況を保持するか
const CONSECUTIVE_THRESHOLD = 3;       // 連続正解で習得とみなす数
const ACCURACY_MIN_ATTEMPTS = 5;       // 通算正解率判定に必要な最小出題数
const ACCURACY_THRESHOLD = 0.9;        // 通算正解率の閾値（90%）
const SELF_REPORT_DAYS_THRESHOLD = 3;  // 自己申告で習得とみなす日数

const progress = {
  /**
   * 解答を記録する（4択クイズ・スペル並べモードから呼ばれる）
   * @returns 更新後の進捗オブジェクト
   */
  async recordAnswer(termId, correct) {
    const current = await storage.getProgress(termId);
    const now = new Date().toISOString();
    const today = _todayString();

    const updated = {
      ...current,
      totalAnswered: current.totalAnswered + 1,
      totalCorrect: current.totalCorrect + (correct ? 1 : 0),
      recentAnswers: [...current.recentAnswers, correct].slice(-RECENT_ANSWERS_LIMIT),
      consecutiveCorrect: correct ? current.consecutiveCorrect + 1 : 0,
      firstAnsweredAt: current.firstAnsweredAt || now,
      lastAnsweredAt: now
    };

    // 習得判定
    const wasMastered = current.status === 'mastered';
    const isNowMastered = _evaluateMastered(updated);
    updated.status = isNowMastered ? 'mastered' : 'unmastered';
    if (!wasMastered && isNowMastered) {
      updated.masteredAt = now;
    }

    await storage.saveProgress(termId, updated);
    await _updateGlobalStats(correct, today);

    return updated;
  },

  /**
   * 自己申告スキップを記録する（カードめくりの「もう知ってる」ボタン）
   * 同日の重複は無効。3つの異なる日で習得済みになる。
   */
  async recordSelfReportedSkip(termId) {
    const current = await storage.getProgress(termId);
    const today = _todayString();
    const days = current.selfReportedSkipDays;

    // 既にこの日にスキップしていたら何もしない
    if (days.includes(today)) {
      return current;
    }

    const updated = {
      ...current,
      selfReportedSkipDays: [...days, today]
    };

    const wasMastered = current.status === 'mastered';
    const isNowMastered = _evaluateMastered(updated);
    updated.status = isNowMastered ? 'mastered' : 'unmastered';
    if (!wasMastered && isNowMastered) {
      updated.masteredAt = new Date().toISOString();
    }

    await storage.saveProgress(termId, updated);
    return updated;
  },

  /**
   * 1用語の現在状態を取得
   */
  async getStatus(termId) {
    return await storage.getProgress(termId);
  },

  /**
   * 全進捗を取得（Map形式）
   */
  async getAllProgress() {
    return await storage.getAllProgress();
  },

  /**
   * 全体統計を取得
   */
  async getOverallStats() {
    const stats = await storage.getStats();
    const allProgress = await storage.getAllProgress();

    let masteredCount = 0;
    allProgress.forEach(p => {
      if (p.status === 'mastered') masteredCount++;
    });

    return {
      ...stats,
      masteredCount,
      learningCount: allProgress.size - masteredCount,
      // 連続学習日数は統計から計算
      streakDays: _calculateStreak(stats.dailyActivity || {}),
      accuracy: stats.totalAnswered > 0
        ? stats.totalCorrect / stats.totalAnswered
        : 0
    };
  },

  /**
   * カテゴリ別統計を取得
   * @param allTerms 全用語のリスト（words.getAll()の結果）
   */
  async getCategoryStats(allTerms) {
    const allProgress = await storage.getAllProgress();
    const result = {};

    allTerms.forEach(term => {
      if (!result[term.category]) {
        result[term.category] = { total: 0, mastered: 0 };
      }
      result[term.category].total++;
      const p = allProgress.get(term.id);
      if (p?.status === 'mastered') {
        result[term.category].mastered++;
      }
    });

    return result;
  },

  /**
   * 直近N日間の学習量を取得（進捗画面のグラフ用）
   * @returns 日付ラベル順の配列 [{ date, count, isToday }, ...]
   */
  async getRecentActivity(days = 7) {
    const stats = await storage.getStats();
    const dailyActivity = stats.dailyActivity || {};
    const today = new Date();
    const result = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = _formatDate(d);
      result.push({
        date: dateStr,
        dayLabel: i === 0 ? '今日' : ['日', '月', '火', '水', '木', '金', '土'][d.getDay()],
        count: dailyActivity[dateStr] || 0,
        isToday: i === 0
      });
    }

    return result;
  }
};

/**
 * 習得済みかどうかを判定
 * 要件定義書 v3.2 4.6節の3条件:
 * 1. 直近3回連続正解
 * 2. 通算5回以上で正解率90%以上
 * 3. 自己申告スキップ3日
 */
function _evaluateMastered(termProgress) {
  // 条件1: 連続正解
  if (termProgress.consecutiveCorrect >= CONSECUTIVE_THRESHOLD) {
    return true;
  }

  // 条件2: 通算正解率
  if (termProgress.totalAnswered >= ACCURACY_MIN_ATTEMPTS) {
    const accuracy = termProgress.totalCorrect / termProgress.totalAnswered;
    if (accuracy >= ACCURACY_THRESHOLD) return true;
  }

  // 条件3: 自己申告スキップ
  if (termProgress.selfReportedSkipDays.length >= SELF_REPORT_DAYS_THRESHOLD) {
    return true;
  }

  return false;
}

/**
 * 全体統計を更新
 */
async function _updateGlobalStats(correct, today) {
  const stats = await storage.getStats();

  stats.totalAnswered++;
  if (correct) stats.totalCorrect++;

  // 日別アクティビティを更新
  if (!stats.dailyActivity) stats.dailyActivity = {};
  stats.dailyActivity[today] = (stats.dailyActivity[today] || 0) + 1;

  // 古いデータを削除（直近30日分のみ保持）
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = _formatDate(cutoff);
  Object.keys(stats.dailyActivity).forEach(date => {
    if (date < cutoffStr) delete stats.dailyActivity[date];
  });

  // 学習日数を更新（重複なしの日数カウント）
  const learningDates = Object.keys(stats.dailyActivity);
  stats.learningDays = learningDates.length;
  stats.lastActiveDate = today;

  await storage.saveStats(stats);
}

/**
 * 連続学習日数を計算
 */
function _calculateStreak(dailyActivity) {
  if (!dailyActivity || Object.keys(dailyActivity).length === 0) return 0;

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = _formatDate(d);
    if (dailyActivity[dateStr]) {
      streak++;
    } else {
      // 今日がアクティブでなくても、昨日からカウント開始するので最初の1日はスキップ
      if (i === 0) continue;
      break;
    }
  }
  return streak;
}

/**
 * 今日の日付文字列（YYYY-MM-DD）
 */
function _todayString() {
  return _formatDate(new Date());
}

/**
 * Date -> YYYY-MM-DD
 */
function _formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

window.progress = progress;
