# Fiscais Canoas

Consulta pública e rápida de locais, seções e páginas da lista operacional das 66ª e 134ª Zonas Eleitorais de Canoas.

Developed by AK Labs

## Problema que resolve

Operadores e fiscais podem localizar um local de votação pelo nome, endereço, bairro ou número de seção, sem percorrer manualmente a lista original.

## Público alvo

Coordenações eleitorais, fiscais, delegados de prédio e equipes de operação em campo.

## Stack

Frontend em HTML, CSS e JavaScript; produção no Cloudflare Workers com Cloudflare D1. A base SQLite local é usada apenas para a importação operacional e é ignorada pelo Git por conter contatos pessoais.

## Arquitetura

O Worker entrega os ativos públicos, consulta D1 e recebe os cadastros administrativos. A consulta nunca retorna nomes ou telefones cadastrados; ela mostra apenas a quantidade de fiscais por local. O banco D1 e a chave administrativa permanecem fora do repositório.

Registros sem seção ou local confirmado são preservados para revisão, mas não são contabilizados publicamente até receberem um vínculo válido.

## Execução local

Para execução local, use `python backend/app.py` e acesse `http://127.0.0.1:8000`. A publicação atual está em `https://fiscaiscanoas.formanditonoenem.workers.dev`; para novos deploys, use o fluxo descrito em `docs/DEPLOYMENT.md`.

## Roadmap inicial

- Adicionar revisão/versionamento da base eleitoral.
- Permitir atualização a partir de planilha validada.
- Criar painel privado para coordenação e distribuição de fiscais.
