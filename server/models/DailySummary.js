const mongoose = require("mongoose");

const dailySummarySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
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
    closingEntries: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        productName: {
          type: String,
          required: true,
          trim: true,
        },
        unit: {
          type: String,
          default: "unit",
        },
        startingQuantity: {
          type: Number,
          default: 0,
          min: 0,
        },
        remainingQuantity: {
          type: Number,
          default: 0,
          min: 0,
        },
        soldQuantity: {
          type: Number,
          default: 0,
          min: 0,
        },
        unitPrice: {
          type: Number,
          default: 0,
          min: 0,
        },
        unitCost: {
          type: Number,
          default: 0,
          min: 0,
        },
        saleAmount: {
          type: Number,
          default: 0,
          min: 0,
        },
        costAmount: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
    ],
  },
  { timestamps: true }
);

// Each owner can only have one summary per date
dailySummarySchema.index({ date: 1, owner: 1 }, { unique: true });

module.exports = mongoose.model("DailySummary", dailySummarySchema);
