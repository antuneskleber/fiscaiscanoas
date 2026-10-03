# Fiscais Canoas

Consulta pública e rápida de locais, seções e páginas da lista operacional das 66ª e 134ª Zonas Eleitorais de Canoas.

Developed by AK Labs

## Problema que resolve

Operadores e fiscais podem localizar um local de votação pelo nome, endereço, bairro ou número de seção, sem percorrer manualmente a lista original.

## Público alvo

Coordenações eleitorais, fiscais, delegados de prédio e equipes de operação em campo.

## Stack

Frontend em HTML, CSS e JavaScript e API em Python sem dependências externas. A base SQLite é criada em `backend/storage/fiscaiscanoas.sqlite3` e é ignorada pelo Git por conter contatos pessoais.

## Arquitetura

O servidor inicializa a base a partir de `frontend/public/data.json`, entrega a consulta pública e recebe os cadastros administrativos. A consulta nunca retorna nomes ou telefones cadastrados; ela mostra apenas a quantidade de fiscais por local. A publicação requer hospedagem de aplicação com volume persistente; GitHub Pages não executa esta API.

Registros sem seção ou local confirmado são preservados para revisão, mas não são contabilizados publicamente até receberem um vínculo válido.

## Execução local

Execute `python backend/app.py` e acesse `http://127.0.0.1:8000`. Para operação fora da máquina local, defina `FISCAIS_ADMIN_TOKEN` e publique atrás de HTTPS; sem esse token, novos cadastros são aceitos somente por localhost. Veja `docs/DEPLOYMENT.md` para a publicação em contêiner.

## Roadmap inicial

- Adicionar revisão/versionamento da base eleitoral.
- Permitir atualização a partir de planilha validada.
- Criar painel privado para coordenação e distribuição de fiscais.
