# Fiscais PT Canoas

Cadastro de fiscais voluntários do PT Canoas para o 2º turno (25/10/2026).
Produção: https://fiscoptcanoas.pages.dev (Cloudflare Pages) · Painel: `/admin.html` (ADMIN_KEY)
Cadastro só por link de convite (`/?c=CÓDIGO`). Equipe entra no painel com WhatsApp + senha (inicial: iniciais do nome + 4 últimos dígitos do celular, troca obrigatória no 1º acesso); papéis: admin master, administrador e coordenador. Prints das telas em `docs/prints/`.

## Estrutura
- `src/worker.js` — API (Cloudflare Worker + D1 `fiscaiscanoas-db`)
- `src/locais.json` — locais e seções de Canoas (TSE 2026), gerado por `scripts/build_locais.py`
- `public/` — formulário (`index.html`), painel (`admin.html`) e cabeçalhos de segurança (`_headers`)
- `migrations/` — schema D1

## Comandos
```
npm run dev                                        # local (ADMIN_KEY em .dev.vars)
npx wrangler d1 migrations apply fiscaiscanoas-db --remote
npx wrangler pages secret put ADMIN_KEY --project-name fiscoptcanoas
npm run deploy -- --branch main                    # build + deploy no Pages
```

## WhatsApp automático (opcional)
Sem configuração, a confirmação é enviada pelo painel com 1 clique (wa.me).
Para envio automático no cadastro, crie um template aprovado na WhatsApp Cloud API (Meta)
com 5 variáveis no corpo (nome, zona, local, endereço, seção) e configure:
`WA_TOKEN`, `WA_PHONE_ID`, `WA_TEMPLATE` (e opcionalmente `WA_LANG`, padrão `pt_BR`) via `wrangler pages secret put --project-name fiscoptcanoas`.
