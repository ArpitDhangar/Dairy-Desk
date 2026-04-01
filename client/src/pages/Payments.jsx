import { useEffect, useState } from "react";
import API from "../services/api";
import { formatCurrency } from "../utils/formatters";

const initialVendorPaymentForm = {
  supplierName: "",
  purchaseId: "",
  amount: "",
  method: "",
  note: "",
};

function Payments() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingVendorPayment, setSubmittingVendorPayment] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [vendorPaymentForm, setVendorPaymentForm] = useState(initialVendorPaymentForm);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      setError("");
      const purchasesRes = await API.get("/products/purchases");
      setPurchases(purchasesRes.data);
    } catch (err) {
      setError("Could not load payments right now.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  const unpaidPurchases = purchases.filter(
    (purchase) => Number(purchase.pendingAmount) > 0
  );

  const suppliers = [
    ...new Set(
      unpaidPurchases
        .map((purchase) => purchase.supplierName?.trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b));

  const filteredVendorPurchases = unpaidPurchases.filter((purchase) => {
    if (!vendorPaymentForm.supplierName) {
      return true;
    }

    return purchase.supplierName === vendorPaymentForm.supplierName;
  });

  const totalPurchaseDue = unpaidPurchases.reduce(
    (sum, purchase) => sum + (Number(purchase.pendingAmount) || 0),
    0
  );

  useEffect(() => {
    if (!filteredVendorPurchases.length) {
      if (vendorPaymentForm.purchaseId) {
        setVendorPaymentForm((current) => ({
          ...current,
          purchaseId: "",
        }));
      }
      return;
    }

    const hasSelectedPurchase = filteredVendorPurchases.some(
      (purchase) => purchase._id === vendorPaymentForm.purchaseId
    );

    if (!hasSelectedPurchase) {
      setVendorPaymentForm((current) => ({
        ...current,
        purchaseId: filteredVendorPurchases[0]._id,
      }));
    }
  }, [
    filteredVendorPurchases,
    vendorPaymentForm.purchaseId,
  ]);

  const handleVendorPayment = async (e) => {
    e.preventDefault();

    if (!vendorPaymentForm.purchaseId) {
      setError("Choose a purchase to pay.");
      return;
    }

    try {
      setSubmittingVendorPayment(true);
      setError("");
      setNotice("");
      await API.post(
        `/products/purchase/${vendorPaymentForm.purchaseId}/payment`,
        {
          amount: Number(vendorPaymentForm.amount) || 0,
          method: vendorPaymentForm.method,
          note: vendorPaymentForm.note,
        }
      );
      setVendorPaymentForm((current) => ({
        ...initialVendorPaymentForm,
        supplierName: current.supplierName,
      }));
      setNotice("Vendor payment saved successfully.");
      fetchPurchases();
    } catch (err) {
      setError(err?.response?.data?.message || "Vendor payment could not be saved.");
      console.error(err);
    } finally {
      setSubmittingVendorPayment(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Payments</p>
          <h2>Payments</h2>
        </div>

        <div className="hero-metrics">
          <div className="metric-card accent-amber">
            <span>Total due</span>
            <strong>{formatCurrency(totalPurchaseDue)}</strong>
          </div>
          <div className="metric-card accent-blue">
            <span>Pending bills</span>
            <strong>{unpaidPurchases.length}</strong>
          </div>
          <div className="metric-card accent-green">
            <span>Vendors</span>
            <strong>{suppliers.length}</strong>
          </div>
        </div>
      </section>

      {error ? <p className="feedback error">{error}</p> : null}
      {notice ? <p className="feedback success">{notice}</p> : null}

      <section className="content-grid">
        <article className="panel-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Vendor payment</p>
              <h3>Pay pending supplier bills</h3>
            </div>
            <span className="pill">{suppliers.length} vendors</span>
          </div>

          <form className="form-grid" onSubmit={handleVendorPayment}>
            <label className="field">
              <span>Vendor</span>
              <select
                value={vendorPaymentForm.supplierName}
                onChange={(e) =>
                  {
                    const selectedSupplier = e.target.value;
                    const matchingPurchases = unpaidPurchases.filter((purchase) =>
                      selectedSupplier
                        ? purchase.supplierName === selectedSupplier
                        : true
                    );

                    setVendorPaymentForm({
                      supplierName: selectedSupplier,
                      purchaseId: matchingPurchases[0]?._id || "",
                      amount: "",
                      method: vendorPaymentForm.method,
                      note: vendorPaymentForm.note,
                    });
                  }
                }
                disabled={!suppliers.length}
              >
                <option value="">
                  {suppliers.length ? "All vendors" : "No unpaid vendors"}
                </option>
                {suppliers.map((supplier) => (
                  <option key={supplier} value={supplier}>
                    {supplier}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Purchase</span>
              <select
                value={vendorPaymentForm.purchaseId}
                onChange={(e) =>
                  setVendorPaymentForm({
                    ...vendorPaymentForm,
                    purchaseId: e.target.value,
                  })
                }
                disabled={!filteredVendorPurchases.length}
              >
                <option value="">
                  {filteredVendorPurchases.length
                    ? "Choose pending purchase"
                    : "No pending purchase"}
                </option>
                {filteredVendorPurchases.map((purchase) => (
                  <option key={purchase._id} value={purchase._id}>
                    {purchase.product?.name || "Product"} | Due{" "}
                    {formatCurrency(purchase.pendingAmount)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Payment amount</span>
              <input
                type="number"
                min="0"
                step="1"
                value={vendorPaymentForm.amount}
                onChange={(e) =>
                  setVendorPaymentForm({
                    ...vendorPaymentForm,
                    amount: e.target.value,
                  })
                }
                required
              />
            </label>

            <label className="field">
              <span>Method</span>
              <input
                value={vendorPaymentForm.method}
                onChange={(e) =>
                  setVendorPaymentForm({
                    ...vendorPaymentForm,
                    method: e.target.value,
                  })
                }
                placeholder="Cash, UPI, bank"
              />
            </label>

            <label className="field field-full">
              <span>Note</span>
              <input
                value={vendorPaymentForm.note}
                onChange={(e) =>
                  setVendorPaymentForm({
                    ...vendorPaymentForm,
                    note: e.target.value,
                  })
                }
                placeholder="Half payment settled today"
              />
            </label>

            <button
              className="primary-button field-full"
              type="submit"
              disabled={submittingVendorPayment || !filteredVendorPurchases.length}
            >
              {submittingVendorPayment ? "Saving..." : "Save vendor payment"}
            </button>
          </form>
        </article>

        <article className="panel-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Pending bills</p>
              <h3>Unpaid purchases</h3>
            </div>
            <span className="pill">{unpaidPurchases.length} pending</span>
          </div>

          {loading ? <p className="feedback">Loading payments...</p> : null}

          {!loading && !unpaidPurchases.length ? (
            <div className="empty-state">
              <h4>No unpaid purchases</h4>
            </div>
          ) : (
            <div className="stock-watch-list">
              {unpaidPurchases.map((purchase) => (
                <div key={purchase._id} className="stock-watch-row">
                  <div className="stock-watch-main">
                    <div>
                      <h4>{purchase.product?.name || "Product"}</h4>
                      <p>{purchase.supplierName || "Supplier not added"}</p>
                    </div>
                    <strong className="stock-watch-value">
                      {purchase.product?.unit
                        ? `${purchase.quantity} ${purchase.product.unit}`
                        : purchase.quantity}
                    </strong>
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

                  {purchase.payments?.length ? (
                    <div className="purchase-history">
                      <span>Payments</span>
                      <div className="chip-list">
                        {purchase.payments.slice().reverse().map((payment, index) => (
                          <span
                            key={`${purchase._id}-payment-${index}`}
                            className="expense-chip static-chip"
                          >
                            {formatCurrency(payment.amount)}
                            {payment.method ? ` ${payment.method}` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

export default Payments;
