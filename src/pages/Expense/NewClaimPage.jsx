import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ModulePage from '../../components/ModulePage/ModulePage.jsx';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Select from '../../components/common/Select.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { expenseApi } from '../../api/expenseApi.js';
import {
  GRADES, TRAIN_CLASSES, TYPES_BY_CARD, ALL_LOCAL_MODES, LODGING, BOARDING, DAILY_ALLOWANCE, OWN_STAY,
  evaluateClaim, claimTotal, dailyAllowance, lineAmount, nightsOf, netPayable, bestTrainClass, cityCategory,
  hoursLeft, todayIso, money, daysBetween,
} from '../../utils/expensePolicy.js';
import { Field, Input, TextArea, CitySelect, IssueList, ResultPill } from './expenseUi.jsx';

const iconProps = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const PlaneIcon = () => (<svg {...iconProps}><path d="M17.8 19.2 16 11l3.5-3.5a2.1 2.1 0 0 0-3-3L13 8 4.8 6.2 3.4 7.6l6.4 3.4-3.3 3.3-2.8-.4L2.4 15.4l4 1.7 1.7 4 1.5-1.3-.4-2.8L12.5 14l3.4 6.4z" /></svg>);
const CarIcon = () => (<svg {...iconProps}><path d="M5 17h14M3 13l2-6a2 2 0 0 1 1.9-1.4h10.2A2 2 0 0 1 19 7l2 6v4a1 1 0 0 1-1 1h-1.5M3 13v4a1 1 0 0 0 1 1h1.5M3 13h18" /><circle cx="7.5" cy="17" r="1.8" /><circle cx="16.5" cy="17" r="1.8" /></svg>);
const ReceiptIcon = () => (<svg {...iconProps}><path d="M6 3h12v18l-2.2-1.5L13.6 21 12 19.5 10.4 21l-2.2-1.5L6 21z" /><path d="M9 8h6M9 12h6" /></svg>);
const ArrowIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>);

const CARDS = [
  { key: 'outstation', title: 'Outstation Travel', Icon: PlaneIcon, tone: 'bg-brand-50 text-brand-500', hint: 'Trips beyond 50 km with an overnight stay. Fare, hotel, food and daily allowance.' },
  { key: 'local', title: 'Local Conveyance', Icon: CarIcon, tone: 'bg-brand-50 text-brand-500', hint: 'Taxi, own two- or four-wheeler, toll, parking, repairs and daily allowance.' },
  { key: 'other', title: 'Other Expenses', Icon: ReceiptIcon, tone: 'bg-brand-50 text-brand-500', hint: 'Marketing, sales promotion, food vouchers, other business costs and daily allowance.' },
];

const PANEL = 'rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-sm sm:p-6';

const CHECK = <path d="M5 12.5l4.5 4.5L19 7.5" />;
const SECTION_ICONS = {
  purpose: <path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6" />,
  route: <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10zM12 8.5v5M9.5 11h5" />,
  travel: <path d="M3 7h18v10H3zM3 11h18M7 15h2" />,
  lines: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
};

