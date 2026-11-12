const nodemailer = require('nodemailer');

function getEmailConfiguration() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const from = process.env.MAIL_FROM;
  const appUrl = (process.env.PUBLIC_APP_URL || '').replace(/\/+$/, '');
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !from) {
    throw new Error('Configure SMTP_HOST, SMTP_PORT e MAIL_FROM.');
  }
  if (!/^https:\/\//i.test(appUrl)) {
    throw new Error('Configure PUBLIC_APP_URL com HTTPS.');
  }
  if (Boolean(process.env.SMTP_USER) !== Boolean(process.env.SMTP_PASS)) {
    throw new Error('Configure SMTP_USER e SMTP_PASS juntos.');
  }
  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    from,
    ...(process.env.SMTP_USER
      ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
      : {})
  };
}

function createTransporter() {
  const { host, port, secure, from, auth } = getEmailConfiguration();
  return {
    from,
    transporter: nodemailer.createTransport({ host, port, secure, ...(auth ? { auth } : {}) })
  };
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

async function sendAccountEmail(email, name, token, purpose) {
  const { from, transporter } = createTransporter();
  const appUrl = (process.env.PUBLIC_APP_URL || '').replace(/\/+$/, '');
  const verify = purpose === 'verify_email';
  const url = `${appUrl}/account-security?${verify ? 'verify' : 'reset'}=${encodeURIComponent(token)}`;
  const greeting = escapeHtml(name);
  const subject = verify ? 'Confirme seu e-mail - 5585 Projects' : 'Redefina sua senha - 5585 Projects';
  const action = verify ? 'Confirmar e-mail' : 'Criar nova senha';
  const expiry = verify ? '24 horas' : '30 minutos';

  await transporter.sendMail({
    from,
    to: email,
    subject,
    text: `Olá ${name},\n\nUse este link para ${verify ? 'confirmar seu e-mail' : 'redefinir sua senha'}: ${url}\n\nO link expira em ${expiry}. Se você não solicitou esta ação, ignore esta mensagem.`,
    html: `<p>Olá ${greeting},</p><p>Use o botão abaixo para ${verify ? 'confirmar seu e-mail' : 'redefinir sua senha'}.</p><p><a href="${url}">${action}</a></p><p>O link expira em ${expiry}. Se você não solicitou esta ação, ignore esta mensagem.</p>`
  });
}

module.exports = {
  getEmailConfiguration,
  sendVerificationEmail: (email, name, token) => sendAccountEmail(email, name, token, 'verify_email'),
  sendPasswordResetEmail: (email, name, token) => sendAccountEmail(email, name, token, 'reset_password')
};
