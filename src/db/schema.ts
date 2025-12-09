import { relations } from 'drizzle-orm';
import {
  mysqlTable,
  int,
  varchar,
  text,
  longtext,
  decimal,
  timestamp,
  tinyint,
  smallint,
  index,
  unique,
} from 'drizzle-orm/mysql-core';

export const catalogProductEntity = mysqlTable('catalog_product_entity', {
  entityId: int('entity_id').notNull(),
  attributeSetId: smallint('attribute_set_id').default(0).notNull(),
  typeId: varchar('type_id', { length: 32 }).default("'simple'").notNull(),
  sku: varchar({ length: 64 }).notNull(),
  hasOptions: smallint('has_options').default(0).notNull(),
  requiredOptions: smallint('required_options').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const catalogProductFlat1 = mysqlTable('catalog_product_flat_1', {
  entityId: int('entity_id').notNull(),
  typeId: varchar('type_id', { length: 32 }).default("'simple'").notNull(),
  name: varchar({ length: 255 }).default('NULL'),
  sku: varchar({ length: 64 }).notNull(),
  description: longtext().default('NULL'),
  shortDescription: longtext('short_description').default('NULL'),
  price: decimal({ precision: 12, scale: 4 }).$type<number>().default(0),
  weight: decimal({ precision: 12, scale: 4 }).$type<number>().default(0),
  image: varchar({ length: 255 }).default('NULL'),
  smallImage: varchar('small_image', { length: 255 }).default('NULL'),
  thumbnail: varchar({ length: 255 }).default('NULL'),
});

export const dddevRecipeCategory = mysqlTable(
  'dddev_recipe_category',
  {
    id: int().autoincrement().notNull(),
    name: varchar({ length: 255 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'string' })
      .default('current_timestamp()')
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .default('current_timestamp()')
      .onUpdateNow()
      .notNull(),
  },
  (table) => [
    unique('dddev_recipe_category_name_unique').on(table.name),
    index('idx_category_name').on(table.name),
  ],
);

export const dddevRecipeClient = mysqlTable(
  'dddev_recipe_client',
  {
    id: int().autoincrement().notNull(),
    name: varchar({ length: 255 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'string' })
      .default('current_timestamp()')
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .default('current_timestamp()')
      .onUpdateNow()
      .notNull(),
  },
  (table) => [
    unique('dddev_recipe_client_name_unique').on(table.name),
    index('idx_client_name').on(table.name),
  ],
);

export const dddevRecipe = mysqlTable('dddev_recipe', {
  id: int().autoincrement().notNull(),
  name: varchar({ length: 255 }).notNull(),
  sku: varchar({ length: 100 }).default('NULL'),
  notes: text().default('NULL'),
  totalQtyForRecipe: decimal('total_qty_for_recipe', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .default(0),
  wastePercent: decimal('waste_percent', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .default(0),
  waterPercent: decimal('water_percent', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .default(0),
  packageWeight: decimal('package_weight', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .default(0),
  numberOfPackages: decimal('number_of_packages', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .default(0),
  timeMinutes: decimal('time_minutes').$type<number>().default(0),
  temperatureCelsius: decimal('temperature_celsius').$type<number>().default(0),
  heightCm: decimal('height_cm', { precision: 12, scale: 2 })
    .$type<number>()
    .default(0),
  widthCm: decimal('width_cm', { precision: 12, scale: 2 })
    .$type<number>()
    .default(0),
  lengthCm: decimal('length_cm', { precision: 12, scale: 2 })
    .$type<number>()
    .default(0),
  cookieWeightCookedG: decimal('cookie_weight_cooked_g', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .default(0),
  mixerCapacityKg: decimal('mixer_capacity_kg', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .default(0),
  traysCapacityKg: decimal('trays_capacity_kg', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .default(0),
  depositorCapacityKg: decimal('depositor_capacity_kg', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .default(0),
  traysPerOvenLoad: decimal('trays_per_oven_load', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .default(0),
  boxCapacity: decimal('box_capacity', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .default(0),
  cartCapacity: decimal('cart_capacity', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .default(0),
  steamMinutes: decimal('steam_minutes', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .default(0),
  valveOpenMinutes: decimal('valve_open_minutes', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .default(0),
  valveCloseMinutes: decimal('valve_close_minutes', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .default(0),
  glutenTestDone: tinyint('gluten_test_done').default(0).notNull(),
  laboratoryHumidityPercent: decimal('laboratory_humidity_percent', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .default(0),
  externalTemperatureC: decimal('external_temperature_c', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .default(0),
  waterTemperatureC: decimal('water_temperature_c', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .default(0),
  finalDoughTemperatureC: decimal('final_dough_temperature_c', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .default(0),
  colatriceSettings: text('colatrice_settings').default('NULL'),
  marginPercent: decimal('margin_percent', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .default(0),
  sellingPrice: decimal('selling_price', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .default(0),
  categoryId: int('category_id').references(() => dddevRecipeCategory.id, {
    onDelete: 'set null',
    onUpdate: 'restrict',
  }),
  createdAt: timestamp('created_at', { mode: 'string' })
    .default('current_timestamp()')
    .notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' })
    .default('current_timestamp()')
    .notNull(),
});

export const dddevRecipeIngredient = mysqlTable('dddev_recipe_ingredient', {
  id: int().autoincrement().notNull(),
  recipeId: int('recipe_id')
    .notNull()
    .references(() => dddevRecipe.id, {
      onDelete: 'cascade',
      onUpdate: 'restrict',
    }),
  sku: varchar({ length: 100 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  qtyOriginal: decimal('qty_original', { precision: 12, scale: 2 })
    .$type<number>()
    .notNull(),
  priceCostPerKg: decimal('price_cost_per_kg', {
    precision: 12,
    scale: 2,
  })
    .$type<number>()
    .notNull(),
  isPowderIngredient: tinyint('is_powder_ingredient').default(0).notNull(),
  supplier: varchar({ length: 255 }).default('NULL'),
  warehouseLocation: varchar('warehouse_location', { length: 255 }).default(
    'NULL',
  ),
  mpSku: varchar('mp_sku', { length: 100 }).default('NULL'),
  productName: varchar('product_name', { length: 255 }).default('NULL'),
  kcal: decimal({ precision: 12, scale: 2 }).$type<number>().default(0),
  kj: decimal({ precision: 12, scale: 2 }).$type<number>().default(0),
  protein: decimal({ precision: 12, scale: 2 }).$type<number>().default(0),
  carbo: decimal({ precision: 12, scale: 2 }).$type<number>().default(0),
  sugar: decimal({ precision: 12, scale: 2 }).$type<number>().default(0),
  fat: decimal({ precision: 12, scale: 2 }).$type<number>().default(0),
  saturi: decimal({ precision: 12, scale: 2 }).$type<number>().default(0),
  fiber: decimal({ precision: 12, scale: 2 }).$type<number>().default(0),
  salt: decimal({ precision: 12, scale: 2 }).$type<number>().default(0),
  polioli: decimal({ precision: 12, scale: 2 }).$type<number>().default(0),
  lot: varchar({ length: 255 }).default('NULL'),
  done: tinyint('done').default(0).notNull(),
  checkGlutine: tinyint('check_glutine').default(0).notNull(),
});

export const dddevIngredientLots = mysqlTable('dddev_ingredient_lots', {
  id: int().autoincrement().notNull(),
  sku: varchar({ length: 100 }).notNull(),
  lot: varchar({ length: 255 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' })
    .default('current_timestamp()')
    .notNull(),
  lastUsedAt: timestamp('last_used_at', { mode: 'string' }),
});

export const dddevRecipeOvenTemperature = mysqlTable(
  'dddev_recipe_oven_temperature',
  {
    id: int('id').autoincrement().notNull(),
    recipeId: int('recipe_id', { unsigned: true })
      .notNull()
      .references(() => dddevRecipe.id, {
        onDelete: 'cascade',
        onUpdate: 'restrict',
      }),
    temperature: decimal({ precision: 12, scale: 2 }).$type<number>().notNull(),
    minutes: decimal({ precision: 12, scale: 2 }).$type<number>().notNull(),
    order: int().default(0).notNull(),
  },
);

export const dddevRecipeMixingTime = mysqlTable('dddev_recipe_mixing_time', {
  id: int('id').autoincrement().notNull(),
  recipeId: int('recipe_id', { unsigned: true })
    .notNull()
    .references(() => dddevRecipe.id, {
      onDelete: 'cascade',
      onUpdate: 'restrict',
    }),
  minutes: decimal({ precision: 12, scale: 2 }).$type<number>().notNull(),
  speed: decimal({ precision: 12, scale: 2 }).$type<number>().notNull(),
  order: int().default(0).notNull(),
});

export const dddevRecipeIngredientRelations = relations(
  dddevRecipeIngredient,
  ({ one }) => ({
    dddevRecipe: one(dddevRecipe, {
      fields: [dddevRecipeIngredient.recipeId],
      references: [dddevRecipe.id],
    }),
  }),
);

export const dddevIngredientLotsRelations = relations(
  dddevIngredientLots,
  () => ({}),
);

export const dddevRecipeRelations = relations(dddevRecipe, ({ one, many }) => ({
  category: one(dddevRecipeCategory, {
    fields: [dddevRecipe.categoryId],
    references: [dddevRecipeCategory.id],
  }),
  dddevRecipeIngredients: many(dddevRecipeIngredient),
  ovenTemperatures: many(dddevRecipeOvenTemperature),
  mixingTimes: many(dddevRecipeMixingTime),
  clientRelations: many(dddevRecipeClientRelation),
  processes: many(dddevRecipeProcess),
}));

export const catalogProductEntityVarchar = mysqlTable(
  'catalog_product_entity_varchar',
  {
    valueId: int('value_id').autoincrement().notNull(),
    attributeId: smallint('attribute_id').notNull(),
    storeId: smallint('store_id').notNull(),
    entityId: int('entity_id').default(0).notNull(),
    value: varchar({ length: 255 }).default('NULL'),
  },
  (table) => [
    index('CATALOG_PRODUCT_ENTITY_VARCHAR_ATTRIBUTE_ID').on(table.attributeId),
    index('CATALOG_PRODUCT_ENTITY_VARCHAR_STORE_ID').on(table.storeId),
    unique('CATALOG_PRODUCT_ENTITY_VARCHAR_ENTITY_ID_ATTRIBUTE_ID_STORE_ID').on(
      table.entityId,
      table.attributeId,
      table.storeId,
    ),
  ],
);

export const catalogProductEntityDecimal = mysqlTable(
  'catalog_product_entity_decimal',
  {
    valueId: int('value_id').autoincrement().notNull(),
    attributeId: smallint('attribute_id').notNull(),
    storeId: smallint('store_id').notNull(),
    entityId: int('entity_id').default(0).notNull(),
    value: decimal({ precision: 12, scale: 4 }).$type<number>().default(0),
  },
  (table) => [
    index('CATALOG_PRODUCT_ENTITY_DECIMAL_ATTRIBUTE_ID').on(table.attributeId),
    index('CATALOG_PRODUCT_ENTITY_DECIMAL_STORE_ID').on(table.storeId),
    unique('CATALOG_PRODUCT_ENTITY_DECIMAL_ENTITY_ID_ATTRIBUTE_ID_STORE_ID').on(
      table.entityId,
      table.attributeId,
      table.storeId,
    ),
  ],
);

export const appRoles = mysqlTable(
  'app_roles',
  {
    id: int('id').autoincrement().notNull(),
    roleLabel: varchar('role_label', { length: 255 }).notNull(),
    allowedSections: text('allowed_sections').notNull().default('[]'),
    capabilities: text('capabilities').notNull().default('{}'),
    createdAt: timestamp('created_at', { mode: 'string' })
      .default('current_timestamp()')
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .default('current_timestamp()')
      .notNull(),
  },
  (table) => [unique('app_roles_role_label_unique').on(table.roleLabel)],
);

export const appPermissions = mysqlTable(
  'app_permissions',
  {
    id: int('id').autoincrement().notNull(),
    username: varchar('username', { length: 64 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    brand: varchar('brand', { length: 64 }).default('Molino Bongiovanni'),
    roleLabel: varchar('role_label', { length: 255 }).default(''),
    roleId: int('role_id'),
    avatarUrl: varchar('avatar_url', { length: 255 }).default(''),
    defaultSection: varchar('default_section', { length: 64 }).default(''),
    // Legacy fields - kept for backward compatibility with existing DB schema
    // These are no longer used (permissions are now in app_roles), but must be included in INSERT
    allowedSections: text('allowed_sections').notNull().default('[]'),
    capabilities: text('capabilities').notNull().default('{}'),
    notes: text('notes'),
    passwordHash: text('password_hash').notNull().default(''),
    mustChangePassword: tinyint('must_change_password').notNull().default(0),
    lastLoginAt: timestamp('last_login_at', { mode: 'string' }),
    createdAt: timestamp('created_at', { mode: 'string' })
      .default('current_timestamp()')
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .default('current_timestamp()')
      .notNull(),
  },
  (table) => [
    unique('app_permissions_username_unique').on(table.username),
    index('idx_role_id').on(table.roleId),
  ],
);

export const dddevCostStandard = mysqlTable(
  'dddev_cost_standard',
  {
    id: int().autoincrement().notNull(),
    costType: varchar('cost_type', { length: 64 }).notNull(),
    value: decimal({ precision: 12, scale: 2 })
      .$type<number>()
      .default(0)
      .notNull(),
    createdAt: timestamp('created_at', { mode: 'string' })
      .default('current_timestamp()')
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .default('current_timestamp()')
      .notNull(),
  },
  (table) => [
    unique('dddev_cost_standard_cost_type_unique').on(table.costType),
    index('idx_cost_type').on(table.costType),
  ],
);

export const dddevStandardParameters = mysqlTable(
  'dddev_standard_parameters',
  {
    id: int().autoincrement().notNull(),
    parameterType: varchar('parameter_type', { length: 64 }).notNull(),
    value: decimal({ precision: 12, scale: 2 })
      .$type<number>()
      .default(0)
      .notNull(),
    createdAt: timestamp('created_at', { mode: 'string' })
      .default('current_timestamp()')
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .default('current_timestamp()')
      .notNull(),
  },
  (table) => [
    unique('dddev_standard_parameters_parameter_type_unique').on(
      table.parameterType,
    ),
    index('idx_parameter_type').on(table.parameterType),
  ],
);

export const dddevColatriceDefaults = mysqlTable('dddev_colatrice_defaults', {
  id: int().autoincrement().notNull(),
  settings: text('settings').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' })
    .default('current_timestamp()')
    .notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' })
    .default('current_timestamp()')
    .notNull(),
});

export const dddevRecipeClientRelation = mysqlTable(
  'dddev_recipe_client_relation',
  {
    id: int().autoincrement().notNull(),
    recipeId: int('recipe_id')
      .notNull()
      .references(() => dddevRecipe.id, {
        onDelete: 'cascade',
        onUpdate: 'restrict',
      }),
    clientId: int('client_id')
      .notNull()
      .references(() => dddevRecipeClient.id, {
        onDelete: 'cascade',
        onUpdate: 'restrict',
      }),
    createdAt: timestamp('created_at', { mode: 'string' })
      .default('current_timestamp()')
      .notNull(),
  },
  (table) => [
    unique('dddev_recipe_client_relation_unique').on(
      table.recipeId,
      table.clientId,
    ),
    index('idx_recipe_id').on(table.recipeId),
    index('idx_client_id').on(table.clientId),
  ],
);

export const dddevRecipeCost = mysqlTable(
  'dddev_recipe_cost',
  {
    id: int().autoincrement().notNull(),
    recipeId: int('recipe_id')
      .notNull()
      .references(() => dddevRecipe.id, {
        onDelete: 'cascade',
        onUpdate: 'restrict',
      }),
    costType: varchar('cost_type', { length: 64 }).notNull(),
    value: decimal({ precision: 12, scale: 2 })
      .$type<number>()
      .default(0)
      .notNull(),
    createdAt: timestamp('created_at', { mode: 'string' })
      .default('current_timestamp()')
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .default('current_timestamp()')
      .notNull(),
  },
  (table) => [
    unique('unique_recipe_cost').on(table.recipeId, table.costType),
    index('idx_recipe_id').on(table.recipeId),
    index('idx_cost_type').on(table.costType),
  ],
);

export const dddevRecipeCostRelations = relations(
  dddevRecipeCost,
  ({ one }) => ({
    recipe: one(dddevRecipe, {
      fields: [dddevRecipeCost.recipeId],
      references: [dddevRecipe.id],
    }),
  }),
);

export const dddevRecipeVersion = mysqlTable('dddev_recipe_version', {
  id: int().autoincrement().notNull(),
  recipeId: int('recipe_id')
    .notNull()
    .references(() => dddevRecipe.id, {
      onDelete: 'cascade',
      onUpdate: 'restrict',
    }),
  versionNumber: int('version_number').notNull(),
  createdByUserId: int('created_by_user_id')
    .notNull()
    .references(() => appPermissions.id, {
      onDelete: 'restrict',
      onUpdate: 'restrict',
    }),
  createdAt: timestamp('created_at', { mode: 'string' })
    .default('current_timestamp()')
    .notNull(),
  recipeSnapshot: longtext('recipe_snapshot').notNull(),
  ingredientsSnapshot: longtext('ingredients_snapshot').notNull(),
});

export const dddevProduction = mysqlTable('dddev_production', {
  id: int().autoincrement().notNull(),
  recipeId: int('recipe_id')
    .notNull()
    .references(() => dddevRecipe.id, {
      onDelete: 'cascade',
      onUpdate: 'restrict',
    }),
  recipeVersionId: int('recipe_version_id').references(
    () => dddevRecipeVersion.id,
    {
      onDelete: 'set null',
      onUpdate: 'restrict',
    },
  ),
  userId: int('user_id')
    .notNull()
    .references(() => appPermissions.id, {
      onDelete: 'restrict',
      onUpdate: 'restrict',
    }),
  productionLot: varchar('production_lot', { length: 255 }).notNull(),
  startedAt: timestamp('started_at', { mode: 'string' })
    .default('current_timestamp()')
    .notNull(),
  finishedAt: timestamp('finished_at', { mode: 'string' }),
  status: varchar('status', { length: 20 }).default('in_progress').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'string' })
    .default('current_timestamp()')
    .notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' })
    .default('current_timestamp()')
    .notNull(),
});

export const dddevRecipeHistory = mysqlTable('dddev_recipe_history', {
  id: int().autoincrement().notNull(),
  recipeId: int('recipe_id')
    .notNull()
    .references(() => dddevRecipe.id, {
      onDelete: 'cascade',
      onUpdate: 'restrict',
    }),
  recipeVersionId: int('recipe_version_id').references(
    () => dddevRecipeVersion.id,
    {
      onDelete: 'set null',
      onUpdate: 'restrict',
    },
  ),
  productionId: int('production_id').references(() => dddevProduction.id, {
    onDelete: 'set null',
    onUpdate: 'restrict',
  }),
  userId: int('user_id')
    .notNull()
    .references(() => appPermissions.id, {
      onDelete: 'restrict',
      onUpdate: 'restrict',
    }),
  changeType: varchar('change_type', { length: 20 }).notNull(),
  fieldName: varchar('field_name', { length: 255 }),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  changeDescription: text('change_description').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' })
    .default('current_timestamp()')
    .notNull(),
});

export const dddevProductionIngredient = mysqlTable(
  'dddev_production_ingredient',
  {
    id: int().autoincrement().notNull(),
    productionId: int('production_id')
      .notNull()
      .references(() => dddevProduction.id, {
        onDelete: 'cascade',
        onUpdate: 'restrict',
      }),
    ingredientId: int('ingredient_id')
      .notNull()
      .references(() => dddevRecipeIngredient.id, {
        onDelete: 'cascade',
        onUpdate: 'restrict',
      }),
    lot: varchar({ length: 255 }),
    productNameOverride: varchar('product_name_override', { length: 255 }),
    mpSkuOverride: varchar('mp_sku_override', { length: 100 }),
    supplierOverride: varchar('supplier_override', { length: 255 }),
    warehouseLocationOverride: varchar('warehouse_location_override', {
      length: 255,
    }),
    createdAt: timestamp('created_at', { mode: 'string' })
      .default('current_timestamp()')
      .notNull(),
  },
);

export const dddevProcess = mysqlTable(
  'dddev_process',
  {
    id: int().autoincrement().notNull(),
    name: varchar({ length: 255 }).notNull(),
    order: int().default(0).notNull(),
    createdAt: timestamp('created_at', { mode: 'string' })
      .default('current_timestamp()')
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .default('current_timestamp()')
      .onUpdateNow()
      .notNull(),
  },
  (table) => [
    unique('dddev_process_name_unique').on(table.name),
    index('idx_process_order').on(table.order),
  ],
);

export const dddevRecipeProcess = mysqlTable(
  'dddev_recipe_process',
  {
    id: int().autoincrement().notNull(),
    recipeId: int('recipe_id')
      .notNull()
      .references(() => dddevRecipe.id, {
        onDelete: 'cascade',
        onUpdate: 'restrict',
      }),
    processId: int('process_id')
      .notNull()
      .references(() => dddevProcess.id, {
        onDelete: 'cascade',
        onUpdate: 'restrict',
      }),
    minutes: decimal('minutes', { precision: 12, scale: 2 })
      .$type<number>()
      .default(0)
      .notNull(),
    cycles: int().default(1).notNull(),
    cycleField: varchar('cycle_field', { length: 64 }),
    createdAt: timestamp('created_at', { mode: 'string' })
      .default('current_timestamp()')
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .default('current_timestamp()')
      .onUpdateNow()
      .notNull(),
  },
  (table) => [
    unique('dddev_recipe_process_unique').on(table.recipeId, table.processId),
    index('idx_recipe_id').on(table.recipeId),
    index('idx_process_id').on(table.processId),
  ],
);

export const dddevRecipeProcessTracking = mysqlTable(
  'dddev_recipe_process_tracking',
  {
    id: int().autoincrement().notNull(),
    productionId: int('production_id')
      .notNull()
      .references(() => dddevProduction.id, {
        onDelete: 'cascade',
        onUpdate: 'restrict',
      }),
    processId: int('process_id')
      .notNull()
      .references(() => dddevProcess.id, {
        onDelete: 'restrict',
        onUpdate: 'restrict',
      }),
    startedAt: timestamp('started_at', { mode: 'string' })
      .default('current_timestamp()')
      .notNull(),
    endedAt: timestamp('ended_at', { mode: 'string' }),
    durationSeconds: int('duration_seconds'),
    userId: int('user_id')
      .notNull()
      .references(() => appPermissions.id, {
        onDelete: 'restrict',
        onUpdate: 'restrict',
      }),
    createdAt: timestamp('created_at', { mode: 'string' })
      .default('current_timestamp()')
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .default('current_timestamp()')
      .onUpdateNow()
      .notNull(),
  },
  (table) => [
    index('idx_production_id').on(table.productionId),
    index('idx_process_id').on(table.processId),
    index('idx_user_id').on(table.userId),
  ],
);

export const dddevRecipeProcessCost = mysqlTable(
  'dddev_recipe_process_cost',
  {
    id: int().autoincrement().notNull(),
    recipeProcessId: int('recipe_process_id')
      .notNull()
      .references(() => dddevRecipeProcess.id, {
        onDelete: 'cascade',
        onUpdate: 'restrict',
      }),
    costType: varchar('cost_type', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'string' })
      .default('current_timestamp()')
      .notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .default('current_timestamp()')
      .onUpdateNow()
      .notNull(),
  },
  (table) => [
    unique('dddev_recipe_process_cost_unique').on(
      table.recipeProcessId,
      table.costType,
    ),
    index('idx_recipe_process_id').on(table.recipeProcessId),
    index('idx_cost_type').on(table.costType),
  ],
);

// Relations
export const dddevRecipeVersionRelations = relations(
  dddevRecipeVersion,
  ({ one, many }) => ({
    recipe: one(dddevRecipe, {
      fields: [dddevRecipeVersion.recipeId],
      references: [dddevRecipe.id],
    }),
    createdBy: one(appPermissions, {
      fields: [dddevRecipeVersion.createdByUserId],
      references: [appPermissions.id],
    }),
    productions: many(dddevProduction),
    historyEntries: many(dddevRecipeHistory),
  }),
);

export const dddevProductionRelations = relations(
  dddevProduction,
  ({ one, many }) => ({
    recipe: one(dddevRecipe, {
      fields: [dddevProduction.recipeId],
      references: [dddevRecipe.id],
    }),
    recipeVersion: one(dddevRecipeVersion, {
      fields: [dddevProduction.recipeVersionId],
      references: [dddevRecipeVersion.id],
    }),
    user: one(appPermissions, {
      fields: [dddevProduction.userId],
      references: [appPermissions.id],
    }),
    historyEntries: many(dddevRecipeHistory),
    ingredients: many(dddevProductionIngredient),
    processTracking: many(dddevRecipeProcessTracking),
  }),
);

export const dddevRecipeHistoryRelations = relations(
  dddevRecipeHistory,
  ({ one }) => ({
    recipe: one(dddevRecipe, {
      fields: [dddevRecipeHistory.recipeId],
      references: [dddevRecipe.id],
    }),
    recipeVersion: one(dddevRecipeVersion, {
      fields: [dddevRecipeHistory.recipeVersionId],
      references: [dddevRecipeVersion.id],
    }),
    production: one(dddevProduction, {
      fields: [dddevRecipeHistory.productionId],
      references: [dddevProduction.id],
    }),
    user: one(appPermissions, {
      fields: [dddevRecipeHistory.userId],
      references: [appPermissions.id],
    }),
  }),
);

export const dddevProductionIngredientRelations = relations(
  dddevProductionIngredient,
  ({ one }) => ({
    production: one(dddevProduction, {
      fields: [dddevProductionIngredient.productionId],
      references: [dddevProduction.id],
    }),
    ingredient: one(dddevRecipeIngredient, {
      fields: [dddevProductionIngredient.ingredientId],
      references: [dddevRecipeIngredient.id],
    }),
  }),
);

export const dddevRecipeCategoryRelations = relations(
  dddevRecipeCategory,
  ({ many }) => ({
    recipes: many(dddevRecipe),
  }),
);

export const dddevRecipeClientRelations = relations(
  dddevRecipeClient,
  ({ many }) => ({
    recipeRelations: many(dddevRecipeClientRelation),
  }),
);

export const dddevRecipeClientRelationRelations = relations(
  dddevRecipeClientRelation,
  ({ one }) => ({
    recipe: one(dddevRecipe, {
      fields: [dddevRecipeClientRelation.recipeId],
      references: [dddevRecipe.id],
    }),
    client: one(dddevRecipeClient, {
      fields: [dddevRecipeClientRelation.clientId],
      references: [dddevRecipeClient.id],
    }),
  }),
);

export const dddevProcessRelations = relations(dddevProcess, ({ many }) => ({
  recipeProcesses: many(dddevRecipeProcess),
  tracking: many(dddevRecipeProcessTracking),
}));

export const dddevRecipeProcessRelations = relations(
  dddevRecipeProcess,
  ({ one, many }) => ({
    recipe: one(dddevRecipe, {
      fields: [dddevRecipeProcess.recipeId],
      references: [dddevRecipe.id],
    }),
    process: one(dddevProcess, {
      fields: [dddevRecipeProcess.processId],
      references: [dddevProcess.id],
    }),
    costs: many(dddevRecipeProcessCost),
  }),
);

export const dddevRecipeProcessCostRelations = relations(
  dddevRecipeProcessCost,
  ({ one }) => ({
    recipeProcess: one(dddevRecipeProcess, {
      fields: [dddevRecipeProcessCost.recipeProcessId],
      references: [dddevRecipeProcess.id],
    }),
  }),
);

export const dddevRecipeProcessTrackingRelations = relations(
  dddevRecipeProcessTracking,
  ({ one }) => ({
    production: one(dddevProduction, {
      fields: [dddevRecipeProcessTracking.productionId],
      references: [dddevProduction.id],
    }),
    process: one(dddevProcess, {
      fields: [dddevRecipeProcessTracking.processId],
      references: [dddevProcess.id],
    }),
    user: one(appPermissions, {
      fields: [dddevRecipeProcessTracking.userId],
      references: [appPermissions.id],
    }),
  }),
);
