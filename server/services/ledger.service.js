const Customer = require("../models/Customer");
const Ledger = require("../models/Ledger");

function getBalanceImpact(type, amount) {
  const normalizedAmount = Number(amount) || 0;
  return type === "debit" ? normalizedAmount : -normalizedAmount;
}

async function createLedgerEntry({
  customerId,
  owner,
  type,
  amount,
  description,
  productName = "",
  quantity = 0,
  unitPrice = 0,
  entrySource = "manual",
  deliverySlot = null,
  date = new Date(),
}) {
  const customer = await Customer.findById(customerId);

  if (!customer) {
    throw new Error("Customer not found");
  }

  const normalizedAmount = Number(amount) || 0;

  const entry = await Ledger.create({
    customer: customerId,
    owner: owner || customer.owner,
    type,
    amount: normalizedAmount,
    description,
    productName,
    quantity,
    unitPrice,
    entrySource,
    deliverySlot,
    date,
  });

  customer.balance += getBalanceImpact(type, normalizedAmount);

  await customer.save();

  return entry;
}

async function updateLedgerEntry(entryId, ownerId, updates) {
  const entry = await Ledger.findOne({ _id: entryId, owner: ownerId });

  if (!entry) {
    throw new Error("Ledger entry not found");
  }

  const customer = await Customer.findById(entry.customer);

  if (!customer) {
    throw new Error("Customer not found");
  }

  const oldImpact = getBalanceImpact(entry.type, entry.amount);
  const nextType = updates.type || entry.type;
  const nextAmount = Number(updates.amount ?? entry.amount) || 0;

  entry.type = nextType;
  entry.amount = nextAmount;
  entry.description = updates.description ?? entry.description;
  entry.productName = updates.productName ?? entry.productName;
  entry.quantity = Number(updates.quantity ?? entry.quantity) || 0;
  entry.unitPrice = Number(updates.unitPrice ?? entry.unitPrice) || 0;
  entry.date = updates.date ? new Date(updates.date) : entry.date;

  const newImpact = getBalanceImpact(entry.type, entry.amount);
  customer.balance += newImpact - oldImpact;

  await entry.save();
  await customer.save();

  return entry;
}

async function deleteLedgerEntry(entryId, ownerId) {
  const entry = await Ledger.findOne({ _id: entryId, owner: ownerId });

  if (!entry) {
    throw new Error("Ledger entry not found");
  }

  const customer = await Customer.findById(entry.customer);

  if (!customer) {
    throw new Error("Customer not found");
  }

  customer.balance -= getBalanceImpact(entry.type, entry.amount);

  await customer.save();
  await entry.deleteOne();
}

