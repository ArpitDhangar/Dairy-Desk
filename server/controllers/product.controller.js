const Product = require("../models/Product");
const ProductPurchase = require("../models/ProductPurchase");

function normalizePurchase(purchase) {
  const cost = Number(purchase.cost) || 0;
  const amountPaid = Math.min(Number(purchase.amountPaid) || 0, cost);

  return {
    ...purchase.toObject(),
    amountPaid,
    pendingAmount: Math.max(cost - amountPaid, 0),
  };
}

// Add Product
exports.addProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { name, sellingPrice } = req.body;

    const product = await Product.findByIdAndUpdate(
      req.params.productId,
      {
        name,
        sellingPrice: Number(sellingPrice) || 0,
      },
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
    });

    if (purchaseExists) {
      return res.status(400).json({
        message: "Product cannot be deleted because purchase records exist",
      });
    }

    const product = await Product.findByIdAndDelete(req.params.productId);

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
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPurchases = async (req, res) => {
  try {
    const purchases = await ProductPurchase.find()
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
    const { product, quantity, cost, amountPaid, supplierName, notes } = req.body;
    const normalizedQuantity = Number(quantity) || 0;
    const normalizedCost = Number(cost) || 0;
    const normalizedAmountPaid = Math.min(Number(amountPaid) || 0, normalizedCost);

    const purchase = await ProductPurchase.create({
      product,
      quantity: normalizedQuantity,
      cost: normalizedCost,
      amountPaid: normalizedAmountPaid,
      supplierName: supplierName || "",
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

    const productData = await Product.findById(product);
    productData.stock += normalizedQuantity;
    await productData.save();

    res.json(normalizePurchase(purchase));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addPurchasePayment = async (req, res) => {
  try {
    const { amount, method, note, date } = req.body;
    const purchase = await ProductPurchase.findById(req.params.purchaseId).populate(
      "product",
      "name unit"
    );

    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    const normalizedAmount = Number(amount) || 0;

    if (normalizedAmount <= 0) {
      return res.status(400).json({ message: "Payment amount must be greater than 0" });
    }

    const cost = Number(purchase.cost) || 0;
    const currentPaid = Math.min(Number(purchase.amountPaid) || 0, cost);
    const pendingAmount = Math.max(cost - currentPaid, 0);

    if (normalizedAmount > pendingAmount) {
      return res
        .status(400)
        .json({ message: "Payment is greater than the pending amount" });
    }

    purchase.amountPaid = currentPaid + normalizedAmount;
    purchase.payments.push({
      amount: normalizedAmount,
      method: method || "",
      note: note || "",
      date: date ? new Date(date) : new Date(),
    });

    await purchase.save();

    res.json(normalizePurchase(purchase));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
