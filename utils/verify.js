const { restrictedHolidays } = require("../mode");
const { User } = require("../models/user");
const { Leave } = require("../models/holidays");
const { publicHolidaysList } = require("../mode");

const isWeekendOrPublicHoliday = (date) => {
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const isPublicHoliday = publicHolidaysList.some(
    (holiday) => holiday.date.getTime() === date.getTime()
  );
  return isWeekend || isPublicHoliday;
};

const verifySickLeave = async (user, fromDate, toDate) => {
  const startDate = new Date(fromDate);
  const endDate = new Date(toDate);
  const currentDate = new Date();

  if (!startDate || !endDate) {
    return {
      isValid: false,
      message: "Please provide valid start and end dates",
    };
  }

  if (startDate < currentDate) {
    return {
      isValid: false,
      message: "Leave date cannot be in the past.",
    };
  }

  if (startDate > endDate) {
    return {
      isValid: false,
      message: "Start date cannot be after end date",
    };
  }

  let diffDays = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    if (!isWeekendOrPublicHoliday(d)) {
      diffDays++;
    }
  }

  let sickLeavesTaken = 0;
  try {
    const userData = await User.findOne({ slackId: user });
    if (userData) {
      sickLeavesTaken = userData.sickLeave;
    }
  } catch (err) {
    console.error(err);
    return {
      isValid: false,
      message:
        "An error occurred while fetching your leave records. Please try again later.",
    };
  }

  const totalSickLeaveLimit = 12;
  const remainingSickLeaves = totalSickLeaveLimit - sickLeavesTaken;

  if (sickLeavesTaken + diffDays > totalSickLeaveLimit) {
    return {
      isValid: false,
      message: `You have exceeded your yearly sick leave limit of ${totalSickLeaveLimit} days. You have ${remainingSickLeaves} days remaining. Please contact HR for additional support.`,
    };
  }

  if (diffDays > 3) {
    return {
      isValid: false,
      message:
        "For sick leaves exceeding 3 days, please provide either a doctor's note or proof from PlumHQ confirming your health status.",
    };
  }

  return {
    isValid: true,
    message: "Sick leave request is valid. Please inform your team lead.",
  };
};

const verifyBurnoutLeave = async (user, fromDate, toDate) => {
  const startDate = new Date(fromDate);
  const endDate = new Date(toDate);
  const currentDate = new Date();

  if (!startDate || !endDate) {
    return {
      isValid: false,
      message: "Please provide valid start and end dates",
    };
  }

  if (startDate < currentDate) {
    return {
      isValid: false,
      message: "Start date cannot be in the past.",
    };
  }

  if (startDate > endDate) {
    return {
      isValid: false,
      message: "Start date cannot be after end date",
    };
  }

  let diffDays = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    if (!isWeekendOrPublicHoliday(d)) {
      diffDays++;
    }
  }

  let burnoutLeavesTaken = 0;
  let remainingBurnoutLeaves = 6;
  try {
    const userData = await User.findOne({ slackId: user });
    if (userData) {
      burnoutLeavesTaken = userData.burnout;
      remainingBurnoutLeaves -= burnoutLeavesTaken;
    }
  } catch (err) {
    console.error(err);
    return {
      isValid: false,
      message:
        "An error occurred while fetching your leave records. Please try again later.",
    };
  }

  const totalBurnoutLeavesRequested = burnoutLeavesTaken + diffDays;
  if (totalBurnoutLeavesRequested > 6) {
    return {
      isValid: false,
      message: `You have exceeded your yearly burnout leave limit of 6 days. You can apply for ${remainingBurnoutLeaves} more days. Please contact HR for additional support.`,
    };
  }

  if (diffDays > 2) {
    return {
      isValid: false,
      message: "You can take a maximum of 2 consecutive burnout leaves.",
    };
  }

  const oneDayBeforeStartDate = new Date(startDate);
  oneDayBeforeStartDate.setDate(oneDayBeforeStartDate.getDate() - 1);
  const formattedOneDayBeforeStartDate = oneDayBeforeStartDate
    .toISOString()
    .split("T")[0];

  const oneDayAfterEndDate = new Date(endDate);
  oneDayAfterEndDate.setDate(oneDayAfterEndDate.getDate() + 1);
  const formattedOneDayAfterEndDate = oneDayAfterEndDate
    .toISOString()
    .split("T")[0];

  const overlappingLeaves = await Leave.find({
    user: user,
    status: "Approved",
    fromDate: {
      $gte: formattedOneDayBeforeStartDate,
      $lt: formattedOneDayAfterEndDate,
    },
    toDate: {
      $gte: formattedOneDayBeforeStartDate,
      $lt: formattedOneDayAfterEndDate,
    },
  });

  if (overlappingLeaves.length > 0) {
    return {
      isValid: false,
      message: "Burnout leaves cannot be clubbed with other leaves.",
    };
  }

  return {
    isValid: true,
    message: "Burnout leave request is valid. Please inform your team lead.",
  };
};

