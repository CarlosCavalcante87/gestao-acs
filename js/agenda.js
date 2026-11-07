/* Agenda de metas: visão "Por prazo" (tudo o que tem data, do mais urgente ao mais distante)
   e visão "Semana" (calendário: o que vence ou passa a valer em cada dia).
   Usa os mesmos alertas de "Ações e Prazos do Dia" (gerarAlertas), que vêm das planilhas do PEC. */
    let semanaOffset = 0, diaAgenda = null;
    const DIA_SEMANA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    const p2 = (n) => String(n).padStart(2, '0');
    const ddmm = (d) => p2(d.getDate()) + '/' + p2(d.getMonth() + 1);
    const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    function segundaDaSemana(d) { const x = iniDia(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
    function moverSemana(delta) { semanaOffset = Math.max(0, Math.min(12, semanaOffset + delta)); diaAgenda = null; atualizarAlertas(); }
    function escolherDiaAgenda(iso) { diaAgenda = iso; atualizarAlertas(); }
    const msgVazia = (t) => `<p style="text-align:center; padding: 24px; color: var(--text-muted); font-size: 0.88rem;">${t}</p>`;

    // ---------- Por prazo ----------
    function htmlAgendaPrazo() {
      // faixas etárias muito distantes só atrapalham a lista: ficam só as que acontecem em até 60 dias
      const lista = gerarAlertas(365).filter(a => a.tipo !== 'faixa' || a.dias <= 60);
      const grupos = agruparAlertas(lista);
      if (!grupos.length) return msgVazia('🎉 Nenhum prazo ou janela com data nos próximos 12 meses.');
      const atras = (g) => g.itens.some(a => a.atrasado);
      const nAtras = grupos.filter(atras).length;
      const nSem = grupos.filter(g => !atras(g) && g.min <= 7).length;
      const nMes = grupos.filter(g => !atras(g) && g.min > 7 && g.min <= 30).length;
      let html = `<div class="ag-resumo" aria-label="Resumo dos prazos">
        <div class="ag-total"><b>${grupos.length}</b> ${grupos.length === 1 ? 'pessoa com data para cumprir' : 'pessoas com data para cumprir'}</div>
        <div class="ag-kpis">
          <div><b>${nAtras}</b><span>atrasadas</span></div>
          <div><b>${nSem}</b><span>nesta semana</span></div>
          <div><b>${nMes}</b><span>em até 30 dias</span></div>
        </div></div>`;
      const secoes = [];
      secoes.push({ t: 'Atrasados', f: atras });
      secoes.push({ t: 'Nesta semana', f: g => !atras(g) && g.min <= 7 });
      secoes.push({ t: 'De 8 a 30 dias', f: g => !atras(g) && g.min > 7 && g.min <= 30 });
      const ja = new Set();
      secoes.forEach(s => { const g = grupos.filter(s.f); g.forEach(x => ja.add(x.chave)); if (!g.length) return; html += `<div class="al-grupo">${s.t} · ${g.length} cidadão(s)</div>`; g.forEach(x => { html += cardAlerta(x); }); });
      // depois de 30 dias: um bloco por mês, pela data mais próxima de cada pessoa
      const porMes = new Map();
      grupos.filter(g => !ja.has(g.chave)).forEach(g => {
        const d = g.itens[0].data; const k = d.getFullYear() * 100 + d.getMonth();
        if (!porMes.has(k)) porMes.set(k, { d, lista: [] }); porMes.get(k).lista.push(g);
      });
      [...porMes.keys()].sort((a, b) => a - b).forEach(k => {
        const { d, lista: l } = porMes.get(k);
        html += `<div class="al-grupo">${maiuscula(d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))} · ${l.length} cidadão(s)</div>`;
        l.forEach(x => { html += cardAlerta(x); });
      });
      return html;
    }

    // ---------- Semana ----------
    function htmlAgendaSemana() {
      const hoje = iniDia(new Date());
      const ini = segundaDaSemana(hoje); ini.setDate(ini.getDate() + 7 * semanaOffset);
      const dias = []; for (let i = 0; i < 7; i++) { const d = new Date(ini); d.setDate(ini.getDate() + i); dias.push(d); }
      const lista = gerarAlertas(7 * (semanaOffset + 2));
      // atrasados vão para hoje; os demais, para a data em que vencem ou passam a valer
      const porDia = new Map();
      lista.forEach(a => {
        const iso = isoLocal(a.atrasado ? hoje : a.data);
        if (!porDia.has(iso)) porDia.set(iso, new Map());
        const m = porDia.get(iso); if (!m.has(a.chave)) m.set(a.chave, []); m.get(a.chave).push(a);
      });
      const isoHoje = isoLocal(hoje);
      let sel = diaAgenda && dias.some(d => isoLocal(d) === diaAgenda) ? diaAgenda : (semanaOffset === 0 ? isoHoje : (dias.map(isoLocal).find(i => porDia.has(i)) || isoLocal(dias[0])));
      const nDia = (iso) => (porDia.get(iso) ? porDia.get(iso).size : 0);
      const totalSemana = dias.reduce((s, d) => s + nDia(isoLocal(d)), 0);
      let html = `<div class="ag-nav">
        <button class="ag-nav-btn" onclick="moverSemana(-1)" aria-label="Semana anterior" ${semanaOffset === 0 ? 'disabled' : ''}>‹</button>
        <div class="ag-nav-txt"><b>${semanaOffset === 0 ? 'Esta semana' : 'Semana de ' + ddmm(dias[0])}</b><span>${ddmm(dias[0])} a ${ddmm(dias[6])} · ${totalSemana} ${totalSemana === 1 ? 'cidadão com data' : 'cidadãos com data'}</span></div>
        <button class="ag-nav-btn" onclick="moverSemana(1)" aria-label="Próxima semana" ${semanaOffset >= 12 ? 'disabled' : ''}>›</button>
      </div><div class="ag-dias" role="group" aria-label="Dias da semana">`;
      dias.forEach(d => {
        const iso = isoLocal(d), n = nDia(iso), passado = d < hoje;
        html += `<button class="ag-dia${iso === sel ? ' on' : ''}${iso === isoHoje ? ' hoje' : ''}${passado ? ' passado' : ''}" onclick="escolherDiaAgenda('${iso}')" aria-pressed="${iso === sel}" aria-label="${DIA_SEMANA_CURTO[d.getDay()]} ${d.getDate()}: ${n} ${n === 1 ? 'cidadão' : 'cidadãos'}">
          <span class="ag-dia-nome">${DIA_SEMANA_CURTO[d.getDay()]}</span><span class="ag-dia-num">${d.getDate()}</span><span class="ag-dia-cnt${n ? '' : ' zero'}">${n}</span></button>`;
      });
      html += '</div>';
      const dSel = dias.find(d => isoLocal(d) === sel) || dias[0];
      const mapa = porDia.get(sel);
      const nome = maiuscula(dSel.toLocaleDateString('pt-BR', { weekday: 'long' })) + ', ' + ddmm(dSel);
      if (!mapa || !mapa.size) {
        html += `<div class="al-grupo">${nome}</div>` + msgVazia('Nada com data neste dia.');
      } else {
        html += `<div class="al-grupo">${nome}${sel === isoHoje ? ' (hoje e atrasados)' : ''} · ${mapa.size} cidadão(s)</div>`;
        [...mapa.entries()].map(([chave, itens]) => { itens.sort((x, y) => x.dias - y.dias); return { chave, c: BASE_DADOS.cidadaos[chave], itens, min: itens[0].dias }; })
          .sort((a, b) => (a.c.nome || '').localeCompare(b.c.nome || '', 'pt-BR', { sensitivity: 'base' }))
          .forEach(g => { html += cardAlerta(g); });
      }
      html += '<p class="ag-nota">Cada pessoa aparece no dia em que o prazo termina ou a visita passa a valer (por exemplo, 30 dias depois da 1ª visita).</p>';
      return html;
    }
