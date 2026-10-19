import LOCAIS from "./locais.json";

const DATA_ELEICAO = "2026-10-25";
const LOCAL_POR_CHAVE = new Map(LOCAIS.map(l => [`${l.zona}:${l.id}`, l]));
const STATUS = ["pendente", "aprovado", "recusado"];
const PAPEIS = ["master", "admin", "coord"];

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

const CONECTIVOS = new Set(["da", "de", "do", "das", "dos", "e"]);
const SESSAO_HORAS = 12;
const MAX_FALHAS = 5;
const BLOQUEIO_MIN = 15;

// Senha inicial: iniciais do nome (sem da/de/do/das/dos/e) + 4 últimos dígitos do celular.
// Ex.: Maria da Silva Souza, (51) 99999-1234 -> mss1234
function senhaInicial(nome, telefone) {
  const iniciais = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .split(/\s+/).filter(p => p && !CONECTIVOS.has(p)).map(p => p[0]).join("");
  return iniciais + telefone.slice(-4);
}

async function hashSenha(senha, salt) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 10000 }, base, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function definirSenha(env, id, senha, trocar) {
  const salt = aleatorio(16);
  await env.DB.prepare("UPDATE coordenadores SET senha_hash = ?, senha_salt = ?, trocar_senha = ?, falhas = 0, bloqueado_ate = NULL WHERE id = ?")
    .bind(await hashSenha(senha, salt), salt, trocar ? 1 : 0, id).run();
}

const iguais = (a, b) => {
  const enc = new TextEncoder();
  const x = enc.encode(a), y = enc.encode(b);
  return x.length === y.length && crypto.subtle.timingSafeEqual(x, y);
};

async function login(request, env) {
  const p = await request.json().catch(() => ({}));
  const senha = String(p.senha || "");
  const erro = json({ error: "WhatsApp ou senha incorretos." }, 401);
  let membroId = null;

  // Chave mestra (ADMIN_KEY) continua valendo para emergências.
  if (!(env.ADMIN_KEY && iguais(await sha256(senha), await sha256(env.ADMIN_KEY)))) {
    const telefone = normalizarTelefone(p.telefone);
    if (!telefone) return erro;
    const m = await env.DB.prepare("SELECT * FROM coordenadores WHERE telefone = ? AND ativo = 1").bind(telefone).first();
    if (!m || !m.senha_hash) return erro;
    if (m.bloqueado_ate && m.bloqueado_ate > new Date().toISOString()) {
      return json({ error: `Muitas tentativas erradas. Tente de novo em ${BLOQUEIO_MIN} minutos.` }, 429);
    }
    // A senha inicial é aceita sem diferenciar maiúsculas.
    const tentativa = m.trocar_senha ? senha.trim().toLowerCase() : senha;
    if (!iguais(await hashSenha(tentativa, m.senha_salt), m.senha_hash)) {
      const falhas = m.falhas + 1;
      const bloqueio = falhas >= MAX_FALHAS ? new Date(Date.now() + BLOQUEIO_MIN * 60000).toISOString() : null;
      await env.DB.prepare("UPDATE coordenadores SET falhas = ?, bloqueado_ate = ? WHERE id = ?").bind(bloqueio ? 0 : falhas, bloqueio, m.id).run();
      await registrarAcesso(env, request, { nome: m.nome }, bloqueio ? "login bloqueado após 5 tentativas" : "senha errada");
      return erro;
    }
    await env.DB.prepare("UPDATE coordenadores SET falhas = 0, bloqueado_ate = NULL WHERE id = ?").bind(m.id).run();
    membroId = m.id;
  }

  const token = aleatorio(40, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
  await env.DB.prepare("DELETE FROM sessoes WHERE expira_em < ?").bind(new Date().toISOString()).run();
  await env.DB.prepare("INSERT INTO sessoes (token_hash, membro_id, expira_em) VALUES (?, ?, ?)")
    .bind(await sha256(token), membroId, new Date(Date.now() + SESSAO_HORAS * 3600000).toISOString()).run();
  const quem = await perfilDaSessao(env, await sha256(token));
  await registrarAcesso(env, request, quem, "entrou no painel");
  return json({ token, ...quem });
}

async function perfilDaSessao(env, tokenHash) {
  const s = await env.DB.prepare("SELECT membro_id FROM sessoes WHERE token_hash = ? AND expira_em > ?")
    .bind(tokenHash, new Date().toISOString()).first();
  if (!s) return null;
  if (s.membro_id == null) return { tipo: "admin", master: true, id: null, nome: "Chave mestra", trocar_senha: false };
  const m = await env.DB.prepare("SELECT id, nome, papel, codigo, trocar_senha FROM coordenadores WHERE id = ? AND ativo = 1").bind(s.membro_id).first();
  // "master" é um administrador que também gerencia a equipe.
  return m ? { tipo: m.papel === "coord" ? "coord" : "admin", master: m.papel === "master", papel: m.papel, id: m.id, nome: m.nome, codigo: m.codigo, trocar_senha: !!m.trocar_senha } : null;
}

// Quem está chamando a API administrativa: { tipo: "admin" | "coord", master, id, nome, trocar_senha }
async function perfil(request, env) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return token ? perfilDaSessao(env, await sha256(token)) : null;
}

