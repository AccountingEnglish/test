/**
 * word-list.js
 *
 * ============================================================================
 * 単語一覧画面のロジック
 * ============================================================================
 *
 * 機能:
 * - 全用語の表示（仮想スクロールなし、当面は数百語程度を想定）
 * - フィルタチップでカテゴリ・難易度・学習状況を切り替え
 * - 検索ボックスで部分一致検索
 * - チェックボックスで複数選択 → 印刷プレビューへ
 *
 * セッションストレージで選択状態を一時保存し、印刷ページに引き継ぐ
 */

// 選択中のフィルタ
const filterState = {
  category: 'all',          // 'all' | カテゴリID
  level: 'all',             // 'all' | 'easy' | 'normal' | 'hard'
  status: 'all',            // 'all' | 'mastered' | 'unmastered'
  query: ''                 // 検索クエリ
};

// 選択中の用語ID（Set）
const selectedIds = new Set();

// データキャッシュ
let allTerms = [];
let progressMap = new Map();

// ----- 初期化 -----
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await storage.init();
    allTerms = await words.getAll();
    progressMap = await progress.getAllProgress();

    renderFilterChips();
    renderList();
    bindEvents();
  } catch (error) {
    console.error('初期化エラー:', error);
    document.getElementById('wordList').innerHTML =
      '<div class="empty-state-msg">データの読み込みに失敗しました</div>';
  }
});

// ----- フィルターチップの描画 -----
function renderFilterChips() {
  const filterBar = document.getElementById('filterBar');
  const categories = Array.from(new Set(allTerms.map(t => t.category)));

  const chips = [
    { type: 'category', value: 'all', label: 'すべて' },
    ...categories.map(c => ({
      type: 'category',
      value: c,
      label: CATEGORY_LABELS[c] || c
    })),
    { type: 'level', value: 'easy', label: 'やさしい' },
    { type: 'level', value: 'normal', label: 'ふつう' },
    { type: 'level', value: 'hard', label: 'むずかしい' },
    { type: 'status', value: 'mastered', label: '習得済み' },
    { type: 'status', value: 'unmastered', label: '未習得' }
  ];

  filterBar.innerHTML = chips.map(chip => {
    const isActive = filterState[chip.type] === chip.value;
    const cls = isActive ? 'filter-chip filter-chip--active' : 'filter-chip';
    return `<button class="${cls}" data-type="${chip.type}" data-value="${chip.value}">${ui.escapeHtml(chip.label)}</button>`;
  }).join('');

  // クリックハンドラ
  filterBar.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const { type, value } = chip.dataset;
      // すでに選択中の同じ値を押したらリセット
      if (filterState[type] === value && value !== 'all') {
        filterState[type] = 'all';
      } else {
        filterState[type] = value;
      }
      renderFilterChips();
      renderList();
    });
  });
}

// ----- リストの描画 -----
function renderList() {
  const listEl = document.getElementById('wordList');
  const filtered = applyFilters(allTerms);

  // ツールバーの件数表示
  const toolbarCount = document.getElementById('toolbarCount');
  toolbarCount.textContent = `${filtered.length}語${selectedIds.size > 0 ? ` / ${selectedIds.size}件選択中` : ''}`;

  // 印刷ボタン状態
  const printBtn = document.getElementById('printBtn');
  printBtn.disabled = selectedIds.size === 0;

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="empty-state-msg">該当する単語がありません</div>';
    return;
  }

  listEl.innerHTML = filtered.map(term => renderWordItem(term)).join('');

  // クリックハンドラ
  listEl.querySelectorAll('.word-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      if (selectedIds.has(id)) {
        selectedIds.delete(id);
      } else {
        selectedIds.add(id);
      }
      updateSelection();
    });
  });
}

