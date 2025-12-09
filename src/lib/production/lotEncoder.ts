const BASE_DATE = new Date('2020-01-01T00:00:00Z').getTime();
const BASE36_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Converte un numero in Base36
 */
function toBase36(num: number, length: number): string {
  if (num < 0) num = 0;
  let result = '';
  while (num > 0 && result.length < length) {
    result = BASE36_CHARS[num % 36] + result;
    num = Math.floor(num / 36);
  }
  return result.padStart(length, '0').toUpperCase();
}

/**
 * Converte da Base36 a numero
 */
function fromBase36(str: string): number {
  let result = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i].toUpperCase();
    const value = BASE36_CHARS.indexOf(char);
    if (value === -1) throw new Error(`Invalid Base36 character: ${char}`);
    result = result * 36 + value;
  }
  return result;
}

/**
 * Estrae iniziali da un nome (prima e ultima lettera)
 */
function getInitials(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, '');
  if (cleaned.length === 0) return 'XX';
  if (cleaned.length === 1) return (cleaned[0] + cleaned[0]).toUpperCase();
  return (cleaned[0] + cleaned[cleaned.length - 1]).toUpperCase();
}

export type LotData = {
  recipeName: string;
  userName: string;
  startedAt: Date;
  finishedAt: Date;
};

/**
 * Genera il lotto produzione (12 caratteri)
 * Formato: RRUUIIIIFFFF
 * - RR: Iniziali ricetta (2 caratteri)
 * - UU: Iniziali utente (2 caratteri)
 * - IIII: Timestamp inizio in minuti dalla data base (4 caratteri Base36)
 * - FFFF: Timestamp fine in minuti dalla data base (4 caratteri Base36)
 */
export function generateProductionLot(data: LotData): string {
  const recipeInitials = getInitials(data.recipeName);
  const userInitials = getInitials(data.userName);

  // Calcola minuti dalla data base
  const startMinutes = Math.floor(
    (data.startedAt.getTime() - BASE_DATE) / (1000 * 60),
  );
  const finishMinutes = Math.floor(
    (data.finishedAt.getTime() - BASE_DATE) / (1000 * 60),
  );

  // Codifica in Base36 (4 caratteri ciascuno)
  const startCode = toBase36(startMinutes, 4);
  const finishCode = toBase36(finishMinutes, 4);

  return recipeInitials + userInitials + startCode + finishCode;
}

/**
 * Decodifica il lotto produzione
 */
export function decodeProductionLot(lot: string): LotData | null {
  if (lot.length !== 12) return null;

  try {
    const recipeInitials = lot.substring(0, 2);
    const userInitials = lot.substring(2, 4);
    const startCode = lot.substring(4, 8);
    const finishCode = lot.substring(8, 12);

    const startMinutes = fromBase36(startCode);
    const finishMinutes = fromBase36(finishCode);

    const startedAt = new Date(BASE_DATE + startMinutes * 60 * 1000);
    const finishedAt = new Date(BASE_DATE + finishMinutes * 60 * 1000);

    return {
      recipeName: recipeInitials, // Solo iniziali, il nome completo va recuperato dal DB
      userName: userInitials, // Solo iniziali, il nome completo va recuperato dal DB
      startedAt,
      finishedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Valida il formato del lotto
 */
export function isValidLotFormat(lot: string): boolean {
  return /^[A-Z0-9]{12}$/.test(lot);
}
