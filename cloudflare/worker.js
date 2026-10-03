const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const normalizePhone = value => String(value || "").replace(/\D/g, "");
const normalizedText = value => String(value || "").trim().replace(/\s+/g, " ");

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/locations" && request.method === "GET") {
      const source = await env.ASSETS.fetch(new Request(new URL("/data.json", request.url)));
      const locations = await source.json();
      const { results } = await env.DB.prepare("SELECT location_name, COUNT(*) AS total FROM assignments WHERE location_name IS NOT NULL GROUP BY location_name").all();
      const counts = new Map(results.map(row => [row.location_name, row.total]));
      return json(locations.map(location => ({ ...location, registered_count: counts.get(location.name) || 0 })));
    }
    if (url.pathname === "/api/fiscals" && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT location_name, section, name, phone FROM assignments ORDER BY location_name COLLATE NOCASE, name COLLATE NOCASE").all();
      return json(results);
    }
    if (url.pathname === "/api/assignments" && request.method === "POST") {
      try {
        const payload = await request.json();
        const locationName = normalizedText(payload.location_name);
        const name = normalizedText(payload.name);
        const phone = normalizePhone(payload.phone);
        if (locationName.length < 3 || name.length < 3 || (phone && (phone.length < 10 || phone.length > 13))) throw new Error("Informe local, nome e um telefone válido com DDD.");
        await env.DB.prepare("INSERT INTO assignments (location_name, section, name, phone, created_at) VALUES (?, ?, ?, ?, ?)").bind(locationName, null, name, phone || null, new Date().toISOString()).run();
        return json({ message: "Fiscal cadastrado com sucesso." }, 201);
      } catch (error) { return json({ error: error.message || "Não foi possível salvar." }, 400); }
    }
    return env.ASSETS.fetch(request);
  }
};
