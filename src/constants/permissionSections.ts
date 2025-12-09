export type PermissionSection = {
  id: string;
  title: string;
  description: string;
  icon?: string;
};

export const PERMISSION_SECTIONS: PermissionSection[] = [
  {
    id: 'recipes',
    title: 'Ricette',
    description: 'Crea e modifica ricette di produzione.',
    icon: '🍞',
  },
  {
    id: 'magento',
    title: 'Magento',
    description: 'Aggiorna i dati nutrizionali su Magento.',
    icon: '🛒',
  },
  {
    id: 'ai-tools',
    title: 'AI Tools',
    description: 'Accesso agli strumenti di stima AI.',
    icon: '✨',
  },
  {
    id: 'docs',
    title: 'Documenti',
    description: 'Manuali, linee guida e checklist.',
    icon: '📚',
  },
  {
    id: 'reports',
    title: 'Reportistica',
    description: 'Dashboard e statistiche operative.',
    icon: '📈',
  },
];

export const BRAND_OPTIONS = [
  { id: 'Molino Bongiovanni', label: 'Molino' },
  { id: 'Tibiona', label: 'Tibiona' },
];

export type PermissionTreeNode = {
  id: string;
  label: string;
  description?: string;
  children?: PermissionTreeNode[];
};

const recipeProcessChildren = [
  {
    id: 'recipe.process.cookies',
    label: 'Biscotti & Teglie',
    description: 'Pezzi e pesi',
    children: [
      { id: 'recipe.process.cookiesCount', label: 'Numero biscotti' },
      {
        id: 'recipe.process.cookieWeightRawG',
        label: 'Peso biscotto crudo (g)',
      },
      {
        id: 'recipe.process.cookieWeightCookedG',
        label: 'Peso biscotto cotto (g)',
      },
      { id: 'recipe.process.trayWeightRawG', label: 'Peso teglia cruda (g)' },
      {
        id: 'recipe.process.trayWeightCookedG',
        label: 'Peso teglia cotta (g)',
      },
    ],
  },
  {
    id: 'recipe.process.equipment',
    label: 'Attrezzature',
    description: 'Capienze e quantità',
    children: [
      { id: 'recipe.process.mixerCapacityKg', label: 'Capienza impastatrice' },
      { id: 'recipe.process.doughBatchesCount', label: 'Numero impasti' },
      { id: 'recipe.process.depositorCapacityKg', label: 'Capienza colatrice' },
      { id: 'recipe.process.depositorsCount', label: 'Numero colatrici' },
      { id: 'recipe.process.traysCapacityKg', label: 'Capienza teglie' },
      { id: 'recipe.process.traysCount', label: 'Numero teglie' },
      { id: 'recipe.process.boxCapacity', label: 'Capienza scatole' },
      { id: 'recipe.process.numberOfBoxes', label: 'Numero scatole' },
      { id: 'recipe.process.cartCapacity', label: 'Capienza carrelli' },
      { id: 'recipe.process.numberOfCarts', label: 'Numero carrelli' },
    ],
  },
  {
    id: 'recipe.process.planning',
    label: 'Pianificazione',
    description: 'Flussi teglie e forni',
    children: [
      { id: 'recipe.process.traysPerBatch', label: 'Teglie per impasto' },
      {
        id: 'recipe.process.traysPerDepositors',
        label: 'Teglie per colatrice',
      },
      { id: 'recipe.process.traysPerOvenLoad', label: 'Teglie per infornata' },
      { id: 'recipe.process.ovenLoadsCount', label: 'Numero infornate' },
    ],
  },
  {
    id: 'recipe.process.quality',
    label: 'Qualità & Processo',
    description: 'Controlli di processo',
    children: [
      { id: 'recipe.process.glutenTestDone', label: 'Test glutine effettuato' },
      {
        id: 'recipe.process.valveOpenMinutes',
        label: 'Minuti apertura valvola',
      },
      { id: 'recipe.process.lot', label: 'Lotto' },
      {
        id: 'recipe.process.laboratoryHumidityPercent',
        label: 'Umidità laboratorio %',
      },
      {
        id: 'recipe.process.externalTemperatureC',
        label: 'Temperatura esterna °C',
      },
      {
        id: 'recipe.process.waterTemperatureC',
        label: 'Temperatura Acqua °C',
      },
      {
        id: 'recipe.process.finalDoughTemperatureC',
        label: 'Temperatura finale impasto °C',
      },
    ],
  },
];

