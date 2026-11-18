/* The API enforces identity and tenant membership. Browser state grants no access. */
(() => {
  const runtime = window.COLDLINE_SITE?.runtime;
  if (!runtime?.enabled || runtime.origin !== location.origin) return;
  const client = window.COLDLINE_WORKSPACE = {
    enabled: true, session: null, version: null,
    async request(path, options = {}) {
      const response = await fetch('/api/' + path, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
      let body; try { body = await response.json(); } catch { const error = new Error(response.status === 401 ? 'Sign in with your organization account.' : 'The workspace service is unavailable. Try again shortly.'); error.status = response.status; throw error; }
      if (!response.ok) { const error = new Error(body.error || 'This request could not be completed.'); error.status = response.status; throw error; }
      return body;
    },
    async load() {
      this.session = await this.request('session');
      const state = await this.request('records');
      this.version = state.version;
      return state.records;
    },
    async save(records) {
      const headers = this.version ? { 'If-Match': this.version } : { 'If-None-Match': '*' };
      const state = await this.request('records', { method: 'PUT', headers, body: JSON.stringify({ records }) });
      this.version = state.version;
      return state.records;
    },
    canWrite() { return this.session?.roles.some(role => ['admin', 'operator', 'reviewer'].includes(role)); }
  };
  if (document.body.dataset.page === 'dashboard') document.body.classList.add('workspace-loading');
})();
