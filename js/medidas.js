/* Medidas (peso, altura, pressão, HbA1c) e IMC */
    // =========================================================================
    // MEDIDAS (peso, altura, pressão, hemoglobina glicada): vale a medição mais recente entre os relatórios
    // =========================================================================
    function numBR(v) { const t = String(v == null ? '' : v).trim().replace(',', '.'); const n = parseFloat(t); return (t === '' || t === '-' || isNaN(n)) ? null : n; }
    function absorverMedidas(cid, reg) {
      cid.med = cid.med || {};
      const m = cid.med;
      const dataMs = (s) => { const d = (s && s !== '-') ? parseDataJS(s) : null; return d && !isNaN(d.getTime()) ? d.getTime() : 0; };
      const peso = numBR(reg['Última medição de peso']), alt = numBR(reg['Última medição de altura']);
      const dPA_ = reg['Data da última medição de peso e altura'];
      if ((peso || alt) && dataMs(dPA_) >= (m.dtPesoMs || 0)) {
        if (peso) m.peso = peso; if (alt) m.altura = alt;
        m.dtPeso = dPA_ && dPA_ !== '-' ? dPA_ : ''; m.dtPesoMs = dataMs(dPA_);
      }
      const pa = (reg['Última medição de pressão arterial'] || '').trim();
      const dPr = reg['Data da última medição de pressão arterial'];
      if (/\d/.test(pa) && dataMs(dPr) >= (m.dtPaMs || 0)) { m.pa = pa; m.dtPa = dPr && dPr !== '-' ? dPr : ''; m.dtPaMs = dataMs(dPr); }
      const hg = numBR(reg['Hemoglobina glicada']);
      const dHg = reg['Data da última avaliação de hemoglobina glicada'];
      if (hg !== null && dataMs(dHg) >= (m.dtHgMs || 0)) { m.hg = hg; m.dtHg = dHg && dHg !== '-' ? dHg : ''; m.dtHgMs = dataMs(dHg); }
    }
    function fmtNum(n, casas) { return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas }); }
    // Classificação do IMC: adultos (OMS) e idosos (SISVAN/Lipschitz, 60 anos ou mais)
    function classificarIMC(imc, anos) {
      if (anos !== null && anos >= 60) {
        if (imc < 22) return ['Baixo peso', 'imc-atencao'];
        if (imc <= 27) return ['Peso adequado', 'imc-ok'];
        return ['Sobrepeso', 'imc-atencao'];
      }
      if (imc < 18.5) return ['Baixo peso', 'imc-atencao'];
      if (imc < 25) return ['Peso adequado', 'imc-ok'];
      if (imc < 30) return ['Sobrepeso', 'imc-atencao'];
      if (imc < 35) return ['Obesidade grau I', 'imc-alerta'];
      if (imc < 40) return ['Obesidade grau II', 'imc-alerta'];
      return ['Obesidade grau III', 'imc-alerta'];
    }
    function htmlMedidas(c) {
      const m = c.med; if (!m) return '';
      const linhas = [];
      if (m.peso || m.altura) {
        const p = [];
        if (m.peso) p.push(`⚖️ ${fmtNum(m.peso, 1)} kg`);
        if (m.altura) p.push(`📏 ${fmtNum(m.altura, 0)} cm`);
        let l = `<div class="med-linha">${p.join(' · ')}${m.dtPeso ? ` <i>(${m.dtPeso})</i>` : ''}</div>`;
        const anos = c.dt_nascimento ? idadeEmAnos(c.dt_nascimento) : null;
        if (m.peso && m.altura && m.altura > 50 && anos !== null && anos >= 19) {
          const imc = m.peso / Math.pow(m.altura / 100, 2);
          const [txt, cls] = classificarIMC(imc, anos);
          l += `<div class="med-linha">IMC ${fmtNum(imc, 1)} <span class="imc ${cls}">${txt}</span></div>`;
        }
        linhas.push(l);
      }
      if (m.pa) linhas.push(`<div class="med-linha">🩺 PA ${escHtml(m.pa)}${m.dtPa ? ` <i>(${m.dtPa})</i>` : ''}</div>`);
      if (m.hg !== undefined) linhas.push(`<div class="med-linha">🩸 HbA1c ${fmtNum(m.hg, 1)}%${m.dtHg ? ` <i>(${m.dtHg})</i>` : ''}</div>`);
      return linhas.length ? `<div class="medidas">${linhas.join('')}</div>` : '';
    }