export const PERMISSION_TREE: PermissionTreeNode[] = [
  {
    id: 'recipe',
    label: 'Editor ricette',
    description: 'Campi e pannelli della pagina ricetta',
    children: [
      {
        id: 'recipe.header',
        label: 'Intestazione',
        children: [{ id: 'recipe.header.meta', label: 'Titolo e metadati' }],
      },
      {
        id: 'recipe.basic',
        label: 'Basic info',
        description: 'Dati generali e rese',
        children: [
          { id: 'recipe.basic.name', label: 'Nome ricetta' },
          { id: 'recipe.basic.packageWeight', label: 'Peso confezione' },
          { id: 'recipe.basic.numberOfPackages', label: 'Numero pacchetti' },
          { id: 'recipe.basic.wastePercent', label: 'Scarto %' },
          { id: 'recipe.basic.waterPercent', label: 'Acqua %' },
        ],
      },
      {
        id: 'recipe.metadata',
        label: 'Metadati',
        description: 'Categoria e clienti della ricetta',
        children: [
          {
            id: 'recipe.metadata.category',
            label: 'Categoria',
            description: 'Visualizza e modifica la categoria della ricetta',
          },
          {
            id: 'recipe.metadata.clients',
            label: 'Clienti',
            description:
              'Visualizza e modifica i clienti associati alla ricetta',
          },
        ],
      },
      {
        id: 'recipe.processes',
        label: 'Processi di produzione',
        description: 'Gestione processi e tracciamento lavorazioni',
        children: [
          {
            id: 'recipe.processes.view',
            label: 'Visualizza widget processi',
            description: 'Consente di visualizzare il widget dei processi',
          },
          {
            id: 'recipe.processes.edit',
            label: 'Modifica valori processi',
            description: 'Consente di modificare minuti e cicli per processo',
          },
          {
            id: 'recipe.processes.tracking',
            label: 'Tracciamento lavorazioni',
            description: 'Accesso al tasto tracciamento e modal di tracking',
          },
          {
            id: 'recipe.processes.history',
            label: 'Visualizza storico',
            description: 'Consente di consultare lo storico dei tracciamenti',
          },
        ],
      },
      {
        id: 'recipe.calculated',
        label: 'Dati calcolati',
        description: 'Pannelli blu con totali e masse',
        children: [
          { id: 'recipe.calculated.panel', label: 'Riepilogo calcoli' },
        ],
      },
      {
        id: 'recipe.process',
        label: 'Process settings',
        description: 'Sezioni tecniche di processo',
        children: recipeProcessChildren,
      },
      {
        id: 'recipe.costs',
        label: 'Costi',
        description: 'Costi standard e personalizzati',
        children: [
          { id: 'recipe.costs.hourly_labor', label: 'Costo orario personale' },
          { id: 'recipe.costs.baking_paper', label: 'Costo carta da forno' },
          { id: 'recipe.costs.release_agent', label: 'Costo staccante' },
          { id: 'recipe.costs.bag', label: 'Costo sacchetto' },
          { id: 'recipe.costs.carton', label: 'Costo cartone' },
          { id: 'recipe.costs.label', label: 'Costo Etichetta' },
          { id: 'recipe.costs.depositor_leasing', label: 'Leasing colatrice' },
          { id: 'recipe.costs.oven_amortization', label: 'Ammortamento forno' },
          {
            id: 'recipe.costs.tray_amortization',
            label: 'Ammortamento teglie',
          },
        ],
      },
      {
        id: 'recipe.ingredients',
        label: 'Ingredienti',
        description: 'Tabella, pesi e nutrizionali',
        children: [
          {
            id: 'recipe.ingredients.table',
            label: 'Visualizzazione tabella ingredienti',
          },
          {
            id: 'recipe.ingredients.editing',
            label: 'Modifica quantità e costi',
          },
          {
            id: 'recipe.ingredients.actions',
            label: 'Aggiunta/rimozione ingredienti',
          },
          {
            id: 'recipe.ingredients.nutrition',
            label: 'Dettagli nutritivi ingredienti',
          },
          {
            id: 'recipe.ingredients.automatch',
            label: 'Tasto Auto match',
          },
          {
            id: 'recipe.ingredients.columns',
            label: 'Colonne tabella',
            description: 'Visibilità colonne individuali',
            children: [
              {
                id: 'recipe.ingredients.column.name',
                label: 'Nome ingrediente',
              },
              {
                id: 'recipe.ingredients.column.sku',
                label: 'SKU',
              },
              {
                id: 'recipe.ingredients.column.qtyForRecipe',
                label: 'Quantità per ricetta',
              },
              {
                id: 'recipe.ingredients.column.qtyOriginal',
                label: 'Quantità originale',
              },
              {
                id: 'recipe.ingredients.column.percentOnTotal',
                label: '% sul totale',
              },
              {
                id: 'recipe.ingredients.column.percentOfPowder',
                label: '% di polvere',
              },
              {
                id: 'recipe.ingredients.column.pricePerKg',
                label: '€ / kg',
              },
              {
                id: 'recipe.ingredients.column.pricePerRecipe',
                label: '€ / ricetta',
              },
              {
                id: 'recipe.ingredients.column.isPowder',
                label: 'È polvere',
              },
              {
                id: 'recipe.ingredients.column.productName',
                label: 'Materia Prima',
              },
              {
                id: 'recipe.ingredients.column.supplier',
                label: 'Fornitore',
              },
              {
                id: 'recipe.ingredients.column.warehouseLocation',
                label: 'Posizione magazzino',
              },
              {
                id: 'recipe.ingredients.column.mpSku',
                label: 'SKU Magento',
              },
              {
                id: 'recipe.ingredients.column.lot',
                label: 'Lotto',
              },
              {
                id: 'recipe.ingredients.column.done',
                label: 'Fatto',
              },
              {
                id: 'recipe.ingredients.column.checkGlutine',
                label: 'Controllo glutine',
              },
              {
                id: 'recipe.ingredients.column.action',
                label: 'Azioni',
              },
            ],
          },
        ],
      },
      {
        id: 'recipe.notes',
        label: 'Note',
        children: [{ id: 'recipe.notes.body', label: 'Campo testo note' }],
      },
      {
        id: 'recipe.nutrition',
        label: 'Pannello nutrizionale',
        children: [
          { id: 'recipe.nutrition.panel', label: 'Sezione Nutrition' },
        ],
      },
      {
        id: 'recipe.actions',
        label: 'Azioni',
        children: [
          { id: 'recipe.actions.save', label: 'Salvataggio ricetta' },
          {
            id: 'recipe.actions.nutritionToggle',
            label: 'Mostra/nascondi dati nutrizionali ingredienti',
          },
        ],
      },
      {
        id: 'recipe.history',
        label: 'Storico modifiche',
        description: 'Pannello storico modifiche ricetta',
        children: [
          { id: 'recipe.history.panel', label: 'Sezione storico modifiche' },
        ],
      },
      {
        id: 'recipe.colatrice',
        label: 'Setting Colatrice',
        description: 'Impostazioni macchina colatrice',
        children: [
          { id: 'recipe.colatrice.home', label: 'Home' },
          { id: 'recipe.colatrice.page1', label: 'Setting page 1' },
          { id: 'recipe.colatrice.page2', label: 'Setting page 2' },
          { id: 'recipe.colatrice.page3', label: 'Setting page 3' },
        ],
      },
    ],
  },
  {
    id: 'portal',
    label: 'Portal · Permessi',
    description: 'Widget disponibili nella pagina utente',
    children: [
      {
        id: 'portal.overview',
        label: 'Overview profilo',
        description: 'Saluto iniziale e anagrafica',
      },
      {
        id: 'portal.sections',
        label: 'Sezioni consentite',
        description: 'Lista sezioni disponibili all’utente',
      },
      {
        id: 'portal.password',
        label: 'Cambio password',
        description: 'Modulo per aggiornare la password',
      },
      {
        id: 'portal.banner',
        label: 'Banner “cambia password”',
        description: 'Avviso obbligo cambio password',
      },
      {
        id: 'portal.recipes',
        label: 'Portal Ricette',
        description: 'Widget gestione ricette',
      },
    ],
  },
  {
    id: 'admin',
    label: 'Admin generale',
    description: 'Accesso aree di configurazione',
    children: [
      {
        id: 'admin.permissions',
        label: 'Gestione permessi',
        description: 'Accesso a /admin/permissions',
      },
      {
        id: 'admin.costs.standard',
        label: 'Costi standard',
        description: 'Accesso a /admin/costs/standard',
      },
      {
        id: 'admin.parameters.standard',
        label: 'Parametri standard',
        description: 'Accesso a /admin/parameters/standard',
      },
      {
        id: 'admin.processes',
        label: 'Gestione processi standard',
        description: 'Accesso a /admin/recipes/processes',
      },
      {
        id: 'admin.production.history',
        label: 'Storico Produzioni',
        description: 'Accesso alla pagina storico produzioni con export Excel',
      },
      {
        id: 'admin.navigation',
        label: 'Link di navigazione',
        description: 'Link nel menu di navigazione',
        children: [
          {
            id: 'admin.navigation.excelrx',
            label: 'Link ExcelRx nel menu',
            description: 'Mostra/nascondi il link ExcelRx nella navigazione',
          },
          {
            id: 'admin.navigation.portal',
            label: 'Link Portal nel menu',
            description: 'Mostra/nascondi il link Portal nella navigazione',
          },
        ],
      },
    ],
  },
  {
    id: 'production',
    label: 'Produzione',
    description: 'Strumenti per la gestione della produzione',
    children: [
      {
        id: 'production.lot.decode',
        label: 'Decodifica lotto produzione',
        description:
          'Accesso alla pagina per decodificare i lotti di produzione',
      },
    ],
  },
];

