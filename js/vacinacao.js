/* Busca ativa de vacinação: importação do relatório, C2 (vacinas) e C7 (HPV de 9 a 14 anos; faixas etárias do C7 em faixasC7) */
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
    // O app acompanha vacinas só até esta idade (crianças e adolescentes de 0 a 14 anos)
    const VAC_IDADE_MAX = 14;
    // 'criancas' (0 a 9) ou 'adolescentes' (10 a 19, filtrado de 10 a 14); null se não der para saber
    function grupoVacinacao(meta) {
      const n = normalizarTexto((meta && meta.grupo) || '');
      if (/crian/.test(n)) return 'criancas';
      if (/adolesc/.test(n)) return 'adolescentes';
      const f = faixaCobertaVacinacao(meta);
      if (f) return f.min <= 9 ? 'criancas' : (f.min <= 19 ? 'adolescentes' : null);
      return null;
    }
    const ROTULO_STATUS_VAC = { 'atrasada': 'Atrasadas', 'no prazo': 'No prazo', 'todas': 'Atrasadas e no prazo' };
    // Guarda quais relatórios já foram importados (para a tela mostrar o que falta), um por grupo-alvo e status
    const VAC_REL_KEY = 'guia_vac_relatorios';
    function lerRelatoriosVacImportados() { try { return JSON.parse(localStorage.getItem(VAC_REL_KEY)) || {}; } catch (e) { return {}; } }
    function registrarRelatorioVacinacao(rel, data) {
      if (rel.tipo === 'matriz') return;
      try {
        const reg = lerRelatoriosVacImportados(); const tipo = tipoStatusVacinacao(rel.meta);
        reg[tipo + '|' + normalizarTexto(rel.meta.grupo || '') + '|' + normalizarTexto(rel.meta.faixa || '')] = { tipo, g: grupoVacinacao(rel.meta), grupo: (rel.meta.grupo || 'todos os grupos') + (/\d/.test(rel.meta.faixa || '') ? ' · ' + rel.meta.faixa.replace(/^-\s*/, '') : ''), data, arquivo: rel.meta.arquivo || '', pessoas: new Set(rel.rows.map(r => r.nome)).size };
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
      max = Math.min(max, VAC_IDADE_MAX);
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
      // 0) data de nascimento e sexo de QUALQUER relatório entram antes de avaliar a cobertura: a ordem dos arquivos não muda o resultado
      { const idx0 = indiceBase();
        relatorios.forEach(rel => {
          if (rel.tipo === 'matriz') return;
          rel.rows.forEach(r => {
            const ch = (r.cpf.length === 11 && idx0.porCpf[r.cpf]) || idx0.porNome[r.nome]; if (!ch) return;
            const c = BASE_DADOS.cidadaos[ch];
            if (r.sexo && r.sexo !== '-' && !c.sexo) c.sexo = r.sexo;
            if (r.nasc && r.nasc !== '-' && !c.dt_nascimento) c.dt_nascimento = r.nasc;
          });
        }); }
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
          { const nasc = r.nasc || BASE_DADOS.cidadaos[ch].dt_nascimento; const id = nasc ? idadeEmAnos(nasc) : null; if (id !== null && id > VAC_IDADE_MAX) return; }   // só até 14 anos
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
          if (coberto && !imunoEspecifico) c.vacCobPrazo = true;   // o relatório "No prazo" avaliou todas as vacinas desta pessoa
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
      resumo.meninas = meninas.length; resumo.meninasHpv = meninas.filter(c => (c.vacCob && c.vacCob.hpv) || hpvSemPendenciaNosRelatorios(c) || (c.vacAtraso || []).some(x => ehHpv(x.v))).length;
      return resumo;
    }

    // C7: monta o texto e o resultado a partir da base guardada e do estado do HPV.
    // Os relatórios de Atrasadas e de No prazo (sem filtro de imunobiológico) cobriram a pessoa: se o HPV não está
    // em nenhum dos dois, a dose já foi aplicada (ou a pessoa não está elegível), então não há pendência de HPV.
    const hpvSemPendenciaNosRelatorios = (c) => !!(c.vacCob && c.vacCob.todas && c.vacCobPrazo);
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
      if (hpvSemPendenciaNosRelatorios(c)) return { tipo: 'ok', txt: 'em dia' };   // avaliada em Atrasadas e No prazo e HPV não aparece em nenhum
      const b = c.c7_base || {};
      if (b.doses >= 1) return { tipo: 'ok', txt: b.doses + ' dose' + (b.doses > 1 ? 's' : '') };
      return { tipo: 'sem' };
    }
    // Faixas etárias do C7 (Saúde da mulher): ÚNICA fonte da regra. Vale a idade completa HOJE.
    //   HPV 9–14 · consulta de saúde sexual e reprodutiva 14–69 · preventivo (colo do útero) 25–64 · mamografia 50–69
    // Sem data de nascimento não dá para saber a faixa: nada é cobrado. Sexo masculino nunca entra.
    function faixasC7(anos, sexo) {
      const f = { hpv: false, consulta: false, colo: false, mama: false };
      if (typeof anos !== 'number' || isNaN(anos) || anos < 0) return f;
      if (/^\s*m/i.test(sexo || '')) return f;
      f.hpv = anos >= 9 && anos <= 14;
      f.consulta = anos >= 14 && anos <= 69;
      f.colo = anos >= 25 && anos <= 64;
      f.mama = anos >= 50 && anos <= 69;
      return f;
    }
    // Situação guardada de cada procedimento (data do último registro e se está dentro do prazo).
    // Bases guardadas por versões anteriores só tinham o texto das etiquetas: recupera o que dá dele.
    function itensC7(b) {
      if (b.v === 2) return b.itens || {};
      const it = {}, chaves = { Preventivo: 'colo', Consulta: 'consulta', Mamografia: 'mama' };
      (b.partes || []).forEach(p => {
        const m = /^(Preventivo|Consulta|Mamografia) (.+) ([✓✗])$/.exec(p);
        if (m) it[chaves[m[1]]] = { dt: m[2] === 'sem registro' ? '' : m[2], ok: m[3] === '✓' };
      });
      return it;
    }
    // Monta etiquetas e pendências do C7 SEMPRE pela idade de hoje: quem saiu da faixa deixa de ser cobrada
    // e quem entrou passa a ser (a base guardada tem a situação de todos os procedimentos).
    function montarC7(c) {
      const b = c.c7_base; if (!b) return;
      const f = faixasC7(c.dt_nascimento ? idadeEmAnos(c.dt_nascimento) : null, c.sexo);
      if (b.semLista) { f.consulta = false; f.colo = false; f.mama = false; }   // entrou só pela vacinação: só o HPV
      c.pendencias = (c.pendencias || []).filter(p => !p.startsWith('C7:'));
      if (!f.hpv && !f.consulta && !f.colo && !f.mama) {   // fora de todas as faixas: sem etiqueta e sem cobrança de C7
        if (c.indicadores) delete c.indicadores.C7;
        delete c.c7Ok; delete c.c7_tempo;
        return;
      }
      const it = itensC7(b);
      const partes = [], pend = [];
      let outrosOk = true, hpvOk = true;
      const proc = (k, rotulo, msg) => {
        if (!f[k]) return;
        const x = it[k] || { dt: '', ok: false };
        partes.push(`${rotulo} ${x.dt || 'sem registro'} ${x.ok ? '✓' : '✗'}`);
        if (!x.ok) { outrosOk = false; pend.push(msg(x.dt)); }
      };
      proc('colo', 'Preventivo', dt => 'C7: Busca Ativa - Preventivo (colo do útero) solicitado ou avaliado nos últimos 3 anos' + (dt ? ` (último registro em ${dt})` : ' (sem registro)'));
      if (f.hpv) {
        const st = estadoHpv(c);
        hpvOk = st.tipo === 'ok';
        if (st.tipo === 'atrasada') pend.push(`C7: Busca Ativa - Vacina HPV atrasada${st.doses.length ? ' (' + st.doses.join(', ') + ')' : ''}: aplicar a dose em atraso (9 a 14 anos)`);
        else if (st.tipo === 'aplicar') pend.push('C7: Vacina HPV (9 a 14 anos): dose liberada e ainda sem registro. Aplicar na UBS ou conferir a caderneta');
        else if (st.tipo === 'sem') pend.push(b.semLista ? 'C7: Vacina HPV (9 a 14 anos): sem informação no sistema. Conferir a caderneta na visita e importar a busca ativa de vacinação com o imunobiológico HPV' : 'C7: Busca Ativa - Vacina HPV (9 a 14 anos) sem registro: conferir a caderneta e importar a busca ativa de vacinação (HPV)');
      }
      proc('consulta', 'Consulta', dt => 'C7: Busca Ativa - Consulta de saúde sexual e reprodutiva no último ano' + (dt ? ` (última em ${dt})` : ' (sem registro)'));
      proc('mama', 'Mamografia', dt => 'C7: Busca Ativa - Mamografia solicitada ou avaliada nos últimos 2 anos' + (dt ? ` (último registro em ${dt})` : ' (sem registro)'));
      c.pendencias = c.pendencias.concat(pend);
      c.c7Ok = outrosOk && hpvOk;
      c.c7_tempo = { texto: partes.length ? '🩺 ' + partes.join(' · ') : '', ok: c.c7Ok };   // o HPV tem etiqueta própria (badgeHpv)
      c.indicadores = c.indicadores || {}; c.indicadores.C7 = true;
    }
    // Etiqueta do HPV no cartão (meninas de 9 a 14 anos): verde quando a planilha confirma, vermelha em qualquer outro caso
    function badgeHpv(c) {
      if (!c.c7_base || !(c.indicadores && c.indicadores.C7)) return '';
      if (!faixasC7(c.dt_nascimento ? idadeEmAnos(c.dt_nascimento) : null, c.sexo).hpv) return '';
      const st = estadoHpv(c), ok = st.tipo === 'ok';
      const dica = ok ? 'HPV em dia' : st.tipo === 'atrasada' ? 'HPV atrasada' : st.tipo === 'aplicar' ? 'HPV a aplicar (dose liberada, sem registro)' : 'HPV sem informação nas planilhas';
      return `<span class="tag ${ok ? 'tag-ok' : 'tag-danger'}" title="${escHtml(dica)}">${ok ? '✓' : '✗'} 💉 HPV</span>`;
    }
    const ehMeninaHpv = (c) => { const a = c.dt_nascimento ? idadeEmAnos(c.dt_nascimento) : null; return faixasC7(a, c.sexo).hpv && /^f/i.test(c.sexo || ''); };

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
        c.c7_base = { v: 2, itens: {}, doses: 0, semLista: true };
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
