const mongoose = require("mongoose");

const dailySummarySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      unique: true,
    },
    milkPurchased: {
      type: Number,
      default: 0,
    },
    purchaseCost: {
      type: Number,
      default: 0,
    },
    otherExpenses: {
      type: Number,
      default: 0,
    },
    expenseEntries: [
      {
        label: {
          type: String,
          required: true,
          trim: true,
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("DailySummary", dailySummarySchema);