const PERMISSION_LEAF_MAP = new Map<string, string[]>();
const PERMISSION_LEAF_IDS: string[] = [];

const collectLeaves = (node: PermissionTreeNode): string[] => {
  if (!node.children || node.children.length === 0) {
    PERMISSION_LEAF_MAP.set(node.id, [node.id]);
    PERMISSION_LEAF_IDS.push(node.id);
    return [node.id];
  }
  const descendants = node.children.flatMap((child) => collectLeaves(child));
  PERMISSION_LEAF_MAP.set(node.id, descendants);
  return descendants;
};

PERMISSION_TREE.forEach((node) => {
  collectLeaves(node);
});

export const PERMISSION_TREE_LEAF_MAP = PERMISSION_LEAF_MAP;
export const PERMISSION_TREE_LEAF_IDS = PERMISSION_LEAF_IDS;

export type PermissionWidget = {
  id: string;
  title: string;
  description?: string;
};

export type PermissionWidgetGroup = {
  id: string;
  title: string;
  description?: string;
  items: PermissionWidget[];
};

export const PERMISSION_WIDGET_GROUPS: PermissionWidgetGroup[] = [
  {
    id: 'admin-recipes',
    title: 'Admin · Ricette',
    description: 'Blocchi presenti nell’editor ricette.',
    items: [
      {
        id: 'recipe.header',
        title: 'Intestazione ricetta',
        description: 'Chip ID, titoli, metadati.',
      },
      {
        id: 'recipe.basic',
        title: 'Scheda Basic info',
        description: 'Packaging, idratazione e campi principali.',
      },
      {
        id: 'recipe.calculated',
        title: 'Dati calcolati',
        description: 'Totali blu e masse derivate.',
      },
      {
        id: 'recipe.process',
        title: 'Process settings',
        description: 'Widget processo consolidati.',
      },
      {
        id: 'recipe.ingredients',
        title: 'Ingredienti',
        description: 'Tabella ingredienti e SKU.',
      },
      {
        id: 'recipe.notes',
        title: 'Note ricetta',
        description: 'Blocco note testuali.',
      },
      {
        id: 'recipe.nutrition',
        title: 'Pannello nutrizionale',
        description: 'Per 100g e pannelli insight.',
      },
      {
        id: 'recipe.actions',
        title: 'Azioni',
        description: 'Bottoni salvataggio/eliminazione.',
      },
      {
        id: 'recipe.history',
        title: 'Storico modifiche',
        description: 'Pannello storico modifiche ricetta.',
      },
      {
        id: 'recipe.colatrice',
        title: 'Setting Colatrice',
        description: 'Impostazioni macchina colatrice.',
      },
      {
        id: 'recipe.processes',
        title: 'Processi di produzione',
        description: 'Widget gestione processi e tracciamento lavorazioni.',
      },
    ],
  },
  {
    id: 'portal',
    title: 'Portal · Permessi',
    description: 'Widget disponibili nella pagina utente.',
    items: [
      {
        id: 'portal.overview',
        title: 'Overview profilo',
        description: 'Saluto iniziale e stato account.',
      },
      {
        id: 'portal.sections',
        title: 'Sezioni consentite',
        description: 'Lista delle sezioni attivabili.',
      },
      {
        id: 'portal.password',
        title: 'Cambio password',
        description: 'Form per aggiornare la password.',
      },
      {
        id: 'portal.banner',
        title: 'Banner “cambia password”',
        description: 'Avviso per password obbligatoria.',
      },
      {
        id: 'portal.recipes',
        title: 'Portal Ricette',
        description: 'Widget gestione ricette.',
      },
    ],
  },
  {
    id: 'admin',
    title: 'Admin generale',
    description: 'Accesso a viste di amministrazione.',
    items: [
      {
        id: 'admin.permissions',
        title: 'Gestione permessi',
        description: 'Consente di accedere alla pagina /admin/permissions.',
      },
      {
        id: 'admin.costs.standard',
        title: 'Costi standard',
        description: 'Accesso a /admin/costs/standard.',
      },
      {
        id: 'admin.parameters.standard',
        title: 'Parametri standard',
        description: 'Accesso a /admin/parameters/standard.',
      },
      {
        id: 'admin.production.history',
        title: 'Storico Produzioni',
        description: 'Accesso alla pagina storico produzioni con export Excel.',
      },
      {
        id: 'admin.navigation',
        title: 'Link di navigazione',
        description: 'Link nel menu di navigazione.',
      },
    ],
  },
];
