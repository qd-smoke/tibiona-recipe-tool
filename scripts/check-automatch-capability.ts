/**
 * Script per verificare la capability recipe.ingredients.automatch nel database
 */

// Load environment variables
import 'dotenv/config';

import { db } from '../src/db';
import { appRoles, appPermissions } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import {
  toAppRole,
  toPermissionProfile,
} from '../src/lib/permissions/transform';

const AUTOMATCH_CAPABILITY = 'recipe.ingredients.automatch';

async function checkAutomatchCapability() {
  console.log('🔍 Verifica capability recipe.ingredients.automatch...\n');

  try {
    // Check in app_roles
    console.log('📋 Controllo in app_roles:');
    console.log('─'.repeat(80));
    const roles = await db.select().from(appRoles);

    for (const roleRecord of roles) {
      const role = toAppRole(roleRecord);
      const automatchRule = role.capabilities[AUTOMATCH_CAPABILITY];

      console.log(`\nRuolo: ${role.roleLabel} (ID: ${role.id})`);
      if (automatchRule) {
        console.log(
          `  ✅ Capability trovata: visible=${automatchRule.visible}, editable=${automatchRule.editable}`,
        );
        console.log(
          `  Raw in DB: ${JSON.stringify(JSON.parse(roleRecord.capabilities)[AUTOMATCH_CAPABILITY])}`,
        );
      } else {
        console.log(`  ❌ Capability NON trovata`);
        // Check if it's in the raw JSON
        const rawCapabilities = JSON.parse(roleRecord.capabilities);
        if (AUTOMATCH_CAPABILITY in rawCapabilities) {
          console.log(
            `  ⚠️  Presente nel JSON raw ma non parsato: ${JSON.stringify(rawCapabilities[AUTOMATCH_CAPABILITY])}`,
          );
        }
      }
    }

    // Check in app_permissions (legacy)
    console.log('\n\n📋 Controllo in app_permissions (legacy):');
    console.log('─'.repeat(80));
    const permissions = await db.select().from(appPermissions).limit(10);

    for (const permRecord of permissions) {
      const profile = toPermissionProfile(permRecord, null);
      const automatchRule = profile.capabilities[AUTOMATCH_CAPABILITY];

      console.log(
        `\nUtente: ${profile.username} (ID: ${profile.id}, Role: ${profile.roleLabel})`,
      );
      if (automatchRule) {
        console.log(
          `  ✅ Capability trovata: visible=${automatchRule.visible}, editable=${automatchRule.editable}`,
        );
        console.log(
          `  Raw in DB: ${JSON.stringify(JSON.parse(permRecord.capabilities)[AUTOMATCH_CAPABILITY])}`,
        );
      } else {
        console.log(`  ❌ Capability NON trovata`);
        // Check if it's in the raw JSON
        const rawCapabilities = JSON.parse(permRecord.capabilities);
        if (AUTOMATCH_CAPABILITY in rawCapabilities) {
          console.log(
            `  ⚠️  Presente nel JSON raw ma non parsato: ${JSON.stringify(rawCapabilities[AUTOMATCH_CAPABILITY])}`,
          );
        }
      }
    }

    console.log('\n\n✅ Verifica completata');
  } catch (error) {
    console.error('❌ Errore durante la verifica:', error);
    process.exit(1);
  }
}

checkAutomatchCapability()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
