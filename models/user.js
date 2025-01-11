const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  sickLeave: { type: Number, default: 12 },
  restrictedHoliday: { type: Number, default: 6 },
  burnout: { type: Number, default: 6 },
  mensuralLeaves: { type: Number, default: 18 },
  casualLeave: { type: Number, default: 6 },
  maternityLeave: { type: Number, default: 91 },
  paternityLeave: { type: Number, default: 30 },
  bereavementLeave: { type: Number, default: 5 },
  wfh: { type: Number, default: 0 },
  halfSickLeave: { type: Number, default: 0 },
  halfRestrictedHoliday: { type: Number, default: 0 },
  halfBurnout: { type: Number, default: 0 },
  halfPeriodLeaves: { type: Number, default: 0 },
  halfCompensatoryLeave: { type: Number, default: 0 },
  halfCasualLeave: { type: Number, default: 0 },
  halfMaternityLeave: { type: Number, default: 0 },
  halfPaternityLeave: { type: Number, default: 0 },
});

const User = mongoose.model("User", userSchema);

module.exports = { User };
