CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS Organizacoes (
    id_organizacao UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    assinatura_plano VARCHAR(50) NOT NULL DEFAULT 'basic',
    timestamp_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS id_organizacao UUID;
ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS organization_role VARCHAR(20) NOT NULL DEFAULT 'member';
ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
DECLARE
    user_record RECORD;
    organization_id UUID;
BEGIN
    FOR user_record IN
        SELECT id_usuario, nome, assinatura_plano
        FROM Usuarios
        WHERE id_organizacao IS NULL
        FOR UPDATE
    LOOP
        INSERT INTO Organizacoes (nome, assinatura_plano)
        VALUES (
            COALESCE(NULLIF(BTRIM(user_record.nome), ''), 'Minha organização'),
            COALESCE(NULLIF(user_record.assinatura_plano, ''), 'basic')
        )
        RETURNING id_organizacao INTO organization_id;

        UPDATE Usuarios
        SET id_organizacao = organization_id, organization_role = 'owner'
        WHERE id_usuario = user_record.id_usuario;
    END LOOP;
END $$;

ALTER TABLE Usuarios ALTER COLUMN id_organizacao SET NOT NULL;
ALTER TABLE Usuarios ADD CONSTRAINT fk_usuario_organizacao
    FOREIGN KEY (id_organizacao) REFERENCES Organizacoes(id_organizacao);
ALTER TABLE Usuarios ADD CONSTRAINT chk_usuario_organization_role
    CHECK (organization_role IN ('owner', 'member'));
ALTER TABLE Usuarios ADD CONSTRAINT chk_usuario_permissions_object
    CHECK (jsonb_typeof(permissions) = 'object');
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_id_organizacao
    ON Usuarios(id_usuario, id_organizacao);
CREATE INDEX IF NOT EXISTS idx_usuarios_organizacao ON Usuarios(id_organizacao);

UPDATE Organizacoes o
SET assinatura_plano = COALESCE(NULLIF(u.assinatura_plano, ''), 'basic')
FROM Usuarios u
WHERE u.id_organizacao = o.id_organizacao
  AND u.organization_role = 'owner';

CREATE TABLE IF NOT EXISTS Convites_Organizacao (
    id_convite UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_organizacao UUID NOT NULL REFERENCES Organizacoes(id_organizacao) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    nome VARCHAR(120) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    permissions JSONB NOT NULL CHECK (jsonb_typeof(permissions) = 'object'),
    criado_por UUID NOT NULL REFERENCES Usuarios(id_usuario),
    timestamp_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    timestamp_expiracao TIMESTAMP NOT NULL,
    timestamp_aceitacao TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_convite_pendente_email
    ON Convites_Organizacao(id_organizacao, LOWER(email))
    WHERE timestamp_aceitacao IS NULL;
CREATE INDEX IF NOT EXISTS idx_convites_organizacao ON Convites_Organizacao(id_organizacao);

ALTER TABLE Centro_Custo ADD COLUMN IF NOT EXISTS id_organizacao UUID;
ALTER TABLE Grupo ADD COLUMN IF NOT EXISTS id_organizacao UUID;
ALTER TABLE Categoria ADD COLUMN IF NOT EXISTS id_organizacao UUID;
ALTER TABLE Forma_Pagamento ADD COLUMN IF NOT EXISTS id_organizacao UUID;
ALTER TABLE Conta ADD COLUMN IF NOT EXISTS id_organizacao UUID;
ALTER TABLE Descricao ADD COLUMN IF NOT EXISTS id_organizacao UUID;
ALTER TABLE Transacoes ADD COLUMN IF NOT EXISTS id_organizacao UUID;
ALTER TABLE Tipo_Investimento ADD COLUMN IF NOT EXISTS id_organizacao UUID;
ALTER TABLE Investimentos ADD COLUMN IF NOT EXISTS id_organizacao UUID;
ALTER TABLE Investimentos ADD COLUMN IF NOT EXISTS rentabilidade_esperada DECIMAL(8, 4);
ALTER TABLE Orcamentos ADD COLUMN IF NOT EXISTS id_organizacao UUID;
ALTER TABLE Metas ADD COLUMN IF NOT EXISTS id_organizacao UUID;

UPDATE Centro_Custo cc
SET id_organizacao = u.id_organizacao
FROM Usuarios u
WHERE cc.id_organizacao IS NULL AND cc.usuario_criacao = u.id_usuario;

UPDATE Grupo g
SET id_organizacao = COALESCE(
    (SELECT u.id_organizacao FROM Usuarios u WHERE u.id_usuario = g.usuario_criacao),
    (SELECT cc.id_organizacao FROM Centro_Custo cc WHERE cc.id_cc = g.id_cc)
)
WHERE g.id_organizacao IS NULL;

UPDATE Categoria c
SET id_organizacao = COALESCE(
    (SELECT u.id_organizacao FROM Usuarios u WHERE u.id_usuario = c.usuario_criacao),
    (SELECT g.id_organizacao FROM Grupo g WHERE g.id_grupo = c.id_grupo)
)
WHERE c.id_organizacao IS NULL;

UPDATE Forma_Pagamento f
SET id_organizacao = u.id_organizacao
FROM Usuarios u
WHERE f.id_organizacao IS NULL AND f.usuario_criacao = u.id_usuario;

UPDATE Conta c
SET id_organizacao = COALESCE(
    (SELECT u.id_organizacao FROM Usuarios u WHERE u.id_usuario = c.usuario_criacao),
    (SELECT cc.id_organizacao FROM Centro_Custo cc WHERE cc.id_cc = c.id_cc)
)
WHERE c.id_organizacao IS NULL;

UPDATE Descricao d
SET id_organizacao = COALESCE(
    (SELECT u.id_organizacao FROM Usuarios u WHERE u.id_usuario = d.usuario_criacao),
    (SELECT c.id_organizacao FROM Categoria c WHERE c.id_categoria = d.id_categoria),
    (SELECT g.id_organizacao FROM Grupo g WHERE g.id_grupo = d.id_grupo)
)
WHERE d.id_organizacao IS NULL;

UPDATE Tipo_Investimento t
SET id_organizacao = u.id_organizacao
FROM Usuarios u
WHERE t.id_organizacao IS NULL AND t.usuario_criacao = u.id_usuario;

UPDATE Transacoes t
SET id_organizacao = COALESCE(
    (SELECT u.id_organizacao FROM Usuarios u WHERE u.id_usuario = t.usuario_insercao),
    (SELECT d.id_organizacao FROM Descricao d WHERE d.id_descricao = t.id_descricao),
    (SELECT c.id_organizacao FROM Conta c WHERE c.id_conta = t.id_conta),
    (SELECT f.id_organizacao FROM Forma_Pagamento f WHERE f.id_forma_pg = t.id_forma_pg)
)
WHERE t.id_organizacao IS NULL
  AND (t.usuario_insercao IS NOT NULL OR t.id_descricao IS NOT NULL OR t.id_conta IS NOT NULL OR t.id_forma_pg IS NOT NULL);

UPDATE Investimentos i
SET id_organizacao = COALESCE(
    (SELECT u.id_organizacao FROM Usuarios u WHERE u.id_usuario = i.usuario_insercao),
    (SELECT c.id_organizacao FROM Conta c WHERE c.id_conta = i.id_conta),
    (SELECT t.id_organizacao FROM Tipo_Investimento t WHERE t.id_tipo_investimento = i.id_tipo_investimento)
)
WHERE i.id_organizacao IS NULL
  AND (i.usuario_insercao IS NOT NULL OR i.id_conta IS NOT NULL OR i.id_tipo_investimento IS NOT NULL);

UPDATE Orcamentos o
SET id_organizacao = COALESCE(
    (SELECT u.id_organizacao FROM Usuarios u WHERE u.id_usuario = o.usuario_criacao),
    (SELECT c.id_organizacao FROM Categoria c WHERE c.id_categoria = o.id_categoria)
)
WHERE o.id_organizacao IS NULL;

UPDATE Metas m
SET id_organizacao = u.id_organizacao
FROM Usuarios u
WHERE m.id_organizacao IS NULL AND m.usuario_criacao = u.id_usuario;

DO $$
DECLARE
    missing_count BIGINT;
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'centro_custo', 'grupo', 'categoria', 'forma_pagamento', 'conta',
        'descricao', 'transacoes', 'tipo_investimento', 'investimentos',
        'orcamentos', 'metas'
    ]
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I WHERE id_organizacao IS NULL', table_name)
        INTO missing_count;
        IF missing_count > 0 THEN
            RAISE EXCEPTION 'Migração multi-tenant abortada: % registro(s) sem organização em %.', missing_count, table_name;
        END IF;
    END LOOP;
END $$;

ALTER TABLE Centro_Custo ALTER COLUMN id_organizacao SET NOT NULL;
ALTER TABLE Grupo ALTER COLUMN id_organizacao SET NOT NULL;
ALTER TABLE Categoria ALTER COLUMN id_organizacao SET NOT NULL;
ALTER TABLE Forma_Pagamento ALTER COLUMN id_organizacao SET NOT NULL;
ALTER TABLE Conta ALTER COLUMN id_organizacao SET NOT NULL;
ALTER TABLE Descricao ALTER COLUMN id_organizacao SET NOT NULL;
ALTER TABLE Transacoes ALTER COLUMN id_organizacao SET NOT NULL;
ALTER TABLE Tipo_Investimento ALTER COLUMN id_organizacao SET NOT NULL;
ALTER TABLE Investimentos ALTER COLUMN id_organizacao SET NOT NULL;
ALTER TABLE Orcamentos ALTER COLUMN id_organizacao SET NOT NULL;
ALTER TABLE Metas ALTER COLUMN id_organizacao SET NOT NULL;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'centro_custo', 'grupo', 'categoria', 'forma_pagamento', 'conta',
        'descricao', 'transacoes', 'tipo_investimento', 'investimentos',
        'orcamentos', 'metas'
    ]
    LOOP
        EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (id_organizacao) REFERENCES Organizacoes(id_organizacao)',
            table_name, 'fk_' || LOWER(table_name) || '_organizacao'
        );
    END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_centro_custo_id_organizacao ON Centro_Custo(id_cc, id_organizacao);
