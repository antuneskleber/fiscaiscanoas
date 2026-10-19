# Fiscais PT Canoas

Cadastro de fiscais voluntários do PT Canoas para o 2º turno (25/10/2026).
Produção: https://fiscaiscanoas.aklabs.workers.dev · Painel: `/admin.html`

## Estrutura
- `src/worker.js` — API (Cloudflare Worker + D1 `fiscaiscanoas-db`)
- `src/locais.json` — locais e seções de Canoas (TSE 2026), gerado por `scripts/build_locais.py`
- `public/` — formulário (`index.html`) e painel da coordenação (`admin.html`)
- `migrations/` — schema D1

## Comandos
```
npx wrangler dev                                   # local (ADMIN_KEY em .dev.vars)
npx wrangler d1 migrations apply fiscaiscanoas-db --remote
npx wrangler secret put ADMIN_KEY                  # chave do painel
npx wrangler deploy
```

## WhatsApp automático (opcional)
Sem configuração, a confirmação é enviada pelo painel com 1 clique (wa.me).
Para envio automático no cadastro, crie um template aprovado na WhatsApp Cloud API (Meta)
com 5 variáveis no corpo (nome, zona, local, endereço, seção) e configure:
`WA_TOKEN`, `WA_PHONE_ID`, `WA_TEMPLATE` (e opcionalmente `WA_LANG`, padrão `pt_BR`) via `wrangler secret put`.
