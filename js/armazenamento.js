/* IndexedDB e gravação da base */
    // =========================================================================
    // ARMAZENAMENTO: a base fica no IndexedDB (maior e mais seguro que o localStorage)
    // =========================================================================
    const BaseIDB = {
      _db: null,
      abrir() {
        return new Promise((res, rej) => {
          if (!('indexedDB' in window)) return rej(new Error('IndexedDB indisponível'));
          const r = indexedDB.open('guia-tacs', 1);
          r.onupgradeneeded = () => { r.result.createObjectStore('kv'); };
          r.onsuccess = () => { this._db = r.result; res(r.result); };
          r.onerror = () => rej(r.error);
          r.onblocked = () => rej(new Error('IndexedDB bloqueado'));
        });
      },
      async _tx(modo, fn) {
        const db = this._db || await this.abrir();
        return new Promise((res, rej) => {
          const t = db.transaction('kv', modo); const st = t.objectStore('kv'); const rq = fn(st);
          t.oncomplete = () => res(rq ? rq.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
        });
      },
      get(k) { return this._tx('readonly', st => st.get(k)); },
      set(k, v) { return this._tx('readwrite', st => st.put(v, k)); },
      del(k) { return this._tx('readwrite', st => st.delete(k)); }
    };
    let filaSalvar = Promise.resolve();
    function salvarBaseLocal() {
      const foto = { cidadaos: BASE_DADOS.cidadaos, ruas: Array.from(BASE_DADOS.ruas).sort() };
      filaSalvar = filaSalvar.then(() => BaseIDB.set('base', JSON.parse(JSON.stringify(foto)))).catch((e) => {
        console.error('IndexedDB falhou, usando localStorage', e);
        try { localStorage.setItem('gestao_acs_dados', JSON.stringify(foto)); } catch (e2) { avisoToast && avisoToast('⚠️ Não foi possível salvar os dados neste aparelho.'); }
      });
      return filaSalvar;
    }
    async function carregarBaseSalva() {
      let base = null;
      try { base = await BaseIDB.get('base'); } catch (e) { console.error(e); }
      if (!base) {   // migração: dados antigos que estavam no localStorage
        let antigo = null; try { antigo = localStorage.getItem('gestao_acs_dados'); } catch (e) {}
        if (antigo) {
          try {
            base = JSON.parse(antigo);
            await BaseIDB.set('base', base);
            const conferido = await BaseIDB.get('base');
            if (conferido && Object.keys(conferido.cidadaos || {}).length === Object.keys(base.cidadaos || {}).length) localStorage.removeItem('gestao_acs_dados');
          } catch (e) { console.error('migração', e); }
        }
      }
      return base;
    }
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    let filtroIndicadorAtual = 'C1';
    let cpfToChave = {};
    let nomeToChave = {};

    const PLANILHAS_ESPERADAS = [
      { id: 'cadastros', icone: '📋', titulo: 'Cadastros', desc: 'Falta · PEC: Acompanhamentos → Cidadãos vinculados' },
      { id: 'lista_geral', icone: '📊', titulo: 'Lista Geral (atendimentos)', desc: 'Falta · PEC: Condições de saúde → Lista temática' },
      { id: 'diabeticos', icone: '🩸', titulo: 'Diabéticos', desc: 'Falta · PEC: Condições de saúde → Diabetes' },
      { id: 'hipertensos', icone: '❤️', titulo: 'Hipertensos', desc: 'Falta · PEC: Condições de saúde → Hipertensão' },
      { id: 'gestantes', icone: '🤰', titulo: 'Gestantes e puérperas', desc: 'Falta · PEC: Condições de saúde → Gestação e Puerpério' },
      { id: 'idosos', icone: '👴', titulo: 'Pessoas idosas', desc: 'Falta · PEC: Condições de saúde → Pessoa idosa' },
      { id: 'mulher', icone: '👩', titulo: 'Saúde da mulher', desc: 'Falta · PEC: Condições de saúde → Saúde da mulher' },
      { id: 'criancas', icone: '👶', titulo: 'Crianças (puericultura)', desc: 'Falta · PEC: Condições de saúde → Desenvolvimento infantil' },
      { id: 'territorio', icone: '🗺️', titulo: 'Território / famílias', desc: 'Falta · PEC: Território → Cadastro domiciliar' }
    ];

    function normalizarTexto(txt) {
      if (!txt) return "";
      return txt.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    }

    window.addEventListener('DOMContentLoaded', () => {
      renderPerfil();
      inicializarListaPlanilhas();
      atualizarStatusBackup();
      atualizarCardSenha(); atualizarAcessib();
      if (document.documentElement.classList.contains('travado')) setTimeout(() => { const c = document.getElementById('bloqSenha'); if (c) c.focus(); }, 80);
      
      carregarBaseSalva().then((parseado) => {
        if (!parseado) return;
        try {
          BASE_DADOS.cidadaos = parseado.cidadaos || {};
          BASE_DADOS.ruas = new Set(parseado.ruas || []);
          Object.values(BASE_DADOS.cidadaos).forEach(c => {
            if (!c.indicadores) c.indicadores = {};
            c.indicadores['C1'] = true;
            if (c.c1Ok === undefined) c.c1Ok = true;
            if (c.bolsaFamilia === undefined) c.bolsaFamilia = false;
          });
          atualizarInterface();
        } catch (e) { console.error(e); }
      }).then(() => carregarHistorico());
    });
