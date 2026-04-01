import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatLiters,
} from "../utils/formatters";

function Dashboard() {
  const today = new Date().toISOString().split("T")[0];

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    milkPurchased: 0,
    purchaseCost: 0,
    expenseEntries: [],
  });
  const [expenseDraft, setExpenseDraft] = useState({
    label: "",
    amount: "",
  });

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get(`/summary/${today}`);
      setSummary(res.data);
      setForm({
        milkPurchased: res.data.milkPurchased || 0,
        purchaseCost: res.data.purchaseCost || 0,
        expenseEntries: res.data.expenseEntries || [],
      });
    } catch (err) {
      setError("Could not load the daily summary.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      await API.post("/summary", {
        date: today,
        ...form,
      });
      fetchSummary();
    } catch (err) {
      setError("Daily summary could not be saved.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddExpense = () => {
    const label = expenseDraft.label.trim();
    const amount = Number(expenseDraft.amount) || 0;

    if (!label || amount <= 0) {
      return;
    }

    setForm((current) => ({
      ...current,
      expenseEntries: [...current.expenseEntries, { label, amount }],
    }));
    setExpenseDraft({ label: "", amount: "" });
  };

  const handleRemoveExpense = (indexToRemove) => {
    setForm((current) => ({
      ...current,
      expenseEntries: current.expenseEntries.filter(
        (_, index) => index !== indexToRemove
      ),
    }));
  };

  const totalOtherExpenses = form.expenseEntries.reduce(
    (sum, entry) => sum + (Number(entry.amount) || 0),
    0
  );

  return (
    <div className="page-stack">
      <section className="hero-card dashboard-hero">
        <div>
          <p className="eyebrow">Owner dashboard</p>
          <h2>Dashboard</h2>
        </div>

        <div className="date-badge">{formatDate(today)}</div>
      </section>

      {error ? <p className="feedback error">{error}</p> : null}

      <section className="stats-row">
        <div className="metric-card accent-blue">
          <span>Total sales</span>
          <strong>{formatCurrency(summary?.totalSales)}</strong>
        </div>
        <div className="metric-card accent-green">
          <span>Total collection</span>
          <strong>{formatCurrency(summary?.totalCollection)}</strong>
        </div>
        <div className="metric-card accent-amber">
          <span>Net profit</span>
          <strong>{formatCurrency(summary?.profit)}</strong>
        </div>
        <div className="metric-card accent-blue">
          <span>Outstanding balance</span>
          <strong>{formatCurrency(summary?.outstandingBalance)}</strong>
        </div>
        <div className="metric-card accent-green">
          <span>Expected delivery</span>
          <strong>{formatLiters(summary?.expectedTotalLiters)}</strong>
        </div>
        <div className="metric-card accent-amber">
          <span>Supplier due</span>
          <strong>{formatCurrency(summary?.purchaseDueAmount)}</strong>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Inputs</p>
              <h3>Purchase and expense log</h3>
            </div>
            <span className="pill">Editable today</span>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Milk purchased</span>
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="0"
                value={form.milkPurchased}
                onChange={(e) =>
                  setForm({ ...form, milkPurchased: Number(e.target.value) })
                }
              />
            </label>

            <label className="field">
              <span>Purchase cost</span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={form.purchaseCost}
                onChange={(e) =>
                  setForm({ ...form, purchaseCost: Number(e.target.value) })
                }
              />
            </label>

            <label className="field field-full">
              <span>Expense type</span>
              <input
                placeholder="Transport, salary, electricity"
                value={expenseDraft.label}
                onChange={(e) =>
                  setExpenseDraft({ ...expenseDraft, label: e.target.value })
                }
              />
            </label>

            <label className="field">
              <span>Expense amount</span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={expenseDraft.amount}
                onChange={(e) =>
                  setExpenseDraft({ ...expenseDraft, amount: e.target.value })
                }
              />
            </label>

            <button
              className="secondary-button"
              type="button"
              onClick={handleAddExpense}
            >
              Add expense
            </button>

            {form.expenseEntries.length ? (
              <div className="field field-full">
                <span>Expense list</span>
                <div className="chip-list">
                  {form.expenseEntries.map((entry, index) => (
                    <button
                      key={`${entry.label}-${index}`}
                      type="button"
                      className="expense-chip"
                      onClick={() => handleRemoveExpense(index)}
                    >
                      {entry.label}: {formatCurrency(entry.amount)} x
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <button
              className="primary-button field-full"
              type="button"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? "Saving..." : "Save summary"}
            </button>
          </div>
        </article>

        <article className="panel-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Today</p>
              <h3>Business snapshot</h3>
            </div>
            <span className="pill pill-green">
              {loading ? "Refreshing" : "Live totals"}
            </span>
          </div>

          <div className="summary-list">
            <div className="summary-row">
              <span>Milk purchased</span>
              <strong>{formatLiters(summary?.milkPurchased)}</strong>
            </div>
            <div className="summary-row">
              <span>Purchase cost</span>
              <strong>{formatCurrency(summary?.purchaseCost)}</strong>
            </div>
            <div className="summary-row">
              <span>Other expenses</span>
              <strong>{formatCurrency(totalOtherExpenses || summary?.otherExpenses)}</strong>
            </div>
            <div className="summary-row">
              <span>Total sales</span>
              <strong>{formatCurrency(summary?.totalSales)}</strong>
            </div>
            <div className="summary-row">
              <span>Total collection</span>
              <strong>{formatCurrency(summary?.totalCollection)}</strong>
            </div>
            <div className="summary-row">
              <span>Milk sold today</span>
              <strong>{formatLiters(summary?.milkSold)}</strong>
            </div>
            <div className="summary-row summary-total">
              <span>Profit after costs</span>
              <strong>{formatCurrency(summary?.profit)}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-detail-grid">
        <article className="panel-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Expenses</p>
              <h3>Today&apos;s expense types</h3>
            </div>
            <span className="pill">
              {summary?.expenseEntries?.length || form.expenseEntries.length || 0} items
            </span>
          </div>

          {(form.expenseEntries.length || summary?.expenseEntries?.length) ? (
            <div className="summary-list">
              {(form.expenseEntries.length
                ? form.expenseEntries
                : summary?.expenseEntries || []
              ).map((entry, index) => (
                <div key={`${entry.label}-${index}`} className="summary-row">
                  <span>{entry.label}</span>
                  <strong>{formatCurrency(entry.amount)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h4>No expenses added</h4>
            </div>
          )}
        </article>

        <article className="panel-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Customers</p>
              <h3>Business health</h3>
            </div>
            <span className="pill">{summary?.customerCount || 0} households</span>
          </div>

          <div className="summary-list">
            <div className="summary-row">
              <span>Monthly customers</span>
              <strong>{summary?.monthlyCustomers || 0}</strong>
            </div>
            <div className="summary-row">
              <span>Daily customers</span>
              <strong>{summary?.dailyCustomers || 0}</strong>
            </div>
            <div className="summary-row">
              <span>Customers with dues</span>
              <strong>{summary?.customersWithBalanceCount || 0}</strong>
            </div>
            <div className="summary-row">
              <span>Morning demand</span>
              <strong>{formatLiters(summary?.expectedMorningLiters)}</strong>
            </div>
            <div className="summary-row summary-total">
              <span>Evening demand</span>
              <strong>{formatLiters(summary?.expectedEveningLiters)}</strong>
            </div>
          </div>
        </article>

        <article className="panel-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Collections</p>
              <h3>Customers needing follow-up</h3>
            </div>
            <Link to="/" className="pill action-pill">
              Open customers
            </Link>
          </div>

          {!summary?.topDueCustomers?.length ? (
            <div className="empty-state">
              <h4>No pending dues</h4>
            </div>
          ) : (
            <div className="card-list compact-list">
              {summary.topDueCustomers.map((customer) => (
                <Link
                  key={customer._id}
                  to={`/customer/${customer._id}`}
                  className="customer-card"
                >
                  <div className="customer-card-top">
                    <div>
                      <h4>{customer.name}</h4>
                      <p>{customer.phone}</p>
                    </div>
                    <span className="pill">
                      {customer.paymentType}
                    </span>
                  </div>
                  <div className="customer-stats single-stat-row">
                    <div>
                      <span>Pending amount</span>
                      <strong>{formatCurrency(customer.balance)}</strong>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </article>

        <article className="panel-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Purchases</p>
              <h3>Supplier payment dues</h3>
            </div>
            <Link to="/products" className="pill action-pill">
              Open inventory
            </Link>
          </div>

          {!summary?.recentPurchases?.length ? (
            <div className="empty-state">
              <h4>No purchases yet</h4>
            </div>
          ) : (
            <div className="card-list compact-list">
              {summary.recentPurchases.map((purchase) => (
                <div key={purchase._id} className="customer-card inventory-card">
                  <div className="customer-card-top">
                    <div>
                      <h4>{purchase.productName}</h4>
                      <p>{purchase.supplierName || formatDate(purchase.date)}</p>
                    </div>
                    <span
                      className={
                        purchase.pendingAmount > 0 ? "pill pill-amber" : "pill pill-green"
                      }
                    >
                      {purchase.pendingAmount > 0 ? "Unpaid" : "Paid"}
                    </span>
                  </div>
                  <div className="customer-stats">
                    <div>
                      <span>Cost</span>
                      <strong>{formatCurrency(purchase.cost)}</strong>
                    </div>
                    <div>
                      <span>Paid</span>
                      <strong>{formatCurrency(purchase.amountPaid)}</strong>
                    </div>
                    <div>
                      <span>Pending</span>
                      <strong>{formatCurrency(purchase.pendingAmount)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Activity</p>
              <h3>Recent ledger movements</h3>
            </div>
            <span className="pill">{summary?.recentActivity?.length || 0} updates</span>
          </div>

          {!summary?.recentActivity?.length ? (
            <div className="empty-state">
              <h4>No ledger activity yet</h4>
            </div>
          ) : (
            <div className="ledger-list">
              {summary.recentActivity.map((entry) => (
                <div key={entry._id} className="ledger-item">
                  <div className="ledger-icon">
                    {entry.type === "debit" ? "DR" : "CR"}
                  </div>
                  <div className="ledger-copy">
                    <div className="ledger-headline">
                      <strong>{entry.customerName}</strong>
                      <span
                        className={
                          entry.type === "debit"
                            ? "amount-negative"
                            : "amount-positive"
                        }
                      >
                        {entry.type === "debit" ? "+" : "-"}
                        {formatCurrency(entry.amount)}
                      </span>
                    </div>
                    <p>{entry.description || "Ledger entry"}</p>
                    <p>{formatDateTime(entry.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

export default Dashboard;
