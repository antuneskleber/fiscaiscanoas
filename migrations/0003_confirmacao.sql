-- Controle da mensagem de confirmação por WhatsApp.
ALTER TABLE fiscais ADD COLUMN confirmado_em TEXT;   -- quando a confirmação foi enviada
ALTER TABLE fiscais ADD COLUMN confirmado_via TEXT;  -- 'api' (automático) ou 'manual' (painel)
