import { useEffect, useState } from "react";
import API from "../services/api";
import { formatCurrency, formatDate } from "../utils/formatters";

const initialProductForm = {
  name: "",
  unit: "liter",
  stock: 0,
  sellingPrice: "",
};

const initialPurchaseForm = {
  product: "",
  quantity: "",
  cost: "",
  amountPaid: "",
  supplierName: "",
  notes: "",
};

function normalizeLabel(value) {
  return String(value || "").trim().toLowerCase();
}

function Products() {
  const today = new Date().toISOString().split("T")[0];

  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [todaySummary, setTodaySummary] = useState(null);
  const [closingEntries, setClosingEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [submittingPurchase, setSubmittingPurchase] = useState(false);
  const [savingClosing, setSavingClosing] = useState(false);
  const [savingProductId, setSavingProductId] = useState("");
  const [deletingProductId, setDeletingProductId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updateToast, setUpdateToast] = useState("");
  const [productForm, setProductForm] = useState(initialProductForm);
  const [purchaseForm, setPurchaseForm] = useState(initialPurchaseForm);
  const [editingProductId, setEditingProductId] = useState("");
  const [editForm, setEditForm] = useState({ name: "", sellingPrice: "" });
  const [dateFilter, setDateFilter] = useState("");

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");
      const [productsRes, purchasesRes, summaryRes] = await Promise.all([
        API.get("/products"),
        API.get("/products/purchases"),
        API.get(`/summary/${today}`),
      ]);
      setProducts(productsRes.data);
      setPurchases(purchasesRes.data);
      setTodaySummary(summaryRes.data);
      setClosingEntries(summaryRes.data.closingEntries || []);
      setPurchaseForm((current) => ({
        ...current,
        product: current.product || productsRes.data[0]?._id || "",
      }));
    } catch (err) {
      setError("Could not load products right now.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (!updateToast) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setUpdateToast(""), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [updateToast]);

  useEffect(() => {
    const supplierName = purchaseForm.supplierName.trim();
    if (!purchaseForm.product || !supplierName) return;

    const latestMatchingPurchase = purchases.find((purchase) => {
      const purchaseProductId =
        typeof purchase.product === "object" ? purchase.product?._id : purchase.product;
      return (
        String(purchaseProductId || "") === String(purchaseForm.product) &&
        normalizeLabel(purchase.supplierName) === normalizeLabel(supplierName)
      );
    });

    if (!latestMatchingPurchase) return;

    const latestUnitCost = String(
      Number(
        latestMatchingPurchase.unitCost ??
          (Number(latestMatchingPurchase.quantity) > 0
            ? Number(latestMatchingPurchase.cost) / Number(latestMatchingPurchase.quantity)
            : 0)
      ) || 0
    );

    setPurchaseForm((current) => {
      if (
        current.product !== purchaseForm.product ||
        current.supplierName.trim() !== supplierName ||
        current.cost === latestUnitCost
      ) {
        return current;
      }
      return { ...current, cost: latestUnitCost };
    });
  }, [purchaseForm.product, purchaseForm.supplierName, purchases]);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      setSubmittingProduct(true);
      setError("");
      setNotice("");
      setUpdateToast("");
      await API.post("/products", {
        ...productForm,
        stock: Number(productForm.stock) || 0,
        sellingPrice: Number(productForm.sellingPrice) || 0,
      });
      setProductForm(initialProductForm);
      setUpdateToast("Product added successfully.");
      fetchAll();
    } catch (err) {
      setError("Product could not be added.");
      console.error(err);
    } finally {
      setSubmittingProduct(false);
    }
  };

  const handleAddPurchase = async (e) => {
    e.preventDefault();
    if (!purchaseForm.product) {
      setError("Choose a product before saving stock.");
      return;
    }
    if (!purchaseForm.supplierName.trim()) {
      setError("Enter a vendor name before saving stock.");
      return;
    }
    try {
      setSubmittingPurchase(true);
      setError("");
      setNotice("");
      setUpdateToast("");
      await API.post("/products/purchase", {
        product: purchaseForm.product,
        quantity: Number(purchaseForm.quantity) || 0,
        unitCost: Number(purchaseForm.cost) || 0,
        amountPaid: Number(purchaseForm.amountPaid) || 0,
        supplierName: purchaseForm.supplierName.trim(),
        notes: purchaseForm.notes,
      });
      setPurchaseForm((current) => ({
        ...initialPurchaseForm,
        product: current.product,
      }));
      setUpdateToast("Stock purchase saved successfully.");
      fetchAll();
    } catch (err) {
      setError("Stock purchase could not be saved.");
      console.error(err);
    } finally {
      setSubmittingPurchase(false);
    }
  };

  const handleSaveClosing = async () => {
    try {
      setSavingClosing(true);
      setError("");
      setUpdateToast("");
      await API.post("/summary", {
        date: today,
        milkPurchased: todaySummary?.milkPurchased || 0,
        purchaseCost: todaySummary?.purchaseCost || 0,
        expenseEntries: todaySummary?.expenseEntries || [],
        closingEntries: closingEntries.map((e) => ({
          productId: e.productId,
          remainingQuantity: e.remainingQuantity,
        })),
      });
      setUpdateToast("Closing stock saved successfully.");
      fetchAll();
    } catch (err) {
      setError("Closing stock could not be saved.");
      console.error(err);
    } finally {
      setSavingClosing(false);
    }
  };

  const startEditingProduct = (product) => {
    setEditingProductId(product._id);
    setEditForm({
      name: product.name || "",
      sellingPrice: String(product.sellingPrice ?? ""),
    });
  };

  const handleUpdateProduct = async (productId) => {
    try {
      setSavingProductId(productId);
      setError("");
      setNotice("");
      setUpdateToast("");
      await API.put(`/products/${productId}`, {
        name: editForm.name,
        sellingPrice: Number(editForm.sellingPrice) || 0,
      });
      setEditingProductId("");
      setUpdateToast("Product updated successfully.");
      fetchAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Product could not be updated.");
      console.error(err);
    } finally {
      setSavingProductId("");
    }
  };

  const handleDeleteProduct = async (productId) => {
    try {
      setDeletingProductId(productId);
      setError("");
      setNotice("");
      setUpdateToast("");
      await API.delete(`/products/${productId}`);
      if (editingProductId === productId) setEditingProductId("");
      setUpdateToast("Product deleted successfully.");
      fetchAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Product could not be deleted.");
      console.error(err);
    } finally {
      setDeletingProductId("");
    }
  };

  const lowStockProducts = products.filter((p) => Number(p.stock) <= 5);
  const totalStock = products.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
  const totalPurchaseDue = purchases.reduce((sum, p) => sum + (Number(p.pendingAmount) || 0), 0);
  const unpaidPurchases = purchases.filter((p) => Number(p.pendingAmount) > 0);
  const selectedPurchaseProduct = products.find(
    (p) => String(p._id) === String(purchaseForm.product)
  );
  const vendors = [
    ...new Set(purchases.map((p) => p.supplierName?.trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  const [showAllPurchases, setShowAllPurchases] = useState(false);
  const PURCHASE_PAGE_SIZE = 4;

  const filteredPurchases = dateFilter
    ? purchases.filter((p) => {
        const d = new Date(p.date || p.createdAt);
        return d.toISOString().split("T")[0] === dateFilter;
      })
    : purchases;

  const visiblePurchases = showAllPurchases
    ? filteredPurchases
    : filteredPurchases.slice(0, PURCHASE_PAGE_SIZE);

  return (
    <div className="page-stack">
      {updateToast ? <p className="feedback success update-toast">{updateToast}</p> : null}

      <section className="hero-card">
        <div>
          <p className="eyebrow">Inventory</p>
          <h2>Inventory</h2>
        </div>
        <div className="hero-metrics">
          <div className="metric-card accent-blue">
            <span>Total products</span>
            <strong>{products.length}</strong>
          </div>
          <div className="metric-card accent-green">
            <span>Total stock units</span>
            <strong>{totalStock}</strong>
          </div>
          <div className="metric-card accent-amber">
            <span>Supplier due</span>
            <strong>{formatCurrency(totalPurchaseDue)}</strong>
          </div>
        </div>
      </section>

      {error ? <p className="feedback error">{error}</p> : null}

      <section className="content-grid">
        <article className="panel-card catalog-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Catalog</p>
              <h3>Add a product</h3>
            </div>
            <span className="pill">Owner setup</span>
          </div>

          <form className="form-grid catalog-form-grid" onSubmit={handleAddProduct}>
            <label className="field">
              <span>Product name</span>
              <input
                placeholder="Curd"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                required
              />
            </label>

            <label className="field">
              <span>Unit</span>
              <select
                value={productForm.unit}
                onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
              >
                <option value="liter">Liter</option>
                <option value="kg">Kilogram</option>
                <option value="packet">Packet</option>
                <option value="piece">Piece</option>
              </select>
            </label>

            <label className="field">
              <span>Selling price</span>
              <input
                type="number"
                min="0"
                step="1"
                value={productForm.sellingPrice}
                onChange={(e) => setProductForm({ ...productForm, sellingPrice: e.target.value })}
                placeholder="0"
                required
              />
            </label>

            <label className="field">
              <span>Opening stock</span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={productForm.stock}
                onChange={(e) => setProductForm({ ...productForm, stock: Number(e.target.value) })}
              />
            </label>

            <button
              className="primary-button field-full"
              type="submit"
              disabled={submittingProduct}
            >
              {submittingProduct ? "Saving..." : "Add product"}
            </button>
          </form>
        </article>

        <article className="panel-card purchase-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Purchases</p>
            </div>
            <span className="pill pill-green">Stock inflow</span>
          </div>

          <form className="form-grid purchase-form-grid" onSubmit={handleAddPurchase}>
            <label className="field field-full">
              <span>Product</span>
              <select
                value={purchaseForm.product}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, product: e.target.value })}
                disabled={!products.length}
              >
                {products.length === 0 ? (
                  <option value="">Add a product first</option>
                ) : null}
                {products.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Quantity purchased</span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={purchaseForm.quantity}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })}
                required
              />
            </label>

            <label className="field">
              <span>
                Purchase price
                {selectedPurchaseProduct?.unit ? ` (per ${selectedPurchaseProduct.unit})` : ""}
              </span>
              <input
                type="number"
                min="0"
                step="1"
                value={purchaseForm.cost}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, cost: e.target.value })}
                required
              />
            </label>

            <label className="field">
              <span>Amount paid</span>
              <input
                type="number"
                min="0"
                step="1"
                value={purchaseForm.amountPaid}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, amountPaid: e.target.value })}
              />
            </label>

            <label className="field">
              <span>Supplier</span>
              <input
                list="purchase-vendors"
                value={purchaseForm.supplierName}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, supplierName: e.target.value })}
                placeholder="Vendor name"
                required
              />
              <datalist id="purchase-vendors">
                {vendors.map((v) => <option key={v} value={v} />)}
              </datalist>
            </label>

            <label className="field field-full">
              <span>Notes</span>
              <input
                value={purchaseForm.notes}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                placeholder="Pending payment, weekly bill"
              />
            </label>

            <button
              className="primary-button field-full"
              type="submit"
              disabled={submittingPurchase || !products.length}
            >
              {submittingPurchase ? "Saving..." : "Save purchase"}
            </button>
          </form>
        </article>
      </section>

      {/* ── Closing Stock ── */}
      <section className="panel-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">End of day</p>
            <h3>Closing Stock</h3>
          </div>
          <span className="pill">{closingEntries.length} products</span>
        </div>

        {!closingEntries.length ? (
          <div className="empty-state">
            <h4>No inventory products to close today</h4>
          </div>
        ) : (
          <>
            <div className="stock-watch-list">
              {closingEntries.map((entry, index) => {
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
                          Start {startingQuantity} {entry.unit} · Sold {soldQuantity} {entry.unit}
                        </p>
                      </div>
                      <strong className="stock-watch-value">{formatCurrency(saleAmount)}</strong>
                    </div>

                    <div className="customer-stats">
                      <div>
                        <span>Opening</span>
                        <strong>{startingQuantity} {entry.unit}</strong>
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
                            setClosingEntries((prev) =>
                              prev.map((item, i) =>
                                i === index ? { ...item, remainingQuantity: e.target.value } : item
                              )
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              className="primary-button"
              type="button"
              disabled={savingClosing}
              onClick={handleSaveClosing}
              style={{ marginTop: "16px" }}
            >
              {savingClosing ? "Saving..." : "Save closing stock"}
            </button>
          </>
        )}
      </section>

      {/* ── Supplier dues (unpaid only) ── */}
      <section className="panel-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Supplier dues</p>
            <h3>Unpaid purchases</h3>
          </div>
          <span className="pill">{unpaidPurchases.length} pending</span>
        </div>

        {!unpaidPurchases.length ? (
          <div className="empty-state">
            <h4>No unpaid purchases</h4>
          </div>
        ) : (
          <div className="stock-watch-list supplier-due-list">
            {unpaidPurchases.map((purchase) => (
              <div key={purchase._id} className="stock-watch-row supplier-due-row purchase-compact-row">
                <div className="stock-watch-main">
                  <div>
                    <h4>{purchase.product?.name || "Product"}</h4>
                    <p>{purchase.supplierName || "Supplier not added"}</p>
                  </div>
                  <div className="purchase-row-right">
                    <strong className="stock-watch-value">
                      {purchase.product?.unit
                        ? `${purchase.quantity} ${purchase.product.unit}`
                        : purchase.quantity}
                    </strong>
                    <span className="purchase-date-badge">
                      {formatDate(purchase.date || purchase.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="customer-stats">
                  <div><span>Cost</span><strong>{formatCurrency(purchase.cost)}</strong></div>
                  <div><span>Paid</span><strong>{formatCurrency(purchase.amountPaid)}</strong></div>
                  <div><span>Pending</span><strong>{formatCurrency(purchase.pendingAmount)}</strong></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Purchase History ── */}
      <section className="panel-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Stock purchases</p>
            <h3>Purchase history</h3>
          </div>
          <span className="pill">{filteredPurchases.length} records</span>
        </div>

        <div className="purchase-filter-row">
          <label className="field purchase-date-field">
            <span>Filter by date</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setShowAllPurchases(false); }}
            />
          </label>
          {dateFilter ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => { setDateFilter(""); setShowAllPurchases(false); }}
            >
              Clear filter
            </button>
          ) : null}
        </div>

        {!filteredPurchases.length ? (
          <div className="empty-state">
            <h4>{dateFilter ? "No purchases on this date" : "No purchases yet"}</h4>
          </div>
        ) : (
          <>
            <div className="stock-watch-list supplier-due-list">
              {visiblePurchases.map((purchase) => (
                <div key={purchase._id} className="stock-watch-row supplier-due-row purchase-compact-row">
                  <div className="stock-watch-main">
                    <div>
                      <h4>{purchase.product?.name || "Product"}</h4>
                      <p>{purchase.supplierName || "Supplier not added"}</p>
                    </div>
                    <div className="purchase-row-right">
                      <strong className="stock-watch-value">
                        {purchase.product?.unit
                          ? `${purchase.quantity} ${purchase.product.unit}`
                          : purchase.quantity}
                      </strong>
                      <span className="purchase-date-badge">
                        {formatDate(purchase.date || purchase.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="customer-stats">
                    <div><span>Cost</span><strong>{formatCurrency(purchase.cost)}</strong></div>
                    <div><span>Paid</span><strong>{formatCurrency(purchase.amountPaid)}</strong></div>
                    <div><span>Pending</span><strong>{formatCurrency(purchase.pendingAmount)}</strong></div>
                  </div>
                </div>
              ))}
            </div>
            {filteredPurchases.length > PURCHASE_PAGE_SIZE ? (
              <button
                className="see-more-button"
                type="button"
                onClick={() => setShowAllPurchases((v) => !v)}
              >
                {showAllPurchases
                  ? "Show less"
                  : `Show ${filteredPurchases.length - PURCHASE_PAGE_SIZE} more`}
              </button>
            ) : null}
          </>
        )}
      </section>

      {/* ── Current inventory ── */}
      <section className="panel-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Stock watch</p>
            <h3>Current inventory</h3>
          </div>
          <span className="pill">{products.length} items</span>
        </div>

        {loading ? <p className="feedback">Loading inventory...</p> : null}

        {!loading && products.length === 0 ? (
          <div className="empty-state">
            <h4>No products yet</h4>
          </div>
        ) : null}

        <div className="stock-watch-list">
          {products.map((product) => {
            const stock = Number(product.stock) || 0;
            const isLow = stock <= 5;
            const levelWidth = Math.max(8, Math.min(100, stock * 10));
            const isEditing = editingProductId === product._id;

            return (
              <div key={product._id} className="stock-watch-row inventory-stock-row">
                <div className="stock-watch-main">
                  <div>
                    {isEditing ? (
                      <div className="inline-edit-grid">
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          placeholder="Product name"
                        />
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={editForm.sellingPrice}
                          onChange={(e) => setEditForm({ ...editForm, sellingPrice: e.target.value })}
                          placeholder="Selling price"
                        />
                      </div>
                    ) : (
                      <>
                        <h4>{product.name}</h4>
                        <p>
                          {product.unit} | Sell {formatCurrency(product.sellingPrice)}
                        </p>
                      </>
                    )}
                  </div>

                  <strong className="stock-watch-value">
                    {stock} {product.unit}
                  </strong>
                </div>

                <div className="stock-watch-meter" aria-hidden="true">
                  <div
                    className={isLow ? "stock-watch-fill low" : "stock-watch-fill"}
                    style={{ width: `${levelWidth}%` }}
                  />
                </div>

                <div className="stock-watch-meta">
                  <span className={isLow ? "pill pill-amber" : "pill pill-green"}>
                    {isLow ? "Low" : "OK"}
                  </span>
                  <div className="action-row">
                    {isEditing ? (
                      <>
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={savingProductId === product._id}
                          onClick={() => handleUpdateProduct(product._id)}
                        >
                          {savingProductId === product._id ? "Saving..." : "Save"}
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => setEditingProductId("")}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => startEditingProduct(product)}
                        >
                          Edit
                        </button>
                        <button
                          className="secondary-button danger-button"
                          type="button"
                          disabled={deletingProductId === product._id}
                          onClick={() => handleDeleteProduct(product._id)}
                        >
                          {deletingProductId === product._id ? "Deleting..." : "Delete"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default Products;
