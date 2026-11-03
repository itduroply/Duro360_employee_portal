import { useEffect, useMemo, useState } from 'react';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Select from '../../components/common/Select.jsx';
import { creditApi } from './api/creditApi.js';
import { useList } from './components.jsx';

// Who approves a Permanent request, one row per level. Level 1 first, then
// Level 2, and so on. A level with an approver shows Edit and Delete. Edit swaps
// the person for another. Delete removes the level and saves at once (the later
// levels move up); a lone level is only emptied, so a new person can be added.
// Amounts play no part. A Temporary request does not use this: it follows the
// amount rules.
//
// A request keeps the approvers it was sent with, so a change here applies only
// to requests sent after it is saved.
const ACTION = 'text-theme-sm font-medium text-accent-500 hover:text-accent-700 disabled:opacity-50';

export default function PermanentApproversPanel() {
  const { data, error, loading, reload } = useList(creditApi.listCreditUsers);
  const [levels, setLevels] = useState([]);
  const [editing, setEditing] = useState(null); // index of the level being edited
  const [pick, setPick] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState('');

  const approvers = data?.approvers ?? [];
  const nameOf = (id) => approvers.find((a) => String(a.id) === String(id))?.name ?? `Employee ${id}`;

  // Start from what is saved. Two empty levels if nothing is set yet.
  useEffect(() => {
    if (!data) return;
    const saved = data.permanentLevels ?? [];
    setLevels(saved.length ? saved.map((l) => ({ approverIds: l.approverIds.map(String) })) : [{ approverIds: [] }, { approverIds: [] }]);
    setEditing(null);
  }, [data]);

  // A person can sit at one level only, so each dropdown offers the others.
  const taken = useMemo(() => new Set(levels.flatMap((l) => l.approverIds)), [levels]);
  const options = approvers.filter((a) => !taken.has(String(a.id)));

  function change(next) {
    setLevels(next);
    setMessage('');
    setProblem('');
  }
  const setLevel = (i, approverIds) => change(levels.map((l, idx) => (idx === i ? { approverIds } : l)));

  function startEdit(i) {
    setEditing(i);
    setPick('');
  }
  function commit(i) {
    if (!pick) return;
    setLevel(i, [pick]);
    setEditing(null);
    setPick('');
  }

  async function save(next = levels, doneMessage = 'Permanent approvers saved. New Permanent requests will follow these levels.') {
    const empty = next.findIndex((l) => l.approverIds.length === 0);
    if (empty !== -1) {
      setProblem(`Level ${empty + 1} has no approver. Add one, or remove the level.`);
      return;
    }
    setSaving(true);
    setProblem('');
    try {
      await creditApi.setPermanentApprovers(next);
      setMessage(doneMessage);
      reload(true);
    } catch (err) {
      setProblem(err.message || 'Could not save the Permanent approvers.');
    } finally {
      setSaving(false);
    }
  }

  // Delete on a level takes the person off and removes the level, then saves
  // at once; the levels after it move up. With only one level there is nothing
  // to remove it into, so it is emptied and a new person must be picked.
  async function deleteLevel(i) {
    const name = level_names(i);
    if (levels.length === 1) {
      setLevel(i, []);
      setProblem('A Permanent request needs at least one level. Pick another approver for Level 1, then save.');
      return;
    }
    if (!window.confirm(`Remove ${name} from Level ${i + 1}? The levels after it move up one, and this is saved at once.`)) return;
    const next = levels.filter((_, idx) => idx !== i);
    if (next.some((l) => l.approverIds.length === 0)) {
      // Another level is still empty, so this cannot be saved yet.
      change(next);
      setProblem('Level removed, but another level has no approver. Add one or remove it, then press Save approvers.');
      return;
    }
    await save(next, `${name} was removed. The remaining levels are now Level 1 to Level ${next.length}.`);
  }
  const level_names = (i) => levels[i].approverIds.map(nameOf).join(', ');

  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
      <h3 className="text-base font-semibold text-gray-800">Permanent request approvers</h3>
      <p className="mb-4 mt-1 text-theme-sm text-gray-500">
        A Permanent request goes through these levels in order. The last level's approval makes it Approved. Requests already sent keep their approvers.
      </p>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {message && <Alert variant="success" className="mb-4">{message}</Alert>}
      {approvers.length === 0 && !loading && (
        <Alert variant="warning" className="mb-4">No active Approver users yet. Add Approvers first.</Alert>
      )}

      {/* Levels sit side by side: two columns in one row, more levels wrap to the next row. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {levels.map((level, i) => {
          const assigned = level.approverIds.length > 0 && editing !== i;
          return (
            <div key={i} className="rounded-xl border border-gray-200 px-4 py-3">
              <p className="mb-2 text-theme-sm font-semibold text-gray-800">
                Level {i + 1}
                {i === levels.length - 1 && levels.length > 1 && <span className="ml-1.5 text-theme-xs font-normal text-gray-500">final</span>}
              </p>

              {assigned ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 flex-1 truncate text-theme-sm text-gray-800">{level.approverIds.map(nameOf).join(', ')}</p>
                  <div className="flex shrink-0 items-center gap-4">
                    <button type="button" className={ACTION} onClick={() => startEdit(i)}>Edit</button>
                    <button type="button" className={ACTION} onClick={() => deleteLevel(i)} disabled={saving}>Delete</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    {/* An empty level saves the pick at once. An edit waits for Update. */}
                    <Select
                      aria-label={`Approver for level ${i + 1}`}
                      value={editing === i ? pick : ''}
                      onChange={(e) => (editing === i ? setPick(e.target.value) : e.target.value && setLevel(i, [e.target.value]))}
                    >
                      <option value="">Select approver</option>
                      {options.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {editing === i ? (
                      <>
                        <button type="button" className={ACTION} onClick={() => commit(i)} disabled={!pick}>Update</button>
                        <button type="button" className={ACTION} onClick={() => setEditing(null)}>Cancel</button>
                      </>
                    ) : (
                      levels.length > 1 && (
                        <button type="button" className={ACTION} onClick={() => change(levels.filter((_, idx) => idx !== i))}>Remove</button>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {problem && <Alert variant="error" className="mt-4">{problem}</Alert>}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={() => change([...levels, { approverIds: [] }])}>
          + Add level
        </Button>
        <Button type="button" onClick={() => save()} isLoading={saving} disabled={loading}>
          Save approvers
        </Button>
      </div>
    </section>
  );
}
