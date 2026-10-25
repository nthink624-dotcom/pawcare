// Storage interfaces for legacy workflow fixtures. Production ownership rules remain real.
export function alimtalkStorageFixture(table, source) {
  if (!['alimtalk_template_registry', 'shop_alimtalk_active_codes'].includes(table)) return null;
  const filters = [];
  let window;
  const query = {
    select: () => query, order: () => query,
    eq: (key, value) => { filters.push(row => row[key] === value); return query; },
    in: (key, values) => { filters.push(row => values.includes(row[key])); return query; },
    range: (from, to) => { window = [from, to]; return query; },
    maybeSingle: () => read(true), then: (resolve, reject) => read().then(resolve, reject),
  };
  async function read(single = false) {
    const { requests = [], platform = [], selected = [], registry = [] } = source();
    const owners = new Map();
    for (const row of requests) owners.set(row.template_code, { template_code: row.template_code, scope: 'shop', owner_shop_id: row.shop_id, retired_at: null });
    for (const row of platform) if (!owners.has(row.provider_template_code)) owners.set(row.provider_template_code, { template_code: row.provider_template_code, scope: 'platform', owner_shop_id: null, retired_at: null });
    for (const row of registry) owners.set(row.template_code, row);
    const candidates = table === 'alimtalk_template_registry' ? [...owners.values()]
      : [...requests.filter(row => row.inspection_status !== 'draft'), ...selected].filter(row => {
        const owner = owners.get(row.template_code);
        return owner && !owner.retired_at && (owner.scope === 'platform' || owner.owner_shop_id === row.shop_id);
      }).map(row => ({ shop_id: row.shop_id, template_alias: row.template_alias, template_code: row.template_code }));
    let rows = candidates.filter(row => filters.every(filter => filter(row)));
    if (window) rows = rows.slice(window[0], window[1] + 1);
    return { data: structuredClone(single ? rows[0] ?? null : rows), error: null };
  }
  return query;
}

// Cache timing has its own tests. Existing transition tests intentionally read each mocked provider revision immediately.
export const uncachedCatalogFixture = 'export const readPersistedAlimtalkDetails=async()=>new Map();export const persistAlimtalkDetails=async()=>{};';
