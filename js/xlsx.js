/* Leitor mínimo de planilhas .xlsx (sem biblioteca externa): converte a primeira aba em texto separado por ";" */
    // =========================================================================
    // LEITURA DE .XLSX: o PEC também exporta em Excel. O arquivo é um ZIP com XMLs.
    // =========================================================================
    async function xlsxDescompactar(buf) {
      const dv = new DataView(buf), u8 = new Uint8Array(buf);
      let eocd = -1;
      for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
      if (eocd < 0) throw new Error('Arquivo .xlsx inválido (não é um ZIP).');
      const total = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
      const arquivos = {}; const dec = new TextDecoder('utf-8');
      for (let n = 0; n < total; n++) {
        if (dv.getUint32(p, true) !== 0x02014b50) break;
        const metodo = dv.getUint16(p + 10, true), tamComp = dv.getUint32(p + 20, true);
        const tamNome = dv.getUint16(p + 28, true), tamExtra = dv.getUint16(p + 30, true), tamCom = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
        const nome = dec.decode(u8.subarray(p + 46, p + 46 + tamNome));
        p += 46 + tamNome + tamExtra + tamCom;
        if (!/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/[^/]+\.xml)$/.test(nome)) continue;
        const ini = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
        const dados = u8.subarray(ini, ini + tamComp);
        let bytes;
        if (metodo === 0) bytes = dados;
        else if (metodo === 8) {
          if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não consegue abrir .xlsx. Exporte a planilha em CSV ou atualize o navegador.');
          bytes = new Uint8Array(await new Response(new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
        } else continue;
        arquivos[nome] = dec.decode(bytes);
      }
      return arquivos;
    }
    function xmlDoc(txt) { return new DOMParser().parseFromString(txt, 'application/xml'); }
    function colunaDeRef(ref) { const m = /^([A-Z]+)/.exec(ref || ''); if (!m) return 0; let n = 0; for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }
    function serialParaTexto(v, tipo) {
      const dias = Math.floor(v), frac = v - dias;
      const hh = Math.round(frac * 86400), hora = `${String(Math.floor(hh / 3600) % 24).padStart(2, '0')}:${String(Math.floor(hh / 60) % 60).padStart(2, '0')}`;
      if (tipo === 'hora') return hora;
      const d = new Date(Date.UTC(1899, 11, 30) + dias * 86400000);
      const data = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
      return tipo === 'datahora' ? data + ' ' + hora : data;
    }
    function numeroParaTexto(s) {
      const n = Number(s); if (!isFinite(n)) return s;
      if (/e/i.test(s)) return Math.abs(n) >= 1e15 ? n.toLocaleString('fullwide', { useGrouping: false }) : String(n);
      return s;
    }

    async function xlsxParaTexto(file) {
      const arqs = await xlsxDescompactar(await file.arrayBuffer());
      // primeira aba
      let alvo = null;
      if (arqs['xl/workbook.xml'] && arqs['xl/_rels/workbook.xml.rels']) {
        const wb = xmlDoc(arqs['xl/workbook.xml']), rels = xmlDoc(arqs['xl/_rels/workbook.xml.rels']);
        const s1 = wb.getElementsByTagName('sheet')[0];
        const rid = s1 && (s1.getAttribute('r:id') || s1.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
        const rel = [...rels.getElementsByTagName('Relationship')].find(r => r.getAttribute('Id') === rid);
        if (rel) { const t = rel.getAttribute('Target').replace(/^\//, ''); alvo = t.startsWith('xl/') ? t : 'xl/' + t; }
      }
      if (!alvo || !arqs[alvo]) alvo = Object.keys(arqs).filter(n => /worksheets\//.test(n)).sort()[0];
      if (!alvo) throw new Error('Nenhuma aba encontrada no .xlsx.');
      // textos compartilhados
      const textos = [];
      if (arqs['xl/sharedStrings.xml']) [...xmlDoc(arqs['xl/sharedStrings.xml']).getElementsByTagName('si')].forEach(si => { textos.push([...si.getElementsByTagName('t')].map(t => t.textContent).join('')); });
      // estilos: quais formatos são data/hora
      const tipoPorEstilo = [];
      if (arqs['xl/styles.xml']) {
        const st = xmlDoc(arqs['xl/styles.xml']); const custom = {};
        [...st.getElementsByTagName('numFmt')].forEach(n => { custom[n.getAttribute('numFmtId')] = n.getAttribute('formatCode') || ''; });
        const classificar = (id) => {
          const f = custom[id];
          if (f === undefined) { id = +id; if (id >= 14 && id <= 17) return 'data'; if (id === 22) return 'datahora'; if (id >= 18 && id <= 21) return 'hora'; if (id >= 45 && id <= 47) return 'hora'; return null; }
          const g = f.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '').toLowerCase();
          const temData = /[dy]/.test(g), temHora = /h|s/.test(g);
          return temData && temHora ? 'datahora' : temData ? 'data' : temHora ? 'hora' : null;
        };
        const cell = st.getElementsByTagName('cellXfs')[0];
        if (cell) [...cell.getElementsByTagName('xf')].forEach(x => tipoPorEstilo.push(classificar(x.getAttribute('numFmtId'))));
      }
      const linhas = [];
      [...xmlDoc(arqs[alvo]).getElementsByTagName('row')].forEach(row => {
        const cels = [];
        [...row.getElementsByTagName('c')].forEach((c, i) => {
          const col = c.getAttribute('r') ? colunaDeRef(c.getAttribute('r')) : i;
          const t = c.getAttribute('t'); const vEl = c.getElementsByTagName('v')[0]; const v = vEl ? vEl.textContent : '';
          let txt = '';
          if (t === 's') txt = textos[+v] || '';
          else if (t === 'inlineStr') txt = [...c.getElementsByTagName('t')].map(x => x.textContent).join('');
          else if (t === 'str' || t === 'e') txt = v;
          else if (t === 'b') txt = v === '1' ? 'Sim' : 'Não';
          else if (v !== '') { const tipo = tipoPorEstilo[+c.getAttribute('s') || 0]; txt = tipo ? serialParaTexto(parseFloat(v), tipo) : numeroParaTexto(v); }
          while (cels.length < col) cels.push('');
          cels[col] = txt.replace(/[\r\n;]+/g, ' ').trim();
        });
        linhas.push(cels.join(';'));
      });
      return linhas.join('\n');
    }

    // Texto de um arquivo importado: .csv (ISO-8859-1, como o PEC exporta) ou .xlsx
    async function obterTextoArquivo(file) {
      const ini = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      const ehZip = ini[0] === 0x50 && ini[1] === 0x4b;                                   // "PK": .xlsx de verdade, mesmo com outro nome
      const ehExcelAntigo = ini[0] === 0xd0 && ini[1] === 0xcf && ini[2] === 0x11 && ini[3] === 0xe0; // .xls antigo (binário)
      if (ehExcelAntigo) throw new Error('é um Excel antigo (.xls). Abra no Excel e salve como .xlsx, ou exporte em .csv.');
      if (ehZip || /\.xlsx$/i.test(file.name || '')) return xlsxParaTexto(file);
      return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsText(file, 'ISO-8859-1'); });
    }
