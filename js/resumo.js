/* Resumo semanal para a equipe */
    // =========================================================================
    // RESUMO SEMANAL
    // =========================================================================
    function montarResumo() {
      const nomes = document.getElementById('resumoNomes').checked;
      const hoje = iniDia(new Date()), ini = somarDias(hoje, -7);
      const p = lerPerfil(); const f = fotoIndicadores();
      // referência: último registro do histórico com pelo menos 7 dias; senão o mais antigo
      const lim = isoLocal(ini); let ref = null;
      historicoCache.forEach(x => { if (x.d <= lim) ref = x; });
      if (!ref && historicoCache.length > 1) ref = historicoCache[0];
      const refHoje = isoLocal(hoje);
      if (ref && ref.d === refHoje) ref = null;
      const L = [];
      L.push(`*Resumo semanal · ${p.micro ? 'Micro ' + p.micro : 'Microárea'}*`);
      if (p.nome) L.push(p.nome);
      L.push(`Semana de ${fmtData(ini)} a ${fmtData(hoje)}`, '');
      L.push('*Indicadores*');
      IND_LISTA.forEach(k => {
        const s = f.st[k]; if (!s || !s.tot) return;
        const pc = pctInd(s); let var_ = '';
        if (ref && ref.st && ref.st[k] && ref.st[k].tot) { const d = pc - pctInd(ref.st[k]); var_ = d === 0 ? ' (= igual)' : d > 0 ? ` (▲ +${d} pts)` : ` (▼ ${d} pts)`; }
        L.push(`${NOMES_IND[k]}: ${pc}% (${s.ok}/${s.tot})${var_}${s.tot - s.ok ? ' · ' + (s.tot - s.ok) + ' pendente(s)' : ' ✓'}`);
      });
      if (ref) L.push(`Comparado com ${fmtData(parseDataJS(ref.d))}.`);
      // visitas registradas no app
      let nVis = 0, pessoas = 0;
      Object.values(BASE_DADOS.cidadaos).forEach(c => { const n = (c.visitasApp || []).filter(v => { const d = parseDataJS(v.d); return d && d >= ini && d <= hoje; }).length; if (n) { nVis += n; pessoas++; } });
      L.push('', '*Visitas registradas no app*', nVis ? `${nVis} visita(s) em ${pessoas} cidadão(s)` : 'Nenhuma visita registrada nesta semana');
      // retornos
      let atr = 0, prox = 0, fei = 0; const lstAtr = [];
      Object.values(BASE_DADOS.cidadaos).forEach(c => (c.retornos || []).forEach(r => {
        if (r.feito) { if (r.d >= isoLocal(ini)) fei++; return; }
        const d = new Date(r.d + 'T12:00:00'); const dias = diasEntre(hoje, iniDia(d));
        if (dias < 0) { atr++; lstAtr.push(c.nome); } else if (dias <= 7) prox++;
      }));
      L.push('', '*Retornos agendados*', `Atrasados: ${atr} · Próximos 7 dias: ${prox} · Feitos na semana: ${fei}`);
      if (nomes && lstAtr.length) L.push('Atrasados: ' + lstAtr.join(', '));
      // vacinação (busca ativa)
      const comVac = Object.values(BASE_DADOS.cidadaos).filter(c => c.vacAtraso && c.vacAtraso.length);
      if (comVac.length || Object.values(BASE_DADOS.cidadaos).some(c => c.vacCob)) {
        const hpv = comVac.filter(c => c.vacAtraso.some(x => ehHpv(x.v)));
        L.push('', '*Vacinação (busca ativa)*', `${comVac.length} pessoa(s) com vacina em atraso` + (hpv.length ? ` · ${hpv.length} com HPV atrasada` : ''));
        if (nomes && comVac.length) L.push('Em atraso: ' + comVac.slice(0, 20).map(c => c.nome).join(', ') + (comVac.length > 20 ? ' e mais ' + (comVac.length - 20) : ''));
      }
      // próximos 7 dias
      const al = gerarAlertas(7); const uni = new Set(al.filter(a => a.tipo !== 'retorno').map(a => a.chave));
      L.push('', '*Próximos 7 dias*', `${uni.size} cidadão(s) com prazo ou mudança de faixa a acompanhar`);
      if (nomes) {
        L.push('', '*Pendentes por indicador*');
        IND_LISTA.forEach(k => {
          const lst = Object.values(BASE_DADOS.cidadaos).filter(c => c.indicadores && c.indicadores[k] && !c[k.toLowerCase() + 'Ok']).map(c => c.nome);
          if (lst.length) L.push(`${k} (${lst.length}): ${lst.slice(0, 15).join(', ')}${lst.length > 15 ? ' e mais ' + (lst.length - 15) : ''}`);
        });
      }
      document.getElementById('resumoTexto').value = L.join('\n');
    }
    function abrirResumo() {
      if (!Object.keys(BASE_DADOS.cidadaos).length) { avisoToast('Importe as planilhas antes de gerar o resumo.'); return; }
      document.getElementById('resumoNomes').checked = false; montarResumo();
      document.getElementById('modalResumo').classList.add('aberto');
    }
    function fecharResumo() { document.getElementById('modalResumo').classList.remove('aberto'); }
    async function copiarResumo() {
      const t = document.getElementById('resumoTexto'); t.select();
      try { await navigator.clipboard.writeText(t.value); avisoToast('✅ Resumo copiado.'); } catch (e) { try { document.execCommand('copy'); avisoToast('✅ Resumo copiado.'); } catch (e2) { avisoToast('Não foi possível copiar. Selecione o texto e copie.'); } }
    }
    async function enviarResumo() {
      const txt = document.getElementById('resumoTexto').value;
      if (navigator.share) { try { await navigator.share({ title: 'Resumo semanal', text: txt }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
      window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
    }
