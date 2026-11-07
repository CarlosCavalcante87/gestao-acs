/* Prontuário do cidadão: resumo, linha do tempo, indicadores, vacinas e anotações */
    let chaveProntuario = null, abaProntuario = 'resumo';
    const PR_NOMES = { C1: 'Cadastro', C2: 'Criança', C3: 'Gestante', C4: 'Diabetes', C5: 'Hipertensão', C6: 'Pessoa idosa', C7: 'Saúde da mulher' };
    const PR_COR = { C1: '#0284c7', C2: '#d97706', C3: '#0d9488', C4: '#7c3aed', C5: '#dc2626', C6: '#2563eb', C7: '#db2777' };
    // aceita dd/mm/aaaa ou aaaa-mm-dd; devolve ISO ou ''
    function prontISO(s) {
      s = String(s || '').trim(); let m;
      if ((m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/))) return `${m[3]}-${m[2]}-${m[1]}`;
      if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[0];
      return '';
    }
    function prontDatasTexto(txt) { return (String(txt || '').match(/\d{2}\/\d{2}\/\d{4}/g) || []).map(prontISO); }
    function prChip(k) { return `<span class="pr-chip" style="background:${PR_COR[k]}1a;color:${PR_COR[k]}">${k}</span>`; }

    function prontEventos(c) {
      const ev = [];
      const add = (iso, titulo, origem, inds) => { if (iso) ev.push({ iso, titulo, origem, inds: inds || [] }); };
      (c.visitasApp || []).forEach(v => add(prontISO(v.d), 'Visita registrada no app', 'ACS', v.inds || []));
      add(prontISO(c.c2_v1), '1ª visita domiciliar', 'PEC', ['C2']);
      add(prontISO(c.c2_v2), '2ª visita domiciliar', 'PEC', ['C2']);
      [['C4', c.c4_vis_txt], ['C5', c.c5_vis_txt], ['C6', c.c6_vis_txt]].forEach(([k, t]) => prontDatasTexto(t).forEach(d => add(d, 'Visita domiciliar', 'PEC', [k])));
      add(prontISO(c.dt_cadastral), 'Cadastro individual atualizado', 'PEC', ['C1']);
      add(prontISO(c.dt_cad_dom), 'Cadastro domiciliar atualizado', 'PEC', ['C1']);
      const m = c.med || {};
      add(prontISO(m.dtPeso), 'Peso e altura medidos', 'PEC', []);
      add(prontISO(m.dtPa), 'Pressão aferida' + (m.pa ? ' (' + m.pa + ')' : ''), 'PEC', ['C5']);
      add(prontISO(m.dtHg), 'Hemoglobina glicada' + (m.hg !== undefined ? ' (' + m.hg + '%)' : ''), 'PEC', ['C4']);
      const it = (c.c7_base && c.c7_base.itens) || {};
      add(prontISO(it.colo && it.colo.dt), 'Exame preventivo', 'PEC', ['C7']);
      add(prontISO(it.mama && it.mama.dt), 'Mamografia', 'PEC', ['C7']);
      add(prontISO(it.consulta && it.consulta.dt), 'Consulta', 'PEC', ['C7']);
      (c.retornos || []).forEach(r => add(r.d, 'Retorno ' + (r.feito ? 'feito' : 'agendado') + (r.nota ? ': ' + r.nota : ''), 'ACS', []));
      return ev;
    }
    function prontAlertas(chave) { try { return gerarAlertas(400).filter(a => a.chave === chave); } catch (e) { return []; } }

    function prontResumo(chave, c) {
      const pend = c.pendencias || [], al = prontAlertas(chave);
      const idade = c.dt_nascimento ? calcularIdade(c.dt_nascimento) : (c.idade_txt || '');
      let h = '';
      h += pend.length ? `<div class="pr-bloco pr-fazer"><b>Fazer na próxima visita</b>${pend.map(p => { const k = p.slice(0, 2); return `<div class="pr-linha">${/^C[1-7]$/.test(k) ? prChip(k) : ''}<span>${escHtml(p.replace(/^C[1-7]:\s*/, ''))}</span></div>`; }).join('')}</div>`
                : `<div class="pr-bloco pr-ok"><b>✓ Nenhuma pendência no momento</b></div>`;
      if (al.length) h += `<div class="pr-bloco"><b>Prazos</b>${al.map(a => `<div class="pr-linha">${a.ind && PR_COR[a.ind] ? prChip(a.ind) : ''}<span>${escHtml(a.texto)}<br><small>${a.atrasado ? 'atrasado · ' : ''}${a.data ? dataBR(isoLocal(a.data instanceof Date ? a.data : new Date(a.data))) : ''}</small></span></div>`).join('')}</div>`;
      h += `<div class="pr-bloco"><b>Medidas</b>${htmlMedidas(c)}</div>`;
      const ult = (c.visitasApp || []).slice(-1)[0];
      h += `<div class="pr-bloco"><b>Última visita no app</b><div>${ult ? escHtml(ult.d) : 'Nenhuma registrada'}</div></div>`;
      return `<div class="pr-meta">${idade ? escHtml(idade) + ' · ' : ''}${c.sexo ? escHtml(c.sexo) + ' · ' : ''}📍 ${escHtml(c.rua || 'Sem rua')}, nº ${escHtml(numeroComComplemento(c) || 'S/N')}</div>` + h;
    }
    function prontLinha(c) {
      const hoje = isoLocal(new Date());
      const ev = prontEventos(c).sort((a, b) => b.iso.localeCompare(a.iso));
      if (!ev.length) return '<div class="pr-vazio">Ainda não há eventos registrados.</div>';
      const fut = ev.filter(e => e.iso > hoje).reverse(), pas = ev.filter(e => e.iso <= hoje);
      const li = e => `<div class="pr-ev"><div class="pr-ev-d">${dataBR(e.iso)}</div><div class="pr-ev-t">${escHtml(e.titulo)}<div class="pr-ev-o"><span class="pr-orig">${e.origem}</span>${e.inds.map(prChip).join('')}</div></div></div>`;
      return (fut.length ? `<div class="pr-sec">Próximos</div>${fut.map(li).join('')}` : '') + `<div class="pr-sec">Histórico</div>${pas.map(li).join('')}`;
    }
    function prontIndicadores(c) {
      const ks = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'].filter(k => k === 'C1' || (c.indicadores && c.indicadores[k]));
      return ks.map(k => {
        const acoes = (c.pendencias || []).filter(p => p.startsWith(k + ':')).map(p => p.slice(3).trim());
        const ok = c[k.toLowerCase() + 'Ok'] === true && !acoes.length;
        const t = c[k.toLowerCase() + '_tempo'];
        return `<div class="pr-bloco"><div class="pr-ind-topo"><b style="color:${PR_COR[k]}">${k} · ${PR_NOMES[k]}</b><span class="tag ${ok ? 'tag-ok' : 'tag-danger'}">${ok ? '✓ meta atingida' : '✗ falta'}</span></div>${t && t.texto ? `<small>${escHtml(t.texto)}</small>` : ''}${acoes.map(a => `<div class="pr-linha"><span>👉 ${escHtml(a)}</span></div>`).join('')}</div>`;
      }).join('');
    }
    function prontVacinas(c) {
      const l = (t, arr, d) => arr && arr.length ? `<div class="pr-bloco"><b>${t}</b><div>${arr.map(x => escHtml(textoDoseVacina(x))).join(' · ')}</div>${d ? `<small>Relatório de ${escHtml(d)}</small>` : ''}</div>` : '';
      const h = l('💉 Em atraso', c.vacAtraso, c.vacData) + l('🗓️ No prazo', c.vacNoPrazo, c.vacDataPrazo);
      let hpv = ''; try { hpv = typeof badgeHpv === 'function' ? badgeHpv(c) : ''; } catch (e) {}
      return (h || '<div class="pr-vazio">Sem dados de vacina importados para esta pessoa.</div>') + (hpv ? `<div class="pr-bloco"><b>HPV</b><div>${hpv}</div></div>` : '');
    }
    function prontNotas(chave, c) {
      return `<textarea class="area-anotacao" style="min-height:140px" placeholder="✍️ Anotações do ACS..." onchange="salvarAnotacao('${escHtml(chave)}', this.value)">${escHtml(c.anotacao || '')}</textarea>`;
    }
    function renderProntuario() {
      const c = BASE_DADOS.cidadaos[chaveProntuario]; if (!c) return;
      document.getElementById('prNome').textContent = c.nome;
      document.querySelectorAll('#modalProntuario .pr-aba').forEach(b => b.classList.toggle('ativa', b.dataset.aba === abaProntuario));
      const f = { resumo: () => prontResumo(chaveProntuario, c), linha: () => prontLinha(c), ind: () => prontIndicadores(c), vac: () => prontVacinas(c), notas: () => prontNotas(chaveProntuario, c) }[abaProntuario];
      document.getElementById('prCorpo').innerHTML = f();
      const rv = document.getElementById('prVisita'); rv.style.display = podeRegistrarVisita(c) ? '' : 'none';
    }
    function abrirProntuario(chave, aba) { chaveProntuario = chave; abaProntuario = aba || 'resumo'; renderProntuario(); document.getElementById('modalProntuario').classList.add('aberto'); document.getElementById('prCorpo').scrollTop = 0; }
    function fecharProntuario() { document.getElementById('modalProntuario').classList.remove('aberto'); chaveProntuario = null; }
    function trocarAbaProntuario(a) { abaProntuario = a; renderProntuario(); }
    document.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('.btn-prontuario'); if (b) abrirProntuario(b.getAttribute('data-chave'));
    });
    // ao registrar visita/retorno por cima do prontuário, atualiza o conteúdo quando a tela principal mudar
    (function () { const o = window.atualizarInterface; if (typeof o === 'function') window.atualizarInterface = function () { const r = o.apply(this, arguments); if (chaveProntuario) renderProntuario(); return r; }; })();