const verifyCasualLeave = async (user, fromDate, toDate) => {
  const startDate = new Date(fromDate);
  const endDate = new Date(toDate);

  if (!startDate || !endDate) {
    return {
      isValid: false,
      message: "Please provide valid start and end dates",
    };
  }

  if (startDate > endDate) {
    return {
      isValid: false,
      message: "Start date cannot be after end date",
    };
  }

  let diffDays = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    if (!isWeekendOrPublicHoliday(d)) {
      diffDays++;
    }
  }

  const userRecord = await User.findOne({ slackId: user });
  const casualLeavesTaken = userRecord ? userRecord.casualLeave : 0;
  const remainingCasualLeaves = 6 - casualLeavesTaken; // Calculate remaining leave
  console.log({ casualLeavesTaken });

  if (casualLeavesTaken + diffDays > 6) {
    return {
      isValid: false,
      message: `You have exceeded your yearly casual leave limit of 6 days. You can take ${remainingCasualLeaves} more days. Please contact HR for additional support.`,
    };
  }

  const twoWeeksInMillis = 1000 * 60 * 60 * 24 * 14;
  const currentDate = new Date();
  if (startDate - currentDate < twoWeeksInMillis) {
    return {
      isValid: false,
      message: "Due notice should be provided at least 2 weeks in advance.",
    };
  }

  return {
    isValid: true,
    message:
      "Casual leave request is valid. You can take the leave individually or club it together. Please inform your team lead.",
  };
};

const verifyBereavementLeave = async (user, fromDate, toDate) => {
  const currentDate = new Date();

  if (!fromDate || !toDate) {
    return {
      isValid: false,
      message: "Please provide valid from and to dates",
    };
  }

  if (fromDate > toDate) {
    return {
      isValid: false,
      message: "From date cannot be after to date",
    };
  }

  let diffDays = 0;
  for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
    if (!isWeekendOrPublicHoliday(d)) {
      diffDays++;
    }
  }

  const userRecord = await User.findOne({ slackId: user });
  const remainingBereavementLeave =
    5 - (userRecord ? userRecord.bereavementLeave : 0);
  if (remainingBereavementLeave <= 0) {
    return {
      isValid: false,
      message: "You have exhausted your paid bereavement leave.",
    };
  }

  if (diffDays > remainingBereavementLeave) {
    return {
      isValid: false,
      message: `You can only take up to ${remainingBereavementLeave} days of paid bereavement leave. and for additional leave please contact with admin `,
    };
  }

  if (diffDays > 5) {
    return {
      isValid: false,
      message:
        "You may take up to 5 continuous days of paid bereavement leave to cope with the loss of a loved one.",
    };
  }

  // work on this part
  if (diffDays > 5 && diffDays <= 15) {
    return {
      isValid: false,
      message: "You can take up to 10 more days of unpaid leave if needed.",
    };
  }

  return {
    isValid: true,
    message:
      "Bereavement leave request is valid. Please take the time you need to cope with your loss.",
  };
};

