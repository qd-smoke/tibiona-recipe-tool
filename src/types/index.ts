import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
  appPermissions,
  appRoles,
  catalogProductEntityVarchar,
  catalogProductFlat1,
  dddevRecipe,
  dddevRecipeIngredient,
  dddevCostStandard,
  dddevRecipeCost,
  dddevStandardParameters,
  dddevProduction,
  dddevRecipeVersion,
  dddevRecipeHistory,
  dddevProductionIngredient,
  dddevIngredientLots,
  dddevRecipeCategory,
  dddevRecipeClient,
  dddevRecipeClientRelation,
  dddevProcess,
  dddevRecipeProcess,
  dddevRecipeProcessCost,
  dddevRecipeProcessTracking,
} from '@/db/schema';

export type MagentoProduct = InferSelectModel<typeof catalogProductFlat1>;
export type MagentoRecipe = InferSelectModel<typeof dddevRecipe>;
export type MagentoRecipeIngredient = InferSelectModel<
  typeof dddevRecipeIngredient
>;
export type MagentoProductWithNutritionAttributes = MagentoProduct & {
  nutritionAttributes?: IngredientNutritionAttributes;
  cost_price_list?: number;
  supplier?: string;
  warehouse_location?: string;
};
export type MagentoCatalogProductEntityVarchar = InferSelectModel<
  typeof catalogProductEntityVarchar
>;

export type NewRecipeProps = InferInsertModel<typeof dddevRecipe>;
export type NewIngredientProps = Omit<
  MagentoRecipeIngredient,
  'id' | 'recipeId'
>;

export type Recipe = MagentoRecipe & {
  ingredients: Ingredient[];
};

export type Ingredient = MagentoRecipeIngredient & {
  nutritionAttributes: IngredientNutritionAttributes;
};

export type IngredientNutritionAttributeCode =
  | 'kcal'
  | 'kj'
  | 'protein'
  | 'carbo'
  | 'sugar'
  | 'fiber'
  | 'fat'
  | 'saturi'
  | 'salt'
  | 'polioli';

export const IngredientNutritionAttributeUnit: Record<string, string> = {
  kcal: 'kcal',
  kj: 'kJ',
  protein: 'g',
  carbo: 'g',
  sugar: 'g',
  fiber: 'g',
  fat: 'g',
  saturi: 'g',
  salt: 'g',
  polioli: 'g',
};

export type IngredientNutritionAttributes = {
  kcal?: {
    value: number;
    unit: 'kcal';
  };
  kj?: {
    value: number;
    unit: 'kJ';
  };
  protein?: {
    value: number;
    unit: 'g';
  };
  carbo?: {
    value: number;
    unit: 'g';
  };
  sugar?: {
    value: number;
    unit: 'g';
  };
  fiber?: {
    value: number;
    unit: 'g';
  };
  fat?: {
    value: number;
    unit: 'g';
  };
  saturi?: {
    value: number;
    unit: 'g';
  };
  salt?: {
    value: number;
    unit: 'g';
  };
  polioli?: {
    value: number;
    unit: 'g';
  };
};

export type PermissionProfileRecord = InferSelectModel<typeof appPermissions>;
export type AppRoleRecord = InferSelectModel<typeof appRoles>;

export type AppRole = Omit<
  AppRoleRecord,
  'allowedSections' | 'capabilities'
> & {
  allowedSections: string[];
  capabilities: PermissionCapabilities;
};

export type AppRoleInput = {
  id?: number;
  roleLabel: string;
  allowedSections: string[];
  capabilities: PermissionCapabilities;
};

export type CapabilityRule = {
  visible: boolean;
  editable: boolean;
};

export type PermissionCapabilities = Record<string, CapabilityRule>;

export type UserRole = 'admin' | 'operator';

export type PermissionProfile = Omit<
  PermissionProfileRecord,
  'allowedSections' | 'capabilities' | 'passwordHash' | 'mustChangePassword'
> & {
  allowedSections: string[];
  capabilities: PermissionCapabilities;
  mustChangePassword: boolean;
  hasPassword: boolean;
  role: UserRole; // Derived from roleLabel for type safety
  roleLabel: string; // Keep original for compatibility
};
export type PermissionProfileInput = Omit<
  PermissionProfile,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'hasPassword'
  | 'lastLoginAt'
  | 'role'
  | 'allowedSections'
  | 'capabilities'
> & {
  id?: number;
  lastLoginAt?: PermissionProfile['lastLoginAt'];
  newPassword?: string;
  roleId?: number | null; // Reference to app_roles.id
};

export type StandardCost = InferSelectModel<typeof dddevCostStandard>;
export type RecipeCost = InferSelectModel<typeof dddevRecipeCost>;
export type StandardParameter = InferSelectModel<
  typeof dddevStandardParameters
>;

export type CostType =
  | 'hourly_labor'
  | 'baking_paper'
  | 'release_agent'
  | 'bag'
  | 'carton'
  | 'label'
  | 'depositor_leasing'
  | 'oven_amortization'
  | 'tray_amortization'
  | 'costoElettricita'
  | 'costoGas';

