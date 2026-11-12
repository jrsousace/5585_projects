CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE Usuarios
    ADD COLUMN IF NOT EXISTS access_role VARCHAR(20) NOT NULL DEFAULT 'user',
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS access_level VARCHAR(20) NOT NULL DEFAULT 'user';

UPDATE Usuarios
SET access_level = CASE
    WHEN organization_role = 'owner' THEN 'manager'
    ELSE 'user'
END;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'usuarios_access_role_check'
          AND conrelid = 'usuarios'::regclass
    ) THEN
        ALTER TABLE Usuarios
            ADD CONSTRAINT usuarios_access_role_check
            CHECK (access_role IN ('user', 'master'));
    END IF;
END $$;

ALTER TABLE Usuarios DROP COLUMN IF EXISTS assinatura_plano;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_usuario_access_level'
          AND conrelid = 'usuarios'::regclass
    ) THEN
        ALTER TABLE Usuarios
            ADD CONSTRAINT chk_usuario_access_level
            CHECK (access_level IN ('manager', 'user', 'reader'));
    END IF;
END $$;

ALTER TABLE Convites_Organizacao
    ADD COLUMN IF NOT EXISTS access_level VARCHAR(20) NOT NULL DEFAULT 'user';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_convite_access_level'
          AND conrelid = 'convites_organizacao'::regclass
    ) THEN
        ALTER TABLE Convites_Organizacao
            ADD CONSTRAINT chk_convite_access_level
            CHECK (access_level IN ('manager', 'user', 'reader'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS Auth_Tokens (
    id_token UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    purpose VARCHAR(30) NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_purpose
    ON Auth_Tokens(user_id, purpose, expires_at DESC);

CREATE TABLE IF NOT EXISTS Auth_Rate_Limits (
    rate_key CHAR(64) PRIMARY KEY,
    window_started_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    blocked_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS Auditoria_Organizacao (
    id_auditoria UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES Organizacoes(id_organizacao),
    actor_user_id UUID NOT NULL REFERENCES Usuarios(id_usuario),
    action VARCHAR(80) NOT NULL,
    target_type VARCHAR(40) NOT NULL,
    target_id UUID,
    previous_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    new_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp_criacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_auditoria_organizacao_org
    ON Auditoria_Organizacao(organization_id, timestamp_criacao DESC);
