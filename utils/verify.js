const { restrictedHolidays } = require("../mode");
const { User } = require("../models/user");
const { Leave } = require("../models/holidays");
const { publicHolidaysList } = require("../mode");

const isWeekendOrPublicHoliday = (date) => {
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const isPublicHoliday =
    Array.isArray(publicHolidaysList) &&
    publicHolidaysList.some(
      (holiday) => holiday.date.getTime() === date.getTime()
    );
  return isWeekend || isPublicHoliday;
};

const verifySickLeave = async (
  user,
  selectedDates,
  leaveTypes,
  halfDays,
  reason
) => {
  if (!Array.isArray(selectedDates) || selectedDates.length === 0) {
    return { isValid: false, message: "No dates provided for sick leave." };
  }

  const dateSet = new Set(
    selectedDates.map((date) => new Date(date).toDateString())
  );
  if (dateSet.size !== selectedDates.length) {
    return {
      isValid: false,
      message: "Two or more selected dates are the same.",
    };
  }

  const formatDate = (date) => {
    if (typeof date === "string") {
      date = new Date(date);
    }
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error("Invalid date provided.");
    }
    return date;
  };

  const formattedDates = selectedDates.map(formatDate);
  console.log("Formatted Dates for Verification:", formattedDates);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = formattedDates[0];

  if (startDate < today) {
    return { isValid: false, message: "Start date cannot be in the past." };
  }

  const userData = await User.findOne({ slackId: user });
  if (!userData) {
    return {
      isValid: false,
      message: "User not found.",
    };
  }

  const totalLeaveDays = selectedDates.reduce((total, date, index) => {
    return total + (halfDays[index] === "Full_Day" ? 1 : 0.5);
  }, 0);

  const totalSickLeaves = userData.sickLeave + totalLeaveDays;
  const remainingSickLeaves = 12 - totalSickLeaves;
  if (totalSickLeaves > 12) {
    return {
      isValid: false,
      message: `Exceeded the limit of 12 paid sick leaves per year. You have ${
        remainingSickLeaves < 0 ? 0 : remainingSickLeaves
      } sick leave days remaining.`,
    };
  }

  for (const date of formattedDates) {
    if (isWeekendOrPublicHoliday(date)) {
      return {
        isValid: false,
        message: `The date ${
          date.toISOString().split("T")[0]
        } is a weekend or a public holiday. Please select a different date.`,
      };
    }

    const overlappingLeave = await Leave.findOne({
      user: user,
      dates: date,
      status: "Approved",
    });
    if (overlappingLeave) {
      return {
        isValid: false,
        message: `There is already an approved leave on ${
          date.toISOString().split("T")[0]
        }. Please select a different date.`,
      };
    }

    const previousDay = new Date(date);
    previousDay.setDate(date.getDate() - 1);
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);

    const adjacentLeave = await Leave.findOne({
      user: user,
      dates: { $in: [previousDay, nextDay] },
      status: "Approved",
    });
    if (adjacentLeave) {
      return {
        isValid: false,
        message: `Clubbing sick leave with other leaves is not allowed. Please ensure no leaves are applied one day before or after ${
          date.toISOString().split("T")[0]
        }.`,
      };
    }
  }

  console.log(
    `Sick leave requested for the following dates: ${formattedDates
      .map((date) => date.toISOString().split("T")[0])
      .join(", ")}`
  );

  return {
    isValid: true,
    message: "Sick leave verified successfully.",
  };
};

