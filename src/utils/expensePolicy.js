// Domestic Travel Policy DIL/HRP/017-3 as set out in the Expense Module BRD/FRD
// v1.2 (sections 7.1, 7.5, 7.6, 7.7). Amounts are in rupees, before GST.
// Change a value here only when the policy owner changes the policy.

export const GRADES = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8'];

const CITIES_A = ['Bengaluru', 'Delhi', 'Faridabad', 'Gurgaon', 'Mumbai', 'Noida'];
const CITIES_B = ['Ahmedabad', 'Bhopal', 'Bhubaneswar', 'Chandigarh', 'Chennai', 'Cochin', 'Guwahati', 'Hyderabad', 'Indore', 'Jaipur', 'Kolkata', 'Lucknow', 'Ludhiana', 'Mohali', 'Nagpur', 'Panchkula', 'Patna', 'Pune', 'Ranchi', 'Surat', 'Vijayawada'];
const CITIES_C = ['Agartala', 'Agra', 'Akola', 'Aligarh', 'Amravati', 'Aurangabad', 'Ayodhya', 'Berhampur', 'Bhagalpur', 'Bhilwara', 'Bilaspur', 'Calicut', 'Coimbatore', 'Cuttack', 'Dehradun', 'Dhanbad', 'Dibrugarh', 'Durgapur', 'Ghaziabad', 'Greater Noida', 'Gulbarga', 'Gwalior', 'Hubli', 'Jabalpur', 'Jalandhar', 'Jammu', 'Jamshedpur', 'Jewar', 'Jodhpur', 'Jorhat', 'Kanpur', 'Karimnagar', 'Karnal', 'Kolhapur', 'Kota', 'Madurai', 'Malda', 'Mangalore', 'Mehsana', 'Muzaffarpur', 'Mysore', 'Nanded', 'Nashik', 'Palanpur', 'Panipat', 'Prayagraj', 'Raipur', 'Rajkot', 'Rourkela', 'Satna', 'Shillong', 'Siliguri', 'Thrissur', 'Tinsukia', 'Tirupati', 'Trichy', 'Trivandrum', 'Udaipur', 'Vadodara', 'Varanasi', 'Vizag', 'Warangal'];
// Places the policy list names as category D, plus the plant town.
const CITIES_D = ['Shapar', 'Zirakpur', 'Sonipat', 'Perumbavoor'];

export const CITIES = [
  ...CITIES_A.map((name) => ({ name, cat: 'A' })),
  ...CITIES_B.map((name) => ({ name, cat: 'B' })),
  ...CITIES_C.map((name) => ({ name, cat: 'C' })),
  ...CITIES_D.map((name) => ({ name, cat: 'D' })),
].sort((a, b) => a.name.localeCompare(b.name));

// Every place that Annexure A does not name is category D.
export function cityCategory(city) {
  return CITIES.find((c) => c.name.toLowerCase() === String(city || '').toLowerCase())?.cat ?? 'D';
}

// Rows by grade; M0 and M1 share one row in the policy. null = paid as actual.
const ROW = (a, b, c, d) => ({ A: a, B: b, C: c, D: d });
const M1 = (...v) => ({ M0: ROW(...v), M1: ROW(...v) });
export const LODGING = {
  M8: ROW(null, null, null, null),
  M7: ROW(8000, 6500, 5000, 4500),
  M6: ROW(8000, 6500, 5000, 4500),
  M5: ROW(7000, 6000, 5000, 4500),
  M4: ROW(6000, 5000, 4500, 4000),
  M3: ROW(4250, 4000, 3750, 3250),
  M2: ROW(3000, 3000, 2500, 2000),
  ...M1(2500, 2000, 1750, 1500),
};
export const BOARDING = {
  M8: ROW(null, null, null, null),
  M7: ROW(1870, 1650, 1375, 1100),
  M6: ROW(1870, 1650, 1375, 1100),
  M5: ROW(1375, 1375, 1100, 825),
  M4: ROW(990, 880, 825, 550),
  M3: ROW(880, 770, 660, 495),
  M2: ROW(770, 660, 550, 440),
  ...M1(660, 550, 440, 385),
};
export const DAILY_ALLOWANCE = { M8: 2000, M7: 1500, M6: 1000, M5: 600, M4: 500, M3: 400, M2: 300, M1: 200, M0: 200 };
export const OWN_STAY = { M8: 4000, M7: 3000, M6: 2500, M5: 2000, M4: 1500, M3: 1200, M2: 1000, M1: 600, M0: 600 };

