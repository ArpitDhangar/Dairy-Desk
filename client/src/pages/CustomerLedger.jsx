import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import API from "../services/api";
import {
  formatCurrency,
  formatDate,
  formatLiters,
} from "../utils/formatters";

function createFixedProductDraft(product) {
  return {
    inventoryProductId: product?._id || "",
    productName: product?.name || "",
    unit: product?.unit || "unit",
    defaultQuantity: 1,
    unitPrice: Number(product?.sellingPrice) || 0,
    morningEnabled: true,
    morningQuantity: 1,
    eveningEnabled: false,
    eveningQuantity: 0,
  };
}

function CustomerLedger() {
  const { id } = useParams();
  const today = new Date().toISOString().split("T")[0];
  const firstDayOfMonth = new Date();
  firstDayOfMonth.setDate(1);
  const firstDayOfThisMonth = firstDayOfMonth.toISOString().split("T")[0];
  const [customer, setCustomer] = useState(null);
  const [products, setProducts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("debit");
  const [description, setDescription] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [entryDate, setEntryDate] = useState(today);
  const [paymentStatus, setPaymentStatus] = useState("due");
  const [paidAmount, setPaidAmount] = useState("");
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creatingScheduled, setCreatingScheduled] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [fromDate, setFromDate] = useState(firstDayOfThisMonth);
  const [toDate, setToDate] = useState(today);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [customerUpdateToast, setCustomerUpdateToast] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [editingEntryId, setEditingEntryId] = useState("");
  const [editingEntryForm, setEditingEntryForm] = useState({
    description: "",
    productName: "",
    quantity: "",
    unitPrice: "",
    amount: "",
  });
  const [savingEntryId, setSavingEntryId] = useState("");
  const [deletingEntryId, setDeletingEntryId] = useState("");
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    name: "",
    phone: "",
    isDeliveryCustomer: true,
    paymentType: "monthly",
    fixedProducts: [],
    effectiveFrom: today,
  });

  const buildCustomerForm = (customerData, availableProducts) => {
    const fixedProducts =
      Array.isArray(customerData?.fixedProducts) && customerData.fixedProducts.length
        ? customerData.fixedProducts.map((item) => {
            const matchingProduct = availableProducts.find(
              (product) => product.name === item?.productName
            );

            return {
              inventoryProductId: matchingProduct?._id || item?.productId || "",
              productName: item?.productName || matchingProduct?.name || "",
              unit: item?.unit || matchingProduct?.unit || "unit",
              defaultQuantity: Number(item?.defaultQuantity) || 1,
              unitPrice: Number(item?.unitPrice) || 0,
              morningEnabled: item?.morningEnabled !== false,
              morningQuantity: Number(
                item?.morningQuantity ?? item?.defaultQuantity ?? 1
              ),
              eveningEnabled: item?.eveningEnabled === true,
              eveningQuantity: Number(item?.eveningQuantity) || 0,
            };
          })
        : [
            createFixedProductDraft(
              availableProducts.find(
                (product) => product.name === customerData?.fixedProductName
              )
            ),
          ];

    return {
      name: customerData?.name || "",
      phone: customerData?.phone || "",
      isDeliveryCustomer: customerData?.isDeliveryCustomer !== false,
      paymentType: customerData?.paymentType || "monthly",
      fixedProducts,
      effectiveFrom: today,
    };
  };

  const fetchLedger = async () => {
    try {
      setLoading(true);
      setError("");
      const [ledgerRes, customerRes, productsRes] = await Promise.all([
        API.get(`/ledger/${id}`),
        API.get("/customers"),
        API.get("/products"),
      ]);

      setEntries(ledgerRes.data);
      setProducts(productsRes.data);
      const currentCustomer = customerRes.data.find((item) => item._id === id);
      if (currentCustomer) {
        setCustomer(currentCustomer);
        setBalance(currentCustomer.balance);
        setCustomerForm(buildCustomerForm(currentCustomer, productsRes.data));
      }
    } catch (err) {
      setError("Could not load this customer ledger.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [id]);

  useEffect(() => {
    if (!customerUpdateToast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCustomerUpdateToast("");
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [customerUpdateToast]);

  useEffect(() => {
    if (!successToast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessToast("");
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [successToast]);

  const handleProductChange = (selectedProductId) => {
    const selectedProduct = products.find((product) => product._id === selectedProductId);

    if (!selectedProduct) {
      setProductQuery("");
      setProductName("");
      setUnitPrice("");
      return;
    }

    setProductQuery(selectedProduct.name);
    setProductName(selectedProduct.name);
    setUnitPrice(String(Number(selectedProduct.sellingPrice) || 0));
  };

  const handleCustomerProductChange = (index, selectedProductId) => {
    const selectedProduct = products.find((product) => product._id === selectedProductId);

    if (!selectedProduct) {
      setCustomerForm((current) => ({
        ...current,
        fixedProducts: current.fixedProducts.map((item, itemIndex) =>
          itemIndex === index ? { ...item, inventoryProductId: "" } : item
        ),
      }));
      return;
    }

    setCustomerForm((current) => ({
      ...current,
      fixedProducts: current.fixedProducts.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              inventoryProductId: selectedProduct._id,
              productName: selectedProduct.name,
              unit: selectedProduct.unit || "unit",
              unitPrice: Number(selectedProduct.sellingPrice) || 0,
              morningQuantity: item.morningEnabled
                ? Number(item.defaultQuantity) || 1
                : item.morningQuantity,
            }
          : item
      ),
    }));
  };

  const updateCustomerFixedProduct = (index, patch) => {
    setCustomerForm((current) => ({
      ...current,
      fixedProducts: current.fixedProducts.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    }));
  };

  const addCustomerFixedProduct = () => {
    setCustomerForm((current) => ({
      ...current,
      fixedProducts: [...current.fixedProducts, createFixedProductDraft(products[0])],
    }));
  };

  const removeCustomerFixedProduct = (index) => {
    setCustomerForm((current) => ({
      ...current,
      fixedProducts: current.fixedProducts.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();

    try {
      setSavingCustomer(true);
      setError("");
      setNotice("");
      setCustomerUpdateToast("");

      const payload =
        customerForm.isDeliveryCustomer === false
          ? {
              name: customerForm.name,
              phone: customerForm.phone,
              isDeliveryCustomer: false,
              paymentType: customerForm.paymentType || "monthly",
              effectiveFrom: customerForm.effectiveFrom,
            }
          : {
              name: customerForm.name,
              phone: customerForm.phone,
              isDeliveryCustomer: true,
              fixedProducts: customerForm.fixedProducts.map((item) => ({
                productId: item.inventoryProductId || null,
                productName: item.productName,
                unit: item.unit,
                defaultQuantity: Number(item.defaultQuantity) || 0,
                unitPrice: Number(item.unitPrice) || 0,
                morningEnabled: item.morningEnabled,
                morningQuantity: item.morningEnabled
                  ? Number(item.morningQuantity ?? item.defaultQuantity) || 0
                  : 0,
                eveningEnabled: item.eveningEnabled,
                eveningQuantity: item.eveningEnabled
                  ? Number(item.eveningQuantity) || 0
                  : 0,
              })),
              paymentType: "monthly",
              effectiveFrom: customerForm.effectiveFrom,
            };

      const res = await API.put(`/customers/${id}`, payload);
      setCustomer(res.data);
      setBalance(res.data.balance || 0);
      setCustomerForm(buildCustomerForm(res.data, products));
      setEditingCustomer(false);
      setCustomerUpdateToast("Customer updated successfully.");
    } catch (err) {
      setError(err?.response?.data?.message || "Customer could not be updated.");
      console.error(err);
    } finally {
      setSavingCustomer(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const query = productQuery.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return product.name.toLowerCase().includes(query);
  });

  const handleAddEntry = async () => {
    const normalizedQuantity = Number(quantity) || 0;
    const normalizedUnitPrice = Number(unitPrice) || 0;
    const isDebit = type === "debit";
    const computedAmount =
      isDebit && normalizedQuantity > 0 && normalizedUnitPrice > 0
        ? normalizedQuantity * normalizedUnitPrice
        : Number(amount) || 0;

    if (!computedAmount) {
      setError("Enter an amount before adding an entry.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setNotice("");
      await API.post("/ledger", {
        customer: id,
        type,
        amount: computedAmount,
        productName: isDebit ? productName.trim() : "",
        quantity: isDebit ? normalizedQuantity : 0,
        unitPrice: isDebit ? normalizedUnitPrice : 0,
        date: entryDate,
        description:
          description.trim() ||
          (type === "debit"
            ? productName.trim() || "Item given"
            : "Payment received"),
      });

      if (isDebit) {
        const normalizedPaidAmount =
          paymentStatus === "paid"
            ? computedAmount
            : paymentStatus === "partial"
            ? Math.min(Number(paidAmount) || 0, computedAmount)
            : 0;

        if (normalizedPaidAmount > 0) {
          await API.post("/ledger", {
            customer: id,
            type: "credit",
            amount: normalizedPaidAmount,
            description:
              paymentStatus === "paid"
                ? `Payment received for ${productName.trim() || "item"}`
                : `Partial payment received for ${productName.trim() || "item"}`,
            date: entryDate,
          });
        }
      }

      setAmount("");
      setDescription("");
      setProductQuery("");
      setProductName("");
      setQuantity("");
      setUnitPrice("");
      setEntryDate(today);
      setPaymentStatus("due");
      setPaidAmount("");
      fetchLedger();
    } catch (err) {
      setError("Entry could not be saved.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateScheduledEntries = async () => {
    try {
      setCreatingScheduled(true);
      setError("");
      setNotice("");
      setSuccessToast("");
      const res = await API.post(`/ledger/${id}/scheduled`);
      setSuccessToast(
        res.data.createdCount
          ? `${res.data.createdCount} fixed entr${
              res.data.createdCount === 1 ? "y was" : "ies were"
            } added for today.`
          : "No new fixed entries were added because today's records already exist or the slot is off."
      );
      fetchLedger();
    } catch (err) {
      setError("Fixed entries could not be created.");
      console.error(err);
    } finally {
      setCreatingScheduled(false);
    }
  };

  const startEditingEntry = (entry) => {
    setEditingEntryId(entry._id);
    setEditingEntryForm({
      description: entry.description || "",
      productName: entry.productName || "",
      quantity: entry.quantity ? String(entry.quantity) : "",
      unitPrice: entry.unitPrice ? String(entry.unitPrice) : "",
      amount: String(entry.amount || ""),
    });
  };

  const handleSaveEntry = async (entry) => {
    const normalizedQuantity = Number(editingEntryForm.quantity) || 0;
    const normalizedUnitPrice = Number(editingEntryForm.unitPrice) || 0;
    const computedAmount =
      entry.type === "debit" && normalizedQuantity > 0 && normalizedUnitPrice > 0
        ? normalizedQuantity * normalizedUnitPrice
        : Number(editingEntryForm.amount) || 0;

    if (!computedAmount) {
      setError("Enter an amount before saving the entry.");
      return;
    }

    try {
      setSavingEntryId(entry._id);
      setError("");
      setNotice("");
      setSuccessToast("");
      await API.put(`/ledger/entry/${entry._id}`, {
        type: entry.type,
        amount: computedAmount,
        description: editingEntryForm.description,
        productName: editingEntryForm.productName,
        quantity: normalizedQuantity,
        unitPrice: normalizedUnitPrice,
        date: entry.date,
      });
      setEditingEntryId("");
      setSuccessToast("Entry updated successfully.");
      fetchLedger();
    } catch (err) {
      setError(err?.response?.data?.message || "Entry could not be updated.");
      console.error(err);
    } finally {
      setSavingEntryId("");
    }
  };

  const handleDeleteEntry = async (entryId) => {
    try {
      setDeletingEntryId(entryId);
      setError("");
      setNotice("");
      setSuccessToast("");
      await API.delete(`/ledger/entry/${entryId}`);
      if (editingEntryId === entryId) {
        setEditingEntryId("");
      }
      setSuccessToast("Entry deleted successfully.");
      fetchLedger();
    } catch (err) {
      setError(err?.response?.data?.message || "Entry could not be deleted.");
      console.error(err);
    } finally {
      setDeletingEntryId("");
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      setError("");
      const res = await API.get(`/ledger/${id}/pdf`, {
        params: {
          filterType,
          fromDate: filterType === "custom" ? fromDate : undefined,
          toDate: filterType === "custom" ? toDate : undefined,
        },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(res.data);
      const link = document.createElement("a");
      const customerName = (customer?.name || "customer").replace(/\s+/g, "-");
      link.href = url;
      link.download = `${customerName.toLowerCase()}-ledger.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("PDF could not be downloaded.");
      console.error(err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const filteredEntries = entries.filter((entry) => {
    const entryDateValue = new Date(entry.date);

    if (filterType === "all") {
      return true;
    }

    if (filterType === "this-month") {
      const now = new Date();
      return (
        entryDateValue.getFullYear() === now.getFullYear() &&
        entryDateValue.getMonth() === now.getMonth()
      );
    }

    if (filterType === "last-month") {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return (
        entryDateValue.getFullYear() === lastMonth.getFullYear() &&
        entryDateValue.getMonth() === lastMonth.getMonth()
      );
    }

    if (filterType === "custom") {
      const from = fromDate ? new Date(fromDate) : null;
      const to = toDate ? new Date(toDate) : null;

      if (from) {
        from.setHours(0, 0, 0, 0);
        if (entryDateValue < from) {
          return false;
        }
      }

      if (to) {
        to.setHours(23, 59, 59, 999);
        if (entryDateValue > to) {
          return false;
        }
      }
    }

    return true;
  });

  const filteredDebit = filteredEntries
    .filter((entry) => entry.type === "debit")
    .reduce((sum, entry) => sum + entry.amount, 0);

  const filteredCredit = filteredEntries
    .filter((entry) => entry.type === "credit")
    .reduce((sum, entry) => sum + entry.amount, 0);

  const filteredBalance = filteredDebit - filteredCredit;

  const balanceLabel =
    filteredBalance > 0 ? "Pending" : filteredBalance < 0 ? "Advance" : "Settled";
  const customerFixedProducts =
    Array.isArray(customer?.fixedProducts) && customer.fixedProducts.length
      ? customer.fixedProducts
      : [];

  return (
    <div className="page-stack">
      {customerUpdateToast ? (
        <p className="feedback success update-toast">{customerUpdateToast}</p>
      ) : null}
      {successToast ? <p className="feedback success update-toast">{successToast}</p> : null}

      <section className="page-header">
        <div>
          <Link to="/" className="ghost-link">
            Back to customers
          </Link>
          <p className="eyebrow">Customer ledger</p>
          <h2>{customer?.name || "Loading customer..."}</h2>
          {customer?.phone ? <p className="schedule-copy">{customer.phone}</p> : null}
        </div>

          <div className="balance-panel balance-panel-upgraded">
            <div className="balance-panel-top">
              <span>Shown balance</span>
              <span className="balance-status-pill">{balanceLabel}</span>
            </div>
            <strong>{formatCurrency(Math.abs(filteredBalance))}</strong>
            <small>{customer ? customer.paymentType : ""}</small>
            <div className="balance-breakdown">
              <div>
                <span>Items taken</span>
                <strong>{formatCurrency(filteredDebit)}</strong>
              </div>
              <div>
                <span>Payments</span>
                <strong>{formatCurrency(filteredCredit)}</strong>
              </div>
            </div>
        </div>
      </section>

      <section className="panel-card customer-edit-card">
        <div className="section-heading customer-edit-heading">
          <div>
            <p className="eyebrow">Customer profile</p>
            <h3>Edit customer</h3>
          </div>
          <button
            className="secondary-button customer-edit-toggle"
            type="button"
            onClick={() => {
              if (!editingCustomer && customer) {
                setCustomerForm(buildCustomerForm(customer, products));
              }
              setEditingCustomer((current) => !current);
            }}
          >
            {editingCustomer ? "Close" : "Edit customer"}
          </button>
        </div>

        {editingCustomer ? (
          <form className="form-grid customer-form-grid customer-edit-form" onSubmit={handleSaveCustomer}>
            <label className="field">
              <span>Name</span>
              <input
                value={customerForm.name}
                onChange={(e) =>
                  setCustomerForm({ ...customerForm, name: e.target.value })
                }
                required
              />
            </label>

            <label className="field">
              <span>Phone</span>
              <input
                value={customerForm.phone}
                onChange={(e) =>
                  setCustomerForm({ ...customerForm, phone: e.target.value })
                }
                required
              />
            </label>

            <label className="field field-full">
              <span>Customer type</span>
              <div className="segmented-control">
                <button
                  type="button"
                  className={customerForm.isDeliveryCustomer ? "segment active" : "segment"}
                  onClick={() =>
                    setCustomerForm((current) => ({
                      ...current,
                      isDeliveryCustomer: true,
                      paymentType: "monthly",
                      fixedProducts: current.fixedProducts.length
                        ? current.fixedProducts
                        : [createFixedProductDraft(products[0])],
                    }))
                  }
                >
                  Delivery
                </button>
                <button
                  type="button"
                  className={!customerForm.isDeliveryCustomer ? "segment active" : "segment"}
                  onClick={() =>
                    setCustomerForm((current) => ({
                      ...current,
                      isDeliveryCustomer: false,
                      morningEnabled: false,
                      morningQuantity: 0,
                      eveningEnabled: false,
                      eveningQuantity: 0,
                    }))
                  }
                >
                  Non-delivery
                </button>
              </div>
            </label>

            {customerForm.isDeliveryCustomer ? (
              <>
                <label className="field">
                  <span>Effective from</span>
                  <input
                    type="date"
                    value={customerForm.effectiveFrom}
                    onChange={(e) =>
                      setCustomerForm({
                        ...customerForm,
                        effectiveFrom: e.target.value,
                      })
                    }
                  />
                </label>

                <div className="field field-full fixed-products-editor">
                  <span>Fixed products</span>
                  <div className="fixed-products-stack">
                    {customerForm.fixedProducts.map((item, index) => {
                      const itemProduct =
                        products.find((product) => product._id === item.inventoryProductId) ||
                        null;
                      const itemUnit = itemProduct?.unit || item.unit || "unit";

                      return (
                        <div key={`edit-fixed-product-${index}`} className="fixed-product-card">
                          <div className="fixed-product-card-top">
                            <strong>{`Product ${index + 1}`}</strong>
                            {customerForm.fixedProducts.length > 1 ? (
                              <button
                                className="secondary-button danger-button"
                                type="button"
                                onClick={() => removeCustomerFixedProduct(index)}
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>

                          <div className="form-grid fixed-product-grid">
                            <label className="field">
                              <span>Product from inventory</span>
                              <select
                                value={item.inventoryProductId}
                                onChange={(e) =>
                                  handleCustomerProductChange(index, e.target.value)
                                }
                                disabled={!products.length}
                              >
                                {products.length === 0 ? (
                                  <option value="">Add products in inventory first</option>
                                ) : null}
                                {products.map((product) => (
                                  <option key={product._id} value={product._id}>
                                    {product.name} - {formatCurrency(product.sellingPrice)}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="field">
                              <span>{`Price per ${itemUnit}`}</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={item.unitPrice}
                                onChange={(e) =>
                                  updateCustomerFixedProduct(index, {
                                    unitPrice: Number(e.target.value),
                                  })
                                }
                              />
                            </label>

                            <label className="field field-full">
                              <span>Product</span>
                              <input
                                value={item.productName}
                                onChange={(e) =>
                                  updateCustomerFixedProduct(index, {
                                    productName: e.target.value,
                                  })
                                }
                                required
                              />
                            </label>

                            <label className="field">
                              <span>{`Default ${itemUnit} quantity`}</span>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={item.defaultQuantity}
                                onChange={(e) =>
                                  updateCustomerFixedProduct(index, {
                                    defaultQuantity: Number(e.target.value),
                                    morningQuantity: item.morningEnabled
                                      ? Number(e.target.value)
                                      : item.morningQuantity,
                                  })
                                }
                              />
                            </label>

                            <label className="field">
                              <span>Morning delivery</span>
                              <div className="segmented-control">
                                <button
                                  type="button"
                                  className={item.morningEnabled ? "segment active" : "segment"}
                                  onClick={() =>
                                    updateCustomerFixedProduct(index, {
                                      morningEnabled: true,
                                    })
                                  }
                                >
                                  Enabled
                                </button>
                                <button
                                  type="button"
                                  className={!item.morningEnabled ? "segment active" : "segment"}
                                  onClick={() =>
                                    updateCustomerFixedProduct(index, {
                                      morningEnabled: false,
                                      morningQuantity: 0,
                                    })
                                  }
                                >
                                  Off
                                </button>
                              </div>
                            </label>

                            <label className="field">
                              <span>{`Morning ${itemUnit} quantity`}</span>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={item.morningQuantity}
                                onChange={(e) =>
                                  updateCustomerFixedProduct(index, {
                                    morningQuantity: Number(e.target.value),
                                  })
                                }
                                disabled={!item.morningEnabled}
                              />
                            </label>

                            <label className="field">
                              <span>Evening delivery</span>
                              <div className="segmented-control">
                                <button
                                  type="button"
                                  className={item.eveningEnabled ? "segment active" : "segment"}
                                  onClick={() =>
                                    updateCustomerFixedProduct(index, {
                                      eveningEnabled: true,
                                    })
                                  }
                                >
                                  Enabled
                                </button>
                                <button
                                  type="button"
                                  className={!item.eveningEnabled ? "segment active" : "segment"}
                                  onClick={() =>
                                    updateCustomerFixedProduct(index, {
                                      eveningEnabled: false,
                                      eveningQuantity: 0,
                                    })
                                  }
                                >
                                  Off
                                </button>
                              </div>
                            </label>

                            <label className="field">
                              <span>{`Evening ${itemUnit} quantity`}</span>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={item.eveningQuantity}
                                onChange={(e) =>
                                  updateCustomerFixedProduct(index, {
                                    eveningQuantity: Number(e.target.value),
                                  })
                                }
                                disabled={!item.eveningEnabled}
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    className="secondary-button fixed-product-add-button"
                    type="button"
                    onClick={addCustomerFixedProduct}
                  >
                    Add fixed product
                  </button>
                </div>
              </>
            ) : null}

            <div className="action-row field-full customer-edit-actions">
              <button className="primary-button" type="submit" disabled={savingCustomer}>
                {savingCustomer ? "Saving..." : "Save customer"}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  if (customer) {
                    setCustomerForm(buildCustomerForm(customer, products));
                  }
                  setEditingCustomer(false);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : customer ? (
          <div className="customer-edit-summary">
            <span className="pill">{customer.isDeliveryCustomer === false ? "Manual account" : "Delivery account"}</span>
            {customerFixedProducts.map((item, index) => (
              <span key={`${item.productName}-${index}`} className="pill">
                {item.productName}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="ledger-grid">
        <article className="panel-card quick-entry-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Quick entry</p>
              <h3>Add a ledger movement</h3>
            </div>
            {customer ? (
              <span
                className={
                  customer.isDeliveryCustomer === false
                    ? "pill manual-account-pill"
                    : "pill"
                }
              >
                {customer.isDeliveryCustomer === false
                  ? "Manual account"
                  : `${customerFixedProducts.length} fixed product${
                      customerFixedProducts.length === 1 ? "" : "s"
                    }`}
              </span>
            ) : null}
          </div>

          <div className="action-row">
            <button
              className="secondary-button quick-entry-download desktop-download-button"
              type="button"
              disabled={downloadingPdf}
              onClick={handleDownloadPdf}
            >
              {downloadingPdf ? "Preparing PDF..." : "Download PDF"}
            </button>
          </div>

          <div className="ledger-filter-stack">
            <div className="field field-full">
              <span>Filter entries</span>
              <div className="segmented-control segmented-control-wide ledger-filter-control">
                <button
                  type="button"
                  className={filterType === "all" ? "segment active" : "segment"}
                  onClick={() => setFilterType("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={filterType === "this-month" ? "segment active" : "segment"}
                  onClick={() => setFilterType("this-month")}
                >
                  This month
                </button>
                <button
                  type="button"
                  className={filterType === "last-month" ? "segment active" : "segment"}
                  onClick={() => setFilterType("last-month")}
                >
                  Last month
                </button>
              </div>
            </div>

            <div className="field field-full">
              <button
                className={filterType === "custom" ? "secondary-button active-filter-button" : "secondary-button"}
                type="button"
                onClick={() => setFilterType("custom")}
              >
                Custom date range
              </button>
            </div>
          </div>

          {filterType === "custom" ? (
            <div className="form-grid">
              <label className="field">
                <span>From date</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </label>

              <label className="field">
                <span>To date</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </label>
            </div>
          ) : null}

          <div className="field field-full mobile-download-wrap">
            <button
              className="secondary-button quick-entry-download mobile-download-button"
              type="button"
              disabled={downloadingPdf}
              onClick={handleDownloadPdf}
            >
              {downloadingPdf ? "Preparing PDF..." : "Download PDF"}
            </button>
          </div>

          <div className="form-grid">
            <label className="field field-full">
              <span>Entry type</span>
              <div className="segmented-control">
                <button
                  type="button"
                  className={type === "debit" ? "segment active" : "segment"}
                  onClick={() => setType("debit")}
                >
                  Items given
                </button>
                <button
                  type="button"
                  className={type === "credit" ? "segment active" : "segment"}
                  onClick={() => setType("credit")}
                >
                  Payment received
                </button>
              </div>
            </label>

            <label className="field">
              <span>Date</span>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </label>

            {type === "debit" ? (
              <>
                <label className="field">
                  <span>Item</span>
                  <input
                    list="customer-ledger-products"
                    placeholder={
                      products.length ? "Type product name" : "Add products in inventory first"
                    }
                    value={productQuery}
                    onChange={(e) => {
                      setProductQuery(e.target.value);
                      const exactMatch = products.find(
                        (product) =>
                          product.name.toLowerCase() === e.target.value.trim().toLowerCase()
                      );

                      if (exactMatch) {
                        setProductName(exactMatch.name);
                        setUnitPrice(String(Number(exactMatch.sellingPrice) || 0));
                      } else {
                        setProductName("");
                        setUnitPrice("");
                      }
                    }}
                    disabled={!products.length}
                  />
                  <datalist id="customer-ledger-products">
                    {filteredProducts.map((product) => (
                      <option key={product._id} value={product.name}>
                        {product.name} - {formatCurrency(product.sellingPrice)}
                      </option>
                    ))}
                  </datalist>
                </label>

                <label className="field">
                  <span>Quantity optional</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="Leave empty if not needed"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </label>

                {customer?.isDeliveryCustomer === false ? (
                  <>
                    <label className="field field-full">
                      <span>Payment status</span>
                      <div className="segmented-control segmented-control-wide">
                        <button
                          type="button"
                          className={paymentStatus === "due" ? "segment active" : "segment"}
                          onClick={() => setPaymentStatus("due")}
                        >
                          Due
                        </button>
                        <button
                          type="button"
                          className={paymentStatus === "partial" ? "segment active" : "segment"}
                          onClick={() => setPaymentStatus("partial")}
                        >
                          Partial
                        </button>
                        <button
                          type="button"
                          className={paymentStatus === "paid" ? "segment active" : "segment"}
                          onClick={() => setPaymentStatus("paid")}
                        >
                          Paid
                        </button>
                      </div>
                    </label>

                    {paymentStatus === "partial" ? (
                      <label className="field">
                        <span>Paid now</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={paidAmount}
                          onChange={(e) => setPaidAmount(e.target.value)}
                        />
                      </label>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}

            <label className="field">
              <span>{type === "debit" ? "Amount" : "Payment amount"}</span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>

            <label className="field field-full">
              <span>Description</span>
              <input
                placeholder={
                  type === "debit" ? "Extra item, unpaid item" : "UPI received"
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            {type === "debit" && quantity && unitPrice ? (
              <div className="field field-full">
                <span>Calculated amount</span>
                <div className="pill entry-preview">
                  {formatCurrency((Number(quantity) || 0) * (Number(unitPrice) || 0))}
                </div>
              </div>
            ) : null}

            <button
              className="primary-button field-full"
              type="button"
              disabled={submitting}
              onClick={handleAddEntry}
            >
              {submitting ? "Saving..." : "Add entry"}
            </button>
          </div>

          {error ? <p className="feedback error">{error}</p> : null}
        </article>

        <article className="panel-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">History</p>
              <h3>Recent movements</h3>
            </div>
            <span className="pill">{filteredEntries.length} entries</span>
          </div>

          {loading ? <p className="feedback">Loading ledger...</p> : null}

          {!loading && filteredEntries.length === 0 ? (
            <div className="empty-state">
              <h4>{entries.length === 0 ? "No ledger entries yet" : "No entries in this filter"}</h4>
            </div>
          ) : null}

          <div className="ledger-list">
            {filteredEntries.map((entry) => (
              <div key={entry._id} className="ledger-item">
                <div className="ledger-icon">
                  {entry.type === "debit" ? "DR" : "CR"}
                </div>
                <div className="ledger-copy">
                  {editingEntryId === entry._id ? (
                    <div className="inline-edit-grid ledger-edit-shell">
                      <div className="ledger-edit-header">
                        <strong>Edit entry</strong>
                        <span className="pill">
                          {entry.deliverySlot
                            ? `${entry.deliverySlot} delivery`
                            : entry.entrySource === "scheduled"
                            ? "Scheduled"
                            : "Manual"}
                        </span>
                      </div>
                      <input
                        value={editingEntryForm.description}
                        onChange={(e) =>
                          setEditingEntryForm({
                            ...editingEntryForm,
                            description: e.target.value,
                          })
                        }
                        placeholder="Description"
                      />
                      {entry.type === "debit" ? (
                        <div className="ledger-edit-grid">
                          <input
                            value={editingEntryForm.productName}
                            onChange={(e) =>
                              setEditingEntryForm({
                                ...editingEntryForm,
                                productName: e.target.value,
                              })
                            }
                            placeholder="Item"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={editingEntryForm.quantity}
                            onChange={(e) =>
                              setEditingEntryForm({
                                ...editingEntryForm,
                                quantity: e.target.value,
                              })
                            }
                            placeholder="Quantity"
                          />
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={editingEntryForm.unitPrice}
                            onChange={(e) =>
                              setEditingEntryForm({
                                ...editingEntryForm,
                                unitPrice: e.target.value,
                            })
                          }
                          placeholder="Rate"
                        />
                        </div>
                      ) : null}
                      <input
                        className="ledger-edit-amount"
                        type="number"
                        min="0"
                        step="1"
                        value={editingEntryForm.amount}
                        onChange={(e) =>
                          setEditingEntryForm({
                            ...editingEntryForm,
                            amount: e.target.value,
                          })
                        }
                        placeholder="Amount"
                      />
                      <div className="action-row ledger-edit-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={savingEntryId === entry._id}
                          onClick={() => handleSaveEntry(entry)}
                        >
                          {savingEntryId === entry._id ? "Saving..." : "Save"}
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => setEditingEntryId("")}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="ledger-headline">
                        <div className="ledger-title-block">
                          <strong>{entry.description || "Ledger entry"}</strong>
                          <span className="ledger-date-chip">{formatDate(entry.date)}</span>
                          <div className="ledger-meta-row">
                          </div>
                        </div>
                        <div className="ledger-actions-side">
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
                          <div className="ledger-entry-actions">
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => startEditingEntry(entry)}
                            >
                              Edit
                            </button>
                            <button
                              className="secondary-button danger-button"
                              type="button"
                              disabled={deletingEntryId === entry._id}
                              onClick={() => handleDeleteEntry(entry._id)}
                            >
                              {deletingEntryId === entry._id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </div>
                      </div>
                      <p className="ledger-detail-line">
                        {entry.quantity ? (
                          <span>
                            {formatLiters(entry.quantity)}
                            {" at "}
                            {formatCurrency(entry.unitPrice || 0)}
                          </span>
                        ) : null}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

export default CustomerLedger;
