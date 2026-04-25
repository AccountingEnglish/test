/**
 * ui.js
 *
 * ============================================================================
 * 共通UIユーティリティ
 * ============================================================================
 *
 * 公開API:
 *   ui.toast(message, type)           - トースト通知（type: 'info'|'success'|'error'）
 *   ui.confirm(message)                - 確認ダイアログ（async/awaitで使用）
 *   ui.alert(message)                  - アラートダイアログ
 *   ui.escapeHtml(str)                 - HTMLエスケープ（XSS対策）
 *   ui.formatNumber(num)               - 数値の3桁区切り
 *   ui.go(path)                        - ページ遷移（パス解決込み）
 */

const ui = {
  /**
   * トースト通知を表示
   */
  toast(message, type = 'info', durationMs = 2500) {
    // 既存のトーストがあれば削除
    const existing = document.querySelector('.app-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `app-toast app-toast--${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: calc(var(--tab-bar-height, 64px) + 16px);
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 20px;
      background-color: var(--color-text);
      color: white;
      border-radius: 24px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 9999;
      max-width: calc(100vw - 32px);
      text-align: center;
      animation: toast-in 200ms ease-out;
    `;

    if (type === 'success') {
      toast.style.backgroundColor = 'var(--color-success)';
    } else if (type === 'error') {
      toast.style.backgroundColor = 'var(--color-error)';
    }

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 200ms ease-out';
      setTimeout(() => toast.remove(), 200);
    }, durationMs);
  },

  /**
   * 確認ダイアログ（カスタム実装ではなくブラウザ標準を使用、シンプルさ優先）
   */
  async confirm(message) {
    return window.confirm(message);
  },

  /**
   * アラートダイアログ
   */
  alert(message) {
    window.alert(message);
  },

  /**
   * HTMLエスケープ（XSS対策・必須）
   */
  escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /**
   * 3桁区切り数値
   */
  formatNumber(num) {
    return Number(num).toLocaleString('ja-JP');
  },

  /**
   * ページ遷移（pages配下からのパス解決）
   */
  go(path) {
    // pages/ にいる場合の相対遷移
    const currentPath = window.location.pathname;
    if (currentPath.includes('/pages/')) {
      // pages内→ pages内の遷移はそのまま
      if (path.startsWith('pages/')) {
        path = path.replace('pages/', '');
      }
      // pages内→ ルート遷移は ../
      if (path === 'index.html' || path === '/' || path === '') {
        path = '../index.html';
      }
    }
    window.location.href = path;
  }
};

window.ui = ui;
