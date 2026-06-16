# ref-match — Design (V1)

**Date :** 2026-06-15
**Statut :** validé (en attente de relecture utilisateur avant plan d'implémentation)

## 1. Objectif

Serveur **MCP** (TypeScript / Node, SDK officiel `@modelcontextprotocol/sdk`) qui rapproche les
catalogues **Odoo / Shopify / Reflex** par **SKU**, vérifie la cohérence du **CAB**
(code-barres / EAN), et expose le résultat (références **OK** / **écarts** + proposition de
correction) à l'aisupacrew.

- **Lecture seule** sur les référentiels : aucune écriture. Le tool *propose* des corrections,
  il ne les applique pas.
- **Clé d'identité = SKU.** **Attribut vérifié = CAB.**
- **Pas de maître fixe** : en cas de divergence, on expose les valeurs par système + la valeur
  majoritaire ; l'humain tranche.
- **Périmètre : tout le catalogue** des 3 systèmes.
- **Persistance : SQLite locale** au projet (aucune base métier touchée, survit au redémarrage).

### Hors scope V1

- **Kits** (produits composés, BoM phantom Odoo, metafields Shopify) — traités ultérieurement.
  Voir **issue #1**. En V1, un kit absent d'Odoo pourra apparaître à tort en `SKU_ABSENT` :
  limitation connue et assumée.
- **Écriture / correction automatique** dans les référentiels.
- CLI et rapport fichier dédiés (le serveur MCP est la seule surface).

## 2. Architecture en couches

```
connecteurs (fetch live)  →  snapshots SQLite  →  moteur de réconciliation (pur)  →  résultats SQLite  →  outils MCP
```

Le fetch (coûteux, rate-limité) est découplé de la consultation (fréquente, appelée par
l'aisupacrew). Chaque couche est testable isolément.

```
src/
  config.ts              # validation env (zod), fail-fast
  connectors/
    types.ts             # NormalizedItem, interface Connector
    directus.ts          # récupère les credentials Odoo depuis Directus
    odoo.ts              # JSON-RPC product.product (default_code, barcode)
    shopify.ts           # Admin GraphQL productVariants (sku, barcode)
    reflex.ts            # OAuth RFX + endpoint master "item" (CAB)
  core/
    normalize.ts         # PUR : normalisation SKU/CAB
    reconcile.ts         # PUR : Map<sku> → statuts classés
    statuses.ts          # enums + types
  store/                 # better-sqlite3
    db.ts                # schéma + migrations
    snapshots.ts         # upsert/lecture snapshots
    results.ts           # écriture/lecture résultats + runs
  mcp/
    server.ts            # wiring du serveur MCP
    tools/               # 1 fichier par outil
  index.ts               # entrypoint stdio MCP
test/
  ...                    # fixtures + tests unitaires/intégration
```

## 3. Connecteurs

Interface commune :

```ts
interface Connector {
  system: 'odoo' | 'shopify' | 'reflex'
  fetchAll(): AsyncIterable<NormalizedItem>   // paginé, normalisé
}
```

- **Odoo** (`odoo.ts`) : récupère les credentials Odoo **depuis Directus** (`directus.ts`), puis
  interroge l'API Odoo (JSON-RPC) sur `product.product`. Champs : `default_code` → SKU,
  `barcode` → CAB, `name`. Pagination par offset/limit.
- **Shopify** (`shopify.ts`) : Admin **GraphQL** (`SHOPIFY_STORE_URL`, `SHOPIFY_ACCESS_TOKEN`,
  `SHOPIFY_API_VERSION`). Itération sur `productVariants` : `sku`, `barcode`. Pagination par
  curseur, gestion du coût (throttle).
- **Reflex** (`reflex.ts`) : OAuth **client-credentials** (`RFX_AUTH_SERVER_URL`,
  `RFX_API_CLIENT_ID/SECRET`, `RFX_API_SERVER_URL`). Endpoint master « item » (CAB). Endpoint et
  champs exacts à confirmer via la skill `reflex-api-expert` à l'implémentation. Pagination par
  pages.

## 4. Normalisation & réconciliation (cœur pur)

**NormalizedItem** : `{ system, sku, cab: string | null, name?, raw }`.

Normalisation (fonctions pures, documentées, testées) :
- **SKU** : `trim`, majuscules, espaces internes compactés.
- **CAB** : `trim`, suppression des espaces, **conservation des zéros de tête** (EAN). Vide → `null`.

Réconciliation **par SKU** → statut :

| Statut | Définition |
|---|---|
| `OK` | présent dans les 3 systèmes, CAB identique et non vide partout |
| `ECART_CAB` | présent dans ≥2 systèmes, CAB renseignés mais **différents** |
| `CAB_MANQUANT` | présent mais CAB vide / `null` dans ≥1 système |
| `SKU_ABSENT` | présent dans certains systèmes, absent d'au moins un autre (orphelin) |

Précédence (un SKU = un statut principal) : `SKU_ABSENT` > `ECART_CAB` > `CAB_MANQUANT` > `OK`.

Chaque SKU réconcilié renvoie :
- le **CAB par système** (et présence/absence),
- la **valeur majoritaire** du CAB (la plus fréquente parmi les systèmes où il est renseigné),
- une **proposition** : « aligner les systèmes minoritaires sur la valeur majoritaire X »
  (suggestion seulement, pas de maître — l'humain tranche),
- un **warning `DUPLICATE_SKU`** si un système expose ≥2 lignes pour le même SKU.

**Paramètre de périmètre** : par défaut, tout SKU est *attendu dans les 3 systèmes* (l'absence
produit `SKU_ABSENT`). Configurable si certains produits ne sont légitimement pas dans un système,
pour ne pas générer de bruit. (NB : la gestion fine des kits est reportée — issue #1.)

## 5. Stockage (SQLite, better-sqlite3)

- `snapshot(system, sku, cab, name, raw_json, fetched_at)` — 1 ligne par (système, SKU) ; dernier
  fetch par système. Index sur `(system, sku)`.
- `run(id, started_at, finished_at, sources_json, partial)` — une exécution de réconciliation.
- `result(run_id, sku, status, per_system_json, majority_cab, proposal_json, warnings_json)` —
  résultat par SKU pour un run. Index sur `(run_id, status)`.

Migrations idempotentes au démarrage (`db.ts`).

## 6. Outils MCP exposés

| Outil | Entrée | Sortie |
|---|---|---|
| `refmatch_refresh` | `{ systems?, env? }` | fetch live → snapshots ; compteurs + statut par source (succès/échec) |
| `refmatch_reconcile` | `{}` | réconcilie les derniers snapshots → résultats ; résumé par statut |
| `refmatch_run` | `{ systems?, env? }` | raccourci refresh + reconcile |
| `refmatch_summary` | `{}` | compteurs par statut + fraîcheur des snapshots + flag « partiel » |
| `refmatch_list` | `{ status, system?, limit, cursor }` | liste paginée d'écarts |
| `refmatch_lookup` | `{ sku }` | détail d'un SKU sur les 3 systèmes + proposition |

`env?` distingue prod / recette là où c'est pertinent (Directus, Periscope).

## 7. Gestion d'erreurs

- **Config validée au démarrage** (zod) → message clair en cas d'env manquant (fail-fast).
- **Isolation par connecteur** : une source en échec n'avorte pas les autres. Son snapshot est
  marqué périmé ; la réconciliation est signalée **partielle** (`run.partial = true`) et exclut
  proprement la source manquante du calcul (pas de faux `SKU_ABSENT` dû à une panne).
- **Tokens OAuth** (Reflex, Directus) mis en cache avec expiry ; refresh sur 401.
- **Rate-limits** : pagination + backoff exponentiel sur 429 / throttle (Shopify cost-aware,
  Reflex pages).
- **Anomalies de normalisation** (SKU dupliqué dans un système) → collectées en warnings,
  remontées dans le résumé.

## 8. Tests (TDD)

- **Cœur pur** (`normalize`, `reconcile`) : testé exhaustivement sur fixtures déterministes —
  c'est là que réside la justesse.
- **Connecteurs** : testés sur HTTP mocké (réponses enregistrées en fixtures).
- **Store** : SQLite in-memory.
- **Outils MCP** : intégration sur base seedée (appel direct des handlers).
- **Framework** : vitest.

## 9. Points à confirmer à l'implémentation

- Endpoint et champs exacts du master « item » Reflex (via `reflex-api-expert`).
- Schéma exact des credentials Odoo stockés dans Directus + dialecte API Odoo (JSON-RPC vs XML-RPC).
- Champs Odoo retenus (`default_code` / `barcode` confirmés).
