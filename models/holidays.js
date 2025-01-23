const mongoose = require("mongoose");

const publicHolidaySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  name: { type: String, required: true },
  description: { type: String, default: "" },
});

const PublicHoliday = mongoose.model("PublicHoliday", publicHolidaySchema);

const restrictedHolidaySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  name: { type: String, required: true },
  description: { type: String, default: "" },
});

const RestrictedHoliday = mongoose.model(
  "RestrictedHoliday",
  restrictedHolidaySchema
);

const leaveSchema = new mongoose.Schema({
  user: String,
  dates: { type: [Date], required: true },
  reason: String,
  status: { type: String, default: "Pending" },
  leaveType: { type: String, required: true },
  leaveDay: { type: String, default: "full-day" },
  leaveTime: { type: String, default: "full-day" },
});

const Leave = mongoose.model("Leave", leaveSchema);

module.exports = { PublicHoliday, RestrictedHoliday, Leave };
