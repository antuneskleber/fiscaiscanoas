# Publicação no Cloudflare

A versão hospedada usa Cloudflare Workers para a API e Cloudflare D1 para os cadastros. O banco local SQLite e qualquer arquivo de segredo não devem ser enviados ao Git.

## Pré-requisitos

- Conta Cloudflare autenticada pelo perfil de CLI ativo.
- Base D1 vinculada como `DB` em `wrangler.jsonc` e `cloudflare.config.ts`.
- Um arquivo `.env` local e ignorado pelo Git com `ADMIN_TOKEN=<chave forte>`.

## Fluxo de publicação

1. Aplique as migrações de `migrations/` na base D1 vinculada.
2. Rode a validação local: `python tests/validate_data.py` e `python tests/validate_backend.py`.
3. Faça uma simulação: `wrangler deploy --dry-run`.
4. Publique com `wrangler deploy --secrets-file <arquivo-env>`.
5. Verifique `/`, `/api/locations` e a proteção de `POST /api/assignments`.

A chave administrativa é obrigatória para gravar ou editar cadastros e nunca deve ser disponibilizada no link público.

Developed by AK Labs
