/* Histórico dos indicadores */
    // =========================================================================
    // HISTÓRICO DOS INDICADORES: um ponto por importação (no mesmo dia, o último vale)
    // =========================================================================
    let historicoCache = [];
    let histVisiveis = new Set(IND_LISTA);
    function pctInd(s) { return s && s.tot ? (s.ok < s.tot ? Math.min(Math.round(s.ok / s.tot * 100), 99) : 100) : null; }
    async function carregarHistorico() { try { historicoCache = (await BaseIDB.get('historico')) || []; } catch (e) { historicoCache = []; } renderHistorico(); }
    async function registrarHistorico() {
      const agora = new Date(); const d = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
      const st = fotoIndicadores().st;
      historicoCache = historicoCache.filter(x => x.d !== d); historicoCache.push({ d, st });
      historicoCache.sort((a, b) => a.d.localeCompare(b.d));
      if (historicoCache.length > 400) historicoCache = historicoCache.slice(-400);
      try { await BaseIDB.set('historico', JSON.parse(JSON.stringify(historicoCache))); } catch (e) { console.error(e); }
      renderHistorico();
    }
    function alternarIndHist(k) { if (histVisiveis.has(k)) histVisiveis.delete(k); else histVisiveis.add(k); renderHistorico(true); }
    function renderHistorico(manterAberto) {
      const el = document.getElementById('blocoHistorico'); if (!el) return;
      if (!Object.keys(BASE_DADOS.cidadaos).length || !historicoCache.length) { el.style.display = 'none'; return; }
      const aberto = el.open;
      const cor = (k) => getComputedStyle(document.documentElement).getPropertyValue('--' + k.toLowerCase()).trim() || '#0284c7';
      const ultimo = historicoCache[historicoCache.length - 1];
      const legenda = IND_LISTA.filter(k => ultimo.st[k] && ultimo.st[k].tot).map(k => `<button class="hist-chip ${histVisiveis.has(k) ? 'on' : ''}" style="--cor:${cor(k)}" onclick="alternarIndHist('${k}')">${k} ${pctInd(ultimo.st[k])}%</button>`).join('');
      let corpo;
      if (historicoCache.length < 2) {
        corpo = `<div class="mud-nota">Há ${historicoCache.length} importação registrada (${historicoCache[0].d.split('-').reverse().join('/')}). A linha de evolução aparece a partir da segunda importação, em outro dia.</div>`;
      } else {
        const W = 340, H = 210, L = 34, R = 12, T = 12, B = 28;
        const ts = historicoCache.map(x => new Date(x.d + 'T12:00:00').getTime());
        const t0 = ts[0], t1 = ts[ts.length - 1], span = Math.max(t1 - t0, 1);
        const X = (i) => L + (ts[i] - t0) / span * (W - L - R);
        const Y = (p) => T + (100 - p) / 100 * (H - T - B);
        let svg = `<svg class="hist-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução dos indicadores por importação">`;
        [0, 25, 50, 75, 100].forEach(p => { svg += `<line x1="${L}" x2="${W - R}" y1="${Y(p)}" y2="${Y(p)}" stroke="#e2e8f0" stroke-width="1"/><text x="${L - 6}" y="${Y(p) + 3}" text-anchor="end">${p}%</text>`; });
        const fmt = (d) => d.split('-').reverse().slice(0, 2).join('/');
        svg += `<text x="${L}" y="${H - 8}" text-anchor="start">${fmt(historicoCache[0].d)}</text><text x="${W - R}" y="${H - 8}" text-anchor="end">${fmt(ultimo.d)}</text>`;
        IND_LISTA.filter(k => histVisiveis.has(k)).forEach(k => {
          const pts = historicoCache.map((x, i) => [i, pctInd(x.st[k])]).filter(p => p[1] !== null);
          if (!pts.length) return;
          svg += `<polyline fill="none" stroke="${cor(k)}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" points="${pts.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}"/>`;
          pts.forEach(p => { svg += `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3" fill="${cor(k)}"><title>${k} em ${historicoCache[p[0]].d.split('-').reverse().join('/')}: ${p[1]}%</title></circle>`; });
        });
        svg += '</svg>';
        corpo = svg + `<div class="mud-nota">${historicoCache.length} importações, de ${historicoCache[0].d.split('-').reverse().join('/')} a ${ultimo.d.split('-').reverse().join('/')}. Toque num indicador para mostrar ou esconder a linha.</div>`;
      }
      el.innerHTML = `<summary>📊 Evolução dos indicadores</summary><div class="hist-legenda">${legenda}</div>${corpo}`;
      el.style.display = ''; if (aberto || manterAberto) el.open = true;
    }

    let chaveVisita = null;
    function abrirModalVisita(chave) {
      const c = BASE_DADOS.cidadaos[chave]; if (!c || !podeRegistrarVisita(c)) return;
      chaveVisita = chave;
      const hoje = new Date(); const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
      const campo = document.getElementById('visitaData'); campo.value = iso; campo.max = iso;
      document.getElementById('visitaNome').textContent = c.nome;
      const opcoes = [];
      ['C2', 'C4', 'C5', 'C6'].forEach(k => { if (c.indicadores[k] && c.ex[k]) opcoes.push([k, k !== 'C2']); });
      if (c.indicadores.C3 && c.ex.C3) { opcoes.push(['C3PN', true]); opcoes.push(['C3PU', false]); }
      const unicos = opcoes.length === 1;
      document.getElementById('visitaMotivos').innerHTML = opcoes.map(([k, marcado]) =>
        `<label class="visita-opcao"><input type="checkbox" value="${k}" ${(marcado || unicos || k === 'C2') ? 'checked' : ''}> <span>${MOTIVOS_VISITA[k]}</span></label>`).join('');
      document.getElementById('modalVisita').classList.add('aberto');
    }
    function fecharModalVisita() { document.getElementById('modalVisita').classList.remove('aberto'); chaveVisita = null; }
    function salvarVisita() {
      const c = BASE_DADOS.cidadaos[chaveVisita]; if (!c) return fecharModalVisita();
      const inds = [...document.querySelectorAll('#visitaMotivos input:checked')].map(i => i.value);
      const dtv = document.getElementById('visitaData').value;
      if (!inds.length) { avisoToast('Marque pelo menos um motivo da visita.'); return; }
      if (!dtv) { avisoToast('Informe a data da visita.'); return; }
      const [a, m, d] = dtv.split('-');
      if (new Date(+a, +m - 1, +d) > new Date()) { avisoToast('A data da visita não pode ser futura.'); return; }
      c.visitasApp = c.visitasApp || [];
      c.visitasApp.push({ d: `${d}/${m}/${a}`, inds, base: { C3PN: c.c3_vis_pn || 0, C3PU: c.c3_vis_puerp || 0 } });
      aplicarVisitasApp(c); salvarBaseLocal(); fecharModalVisita(); atualizarInterface(); avisoToast('✅ Visita registrada.');
    }
    function removerVisitaApp(chave, i) {
      const c = BASE_DADOS.cidadaos[chave]; if (!c || !c.visitasApp || !c.visitasApp[i]) return;
      if (!confirm(`Remover a visita de ${c.visitasApp[i].d}?`)) return;
      c.visitasApp.splice(i, 1); aplicarVisitasApp(c); salvarBaseLocal(); atualizarInterface(); avisoToast('Visita removida.');
    }
    document.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('.btn-visita'); if (b) { abrirModalVisita(b.getAttribute('data-chave')); return; }
      const r = e.target.closest && e.target.closest('.btn-rm-visita'); if (r) removerVisitaApp(r.getAttribute('data-chave'), +r.getAttribute('data-i'));
    });
