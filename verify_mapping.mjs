/**
 * verify_mapping.mjs
 * 
 * Verifica a integridade da regra de vínculo obrigatório 1:1:1:1.
 */

import fs from 'fs';
import { execSync } from 'child_process';

const CONFIG = {
  local_path: 'C:/Users/sutil/documents/lib/ds_auditor',
  repo: 'romulosutil/ds_auditor',
  project_url: 'https://github.com/users/romulosutil/projects/1/views/1',
  rules_file: 'RULES.md',
  checkpoint_file: 'checkpoint.md'
};

console.log('🔍 Iniciando verificação de mapeamento 1:1:1:1...\n');

let errors = 0;

// 1. Verificar Pasta Local
if (fs.existsSync(CONFIG.local_path)) {
  console.log('✅ [1/4] Pasta Local: OK');
} else {
  console.error('❌ [1/4] Pasta Local: Não encontrada em ' + CONFIG.local_path);
  errors++;
}

// 2. Verificar Repositório GitHub
try {
  const remoteUrl = execSync('git remote get-url origin').toString().trim();
  if (remoteUrl.includes(CONFIG.repo)) {
    console.log('✅ [2/4] Repositório GitHub: OK (' + CONFIG.repo + ')');
  } else {
    console.warn('⚠️ [2/4] Repositório GitHub: Remoto difere do esperado (' + remoteUrl + ')');
  }
} catch (e) {
  console.error('❌ [2/4] Repositório GitHub: Não é um repositório git ou sem origin.');
  errors++;
}

// 3. Verificar GitHub Project (URL no RULES.md)
try {
  const rulesContent = fs.readFileSync(CONFIG.rules_file, 'utf8');
  if (rulesContent.includes(CONFIG.project_url)) {
    console.log('✅ [3/4] GitHub Project Link: OK (Vinculado no RULES.md)');
  } else {
    console.error('❌ [3/4] GitHub Project Link: Não encontrado no RULES.md');
    errors++;
  }
} catch (e) {
  console.error('❌ [3/4] GitHub Project: Erro ao ler ' + CONFIG.rules_file);
  errors++;
}

// 4. Verificar Arquivos Mandatórios
const mandatoryFiles = [CONFIG.rules_file, CONFIG.checkpoint_file, 'ARCHITECTURE.md', 'CLAUDE.md'];
let filesOk = true;
mandatoryFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.error(`❌ [4/4] Arquivo Mandatório: ${file} ausente.`);
    filesOk = false;
    errors++;
  }
});
if (filesOk) console.log('✅ [4/4] Arquivos Mandatórios: OK');

console.log('\n---');
if (errors === 0) {
  console.log('🚀 Mapeamento 1:1:1:1 INTEGRALMENTE VALIDADO.');
} else {
  console.error(`🚨 Falha na validação: ${errors} erro(s) encontrado(s).`);
  process.exit(1);
}
