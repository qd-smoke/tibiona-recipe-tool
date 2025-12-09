# Git Workflow Guide - recipe-tool.tibiona.it

## Workflow Standard

### 1. Creare una nuova feature branch

```powershell
# Assicurati di essere su master aggiornato
git checkout master
git pull origin master

# Crea e switcha alla nuova branch
git checkout -b aldo-2025-11-13
```

### 2. Lavorare sulla feature branch

- Fai commit frequenti e piccoli
- Usa messaggi di commit descrittivi
- Testa localmente prima di pushare

```powershell
git add .
git commit -m "feat: add nutrition calculation per 100g"
git push origin aldo-2025-11-13
```

### 3. Merge in master

**Opzione A: Usa lo script automatico (consigliato)**

```powershell
.\merge-branch.ps1 -BranchName "aldo-2025-11-13"
```

Lo script:
- Verifica che non ci siano merge in corso
- Assicura che sei su master
- Aggiorna master da origin
- Esegue il merge con `--no-ff`
- Gestisce conflitti e errori
- Chiede conferma per il push

**Opzione B: Merge manuale**

```powershell
# 1. Switch a master
git checkout master

# 2. Aggiorna da origin
git pull origin master

# 3. Merge feature branch
git merge --no-ff aldo-2025-11-13

# 4. Se ci sono conflitti, risolvili e poi:
git add .
git commit --no-edit

# 5. Push per triggerare pipeline
git push origin master
```

## Gestione Merge Interrotti

Se un merge viene interrotto (es. editor chiuso, errore), Git lascia file di stato:
- `.git/MERGE_HEAD` - indica merge in corso
- `.git/MERGE_MSG` - messaggio di merge
- `.git/MERGE_MODE` - modalità merge

### Completare un merge interrotto

**Opzione A: Usa lo script (consigliato)**

```powershell
.\complete-merge.ps1
```

**Opzione B: Manuale**

```powershell
# 1. Verifica conflitti
git status

# 2. Se ci sono conflitti, risolvili manualmente
# Poi aggiungi i file risolti:
git add .

# 3. Completa il merge
git commit --no-edit
```

### Annullare un merge interrotto

Se vuoi annullare completamente il merge:

```powershell
git merge --abort
```

Questo ripristina lo stato prima del merge.

## Verifica Stato Repository

Per verificare lo stato del repository:

```powershell
.\check-repo-status.ps1
```

Oppure manualmente:

```powershell
# Branch corrente
git branch --show-current

# Stato working directory
git status

# Verifica merge in corso
Test-Path .git\MERGE_HEAD

# Ultimi commit
git log --oneline -5
```

## Best Practices

1. **Sempre pull prima di merge**: assicurati che master sia aggiornato
2. **Usa `--no-ff`**: mantiene la storia del branch nel merge commit
3. **Testa prima di pushare**: esegui `pnpm run build` per verificare errori
4. **Commit atomici**: ogni commit dovrebbe essere una modifica logica completa
5. **Messaggi chiari**: usa prefissi come `feat:`, `fix:`, `refactor:`, `docs:`
6. **Non force-push su master**: sempre merge commits per preservare storia

## Troubleshooting

### "Merge in corso" ma non ricordi di aver iniziato un merge

```powershell
# Verifica stato
git status

# Completa o annulla
.\complete-merge.ps1
# oppure
git merge --abort
```

### Conflitti durante merge

1. Git ti mostrerà i file in conflitto
2. Apri i file e risolvi manualmente (cerca `<<<<<<<`, `=======`, `>>>>>>>`)
3. Aggiungi i file risolti: `git add .`
4. Completa: `git commit --no-edit`

### Branch già mergeato ma vuoi rifare

Se il branch è già mergeato ma vuoi rifare il merge:

```powershell
# Verifica
git branch --merged master

# Se necessario, rimuovi il merge commit e rifai
git reset --hard HEAD~1
git merge --no-ff aldo-2025-11-13
```

## Script Disponibili

- `merge-branch.ps1` - Merge sicuro di una feature branch
- `complete-merge.ps1` - Completa un merge interrotto
- `check-repo-status.ps1` - Verifica stato repository

Tutti gli script sono in `.gitignore` e non vengono committati.

