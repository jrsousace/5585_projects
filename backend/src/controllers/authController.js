const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

exports.register = async (req, res) => {
  const { nome, email, password } = req.body;

  try {
    // 1. Verificar se usuário já existe
    const userExists = await db.query('SELECT id_usuario FROM Usuarios WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'E-mail já cadastrado' });
    }

    // 2. Criptografar a senha
    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(password, salt);

    // 3. Inserir Usuário no banco e retornar o ID
    const insertQuery = `
      INSERT INTO Usuarios (nome, email, senha_hash, assinatura_plano) 
      VALUES ($1, $2, $3, $4) RETURNING id_usuario, nome, assinatura_plano
    `;
    const newUser = await db.query(insertQuery, [nome, email, senhaHash, 'basic']);
    const userId = newUser.rows[0].id_usuario;

    // 4. Seeding: Criar categorias padrão para este usuário
    const defaultCategories = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Lazer', 'Salário', 'Investimentos'];
    for (const cat of defaultCategories) {
      await db.query(
        'INSERT INTO Categoria (nome_categoria, usuario_criacao) VALUES ($1, $2)',
        [cat, userId]
      );
    }
    
    // 5. Seeding: Formas de Pagamento padrão
    const defaultPayments = ['Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'PIX', 'Transferência'];
    for (const pay of defaultPayments) {
      await db.query(
        'INSERT INTO Forma_Pagamento (forma_pagamento, usuario_criacao) VALUES ($1, $2)',
        [pay, userId]
      );
    }

    res.status(201).json({ message: 'Usuário registrado com sucesso', user: newUser.rows[0] });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ message: 'Erro interno no servidor' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Buscar usuário pelo email
    const { rows } = await db.query('SELECT * FROM Usuarios WHERE email = $1', [email]);
    
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    const userDB = rows[0];

    // 2. Comparar senha informada com a senha hasheada do banco
    const validPassword = await bcrypt.compare(password, userDB.senha_hash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    // 3. Montar payload do usuário
    const user = {
      id: userDB.id_usuario,
      name: userDB.nome,
      email: userDB.email,
      subscription: {
        plan: userDB.assinatura_plano,
        active: true,
        // Provisório: liberando todos se for PRO, ou nada se for basic
        modules: userDB.assinatura_plano === 'pro' ? ['budget', 'investments'] : []
      }
    };

    // 4. Gerar Token JWT
    const token = jwt.sign(
      { userId: user.id, plan: user.subscription.plan },
      process.env.JWT_SECRET || 'secret_fallback',
      { expiresIn: '8h' }
    );

    return res.json({ token, user });
    
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ message: 'Erro interno no servidor' });
  }
};

const pool = require('../config/db');
// const bcrypt = require('bcrypt'); // Usaremos para gerar o senha_hash

exports.registrarUsuario = async (req, res) => {
    const { nome, email, senha } = req.body;
    
    // Solicitamos um 'cliente' exclusivo do pool para fazer a transação
    const client = await pool.connect();

    try {
        // 1. Inicia a Transação (Se algo falhar daqui para baixo, NADA é salvo)
        await client.query('BEGIN'); 

        // 2. Cria o usuário e resgata o UUID gerado
        const insertUserQuery = `
            INSERT INTO Usuarios (nome, email, senha_hash) 
            VALUES ($1, $2, $3) RETURNING id_usuario
        `;
        // const senhaHash = await bcrypt.hash(senha, 10);
        const userResult = await client.query(insertUserQuery, [nome, email, senha /* usar senhaHash depois */]);
        const novoIdUsuario = userResult.rows[0].id_usuario;

        // 3. SEEDING: Injeta as Categorias Padrão amarradas a esse usuário
        const insertCategorias = `
            INSERT INTO Categoria (nome_categoria, usuario_criacao) VALUES 
            ('Moradia', $1), ('Alimentação', $1), ('Transporte', $1), ('Lazer', $1)
        `;
        await client.query(insertCategorias, [novoIdUsuario]);

        // 4. SEEDING: Injeta as Formas de Pagamento Padrão
        const insertFormasPg = `
            INSERT INTO Forma_Pagamento (forma_pagamento, usuario_criacao) VALUES 
            ('PIX', $1), ('Cartão de Crédito', $1), ('Dinheiro', $1)
        `;
        await client.query(insertFormasPg, [novoIdUsuario]);

        // 5. Confirma a transação (Salva tudo definitivamente)
        await client.query('COMMIT');
        
        res.status(201).json({ message: "Conta criada e configurada com sucesso!" });

    } catch (error) {
        // Se der erro (ex: email já existe), desfaz qualquer tabela criada no meio do caminho
        await client.query('ROLLBACK');
        console.error("Erro no registro:", error);
        res.status(500).json({ error: "Falha ao criar a conta." });
    } finally {
        // Devolve o cliente para o Pool
        client.release();
    }
};