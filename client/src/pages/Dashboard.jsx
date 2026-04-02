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
  const [successToast, setSuccessToast] = useState("");
  const [form, setForm] = useState({
    milkPurchased: 0,
    purchaseCost: 0,
    expenseEntries: [],
    closingEntries: [],
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
        closingEntries: res.data.closingEntries || [],
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

  useEffect(() => {
    if (!successToast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessToast("");
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [successToast]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccessToast("");
      await API.post("/summary", {
        date: today,
        ...form,
      });
      setSuccessToast("Daily summary saved successfully.");
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
  const computedInventorySales = form.closingEntries.reduce(
    (sum, entry) =>
      sum +
      Math.max(
        (Number(entry.startingQuantity) || 0) - (Number(entry.remainingQuantity) || 0),
        0
      ) *
        (Number(entry.unitPrice) || 0),
    0
  );
  const computedInventoryCost = form.closingEntries.reduce(
    (sum, entry) =>
      sum +
      Math.max(
        (Number(entry.startingQuantity) || 0) - (Number(entry.remainingQuantity) || 0),
        0
      ) *
        (Number(entry.unitCost) || 0),
    0
  );
  const baseLedgerSales = Math.max(
    (Number(summary?.totalSales) || 0) - (Number(summary?.inventorySales) || 0),
    0
  );
  const displayTotalSales = baseLedgerSales + computedInventorySales;
  const displayOtherExpenses =
    form.expenseEntries.length || !summary ? totalOtherExpenses : Number(summary?.otherExpenses) || 0;
  const displayPurchaseCost = Number(summary?.purchaseCost) || 0;
  const displayProfit =
    displayTotalSales - computedInventoryCost - displayPurchaseCost - displayOtherExpenses;

  return (
    <div className="page-stack">
      {successToast ? <p className="feedback success update-toast">{successToast}</p> : null}

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
          <strong>{formatCurrency(displayTotalSales)}</strong>
        </div>
        <div className="metric-card accent-green">
          <span>Total collection</span>
          <strong>{formatCurrency(summary?.totalCollection)}</strong>
        </div>
        <div className="metric-card accent-amber">
          <span>Net profit</span>
          <strong>{formatCurrency(displayProfit)}</strong>
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
              <h3>Expense log</h3>
            </div>
            <span className="pill">Editable today</span>
          </div>

          <div className="form-grid">
            <label className="field field-full">
              <span>Date</span>
              <input type="date" value={today} readOnly />
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
              className="secondary-button dashboard-add-expense-button"
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
              <strong>{formatCurrency(displayPurchaseCost)}</strong>
            </div>
            <div className="summary-row">
              <span>Inventory sales</span>
              <strong>{formatCurrency(computedInventorySales)}</strong>
            </div>
            <div className="summary-row">
              <span>Inventory cost</span>
              <strong>{formatCurrency(computedInventoryCost)}</strong>
            </div>
            <div className="summary-row">
              <span>Other expenses</span>
              <strong>{formatCurrency(displayOtherExpenses)}</strong>
            </div>
            <div className="summary-row">
              <span>Total sales</span>
              <strong>{formatCurrency(displayTotalSales)}</strong>
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
              <strong>{formatCurrency(displayProfit)}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-detail-grid">
        <article className="panel-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Closing Stock</p>
              <h3>Remaining quantity for today</h3>
            </div>
            <span className="pill">
              {form.closingEntries.length || 0} products
            </span>
          </div>

          {!form.closingEntries.length ? (
            <div className="empty-state">
              <h4>No inventory products to close today</h4>
            </div>
          ) : (
            <div className="stock-watch-list">
              {form.closingEntries.map((entry, index) => {
                const startingQuantity = Number(entry.startingQuantity) || 0;
                const remainingQuantity = Number(entry.remainingQuantity) || 0;
                const soldQuantity = Math.max(startingQuantity - remainingQuantity, 0);
                const saleAmount = soldQuantity * (Number(entry.unitPrice) || 0);

                return (
                  <div key={entry.productId || `${entry.productName}-${index}`} className="stock-watch-row">
                    <div className="stock-watch-main">
                      <div>
                        <h4>{entry.productName}</h4>
                        <p>
                          Start {startingQuantity} {entry.unit} | Sold {soldQuantity} {entry.unit}
                        </p>
                      </div>
                      <strong className="stock-watch-value">{formatCurrency(saleAmount)}</strong>
                    </div>

                    <div className="customer-stats">
                      <div>
                        <span>Opening</span>
                        <strong>
                          {startingQuantity} {entry.unit}
                        </strong>
                      </div>
                      <div>
                        <span>Remaining</span>
                        <input
                          className="closing-stock-input"
                          type="number"
                          min="0"
                          step="0.5"
                          value={entry.remainingQuantity}
                          onChange={(e) =>
                            setForm((current) => ({
                              ...current,
                              closingEntries: current.closingEntries.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, remainingQuantity: e.target.value }
                                  : item
                              ),
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

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

      </section>
    </div>
  );
}

export default Dashboard;