function getDayRange(targetDate = new Date()) {
  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(targetDate);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function getEffectiveDeliveryPlan(customer, targetDate = new Date()) {
  const target = new Date(targetDate);
  target.setHours(23, 59, 59, 999);

  const deliveryPlans = Array.isArray(customer.deliveryPlans)
    ? customer.deliveryPlans
        .filter((plan) => plan?.effectiveFrom)
        .sort(
          (left, right) =>
            new Date(left.effectiveFrom).getTime() - new Date(right.effectiveFrom).getTime()
        )
    : [];

  const matchingPlan = deliveryPlans
    .filter((plan) => new Date(plan.effectiveFrom).getTime() <= target.getTime())
    .pop();

  if (matchingPlan) {
    return matchingPlan;
  }

  return {
    fixedProducts: Array.isArray(customer.fixedProducts) ? customer.fixedProducts : [],
    fixedProductName: customer.fixedProductName,
    defaultMilkQuantity: customer.defaultMilkQuantity,
    pricePerLiter: customer.pricePerLiter,
    morningEnabled: customer.morningEnabled,
    morningQuantity: customer.morningQuantity,
    eveningEnabled: customer.eveningEnabled,
    eveningQuantity: customer.eveningQuantity,
  };
}

function getFixedProductsForPlan(customer, targetDate = new Date()) {
  const effectivePlan = getEffectiveDeliveryPlan(customer, targetDate);
  const planProducts = Array.isArray(effectivePlan.fixedProducts)
    ? effectivePlan.fixedProducts
    : [];

  if (planProducts.length > 0) {
    return planProducts;
  }

  return [
    {
      productName: effectivePlan.fixedProductName || customer.fixedProductName || "Milk",
      unit: "liter",
      defaultQuantity: effectivePlan.defaultMilkQuantity ?? customer.defaultMilkQuantity ?? 0,
      unitPrice: effectivePlan.pricePerLiter ?? customer.pricePerLiter ?? 0,
      morningEnabled: effectivePlan.morningEnabled ?? customer.morningEnabled,
      morningQuantity: effectivePlan.morningQuantity ?? customer.morningQuantity,
      eveningEnabled: effectivePlan.eveningEnabled ?? customer.eveningEnabled,
      eveningQuantity: effectivePlan.eveningQuantity ?? customer.eveningQuantity,
    },
  ];
}

function getSchedulesForSlot(customer, slot, targetDate = new Date()) {
  if (!customer.isDeliveryCustomer) {
    return [];
  }

  const fixedProducts = getFixedProductsForPlan(customer, targetDate);

  return fixedProducts
    .map((product) => {
      if (slot === "morning") {
        return {
          slot,
          enabled: product.morningEnabled,
          quantity: product.morningQuantity ?? product.defaultQuantity ?? 0,
          unitPrice: Number(product.unitPrice) || 0,
          productName: product.productName || "Milk",
          unit: product.unit || "unit",
        };
      }

      if (slot === "evening") {
        return {
          slot,
          enabled: product.eveningEnabled,
          quantity: product.eveningQuantity ?? 0,
          unitPrice: Number(product.unitPrice) || 0,
          productName: product.productName || "Milk",
          unit: product.unit || "unit",
        };
      }

      return null;
    })
    .filter(Boolean);
}

async function createScheduledEntryForCustomer(customer, slot, targetDate = new Date()) {
  const schedules = getSchedulesForSlot(customer, slot, targetDate);
  const { start, end } = getDayRange(targetDate);
  const results = [];

  for (const schedule of schedules) {
    if (!schedule.enabled || schedule.quantity <= 0) {
      results.push({ status: "skipped", reason: "slot-disabled", productName: schedule.productName });
      continue;
    }

    const existingEntry = await Ledger.findOne({
      customer: customer._id,
      owner: customer.owner,
      entrySource: "scheduled",
      deliverySlot: slot,
      productName: schedule.productName,
      date: { $gte: start, $lte: end },
    });

    if (existingEntry) {
      results.push({
        status: "skipped",
        reason: "already-created",
        productName: schedule.productName,
        entry: existingEntry,
      });
      continue;
    }

    const quantity = Number(schedule.quantity) || 0;
    const unitPrice = Number(schedule.unitPrice) || 0;
    const amount = quantity * unitPrice;
    const productName = schedule.productName || "Milk";
    const slotLabel = slot.charAt(0).toUpperCase() + slot.slice(1);
    const unitLabel = schedule.unit || "unit";

    const entry = await createLedgerEntry({
      customerId: customer._id,
      owner: customer.owner,
      type: "debit",
      amount,
      description: `${productName} - ${slotLabel} (${quantity} ${unitLabel})`,
      productName,
      quantity,
      unitPrice,
      entrySource: "scheduled",
      deliverySlot: slot,
      date: targetDate,
    });

    results.push({ status: "created", entry, productName });
  }

  return results;
}

async function createScheduledEntriesForCustomerId(customerId, targetDate = new Date()) {
  const customer = await Customer.findById(customerId);

  if (!customer) {
    throw new Error("Customer not found");
  }

  const results = [];

  results.push(...(await createScheduledEntryForCustomer(customer, "morning", targetDate)));
  results.push(...(await createScheduledEntryForCustomer(customer, "evening", targetDate)));

  return {
    customer,
    createdEntries: results
      .filter((result) => result.status === "created")
      .map((result) => result.entry),
    skipped: results.filter((result) => result.status === "skipped"),
  };
}

async function createScheduledEntriesForAllCustomers(slot, targetDate = new Date()) {
  const customers = await Customer.find();
  const results = [];

  for (const customer of customers) {
    results.push({
      customerId: customer._id,
      customerName: customer.name,
      ...(await createScheduledEntryForCustomer(customer, slot, targetDate)),
    });
  }

  return results;
}

module.exports = {
  createLedgerEntry,
  updateLedgerEntry,
  deleteLedgerEntry,
  createScheduledEntriesForCustomerId,
  createScheduledEntriesForAllCustomers,
  getDayRange,
};
