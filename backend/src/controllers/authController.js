const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/db');
const {
  digitsOnly,
  validatePersonalRegistration,
  validateOrganizationRegistration
} = require('../validation/registrationValidation');
const { buildSubscription } = require('../utils/subscription');
const { createAuthToken } = require('../utils/authTokens');
const { getEmailConfiguration, sendVerificationEmail } = require('../utils/emailService');
const { setSessionCookie, sessionDurationMs } = require('../utils/sessionCookie');
const {
  loginKeys,
  checkLoginLimit,
  recordLoginFailure
} = require('../utils/loginRateLimit');

const isValidEmail = (email) =>
  typeof email === 'string' &&
  email.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

exports.register = async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body
    : {};
  const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
  const tipoCadastro = typeof body.tipo_cadastro === 'string' ? body.tipo_cadastro : '';
  const cpf = digitsOnly(body.cpf);
  const dataNascimento = typeof body.data_nascimento === 'string' ? body.data_nascimento : '';
  const telefone = digitsOnly(body.telefone);
  const logradouro = typeof body.logradouro === 'string' ? body.logradouro.trim() : '';
  const numero = typeof body.numero === 'string' ? body.numero.trim() : '';
  const complemento = typeof body.complemento === 'string' ? body.complemento.trim() : '';
  const bairro = typeof body.bairro === 'string' ? body.bairro.trim() : '';
  const municipio = typeof body.municipio === 'string' ? body.municipio.trim() : '';
  const uf = typeof body.uf === 'string' ? body.uf.toUpperCase() : '';
  const cep = digitsOnly(body.cep);
  const cnpj = typeof body.cnpj === 'string' && /^[a-z0-9./\-\s]+$/i.test(body.cnpj)
    ? body.cnpj.replace(/[^a-z0-9]/gi, '').toUpperCase()
    : '';
  const razaoSocial = typeof body.razao_social === 'string' ? body.razao_social.trim() : '';
  const nomeFantasia = typeof body.nome_fantasia === 'string' ? body.nome_fantasia.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const personalError = validatePersonalRegistration({
    nome,
    cpf,
    data_nascimento: dataNascimento,
    telefone,
    logradouro,
    numero,
    complemento,
    bairro,
    municipio,
    uf,
    cep
  });
  const organizationError = validateOrganizationRegistration({
    tipo_cadastro: tipoCadastro,
    cnpj,
    razao_social: razaoSocial,
    nome_fantasia: nomeFantasia
  });

  if (personalError || organizationError || !isValidEmail(email)) {
    return res.status(400).json({
      message: personalError || organizationError || 'Informe um e-mail válido.'
    });
  }
  if (!nome || nome.length > 120) {
    return res.status(400).json({ message: 'Informe um nome válido e um e-mail válido.' });
  }
  if ([...password].length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ message: 'A senha deve ter de 12 a 72 bytes.' });
  }

  let client;
  let transactionStarted = false;
  let verificationToken;

  try {
    getEmailConfiguration();
    client = await db.connect();
    await client.query('BEGIN');
    transactionStarted = true;

    const userExists = await client.query(
      'SELECT id_usuario FROM Usuarios WHERE LOWER(email) = $1 LIMIT 1',
      [email]
    );
    if (userExists.rows.length > 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(409).json({ message: 'Este e-mail já está cadastrado.' });
    }

    const organization = await client.query(
      `INSERT INTO Organizacoes
         (nome, assinatura_plano, tipo_cadastro, cnpj, razao_social, nome_fantasia)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_organizacao`,
      [
        tipoCadastro === 'pj' ? razaoSocial : nome,
        'basic',
        tipoCadastro,
        tipoCadastro === 'pj' ? cnpj : null,
        tipoCadastro === 'pj' ? razaoSocial : null,
        tipoCadastro === 'pj' ? nomeFantasia : null
      ]
    );
    const organizationId = organization.rows[0].id_organizacao;
    const senhaHash = await bcrypt.hash(password, 12);
    const insertUser = await client.query(
      `INSERT INTO Usuarios
         (id_organizacao, nome, email, senha_hash, organization_role, access_level,
          email_verified,
          cpf, data_nascimento, telefone, logradouro, numero, complemento, bairro, municipio, uf, cep)
       VALUES ($1, $2, $3, $4, 'owner', 'manager', FALSE, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id_usuario`,
      [
        organizationId, nome, email, senhaHash, cpf, dataNascimento, telefone,
        logradouro, numero, complemento, bairro, municipio, uf, cep
      ]
    );
    const userId = insertUser.rows[0].id_usuario;
    verificationToken = await createAuthToken(client, userId, 'verify_email');

    const ccPessoal = await client.query(
      'INSERT INTO Centro_Custo (centro_custo, usuario_criacao, id_organizacao) VALUES ($1, $2, $3) RETURNING id_cc',
      ['Pessoal', userId, organizationId]
    );
    await client.query(
      'INSERT INTO Centro_Custo (centro_custo, usuario_criacao, id_organizacao) VALUES ($1, $2, $3)',
      ['MEI / Empresa', userId, organizationId]
    );

    const grupoFixa = await client.query(
      'INSERT INTO Grupo (grupo, id_cc, usuario_criacao, id_organizacao) VALUES ($1, $2, $3, $4) RETURNING id_grupo',
      ['Despesas Fixas', ccPessoal.rows[0].id_cc, userId, organizationId]
    );

    for (const categoria of ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Lazer']) {
      await client.query(
        'INSERT INTO Categoria (nome_categoria, id_grupo, usuario_criacao, id_organizacao) VALUES ($1, $2, $3, $4)',
        [categoria, grupoFixa.rows[0].id_grupo, userId, organizationId]
      );
    }

    for (const formaPagamento of ['PIX', 'Dinheiro', 'Crédito', 'Débito', 'TED', 'Voucher']) {
      await client.query(
        'INSERT INTO Forma_Pagamento (forma_pagamento, usuario_criacao, id_organizacao) VALUES ($1, $2, $3)',
        [formaPagamento, userId, organizationId]
      );
    }

    await client.query('COMMIT');
    transactionStarted = false;
    try {
      await sendVerificationEmail(email, nome, verificationToken);
      return res.status(201).json({
        message: 'Conta criada. Confirme seu e-mail pelo link enviado antes de entrar.'
      });
    } catch (emailError) {
      console.error('Conta criada, mas o e-mail de confirmação não foi enviado:', emailError.message);
      return res.status(201).json({
        emailSent: false,
        message: 'Conta criada, mas não foi possível enviar o e-mail de confirmação. Use “Reenviar confirmação” após configurar o envio de e-mail.'
      });
    }
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Erro ao desfazer transação de cadastro:', rollbackError);
      }
    }

    if (error.code === '23505') {
      return res.status(409).json({ message: 'Este e-mail já está cadastrado.' });
    }

    if (error.message?.includes('SMTP_') || error.message?.includes('PUBLIC_APP_URL')) {
      console.error('Cadastro indisponível: configuração de e-mail incompleta.');
      return res.status(503).json({ message: 'O cadastro por e-mail está temporariamente indisponível.' });
    }
    console.error('Erro no cadastro:', error);
    return res.status(500).json({ message: 'Não foi possível criar a conta. Tente novamente.' });
  } finally {
    if (client) {
      client.release();
    }
  }
};

