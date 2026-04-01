const express = require("express");
const router = express.Router();
const {
  addProduct,
  updateProduct,
  deleteProduct,
  getProducts,
  addPurchase,
  getPurchases,
  addPurchasePayment,
} = require("../controllers/product.controller");

router.post("/", addProduct);
router.get("/", getProducts);
router.put("/:productId", updateProduct);
router.delete("/:productId", deleteProduct);
router.get("/purchases", getPurchases);
router.post("/purchase", addPurchase);
router.post("/purchase/:purchaseId/payment", addPurchasePayment);

module.exports = router;
