export class DomainError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.name = 'DomainError';
    this.code = code;
  }
}

const MESSAGES: Record<string, string> = {
  OPEN_SESSION_EXISTS: 'Medarbetaren har redan en öppen stämpling.',
  NO_OPEN_SESSION: 'Det finns ingen öppen stämpling.',
  ALREADY_ON_BREAK: 'Medarbetaren är redan på rast.',
  NOT_ON_BREAK: 'Det finns ingen pågående rast.',
  ON_BREAK: 'Avsluta rasten innan utstämpling.',
  INVALID_TIME: 'Tiderna hänger inte ihop. Kontrollera start, slut och raster.',
  OVERLAPPING_BREAK: 'Rasterna överlappar varandra.',
  REASON_REQUIRED: 'Ange en orsak till korrigeringen.',
  SUBSCRIPTION_LOCKED: 'Schema och stämpling är låsta eftersom prenumerationen inte är aktiv.',
  INACTIVE_EMPLOYEE: 'Inaktiva medarbetare kan inte schemaläggas eller stämplas in.',
  FORBIDDEN_SALON: 'Du kan bara hantera din egen salong.',
  FORBIDDEN_PLATFORM: 'Bara plattformsägaren kan göra det här.',
  NOT_FOUND: 'Posten hittades inte.',
  NAME_REQUIRED: 'Ange ett namn.',
  EMAIL_INVALID: 'Ange en giltig e-postadress.',
  PRICE_INVALID: 'Priset måste vara minst 1 krona.',
  DATE_INVALID: 'Ange giltiga datum.',
  DATE_ORDER: 'Utgångsdatum kan inte vara före startdatum.',
  TIME_INVALID: 'Ange tider i formatet tt:mm.',
  TIME_SAME: 'Start och slut kan inte vara samma tid.',
  EMPLOYEE_REQUIRED: 'Välj en medarbetare.',
  TITLE_REQUIRED: 'Ange en yrkesroll.',
  EMPTY_COPY: 'Föregående vecka har inga pass att kopiera.',
  SUBJECT_REQUIRED: 'Ange ett ämne.',
  CATEGORY_REQUIRED: 'Välj en kategori.',
  MESSAGE_REQUIRED: 'Skriv ett meddelande.',
  STATUS_INVALID: 'Välj status Öppen, Pågår eller Löst.',
  PHONE_INVALID: 'Ange ett giltigt telefonnummer med landskod.',
};

export function describeError(error: unknown): string {
  if (error instanceof DomainError) {
    return MESSAGES[error.code] ?? 'Kontrollera uppgifterna och försök igen.';
  }
  return 'Något gick fel. Försök igen.';
}
