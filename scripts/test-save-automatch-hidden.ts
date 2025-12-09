/**
 * Script per testare il salvataggio di recipe.ingredients.automatch come hidden
 */

// Load environment variables
import 'dotenv/config';

import { db } from '../src/db';
import { appRoles } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { toAppRole } from '../src/lib/permissions/transform';
import { serializeCapabilities } from '../src/lib/permissions/transform';

const AUTOMATCH_CAPABILITY = 'recipe.ingredients.automatch';

async function testSaveAutomatchHidden() {
  console.log(
    '🔍 Test salvataggio recipe.ingredients.automatch come hidden...\n',
  );

  try {
    // Leggi il ruolo operator
    const [operatorRole] = await db
      .select()
      .from(appRoles)
      .where(eq(appRoles.roleLabel, 'operator'))
      .limit(1);

    if (!operatorRole) {
      console.error('❌ Ruolo "operator" non trovato');
      process.exit(1);
    }

    const role = toAppRole(operatorRole);
    console.log(`📋 Ruolo trovato: ${role.roleLabel} (ID: ${role.id})`);
    console.log(
      `📊 Capabilities attuali: ${Object.keys(role.capabilities).length}`,
    );

    // Verifica se automatch è presente
    const automatchBefore = role.capabilities[AUTOMATCH_CAPABILITY];
    console.log(`\n🔍 Stato attuale di ${AUTOMATCH_CAPABILITY}:`);
    if (automatchBefore) {
      console.log(
        `  ✅ Presente: visible=${automatchBefore.visible}, editable=${automatchBefore.editable}`,
      );
    } else {
      console.log(`  ❌ NON presente`);
    }

    // Simula il salvataggio con automatch hidden
    const testCapabilities = {
      ...role.capabilities,
      [AUTOMATCH_CAPABILITY]: {
        visible: false,
        editable: false,
      },
    };

    console.log(`\n💾 Simulazione salvataggio con automatch hidden:`);
    console.log(
      `  Capabilities count: ${Object.keys(testCapabilities).length}`,
    );
    console.log(
      `  ${AUTOMATCH_CAPABILITY}: visible=${testCapabilities[AUTOMATCH_CAPABILITY].visible}, editable=${testCapabilities[AUTOMATCH_CAPABILITY].editable}`,
    );

    // Serializza come farebbe l'API
    const serialized = serializeCapabilities(testCapabilities);
    console.log(`\n📦 Dopo serializeCapabilities:`);
    console.log(`  Capabilities count: ${Object.keys(serialized).length}`);
    if (serialized[AUTOMATCH_CAPABILITY]) {
      console.log(
        `  ✅ ${AUTOMATCH_CAPABILITY} presente: visible=${serialized[AUTOMATCH_CAPABILITY].visible}, editable=${serialized[AUTOMATCH_CAPABILITY].editable}`,
      );
    } else {
      console.log(
        `  ❌ ${AUTOMATCH_CAPABILITY} NON presente dopo serializzazione!`,
      );
    }

    const jsonString = JSON.stringify(serialized);
    console.log(`\n📄 JSON risultante (primi 500 caratteri):`);
    console.log(jsonString.substring(0, 500));

    // Verifica se automatch è nel JSON
    const parsed = JSON.parse(jsonString);
    if (parsed[AUTOMATCH_CAPABILITY]) {
      console.log(`\n✅ ${AUTOMATCH_CAPABILITY} è presente nel JSON finale`);
    } else {
      console.log(
        `\n❌ ${AUTOMATCH_CAPABILITY} NON è presente nel JSON finale!`,
      );
    }

    console.log('\n✅ Test completato');
  } catch (error) {
    console.error('❌ Errore durante il test:', error);
    process.exit(1);
  }
}

testSaveAutomatchHidden()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
