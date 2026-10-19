import LOCAIS from "./locais.json";

const DATA_ELEICAO = "2026-10-25";
const LOCAL_POR_CHAVE = new Map(LOCAIS.map(l => [`${l.zona}:${l.id}`, l]));

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });

const texto = v => String(v ?? "").trim().replace(/\s+/g, " ");
const soDigitos = v => String(v ?? "").replace(/\D/g, "");

// Aceita (51) 99999-9999, 5551999999999 etc. Guarda sempre como 55 + DDD + número.
function normalizarTelefone(v) {
  let d = soDigitos(v);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  return "55" + d;
}

// Envio automático pela WhatsApp Cloud API (Meta). Só roda se os secrets
// WA_TOKEN, WA_PHONE_ID e WA_TEMPLATE estiverem configurados; o template aprovado
// deve ter 5 variáveis no corpo: nome, zona, local, endereço, seção.
async function enviarConfirmacaoApi(env, id, f, local) {
  if (!env.WA_TOKEN || !env.WA_PHONE_ID || !env.WA_TEMPLATE) return;
  const params = [f.nome.split(" ")[0], String(f.zona), local.nome, `${local.endereco} - ${local.bairro}`, f.secao ? String(f.secao) : "qualquer seção do local"];
  const r = await fetch(`https://graph.facebook.com/v21.0/${env.WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.WA_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to: f.telefone, type: "template",
      template: { name: env.WA_TEMPLATE, language: { code: env.WA_LANG || "pt_BR" },
        components: [{ type: "body", parameters: params.map(text => ({ type: "text", text })) }] },
    }),
  });
  if (!r.ok) { console.error("WhatsApp API", r.status, await r.text()); return; }
  await env.DB.prepare("UPDATE fiscais SET confirmado_em = ?, confirmado_via = 'api' WHERE id = ?").bind(new Date().toISOString(), id).run();
}

async function chaveConfere(chave, enviada) {
  if (!chave || !enviada) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(chave)),
    crypto.subtle.digest("SHA-256", enc.encode(enviada)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

// ADMIN_KEY: coordenação (tudo). CONSULTA_KEY: só leitura (página de consulta).
async function perfil(request, env) {
  const enviada = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (await chaveConfere(env.ADMIN_KEY, enviada)) return "admin";
  if (await chaveConfere(env.CONSULTA_KEY, enviada)) return "leitura";
  return null;
}

async function ocupacao(env) {
  const { results } = await env.DB.prepare("SELECT zona, local_id, secao FROM fiscais").all();
  const secoes = {};   // "zona:secao" -> true
  const porLocal = {}; // "zona:local_id" -> total de fiscais
  for (const r of results) {
    const k = `${r.zona}:${r.local_id}`;
    porLocal[k] = (porLocal[k] || 0) + 1;
    if (r.secao != null) secoes[`${r.zona}:${r.secao}`] = true;
  }
  return { secoes, porLocal };
}

async function cadastrar(request, env, ctx) {
  let p;
  try { p = await request.json(); } catch { return json({ error: "Requisição inválida." }, 400); }
  if (p.site) return json({ ok: true }, 201); // honeypot

  const nome = texto(p.nome);
  const telefone = normalizarTelefone(p.telefone);
  const zona = Number(p.zona);
  const local = LOCAL_POR_CHAVE.get(`${zona}:${Number(p.local_id)}`);
  const secao = p.secao === "" || p.secao == null ? null : Number(p.secao);

  if (nome.length < 5 || !nome.includes(" ")) return json({ error: "Informe seu nome completo." }, 400);
  if (!telefone) return json({ error: "Informe um WhatsApp válido com DDD." }, 400);
  if (!local) return json({ error: "Escolha a zona e o local de votação." }, 400);
  if (secao !== null && !local.secoes.includes(secao)) return json({ error: "Seção não pertence a este local." }, 400);

  try {
    const { meta } = await env.DB.prepare(
      "INSERT INTO fiscais (nome, telefone, zona, local_id, local_nome, secao, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(nome, telefone, zona, local.id, local.nome, secao, new Date().toISOString()).run();
    ctx.waitUntil(enviarConfirmacaoApi(env, meta.last_row_id, { nome, telefone, zona, secao }, local).catch(console.error));
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes("fiscais.telefone")) return json({ error: "Este WhatsApp já está cadastrado. Fale com a coordenação para alterar." }, 409);
    if (msg.includes("fiscais.zona")) return json({ error: `A seção ${secao} já tem fiscal. Escolha outra ou "qualquer seção".` }, 409);
    throw e;
  }
  return json({ ok: true, local: local.nome, endereco: local.endereco, bairro: local.bairro, zona, secao }, 201);
}

async function admin(request, env, url) {
  const quem = await perfil(request, env);
  if (!quem) return json({ error: "Chave de acesso inválida." }, 401);
  const id = Number(url.pathname.split("/")[4]);

  if (request.method === "GET") {
    const { results } = await env.DB.prepare("SELECT * FROM fiscais ORDER BY zona, local_nome, secao, nome").all();
    return json(results, 200, { "x-perfil": quem });
  }
  if (quem !== "admin") return json({ error: "Chave de consulta não permite alterações." }, 403);

  // Cadastro feito pela coordenação (mesmas regras do formulário público).
  if (request.method === "POST" && !id) return cadastrar(request, env, { waitUntil() {} });

  // Marca/desmarca a confirmação enviada manualmente pelo painel.
  if (request.method === "POST" && id && url.pathname.endsWith("/confirmado")) {
    const { enviado = true } = await request.json().catch(() => ({}));
    await env.DB.prepare("UPDATE fiscais SET confirmado_em = ?, confirmado_via = ? WHERE id = ?")
      .bind(enviado ? new Date().toISOString() : null, enviado ? "manual" : null, id).run();
    return json({ ok: true });
  }

  if (request.method === "DELETE" && id) {
    await env.DB.prepare("DELETE FROM fiscais WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  if (request.method === "PUT" && id) {
    const p = await request.json();
    const local = LOCAL_POR_CHAVE.get(`${Number(p.zona)}:${Number(p.local_id)}`);
    const telefone = normalizarTelefone(p.telefone);
    const secao = p.secao === "" || p.secao == null ? null : Number(p.secao);
    if (!local || !telefone || texto(p.nome).length < 3) return json({ error: "Dados inválidos." }, 400);
    if (secao !== null && !local.secoes.includes(secao)) return json({ error: "Seção não pertence a este local." }, 400);
    try {
      await env.DB.prepare(
        "UPDATE fiscais SET nome = ?, telefone = ?, zona = ?, local_id = ?, local_nome = ?, secao = ? WHERE id = ?"
      ).bind(texto(p.nome), telefone, local.zona, local.id, local.nome, secao, id).run();
    } catch (e) {
      return json({ error: "Telefone ou seção já usados por outro fiscal." }, 409);
    }
    return json({ ok: true });
  }

  return json({ error: "Método não suportado." }, 405);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      if (pathname === "/api/locais" && request.method === "GET") {
        return json({ data: DATA_ELEICAO, locais: LOCAIS, ...(await ocupacao(env)) });
      }
      if (pathname === "/api/cadastro" && request.method === "POST") return cadastrar(request, env, ctx);
      if (pathname.startsWith("/api/admin/fiscais")) return admin(request, env, url);
      if (pathname.startsWith("/api/")) return json({ error: "Não encontrado." }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: "Erro interno. Tente novamente." }, 500);
    }

    return env.ASSETS.fetch(request);
  },
};