export const VARIANCE_TOLERANCE = 0.1; // up to 10% over a limit is a variance
export const MAX_STAY_DAYS = 10;
export const SUBMIT_WINDOW_HOURS = 72;
export const SAME_DAY_HOURS = 8;

// Train classes, best first within a rank.
export const TRAIN_CLASSES = [
  { name: 'Sleeper', rank: 1 },
  { name: 'AC III', rank: 2 },
  { name: 'AC II', rank: 3 },
  { name: 'AC Chair Car', rank: 3 },
  { name: 'AC I', rank: 4 },
  { name: 'Executive Chair Car', rank: 4 },
];

const gradeNo = (grade) => Number(String(grade).replace('M', '')) || 0;

// 'ok', 'needs-tr' (allowed only with an approved travel request) or 'exception'.
export function trainStatus(grade, className) {
  const rank = TRAIN_CLASSES.find((c) => c.name === className)?.rank ?? 0;
  const g = gradeNo(grade);
  if (g >= 5) return 'ok';
  if (g >= 3) return rank <= 3 ? 'ok' : 'exception';
  if (g === 2) return rank <= 2 ? 'ok' : rank === 3 ? 'needs-tr' : 'exception';
  if (g === 1) return rank <= 2 ? 'ok' : 'exception';
  return rank <= 1 ? 'ok' : rank === 2 ? 'needs-tr' : 'exception'; // M0: stricter row (BRD open item 21)
}

export function bestTrainClass(grade) {
  const g = gradeNo(grade);
  if (g >= 5) return 'AC I';
  if (g >= 3) return 'AC II';
  if (g >= 1) return 'AC III';
  return 'Sleeper';
}

// Air: M5 and above entitled; M4 between states needs approval within a state; M3 needs approval.
export function airEntitled(grade) {
  return gradeNo(grade) >= 5;
}
export function carEntitled(grade) {
  return gradeNo(grade) >= 5;
}

// Local modes by grade (BRD 7.6, home location column).
const LOCAL_MODES_BY_BAND = [
  [5, ['Car / taxi (Ola, Uber)']],
  [4, ['Car / taxi (Ola, Uber)']],
  [3, ['Car / taxi (Ola, Uber)', 'Auto', 'Bus', 'Metro']],
  [2, ['Bus', 'Auto', 'Metro']],
  [0, ['Bus', 'Rickshaw / e-rickshaw', 'Auto', 'Metro']],
];
export const ALL_LOCAL_MODES = ['Car / taxi (Ola, Uber)', 'Auto', 'Bus', 'Metro', 'Rickshaw / e-rickshaw'];
export function localModesFor(grade) {
  const g = gradeNo(grade);
  return (LOCAL_MODES_BY_BAND.find(([min]) => g >= min) ?? LOCAL_MODES_BY_BAND.at(-1))[1];
}

// Expense types per claim card. `bill`: 'yes' needs a bill, 'opt' optional, 'auto' calculated.
export const OUTSTATION_TYPES = [
  { key: 'fare', label: 'Fare (ticket)', head: 'Travelling', bill: 'yes' },
  { key: 'lodging', label: 'Lodging (hotel)', head: 'Travelling', bill: 'yes', needsGst: true },
  { key: 'boarding', label: 'Boarding (food)', head: 'Travelling', bill: 'opt' },
  { key: 'ownstay', label: 'Own stay (relatives / own arrangement)', head: 'Travelling', bill: 'auto' },
  { key: 'guesthouse', label: 'Guest house / course charges', head: 'Travelling', bill: 'yes' },
  { key: 'taxi', label: 'Local conveyance at destination (taxi / auto)', head: 'Conveyance', bill: 'yes' },
  { key: 'toll', label: 'Toll and parking', head: 'Conveyance', bill: 'yes' },
  { key: 'agency', label: 'Travel agency fee', head: 'Travelling', bill: 'yes' },
  { key: 'laundry', label: 'Laundry', head: 'Travelling', bill: 'opt' },
  { key: 'sundry', label: 'Sundry', head: 'Travelling', bill: 'opt' },
];
export const LOCAL_TYPES = [
  { key: 'conv', label: 'Local conveyance', head: 'Conveyance', bill: 'opt', needsMode: true },
  { key: 'toll', label: 'Toll', head: 'Conveyance', bill: 'yes' },
  { key: 'parking', label: 'Parking', head: 'Conveyance', bill: 'yes' },
  { key: 'repair', label: 'Vehicle repair & maintenance', head: 'Vehicle Maintenance', bill: 'opt' },
];
export const OTHER_TYPES = [
  { key: 'marketing', label: 'Marketing & selling expense', head: 'Marketing & Selling', bill: 'opt' },
  { key: 'promotion', label: 'Sales promotion', head: 'Sales Promotion', bill: 'opt' },
  { key: 'postage', label: 'Postage and courier', head: 'Other', bill: 'yes' },
  { key: 'printing', label: 'Printing and stationery', head: 'Other', bill: 'yes' },
  { key: 'food', label: 'Food voucher', head: 'Other', bill: 'opt' },
  { key: 'other', label: 'Other business expense', head: 'Other', bill: 'opt' },
];
export const TYPES_BY_CARD = { outstation: OUTSTATION_TYPES, local: LOCAL_TYPES, other: OTHER_TYPES };