const verifyBurnoutLeave = async (user, selectedDates, reason) => {
  if (!Array.isArray(selectedDates) || selectedDates.length === 0) {
    return { isValid: false, message: "No dates provided for burnout leave." };
  }

  if (selectedDates.length > 2) {
    return {
      isValid: false,
      message:
        "You can only take a maximum of 2 consecutive burnout leave days.",
    };
  }

  const currentQuarter = Math.floor(new Date().getMonth() / 3);
  const quarterStart = new Date(
    new Date().getFullYear(),
    currentQuarter * 3,
    1
  );
  const quarterEnd = new Date(
    new Date().getFullYear(),
    (currentQuarter + 1) * 3,
    0
  );

  let leavesThisQuarter = 0;
  const leaves = await Leave.find({
    user: user,
    leaveType: "Burnout_Leave",
    dates: { $elemMatch: { $gte: quarterStart, $lte: quarterEnd } },
    status: "Approved",
  });

  leaves.forEach((doc) => {
    leavesThisQuarter += doc.dates.filter(
      (date) => date >= quarterStart && date <= quarterEnd
    ).length;
  });

  if (leavesThisQuarter >= 2) {
    return {
      isValid: false,
      message: `You have already taken ${leavesThisQuarter} burnout leaves this quarter, and no more are allowed.`,
    };
  } else if (leavesThisQuarter === 1 && selectedDates.length > 1) {
    return {
      isValid: false,
      message: "You can only take one more burnout leave day this quarter.",
    };
  }

  const formattedDates = selectedDates.map((date) => new Date(date));
  console.log("Formatted Dates for Verification:", formattedDates);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const date of formattedDates) {
    if (date < today) {
      return {
        isValid: false,
        message: `The date ${
          date.toISOString().split("T")[0]
        } is in the past. Please select a future date.`,
      };
    }

    if (isWeekendOrPublicHoliday(date)) {
      return {
        isValid: false,
        message: `The date ${
          date.toISOString().split("T")[0]
        } is a weekend or a public holiday. Please select a different date.`,
      };
    }

    const adjacentLeaves = await Leave.findOne({
      user: user,
      dates: {
        $in: [
          new Date(date.getTime() - 86400000),
          new Date(date.getTime() + 86400000),
        ],
      },
      status: "Approved",
    });

    if (adjacentLeaves) {
      return {
        isValid: false,
        message: `Burnout leave cannot be clubbed with other leaves. Please ensure no leaves are applied one day before or after ${
          date.toISOString().split("T")[0]
        }.`,
      };
    }

    const userData = await User.findOne({ slackId: user });
    const totalBurnoutLeaves = userData.burnoutLeave + selectedDates.length;
    const remainingBurnoutLeaves = 6 - totalBurnoutLeaves;
    if (totalBurnoutLeaves > 6) {
      return {
        isValid: false,
        message: `Exceeded the limit of 6 burnout leaves per year. You have ${
          remainingBurnoutLeaves < 0 ? 0 : remainingBurnoutLeaves
        } burnout leave days remaining.`,
      };
    }
  }

  const overlappingLeave = await Leave.findOne({
    user: user,
    dates: { $in: formattedDates },
    status: "Approved",
  });
  if (overlappingLeave) {
    return {
      isValid: false,
      message: `There is already an approved leave on ${
        overlappingLeave.dates.toISOString().split("T")[0]
      }. Please select a different date.`,
    };
  }

  console.log(
    `Burnout leave requested for the following dates: ${formattedDates
      .map((date) => date.toISOString().split("T")[0])
      .join(", ")}`
  );

  return {
    isValid: true,
    message: "Burnout leave verified successfully.",
  };
};

const verifyCasualLeave = async (
  user,
  selectedDates,
  leaveTypes,
  halfDays,
  reason
) => {
  if (!Array.isArray(selectedDates) || selectedDates.length === 0) {
    return { isValid: false, message: "No dates provided for casual leave." };
  }

  const formatDate = (date) => {
    if (typeof date === "string") {
      date = new Date(date);
    }
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error("Invalid date provided.");
    }
    return date;
  };

  const formattedDates = selectedDates.map(formatDate);
  console.log("Formatted Dates for Verification:", formattedDates);

  for (const date of formattedDates) {
    if (isWeekendOrPublicHoliday(date)) {
      return {
        isValid: false,
        message: `The date ${
          date.toISOString().split("T")[0]
        } is a weekend or a public holiday. Please select a different date.`,
      };
    }
  }

  console.log(
    `Casual leave requested for the following dates: ${formattedDates
      .map((date) => date.toISOString().split("T")[0])
      .join(", ")}`
  );

  // Additional logic for verifying casual leave can be added here

  return {
    isValid: true,
    message: "Casual leave verified successfully.",
  };
};

const verifyBereavementLeave = async (user, fromDate, toDate) => {
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
      message: `You can only take up to ${remainingBereavementLeave} days of paid bereavement leave. For additional leave, please contact admin.`,
    };
  }

  return {
    isValid: true,
    message: `🕊️ Your bereavement leave for ${fromDate} to ${toDate} is approved. We are deeply sorry for your loss. Our thoughts are with you, and we're here if you need any support.`,
  };
};

