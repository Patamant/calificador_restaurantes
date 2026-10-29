/* Capa de acceso a datos: Google Apps Script (producción) o almacenamiento local (modo demostración). */
(function () {
  const CFG = window.APP_CONFIG;
  const DEMO = !CFG.API_URL;
  const LS_DB = 'finav_demo_db_v1';

  async function remoteGet(params) {
    const url = new URL(CFG.API_URL);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
    if (!res.ok) throw new Error('Error HTTP ' + res.status);
    return res.json();
  }

  async function remotePost(body) {
    // text/plain evita la verificación CORS previa (preflight) que Apps Script no admite.
    const res = await fetch(CFG.API_URL, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('Error HTTP ' + res.status);
    return res.json();
  }

  function check(r) {
    if (!r || !r.ok) {
      const err = new Error((r && r.error) || 'Respuesta inválida del servidor');
      err.code = r && r.code;
      throw err;
    }
    return r;
  }

  // ---------- Modo demostración ----------
  function db() { try { return JSON.parse(localStorage.getItem(LS_DB)) || { evals: {} }; } catch (e) { return { evals: {} }; } }
  function saveDb(d) { localStorage.setItem(LS_DB, JSON.stringify(d)); }
  const pad = n => String(n).padStart(2, '0');
  function stamp(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  const demo = {
    async ping(key) { if (!key) throw new Error('Ingrese una clave'); return { ok: true, version: 'demo' }; },
    async catalog() { return { ok: true, catalog: window.DEMO_CATALOG, config: {} }; },
    async list() {
      return { ok: true, evaluations: Object.values(db().evals).map(e => ({
        id: e.evaluation.id, estado: e.evaluation.estado, restaurante: e.evaluation.restaurante,
        fecha: e.evaluation.fecha, evaluador: e.evaluation.evaluador, indiceOp: e.results.indiceOp,
        indiceAdq: e.results.indiceAdq, dictamenAdq: e.results.dictamenAdq, actualizado: e.evaluation.actualizado
      })).sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado))) };
    },
    async get(id) {
      const e = db().evals[id];
      if (!e) return { ok: false, error: 'Evaluación no encontrada' };
      return { ok: true, evaluation: e.evaluation, items: e.items };
    },
    async save(payload) {
      const d = db(); const now = stamp();
      const id = payload.evaluation.id || 'EV-' + now.replace(/[-: ]/g, '').slice(0, 14) + '-' + Math.floor(Math.random() * 900 + 100);
      payload.evaluation.id = id; payload.evaluation.actualizado = now;
      d.evals[id] = payload; saveDb(d);
      return { ok: true, id, actualizado: now };
    },
    async remove(id) { const d = db(); delete d.evals[id]; saveDb(d); return { ok: true }; }
  };

  // ---------- API pública ----------
  window.Api = {
    isDemo: DEMO,
    key: () => sessionStorage.getItem('finav_key') || '',
    setKey: k => sessionStorage.setItem('finav_key', k),
    clearKey: () => sessionStorage.removeItem('finav_key'),
    async ping(key) { return check(DEMO ? await demo.ping(key) : await remoteGet({ action: 'ping', key })); },
    async catalog() { return check(DEMO ? await demo.catalog() : await remoteGet({ action: 'catalog', key: this.key() })); },
    async list() { return check(DEMO ? await demo.list() : await remoteGet({ action: 'list', key: this.key() })); },
    async get(id) { return check(DEMO ? await demo.get(id) : await remoteGet({ action: 'get', id, key: this.key() })); },
    async save(payload) {
      return check(DEMO ? await demo.save(payload) : await remotePost(Object.assign({ action: 'save', key: this.key() }, payload)));
    },
    async remove(id) { return check(DEMO ? await demo.remove(id) : await remotePost({ action: 'delete', id, key: this.key() })); }
  };
})();
