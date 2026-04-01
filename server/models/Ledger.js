const mongoose = require("mongoose");

const ledgerSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    type: {
      type: String,
      enum: ["debit", "credit"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
    },
    productName: {
      type: String,
      default: "",
    },
    quantity: {
      type: Number,
      default: 0,
    },
    unitPrice: {
      type: Number,
      default: 0,
    },
    entrySource: {
      type: String,
      enum: ["manual", "scheduled"],
      default: "manual",
    },
    deliverySlot: {
      type: String,
      enum: ["morning", "evening", null],
      default: null,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ledger", ledgerSchema);
