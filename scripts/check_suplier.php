<?php
// Version: 2025-10-20 12:30:00
// Usage: php scripts/check_suplier.php [sku|entity:<id>]

if (php_sapi_name() !== 'cli') { echo "Run from CLI\n"; exit(1); }

$arg = $argv[1] ?? '';
require_once __DIR__ . '/../datasheet/init.php';
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../datasheet/lib/magento.php';

function eprint($s){ fwrite(STDOUT, $s . PHP_EOL); }

if (!$arg) { eprint("Usage: php scripts/check_suplier.php <sku> | entity:<id>"); exit(2); }

try{
  if (strpos($arg, 'entity:') === 0){
    $id = (int)substr($arg, 7);
    eprint("Searching product by entity_id={$id}...");
    $path = "products?searchCriteria[filter_groups][0][filters][0][field]=entity_id&searchCriteria[filter_groups][0][filters][0][value]={$id}&searchCriteria[filter_groups][0][filters][0][condition_type]=eq&fields=items[sku]";
    $j = mgRest('GET', $path);
    $sku = $j['items'][0]['sku'] ?? null;
    if (!$sku){ eprint("Product not found by entity_id"); exit(3); }
  } else {
    $sku = $arg;
  }

  eprint("Fetching product SKU={$sku} on default scope...");
  $prod_default = mgRest('GET', 'products/' . rawurlencode($sku));
  eprint("Default scope: name=" . ($prod_default['name'] ?? '<no>') . ", updated_at=" . ($prod_default['updated_at'] ?? ''));
  $found_def = null;
  foreach (($prod_default['custom_attributes'] ?? []) as $c){ if (($c['attribute_code'] ?? '') === 'suplier'){ $found_def = $c; break; } }
  eprint("Default suplier: " . ($found_def ? json_encode($found_def, JSON_UNESCAPED_UNICODE) : '<not present>'));

  // also fetch for store view id 1 (common case)
  $storeId = 1;
  try{
    eprint("Fetching product SKU={$sku} on storeId={$storeId}...");
    $prod_store = mgRest('GET', 'products/' . rawurlencode($sku), null, $storeId);
    $found_store = null;
    foreach (($prod_store['custom_attributes'] ?? []) as $c){ if (($c['attribute_code'] ?? '') === 'suplier'){ $found_store = $c; break; } }
    eprint("Store {$storeId} suplier: " . ($found_store ? json_encode($found_store, JSON_UNESCAPED_UNICODE) : '<not present>'));
  } catch(Throwable $e){ eprint("Store {$storeId} fetch failed: " . $e->getMessage()); }

  eprint("Fetching attribute metadata for 'suplier'...");
  $meta = mgRest('GET', 'products/attributes/suplier');
  eprint("Attribute metadata: " . json_encode($meta, JSON_UNESCAPED_UNICODE));

  // If select options present, print some options
  if (!empty($meta['options']) && is_array($meta['options'])){
    eprint("Options sample (first 20):");
    $i=0; foreach ($meta['options'] as $opt){ eprint("  value=" . ($opt['value'] ?? '<>') . " label=" . ($opt['label'] ?? '')); if(++$i>=20) break; }
  }

  eprint("Done.");
} catch (Throwable $e){ eprint('Error: '.$e->getMessage()); exit(9); }