const PERSONAL_WORDS = /\b(spa|alcohol|liquor|beer|wine|movie|cinema|medicine|medical|pharmacy|doctor|hospital)\b/i;

// ---- date helpers (ISO yyyy-mm-dd strings) ----
export const todayIso = () => new Date().toISOString().slice(0, 10);
const toUtc = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export const daysBetween = (from, to) => Math.round((toUtc(to) - toUtc(from)) / 86400000);

// The 72-hour window starts at the end of the return day (00:00 next day).
export function submitDeadline(returnDate) {
  if (!returnDate) return null;
  return new Date(toUtc(returnDate) + 86400000 + SUBMIT_WINDOW_HOURS * 3600000 - 5.5 * 3600000);
}
export function hoursLeft(returnDate, now = new Date()) {
  const d = submitDeadline(returnDate);
  return d ? Math.floor((d - now) / 3600000) : null;
}

export const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// Nights of a hotel or own-stay line: check-out minus check-in; one date clicked twice is one night.
export const nightsOf = (line) => (line.date && line.checkout ? Math.max(1, daysBetween(line.date, line.checkout)) : 0);

function nightSet(line) {
  const set = new Set();
  const n = nightsOf(line);
  for (let i = 0; i < n; i += 1) set.add(new Date(toUtc(line.date) + i * 86400000).toISOString().slice(0, 10));
  return set;
}

// Daily allowance is worked out by the system, never typed.
export function dailyAllowance(claim, grade) {
  if (claim.card !== 'outstation' || !claim.claimDA || !claim.departDate || !claim.returnDate) return 0;
  const rate = DAILY_ALLOWANCE[grade] ?? 0;
  const days = daysBetween(claim.departDate, claim.returnDate) + 1;
  if (days === 1) return Number(claim.hoursAtDest) > SAME_DAY_HOURS ? Math.round(rate / 2) : 0;
  return rate * days;
}

// Amount of one line as it counts toward the claim (own stay is calculated).
export function lineAmount(line, grade) {
  if (line.type === 'ownstay') return (OWN_STAY[grade] ?? 0) * nightsOf(line);
  return Number(line.amount) || 0;
}

export function claimTotal(claim, grade) {
  return claim.lines.reduce((s, l) => s + lineAmount(l, grade), 0) + dailyAllowance(claim, grade);
}

export function netPayable(claim, grade, advanceBalance = 0) {
  const gross = claimTotal(claim, grade);
  const company = (Number(claim.ticketPaid) || 0) + (Number(claim.hotelPaid) || 0);
  const afterCompany = gross - company;
  const advance = Math.min(Math.max(advanceBalance, 0), Math.max(afterCompany, 0));
  return { gross, company, advance, net: afterCompany - advance };
}

function overLimit(amount, limit) {
  if (limit == null || amount <= limit) return 0;
  return (amount - limit) / limit;
}

/**
 * Checks one claim against the policy. Returns the result
 * (Within policy | Variance | Exception | Blocked), every issue with its rule,
 * and the approval route. Blocked claims cannot be submitted.
 */
