/* Perfil, importação de planilhas e inicialização */
    // ---------- PERFIL DO ACS (nome e microárea) ----------
    function lerPerfil() {
      try { return JSON.parse(localStorage.getItem('gestao_acs_perfil')) || {}; } catch (e) { return {}; }
    }

    function atualizarSubtitulo() {
      const total = window.__totalVinculados;
      if (typeof total !== 'number') return;
      const p = lerPerfil();
      document.getElementById('subtitulo').textContent = (p.micro ? `Microárea ${p.micro} · ` : '') + `${total} cidadãos`;
    }

    function renderPerfil() {
      const p = lerPerfil();
      const nome = (p.nome || '').trim();
      const partes = nome.split(/\s+/).filter(Boolean);
      const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      document.getElementById('saudacao').textContent = partes.length ? 'Olá, ' + cap(partes[0]) : 'Guia de Visitas TACS';
      const av = document.getElementById('perfilLinha');
      av.textContent = partes.length ? (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase() : '＋';
      av.title = nome ? nome + (p.micro ? ' · Micro ' + p.micro : '') : 'Informar nome e microárea';
      atualizarSubtitulo();
    }

    function abrirModalPerfil() {
      const p = lerPerfil();
      document.getElementById('perfilNome').value = p.nome || '';
      document.getElementById('perfilMicro').value = p.micro || '';
      document.getElementById('modalPerfil').classList.add('aberto');
    }

    function fecharModalPerfil() {
      document.getElementById('modalPerfil').classList.remove('aberto');
    }

    function salvarPerfil() {
      const perfil = {
        nome: document.getElementById('perfilNome').value.trim(),
        micro: document.getElementById('perfilMicro').value.trim()
      };
      localStorage.setItem('gestao_acs_perfil', JSON.stringify(perfil));
      renderPerfil();
      fecharModalPerfil();
    }

    function limparBase() {
      document.getElementById('modalLimpar').classList.add('aberto');
    }

    function fecharModalLimpar() {
      document.getElementById('modalLimpar').classList.remove('aberto');
    }

    function confirmarLimparBase() {
      fecharModalLimpar();
      try { localStorage.removeItem('gestao_acs_dados'); localStorage.removeItem('guia_mudancas'); } catch (e) {}
      historicoCache = [];
      filaSalvar = filaSalvar.then(() => BaseIDB.del('base')).then(() => BaseIDB.del('historico')).catch(() => {});
      BASE_DADOS = { cidadaos: {}, ruas: new Set() };
      atualizarInterface();
      alternarAba('alertas');
    }


    // ---------- STATUS DOS DADOS NO CABEÇALHO (última importação + resumo do banco) ----------
    function lerImportacao() { try { return JSON.parse(localStorage.getItem('guia_ultima_importacao')) || null; } catch (e) { return null; } }
    function fmtDM(ts) { const d = new Date(ts); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); }
    function fmtHM(ts) { const d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
    function fmtHa(ts) {
      const min = Math.max(0, Math.round((Date.now() - ts) / 60000));
      if (min < 1) return 'agora mesmo'; if (min < 60) return `há ${min} min`;
      const h = Math.round(min / 60); if (h < 24) return `há ${h} h`;
      const d = Math.round(h / 24); return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
    }
    function atualizarStatusCab() {
      const l1 = document.getElementById('csL1'); if (!l1) return;
      const total = Object.keys(BASE_DADOS.cidadaos).length, imp = lerImportacao(), g = window.__gravacao;
      const ponto = document.getElementById('csPonto');
      if (!total) { l1.textContent = 'Sem dados'; document.getElementById('csL2').textContent = 'importe as planilhas'; ponto.className = 'cs-ponto'; }
      else {
        const erro = g && g.erro;
        l1.textContent = erro ? 'Não salvo' : 'Salvo';
        document.getElementById('csL2').textContent = imp ? 'Importado ' + fmtDM(imp.ts) + ' · ' + fmtHM(imp.ts) : 'importação sem data';
        ponto.className = 'cs-ponto ' + (erro ? 'erro' : 'ok');
      }
      if (!document.getElementById('popStatus').hidden) renderPopStatus();
    }
    function renderPopStatus() {
      const pop = document.getElementById('popStatus');
      const total = Object.keys(BASE_DADOS.cidadaos).length, imp = lerImportacao(), g = window.__gravacao;
      let st = {}; try { st = fotoIndicadores().st || {}; } catch (e) {}
      const chips = IND_LISTA.filter(k => st[k] && st[k].tot).map(k => `<span class="ps-chip" style="--cor: var(--${k.toLowerCase()})"><b>${k}</b> ${st[k].tot}</span>`).join('');
      const linha = (r, v) => `<div class="ps-lin"><span>${r}</span><b>${v}</b></div>`;
      pop.innerHTML = `
        ${linha('Última importação', imp ? `${fmtDM(imp.ts)}/${new Date(imp.ts).getFullYear()} às ${fmtHM(imp.ts)} <small>(${fmtHa(imp.ts)})</small>` : 'sem registro')}
        ${linha('Gravado neste aparelho', g ? (g.erro ? 'falhou ⚠️' : `às ${fmtHM(g.ts)}`) : (total ? 'dados carregados' : '—'))}
        ${linha('Cidadãos · Ruas', `${total} · ${BASE_DADOS.ruas ? BASE_DADOS.ruas.size : 0}`)}
        ${chips ? `<div class="ps-chips">${chips}</div>` : ''}
        <div class="ps-acoes">
          <button type="button" onclick="fecharPopStatus(); alternarAba('upload')">Importar</button>
          <button type="button" class="prim" onclick="salvarBaseLocal().then(() => avisoToast && avisoToast('Dados salvos.'))">Salvar agora</button>
        </div>`;
    }
    function alternarPopStatus(ev) {
      if (ev) ev.stopPropagation();
      const pop = document.getElementById('popStatus');
      if (!pop.hidden) { fecharPopStatus(); return; }
      renderPopStatus(); pop.hidden = false; document.getElementById('cabStatus').setAttribute('aria-expanded', 'true');
    }
    function fecharPopStatus() { document.getElementById('popStatus').hidden = true; document.getElementById('cabStatus').setAttribute('aria-expanded', 'false'); }
    document.addEventListener('click', (e) => { const pop = document.getElementById('popStatus'); if (pop && !pop.hidden && !pop.contains(e.target)) fecharPopStatus(); });
    window.addEventListener('DOMContentLoaded', atualizarStatusCab);