CREATE UNIQUE INDEX IF NOT EXISTS idx_grupo_id_organizacao ON Grupo(id_grupo, id_organizacao);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categoria_id_organizacao ON Categoria(id_categoria, id_organizacao);
CREATE UNIQUE INDEX IF NOT EXISTS idx_forma_pagamento_id_organizacao ON Forma_Pagamento(id_forma_pg, id_organizacao);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conta_id_organizacao ON Conta(id_conta, id_organizacao);
CREATE UNIQUE INDEX IF NOT EXISTS idx_descricao_id_organizacao ON Descricao(id_descricao, id_organizacao);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tipo_investimento_id_organizacao ON Tipo_Investimento(id_tipo_investimento, id_organizacao);

DO $$
BEGIN
    ALTER TABLE Centro_Custo ADD CONSTRAINT fk_centro_custo_usuario_organizacao
        FOREIGN KEY (usuario_criacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    ALTER TABLE Centro_Custo ADD CONSTRAINT fk_centro_custo_atualizacao_organizacao
        FOREIGN KEY (usuario_atualizacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    ALTER TABLE Grupo ADD CONSTRAINT fk_grupo_cc_organizacao
        FOREIGN KEY (id_cc, id_organizacao) REFERENCES Centro_Custo(id_cc, id_organizacao);
    ALTER TABLE Grupo ADD CONSTRAINT fk_grupo_usuario_organizacao
        FOREIGN KEY (usuario_criacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    ALTER TABLE Grupo ADD CONSTRAINT fk_grupo_atualizacao_organizacao
        FOREIGN KEY (usuario_atualizacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    ALTER TABLE Categoria ADD CONSTRAINT fk_categoria_grupo_organizacao
        FOREIGN KEY (id_grupo, id_organizacao) REFERENCES Grupo(id_grupo, id_organizacao);
    ALTER TABLE Categoria ADD CONSTRAINT fk_categoria_usuario_organizacao
        FOREIGN KEY (usuario_criacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    ALTER TABLE Categoria ADD CONSTRAINT fk_categoria_atualizacao_organizacao
        FOREIGN KEY (usuario_atualizacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    ALTER TABLE Forma_Pagamento ADD CONSTRAINT fk_forma_usuario_organizacao
        FOREIGN KEY (usuario_criacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    ALTER TABLE Forma_Pagamento ADD CONSTRAINT fk_forma_atualizacao_organizacao
        FOREIGN KEY (usuario_atualizacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    ALTER TABLE Conta ADD CONSTRAINT fk_conta_cc_organizacao
        FOREIGN KEY (id_cc, id_organizacao) REFERENCES Centro_Custo(id_cc, id_organizacao);
    ALTER TABLE Conta ADD CONSTRAINT fk_conta_usuario_organizacao
        FOREIGN KEY (usuario_criacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    ALTER TABLE Conta ADD CONSTRAINT fk_conta_atualizacao_organizacao
        FOREIGN KEY (usuario_atualizacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    ALTER TABLE Descricao ADD CONSTRAINT fk_descricao_categoria_organizacao
        FOREIGN KEY (id_categoria, id_organizacao) REFERENCES Categoria(id_categoria, id_organizacao);
    ALTER TABLE Descricao ADD CONSTRAINT fk_descricao_grupo_organizacao
        FOREIGN KEY (id_grupo, id_organizacao) REFERENCES Grupo(id_grupo, id_organizacao);
    ALTER TABLE Descricao ADD CONSTRAINT fk_descricao_usuario_organizacao
        FOREIGN KEY (usuario_criacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    ALTER TABLE Descricao ADD CONSTRAINT fk_descricao_atualizacao_organizacao
        FOREIGN KEY (usuario_atualizacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    ALTER TABLE Transacoes ADD CONSTRAINT fk_transacao_descricao_organizacao
        FOREIGN KEY (id_descricao, id_organizacao) REFERENCES Descricao(id_descricao, id_organizacao);
    ALTER TABLE Transacoes ADD CONSTRAINT fk_transacao_usuario_organizacao
        FOREIGN KEY (usuario_insercao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    ALTER TABLE Transacoes ADD CONSTRAINT fk_transacao_atualizacao_organizacao
        FOREIGN KEY (usuario_atualizacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    ALTER TABLE Transacoes ADD CONSTRAINT fk_transacao_forma_organizacao
        FOREIGN KEY (id_forma_pg, id_organizacao) REFERENCES Forma_Pagamento(id_forma_pg, id_organizacao);
    ALTER TABLE Transacoes ADD CONSTRAINT fk_transacao_conta_organizacao
        FOREIGN KEY (id_conta, id_organizacao) REFERENCES Conta(id_conta, id_organizacao);
    ALTER TABLE Investimentos ADD CONSTRAINT fk_investimento_conta_organizacao
        FOREIGN KEY (id_conta, id_organizacao) REFERENCES Conta(id_conta, id_organizacao);
    ALTER TABLE Investimentos ADD CONSTRAINT fk_investimento_tipo_organizacao
        FOREIGN KEY (id_tipo_investimento, id_organizacao) REFERENCES Tipo_Investimento(id_tipo_investimento, id_organizacao);
    ALTER TABLE Tipo_Investimento ADD CONSTRAINT fk_tipo_investimento_usuario_organizacao
        FOREIGN KEY (usuario_criacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    ALTER TABLE Tipo_Investimento ADD CONSTRAINT fk_tipo_investimento_atualizacao_organizacao
        FOREIGN KEY (usuario_atualizacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    ALTER TABLE Investimentos ADD CONSTRAINT fk_investimento_usuario_organizacao
        FOREIGN KEY (usuario_insercao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    ALTER TABLE Investimentos ADD CONSTRAINT fk_investimento_atualizacao_organizacao
        FOREIGN KEY (usuario_atualizacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    ALTER TABLE Orcamentos ADD CONSTRAINT fk_orcamento_categoria_organizacao
        FOREIGN KEY (id_categoria, id_organizacao) REFERENCES Categoria(id_categoria, id_organizacao);
    ALTER TABLE Orcamentos ADD CONSTRAINT fk_orcamento_usuario_organizacao
        FOREIGN KEY (usuario_criacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    ALTER TABLE Metas ADD CONSTRAINT fk_meta_usuario_organizacao
        FOREIGN KEY (usuario_criacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    ALTER TABLE Convites_Organizacao ADD CONSTRAINT fk_convite_criador_organizacao
        FOREIGN KEY (criado_por, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
END $$;

CREATE INDEX IF NOT EXISTS idx_transacoes_organizacao ON Transacoes(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_investimentos_organizacao ON Investimentos(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_categorias_organizacao ON Categoria(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_contas_organizacao ON Conta(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_centros_custo_organizacao ON Centro_Custo(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_grupos_organizacao ON Grupo(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_formas_pagamento_organizacao ON Forma_Pagamento(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_descricoes_organizacao ON Descricao(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_tipos_investimento_organizacao ON Tipo_Investimento(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_orcamentos_organizacao ON Orcamentos(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_metas_organizacao ON Metas(id_organizacao);