const verifyUnpaidLeave = async (user, fromDate, toDate) => {
  const currentDate = new Date();
  const noticePeriod = new Date(
    currentDate.setMonth(currentDate.getMonth() + 2)
  );

  if (!fromDate || !toDate) {
    return {
      isValid: false,
      message: "Please provide valid from and to dates",
    };
  }

  if (fromDate > toDate) {
    return {
      isValid: false,
      message: "From date cannot be after to date",
    };
  }

  let diffDays = 0;
  for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
    if (!isWeekendOrPublicHoliday(d)) {
      diffDays++;
    }
  }

  if (diffDays > 20) {
    return {
      isValid: false,
      message:
        "You may take leave without pay for a maximum of 20 working days.",
    };
  }

  const userRecord = await User.findOne({ slackId: user });
  if (userRecord.yearsOfService < 2) {
    return {
      isValid: false,
      message:
        "You must have a minimum of 2 years of service to apply for unpaid leave.",
    };
  }

  if (fromDate < noticePeriod) {
    return {
      isValid: false,
      message:
        "A notice period of 2 months is required before taking unpaid leave.",
    };
  }

  let leaveAlreadyTaken = 0;
  try {
    const userData = await User.findOne({ slackId: user });
    if (userData) {
      leaveAlreadyTaken = userData.unpaidLeave;
    }
  } catch (err) {
    console.error(err);
    return {
      isValid: false,
      message:
        "An error occurred while fetching your leave records. Please try again later.",
    };
  }

  if (leaveAlreadyTaken + diffDays > 20) {
    return {
      isValid: false,
      message: `You have already taken ${leaveAlreadyTaken} days of unpaid leave. You can only take up to 20 days in total.`,
    };
  }

  return {
    isValid: true,
    message:
      "Unpaid leave request is valid. Please ensure you remain under employment during this period.",
  };
};

const verifyInternshipLeave = async (user, fromDate, toDate) => {
  const noticePeriod = 5 * 24 * 60 * 60 * 1000;

  if (!fromDate || !toDate) {
    return {
      isValid: false,
      message: "Please provide valid from and to dates",
    };
  }

  if (fromDate > toDate) {
    return {
      isValid: false,
      message: "From date cannot be after to date",
    };
  }

  let diffDays = 0;
  for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
    if (!isWeekendOrPublicHoliday(d)) {
      diffDays++;
    }
  }

  if (diffDays > 2) {
    return {
      isValid: false,
      message:
        "Interns are eligible for a maximum of 2 paid leave days per month.",
    };
  }

  const userRecord = await User.findOne({ slackId: user });
  if (userRecord.yearsOfService < 0) {
    return {
      isValid: false,
      message: "Interns are eligible for paid leaves.",
    };
  }

  if (fromDate < noticePeriod) {
    return {
      isValid: false,
      message:
        "A notice period of 5 working days is required before taking leave.",
    };
  }

  return {
    isValid: true,
    message:
      "Internship leave request is valid. Additional leaves may be provided based on circumstances.",
  };
};

