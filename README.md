# Fiscais Canoas

Consulta pública e rápida de locais, seções e páginas da lista operacional das 66ª e 134ª Zonas Eleitorais de Canoas.

Developed by AK Labs

## Problema que resolve

Operadores e fiscais podem localizar um local de votação pelo nome, endereço, bairro ou número de seção, sem percorrer manualmente a lista original.

## Público alvo

Coordenações eleitorais, fiscais, delegados de prédio e equipes de operação em campo.

## Stack

Site estático em HTML, CSS e JavaScript. Os dados publicados ficam em `frontend/public/data.json`.

## Arquitetura

O frontend não tem dependências e carrega uma base JSON estática. O GitHub Actions publica somente `frontend/public` no GitHub Pages.

## Execução local

Abra a pasta `frontend/public` em um servidor HTTP estático, por exemplo `python -m http.server`, e acesse a porta informada.

## Roadmap inicial

- Adicionar revisão/versionamento da base eleitoral.
- Permitir atualização a partir de planilha validada.
- Criar painel privado para coordenação e distribuição de fiscais.
