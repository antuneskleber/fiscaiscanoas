# Fiscais Canoas

Consulta pública e rápida de fiscais por local ou nome, para as 66ª e 134ª Zonas Eleitorais de Canoas.

Developed by AK Labs

## Problema que resolve

Operadores e fiscais podem buscar pelo local ou pelo nome do fiscal, encontrando imediatamente o contato e o local associado sem percorrer manualmente a lista original.

## Público alvo

Coordenações eleitorais, fiscais, delegados de prédio e equipes de operação em campo.

## Stack

Frontend em HTML, CSS e JavaScript; produção no Cloudflare Workers com Cloudflare D1. A base SQLite local é usada apenas para a importação operacional e é ignorada pelo Git por conter contatos pessoais.

## Arquitetura

O Worker entrega os ativos públicos, consulta D1 e recebe cadastros abertos. A busca pública retorna nome, telefone e local de cada fiscal, conforme a autorização de publicidade informada pela coordenação. O banco D1 permanece fora do repositório.

As seções ainda não foram definidas: os novos cadastros ficam associados ao local e identificados como pendentes de seção.

## Execução local

Para execução local, use `python backend/app.py` e acesse `http://127.0.0.1:8000`. A publicação atual está em `https://fiscaiscanoas.formanditonoenem.workers.dev`; para novos deploys, use o fluxo descrito em `docs/DEPLOYMENT.md`.

## Roadmap inicial

- Adicionar revisão/versionamento da base eleitoral.
- Permitir atualização a partir de planilha validada.
- Criar painel privado para coordenação e distribuição de fiscais.
