// Gera os modelos de e-mail do Supabase em português, com a identidade do Kissly.
// Uso: node scripts/generate-email-templates.mjs
// Depois, cole cada arquivo em: Supabase → Authentication → Emails → Templates.
//
// HTML de e-mail é diferente de página web: tabelas e estilos inline, para funcionar
// no Gmail, Outlook e no Mail do iPhone. As variáveis {{ .X }} são preenchidas pelo Supabase.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'email-templates');

const ROSE = '#FF3D7F';
const CORAL = '#FF7A59';
const INK = '#0B0810';
const SURFACE = '#16111C';
const TEXT = '#F7F2F5';
const MUTED = '#A99FB0';
const FAINT = '#6E6475';

function layout({ preheader, title, paragraphs, button, footnote }) {
  const p = paragraphs
    .map((t) => `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:${MUTED};">${t}</p>`)
    .join('\n              ');
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark light" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:${INK};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <!-- Texto de prévia (aparece ao lado do assunto na caixa de entrada) -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${INK};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
            <!-- Logo -->
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="40" height="40" align="center" valign="middle" bgcolor="${ROSE}"
                        style="width:40px;height:40px;border-radius:12px;background:${ROSE};background-image:linear-gradient(135deg,${ROSE},${CORAL});font-size:22px;line-height:40px;color:#ffffff;">&#10084;</td>
                    <td style="padding-left:10px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:bold;font-size:28px;color:${TEXT};">Kissly</td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Cartão -->
            <tr>
              <td style="background:${SURFACE};border-radius:24px;padding:32px 28px;border:1px solid #2A2232;">
              <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:32px;color:${TEXT};">${title}</h1>
              ${p}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">
                <tr>
                  <td align="center" bgcolor="${ROSE}" style="border-radius:999px;background:${ROSE};background-image:linear-gradient(135deg,${ROSE},${CORAL});">
                    <a href="${button.href}" target="_blank"
                       style="display:block;padding:16px 24px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">${button.label}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;line-height:20px;color:${FAINT};">${footnote}</p>
              </td>
            </tr>
            <!-- Rodapé -->
            <tr>
              <td align="center" style="padding:24px 8px 0;font-size:12px;line-height:18px;color:${FAINT};">
                Você recebeu este e-mail porque ele foi usado no Kissly.<br />
                Exclusivo para maiores de 18 anos.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

const IGNORE = 'Se não foi você, é só ignorar este e-mail: nada vai mudar na sua conta.';

export const TEMPLATES = [
  {
    file: 'confirmar-cadastro.html',
    supabase: 'Confirm signup',
    subject: 'Confirme seu e-mail e comece no Kissly 💘',
    html: layout({
      preheader: 'Falta só um toque para ativar sua conta.',
      title: 'Bem-vindo(a) ao Kissly!',
      paragraphs: [
        'Que bom ter você aqui. Para ativar sua conta e começar a dar Kiss, confirme seu e-mail tocando no botão abaixo.',
      ],
      button: { href: '{{ .ConfirmationURL }}', label: 'Confirmar meu e-mail' },
      footnote: `O link vale por 24 horas. ${IGNORE}`,
    }),
  },
  {
    file: 'redefinir-senha.html',
    supabase: 'Reset password',
    subject: 'Redefina sua senha do Kissly',
    html: layout({
      preheader: 'Crie uma nova senha para entrar no Kissly.',
      title: 'Vamos criar uma nova senha',
      paragraphs: [
        'Recebemos um pedido para redefinir a senha da sua conta no Kissly.',
        'Toque no botão abaixo <strong style="color:#F7F2F5;">neste celular</strong> para escolher uma nova senha.',
      ],
      button: { href: '{{ .ConfirmationURL }}', label: 'Criar nova senha' },
      footnote: `O link vale por 1 hora. ${IGNORE}`,
    }),
  },
  {
    file: 'alterar-email.html',
    supabase: 'Change email address',
    subject: 'Confirme seu novo e-mail no Kissly',
    html: layout({
      preheader: 'Confirme a troca do e-mail da sua conta.',
      title: 'Confirme seu novo e-mail',
      paragraphs: [
        'Você pediu para trocar o e-mail da sua conta de <strong style="color:#F7F2F5;">{{ .Email }}</strong> para <strong style="color:#F7F2F5;">{{ .NewEmail }}</strong>.',
        'Para concluir, toque no botão abaixo.',
      ],
      button: { href: '{{ .ConfirmationURL }}', label: 'Confirmar novo e-mail' },
      footnote: 'Se você não pediu essa troca, entre no app e altere sua senha imediatamente.',
    }),
  },
];

fs.mkdirSync(OUT, { recursive: true });
for (const t of TEMPLATES) fs.writeFileSync(path.join(OUT, t.file), t.html);
fs.writeFileSync(
  path.join(OUT, 'ASSUNTOS.md'),
  `# Assuntos dos e-mails\n\nEm **Supabase → Authentication → Emails → Templates**, para cada modelo, cole o assunto e o HTML:\n\n| Modelo no Supabase | Assunto (Subject) | Arquivo |\n| --- | --- | --- |\n${TEMPLATES.map((t) => `| ${t.supabase} | ${t.subject} | [${t.file}](${t.file}) |`).join('\n')}\n`,
);
console.log('Modelos gerados em', OUT);