const verifyMensuralLeave = async (user, fromDate, toDate) => {
  const startDate = new Date(fromDate);
  const endDate = new Date(toDate);

  if (!startDate || !endDate) {
    return {
      isValid: false,
      message: "Please provide valid start and end dates",
    };
  }

  if (startDate > endDate) {
    return {
      isValid: false,
      message: "Start date cannot be after end date",
    };
  }

  let diffDays = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    if (!isWeekendOrPublicHoliday(d)) {
      diffDays++;
    }
  }

  let mensuralLeavesTaken = 0;
  try {
    const leaves = await Leave.find({ user, leaveType: "mensural" });
    const currentYear = startDate.getFullYear();
    const leavesThisYear = leaves.filter((leave) => {
      const leaveDate = new Date(leave.fromDate);
      return leaveDate.getFullYear() === currentYear;
    });
    mensuralLeavesTaken = leavesThisYear.length;
  } catch (err) {
    console.error(err);
    return {
      isValid: false,
      message:
        "An error occurred while fetching your leave records. Please try again later.",
    };
  }

  if (mensuralLeavesTaken + diffDays > 18) {
    return {
      isValid: false,
      message:
        "You have exceeded your yearly menstrual leave limit of 18 days. Please contact HR for additional support.",
    };
  }

  if (diffDays > 2) {
    return {
      isValid: false,
      message:
        "For those needing more than 2 days at a time, additional leave may be provided based on your circumstances.",
    };
  }

  return {
    isValid: true,
    message:
      "Menstrual leave request is valid. Leaves can be taken as 1 full day and a half-day, or split into half-days as needed. Inform your lead or team in advance when possible to ensure smooth workflow management. Menstrual health is not one-size-fits-all. This policy reflects our commitment to supporting your physical and mental well-being, offering flexibility for those who need it most, while maintaining fairness across the team.",
  };
};

const verifyMaternityLeave = async (user, fromDate, toDate) => {
  const startDate = new Date(fromDate);
  const endDate = new Date(toDate);
  const currentDate = new Date();

  if (!startDate || !endDate) {
    return {
      isValid: false,
      message: "Please provide valid start and end dates",
    };
  }

  if (startDate > endDate) {
    return {
      isValid: false,
      message: "Start date cannot be after end date",
    };
  }

  let diffDays = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    if (!isWeekendOrPublicHoliday(d)) {
      diffDays++;
    }
  }

  const diffTime = Math.abs(endDate - startDate);
  const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));

  let maternityLeavesTaken = 0;
  try {
    const userData = await User.findOne({ slackId: user });
    if (userData) {
      maternityLeavesTaken = userData.maternityLeave;
    }
  } catch (err) {
    console.error(err);
    return {
      isValid: false,
      message:
        "An error occurred while fetching your leave records. Please try again later.",
    };
  }

  const totalMaternityLeaveLimit = 13;
  const remainingMaternityLeaves =
    totalMaternityLeaveLimit - maternityLeavesTaken;

  if (maternityLeavesTaken + diffWeeks > totalMaternityLeaveLimit) {
    return {
      isValid: false,
      message: `You have exceeded your maternity leave limit of ${totalMaternityLeaveLimit} weeks. You have ${remainingMaternityLeaves} weeks remaining. Please contact HR for additional support.`,
    };
  }

  if (diffWeeks > 13) {
    return {
      isValid: false,
      message: "Maternity leave cannot exceed 13 weeks.",
    };
  }

  const fourWeeksBeforeDueDate = new Date(currentDate);
  fourWeeksBeforeDueDate.setDate(currentDate.getDate() - 28);
  if (startDate < fourWeeksBeforeDueDate) {
    return {
      isValid: false,
      message: "Leave can start up to 4 weeks before the due date if needed.",
    };
  }

  return {
    isValid: true,
    message:
      "Maternity leave request is valid. Flexible working hours or remote work options may be arranged during the first 2 months post-return to help ease the transition. Leave policies apply equally to adoptive mothers. Please inform your team lead in advance to ensure smooth workflow management.",
  };
};

