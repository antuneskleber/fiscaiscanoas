// Monta dist/ para o Cloudflare Pages: arquivos de public/ + _worker.js (modo avançado).
import { cpSync, rmSync, writeFileSync } from "node:fs";
rmSync("dist", { recursive: true, force: true });
cpSync("public", "dist", { recursive: true });
writeFileSync("dist/_worker.js", 'export { default } from "../src/worker.js";\n');
writeFileSync("dist/_routes.json", JSON.stringify({ version: 1, include: ["/api/*"], exclude: [] }));
console.log("dist/ pronto");
