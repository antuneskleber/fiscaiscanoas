# Changelog

## 1.3.0 - 2026-10-19

- Login da equipe por WhatsApp + senha (migração `0005_equipe_login.sql`), com sessão de 12 h, bloqueio de 15 min após 5 senhas erradas e registro em Acessos. A `ADMIN_KEY` continua valendo como chave mestra de emergência.
- Senha inicial = iniciais do nome (sem da/de/do/das/dos/e) + 4 últimos dígitos do celular; troca obrigatória no primeiro acesso (mínimo 8 caracteres, não só números).
- Três papéis: admin master (gerencia a equipe), administrador (lista completa, aprovação, impressão e exportação) e coordenador (só os próprios indicados). Aba Equipe substitui a de Coordenadores; coordenador ganha a aba "Meu link de convite".
- Links de convite sempre com o endereço oficial `https://fiscoptcanoas.pages.dev`.
- Admins master em produção: Kleber Antunes e Graziele Bica.
- Prints de todas as telas em `docs/prints/` (dados fictícios).

## 1.2.0 - 2026-10-19

- Cadastro somente por convite: cada coordenador tem um link pessoal (`/?c=CÓDIGO`); o fiscal entra como "pendente" até ser aprovado por quem indicou (migração `0004_coordenadores.sql`).
- CPF obrigatório no cadastro, com validação dos dígitos e sem duplicidade.
- Painel com dois perfis: coordenação geral (`ADMIN_KEY`) e coordenador (chave pessoal gerada no painel), que vê só os próprios indicados, com CPF mascarado, e apenas aprova ou recusa.
- Nova aba Coordenadores (criar, copiar link de convite, gerar nova chave, desativar) e aba Acessos (registro de quem abriu, alterou ou exportou a lista).
- Proteção de dados: removida a página `/consulta.html` e a `CONSULTA_KEY`; mensagens de erro não revelam se um CPF ou WhatsApp já está cadastrado; cabeçalhos de segurança (`public/_headers`); saída automática do painel após 30 min sem uso; página 404.
- Mensagem por WhatsApp passa a ser enviada só após a aprovação; removido o botão de autoconfirmação da tela de sucesso.

## 1.1.0 - 2026-10-19

- Nova página `/consulta.html` (modo leitura e busca do sistema antigo): cards por local com zona, endereço (link para o mapa), seções, fiscais e botões Ligar/WhatsApp; abas Todos / Com fiscal / Sem fiscal / Zona; busca sem acento por local, bairro, seção ou nome. Protegida pela chave só de leitura `CONSULTA_KEY`.
- Painel: botão "+ Cadastrar fiscal" (cadastro manual pela coordenação), botão de ligar e busca sem acento.
- Worker antigo `fiscaiscanoas.aklabs.workers.dev` excluído.

- Site movido para o Cloudflare Pages em https://fiscoptcanoas.pages.dev (sem o subdomínio AKLabs). Build em `scripts/build.mjs` gera `dist/` com `_worker.js`; o mesmo D1 `fiscaiscanoas-db` continua em uso.
- Removida a tabela antiga `assignments` (47 cadastros do sistema anterior), a pedido da coordenação. Restauração possível via D1 Time Travel até 18/11/2026 (bookmark `00000013-00000000-00005109-4eda8a42a95ab25ebb948425c894e57e`).

## 1.0.0 - 2026-10-19

Reconstrução completa para o cadastro de fiscais voluntários do 2º turno (25/10/2026).

- Novo formulário público mobile-first: nome completo, WhatsApp, zona (66/134), local de votação e seção (ou "qualquer seção do local").
- Locais e seções gerados do CSV oficial do TSE 2026 (`scripts/build_locais.py` → `src/locais.json`): 90 locais, 759 seções.
- Nova tabela D1 `fiscais` (migração `0002_fiscais.sql`) com WhatsApp único e uma seção por fiscal; a tabela antiga `assignments` foi preservada.
- A página pública não expõe mais nomes e telefones; mostra apenas seções já ocupadas e totais.
- Painel `/admin.html` protegido pelo secret `ADMIN_KEY`: métricas de cobertura, lista de fiscais, cobertura por local, edição, exclusão, exportação CSV e lista para WhatsApp.
- Confirmação por WhatsApp: botão "Salvar confirmação no meu WhatsApp" na tela de sucesso; no painel, envio com 1 clique (wa.me) e fila "Enviar próxima confirmação", com controle de enviadas (migração `0003_confirmacao.sql`). Envio automático opcional pela WhatsApp Cloud API (secrets `WA_TOKEN`, `WA_PHONE_ID`, `WA_TEMPLATE`).
- Aba Relatórios no painel: resumo por zona, cadastros por dia, locais sem fiscal, relatório por local para imprimir/PDF, TXT no formato antigo, CSV de fiscais, CSV de seções sem fiscal e lista para WhatsApp.
- Worker movido para `src/worker.js` e assets para `public/`; SQLs avulsos antigos movidos para `legacy/` para não serem aplicados como migração.

