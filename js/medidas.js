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
    // Classificação do IMC: adultos de 19 a 59 anos (OMS) e idosos de 60 anos ou mais (SISVAN/Lipschitz)
    function classificarIMC(imc, anos) {
      if (anos !== null && anos >= 60) {
        if (imc <= 22) return ['Baixo peso', 'imc-atencao'];
        if (imc <= 27) return ['Peso adequado', 'imc-ok'];
        if (imc < 30) return ['Sobrepeso', 'imc-atencao'];
        return ['Obesidade', 'imc-alerta'];
      }
      if (imc < 18.5) return ['Magreza', 'imc-atencao'];
      if (imc < 25) return ['Normal', 'imc-ok'];
      if (imc < 30) return ['Sobrepeso', 'imc-atencao'];
      if (imc < 35) return ['Obesidade grau I', 'imc-alerta'];
      if (imc < 40) return ['Obesidade grau II', 'imc-alerta'];
      return ['Obesidade grau III', 'imc-alerta'];
    }
    // Chip do IMC, sempre no mesmo formato: "IMC 29,4 (Sobrepeso)", com cor pelo resultado.
    // Menores de 19 anos: o valor aparece, mas a classificação depende da curva IMC/idade (OMS), então o chip é neutro.
    function htmlChipIMC(m, anos) {
      if (!m || !m.peso || !m.altura || m.altura <= 50) {
        const falta = !m || (!m.peso && !m.altura) ? 'sem peso e altura' : !m.peso ? 'sem peso' : !m.altura ? 'sem altura' : 'altura inválida';
        return `<span class="imc imc-sem">IMC não calculado (${falta})</span>`;
      }
      const imc = m.peso / Math.pow(m.altura / 100, 2);
      if (anos === null) return `<span class="imc imc-neutro">IMC ${imc.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (sem data de nascimento)</span>`;
      if (anos < 19) return `<span class="imc imc-neutro">IMC ${imc.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (avaliar na curva IMC/idade)</span>`;
      const [txt, cls] = classificarIMC(imc, anos);
      return `<span class="imc ${cls}">IMC ${imc.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${txt})</span>`;
    }
    function htmlMedidas(c) {
      const m = c.med || null;
      const anos = c.dt_nascimento ? idadeEmAnos(c.dt_nascimento) : null;
      const linhas = [];
      if (m && (m.peso || m.altura)) {
        const p = [];
        if (m.peso) p.push(`⚖️ ${fmtNum(m.peso, 1)} kg`);
        if (m.altura) p.push(`📏 ${fmtNum(m.altura, 0)} cm`);
        linhas.push(`<div class="med-linha">${p.join(' · ')}${m.dtPeso ? ` <i>(${m.dtPeso})</i>` : ''}</div>`);
      }
      linhas.push(`<div class="med-linha med-imc">${htmlChipIMC(m, anos)}</div>`);
      if (m && m.pa) linhas.push(`<div class="med-linha">🩺 PA ${escHtml(m.pa)}${m.dtPa ? ` <i>(${m.dtPa})</i>` : ''}</div>`);
      if (m && m.hg !== undefined) linhas.push(`<div class="med-linha">🩸 HbA1c ${fmtNum(m.hg, 1)}%${m.dtHg ? ` <i>(${m.dtHg})</i>` : ''}</div>`);
      return `<div class="medidas">${linhas.join('')}</div>`;
    }
