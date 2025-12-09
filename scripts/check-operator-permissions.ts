/**
 * Script per verificare i permessi del ruolo "operator" nel database
 * e confrontarli con il rendering della pagina recipe editor
 */

// Load environment variables
import 'dotenv/config';

import { db } from '../src/db';
import { appRoles } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { toAppRole } from '../src/lib/permissions/transform';
import { canView, canEdit } from '../src/lib/permissions/check';
import type { PermissionCapabilities } from '../src/types';

// Capability IDs usati nella pagina recipe editor
const HEADER_CAPABILITY = 'recipe.header.meta';
const CALCULATED_CAPABILITY = 'recipe.calculated.panel';
const NOTES_CAPABILITY = 'recipe.notes.body';
const NUTRITION_PANEL_CAPABILITY = 'recipe.nutrition.panel';
const SAVE_CAPABILITY = 'recipe.actions.save';

const BASIC_CAPABILITIES = {
  name: 'recipe.basic.name',
  packageWeight: 'recipe.basic.packageWeight',
  numberOfPackages: 'recipe.basic.numberOfPackages',
  wastePercent: 'recipe.basic.wastePercent',
  waterPercent: 'recipe.basic.waterPercent',
} as const;

const PROCESS_CAPABILITIES = {
  cookiesCount: 'recipe.process.cookiesCount',
  cookieWeightRawG: 'recipe.process.cookieWeightRawG',
  cookieWeightCookedG: 'recipe.process.cookieWeightCookedG',
  trayWeightRawG: 'recipe.process.trayWeightRawG',
  trayWeightCookedG: 'recipe.process.trayWeightCookedG',
  mixerCapacityKg: 'recipe.process.mixerCapacityKg',
  doughBatchesCount: 'recipe.process.doughBatchesCount',
  depositorCapacityKg: 'recipe.process.depositorCapacityKg',
  depositorsCount: 'recipe.process.depositorsCount',
  traysCapacityKg: 'recipe.process.traysCapacityKg',
  traysCount: 'recipe.process.traysCount',
  traysPerBatch: 'recipe.process.traysPerBatch',
  traysPerDepositors: 'recipe.process.traysPerDepositors',
  traysPerOvenLoad: 'recipe.process.traysPerOvenLoad',
  ovenLoadsCount: 'recipe.process.ovenLoadsCount',
  glutenTestDone: 'recipe.process.glutenTestDone',
  valveOpenMinutes: 'recipe.process.valveOpenMinutes',
  lot: 'recipe.process.lot',
} as const;

const INGREDIENT_CAPABILITIES = {
  table: 'recipe.ingredients.table',
  editing: 'recipe.ingredients.editing',
  actions: 'recipe.ingredients.actions',
  nutrition: 'recipe.ingredients.nutrition',
} as const;

const COSTS_CAPABILITY = 'recipe.costs';

interface CapabilityCheck {
  id: string;
  visible: boolean;
  editable: boolean;
  expectedVisible: boolean;
  expectedEditable: boolean;
  match: boolean;
}

