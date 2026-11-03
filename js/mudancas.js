/* O que mudou desde a importação anterior */
    // =========================================================================
    // O QUE MUDOU DESDE A IMPORTAÇÃO ANTERIOR
    // =========================================================================
    const IND_LISTA = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'];
    function fotoIndicadores() {
      const s = { cid: {}, st: {} };
      IND_LISTA.forEach(k => { s.st[k] = { ok: 0, tot: 0 }; });
      Object.entries(BASE_DADOS.cidadaos).forEach(([ch, c]) => {
        const o = {};
        IND_LISTA.forEach(k => {
          if (c.indicadores && c.indicadores[k]) { const ok = !!c[k.toLowerCase() + 'Ok']; o[k] = ok; s.st[k].tot++; if (ok) s.st[k].ok++; }
        });
        s.cid[ch] = { n: c.nome, o };
      });
      return s;
    }
    function compararImportacao(antes, depois) {
      if (!antes || !Object.keys(antes.cid).length) return null;
      const res = { quando: fmtData(new Date()), antes: antes.st, depois: depois.st, resolvidos: [], novos: [], novosCid: 0 };
      Object.entries(depois.cid).forEach(([ch, d]) => {
        const a = antes.cid[ch];
        if (!a) { res.novosCid++; return; }
        Object.keys(d.o).forEach(k => {
          if (a.o[k] === false && d.o[k] === true) res.resolvidos.push({ n: d.n, k });
          else if (a.o[k] === true && d.o[k] === false) res.novos.push({ n: d.n, k });
        });
      });
      return res;
    }
    function renderMudancas() {
      const el = document.getElementById('blocoMudancas'); if (!el) return;
      let m = null; try { m = JSON.parse(localStorage.getItem('guia_mudancas')); } catch (e) {}
      if (!m || !Object.keys(BASE_DADOS.cidadaos).length) { el.style.display = 'none'; return; }
      const pct = (s) => s && s.tot ? (s.ok < s.tot ? Math.min(Math.round(s.ok / s.tot * 100), 99) : 100) : 0;
      const linhas = IND_LISTA.filter(k => (m.antes[k] && m.antes[k].tot) || (m.depois[k] && m.depois[k].tot)).map(k => {
        const a = pct(m.antes[k]), d = pct(m.depois[k]), dif = (m.depois[k].ok - m.antes[k].ok);
        const cls = dif > 0 ? 'sobe' : (dif < 0 ? 'desce' : 'igual');
        return `<div><b>${k}</b> ${a}% → ${d}%</div><span class="${cls}">${dif > 0 ? '+' : ''}${dif} ${Math.abs(dif) === 1 ? 'cidadão' : 'cidadãos'} em dia</span>`;
      }).join('');
      const lista = (arr) => arr.slice(0, 15).map(x => `${escHtml(x.n)} (${x.k})`).join('<br>') + (arr.length > 15 ? `<br>e mais ${arr.length - 15}...` : '');
      el.innerHTML = `<summary>📈 O que mudou desde a importação anterior</summary>
        <div class="mud-linhas">${linhas}</div>
        <div class="mud-sub" style="color:#059669;">✅ Saíram das pendências: ${m.resolvidos.length}</div>
        <div class="mud-lista">${m.resolvidos.length ? lista(m.resolvidos) : 'Nenhum.'}</div>
        <div class="mud-sub" style="color:#dc2626;">⚠️ Entraram nas pendências: ${m.novos.length}</div>
        <div class="mud-lista">${m.novos.length ? lista(m.novos) : 'Nenhum.'}</div>
        ${m.novosCid ? `<div class="mud-sub">➕ Cidadãos novos nos relatórios: ${m.novosCid}</div>` : ''}
        <div class="mud-nota">Comparação feita em ${escHtml(m.quando)}, entre a importação anterior e a última.</div>`;
      el.style.display = '';
    }
