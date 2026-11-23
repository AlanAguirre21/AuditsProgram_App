/** Message → Outlook-safe HTML (tables + inline CSS) and a plain-text alternative (spec 8.5). */
const COLORS = { accent: '#0057b7', good: '#1e8e3e', warning: '#e37400', attention: '#d93025' };

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function toEmailHtml(msg) {
  const color = COLORS[msg.tone] ?? COLORS.accent;
  const facts = (msg.facts ?? [])
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6e6e73;font-size:13px;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;color:#1d1d1f;font-size:13px">${esc(v)}</td></tr>`,
    )
    .join('');
  const sections = (msg.sections ?? [])
    .map(
      (s) =>
        `<p style="margin:18px 0 6px;font-size:14px;font-weight:bold;color:#1d1d1f">${esc(s.title)}</p><ul style="margin:0;padding-left:18px;font-size:13px;color:#1d1d1f">${s.items.map((i) => `<li style="margin:2px 0">${esc(i)}</li>`).join('')}</ul>`,
    )
    .join('');
  const button = msg.link
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr><td style="background:${color};border-radius:6px"><a href="${esc(msg.link)}" style="display:inline-block;padding:10px 22px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;font-family:Segoe UI,Arial,sans-serif">${esc(msg.linkLabel ?? 'Abrir')}</a></td></tr></table>`
    : '';

  return `<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#eef1f6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;font-family:Segoe UI,Arial,sans-serif">
<tr><td style="background:${color};height:6px;border-radius:10px 10px 0 0"></td></tr>
<tr><td style="padding:24px 28px">
<p style="margin:0;font-size:12px;color:#6e6e73">Programa General de Auditorías · Calidad ZF El Salto</p>
<h1 style="margin:6px 0 12px;font-size:20px;color:${color}">${esc(msg.title)}</h1>
<p style="margin:0 0 14px;font-size:14px;color:#1d1d1f;line-height:1.5">${esc(msg.summary)}</p>
${facts ? `<table role="presentation" cellpadding="0" cellspacing="0">${facts}</table>` : ''}
${sections}
${button}
</td></tr>
<tr><td style="padding:14px 28px;border-top:1px solid #e5e5ea;font-size:12px;color:#aeaeb2">Mensaje automático. No responder.</td></tr>
</table></td></tr></table></body></html>`;
}

export function toEmailText(msg) {
  const lines = [msg.title, '', msg.summary, ''];
  for (const [k, v] of msg.facts ?? []) lines.push(`${k}: ${v}`);
  for (const s of msg.sections ?? []) {
    lines.push('', s.title);
    for (const i of s.items) lines.push(`- ${i}`);
  }
  if (msg.link) lines.push('', `${msg.linkLabel ?? 'Abrir'}: ${msg.link}`);
  lines.push('', 'Mensaje automático. No responder.');
  return lines.join('\n');
}
