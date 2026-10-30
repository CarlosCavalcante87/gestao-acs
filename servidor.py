import os
import glob
import json
import struct
import zlib
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORTA = 8080
ARQUIVO_DADOS = "dados_microarea.json"

def garantir_icones():
    def criar_png_puro(largura, altura, cor_rgb=(2, 132, 199)):
        r, g, b = cor_rgb
        dados = bytearray()
        for _ in range(altura):
            dados.append(0)
            for _ in range(largura):
                dados.extend((r, g, b))
        def chunk(tag, data):
            return struct.pack("!I", len(data)) + tag + data + struct.pack("!I", zlib.crc32(tag + data) & 0xffffffff)
        ihdr = struct.pack("!IIBBBBB", largura, altura, 8, 2, 0, 0, 0)
        idat = zlib.compress(bytes(dados), 9)
        return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")

    if not os.path.exists("icone-192.png"):
        with open("icone-192.png", "wb") as f:
            f.write(criar_png_puro(192, 192))

    if not os.path.exists("icone-512.png"):
        with open("icone-512.png", "wb") as f:
            f.write(criar_png_puro(512, 512))

def normalizar_rua(nome_rua):
    rua = nome_rua.strip().upper()
    if not rua or rua == "-":
        return ""
    if "SÃO FRANCISCO" in rua or "SAO FRANCISCO" in rua:
        return "RUA SÃO FRANCISCO"
    if "SÃO PEDRO" in rua or "SAO PEDRO" in rua:
        return "RUA SÃO PEDRO"
    if not rua.startswith("RUA ") and not rua.startswith("AVENIDA ") and not rua.startswith("TRAVESSA "):
        return f"RUA {rua}"
    return rua

