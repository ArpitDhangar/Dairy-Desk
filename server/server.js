const express = require("express");
const cors = require("cors");
require("dotenv").config();
const customerRoutes = require("./routes/customer.routes");
const ledgerRoutes = require("./routes/ledger.routes");
const summaryRoutes = require("./routes/summary.routes");
const startAutoMilkEntry = require("./services/autoEntry.service");
const productRoutes = require("./routes/product.routes");

const connectDB = require("./config/db");
        
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/customers", customerRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/summary", summaryRoutes);
app.use("/api/products", productRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("Dairy Management API Running...");
});

// Connect database
connectDB();
startAutoMilkEntry();


// Start server
app.listen(5000, () => {
  console.log("Server running on port 5000");
});
