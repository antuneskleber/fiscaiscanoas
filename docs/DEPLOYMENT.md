# Publicação com banco de dados

O GitHub Pages não é adequado para esta versão, porque ele não executa a API nem hospeda a base SQLite. Publique o contêiner em um serviço com volume persistente e HTTPS.

## Requisitos

- Variável `FISCAIS_ADMIN_TOKEN` com uma chave administrativa forte.
- Volume persistente montado em `/app/backend/storage`.
- Proxy HTTPS na frente da aplicação.

## Execução com contêiner

```text
docker build -t fiscaiscanoas .
docker run -p 8000:8000 -e FISCAIS_ADMIN_TOKEN=troque-esta-chave -v fiscaiscanoas-data:/app/backend/storage fiscaiscanoas
```

Developed by AK Labs
