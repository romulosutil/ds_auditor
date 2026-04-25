# DS Auditor — Regras Operacionais

## Mapeamento 1:1:1:1 (Vínculo Obrigatório)
- **Pasta Local**: `C:\Users\sutil\Documents\lib\ds_auditor`
- **GitHub Repo**: [romulosutil/ds_auditor](https://github.com/romulosutil/ds_auditor)
- **GitHub Project**: [@romulosutil Pipe (Kanban)](https://github.com/users/romulosutil/projects/1/views/1)
- **Obsidian Brain**: `02_Areas/ds_auditor/RULES.md`

---

## 🛡️ Protocolo de Validação (Kanban: Validation)
Todo card que entrar na coluna **Validation** deve seguir este rito pela IA:
1. **Automático**: A IA deve buscar e executar todos os scripts de teste disponíveis.
2. **Manual**: Caso a validação exija interação humana, a IA **deve parar** e adicionar um comentário no card do GitHub Project com o título "**Manual Test Guide**".

---

## Objetivo
Auditoria de consistência em Design Systems.