/**
 * Message → Adaptive Card 1.4 (renders in Teams chats and channels).
 * Same visual language as the 2FA card: ZF logo, "ZF Group · app" header, a tone-coloured
 * band with title + summary, details in an emphasis box, primary button, subtle footer.
 */
import { env } from '../../../config/env.js';

const MAX_ITEMS = 15;
const BRAND_NAME = 'ZF Group';
const APP_NAME = 'Programa General de Auditorías';

/** tone → Adaptive Card container style / text colour. */
const TONES = {
  accent: { style: 'accent', color: 'Accent' },
  good: { style: 'good', color: 'Good' },
  warning: { style: 'warning', color: 'Warning' },
  attention: { style: 'attention', color: 'Attention' },
};

export function toAdaptiveCard(msg) {
  const tone = TONES[msg.tone] ?? TONES.attention;

  const body = [
    // Logo from BRAND_LOGO_URL (.env); omitted when not configured.
    ...(env.BRAND_LOGO_URL ? [{ type: 'Image', url: env.BRAND_LOGO_URL, height: '40px', altText: BRAND_NAME, horizontalAlignment: 'Left' }] : []),
    { type: 'TextBlock', text: `${BRAND_NAME} · ${APP_NAME}`, size: 'Small', isSubtle: true, wrap: true, spacing: 'Small' },
    {
      type: 'Container',
      style: tone.style,
      bleed: true,
      spacing: 'Medium',
      items: [
        { type: 'TextBlock', text: msg.title, size: 'Large', weight: 'Bolder', color: tone.color, wrap: true },
        { type: 'TextBlock', text: msg.summary, wrap: true, spacing: 'Small' },
      ],
    },
  ];

  if (msg.facts?.length) {
    body.push({
      type: 'Container',
      style: 'emphasis',
      spacing: 'Medium',
      items: [{ type: 'FactSet', facts: msg.facts.map(([title, value]) => ({ title, value: String(value) })) }],
    });
  }

  for (const s of msg.sections ?? []) {
    body.push({ type: 'TextBlock', text: s.title, weight: 'Bolder', wrap: true, spacing: 'Medium' });
    const items = s.items.slice(0, MAX_ITEMS);
    if (items.length) body.push({ type: 'TextBlock', text: items.map((i) => `- ${i}`).join('\n'), wrap: true, spacing: 'Small' });
    if (s.items.length > MAX_ITEMS) body.push({ type: 'TextBlock', text: `… y ${s.items.length - MAX_ITEMS} más`, isSubtle: true, spacing: 'None' });
  }

  body.push({
    type: 'TextBlock',
    text: 'Mensaje automático · Por favor, no respondas.',
    size: 'Small',
    isSubtle: true,
    wrap: true,
    separator: true,
    spacing: 'Large',
  });

  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.4',
    msteams: { width: 'Full' },
    body,
    actions: msg.link ? [{ type: 'Action.OpenUrl', title: msg.linkLabel ?? 'Abrir', url: msg.link, style: 'positive' }] : [],
  };
}
