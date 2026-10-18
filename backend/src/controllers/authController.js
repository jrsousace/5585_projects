const jwt = require('jsonwebtoken');

// Controlador provisório com usuários estáticos para não depender do DB na primeira execução
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // No ambiente real, faríamos:
    // const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    
    // Simulação temporária até popularmos o DB
    if (email === 'admin@teste.com' && password === 'admin123') {
      
      const user = {
        id: 1,
        name: 'Administrador (Real)',
        email: 'admin@teste.com',
        subscription: {
          plan: 'pro',
          active: true,
          modules: ['budget', 'investments']
        }
      };

      const token = jwt.sign(
        { userId: user.id, plan: user.subscription.plan },
        process.env.JWT_SECRET || 'secret_fallback',
        { expiresIn: '8h' }
      );

      return res.json({ token, user });
    }

    if (email === 'basico@teste.com' && password === 'basico123') {
      const user = {
        id: 2,
        name: 'Usuário Básico (Real)',
        email: 'basico@teste.com',
        subscription: { plan: 'basic', active: true, modules: [] }
      };
      
      const token = jwt.sign(
        { userId: user.id, plan: user.subscription.plan },
        process.env.JWT_SECRET || 'secret_fallback',
        { expiresIn: '8h' }
      );

      return res.json({ token, user });
    }

    return res.status(401).json({ message: 'Credenciais inválidas' });
    
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ message: 'Erro interno no servidor' });
  }
};
