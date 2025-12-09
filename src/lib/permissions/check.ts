import type { CapabilityRule, PermissionCapabilities } from '@/types';

const DEFAULT_RULE: CapabilityRule = {
  visible: true,
  editable: true,
};

const normalizeRuleValue = (rule?: CapabilityRule | null): CapabilityRule => {
  if (!rule) return { ...DEFAULT_RULE };
  const visible =
    typeof rule.visible === 'boolean' ? rule.visible : DEFAULT_RULE.visible;
  const editable =
    typeof rule.editable === 'boolean'
      ? rule.editable
      : typeof rule.visible === 'boolean'
        ? rule.visible
        : DEFAULT_RULE.editable;
  return { visible, editable };
};

const findRule = (
  capabilities: PermissionCapabilities | null | undefined,
  widgetId: string,
): CapabilityRule | undefined => {
  if (!capabilities) return undefined;
  // Se capabilities è un oggetto vuoto esplicito (Vista Operatore), restituisci undefined
  if (Object.keys(capabilities).length === 0) return undefined;
  let key: string | null = widgetId;
  while (key) {
    const candidate = capabilities[key];
    if (candidate) return candidate;
    const idx = key.lastIndexOf('.');
    if (idx === -1) break;
    key = key.slice(0, idx);
  }
  return undefined;
};

export const canView = (
  capabilities: PermissionCapabilities | null | undefined,
  widgetId: string,
  isOperatorViewActive: boolean = false, // Flag per distinguere Vista Operatore da operatore senza capabilities
  isOperator: boolean = false, // Flag per indicare se l'utente è un operatore reale (non admin)
) => {
  // Se capabilities è null/undefined (non ancora caricato), restituisci true (default: mostra tutto)
  if (!capabilities) {
    return DEFAULT_RULE.visible;
  }
  // Se capabilities è un oggetto vuoto
  if (Object.keys(capabilities).length === 0) {
    // Se Vista Operatore è attiva O se l'utente è un operatore reale, nascondi tutto (deny-by-default)
    if (isOperatorViewActive || isOperator) {
      return false;
    }
    // Altrimenti, utente senza capabilities configurati -> mostra tutto (default)
    return DEFAULT_RULE.visible;
  }

  const rule = findRule(capabilities, widgetId);
  // Se capabilities ha altre regole configurate ma questa specifica non è presente,
  // significa che non è permessa (opt-in: solo i capability esplicitamente configurati sono permessi)
  if (!rule) {
    return false;
  }
  return normalizeRuleValue(rule).visible;
};

export const canEdit = (
  capabilities: PermissionCapabilities | null | undefined,
  widgetId: string,
) => {
  // Se capabilities è null/undefined (non ancora caricato), restituisci true (default: modifica tutto)
  if (!capabilities) return DEFAULT_RULE.visible && DEFAULT_RULE.editable;
  // Se capabilities è un oggetto vuoto esplicito (Vista Operatore), restituisci false
  if (Object.keys(capabilities).length === 0) return false;

  const rule = findRule(capabilities, widgetId);
  // Se capabilities ha altre regole configurate ma questa specifica non è presente,
  // significa che non è permessa (opt-in: solo i capability esplicitamente configurati sono permessi)
  if (!rule) return false;
  const normalized = normalizeRuleValue(rule);
  return normalized.visible && normalized.editable;
};

export const getCapabilityRule = (
  capabilities: PermissionCapabilities | null | undefined,
  widgetId: string,
) => normalizeRuleValue(findRule(capabilities, widgetId));