// ----- 単語1件の描画 -----
function renderWordItem(term) {
  const p = progressMap.get(term.id);
  const status = p?.status || 'unmastered';
  const recentAnswers = p?.recentAnswers || [];
  const isSelected = selectedIds.has(term.id);

  const checkClass = isSelected ? 'word-item__check word-item__check--checked' : 'word-item__check';
  const checkContent = isSelected ? '✓' : '';

  // 直近5回のドット
  const dots = [];
  for (let i = 0; i < 5; i++) {
    const ans = recentAnswers[i];
    if (ans === undefined) {
      dots.push('<span class="word-item__dot"></span>');
    } else if (ans === true) {
      dots.push('<span class="word-item__dot word-item__dot--correct"></span>');
    } else {
      dots.push('<span class="word-item__dot word-item__dot--incorrect"></span>');
    }
  }

  // ステータスラベル
  let statusLabel = '未習得';
  let statusClass = '';
  if (status === 'mastered') {
    statusLabel = '習得済み';
    statusClass = 'word-item__status-label--mastered';
  } else if (recentAnswers.length > 0) {
    statusLabel = '学習中';
    statusClass = 'word-item__status-label--learning';
  }

  return `
    <div class="word-item" data-id="${term.id}">
      <div class="${checkClass}">${checkContent}</div>
      <div class="word-item__body">
        <div class="word-item__english">${ui.escapeHtml(term.english)}</div>
        <div class="word-item__japanese">${ui.escapeHtml(term.japanese)}</div>
        <div class="word-item__meta">
          <span class="badge">${ui.escapeHtml(CATEGORY_LABELS[term.category] || term.category)}</span>
          <span class="badge">${ui.escapeHtml(LEVEL_LABELS[term.level] || term.level)}</span>
        </div>
      </div>
      <div class="word-item__status">
        <div class="word-item__status-dots">${dots.join('')}</div>
        <span class="word-item__status-label ${statusClass}">${statusLabel}</span>
      </div>
    </div>
  `;
}

// ----- フィルタ適用 -----
function applyFilters(terms) {
  let result = terms;

  // カテゴリ
  if (filterState.category !== 'all') {
    result = result.filter(t => t.category === filterState.category);
  }

  // 難易度（UI表示3段階 -> 内部4段階）
  if (filterState.level !== 'all') {
    const internalLevels = LEVEL_DISPLAY_TO_INTERNAL[filterState.level] || [];
    result = result.filter(t => internalLevels.includes(t.level));
  }

  // 学習状況
  if (filterState.status !== 'all') {
    result = result.filter(t => {
      const p = progressMap.get(t.id);
      const status = p?.status || 'unmastered';
      return status === filterState.status;
    });
  }

  // 検索クエリ
  if (filterState.query.trim()) {
    const lowered = filterState.query.trim().toLowerCase();
    const original = filterState.query.trim();
    result = result.filter(t =>
      t.english.toLowerCase().includes(lowered) ||
      t.japanese.includes(original) ||
      (t.description && t.description.includes(original))
    );
  }

  return result;
}

// ----- 選択状態の更新 -----
function updateSelection() {
  // チェックボックスの再描画は、リスト全体の再描画を避けて部分更新
  document.querySelectorAll('.word-item').forEach(item => {
    const id = item.dataset.id;
    const check = item.querySelector('.word-item__check');
    if (selectedIds.has(id)) {
      check.classList.add('word-item__check--checked');
      check.textContent = '✓';
    } else {
      check.classList.remove('word-item__check--checked');
      check.textContent = '';
    }
  });

  // 印刷バーの表示切替
  const printBar = document.getElementById('printBar');
  const selectedCount = document.getElementById('selectedCount');
  const printBtn = document.getElementById('printBtn');
  const toolbarCount = document.getElementById('toolbarCount');

  selectedCount.textContent = `${selectedIds.size}件選択中`;
  printBtn.disabled = selectedIds.size === 0;

  if (selectedIds.size > 0) {
    printBar.classList.remove('print-action-bar--hidden');
  } else {
    printBar.classList.add('print-action-bar--hidden');
  }

  // ツールバーの件数を更新
  const filtered = applyFilters(allTerms);
  toolbarCount.textContent = `${filtered.length}語${selectedIds.size > 0 ? ` / ${selectedIds.size}件選択中` : ''}`;
}

// ----- イベントバインディング -----
function bindEvents() {
  // 検索入力（debounce 200ms）
  const searchInput = document.getElementById('searchInput');
  let searchTimer = null;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      filterState.query = e.target.value;
      renderList();
      updateSelection(); // チェック状態を維持
    }, 200);
  });

  // 印刷へ→ボタン（ツールバー）
  document.getElementById('printBtn').addEventListener('click', goToPrintView);

  // 印刷プレビューボタン（フローティングバー）
  document.getElementById('goToPrintBtn').addEventListener('click', goToPrintView);
}

// ----- 印刷ページに遷移（選択IDをsessionStorageで渡す） -----
function goToPrintView() {
  if (selectedIds.size === 0) return;
  const ids = Array.from(selectedIds);
  sessionStorage.setItem('printTargetIds', JSON.stringify(ids));
  window.location.href = 'print-view.html';
}
