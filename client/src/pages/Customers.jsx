import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import { formatCurrency, formatLiters } from "../utils/formatters";

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

function Customers() {
  const initialForm = {
    name: "",
    phone: "",
    isDeliveryCustomer: true,
    paymentType: "monthly",
    fixedProducts: [],
  };

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [form, setForm] = useState(initialForm);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError("");
      const [customersRes, productsRes] = await Promise.all([
        API.get("/customers"),
        API.get("/products"),
      ]);
      setCustomers(customersRes.data);
      setProducts(productsRes.data);
    } catch (err) {
      setError("Could not load customers right now.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
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

  useEffect(() => {
    if (!products.length) {
      return;
    }

    setForm((current) => {
      if (current.inventoryProductId) {
        return current;
      }

      const defaultProduct = products[0];

      return {
        ...current,
        fixedProducts: current.fixedProducts.length
          ? current.fixedProducts
          : [createFixedProductDraft(defaultProduct)],
      };
    });
  }, [products]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      setError("");
      setSuccessToast("");
      const payload =
        form.isDeliveryCustomer === false
          ? {
              name: form.name,
              phone: form.phone,
              isDeliveryCustomer: false,
              paymentType: form.paymentType,
            }
          : {
              ...form,
              fixedProducts: form.fixedProducts,
            };

      await API.post("/customers", payload);
      const defaultProduct = products[0];
      setForm({
        ...initialForm,
        fixedProducts: defaultProduct ? [createFixedProductDraft(defaultProduct)] : [],
      });
      setShowAddCustomer(false);
      setSuccessToast("Customer added successfully.");
      fetchCustomers();
    } catch (err) {
      setError("Customer could not be added.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const totalBalance = customers.reduce(
    (sum, customer) => sum + (customer.balance || 0),
    0
  );

  const monthlyCustomers = customers.filter(
    (customer) => customer.paymentType === "monthly"
  ).length;

  const dailyCustomers = customers.length - monthlyCustomers;
  const deliveryCustomers = customers.filter(
    (customer) => customer.isDeliveryCustomer !== false
  ).length;

  const getCustomerDailyQuantity = (customer) => {
    if (customer.isDeliveryCustomer === false) {
      return 0;
    }

    const fixedProducts = Array.isArray(customer.fixedProducts)
      ? customer.fixedProducts
      : [];

    return fixedProducts.reduce((sum, product) => {
      const unit = String(product.unit || "").toLowerCase();
      if (unit !== "liter" && unit !== "litre" && unit !== "l") {
        return sum;
      }

      const morningQuantity = product.morningEnabled
        ? Number(product.morningQuantity ?? product.defaultQuantity ?? 0)
        : 0;
      const eveningQuantity = product.eveningEnabled
        ? Number(product.eveningQuantity ?? 0)
        : 0;

      return sum + morningQuantity + eveningQuantity;
    }, 0);
  };

  const getCustomerFixedProducts = (customer) =>
    Array.isArray(customer.fixedProducts) && customer.fixedProducts.length
      ? customer.fixedProducts
      : customer.isDeliveryCustomer === false
      ? []
      : [
          {
            productName: customer.fixedProductName || "Milk",
            unit: "liter",
            defaultQuantity: customer.defaultMilkQuantity,
            unitPrice: customer.pricePerLiter,
            morningEnabled: customer.morningEnabled,
            morningQuantity: customer.morningQuantity,
            eveningEnabled: customer.eveningEnabled,
            eveningQuantity: customer.eveningQuantity,
          },
        ];

  const getCustomerFixedProductNames = (customer) =>
    getCustomerFixedProducts(customer)
      .map((product) => product.productName)
      .filter(Boolean);

  const buildSlotSummary = (customer, slot) => {
    if (customer.isDeliveryCustomer === false) {
      return slot === "morning" ? "Only manual unpaid entries" : customer.paymentType;
    }

    const items = getCustomerFixedProducts(customer)
      .filter((product) => (slot === "morning" ? product.morningEnabled : product.eveningEnabled))
      .map((product) => {
        const quantity =
          slot === "morning"
            ? Number(product.morningQuantity ?? product.defaultQuantity ?? 0)
            : Number(product.eveningQuantity ?? 0);
        return `${product.productName}: ${quantity} ${product.unit || "unit"}`;
      });

    return `${slot === "morning" ? "Morning" : "Evening"}: ${
      items.length ? items.join(", ") : "Off"
    }`;
  };

  const filteredCustomers = customers.filter((customer) => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return [
      customer.name,
      customer.phone,
      ...getCustomerFixedProductNames(customer),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const handleProductChange = (index, productId) => {
    const selectedProduct = products.find((product) => product._id === productId);

    if (!selectedProduct) {
      setForm((current) => ({
        ...current,
        fixedProducts: current.fixedProducts.map((item, itemIndex) =>
          itemIndex === index
            ? { ...item, inventoryProductId: "" }
            : item
        ),
      }));
      return;
    }

    setForm((current) => ({
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

  const updateFixedProduct = (index, patch) => {
    setForm((current) => ({
      ...current,
      fixedProducts: current.fixedProducts.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    }));
  };

  const addFixedProduct = () => {
    setForm((current) => ({
      ...current,
      fixedProducts: [
        ...current.fixedProducts,
        createFixedProductDraft(products[0]),
      ],
    }));
  };

  const removeFixedProduct = (index) => {
    setForm((current) => ({
      ...current,
      fixedProducts: current.fixedProducts.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  return (
    <div className="page-stack">
      {successToast ? <p className="feedback success update-toast">{successToast}</p> : null}

      <section className="hero-card customer-book-hero">
        <div>
          <p className="eyebrow">Customer book</p>
          <h2>Customers</h2>
        </div>

        <div className="hero-metrics customer-book-metrics">
          <div className="metric-card accent-amber">
            <span>Total customers</span>
            <strong>{customers.length}</strong>
          </div>
          <div className="metric-card accent-green">
            <span>Delivery customers</span>
            <strong>{deliveryCustomers}</strong>
          </div>
          <div className="metric-card accent-blue">
            <span>Outstanding balance</span>
            <strong>{formatCurrency(totalBalance)}</strong>
          </div>
        </div>

        <div className="action-row customer-book-actions">
          <button
            className="secondary-button customer-book-toggle"
            type="button"
            onClick={() => setShowAddCustomer((current) => !current)}
          >
            {showAddCustomer ? "Close" : "Add customer"}
          </button>
        </div>
      </section>

      {showAddCustomer ? (
        <section className="inline-form-shell customer-form-shell">
          <form className="form-grid customer-form-grid" onSubmit={handleSubmit}>
              <label className="field">
                <span>Name</span>
                <input
                  placeholder="Ravi Sharma"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </label>

              <label className="field">
                <span>Phone</span>
                <input
                  placeholder="9876543210"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                />
              </label>

              <label className="field field-full">
                <span>Customer type</span>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={form.isDeliveryCustomer ? "segment active" : "segment"}
                    onClick={() =>
                      setForm({
                        ...form,
                        isDeliveryCustomer: true,
                        paymentType: "monthly",
                        fixedProducts: form.fixedProducts.length
                          ? form.fixedProducts
                          : [createFixedProductDraft(products[0])],
                      })
                    }
                  >
                    Delivery
                  </button>
                  <button
                    type="button"
                    className={!form.isDeliveryCustomer ? "segment active" : "segment"}
                    onClick={() =>
                      setForm({
                        ...form,
                        isDeliveryCustomer: false,
                        morningEnabled: false,
                        eveningEnabled: false,
                        morningQuantity: 0,
                        eveningQuantity: 0,
                      })
                    }
                  >
                    Non-delivery
                  </button>
                </div>
              </label>

              {form.isDeliveryCustomer ? (
                <>
                  <div className="field field-full fixed-products-editor">
                    <span>Fixed products</span>
                    <div className="fixed-products-stack">
                      {form.fixedProducts.map((item, index) => {
                        const itemProduct =
                          products.find((product) => product._id === item.inventoryProductId) ||
                          null;
                        const itemUnit = itemProduct?.unit || item.unit || "unit";

                        return (
                          <div key={`new-fixed-product-${index}`} className="fixed-product-card">
                            <div className="fixed-product-card-top">
                              <strong>{`Product ${index + 1}`}</strong>
                              {form.fixedProducts.length > 1 ? (
                                <button
                                  className="secondary-button danger-button"
                                  type="button"
                                  onClick={() => removeFixedProduct(index)}
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
                                  onChange={(e) => handleProductChange(index, e.target.value)}
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
                                    updateFixedProduct(index, {
                                      unitPrice: Number(e.target.value),
                                    })
                                  }
                                />
                              </label>

                              <label className="field field-full">
                                <span>Product</span>
                                <input
                                  placeholder="Milk"
                                  value={item.productName}
                                  onChange={(e) =>
                                    updateFixedProduct(index, {
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
                                    updateFixedProduct(index, {
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
                                      updateFixedProduct(index, {
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
                                      updateFixedProduct(index, {
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
                                    updateFixedProduct(index, {
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
                                      updateFixedProduct(index, {
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
                                      updateFixedProduct(index, {
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
                                    updateFixedProduct(index, {
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
                      onClick={addFixedProduct}
                    >
                      Add fixed product
                    </button>
                  </div>
                </>
              ) : null}

              <button
                className="primary-button field-full"
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Add customer"}
              </button>
          </form>

          {error ? <p className="feedback error">{error}</p> : null}
        </section>
      ) : null}

      <section className="content-grid single-column-grid">
        <article className="panel-card customer-book-panel">
          <div className="section-heading customer-book-heading">
            <div>
              <p className="eyebrow">Households</p>
              <h3>Customer list</h3>
            </div>
            <span className="pill">{filteredCustomers.length || 0} profiles</span>
          </div>

          <div className="field customer-search customer-book-search">
            <input
              placeholder="Search customer, phone, product"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {loading ? <p className="feedback">Loading customers...</p> : null}

          {!loading && filteredCustomers.length === 0 ? (
            <div className="empty-state">
              <h4>{customers.length === 0 ? "No customers yet" : "No matching customers"}</h4>
            </div>
          ) : null}

          <div className="card-list customer-book-list">
            {filteredCustomers.map((customer) => (
              <Link
                key={customer._id}
                to={`/customer/${customer._id}`}
                className="customer-card customer-book-card"
              >
                <div className="customer-card-top">
                  <div className="customer-card-identity">
                    <h4>{customer.name}</h4>
                    <p>{customer.phone}</p>
                  </div>
                  <span
                    className={
                      customer.isDeliveryCustomer === false
                        ? "pill"
                        : customer.paymentType === "daily"
                        ? "pill pill-green"
                        : "pill"
                    }
                  >
                    {customer.isDeliveryCustomer === false
                      ? "non-delivery"
                      : customer.paymentType}
                  </span>
                </div>

                <div className="customer-stats customer-book-stats">
                  <div className="customer-stat">
                    <span>Fixed products</span>
                    <strong>
                      {customer.isDeliveryCustomer === false
                        ? "Manual items"
                        : getCustomerFixedProductNames(customer).join(", ") || "Milk"}
                    </strong>
                  </div>
                  <div className="customer-stat">
                    <span>Auto items</span>
                    <strong>
                      {customer.isDeliveryCustomer === false
                        ? "No auto"
                        : `${getCustomerFixedProducts(customer).length} fixed product${
                            getCustomerFixedProducts(customer).length === 1 ? "" : "s"
                          }`}
                    </strong>
                  </div>
                  <div className="customer-stat">
                    <span>Milk total</span>
                    <strong>
                      {customer.isDeliveryCustomer === false
                        ? "--"
                        : formatLiters(getCustomerDailyQuantity(customer))}
                    </strong>
                  </div>
                  <div className="customer-stat">
                    <span>Balance</span>
                    <strong>{formatCurrency(customer.balance)}</strong>
                  </div>
                </div>

                <div className="customer-shift-row customer-book-shifts">
                  <span className="customer-shift-chip">
                    {customer.isDeliveryCustomer === false
                      ? "Only manual unpaid entries"
                      : buildSlotSummary(customer, "morning")}
                  </span>
                  <span className="customer-shift-chip">
                    {customer.isDeliveryCustomer === false
                      ? customer.paymentType
                      : buildSlotSummary(customer, "evening")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

export default Customers;