exports.acceptInvitation = async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body
    : {};
  const token = typeof body.token === 'string' ? body.token : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const personalData = {
    nome: typeof body.nome === 'string' ? body.nome.trim() : '',
    cpf: digitsOnly(body.cpf),
    data_nascimento: typeof body.data_nascimento === 'string' ? body.data_nascimento : '',
    telefone: digitsOnly(body.telefone),
    logradouro: typeof body.logradouro === 'string' ? body.logradouro.trim() : '',
    numero: typeof body.numero === 'string' ? body.numero.trim() : '',
    complemento: typeof body.complemento === 'string' ? body.complemento.trim() : '',
    bairro: typeof body.bairro === 'string' ? body.bairro.trim() : '',
    municipio: typeof body.municipio === 'string' ? body.municipio.trim() : '',
    uf: typeof body.uf === 'string' ? body.uf.toUpperCase() : '',
    cep: digitsOnly(body.cep)
  };
  const personalError = validatePersonalRegistration(personalData);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
    return res.status(400).json({ message: 'Convite inválido ou expirado.' });
  }
  if (personalError) return res.status(400).json({ message: personalError });
  if (!isValidEmail(email)) return res.status(400).json({ message: 'Informe um e-mail válido.' });
  if ([...password].length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ message: 'A senha deve ter de 12 a 72 bytes.' });
  }

  let client;
  let transactionStarted = false;
  let verificationToken;
  try {
    getEmailConfiguration();
    client = await db.connect();
    await client.query('BEGIN');
    transactionStarted = true;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invitation = await client.query(
      `SELECT c.id_convite, c.id_organizacao, c.email, c.nome, c.permissions,
              c.access_level
       FROM Convites_Organizacao c
       WHERE c.token_hash = $1 AND c.timestamp_aceitacao IS NULL
         AND c.timestamp_expiracao > CURRENT_TIMESTAMP
       FOR UPDATE OF c`,
      [tokenHash]
    );

    if (invitation.rowCount === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(400).json({ message: 'Convite inválido ou expirado.' });
    }

    const invite = invitation.rows[0];
    if (email !== invite.email.toLowerCase()) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(400).json({ message: 'O e-mail informado não corresponde ao e-mail convidado.' });
    }
    const existingUser = await client.query(
      'SELECT 1 FROM Usuarios WHERE LOWER(email) = $1 LIMIT 1',
      [invite.email.toLowerCase()]
    );
    if (existingUser.rowCount > 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(409).json({ message: 'Este e-mail já possui uma conta.' });
    }

    const senhaHash = await bcrypt.hash(password, 12);
    const newUser = await client.query(
      `INSERT INTO Usuarios
         (id_organizacao, nome, email, senha_hash, organization_role, access_level,
          permissions, email_verified,
          cpf, data_nascimento, telefone, logradouro, numero, complemento, bairro, municipio, uf, cep)
       VALUES ($1, $2, $3, $4, 'member', $5, $6, FALSE, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id_usuario`,
      [
        invite.id_organizacao, personalData.nome, invite.email, senhaHash,
        invite.access_level, invite.permissions, personalData.cpf,
        personalData.data_nascimento, personalData.telefone, personalData.logradouro,
        personalData.numero, personalData.complemento, personalData.bairro,
        personalData.municipio, personalData.uf, personalData.cep
      ]
    );
    verificationToken = await createAuthToken(client, newUser.rows[0].id_usuario, 'verify_email');
    await client.query(
      'UPDATE Convites_Organizacao SET timestamp_aceitacao = CURRENT_TIMESTAMP WHERE id_convite = $1',
      [invite.id_convite]
    );
    await client.query(
      `INSERT INTO Auditoria_Organizacao
         (organization_id, actor_user_id, action, target_type, target_id, previous_state, new_state)
       VALUES ($1, $2, 'invitation.accepted', 'invitation', $3, $4::jsonb, $5::jsonb)`,
      [
        invite.id_organizacao,
        newUser.rows[0].id_usuario,
        invite.id_convite,
        JSON.stringify({ status: 'pending', accessLevel: invite.access_level }),
        JSON.stringify({ status: 'accepted', emailVerified: false })
      ]
    );
    await client.query('COMMIT');
    transactionStarted = false;
    try {
      await sendVerificationEmail(invite.email, personalData.nome, verificationToken);
      return res.status(201).json({
        message: 'Convite aceito. Confirme seu e-mail pelo link enviado antes de entrar.'
      });
    } catch (emailError) {
      console.error('Convite aceito, mas o e-mail de confirmação não foi enviado:', emailError.message);
      return res.status(201).json({
        emailSent: false,
        message: 'Convite aceito, mas não foi possível enviar o e-mail de confirmação. Solicite o reenvio após configurar o envio de e-mail.'
      });
    }
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Erro ao desfazer aceite do convite:', rollbackError);
      }
    }
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Este e-mail já possui uma conta ou convite ativo.' });
    }
    console.error('Erro ao aceitar convite:', error);
    return res.status(500).json({ message: 'Não foi possível aceitar o convite. Tente novamente.' });
  } finally {
    if (client) client.release();
  }
};

