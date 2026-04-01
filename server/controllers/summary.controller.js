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
    } = req.body;
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

    const summary = await DailySummary.findOneAndUpdate(
      { date },
      {
        milkPurchased,
        purchaseCost,
        otherExpenses: computedOtherExpenses,
        expenseEntries: normalizedExpenseEntries,
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
    const requestedDate = new Date(req.params.date);
    const { start, end } = getDayRange(requestedDate);

    const [summary, ledgerEntries, customers, products, recentEntries, purchases] =
      await Promise.all([
        DailySummary.findOne({ date: start }),
        Ledger.find({
          date: { $gte: start, $lte: end },
        }),
        Customer.find().sort({ balance: -1 }),
        Product.find().sort({ stock: 1, name: 1 }),
        Ledger.find()
          .populate("customer", "name phone")
          .sort({ date: -1 })
          .limit(6),
        ProductPurchase.find()
          .populate("product", "name unit")
          .sort({ date: -1, createdAt: -1 })
          .limit(8),
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

    const profit =
      totalSales -
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
          if (unit !== "liter" && unit !== "litre" && unit !== "l") {
            return slotSum;
          }

          if (!product.morningEnabled) {
            return slotSum;
          }

          return slotSum + (Number(product.morningQuantity ?? product.defaultQuantity) || 0);
        }, 0)
      );
    }, 0);
    const expectedEveningLiters = deliveryCustomers.reduce((sum, customer) => {
      return (
        sum +
        getActiveFixedProducts(customer, requestedDate).reduce((slotSum, product) => {
          const unit = String(product.unit || "").toLowerCase();
          if (unit !== "liter" && unit !== "litre" && unit !== "l") {
            return slotSum;
          }

          if (!product.eveningEnabled) {
            return slotSum;
          }

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
