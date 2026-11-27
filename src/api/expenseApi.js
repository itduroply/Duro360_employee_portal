// Expense module data (claims, advances, travel requests, grade and base city).
//
// TEMPORARY STORE: there are no expense tables in Supabase yet, so everything
// is kept in this browser's localStorage, per signed-in user. Every page calls
// only the functions below, so moving to Supabase later means rewriting this
// file and nothing else. Keep the function names and return shapes.

const KEY = (userId, name) => `expense.${name}.${userId}`;

function read(userId, name, fallback) {
  try {
    const raw = localStorage.getItem(KEY(userId, name));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(userId, name, value) {
  try {
    localStorage.setItem(KEY(userId, name), JSON.stringify(value));
  } catch {
    throw new Error('Could not save. Browser storage is full or blocked.');
  }
}

const pad = (n, w = 4) => String(n).padStart(w, '0');
function nextNumber(items, prefix) {
  const ym = new Date().toISOString().slice(2, 7).replace('-', '');
  const used = items.filter((i) => i.number?.startsWith(`${prefix}-${ym}`)).length;
  return `${prefix}-${ym}-${pad(used + 1)}`;
}

export const CLAIM_PREFIX = { outstation: 'OS', local: 'LC', other: 'LC' };

export const expenseApi = {
  // ---- profile: grade and base city (to come from the HR master, BRD open item 2) ----
  getProfile: (userId) => read(userId, 'profile', { grade: 'M2', baseCity: 'Kolkata' }),
  saveProfile: (userId, profile) => write(userId, 'profile', profile),

  // ---- claims ----
  listClaims: (userId) => read(userId, 'claims', []).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
  getClaim: (userId, id) => read(userId, 'claims', []).find((c) => c.id === id) ?? null,
  saveClaim(userId, claim) {
    const all = read(userId, 'claims', []);
    const now = new Date().toISOString();
    const index = all.findIndex((c) => c.id === claim.id);
    if (index >= 0) {
      all[index] = { ...all[index], ...claim, updatedAt: now };
    } else {
      all.push({ ...claim, id: crypto.randomUUID(), status: 'Draft', createdAt: now, updatedAt: now });
    }
    write(userId, 'claims', all);
    return all[index >= 0 ? index : all.length - 1];
  },
  submitClaim(userId, claim, { result, route, total, grade, hoursLate }) {
    const all = read(userId, 'claims', []);
    const now = new Date().toISOString();
    const saved = {
      ...claim,
      id: claim.id || crypto.randomUUID(),
      number: claim.number || nextNumber(all, CLAIM_PREFIX[claim.card] || 'LC'),
      status: 'Pending',
      result,
      route,
      stage: 0,
      total,
      grade,
      late: hoursLate,
      submittedAt: now,
      createdAt: claim.createdAt || now,
      updatedAt: now,
      history: [...(claim.history || []), { at: now, action: 'Submitted', note: `Result: ${result}` }],
    };
    const index = all.findIndex((c) => c.id === saved.id);
    if (index >= 0) all[index] = saved;
    else all.push(saved);
    write(userId, 'claims', all);
    return saved;
  },
  deleteDraft(userId, id) {
    const all = read(userId, 'claims', []);
    const claim = all.find((c) => c.id === id);
    if (claim && claim.status !== 'Draft') throw new Error('Only a draft can be deleted.');
    write(userId, 'claims', all.filter((c) => c.id !== id));
  },

  // ---- advances ----
  listAdvances: (userId) => read(userId, 'advances', []).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
  requestAdvance(userId, { amount, purpose }, route) {
    const all = read(userId, 'advances', []);
    const number = `ADV-${pad(all.length + 1)}`;
    const now = new Date().toISOString();
    const advance = { id: crypto.randomUUID(), number, amount: Number(amount), purpose: purpose.trim(), status: 'Requested', route, stage: 0, requestedAt: now, issued: 0, adjusted: 0 };
    write(userId, 'advances', [...all, advance]);
    return advance;
  },
  // Balance = issued less adjusted (BRD rule R-50).
  advanceBalance: (userId) => read(userId, 'advances', []).reduce((s, a) => s + (a.issued || 0) - (a.adjusted || 0), 0),

  // ---- travel requests ----
  listTravel: (userId) => read(userId, 'travel', []).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  requestTravel(userId, request, route) {
    const all = read(userId, 'travel', []);
    const number = `TR-${pad(all.length + 1)}`;
    const item = { ...request, id: crypto.randomUUID(), number, status: 'Pending', route, stage: 0, createdAt: new Date().toISOString() };
    write(userId, 'travel', [...all, item]);
    return item;
  },
};
