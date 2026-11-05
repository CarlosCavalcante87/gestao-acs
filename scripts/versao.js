// Uso: node scripts/versao.js 85.13
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const v = (process.argv[2] || '').replace(/^v/, '');
if (!/^\d+\.\d+$/.test(v)) { console.error('Informe a versão no formato 85.13'); process.exit(1); }
const arq = path.join(raiz, 'js', 'versao.js');
fs.writeFileSync(arq, fs.readFileSync(arq, 'utf8').replace(/self\.__VERSAO__ = '[^']*';/, `self.__VERSAO__ = 'v${v}';`));
const pj = path.join(raiz, 'package.json'), p = JSON.parse(fs.readFileSync(pj, 'utf8'));
p.version = v + '.0'; fs.writeFileSync(pj, JSON.stringify(p, null, 2) + '\n');
console.log('Versão atualizada para v' + v);
