const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    isDeliveryCustomer: {
      type: Boolean,
      default: true,
    },
    defaultMilkQuantity: {
      type: Number,
      required: true,
      default: 1,
    },
    pricePerLiter: {
      type: Number,
      required: true,
      default: 60,
    },
    paymentType: {
      type: String,
      enum: ["monthly", "daily"],
      default: "monthly",
    },
    fixedProductName: {
      type: String,
      default: "Milk",
      trim: true,
    },
    morningEnabled: {
      type: Boolean,
      default: true,
    },
    morningQuantity: {
      type: Number,
      default: 1,
      min: 0,
    },
    eveningEnabled: {
      type: Boolean,
      default: false,
    },
    eveningQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    balance: {
      type: Number,
      default: 0,
    },
    fixedProducts: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          default: null,
        },
        productName: {
          type: String,
          default: "Milk",
          trim: true,
        },
        unit: {
          type: String,
          default: "liter",
          trim: true,
        },
        defaultQuantity: {
          type: Number,
          default: 1,
        },
        unitPrice: {
          type: Number,
          default: 0,
        },
        morningEnabled: {
          type: Boolean,
          default: true,
        },
        morningQuantity: {
          type: Number,
          default: 1,
          min: 0,
        },
        eveningEnabled: {
          type: Boolean,
          default: false,
        },
        eveningQuantity: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
    ],
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deliveryPlans: [
      {
        effectiveFrom: {
          type: Date,
          required: true,
        },
        fixedProducts: [
          {
            productId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Product",
              default: null,
            },
            productName: {
              type: String,
              default: "Milk",
              trim: true,
            },
            unit: {
              type: String,
              default: "liter",
              trim: true,
            },
            defaultQuantity: {
              type: Number,
              default: 1,
            },
            unitPrice: {
              type: Number,
              default: 0,
            },
            morningEnabled: {
              type: Boolean,
              default: true,
            },
            morningQuantity: {
              type: Number,
              default: 1,
              min: 0,
            },
            eveningEnabled: {
              type: Boolean,
              default: false,
            },
            eveningQuantity: {
              type: Number,
              default: 0,
              min: 0,
            },
          },
        ],
        fixedProductName: {
          type: String,
          default: "Milk",
          trim: true,
        },
        defaultMilkQuantity: {
          type: Number,
          default: 1,
        },
        pricePerLiter: {
          type: Number,
          default: 0,
        },
        morningEnabled: {
          type: Boolean,
          default: true,
        },
        morningQuantity: {
          type: Number,
          default: 1,
          min: 0,
        },
        eveningEnabled: {
          type: Boolean,
          default: false,
        },
        eveningQuantity: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Customer", customerSchema);
