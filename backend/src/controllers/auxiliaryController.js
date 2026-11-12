const db = require('../config/db');

// --- CATEGORIAS ---
exports.getCategorias = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM Categoria WHERE id_organizacao = $1 ORDER BY nome_categoria',
      [req.user.organizationId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar categorias:', error);
    res.status(500).json({ message: 'Erro ao buscar categorias' });
  }
};

exports.createCategoria = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { nome_categoria } = req.body;
    const { rows } = await db.query(
      'INSERT INTO Categoria (nome_categoria, usuario_criacao, id_organizacao) VALUES ($1, $2, $3) RETURNING *',
      [nome_categoria, userId, req.user.organizationId]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Erro ao criar categoria:', error);
    res.status(500).json({ message: 'Erro ao criar categoria' });
  }
};

// --- FORMAS DE PAGAMENTO ---
exports.getFormasPagamento = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM Forma_Pagamento WHERE id_organizacao = $1 ORDER BY forma_pagamento',
      [req.user.organizationId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar formas de pagamento:', error);
    res.status(500).json({ message: 'Erro ao buscar formas de pagamento' });
  }
};

// --- CONTAS ---
exports.getContas = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM Conta WHERE id_organizacao = $1 ORDER BY conta',
      [req.user.organizationId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar contas:', error);
    res.status(500).json({ message: 'Erro ao buscar contas' });
  }
};

exports.createConta = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { conta, banco, num_conta } = req.body;
    const { rows } = await db.query(
      'INSERT INTO Conta (conta, banco, num_conta, usuario_criacao, id_organizacao) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [conta, banco, num_conta, userId, req.user.organizationId]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Erro ao criar conta:', error);
    res.status(500).json({ message: 'Erro ao criar conta' });
  }
};

// --- BANCOS ---
exports.getBancos = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT compe, ispb, nome_curto, nome_completo FROM Bancos ORDER BY nome_completo');
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar lista de bancos:', error);
    res.status(500).json({ message: 'Erro ao buscar lista de bancos' });
  }
};
