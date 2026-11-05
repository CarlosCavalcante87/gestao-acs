/* Busca ativa de vacinação: importação do relatório, C2 (vacinas) e C7 (HPV de 9 a 14 anos) */
    // =========================================================================
    // BUSCA ATIVA DE VACINAÇÃO (relatório do PEC: uma linha por cidadão, vacina e dose)
    // =========================================================================
    // C2 considera as vacinas do indicador (penta e poliomielite); as demais ficam como informação no cartão
    const ehVacinaC2 = (imuno) => /penta|polio|vip|dtp|hepatite b|hib/.test(normalizarTexto(imuno || ''));
    const ehHpv = (imuno) => /hpv|papiloma/.test(normalizarTexto(imuno || ''));
    function nomeVacinaCurto(v) { return (v || '').replace(/^vacina\s+/i, '').trim(); }
    function textoDoseVacina(it) { return nomeVacinaCurto(it.v) + (it.d && it.d !== '-' ? ' ' + it.d : ''); }

    // Lê o relatório já separado em linhas. Devolve { meta, rows }.
    function lerRelatorioVacinacao(linhas, cabIdx) {
      const meta = {};
      for (let i = 0; i < cabIdx; i++) {
        const pc = linhas[i].split(';').map(x => x.replace(/^"|"$/g, '').trim());
        const k = normalizarTexto(pc[0]);
        if (k === 'grupo-alvo') meta.grupo = pc[1] || '';
        else if (k === 'faixa etaria') meta.faixa = pc[1] || '';
        else if (k === 'status da vacina') meta.status = pc[1] || '';
        else if (k === 'imunobiologico') meta.imuno = pc[1] || '';
        else if (k === 'dose') meta.dose = pc[1] || '';
        else if (k === 'tipo de logradouro') meta.tipoLog = pc[1] || '';
        else if (k === 'logradouro') meta.log = pc[1] || '';
        else if (k === 'bairro') meta.bairro = pc[1] || '';
        else if (k === 'gerado em') meta.gerado = pc[1] || '';
      }
      const colunas = linhas[cabIdx].split(';').map(c => c.trim().replace(/^"|"$/g, ''));
      const rows = [];
      for (let i = cabIdx + 1; i < linhas.length; i++) {
        const l = linhas[i].trim(); if (!l) continue;
        const vals = l.split(';').map(v => v.trim().replace(/^"|"$/g, ''));
        const reg = {}; colunas.forEach((c, idx) => { reg[c] = vals[idx] || ''; });
        const nome = (reg['Nome do cidadão'] || '').trim().toUpperCase();
        if (!nome || nome === '-' || nome.length < 3) continue;
        rows.push({
          nome, cpf: (reg['CPF'] || '').replace(/\D/g, ''), nasc: reg['Data de nascimento'] || '', sexo: reg['Sexo'] || '',
          status: reg['Status da vacina'] || '', v: reg['Imunobiológico'] || '', d: reg['Dose'] || ''
        });
      }
      return { meta, rows };
    }

    // Relatório em matriz (uma linha por cidadão, uma coluna por vacina/dose):
    // ✓ verde = aplicada, ✓ azul = equivalente, vazio vermelho = em atraso, ✗ = inapto pela idade, vazio sem cor = apto no prazo
    function lerMatrizVacinacao(linhas, cabIdx) {
      const colunas = linhas[cabIdx].split(';').map(c => c.trim());
      const iCpf = colunas.indexOf('CPF'), iNome = colunas.indexOf('Nome'), iNasc = colunas.indexOf('Nascimento');
      const iPrimeira = colunas.findIndex((c, i) => i > iNasc && /\b(D\d?|DU|R\d|REF)\b/i.test(c) && !/^(microarea|equipe|unidade)/i.test(normalizarTexto(c)));
      const vacinas = colunas.map((c, i) => ({ c, i })).filter(x => x.i >= iPrimeira && x.c);
      const rows = [];
      for (let i = cabIdx + 1; i < linhas.length; i++) {
        const l = linhas[i]; if (!l.trim()) continue;
        const vals = l.split(';');
        const nome = (vals[iNome] || '').trim().toUpperCase(); if (!nome || nome.length < 3) continue;
        const cels = {};
        vacinas.forEach(x => {
          const t = (vals[x.i] || '').trim(); const m = /‹([AER])›/.exec(t); const base = t.replace(/‹[AER]›/, '').trim();
          cels[x.c] = base === '✗' ? 'X' : base === '✓' ? (m ? m[1] : 'A') : (m ? m[1] : 'N');
        });
        rows.push({ nome, cpf: (vals[iCpf] || '').replace(/\D/g, ''), nasc: (vals[iNasc] || '').trim(), cels });
      }
      return { tipo: 'matriz', meta: {}, rows, colunas: vacinas.map(x => x.c) };
    }
    function aplicarMatrizVacinacao(rel, resumo) {
      const idx = indiceBase(); const gerado = dataDoNomeDoArquivo(rel.meta.arquivo) || fmtData(new Date());
      const fora = new Set();
      rel.rows.forEach(r => {
        const ch = (r.cpf.length === 11 && idx.porCpf[r.cpf]) || idx.porNome[r.nome];
        if (!ch) { fora.add(r.nome); return; }
        const c = BASE_DADOS.cidadaos[ch];
        if (r.nasc && !c.dt_nascimento) c.dt_nascimento = r.nasc;
        c.vacAtraso = rel.colunas.filter(col => r.cels[col] === 'R').map(col => ({ v: col, d: '' }));
        const colHpv = rel.colunas.find(col => ehHpv(col));
        c.vacHpv = colHpv ? r.cels[colHpv] : undefined;
        c.vacCob = { todas: true, hpv: !!colHpv }; c.vacData = gerado; c.vacFonte = 'matriz';
      });
      resumo.foraDaBase += fora.size;
    }

    // Tipo do relatório pelo filtro "Status da vacina": 'atrasada', 'no prazo' ou 'todas' (sem filtro)
    function tipoStatusVacinacao(meta) {
      const n = normalizarTexto(meta.status || '');
      if (/atras/.test(n)) return 'atrasada';
      if (/no prazo/.test(n)) return 'no prazo';
      return 'todas';
    }
    const ROTULO_STATUS_VAC = { 'atrasada': 'Atrasadas', 'no prazo': 'No prazo', 'todas': 'Atrasadas e no prazo' };
    // Guarda quais relatórios já foram importados (para a tela mostrar o que falta), um por grupo-alvo e status
    const VAC_REL_KEY = 'guia_vac_relatorios';
    function lerRelatoriosVacImportados() { try { return JSON.parse(localStorage.getItem(VAC_REL_KEY)) || {}; } catch (e) { return {}; } }
    function registrarRelatorioVacinacao(rel, data) {
      if (rel.tipo === 'matriz') return;
      try {
        const reg = lerRelatoriosVacImportados(); const tipo = tipoStatusVacinacao(rel.meta);
        reg[tipo + '|' + normalizarTexto(rel.meta.grupo || '')] = { tipo, grupo: rel.meta.grupo || 'todos os grupos', data, arquivo: rel.meta.arquivo || '', pessoas: new Set(rel.rows.map(r => r.nome)).size };
        localStorage.setItem(VAC_REL_KEY, JSON.stringify(reg));
      } catch (e) {}
    }

    // Faixa de idade (em anos completos) que o relatório cobre; null quando não dá para saber.
    function faixaCobertaVacinacao(meta) {
      let min = null, max = null;
      const g = meta.grupo || '';
      let m = g.match(/(\d+)\s*a\s*(\d+)\s*anos/i);
      if (m) { min = +m[1]; max = +m[2]; }
      else if ((m = g.match(/(\d+)\s*anos?\s*ou\s*mais/i))) { min = +m[1]; max = 200; }
      if (min === null) return null;
      const f = (meta.faixa || '');
      const mf = f.match(/(\d+)\D+(\d+)/);
      if (mf) { min = Math.max(min, +mf[1]); max = Math.min(max, +mf[2]); }
      return { min, max };
    }
    const filtroVazio = (v) => { const n = normalizarTexto(v || ''); return n === '' || n === '-' || n === 'todas' || n === 'todos'; };

    // O PEC põe a data e a hora da exportação no nome: busca-ativa-vacinacao_2026-11-03-09-33.csv
    function dataDoNomeDoArquivo(nome) {
      const m = /(\d{4})-(\d{2})-(\d{2})(?:-(\d{2})-(\d{2}))?/.exec(nome || ''); if (!m) return null;
      return `${m[3]}/${m[2]}/${m[1]}`;
    }

    function indiceBase() {
      const porCpf = {}, porNome = {};
      Object.entries(BASE_DADOS.cidadaos).forEach(([ch, c]) => {
        const d = (c.cpf || '').replace(/\D/g, ''); if (d.length === 11) porCpf[d] = ch;
        if (/^\d{11}$/.test(ch)) porCpf[ch] = ch;
        if (c.nome) porNome[c.nome.toUpperCase()] = ch;
      });
      return { porCpf, porNome };
    }

    // Aplica os relatórios de vacinação lidos nesta importação. Devolve um resumo para a tela.
    function aplicarRelatoriosVacinacao(relatorios) {
      const resumo = { pessoas: 0, vacinas: 0, foraDaBase: 0, hpv: 0, prazoPessoas: 0, prazoVacinas: 0 };
      relatorios.forEach(rel => {
        if (rel.tipo === 'matriz') { aplicarMatrizVacinacao(rel, resumo); return; }
        const { meta, rows } = rel; const idx = indiceBase();
        const statusAtraso = filtroVazio(meta.status) || /atras/.test(normalizarTexto(meta.status));
        const statusPrazo = filtroVazio(meta.status) || /no prazo/.test(normalizarTexto(meta.status));
        const filtrosLivres = filtroVazio(meta.dose) && filtroVazio(meta.tipoLog) && filtroVazio(meta.log) && filtroVazio(meta.bairro);
        const inferir = statusAtraso && filtrosLivres;
        const inferirPrazo = statusPrazo && filtrosLivres;
        const faixa = faixaCobertaVacinacao(meta);
        const imunoEspecifico = !filtroVazio(meta.imuno);
        const temHpvNoRelatorio = rows.some(r => ehHpv(r.v)) || (imunoEspecifico && ehHpv(meta.imuno));
        const gerado = dataDoNomeDoArquivo(meta.arquivo) || meta.gerado || fmtData(new Date());
        // 1) linhas por cidadão (só vacinas atrasadas)
        const porChave = {}, porChavePrazo = {}; const fora = new Set();
        rows.forEach(r => {
          const st = normalizarTexto(r.status);
          const ehAtraso = /atras/.test(st), ehPrazo = /no prazo/.test(st);
          if (!ehAtraso && !ehPrazo) return;
          const ch = (r.cpf.length === 11 && idx.porCpf[r.cpf]) || idx.porNome[r.nome];
          if (!ch) { fora.add(r.nome); return; }
          ((ehAtraso ? porChave : porChavePrazo)[ch] = (ehAtraso ? porChave : porChavePrazo)[ch] || []).push({ v: r.v, d: r.d });
          const c = BASE_DADOS.cidadaos[ch];
          if (r.sexo && r.sexo !== '-' && !c.sexo) c.sexo = r.sexo;
          if (r.nasc && r.nasc !== '-' && !c.dt_nascimento) c.dt_nascimento = r.nasc;
        });
        resumo.foraDaBase += fora.size;
        // 1b) vacinas "no prazo" (a aplicar, ainda sem atraso): só informação no cartão e alerta de HPV
        Object.entries(BASE_DADOS.cidadaos).forEach(([ch, c]) => {
          const novas = porChavePrazo[ch] || [];
          const idade = c.dt_nascimento ? idadeEmAnos(c.dt_nascimento) : null;
          const coberto = inferirPrazo && faixa && idade !== null && idade >= faixa.min && idade <= faixa.max;
          if (c.vacFonte === 'matriz') return;
          if (!coberto && !novas.length) return;
          let lista = c.vacNoPrazo || [];
          if (coberto) lista = imunoEspecifico ? lista.filter(x => (ehHpv(meta.imuno) ? !ehHpv(x.v) : normalizarTexto(x.v) !== normalizarTexto(meta.imuno))) : [];
          novas.forEach(n => { if (!lista.some(x => normalizarTexto(x.v) === normalizarTexto(n.v) && x.d === n.d)) lista.push(n); });
          c.vacNoPrazo = lista; c.vacDataPrazo = gerado;
        });
        registrarRelatorioVacinacao(rel, gerado);
        // 2) cobertura: todo cidadão da base dentro da faixa foi "avaliado" por este relatório
        Object.entries(BASE_DADOS.cidadaos).forEach(([ch, c]) => {
          const novas = porChave[ch] || [];
          const idade = c.dt_nascimento ? idadeEmAnos(c.dt_nascimento) : null;
          const coberto = inferir && faixa && idade !== null && idade >= faixa.min && idade <= faixa.max;
          if (c.vacFonte === 'matriz') return;
          if (!coberto && !novas.length) return;
          let lista = c.vacAtraso || [];
          if (coberto) {
            if (!imunoEspecifico) lista = lista.filter(x => ehHpv(x.v) && !temHpvNoRelatorio); // mantém HPV antigo se este relatório não avalia HPV
            else lista = lista.filter(x => (ehHpv(meta.imuno) ? !ehHpv(x.v) : normalizarTexto(x.v) !== normalizarTexto(meta.imuno)));
            c.vacCob = c.vacCob || {};
            if (!imunoEspecifico) c.vacCob.todas = true;
            if (temHpvNoRelatorio) c.vacCob.hpv = true;
          }
          novas.forEach(n => { if (!lista.some(x => normalizarTexto(x.v) === normalizarTexto(n.v) && x.d === n.d)) lista.push(n); });
          c.vacAtraso = lista; c.vacData = gerado;
        });
      });
      Object.values(BASE_DADOS.cidadaos).forEach(c => { aplicarVacinacaoCidadao(c); });
      Object.values(BASE_DADOS.cidadaos).forEach(c => { if (c.vacNoPrazo && c.vacNoPrazo.length) { resumo.prazoPessoas++; resumo.prazoVacinas += c.vacNoPrazo.length; } });
      Object.values(BASE_DADOS.cidadaos).forEach(c => { if (c.vacAtraso && c.vacAtraso.length) { resumo.pessoas++; resumo.vacinas += c.vacAtraso.length; if (c.vacAtraso.some(x => ehHpv(x.v))) resumo.hpv++; } });
      const meninas = Object.values(BASE_DADOS.cidadaos).filter(ehMeninaHpv);
      resumo.meninas = meninas.length; resumo.meninasHpv = meninas.filter(c => (c.vacCob && c.vacCob.hpv) || (c.vacAtraso || []).some(x => ehHpv(x.v))).length;
      return resumo;
    }

    // C7: monta o texto e o resultado a partir da base guardada e do estado do HPV.
    function estadoHpv(c) {
      if (c.vacHpv) {
        if (c.vacHpv === 'A' || c.vacHpv === 'E') return { tipo: 'ok', txt: 'em dia' };
        if (c.vacHpv === 'R') return { tipo: 'atrasada', doses: [], nome: 'HPV' };
        if (c.vacHpv === 'N') return { tipo: 'aplicar' };
      }
      const hl = (c.vacAtraso || []).filter(x => ehHpv(x.v));
      if (hl.length) return { tipo: 'atrasada', doses: hl.map(x => x.d).filter(d => d && d !== '-'), nome: nomeVacinaCurto(hl[0].v) };
      if ((c.vacNoPrazo || []).some(x => ehHpv(x.v))) return { tipo: 'aplicar' };   // relatório "No prazo": dose liberada, ainda não aplicada
      if (c.vacCob && c.vacCob.hpv) return { tipo: 'ok', txt: 'em dia' };
      const b = c.c7_base || {};
      if (b.doses >= 1) return { tipo: 'ok', txt: b.doses + ' dose' + (b.doses > 1 ? 's' : '') };
      return { tipo: 'sem' };
    }
    function montarC7(c) {
      const b = c.c7_base; if (!b) return;
      const st = b.hpv ? estadoHpv(c) : null;
      const hpvOk = !b.hpv || st.tipo === 'ok';
      const partes = [], pend = [];
      b.partes.forEach(p => {
        if (p !== '@HPV') { partes.push(p); return; }
        partes.push(st.tipo === 'ok' ? `HPV ${st.txt} ✓` : st.tipo === 'atrasada' ? `HPV ${st.doses.length ? st.doses.join('/') + ' ' : ''}atrasada ✗` : st.tipo === 'aplicar' ? 'HPV a aplicar ✗' : (b.semLista ? 'HPV sem informação ✗' : 'HPV sem registro ✗'));
      });
      b.pend.forEach(p => {
        if (p !== '@HPV') { pend.push(p); return; }
        if (st.tipo === 'atrasada') pend.push(`C7: Busca Ativa - Vacina HPV atrasada${st.doses.length ? ' (' + st.doses.join(', ') + ')' : ''}: aplicar a dose em atraso (9 a 14 anos)`);
        else if (st.tipo === 'aplicar') pend.push('C7: Vacina HPV (9 a 14 anos): dose liberada e ainda sem registro. Aplicar na UBS ou conferir a caderneta');
        else if (st.tipo === 'sem') pend.push(b.semLista ? 'C7: Vacina HPV (9 a 14 anos): sem informação no sistema. Conferir a caderneta na visita e importar a busca ativa de vacinação com o imunobiológico HPV' : 'C7: Busca Ativa - Vacina HPV (9 a 14 anos) sem registro: conferir a caderneta e importar a busca ativa de vacinação (HPV)');
      });
      c.pendencias = (c.pendencias || []).filter(p => !p.startsWith('C7:')).concat(pend);
      c.c7Ok = b.outros && hpvOk;
      c.c7_tempo = { texto: '🩺 ' + partes.join(' · '), ok: c.c7Ok };
      c.indicadores = c.indicadores || {}; c.indicadores.C7 = true;
    }
    const ehMeninaHpv = (c) => { const a = c.dt_nascimento ? idadeEmAnos(c.dt_nascimento) : null; return a !== null && a >= 9 && a <= 14 && /^f/i.test(c.sexo || ''); };

    // Reaplica a vacinação de um cidadão sobre C2 e C7. Pode rodar quantas vezes for preciso.
    function aplicarVacinacaoCidadao(c) {
      // C2: vacinas da criança vêm do relatório quando ele avaliou todas as vacinas
      if (c.indicadores && c.indicadores.C2 && c.ex && c.ex.C2 && c.vacCob && c.vacCob.todas) {
        const lista = (c.vacAtraso || []).filter(x => ehVacinaC2(x.v));
        c.c2_vacinasOk = lista.length === 0;
        c.ex.C2.okExtra = c.c2_vacinasOk;
        c.ex.C2.pend = lista.length ? [`C2: Vacina Penta/Pólio em atraso 💉 (${lista.length}): ` + lista.map(textoDoseVacina).join(' · ')] : [];
        aplicarVisitasApp(c);
      }
      // C7: meninas de 9 a 14 anos que ainda não estavam na lista "Saúde da mulher" entram só pelo HPV
      if (!c.c7_base && ehMeninaHpv(c)) {
        c.c7_base = { outros: true, partes: ['@HPV'], pend: ['@HPV'], hpv: true, doses: 0, semLista: true };
      }
      if (c.c7_base) montarC7(c);
    }

    // Influenza das pessoas idosas (60 anos ou mais), com ou sem lista de idosos: em dia, em atraso ou sem informação.
    // Fontes: lista "Pessoa idosa" (c.infC6) e relatório de busca ativa de vacinação (c.vacAtraso / c.vacCob).
    function estadoInfluenza(c) {
      const atraso = (c.vacAtraso || []).some(x => /influenza/.test(normalizarTexto(x.v || '')));
      const lista = c.infC6;
      if (atraso || (lista && lista.pend)) return { tipo: 'atrasada' };
      if (lista) return { tipo: 'ok', txt: lista.txt && lista.txt !== '-' ? lista.txt : '' };
      if (c.vacCob && c.vacCob.todas) return { tipo: 'ok', txt: '' };
      return { tipo: 'sem' };
    }
    function badgeInfluenza(c) {
      const anos = c.dt_nascimento ? idadeEmAnos(c.dt_nascimento) : null;
      if (anos === null || anos < 60) return '';
      const st = estadoInfluenza(c);
      const t = st.tipo === 'ok' ? ['tag-ok', '✓ Influenza em dia'] : st.tipo === 'atrasada' ? ['tag-danger', '✗ Influenza em atraso'] : ['tag-sem', '? Influenza sem informação'];
      return `<span class="tag ${t[0]}" title="${escHtml(st.txt || 'Vacina influenza')}">${t[1]} 💉</span>`;
    }
