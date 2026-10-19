-- Indicação por coordenador: cada fiscal entra por um link de convite e fica
-- pendente até o coordenador que indicou aprovar.
CREATE TABLE IF NOT EXISTS coordenadores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  codigo TEXT NOT NULL UNIQUE,        -- vai no link de convite (?c=)
  chave_hash TEXT NOT NULL UNIQUE,    -- SHA-256 da chave de acesso ao painel
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL
);

ALTER TABLE fiscais ADD COLUMN coordenador_id INTEGER REFERENCES coordenadores(id);
ALTER TABLE fiscais ADD COLUMN status TEXT NOT NULL DEFAULT 'pendente';  -- pendente | aprovado | recusado
ALTER TABLE fiscais ADD COLUMN avaliado_em TEXT;
CREATE INDEX IF NOT EXISTS fiscais_coord_idx ON fiscais(coordenador_id);

-- Registro de quem acessou ou exportou a lista.
CREATE TABLE IF NOT EXISTS acessos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quem TEXT NOT NULL,
  acao TEXT NOT NULL,
  ip TEXT,
  em TEXT NOT NULL
);

-- CPF do fiscal (obrigatório nos novos cadastros, único).
ALTER TABLE fiscais ADD COLUMN cpf TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS fiscais_cpf_uq ON fiscais(cpf) WHERE cpf IS NOT NULL;
