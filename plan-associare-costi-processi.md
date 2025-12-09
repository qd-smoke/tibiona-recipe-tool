# Associare costi ai processi di produzione

## Obiettivi

Permettere di associare un costo (consumo) a ogni processo di produzione e calcolare dinamicamente i cicli da campi numerici della ricetta. Il calcolo del costo sarà: `consumo_selezionato * (minuti / 60) * valore_cicli_dal_campo_ricetta`.

## Modifiche Database

### Schema

**File**: `src/db/schema.ts`

Aggiungere due nuovi campi alla tabella `dddev_recipe_process`:
- `costType`: `varchar('cost_type', { length: 64 })` - nullable, tipo di costo associato (es. 'consumoForno', 'consumoColatrice')
- `cycleField`: `varchar('cycle_field', { length: 64 })` - nullable, nome del campo della ricetta da usare per i cicli (es. 'traysPerOvenLoad', 'numberOfPackages')

### Migration Script

**File**: `scripts/add-process-cost-fields.ts`

Script CLI per aggiungere i nuovi campi alla tabella `dddev_recipe_process`:
- `ALTER TABLE dddev_recipe_process ADD COLUMN cost_type VARCHAR(64) NULL;`
- `ALTER TABLE dddev_recipe_process ADD COLUMN cycle_field VARCHAR(64) NULL;`
- Aggiungere indici se necessario

## Modifiche Types

**File**: `src/types/index.ts`

Aggiornare il tipo `RecipeProcess` per includere:
- `costType?: CostType | null` - tipo di costo associato
- `cycleField?: string | null` - nome del campo della ricetta per i cicli

Creare un tipo helper per mappare i campi della ricetta:
```typescript
export type RecipeCycleField = 
  | 'numberOfPackages'
  | 'traysPerOvenLoad'
  | 'totalQtyForRecipe'
  | // altri campi numerici della ricetta
```

## Modifiche API

### API Route: Processi Ricetta

**File**: `src/app/api/recipes/[id]/processes/route.ts`

- **GET**: Includere `costType` e `cycleField` nella risposta
- **PUT**: Accettare e salvare `costType` e `cycleField` per ogni processo

### API Route: Calcolo Costi

**File**: `src/app/api/recipes/[id]/processes/costs/route.ts`

Modificare la logica di calcolo:
1. Per ogni processo, se `costType` è definito:
   - Recuperare il valore del consumo dal parametro standard (`dddev_standard_parameters`)
   - Recuperare il valore del campo ciclo dalla ricetta (`dddev_recipe`)
   - Calcolo: `consumo_kw * (minuti / 60) * valore_ciclo`
2. Se `costType` non è definito, usare il calcolo attuale (hourly_labor)
3. Se `cycleField` non è definito, usare il valore `cycles` salvato nel processo

## Modifiche Frontend

### Componente Widget Processi

**File**: `src/components/RecipeProcessesWidget.tsx`

Aggiungere due nuove colonne nella tabella:
1. **Colonna "Costo associato"**:
   - Dropdown con i consumi disponibili (solo `consumoForno`, `consumoColatrice`, `consumoImpastatrice`, `consumoSaldatrice`, `consumoConfezionatrice`, `consumoBassima`, `consumoMulino`)
   - Opzione "Nessuno" per non associare un costo
   - Valore salvato in `costType`

2. **Colonna "Campo cicli"**:
   - Dropdown con i campi numerici della ricetta disponibili
   - Opzione "Usa valore salvato" per usare il campo `cycles` del processo
   - Valore salvato in `cycleField`

Modificare la logica di salvataggio per includere `costType` e `cycleField`.

### Recupero dati ricetta

Il componente deve ricevere i dati della ricetta (o recuperarli) per:
- Popolare il dropdown dei campi cicli
- Mostrare il valore corrente del campo selezionato

## Flusso di calcolo

1. Utente seleziona un processo (es. "Cottura")
2. Seleziona costo: "Consumo Forno" (consumoForno)
3. Seleziona campo cicli: "Teglie/Infornate" (traysPerOvenLoad)
4. Salva → i valori vengono salvati in `dddev_recipe_process`
5. Calcolo costo:
   - Recupera `consumoForno` da parametri standard (es. 5 kW/h)
   - Recupera `traysPerOvenLoad` dalla ricetta (es. 25)
   - Recupera `minutes` dal processo (es. 30 minuti)
   - Calcolo: `5 * (30/60) * 25 = 5 * 0.5 * 25 = 62.5 €`

## Note implementative

- I consumi sono in kW/h, quindi il calcolo è: `consumo_kw * (minuti / 60) * cicli`
- Se `cycleField` è null, usare il valore `cycles` salvato nel processo
- Se `costType` è null, usare il calcolo attuale con `hourly_labor`
- Il dropdown dei campi cicli deve mostrare label leggibili (es. "Numero pacchetti" per `numberOfPackages`)
- Validazione: `costType` deve essere uno dei consumi validi
- Validazione: `cycleField` deve essere un campo numerico valido della ricetta

## TODO

- [ ] Aggiungere campi costType e cycleField alla tabella dddev_recipe_process nello schema Drizzle
- [ ] Creare script di migrazione per aggiungere i nuovi campi al database
- [ ] Aggiornare i tipi TypeScript per includere costType e cycleField in RecipeProcess
- [ ] Modificare GET /api/recipes/[id]/processes per includere costType e cycleField nella risposta
- [ ] Modificare PUT /api/recipes/[id]/processes per accettare e salvare costType e cycleField
- [ ] Modificare GET /api/recipes/[id]/processes/costs per calcolare usando costType e cycleField
- [ ] Aggiungere dropdown per costType e cycleField nella tabella del widget processi
- [ ] Modificare la logica di salvataggio per includere costType e cycleField
- [ ] Recuperare i dati della ricetta nel widget per popolare il dropdown dei campi cicli



