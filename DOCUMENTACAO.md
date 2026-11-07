# Guia de Visitas TACS — Documentação (v85.42)

App web instalável (PWA) para agentes comunitários de saúde (ACS/TACS). Funciona offline, guarda os dados no próprio aparelho e usa como fonte as planilhas exportadas do PEC.

## 1. O que o app faz
- **Importa as planilhas do PEC** (CSV/XLSX) dos indicadores C1 a C7 e monta a lista de cidadãos, famílias e pendências.
- **Ações e Prazos do Dia**: alertas por urgência, roteiro por rua, aniversariantes e, novos na v85.42, **Agenda por prazo** e **Agenda da semana**.
- **Prontuário por cidadão** (botão "📋 Prontuário" na lista e nas agendas): abas Resumo, Linha do tempo, Indicadores, Vacinas e Anotações, com atalhos para registrar visita e agendar retorno.
- **Vacinação (busca ativa)**: 4 planilhas do PEC, Atrasada e No prazo, de 0 a 9 anos e de 10 a 14 anos (HPV e outras). Pessoas com mais de 14 anos são ignoradas.
- **Backup** em `backup_dd-mm-aaaa[_protegido].json`, com senha opcional; animação de abertura.

## 2. Indicadores
C1 Cadastro · C2 Criança · C3 Gestante · C4 Diabetes · C5 Hipertensão · C6 Pessoa idosa · C7 Saúde da mulher.

## 3. Rotina de uso
1. No PEC, exporte as 13 planilhas do mesmo dia (9 dos indicadores + 4 de vacinação).
2. No app, importe uma a uma ou todas de uma vez; o app informa as que faltam.
3. Use a agenda (prazo/semana) e o prontuário para planejar as visitas.
4. Registre visitas e retornos; faça backup periodicamente.

## 4. Estrutura do projeto
`index.html`, `styles.css`, `sw.js` (cache offline), `manifest.json`, `scripts/versao.js` e `js/`:
`versao, nucleo, armazenamento, alertas, agenda, backup, senha, resumo, acessibilidade, vacinacao, retornos, medidas, visitas, mudancas, historico, alcance, xlsx, indicadores, interface, prontuario`.

**Nova versão:** `node scripts/versao.js 85.NN` (atualiza `js/versao.js` e o nome do cache). Todo arquivo novo precisa entrar no `index.html` e na lista `RECURSOS` do `sw.js`. Os ícones `icone-*.png` ficam ao lado do `index.html`.

## 5. Onde ficam os dados
IndexedDB `guia-tacs` e localStorage, **no aparelho de cada usuário**. Nada é enviado a servidor. Cada ACS tem a sua própria base e o seu próprio backup.

## 6. Plano: APK e uso por mais colegas (10 a 20 usuários)

### 6.1 Hospedagem (GitHub Pages)
O GitHub Pages só serve arquivos estáticos (o app tem cerca de 100 KB). Depois da primeira abertura, o app roda no aparelho e não consome o servidor, então **10 a 20 usuários (ou toda a UBS, 11 TACS) não são problema** para o Pages. Atenção:
- **Nunca publique dados reais de pacientes no repositório.** No plano gratuito o repositório é público; os dados só devem existir dentro do app, em cada aparelho.
- Cada colega recebe a atualização quando abre o app com internet (o service worker troca a versão). Avise a equipe a cada versão nova e confira a versão no rodapé.
- Cada colega importa as próprias planilhas e faz o próprio backup; ninguém vê os dados de outro.

### 6.2 APK
- Caminho recomendado: **empacotar o mesmo PWA com Capacitor** (ou TWA/Bubblewrap). Mantém um único código para web e Android.
- Os dados continuam em IndexedDB dentro do app, o que já atende. No APK, o backup em arquivo é ainda mais importante, porque desinstalar o app apaga os dados.
- Distribuição inicial por arquivo `.apk` para a equipe; Play Store só se houver necessidade (exige conta de desenvolvedor).
- Atualizações: o APK pode carregar o conteúdo atualizado da web ou receber novo `.apk`; definir um dos dois antes de empacotar.

### 6.3 SQL
- **Não é necessário agora.** O app é offline-first e a base de uma microárea cabe em IndexedDB sem problema.
- Faz sentido SQL em dois casos:
  1. **Só no aparelho (APK):** SQLite via Capacitor, para consultas mais rápidas e estruturadas. Exige migrar a base atual e reescrever a camada de dados; ganho pequeno para o volume de uma microárea.
  2. **Servidor compartilhado:** só se a UBS quiser painel da equipe ou sincronizar entre aparelhos. Isso envolve **dados pessoais de saúde (LGPD)**: autorização da gestão/UBS, login, criptografia, backup e controle de acesso. É um projeto maior e deve ser decidido com a coordenação.
- Sugestão de caminho: (1) manter local e distribuir o PWA/APK à equipe; (2) se surgir demanda real de compartilhamento, avaliar um servidor com autenticação e permissão por microárea.

### 6.4 Limites e próximos passos
- Hoje não há sincronização: trocar de celular exige restaurar o backup.
- Sem login: a senha do app protege só o acesso local.
- Próximos passos possíveis: teste com 2 a 3 colegas da UBS; definir como distribuir atualizações; decidir APK (Capacitor); só depois discutir servidor.

## 7. Histórico recente
- v85.40: animação de abertura; backup com nome curto.
- v85.41: 4 planilhas de vacinação (limite de 14 anos); Agenda por prazo e da semana; Prontuário.
- v85.42: botão Prontuário nos cartões das agendas.
