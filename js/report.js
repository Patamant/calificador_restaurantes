/* Generación del informe PDF (jsPDF + AutoTable) */
(function () {
  const CFG = window.APP_CONFIG;
  const NAVY = [11, 42, 91], GOLD = [184, 137, 47], INK = [28, 37, 51], MUTED = [102, 112, 133], LINE = [228, 231, 236];
  const LVL = {
    'Crítico': { f: [254, 228, 226], t: [180, 35, 24] }, 'Alto': { f: [253, 234, 215], t: [181, 71, 8] },
    'Medio': { f: [254, 247, 195], t: [133, 74, 14] }, 'Bajo': { f: [220, 250, 230], t: [59, 138, 90] },
    'Sin brecha': { f: [209, 250, 223], t: [6, 118, 71] }
  };
  const DICT = { FAVORABLE: 'good', APTO: 'good', CONDICIONADO: 'warn', 'APTO CON PLAN': 'warn', 'NO PROCEDER': 'bad', DESFAVORABLE: 'bad', 'NO APTO': 'bad' };
  const DCOL = { good: { f: [209, 250, 223], t: [6, 118, 71] }, warn: { f: [254, 240, 199], t: [161, 92, 7] }, bad: { f: [254, 228, 226], t: [180, 35, 24] }, none: { f: [242, 244, 247], t: [71, 84, 103] } };

  // Las fuentes estándar del PDF no incluyen algunos símbolos: se sustituyen.
  const T = s => String(s ?? '').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/→/g, '->').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, '...');
  const pct = v => (v === null || v === undefined || v === '' || isNaN(v)) ? '—' : (Number(v) * 100).toFixed(1) + '%';
  const money = v => '$' + Math.round(Number(v) || 0).toLocaleString('en-US');

  function loadImage(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0);
          resolve({ data: c.toDataURL('image/jpeg', 0.92), w: img.naturalWidth, h: img.naturalHeight });
        } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
  function imgSize(dataUrl) {
    return new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res(null); i.src = dataUrl; });
  }

  async function generate({ ev, result, cfg, answers, chartCat, chartPrio }) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 14;
    const logo = await loadImage(CFG.LOGO_PDF || CFG.LOGO);
    const s = result.summary;
    const empresa = T(cfg.EMPRESA || CFG.COMPANY);
    const TOP = 30; // margen superior bajo el encabezado

    function header() {
      if (logo) { const h = 16, w = h * logo.w / logo.h; doc.addImage(logo.data, 'JPEG', M, 7, w, h); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...NAVY);
      doc.text('Informe de evaluación para adquisición', W - M, 13, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
      doc.text(T(ev.restaurante) + (ev.id ? '  ·  ' + ev.id : ''), W - M, 18, { align: 'right' });
      doc.setDrawColor(...GOLD); doc.setLineWidth(0.6); doc.line(M, 25, W - M, 25);
    }
    function section(title, y) {
      if (y > H - 40) { doc.addPage(); y = TOP; }
      doc.setFillColor(...NAVY); doc.rect(M, y, 2.2, 6.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...NAVY);
      doc.text(T(title), M + 5, y + 5);
      return y + 10;
    }
    const tableBase = {
      margin: { left: M, right: M, top: TOP, bottom: 18 },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8, textColor: INK, lineColor: LINE, lineWidth: 0.2, overflow: 'linebreak' },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: [249, 250, 251] }
    };
    const colorLevel = (data, cols) => {
      if (data.section !== 'body' || !cols.includes(data.column.index)) return;
      const c = LVL[data.cell.raw]; if (c) { data.cell.styles.fillColor = c.f; data.cell.styles.textColor = c.t; data.cell.styles.fontStyle = 'bold'; }
    };

    // ---------------- Portada / resumen ----------------
    let y = 38;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor(...NAVY);
    doc.text('Evaluación del estado actual del restaurante', M, y);
    doc.setFontSize(14); doc.setTextColor(...GOLD);
    doc.text(T(ev.restaurante || ''), M, y + 8);
    y += 15;
    doc.autoTable(Object.assign({}, tableBase, {
      startY: y, theme: 'plain',
      styles: Object.assign({}, tableBase.styles, { fontSize: 9, cellPadding: 1.5 }),
      columnStyles: { 0: { fontStyle: 'bold', textColor: MUTED, cellWidth: 38 }, 2: { fontStyle: 'bold', textColor: MUTED, cellWidth: 38 } },
      body: [
        ['Restaurante', T(ev.restaurante), 'Código', T(ev.id || '(sin guardar)')],
        ['Dirección', T([ev.direccion, ev.ciudad].filter(Boolean).join(', ')), 'Fecha evaluación', T(ev.fecha)],
        ['Propietario / vendedor', T(ev.propietario), 'Evaluador(es)', T(ev.evaluador)],
        ['Precio ofertado', ev.precio ? money(ev.precio) : '—', 'Estado', T(ev.estado || 'Borrador')]
      ]
    }));
    y = doc.lastAutoTable.finalY + 6;

    // Dictámenes
    const boxW = (W - 2 * M - 6) / 2;
    [['DICTAMEN DE ADQUISICIÓN', s.dictamenAdq, s.dictamenAdqTxt], ['DICTAMEN OPERATIVO', s.dictamenOp, s.dictamenOpTxt]].forEach((d, i) => {
      const c = DCOL[DICT[d[1]] || 'none'], x = M + i * (boxW + 6);
      doc.setFillColor(...c.f); doc.roundedRect(x, y, boxW, 24, 2, 2, 'F');
      doc.setFillColor(...c.t); doc.rect(x, y, 2.2, 24, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text(T(d[0]), x + 6, y + 6);
      doc.setFontSize(15); doc.setTextColor(...c.t); doc.text(T(d[1]), x + 6, y + 14);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...INK);
      doc.text(doc.splitTextToSize(T(d[2]), boxW - 10), x + 6, y + 19.5);
    });
    y += 30;
    if (s.pendientes > 0) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(180, 35, 24);
      doc.text(`Dictamen preliminar: ${s.pendientes} ítems sin calificar.`, M, y); y += 5;
    }

    // KPIs
    const precio = Number(ev.precio) || 0;
    const kp = [
      ['Índice de condición operativa', pct(s.indiceOp)], ['Índice de condición para adquisición', pct(s.indiceAdq)],
      ['Ítems calificados / N/A / pendientes', `${s.calificados} / ${s.na} / ${s.pendientes} de ${s.total}`],
      ['Prioridad crítica / alta / media', `${s.criticos} / ${s.altos} / ${s.medios}`],
      ['Ítems bloqueantes incumplidos', String(s.bloqueantes)], ['Acciones previas al cierre (PRE-CIERRE)', String(s.pre)],
      ['Costo total estimado de correcciones', money(s.costoTotal)], ['Costo de ítems críticos y altos', money(s.costoCritAlto)],
      ['Costo de acciones pre-cierre', money(s.costoPre)], ['Correcciones como % del precio ofertado', precio ? (s.costoTotal / precio * 100).toFixed(1) + '%' : '—']
    ];
    y = section('Indicadores clave', y);
    doc.autoTable(Object.assign({}, tableBase, {
      startY: y, head: [['Indicador', 'Valor', 'Indicador', 'Valor']],
      body: Array.from({ length: kp.length / 2 }, (_, i) => [kp[i * 2][0], kp[i * 2][1], kp[i * 2 + 1][0], kp[i * 2 + 1][1]]),
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold', cellWidth: 30 }, 3: { halign: 'right', fontStyle: 'bold', cellWidth: 30 } }
    }));
    y = doc.lastAutoTable.finalY + 6;

    // Conclusiones
    if (ev.conclusiones) {
      y = section('Conclusiones y recomendaciones del evaluador', y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK);
      const lines = doc.splitTextToSize(T(ev.conclusiones), W - 2 * M);
      lines.forEach(l => { if (y > H - 20) { doc.addPage(); y = TOP + 4; } doc.text(l, M, y); y += 4.6; });
      y += 3;
    }

    // ---------------- Gráficos ----------------
    doc.addPage(); y = TOP + 4;
    y = section('Índice de condición por categoría', y);
    if (chartCat) {
      const d = await imgSize(chartCat); const w = W - 2 * M, h = d ? Math.min(w * d.h / d.w, 120) : 100;
      doc.addImage(chartCat, 'PNG', M, y, d ? h * d.w / d.h : w, h); y += h + 6;
    }
    y = section('Distribución de ítems por prioridad', y);
    if (chartPrio) {
      const d = await imgSize(chartPrio); const h = 62, w = d ? h * d.w / d.h : 110;
      doc.addImage(chartPrio, 'PNG', M, y, Math.min(w, W - 2 * M), h); y += h + 4;
    }

    // ---------------- Resultados por categoría ----------------
    doc.addPage(); y = TOP + 4;
    y = section('Resultados por categoría', y);
    doc.autoTable(Object.assign({}, tableBase, {
      startY: y,
      head: [['Categoría', 'Ítems', 'Calif.', 'Índ. op.', 'Índ. adq.', 'Crít.', 'Altos', 'Medios', 'Bloq.', 'Costo', 'Estado']],
      body: result.categories.map(c => [T(c.categoria), c.items, c.calificados, pct(c.indiceOp), pct(c.indiceAdq), c.criticos, c.altos, c.medios, c.bloqueantes, money(c.costo), T(c.estado)]),
      foot: [['TOTAL', s.total, s.calificados, pct(s.indiceOp), pct(s.indiceAdq), s.criticos, s.altos, s.medios, s.bloqueantes, money(s.costoTotal), '']],
      footStyles: { fillColor: [238, 242, 248], textColor: NAVY, fontStyle: 'bold' },
      styles: Object.assign({}, tableBase.styles, { fontSize: 8 }),
      columnStyles: { 0: { cellWidth: 52 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right' } },
      didParseCell: data => {
        if (data.section === 'body' && data.column.index === 10) {
          const m = { 'Atención inmediata': [180, 35, 24], 'Deficiente': [181, 71, 8], 'Requiere mejoras': [133, 74, 14], 'Buen estado': [6, 118, 71] }[data.cell.raw];
          if (m) { data.cell.styles.textColor = m; data.cell.styles.fontStyle = 'bold'; }
        }
      }
    }));
    y = doc.lastAutoTable.finalY + 8;

    // ---------------- Plan de acción ----------------
    y = section('Plan de acción priorizado', y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(...MUTED);
    doc.text(doc.splitTextToSize('PRE-CIERRE: condición para firmar (exigir subsanación al vendedor o descontar del precio). NEGOCIACIÓN: ajuste de precio o retención en garantía. POST-CIERRE: corregir después de la compra (primeros 30 días si es crítico/alto operativo; resto, mejora continua).', W - 2 * M), M, y);
    y += 8;
    if (!result.plan.length) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...MUTED);
      doc.text('No hay ítems con prioridad Crítica, Alta o Media.', M, y + 2); y += 8;
    } else {
      doc.autoTable(Object.assign({}, tableBase, {
        startY: y,
        head: [['#', 'Prioridad', 'Ítem', 'Estrategia', 'Acción propuesta', 'Plazo', 'Responsable', 'Fecha', 'Costo']],
        body: result.plan.map((p, i) => {
          const a = answers[p.id] || {};
          return [i + 1, p.prioridad + (p.bloqIncumplido ? '\nBloqueante' : ''), `${p.id} · ${T(p.item)}`, T(p.estrategia.split(':')[0]), T(p.accionPropuesta),
            T(p.plazo), T(a.responsableAsignado || p.responsableSug), T(a.fechaCompromiso || ''), a.costo ? money(a.costo) : '—'];
        }),
        styles: Object.assign({}, tableBase.styles, { fontSize: 7.4, cellPadding: 1.5 }),
        columnStyles: { 0: { cellWidth: 6, halign: 'right' }, 1: { cellWidth: 18 }, 2: { cellWidth: 36 }, 3: { cellWidth: 22 }, 4: { cellWidth: 41 }, 5: { cellWidth: 16 }, 6: { cellWidth: 16 }, 7: { cellWidth: 14 }, 8: { cellWidth: 13, halign: 'right' } },
        didParseCell: data => {
          if (data.section === 'body' && data.column.index === 1) {
            const c = LVL[String(data.cell.raw).split('\n')[0]];
            if (c) { data.cell.styles.fillColor = c.f; data.cell.styles.textColor = c.t; data.cell.styles.fontStyle = 'bold'; }
          }
          if (data.section === 'body' && data.column.index === 3 && String(data.cell.raw).startsWith('PRE')) {
            data.cell.styles.textColor = [180, 35, 24]; data.cell.styles.fontStyle = 'bold';
          }
        }
      }));
      y = doc.lastAutoTable.finalY + 8;
    }

    // ---------------- Detalle ----------------
    doc.addPage(); y = TOP + 4;
    y = section('Detalle de la evaluación por ítem', y);
    const body = [];
    let lastCat = null;
    result.items.forEach(r => {
      if (r.categoria !== lastCat) { body.push([{ content: T(r.categoria), colSpan: 8, styles: { fillColor: [238, 242, 248], textColor: NAVY, fontStyle: 'bold' } }]); lastCat = r.categoria; }
      const a = answers[r.id] || {};
      body.push([r.id, T(r.item) + (r.bloqueante ? ' (B)' : ''), r.calificacion || '—', `${r.impOp}/${r.impAdq}`, r.nivelOp, r.nivelAdq, r.prioridad, T(a.observaciones || '')]);
    });
    doc.autoTable(Object.assign({}, tableBase, {
      startY: y,
      head: [['ID', 'Ítem', 'Calif.', 'Imp. O/A', 'Nivel op.', 'Nivel adq.', 'Prioridad', 'Observaciones / evidencia']],
      body,
      styles: Object.assign({}, tableBase.styles, { fontSize: 7.4, cellPadding: 1.4 }),
      columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 45 }, 2: { cellWidth: 10, halign: 'center' }, 3: { cellWidth: 12, halign: 'center' }, 4: { cellWidth: 16 }, 5: { cellWidth: 16 }, 6: { cellWidth: 16 } },
      didParseCell: data => colorLevel(data, [4, 5, 6])
    }));
    y = doc.lastAutoTable.finalY + 5;
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text('(B) = ítem bloqueante. Imp. O/A = importancia para la operación / para la adquisición (1-5).', M, y); y += 8;

    // ---------------- Metodología y firmas ----------------
    if (y > H - 85) { doc.addPage(); y = TOP + 4; }
    y = section('Metodología', y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...INK);
    const met = [
      'Escala de calificación: 5 Excelente, 4 Bueno, 3 Regular, 2 Deficiente, 1 Crítico, N/A No aplica (excluido del cálculo).',
      `Riesgo = (5 - calificación) x importancia (0-20). Niveles: Crítico >= ${cfg.UMBRAL_CRITICO}, Alto >= ${cfg.UMBRAL_ALTO}, Medio >= ${cfg.UMBRAL_MEDIO}, Bajo > 0.`,
      `Un ítem bloqueante con calificación <= ${cfg.BLOQUEANTE_MAX} se considera incumplido y fuerza el dictamen NO PROCEDER.`,
      'Índice de condición = suma(calificación x importancia) / suma(5 x importancia) de los ítems calificados.',
      `Dictamen: Favorable/Apto >= ${Math.round(cfg.DICTAMEN_FAVORABLE * 100)}% sin ítems críticos; Condicionado/Apto con plan >= ${Math.round(cfg.DICTAMEN_CONDICIONADO * 100)}%.`
    ];
    met.forEach(t => { const l = doc.splitTextToSize('•  ' + T(t), W - 2 * M); doc.text(l, M, y); y += l.length * 4 + 1; });
    y += 18;
    if (y > H - 30) { doc.addPage(); y = TOP + 25; }
    const sw = (W - 2 * M - 20) / 2;
    doc.setDrawColor(...MUTED); doc.setLineWidth(0.3);
    doc.line(M, y, M + sw, y); doc.line(M + sw + 20, y, W - M, y);
    doc.setFontSize(8.5); doc.setTextColor(...INK);
    doc.text('Evaluador: ' + T(ev.evaluador || ''), M, y + 5);
    doc.text('Cliente / comprador', M + sw + 20, y + 5);

    // ---------------- Pie de página ----------------
    const n = doc.getNumberOfPages();
    const gen = new Date().toLocaleString(CFG.LOCALE);
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      header();
      doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, H - 12, W - M, H - 12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
      doc.text(T(empresa + ' · ' + (cfg.PIE_INFORME || '')), M, H - 7.5);
      doc.text(`Generado: ${gen}   ·   Página ${i} de ${n}`, W - M, H - 7.5, { align: 'right' });
    }

    const safe = String(ev.restaurante || 'restaurante').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
    doc.save(`Informe_Evaluacion_${safe}_${(ev.fecha || '').replace(/-/g, '')}.pdf`);
    return doc;
  }

  window.Report = { generate };
})();
