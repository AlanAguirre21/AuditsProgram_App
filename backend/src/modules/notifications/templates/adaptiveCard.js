/** Message → Adaptive Card 1.4 (renders in Teams chats and channels). */
const MAX_ITEMS = 15;

export function toAdaptiveCard(msg) {
  const body = [
    { type: 'TextBlock', text: 'Programa General de Auditorías', size: 'Small', isSubtle: true, spacing: 'None' },
    { type: 'TextBlock', text: msg.title, weight: 'Bolder', size: 'Medium', color: msg.tone === 'accent' ? 'Accent' : msg.tone === 'good' ? 'Good' : msg.tone === 'warning' ? 'Warning' : 'Attention', wrap: true },
    { type: 'TextBlock', text: msg.summary, wrap: true },
  ];
  if (msg.facts?.length) {
    body.push({ type: 'FactSet', facts: msg.facts.map(([title, value]) => ({ title, value: String(value) })) });
  }
  for (const s of msg.sections ?? []) {
    body.push({ type: 'TextBlock', text: s.title, weight: 'Bolder', wrap: true, spacing: 'Medium' });
    const items = s.items.slice(0, MAX_ITEMS);
    if (items.length) body.push({ type: 'TextBlock', text: items.map((i) => `- ${i}`).join('\n'), wrap: true, spacing: 'Small' });
    if (s.items.length > MAX_ITEMS) body.push({ type: 'TextBlock', text: `… y ${s.items.length - MAX_ITEMS} más`, isSubtle: true, spacing: 'None' });
  }
  body.push({ type: 'TextBlock', text: 'Mensaje automático. No responder.', size: 'Small', isSubtle: true, spacing: 'Medium' });

  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.4',
    msteams: { width: 'Full' },
    body,
    actions: msg.link ? [{ type: 'Action.OpenUrl', title: msg.linkLabel ?? 'Abrir', url: msg.link }] : [],
  };
}
