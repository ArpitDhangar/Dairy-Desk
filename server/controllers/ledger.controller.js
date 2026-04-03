const Ledger = require("../models/Ledger");
const Customer = require("../models/Customer");
const {
  createLedgerEntry,
  updateLedgerEntry,
  deleteLedgerEntry,
  createScheduledEntriesForCustomerId,
} = require("../services/ledger.service");
const { generateLedgerPdf } = require("../services/pdf.service");

function getDateRangeFromQuery(query) {
  const filterType = query.filterType || "all";

  if (filterType === "this-month") {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end, label: "This month" };
  }

  if (filterType === "last-month") {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end, label: "Last month" };
  }

  if (filterType === "custom") {
    const start = query.fromDate ? new Date(query.fromDate) : null;
    const end = query.toDate ? new Date(query.toDate) : null;

    if (start) {
      start.setHours(0, 0, 0, 0);
    }

    if (end) {
      end.setHours(23, 59, 59, 999);
    }

    return {
      start,
      end,
      label:
        query.fromDate || query.toDate
          ? `${query.fromDate || "Start"} to ${query.toDate || "Today"}`
          : "Custom range",
    };
  }

  return { start: null, end: null, label: "All entries" };
}

// Add Ledger Entry
exports.addEntry = async (req, res) => {
  try {
    const {
      customer,
      type,
      amount,
      description,
      productName,
      quantity,
      unitPrice,
      date,
    } = req.body;

    const entry = await createLedgerEntry({
      customerId: customer,
      owner: req.user.id,
      type,
      amount,
      description,
      productName,
      quantity,
      unitPrice,
      entrySource: "manual",
      date: date ? new Date(date) : new Date(),
    });

    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Ledger by Customer
exports.getCustomerLedger = async (req, res) => {
  try {
    const entries = await Ledger.find({
      customer: req.params.customerId,
      owner: req.user.id,
    }).sort({ date: -1 });

    res.json(entries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createScheduledEntries = async (req, res) => {
  try {
    const targetDate = req.body?.date ? new Date(req.body.date) : new Date();
    const result = await createScheduledEntriesForCustomerId(
      req.params.customerId,
      targetDate
    );

    res.json({
      message: "Scheduled entries processed",
      createdCount: result.createdEntries.length,
      createdEntries: result.createdEntries,
      skippedCount: result.skipped.length,
      skipped: result.skipped,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateEntry = async (req, res) => {
  try {
    const {
      type,
      amount,
      description,
      productName,
      quantity,
      unitPrice,
      date,
    } = req.body;

    const entry = await updateLedgerEntry(req.params.entryId, req.user.id, {
      type,
      amount,
      description,
      productName,
      quantity,
      unitPrice,
      date,
    });

    res.json(entry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteEntry = async (req, res) => {
  try {
    await deleteLedgerEntry(req.params.entryId, req.user.id);
    res.json({ message: "Ledger entry deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.downloadCustomerLedgerPdf = async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.customerId, owner: req.user.id });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const { start, end, label } = getDateRangeFromQuery(req.query);
    const ledgerQuery = { customer: customer._id, owner: req.user.id };

    if (start || end) {
      ledgerQuery.date = {};

      if (start) {
        ledgerQuery.date.$gte = start;
      }

      if (end) {
        ledgerQuery.date.$lte = end;
      }
    }

    const entries = await Ledger.find(ledgerQuery).sort({ date: -1 });

    const totalDebit = entries
      .filter((entry) => entry.type === "debit")
      .reduce((sum, entry) => sum + entry.amount, 0);

    const totalCredit = entries
      .filter((entry) => entry.type === "credit")
      .reduce((sum, entry) => sum + entry.amount, 0);

    const pdf = generateLedgerPdf({
      customer,
      entries,
      totalDebit,
      totalCredit,
      balance: totalDebit - totalCredit,
      reportLabel: label,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${customer.name.replace(/\s+/g, "-").toLowerCase()}-ledger.pdf"`
    );

    res.send(pdf);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
