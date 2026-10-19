-- Login da equipe por WhatsApp + senha. A tabela coordenadores passa a guardar
-- toda a equipe: administradores (papel 'admin') e coordenadores (papel 'coord').
ALTER TABLE coordenadores ADD COLUMN papel TEXT NOT NULL DEFAULT 'coord';
ALTER TABLE coordenadores ADD COLUMN telefone TEXT;
ALTER TABLE coordenadores ADD COLUMN senha_hash TEXT;
ALTER TABLE coordenadores ADD COLUMN senha_salt TEXT;
ALTER TABLE coordenadores ADD COLUMN trocar_senha INTEGER NOT NULL DEFAULT 1; -- 1 = ainda usa a senha inicial
ALTER TABLE coordenadores ADD COLUMN falhas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE coordenadores ADD COLUMN bloqueado_ate TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS coordenadores_telefone_uq ON coordenadores(telefone) WHERE telefone IS NOT NULL;

CREATE TABLE IF NOT EXISTS sessoes (
  token_hash TEXT PRIMARY KEY,
  membro_id INTEGER,          -- NULL = chave mestra (ADMIN_KEY)
  expira_em TEXT NOT NULL
);
