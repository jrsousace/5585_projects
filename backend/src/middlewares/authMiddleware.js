const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  // O token geralmente vem no formato "Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extrai apenas o <token>

  if (!token) {
    return res.status(401).json({ message: 'Acesso negado. Token não fornecido.' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'secret_fallback';
    const decoded = jwt.verify(token, secret);
    
    // Anexa as informações do usuário na requisição para uso nos próximos controllers
    req.user = decoded;
    
    next(); // Passa para o próximo passo (controller)
  } catch (error) {
    console.error('Erro na validação do token:', error.message);
    return res.status(403).json({ message: 'Token inválido ou expirado.' });
  }
};

module.exports = authMiddleware;
