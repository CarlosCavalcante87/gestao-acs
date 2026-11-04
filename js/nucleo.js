/* Estado da base, perfil, utilidades de data e telas */
    // Versão do sistema: ao publicar uma nova, altere aqui E em CACHE_NAME no sw.js (mesmo número)
    const APP_VERSAO = 'v85.9'; // manter igual ao CACHE_NAME do sw.js (v85.9 = gestao-acs-v85-9)
    const APP_DEV = 'Carlos Cavalcante';
    function mostrarVersaoApp() {
      document.querySelectorAll('.app-versao').forEach(el => {
        el.innerHTML = el.classList.contains('app-versao-grande')
          ? `<div><span>Versão</span><b>${APP_VERSAO}</b></div><div><span>Desenvolvedor</span><b>${APP_DEV}</b></div>`
          : `Guia TACS · <b>${APP_VERSAO}</b> · Desenvolvedor: ${APP_DEV}`;
      });
    }
    mostrarVersaoApp();
    let eventoInstalacao = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      eventoInstalacao = e;
      const btn = document.getElementById('btnInstalarApp');
      if (btn) btn.style.display = 'block';
    });

    async function acionarInstalacaoPWA() {
      if (!eventoInstalacao) return;
      eventoInstalacao.prompt();
      const { outcome } = await eventoInstalacao.userChoice;
      if (outcome === 'accepted') {
        document.getElementById('btnInstalarApp').style.display = 'none';
      }
      eventoInstalacao = null;
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(err => console.log("SW:", err));
    }

    let BASE_DADOS = { cidadaos: {}, ruas: new Set() };
