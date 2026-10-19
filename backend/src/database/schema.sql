-- Estrutura de banco de dados para o SaaS Financeiro (PostgreSQL)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Modulo Base / Core
CREATE TABLE IF NOT EXISTS Usuarios (
    id_usuario UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    assinatura_plano VARCHAR(50) DEFAULT 'basic',
    status_conta VARCHAR(50) DEFAULT 'ativo',
    deleted_at TIMESTAMP,
    timestamp_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    timestamp_atualizacao TIMESTAMP
);

-- Módulo Orçamento Doméstico
CREATE TABLE IF NOT EXISTS Centro_Custo (
    id_cc UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    centro_custo VARCHAR(100) NOT NULL,
    timestamp_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_criacao UUID REFERENCES Usuarios(id_usuario),
    timestamp_atualizacao TIMESTAMP,
    usuario_atualizacao UUID REFERENCES Usuarios(id_usuario)
);

CREATE TABLE IF NOT EXISTS Grupo (
    id_grupo UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grupo VARCHAR(100) NOT NULL,
    id_cc UUID REFERENCES Centro_Custo(id_cc),
    timestamp_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_criacao UUID REFERENCES Usuarios(id_usuario),
    timestamp_atualizacao TIMESTAMP,
    usuario_atualizacao UUID REFERENCES Usuarios(id_usuario)
);

CREATE TABLE IF NOT EXISTS Categoria (
    id_categoria UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome_categoria VARCHAR(100) NOT NULL,
    id_grupo UUID REFERENCES Grupo(id_grupo),
    timestamp_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_criacao UUID REFERENCES Usuarios(id_usuario),
    timestamp_atualizacao TIMESTAMP,
    usuario_atualizacao UUID REFERENCES Usuarios(id_usuario)
);

CREATE TABLE IF NOT EXISTS Forma_Pagamento (
    id_forma_pg UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    forma_pagamento VARCHAR(100) NOT NULL,
    timestamp_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_criacao UUID REFERENCES Usuarios(id_usuario),
    timestamp_atualizacao TIMESTAMP,
    usuario_atualizacao UUID REFERENCES Usuarios(id_usuario)
);

CREATE TABLE IF NOT EXISTS Conta (
    id_conta UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    tipo VARCHAR(100) NOT NULL,
    usuario_criacao UUID REFERENCES Usuarios(id_usuario),
    timestamp_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_atualizacao UUID REFERENCES Usuarios(id_usuario),
    timestamp_atualizacao TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Investimentos (
    id_investimento UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_conta UUID REFERENCES Conta(id_conta), -- Conta onde o investimento foi realizado
    ativo VARCHAR(100) NOT NULL, 
    data_aplicacao DATE NOT NULL,
    quantidade DECIMAL(15, 8) NOT NULL, 
    preco_unitario DECIMAL(15, 4) NOT NULL, 
    valor_investido DECIMAL(15, 2) NOT NULL, 
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
CREATE INDEX idx_transacoes_usuario ON Transacoes(usuario_insercao);
CREATE INDEX idx_investimentos_usuario ON Investimentos(usuario_insercao);
CREATE INDEX idx_categorias_usuario ON Categoria(usuario_criacao);
CREATE INDEX idx_contas_usuario ON Conta(usuario_criacao);

-- Índices para Dashboards (Buscas por data e competência são constantes)
CREATE INDEX idx_transacoes_data ON Transacoes(data_vencimento);
CREATE INDEX idx_transacoes_competencia ON Transacoes(competencia);
CREATE INDEX idx_investimentos_data ON Investimentos(data_aplicacao);

-- Índices para busca rápida de bancos
CREATE INDEX idx_bancos_nome_curto ON Bancos(nome_curto);
CREATE INDEX idx_bancos_nome_completo ON Bancos(nome_completo);
CREATE INDEX idx_orcamentos_usuario ON Orcamentos(usuario_criacao);
CREATE INDEX idx_metas_usuario ON Metas(usuario_criacao);