async function checkOperatorPermissions() {
  console.log('🔍 Verifica permessi ruolo "operator"...\n');

  try {
    // Leggi il ruolo "operator" dal database
    const operatorRoleRecords = await db
      .select()
      .from(appRoles)
      .where(eq(appRoles.roleLabel, 'operator'));

    if (operatorRoleRecords.length === 0) {
      console.error('❌ Ruolo "operator" non trovato nel database');
      process.exit(1);
    }

    const roleRecord = operatorRoleRecords[0];
    const role = toAppRole(roleRecord);

    console.log(`📋 Ruolo trovato: ID=${role.id}, Label="${role.roleLabel}"`);
    console.log(
      `📊 Capabilities nel DB: ${Object.keys(role.capabilities).length} regole configurate\n`,
    );

    // Mostra tutte le capabilities configurate
    console.log('📝 Capabilities configurate nel database:');
    console.log('─'.repeat(80));
    const sortedCapabilities = Object.entries(role.capabilities).sort(
      ([a], [b]) => a.localeCompare(b),
    );
    for (const [id, rule] of sortedCapabilities) {
      const visible = rule.visible ? '✅' : '❌';
      const editable = rule.editable ? '✏️' : '🔒';
      console.log(`  ${visible} ${editable} ${id}`);
    }
    console.log('─'.repeat(80));
    console.log('');

    // Verifica visibilità e editabilità per ogni capability usata nella pagina recipe
    const checks: CapabilityCheck[] = [];

    // Header
    checks.push({
      id: HEADER_CAPABILITY,
      visible: canView(role.capabilities, HEADER_CAPABILITY, false),
      editable: canEdit(role.capabilities, HEADER_CAPABILITY),
      expectedVisible: role.capabilities[HEADER_CAPABILITY]?.visible ?? true,
      expectedEditable: role.capabilities[HEADER_CAPABILITY]?.editable ?? true,
      match: true, // Will be calculated
    });

    // Basic capabilities
    for (const capabilityId of Object.values(BASIC_CAPABILITIES)) {
      const rule = role.capabilities[capabilityId];
      checks.push({
        id: capabilityId,
        visible: canView(role.capabilities, capabilityId, false),
        editable: canEdit(role.capabilities, capabilityId),
        expectedVisible: rule?.visible ?? true,
        expectedEditable: rule?.editable ?? true,
        match: true,
      });
    }

    // Process capabilities
    for (const capabilityId of Object.values(PROCESS_CAPABILITIES)) {
      const rule = role.capabilities[capabilityId];
      checks.push({
        id: capabilityId,
        visible: canView(role.capabilities, capabilityId, false),
        editable: canEdit(role.capabilities, capabilityId),
        expectedVisible: rule?.visible ?? true,
        expectedEditable: rule?.editable ?? true,
        match: true,
      });
    }

    // Ingredient capabilities
    for (const capabilityId of Object.values(INGREDIENT_CAPABILITIES)) {
      const rule = role.capabilities[capabilityId];
      checks.push({
        id: capabilityId,
        visible: canView(role.capabilities, capabilityId, false),
        editable: canEdit(role.capabilities, capabilityId),
        expectedVisible: rule?.visible ?? true,
        expectedEditable: rule?.editable ?? true,
        match: true,
      });
    }

    // Other capabilities
    const otherCapabilities = [
      CALCULATED_CAPABILITY,
      NOTES_CAPABILITY,
      NUTRITION_PANEL_CAPABILITY,
      SAVE_CAPABILITY,
      COSTS_CAPABILITY,
    ];

    for (const id of otherCapabilities) {
      const rule = role.capabilities[id];
      checks.push({
        id,
        visible: canView(role.capabilities, id, false),
        editable: canEdit(role.capabilities, id),
        expectedVisible: rule?.visible ?? true,
        expectedEditable: rule?.editable ?? true,
        match: true,
      });
    }

    // Calcola match
    for (const check of checks) {
      check.match =
        check.visible === check.expectedVisible &&
        check.editable === check.expectedEditable;
    }

    // Raggruppa per sezione
    const basicCapabilityIds = Object.values(BASIC_CAPABILITIES);
    const processCapabilityIds = Object.values(PROCESS_CAPABILITIES);
    const ingredientCapabilityIds = Object.values(INGREDIENT_CAPABILITIES);
    const sections = {
      Header: checks.filter((c) => c.id === HEADER_CAPABILITY),
      'Basic Info': checks.filter((c) =>
        basicCapabilityIds.includes(
          c.id as (typeof basicCapabilityIds)[number],
        ),
      ),
      'Process Settings': checks.filter((c) =>
        processCapabilityIds.includes(
          c.id as (typeof processCapabilityIds)[number],
        ),
      ),
      Ingredients: checks.filter((c) =>
        ingredientCapabilityIds.includes(
          c.id as (typeof ingredientCapabilityIds)[number],
        ),
      ),
      Other: checks.filter((c) => otherCapabilities.includes(c.id)),
    };

    // Report
    console.log('📊 REPORT VISIBILITÀ E EDITABILITÀ PER PAGINA RECIPE EDITOR');
    console.log('═'.repeat(80));

    for (const [sectionName, sectionChecks] of Object.entries(sections)) {
      if (sectionChecks.length === 0) continue;

      console.log(`\n📦 ${sectionName}:`);
      console.log('─'.repeat(80));

      for (const check of sectionChecks) {
        const visibleIcon = check.visible ? '✅' : '❌';
        const editableIcon = check.editable ? '✏️' : '🔒';
        const matchIcon = check.match ? '✓' : '⚠️';

        console.log(
          `  ${matchIcon} ${visibleIcon} ${editableIcon} ${check.id.padEnd(50)} | Visible: ${String(check.visible).padEnd(5)} | Editable: ${String(check.editable).padEnd(5)}`,
        );
      }
    }

    console.log('\n' + '═'.repeat(80));

    // Verifica sezioni principali
    const basicFieldIds = Object.values(BASIC_CAPABILITIES);
    const processFieldIds = Object.values(PROCESS_CAPABILITIES);

    const canViewHeader = canView(role.capabilities, HEADER_CAPABILITY, false);
    const canViewBasic = basicFieldIds.some((id) =>
      canView(role.capabilities, id, false),
    );
    const canViewProcess = processFieldIds.some((id) =>
      canView(role.capabilities, id, false),
    );
    const canViewIngredientsTable = canView(
      role.capabilities,
      INGREDIENT_CAPABILITIES.table,
      false,
    );
    const canViewNotes = canView(role.capabilities, NOTES_CAPABILITY, false);
    const canViewCosts = canView(role.capabilities, COSTS_CAPABILITY, false);

    const showProcessSection = canViewBasic || canViewProcess;
    const showEditSection = canViewIngredientsTable || canViewNotes;
    const willRender = canViewHeader || showProcessSection || showEditSection;

    console.log('\n🎯 SEZIONI PRINCIPALI:');
    console.log('─'.repeat(80));
    console.log(
      `  Header:                    ${canViewHeader ? '✅ VISIBILE' : '❌ NASCOSTO'}`,
    );
    console.log(
      `  Process Settings:          ${showProcessSection ? '✅ VISIBILE' : '❌ NASCOSTO'}`,
    );
    console.log(
      `    - Basic Info:            ${canViewBasic ? '✅ VISIBILE' : '❌ NASCOSTO'}`,
    );
    console.log(
      `    - Process Fields:        ${canViewProcess ? '✅ VISIBILE' : '❌ NASCOSTO'}`,
    );
    console.log(
      `  Edit Recipe:               ${showEditSection ? '✅ VISIBILE' : '❌ NASCOSTO'}`,
    );
    console.log(
      `    - Ingredients Table:     ${canViewIngredientsTable ? '✅ VISIBILE' : '❌ NASCOSTO'}`,
    );
    console.log(
      `    - Notes:                 ${canViewNotes ? '✅ VISIBILE' : '❌ NASCOSTO'}`,
    );
    console.log(
      `  Costs Section:             ${canViewCosts ? '✅ VISIBILE' : '❌ NASCOSTO'}`,
    );
    console.log('─'.repeat(80));
    console.log(
      `\n🎬 RISULTATO FINALE: ${willRender ? '✅ PAGINA RENDERIZZATA' : '❌ PAGINA VUOTA'}`,
    );

    // Verifica capabilities mancanti
    const allCapabilityIds = [
      HEADER_CAPABILITY,
      ...Object.values(BASIC_CAPABILITIES),
      ...Object.values(PROCESS_CAPABILITIES),
      ...Object.values(INGREDIENT_CAPABILITIES),
      CALCULATED_CAPABILITY,
      NOTES_CAPABILITY,
      NUTRITION_PANEL_CAPABILITY,
      SAVE_CAPABILITY,
      COSTS_CAPABILITY,
    ];

    const missingCapabilities = allCapabilityIds.filter(
      (id) => !role.capabilities[id],
    );

    if (missingCapabilities.length > 0) {
      console.log(
        '\n⚠️  CAPABILITIES NON CONFIGURATE (useranno valori di default):',
      );
      console.log('─'.repeat(80));
      for (const id of missingCapabilities) {
        const visible = canView(role.capabilities, id, false);
        const editable = canEdit(role.capabilities, id);
        console.log(
          `  ${id.padEnd(50)} | Visible: ${String(visible).padEnd(5)} | Editable: ${String(editable).padEnd(5)}`,
        );
      }
    }

    console.log('\n' + '═'.repeat(80));

    // Test con capabilities vuote (simula operatore senza capabilities configurati)
    console.log(
      '\n🧪 TEST: Simulazione operatore senza capabilities configurati',
    );
    console.log('─'.repeat(80));
    const emptyCapabilities: PermissionCapabilities = {};
    const canViewHeaderEmpty = canView(
      emptyCapabilities,
      HEADER_CAPABILITY,
      false,
    );
    const canViewBasicEmpty = basicFieldIds.some((id) =>
      canView(emptyCapabilities, id, false),
    );
    const canViewProcessEmpty = processFieldIds.some((id) =>
      canView(emptyCapabilities, id, false),
    );
    const canViewIngredientsTableEmpty = canView(
      emptyCapabilities,
      INGREDIENT_CAPABILITIES.table,
      false,
    );
    const canViewNotesEmpty = canView(
      emptyCapabilities,
      NOTES_CAPABILITY,
      false,
    );
    const showProcessSectionEmpty = canViewBasicEmpty || canViewProcessEmpty;
    const showEditSectionEmpty =
      canViewIngredientsTableEmpty || canViewNotesEmpty;
    const willRenderEmpty =
      canViewHeaderEmpty || showProcessSectionEmpty || showEditSectionEmpty;
    console.log(
      `  Header:                    ${canViewHeaderEmpty ? '✅ VISIBILE' : '❌ NASCOSTO'}`,
    );
    console.log(
      `  Process Settings:          ${showProcessSectionEmpty ? '✅ VISIBILE' : '❌ NASCOSTO'}`,
    );
    console.log(
      `  Edit Recipe:               ${showEditSectionEmpty ? '✅ VISIBILE' : '❌ NASCOSTO'}`,
    );
    console.log(
      `  Risultato:                  ${willRenderEmpty ? '✅ PAGINA RENDERIZZATA' : '❌ PAGINA VUOTA'}`,
    );

    // Test con Vista Operatore attiva (simula admin che vede come operatore)
    console.log(
      '\n🧪 TEST: Simulazione Vista Operatore attiva (isOperatorView = true)',
    );
    console.log('─'.repeat(80));
    const canViewHeaderOperatorView = canView(
      role.capabilities,
      HEADER_CAPABILITY,
      true,
    );
    const canViewBasicOperatorView = basicFieldIds.some((id) =>
      canView(role.capabilities, id, true),
    );
    const canViewProcessOperatorView = processFieldIds.some((id) =>
      canView(role.capabilities, id, true),
    );
    const canViewIngredientsTableOperatorView = canView(
      role.capabilities,
      INGREDIENT_CAPABILITIES.table,
      true,
    );
    const canViewNotesOperatorView = canView(
      role.capabilities,
      NOTES_CAPABILITY,
      true,
    );
    const showProcessSectionOperatorView =
      canViewBasicOperatorView || canViewProcessOperatorView;
    const showEditSectionOperatorView =
      canViewIngredientsTableOperatorView || canViewNotesOperatorView;
    const willRenderOperatorView =
      canViewHeaderOperatorView ||
      showProcessSectionOperatorView ||
      showEditSectionOperatorView;
    console.log(
      `  Header:                    ${canViewHeaderOperatorView ? '✅ VISIBILE' : '❌ NASCOSTO'}`,
    );
    console.log(
      `  Process Settings:          ${showProcessSectionOperatorView ? '✅ VISIBILE' : '❌ NASCOSTO'}`,
    );
    console.log(
      `  Edit Recipe:               ${showEditSectionOperatorView ? '✅ VISIBILE' : '❌ NASCOSTO'}`,
    );
    console.log(
      `  Risultato:                  ${willRenderOperatorView ? '✅ PAGINA RENDERIZZATA' : '❌ PAGINA VUOTA'}`,
    );

    console.log('\n' + '═'.repeat(80));
    console.log(`\n✅ Verifica completata!`);

    if (!willRender) {
      console.log(
        '\n⚠️  ATTENZIONE: La pagina risulterà VUOTA per gli operatori!',
      );
      console.log(
        '   Assicurati che almeno una di queste condizioni sia vera:',
      );
      console.log('   - Header visibile');
      console.log('   - Basic Info visibile');
      console.log('   - Process Fields visibile');
      console.log('   - Ingredients Table visibile');
      console.log('   - Notes visibile');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Errore durante la verifica:', error);
    process.exit(1);
  }
}

// Esegui lo script
checkOperatorPermissions();
