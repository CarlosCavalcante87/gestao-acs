/* Backup (com senha) e restauração */
    // =========================================================================
    // BACKUP (opcionalmente protegido por senha: PBKDF2 + AES-GCM) E RESTAURAÇÃO
    // =========================================================================
    const FORMATO_CIFRADO = 'guia-tacs-backup-cifrado';
    function paraB64(buf) { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
    function deB64(t) { const s = atob(t); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
    async function derivarChave(senha, salt, iter) {
      const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    }
    async function cifrarTexto(texto, senha) {
      const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), iter = 250000;
      const chave = await derivarChave(senha, salt, iter);
      const cif = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, new TextEncoder().encode(texto));
      return { formato: FORMATO_CIFRADO, versao: 1, kdf: 'PBKDF2-SHA256', iter, salt: paraB64(salt), iv: paraB64(iv), dados: paraB64(cif) };
    }
    async function decifrarTexto(obj, senha) {
      const chave = await derivarChave(senha, deB64(obj.salt), obj.iter || 250000);
      const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(obj.iv) }, chave, deB64(obj.dados));
      return new TextDecoder().decode(claro);
    }
    function baixarArquivo(texto, nome) {
      const blob = new Blob([texto], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = nome;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }
    function infoUltimoBackup() { try { return JSON.parse(localStorage.getItem('guia_ultimo_backup')); } catch (e) { return null; } }
    function diasDesdeBackup() {
      const u = infoUltimoBackup(); if (!u || !u.d) return null;
      const d = new Date(u.d + 'T12:00:00'); return Math.floor((new Date() - d) / 86400000);
    }
    function atualizarStatusBackup() {
      const el = document.getElementById('statusBackup');
      if (el) { const u = infoUltimoBackup(); el.textContent = u ? `Último backup: ${u.d.split('-').reverse().join('/')}${u.cifrado ? ' (protegido com senha)' : ' (sem senha)'}` : 'Nenhum backup feito neste aparelho ainda.'; }
      const av = document.getElementById('avisoBackup'); if (!av) return;
      const tem = Object.keys(BASE_DADOS.cidadaos).length > 0;
      const dias = diasDesdeBackup();
      let adiado = false; try { adiado = localStorage.getItem('guia_backup_adiado') === isoLocal(new Date()); } catch (e) {}
      if (!tem || adiado || (dias !== null && dias < 7)) { av.style.display = 'none'; return; }
      document.getElementById('avisoBackupTexto').textContent = dias === null ? 'Você ainda não fez nenhum backup. Se o celular for trocado ou o navegador limpo, os dados e as anotações se perdem.' : `Faz ${dias} dias desde o último backup. Faça um novo para não perder anotações e visitas registradas.`;
      av.style.display = '';
    }
    function adiarAvisoBackup() { try { localStorage.setItem('guia_backup_adiado', isoLocal(new Date())); } catch (e) {} atualizarStatusBackup(); }
