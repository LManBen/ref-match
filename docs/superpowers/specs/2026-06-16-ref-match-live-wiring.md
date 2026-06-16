# ref-match — Live wiring (per-activity) — Spec addendum

**Date :** 2026-06-16
**Statut :** validé (décisions utilisateur actées) — remplace les hypothèses mono-tenant de la V1.
**Référence :** issue #2. Prérequis : la V1 (PR #3).

## Décision structurante : multi-tenant par `activity`

Les référentiels sont configurés **par activité** (collection Directus `activity`, id entier). Les
outils MCP prennent désormais un paramètre **`activity`** (id Directus). Le `.env` ne porte plus la
config d'un tenant unique : il porte l'accès **Directus** et la connexion **API Reflex** (globale).

## Résolution d'une activité (Directus)

Depuis un id d'activité (ex. `213`), lire :

1. `activity/{id}` → `Trigram` (3 car., = **`activity_code` Reflex**), `code_depot_physique_reflex`
   (dépôt), `name`, `active_in_reflex`.
2. `configuration_odoo` (filtre `activity={id}`, `active=true`, limit 1) →
   `url`, `database`, `client_id` (**= login Odoo**), `client_secret` (**= password Odoo**), `version`.
   Absent → Odoo non configuré pour cette activité.
3. `configuration_shopify` (filtre `activity={id}`, `active=true`, limit 1) →
   `url` (**sans schéma**, ex. `modernmetier.myshopify.com`), `token` (token Admin API).
   Absent → Shopify non configuré.
4. `configuration_reflex` (filtre `activity={id}`, `active=true`, limit 1) → présence = Reflex activé
   (la connexion API vient du `.env` ; on scope par le Trigram). `depot_code`/`originator_code` lus
   pour info.

Résultat : `ResolvedActivity { activityId, trigram, depotCode, name, odoo?, shopify?, reflexEnabled }`.
On construit les connecteurs **uniquement pour les systèmes configurés** → la réconciliation
partielle (V1) gère l'absence sans faux `SKU_ABSENT`.

## Connecteurs (mise à jour)

### Odoo (`src/connectors/odoo.ts`)
- Creds : `{ url, db, login, password }` (depuis Directus).
- Auth : JSON-RPC `common.authenticate(db, login, password, {})` → **uid** (int).
- Données : `object.execute_kw(db, uid, password, 'product.product', 'search_read', [[]],
  { fields: ['default_code','barcode','name'], offset, limit })`.
- **Pagination** : boucle offset/limit (page 1000) jusqu'à page incomplète.
- Map : `default_code`→SKU, `barcode`→CAB (`false`→null).

### Shopify (`src/connectors/shopify.ts`)
- Cfg : `{ storeUrl, token, apiVersion }` — `storeUrl` normalisé (préfixer `https://` si absent),
  `apiVersion` depuis `.env` (`SHOPIFY_API_VERSION`, défaut `2024-10`).
- Query GraphQL `productVariants` (curseur) — inchangée. Map `sku`→SKU, `barcode`→CAB.

### Reflex (`src/connectors/reflex.ts`)
**Source de vérité : le connecteur C# existant `ezfng-prod/src/Connectors/Reflex.Shared`** (EzyFlowNG).
La V1 supposait OAuth/Bearer — **FAUX**. Recette réelle :
- Auth : `GET <RFX_API_SERVER_URL>/reflexWS/JWTServlet?login=<user>&password=<password>` → le corps
  de la réponse **est le token brut** (pas de JSON). Header sur tous les appels :
  `Authorization: JWT <token>` (préfixe `JWT`, **pas** `Bearer`) + `Accept: application/json`.
  Creds : `REFLEX_USER` / `REFLEX_PASSWORD` (`.env`). Base = `RFX_API_SERVER_URL`
  (`RFX_AUTH_SERVER_URL`/OAuth **non utilisés** pour Reflex). Token mis en cache (TTL court).
