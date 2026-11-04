/* Agenda de retorno por cidadão */
    // =========================================================================
    // RETORNOS AGENDADOS
    // =========================================================================
    let chaveRetorno = null;
    function dataBR(iso) { return iso.split('-').reverse().join('/'); }
    function abrirModalRetorno(chave) {
      const c = BASE_DADOS.cidadaos[chave]; if (!c) return;
      chaveRetorno = chave; document.getElementById('retNome').textContent = c.nome;
      const campo = document.getElementById('retData'); campo.min = isoLocal(new Date()); campo.value = isoLocal(somarDias(new Date(), 7));
      document.getElementById('retNota').value = '';
      document.getElementById('modalRetorno').classList.add('aberto');
    }
    function fecharModalRetorno() { document.getElementById('modalRetorno').classList.remove('aberto'); chaveRetorno = null; }
    function salvarRetorno() {
      const c = BASE_DADOS.cidadaos[chaveRetorno]; if (!c) return fecharModalRetorno();
      const d = document.getElementById('retData').value;
      if (!d) { avisoToast('Informe a data do retorno.'); return; }
      if (d < isoLocal(new Date())) { avisoToast('A data do retorno não pode ser no passado.'); return; }
      c.retornos = c.retornos || [];
      c.retornos.push({ d, nota: document.getElementById('retNota').value.trim(), feito: false });
      salvarBaseLocal(); fecharModalRetorno(); atualizarInterface(); avisoToast('✅ Retorno agendado.');
    }
    function marcarRetornoFeito(chave, i) { const c = BASE_DADOS.cidadaos[chave]; if (!c || !c.retornos || !c.retornos[i]) return; c.retornos[i].feito = true; salvarBaseLocal(); atualizarInterface(); avisoToast('Retorno marcado como feito.'); }
    function removerRetorno(chave, i) { const c = BASE_DADOS.cidadaos[chave]; if (!c || !c.retornos || !c.retornos[i]) return; if (!confirm(`Remover o retorno de ${dataBR(c.retornos[i].d)}?`)) return; c.retornos.splice(i, 1); salvarBaseLocal(); atualizarInterface(); }
    document.addEventListener('click', (e) => {
      const t = e.target.closest && e.target.closest('.btn-retorno'); if (t) { abrirModalRetorno(t.getAttribute('data-chave')); return; }
      const f = e.target.closest && e.target.closest('.btn-ret-feito'); if (f) { marcarRetornoFeito(f.getAttribute('data-chave'), +f.getAttribute('data-i')); return; }
      const r = e.target.closest && e.target.closest('.btn-ret-rm'); if (r) removerRetorno(r.getAttribute('data-chave'), +r.getAttribute('data-i'));
    });

    function exportarBaseJSON() {
      if (Object.keys(BASE_DADOS.cidadaos).length === 0) return alert('Nenhum dado para fazer backup.');
      abrirModalBackup();
    }
    function abrirModalBackup() {
      const ok = cryptoOk(), temApp = senhaDefinida() && !!senhaSessao;
      const cb = document.getElementById('bkpUsarSenha');
      cb.checked = ok; cb.disabled = !ok;
      document.getElementById('bkpRotulo').textContent = temApp ? 'Proteger o arquivo com a senha do app' : (senhaDefinida() ? 'Proteger o arquivo com senha (use a mesma senha do app)' : 'Proteger o arquivo com senha');
      document.getElementById('bkpSenha').value = ''; document.getElementById('bkpSenha2').value = '';
      document.getElementById('bkpLigarApp').checked = true;
      document.getElementById('bkpAviso').textContent = ok ? '' : 'A proteção por senha só funciona em endereço seguro (https). O backup será gerado sem senha.';
      document.getElementById('bkpCampos').style.display = (ok && !temApp) ? '' : 'none';
      document.getElementById('modalBackup').classList.add('aberto');
    }
    function fecharModalBackup() { document.getElementById('modalBackup').classList.remove('aberto'); }
    function alternarCamposSenha() { document.getElementById('bkpCampos').style.display = (document.getElementById('bkpUsarSenha').checked && !(senhaDefinida() && senhaSessao)) ? '' : 'none'; }
    async function confirmarBackup() {
      const usar = document.getElementById('bkpUsarSenha').checked;
      const temApp = senhaDefinida() && !!senhaSessao;
      const s1 = document.getElementById('bkpSenha').value, s2 = document.getElementById('bkpSenha2').value;
      const av = document.getElementById('bkpAviso');
      if (usar && !temApp) {
        if (s1.length < 6) { av.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
        if (s1 !== s2) { av.textContent = 'As duas senhas não são iguais.'; return; }
      }
      const senha = temApp ? senhaSessao : s1;
      const payload = { cidadaos: BASE_DADOS.cidadaos, ruas: Array.from(BASE_DADOS.ruas).sort(), perfil: lerPerfil(), historico: historicoCache };
      const texto = JSON.stringify(payload);
      const hoje = isoLocal(new Date());
      try {
        if (usar) { av.textContent = 'Protegendo o arquivo...'; baixarArquivo(JSON.stringify(await cifrarTexto(texto, senha)), `backup_guia_tacs_${hoje}_protegido.json`); }
        else baixarArquivo(JSON.stringify(payload, null, 2), `backup_guia_tacs_${hoje}.json`);
        localStorage.setItem('guia_ultimo_backup', JSON.stringify({ d: hoje, cifrado: usar }));
        if (usar && !temApp && !senhaDefinida() && document.getElementById('bkpLigarApp').checked) { await gravarSenhaApp(s1); atualizarCardSenha(); }
        fecharModalBackup(); atualizarStatusBackup(); avisoToast('✅ Backup gerado.');
      } catch (e) { av.textContent = 'Não foi possível gerar o backup: ' + e.message; }
    }

    let backupCifradoPendente = null;
    function importarBaseJSON(arquivo) {
      if (!arquivo) return;
      if (Object.keys(BASE_DADOS.cidadaos).length > 0 && !confirm('Restaurar o backup vai substituir os dados atuais do app. Deseja continuar?')) { document.getElementById('inputArquivoJSON').value = ''; return; }
      const prog = document.getElementById('progressoUpload');
      prog.style.color = '#0284c7';
      prog.innerHTML = 'Restaurando backup...';
      const leitor = new FileReader();
      leitor.readAsText(arquivo, 'utf-8');
      leitor.onload = () => {
        try {
          const dados = JSON.parse(leitor.result);
          if (dados && dados.formato === FORMATO_CIFRADO) {
            backupCifradoPendente = dados;
            (async () => {
              if (senhaSessao && cryptoOk()) { try { aplicarBackup(JSON.parse(await decifrarTexto(dados, senhaSessao)), prog); backupCifradoPendente = null; return; } catch (e) {} }
              document.getElementById('restSenha').value = ''; document.getElementById('restAviso').textContent = '';
              document.getElementById('modalRestaurar').classList.add('aberto'); prog.innerHTML = '';
            })();
            return;
          }
          aplicarBackup(dados, prog);
        } catch (e) {
          prog.style.color = '#ef4444';
          prog.innerHTML = '❌ Arquivo de backup inválido: ' + e.message;
        }
      };
    }
    function fecharModalRestaurar() { document.getElementById('modalRestaurar').classList.remove('aberto'); backupCifradoPendente = null; }
    async function confirmarRestaurarCifrado() {
      const av = document.getElementById('restAviso'); const prog = document.getElementById('progressoUpload');
      if (!backupCifradoPendente) return fecharModalRestaurar();
      if (!(window.crypto && crypto.subtle)) { av.textContent = 'Abra o app por endereço seguro (https) para restaurar um backup com senha.'; return; }
      av.textContent = 'Verificando a senha...';
      let dados;
      try { dados = JSON.parse(await decifrarTexto(backupCifradoPendente, document.getElementById('restSenha').value)); }
      catch (e) { av.textContent = 'Senha incorreta ou arquivo danificado.'; return; }
      fecharModalRestaurar();
      try { aplicarBackup(dados, prog); } catch (e) { prog.style.color = '#ef4444'; prog.innerHTML = '❌ Arquivo de backup inválido: ' + e.message; }
    }
    function aplicarBackup(dados, prog) {
      if (!(dados && dados.cidadaos && Object.keys(dados.cidadaos).length > 0)) throw new Error('não há cidadãos no arquivo');
      BASE_DADOS.cidadaos = dados.cidadaos;
      BASE_DADOS.ruas = new Set(dados.ruas || []);
      if (Array.isArray(dados.historico)) { historicoCache = dados.historico; BaseIDB.set('historico', JSON.parse(JSON.stringify(historicoCache))).catch(() => {}); }
      if (dados.perfil && (dados.perfil.nome || dados.perfil.micro)) { localStorage.setItem('gestao_acs_perfil', JSON.stringify(dados.perfil)); renderPerfil(); }
      Object.values(BASE_DADOS.cidadaos).forEach(c => {
        if (!c.indicadores) c.indicadores = {};
        c.indicadores['C1'] = true;
        if (c.c1Ok === undefined) c.c1Ok = true;
        if (c.bolsaFamilia === undefined) c.bolsaFamilia = false;
      });
      salvarBaseLocal();
      prog.style.color = '#10b981';
      prog.innerHTML = `✅ ${Object.keys(BASE_DADOS.cidadaos).length} cidadãos restaurados com sucesso!`;
      atualizarInterface();
      setTimeout(() => alternarAba('dashboard'), 800);
    }

    function parseDataJS(dStr) {
      if (!dStr || dStr === '-') return null;
      const p = dStr.split('/');
      if (p.length === 3) return new Date(p[2], p[1] - 1, p[0]);
      const pIso = dStr.split('-');
      if (pIso.length === 3) {
        if (pIso[0].length === 4) return new Date(pIso[0], pIso[1] - 1, pIso[2]);
        return new Date(pIso[2], pIso[1] - 1, pIso[0]);
      }
      return null;
    }

    function extrairDatas(txt) {
      const out = [];
      const re = /(\d{2})\/(\d{2})\/(\d{4})|(\d{4})-(\d{2})-(\d{2})/g;
      let m;
      while ((m = re.exec(txt || '')) !== null) {
        out.push(m[1] ? new Date(+m[3], +m[2] - 1, +m[1]) : new Date(+m[4], +m[5] - 1, +m[6]));
      }
      return out.sort((a, b) => a - b);
    }
    function fmtData(d) {
      const p = n => String(n).padStart(2, '0');
      return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
    }
    function diasEntre(a, b) { return Math.round((b - a) / 86400000); }
    function somarDias(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
    function somarMeses(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }

    // C4, C5 e C6: 2 visitas nos últimos 12 meses, com no mínimo 30 dias entre elas
    function avaliarVisitas30(textoDatas, qtd, motivo) {
      const hoje = new Date();
      const todas = extrairDatas(textoDatas);
      const r = { ok: false, pend: null, tempo: '', tempoOk: false };
      if (!todas.length) {
        r.ok = qtd >= 2;
        r.tempo = qtd === 0 ? '⏱ Sem visita registrada' : '';
        if (!r.ok) r.pend = `Visitar agora (2 visitas, 30+ dias entre elas) · motivo: "${motivo}"`;
        return r;
      }
      const janela = somarMeses(hoje, -12);
      const unicas = [];
      todas.filter(d => d >= janela).forEach(d => { if (!unicas.some(u => u.getTime() === d.getTime())) unicas.push(d); });
      if (unicas.length === 0) {
        r.tempo = '⏱ Sem visita nos últimos 12 meses';
        r.pend = `Visitar agora (2 visitas, 30+ dias entre elas) · motivo: "${motivo}"`;
        return r;
      }
      const ult = unicas[unicas.length - 1];
      const minima = somarDias(ult, 30);
      const quando = minima <= hoje ? 'Visitar agora' : `Visitar a partir de ${fmtData(minima)}`;
      if (unicas.length >= 2) {
        const pen = unicas[0];   // vale qualquer par de visitas com 30+ dias: compara a mais antiga da janela com a mais recente
        const n = diasEntre(pen, ult);
        r.tempo = `⏱ ${fmtData(pen)} e ${fmtData(ult)} · ${n} dias entre visitas`;
        if (n >= 30) { r.ok = true; r.tempoOk = true; return r; }
        r.pend = `${quando} · motivo: "${motivo}"`;
        return r;
      }
      r.tempo = `⏱ Última visita: ${fmtData(ult)}`;
      r.pend = `${quando} · motivo: "${motivo}"`;
      return r;
    }
