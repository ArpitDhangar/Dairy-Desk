const express = require("express");
const router = express.Router();
const {
  addCustomer,
  getCustomers,
  updateCustomer,
} = require("../controllers/customer.controller");

router.post("/", addCustomer);
router.get("/", getCustomers);
router.put("/:id", updateCustomer);

module.exports = router;