## 0.4.7 - 2026-10-03

- Desduplicação do fiscal Luiz Carlos da Silva, unificando seus dois números de telefone (`(51) 99129-534 / (51) 99180-0882`) com botões dedicados de ligação e WhatsApp para cada linha.
- Remoção do termo/rótulo "Fiscais Volantes", exibindo apenas o bairro correspondente (ex.: "Harmonia e Mathias", "Harmonia e Rio Branco").
- Atualização cadastral dos telefones de Vani, Marton Lampert, Kelen, Norberto Tombosi, Sara e Humberto.
- Inclusão da nova fiscal Graziele Bica na EMEF Guajuviras.
- Suporte a múltiplos telefones na interface pública e no Painel Administrativo.

## 0.4.6 - 2026-10-03

- Telefone / WhatsApp agora é opcional no formulário de cadastro e edição no Painel Admin.
- Adicionado botão de "Exportar TXT" e cópia de lista na formatação exata (Escola, Fiscal e Telefone com quebras de linha duplas).

## 0.4.5 - 2026-10-03

- Integração total dos locais de fiscalização (Escola Guarani, Escola Irmão Miguel, Harmonia / Luterano, Fiscais Volantes) como cards oficiais com seus respectivos endereços e fiscais escalados.
- Remoção definitiva da caixa de alerta de locais a confirmar.

## 0.4.4 - 2026-10-03

- Remoção do botão de admin e de botões de cadastro da página pública, mantendo apenas a exibição limpa do local, endereço, seções e fiscais alocados.
- Endereço simplificado para focar na localização (removida a indicação de página do PDF).

## 0.4.3 - 2026-10-03

- Implementação do Painel Administrativo completo em `/admin.html` com métricas, gestão de fiscais (edição, exclusão), filtros em tempo real e exportação (CSV e WhatsApp).
- Adicionados endpoints REST para atualização (PUT) e exclusão (DELETE) de fiscais no Cloudflare Worker.

## 0.4.2 - 2026-10-03

- Exibição direta dos fiscais, nomes, contatos e botões de chamada/WhatsApp em cada card de escola.
- Filtros rápidos por abas: Todos, Com Fiscal, Sem Fiscal e A Confirmar.
- Ações rápidas para escalar ou adicionar fiscais pré-selecionando o local no cadastro.

## 0.4.1 - 2026-10-03

- Migração da publicação e da base D1 para a conta AKLabs, em `fiscaiscanoas.aklabs.workers.dev`.

## 0.4.0 - 2026-10-03

- Busca pública por local ou nome do fiscal, mostrando local, contato e situação da seção.
- Cadastro aberto sem chave administrativa; local, nome e telefone podem ser incluídos antes da definição das seções.

## 0.3.3 - 2026-10-03

- Interface otimizada para uso predominante em celulares: controles maiores, tipografia sem zoom automático e suporte a áreas seguras de tela.

## 0.3.2 - 2026-10-03

- Preparação da base D1 para publicação no Cloudflare, com migração versionada e telemetria do Worker habilitada.

## 0.3.1 - 2026-10-03

- Inclusão de quatro cadastros adicionais, todos vinculados a locais oficiais.

## 0.3.0 - 2026-10-03

- Importação de lista existente de fiscais para a base operacional.
- Cadastro passa a aceitar seção e telefone não informados, preservando registros que precisam de revisão.
- Vínculo de dados incompletos ao local fica opcional, evitando associação automática incorreta.

## 0.2.0 - 2026-10-03

- Cadastro operacional de fiscal com local, seção, nome e telefone.
- Base SQLite local com validação de local e seção.
- Consulta pública passa a usar a API e mostra somente a cobertura por local, sem expor dados pessoais.

## 0.1.0 - 2026-10-03

- Lançamento inicial da consulta de 87 locais e 755 seções eleitorais de Canoas.
- Busca por escola, endereço, bairro, zona e seção.
- Referência da página original para cada local.
- Estrutura pronta para publicação via GitHub Pages.

Developed by AK Labs
