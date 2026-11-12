const db = require('../config/db');

exports.getInvestments = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const query = `
      SELECT i.*, t.tipo as nome_tipo_investimento
      FROM Investimentos i
      LEFT JOIN Tipo_Investimento t
        ON i.id_tipo_investimento = t.id_tipo_investimento
       AND t.id_organizacao = i.id_organizacao
      WHERE i.id_organizacao = $1
      ORDER BY i.data_aplicacao DESC
    `;
    const { rows } = await db.query(query, [organizationId]);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar investimentos:', error);
    res.status(500).json({ message: 'Erro ao buscar carteira de investimentos' });
  }
};

exports.createInvestment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const organizationId = req.user.organizationId;
    const { 
      ativo, data_aplicacao, valor_investido, rentabilidade_esperada, 
      vencimento, id_tipo_investimento, id_conta, quantidade, preco_unitario, 
      indexador, taxa_contratada 
    } = req.body;

    for (const [table, column, value] of [
      ['Tipo_Investimento', 'id_tipo_investimento', id_tipo_investimento],
      ['Conta', 'id_conta', id_conta]
    ]) {
      if (value) {
        const check = await db.query(
          `SELECT 1 FROM ${table} WHERE ${column} = $1 AND id_organizacao = $2`,
          [value, organizationId]
        );
        if (check.rowCount === 0) {
          return res.status(400).json({ message: 'Um ou mais itens vinculados não pertencem a esta organização.' });
        }
      }
    }

    const insertQuery = `
      INSERT INTO Investimentos 
        (id_organizacao, ativo, data_aplicacao, valor_investido, rentabilidade_esperada, vencimento, id_tipo_investimento, usuario_insercao, id_conta, quantidade, preco_unitario, indexador, taxa_contratada)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    const { rows } = await db.query(insertQuery, [
      organizationId, ativo, data_aplicacao, valor_investido, rentabilidade_esperada, vencimento, id_tipo_investimento, userId, id_conta, quantidade, preco_unitario, indexador, taxa_contratada
    ]);

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Erro ao registrar investimento:', error);
    res.status(500).json({ message: 'Erro ao registrar investimento' });
  }
};
