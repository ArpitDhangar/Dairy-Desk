import { useEffect, useState } from "react";
import API from "../services/api";
import {
  formatCurrency,
  formatDate,
  formatLiters,
} from "../utils/formatters";

function Dashboard() {
  const today = new Date().toISOString().split("T")[0];

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get(`/summary/${today}`);
      setSummary(res.data);
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

  const displayTotalSales = Number(summary?.totalSales) || 0;
  const displayProfit = Number(summary?.profit) || 0;
  const displayOtherExpenses = Number(summary?.otherExpenses) || 0;
  const displayPurchaseCost = Number(summary?.purchaseCost) || 0;
  const inventorySales = Number(summary?.inventorySales) || 0;
  const inventoryCost = Number(summary?.inventoryCost) || 0;
  const baseLedgerSales = Math.max(displayTotalSales - inventorySales, 0);
  const profitPositive = displayProfit >= 0;

  return (
    <div className="page-stack">
      {/* ── Page header ── */}
      <div className="dash-header">
        <div>
          <p className="eyebrow">Owner Dashboard</p>
          <h2 className="dash-title">Daily Overview</h2>
        </div>
        <div className="date-badge">{formatDate(today)}</div>
      </div>

      {error ? <p className="feedback error">{error}</p> : null}

      {/* ── KPI grid ── */}
      <section className="kpi-grid">
        <div className="kpi-card kpi-accent-blue">
          <div className="kpi-card-top">
            <span className="kpi-label">Total Sales</span>
            <div className="kpi-icon kpi-icon-blue">
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <strong className="kpi-value">{formatCurrency(displayTotalSales)}</strong>
        </div>

        <div className="kpi-card kpi-accent-green">
          <div className="kpi-card-top">
            <span className="kpi-label">Total Collection</span>
            <div className="kpi-icon kpi-icon-green">
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM2 9h16v5a2 2 0 01-2 2H4a2 2 0 01-2-2V9zm4 2a1 1 0 100 2h2a1 1 0 100-2H6z" />
              </svg>
            </div>
          </div>
          <strong className="kpi-value">{formatCurrency(summary?.totalCollection)}</strong>
        </div>

        <div className={`kpi-card ${profitPositive ? "kpi-accent-teal" : "kpi-accent-red"}`}>
          <div className="kpi-card-top">
            <span className="kpi-label">Net Profit</span>
            <div className={`kpi-icon ${profitPositive ? "kpi-icon-teal" : "kpi-icon-red"}`}>
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414 3.707 14.707a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <strong className={`kpi-value ${profitPositive ? "kpi-value-positive" : "kpi-value-negative"}`}>
            {formatCurrency(displayProfit)}
          </strong>
        </div>

        <div className="kpi-card kpi-accent-amber">
          <div className="kpi-card-top">
            <span className="kpi-label">Outstanding Balance</span>
            <div className="kpi-icon kpi-icon-amber">
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <strong className="kpi-value">{formatCurrency(summary?.outstandingBalance)}</strong>
        </div>

        <div className="kpi-card kpi-accent-teal">
          <div className="kpi-card-top">
            <span className="kpi-label">Expected Delivery</span>
            <div className="kpi-icon kpi-icon-teal">
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-1h3a1 1 0 00.8-.4l3-4a1 1 0 00.2-.6V8a1 1 0 00-1-1h-3V5a1 1 0 00-1-1H3z" />
              </svg>
            </div>
          </div>
          <strong className="kpi-value">{formatLiters(summary?.expectedTotalLiters)}</strong>
        </div>

        <div className="kpi-card kpi-accent-red">
          <div className="kpi-card-top">
            <span className="kpi-label">Supplier Due</span>
            <div className="kpi-icon kpi-icon-red">
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm4.707 3.707a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L8.414 9H10a3 3 0 013 3v1a1 1 0 102 0v-1a5 5 0 00-5-5H8.414l1.293-1.293z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <strong className="kpi-value">{formatCurrency(summary?.purchaseDueAmount)}</strong>
        </div>
      </section>

      {/* ── P&L Summary ── */}
      <article className="panel-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Today</p>
            <h3>P&amp;L Summary</h3>
          </div>
          <span className={`pill ${loading ? "" : "pill-green"}`}>
            {loading ? "Refreshing" : "Live totals"}
          </span>
        </div>

        <div className="pnl-list">
          <div className="pnl-section-label">Income</div>
          <div className="summary-row">
            <span>Ledger sales</span>
            <strong>{formatCurrency(baseLedgerSales)}</strong>
          </div>
          <div className="summary-row">
            <span>Inventory sales</span>
            <strong>{formatCurrency(inventorySales)}</strong>
          </div>
          <div className="pnl-subtotal">
            <span>Total sales</span>
            <strong>{formatCurrency(displayTotalSales)}</strong>
          </div>

          <div className="pnl-section-label pnl-section-gap">Costs</div>
          <div className="summary-row">
            <span>Milk purchase</span>
            <strong>{formatCurrency(displayPurchaseCost)}</strong>
          </div>
          <div className="summary-row">
            <span>Inventory cost</span>
            <strong>{formatCurrency(inventoryCost)}</strong>
          </div>
          <div className="summary-row">
            <span>Other expenses</span>
            <strong>{formatCurrency(displayOtherExpenses)}</strong>
          </div>

          <div className={`pnl-profit ${profitPositive ? "pnl-profit-positive" : "pnl-profit-negative"}`}>
            <span>Net profit</span>
            <strong>{formatCurrency(displayProfit)}</strong>
          </div>
        </div>

        <div className="pnl-footer-row">
          <div className="pnl-footer-stat">
            <span>Collection</span>
            <strong>{formatCurrency(summary?.totalCollection)}</strong>
          </div>
          <div className="pnl-footer-stat">
            <span>Milk sold</span>
            <strong>{formatLiters(summary?.milkSold)}</strong>
          </div>
          <div className="pnl-footer-stat">
            <span>Milk purchased</span>
            <strong>{formatLiters(summary?.milkPurchased)}</strong>
          </div>
        </div>
      </article>

      {/* ── Detail grid ── */}
      <section className="dashboard-detail-grid">
        <article className="panel-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Expenses</p>
              <h3>Today&apos;s breakdown</h3>
            </div>
            <span className="pill">
              {summary?.expenseEntries?.length || 0} items
            </span>
          </div>

          {summary?.expenseEntries?.length ? (
            <div className="summary-list">
              {summary.expenseEntries.map((entry, index) => (
                <div key={`${entry.label}-${index}`} className="summary-row">
                  <span>{entry.label}</span>
                  <strong>{formatCurrency(entry.amount)}</strong>
                </div>
              ))}
              <div className="summary-total">
                <span>Total expenses</span>
                <strong>{formatCurrency(displayOtherExpenses)}</strong>
              </div>
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
            <div className="summary-total">
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
