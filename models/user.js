const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  slackId: { type: String, required: true },
  sickLeave: { type: Number, default: 0 },
  restrictedHoliday: { type: Number, default: 0 },
  burnout: { type: Number, default: 0 },
  mensuralLeaves: { type: Number, default: 0 },
  casualLeave: { type: Number, default: 0 },
  maternityLeave: { type: Number, default: 0 },
  unpaidLeave: { type: Number, default: 0 },
  paternityLeave: { type: Number, default: 0 },
  bereavementLeave: { type: Number, default: 0 },
  wfhLeave: { type: Number, default: 0 },
  internshipLeave: { type: Number, default: 0 },
});

const User = mongoose.model("User", userSchema);

module.exports = { User };
