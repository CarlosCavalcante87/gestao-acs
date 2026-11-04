/* Visitas registradas no app */
    // =========================================================================
    // VISITAS REGISTRADAS NO APP (somam-se às datas do relatório, sem duplicar)
    // =========================================================================
    const MOTIVOS_VISITA = { C2: 'Criança (C2)', C3PN: 'Gestante, pré-natal (C3)', C3PU: 'Puérpera (C3)', C4: 'Pessoa com diabetes (C4)', C5: 'Pessoa com hipertensão (C5)', C6: 'Pessoa idosa (C6)' };
    function datasVisitaApp(c, chaveMotivo) { return (c.visitasApp || []).filter(v => v.inds.includes(chaveMotivo)).map(v => v.d); }
    function textoVisitas(c, k) { return (c[k.toLowerCase() + '_vis_txt'] || '') + ' ' + datasVisitaApp(c, k).join(' '); }
    function podeRegistrarVisita(c) { return !!(c.ex && c.indicadores && ['C2', 'C3', 'C4', 'C5', 'C6'].some(k => c.indicadores[k] && c.ex[k])); }

    function aplicarVisitasApp(c) {
      if (!c || !c.ex) return;
      const ind = c.indicadores || {};
      c.pendencias = c.pendencias || [];
      [['C4', 'Pessoa com diabetes'], ['C5', 'Pessoa com hipertensão'], ['C6', 'Pessoa idosa']].forEach(([k, motivo]) => {
        if (!ind[k] || !c.ex[k]) return;
        const lk = k.toLowerCase();
        const rep = extrairDatas(c[lk + '_vis_txt']).map(fmtData);
        const novas = datasVisitaApp(c, k).filter(d => !rep.includes(d));
        const av = avaliarVisitas30(textoVisitas(c, k), (c[lk + '_visitas'] || 0) + novas.length, motivo);
        c[lk + '_tempo'] = { texto: av.tempo, ok: av.tempoOk };
        c[lk + 'Ok'] = av.ok && c.ex[k].okExtra;
        c.pendencias = c.pendencias.filter(p => !p.startsWith(k + ':'));
        if (av.pend) c.pendencias.push(`${k}: ${av.pend}`);
        c.ex[k].pend.forEach(p => c.pendencias.push(p));
      });

      if (ind.C2 && c.ex.C2) {
        const nasc = c.dt_nascimento ? parseDataJS(c.dt_nascimento) : null;
        const rep = extrairDatas((c.c2_v1 || '') + ' ' + (c.c2_v2 || ''));
        const app = extrairDatas(datasVisitaApp(c, 'C2').join(' '));
        const todas = [];
        rep.concat(app).sort((a, b) => a - b).forEach(d => { if (!todas.some(u => u.getTime() === d.getTime())) todas.push(d); });
        const novas = app.filter(d => !rep.some(r => r.getTime() === d.getTime())).length;
        const v1 = todas[0] || null;
        let v2 = null;
        if (todas.length > 1) v2 = (nasc && !isNaN(nasc.getTime())) ? (todas.slice(1).find(d => diasEntre(nasc, d) > 30) || todas[1]) : todas[1];
        const av2 = avaliarVisitasC2(nasc, v1, v2, (c.c2_visitas || 0) + novas);
        c.c2_tempo = { texto: av2.tempo, ok: av2.tempoOk };
        c.c2_ok1 = av2.ok1; c.c2_ok2 = av2.ok2;
        c.c2Ok = av2.ok && c.ex.C2.okExtra;
        c.pendencias = c.pendencias.filter(p => !p.startsWith('C2:'));
        av2.pend.forEach(p => c.pendencias.push('C2: ' + p));
        c.ex.C2.pend.forEach(p => c.pendencias.push(p));
      }

      if (ind.C3 && c.ex.C3) {
        const validas = (k, base) => (c.visitasApp || []).filter(v => v.inds.includes(k) && !((base || 0) > ((v.base && v.base[k]) || 0)));
        const repPn = c.c3_vis_pn || 0, repPu = c.c3_vis_puerp || 0;
        const vPn = (c.visitasApp || []).filter(v => v.inds.includes('C3PN') && repPn <= ((v.base && v.base.C3PN) || 0));
        const vPu = (c.visitasApp || []).filter(v => v.inds.includes('C3PU') && repPu <= ((v.base && v.base.C3PU) || 0));
        const visPn = repPn + vPn.length, visPu = repPu + vPu.length;
        c.c3_pn_ef = visPn; c.c3_pu_ef = visPu;
        const todasApp = extrairDatas(vPn.concat(vPu).map(v => v.d).join(' '));
        if (todasApp.length) {
          const dias = diasEntre(todasApp[todasApp.length - 1], new Date());
          c.c3_tempo = { texto: `⏱ Última visita há ${dias} dia(s) (registrada no app)`, ok: (visPn >= 3 && visPu >= 1) || dias < 30 };
        } else if (c.c3_tempo_rep) c.c3_tempo = c.c3_tempo_rep;
        c.c3Ok = (visPn >= 3 && visPu >= 1 && c.ex.C3.okExtra);
        c.pendencias = c.pendencias.filter(p => !p.startsWith('C3:'));
        if (visPn < 3) c.pendencias.push(`C3: Visitar (pré-natal ${visPn}/3) · motivo: "Gestante"` + (c.c3_ult ? ` · última há ${c.c3_ult}` : ''));
        if (visPu < 1) c.pendencias.push('C3: Visitar a mãe e o bebê até o 7º dia após o parto · motivo: "Puérpera"');
        c.ex.C3.pend.forEach(p => c.pendencias.push(p));
      }
    }

    function avisoToast(txt) {
      let t = document.getElementById('toastApp');
      if (!t) { t = document.createElement('div'); t.id = 'toastApp'; document.body.appendChild(t); }
      t.textContent = txt; t.className = 'mostrar';
      clearTimeout(window.__toastT); window.__toastT = setTimeout(() => { t.className = ''; }, 2600);
    }
