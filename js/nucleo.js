/* Estado da base, perfil, utilidades de data e telas */
    // Versão do sistema: vem de js/versao.js (mude com: node scripts/versao.js 85.13)
    const APP_VERSAO = self.__VERSAO__ || '';   // vem de js/versao.js (única fonte da versão)
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
