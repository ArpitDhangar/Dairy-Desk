const Product = require("../models/Product");
const ProductPurchase = require("../models/ProductPurchase");

function normalizePurchase(purchase) {
  const cost = Number(purchase.cost) || 0;
  const amountPaid = Math.min(Number(purchase.amountPaid) || 0, cost);
  const quantity = Number(purchase.quantity) || 0;
  const unitCost =
    Number(purchase.unitCost) || (quantity > 0 ? Number((cost / quantity).toFixed(2)) : 0);

  return {
    ...purchase.toObject(),
    unitCost,
    amountPaid,
    pendingAmount: Math.max(cost - amountPaid, 0),
  };
}

// Add Product
exports.addProduct = async (req, res) => {
  try {
    const product = await Product.create({ ...req.body, owner: req.user.id });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { name, sellingPrice } = req.body;

    const product = await Product.findOneAndUpdate(
      { _id: req.params.productId, owner: req.user.id },
      { name, sellingPrice: Number(sellingPrice) || 0 },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const purchaseExists = await ProductPurchase.exists({
      product: req.params.productId,
      owner: req.user.id,
    });

    if (purchaseExists) {
      return res.status(400).json({
        message: "Product cannot be deleted because purchase records exist",
      });
    }

    const product = await Product.findOneAndDelete({ _id: req.params.productId, owner: req.user.id });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Products
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find({ owner: req.user.id });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPurchases = async (req, res) => {
  try {
    const purchases = await ProductPurchase.find({ owner: req.user.id })
      .populate("product", "name unit")
      .sort({ date: -1, createdAt: -1 });

    const normalizedPurchases = purchases.map(normalizePurchase);

    res.json(normalizedPurchases);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add Purchase
exports.addPurchase = async (req, res) => {
  try {
    const { product, quantity, cost, unitCost, amountPaid, supplierName, notes } = req.body;
    const normalizedQuantity = Number(quantity) || 0;
    const normalizedUnitCost = Number(unitCost ?? cost) || 0;
    const normalizedCost = Number((normalizedQuantity * normalizedUnitCost).toFixed(2)) || 0;
    const normalizedAmountPaid = Math.min(Number(amountPaid) || 0, normalizedCost);
    const normalizedSupplierName = String(supplierName || "").trim();

    if (!normalizedSupplierName) {
      return res.status(400).json({ message: "Vendor name is required" });
    }

    const purchase = await ProductPurchase.create({
      product,
      owner: req.user.id,
      quantity: normalizedQuantity,
      cost: normalizedCost,
      unitCost: normalizedUnitCost,
      amountPaid: normalizedAmountPaid,
      supplierName: normalizedSupplierName,
      notes: notes || "",
      payments:
        normalizedAmountPaid > 0
          ? [
              {
                amount: normalizedAmountPaid,
                method: "initial",
                note: "Paid at purchase time",
                date: new Date(),
              },
            ]
          : [],
    });

    const productData = await Product.findOne({ _id: product, owner: req.user.id });
    if (productData) {
      productData.stock += normalizedQuantity;
      await productData.save();
    }

    res.json(normalizePurchase(purchase));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addPurchasePayment = async (req, res) => {
  try {
    const { amount, settledAmount, method, note, date } = req.body;
    const purchase = await ProductPurchase.findOne({
      _id: req.params.purchaseId,
      owner: req.user.id,
    }).populate("product", "name unit");

    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    const normalizedAmount = Number(amount) || 0;
    const normalizedSettledAmount = Number(settledAmount) || 0;
    const totalAppliedAmount = normalizedAmount + normalizedSettledAmount;

    if (totalAppliedAmount <= 0) {
      return res
        .status(400)
        .json({ message: "Payment amount or settle amount must be greater than 0" });
    }

    const cost = Number(purchase.cost) || 0;
    const currentPaid = Math.min(Number(purchase.amountPaid) || 0, cost);
    const pendingAmount = Math.max(cost - currentPaid, 0);

    if (totalAppliedAmount > pendingAmount) {
      return res
        .status(400)
        .json({ message: "Payment and settle amount are greater than the pending amount" });
    }

    purchase.amountPaid = currentPaid + totalAppliedAmount;

    if (normalizedAmount > 0) {
      purchase.payments.push({
        amount: normalizedAmount,
        method: method || "",
        note: note || "",
        date: date ? new Date(date) : new Date(),
      });
    }

    if (normalizedSettledAmount > 0) {
      purchase.payments.push({
        amount: normalizedSettledAmount,
        method: "settlement",
        note: note || "Settled adjustment",
        date: date ? new Date(date) : new Date(),
      });
    }

    await purchase.save();

    res.json(normalizePurchase(purchase));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addBulkPurchasePayment = async (req, res) => {
  try {
    const { purchaseIds, amount, settledAmount, method, note, date } = req.body;
    const normalizedAmount = Number(amount) || 0;
    const normalizedSettledAmount = Number(settledAmount) || 0;
    const totalAppliedAmount = normalizedAmount + normalizedSettledAmount;

    if (!Array.isArray(purchaseIds) || purchaseIds.length === 0) {
      return res.status(400).json({ message: "Choose at least one purchase" });
    }

    if (totalAppliedAmount <= 0) {
      return res
        .status(400)
        .json({ message: "Payment amount or settle amount must be greater than 0" });
    }

    const purchases = await ProductPurchase.find({
      _id: { $in: purchaseIds },
      owner: req.user.id,
    })
      .populate("product", "name unit")
      .sort({ date: 1, createdAt: 1 });

    if (!purchases.length) {
      return res.status(404).json({ message: "No matching purchases found" });
    }

    const pendingPurchases = purchases.filter((purchase) => {
      const cost = Number(purchase.cost) || 0;
      const currentPaid = Math.min(Number(purchase.amountPaid) || 0, cost);
      return Math.max(cost - currentPaid, 0) > 0;
    });

    const totalPending = pendingPurchases.reduce((sum, purchase) => {
      const cost = Number(purchase.cost) || 0;
      const currentPaid = Math.min(Number(purchase.amountPaid) || 0, cost);
      return sum + Math.max(cost - currentPaid, 0);
    }, 0);

    if (!pendingPurchases.length) {
      return res.status(400).json({ message: "Selected purchases have no pending amount" });
    }

    if (totalAppliedAmount > totalPending) {
      return res
        .status(400)
        .json({ message: "Payment and settle amount are greater than the pending amount" });
    }

    let remainingAmount = normalizedAmount;
    let remainingSettledAmount = normalizedSettledAmount;
    const updatedPurchases = [];

    for (const purchase of pendingPurchases) {
      if (remainingAmount <= 0 && remainingSettledAmount <= 0) {
        break;
      }

      const cost = Number(purchase.cost) || 0;
      const currentPaid = Math.min(Number(purchase.amountPaid) || 0, cost);
      const pendingAmount = Math.max(cost - currentPaid, 0);
      const appliedPaymentAmount = Math.min(remainingAmount, pendingAmount);
      const remainingPendingAfterPayment = pendingAmount - appliedPaymentAmount;
      const appliedSettledAmount = Math.min(
        remainingSettledAmount,
        remainingPendingAfterPayment
      );

      purchase.amountPaid = currentPaid + appliedPaymentAmount + appliedSettledAmount;

      if (appliedPaymentAmount > 0) {
        purchase.payments.push({
          amount: appliedPaymentAmount,
          method: method || "",
          note: note || "",
          date: date ? new Date(date) : new Date(),
        });
      }

      if (appliedSettledAmount > 0) {
        purchase.payments.push({
          amount: appliedSettledAmount,
          method: "settlement",
          note: note || "Settled adjustment",
          date: date ? new Date(date) : new Date(),
        });
      }

      await purchase.save();
      updatedPurchases.push(normalizePurchase(purchase));
      remainingAmount -= appliedPaymentAmount;
      remainingSettledAmount -= appliedSettledAmount;
    }

    res.json({
      message: "Vendor payment saved successfully",
      updatedPurchases,
      appliedAmount: totalAppliedAmount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
