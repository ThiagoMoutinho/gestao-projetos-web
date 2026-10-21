# Regras de desenvolvimento — Sistema de Gestão de Projetos IGEPPS

## 1. Contexto e autoridade
- O sistema é desenvolvido para o Escritório de Projetos da CTIN/IGEPPS e tem como objetivo substituir integralmente o OpenProject de forma gradual e controlada.
- O usuário responsável pelo produto define as regras de negócio. O agente não pode criar, alterar ou interpretar como aprovadas regras não decididas explicitamente.
- RN-001 (alertas e cobranças de prazo) e RN-003 (cálculo ponderado de andamento) devem ser respeitadas conforme as especificações aprovadas; não implementá-las sem autorização expressa.
- Antes de editar, examinar os arquivos, os padrões e os contratos existentes. Fazer alterações incrementais e limitadas ao escopo solicitado.

## 2. Stack existente e arquitetura
- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS e shadcn/ui.
- Backend: Node.js, Fastify, TypeScript, Zod, Drizzle ORM, PostgreSQL e Better Auth.
- Reutilizar arquitetura, bibliotecas, rotas, schemas, clientes HTTP e componentes existentes. Não instalar dependências sem justificativa e aprovação.
- Não recriar componentes, endpoints ou regras que já existam.
- Preferir componentes pequenos, tipados, testáveis e com responsabilidades bem delimitadas.

## 3. shadcn/ui obrigatório no frontend
- **Sempre consultar e priorizar os componentes oficiais do shadcn/ui disponíveis no projeto.** Antes de criar qualquer UI, verificar `components.json`, os componentes locais e a versão instalada.
- Usar os componentes do shadcn/ui adequados a cada caso: Button, Input, Textarea, Label, Select, Checkbox, RadioGroup, Form/Field, Dialog, Sheet, Drawer, Tabs, Accordion, Collapsible, Card, Badge, Table, Skeleton, Tooltip, AlertDialog, ScrollArea, Separator, DropdownMenu, etc., quando disponíveis.
- Não construir visualmente controles com elementos HTML puros (`<button>`, `<input>`, `<select>`, `<textarea>`) se existir componente shadcn/ui adequado. HTML semântico é permitido para estrutura e quando não houver equivalente adequado.
- Não copiar componentes da internet sem verificar compatibilidade, acessibilidade e dependências. Usar a instalação/geração oficial compatível com o projeto quando um componente estiver ausente; explicar qualquer adição.
- Não substituir componentes shadcn/ui por bibliotecas de UI concorrentes sem autorização.
- Não editar componentes-base em `components/ui` para resolver problemas locais se composição, variantes ou classes no componente consumidor forem suficientes.
- Manter tokens de tema, variantes, estados, espaçamentos, tipografia e estilos consistentes. Evitar valores arbitrários e CSS inline sem necessidade.
- Utilizar ícones da biblioteca já adotada (preferencialmente Lucide), com tamanho e alinhamento consistentes.
- Em toda entrega de frontend, listar os componentes shadcn/ui utilizados e justificar os controles nativos ou personalizados inevitáveis.

## 4. Experiência de usuário e design
- Preservar a identidade visual institucional do IGEPPS, sidebar, cabeçalho, tipografia e layouts aprovados. Não redesenhar telas sem solicitação.
- A listagem de projetos é executiva: destacar situação, saúde, prazos, pendências e atualizações, sem excesso de colunas.
- A EAP deve ser compacta e hierárquica (fases, tarefas e marcos). Exibir somente informações operacionais essenciais; detalhes adicionais no painel lateral.
- Edição rápida de tarefas deve iniciar recolhida, expandir mediante ação do usuário e permitir salvar/cancelar sem sair da EAP.
- Usar Sheet no desktop para edição contextual e avaliar Drawer no mobile, conforme usabilidade. Manter ações acessíveis em rodapé fixo quando o conteúdo for longo.
- Evitar repetição de datas; destacar prazo vigente. Linha de base, datas realizadas e demais campos ficam em seção de detalhes, sem serem removidos dos dados.
- Exibir estado vazio, carregamento, erro, sucesso e ausência de permissão de forma clara; não inventar dados para preencher a interface.

## 5. Transições suaves — regra permanente
- Toda navegação e interação deve ter transições suaves, discretas e consistentes; não usar trocas bruscas de conteúdo.
- Preservar sidebar e cabeçalho entre rotas, sem piscar ou remontar desnecessariamente.
- Priorizar transições de opacidade e deslocamento sutil (~180–250 ms), microinterações (~120–180 ms), e Skeleton durante carregamentos reais.
- Usar padrões compatíveis com Next.js App Router; evitar erros de hidratação, animações excessivas, delays artificiais e saltos de layout.
- Respeitar `prefers-reduced-motion`, navegação por teclado, foco, rótulos e contraste.
- Não adicionar biblioteca de animação sem necessidade demonstrada e autorização.

## 6. Formulários e alterações
- Usar componentes shadcn/ui com validação tipada e Zod conforme padrões já existentes.
- Exibir mensagens de erro por campo, feedback de envio e estados de botão adequados.
- Proteger alterações não salvas ao trocar de item, fechar painel ou navegar.
- Não atualizar o estado visual como sucesso antes da confirmação da API; em erro, preservar o preenchimento.
- Não permitir edição direta de datas planejadas protegidas, linha de base ou percentuais consolidados.
- Fornecedor/PO atualiza execução; reprogramações, pesos, homologações e aceite seguem as permissões e regras específicas.

## 7. Segurança, dados e integrações
- Reutilizar Better Auth e RBAC existentes; autorizar no backend, não apenas ocultar controles no frontend.
- Não expor projetos de outros usuários, segredos, tokens ou dados institucionais indevidos.
- Não executar seed, reset, limpeza, migration ou integração externa sem pedido explícito.
- Dados fictícios devem ficar restritos ao desenvolvimento e nunca disparar notificações ou e-mails reais.
- Não alterar esquema, endpoints, contratos, autenticação ou permissões fora do escopo aprovado.
- Respeitar trilha de auditoria, histórico, justificativas e evidências; não apagar histórico para simplificar UI.

## 8. Qualidade e entrega
- Antes de implementar: resumir entendimento, arquivos afetados, componentes shadcn/ui previstos, contratos reutilizados e riscos.
- Alterar o mínimo necessário; não misturar refatorações amplas com funcionalidades pequenas.
- Escrever TypeScript tipado; evitar `any`, duplicação, lógica de negócio no componente e tratamento silencioso de erros.
- Manter cálculos e regras críticas no backend, com testes automatizados e comportamento determinístico.
- Rodar os testes, lint, typecheck e build pertinentes quando disponíveis; reportar comandos e resultados reais, sem afirmar testes não executados.
- Após implementar: apresentar arquivos modificados, componentes shadcn/ui utilizados, comportamento entregue, validações, limitações e decisões pendentes.
- Se a solicitação disser 'analisar', 'especificar' ou 'sem implementar', não editar código, não criar migrations e não executar comandos que alterem dados.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
