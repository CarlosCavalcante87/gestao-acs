/* Regras dos indicadores C1–C7 e cartões */
    // C2: 1ª visita até 30 dias de vida; 2ª depois do 30º dia e até 6 meses
    function avaliarVisitasC2(nasc, v1, v2, qtd) {
      const hoje = new Date();
      const r = { ok: false, pend: [], tempo: '', tempoOk: false };
      if (!nasc || isNaN(nasc.getTime())) {
        r.ok = qtd >= 2;
        if (!r.ok) r.pend.push(`Visita Domiciliar pendente (${qtd}/2 visitas)`);
        return r;
      }
      const lim1 = somarDias(nasc, 30), ini2 = somarDias(nasc, 31), lim2 = somarMeses(nasc, 6), fim24 = somarMeses(nasc, 24);
      const d1 = v1 ? diasEntre(nasc, v1) : null;
      const d2 = v2 ? diasEntre(nasc, v2) : null;
      const ok1 = !!v1 && d1 >= 0 && d1 <= 30;
      const ok2 = !!v2 && d2 > 30 && v2 <= lim2;
      r.ok1 = ok1; r.ok2 = ok2;
      const partes = [];
      const marca = ok => (hoje > fim24) ? '' : (ok ? ' ✓' : ' ✗');   // acima de 24 meses só informa, sem cobrar prazo
      if (v1) partes.push(`1ª aos ${d1} dias${marca(ok1)}`);
      if (v2) partes.push(`2ª aos ${d2} dias${marca(ok2)}`);
      if (v1 && v2) partes.push(`${diasEntre(v1, v2)} dias entre elas`);
      r.tempo = partes.length ? '⏱ ' + partes.join(' · ') : '⏱ Sem visitas registradas';
      if (hoje > fim24) {            // acima de 24 meses: o prazo das visitas já encerrou
        r.ok = qtd >= 2; r.tempoOk = r.ok;
        return r;
      }
      r.ok = ok1 && ok2;
      r.tempoOk = r.ok;
      const nota = qtd > 2 ? ` — o relatório traz só as 2 primeiras datas (há ${qtd} visitas): confira se alguma cai nesse período` : '';
      const janela2 = `entre ${fmtData(ini2)} e ${fmtData(lim2)}`;
      if (!ok1) {
        if (!v1) r.pend.push(hoje <= lim1 ? `1ª visita (motivo: "Recém-nascido"): fazer até ${fmtData(lim1)} (30 dias de vida)` : `1ª visita não consta no relatório e o prazo (30 dias de vida) terminou em ${fmtData(lim1)}`);
        else r.pend.push(`1ª visita foi aos ${d1} dias de vida, fora do prazo (até 30 dias)`);
      }
      if (!ok2) {
        if (!v2) r.pend.push(hoje <= lim2 ? `2ª visita (motivo: "Criança"): fazer ${janela2} (depois dos 30 dias e até 6 meses de vida)${nota}` : `2ª visita não consta no relatório e o prazo (6 meses de vida) terminou em ${fmtData(lim2)}${nota}`);
        else if (d2 <= 30) r.pend.push(hoje <= lim2 ? `2ª visita foi aos ${d2} dias de vida (antes do 31º dia, não conta): fazer outra ${janela2}${nota}` : `2ª visita foi aos ${d2} dias de vida (não conta) e o prazo de 6 meses terminou em ${fmtData(lim2)}${nota}`);
        else r.pend.push(`2ª visita foi aos ${d2} dias de vida, depois dos 6 meses: fora do prazo${nota}`);
      }
      return r;
    }

// Telefone -> link do WhatsApp (abre o WhatsApp ou o WhatsApp Business instalado no celular)
// Ícone ao lado do telefone: usa o arquivo icone-whatsapp.png (se estiver na pasta do app) ou um ícone simples de mensagem
    let temIconeWa = false;
    function htmlIconeMsg() {
      if (temIconeWa) return '<img class="ico-wa" src="./icone-whatsapp.png" alt="" width="20" height="20">';
      return '<svg class="ico-msg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>';
    }
    fetch('./icone-whatsapp.png', { method: 'HEAD' }).then(r => {
      if (r.ok) { temIconeWa = true; if (typeof filtrarLista === 'function' && Object.keys(BASE_DADOS.cidadaos).length) filtrarLista(); }
    }).catch(() => {});

    function linkWhatsApp(tel) {
      let d = (tel || '').replace(/\D/g, '').replace(/^0+/, '');
      if (d.length < 10 || d.slice(-8) === '00000000') return null;
      if (d.length <= 11) d = '55' + d;
      return `https://wa.me/${d}`;
    }