exports.login = async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body
    : {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!isValidEmail(email) || !password) {
    return res.status(400).json({ message: 'Informe um e-mail e uma senha válidos.' });
  }

  try {
    const rateKeys = loginKeys(req, email);
    const blockedUntil = await checkLoginLimit(db, rateKeys);
    if (blockedUntil) {
      const retryAfter = Math.max(1, Math.ceil((new Date(blockedUntil).getTime() - Date.now()) / 1000));
      return res.status(429).set('Retry-After', String(retryAfter)).json({
        message: 'Muitas tentativas de acesso. Aguarde antes de tentar novamente.'
      });
    }
    const { rows } = await db.query(
      `SELECT u.id_usuario, u.nome, u.email, u.senha_hash, u.access_role,
              u.organization_role, u.access_level, u.permissions,
              u.email_verified, u.token_version, o.id_organizacao, o.assinatura_plano,
              o.assinatura_status, o.assinatura_expira_em
       FROM Usuarios u
       JOIN Organizacoes o ON o.id_organizacao = u.id_organizacao
       WHERE LOWER(u.email) = $1 AND u.status_conta = 'ativo' AND u.deleted_at IS NULL
       LIMIT 1`,
      [email]
    );

    if (rows.length === 0 || !await bcrypt.compare(password, rows[0].senha_hash)) {
      const newBlock = await recordLoginFailure(db, rateKeys);
      if (newBlock) {
        const retryAfter = Math.max(1, Math.ceil((new Date(newBlock).getTime() - Date.now()) / 1000));
        return res.status(429).set('Retry-After', String(retryAfter)).json({
          message: 'Muitas tentativas de acesso. Aguarde antes de tentar novamente.'
        });
      }
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || Buffer.byteLength(jwtSecret, 'utf8') < 32) {
      console.error('JWT_SECRET ausente ou menor que 32 bytes.');
      return res.status(500).json({ message: 'Serviço de autenticação indisponível.' });
    }

    const userDB = rows[0];
    if (!userDB.email_verified) {
      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Confirme seu e-mail antes de entrar. Você pode solicitar o reenvio do link.'
      });
    }
    await db.query(
      'DELETE FROM Auth_Rate_Limits WHERE rate_key = ANY($1::char(64)[])',
      [rateKeys]
    );
    const user = {
      id: userDB.id_usuario,
      name: userDB.nome,
      email: userDB.email,
      accessRole: userDB.access_role,
      organizationRole: userDB.organization_role,
      accessLevel: userDB.access_level,
      permissions: userDB.permissions,
      organizationId: userDB.id_organizacao,
      subscription: buildSubscription(userDB)
    };

    const token = jwt.sign(
      {
        userId: user.id,
        organizationId: userDB.id_organizacao,
        plan: user.subscription.plan,
        accessRole: user.accessRole,
        tokenVersion: userDB.token_version
      },
      jwtSecret,
      { expiresIn: '8h', algorithm: 'HS256' }
    );

    setSessionCookie(res, token);
    return res.set('Cache-Control', 'no-store').json({
      user,
      expiresAt: new Date(Date.now() + sessionDurationMs).toISOString()
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ message: 'Erro interno no servidor.' });
  }
};

exports.getSession = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id_usuario, u.nome, u.email, u.access_role, u.organization_role,
              u.access_level, u.permissions, o.id_organizacao, o.assinatura_plano,
              o.assinatura_status, o.assinatura_expira_em
       FROM Usuarios u
       JOIN Organizacoes o ON o.id_organizacao = u.id_organizacao
       WHERE u.id_usuario = $1 AND u.status_conta = 'ativo' AND u.deleted_at IS NULL
       LIMIT 1`,
      [req.user.userId]
    );
    if (rows.length === 0) {
      return res.status(403).json({ message: 'Conta inativa ou não encontrada.' });
    }

    const user = rows[0];
    return res.set('Cache-Control', 'no-store').json({
      id: user.id_usuario,
      name: user.nome,
      email: user.email,
      accessRole: user.access_role,
      organizationRole: user.organization_role,
      accessLevel: user.access_level,
      permissions: user.permissions,
      organizationId: user.id_organizacao,
      subscription: buildSubscription(user)
    });
  } catch (error) {
    console.error('Erro ao atualizar a sessão:', error);
    return res.status(500).json({ message: 'Não foi possível atualizar a sessão.' });
  }
};
