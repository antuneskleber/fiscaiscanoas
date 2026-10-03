# Changelog

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
