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
      alternarAba('dashboard');
    }