const verifyPaternityLeave = async (user, fromDate, toDate) => {
  const startDate = new Date(fromDate);
  const endDate = new Date(toDate);
  const currentDate = new Date();

  if (!startDate || !endDate) {
    return {
      isValid: false,
      message: "Please provide valid start and end dates",
    };
  }

  if (startDate > endDate) {
    return {
      isValid: false,
      message: "Start date cannot be after end date",
    };
  }

  let diffDays = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    if (!isWeekendOrPublicHoliday(d)) {
      diffDays++;
    }
  }

  const diffTime = Math.abs(endDate - startDate);
  const diffDaysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let paternityLeavesTaken = 0;
  try {
    const userData = await User.findOne({ slackId: user });
    if (userData) {
      paternityLeavesTaken = userData.paternityLeave;
    }
  } catch (err) {
    console.error(err);
    return {
      isValid: false,
      message:
        "An error occurred while fetching your leave records. Please try again later.",
    };
  }

  const totalPaternityLeaveLimit = 20;
  const remainingPaternityLeaves =
    totalPaternityLeaveLimit - paternityLeavesTaken;

  if (paternityLeavesTaken + diffDaysCount > totalPaternityLeaveLimit) {
    return {
      isValid: false,
      message: `You have exceeded your paternity leave limit of ${totalPaternityLeaveLimit} days. You have ${remainingPaternityLeaves} days remaining. Please contact HR for additional support.`,
    };
  }

  if (diffDaysCount > 10 && diffDaysCount % 10 !== 0) {
    return {
      isValid: false,
      message:
        "Paternity leave can be taken in increments, with a maximum of 2 weeks (10 working days) at one stretch.",
    };
  }

  const twoWeeksFromNow = new Date(currentDate);
  twoWeeksFromNow.setDate(currentDate.getDate() + 14);
  if (startDate < twoWeeksFromNow) {
    return {
      isValid: false,
      message: "Please submit a request for leave at least 2 weeks in advance.",
    };
  }

  if (diffDaysCount > remainingPaternityLeaves) {
    return {
      isValid: false,
      message: `You can request up to ${remainingPaternityLeaves} more days of unpaid leave if needed.`,
    };
  }

  return {
    isValid: true,
    message:
      "Paternity leave request is valid. Please inform your team lead in advance to ensure smooth workflow management.",
  };
};

const verifyPersonalLeave = async (user, fromDate, toDate) => {
  if (!fromDate || !toDate) {
    return {
      isValid: false,
      message: "Please provide valid from and to dates",
    };
  }

  if (fromDate > toDate) {
    return {
      isValid: false,
      message: "From date cannot be after to date",
    };
  }

  let diffDays = 0;
  for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
    if (!isWeekendOrPublicHoliday(d)) {
      diffDays++;
    }
  }

  if (diffDays > 6) {
    return {
      isValid: false,
      message: "You can choose up to 6 restricted holidays in a year.",
    };
  }

  let restrictedHolidaysTaken = 0;
  try {
    const userData = await User.findOne({ slackId: user });
    if (userData) {
      restrictedHolidaysTaken = userData.restrictedHoliday;
    }
  } catch (err) {
    console.error(err);
    return {
      isValid: false,
      message:
        "An error occurred while fetching your leave records. Please try again later.",
    };
  }

  if (restrictedHolidaysTaken + diffDays > 6) {
    return {
      isValid: false,
      message: `You have already taken ${restrictedHolidaysTaken} restricted holidays. You can only take up to 6 in total.`,
    };
  }

  const currentMonth = new Date().getMonth();
  const isQuarterStart = [0, 3, 6, 9].includes(currentMonth);
  if (!isQuarterStart) {
    return {
      isValid: false,
      message:
        "Restricted holidays should be updated quarterly, during the first week of January, April, July, and October.",
    };
  }

  return {
    isValid: true,
    message:
      "Personal leave request is valid. Please ensure to submit your request for approval over email.",
  };
};

module.exports = {
  verifySickLeave,
  verifyBurnoutLeave,
  verifyCasualLeave,
  verifyMensuralLeave,
  verifyMaternityLeave,
  verifyPaternityLeave,
  verifyBereavementLeave,
  verifyUnpaidLeave,
  verifyInternshipLeave,
  verifyPersonalLeave,
};