- Énumération : `GET /reflexWS/rest/public/v1/items?activity_code=<trigram>&next_key=<cursor>`
  → `{ status, data: { items_list: [{ item_code, base_lv, ... }] }, next_key }`. Pagination
  **curseur** via `next_key` jusqu'à vide/absent. Champs : `item_code`→SKU. **Pas de CAB ici.**
- CAB : **pas de bulk** → pour chaque SKU, `GET /reflexWS/rest/public/v1/activities/<trigram>/items/<item_code>`
  → `{ status, item_list: [{ item_code, logistical_variant_list: [{ logistical_variant_code,
  id_list: [{ logistical_variant_ID_type_code, logistical_variant_ID_code }] }] }] }`.
  Sélection : LV **UVC** = `logistical_variant_code == "10"` ; CAB = `logistical_variant_ID_code`
  de son `id_list` (préférer un type `EAN12/EAN13/EAN14`, sinon le dernier id non vide — comme le C#).
  Noter le `ID` majuscule dans les clés JSON.
  Appels détail **parallélisés avec borne de concurrence** (`REFMATCH_REFLEX_CONCURRENCY`, défaut 8)
  + retry/backoff existant.
- Stratégie actée : complet (1 détail/SKU), même si N appels.

## Store (scopé par activité)

- `snapshot` : ajouter colonne `activity TEXT NOT NULL`. Clé logique (activity, system, sku).
  `replaceSnapshot(db, activity, system, items)`, `readSnapshot(db, activity, system)`,
  `snapshotFreshness(db, activity)`.
- `run` : ajouter colonne `activity TEXT NOT NULL`. `saveRun(db, {activity, sources, partial}, results)`,
  `latestRunId(db, activity)`. `summary/listByStatus/lookup` restent scopés par `runId`.

## Outils MCP (mise à jour)

Tous les outils de déclenchement/consultation prennent **`activity` (id Directus, requis)** :
- `refmatch_refresh { activity, systems? }`
- `refmatch_reconcile { activity }`
- `refmatch_run { activity, systems? }`
- `refmatch_summary { activity }` (dernier run de l'activité) — inclut la fraîcheur.
- `refmatch_list { activity, status, limit?, offset? }`
- `refmatch_lookup { activity, sku }`

Plus un outil d'aide : `refmatch_activities` → liste les activités candidates (id, name, trigram,
systèmes actifs) en lisant Directus, pour que l'aisupacrew sache quoi passer en `activity`.

## Config (`.env`)
- Requis : `DIRECTUS_PROD_URL`, `DIRECTUS_PROD_TOKEN`, `RFX_API_SERVER_URL`, `REFLEX_USER`,
  `REFLEX_PASSWORD`. Optionnel : `SHOPIFY_API_VERSION` (défaut `2024-10`), `REFMATCH_DB_PATH`,
  `REFMATCH_REFLEX_CONCURRENCY` (défaut 8).
- `SHOPIFY_STORE_URL`/`SHOPIFY_ACCESS_TOKEN` **ne sont plus requis** (Shopify vient de Directus).
- `RFX_AUTH_SERVER_URL`/`RFX_API_CLIENT_ID`/`RFX_API_CLIENT_SECRET` **ne sont plus utilisés**
  (Reflex s'authentifie via JWTServlet avec `REFLEX_USER`/`REFLEX_PASSWORD`).

## Premier run réel
Activité **213 (Moder Métier, MOM, EZ1)** — seule avec les 3 systèmes actifs.

## Reste à confirmer en exécution
- Le couple creds JWTServlet : `REFLEX_USER`/`REFLEX_PASSWORD` (le C# utilise `ReflexApiClientId/Secret`
  comme `login`/`password` — vérifier quel couple `.env` est le bon en faisant un appel réel).
- Que la LV UVC porte bien `logistical_variant_code == "10"` pour les activités visées (convention C#).
- Le `next_key` exact (champ racine `next_key` de la réponse LIST_ITM, confirmé côté C#).

**Référence d'implémentation** : `ezfng-prod/src/Connectors/Reflex.Shared` (DTOs `ReflexArticleItem`,
`ReflexArticleItemLvIdResponse`, services `ReflexApiService`/`ReflexAccessTokenService`).
