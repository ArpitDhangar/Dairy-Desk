const cron = require("node-cron");
const { createScheduledEntriesForAllCustomers } = require("./ledger.service");

const startAutoMilkEntry = () => {
  const runSlot = async (slot) => {
    console.log(`Running ${slot} scheduled dairy entry...`);

    try {
      const results = await createScheduledEntriesForAllCustomers(slot, new Date());

      results.forEach((result) => {
        if (result.status === "created") {
          console.log(`${slot} entry created for ${result.customerName}`);
        }
      });
    } catch (error) {
      console.error("Auto Entry Error:", error.message);
    }
  };

  cron.schedule("0 6 * * *", () => runSlot("morning"), {
    timezone: "Asia/Kolkata",
  });

  cron.schedule("0 18 * * *", () => runSlot("evening"), {
    timezone: "Asia/Kolkata",
  });
};

module.exports = startAutoMilkEntry;
