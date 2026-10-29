/* FINAV · Matriz de Evaluación de Restaurantes – lógica de la interfaz */
(function () {
  const CFG = window.APP_CONFIG;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BACKUP = 'finav_backup_v1';

  const S = {
    catalog: [], cfg: Object.assign({}, CFG.DEFAULTS), categories: [],
    ev: null, answers: {}, catIdx: 0, dirty: false, charts: {}, result: null
  };

  // ---------------- utilidades ----------------
  const fmtPct = v => (v === null || v === undefined || v === '' || isNaN(v)) ? '—' : (Number(v) * 100).toFixed(1) + '%';
  const fmtMoney = v => new Intl.NumberFormat(CFG.LOCALE, { style: 'currency', currency: CFG.CURRENCY, maximumFractionDigits: 0 }).format(Number(v) || 0);
  const lvlClass = l => 'lvl lvl-' + (l === 'Sin brecha' ? 'Sin' : l === 'N/A' ? 'NA' : l);
  const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };

  function toast(msg, error) {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (error ? ' error' : ''); t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), error ? 6000 : 3000);
  }
  function busy(on, text) { $('#overlay').hidden = !on; if (text) $('#overlay-text').textContent = text; }
  function handleErr(e) {
    console.error(e);
    if (e.code === 'AUTH') { toast('Sesión no válida. Ingrese nuevamente la clave.', true); logout(); return; }
    toast('Error: ' + (e.message || e), true);
  }

  function setDirty(v) {
    S.dirty = v;
    const el = $('#save-state');
    el.textContent = v ? 'Cambios sin guardar' : (S.ev && S.ev.actualizado ? 'Guardado ' + S.ev.actualizado : '');
    el.classList.toggle('dirty', v);
    if (v) backup(); else localStorage.removeItem(BACKUP);
  }
  function backup() {
    try { localStorage.setItem(BACKUP, JSON.stringify({ ev: S.ev, answers: S.answers, at: Date.now() })); } catch (e) { /* lleno */ }
  }

  // ---------------- arranque / login ----------------
  async function init() {
    if (Api.isDemo) { $('#demo-note').hidden = false; $('#demo-badge').hidden = false; }
    $('#login-form').addEventListener('submit', onLogin);
    $('#btn-logout').onclick = () => { if (!S.dirty || confirm('Hay cambios sin guardar. ¿Salir de todos modos?')) logout(); };
    $('#btn-home').onclick = $('#go-home').onclick = () => goHome();
    $('#btn-new').onclick = newEval;
    $('#btn-save').onclick = $('#btn-save-2').onclick = () => save();
    $('#btn-finalize').onclick = finalize;
    $('#btn-pdf').onclick = downloadPdf;
    $('#btn-prev-cat').onclick = () => selectCat(S.catIdx - 1);
    $('#btn-next-cat').onclick = () => selectCat(S.catIdx + 1);
    $('#only-pending').onchange = renderItems;
    $$('.tab').forEach(b => (b.onclick = () => showTab(b.dataset.tab)));
    $$('[data-goto]').forEach(b => (b.onclick = () => showTab(b.dataset.goto)));
    $('#form-datos').addEventListener('input', e => {
      if (!S.ev) return; S.ev[e.target.name] = e.target.value; setDirty(true); updateHeader();
    });
    $('#item-list').addEventListener('click', onRateClick);
    $('#item-list').addEventListener('input', onItemInput);
    $('#plan-table').addEventListener('change', onPlanInput);
    $('#eval-list').addEventListener('click', onListClick);
    window.addEventListener('beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

    if (Api.key()) {
      try { busy(true, 'Conectando…'); await afterLogin(); } catch (e) { busy(false); Api.clearKey(); showLogin(); handleErr(e); }
    } else showLogin();
  }

  function showLogin() { $('#view-login').hidden = false; $('#app').hidden = true; $('#login-key').focus(); }

  async function onLogin(ev) {
    ev.preventDefault();
    const key = $('#login-key').value.trim();
    $('#login-error').hidden = true;
    try {
      busy(true, 'Validando acceso…');
      await Api.ping(key);
      Api.setKey(key);
      await afterLogin();
    } catch (e) {
      busy(false);
      $('#login-error').textContent = e.code === 'AUTH' ? 'Clave incorrecta.' : 'No se pudo conectar: ' + e.message;
      $('#login-error').hidden = false;
    }
  }

  async function afterLogin() {
    const r = await Api.catalog();
    S.catalog = r.catalog.map(it => Object.assign({}, it, { impOp: Number(it.impOp), impAdq: Number(it.impAdq) }));
    S.cfg = Object.assign({}, CFG.DEFAULTS, r.config || {});
    S.categories = [...new Set(S.catalog.map(i => i.categoria))];
    $('#view-login').hidden = true; $('#app').hidden = false;
    busy(false);
    const b = (() => { try { return JSON.parse(localStorage.getItem(BACKUP)); } catch (e) { return null; } })();
    if (b && b.ev && confirm(`Hay una evaluación con cambios sin guardar ("${b.ev.restaurante || 'sin nombre'}"). ¿Desea recuperarla?`)) {
      S.ev = b.ev; S.answers = b.answers || {}; openEditor('calificacion'); setDirty(true);
    } else { localStorage.removeItem(BACKUP); goHome(); }
  }

  function logout() { Api.clearKey(); S.dirty = false; location.reload(); }

  // ---------------- lista ----------------
  async function goHome() {
    if (S.dirty && !confirm('Hay cambios sin guardar. ¿Volver a la lista sin guardar?')) return;
    if (S.dirty) setDirty(false);
    $('#view-eval').hidden = true; $('#view-home').hidden = false;
    S.ev = null;
    try {
      busy(true, 'Cargando evaluaciones…');
      const r = await Api.list();
      const tb = $('#eval-list tbody');
      tb.innerHTML = r.evaluations.map(e => `<tr>
        <td><b>${esc(e.restaurante)}</b><div class="muted small">${esc(e.id)}</div></td>
        <td>${esc(e.fecha)}</td><td>${esc(e.evaluador)}</td>
        <td>${esc(e.estado)}</td><td class="num">${fmtPct(e.indiceAdq)}</td>
        <td>${esc(e.dictamenAdq)}</td><td class="small">${esc(e.actualizado)}</td>
        <td style="white-space:nowrap"><button class="btn-link" data-open="${esc(e.id)}">Abrir</button>
          <button class="btn-link" data-dash="${esc(e.id)}">Dashboard</button>
          <button class="btn-link danger" data-del="${esc(e.id)}">Eliminar</button></td></tr>`).join('');
      $('#eval-empty').hidden = r.evaluations.length > 0;
    } catch (e) { handleErr(e); } finally { busy(false); }
  }

  async function onListClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.open) return loadEval(b.dataset.open, 'calificacion');
    if (b.dataset.dash) return loadEval(b.dataset.dash, 'dashboard');
    if (b.dataset.del) {
      if (!confirm('¿Eliminar definitivamente esta evaluación? Esta acción no se puede deshacer.')) return;
      try { busy(true, 'Eliminando…'); await Api.remove(b.dataset.del); toast('Evaluación eliminada'); goHome(); }
      catch (err) { handleErr(err); } finally { busy(false); }
    }
  }

  async function loadEval(id, tab) {
    try {
      busy(true, 'Abriendo evaluación…');
      const r = await Api.get(id);
      S.ev = r.evaluation; S.answers = {};
      (r.items || []).forEach(it => {
        const a = {};
        ['calificacion', 'observaciones', 'costo', 'responsableAsignado', 'fechaCompromiso', 'estadoAccion'].forEach(k => {
          if (it[k] !== undefined && it[k] !== null && it[k] !== '') a[k] = it[k];
        });
        if (a.calificacion !== undefined) a.calificacion = String(a.calificacion);
        S.answers[it.id] = a;
      });
      openEditor(tab);
    } catch (e) { handleErr(e); } finally { busy(false); }
  }

  function newEval() {
    S.ev = { id: '', estado: 'Borrador', restaurante: '', direccion: '', ciudad: '', propietario: '',
      fecha: today(), evaluador: '', precio: '', conclusiones: '' };
    S.answers = {};
    openEditor('datos');
    setDirty(false);
  }

  // ---------------- editor ----------------
  function openEditor(tab) {
    $('#view-home').hidden = true; $('#view-eval').hidden = false;
    const f = $('#form-datos');
    ['restaurante', 'direccion', 'ciudad', 'propietario', 'fecha', 'evaluador', 'precio', 'conclusiones'].forEach(k => {
      f.elements[k].value = S.ev[k] ?? '';
    });
    S.catIdx = 0;
    renderCatNav(); renderItems(); updateHeader(); updateProgress();
    setDirty(false);
    showTab(tab || 'datos');
  }

  function updateHeader() {
    $('#eval-title').textContent = S.ev.restaurante || 'Nueva evaluación';
    $('#eval-sub').textContent = (S.ev.id ? S.ev.id + ' · ' : 'Sin guardar · ') + 'Estado: ' + (S.ev.estado || 'Borrador');
  }

  function showTab(name) {
    if (name !== 'datos' && !S.ev.restaurante) { toast('Ingrese primero el nombre del restaurante.', true); name = 'datos'; }
    $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    $$('.tab-panel').forEach(p => (p.hidden = p.id !== 'tab-' + name));
    if (name === 'dashboard') renderDashboard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const rated = id => S.answers[id] && S.answers[id].calificacion !== undefined && S.answers[id].calificacion !== '';

  function renderCatNav() {
    $('#cat-nav').innerHTML = S.categories.map((c, i) => {
      const its = S.catalog.filter(x => x.categoria === c), n = its.filter(x => rated(x.id)).length;
      return `<button class="cat-btn ${i === S.catIdx ? 'active' : ''} ${n === its.length ? 'done' : ''}" data-cat="${i}">
        <span>${esc(c)}</span><span class="count">${n}/${its.length}</span></button>`;
    }).join('');
    $$('.cat-btn').forEach(b => (b.onclick = () => selectCat(Number(b.dataset.cat))));
  }

  function selectCat(i) {
    if (i < 0 || i >= S.categories.length) { if (i >= S.categories.length) showTab('dashboard'); return; }
    S.catIdx = i; renderCatNav(); renderItems();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function itemCard(it) {
    const a = S.answers[it.id] || {};
    const r = Calc.computeItem(it, a, S.cfg);
    const btns = ['5', '4', '3', '2', '1', 'N/A'].map(v =>
      `<button type="button" data-v="${v}" class="${a.calificacion === v ? 'sel' : ''}" title="${{ '5': 'Excelente', '4': 'Bueno', '3': 'Regular', '2': 'Deficiente', '1': 'Crítico', 'N/A': 'No aplica' }[v]}">${v}</button>`).join('');
    return `<div class="item ${rated(it.id) ? 'rated' : ''}" data-id="${esc(it.id)}">
      <div class="item-top"><div>
        <div class="item-id">${esc(it.id)}</div>
        <div class="item-name">${esc(it.item)}</div>
        <p class="item-check">Verificar: ${esc(it.verificar)}</p></div>
        <div><span class="${lvlClass(r.prioridad)}" data-lvl>${esc(r.prioridad)}</span></div></div>
      <div class="tags"><span class="tag">Imp. operación ${it.impOp}</span><span class="tag">Imp. adquisición ${it.impAdq}</span>
        ${it.bloqueante ? '<span class="tag block">Bloqueante</span>' : ''}</div>
      <div class="rating">${btns}</div>
      <div class="item-inputs">
        <div><label>Observaciones / evidencia</label><textarea rows="2" data-f="observaciones" placeholder="Hallazgos, evidencia, fotos de referencia…">${esc(a.observaciones || '')}</textarea></div>
        <div><label>Costo est. corrección (USD)</label><input type="number" min="0" step="1" data-f="costo" value="${esc(a.costo ?? '')}"></div>
      </div></div>`;
  }

  function renderItems() {
    const cat = S.categories[S.catIdx];
    let its = S.catalog.filter(x => x.categoria === cat);
    if ($('#only-pending').checked) its = its.filter(x => !rated(x.id));
    $('#cat-title').textContent = cat;
    $('#item-list').innerHTML = its.length ? its.map(itemCard).join('') : '<div class="card empty">Todos los ítems de esta categoría están calificados.</div>';
    $('#btn-prev-cat').disabled = S.catIdx === 0;
    $('#btn-next-cat').textContent = S.catIdx === S.categories.length - 1 ? 'Ver dashboard →' : 'Siguiente categoría →';
  }

  function refreshCard(id) {
    const card = $(`.item[data-id="${CSS.escape(id)}"]`); if (!card) return;
    const it = S.catalog.find(x => x.id === id);
    const r = Calc.computeItem(it, S.answers[id], S.cfg);
    const lv = $('[data-lvl]', card); lv.className = lvlClass(r.prioridad); lv.textContent = r.prioridad;
    card.classList.toggle('rated', rated(id));
    $$('.rating button', card).forEach(b => b.classList.toggle('sel', b.dataset.v === (S.answers[id] || {}).calificacion));
  }

  function onRateClick(e) {
    const b = e.target.closest('.rating button'); if (!b) return;
    const id = b.closest('.item').dataset.id;
    const a = S.answers[id] = S.answers[id] || {};
    a.calificacion = a.calificacion === b.dataset.v ? '' : b.dataset.v;
    if (a.calificacion === '') delete a.calificacion;
    refreshCard(id); renderCatNav(); updateProgress(); setDirty(true);
  }

  function onItemInput(e) {
    const f = e.target.dataset.f; if (!f) return;
    const id = e.target.closest('.item').dataset.id;
    const a = S.answers[id] = S.answers[id] || {};
    a[f] = f === 'costo' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value;
    setDirty(true);
  }

  function updateProgress() {
    const n = S.catalog.filter(x => rated(x.id)).length, t = S.catalog.length;
    $('#progress-bar').style.width = (t ? (n / t) * 100 : 0) + '%';
    $('#progress-text').textContent = `${n} de ${t} ítems calificados (${t ? Math.round(n / t * 100) : 0}%)`;
  }

  // ---------------- dashboard ----------------
  function compute() { S.result = Calc.computeAll(S.catalog, S.answers, S.cfg); return S.result; }

  function dictClass(d) {
    if (['FAVORABLE', 'APTO'].includes(d)) return 'good';
    if (['CONDICIONADO', 'APTO CON PLAN'].includes(d)) return 'warn';
    if (['NO PROCEDER', 'DESFAVORABLE', 'NO APTO'].includes(d)) return 'bad';
    return '';
  }

  function renderDashboard() {
    const R = compute(), s = R.summary;
    const da = $('#dict-adq'), dop = $('#dict-op');
    da.className = 'dictamen ' + dictClass(s.dictamenAdq); $('strong', da).textContent = s.dictamenAdq; $('em', da).textContent = s.dictamenAdqTxt;
    dop.className = 'dictamen ' + dictClass(s.dictamenOp); $('strong', dop).textContent = s.dictamenOp; $('em', dop).textContent = s.dictamenOpTxt;
    const precio = Number(S.ev.precio) || 0;
    const k = [
      ['Índice operativo', fmtPct(s.indiceOp), 'condición para operar'],
      ['Índice adquisición', fmtPct(s.indiceAdq), 'condición para comprar'],
      ['Avance', Math.round(s.avance * 100) + '%', `${s.pendientes} pendientes`],
      ['Críticos / Altos', `${s.criticos} / ${s.altos}`, `${s.medios} medios`, s.criticos > 0],
      ['Bloqueantes', s.bloqueantes, 'incumplidos', s.bloqueantes > 0],
      ['Costo correcciones', fmtMoney(s.costoTotal), precio ? `${(s.costoTotal / precio * 100).toFixed(1)}% del precio` : `pre-cierre ${fmtMoney(s.costoPre)}`]
    ];
    $('#kpis').innerHTML = k.map(x => `<div class="kpi ${x[3] ? 'alert' : ''}"><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>`).join('');

    // tabla por categoría
    $('#cat-table').innerHTML = `<thead><tr><th>Categoría</th><th class="num">Ítems</th><th class="num">Calificados</th><th class="num">Índice op.</th>
      <th class="num">Índice adq.</th><th class="num">Críticos</th><th class="num">Altos</th><th class="num">Medios</th><th class="num">Bloq.</th>
      <th class="num">Costo</th><th>Estado</th></tr></thead><tbody>` +
      R.categories.map(c => `<tr><td>${esc(c.categoria)}</td><td class="num">${c.items}</td><td class="num">${c.calificados}</td>
        <td class="num">${fmtPct(c.indiceOp)}</td><td class="num">${fmtPct(c.indiceAdq)}</td><td class="num">${c.criticos}</td>
        <td class="num">${c.altos}</td><td class="num">${c.medios}</td><td class="num">${c.bloqueantes}</td><td class="num">${fmtMoney(c.costo)}</td>
        <td><span class="st st-${c.estado.split(' ')[0]}">${esc(c.estado)}</span></td></tr>`).join('') + '</tbody>';

    // plan
    $('#plan-count').textContent = `${R.plan.length} acciones`;
    const estados = ['Pendiente', 'En proceso', 'Cerrado', 'Descartado'];
    $('#plan-table').innerHTML = `<thead><tr><th>#</th><th>Prioridad</th><th>Ítem</th><th>Calif.</th><th>Estrategia</th><th>Acción propuesta</th>
      <th>Plazo</th><th class="num">Costo</th><th>Responsable</th><th>Fecha compromiso</th><th>Estado</th></tr></thead><tbody>` +
      (R.plan.length ? R.plan.map((p, i) => {
        const a = S.answers[p.id] || {};
        return `<tr data-id="${esc(p.id)}"><td>${i + 1}</td><td><span class="${lvlClass(p.prioridad)}">${p.prioridad}</span>${p.bloqIncumplido ? '<div class="pre small">Bloqueante</div>' : ''}</td>
        <td><b>${esc(p.id)}</b> ${esc(p.item)}<div class="muted small">${esc(p.categoria)}</div></td><td class="num">${esc(p.calificacion)}</td>
        <td class="${p.estrategia.startsWith('PRE') ? 'pre' : ''}" title="${esc(p.estrategia)}">${esc(p.estrategia.split(':')[0])}</td><td>${esc(p.accionPropuesta)}</td><td>${esc(p.plazo)}</td>
        <td class="num">${a.costo ? fmtMoney(a.costo) : '—'}</td>
        <td><input data-p="responsableAsignado" value="${esc(a.responsableAsignado || '')}" placeholder="${esc(p.responsableSug)}"></td>
        <td><input type="date" data-p="fechaCompromiso" value="${esc(a.fechaCompromiso || '')}"></td>
        <td><select data-p="estadoAccion">${estados.map(e => `<option ${((a.estadoAccion || 'Pendiente') === e) ? 'selected' : ''}>${e}</option>`).join('')}</select></td></tr>`;
      }).join('') : '<tr><td colspan="11" class="empty">Sin acciones: no hay ítems con prioridad Crítica, Alta o Media.</td></tr>') + '</tbody>';

    drawCharts(R);
  }

  function onPlanInput(e) {
    const f = e.target.dataset.p; if (!f) return;
    const id = e.target.closest('tr').dataset.id;
    (S.answers[id] = S.answers[id] || {})[f] = e.target.value;
    setDirty(true);
  }

  function drawCharts(R) {
    if (!window.Chart) return;
    Object.values(S.charts).forEach(c => c.destroy());
    const short = c => c.replace(/^\d+\.\s*/, '').replace('Administrativo – ', '').replace('Instalaciones – ', 'Instal. ');
    const pct = v => v === null ? null : Math.round(v * 1000) / 10;
    Chart.defaults.font.family = 'Inter, Arial, sans-serif';
    S.charts.cat = new Chart($('#chart-cat'), {
      type: 'bar',
      data: { labels: R.categories.map(c => short(c.categoria)),
        datasets: [{ label: 'Índice operativo', data: R.categories.map(c => pct(c.indiceOp)), backgroundColor: '#0B2A5B', borderRadius: 3 },
                   { label: 'Índice adquisición', data: R.categories.map(c => pct(c.indiceAdq)), backgroundColor: '#B8892F', borderRadius: 3 }] },
      options: { indexAxis: 'y', animation: false, maintainAspectRatio: false, responsive: true,
        scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%' }, grid: { color: '#EEF0F3' } }, y: { grid: { display: false }, ticks: { font: { size: 11 } } } },
        plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw ?? '—'}%` } } } }
    });
    const s = R.summary;
    const lab = ['Crítico', 'Alto', 'Medio', 'Bajo', 'Sin brecha', 'N/A', 'Pendiente'];
    const cnt = lab.map(l => R.items.filter(i => i.prioridad === l).length);
    S.charts.prio = new Chart($('#chart-prio'), {
      type: 'doughnut',
      data: { labels: lab, datasets: [{ data: cnt, backgroundColor: ['#D92D20', '#E8762C', '#E9B200', '#3B8A5A', '#067647', '#98A2B3', '#D0D5DD'], borderWidth: 1 }] },
      options: { animation: false, maintainAspectRatio: false, cutout: '58%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11.5 } } } } }
    });
    void s;
  }

  // ---------------- guardar / finalizar ----------------
  function buildPayload() {
    const R = compute(), s = R.summary;
    return {
      evaluation: Object.assign({}, S.ev, { precio: S.ev.precio === '' ? '' : Number(S.ev.precio) }),
      results: { indiceOp: s.indiceOp, indiceAdq: s.indiceAdq, dictamenAdq: s.dictamenAdq, dictamenOp: s.dictamenOp,
        calificados: s.calificados, na: s.na, pendientes: s.pendientes, criticos: s.criticos, altos: s.altos, medios: s.medios,
        bloqueantes: s.bloqueantes, costoTotal: s.costoTotal, costoPre: s.costoPre },
      items: R.items.map(r => {
        const a = S.answers[r.id] || {};
        return { id: r.id, categoria: r.categoria, item: r.item, impOp: r.impOp, impAdq: r.impAdq, bloqueante: r.bloqueante,
          calificacion: r.calificacion, observaciones: a.observaciones || '', costo: a.costo ?? '', brecha: r.brecha,
          riesgoOp: r.riesgoOp, riesgoAdq: r.riesgoAdq, nivelOp: r.nivelOp, nivelAdq: r.nivelAdq, prioridad: r.prioridad,
          estrategia: r.estrategia, accion: r.accionPropuesta, plazo: r.plazo, responsable: r.responsableSug,
          responsableAsignado: a.responsableAsignado || '', fechaCompromiso: a.fechaCompromiso || '', estadoAccion: a.estadoAccion || '' };
      })
    };
  }

  async function save(estado) {
    if (!S.ev.restaurante) { toast('El nombre del restaurante es obligatorio.', true); showTab('datos'); return false; }
    const prev = S.ev.estado;
    if (estado) S.ev.estado = estado;
    try {
      busy(true, 'Guardando en Google Sheets…');
      const r = await Api.save(buildPayload());
      S.ev.id = r.id; S.ev.actualizado = r.actualizado;
      setDirty(false); updateHeader();
      toast(estado === 'Finalizada' ? 'Evaluación finalizada y guardada.' : 'Evaluación guardada correctamente.');
      return true;
    } catch (e) { S.ev.estado = prev; handleErr(e); return false; } finally { busy(false); }
  }

  async function finalize() {
    const p = S.catalog.length - S.catalog.filter(x => rated(x.id)).length;
    const msg = p > 0 ? `Quedan ${p} ítems sin calificar. Si finaliza, se tratarán como pendientes y el dictamen será preliminar. ¿Finalizar de todos modos?`
                      : '¿Finalizar la evaluación? Podrá seguir editándola si lo necesita.';
    if (!confirm(msg)) return;
    if (await save('Finalizada')) renderDashboard();
  }

  async function downloadPdf() {
    try {
      busy(true, 'Generando informe PDF…');
      if ($('#tab-dashboard').hidden) showTab('dashboard'); else renderDashboard();
      await new Promise(r => setTimeout(r, 150));
      await Report.generate({ ev: S.ev, result: S.result, cfg: S.cfg, answers: S.answers,
        chartCat: S.charts.cat && S.charts.cat.toBase64Image('image/png', 1),
        chartPrio: S.charts.prio && S.charts.prio.toBase64Image('image/png', 1) });
      toast('Informe descargado.');
    } catch (e) { handleErr(e); } finally { busy(false); }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
