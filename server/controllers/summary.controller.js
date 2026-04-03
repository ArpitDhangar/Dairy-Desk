const DailySummary = require("../models/DailySummary");
const Ledger = require("../models/Ledger");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const ProductPurchase = require("../models/ProductPurchase");
const { getDayRange } = require("../services/ledger.service");

function getActiveFixedProducts(customer, targetDate) {
  const target = new Date(targetDate);
  target.setHours(23, 59, 59, 999);

  const plans = Array.isArray(customer.deliveryPlans) ? [...customer.deliveryPlans] : [];
  plans.sort(
    (left, right) =>
      new Date(left.effectiveFrom).getTime() - new Date(right.effectiveFrom).getTime()
  );

  const matchingPlan = plans
    .filter((plan) => plan?.effectiveFrom && new Date(plan.effectiveFrom).getTime() <= target.getTime())
    .pop();

  if (Array.isArray(matchingPlan?.fixedProducts) && matchingPlan.fixedProducts.length) {
    return matchingPlan.fixedProducts;
  }

  if (Array.isArray(customer.fixedProducts) && customer.fixedProducts.length) {
    return customer.fixedProducts;
  }

  return [
    {
      unit: "liter",
      defaultQuantity: customer.defaultMilkQuantity,
      morningEnabled: customer.morningEnabled,
      morningQuantity: customer.morningQuantity,
      eveningEnabled: customer.eveningEnabled,
      eveningQuantity: customer.eveningQuantity,
    },
  ];
}

