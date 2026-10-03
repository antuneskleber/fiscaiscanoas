const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const normalizePhone = value => String(value || "").replace(/\D/g, "");
const normalizedText = value => String(value || "").trim().replace(/\s+/g, " ");

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Listar locais com contagem
    if (url.pathname === "/api/locations" && request.method === "GET") {
      const source = await env.ASSETS.fetch(new Request(new URL("/data.json", request.url)));
      const locations = await source.json();
      const { results } = await env.DB.prepare("SELECT location_name, COUNT(*) AS total FROM assignments WHERE location_name IS NOT NULL GROUP BY location_name").all();
      const counts = new Map(results.map(row => [row.location_name, row.total]));
      return json(locations.map(location => ({ ...location, registered_count: counts.get(location.name) || 0 })));
    }

    // Listar todos os fiscais com ID
    if (url.pathname === "/api/fiscals" && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT id, location_name, section, name, phone, created_at FROM assignments ORDER BY location_name COLLATE NOCASE, name COLLATE NOCASE").all();
      return json(results);
    }

    // Criar novo fiscal
    if (url.pathname === "/api/assignments" && request.method === "POST") {
      try {
        const payload = await request.json();
        const locationName = normalizedText(payload.location_name);
        const name = normalizedText(payload.name);
        const phone = normalizePhone(payload.phone);
        const section = payload.section ? Number(payload.section) : null;
        if (locationName.length < 3 || name.length < 3 || (phone && (phone.length < 10 || phone.length > 13))) {
          throw new Error("Informe local, nome e um telefone válido com DDD.");
        }
        await env.DB.prepare("INSERT INTO assignments (location_name, section, name, phone, created_at) VALUES (?, ?, ?, ?, ?)").bind(locationName, section, name, phone || null, new Date().toISOString()).run();
        return json({ message: "Fiscal cadastrado com sucesso." }, 201);
      } catch (error) {
        return json({ error: error.message || "Não foi possível salvar." }, 400);
      }
    }

    // Atualizar fiscal existente
    if (url.pathname === "/api/assignments" && request.method === "PUT") {
      try {
        const payload = await request.json();
        const id = payload.id;
        if (!id) throw new Error("ID do fiscal não fornecido.");
        const locationName = normalizedText(payload.location_name);
        const name = normalizedText(payload.name);
        const phone = normalizePhone(payload.phone);
        const section = payload.section ? Number(payload.section) : null;
        if (locationName.length < 3 || name.length < 3) {
          throw new Error("Informe local e nome válidos.");
        }
        await env.DB.prepare("UPDATE assignments SET location_name = ?, section = ?, name = ?, phone = ? WHERE id = ?").bind(locationName, section, name, phone || null, id).run();
        return json({ message: "Fiscal atualizado com sucesso." });
      } catch (error) {
        return json({ error: error.message || "Erro ao atualizar." }, 400);
      }
    }

    // Excluir fiscal
    if (url.pathname === "/api/assignments" && request.method === "DELETE") {
      try {
        const id = url.searchParams.get("id");
        if (!id) throw new Error("ID do fiscal não fornecido.");
        await env.DB.prepare("DELETE FROM assignments WHERE id = ?").bind(id).run();
        return json({ message: "Fiscal removido com sucesso." });
      } catch (error) {
        return json({ error: error.message || "Erro ao remover." }, 400);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
