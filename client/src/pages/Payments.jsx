import { useEffect, useState } from "react";
import API from "../services/api";
import { formatCurrency } from "../utils/formatters";

const initialVendorPaymentForm = {
  supplierName: "",
  purchaseId: "",
  amount: "",
  settledAmount: "",
  method: "Cash",
  note: "",
};

const initialBillFilters = {
  supplierName: "",
  productName: "",
};

function Payments() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingVendorPayment, setSubmittingVendorPayment] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [vendorPaymentForm, setVendorPaymentForm] = useState(initialVendorPaymentForm);
  const [billFilters, setBillFilters] = useState(initialBillFilters);

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

  useEffect(() => {
    if (!successToast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessToast("");
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [successToast]);

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

  const products = [
    ...new Set(
      unpaidPurchases
        .map((purchase) => purchase.product?.name?.trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b));

  const filteredVendorPurchases = unpaidPurchases.filter((purchase) => {
    if (!vendorPaymentForm.supplierName) {
      return true;
    }

    return purchase.supplierName === vendorPaymentForm.supplierName;
  });

  const filteredUnpaidPurchases = unpaidPurchases.filter((purchase) => {
    const matchesSupplier = billFilters.supplierName
      ? purchase.supplierName === billFilters.supplierName
      : true;
    const matchesProduct = billFilters.productName
      ? purchase.product?.name === billFilters.productName
      : true;

    return matchesSupplier && matchesProduct;
  });

  const filteredPurchaseDue = filteredUnpaidPurchases.reduce(
    (sum, purchase) => sum + (Number(purchase.pendingAmount) || 0),
    0
  );

  const filteredSuppliers = [
    ...new Set(
      filteredUnpaidPurchases
        .map((purchase) => purchase.supplierName?.trim())
        .filter(Boolean)
    ),
  ];

  useEffect(() => {
    if (!filteredVendorPurchases.length) {
      if (vendorPaymentForm.purchaseId !== "") {
        setVendorPaymentForm((current) => ({
          ...current,
          purchaseId: "",
        }));
      }
      return;
    }

    if (vendorPaymentForm.supplierName && vendorPaymentForm.purchaseId === "") {
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

    if (!filteredVendorPurchases.length) {
      setError("Choose a pending vendor or product to pay.");
      return;
    }

    if (!vendorPaymentForm.purchaseId && !vendorPaymentForm.supplierName) {
      setError("Choose a vendor or select a specific product.");
      return;
    }

    try {
      setSubmittingVendorPayment(true);
      setError("");
      setNotice("");
      setSuccessToast("");
      const paymentPayload = {
        amount: Number(vendorPaymentForm.amount) || 0,
        settledAmount: Number(vendorPaymentForm.settledAmount) || 0,
        method: vendorPaymentForm.method,
        note: vendorPaymentForm.note,
      };

      if (vendorPaymentForm.purchaseId) {
        await API.post(
          `/products/purchase/${vendorPaymentForm.purchaseId}/payment`,
          paymentPayload
        );
      } else {
        await API.post("/products/purchases/payment", {
          purchaseIds: filteredVendorPurchases.map((purchase) => purchase._id),
          supplierName: vendorPaymentForm.supplierName,
          ...paymentPayload,
        });
      }
      setVendorPaymentForm((current) => ({
        ...initialVendorPaymentForm,
        supplierName: current.supplierName,
        purchaseId: "",
      }));
      setSuccessToast("Vendor payment saved successfully.");
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
      {successToast ? <p className="feedback success update-toast">{successToast}</p> : null}

      <section className="hero-card">
        <div>
          <p className="eyebrow">Payments</p>
          <h2>Payments</h2>
        </div>

        <div className="hero-metrics">
          <div className="metric-card accent-amber">
            <span>Total due</span>
            <strong>{formatCurrency(filteredPurchaseDue)}</strong>
          </div>
          <div className="metric-card accent-blue">
            <span>Pending bills</span>
            <strong>{filteredUnpaidPurchases.length}</strong>
          </div>
          <div className="metric-card accent-green">
            <span>Vendors</span>
            <strong>{filteredSuppliers.length}</strong>
          </div>
        </div>
      </section>

      {error ? <p className="feedback error">{error}</p> : null}
      <section className="content-grid">
        <article className="panel-card payment-vendor-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Vendor payment</p>
              <h3>Pay pending supplier bills</h3>
            </div>
            <span className="pill">{suppliers.length} vendors</span>
          </div>

          <form className="form-grid payment-vendor-form" onSubmit={handleVendorPayment}>
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
                      purchaseId: "",
                      amount: "",
                      settledAmount: "",
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
                    ? vendorPaymentForm.supplierName
                      ? "All products"
                      : "Select product"
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
              />
            </label>

            <label className="field">
              <span>Settle amount</span>
              <input
                type="number"
                min="0"
                step="1"
                value={vendorPaymentForm.settledAmount}
                onChange={(e) =>
                  setVendorPaymentForm({
                    ...vendorPaymentForm,
                    settledAmount: e.target.value,
                  })
                }
                placeholder="Optional discount or adjustment"
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

        <article className="panel-card payment-bills-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Pending bills</p>
              <h3>Unpaid purchases</h3>
            </div>
            <span className="pill">{filteredUnpaidPurchases.length} pending</span>
          </div>

          <div className="ledger-filter-stack payment-filter-stack">
            <label className="field ledger-filter-control">
              <span>Vendor</span>
              <select
                value={billFilters.supplierName}
                onChange={(e) =>
                  setBillFilters((current) => ({
                    ...current,
                    supplierName: e.target.value,
                  }))
                }
              >
                <option value="">All vendors</option>
                {suppliers.map((supplier) => (
                  <option key={supplier} value={supplier}>
                    {supplier}
                  </option>
                ))}
              </select>
            </label>

            <label className="field ledger-filter-control">
              <span>Product</span>
              <select
                value={billFilters.productName}
                onChange={(e) =>
                  setBillFilters((current) => ({
                    ...current,
                    productName: e.target.value,
                  }))
                }
              >
                <option value="">All products</option>
                {products.map((product) => (
                  <option key={product} value={product}>
                    {product}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? <p className="feedback">Loading payments...</p> : null}

          {!loading && !filteredUnpaidPurchases.length ? (
            <div className="empty-state">
              <h4>{unpaidPurchases.length ? "No matching purchases" : "No unpaid purchases"}</h4>
            </div>
          ) : (
            <div className="stock-watch-list supplier-due-list">
              {filteredUnpaidPurchases.map((purchase) => (
                <div key={purchase._id} className="stock-watch-row supplier-due-row">
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
