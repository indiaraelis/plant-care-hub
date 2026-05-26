// backend/utils/email.js

const nodemailer = require('nodemailer');

function createTransporter() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

exports.sendResetEmail = async (to, username, resetUrl) => {
    const transporter = createTransporter();
    await transporter.sendMail({
        from: process.env.SMTP_FROM || `"Plant Care Hub" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Recuperação de senha — Plant Care Hub',
        html: `
<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family: sans-serif; color: #2d2d2d; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
  <h2 style="color: #2d6a2d; margin-bottom: 8px;">Plant Care Hub</h2>
  <p>Olá, <strong>${username}</strong>.</p>
  <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
  <p>Clique no botão abaixo para criar uma nova senha. O link é válido por <strong>1 hora</strong>.</p>
  <a href="${resetUrl}"
     style="display:inline-block; margin: 24px 0; padding: 14px 28px; background:#2d6a2d; color:#fff; text-decoration:none; border-radius:12px; font-weight:600;">
    Redefinir minha senha
  </a>
  <p style="font-size:0.85em; color:#888;">
    Se você não solicitou a recuperação de senha, ignore este e-mail. Sua senha não será alterada.
  </p>
  <p style="font-size:0.85em; color:#aaa;">
    Ou copie e cole este endereço no navegador:<br>${resetUrl}
  </p>
</body>
</html>`,
    });
};
