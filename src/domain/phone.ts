import { DomainError } from './errors';

export function normalizeSupportPhone(input: string): string {
  const compact = input.trim().replace(/[\s().-]/g, '');
  if (!compact) throw new DomainError('PHONE_INVALID');
  let value = compact;
  if (value.startsWith('00')) value = `+${value.slice(2)}`;
  else if (value.startsWith('0')) value = `+46${value.slice(1)}`;
  if (value.startsWith('+460')) value = `+46${value.slice(4)}`;
  if (!/^\+[1-9]\d{7,14}$/.test(value)) throw new DomainError('PHONE_INVALID');
  return value;
}

export function formatSupportPhone(e164: string): string {
  if (/^\+46\d{9}$/.test(e164)) {
    const national = e164.slice(3);
    return `+46 ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5, 7)} ${national.slice(7)}`;
  }
  const digits = e164.startsWith('+') ? e164.slice(1) : e164;
  const countryLength = digits.length > 10 ? digits.length - 9 : Math.min(3, Math.max(1, digits.length - 7));
  const country = digits.slice(0, countryLength);
  const rest = digits.slice(countryLength);
  const groups = rest.match(/\d{1,3}/g) ?? [];
  return [`+${country}`, ...groups].join(' ');
}

export function supportPhoneHref(e164: string): string {
  return `tel:${e164}`;
}