export function evaluateClaim(claim, { grade, travelRequests = [] } = {}) {
  const issues = [];
  const block = (msg, rule, field) => issues.push({ level: 'block', msg, rule, field });
  const exception = (msg, rule) => issues.push({ level: 'exception', msg, rule });
  const variance = (msg, rule) => issues.push({ level: 'variance', msg, rule });
  const flag = (msg, rule) => issues.push({ level: 'flag', msg, rule });
  const today = todayIso();
  const out = claim.card === 'outstation';
  const types = TYPES_BY_CARD[claim.card] ?? [];
  const approvedTr = travelRequests.find((t) => t.id === claim.linkedTr && t.status === 'Approved');

  if (!String(claim.purpose || '').trim()) block('Purpose is missing.', 'V-01', 'purpose');
  if (out) {
    if (!claim.fromCity) block('From city is missing.', 'V-01', 'fromCity');
    if (!claim.toCity) block('To city is missing.', 'V-01', 'toCity');
    if (!claim.departDate || !claim.returnDate) block('Departure and return dates are missing.', 'V-01', 'departDate');
    else {
      if (claim.returnDate < claim.departDate) block('Return date is before the departure date.', 'R-02', 'returnDate');
      if (claim.returnDate > today) block('Return date is in the future.', 'R-02', 'returnDate');
    }
    if (claim.mode === 'train' && !claim.trainClass) block('Choose the train class.', 'V-06', 'trainClass');
  } else if (!claim.claimDate) {
    block('Claim date is missing.', 'V-01', 'claimDate');
  } else if (claim.claimDate > today) {
    block('Claim date is in the future.', 'R-02', 'claimDate');
  }
  if (claim.lines.length === 0 && dailyAllowance(claim, grade) === 0) block('Add at least one expense line.', 'V-02', 'lines');

  // Outstation entitlements.
  if (out && claim.mode === 'train' && claim.trainClass) {
    const s = trainStatus(grade, claim.trainClass);
    if (s === 'exception' || (s === 'needs-tr' && !approvedTr)) exception(`${claim.trainClass} is above the train entitlement of grade ${grade}.`, 'R-16');
  }
  if (out && claim.mode === 'air' && !airEntitled(grade) && !approvedTr) exception(`Air travel is outside the entitlement of grade ${grade} without an approved travel request.`, 'R-17');
  if (out && claim.mode === 'car' && !carEntitled(grade) && !approvedTr) exception(`Car or taxi is outside the entitlement of grade ${grade} without an approved travel request.`, 'R-19');
  if (out && claim.mode === 'own' && !approvedTr) exception('Personal vehicle needs an approved travel request.', 'R-20');

  const nights = out && claim.departDate && claim.returnDate ? Math.max(0, daysBetween(claim.departDate, claim.returnDate)) : 0;
  if (out && nights + 1 > MAX_STAY_DAYS) exception(`Stay of ${nights + 1} days is more than ${MAX_STAY_DAYS} days at one place.`, 'R-07');
  if (out && claim.departDate && claim.returnDate && claim.returnDate >= claim.departDate) {
    const late = hoursLeft(claim.returnDate);
    if (late != null && late < 0) flag('Submitted after the 72-hour window. The manager will be alerted.', 'R-04');
  }

  const cat = cityCategory(claim.toCity);
  const hotelNights = new Set();
  let ownNights = new Set();
  claim.lines.forEach((l, i) => {
    const t = types.find((x) => x.key === l.type);
    const n = `Line ${i + 1}`;
    if (!t) return block(`${n}: choose an expense type.`, 'V-02', `line-${i}`);
    if (t.bill !== 'auto' && !(Number(l.amount) > 0)) block(`${n}: amount must be above zero.`, 'V-02', `line-${i}`);
    if (!l.date) block(`${n}: date is missing.`, 'V-02', `line-${i}`);
    else if (out && claim.departDate && claim.returnDate && (l.date < claim.departDate || l.date > claim.returnDate)) block(`${n}: date is outside the trip dates.`, 'V-03', `line-${i}`);
    if (t.bill === 'yes' && !l.billName) block(`${n}: attach the bill.`, 'V-04', `line-${i}`);
    if (PERSONAL_WORDS.test(l.particulars || '')) exception(`${n}: personal or medical item cannot be reimbursed.`, 'R-08');
    if (Number(l.gst) > Number(l.amount)) block(`${n}: GST is more than the amount.`, 'V-04', `line-${i}`);
    const base = Math.max(0, (Number(l.amount) || 0) - (Number(l.gst) || 0));

    if (claim.companyStay && ['lodging', 'boarding', 'ownstay'].includes(l.type)) block(`${n}: the company arranged the stay. Only daily allowance is paid.`, 'V-08', `line-${i}`);
    if (['lodging', 'ownstay'].includes(l.type)) {
      if (!l.checkout) block(`${n}: check-out date is missing.`, 'V-03', `line-${i}`);
      else if (l.checkout < l.date) block(`${n}: check-out is before check-in.`, 'V-03', `line-${i}`);
      else if (out && claim.returnDate && l.checkout > claim.returnDate) block(`${n}: check-out is after the return date.`, 'V-03', `line-${i}`);
    }
    if (l.type === 'lodging') {
      if (String(l.gstNo || '').trim().length !== 15) block(`${n}: hotel GST number must be 15 characters.`, 'V-05', `line-${i}`);
      nightSet(l).forEach((d) => hotelNights.add(d));
      const limit = LODGING[grade]?.[cat];
      const over = overLimit(base, limit == null ? null : limit * nightsOf(l));
      if (over > VARIANCE_TOLERANCE) exception(`${n}: lodging ${money(base)} is ${Math.round(over * 100)}% over the ${money(limit * nightsOf(l))} limit (grade ${grade}, city ${cat}).`, 'R-06');
      else if (over > 0) variance(`${n}: lodging ${money(base)} is ${Math.round(over * 100)}% over the ${money(limit * nightsOf(l))} limit (grade ${grade}, city ${cat}).`, 'R-06');
    }
    if (l.type === 'ownstay') nightSet(l).forEach((d) => (ownNights = ownNights.add(d)));
    if (l.type === 'boarding') {
      const days = Math.max(1, Number(l.days) || 1);
      const limit = BOARDING[grade]?.[cat];
      const over = overLimit(base, limit == null ? null : limit * days);
      if (over > VARIANCE_TOLERANCE) exception(`${n}: boarding ${money(base)} is ${Math.round(over * 100)}% over the ${money(limit * days)} limit.`, 'R-06');
      else if (over > 0) variance(`${n}: boarding ${money(base)} is ${Math.round(over * 100)}% over the ${money(limit * days)} limit.`, 'R-06');
    }
    if (t.needsMode || l.type === 'taxi') {
      if (!l.place) block(`${n}: place visited is missing.`, 'V-06', `line-${i}`);
      if (t.needsMode) {
        if (!l.mode) block(`${n}: choose the mode.`, 'V-06', `line-${i}`);
        else if (!localModesFor(grade).includes(l.mode)) exception(`${n}: ${l.mode} is outside the local entitlement of grade ${grade}.`, 'R-23');
        if (l.mode === 'Car / taxi (Ola, Uber)' && !l.billName) block(`${n}: a taxi line needs a receipt.`, 'R-24', `line-${i}`);
      }
    }
  });
  if ([...hotelNights].some((d) => ownNights.has(d))) block('A hotel line and an own-stay line cover the same night.', 'V-08', 'lines');

  const level = (l) => issues.some((i) => i.level === l);
  const result = level('block') ? 'Blocked' : level('exception') ? 'Exception' : level('variance') ? 'Variance' : 'Within policy';
  return { result, issues, route: buildRoute(result, issues, claim) };
}

// The approval route in the order of BRD section 6.5 (v1.2): Reporting Manager,
// extra approver, HR review (the HR Head if there is a variance), Finance
// Controller, AGM Accounts.
export function buildRoute(result) {
  const route = ['Reporting Manager'];
  if (result === 'Variance') route.push('Variance approver');
  if (result === 'Exception') route.push('MD / Designated Authority');
  route.push(result === 'Variance' ? 'HR Head review' : 'HR review', 'Finance Controller (in-depth check)', 'AGM Accounts');
  return route;
}

export const ADVANCE_ROUTE = ['Reporting Manager', 'Finance Controller (in-depth check)', 'AGM Accounts', 'Finance Controller (issue)'];
export function travelRoute(needs) {
  return needs?.own ? ['Reporting Manager', 'HOD'] : ['Reporting Manager'];
}
