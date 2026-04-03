import { useEffect, useState } from "react";
import API from "../services/api";
import { formatCurrency, formatDate } from "../utils/formatters";

function Expenses() {
  const today = new Date().toISOString().split("T")[0];
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [expenseEntries, setExpenseEntries] = useState([]);
  const [draft, setDraft] = useState({ label: "", amount: "" });

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get(`/summary/${today}`);
      setSummary(res.data);
      setExpenseEntries(res.data.expenseEntries || []);
    } catch (err) {
      setError("Could not load expense data.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    if (!successToast) return undefined;
    const id = window.setTimeout(() => setSuccessToast(""), 5000);
    return () => window.clearTimeout(id);
  }, [successToast]);

  const handleAdd = () => {
    const label = draft.label.trim();
    const amount = Number(draft.amount) || 0;
    if (!label || amount <= 0) return;
    setExpenseEntries((prev) => [...prev, { label, amount }]);
    setDraft({ label: "", amount: "" });
  };

  const handleRemove = (index) => {
    setExpenseEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccessToast("");
      await API.post("/summary", {
        date: today,
        milkPurchased: summary?.milkPurchased || 0,
        purchaseCost: summary?.purchaseCost || 0,
        expenseEntries,
        closingEntries: (summary?.closingEntries || []).map((e) => ({
          productId: e.productId,
          remainingQuantity: e.remainingQuantity,
        })),
      });
      setSuccessToast("Expenses saved successfully.");
      fetchSummary();
    } catch (err) {
      setError("Could not save expenses.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const total = expenseEntries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <div className="page-stack">
      {successToast ? <p className="feedback success update-toast">{successToast}</p> : null}

      <div className="dash-header">
        <div>
          <p className="eyebrow">Daily Inputs</p>
          <h2 className="dash-title">Expense Log</h2>
        </div>
        <div className="date-badge">{formatDate(today)}</div>
      </div>

      {error ? <p className="feedback error">{error}</p> : null}

      <section className="content-grid">
        <article className="panel-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Add expense</p>
              <h3>Today&apos;s expenses</h3>
            </div>
            <span className="pill">Editable today</span>
          </div>

          <div className="form-grid">
            <label className="field field-full">
              <span>Expense type</span>
              <input
                placeholder="Transport, salary, electricity"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              />
            </label>

            <label className="field">
              <span>Amount</span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
              />
            </label>

            <button
              className="secondary-button dashboard-add-expense-button"
              type="button"
              onClick={handleAdd}
            >
              Add expense
            </button>

            {expenseEntries.length ? (
              <div className="field field-full">
                <span>Expense list</span>
                <div className="chip-list">
                  {expenseEntries.map((entry, index) => (
                    <button
                      key={`${entry.label}-${index}`}
                      type="button"
                      className="expense-chip"
                      onClick={() => handleRemove(index)}
                    >
                      {entry.label}: {formatCurrency(entry.amount)} ×
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <button
              className="primary-button field-full"
              type="button"
              disabled={saving || loading}
              onClick={handleSave}
            >
              {saving ? "Saving…" : "Save expenses"}
            </button>
          </div>
        </article>

        <article className="panel-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Summary</p>
              <h3>Expense breakdown</h3>
            </div>
            <span className="pill">{expenseEntries.length} items</span>
          </div>

          {expenseEntries.length ? (
            <div className="summary-list">
              {expenseEntries.map((entry, index) => (
                <div key={`${entry.label}-${index}`} className="summary-row">
                  <span>{entry.label}</span>
                  <strong>{formatCurrency(entry.amount)}</strong>
                </div>
              ))}
              <div className="summary-total">
                <span>Total expenses</span>
                <strong>{formatCurrency(total)}</strong>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              {loading ? <h4>Loading…</h4> : <h4>No expenses added today</h4>}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

export default Expenses;