const verifyUnpaidLeave = async (user, fromDate, toDate) => {
  const currentDate = new Date();
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

  if (diffDays > 3) {
    const fourWeeksInMillis = 1000 * 60 * 60 * 24 * 28;
    const noticePeriod = new Date(currentDate.getTime() + fourWeeksInMillis);
    if (startDate < noticePeriod) {
      return {
        isValid: false,
        message:
          "A notice period of 4 weeks is required before taking unpaid leave for more than 3 days.",
      };
    }
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

  if (diffDays > 2) {
    return {
      isValid: false,
      message:
        "Interns are eligible for a maximum of 2 paid leave days per month.",
    };
  }

  const userRecord = await User.findOne({ slackId: user });
  if (!userRecord || userRecord.yearsOfService >= 1) {
    return {
      isValid: false,
      message: "Only interns are eligible for internship leaves.",
    };
  }

  const currentMonth = startDate.getMonth();
  const leavesThisMonth = await Leave.find({
    user: user,
    leaveType: "Internship_Leave",
    fromDate: { $gte: new Date(startDate.getFullYear(), currentMonth, 1) },
    toDate: { $lte: new Date(startDate.getFullYear(), currentMonth + 1, 0) },
  });

  const internshipLeavesThisMonth = leavesThisMonth.reduce((acc, leave) => {
    const leaveStart = new Date(leave.fromDate);
    const leaveEnd = new Date(leave.toDate);
    for (
      let d = new Date(leaveStart);
      d <= leaveEnd;
      d.setDate(d.getDate() + 1)
    ) {
      if (!isWeekendOrPublicHoliday(d)) {
        acc++;
      }
    }
    return acc;
  }, 0);

  if (internshipLeavesThisMonth + diffDays > 2) {
    return {
      isValid: false,
      message:
        "You cannot apply for more than 2 internship leave days in a month.",
    };
  }

  return {
    isValid: true,
    message: "Internship leave request is valid.",
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

  const totalMaternityLeaveLimit = 65;
  const remainingMaternityLeaves =
    totalMaternityLeaveLimit - maternityLeavesTaken;

  if (maternityLeavesTaken + diffWeeks > totalMaternityLeaveLimit) {
    return {
      isValid: false,
      message: `You have exceeded your maternity leave limit of ${totalMaternityLeaveLimit} weeks. You have ${remainingMaternityLeaves} weeks remaining. Please contact HR for additional support.`,
    };
  }

  if (diffWeeks > 9) {
    return {
      isValid: false,
      message: "Maternity leave cannot exceed 65 days.",
    };
  }

  const fourWeeksBeforeStartDate = new Date(currentDate);
  fourWeeksBeforeStartDate.setDate(currentDate.getDate() + 28);
  if (startDate < fourWeeksBeforeStartDate) {
    return {
      isValid: false,
      message: "Leave must be applied for at least 4 weeks in advance.",
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

  const diffDaysCount = Math.ceil(
    (endDate - startDate) / (1000 * 60 * 60 * 24)
  );

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

  if (diffDaysCount > 10) {
    return {
      isValid: false,
      message:
        "Paternity leave can be taken in increments, with a maximum of 10 working days at one stretch.",
    };
  }

  const fourWeeksFromNow = new Date(currentDate);
  fourWeeksFromNow.setDate(currentDate.getDate() + 28);
  if (startDate < fourWeeksFromNow) {
    return {
      isValid: false,
      message: "Please submit a request for leave at least 4 weeks in advance.",
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

const verifyRestrictedHoliday = async (user, fromDate, toDate) => {
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

  const currentMonth = currentDate.getMonth();
  const isQuarterStart = [0, 3, 6, 9].includes(currentMonth);
  const isFirstWeek = currentDate.getDate() <= 7;

  if (!isQuarterStart || !isFirstWeek) {
    return {
      isValid: false,
      message:
        "Restricted holidays should be applied for the entire quarter and only in the first week of January, April, July, and October.",
    };
  }

  let diffDays = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    if (!isWeekendOrPublicHoliday(d)) {
      diffDays++;
    }
  }

  const userRecord = await User.findOne({ slackId: user });
  const restrictedHolidaysTaken = userRecord ? userRecord.restrictedHoliday : 0;
  const remainingRestrictedHolidays = 6 - restrictedHolidaysTaken;

  if (restrictedHolidaysTaken + diffDays > 6) {
    return {
      isValid: false,
      message: `You have exceeded your yearly restricted holiday limit of 6 days. You can take ${remainingRestrictedHolidays} more days.`,
    };
  }

  return {
    isValid: true,
    message: "Restricted holiday request is valid.",
  };
};

const verifyWFHLeave = async (user, fromDate, toDate) => {
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

  if (startDate.getDate() > 3) {
    return {
      isValid: false,
      message: "WFH leave must be applied before the 3rd of the month.",
    };
  }

  let diffDays = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    if (!isWeekendOrPublicHoliday(d)) {
      diffDays++;
    }
  }

  if (diffDays > 1) {
    return {
      isValid: false,
      message: "You can only take 1 WFH day per week.",
    };
  }

  const userRecord = await User.findOne({ slackId: user });
  const wfhLeavesTaken = userRecord ? userRecord.wfhLeave : 0;

  if (wfhLeavesTaken + diffDays > 4) {
    return {
      isValid: false,
      message: "You have exceeded your monthly WFH leave limit of 4 days.",
    };
  }

  return {
    isValid: true,
    message: "WFH leave request is valid. Please inform your team lead.",
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
  verifyRestrictedHoliday,
  verifyWFHLeave,
};
