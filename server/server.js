const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const authRoutes = require("./routes/auth.routes");
const customerRoutes = require("./routes/customer.routes");
const ledgerRoutes = require("./routes/ledger.routes");
const summaryRoutes = require("./routes/summary.routes");
const startAutoMilkEntry = require("./services/autoEntry.service");
const productRoutes = require("./routes/product.routes");
const authMiddleware = require("./middleware/auth");

const connectDB = require("./config/db");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "*",
}));
app.use(express.json());

// Public routes
app.use("/api/auth", authRoutes);

// Protected routes — every request must carry a valid JWT
app.use("/api/customers", authMiddleware, customerRoutes);
app.use("/api/ledger", authMiddleware, ledgerRoutes);
app.use("/api/summary", authMiddleware, summaryRoutes);
app.use("/api/products", authMiddleware, productRoutes);

app.get("/", (req, res) => {
  res.send("Dairy Management API Running...");
});

connectDB();
startAutoMilkEntry();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
