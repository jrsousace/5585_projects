require('dotenv').config(); // Para ler suas senhas do .env
const pool = require('../config/db'); // Aquele arquivo que criamos antes

async function sincronizarBancos() {
    console.log("🔄 Iniciando sincronização com a lista de bancos do Bacen (via BrasilAPI)...");

    try {
        // 1. Busca os dados na BrasilAPI (usando o fetch nativo do Node)
        const response = await fetch('https://brasilapi.com.br/api/banks/v1');
        const bancos = await response.json();

        // 2. Filtra apenas os bancos válidos (algumas corretoras não têm COMPE/code)
        const bancosValidos = bancos.filter(b => b.code != null);

        console.log(`🏦 Encontrados ${bancosValidos.length} bancos. Inserindo no banco de dados...`);

        // 3. Conecta ao banco de dados
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 4. Prepara a query com ON CONFLICT (Se o banco já existir, ele só atualiza)
            const upsertQuery = `
                INSERT INTO Bancos (compe, ispb, nome_curto, nome_completo) 
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (compe) 
                DO UPDATE SET 
                    nome_curto = EXCLUDED.nome_curto,
                    nome_completo = EXCLUDED.nome_completo,
                    timestamp_atualizacao = CURRENT_TIMESTAMP;
            `;

            // 5. Roda o loop de inserção
            for (const banco of bancosValidos) {
                // Padroniza o código COMPE para 3 dígitos (ex: 1 vira '001')
                const compeFormatado = String(banco.code).padStart(3, '0');
                
                await client.query(upsertQuery, [
                    compeFormatado, 
                    banco.ispb, 
                    banco.name, 
                    banco.fullName
                ]);
            }

            await client.query('COMMIT');
            console.log("✅ Sincronização de bancos concluída com sucesso!");

        } catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error("❌ Erro ao sincronizar bancos:", error.message);
    } finally {
        // Encerra a conexão para o script não ficar travado no terminal
        pool.end();
    }
}

// Executa a função
sincronizarBancos();