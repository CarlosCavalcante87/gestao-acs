/* Ações do Dia: prazos, faixas, aniversários, notificações */
    // =========================================================================
    // AÇÕES DO DIA: prazos que vencem e faixas etárias que mudam nos próximos dias
    // =========================================================================
    let horizonteAlertas = 7;
    try { if (parseInt(localStorage.getItem('guia_horizonte')) === 15) horizonteAlertas = 15; } catch (e) {}

    function iniDia(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
    function escHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function isoLocal(d) { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }

    function datasUnicas12m(txt) {
      const janela = somarMeses(new Date(), -12);
      const unicas = [];
      extrairDatas(txt).filter(d => d >= janela).forEach(d => { if (!unicas.some(u => u.getTime() === d.getTime())) unicas.push(d); });
      return unicas;
    }

    function gerarAlertas(limite) {
      const hoje = iniDia(new Date());
      const out = [];
      Object.entries(BASE_DADOS.cidadaos).forEach(([chave, c]) => {
        const ind = c.indicadores || {};
        const nasc = c.dt_nascimento ? parseDataJS(c.dt_nascimento) : null;
        const temNasc = !!nasc && !isNaN(nasc.getTime());
        const add = (data, tipo, indic, texto) => {
          const dias = diasEntre(hoje, iniDia(data));
          if (dias < 0 || dias > limite) return;
          out.push({ chave, dias, data: iniDia(data), tipo, ind: indic, texto });
        };
        const pend = (pref, txt) => (c.pendencias || []).some(p => p.startsWith(pref + ':') && p.includes(txt));

        // Retornos agendados pelo ACS (atrasados até 60 dias continuam aparecendo)
        (c.retornos || []).forEach((r, ri) => {
          if (r.feito || !r.d) return;
          const dt = new Date(r.d + 'T12:00:00'); const dias = diasEntre(hoje, iniDia(dt));
          if (dias > limite || dias < -60) return;
          out.push({ chave, dias: Math.max(0, dias), data: iniDia(dt), tipo: 'retorno', ind: 'Retorno', ri, atrasado: dias < 0,
            texto: (dias < 0 ? `Retorno atrasado (era dia ${dataBR(r.d)}).` : `Retorno agendado para ${dataBR(r.d)}.`) + (r.nota ? ' ' + r.nota : '') });
        });

        // C1: cadastro vale 1 ano
        [['dt_cadastral', 'individual'], ['dt_cad_dom', 'domiciliar']].forEach(([campo, nomeC]) => {
          const d = c[campo] ? parseDataJS(c[campo]) : null;
          if (d && !isNaN(d.getTime())) add(somarMeses(d, 12), 'prazo', 'C1', `Cadastro ${nomeC} (de ${c[campo]}) completa 1 ano: atualizar para não ficar pendente`);
        });

        // C2: crianças (1ª visita até 30 dias de vida, 2ª entre o 31º dia e 6 meses, fim dos 24 meses)
        if (ind.C2 && temNasc) {
          const lim1 = somarDias(nasc, 30), ini2 = somarDias(nasc, 31), lim2 = somarMeses(nasc, 6), fim24 = somarMeses(nasc, 24);
          if (c.c2_ok1 === false && hoje <= lim1) add(lim1, 'prazo', 'C2', `1ª visita (motivo "Recém-nascido") até ${fmtData(lim1)}, quando completa 30 dias de vida`);
          if (c.c2_ok2 === false) {
            if (hoje <= lim2) add(lim2, 'prazo', 'C2', `2ª visita (motivo "Criança") até ${fmtData(lim2)}, quando completa 6 meses de vida`);
            if (hoje < ini2) add(ini2, 'janela', 'C2', `2ª visita já pode ser feita a partir de ${fmtData(ini2)} (31º dia de vida)`);
          }
          if (c.c2Ok !== true && hoje <= fim24) add(fim24, 'faixa', 'C2', `Completa 24 meses em ${fmtData(fim24)}: acaba o prazo das visitas do C2`);
        }

        // C3: gestantes (DPP, pré-natal e puerpério)
        if (ind.C3 && c.c3_dpp) {
          const dpp = extrairDatas(c.c3_dpp)[0];
          if (dpp) {
            const visPn = (c.c3_pn_ef !== undefined ? c.c3_pn_ef : c.c3_vis_pn) || 0, visPu = (c.c3_pu_ef !== undefined ? c.c3_pu_ef : c.c3_vis_puerp) || 0;
            if (visPn < 3) add(dpp, 'prazo', 'C3', `DPP em ${fmtData(dpp)}: faltam ${3 - visPn} visita(s) de pré-natal (motivo "Gestante")`);
            if (visPu < 1) {
              add(somarDias(dpp, 7), 'prazo', 'C3', `Puérpera: visita domiciliar até o 7º dia após o parto (DPP estimada em ${fmtData(dpp)}): avaliar amamentação, cicatrização e sinais de depressão pós-parto; confirmar a data real do parto`);
              add(somarDias(dpp, 42), 'prazo', 'C3', `Puérpera: consulta de puerpério na UBS até 42 dias após o parto (DPP ${fmtData(dpp)}): articular o agendamento com a enfermagem`);
            }
          }
        }

        // C4, C5 e C6: 2 visitas nos últimos 12 meses, com 30+ dias entre elas
        [['C4', 'Diabetes'], ['C5', 'Hipertensão'], ['C6', 'Idoso']].forEach(([k, nomeInd]) => {
          if (!ind[k]) return;
          const unicas = datasUnicas12m(textoVisitas(c, k));
          if (!unicas.length) return;
          const ult = unicas[unicas.length - 1];
          const pen = unicas.length >= 2 ? unicas[0] : null;
          if (pen && diasEntre(pen, ult) >= 30) {
            add(somarMeses(pen, 12), 'prazo', k, `${nomeInd}: a visita de ${fmtData(pen)} sai da janela de 12 meses; fazer nova visita (30+ dias depois de ${fmtData(ult)})`);
          } else {
            add(somarMeses(ult, 12), 'prazo', k, `${nomeInd}: a visita de ${fmtData(ult)} perde a validade (12 meses); falta outra com 30+ dias de intervalo`);
            add(somarDias(ult, 30), 'janela', k, `${nomeInd}: a 2ª visita passa a valer a partir de ${fmtData(somarDias(ult, 30))} (30 dias depois de ${fmtData(ult)})`);
          }
        });

        // Mudanças de faixa etária
        if (temNasc) {
          const aniv = (anos) => somarMeses(nasc, anos * 12);
          add(aniv(60), 'faixa', 'C6', `Completa 60 anos em ${fmtData(aniv(60))}: passa a ser acompanhado(a) como pessoa idosa (C6)`);
          if (pend('C7', 'HPV')) add(aniv(15), 'faixa', 'C7', `Completa 15 anos em ${fmtData(aniv(15))}: última chance da vacina HPV (9 a 14 anos)`);
          if (pend('C7', 'Preventivo')) add(aniv(65), 'faixa', 'C7', `Completa 65 anos em ${fmtData(aniv(65))}: sai da faixa do preventivo (25 a 64 anos)`);
          if (pend('C7', 'Mamografia')) add(aniv(70), 'faixa', 'C7', `Completa 70 anos em ${fmtData(aniv(70))}: sai da faixa da mamografia (50 a 69 anos)`);
          if (ind.C7) {
            add(aniv(25), 'faixa', 'C7', `Completa 25 anos em ${fmtData(aniv(25))}: entra na faixa do preventivo (25 a 64 anos)`);
            add(aniv(50), 'faixa', 'C7', `Completa 50 anos em ${fmtData(aniv(50))}: entra na faixa da mamografia (50 a 69 anos)`);
          }
        }
      });
      return out;
    }

    // Aniversariantes: lista à parte, não mistura com os prazos
    function gerarAniversarios(limite) {
      const hoje = iniDia(new Date());
      const out = [];
      Object.entries(BASE_DADOS.cidadaos).forEach(([chave, c]) => {
        const nasc = c.dt_nascimento ? parseDataJS(c.dt_nascimento) : null;
        if (!nasc || isNaN(nasc.getTime())) return;
        let prox = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate());
        if (prox < hoje) prox = new Date(hoje.getFullYear() + 1, nasc.getMonth(), nasc.getDate());
        const dias = diasEntre(hoje, prox);
        if (dias > limite) return;
        const anos = prox.getFullYear() - nasc.getFullYear();
        out.push({ chave, c, dias, data: prox, anos, dd: String(prox.getDate()).padStart(2, '0') + '/' + String(prox.getMonth() + 1).padStart(2, '0') });
      });
      out.sort((a, b) => a.dias - b.dias || (a.c.nome || '').localeCompare(b.c.nome || '', 'pt-BR', { sensitivity: 'base' }));
      return out;
    }

    function agruparAlertas(lista) {
      const mapa = new Map();
      lista.forEach(a => { if (!mapa.has(a.chave)) mapa.set(a.chave, []); mapa.get(a.chave).push(a); });
      const cidadaos = [...mapa.entries()].map(([chave, itens]) => {
        itens.sort((x, y) => x.dias - y.dias);
        return { chave, c: BASE_DADOS.cidadaos[chave], itens, min: itens[0].dias };
      });
      cidadaos.sort((a, b) => a.min - b.min || (a.c.nome || '').localeCompare(b.c.nome || '', 'pt-BR', { sensitivity: 'base' }));
      return cidadaos;
    }

    const TIPO_ALERTA = { prazo: '⏳', faixa: '📅', janela: '🔓', aniv: '🎉', retorno: '🔁' };
    function textoQuando(dias) { return dias === 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : `em ${dias} dias`; }

    function definirHorizonteAlertas(n) {
      horizonteAlertas = n;
      try { localStorage.setItem('guia_horizonte', String(n)); } catch (e) {}
      atualizarAlertas();
    }

    let modoAlertas = 'urgencia';
    try { if (localStorage.getItem('guia_modo_alertas') === 'rua') modoAlertas = 'rua'; } catch (e) {}
    function definirModoAlertas(m) { modoAlertas = m; try { localStorage.setItem('guia_modo_alertas', m); } catch (e) {} atualizarAlertas(); }

    function cardAlerta({ chave, c, itens }) {
      const idade = c.dt_nascimento ? calcularIdade(c.dt_nascimento) : (c.idade_txt || '');
      const urlWa = linkWhatsApp(c.telefone);
      const tel = c.telefone ? (urlWa ? ` | <a href="${urlWa}" target="_blank" rel="noopener" style="color:var(--primary);font-weight:600;text-decoration:none;">${htmlIconeMsg()} ${escHtml(c.telefone)}</a>` : ` | 📞 ${escHtml(c.telefone)}`) : '';
      return `<div class="item-cidadao ${itens[0].dias <= 7 ? 'tem-pend' : 'em-dia'}">
        <div class="topo"><div class="nome">${escHtml(c.nome)}</div></div>
        ${idade ? `<div class="linha-info"><span class="idade">🎂 ${escHtml(idade)}</span></div>` : ''}
        <div class="endereco">📍 ${escHtml(c.rua || 'Sem rua cadastrada')}, nº ${escHtml(c.numero || 'S/N')}${tel}</div>
        ${itens.map(a => `<div class="al-linha al-${a.tipo}"><span class="al-quando">${TIPO_ALERTA[a.tipo]} ${a.atrasado ? 'Atrasado' : textoQuando(a.dias)}</span><span class="al-texto"><b>${a.ind}</b> · ${escHtml(a.texto)}</span></div>`).join('')}
        ${itens.filter(a => a.tipo === 'retorno').map(a => `<button class="btn-ret-feito grande" data-chave="${escHtml(chave)}" data-i="${a.ri}">✓ Retorno feito (${a.data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})</button>`).join('')}
        ${podeRegistrarVisita(c) ? `<button class="btn-visita" data-chave="${escHtml(chave)}">📝 Registrar visita</button>` : ''}
        <button class="btn btn-abrir" data-chave="${escHtml(chave)}">Abrir cartão do cidadão</button>
      </div>`;
    }

    function atualizarAlertas() {
      document.getElementById('chipModoUrg').className = 'chip' + (modoAlertas === 'urgencia' ? ' active' : '');
      document.getElementById('chipModoRua').className = 'chip' + (modoAlertas === 'rua' ? ' active' : '');
      const tem = Object.keys(BASE_DADOS.cidadaos).length > 0;
      document.getElementById('chipAl7').className = 'chip' + (horizonteAlertas === 7 ? ' active' : '');
      document.getElementById('chipAl15').className = 'chip' + (horizonteAlertas === 15 ? ' active' : '');

      const grupos7 = tem ? agruparAlertas(gerarAlertas(7)) : [];
      const badge = document.getElementById('badgeAlertas');
      badge.textContent = grupos7.length;
      badge.style.display = grupos7.length ? 'inline-block' : 'none';

      const alvo = document.getElementById('listaAlertas');
      if (!tem) { alvo.innerHTML = '<p style="text-align:center; padding: 24px; color: var(--text-muted); font-size: 0.88rem;">Importe as planilhas na aba Configurações para ver as ações do dia.</p>'; return; }
      const grupos = agruparAlertas(gerarAlertas(horizonteAlertas));
      if (!grupos.length) { alvo.innerHTML = `<p style="text-align:center; padding: 24px; color: var(--text-muted); font-size: 0.88rem;">🎉 Nenhuma ação urgente nos próximos ${horizonteAlertas} dias.</p>`; }
      else {
        const secoes = [
          { titulo: '🔴 Hoje', filtro: g => g.min === 0 },
          { titulo: '🟠 Próximos 7 dias', filtro: g => g.min >= 1 && g.min <= 7 },
          { titulo: '🟡 De 8 a 15 dias', filtro: g => g.min >= 8 }
        ];
        let html = '';
        if (modoAlertas === 'rua') {
          const porRua = new Map();
          grupos.forEach(g => { const r = g.c.rua || 'Sem rua cadastrada'; if (!porRua.has(r)) porRua.set(r, []); porRua.get(r).push(g); });
          [...porRua.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })).forEach(rua => {
            const lista = porRua.get(rua).sort((a, b) => {
              const na = parseInt(a.c.numero), nb = parseInt(b.c.numero);
              return ((isNaN(na) ? 1e9 : na) - (isNaN(nb) ? 1e9 : nb)) || (a.c.nome || '').localeCompare(b.c.nome || '', 'pt-BR', { sensitivity: 'base' });
            });
            const casas = new Set(lista.map(g => (g.c.numero || 'S/N'))).size;
            html += `<div class="al-grupo">📍 ${escHtml(rua)} · ${lista.length} cidadão(s) em ${casas} casa(s)</div>`;
            lista.forEach(g => { html += cardAlerta(g); });
          });
          alvo.innerHTML = html;
        } else {
        secoes.forEach(s => {
          const g = grupos.filter(s.filtro);
          if (!g.length) return;
          html += `<div class="al-grupo">${s.titulo} · ${g.length} cidadão(s)</div>`;
          g.forEach(gr => { html += cardAlerta(gr); });
        });
        alvo.innerHTML = html;
        }
      }
      const faltaDados = Object.values(BASE_DADOS.cidadaos).some(c => c.indicadores && ((!c.ex && ['C2','C3','C4','C5','C6'].some(k => c.indicadores[k])) || (c.indicadores.C4 && c.c4_vis_txt === undefined) || (c.indicadores.C5 && c.c5_vis_txt === undefined) || (c.indicadores.C6 && c.c6_vis_txt === undefined) || (c.indicadores.C2 && c.c2_ok1 === undefined)));
      if (faltaDados) alvo.innerHTML = '<div class="card" style="border-left:5px solid #f59e0b;"><b>⚠️ Reimporte as planilhas</b><p class="al-ajuda">Os dados guardados no app são de uma versão anterior e não têm as datas das visitas. Vá na aba <b>Configurações</b>, importe os relatórios de novo e os lembretes de visita voltam a aparecer aqui.</p></div>' + alvo.innerHTML;
      const anivs = gerarAniversarios(horizonteAlertas);
      if (anivs.length) {
        let ha = `<div class="al-grupo">🎉 Aniversariantes · ${anivs.length}</div>`;
        anivs.forEach(a => {
          const c = a.c, w = linkWhatsApp(c.telefone);
          const msg = 'Parabéns, ' + (c.nome || '').split(' ')[0] + '! 🎉 Desejo muita saúde e felicidades neste dia. Um abraço do seu agente de saúde, ' + ((lerPerfil().nome || '').split(' ')[0] || 'TACS') + '.';
          ha += `<div class="item-cidadao em-dia">
            <div class="topo"><div class="nome">${escHtml(c.nome)}</div></div>
            <div class="al-linha al-aniv"><span class="al-quando">🎉 ${a.dias === 0 ? 'Hoje' : (a.dias === 1 ? 'Amanhã' : a.dd)}</span><span class="al-texto">${a.dias === 0 ? 'Aniversariante do dia: faz' : 'Faz'} ${a.anos} ${a.anos === 1 ? 'ano' : 'anos'}${a.dias === 0 ? '. Mande os parabéns!' : ` em ${a.dd} (em ${a.dias} dias)`}</span></div>
            ${a.dias === 0 && w ? `<a class="btn-parabens" href="${w}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">🎉 Enviar parabéns no WhatsApp</a>` : ''}
          </div>`;
        });
        alvo.innerHTML += ha;
      }
      if (lembretesAtivos()) { salvarSnapshotAlertas().catch(() => {}); avisoResumo(false).catch(() => {}); }
    }

    document.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('.btn-abrir');
      if (!b) return;
      const c = BASE_DADOS.cidadaos[b.getAttribute('data-chave')];
      if (!c) return;
      window.__abrindoCartao = true; alternarAba('dashboard'); window.__abrindoCartao = false;
      abrirIndicador('C1');
      document.getElementById('campoBusca').value = c.nome;
      filtrarLista();
      window.scrollTo(0, 0);
    });

    // ---------- Lembretes no celular ----------
    function lembretesSuportados() { return ('Notification' in window) && ('serviceWorker' in navigator) && window.isSecureContext; }
    function lembretesAtivos() {
      try { return lembretesSuportados() && localStorage.getItem('guia_lembretes') === '1' && Notification.permission === 'granted'; } catch (e) { return false; }
    }

    function atualizarStatusLembretes() {
      const btn = document.getElementById('btnLembretes');
      const st = document.getElementById('statusLembretes');
      if (!btn) return;
      btn.style.display = '';
      if (!lembretesSuportados()) {
        btn.style.display = 'none';
        st.textContent = 'Os lembretes no celular só funcionam quando o app é aberto por um endereço seguro (https) ou instalado na tela inicial. Neste endereço eles não estão disponíveis, mas esta lista continua funcionando.';
      } else if (Notification.permission === 'denied') {
        btn.style.display = 'none';
        st.textContent = 'As notificações deste app estão bloqueadas. Libere nas configurações do navegador (permissões do site) para receber lembretes.';
      } else if (lembretesAtivos()) {
        btn.textContent = '🔕 Desativar lembretes';
        st.textContent = '✅ Lembretes ativados: um resumo aparece uma vez por dia quando você abre o app. Em celulares Android com o app instalado, o Chrome também pode avisar sozinho, em horário que ele decide.';
      } else {
        btn.textContent = '🔔 Ativar lembretes no celular';
        st.textContent = '';
      }
    }

    async function ativarLembretes() {
      if (!lembretesSuportados()) { atualizarStatusLembretes(); return; }
      const reg = await navigator.serviceWorker.ready;
      if (lembretesAtivos()) {
        localStorage.removeItem('guia_lembretes');
        try { if (reg.periodicSync) await reg.periodicSync.unregister('alertas-diarios'); } catch (e) {}
        atualizarStatusLembretes();
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { atualizarStatusLembretes(); return; }
      localStorage.setItem('guia_lembretes', '1');
      try { if (reg.periodicSync) await reg.periodicSync.register('alertas-diarios', { minInterval: 12 * 60 * 60 * 1000 }); } catch (e) {}
      await salvarSnapshotAlertas();
      await avisoResumo(true);
      atualizarStatusLembretes();
    }

    async function salvarSnapshotAlertas() {
      if (!('caches' in window)) return;
      const arr = gerarAlertas(30).map(a => ({ d: isoLocal(a.data), n: BASE_DADOS.cidadaos[a.chave].nome, i: a.ind, x: a.texto, a: 0 }))
        .concat(gerarAniversarios(30).map(a => ({ d: isoLocal(a.data), n: a.c.nome, i: '🎉', x: 'aniversário', a: 1 })));
      const cache = await caches.open('guia-alertas');
      await cache.put('./alertas.json', new Response(JSON.stringify(arr), { headers: { 'Content-Type': 'application/json' } }));
    }

    async function avisoResumo(forcar) {
      if (!lembretesAtivos()) return;
      const hojeIso = isoLocal(new Date());
      if (!forcar && localStorage.getItem('guia_ultimo_aviso') === hojeIso) return;
      const grupos = agruparAlertas(gerarAlertas(7));
      let titulo, corpo;
      if (grupos.length) {
        titulo = `🔔 ${grupos.length} cidadão(s) com ação nos próximos 7 dias`;
        corpo = grupos.slice(0, 3).map(g => `${(g.c.nome || '').split(' ')[0]}: ${g.itens[0].texto}`.slice(0, 90)).join('\n');
      } else if (forcar) {
        titulo = '🔔 Lembretes ativados';
        corpo = 'Nenhuma ação urgente nos próximos 7 dias.';
      } else if (!gerarAniversarios(0).length) return;
      const diasBkp = diasDesdeBackup();
      if (Object.keys(BASE_DADOS.cidadaos).length && (diasBkp === null || diasBkp >= 7)) corpo = ((corpo ? corpo + '\n' : '') + '💾 Faça o backup dos dados (aba Configurações).').trim();
      const hojeAn = gerarAniversarios(0);
      if (hojeAn.length) {
        titulo = (titulo ? titulo + ' · ' : '') + `🎉 ${hojeAn.length} aniversariante(s) hoje`;
        corpo = (hojeAn.map(a => `🎉 ${a.c.nome} faz ${a.anos} anos hoje`).join('\n') + (corpo ? '\n' + corpo : '')).trim();
      }
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(titulo, { body: corpo, tag: 'resumo-diario', icon: './icone-192.png', badge: './icone-192.png', data: { url: './index.html#alertas' } });
      localStorage.setItem('guia_ultimo_aviso', hojeIso);
    }

    window.addEventListener('DOMContentLoaded', () => {
      atualizarStatusLembretes();
      atualizarAlertas();
      if (location.hash === '#alertas') alternarAba('alertas');
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.abrir === 'alertas') alternarAba('alertas'); });
      }
    });

    function alternarAba(aba) {
      ['dashboard', 'alertas', 'upload'].forEach(a => { document.getElementById('view-' + a).style.display = a === aba ? 'block' : 'none'; });
      document.getElementById('btnTabDash').className = aba === 'dashboard' ? 'active' : '';
      document.getElementById('btnTabAl').className = aba === 'alertas' ? 'active' : '';
      document.getElementById('btnTabUp').className = aba === 'upload' ? 'active' : '';
      if (aba === 'dashboard' && document.getElementById('painel-lista').style.display !== 'none' && !window.__abrindoCartao) mostrarCards();
      if (aba === 'alertas') atualizarAlertas();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const NOMES_IND = { C1: '📋 C1 · Cadastro', C2: '👶 C2 · Criança', C3: '🤰 C3 · Pré-natal', C4: '🩸 C4 · Diabetes', C5: '❤️ C5 · Hipertensão', C6: '👴 C6 · Idosos', C7: '👩 C7 · Mulheres', BF: '💰 Bolsa Família', todos: 'Todos' };
    function abrirIndicador(ind) {
      selecionarFiltroIndicador(ind);
      document.getElementById('painel-cards').style.display = 'none';
      document.getElementById('painel-lista').style.display = 'block';
      try { if (!(history.state && history.state.lista)) history.pushState({ lista: 1 }, ''); } catch (e) {}
      window.scrollTo(0, 0);
    }
    function mostrarCards() {
      document.getElementById('painel-lista').style.display = 'none';
      document.getElementById('painel-cards').style.display = 'block';
      window.scrollTo(0, 0);
    }
    function voltarAosCards() {
      try { if (history.state && history.state.lista) { history.back(); return; } } catch (e) {}
      mostrarCards();
    }
    window.addEventListener('popstate', () => mostrarCards());

    // Verifica se o indicador possui pelo menos 1 cidadão com pendência
    function indicadorTemPendencias(ind) {
      if (!/^C[1-7]$/.test(ind)) return false;
      const lista = Object.values((typeof BASE_DADOS !== 'undefined' && BASE_DADOS.cidadaos) ? BASE_DADOS.cidadaos : {});
      return lista.some(c => {
        if (!c.indicadores || !c.indicadores[ind]) return false;
        const pends = c.pendencias || [];
        return c[ind.toLowerCase() + 'Ok'] === false || pends.some(p => p.startsWith(ind + ':'));
      });
    }

    function selecionarFiltroIndicador(ind) {
      filtroIndicadorAtual = ind;
      document.querySelectorAll('.chips-indicadores .chip').forEach(c => c.classList.remove('active'));
      document.querySelectorAll('.card-meta').forEach(c => c.classList.remove('active'));

      const chip = document.getElementById(`chip-${ind}`);
      if (chip) {
        chip.classList.add('active');
        const ca = document.getElementById('chipAtivo');
        if (ca) { ca.textContent = chip.textContent; ca.style.setProperty('--accent', getComputedStyle(chip).getPropertyValue('--accent')); }
        const trilho = chip.parentElement; if (trilho) trilho.scrollLeft = 0;
      }

      const cardId = ind === 'BF' ? 'card-bf' : `card-${ind.toLowerCase()}`;
      const card = document.getElementById(cardId);
      if (card) card.classList.add('active');

      const selectPend = document.getElementById('filtroPendencia');
      // Se o card clicado tiver pendências, abre direto em "Apenas Pendências"; se estiver 100% em dia (sem falhas) ou for BF, abre em "Todos"
      if (indicadorTemPendencias(ind)) {
        selectPend.value = 'pendentes';
      } else {
        selectPend.value = 'todos';
      }
      filtrarLista();
    }

    window.salvarAnotacao = function(chave, texto) {
      if (BASE_DADOS.cidadaos[chave]) {
        BASE_DADOS.cidadaos[chave].anotacao = texto;
        salvarBaseLocal();
      }
    };