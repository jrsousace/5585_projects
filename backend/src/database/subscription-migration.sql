CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE Organizacoes
    ADD COLUMN IF NOT EXISTS assinatura_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS assinatura_expira_em TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

UPDATE Organizacoes
SET assinatura_status = CASE
    WHEN assinatura_plano = 'pro' THEN 'expired'
    ELSE 'free'
END
WHERE assinatura_status IS NULL;

ALTER TABLE Organizacoes
    ALTER COLUMN assinatura_status SET DEFAULT 'free',
    ALTER COLUMN assinatura_status SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_organizacao_assinatura_status'
    ) THEN
        ALTER TABLE Organizacoes
            ADD CONSTRAINT chk_organizacao_assinatura_status
            CHECK (assinatura_status IN ('free', 'active', 'expired', 'canceled'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizacoes_stripe_subscription
    ON Organizacoes(stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizacoes_stripe_customer
    ON Organizacoes(stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS Stripe_Eventos (
    event_id VARCHAR(255) PRIMARY KEY,
    event_type VARCHAR(120) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Admin_Auditoria_Assinaturas (
    id_auditoria UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES Organizacoes(id_organizacao),
    admin_user_id UUID NOT NULL REFERENCES Usuarios(id_usuario),
    origem VARCHAR(20) NOT NULL CHECK (origem IN ('master', 'stripe')),
    acao VARCHAR(60) NOT NULL,
    estado_anterior JSONB NOT NULL,
    estado_novo JSONB NOT NULL,
    timestamp_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_auditoria_assinatura_org
    ON Admin_Auditoria_Assinaturas(organization_id, timestamp_criacao DESC);

CREATE TABLE IF NOT EXISTS Admin_Auditoria_Usuarios (
    id_auditoria UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES Organizacoes(id_organizacao),
    target_user_id UUID NOT NULL REFERENCES Usuarios(id_usuario),
    admin_user_id UUID NOT NULL REFERENCES Usuarios(id_usuario),
    status_anterior VARCHAR(50) NOT NULL,
    status_novo VARCHAR(50) NOT NULL,
    timestamp_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_auditoria_usuario_org
    ON Admin_Auditoria_Usuarios(organization_id, timestamp_criacao DESC);
