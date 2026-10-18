const db = require('../config/db');

// --- CATEGORIAS ---
exports.getCategorias = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { rows } = await db.query('SELECT * FROM Categoria WHERE usuario_criacao = $1 ORDER BY nome_categoria', [userId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar categorias' });
  }
};

exports.createCategoria = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { nome_categoria } = req.body;
    const { rows } = await db.query(
      'INSERT INTO Categoria (nome_categoria, usuario_criacao) VALUES ($1, $2) RETURNING *',
      [nome_categoria, userId]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao criar categoria' });
  }
};

// --- FORMAS DE PAGAMENTO ---
exports.getFormasPagamento = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { rows } = await db.query('SELECT * FROM Forma_Pagamento WHERE usuario_criacao = $1', [userId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar formas de pagamento' });
  }
};

// --- CONTAS ---
exports.getContas = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { rows } = await db.query('SELECT * FROM Conta WHERE usuario_criacao = $1', [userId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar contas' });
  }
};

exports.createConta = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { conta, banco, num_conta } = req.body;
    const { rows } = await db.query(
      'INSERT INTO Conta (conta, banco, num_conta, usuario_criacao) VALUES ($1, $2, $3, $4) RETURNING *',
      [conta, banco, num_conta, userId]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao criar conta' });
  }
};
