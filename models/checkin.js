const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  user: { type: String, required: true },
  checkinTime: { type: String, required: true },
  checkoutTime: { type: String },
  date: { type: String, required: true },
});

const Attendance = mongoose.model("Attendance", attendanceSchema);

module.exports = { Attendance };
