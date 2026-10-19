-- Cadastro de fiscais voluntários do 2º turno (25/10/2026).
-- A tabela antiga `assignments` é preservada como histórico.
CREATE TABLE IF NOT EXISTS fiscais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  zona INTEGER NOT NULL,
  local_id INTEGER NOT NULL,
  local_nome TEXT NOT NULL,
  secao INTEGER,               -- NULL = qualquer seção do local (volante)
  criado_em TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS fiscais_telefone_uq ON fiscais(telefone);
CREATE UNIQUE INDEX IF NOT EXISTS fiscais_secao_uq ON fiscais(zona, secao) WHERE secao IS NOT NULL;
CREATE INDEX IF NOT EXISTS fiscais_local_idx ON fiscais(zona, local_id);
