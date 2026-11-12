ALTER TABLE Organizacoes ADD COLUMN IF NOT EXISTS tipo_cadastro VARCHAR(2);
ALTER TABLE Organizacoes ADD COLUMN IF NOT EXISTS cnpj VARCHAR(14);
ALTER TABLE Organizacoes ADD COLUMN IF NOT EXISTS razao_social VARCHAR(255);
ALTER TABLE Organizacoes ADD COLUMN IF NOT EXISTS nome_fantasia VARCHAR(255);

UPDATE Organizacoes SET tipo_cadastro = 'pf' WHERE tipo_cadastro IS NULL;
ALTER TABLE Organizacoes ALTER COLUMN tipo_cadastro SET DEFAULT 'pf';
ALTER TABLE Organizacoes ALTER COLUMN tipo_cadastro SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_organizacao_tipo_cadastro') THEN
        ALTER TABLE Organizacoes ADD CONSTRAINT chk_organizacao_tipo_cadastro
            CHECK (tipo_cadastro IN ('pf', 'pj'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_organizacao_dados_pj') THEN
        ALTER TABLE Organizacoes ADD CONSTRAINT chk_organizacao_dados_pj
            CHECK (
                tipo_cadastro <> 'pj' OR (
                    cnpj IS NOT NULL AND cnpj ~ '^[A-Z0-9]{12}[0-9]{2}$' AND
                    NULLIF(BTRIM(razao_social), '') IS NOT NULL AND
                    NULLIF(BTRIM(nome_fantasia), '') IS NOT NULL
                )
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_organizacao_cnpj_formato') THEN
        ALTER TABLE Organizacoes ADD CONSTRAINT chk_organizacao_cnpj_formato
            CHECK (cnpj IS NULL OR cnpj ~ '^[A-Z0-9]{12}[0-9]{2}$');
    END IF;
END $$;

ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS cpf VARCHAR(11);
ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS data_nascimento DATE;
ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS telefone VARCHAR(13);
ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS logradouro VARCHAR(160);
ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS numero VARCHAR(20);
ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS complemento VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS bairro VARCHAR(100);
ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS municipio VARCHAR(100);
ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS uf CHAR(2);
ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS cep VARCHAR(8);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_usuario_cpf_formato') THEN
        ALTER TABLE Usuarios ADD CONSTRAINT chk_usuario_cpf_formato
            CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_usuario_telefone_formato') THEN
        ALTER TABLE Usuarios ADD CONSTRAINT chk_usuario_telefone_formato
            CHECK (telefone IS NULL OR telefone ~ '^55[1-9][1-9][0-9]{9}$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_usuario_uf_formato') THEN
        ALTER TABLE Usuarios ADD CONSTRAINT chk_usuario_uf_formato
            CHECK (uf IS NULL OR uf ~ '^[A-Z]{2}$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_usuario_cep_formato') THEN
        ALTER TABLE Usuarios ADD CONSTRAINT chk_usuario_cep_formato
            CHECK (cep IS NULL OR (cep ~ '^[0-9]{8}$' AND cep <> '00000000'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organizacoes_cnpj
    ON Organizacoes(cnpj) WHERE cnpj IS NOT NULL;
