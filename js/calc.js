/* Motor de cálculo: misma metodología que la matriz en Excel. */
(function () {
  const LEVELS = ['Crítico', 'Alto', 'Medio', 'Bajo', 'Sin brecha'];

  function level(risk, cfg) {
    if (risk >= cfg.UMBRAL_CRITICO) return 'Crítico';
    if (risk >= cfg.UMBRAL_ALTO) return 'Alto';
    if (risk >= cfg.UMBRAL_MEDIO) return 'Medio';
    if (risk > 0) return 'Bajo';
    return 'Sin brecha';
  }

  function plazo(nivel, cfg) {
    return { 'Crítico': cfg.PLAZO_CRITICO, 'Alto': cfg.PLAZO_ALTO, 'Medio': cfg.PLAZO_MEDIO, 'Bajo': cfg.PLAZO_BAJO }[nivel] || '';
  }

  /** item: definición del catálogo; ans: {calificacion, observaciones, costo, ...} */
  function computeItem(item, ans, cfg) {
    const r = Object.assign({}, item, ans || {});
    const cal = ans && ans.calificacion !== undefined ? String(ans.calificacion) : '';
    r.calificacion = cal;
    r.brecha = r.riesgoOp = r.riesgoAdq = null;
    r.bloqIncumplido = false;
    r.estrategia = r.plazo = r.accionPropuesta = r.responsableSug = '';
    if (cal === '') { r.nivelOp = r.nivelAdq = r.prioridad = 'Pendiente'; return r; }
    if (cal === 'N/A') { r.nivelOp = r.nivelAdq = r.prioridad = 'N/A'; return r; }
    const c = Number(cal);
    r.brecha = 5 - c;
    r.riesgoOp = r.brecha * Number(item.impOp);
    r.riesgoAdq = r.brecha * Number(item.impAdq);
    r.bloqIncumplido = !!item.bloqueante && c <= Number(cfg.BLOQUEANTE_MAX);
    r.nivelOp = level(r.riesgoOp, cfg);
    r.nivelAdq = r.bloqIncumplido ? 'Crítico' : level(r.riesgoAdq, cfg);
    const maxR = Math.max(r.riesgoOp, r.riesgoAdq);
    r.prioridad = r.bloqIncumplido ? 'Crítico' : level(maxR, cfg);
    if (r.prioridad !== 'Sin brecha') {
      if (r.nivelAdq === 'Crítico') r.estrategia = 'PRE-CIERRE: condición para firmar (exigir subsanación al vendedor o descontar del precio)';
      else if (r.nivelAdq === 'Alto') r.estrategia = 'NEGOCIACIÓN: ajuste de precio o retención en garantía';
      else if (r.nivelOp === 'Crítico' || r.nivelOp === 'Alto') r.estrategia = 'POST-CIERRE: primeros 30 días de operación';
      else r.estrategia = 'POST-CIERRE: plan de mejora continua';
      r.plazo = plazo(r.prioridad, cfg);
      r.responsableSug = item.responsable || '';
      r.accionPropuesta = ['Crítico', 'Alto', 'Medio'].includes(r.prioridad)
        ? (item.accion || '') : 'Monitorear e incluir en el mantenimiento preventivo.';
    }
    const sev = { 'Crítico': 3, 'Alto': 2, 'Medio': 1 }[r.prioridad] || 0;
    r.sortKey = sev ? sev * 1000 + (r.bloqIncumplido ? 500 : 0) + maxR * 10 : 0;
    return r;
  }

  function computeAll(catalog, answers, cfg) {
    const items = catalog.map(it => computeItem(it, answers[it.id], cfg));
    const S = { calificados: 0, na: 0, pendientes: 0, criticos: 0, altos: 0, medios: 0, bajos: 0,
      critOp: 0, critAdq: 0, bloqueantes: 0, pre: 0, costoTotal: 0, costoCritAlto: 0, costoPre: 0 };
    let pOp = 0, mOp = 0, pAdq = 0, mAdq = 0;
    const cats = {};
    items.forEach(r => {
      const k = r.categoria;
      if (!cats[k]) cats[k] = { categoria: k, items: 0, calificados: 0, pOp: 0, mOp: 0, pAdq: 0, mAdq: 0,
        criticos: 0, altos: 0, medios: 0, bloqueantes: 0, costo: 0 };
      const C = cats[k];
      C.items++;
      const costo = Number(r.costo) || 0;
      S.costoTotal += costo; C.costo += costo;
      if (r.prioridad === 'Pendiente') { S.pendientes++; return; }
      if (r.prioridad === 'N/A') { S.na++; return; }
      const c = Number(r.calificacion);
      S.calificados++; C.calificados++;
      pOp += c * r.impOp; mOp += 5 * r.impOp; pAdq += c * r.impAdq; mAdq += 5 * r.impAdq;
      C.pOp += c * r.impOp; C.mOp += 5 * r.impOp; C.pAdq += c * r.impAdq; C.mAdq += 5 * r.impAdq;
      if (r.prioridad === 'Crítico') { S.criticos++; C.criticos++; }
      if (r.prioridad === 'Alto') { S.altos++; C.altos++; }
      if (r.prioridad === 'Medio') { S.medios++; C.medios++; }
      if (r.prioridad === 'Bajo') S.bajos++;
      if (r.nivelOp === 'Crítico') S.critOp++;
      if (r.nivelAdq === 'Crítico') S.critAdq++;
      if (r.bloqIncumplido) { S.bloqueantes++; C.bloqueantes++; }
      if (r.estrategia.startsWith('PRE')) { S.pre++; S.costoPre += costo; }
      if (r.prioridad === 'Crítico' || r.prioridad === 'Alto') S.costoCritAlto += costo;
    });
    S.total = items.length;
    S.indiceOp = mOp ? pOp / mOp : null;
    S.indiceAdq = mAdq ? pAdq / mAdq : null;
    S.avance = S.total ? (S.calificados + S.na) / S.total : 0;
    const fav = Number(cfg.DICTAMEN_FAVORABLE), cond = Number(cfg.DICTAMEN_CONDICIONADO);

    if (!S.calificados) { S.dictamenAdq = 'SIN DATOS'; S.dictamenAdqTxt = 'Complete la evaluación'; }
    else if (S.bloqueantes > 0) { S.dictamenAdq = 'NO PROCEDER'; S.dictamenAdqTxt = 'Existen ítems bloqueantes sin subsanar'; }
    else if (S.indiceAdq >= fav && S.critAdq === 0) { S.dictamenAdq = 'FAVORABLE'; S.dictamenAdqTxt = 'Proceder con la adquisición'; }
    else if (S.indiceAdq >= cond) { S.dictamenAdq = 'CONDICIONADO'; S.dictamenAdqTxt = 'Proceder solo con subsanaciones previas y/o ajuste de precio'; }
    else { S.dictamenAdq = 'DESFAVORABLE'; S.dictamenAdqTxt = 'Renegociar a fondo o desistir'; }

    if (!S.calificados) { S.dictamenOp = 'SIN DATOS'; S.dictamenOpTxt = 'Complete la evaluación'; }
    else if (S.indiceOp >= fav && S.critOp === 0) { S.dictamenOp = 'APTO'; S.dictamenOpTxt = 'Puede continuar operando con mantenimiento normal'; }
    else if (S.indiceOp >= cond) { S.dictamenOp = 'APTO CON PLAN'; S.dictamenOpTxt = 'Operar ejecutando el plan inmediato de correcciones'; }
    else { S.dictamenOp = 'NO APTO'; S.dictamenOpTxt = 'Requiere intervención antes de operar'; }

    const categories = Object.values(cats).map(C => {
      C.indiceOp = C.mOp ? C.pOp / C.mOp : null;
      C.indiceAdq = C.mAdq ? C.pAdq / C.mAdq : null;
      if (!C.calificados) C.estado = 'Sin evaluar';
      else if (C.bloqueantes > 0 || C.criticos > 0) C.estado = 'Atención inmediata';
      else { const m = Math.min(C.indiceOp, C.indiceAdq); C.estado = m >= fav ? 'Buen estado' : m >= cond ? 'Requiere mejoras' : 'Deficiente'; }
      return C;
    });
    const plan = items.filter(r => r.sortKey > 0).sort((a, b) => b.sortKey - a.sortKey);
    return { items, summary: S, categories, plan };
  }

  window.Calc = { computeAll, computeItem, LEVELS };
})();
