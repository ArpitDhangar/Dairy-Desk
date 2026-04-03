const Customer = require("../models/Customer");

function normalizeEffectiveFrom(value) {
  const date = value ? new Date(value) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function normalizeFixedProducts(inputProducts = []) {
  const source = Array.isArray(inputProducts) ? inputProducts : [];

  const normalized = source
    .map((item) => ({
      productId: item?.productId || item?.inventoryProductId || null,
      productName: String(
        item?.productName || item?.fixedProductName || item?.name || "Milk"
      ).trim(),
      unit: String(item?.unit || "liter").trim() || "liter",
      defaultQuantity: Number(item?.defaultQuantity ?? item?.defaultMilkQuantity) || 0,
      unitPrice: Number(item?.unitPrice ?? item?.pricePerLiter) || 0,
      morningEnabled: item?.morningEnabled !== false,
      morningQuantity:
        item?.morningEnabled === false
          ? 0
          : Number(item?.morningQuantity ?? item?.defaultQuantity ?? item?.defaultMilkQuantity) || 0,
      eveningEnabled: item?.eveningEnabled === true,
      eveningQuantity: item?.eveningEnabled === true ? Number(item?.eveningQuantity) || 0 : 0,
    }))
    .filter((item) => item.productName);

  if (normalized.length > 0) {
    return normalized;
  }

  return [
    {
      productId: null,
      productName: String(inputProducts?.fixedProductName || "Milk").trim() || "Milk",
      unit: String(inputProducts?.unit || "liter").trim() || "liter",
      defaultQuantity: Number(inputProducts?.defaultMilkQuantity) || 0,
      unitPrice: Number(inputProducts?.pricePerLiter) || 0,
      morningEnabled: inputProducts?.morningEnabled !== false,
      morningQuantity:
        inputProducts?.morningEnabled === false
          ? 0
          : Number(
              inputProducts?.morningQuantity ?? inputProducts?.defaultMilkQuantity
            ) || 0,
      eveningEnabled: inputProducts?.eveningEnabled === true,
      eveningQuantity:
        inputProducts?.eveningEnabled === true ? Number(inputProducts?.eveningQuantity) || 0 : 0,
    },
  ];
}

function applyPrimaryFixedProduct(normalized, fixedProducts) {
  const primaryProduct = fixedProducts[0];

  normalized.fixedProducts = fixedProducts;
  normalized.fixedProductName = primaryProduct?.productName || "Milk";
  normalized.defaultMilkQuantity = Number(primaryProduct?.defaultQuantity) || 0;
  normalized.pricePerLiter = Number(primaryProduct?.unitPrice) || 0;
  normalized.morningEnabled = primaryProduct?.morningEnabled !== false;
  normalized.morningQuantity =
    primaryProduct?.morningEnabled === false
      ? 0
      : Number(primaryProduct?.morningQuantity ?? primaryProduct?.defaultQuantity) || 0;
  normalized.eveningEnabled = primaryProduct?.eveningEnabled === true;
  normalized.eveningQuantity =
    primaryProduct?.eveningEnabled === true ? Number(primaryProduct?.eveningQuantity) || 0 : 0;
}

const normalizeCustomerPayload = (payload) => {
  const normalized = { ...payload };

  if (normalized.isDeliveryCustomer === false) {
    normalized.defaultMilkQuantity = 0;
    normalized.fixedProductName = normalized.fixedProductName || "Item";
    normalized.morningEnabled = false;
    normalized.morningQuantity = 0;
    normalized.eveningEnabled = false;
    normalized.eveningQuantity = 0;
    normalized.pricePerLiter = Number(normalized.pricePerLiter) || 0;
    normalized.fixedProducts = [];
  } else {
    normalized.paymentType = "monthly";
    const fixedProducts = normalizeFixedProducts(payload.fixedProducts || payload);
    applyPrimaryFixedProduct(normalized, fixedProducts);
  }

  delete normalized.inventoryProductId;

  return normalized;
};

function buildDeliveryPlan(payload) {
  const fixedProducts = normalizeFixedProducts(payload.fixedProducts || payload);
  const primaryProduct = fixedProducts[0];

  return {
    effectiveFrom: normalizeEffectiveFrom(payload.effectiveFrom),
    fixedProducts,
    fixedProductName: primaryProduct?.productName || "Milk",
    defaultMilkQuantity: Number(primaryProduct?.defaultQuantity) || 0,
    pricePerLiter: Number(primaryProduct?.unitPrice) || 0,
    morningEnabled: primaryProduct?.morningEnabled !== false,
    morningQuantity:
      primaryProduct?.morningEnabled === false
        ? 0
        : Number(primaryProduct?.morningQuantity ?? primaryProduct?.defaultQuantity) || 0,
    eveningEnabled: primaryProduct?.eveningEnabled === true,
    eveningQuantity:
      primaryProduct?.eveningEnabled === true ? Number(primaryProduct?.eveningQuantity) || 0 : 0,
  };
}

function mergeDeliveryPlan(customer, payload) {
  const nextPlan = buildDeliveryPlan(payload);
  const existingPlans = Array.isArray(customer.deliveryPlans)
    ? [...customer.deliveryPlans]
    : [];
  const effectiveTime = nextPlan.effectiveFrom.getTime();
  const planIndex = existingPlans.findIndex(
    (plan) => new Date(plan.effectiveFrom).getTime() === effectiveTime
  );

  if (planIndex >= 0) {
    existingPlans[planIndex] = nextPlan;
  } else {
    existingPlans.push(nextPlan);
  }

  existingPlans.sort(
    (left, right) => new Date(left.effectiveFrom).getTime() - new Date(right.effectiveFrom).getTime()
  );

  return existingPlans;
}

// Add Customer
exports.addCustomer = async (req, res) => {
  try {
    const payload = normalizeCustomerPayload(req.body);
    if (payload.isDeliveryCustomer !== false) {
      payload.deliveryPlans = [buildDeliveryPlan(req.body)];
    }
    payload.owner = req.user.id;
    const customer = await Customer.create(payload);
    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Customers
exports.getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Customer
exports.updateCustomer = async (req, res) => {
  try {
    const existingCustomer = await Customer.findOne({ _id: req.params.id, owner: req.user.id });

    if (!existingCustomer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const payload = normalizeCustomerPayload(req.body);

    if (payload.isDeliveryCustomer === false) {
      payload.deliveryPlans = [];
    } else {
      payload.deliveryPlans = mergeDeliveryPlan(existingCustomer, req.body);
    }

    const customer = await Customer.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
