const express = require("express");
const router = express.Router();
const {
  createOrUpdateSummary,
  getDailySummary,
} = require("../controllers/summary.controller");

router.post("/", createOrUpdateSummary);
router.get("/:date", getDailySummary);

module.exports = router;
