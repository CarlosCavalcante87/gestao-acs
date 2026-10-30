import os
import glob
import json
import struct
import zlib
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORTA = 8080
ARQUIVO_DADOS = "dados_microarea.json"

def garantir_icones():
    """Gera automaticamente arquivos PNG válidos para os ícones do PWA caso não existam."""
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
        print("[+] Gerado com sucesso: icone-192.png")

    if not os.path.exists("icone-512.png"):
        with open("icone-512.png", "wb") as f:
            f.write(criar_png_puro(512, 512))
        print("[+] Gerado com sucesso: icone-512.png")

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

def processar_csvs_da_pasta():
    csv_files = glob.glob("*.csv")
    if not csv_files:
        print("[-] Nenhum arquivo .csv encontrado na pasta atual.")
        return

    print(f"[*] Processando {len(csv_files)} arquivos CSV do e-SUS PEC...")
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

            if cpf_limpo:
                cpf_to_chave[cpf_limpo] = chave
            if nome:
                nome_to_chave[nome] = chave

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
                    "pendencias": []
                }

            cid = base_dados["cidadaos"][chave]
            if nome and not cid["nome"]: cid["nome"] = nome
            if cpf_bruto and cpf_bruto != "-" and not cid["cpf"]: cid["cpf"] = cpf_bruto
            if reg.get("CNS") and reg.get("CNS") != "-" and not cid["cns"]: cid["cns"] = reg.get("CNS")
            if rua_formatada: cid["rua"] = rua_formatada
            if reg.get("Número"): cid["numero"] = reg["Número"]
            if reg.get("NÚMERO") and not cid["numero"]: cid["numero"] = reg["NÚMERO"]
            if reg.get("Telefone celular") and reg.get("Telefone celular") != "-" and not cid["telefone"]:
                cid["telefone"] = reg.get("Telefone celular")
            if cid["rua"]: base_dados["ruas"].add(cid["rua"])

            # Regras dos Indicadores
            if tema == "Hipertensão":
                try: pa_qtd = int(reg.get("Quantidade de medições de pressão arterial", 0) or 0)
                except: pa_qtd = 0
                try: cons_qtd = int(reg.get("Quantidade de consultas", 0) or 0)
                except: cons_qtd = 0
                cid["condicoes"]["Hipertensao"] = True
                cid["hipertensaoOk"] = (pa_qtd >= 1 and cons_qtd >= 1)
                cid["pendencias"] = [p for p in cid["pendencias"] if not p.startswith("Hipertensão:")]
                if not cid["hipertensaoOk"]:
                    if cons_qtd == 0: cid["pendencias"].append("Hipertensão: Consulta pendente")
                    if pa_qtd == 0: cid["pendencias"].append("Hipertensão: Aferir PA no semestre")

            elif tema == "Diabetes":
                hg = reg.get("Hemoglobina glicada", "")
                cid["condicoes"]["Diabetes"] = True
                cid["diabetesOk"] = (hg != "" and hg != "-")
                cid["pendencias"] = [p for p in cid["pendencias"] if not p.startswith("Diabetes:")]
                if not cid["diabetesOk"]:
                    cid["pendencias"].append("Diabetes: Exame de Hemoglobina Glicada")

            elif tema == "Gestação e puerpério":
                try: cons_pn = int(reg.get("Quantidade de atendimentos no pré-natal", 0) or 0)
                except: cons_pn = 0
                try: odonto = int(reg.get("Quantidade de atendimentos odontológicos no pré-natal", 0) or 0)
                except: odonto = 0
                cid["condicoes"]["Gestante"] = True
                cid["gestanteOk"] = (cons_pn >= 6 and odonto >= 1)
                cid["pendencias"] = [p for p in cid["pendencias"] if not p.startswith("Pré-natal:")]
                if cons_pn < 6: cid["pendencias"].append(f"Pré-natal: {cons_pn}/6 consultas")
                if odonto == 0: cid["pendencias"].append("Pré-natal: Odonto pendente")

            elif tema == "Saúde da mulher":
                av = reg.get("Exame de rastreamento de câncer de colo de útero data última avaliação", "")
                cid["condicoes"]["Mulher"] = True
                cid["citopatologicoOk"] = (av != "" and av != "-")
                cid["pendencias"] = [p for p in cid["pendencias"] if not p.startswith("Saúde da Mulher:")]
                if not cid["citopatologicoOk"]:
                    cid["pendencias"].append("Saúde da Mulher: Coleta de Preventivo")

            elif tema == "Desenvolvimento infantil":
                cid["condicoes"]["Crianca"] = True
                penta = reg.get("Difteria, Tétano, Pertusis, Hepatite B, Haemophilus Influenza B", "")
                polio = reg.get("Poliomielite", "")
                cid["criancaOk"] = (penta != "" and penta != "-" and polio != "" and polio != "-")
                cid["pendencias"] = [p for p in cid["pendencias"] if not p.startswith("Criança:")]
                if not cid["criancaOk"]:
                    cid["pendencias"].append("Criança: Vacinas pendentes (Penta/Polio)")

            elif tema == "Pessoa idosa":
                cid["condicoes"]["Idoso"] = True
                ivcf = reg.get("IVCF-20 Índice", "")
                cid["ivcfOk"] = (ivcf != "" and ivcf != "-" and ivcf != "Sem registro")
                cid["pendencias"] = [p for p in cid["pendencias"] if not p.startswith("Idoso:")]
                if not cid["ivcfOk"]:
                    cid["pendencias"].append("Idoso: Avaliação IVCF-20 pendente")

    base_dados["ruas"] = sorted(list(base_dados["ruas"]))
    
    with open(ARQUIVO_DADOS, 'w', encoding='utf-8') as f:
        json.dump(base_dados, f, ensure_ascii=False, indent=2)

    total_cidadaos = len(base_dados["cidadaos"])
    print(f"[OK] Sucesso! {total_cidadaos} cidadãos únicos processados e salvos em '{ARQUIVO_DADOS}'.")
    print(f"[OK] Ruas mapeadas: {', '.join(base_dados['ruas'])}")


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