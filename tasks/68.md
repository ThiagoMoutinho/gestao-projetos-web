## **Autorização — Organização e Versionamento do Git**

Aprovo o plano de organização dos repositórios `gestao-projetos-api` e `gestao-projetos-web`, com as decisões abaixo.

### **1. Regras de negócio confirmadas**

**Homologação:**
- PMO e COORDENADOR podem homologar marcos de todos os projetos.
- Gestores homologam conforme seu vínculo e permissões.
- ADMIN não recebe permissão de homologação automaticamente.
- A autoaprovação continua proibida.

**Datas automáticas das fases:**
- Autorizo que as datas das fases sejam recalculadas quando a exclusão de tarefas ou marcos alterar seus limites.
- Preservar as datas anteriores no histórico.
- Identificar a alteração como automática, com sua origem e justificativa.
- Não modificar fases concluídas.
- Não apagar o histórico de reprogramações.
- Se essas garantias não estiverem implementadas, interromper o versionamento desse bloco e apresentar o problema antes de alterar o código.

### **2. Arquivos e configurações**

- Criar `.gitattributes` nos dois repositórios para padronizar LF, verificando antes o impacto sobre arquivos existentes.
- Não incluir `tasks/imagem/` nos commits.
- Preservar os arquivos dessa pasta localmente, sem apagá-los.
- Versionar `tasks/*.md` e os arquivos de configuração necessários.
- Preservar as migrations 0017 a 0025 e seus snapshots.
- Incluir os arquivos gerados pelo Orval necessários à compilação.

### **3. Estratégia dos commits**

Utilizar blocos funcionais, priorizando estabilidade e facilidade de recuperação.

**API:**
1. Configuração de fim de linha.
2. Regras da EAP, homologação e cronograma.
3. Perfil institucional, resultados, widgets, evidências e GLPI, mantendo as migrations na sequência correta.

**Frontend:**
1. Configuração de fim de linha.
2. Design System e editor rico.
3. EAP, Visão Geral, widgets, institucional, evidências e GLPI, agrupando dependências inseparáveis.
4. Configurações, testes E2E e documentos.

Se algum agrupamento não compilar isoladamente, reorganizar os commits antes de executá-los. Não criar commits intermediários quebrados apenas para manter a quantidade planejada.

### **4. Segurança**

Antes de qualquer commit:

- Criar cópia de segurança dos dois repositórios, incluindo arquivos não rastreados relevantes, sem `node_modules`, `.env`, credenciais ou backups do PostgreSQL.
- Confirmar a integridade das cópias.
- Não executar migrations.
- Não modificar o banco de dados.
- Não executar `git reset --hard`, `git clean` ou descarte de alterações.
- Não executar `git push`.
- Não alterar produção.

### **5. Execução e validação**

Autorizo realizar os commits locais após as verificações de segurança.

- Utilizar mensagens descritivas no padrão já adotado.
- Validar typecheck e testes em cada ponto tecnicamente consistente, preferencialmente em worktree isolado.
- Confirmar que nenhum arquivo necessário ficou de fora.
- Preservar todo o código e os dados existentes.

### **6. Relatório final**

Ao concluir, informar:

1. Commits criados em cada repositório, com hash e descrição.
2. Arquivos deliberadamente não versionados.
3. Resultados dos testes e builds.
4. Situação final do `git status` nos dois repositórios.
5. Eventuais pendências ou riscos.

Não executar push nem modificar produção.

Economize tokens e apresente um relatório objetivo.