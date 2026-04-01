const express = require("express");
const router = express.Router();
const {
  addEntry,
  updateEntry,
  deleteEntry,
  getCustomerLedger,
  createScheduledEntries,
  downloadCustomerLedgerPdf,
} = require("../controllers/ledger.controller");

router.post("/", addEntry);
router.put("/entry/:entryId", updateEntry);
router.delete("/entry/:entryId", deleteEntry);
router.post("/:customerId/scheduled", createScheduledEntries);
router.get("/:customerId/pdf", downloadCustomerLedgerPdf);
router.get("/:customerId", getCustomerLedger);

module.exports = router;
