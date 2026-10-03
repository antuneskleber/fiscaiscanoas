# Publicação no Cloudflare

A versão hospedada usa Cloudflare Workers para a API e Cloudflare D1 para os cadastros. O banco local SQLite não deve ser enviado ao Git.

## Pré-requisitos

- Conta Cloudflare autenticada pelo perfil de CLI ativo.
- Base D1 vinculada como `DB` em `wrangler.jsonc` e `cloudflare.config.ts`.

## Fluxo de publicação

1. Aplique as migrações de `migrations/` na base D1 vinculada.
2. Rode a validação local: `python tests/validate_data.py` e `python tests/validate_backend.py`.
3. Faça uma simulação: `wrangler deploy --dry-run`.
4. Publique com `wrangler deploy`.
5. Verifique `/`, `/api/locations`, `/api/fiscals` e o envio do formulário em `POST /api/assignments`.

O cadastro é público e não usa chave administrativa. Antes de divulgar o formulário amplamente, configure Turnstile para reduzir envios automatizados sem exigir identificação dos usuários.

Developed by AK Labs
