/* Senha única: bloqueio do app e proteção do backup */
    // =========================================================================
    // SENHA ÚNICA: bloqueia o app e protege o backup
    // =========================================================================
    const SENHA_KEY = 'guia_senha';
    let senhaSessao = null, tentativasSenha = 0, bloqueadoAte = 0;
    function senhaDefinida() { try { return !!localStorage.getItem(SENHA_KEY); } catch (e) { return false; } }
    function cryptoOk() { return !!(window.crypto && crypto.subtle && window.isSecureContext); }
    async function hashSenha(senha, salt, iter) {
      const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits']);
      return paraB64(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, km, 256));
    }
    // Senha pedida uma vez por dia: guarda o dia (data local) em que o app foi destravado
    function diaLocalHoje() { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
    function marcarDestravadoHoje() { try { localStorage.setItem('guia_destravado', diaLocalHoje()); } catch (e) {} }
    function destravadoHoje() { try { return localStorage.getItem('guia_destravado') === diaLocalHoje(); } catch (e) { return false; } }
    async function gravarSenhaApp(senha) {
      const salt = crypto.getRandomValues(new Uint8Array(16)), iter = 250000;
      localStorage.setItem(SENHA_KEY, JSON.stringify({ salt: paraB64(salt), iter, hash: await hashSenha(senha, salt, iter) }));
      senhaSessao = senha; marcarDestravadoHoje();
    }
    async function conferirSenhaApp(senha) {
      const o = JSON.parse(localStorage.getItem(SENHA_KEY)); if (!o) return false;
      return (await hashSenha(senha, deB64(o.salt), o.iter)) === o.hash;
    }
    function travarApp() {
      if (!senhaDefinida() || !cryptoOk()) return;
      senhaSessao = null; document.documentElement.classList.add('travado');
      setTimeout(() => { const c = document.getElementById('bloqSenha'); if (c) c.focus(); }, 60);
    }
    async function destravarApp() {
      const campo = document.getElementById('bloqSenha'), av = document.getElementById('bloqAviso');
      if (Date.now() < bloqueadoAte) { av.textContent = `Aguarde ${Math.ceil((bloqueadoAte - Date.now()) / 1000)} s para tentar de novo.`; return; }
      let ok = false; try { ok = await conferirSenhaApp(campo.value); } catch (e) {}
      if (ok) { senhaSessao = campo.value; campo.value = ''; av.textContent = ''; tentativasSenha = 0; document.documentElement.classList.remove('travado'); marcarDestravadoHoje(); atualizarStatusBackup(); return; }
      tentativasSenha++; campo.value = '';
      if (tentativasSenha >= 5) { bloqueadoAte = Date.now() + 30000; tentativasSenha = 0; av.textContent = 'Muitas tentativas. Aguarde 30 segundos.'; }
      else av.textContent = `Senha incorreta (${tentativasSenha}/5).`;
    }
    function esqueciSenha() {
      if (!confirm('Para criar uma nova senha é preciso APAGAR todos os dados deste aparelho (cidadãos, anotações, visitas e retornos). Depois você pode importar as planilhas de novo ou restaurar um backup, que continua exigindo a senha antiga. Apagar agora?')) return;
      try { localStorage.removeItem(SENHA_KEY); localStorage.removeItem('guia_destravado'); localStorage.removeItem('guia_mudancas'); } catch (e) {}
      senhaSessao = null; historicoCache = [];
      BASE_DADOS = { cidadaos: {}, ruas: new Set() };
      filaSalvar = filaSalvar.then(() => BaseIDB.del('base')).then(() => BaseIDB.del('historico')).catch(() => {});
      document.documentElement.classList.remove('travado');
      atualizarInterface(); atualizarCardSenha(); alternarAba('alertas');
    }
    // Bloqueio diário: a senha é pedida na primeira abertura de cada dia (também vale se o app ficou aberto até virar o dia)
    let ultimaAtividade = Date.now();
    function conferirInatividade() { if (senhaDefinida() && !document.documentElement.classList.contains('travado') && !destravadoHoje()) travarApp(); }
    ['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel'].forEach(ev => document.addEventListener(ev, () => { if (!document.documentElement.classList.contains('travado')) ultimaAtividade = Date.now(); }, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) conferirInatividade(); });
    setInterval(conferirInatividade, 30000);

    let modoSenha = 'definir';
