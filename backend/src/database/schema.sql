-- Estrutura de banco de dados para o SaaS Financeiro (PostgreSQL)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS Organizacoes (
    id_organizacao UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    assinatura_plano VARCHAR(50) NOT NULL DEFAULT 'basic',
    assinatura_status VARCHAR(20) NOT NULL DEFAULT 'free',
    assinatura_expira_em TIMESTAMPTZ,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    tipo_cadastro VARCHAR(2) NOT NULL DEFAULT 'pf' CHECK (tipo_cadastro IN ('pf', 'pj')),
    cnpj VARCHAR(14),
    razao_social VARCHAR(255),
    nome_fantasia VARCHAR(255),
    timestamp_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_organizacao_assinatura_status
        CHECK (assinatura_status IN ('free', 'active', 'expired', 'canceled')),
    CHECK (cnpj IS NULL OR cnpj ~ '^[A-Z0-9]{12}[0-9]{2}$'),
    CHECK (
        tipo_cadastro <> 'pj' OR (
            cnpj IS NOT NULL AND
            razao_social IS NOT NULL AND BTRIM(razao_social) <> '' AND
            nome_fantasia IS NOT NULL AND BTRIM(nome_fantasia) <> ''
        )
    )
);
CREATE INDEX IF NOT EXISTS idx_organizacoes_cnpj ON Organizacoes(cnpj) WHERE cnpj IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizacoes_stripe_subscription
    ON Organizacoes(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizacoes_stripe_customer
    ON Organizacoes(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Modulo Base / Core
CREATE TABLE IF NOT EXISTS Usuarios (
    id_usuario UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_organizacao UUID NOT NULL REFERENCES Organizacoes(id_organizacao),
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    access_role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (access_role IN ('user', 'master')),
    organization_role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (organization_role IN ('owner', 'member')),
    access_level VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (access_level IN ('manager', 'user', 'reader')),
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(permissions) = 'object'),
    email_verified BOOLEAN NOT NULL DEFAULT TRUE,
    token_version INTEGER NOT NULL DEFAULT 0,
    cpf VARCHAR(11) NOT NULL,
    data_nascimento DATE NOT NULL,
    telefone VARCHAR(13) NOT NULL,
    logradouro VARCHAR(160) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    complemento VARCHAR(100) NOT NULL DEFAULT '',
    bairro VARCHAR(100) NOT NULL,
    municipio VARCHAR(100) NOT NULL,
    uf CHAR(2) NOT NULL,
    cep VARCHAR(8) NOT NULL,
    status_conta VARCHAR(50) DEFAULT 'ativo',
    deleted_at TIMESTAMP,
    timestamp_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    timestamp_atualizacao TIMESTAMP,
    CHECK (cpf ~ '^[0-9]{11}$'),
    CHECK (telefone ~ '^55[1-9][1-9][0-9]{9}$'),
    CHECK (uf ~ '^[A-Z]{2}$'),
    CHECK (cep ~ '^[0-9]{8}$' AND cep <> '00000000')
);

CREATE TABLE IF NOT EXISTS Convites_Organizacao (
    id_convite UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_organizacao UUID NOT NULL REFERENCES Organizacoes(id_organizacao) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    nome VARCHAR(120) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    permissions JSONB NOT NULL CHECK (jsonb_typeof(permissions) = 'object'),
    access_level VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (access_level IN ('manager', 'user', 'reader')),
    criado_por UUID NOT NULL REFERENCES Usuarios(id_usuario),
    timestamp_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    timestamp_expiracao TIMESTAMP NOT NULL,
    timestamp_aceitacao TIMESTAMP
);

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
CREATE UNIQUE INDEX IF NOT EXISTS idx_convite_pendente_email
    ON Convites_Organizacao(id_organizacao, LOWER(email))
    WHERE timestamp_aceitacao IS NULL;

-- Módulo Orçamento Doméstico
CREATE TABLE IF NOT EXISTS Centro_Custo (
    id_cc UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_organizacao UUID NOT NULL REFERENCES Organizacoes(id_organizacao),
    centro_custo VARCHAR(100) NOT NULL,
    timestamp_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_criacao UUID REFERENCES Usuarios(id_usuario),
    timestamp_atualizacao TIMESTAMP,
    usuario_atualizacao UUID REFERENCES Usuarios(id_usuario)
);

CREATE TABLE IF NOT EXISTS Grupo (
    id_grupo UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_organizacao UUID NOT NULL REFERENCES Organizacoes(id_organizacao),
    grupo VARCHAR(100) NOT NULL,
    id_cc UUID REFERENCES Centro_Custo(id_cc),
    timestamp_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_criacao UUID REFERENCES Usuarios(id_usuario),
    timestamp_atualizacao TIMESTAMP,
    usuario_atualizacao UUID REFERENCES Usuarios(id_usuario)
);

CREATE TABLE IF NOT EXISTS Categoria (
    id_categoria UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_organizacao UUID NOT NULL REFERENCES Organizacoes(id_organizacao),
    nome_categoria VARCHAR(100) NOT NULL,
    id_grupo UUID REFERENCES Grupo(id_grupo),
    timestamp_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_criacao UUID REFERENCES Usuarios(id_usuario),
    timestamp_atualizacao TIMESTAMP,
    usuario_atualizacao UUID REFERENCES Usuarios(id_usuario)
);

CREATE TABLE IF NOT EXISTS Forma_Pagamento (
    id_forma_pg UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_organizacao UUID NOT NULL REFERENCES Organizacoes(id_organizacao),
    forma_pagamento VARCHAR(100) NOT NULL,
    timestamp_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_criacao UUID REFERENCES Usuarios(id_usuario),
    timestamp_atualizacao TIMESTAMP,
    usuario_atualizacao UUID REFERENCES Usuarios(id_usuario)
);

CREATE TABLE IF NOT EXISTS Conta (
    id_conta UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_organizacao UUID NOT NULL REFERENCES Organizacoes(id_organizacao),
    conta VARCHAR(100) NOT NULL,
    id_cc UUID REFERENCES Centro_Custo(id_cc),
    codigo_banco VARCHAR(20),
    banco VARCHAR(100),
    agencia VARCHAR(20),
    num_conta VARCHAR(50),
    digito VARCHAR(10),
    timestamp_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_criacao UUID REFERENCES Usuarios(id_usuario),
    timestamp_atualizacao TIMESTAMP,
    usuario_atualizacao UUID REFERENCES Usuarios(id_usuario)
);

CREATE TABLE IF NOT EXISTS Descricao (
    id_descricao UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_organizacao UUID NOT NULL REFERENCES Organizacoes(id_organizacao),
    descricao VARCHAR(255) NOT NULL,
    id_categoria UUID REFERENCES Categoria(id_categoria),
    id_grupo UUID REFERENCES Grupo(id_grupo),
    timestamp_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_criacao UUID REFERENCES Usuarios(id_usuario),
    timestamp_atualizacao TIMESTAMP,
    usuario_atualizacao UUID REFERENCES Usuarios(id_usuario)
);

CREATE TABLE IF NOT EXISTS Transacoes (
    id_transacao UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_organizacao UUID NOT NULL REFERENCES Organizacoes(id_organizacao),
    usuario_insercao UUID REFERENCES Usuarios(id_usuario),
    timestamp_insercao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Controle de Datas
    data_vencimento DATE NOT NULL,
    data_pagamento DATE, -- Pode ser NULL se o status for 'pendente'
    competencia VARCHAR(7), -- Formato 'MM-YYYY'
    
    id_descricao UUID REFERENCES Descricao(id_descricao),
    valor_total DECIMAL(15, 2) NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- 'receita' ou 'despesa'
    
    -- Controle de Parcelas e Metadados
    parcela_atual INT DEFAULT 1,
    total_parcelas INT DEFAULT 1,
    observacao TEXT,
    
    transacao_status VARCHAR(50), -- 'pago', 'pendente', 'atrasado'
    id_forma_pg UUID REFERENCES Forma_Pagamento(id_forma_pg),
    id_conta UUID REFERENCES Conta(id_conta),
    
    usuario_atualizacao UUID REFERENCES Usuarios(id_usuario),
    timestamp_atualizacao TIMESTAMP
);

-- Módulo Investimentos
CREATE TABLE IF NOT EXISTS Tipo_Investimento (
    id_tipo_investimento UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_organizacao UUID NOT NULL REFERENCES Organizacoes(id_organizacao),
    tipo VARCHAR(100) NOT NULL,
    usuario_criacao UUID REFERENCES Usuarios(id_usuario),
    timestamp_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_atualizacao UUID REFERENCES Usuarios(id_usuario),
    timestamp_atualizacao TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Investimentos (
    id_investimento UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_organizacao UUID NOT NULL REFERENCES Organizacoes(id_organizacao),
    id_conta UUID REFERENCES Conta(id_conta), -- Conta onde o investimento foi realizado
    ativo VARCHAR(100) NOT NULL, 
    data_aplicacao DATE NOT NULL,
    quantidade DECIMAL(15, 8) NOT NULL, 
    preco_unitario DECIMAL(15, 4) NOT NULL, 
    valor_investido DECIMAL(15, 2) NOT NULL, 
    rentabilidade_esperada DECIMAL(8, 4),
    indexador VARCHAR(50), 
    taxa_contratada DECIMAL(8, 4), 
    vencimento DATE,
    cotacao_atual DECIMAL(15, 4), 
    data_ultima_cotacao TIMESTAMP,
    id_tipo_investimento UUID REFERENCES Tipo_Investimento(id_tipo_investimento),
    usuario_insercao UUID REFERENCES Usuarios(id_usuario),
    timestamp_insercao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_atualizacao UUID REFERENCES Usuarios(id_usuario),
    timestamp_atualizacao TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Bancos (
    compe VARCHAR(10) PRIMARY KEY, -- O código de 3 dígitos (ex: 341 para Itaú)
    ispb VARCHAR(8) NOT NULL,      -- Código usado no PIX
    nome_curto VARCHAR(100),
    nome_completo VARCHAR(255),
    timestamp_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Orçamentos (Limites de gastos mensais por Categoria)
CREATE TABLE IF NOT EXISTS Orcamentos (
    id_orcamento UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_organizacao UUID NOT NULL REFERENCES Organizacoes(id_organizacao),
    usuario_criacao UUID REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
    id_categoria UUID REFERENCES Categoria(id_categoria) ON DELETE CASCADE,
    valor_limite DECIMAL(15, 2) NOT NULL,
    -- Se 'competencia' for nulo, é um limite fixo para todos os meses. 
    -- Se preenchido (ex: '12-2026'), vale só para aquele mês específico.
    competencia VARCHAR(7), 
    timestamp_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    timestamp_atualizacao TIMESTAMP
);

-- Tabela de Metas (Cofrinhos e Objetivos de Longo Prazo)
CREATE TABLE IF NOT EXISTS Metas (
    id_meta UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_organizacao UUID NOT NULL REFERENCES Organizacoes(id_organizacao),
    usuario_criacao UUID REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
    nome_meta VARCHAR(100) NOT NULL,
    valor_alvo DECIMAL(15, 2) NOT NULL,
    saldo_acumulado DECIMAL(15, 2) DEFAULT 0.00,
    data_alvo DATE, -- Data limite para atingir a meta
    status_meta VARCHAR(20) DEFAULT 'em_andamento', -- 'em_andamento', 'concluida', 'pausada'
    timestamp_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    timestamp_atualizacao TIMESTAMP
);

-- Índices para isolamento de dados (Multi-tenant)
CREATE INDEX IF NOT EXISTS idx_usuarios_organizacao ON Usuarios(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_convites_organizacao ON Convites_Organizacao(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_centros_custo_organizacao ON Centro_Custo(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_grupos_organizacao ON Grupo(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_formas_pagamento_organizacao ON Forma_Pagamento(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_descricoes_organizacao ON Descricao(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_transacoes_organizacao ON Transacoes(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_tipos_investimento_organizacao ON Tipo_Investimento(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_investimentos_organizacao ON Investimentos(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_categorias_organizacao ON Categoria(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_contas_organizacao ON Conta(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_orcamentos_organizacao ON Orcamentos(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_metas_organizacao ON Metas(id_organizacao);
CREATE INDEX IF NOT EXISTS idx_transacoes_usuario ON Transacoes(usuario_insercao);
CREATE INDEX IF NOT EXISTS idx_investimentos_usuario ON Investimentos(usuario_insercao);
CREATE INDEX IF NOT EXISTS idx_categorias_usuario ON Categoria(usuario_criacao);
CREATE INDEX IF NOT EXISTS idx_contas_usuario ON Conta(usuario_criacao);

-- Índices para Dashboards (Buscas por data e competência são constantes)
CREATE INDEX IF NOT EXISTS idx_transacoes_data ON Transacoes(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_transacoes_competencia ON Transacoes(competencia);
CREATE INDEX IF NOT EXISTS idx_investimentos_data ON Investimentos(data_aplicacao);

-- Índices para busca rápida de bancos
CREATE INDEX IF NOT EXISTS idx_bancos_nome_curto ON Bancos(nome_curto);
CREATE INDEX IF NOT EXISTS idx_bancos_nome_completo ON Bancos(nome_completo);
CREATE INDEX IF NOT EXISTS idx_orcamentos_usuario ON Orcamentos(usuario_criacao);
CREATE INDEX IF NOT EXISTS idx_metas_usuario ON Metas(usuario_criacao);

CREATE UNIQUE INDEX IF NOT EXISTS idx_centro_custo_id_organizacao ON Centro_Custo(id_cc, id_organizacao);
CREATE UNIQUE INDEX IF NOT EXISTS idx_grupo_id_organizacao ON Grupo(id_grupo, id_organizacao);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categoria_id_organizacao ON Categoria(id_categoria, id_organizacao);
CREATE UNIQUE INDEX IF NOT EXISTS idx_forma_pagamento_id_organizacao ON Forma_Pagamento(id_forma_pg, id_organizacao);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conta_id_organizacao ON Conta(id_conta, id_organizacao);
CREATE UNIQUE INDEX IF NOT EXISTS idx_descricao_id_organizacao ON Descricao(id_descricao, id_organizacao);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tipo_investimento_id_organizacao ON Tipo_Investimento(id_tipo_investimento, id_organizacao);
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_id_organizacao ON Usuarios(id_usuario, id_organizacao);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_grupo_cc_organizacao') THEN
        ALTER TABLE Grupo ADD CONSTRAINT fk_grupo_cc_organizacao
            FOREIGN KEY (id_cc, id_organizacao) REFERENCES Centro_Custo(id_cc, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_centro_custo_usuario_organizacao') THEN
        ALTER TABLE Centro_Custo ADD CONSTRAINT fk_centro_custo_usuario_organizacao
            FOREIGN KEY (usuario_criacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_centro_custo_atualizacao_organizacao') THEN
        ALTER TABLE Centro_Custo ADD CONSTRAINT fk_centro_custo_atualizacao_organizacao
            FOREIGN KEY (usuario_atualizacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_grupo_usuario_organizacao') THEN
        ALTER TABLE Grupo ADD CONSTRAINT fk_grupo_usuario_organizacao
            FOREIGN KEY (usuario_criacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_grupo_atualizacao_organizacao') THEN
        ALTER TABLE Grupo ADD CONSTRAINT fk_grupo_atualizacao_organizacao
            FOREIGN KEY (usuario_atualizacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_categoria_grupo_organizacao') THEN
        ALTER TABLE Categoria ADD CONSTRAINT fk_categoria_grupo_organizacao
            FOREIGN KEY (id_grupo, id_organizacao) REFERENCES Grupo(id_grupo, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_categoria_usuario_organizacao') THEN
        ALTER TABLE Categoria ADD CONSTRAINT fk_categoria_usuario_organizacao
            FOREIGN KEY (usuario_criacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_categoria_atualizacao_organizacao') THEN
        ALTER TABLE Categoria ADD CONSTRAINT fk_categoria_atualizacao_organizacao
            FOREIGN KEY (usuario_atualizacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_forma_usuario_organizacao') THEN
        ALTER TABLE Forma_Pagamento ADD CONSTRAINT fk_forma_usuario_organizacao
            FOREIGN KEY (usuario_criacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_forma_atualizacao_organizacao') THEN
        ALTER TABLE Forma_Pagamento ADD CONSTRAINT fk_forma_atualizacao_organizacao
            FOREIGN KEY (usuario_atualizacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_conta_cc_organizacao') THEN
        ALTER TABLE Conta ADD CONSTRAINT fk_conta_cc_organizacao
            FOREIGN KEY (id_cc, id_organizacao) REFERENCES Centro_Custo(id_cc, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_conta_usuario_organizacao') THEN
        ALTER TABLE Conta ADD CONSTRAINT fk_conta_usuario_organizacao
            FOREIGN KEY (usuario_criacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_conta_atualizacao_organizacao') THEN
        ALTER TABLE Conta ADD CONSTRAINT fk_conta_atualizacao_organizacao
            FOREIGN KEY (usuario_atualizacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_descricao_categoria_organizacao') THEN
        ALTER TABLE Descricao ADD CONSTRAINT fk_descricao_categoria_organizacao
            FOREIGN KEY (id_categoria, id_organizacao) REFERENCES Categoria(id_categoria, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_descricao_grupo_organizacao') THEN
        ALTER TABLE Descricao ADD CONSTRAINT fk_descricao_grupo_organizacao
            FOREIGN KEY (id_grupo, id_organizacao) REFERENCES Grupo(id_grupo, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_descricao_usuario_organizacao') THEN
        ALTER TABLE Descricao ADD CONSTRAINT fk_descricao_usuario_organizacao
            FOREIGN KEY (usuario_criacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_descricao_atualizacao_organizacao') THEN
        ALTER TABLE Descricao ADD CONSTRAINT fk_descricao_atualizacao_organizacao
            FOREIGN KEY (usuario_atualizacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transacao_descricao_organizacao') THEN
        ALTER TABLE Transacoes ADD CONSTRAINT fk_transacao_descricao_organizacao
            FOREIGN KEY (id_descricao, id_organizacao) REFERENCES Descricao(id_descricao, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transacao_usuario_organizacao') THEN
        ALTER TABLE Transacoes ADD CONSTRAINT fk_transacao_usuario_organizacao
            FOREIGN KEY (usuario_insercao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transacao_atualizacao_organizacao') THEN
        ALTER TABLE Transacoes ADD CONSTRAINT fk_transacao_atualizacao_organizacao
            FOREIGN KEY (usuario_atualizacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transacao_forma_organizacao') THEN
        ALTER TABLE Transacoes ADD CONSTRAINT fk_transacao_forma_organizacao
            FOREIGN KEY (id_forma_pg, id_organizacao) REFERENCES Forma_Pagamento(id_forma_pg, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transacao_conta_organizacao') THEN
        ALTER TABLE Transacoes ADD CONSTRAINT fk_transacao_conta_organizacao
            FOREIGN KEY (id_conta, id_organizacao) REFERENCES Conta(id_conta, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_investimento_conta_organizacao') THEN
        ALTER TABLE Investimentos ADD CONSTRAINT fk_investimento_conta_organizacao
            FOREIGN KEY (id_conta, id_organizacao) REFERENCES Conta(id_conta, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_investimento_tipo_organizacao') THEN
        ALTER TABLE Investimentos ADD CONSTRAINT fk_investimento_tipo_organizacao
            FOREIGN KEY (id_tipo_investimento, id_organizacao) REFERENCES Tipo_Investimento(id_tipo_investimento, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tipo_investimento_usuario_organizacao') THEN
        ALTER TABLE Tipo_Investimento ADD CONSTRAINT fk_tipo_investimento_usuario_organizacao
            FOREIGN KEY (usuario_criacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tipo_investimento_atualizacao_organizacao') THEN
        ALTER TABLE Tipo_Investimento ADD CONSTRAINT fk_tipo_investimento_atualizacao_organizacao
            FOREIGN KEY (usuario_atualizacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_investimento_usuario_organizacao') THEN
        ALTER TABLE Investimentos ADD CONSTRAINT fk_investimento_usuario_organizacao
            FOREIGN KEY (usuario_insercao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_investimento_atualizacao_organizacao') THEN
        ALTER TABLE Investimentos ADD CONSTRAINT fk_investimento_atualizacao_organizacao
            FOREIGN KEY (usuario_atualizacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orcamento_categoria_organizacao') THEN
        ALTER TABLE Orcamentos ADD CONSTRAINT fk_orcamento_categoria_organizacao
            FOREIGN KEY (id_categoria, id_organizacao) REFERENCES Categoria(id_categoria, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orcamento_usuario_organizacao') THEN
        ALTER TABLE Orcamentos ADD CONSTRAINT fk_orcamento_usuario_organizacao
            FOREIGN KEY (usuario_criacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_meta_usuario_organizacao') THEN
        ALTER TABLE Metas ADD CONSTRAINT fk_meta_usuario_organizacao
            FOREIGN KEY (usuario_criacao, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_convite_criador_organizacao') THEN
        ALTER TABLE Convites_Organizacao ADD CONSTRAINT fk_convite_criador_organizacao
            FOREIGN KEY (criado_por, id_organizacao) REFERENCES Usuarios(id_usuario, id_organizacao);
    END IF;
END $$;