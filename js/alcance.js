/* Painel "Alcance Total das Metas (C1 a C7)" — fica acima dos cards da aba Indicadores */
    let alcanceModo = 'geral';
    const ALC_ICONE = { C1: '📋', C2: '👶', C3: '🤰', C4: '🩸', C5: '❤️', C6: '👵', C7: '👩' };
    const ALC_NOME = { C1: 'Cadastros', C2: 'Crianças', C3: 'Pré-Natal', C4: 'Diabetes', C5: 'Hipertensão', C6: 'Pessoas Idosas', C7: 'Saúde da Mulher' };
    function alternarAlcance(m) { alcanceModo = m; renderAlcance(); }
    function renderAlcance() {
      const el = document.getElementById('painelAlcance'); if (!el) return;
      if (!Object.keys(BASE_DADOS.cidadaos).length) { el.style.display = 'none'; return; }
      const st = fotoIndicadores().st;
      let ok = 0, tot = 0, metas = 0;
      IND_LISTA.forEach(k => { ok += st[k].ok; tot += st[k].tot; if (st[k].tot && st[k].ok === st[k].tot) metas++; });
      const pend = tot - ok;
      const pct = tot ? (pend > 0 ? Math.min(Math.round(ok / tot * 100), 99) : 100) : 0;
      const status = !tot ? 'Sem dados' : pct >= 100 ? 'Metas atingidas' : pct >= 80 ? 'Ótimo ritmo' : pct >= 50 ? 'Bom ritmo' : 'Precisa de atenção';
      const corSt = pct >= 80 ? 'alc-verde' : pct >= 50 ? 'alc-ambar' : 'alc-verm';
      const R = 80, C = 2 * Math.PI * R, gap = (ok && pend) ? 6 : 0;
      const fOk = tot ? ok / tot * C : 0, fPe = tot ? pend / tot * C : 0;
      const arco = (cor, len, ini) => len > 0 ? `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${cor}" stroke-width="26" stroke-dasharray="${Math.max(len - gap, 0.1).toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-ini).toFixed(1)}" transform="rotate(-90 100 100)"/>` : '';
      const donut = `<svg class="alc-donut" viewBox="0 0 200 200" role="img" aria-label="${pct}% de alcance global: ${ok} em dia e ${pend} pendentes">
        <circle cx="100" cy="100" r="${R}" fill="none" stroke="#e2e8f0" stroke-width="26"/>${arco('#10b981', fOk, 0)}${arco('#f59e0b', fPe, fOk)}
        <text x="100" y="104" text-anchor="middle" class="alc-pct">${pct}%</text>
        <text x="100" y="124" text-anchor="middle" class="alc-rot">ALCANCE GLOBAL</text>
        <text x="100" y="138" text-anchor="middle" class="alc-meta">Meta: 100%</text></svg>`;
      const linhas = IND_LISTA.map(k => {
        const s = st[k]; const p = pctInd(s); const v = p === null ? 0 : p;
        const cls = p === 100 ? 'alc-verde' : v >= 50 ? 'alc-ambar' : 'alc-cinza';
        return `<button class="alc-linha" onclick="abrirIndicador('${k}')" aria-label="${k} ${ALC_NOME[k]}: ${s.ok} de ${s.tot}, ${v}%">
          <span class="alc-ic">${ALC_ICONE[k]}</span>
          <span class="alc-corpo"><span class="alc-topo"><b>${k} · ${ALC_NOME[k]}</b><i>${s.ok}/${s.tot}</i></span><span class="alc-barra"><span style="width:${v}%;background:var(--${k.toLowerCase()})"></span></span></span>
          <span class="alc-badge ${cls}">${v}%</span><span class="alc-seta" aria-hidden="true">›</span></button>`;
      }).join('');
      const geral = alcanceModo === 'geral';
      el.innerHTML = `<div class="alc-cab"><div><h3>🎯 Alcance Total das Metas (C1 a C7)</h3><p>Desempenho consolidado dos indicadores em relação à meta de 100%.</p></div>
        <div class="alc-abas" role="tablist"><button role="tab" aria-selected="${geral}" class="${geral ? 'on' : ''}" onclick="alternarAlcance('geral')">Alcance Geral</button><button role="tab" aria-selected="${!geral}" class="${!geral ? 'on' : ''}" onclick="alternarAlcance('ind')">Por Indicador</button></div></div>
        <div class="alc-corpo-geral ${geral ? '' : 'so-lista'}">
          ${geral ? `<div class="alc-esq">${donut}<div class="alc-leg"><span><i style="background:#10b981"></i>${ok} em dia</span><span><i style="background:#f59e0b"></i>${pend} pendente(s)</span></div></div>` : ''}
          <div class="alc-dir">${geral ? `<div class="alc-kpis"><div><small>Metas 100%:</small><b class="alc-verde-t">🏅 ${metas} de ${IND_LISTA.length} metas</b></div><div><small>Atendimentos OK:</small><b>✔ ${ok} / ${tot}</b></div><div class="alc-kpi-st"><small>Status Global:</small><b class="${corSt}-t">↗ ${status}</b></div></div>` : ''}
            <div class="alc-lista">${linhas}</div></div></div>`;
      el.style.display = '';
    }