async function trocarSenha(request, env, quem) {
  if (!quem.id) return json({ error: "A chave mestra não tem senha para trocar." }, 400);
  const { atual = "", nova = "" } = await request.json().catch(() => ({}));
  const m = await env.DB.prepare("SELECT * FROM coordenadores WHERE id = ?").bind(quem.id).first();
  const tentativa = m.trocar_senha ? atual.trim().toLowerCase() : atual;
  if (!iguais(await hashSenha(tentativa, m.senha_salt), m.senha_hash)) return json({ error: "Senha atual incorreta." }, 400);
  if (nova.length < 8) return json({ error: "A nova senha precisa ter pelo menos 8 caracteres." }, 400);
  if (nova.toLowerCase() === senhaInicial(m.nome, m.telefone) || /^\d+$/.test(nova)) {
    return json({ error: "Escolha uma senha diferente da inicial e que não seja só números." }, 400);
  }
  await definirSenha(env, m.id, nova, false);
  await registrarAcesso(env, request, quem, "trocou a senha");
  return json({ ok: true });
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

async function equipe(request, env, url, quem) {
  if (quem.tipo !== "admin") return json({ error: "Acesso negado." }, 403);
  const partes = url.pathname.split("/");
  const id = Number(partes[4]);

  if (request.method === "GET") {
    const { results } = await env.DB.prepare(`
      SELECT c.id, c.nome, c.telefone, c.papel, c.codigo, c.ativo, c.trocar_senha, c.criado_em,
        COUNT(f.id) AS total,
        COALESCE(SUM(f.status = 'pendente'), 0) AS pendentes,
        COALESCE(SUM(f.status = 'aprovado'), 0) AS aprovados
      FROM coordenadores c LEFT JOIN fiscais f ON f.coordenador_id = c.id
      GROUP BY c.id ORDER BY CASE c.papel WHEN 'master' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, c.nome COLLATE NOCASE`).all();
    return json(results);
  }

  // Incluir, remover e mudar papéis da equipe: só administrador master.
  if (!quem.master) return json({ error: "Só administradores master podem alterar a equipe." }, 403);

  if (request.method === "POST" && !id) {
    const p = await request.json().catch(() => ({}));
    const nome = texto(p.nome);
    const telefone = normalizarTelefone(p.telefone);
    const papel = PAPEIS.includes(p.papel) ? p.papel : "coord";
    if (nome.length < 5 || !nome.includes(" ")) return json({ error: "Informe o nome completo." }, 400);
    if (!telefone) return json({ error: "Informe um WhatsApp válido com DDD." }, 400);
    try {
      const { meta } = await env.DB.prepare("INSERT INTO coordenadores (nome, telefone, papel, codigo, chave_hash, criado_em) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(nome, telefone, papel, aleatorio(6), await sha256(aleatorio(32)), new Date().toISOString()).run();
      await definirSenha(env, meta.last_row_id, senhaInicial(nome, telefone), true);
    } catch (e) {
      if (String(e?.message || e).includes("telefone")) return json({ error: "Já existe alguém da equipe com este WhatsApp." }, 409);
      throw e;
    }
    await registrarAcesso(env, request, quem, `incluiu ${nome} na equipe (${papel})`);
    return json({ ok: true, senha_inicial: senhaInicial(nome, telefone) }, 201);
  }

  if (request.method === "POST" && id && partes[5] === "redefinir-senha") {
    const m = await env.DB.prepare("SELECT nome, telefone FROM coordenadores WHERE id = ?").bind(id).first();
    if (!m) return json({ error: "Não encontrado." }, 404);
    await definirSenha(env, id, senhaInicial(m.nome, m.telefone), true);
    await env.DB.prepare("DELETE FROM sessoes WHERE membro_id = ?").bind(id).run();
    await registrarAcesso(env, request, quem, `redefiniu a senha de ${m.nome}`);
    return json({ ok: true, senha_inicial: senhaInicial(m.nome, m.telefone) });
  }

  if (request.method === "PUT" && id) {
    const p = await request.json().catch(() => ({}));
    if (id === quem.id && (p.ativo === false || (p.papel && p.papel !== "master"))) return json({ error: "Você não pode remover o seu próprio acesso de administrador master." }, 400);
    if ("ativo" in p) {
      await env.DB.prepare("UPDATE coordenadores SET ativo = ? WHERE id = ?").bind(p.ativo ? 1 : 0, id).run();
      if (!p.ativo) await env.DB.prepare("DELETE FROM sessoes WHERE membro_id = ?").bind(id).run();
    }
    if (PAPEIS.includes(p.papel)) {
      await env.DB.prepare("UPDATE coordenadores SET papel = ? WHERE id = ?").bind(p.papel, id).run();
    }
    await registrarAcesso(env, request, quem, `alterou o membro #${id} da equipe (${JSON.stringify(p)})`);
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

      if (pathname === "/api/login" && request.method === "POST") return login(request, env);

      if (pathname.startsWith("/api/admin/")) {
        const quem = await perfil(request, env);
        if (!quem) return json({ error: "Sessão expirada. Entre novamente." }, 401);
        if (pathname === "/api/admin/eu") return json(quem);
        if (pathname === "/api/admin/sair") {
          const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
          await env.DB.prepare("DELETE FROM sessoes WHERE token_hash = ?").bind(await sha256(token)).run();
          return json({ ok: true });
        }
        if (pathname === "/api/admin/senha" && request.method === "POST") return trocarSenha(request, env, quem);
        // Enquanto usar a senha inicial, só pode trocar a senha.
        if (quem.trocar_senha) return json({ error: "Troque a senha inicial para continuar." }, 403);
        if (pathname === "/api/admin/acessos") {
          if (quem.tipo !== "admin") return json({ error: "Acesso negado." }, 403);
          const { results } = await env.DB.prepare("SELECT * FROM acessos ORDER BY id DESC LIMIT 200").all();
          return json(results);
        }
        if (pathname.startsWith("/api/admin/equipe")) return equipe(request, env, url, quem);
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