def parse_data(d_str):
    if not d_str or d_str == '-': return None
    for fmt in ('%d/%m/%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(d_str.strip(), fmt)
        except:
            pass
    return None

def processar_csvs_da_pasta():
    csv_files = glob.glob("*.csv")
    if not csv_files:
        print("[-] Nenhum arquivo .csv encontrado na pasta atual.")
        return

    print(f"[*] Processando {len(csv_files)} relatórios CSV do PEC...")
    
    anotacoes_salvas = {}
    if os.path.exists(ARQUIVO_DADOS):
        try:
            with open(ARQUIVO_DADOS, 'r', encoding='utf-8') as f:
                dados_antigos = json.load(f)
                for k, v in dados_antigos.get('cidadaos', {}).items():
                    if v.get('anotacao'):
                        anotacoes_salvas[k] = v['anotacao']
        except Exception:
            pass

    base_dados = {"cidadaos": {}, "ruas": set()}
    cpf_to_chave = {}
    nome_to_chave = {}

    for f in sorted(csv_files):
        try:
            with open(f, 'r', encoding='latin-1') as fp:
                linhas = fp.readlines()
        except Exception as e:
            print(f"[!] Erro ao abrir {f}: {e}")
            continue

        tema = ""
        cabecalhoIdx = -1
        for i in range(min(len(linhas), 35)):
            l = linhas[i].strip()
            if "Lista temática;" in l:
                tema = l.split(";")[1].strip()
            if any(l.startswith(h) for h in ["Nome;", "NOME CIDADÃO;", "Nome equipe;", "TIPO DE LOGRADOURO;"]):
                cabecalhoIdx = i
                break

        if cabecalhoIdx == -1:
            continue

        colunas = [c.strip().strip('"') for c in linhas[cabecalhoIdx].split(";")]

        for i in range(cabecalhoIdx + 1, len(linhas)):
            linha = linhas[i].strip()
            if not linha:
                continue
            valores = [v.strip().strip('"') for v in linha.split(";")]
            reg = {}
            for idx, col in enumerate(colunas):
                reg[col] = valores[idx] if idx < len(valores) else ""

            nome = (reg.get("Nome") or reg.get("NOME CIDADÃO") or "").strip().upper()
            if not nome or nome in ["-", "SEM MORADORES", "NÃO INFORMADO"] or len(nome) < 3:
                continue

            cpf_bruto = reg.get("CPF") or reg.get("CPF/CNS") or ""
            cpf_limpo = "".join([c for c in cpf_bruto if c.isdigit()])
            if len(cpf_limpo) != 11:
                cpf_limpo = ""

            chave = None
            if cpf_limpo and cpf_limpo in cpf_to_chave:
                chave = cpf_to_chave[cpf_limpo]
            elif nome in nome_to_chave:
                chave = nome_to_chave[nome]
            else:
                chave = cpf_limpo if cpf_limpo else nome

            if cpf_limpo: cpf_to_chave[cpf_limpo] = chave
            if nome: nome_to_chave[nome] = chave

            rua_bruta = reg.get("Rua") or reg.get("LOGRADOURO") or ""
            rua_formatada = normalizar_rua(rua_bruta)

            if chave not in base_dados["cidadaos"]:
                base_dados["cidadaos"][chave] = {
                    "nome": nome,
                    "cpf": cpf_bruto if cpf_bruto != "-" else "",
                    "cns": reg.get("CNS", "") if reg.get("CNS") != "-" else "",
                    "rua": rua_formatada,
                    "numero": reg.get("Número") or reg.get("NÚMERO") or "",
                    "telefone": reg.get("Telefone celular", "") if reg.get("Telefone celular") != "-" else "",
                    "condicoes": {},
                    "indicadores": {"C1": True},
                    "pendencias": [],
                    "anotacao": anotacoes_salvas.get(chave, "")
                }

            cid = base_dados["cidadaos"][chave]
            cid['indicadores']['C1'] = True

            if nome and not cid["nome"]: cid["nome"] = nome
            if cpf_bruto and cpf_bruto != "-" and not cid["cpf"]: cid["cpf"] = cpf_bruto
            if reg.get("CNS") and reg.get("CNS") != "-" and not cid["cns"]: cid["cns"] = reg.get("CNS")
            if rua_formatada: cid["rua"] = rua_formatada
            if reg.get("Número"): cid["numero"] = reg["Número"]
            if reg.get("NÚMERO") and not cid["numero"]: cid["numero"] = reg["NÚMERO"]
            if reg.get("Telefone celular") and reg.get("Telefone celular") != "-" and not cid["telefone"]:
                cid["telefone"] = reg.get("Telefone celular")
            if cid["rua"]: base_dados["ruas"].add(cid["rua"])

            if 'Última atualização cadastral' in reg and reg.get('Última atualização cadastral') and reg.get('Última atualização cadastral') != '-':
                cid['dt_cadastral'] = reg.get('Última atualização cadastral')

            # C2: Crianças
            if tema == "Desenvolvimento infantil":
                cid['indicadores']['C2'] = True
                try: vis_inf = int(reg.get('Quantidade de visitas domiciliares até os 24 meses de idade', 0) or 0)
                except: vis_inf = 0
                try: cons_inf = int(reg.get('Quantidade de consultas até 24 meses', 0) or 0)
                except: cons_inf = 0
                
                penta = reg.get('Difteria, Tétano, Pertusis, Hepatite B, Haemophilus Influenza B', '')
                polio = reg.get('Poliomielite', '')
                
                penta_ok = bool(penta and penta != '-')
                polio_ok = bool(polio and polio != '-')
                vac_ok = (penta_ok and polio_ok)

                cid['c2_visitas'] = vis_inf
                cid['c2_vacinasOk'] = vac_ok
                cid['c2Ok'] = (vis_inf >= 2 and vac_ok and cons_inf >= 1)
                
                cid['pendencias'] = [p for p in cid['pendencias'] if not p.startswith("C2:")]
                
                if vis_inf < 2: 
                    cid['pendencias'].append(f"C2: Visita Domiciliar pendente ({vis_inf}/2 visitas)")
                
                if not penta_ok and not polio_ok:
                    cid['pendencias'].append("C2: Busca Ativa - Faltam vacinas Penta e Pólio")
                elif not penta_ok:
                    cid['pendencias'].append("C2: Busca Ativa - Falta vacina Penta")
                elif not polio_ok:
                    cid['pendencias'].append("C2: Busca Ativa - Falta vacina Pólio")
                
                if cons_inf == 0: 
                    cid['pendencias'].append("C2: Busca Ativa - Agendar consulta de puericultura")

            # C3: Gestantes
            elif tema == "Gestação e puerpério":
                cid['indicadores']['C3'] = True
                try: vis_pn = int(reg.get('Quantidade de visitas domiciliares no pré-natal', 0) or 0)
                except: vis_pn = 0
                try: vis_puerp = int(reg.get('Quantidade de visitas domiciliares no puerpério', 0) or 0)
                except: vis_puerp = 0
                try: cons_pn = int(reg.get('Quantidade de atendimentos no pré-natal', 0) or 0)
                except: cons_pn = 0
                try: cons_12sem = int(reg.get('Quantidade de atendimentos até 12 semanas no pré-natal', 0) or 0)
                except: cons_12sem = 0
                try: odonto = int(reg.get('Quantidade de atendimentos odontológicos no pré-natal', 0) or 0)
                except: odonto = 0

                cid['c3_vis_pn'] = vis_pn
                cid['c3_vis_puerp'] = vis_puerp
                cid['c3Ok'] = (vis_pn >= 3 and vis_puerp >= 1 and cons_pn >= 6 and odonto >= 1 and cons_12sem >= 1)
                cid['pendencias'] = [p for p in cid['pendencias'] if not p.startswith("C3:")]
                if vis_pn < 3: cid['pendencias'].append(f"C3: Visitas Pré-Natal pendentes ({vis_pn}/3)")
                if vis_puerp < 1: cid['pendencias'].append("C3: Visita no Puerpério pendente (0/1)")
                if cons_12sem == 0: cid['pendencias'].append("C3: Busca Ativa - Captação precoce (<12 semanas)")
                if cons_pn < 6: cid['pendencias'].append(f"C3: Busca Ativa - Consultas Pré-Natal ({cons_pn}/6)")
                if odonto < 1: cid['pendencias'].append("C3: Busca Ativa - Avaliação Odontológica pendente")

            # C4: Diabetes
            elif tema == "Diabetes":
                cid['indicadores']['C4'] = True
                try: vis_dia = int(reg.get('Quantidade de visitas domiciliares', 0) or 0)
                except: vis_dia = 0
                hg = reg.get('Hemoglobina glicada', '')
                dt_hg = reg.get('Data da última avaliação de hemoglobina glicada', '')
                dt_pes = reg.get('Data da avaliação dos pés', '')
                hg_ok = bool((hg and hg != '-') or (dt_hg and dt_hg != '-'))
                pes_ok = bool(dt_pes and dt_pes != '-')

                cid['c4_visitas'] = vis_dia
                cid['c4Ok'] = (vis_dia >= 2 and hg_ok and pes_ok)
                cid['pendencias'] = [p for p in cid['pendencias'] if not p.startswith("C4:")]
                if vis_dia < 2: cid['pendencias'].append(f"C4: Visitas Domiciliares pendentes ({vis_dia}/2 no ano)")
                if not hg_ok: cid['pendencias'].append("C4: Busca Ativa - Exame de Hemoglobina Glicada")
                if not pes_ok: cid['pendencias'].append("C4: Busca Ativa - Avaliação periódica dos pés")

            # C5: Hipertensão
            elif tema == "Hipertensão":
                cid['indicadores']['C5'] = True
                try: vis_hip = int(reg.get('Quantidade de visitas domiciliares', 0) or 0)
                except: vis_hip = 0
                try: pa_qtd = int(reg.get('Quantidade de medições de pressão arterial', 0) or 0)
                except: pa_qtd = 0
                try: cons_qtd = int(reg.get('Quantidade de consultas', 0) or 0)
                except: cons_qtd = 0

                cid['c5_visitas'] = vis_hip
                cid['c5Ok'] = (vis_hip >= 2 and pa_qtd >= 1 and cons_qtd >= 1)
                cid['pendencias'] = [p for p in cid['pendencias'] if not p.startswith("C5:")]
                if vis_hip < 2: cid['pendencias'].append(f"C5: Visitas Domiciliares pendentes ({vis_hip}/2 no ano)")
                if pa_qtd == 0: cid['pendencias'].append("C5: Busca Ativa - Aferição de PA no semestre")
                if cons_qtd == 0: cid['pendencias'].append("C5: Busca Ativa - Agendar Consulta semestral")

            # C6: Pessoa Idosa (60+)
            elif tema == "Pessoa idosa":
                cid['indicadores']['C6'] = True
                try: vis_ido = int(reg.get('Quantidade de visitas domiciliares', 0) or 0)
                except: vis_ido = 0
                inf = reg.get('Influenza (últimos 12 meses)', '')
                inf_ok = bool(inf and inf not in ['-', 'Não', 'Sem registro'])
                try: m_med = int(reg.get('Meses desde o último atendimento médico', 99) or 99)
                except: m_med = 99
                try: m_enf = int(reg.get('Meses desde o último atendimento de enfermagem', 99) or 99)
                except: m_enf = 99
                cons_anual = (m_med <= 12 or m_enf <= 12)
                ivcf = reg.get('IVCF-20 Índice', '')
                ivcf_ok = bool(ivcf and ivcf not in ['-', 'Sem registro'])

                cid['c6_visitas'] = vis_ido
                cid['c6Ok'] = (vis_ido >= 2 and inf_ok and cons_anual)
                cid['pendencias'] = [p for p in cid['pendencias'] if not p.startswith("C6:")]
                if vis_ido < 2: cid['pendencias'].append(f"C6: Visitas Domiciliares pendentes ({vis_ido}/2 no ano)")
                if not inf_ok: cid['pendencias'].append("C6: Busca Ativa - Vacina contra Influenza atrasada")
                if not cons_anual: cid['pendencias'].append("C6: Busca Ativa - Consulta anual pendente (>12 meses)")
                if not ivcf_ok: cid['pendencias'].append("C6: Busca Ativa - Avaliação multidimensional (IVCF-20)")

            # C7: Saúde da Mulher
            elif tema == "Saúde da mulher":
                cid['indicadores']['C7'] = True
                av = reg.get("Exame de rastreamento de câncer de colo de útero data última avaliação", "")
                cid['c7Ok'] = bool(av and av != "-")
                cid['pendencias'] = [p for p in cid['pendencias'] if not p.startswith("C7:")]
                if not cid['c7Ok']:
                    cid['pendencias'].append("C7: Busca Ativa - Coleta de Preventivo em atraso")

    # Validação Final do C1
    agora = datetime.now()
    for cid in base_dados["cidadaos"].values():
        cid['indicadores']['C1'] = True
        dt_obj = parse_data(cid.get('dt_cadastral', ''))
        dias = (agora - dt_obj).days if dt_obj else 0
        cid['c1Ok'] = bool(dt_obj and dias <= 730)
        if not cid['c1Ok']:
            dt_str = cid.get('dt_cadastral', 'Sem data')
            cid['pendencias'] = [p for p in cid['pendencias'] if not p.startswith("C1:")]
            cid['pendencias'].append(f"C1: Cadastro desatualizado há mais de 2 anos ({dt_str})")

    base_dados["ruas"] = sorted(list(base_dados["ruas"]))

    with open(ARQUIVO_DADOS, 'w', encoding='utf-8') as f:
        json.dump(base_dados, f, ensure_ascii=False, indent=2)

    print(f"[OK] {len(base_dados['cidadaos'])} cidadãos processados com sucesso.")


class ServidorACS(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/salvar':
            try:
                tamanho = int(self.headers.get('Content-Length', 0))
                corpo = self.rfile.read(tamanho)
                dados = json.loads(corpo.decode('utf-8'))
                with open(ARQUIVO_DADOS, 'w', encoding='utf-8') as f:
                    json.dump(dados, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(b'{"status": "sucesso"}')
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "erro", "detalhe": str(e)}).encode('utf-8'))
                
        elif self.path == '/api/salvar_anotacoes':
            try:
                tamanho = int(self.headers.get('Content-Length', 0))
                corpo = self.rfile.read(tamanho)
                notas_recebidas = json.loads(corpo.decode('utf-8'))
                
                if os.path.exists(ARQUIVO_DADOS):
                    with open(ARQUIVO_DADOS, 'r', encoding='utf-8') as f:
                        dados_atuais = json.load(f)
                    
                    for chave, nota in notas_recebidas.items():
                        if chave in dados_atuais.get("cidadaos", {}):
                            dados_atuais["cidadaos"][chave]["anotacao"] = nota
                            
                    with open(ARQUIVO_DADOS, 'w', encoding='utf-8') as f:
                        json.dump(dados_atuais, f, ensure_ascii=False, indent=2)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(b'{"status": "anotacoes_salvas"}')
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "erro", "detalhe": str(e)}).encode('utf-8'))
        else:
            self.send_error(404)

    def do_GET(self):
        if self.path == '/api/dados':
            if os.path.exists(ARQUIVO_DADOS):
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                with open(ARQUIVO_DADOS, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(b'{"cidadaos": {}, "ruas": []}')
        else:
            super().do_GET()


if __name__ == '__main__':
    garantir_icones()
    processar_csvs_da_pasta()

    print("\n" + "=" * 55)
    print(f" Servidor ACS Ativo na Porta {PORTA}")
    print(f" No Celular acesse: http://192.168.1.7:{PORTA}")
    print("=" * 55)

    servidor = HTTPServer(('0.0.0.0', PORTA), ServidorACS)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")