function idadeEmAnos(dtStr) {
      const n = parseDataJS(dtStr);
      if (!n || isNaN(n.getTime())) return null;
      const hoje = new Date();
      let a = hoje.getFullYear() - n.getFullYear();
      if (hoje.getMonth() < n.getMonth() || (hoje.getMonth() === n.getMonth() && hoje.getDate() < n.getDate())) a--;
      return a;
    }

    function calcularIdade(dtStr) {
      const n = parseDataJS(dtStr);
      if (!n || isNaN(n.getTime())) return '';
      const hoje = new Date();
      let anos = hoje.getFullYear() - n.getFullYear();
      let meses = hoje.getMonth() - n.getMonth();
      if (hoje.getDate() < n.getDate()) meses--;
      if (meses < 0) { anos--; meses += 12; }
      if (anos < 0) return '';
      const a = anos === 1 ? '1 ano' : `${anos} anos`;
      const m = meses === 1 ? '1 mês' : `${meses} meses`;
      if (anos === 0) return meses === 0 ? 'menos de 1 mês' : m;
      return meses === 0 ? a : `${a} e ${m}`;
    }

    function inicializarListaPlanilhas() {
      const listaDiv = document.getElementById('listaArquivosUpload');
      let html = `<div class="file-list-header">
            <span>0 de ${PLANILHAS_ESPERADAS.length} planilhas selecionadas</span>
          </div>`;
      
      PLANILHAS_ESPERADAS.forEach(p => {
        html += `
          <div class="file-item" id="file-item-${p.id}">
            <div class="file-item-icon pending">-</div>
            <div class="file-item-content">
              <div class="file-item-title">${p.icone} ${p.titulo}</div>
              <div class="file-item-status pending">${p.desc}</div>
            </div>
          </div>
        `;
      });
      listaDiv.innerHTML = html;
    }

    async function processarFicheiros(files) {
      if (!files.length) return;
      const prog = document.getElementById('progressoUpload');
      const listaDiv = document.getElementById('listaArquivosUpload');
      
      prog.style.color = "#0284c7";
      prog.innerHTML = `⏳ Lendo ${files.length} arquivo(s)...`;
      
      const fotoAntes = fotoIndicadores();
      cpfToChave = {}; nomeToChave = {};
      let arquivosProcessados = {};
      const perfilDetectado = {};
      const relatoriosVacinacao = [];
      const limpaValor = (v) => (v || '').toString().replace(/^"|"$/g, '').trim();
      const detectarPerfil = (chaveBruta, valorBruto) => {
        const k = normalizarTexto(chaveBruta);
        const v = limpaValor(valorBruto);
        if (!v || v === '-' || v.length > 80) return;
        if (!perfilDetectado.micro && (k.includes('microarea') || k.includes('micro-area') || k.includes('micro area'))) perfilDetectado.micro = v;
        if (!perfilDetectado.nome && (k.includes('agente comunitario') || k === 'acs' || k.includes('nome do acs') || k.includes('profissional'))) perfilDetectado.nome = v;
      };

      for (let file of files) {
        let textoArquivo;
        try { textoArquivo = await obterTextoArquivo(file); }
        catch (e) { avisoToast('Não foi possível ler ' + file.name + ': ' + e.message); continue; }
        await new Promise((resolve) => {
          const reader = { result: textoArquivo };
          const processar = () => {
            const linhas = reader.result.split(/\r?\n/);
            let tema = "", cabIdx = -1, ehVac = false, ehMatriz = false;
            for (let i = 0; i < Math.min(linhas.length, 35); i++) {
              const l = linhas[i].trim();
              {
                const pc = l.split(';');
                if (pc.length >= 2) detectarPerfil(pc[0], pc[1]);
                // Linha "Gerado em ; data ; às ; hora ; por ; NOME"
                const iPor = pc.findIndex(cel => normalizarTexto(limpaValor(cel)) === 'por');
                if (iPor !== -1 && !perfilDetectado.nome) {
                  const nomeAcs = pc.slice(iPor + 1).map(limpaValor).find(x => x && x !== '-');
                  if (nomeAcs) perfilDetectado.nome = nomeAcs;
                }
              }
              if (l.includes("Lista temática;")) tema = l.split(";")[1]?.trim();
              if (normalizarTexto(l).includes('busca ativa de vacina')) ehVac = true;
              if (l.startsWith("Nome do cidadão;")) { cabIdx = i; break; }
              if (/^CPF;CNS;Nome;Nascimento;/.test(l)) { cabIdx = i; ehVac = true; ehMatriz = true; break; }
              if (l.startsWith("Nome;") || l.startsWith("NOME CIDADÃO;") || l.startsWith("Nome equipe;") || l.startsWith("TIPO DE LOGRADOURO;")) {
                cabIdx = i; break;
              }
            }

            let matchedId = null;
            if (ehVac) matchedId = 'vacinacao';
            else if (tema === "Desenvolvimento infantil") matchedId = 'criancas';
            else if (tema === "Gestação e puerpério") matchedId = 'gestantes';
            else if (tema === "Diabetes") matchedId = 'diabeticos';
            else if (tema === "Hipertensão") matchedId = 'hipertensos';
            else if (tema === "Pessoa idosa") matchedId = 'idosos';
            else if (tema === "Saúde da mulher") matchedId = 'mulher';
            else if (tema) matchedId = 'lista_geral';
            else {
              const fname = file.name.toLowerCase();
              if (fname.includes('cidadaos') || fname.includes('cadastro')) matchedId = 'cadastros';
              else if (fname.includes('territorio') || fname.includes('domiciliar') || fname.includes('familia')) matchedId = 'territorio';
              else matchedId = 'lista_geral';
            }
            
            let countAtualizados = 0;
            let countBolsaFamiliaFile = 0;

            if (ehVac && cabIdx !== -1) {
              const rel = ehMatriz ? lerMatrizVacinacao(linhas, cabIdx) : lerRelatorioVacinacao(linhas, cabIdx); rel.meta.arquivo = file.name;
              relatoriosVacinacao.push(rel);
              countAtualizados = new Set(rel.rows.map(r => r.nome)).size;
            } else if (cabIdx !== -1) {
              const colunas = linhas[cabIdx].split(";").map(c => c.trim().replace(/^"|"$/g, ''));
              for (let i = cabIdx + 1; i < linhas.length; i++) {
                const linha = linhas[i].trim();
                if (!linha) continue;
                const vals = linha.split(";").map(v => v.trim().replace(/^"|"$/g, ''));
                const reg = {};
                colunas.forEach((col, idx) => { reg[col] = vals[idx] || ""; });
                
                const nome = (reg["Nome"] || reg["NOME CIDADÃO"] || "").trim().toUpperCase();
                if (!nome || nome === "-" || nome === "SEM MORADORES" || nome.length < 3) continue;
                
                countAtualizados++;
                for (let kPerf in reg) detectarPerfil(kPerf, reg[kPerf]);

                const cpfLimpo = (reg["CPF"] || reg["CPF/CNS"] || "").replace(/\D/g, "");
                const cpfValido = (cpfLimpo.length === 11) ? cpfLimpo : "";
                let chave = null;
                if (cpfValido && cpfToChave[cpfValido]) chave = cpfToChave[cpfValido];
                else if (nomeToChave[nome]) chave = nomeToChave[nome];
                else chave = cpfValido ? cpfValido : nome;

                if (cpfValido) cpfToChave[cpfValido] = chave;
                if (nome) nomeToChave[nome] = chave;

                let ruaBruta = (reg["Rua"] || reg["LOGRADOURO"] || "").trim().toUpperCase();
                if (ruaBruta.includes("SÃO FRANCISCO") || ruaBruta.includes("SAO FRANCISCO")) ruaBruta = "RUA SÃO FRANCISCO";
                else if (ruaBruta.includes("SÃO PEDRO") || ruaBruta.includes("SAO PEDRO")) ruaBruta = "RUA SÃO PEDRO";
                else if (ruaBruta && !ruaBruta.startsWith("RUA ") && !ruaBruta.startsWith("AVENIDA ")) ruaBruta = "RUA " + ruaBruta;

                if (!BASE_DADOS.cidadaos[chave]) {
                  BASE_DADOS.cidadaos[chave] = {
                    nome: nome, cpf: reg["CPF"] || reg["CPF/CNS"] || "", 
                    rua: ruaBruta, numero: reg["Número"] || reg["NÚMERO"] || "",
                    telefone: reg["Telefone celular"] || "", condicoes: {}, indicadores: { "C1": true }, pendencias: [],
                    bolsaFamilia: false
                  };
                }
                
                const cid = BASE_DADOS.cidadaos[chave];
                absorverMedidas(cid, reg);
                cid.indicadores['C1'] = true;
                if (!cid.nome) cid.nome = nome;
                if (!cid.rua && ruaBruta) cid.rua = ruaBruta;
                if (cid.rua) BASE_DADOS.ruas.add(cid.rua);

                // Data de nascimento / idade (se a planilha trouxer)
                for (let key in reg) {
                  const kn = normalizarTexto(key);
                  if (kn.includes("nascimento") && reg[key] && reg[key] !== "-") {
                    cid.dt_nascimento = reg[key];
                  }
                }
                if (reg["Sexo"] && reg["Sexo"] !== "-") cid.sexo = reg["Sexo"];
                if (reg["Idade"] && reg["Idade"] !== "-") cid.idade_txt = reg["Idade"];
                else if (reg["IDADE"] && reg["IDADE"] !== "-") cid.idade_txt = reg["IDADE"];

                // Completa número da casa, telefone, CNS e CPF quando outra planilha trouxer
                for (let key in reg) {
                  const kn = normalizarTexto(key);
                  const val = (reg[key] || "").trim();
                  if (!val || val === "-") continue;
                  if ((kn === "numero" || kn === "n°" || kn === "no" || kn.startsWith("numero ")) && !cid.numero) cid.numero = val;
                  if (kn === "telefone celular" && !cid.telefone) cid.telefone = val;
                }
                if (cid.bolsaFamilia === undefined) cid.bolsaFamilia = false;

                let matchedBf = false;
                for (let key in reg) {
                  let keyLower = key.toLowerCase();
                  let valLower = reg[key].toLowerCase();
                  if (keyLower.includes("bolsa") || keyLower.includes("auxílio") || keyLower.includes("auxilio") || keyLower.includes("benefício") || keyLower.includes("beneficio")) {
                    if (valLower === "sim" || valLower === "s" || valLower === "true" || valLower === "1") {
                      matchedBf = true;
                    }
                  }
                  if (valLower.includes("bolsa família") || valLower.includes("bolsa familia") || valLower.includes("auxílio brasil")) {
                    matchedBf = true;
                  }
                }
                if (tema.toLowerCase().includes("bolsa fam") || tema.toLowerCase().includes("auxílio")) {
                  matchedBf = true;
                }

                const jaEraBf = cid.bolsaFamilia;
                if (matchedBf) {
                  cid.bolsaFamilia = true;
                }
                if (!jaEraBf && cid.bolsaFamilia) {
                  countBolsaFamiliaFile++;
                }

                if (reg["Última atualização cadastral"] && reg["Última atualização cadastral"] !== "-") {
                  cid.dt_cadastral = reg["Última atualização cadastral"];
                }
                // C1: cadastro individual (data do relatório) e, se o relatório trouxer, cadastro domiciliar. Vale até 1 ano.
                for (let key in reg) {
                  const kn = normalizarTexto(key);
                  const v = (reg[key] || "").trim();
                  if (kn.includes("atualiza") && kn.includes("cadastr") && (kn.includes("domicil") || kn.includes("famili") || kn.includes("moradia")) && /\d/.test(v)) cid.dt_cad_dom = v;
                }
                const diasDe = (s) => { const d = s ? parseDataJS(s) : null; return (d && !isNaN(d.getTime())) ? Math.floor((new Date() - d) / 86400000) : null; };
                const diasInd = diasDe(cid.dt_cadastral), diasDom = diasDe(cid.dt_cad_dom);
                const indVenceu = diasInd === null || diasInd > 365;
                const domVenceu = diasDom !== null && diasDom > 365;
                cid.c1_ind_ok = !indVenceu; cid.c1_dom_ok = (diasDom === null) ? null : !domVenceu;
                cid.c1Ok = !indVenceu && !domVenceu;
                cid.pendencias = (cid.pendencias || []).filter(p => !p.startsWith("C1:"));
                if (indVenceu) cid.pendencias.push(diasInd === null
                  ? "C1: Cadastro INDIVIDUAL sem data de atualização: refazer/atualizar o cadastro individual do cidadão (CDS ou PEC) e conferir o cadastro domiciliar da família"
                  : `C1: Cadastro INDIVIDUAL desatualizado (última atualização em ${cid.dt_cadastral}, há mais de 1 ano): atualizar o cadastro individual do cidadão e, na mesma visita, conferir o cadastro domiciliar da família`);
                if (domVenceu) cid.pendencias.push(`C1: Cadastro DOMICILIAR desatualizado (última atualização em ${cid.dt_cad_dom}, há mais de 1 ano): atualizar o cadastro do domicílio/família`);

                // =========================================================================
                // C2: CRIANÇAS DE 0 A 4 ANOS (LISTA DESENVOLVIMENTO INFANTIL)
                // =========================================================================
                let idadeStr = (reg["Idade"] || reg["IDADE"] || "").toLowerCase();
                let faixaEtariaStr = (reg["Faixa etária"] || reg["FAIXA ETÁRIA"] || "").toLowerCase();
                
                // Deteta se é criança (por idade numérica < 10 anos ou menção a infância/criança)
                let numIdade = parseInt(idadeStr) || 99;
                let isCriancaEtaria = (numIdade < 10 || faixaEtariaStr.includes("criança") || faixaEtariaStr.includes("infantil") || faixaEtariaStr.includes("0 a") || faixaEtariaStr.includes("1 ano") || faixaEtariaStr.includes("2 ano") || faixaEtariaStr.includes("3 ano") || faixaEtariaStr.includes("4 ano") || faixaEtariaStr.includes("5 ano"));
                let isCriancaRow = (tema === "Desenvolvimento infantil" || tema.toLowerCase().includes("criança") || tema.toLowerCase().includes("infantil") || tema.toLowerCase().includes("puericultura") || isCriancaEtaria);

                let vacinasPendentesList = [];
                for (let key in reg) {
                  let kLow = key.toLowerCase();
                  let vLow = reg[key].toLowerCase();
                  if (kLow.includes("vacina") || kLow.includes("penta") || kLow.includes("pólio") || kLow.includes("polio") || kLow.includes("tríplice") || kLow.includes("pneumo") || kLow.includes("rota") || kLow.includes("febre") || kLow.includes("bcg") || kLow.includes("meningo")) {
                    if (vLow === "" || vLow === "-" || vLow.includes("não") || vLow.includes("sem registro") || vLow.includes("atrasad") || vLow.includes("pendent")) {
                      vacinasPendentesList.push(`${key}: ${reg[key] || "Pendente"}`);
                    }
                  }
                }

                const temColunasC2 = ("Quantidade de visitas domiciliares até os 24 meses de idade" in reg) || ("Poliomielite" in reg);
                const jaTemC2Detalhado = (cid.c2Detalhado === true) && !temColunasC2;

                // C2 só para quem está na lista "Desenvolvimento infantil" (0 a 4 anos), a única que traz visitas e vacinas
                if (temColunasC2) {
                  cid.indicadores['C2'] = true;
                  if (temColunasC2) cid.c2Detalhado = true;
                  const visInf = parseInt(reg["Quantidade de visitas domiciliares até os 24 meses de idade"]) || 0;
                  const consInf = parseInt(reg["Quantidade de consultas até 24 meses"]) || 0;
                  const av2 = avaliarVisitasC2(parseDataJS(reg["Data de nascimento"] || reg["DATA DE NASCIMENTO"] || ""), extrairDatas(reg["Data da primeira visita domiciliar"])[0] || null, extrairDatas(reg["Data da segunda visita domiciliar"])[0] || null, visInf);
                  
                  const penta = reg["Difteria, Tétano, Pertusis, Hepatite B, Haemophilus Influenza B"] || "";
                  const polio = reg["Poliomielite"] || "";
                  const semDadosVacina = !temColunasC2;
                  const pentaPendente = !semDadosVacina && (penta === "" || penta === "-" || penta.toLowerCase().includes("não") || penta.toLowerCase().includes("sem registro") || penta.toLowerCase().includes("atrasad"));
                  const polioPendente = !semDadosVacina && (polio === "" || polio === "-" || polio.toLowerCase().includes("não") || polio.toLowerCase().includes("sem registro") || polio.toLowerCase().includes("atrasad"));
                  
                  // Se houver qualquer vacina em falta OU se for criança sem colunas detalhadas de vacina preenchidas, puxamos alerta preventivo
                  const temVacinasAtrasadas = semDadosVacina || pentaPendente || polioPendente || vacinasPendentesList.length > 0;

                  cid.c2_visitas = visInf; 
                  cid.c2_vacinasOk = !temVacinasAtrasadas;
                  cid.c2Ok = (av2.ok && cid.c2_vacinasOk);
                  cid.c2_tempo = { texto: av2.tempo, ok: av2.tempoOk };
                  cid.c2_ok1 = av2.ok1; cid.c2_ok2 = av2.ok2;
                  
                  cid.pendencias = cid.pendencias.filter(p => !p.startsWith("C2:"));
                  
                  av2.pend.forEach(p => cid.pendencias.push("C2: " + p));
                  
                  const nAntesC2 = cid.pendencias.length;
                  cid.c2_v1 = reg["Data da primeira visita domiciliar"] || ""; cid.c2_v2 = reg["Data da segunda visita domiciliar"] || "";
                  if (pentaPendente) cid.pendencias.push(`C2: Vacina Penta 💉 (${penta || "Pendente"})`);
                  if (polioPendente) cid.pendencias.push(`C2: Vacina Pólio 💉 (${polio || "Pendente"})`);
                  
                  if (vacinasPendentesList.length > 0) {
                    vacinasPendentesList.slice(0, 3).forEach(v => {
                      if (!cid.pendencias.some(p => p.includes(v))) {
                        cid.pendencias.push(`C2: Vacina em atraso 💉 (${v})`);
                      }
                    });
                  } else if (isCriancaRow && penta === "" && Object.keys(reg).some(k => k.toLowerCase().includes("vacina"))) {
                    // Alerta preventivo rigoroso para pecar por excesso
                    if (!cid.pendencias.some(p => p.includes("Verificar Caderneta"))) {
                      cid.pendencias.push(`C2: Verificar caderneta de vacinação infantil 💉 (Pecando por excesso)`);
                    }
                  }
                  cid.ex = cid.ex || {}; cid.ex.C2 = { okExtra: cid.c2_vacinasOk, pend: cid.pendencias.slice(nAntesC2) };
                }

                if (tema === "Gestação e puerpério") {
                  cid.indicadores['C3'] = true;
                  const visPn = parseInt(reg["Quantidade de visitas domiciliares no pré-natal"]) || 0;
                  const visPuerp = parseInt(reg["Quantidade de visitas domiciliares no puerpério"]) || 0;
                  const consPn = parseInt(reg["Quantidade de atendimentos no pré-natal"]) || 0;
                  const cons12sem = parseInt(reg["Quantidade de atendimentos até 12 semanas no pré-natal"]) || 0;
                  const odonto = parseInt(reg["Quantidade de atendimentos odontológicos no pré-natal"]) || 0;
                  const dVis = parseInt(reg["Dias desde a última visita domiciliar"]);
                  const mVis = parseInt(reg["Meses desde a última visita domiciliar"]);
                  const temUlt = !isNaN(dVis) || !isNaN(mVis);
                  const ultTxt = !temUlt ? '' : ((mVis || 0) > 0 ? `${mVis} mês(es)${(dVis || 0) ? ' e ' + dVis + ' dia(s)' : ''}` : `${dVis || 0} dia(s)`);
                  const ultDias = temUlt ? (mVis || 0) * 30 + (dVis || 0) : null;
                  cid.c3_tempo = { texto: temUlt ? `⏱ Última visita há ${ultTxt}` : '⏱ Sem visita domiciliar registrada', ok: (visPn >= 3 && visPuerp >= 1) || (ultDias !== null && ultDias < 30) };
                  cid.c3_vis_pn = visPn; cid.c3_vis_puerp = visPuerp; cid.c3_dpp = extrairDatas(reg["DPP (DUM)"]).length ? reg["DPP (DUM)"] : (reg["DPP (ecografia obstétrica)"] || ""); cid.c3Ok = (visPn >= 3 && visPuerp >= 1 && consPn >= 6 && odonto >= 1 && cons12sem >= 1);
                  cid.pendencias = cid.pendencias.filter(p => !p.startsWith("C3:"));
                  if (visPn < 3) cid.pendencias.push(`C3: Visitas Pré-Natal pendentes (${visPn}/3)` + (temUlt ? ` — última visita há ${ultTxt}; espaçar as visitas ao longo da gestação (motivo: "Gestante")` : ` (motivo: "Gestante")`));
                  if (visPuerp < 1) cid.pendencias.push('C3: Visita no Puerpério pendente (0/1): visitar a mãe e o bebê até o 7º dia após o parto (motivo: "Puérpera"), articular a consulta de puerpério na UBS em até 42 dias e atualizar o cadastro do recém-nascido');
                  if (cons12sem === 0) cid.pendencias.push("C3: Busca Ativa - Captação precoce (<12 semanas)");
                  if (consPn < 6) cid.pendencias.push(`C3: Busca Ativa - Consultas Pré-Natal (${consPn}/6)`);
                  if (odonto < 1) cid.pendencias.push("C3: Busca Ativa - Avaliação Odontológica pendente");
                  cid.ex = cid.ex || {}; cid.ex.C3 = { okExtra: (consPn >= 6 && odonto >= 1 && cons12sem >= 1), pend: cid.pendencias.filter(p => p.startsWith("C3: Busca Ativa")) };
                  cid.c3_ult = temUlt ? ultTxt : ""; cid.c3_ultDias = ultDias; cid.c3_tempo_rep = cid.c3_tempo;
                }
                else if (tema === "Diabetes") {
                  cid.indicadores['C4'] = true;
                  const visDia = parseInt(reg["Quantidade de visitas domiciliares"]) || 0;
                  const av4 = avaliarVisitas30(reg["Últimas visitas domiciliares"], visDia, "Pessoa com diabetes");
                  const hg = reg["Hemoglobina glicada"] || "";
                  const dtHg = reg["Data da última avaliação de hemoglobina glicada"] || "";
                  const dtPes = reg["Data da avaliação dos pés"] || "";
                  const hgOk = (hg !== "" && hg !== "-") || (dtHg !== "" && dtHg !== "-");
                  const pesOk = (dtPes !== "" && dtPes !== "-");
                  cid.c4_visitas = visDia; cid.c4_vis_txt = reg["Últimas visitas domiciliares"] || ""; cid.c4_tempo = { texto: av4.tempo, ok: av4.tempoOk }; cid.c4Ok = (av4.ok && hgOk && pesOk);
                  cid.pendencias = cid.pendencias.filter(p => !p.startsWith("C4:"));
                  if (av4.pend) cid.pendencias.push(`C4: ${av4.pend}`);
                  if (!hgOk) cid.pendencias.push("C4: Busca Ativa - Exame de Hemoglobina Glicada");
                  if (!pesOk) cid.pendencias.push("C4: Busca Ativa - Avaliação periódica dos pés");
                  cid.ex = cid.ex || {}; cid.ex.C4 = { okExtra: (hgOk && pesOk), pend: cid.pendencias.filter(p => p.startsWith("C4: Busca Ativa")) };
                }
                else if (tema === "Hipertensão") {
                  cid.indicadores['C5'] = true;
                  const visHip = parseInt(reg["Quantidade de visitas domiciliares"]) || 0;
                  const av5 = avaliarVisitas30(reg["Últimas visitas domiciliares"], visHip, "Pessoa com hipertensão");
                  const paQtd = parseInt(reg["Quantidade de medições de pressão arterial"]) || 0;
                  const consQtd = parseInt(reg["Quantidade de consultas"]) || 0;
                  cid.c5_visitas = visHip; cid.c5_vis_txt = reg["Últimas visitas domiciliares"] || ""; cid.c5_tempo = { texto: av5.tempo, ok: av5.tempoOk }; cid.c5Ok = (av5.ok && paQtd >= 1 && consQtd >= 1);
                  cid.pendencias = cid.pendencias.filter(p => !p.startsWith("C5:"));
                  if (av5.pend) cid.pendencias.push(`C5: ${av5.pend}`);
                  if (paQtd === 0) cid.pendencias.push("C5: Busca Ativa - Aferição de PA no semestre");
                  if (consQtd === 0) cid.pendencias.push("C5: Busca Ativa - Agendar Consulta semestral");
                  cid.ex = cid.ex || {}; cid.ex.C5 = { okExtra: (paQtd >= 1 && consQtd >= 1), pend: cid.pendencias.filter(p => p.startsWith("C5: Busca Ativa")) };
                }
                // ==========================================
                // C6: PESSOA IDOSA E VACINA INFLUENZA
                // ==========================================
                else if (tema === "Pessoa idosa" || tema.toLowerCase().includes("idoso")) {
                  cid.indicadores['C6'] = true;
                  const visIdo = parseInt(reg["Quantidade de visitas domiciliares"]) || 0;
                  const av6 = avaliarVisitas30(reg["Últimas visitas domiciliares"], visIdo, "Pessoa idosa");
                  
                  const inf = reg["Influenza (últimos 12 meses)"] || reg["Vacina influenza"] || reg["Influenza"] || "";
                  const infPendente = (inf === "" || inf === "-" || inf.toLowerCase().includes("não") || inf.toLowerCase().includes("sem registro") || inf.toLowerCase().includes("atrasad"));
                  
                  const mMed = parseInt(reg["Meses desde o último atendimento médico"]) || 99;
                  const mEnf = parseInt(reg["Meses desde o último atendimento de enfermagem"]) || 99;
                  const consAnual = (mMed <= 12 || mEnf <= 12);
                  
                  cid.c6_visitas = visIdo; 
                  cid.c6_tempo = { texto: av6.tempo, ok: av6.tempoOk };
                  cid.c6_vis_txt = reg["Últimas visitas domiciliares"] || "";
                  cid.c6Ok = (av6.ok && !infPendente && consAnual);
                  
                  cid.pendencias = cid.pendencias.filter(p => !p.startsWith("C6:"));
                  if (av6.pend) cid.pendencias.push(`C6: ${av6.pend}`);
                  if (infPendente) cid.pendencias.push(`C6: Vacina Influenza 💉 (${inf || "Não realizada / Sem registro"})`);
                  if (!consAnual) cid.pendencias.push("C6: Busca Ativa - Consulta anual pendente (>12 meses)");
                  cid.ex = cid.ex || {}; cid.ex.C6 = { okExtra: (!infPendente && consAnual), pend: cid.pendencias.filter(p => p.startsWith("C6: Vacina") || p.startsWith("C6: Busca Ativa")) };
                }
                else if (tema === "Saúde da mulher") {
                  // C7 (boas práticas da mulher): preventivo (25-64a), vacina HPV (9-14a),
                  // consulta de saúde sexual e reprodutiva (14-69a) e mamografia (50-69a)
                  const hoje7 = new Date();
                  const anos7 = idadeEmAnos(reg["Data de nascimento"] || "");
                  const precisaColo = (anos7 === null) || (anos7 >= 25 && anos7 <= 64);
                  const precisaHpv = (anos7 !== null) && (anos7 >= 9 && anos7 <= 14);
                  const precisaConsulta = (anos7 === null) || (anos7 >= 14 && anos7 <= 69);
                  const precisaMama = (anos7 !== null) && (anos7 >= 50 && anos7 <= 69);
                  cid.pendencias = cid.pendencias.filter(p => !p.startsWith("C7:"));
                  if (!precisaColo && !precisaHpv && !precisaConsulta && !precisaMama) {
                    delete cid.indicadores['C7']; delete cid.c7Ok; delete cid.c7_tempo;
                  } else {
                    cid.indicadores['C7'] = true;
                    const ultimaData = (pred) => {
                      let ds = [];
                      for (const k in reg) { if (pred(normalizarTexto(k))) ds = ds.concat(extrairDatas(reg[k])); }
                      return ds.sort((a, b) => a - b).pop() || null;
                    };
                    const dtColo = ultimaData(k => k.includes('colo de utero') && k.includes('data'));      // solicitado ou avaliado
                    const dtMama = ultimaData(k => k.includes('mama') && k.includes('data'));               // solicitada, realizada ou avaliada
                    const dtConsulta = ultimaData(k => k.includes('consulta de saude sexual'));
                    const dosesHpv = ((reg["HPV"] || "").match(/vacina hpv/gi) || []).length;
                    const coloOk = !!dtColo && dtColo >= somarMeses(hoje7, -36);
                    const mamaOk = !!dtMama && dtMama >= somarMeses(hoje7, -24);
                    const consultaOk = !!dtConsulta && dtConsulta >= somarMeses(hoje7, -12);
                                        const partes7 = [];
                    const p7 = [];
                    if (precisaColo) {
                      partes7.push(`Preventivo ${dtColo ? fmtData(dtColo) : 'sem registro'} ${coloOk ? '✓' : '✗'}`);
                      if (!coloOk) p7.push("C7: Busca Ativa - Preventivo (colo do útero) solicitado ou avaliado nos últimos 3 anos" + (dtColo ? ` (último registro em ${fmtData(dtColo)})` : " (sem registro)"));
                    }
                    if (precisaHpv) { partes7.push('@HPV'); p7.push('@HPV'); }
                    if (precisaConsulta) {
                      partes7.push(`Consulta ${dtConsulta ? fmtData(dtConsulta) : 'sem registro'} ${consultaOk ? '✓' : '✗'}`);
                      if (!consultaOk) p7.push("C7: Busca Ativa - Consulta de saúde sexual e reprodutiva no último ano" + (dtConsulta ? ` (última em ${fmtData(dtConsulta)})` : " (sem registro)"));
                    }
                    if (precisaMama) {
                      partes7.push(`Mamografia ${dtMama ? fmtData(dtMama) : 'sem registro'} ${mamaOk ? '✓' : '✗'}`);
                      if (!mamaOk) p7.push("C7: Busca Ativa - Mamografia solicitada ou avaliada nos últimos 2 anos" + (dtMama ? ` (último registro em ${fmtData(dtMama)})` : " (sem registro)"));
                    }
                    cid.c7_base = { outros: (!precisaColo || coloOk) && (!precisaConsulta || consultaOk) && (!precisaMama || mamaOk), partes: partes7, pend: p7, hpv: precisaHpv, doses: dosesHpv };
                    montarC7(cid);
                  }
                }
              }
            }

            if (!arquivosProcessados[matchedId]) {
              arquivosProcessados[matchedId] = { nome: file.name, count: countAtualizados, bf: countBolsaFamiliaFile };
            } else {
              arquivosProcessados[matchedId].count += countAtualizados;
              arquivosProcessados[matchedId].bf += countBolsaFamiliaFile;
            }

            resolve();
          };
          processar();
        });
      }

      const resumoVac = relatoriosVacinacao.length ? aplicarRelatoriosVacinacao(relatoriosVacinacao) : null;
      if (!resumoVac) Object.values(BASE_DADOS.cidadaos).forEach(aplicarVacinacaoCidadao);
      const resumoVacTxt = resumoVac ? `${resumoVac.pessoas} pessoa(s) com ${resumoVac.vacinas} vacina(s) em atraso` + (resumoVac.hpv ? `, ${resumoVac.hpv} com HPV atrasada` : '') + (resumoVac.foraDaBase ? `. ${resumoVac.foraDaBase} fora da sua microárea/base` : '') + '.' + (resumoVac.meninas ? ` HPV avaliado em ${resumoVac.meninasHpv} de ${resumoVac.meninas} meninas de 9 a 14 anos.` + (resumoVac.meninasHpv < resumoVac.meninas ? ' Para o resto, exporte a busca ativa com o imunobiológico HPV.' : '') : '') : '';
      let countEncontrados = Object.keys(arquivosProcessados).length;
      let html = `<div class="file-list-header">
            <span>${countEncontrados} de ${PLANILHAS_ESPERADAS.length} planilhas processadas</span>
            <span class="btn-limpar" onclick="inicializarListaPlanilhas(); document.getElementById('progressoUpload').innerHTML='';">Limpar</span>
          </div>`;
          
      PLANILHAS_ESPERADAS.forEach(p => {
        if (arquivosProcessados[p.id]) {
           const info = arquivosProcessados[p.id];
           if (info.count > 0) {
             let textoBf = info.bf > 0 ? `, ${info.bf} no Bolsa Família` : '';
             html += `
               <div class="file-item">
                 <div class="file-item-icon">✓</div>
                 <div class="file-item-content">
                   <div class="file-item-title">${p.icone} ${p.titulo}</div>
                   <span class="file-item-name">${info.nome}</span>
                   <div class="file-item-status">✓ ${info.count} pacientes identificados${textoBf}.${p.id === 'vacinacao' && resumoVacTxt ? ' ' + resumoVacTxt : ''}</div>
                 </div>
               </div>
             `;
           } else {
             html += `
               <div class="file-item">
                 <div class="file-item-icon error">!</div>
                 <div class="file-item-content">
                   <div class="file-item-title">${p.icone} ${p.titulo}</div>
                   <span class="file-item-name">${info.nome}</span>
                   <div class="file-item-status error">Ficheiro sem pacientes válidos.</div>
                 </div>
               </div>
             `;
           }
        } else {
           html += `
             <div class="file-item">
               <div class="file-item-icon pending">-</div>
               <div class="file-item-content">
                 <div class="file-item-title">${p.icone} ${p.titulo}</div>
                 <div class="file-item-status pending">${p.desc}</div>
               </div>
             </div>
           `;
        }
      });
      listaDiv.innerHTML = html;

      if (perfilDetectado.nome || perfilDetectado.micro) {
        const atual = lerPerfil();
        localStorage.setItem('gestao_acs_perfil', JSON.stringify({
          nome: perfilDetectado.nome || atual.nome || '',
          micro: perfilDetectado.micro || atual.micro || ''
        }));
        renderPerfil();
      }

      Object.values(BASE_DADOS.cidadaos).forEach(aplicarVisitasApp);
      try { const cmp = compararImportacao(fotoAntes, fotoIndicadores()); if (cmp) localStorage.setItem('guia_mudancas', JSON.stringify(cmp)); } catch (e) {}
      await salvarBaseLocal();
      await registrarHistorico();
      prog.style.color = "#10b981"; prog.innerHTML = "";
      atualizarInterface();
    }

    function atualizarInterface() {
      const lista = Object.values(BASE_DADOS.cidadaos);
      const totalBf = lista.filter(c => c.bolsaFamilia).length;
      
      window.__totalVinculados = lista.length;
      atualizarSubtitulo();
      document.getElementById('bf-tot').innerText = totalBf;

      const selectRua = document.getElementById('filtroRua');
      const ruaAtual = selectRua.value;
      selectRua.innerHTML = '<option value="">Todas as ruas</option>';
      Array.from(BASE_DADOS.ruas).sort().forEach(r => { selectRua.innerHTML += `<option value="${r}">${r}</option>`; });
      selectRua.value = ruaAtual;

      const stats = { C1: { tot: 0, ok: 0 }, C2: { tot: 0, ok: 0 }, C3: { tot: 0, ok: 0 }, C4: { tot: 0, ok: 0 }, C5: { tot: 0, ok: 0 }, C6: { tot: 0, ok: 0 }, C7: { tot: 0, ok: 0 } };

      lista.forEach(c => {
        ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'].forEach(ind => {
          if (c.indicadores && c.indicadores[ind]) {
            stats[ind].tot++;
            if (c[`${ind.toLowerCase()}Ok`]) stats[ind].ok++;
          }
        });
      });

      ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'].forEach(ind => {
        const t = stats[ind].tot;
        const o = stats[ind].ok;
        const pend = t - o;
        const pctOk = t > 0 ? Math.min(Math.round((o / t) * 100), pend > 0 ? 99 : 100) : 100;
        const idLow = ind.toLowerCase();

        document.getElementById(`${idLow}-tot`).innerText = t;
        if (t === 0) {
          document.getElementById(`${idLow}-pct`).innerText = "0%";
          document.getElementById(`${idLow}-pct`).className = "valor";
          document.getElementById(`${idLow}-bar`).style.width = "0%";
          document.getElementById(`${idLow}-pend`).className = "status-meta";
          document.getElementById(`${idLow}-pend`).innerHTML = Object.keys(BASE_DADOS.cidadaos).length ? "Nenhum no grupo" : "Aguardando...";
        } else if (pend === 0) {
          document.getElementById(`${idLow}-pct`).innerText = "100%";
          document.getElementById(`${idLow}-pct`).className = "valor ok";
          document.getElementById(`${idLow}-bar`).style.width = "100%";
          document.getElementById(`${idLow}-bar`).style.background = "#0284c7";
          document.getElementById(`${idLow}-pend`).className = "status-meta ok-100";
          document.getElementById(`${idLow}-pend`).innerHTML = "atualizados";
        } else {
          document.getElementById(`${idLow}-pct`).innerText = `${pctOk}%`;
          document.getElementById(`${idLow}-pct`).className = "valor danger";
          document.getElementById(`${idLow}-bar`).style.width = `${pctOk}%`;
          document.getElementById(`${idLow}-bar`).style.background = "#0284c7";
          document.getElementById(`${idLow}-pend`).className = "status-meta danger";
          const sufixo = pend === 1 ? 'pendente' : 'pendentes';
          document.getElementById(`${idLow}-pend`).innerHTML = `⚠️ ${pend} ${sufixo}`;
        }
      });

      filtrarLista();
      atualizarAlertas();
      renderMudancas();
      renderAlcance();
      renderHistorico();
      atualizarStatusBackup();
    }

    function filtrarLista() {
      const termoRaw = document.getElementById('campoBusca').value.trim();
      const ruaSel = document.getElementById('filtroRua').value;
      const situacaoSel = document.getElementById('filtroPendencia').value;

      const content = document.getElementById('listaUtentes');
      const contadorEl = document.getElementById('contadorResultados');
      content.innerHTML = "";

      const temTermoBusca = termoRaw.length > 0;
      const termoNorm = normalizarTexto(termoRaw);
      const palavrasBusca = termoNorm.split(/\s+/).filter(p => p.length > 0);
      const termoDigitos = termoRaw.replace(/\D/g, "");

      const filtrados = Object.entries(BASE_DADOS.cidadaos).filter(([chave, c]) => {
        if (filtroIndicadorAtual === 'BF') {
          if (!c.bolsaFamilia) return false;
        } else if (filtroIndicadorAtual !== 'todos') {
          if (filtroIndicadorAtual !== 'C1' && (!c.indicadores || !c.indicadores[filtroIndicadorAtual])) return false;
        }

        if (temTermoBusca) {
          const nomeNorm = normalizarTexto(c.nome);
          const matchNome = palavrasBusca.length > 0 && palavrasBusca.every(p => nomeNorm.includes(p));
          const cpfDigitos = (c.cpf || "").replace(/\D/g, "");
          const matchDoc = termoDigitos.length >= 2 && cpfDigitos.includes(termoDigitos);
          const matchNum = c.numero && normalizarTexto(c.numero) === termoNorm;

          if (!matchNome && !matchDoc && !matchNum) return false;
        }

        if (ruaSel && c.rua !== ruaSel) return false;

        if (!temTermoBusca && filtroIndicadorAtual !== 'BF') {
          // A pendência considerada é a do indicador selecionado (C1 = só cadastro individual)
          const pends = c.pendencias || [];
          const temPendencias = (filtroIndicadorAtual === 'todos')
            ? pends.length > 0
            : (filtroIndicadorAtual === 'C1' ? (c.c1Ok === false || pends.some(p => p.startsWith('C1:'))) : pends.some(p => p.startsWith(filtroIndicadorAtual + ':')));
          if (situacaoSel === 'pendentes' && !temPendencias) return false;
          if (situacaoSel === 'emdia' && temPendencias) return false;
        }

        return true;
      });

      filtrados.sort((x, y) => (x[1].nome || '').localeCompare(y[1].nome || '', 'pt-BR', { sensitivity: 'base' }));

      contadorEl.innerText = `Exibindo ${filtrados.length} cidadão(s)`;

      if (!filtrados.length) {
        content.innerHTML = '<p style="text-align:center; padding: 24px; color: var(--text-muted); font-size: 0.88rem;">Nenhum cidadão localizado para este filtro.</p>';
        return;
      }

      let htmlLista = '';
      filtrados.forEach(([chave, c]) => {
        // Cada indicador vira um bloco: etiqueta verde (meta atingida) ou vermelha (não atendida)
        // e, logo abaixo, o que fazer para atingir a meta.
        const rotulos = {
          C1: c.c1Ok === false ? ('C1: Cadastro Individual desatualizado' + (c.c1_dom_ok === false ? ' e domiciliar' : '')) : 'C1: Cadastro Individual',
          C2: 'C2: Criança' + (c.c2_vacinasOk ? ' · 💉 vacinas em dia' : ''),
          C3: 'C3: Gestante',
          C4: 'C4: Diabetes',
          C5: 'C5: Hipertensão',
          C6: 'C6: Idoso',
          C7: 'C7: Mulher'
        };
        const tempos = { C2: c.c2_tempo, C3: c.c3_tempo, C4: c.c4_tempo, C5: c.c5_tempo, C6: c.c6_tempo, C7: c.c7_tempo };
        let blocosOkHtml = '';
        let blocosPendHtml = '';
        let algumaPendente = false;
        ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'].forEach(ind => {
          if (!c.indicadores || !c.indicadores[ind]) return;
          if (situacaoSel === 'pendentes' && /^C[1-7]$/.test(filtroIndicadorAtual) && ind !== filtroIndicadorAtual) return;   // em "somente pendências" mostra só o indicador escolhido
          const acoes = (c.pendencias || [])
            .filter(p => p.startsWith(ind + ':'))
            .map(p => p.substring(ind.length + 1).trim());
          const atingida = (c[ind.toLowerCase() + 'Ok'] === true) && acoes.length === 0;
          if (!atingida) algumaPendente = true;
          const acoesHtml = acoes.length
            ? `<div class="acoes-meta"><div class="acoes-titulo">👉 O que fazer para atingir a meta:</div>` +
              acoes.map(a => `<div class="acao-item">${a}</div>`).join('') + `</div>`
            : '';
          const blocoHtml = `<div class="bloco-meta">
              <span class="tag ${atingida ? 'tag-ok' : 'tag-danger'}">${atingida ? '✓' : '✗'} ${rotulos[ind]}</span>${(tempos[ind] && tempos[ind].texto) ? `<span class="tag tag-tempo ${tempos[ind].ok ? 'tempo-ok' : 'tempo-atencao'}">${tempos[ind].texto}</span>` : ''}
              ${acoesHtml}
            </div>`;
          if (atingida) blocosOkHtml += blocoHtml; else blocosPendHtml += blocoHtml;
        });

        // Ordem: metas atingidas (verde), Bolsa Família e, por último, as pendências (vermelho)
        let tagsHtml = blocosOkHtml;
        tagsHtml += blocosPendHtml;
        const pendenciasHtml = '';

        const urlWa = linkWhatsApp(c.telefone);
        const linkTel = c.telefone ? (urlWa ? `<span class="telefone"> | <a href="${urlWa}" target="_blank" rel="noopener">${htmlIconeMsg()} ${c.telefone}</a></span>` : `<span class="telefone"> | 📞 ${c.telefone}</span>`) : '';
        const valAnotacao = c.anotacao || '';
        const visApp = (c.visitasApp || []).map((v, i) => `<div class="visita-app-linha">📝 Visita registrada no app: <b>${v.d}</b> · ${v.inds.map(k => (MOTIVOS_VISITA[k] || k).replace(/ \(.*$/, '')).join(', ')} <button class="btn-rm-visita" data-chave="${escHtml(chave)}" data-i="${i}" aria-label="Remover visita">✕</button></div>`).join('');
        const retsHtml = (c.retornos || []).map((r, i) => r.feito ? '' : `<div class="retorno-linha">📅 Retorno em <b>${dataBR(r.d)}</b>${r.nota ? ' · ' + escHtml(r.nota) : ''}<span class="acoes-ret"><button class="btn-ret-feito" data-chave="${escHtml(chave)}" data-i="${i}">✓ Feito</button><button class="btn-ret-rm" data-chave="${escHtml(chave)}" data-i="${i}" aria-label="Remover retorno">✕</button></span></div>`).join('');
        const vacHtml = (c.vacAtraso && c.vacAtraso.length) ? `<div class="vac-bloco"><b>💉 ${c.vacAtraso.length} vacina(s) em atraso</b><div>${c.vacAtraso.map(x => escHtml(textoDoseVacina(x))).join(' · ')}</div><small>Relatório de ${escHtml(c.vacData || '')}</small></div>` : '';
        const visitaHtml = vacHtml + (podeRegistrarVisita(c) ? `${visApp}<button class="btn-visita" data-chave="${escHtml(chave)}">📝 Registrar visita</button>` : '') + retsHtml + `<button class="btn-retorno" data-chave="${escHtml(chave)}">📅 Agendar retorno</button>`;
        const anotacaoHtml = `<textarea class="area-anotacao" placeholder="✍️ Anotações do ACS..." onchange="salvarAnotacao('${chave}', this.value)">${valAnotacao}</textarea>`;

        const temPend = algumaPendente;
        const idadeCalc = c.dt_nascimento ? calcularIdade(c.dt_nascimento) : (c.idade_txt || '');
        const idadeBadge = idadeCalc ? `<span class="idade">🎂 ${idadeCalc}</span>` : '';
        const bfBadge = c.bolsaFamilia ? `<span class="tag tag-bf">💰 Bolsa Família</span>` : '';
        // Etiquetas de perfil para quem está fora das listas de indicadores do PEC (sem meta, só para identificar)
        const anosC = c.dt_nascimento ? idadeEmAnos(c.dt_nascimento) : null;
        let perfilBadge = '';
        if (anosC !== null && anosC < 10 && !(c.indicadores && c.indicadores['C2'])) perfilBadge += '<span class="tag tag-info">👶 Criança · fora do C2</span>';
        if (anosC !== null && anosC >= 60 && !(c.indicadores && c.indicadores['C6'])) perfilBadge += '<span class="tag tag-info">🧓 Idoso · fora do C6</span>';
        const linhaInfoHtml = (idadeBadge || bfBadge || perfilBadge) ? `<div class="linha-info">${idadeBadge}${bfBadge}${perfilBadge}</div>` : '';
        htmlLista += `
          <div class="item-cidadao ${temPend ? 'tem-pend' : 'em-dia'}">
            <div class="topo">
              <div class="nome">${c.nome}</div>
            </div>
            ${linhaInfoHtml}
            <div class="endereco">📍 ${c.rua || 'Sem rua cadastrada'}, nº ${c.numero || 'S/N'}${linkTel}</div>
            ${htmlMedidas(c)}
            <div>${tagsHtml}</div>
            ${pendenciasHtml}
            ${visitaHtml}
            ${anotacaoHtml}
          </div>
        `;
      });
      content.innerHTML = htmlLista;
    }
