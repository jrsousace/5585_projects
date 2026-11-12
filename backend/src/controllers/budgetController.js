const db = require('../config/db');

exports.getTransactions = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    
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
      LEFT JOIN Descricao d ON t.id_descricao = d.id_descricao AND d.id_organizacao = t.id_organizacao
      LEFT JOIN Categoria c ON d.id_categoria = c.id_categoria AND c.id_organizacao = t.id_organizacao
      LEFT JOIN Forma_Pagamento fp ON t.id_forma_pg = fp.id_forma_pg AND fp.id_organizacao = t.id_organizacao
      WHERE t.id_organizacao = $1
      ORDER BY t.data_vencimento DESC
    `;
    
    const { rows } = await db.query(query, [organizationId]);
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar transações:', error);
    res.status(500).json({ message: 'Erro ao buscar dados do orçamento' });
  }
};

exports.createTransaction = async (req, res) => {
  let client;
  let transactionStarted = false;
  try {
    const userId = req.user.userId;
    const organizationId = req.user.organizationId;
    const { 
      data_vencimento, data_pagamento, competencia, valor_total, tipo, 
      transacao_status, descricao, id_categoria, id_forma_pg, id_conta, 
      parcela_atual, total_parcelas, observacao 
    } = req.body;

    client = await db.connect();
    await client.query('BEGIN');
    transactionStarted = true;

    for (const [table, column, value] of [
      ['Categoria', 'id_categoria', id_categoria],
      ['Forma_Pagamento', 'id_forma_pg', id_forma_pg],
      ['Conta', 'id_conta', id_conta]
    ]) {
      if (value) {
        const check = await client.query(
          `SELECT 1 FROM ${table} WHERE ${column} = $1 AND id_organizacao = $2`,
          [value, organizationId]
        );
        if (check.rowCount === 0) {
          await client.query('ROLLBACK');
          transactionStarted = false;
          return res.status(400).json({ message: 'Um ou mais itens vinculados não pertencem a esta organização.' });
        }
      }
    }

    // 1. Create a tenant-scoped description for the selected category.
    let idDescricao = null;
    if (descricao) {
      const descResult = await client.query(
        'INSERT INTO Descricao (descricao, id_categoria, usuario_criacao, id_organizacao) VALUES ($1, $2, $3, $4) RETURNING id_descricao',
        [descricao, id_categoria, userId, organizationId]
      );
      idDescricao = descResult.rows[0].id_descricao;
    }

    // 2. Inserir a Transação
    const insertQuery = `
      INSERT INTO Transacoes 
        (id_organizacao, usuario_insercao, data_vencimento, data_pagamento, competencia, id_descricao, valor_total, tipo, transacao_status, id_forma_pg, id_conta, parcela_atual, total_parcelas, observacao)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    const { rows } = await client.query(insertQuery, [
      organizationId, userId, data_vencimento, data_pagamento, competencia, idDescricao, valor_total, tipo, transacao_status, id_forma_pg, id_conta, parcela_atual, total_parcelas, observacao
    ]);

    await client.query('COMMIT');
    transactionStarted = false;
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Erro ao criar transação:', error);
    res.status(500).json({ message: 'Erro ao registrar a transação' });
  } finally {
    if (transactionStarted && client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Erro ao desfazer criação da transação:', rollbackError);
      }
    }
    if (client) client.release();
  }
};
