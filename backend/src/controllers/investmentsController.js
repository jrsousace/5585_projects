const db = require('../config/db');

exports.getInvestments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const query = `
      SELECT i.*, t.tipo as nome_tipo_investimento
      FROM Investimentos i
      LEFT JOIN Tipo_Investimento t ON i.id_tipo_investimento = t.id_tipo_investimento
      WHERE i.usuario_insercao = $1
      ORDER BY i.data_aplicacao DESC
    `;
    const { rows } = await db.query(query, [userId]);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar investimentos:', error);
    res.status(500).json({ message: 'Erro ao buscar carteira de investimentos' });
  }
};

exports.createInvestment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { ativo, data_aplicacao, valor_investido, rentabilidade_esperada, vencimento, id_tipo_investimento } = req.body;

    const insertQuery = `
      INSERT INTO Investimentos 
        (ativo, data_aplicacao, valor_investido, rentabilidade_esperada, vencimento, id_tipo_investimento, usuario_insercao)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const { rows } = await db.query(insertQuery, [
      ativo, data_aplicacao, valor_investido, rentabilidade_esperada, vencimento, id_tipo_investimento, userId
    ]);

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Erro ao registrar investimento:', error);
    res.status(500).json({ message: 'Erro ao registrar investimento' });
  }
};
