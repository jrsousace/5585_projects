// const db = require('../config/db');

exports.getTransactions = async (req, res) => {
  try {
    // No ambiente real, faríamos a busca no DB:
    // const { rows } = await db.query('SELECT * FROM vw_transacoes WHERE id_usuario = $1', [req.user.id]);
    
    // Retorno hardcoded para validar o fluxo real Backend -> Frontend
    const mockDataFromAPI = [
      {
        id_transacao: 'uuid-db-1',
        data_evento: '2023-11-01',
        descricao: 'Internet (API Real)',
        categoria: 'Despesas Fixas',
        valor_total: 100.00,
        tipo: 'despesa'
      },
      {
        id_transacao: 'uuid-db-2',
        data_evento: '2023-11-05',
        descricao: 'Rendimento (API Real)',
        categoria: 'Investimentos',
        valor_total: 1500.00,
        tipo: 'receita'
      }
    ];

    res.json(mockDataFromAPI);
  } catch (error) {
    console.error('Erro ao buscar transações:', error);
    res.status(500).json({ message: 'Erro ao buscar dados do orçamento' });
  }
};
