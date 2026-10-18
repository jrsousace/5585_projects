-- Estrutura de banco de dados para o SaaS Financeiro (PostgreSQL)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Modulo Base / Core
CREATE TABLE IF NOT EXISTS Usuarios (
    id_usuario UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    assinatura_plano VARCHAR(50) DEFAULT 'basic',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Módulo Orçamento Doméstico
CREATE TABLE IF NOT EXISTS Categoria (
    id_categoria UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome_categoria VARCHAR(100) NOT NULL,
    timestamp_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_criacao UUID REFERENCES Usuarios(id_usuario),
    timestamp_atualizacao TIMESTAMP,
    usuario_atualizacao UUID REFERENCES Usuarios(id_usuario)
);

CREATE TABLE IF NOT EXISTS Grupo (
    id_grupo UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grupo VARCHAR(100) NOT NULL,
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

CREATE TABLE IF NOT EXISTS Centro_Custo (
    id_cc UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    centro_custo VARCHAR(100) NOT NULL,
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
    timestamp_insercao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_insercao UUID REFERENCES Usuarios(id_usuario),
    data_evento DATE NOT NULL,
    competencia VARCHAR(7), -- Formato 'MM-YYYY'
    id_descricao UUID REFERENCES Descricao(id_descricao),
    valor_total DECIMAL(15, 2) NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- 'receita' ou 'despesa'
    saldo DECIMAL(15, 2),
    status VARCHAR(50),
    id_forma_pg UUID REFERENCES Forma_Pagamento(id_forma_pg),
    timestamp_atualizacao TIMESTAMP,
    usuario_atualizacao UUID REFERENCES Usuarios(id_usuario),
    id_conta UUID REFERENCES Conta(id_conta)
);

-- Módulo Investimentos
CREATE TABLE IF NOT EXISTS Tipo_Investimento (
    id_tipo_investimento UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS Investimentos (
    id_investimento UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ativo VARCHAR(100) NOT NULL,
    data_aplicacao DATE NOT NULL,
    valor_investido DECIMAL(15, 2) NOT NULL,
    rentabilidade_esperada DECIMAL(8, 4),
    vencimento DATE,
    id_tipo_investimento UUID REFERENCES Tipo_Investimento(id_tipo_investimento),
    usuario_insercao UUID REFERENCES Usuarios(id_usuario)
);
