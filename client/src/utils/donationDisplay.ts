/** Defaults match server utils/donationDisplaySettings.js */
export const DONATION_DISPLAY_DEFAULTS = {
  donationMarqueeTemplate: 'Vielen Dank an die Spender: {names}',
  donationNotificationTemplate: 'Danke an {name} für diese Spende!',
  donationMarqueeSeparator: '+++',
} as const;

export function buildMarqueeSegment(
  template: string,
  separator: string,
  donorNames: string[]
): string {
  const namesList = donorNames.map((x) => String(x).trim()).filter(Boolean);
  const sep = String(separator || DONATION_DISPLAY_DEFAULTS.donationMarqueeSeparator).trim() || '+++';
  const namesJoined = namesList.join(` ${sep} `);
  const tpl = String(template || DONATION_DISPLAY_DEFAULTS.donationMarqueeTemplate);
  return tpl.replace(/\{names\}/gi, namesJoined);
}

export function applyNotificationTemplate(template: string, name: string): string {
  const n = String(name || '').trim();
  const t = String(template || DONATION_DISPLAY_DEFAULTS.donationNotificationTemplate);
  return t.replace(/\{name\}/gi, n || '…');
}
