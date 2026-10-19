const db = require('../config/db');

exports.getTransactions = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Busca transações fazendo join para pegar nome da categoria/descrição/conta
    const query = `
      SELECT 
        t.id_transacao, 
        t.data_vencimento, 
        t.data_pagamento,
        t.valor_total, 
        t.tipo, 
        t.transacao_status,
        d.descricao, 
        c.nome_categoria as categoria,
        fp.forma_pagamento
      FROM Transacoes t
      LEFT JOIN Descricao d ON t.id_descricao = d.id_descricao
      LEFT JOIN Categoria c ON d.id_categoria = c.id_categoria
      LEFT JOIN Forma_Pagamento fp ON t.id_forma_pg = fp.id_forma_pg
      WHERE t.usuario_insercao = $1
      ORDER BY t.data_vencimento DESC
    `;
    
    const { rows } = await db.query(query, [userId]);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar transações:', error);
    res.status(500).json({ message: 'Erro ao buscar dados do orçamento' });
  }
};

exports.createTransaction = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { 
      data_vencimento, data_pagamento, competencia, valor_total, tipo, 
      transacao_status, descricao, id_categoria, id_forma_pg, id_conta, 
      parcela_atual, total_parcelas, observacao 
    } = req.body;

    // 1. Inserir ou buscar a Descrição (para manter a integridade da modelagem)
    let idDescricao = null;
    if (descricao) {
      // Tenta achar descrição existente para esta categoria, ou cria uma nova
      const descResult = await db.query(
        'INSERT INTO Descricao (descricao, id_categoria, usuario_criacao) VALUES ($1, $2, $3) RETURNING id_descricao',
        [descricao, id_categoria, userId]
      );
      idDescricao = descResult.rows[0].id_descricao;
    }

    // 2. Inserir a Transação
    const insertQuery = `
      INSERT INTO Transacoes 
        (usuario_insercao, data_vencimento, data_pagamento, competencia, id_descricao, valor_total, tipo, transacao_status, id_forma_pg, id_conta, parcela_atual, total_parcelas, observacao)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    const { rows } = await db.query(insertQuery, [
      userId, data_vencimento, data_pagamento, competencia, idDescricao, valor_total, tipo, transacao_status, id_forma_pg, id_conta, parcela_atual, total_parcelas, observacao
    ]);

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Erro ao criar transação:', error);
    res.status(500).json({ message: 'Erro ao registrar a transação' });
  }
};