// One step of the form, as its own card (same pattern as the Complaints form).
// The badge turns green once the step's required fields are filled.
function Section({ step, icon, title, hint, done, action, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-sm">
      <header className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/60 px-4 py-3 sm:px-5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${done ? 'bg-success-500 text-white' : 'bg-brand-50 text-brand-500'}`}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{done ? CHECK : icon}</svg>
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3">
          <h3 className="text-theme-sm font-semibold text-gray-800"><span className="mr-1.5 text-gray-400">{step}</span>{title}</h3>
          {hint && <p className="hidden text-theme-xs text-gray-500 sm:block">{hint}</p>}
        </div>
        {action}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

const emptyLine = (card) => ({ type: TYPES_BY_CARD[card][0].key, date: '', checkout: '', amount: '', gst: '', gstNo: '', days: 1, particulars: '', mode: '', place: '', billName: '' });
const emptyClaim = (card, profile) => ({
  card,
  purpose: '',
  fromCity: profile.baseCity,
  toCity: '',
  departDate: '',
  returnDate: '',
  mode: 'train',
  trainClass: bestTrainClass(profile.grade),
  companyStay: false,
  claimDA: true,
  hoursAtDest: '',
  ticketPaid: '',
  hotelPaid: '',
  linkedTr: '',
  claimDate: todayIso(),
  lines: [],
});

function LineEditor({ index, line, card, claim, grade, onChange, onRemove }) {
  const types = TYPES_BY_CARD[card];
  const t = types.find((x) => x.key === line.type) ?? types[0];
  const set = (patch) => onChange({ ...line, ...patch });
  const cat = cityCategory(claim.toCity);
  const hint =
    line.type === 'lodging' ? (LODGING[grade]?.[cat] == null ? 'Paid as actual.' : `Limit ${money(LODGING[grade][cat])} per night before GST (grade ${grade}, city ${cat}).`)
    : line.type === 'boarding' ? (BOARDING[grade]?.[cat] == null ? 'Paid as actual.' : `Limit ${money(BOARDING[grade][cat])} per day before GST.`)
    : line.type === 'ownstay' ? `${money(OWN_STAY[grade])} per night. No bill needed.`
    : '';
  const auto = t.bill === 'auto';
  const stay = line.type === 'lodging' || line.type === 'ownstay';

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-theme-sm font-semibold text-gray-800">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-theme-xs shadow-theme-xs ring-1 ring-gray-200">{index + 1}</span>
          Line {index + 1}
        </span>
        <button type="button" onClick={onRemove} className="text-theme-xs font-medium text-error-600 hover:underline">Remove</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Expense type" className="sm:col-span-2">
          <Select value={line.type} onChange={(e) => set({ type: e.target.value })}>
            {types.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </Select>
        </Field>
        <Field label={stay ? 'Check-in date' : 'Date'}>
          <Input type="date" max={todayIso()} min={card === 'outstation' ? claim.departDate : undefined} value={line.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        {stay && (
          <Field label="Check-out date" hint={line.date && line.checkout ? `${nightsOf(line)} night(s)` : 'One date twice is one night.'}>
            <Input type="date" min={line.date || undefined} value={line.checkout} onChange={(e) => set({ checkout: e.target.value })} />
          </Field>
        )}
        {auto ? (
          <Field label="Amount (calculated)">
            <Input value={money(lineAmount(line, grade))} readOnly className="bg-gray-100" />
          </Field>
        ) : (
          <Field label="Amount (₹)">
            <Input type="number" min="0" inputMode="decimal" value={line.amount} onChange={(e) => set({ amount: e.target.value })} />
          </Field>
        )}
        {!auto && t.bill !== 'auto' && (
          <Field label="GST on the bill (₹)" hint="Limits compare the amount before GST.">
            <Input type="number" min="0" value={line.gst} onChange={(e) => set({ gst: e.target.value })} />
          </Field>
        )}
        {t.needsGst && (
          <Field label="Hotel GST number">
            <Input maxLength={15} value={line.gstNo} onChange={(e) => set({ gstNo: e.target.value.toUpperCase() })} placeholder="15 characters" />
          </Field>
        )}
        {line.type === 'boarding' && (
          <Field label="Days">
            <Input type="number" min="1" value={line.days} onChange={(e) => set({ days: e.target.value })} />
          </Field>
        )}
        {(t.needsMode) && (
          <Field label="Mode">
            <Select value={line.mode} onChange={(e) => set({ mode: e.target.value })}>
              <option value="">Select mode</option>
              {ALL_LOCAL_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
        )}
        {(t.needsMode || line.type === 'taxi') && (
          <Field label="Place visited">
            <Input value={line.place} onChange={(e) => set({ place: e.target.value })} />
          </Field>
        )}
        <Field label="Particulars" className="sm:col-span-2">
          <Input value={line.particulars} onChange={(e) => set({ particulars: e.target.value })} />
        </Field>
        {!auto && (
          <Field label={t.bill === 'yes' ? 'Bill (photo or PDF) — required' : 'Bill (photo or PDF)'} hint={line.billName || undefined}>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => set({ billName: e.target.files?.[0]?.name || '' })}
              className="block w-full text-theme-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-theme-sm file:font-medium file:text-brand-600"
            />
          </Field>
        )}
      </div>
      {hint && <p className="mt-3 text-theme-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export default function NewClaimPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const userId = user?.id;

  const [profile, setProfile] = useState(() => expenseApi.getProfile(userId));
  const draft = useMemo(() => (params.get('draft') ? expenseApi.getClaim(userId, params.get('draft')) : null), [params, userId]);
  const [claim, setClaim] = useState(() => draft ?? null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showIssues, setShowIssues] = useState(false);

  const travel = useMemo(() => expenseApi.listTravel(userId), [userId]);
  const approvedTravel = travel.filter((t) => t.status === 'Approved');
  const advanceBalance = expenseApi.advanceBalance(userId);
  const grade = profile.grade;

  const check = useMemo(() => (claim ? evaluateClaim(claim, { grade, travelRequests: travel }) : null), [claim, grade, travel]);
  const set = (patch) => setClaim((c) => ({ ...c, ...patch }));
  const updateProfile = (patch) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    expenseApi.saveProfile(userId, next);
    if (claim && patch.grade && claim.mode === 'train') set({ trainClass: bestTrainClass(patch.grade) });
    if (claim && patch.baseCity && claim.card === 'outstation' && !draft) set({ fromCity: patch.baseCity });
  };

  const choose = (card) => setClaim(emptyClaim(card, profile));
  const total = claim ? claimTotal(claim, grade) : 0;
  const pay = claim ? netPayable(claim, grade, advanceBalance) : null;
  const left = claim?.card === 'outstation' && claim.returnDate ? hoursLeft(claim.returnDate) : null;
  const blocks = check?.issues.filter((i) => i.level === 'block') ?? [];

  const saveDraft = () => {
    try {
      const saved = expenseApi.saveClaim(userId, { ...claim, grade, total });
      setClaim(saved);
      setNotice('Draft saved.');
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  const submit = () => {
    setShowIssues(true);
    if (!check || check.result === 'Blocked') {
      setError(`Please complete ${blocks.length} detail${blocks.length === 1 ? '' : 's'} before you submit.`);
      return;
    }
    try {
      const late = claim.card === 'outstation' && left != null && left < 0;
      const saved = expenseApi.submitClaim(userId, claim, { result: check.result, route: check.route, total, grade, hoursLate: late });
      navigate('../claims', { relative: 'path', state: { notice: `Claim ${saved.number} submitted. It is with the Reporting Manager.` } });
    } catch (e) {
      setError(e.message);
    }
  };


  const active = CARDS.find((c) => c.key === claim?.card);
  const outstation = claim?.card === 'outstation';
  const sectionDone = claim && {
    purpose: Boolean(claim.purpose.trim()) && (outstation || Boolean(claim.claimDate)),
    route: outstation && Boolean(claim.toCity && claim.departDate && claim.returnDate),
    travel: outstation && Boolean(claim.mode),
    lines: claim.lines.length > 0,
  };

  const profileFields = (
    <>
      <Field label="Your grade" hint="Will come from the HR master. Set it here until then.">
        <Select value={profile.grade} onChange={(e) => updateProfile({ grade: e.target.value })}>
          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
        </Select>
      </Field>
      <Field label="Base city" hint="Sets your From city and city category.">
        <CitySelect value={profile.baseCity} onChange={(v) => updateProfile({ baseCity: v })} />
      </Field>
      <Field label="Daily allowance for your grade" hint="Fixed by grade.">
        <Input readOnly value={`${money(DAILY_ALLOWANCE[grade])} per day`} className="bg-gray-50 font-semibold" />
      </Field>
    </>
  );

  const checkTile = (label, checked, onChange) => (
    <label className={`flex h-11 cursor-pointer items-center gap-3 self-end rounded-lg border px-4 text-theme-sm transition-colors ${checked ? 'border-brand-300 bg-brand-25 text-gray-800' : 'border-gray-300 bg-white text-gray-700 hover:border-brand-300'}`}>
      <input type="checkbox" className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-brand-500" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );

  let step = 0;
  const next = () => String(++step);

  return (
    <ModulePage title="New Claim" live>
      {!claim ? (
        <div className={PANEL}>
          <h2 className="text-theme-xl font-semibold text-gray-800">What are you claiming?</h2>
          <p className="mt-1 text-theme-sm text-gray-500">Choose one. Daily allowance can be added under all three.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {CARDS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => choose(c.key)}
                className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-theme-md focus:outline-none focus:ring-3 focus:ring-brand-500/15"
              >
                <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${c.tone}`}><c.Icon /></span>
                <p className="mt-5 text-base font-semibold text-gray-800">{c.title}</p>
                <p className="mt-1.5 flex-1 text-theme-sm text-gray-500">{c.hint}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-theme-sm font-semibold text-brand-500">
                  Start
                  <span className="transition-transform duration-200 group-hover:translate-x-1"><ArrowIcon /></span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-5 text-theme-xs text-gray-500">Monthly fuel claims for the sales team and deployment allowance are not in this release.</p>
        </div>
      ) : (
        <div role="tablist" aria-label="Claim type" className="grid grid-cols-1 gap-1 rounded-xl bg-gray-100 p-1 sm:grid-cols-3">
          {CARDS.map((c) => {
            const on = claim.card === c.key;
            return (
              <button
                key={c.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => !on && choose(c.key)}
                className={`flex h-11 items-center justify-center gap-2.5 rounded-lg text-theme-sm font-medium transition-all focus:outline-none focus:ring-3 focus:ring-brand-500/15 ${on ? 'bg-white text-brand-600 shadow-theme-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <span className="scale-[0.65]"><c.Icon /></span>
                {c.title}
              </button>
            );
          })}
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {claim && (
        <div className="flex min-w-0 flex-col gap-5">
          <div className={PANEL}>
            <p className="mb-4 text-theme-xs font-semibold uppercase tracking-wider text-gray-400">Your details</p>
            <div className="grid gap-5 sm:grid-cols-3">{profileFields}</div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-sm">
            <div className="h-1 bg-accent-stripe" />
            <div className="grid grid-cols-2 divide-gray-100 lg:grid-cols-5 lg:divide-x">
              {[
                ['Claim total', money(total)],
                ['Paid by company', `${pay.company > 0 ? '−' : ''}${money(pay.company)}`],
                ['Advance applied', `${pay.advance > 0 ? '−' : ''}${money(pay.advance)}`],
              ].map(([label, value]) => (
                <div key={label} className="px-5 py-4">
                  <p className="text-theme-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                  <p className="mt-1 text-theme-xl font-semibold tabular-nums text-gray-800">{value}</p>
                </div>
              ))}
              <div className="col-span-2 bg-brand-25 px-5 py-4 lg:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-theme-xs font-semibold uppercase tracking-wider text-gray-500">Net payable</p>
                  <ResultPill result={check.result} />
                </div>
                <p className="mt-1 text-title-sm font-semibold tabular-nums text-brand-600">{money(pay.net)}</p>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <Section step={next()} icon={SECTION_ICONS.purpose} title={outstation ? 'Purpose' : 'Purpose and date'} hint={active.hint} done={sectionDone.purpose}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Purpose" className="sm:col-span-2">
                  <TextArea rows={1} className="!h-11 min-h-0 resize-none" value={claim.purpose} onChange={(e) => set({ purpose: e.target.value })} placeholder="Why was this expense incurred?" />
                </Field>
                {!outstation && (
                  <Field label="Claim date"><Input type="date" max={todayIso()} value={claim.claimDate} onChange={(e) => set({ claimDate: e.target.value })} /></Field>
                )}
              </div>
            </Section>

            {outstation && (
              <>
                <Section step={next()} icon={SECTION_ICONS.route} title="Route and dates" hint="Where you went and when." done={sectionDone.route}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="From city"><CitySelect value={claim.fromCity} onChange={(v) => set({ fromCity: v })} /></Field>
                    <Field label="To city" hint={claim.toCity ? `City category ${cityCategory(claim.toCity)}` : undefined}><CitySelect value={claim.toCity} onChange={(v) => set({ toCity: v })} /></Field>
                    <Field label="Departure date"><Input type="date" max={todayIso()} value={claim.departDate} onChange={(e) => set({ departDate: e.target.value })} /></Field>
                    <Field label="Return date" hint={left == null ? undefined : left < 0 ? 'The 72-hour window has passed. The claim will be flagged Late.' : `About ${left} hour(s) left to submit.`}>
                      <Input type="date" max={todayIso()} min={claim.departDate || undefined} value={claim.returnDate} onChange={(e) => set({ returnDate: e.target.value })} />
                    </Field>
                    {claim.departDate && claim.returnDate && daysBetween(claim.departDate, claim.returnDate) === 0 && (
                      <Field label="Hours at destination" hint="More than 8 hours gives 50% daily allowance." className="sm:col-span-2"><Input type="number" min="0" value={claim.hoursAtDest} onChange={(e) => set({ hoursAtDest: e.target.value })} /></Field>
                    )}
                  </div>
                </Section>

                <Section step={next()} icon={SECTION_ICONS.travel} title="Travel and payments" hint="Mode of travel and what the company paid." done={sectionDone.travel}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Mode of travel">
                      <Select value={claim.mode} onChange={(e) => set({ mode: e.target.value })}>
                        <option value="train">Train</option><option value="bus">Bus</option><option value="air">Air (economy)</option>
                        <option value="car">Car or taxi</option><option value="own">Own vehicle</option>
                      </Select>
                    </Field>
                    {claim.mode === 'train' ? (
                      <Field label="Train class">
                        <Select value={claim.trainClass} onChange={(e) => set({ trainClass: e.target.value })}>
                          {TRAIN_CLASSES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </Select>
                      </Field>
                    ) : null}
                    <Field label="Linked travel request" hint="Only approved requests are listed." className={claim.mode === 'train' ? '' : 'sm:col-span-1'}>
                      <Select value={claim.linkedTr} onChange={(e) => set({ linkedTr: e.target.value })}>
                        <option value="">None</option>
                        {approvedTravel.map((t) => <option key={t.id} value={t.id}>{t.number} · {t.fromCity} to {t.toCity}</option>)}
                      </Select>
                    </Field>
                    <Field label="Company paid the ticket (₹)"><Input type="number" min="0" value={claim.ticketPaid} onChange={(e) => set({ ticketPaid: e.target.value })} /></Field>
                    <Field label="Company paid the hotel (₹)"><Input type="number" min="0" value={claim.hotelPaid} onChange={(e) => set({ hotelPaid: e.target.value })} /></Field>
                    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                      {checkTile('Company arranged the stay', claim.companyStay, (v) => set({ companyStay: v }))}
                      {checkTile('Claim daily allowance', claim.claimDA, (v) => set({ claimDA: v }))}
                    </div>
                  </div>
                </Section>
              </>
            )}

            <Section
              step={next()}
              icon={SECTION_ICONS.lines}
              title="Expense lines"
              hint={`${claim.lines.length} line${claim.lines.length === 1 ? '' : 's'} added`}
              done={sectionDone.lines}
              action={<Button size="sm" onClick={() => set({ lines: [...claim.lines, emptyLine(claim.card)] })}>+ Add line</Button>}
            >
              <div className="flex flex-col gap-4">
                {outstation && dailyAllowance(claim, grade) > 0 && (
                  <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-theme-sm">
                    <span className="text-gray-600">Daily allowance (calculated, no bill)</span>
                    <span className="font-semibold text-gray-800">{money(dailyAllowance(claim, grade))}</span>
                  </div>
                )}
                {claim.lines.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-theme-sm text-gray-500">
                    No lines yet. Use Add line.
                  </div>
                )}
                {claim.lines.map((line, i) => (
                  <LineEditor
                    key={i}
                    index={i}
                    line={line}
                    card={claim.card}
                    claim={claim}
                    grade={grade}
                    onChange={(nextLine) => set({ lines: claim.lines.map((l, j) => (j === i ? nextLine : l)) })}
                    onRemove={() => set({ lines: claim.lines.filter((_, j) => j !== i) })}
                  />
                ))}
              </div>
            </Section>
          </div>

          <div className={`${PANEL} flex flex-col gap-4`}>
            <div className="flex items-center gap-3">
              <h3 className="text-theme-sm font-semibold text-gray-800">Policy check</h3>
              <ResultPill result={check.result} />
            </div>
            {check.issues.length === 0 ? (
              <p className="text-theme-sm text-gray-500">No policy issue found so far.</p>
            ) : showIssues ? (
              <IssueList issues={check.issues} />
            ) : (
              <IssueList issues={check.issues.filter((i) => i.level !== 'block')} />
            )}
            {!showIssues && blocks.length > 0 && <p className="text-theme-sm text-gray-500">{blocks.length} detail{blocks.length === 1 ? '' : 's'} still to complete. Press Submit to see them.</p>}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <p className="text-theme-sm text-gray-500">Net payable <span className="font-semibold text-gray-800">{money(pay.net)}</span></p>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={saveDraft}>Save draft</Button>
                <Button onClick={submit}>Submit claim</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ModulePage>
  );
}
