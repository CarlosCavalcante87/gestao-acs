/* Tamanho da letra e tema claro/escuro */
    function definirFonte(v) {
      try { localStorage.setItem('guia_fonte', v); } catch (e) {}
      document.documentElement.classList.remove('fonte1', 'fonte2'); if (v !== '0') document.documentElement.classList.add('fonte' + v);
      atualizarAcessib();
    }
    function temaEscuroAtivo() { return document.documentElement.classList.contains('escuro'); }
    function definirTema(v) {
      try { localStorage.setItem('guia_tema', v); } catch (e) {}
      document.documentElement.classList.toggle('escuro', v === 'escuro');
      atualizarAcessib();
    }
    function atualizarAcessib() {
      let f = '0', t = 'claro'; try { f = localStorage.getItem('guia_fonte') || '0'; t = localStorage.getItem('guia_tema') === 'escuro' ? 'escuro' : 'claro'; } catch (e) {}
      document.querySelectorAll('#opFonte button').forEach(b => b.classList.toggle('ativo', b.dataset.v === f));
      document.querySelectorAll('#opTema button').forEach(b => b.classList.toggle('ativo', b.dataset.v === t));
    }
    function atualizarCardSenha() {
      const card = document.getElementById('cardSenha'); if (!card) return;
      const def = senhaDefinida();
      const st = document.getElementById('statusSenha');
      if (!cryptoOk()) { st.textContent = 'A senha só funciona em endereço seguro (https). Neste endereço ela não está disponível.'; ['btnSenhaDef', 'btnSenhaAlt', 'btnSenhaRem'].forEach(i => document.getElementById(i).style.display = 'none'); return; }
      st.textContent = def ? '✅ Senha definida: o app pede a senha ao abrir e usa a mesma senha para proteger os backups.' : 'Nenhuma senha definida. O app abre sem pedir senha.';
      document.getElementById('btnSenhaDef').style.display = def ? 'none' : '';
      document.getElementById('btnSenhaAlt').style.display = def ? '' : 'none';
      document.getElementById('btnSenhaRem').style.display = def ? '' : 'none';
    }
    function abrirModalSenha(modo) {
      modoSenha = modo;
      document.getElementById('saTitulo').textContent = modo === 'definir' ? '🔒 Definir senha' : modo === 'alterar' ? '✏️ Alterar senha' : '🔓 Remover senha';
      document.getElementById('saAtualBox').style.display = modo === 'definir' ? 'none' : '';
      document.getElementById('saNovaBox').style.display = modo === 'remover' ? 'none' : '';
      document.getElementById('saNota').textContent = modo === 'remover' ? 'Sem senha, o app abre direto e os próximos backups poderão ser gerados sem proteção.' : (modo === 'alterar' ? 'Backups feitos antes continuam exigindo a senha antiga.' : 'Anote a senha em local seguro. Se for esquecida, não há como recuperar os backups protegidos por ela.');
      ['saAtual', 'saNova', 'saNova2'].forEach(i => document.getElementById(i).value = '');
      document.getElementById('saAviso').textContent = '';
      document.getElementById('modalSenhaApp').classList.add('aberto');
    }
    function fecharModalSenha() { document.getElementById('modalSenhaApp').classList.remove('aberto'); }
    async function confirmarSenhaApp() {
      const av = document.getElementById('saAviso');
      const atual = document.getElementById('saAtual').value, n1 = document.getElementById('saNova').value, n2 = document.getElementById('saNova2').value;
      try {
        if (modoSenha !== 'definir') { if (!(await conferirSenhaApp(atual))) { av.textContent = 'A senha atual está incorreta.'; return; } }
        if (modoSenha === 'remover') { localStorage.removeItem(SENHA_KEY); senhaSessao = null; }
        else {
          if (n1.length < 6) { av.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
          if (n1 !== n2) { av.textContent = 'As duas senhas não são iguais.'; return; }
          await gravarSenhaApp(n1);
        }
      } catch (e) { av.textContent = 'Não foi possível salvar: ' + e.message; return; }
      fecharModalSenha(); atualizarCardSenha(); atualizarStatusBackup();
      avisoToast(modoSenha === 'remover' ? 'Senha removida.' : '✅ Senha salva.');
    }
