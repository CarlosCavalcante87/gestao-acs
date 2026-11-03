/* Estado da base, perfil, utilidades de data e telas */
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