exports.createOrUpdateSummary = async (req, res) => {
  try {
    const {
      date,
      milkPurchased,
      purchaseCost,
      otherExpenses,
      expenseEntries,
      closingEntries,
    } = req.body;

    const ownerId = req.user.id;

    const normalizedExpenseEntries = Array.isArray(expenseEntries)
      ? expenseEntries
          .map((entry) => ({
            label: String(entry?.label || "").trim(),
            amount: Number(entry?.amount) || 0,
          }))
          .filter((entry) => entry.label && entry.amount > 0)
      : [];
    const computedOtherExpenses = normalizedExpenseEntries.length
      ? normalizedExpenseEntries.reduce((sum, entry) => sum + entry.amount, 0)
      : Number(otherExpenses) || 0;

    const existingSummary = await DailySummary.findOne({ date, owner: ownerId });
    const existingClosingMap = new Map(
      Array.isArray(existingSummary?.closingEntries)
        ? existingSummary.closingEntries.map((entry) => [String(entry.productId), entry])
        : []
    );
    const normalizedClosingEntries = Array.isArray(closingEntries)
      ? closingEntries
          .map((entry) => ({
            productId: String(entry?.productId || "").trim(),
            remainingQuantity: Number(entry?.remainingQuantity) || 0,
          }))
          .filter((entry) => entry.productId)
      : [];
    const submittedProductIds = [...new Set(normalizedClosingEntries.map((entry) => entry.productId))];
    const products = submittedProductIds.length
      ? await Product.find({ _id: { $in: submittedProductIds }, owner: ownerId })
      : [];
    const productMap = new Map(products.map((product) => [String(product._id), product]));
    const latestPurchases = submittedProductIds.length
      ? await ProductPurchase.find({ product: { $in: submittedProductIds }, owner: ownerId }).sort({
          date: -1,
          createdAt: -1,
        })
      : [];
    const latestUnitCostMap = new Map();

    latestPurchases.forEach((purchase) => {
      const productId = String(purchase.product);
      if (!latestUnitCostMap.has(productId)) {
        const quantity = Number(purchase.quantity) || 0;
        const fallbackUnitCost = quantity > 0 ? (Number(purchase.cost) || 0) / quantity : 0;
        latestUnitCostMap.set(productId, Number(purchase.unitCost) || fallbackUnitCost || 0);
      }
    });

    const computedClosingEntries = [];

    for (const entry of normalizedClosingEntries) {
      const product = productMap.get(entry.productId);

      if (!product) {
        continue;
      }

      const previousEntry = existingClosingMap.get(entry.productId);
      const startingQuantity = previousEntry
        ? Number(previousEntry.startingQuantity) || 0
        : Number(product.stock) || 0;
      const remainingQuantity = Number(entry.remainingQuantity) || 0;
      const soldQuantity = Math.max(startingQuantity - remainingQuantity, 0);
      const unitPrice = Number(product.sellingPrice) || 0;
      const unitCost = Number(latestUnitCostMap.get(entry.productId)) || 0;
      const saleAmount = Number((soldQuantity * unitPrice).toFixed(2));
      const costAmount = Number((soldQuantity * unitCost).toFixed(2));

      product.stock = remainingQuantity;
      await product.save();

      computedClosingEntries.push({
        productId: product._id,
        productName: product.name,
        unit: product.unit || "unit",
        startingQuantity,
        remainingQuantity,
        soldQuantity,
        unitPrice,
        unitCost,
        saleAmount,
        costAmount,
      });
    }

    const summary = await DailySummary.findOneAndUpdate(
      { date, owner: ownerId },
      {
        owner: ownerId,
        milkPurchased,
        purchaseCost,
        otherExpenses: computedOtherExpenses,
        expenseEntries: normalizedExpenseEntries,
        closingEntries: computedClosingEntries,
      },
      { new: true, upsert: true }
    );

    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDailySummary = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const requestedDate = new Date(req.params.date);
    const { start, end } = getDayRange(requestedDate);

    const [summary, ledgerEntries, customers, products, recentEntries, purchases] =
      await Promise.all([
        DailySummary.findOne({ date: start, owner: ownerId }),
        Ledger.find({ owner: ownerId, date: { $gte: start, $lte: end } }),
        Customer.find({ owner: ownerId }).sort({ balance: -1 }),
        Product.find({ owner: ownerId }).sort({ stock: 1, name: 1 }),
        Ledger.find({ owner: ownerId })
          .populate("customer", "name phone")
          .sort({ date: -1 })
          .limit(6),
        ProductPurchase.find({ owner: ownerId })
          .populate("product", "name unit")
          .sort({ date: -1, createdAt: -1 }),
      ]);

    let totalSales = 0;
    let totalCollection = 0;
    let milkSold = 0;

    ledgerEntries.forEach((entry) => {
      if (entry.type === "debit") totalSales += entry.amount;
      if (entry.type === "credit") totalCollection += entry.amount;
      if (entry.type === "debit" && entry.quantity) {
        milkSold += entry.quantity;
      }
    });

    const closingEntryMap = new Map(
      Array.isArray(summary?.closingEntries)
        ? summary.closingEntries.map((entry) => [String(entry.productId), entry])
        : []
    );
    const latestUnitCostMap = new Map();

    purchases.forEach((purchase) => {
      const productId = String(purchase.product?._id || purchase.product || "");
      if (productId && !latestUnitCostMap.has(productId)) {
        const quantity = Number(purchase.quantity) || 0;
        const fallbackUnitCost = quantity > 0 ? (Number(purchase.cost) || 0) / quantity : 0;
        latestUnitCostMap.set(productId, Number(purchase.unitCost) || fallbackUnitCost || 0);
      }
    });

    const closingEntries = products
      .filter(
        (product) =>
          Number(product.stock) > 0 || closingEntryMap.has(String(product._id))
      )
      .map((product) => {
        const savedEntry = closingEntryMap.get(String(product._id));

        if (savedEntry) {
          return savedEntry;
        }

        const startingQuantity = Number(product.stock) || 0;

        return {
          productId: product._id,
          productName: product.name,
          unit: product.unit || "unit",
          startingQuantity,
          remainingQuantity: startingQuantity,
          soldQuantity: 0,
          unitPrice: Number(product.sellingPrice) || 0,
          unitCost: Number(latestUnitCostMap.get(String(product._id))) || 0,
          saleAmount: 0,
          costAmount: 0,
        };
      });

    const inventorySales = closingEntries.reduce(
      (sum, entry) => sum + (Number(entry.saleAmount) || 0),
      0
    );
    const inventoryCost = closingEntries.reduce(
      (sum, entry) => sum + (Number(entry.costAmount) || 0),
      0
    );

    totalSales += inventorySales;

    const profit =
      totalSales -
      inventoryCost -
      (summary?.purchaseCost || 0) -
      (summary?.otherExpenses || 0);

    const outstandingBalance = customers.reduce(
      (sum, customer) => sum + (Number(customer.balance) || 0),
      0
    );
    const customersWithBalance = customers.filter(
      (customer) => Number(customer.balance) > 0
    );
    const monthlyCustomers = customers.filter(
      (customer) => customer.paymentType === "monthly"
    ).length;
    const dailyCustomers = customers.length - monthlyCustomers;
    const deliveryCustomers = customers.filter(
      (customer) => customer.isDeliveryCustomer !== false
    );
    const expectedMorningLiters = deliveryCustomers.reduce((sum, customer) => {
      return (
        sum +
        getActiveFixedProducts(customer, requestedDate).reduce((slotSum, product) => {
          const unit = String(product.unit || "").toLowerCase();
          if (unit !== "liter" && unit !== "litre" && unit !== "l") return slotSum;
          if (!product.morningEnabled) return slotSum;
          return slotSum + (Number(product.morningQuantity ?? product.defaultQuantity) || 0);
        }, 0)
      );
    }, 0);
    const expectedEveningLiters = deliveryCustomers.reduce((sum, customer) => {
      return (
        sum +
        getActiveFixedProducts(customer, requestedDate).reduce((slotSum, product) => {
          const unit = String(product.unit || "").toLowerCase();
          if (unit !== "liter" && unit !== "litre" && unit !== "l") return slotSum;
          if (!product.eveningEnabled) return slotSum;
          return slotSum + (Number(product.eveningQuantity) || 0);
        }, 0)
      );
    }, 0);

    const lowStockProducts = products
      .filter((product) => Number(product.stock) <= 5)
      .slice(0, 5);
    const purchaseDueAmount = purchases.reduce((sum, purchase) => {
      const cost = Number(purchase.cost) || 0;
      const amountPaid = Math.min(Number(purchase.amountPaid) || 0, cost);
      return sum + Math.max(cost - amountPaid, 0);
    }, 0);

    res.json({
      date: start,
      milkPurchased: summary?.milkPurchased || 0,
      purchaseCost: summary?.purchaseCost || 0,
      otherExpenses: summary?.otherExpenses || 0,
      totalSales,
      totalCollection,
      profit,
      milkSold,
      customerCount: customers.length,
      deliveryCustomerCount: deliveryCustomers.length,
      monthlyCustomers,
      dailyCustomers,
      customersWithBalanceCount: customersWithBalance.length,
      outstandingBalance,
      purchaseDueAmount,
      expectedMorningLiters,
      expectedEveningLiters,
      expectedTotalLiters: expectedMorningLiters + expectedEveningLiters,
      lowStockProducts,
      productCount: products.length,
      expenseEntries: summary?.expenseEntries || [],
      closingEntries,
      inventorySales,
      inventoryCost,
      topDueCustomers: customersWithBalance.slice(0, 5).map((customer) => ({
        _id: customer._id,
        name: customer.name,
        phone: customer.phone,
        balance: customer.balance,
        paymentType: customer.paymentType,
      })),
      recentActivity: recentEntries.map((entry) => ({
        _id: entry._id,
        customerName: entry.customer?.name || "Unknown customer",
        customerPhone: entry.customer?.phone || "",
        type: entry.type,
        amount: entry.amount,
        description: entry.description,
        date: entry.date,
      })),
      recentPurchases: purchases.map((purchase) => {
        const cost = Number(purchase.cost) || 0;
        const amountPaid = Math.min(Number(purchase.amountPaid) || 0, cost);
        return {
          _id: purchase._id,
          productName: purchase.product?.name || "Product",
          unit: purchase.product?.unit || "",
          quantity: purchase.quantity,
          cost,
          amountPaid,
          pendingAmount: Math.max(cost - amountPaid, 0),
          supplierName: purchase.supplierName || "",
          notes: purchase.notes || "",
          date: purchase.date,
        };
      }),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