export type ParameterType =
  | 'mixerCapacityKg'
  | 'depositorCapacityKg'
  | 'traysCapacityKg'
  | 'cookieWeightCookedG'
  | 'traysPerOvenLoad'
  | 'wastePercent'
  | 'waterPercent'
  | 'consumoForno'
  | 'consumoColatrice'
  | 'consumoImpastatrice'
  | 'consumoSaldatrice'
  | 'consumoConfezionatrice'
  | 'consumoBassima'
  | 'consumoMulino'
  | 'steamMinutes'
  | 'valveOpenMinutes'
  | 'valveCloseMinutes'
  | 'boxCapacity'
  | 'cartCapacity';

// Union type for process costs (includes both CostType and consumption ParameterTypes)
export type ProcessCostType =
  | CostType
  | 'consumoForno'
  | 'consumoColatrice'
  | 'consumoImpastatrice'
  | 'consumoSaldatrice'
  | 'consumoConfezionatrice'
  | 'consumoBassima'
  | 'consumoMulino';

export type RecipeCostWithStandard = {
  costType: CostType;
  value: number;
  isStandard: boolean;
  standardValue: number;
};

export const PARAMETER_TYPE_LABELS: Record<ParameterType, string> = {
  mixerCapacityKg: 'Capienza Impastatrice',
  depositorCapacityKg: 'Capienza colatrice',
  traysCapacityKg: 'Capienza teglie',
  cookieWeightCookedG: 'Peso biscotto cotto',
  traysPerOvenLoad: 'Teglie/Infornate',
  wastePercent: 'Waste',
  waterPercent: 'Water',
  consumoForno: 'Consumo Forno',
  consumoColatrice: 'Consumo Colatrice',
  consumoImpastatrice: 'Consumo Impastatrice',
  consumoSaldatrice: 'Consumo Saldatrice',
  consumoConfezionatrice: 'Consumo Confezionatrice',
  consumoBassima: 'Consumo Bassima',
  consumoMulino: 'Consumo Mulino',
  steamMinutes: 'Minuti vapore',
  valveOpenMinutes: 'Minuti apertura valvola',
  valveCloseMinutes: 'Minuti chiusura valvola',
  boxCapacity: 'Capienza scatole',
  cartCapacity: 'Capienza carrelli',
};

// Production and Versioning Types
export type Production = InferSelectModel<typeof dddevProduction>;
export type RecipeVersion = InferSelectModel<typeof dddevRecipeVersion>;
export type RecipeHistoryEntry = InferSelectModel<typeof dddevRecipeHistory>;
export type IngredientLot = InferSelectModel<typeof dddevIngredientLots>;
export type ProductionIngredient = InferSelectModel<
  typeof dddevProductionIngredient
>;

export type ProductionStatus = 'in_progress' | 'completed' | 'cancelled';
export type ChangeType = 'production' | 'admin' | 'version_created';

export const COST_TYPE_LABELS: Record<CostType, string> = {
  hourly_labor: 'Costo orario personale',
  baking_paper: 'Costo carta da forno',
  release_agent: 'Costo staccante',
  bag: 'Costo sacchetto',
  carton: 'Costo cartone',
  label: 'Costo Etichetta',
  depositor_leasing: 'Leasing colatrice',
  oven_amortization: 'Ammortamento forno',
  tray_amortization: 'Ammortamento teglie',
  costoElettricita: 'Costo Elettricità',
  costoGas: 'Costo Gas',
};

// Recipe Category and Client Types
export type RecipeCategory = InferSelectModel<typeof dddevRecipeCategory>;
export type RecipeClient = InferSelectModel<typeof dddevRecipeClient>;
export type RecipeClientRelation = InferSelectModel<
  typeof dddevRecipeClientRelation
>;

export type RecipeMetadataUpdate = {
  name?: string;
  sku?: string | null;
  categoryId?: number | null;
  clientIds?: number[];
};

export type RecipeListItem = {
  id: number;
  name: string;
  sku?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  clientIds?: number[];
  clientNames?: string[];
};

// Process Types
export type ProcessRecord = InferSelectModel<typeof dddevProcess>;
export type Process = ProcessRecord;

export type RecipeProcessRecord = InferSelectModel<typeof dddevRecipeProcess>;
export type RecipeProcessCostRecord = InferSelectModel<
  typeof dddevRecipeProcessCost
>;
export type RecipeProcessCost = RecipeProcessCostRecord;

export type RecipeProcess = RecipeProcessRecord & {
  processName?: string;
  costTypes?: CostType[];
  cycleField?: string | null;
};

export type RecipeCycleField =
  | 'numberOfPackages'
  | 'traysPerOvenLoad'
  | 'totalQtyForRecipe'
  | 'traysCapacityKg'
  | 'mixerCapacityKg'
  | 'depositorCapacityKg'
  | 'packageWeight'
  | 'cookieWeightCookedG'
  | 'numberOfCookies'
  | 'numberOfTrays'
  | 'numberOfDepositorCycles'
  | 'numberOfMixingCycles'
  | 'numberOfOvenLoads'
  | 'boxCapacity'
  | 'numberOfBoxes'
  | 'cartCapacity'
  | 'numberOfCarts'
  | 'singleCycle';

export type ProcessTrackingRecord = InferSelectModel<
  typeof dddevRecipeProcessTracking
>;
export type ProcessTracking = ProcessTrackingRecord;

export type ProcessTrackingState = 'not_started' | 'in_progress' | 'completed';
