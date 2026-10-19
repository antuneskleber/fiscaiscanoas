import LOCAIS from "./locais.json";

const DATA_ELEICAO = "2026-10-25";
const LOCAL_POR_CHAVE = new Map(LOCAIS.map(l => [`${l.zona}:${l.id}`, l]));
const STATUS = ["pendente", "aprovado", "recusado"];

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

// Retorna o CPF só com dígitos se os dígitos verificadores conferem.
function normalizarCpf(v) {
  const d = soDigitos(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return null;
  for (const t of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(d[i]) * (t + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(d[t])) return null;
  }
  return d;
}

const mascararCpf = c => c ? `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**` : null;

async function sha256(v) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function aleatorio(n, alfabeto = "abcdefghjkmnpqrstuvwxyz23456789") {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return [...bytes].map(b => alfabeto[b % alfabeto.length]).join("");
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

// Quem está chamando a API administrativa:
//   { tipo: "admin" }              — ADMIN_KEY, coordenação geral
//   { tipo: "coord", id, nome }    — chave pessoal de um coordenador ativo
async function perfil(request, env) {
  const enviada = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!enviada) return null;
  const h = await sha256(enviada);
  const enc = new TextEncoder();
  if (env.ADMIN_KEY && crypto.subtle.timingSafeEqual(enc.encode(h), enc.encode(await sha256(env.ADMIN_KEY)))) {
    return { tipo: "admin", nome: "Coordenação geral" };
  }
  const c = await env.DB.prepare("SELECT id, nome FROM coordenadores WHERE chave_hash = ? AND ativo = 1").bind(h).first();
  return c ? { tipo: "coord", id: c.id, nome: c.nome } : null;
}

async function registrarAcesso(env, request, quem, acao) {
  await env.DB.prepare("INSERT INTO acessos (quem, acao, ip, em) VALUES (?, ?, ?, ?)")
    .bind(quem.nome, acao, request.headers.get("cf-connecting-ip"), new Date().toISOString()).run();
}

async function ocupacao(env) {
  const { results } = await env.DB.prepare("SELECT zona, local_id, secao FROM fiscais WHERE status != 'recusado'").all();
  const secoes = {};   // "zona:secao" -> true
  const porLocal = {}; // "zona:local_id" -> total de fiscais
  for (const r of results) {
    const k = `${r.zona}:${r.local_id}`;
    porLocal[k] = (porLocal[k] || 0) + 1;
    if (r.secao != null) secoes[`${r.zona}:${r.secao}`] = true;
  }
  return { secoes, porLocal };
}

async function convite(env, codigo) {
  if (!/^[a-z0-9]{4,16}$/.test(codigo || "")) return null;
  return env.DB.prepare("SELECT id, nome FROM coordenadores WHERE codigo = ? AND ativo = 1").bind(codigo).first();
}

// Valida e grava um fiscal. Usado pelo formulário público (com convite) e pela coordenação geral.
async function inserirFiscal(env, p, { coordenadorId, status }) {
  const nome = texto(p.nome);
  const cpf = normalizarCpf(p.cpf);
  const telefone = normalizarTelefone(p.telefone);
  const zona = Number(p.zona);
  const local = LOCAL_POR_CHAVE.get(`${zona}:${Number(p.local_id)}`);
  const secao = p.secao === "" || p.secao == null ? null : Number(p.secao);

  if (nome.length < 5 || !nome.includes(" ")) return { erro: json({ error: "Informe o nome completo." }, 400) };
  if (!cpf) return { erro: json({ error: "CPF inválido. Confira os números." }, 400) };
  if (!telefone) return { erro: json({ error: "Informe um WhatsApp válido com DDD." }, 400) };
  if (!local) return { erro: json({ error: "Escolha a zona e o local de votação." }, 400) };
  if (secao !== null && !local.secoes.includes(secao)) return { erro: json({ error: "Seção não pertence a este local." }, 400) };

  try {
    const { meta } = await env.DB.prepare(
      "INSERT INTO fiscais (nome, cpf, telefone, zona, local_id, local_nome, secao, criado_em, coordenador_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(nome, cpf, telefone, zona, local.id, local.nome, secao, new Date().toISOString(), coordenadorId, status).run();
    return { id: meta.last_row_id, nome, telefone, zona, secao, local };
  } catch (e) {
    const msg = String(e?.message || e);
    // Mensagem neutra: não confirma se um CPF ou número já está na lista.
    if (msg.includes("fiscais.telefone") || msg.includes("fiscais.cpf")) {
      return { erro: json({ error: "Não foi possível concluir o cadastro com estes dados. Fale com quem indicou você." }, 409) };
    }
    if (msg.includes("fiscais.zona")) return { erro: json({ error: `A seção ${secao} já tem fiscal. Escolha outra ou "qualquer seção".` }, 409) };
    throw e;
  }
}

async function cadastrar(request, env) {
  let p;
  try { p = await request.json(); } catch { return json({ error: "Requisição inválida." }, 400); }
  if (p.site) return json({ ok: true }, 201); // honeypot

  const coord = await convite(env, String(p.convite || "").toLowerCase());
  if (!coord) return json({ error: "Link de convite inválido. Peça o link ao coordenador que indicou você." }, 403);

  const r = await inserirFiscal(env, p, { coordenadorId: coord.id, status: "pendente" });
  if (r.erro) return r.erro;
  return json({ ok: true, local: r.local.nome, endereco: r.local.endereco, bairro: r.local.bairro, zona: r.zona, secao: r.secao, coordenador: coord.nome.split(" ")[0] }, 201);
}

async function coordenadores(request, env, url, quem) {
  if (quem.tipo !== "admin") return json({ error: "Acesso negado." }, 403);
  const partes = url.pathname.split("/");
  const id = Number(partes[4]);

  if (request.method === "GET") {
    const { results } = await env.DB.prepare(`
      SELECT c.id, c.nome, c.codigo, c.ativo, c.criado_em,
        COUNT(f.id) AS total,
        COALESCE(SUM(f.status = 'pendente'), 0) AS pendentes,
        COALESCE(SUM(f.status = 'aprovado'), 0) AS aprovados
      FROM coordenadores c LEFT JOIN fiscais f ON f.coordenador_id = c.id
      GROUP BY c.id ORDER BY c.nome COLLATE NOCASE`).all();
    return json(results);
  }

  // Criar coordenador ou gerar nova chave: a chave só aparece nesta resposta.
  if (request.method === "POST" && (!id || partes[5] === "nova-chave")) {
    const chave = `coord-${aleatorio(14)}`;
    if (!id) {
      const nome = texto((await request.json().catch(() => ({}))).nome);
      if (nome.length < 3) return json({ error: "Informe o nome do coordenador." }, 400);
      const codigo = aleatorio(6);
      await env.DB.prepare("INSERT INTO coordenadores (nome, codigo, chave_hash, criado_em) VALUES (?, ?, ?, ?)")
        .bind(nome, codigo, await sha256(chave), new Date().toISOString()).run();
      await registrarAcesso(env, request, quem, `criou coordenador ${nome}`);
      return json({ ok: true, nome, codigo, chave }, 201);
    }
    await env.DB.prepare("UPDATE coordenadores SET chave_hash = ? WHERE id = ?").bind(await sha256(chave), id).run();
    await registrarAcesso(env, request, quem, `gerou nova chave do coordenador #${id}`);
    return json({ ok: true, chave });
  }

  if (request.method === "PUT" && id) {
    const { ativo } = await request.json().catch(() => ({}));
    await env.DB.prepare("UPDATE coordenadores SET ativo = ? WHERE id = ?").bind(ativo ? 1 : 0, id).run();
    await registrarAcesso(env, request, quem, `${ativo ? "ativou" : "desativou"} coordenador #${id}`);
    return json({ ok: true });
  }

  return json({ error: "Método não suportado." }, 405);
}

async function fiscais(request, env, url, quem, ctx) {
  const partes = url.pathname.split("/");
  const id = Number(partes[4]);
  const acao = partes[5];

  if (request.method === "GET") {
    const filtro = quem.tipo === "coord" ? "WHERE f.coordenador_id = ?" : "";
    let q = env.DB.prepare(`SELECT f.*, c.nome AS coordenador_nome FROM fiscais f
      LEFT JOIN coordenadores c ON c.id = f.coordenador_id ${filtro}
      ORDER BY f.zona, f.local_nome, f.secao, f.nome`);
    if (quem.tipo === "coord") q = q.bind(quem.id);
    let { results } = await q.all();
    // Coordenador vê só o necessário para reconhecer a pessoa.
    if (quem.tipo === "coord") results = results.map(f => ({ ...f, cpf: mascararCpf(f.cpf) }));
    await registrarAcesso(env, request, quem, "abriu a lista");
    return json(results);
  }

  // Aprovar/recusar: a coordenação geral avalia qualquer um; o coordenador só os seus indicados.
  if (request.method === "POST" && id && acao === "status") {
    const { status } = await request.json().catch(() => ({}));
    if (!STATUS.includes(status)) return json({ error: "Status inválido." }, 400);
    const dono = quem.tipo === "coord" ? " AND coordenador_id = ?" : "";
    // Recusado libera a seção para outra pessoa.
    const { meta } = await env.DB.prepare(
      `UPDATE fiscais SET status = ?, avaliado_em = ?${status === "recusado" ? ", secao = NULL" : ""} WHERE id = ?${dono}`
    ).bind(status, new Date().toISOString(), id, ...(quem.tipo === "coord" ? [quem.id] : [])).run();
    if (!meta.changes) return json({ error: "Fiscal não encontrado." }, 404);
    await registrarAcesso(env, request, quem, `marcou fiscal #${id} como ${status}`);
    if (status === "aprovado") {
      const f = await env.DB.prepare("SELECT * FROM fiscais WHERE id = ? AND confirmado_em IS NULL").bind(id).first();
      const local = f && LOCAL_POR_CHAVE.get(`${f.zona}:${f.local_id}`);
      if (local) ctx.waitUntil(enviarConfirmacaoApi(env, id, f, local).catch(console.error));
    }
    return json({ ok: true });
  }

  if (quem.tipo !== "admin") return json({ error: "Acesso negado." }, 403);

  // Registro das exportações feitas no navegador (CSV, TXT, impressão, cópia).
  if (request.method === "POST" && partes[4] === "exportou") {
    const { tipo } = await request.json().catch(() => ({}));
    await registrarAcesso(env, request, quem, `exportou ${texto(tipo).slice(0, 40)}`);
    return json({ ok: true });
  }

  if (request.method === "POST" && !partes[4]) {
    const p = await request.json().catch(() => null);
    if (!p) return json({ error: "Requisição inválida." }, 400);
    const r = await inserirFiscal(env, p, { coordenadorId: p.coordenador_id ? Number(p.coordenador_id) : null, status: "aprovado" });
    if (r.erro) return r.erro;
    await registrarAcesso(env, request, quem, `cadastrou fiscal #${r.id}`);
    return json({ ok: true }, 201);
  }

  if (request.method === "POST" && id && acao === "confirmado") {
    const { enviado = true } = await request.json().catch(() => ({}));
    await env.DB.prepare("UPDATE fiscais SET confirmado_em = ?, confirmado_via = ? WHERE id = ?")
      .bind(enviado ? new Date().toISOString() : null, enviado ? "manual" : null, id).run();
    return json({ ok: true });
  }

  if (request.method === "DELETE" && id) {
    await env.DB.prepare("DELETE FROM fiscais WHERE id = ?").bind(id).run();
    await registrarAcesso(env, request, quem, `excluiu fiscal #${id}`);
    return json({ ok: true });
  }

  if (request.method === "PUT" && id) {
    const p = await request.json();
    const local = LOCAL_POR_CHAVE.get(`${Number(p.zona)}:${Number(p.local_id)}`);
    const telefone = normalizarTelefone(p.telefone);
    const cpf = normalizarCpf(p.cpf);
    const secao = p.secao === "" || p.secao == null ? null : Number(p.secao);
    if (!local || !telefone || texto(p.nome).length < 3) return json({ error: "Dados inválidos." }, 400);
    if (!cpf) return json({ error: "CPF inválido." }, 400);
    if (secao !== null && !local.secoes.includes(secao)) return json({ error: "Seção não pertence a este local." }, 400);
    try {
      await env.DB.prepare(
        "UPDATE fiscais SET nome = ?, cpf = ?, telefone = ?, zona = ?, local_id = ?, local_nome = ?, secao = ?, coordenador_id = ? WHERE id = ?"
      ).bind(texto(p.nome), cpf, telefone, local.zona, local.id, local.nome, secao, p.coordenador_id ? Number(p.coordenador_id) : null, id).run();
    } catch (e) {
      return json({ error: "CPF, telefone ou seção já usados por outro fiscal." }, 409);
    }
    await registrarAcesso(env, request, quem, `editou fiscal #${id}`);
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
      if (pathname.startsWith("/api/convite/") && request.method === "GET") {
        const c = await convite(env, pathname.split("/")[3]?.toLowerCase());
        return c ? json({ coordenador: c.nome.split(" ")[0] }) : json({ error: "Convite inválido." }, 404);
      }
      if (pathname === "/api/cadastro" && request.method === "POST") return cadastrar(request, env);

      if (pathname.startsWith("/api/admin/")) {
        const quem = await perfil(request, env);
        if (!quem) return json({ error: "Chave de acesso inválida." }, 401);
        if (pathname === "/api/admin/eu") return json(quem);
        if (pathname === "/api/admin/acessos") {
          if (quem.tipo !== "admin") return json({ error: "Acesso negado." }, 403);
          const { results } = await env.DB.prepare("SELECT * FROM acessos ORDER BY id DESC LIMIT 200").all();
          return json(results);
        }
        if (pathname.startsWith("/api/admin/coordenadores")) return coordenadores(request, env, url, quem);
        if (pathname.startsWith("/api/admin/fiscais")) return fiscais(request, env, url, quem, ctx);
      }
      if (pathname.startsWith("/api/")) return json({ error: "Não encontrado." }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: "Erro interno. Tente novamente." }, 500);
    }

    return env.ASSETS.fetch(request);
  },
};
