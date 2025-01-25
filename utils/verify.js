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
  for (const date of formattedDates) {
    if (date < today) {
      return {
        isValid: false,
        message: `The date ${
          date.toISOString().split("T")[0]
        } cannot be in the past.`,
      };
    }
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const userData = await User.findOne({ slackId: user });
  const totalDaysRequested = selectedDates.reduce((total, _, index) => {
    return total + (halfDays[index] === "Full_Day" ? 1 : 0.5);
  }, 0);
  const totalCasualLeaves = userData.casualLeave + totalDaysRequested;

  if (totalCasualLeaves > 6) {
    return {
      isValid: false,
      message: `Exceeded the limit of 6 casual leaves per year. You have ${
        6 - userData.casualLeave
      } casual leave days remaining.`,
    };
  }

  for (const date of formattedDates) {
    if (date < today) {
      return {
        isValid: false,
        message: `The date ${
          date.toISOString().split("T")[0]
        } is a past date. Please select a future date.`,
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
  }

  if (totalDaysRequested <= 1) {
    return {
      isValid: true,
      message: "Casual leave for one day verified successfully.",
    };
  } else {
    const earliestDate = new Date(Math.min.apply(null, formattedDates));
    const requiredNoticeDate = new Date(earliestDate);
    requiredNoticeDate.setDate(requiredNoticeDate.getDate() - 14);

    if (today > requiredNoticeDate) {
      return {
        isValid: false,
        message: `For leave of more than one day, application must be submitted at least 2 weeks in advance. The earliest date in your request is too soon.`,
      };
    }
  }

  console.log(
    `Casual leave requested for the following dates: ${formattedDates
      .map((date) => date.toISOString().split("T")[0])
      .join(", ")}`
  );

  return {
    isValid: true,
    message: "Casual leave verified successfully.",
  };
};

const verifyUnpaidLeave = async (
  user,
  selectedDates,
  leaveTypes,
  halfDays,
  reason
) => {
  if (!Array.isArray(selectedDates) || selectedDates.length === 0) {
    return { isValid: false, message: "No dates provided for unpaid leave." };
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
  for (const date of formattedDates) {
    if (date < today) {
      return {
        isValid: false,
        message: `The date ${
          date.toISOString().split("T")[0]
        } cannot be in the past.`,
      };
    }
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

  const totalUnpaidLeaves = userData.unpaidLeave || 0;
  const totalLeaveCount = totalUnpaidLeaves + totalLeaveDays;

  if (totalLeaveCount > 20) {
    return {
      isValid: false,
      message: `You have exceeded the limit of 20 unpaid leave days per year. You have ${
        20 - totalUnpaidLeaves
      } unpaid leave days remaining.`,
    };
  }

  let workingDays = 0;
  for (let date of formattedDates) {
    if (!isWeekendOrPublicHoliday(date)) {
      workingDays++;
    }
  }

  if (workingDays > 20) {
    return {
      isValid: false,
      message:
        "You may take leave without pay for a maximum of 20 working days per year.",
    };
  }

  if (workingDays <= 3) {
    return {
      isValid: true,
      message: "Unpaid leave request for up to 3 days is approved immediately.",
    };
  } else {
    const fourWeeksInMillis = 1000 * 60 * 60 * 24 * 28;
    const noticePeriod = new Date(today.getTime() + fourWeeksInMillis);
    const earliestDate = new Date(
      Math.min(...formattedDates.map((date) => date.getTime()))
    );
    if (earliestDate < noticePeriod) {
      return {
        isValid: false,
        message:
          "A notice period of 4 weeks is required before taking unpaid leave for more than 3 days.",
      };
    }
  }

  return {
    isValid: true,
    message:
      "Unpaid leave request is valid. Please ensure you remain under employment during this period.",
  };
};

const verifyBereavementLeave = async (user, fromDate, toDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(fromDate);
  const endDate = new Date(toDate);

  if (
    !startDate ||
    !endDate ||
    isNaN(startDate.getTime()) ||
    isNaN(endDate.getTime())
  ) {
    return {
      isValid: false,
      message: "Please provide valid start and end dates.",
    };
  }

  if (startDate > endDate) {
    return {
      isValid: false,
      message: "Start date cannot be after end date.",
    };
  }

  if (startDate < today) {
    return {
      isValid: false,
      message: "Start date cannot be a past date.",
    };
  }

  const userRecord = await User.findOne({ slackId: user });
  if (!userRecord) {
    return {
      isValid: false,
      message: "User record not found.",
    };
  }

  // Create a list of all dates between startDate and endDate
  const dateList = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    dateList.push(new Date(d));
  }

  // Check each date to see if it exists in any existing leaves
  const existingLeaves = await Leave.find({
    user: user,
    dates: { $in: dateList },
  });

  if (existingLeaves.length > 0) {
    const conflictingDates = existingLeaves
      .map((leave) =>
        leave.dates.filter((date) =>
          dateList.some((d) => d.getTime() === date.getTime())
        )
      )
      .flat();
    const uniqueConflictingDates = [
      ...new Set(
        conflictingDates.map((date) => date.toISOString().split("T")[0])
      ),
    ];
    return {
      isValid: false,
      message: `You are already on leave for the following dates: ${uniqueConflictingDates.join(
        ", "
      )}.`,
    };
  }

  let diffDays = 0;
  dateList.forEach((d) => {
    if (!isWeekendOrPublicHoliday(d)) {
      diffDays++;
    }
  });

  if (diffDays > 5) {
    return {
      isValid: false,
      message:
        "You can only take a maximum of 5 bereavement leave days at a time.",
    };
  }

  const totalBereavementLeaveTaken = userRecord.bereavementLeave || 0;
  const remainingBereavementLeave = 5 - totalBereavementLeaveTaken;

  if (totalBereavementLeaveTaken >= 5) {
    return {
      isValid: false,
      message: "You have exhausted your paid bereavement leave for the year.",
    };
  }

  if (diffDays > remainingBereavementLeave) {
    return {
      isValid: false,
      message: `You can only take up to ${remainingBereavementLeave} more days of paid bereavement leave this year. For additional leave, please contact admin.`,
    };
  }

  return {
    isValid: true,
    message: `🕊️ Your bereavement leave for ${fromDate} to ${toDate} is approved. We are deeply sorry for your loss. Our thoughts are with you, and we're here if you need any support.`,
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

const verifyMensuralLeave = async (
  user,
  selectedDates,
  leaveTypes,
  halfDays,
  reason
) => {
  if (!Array.isArray(selectedDates) || selectedDates.length === 0) {
    return {
      isValid: false,
      message: "No dates provided for menstrual leave.",
    };
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

  const formattedMensuralLeaveDates = selectedDates.map(formatDate);
  console.log("Formatted Dates for Verification:", formattedMensuralLeaveDates);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const date of formattedMensuralLeaveDates) {
    if (date < today) {
      return {
        isValid: false,
        message: `The date ${
          date.toISOString().split("T")[0]
        } cannot be in the past.`,
      };
    }
  }

  const userData = await User.findOne({ slackId: user });
  if (!userData) {
    return {
      isValid: false,
      message: "User data not found.",
    };
  }

  const totalLeaveDays = selectedDates.reduce((total, date, index) => {
    return total + (halfDays[index] === "Full_Day" ? 1 : 0.5);
  }, 0);

  const totalMensuralLeaves = userData.mensuralLeave + totalLeaveDays;
  const remainingMensuralLeaves = 18 - totalMensuralLeaves;
  if (totalMensuralLeaves > 18) {
    return {
      isValid: false,
      message: `Exceeded the limit of 18 paid menstrual leaves per year. You have ${
        remainingMensuralLeaves < 0 ? 0 : remainingMensuralLeaves
      } menstrual leave days remaining.`,
    };
  }

  const currentMonth = new Date().getMonth();
  const leavesThisMonth = await Leave.find({
    user: user,
    leaveType: "Mensural_Leave",
    dates: {
      $elemMatch: {
        $gte: new Date(new Date().getFullYear(), currentMonth, 1),
        $lte: new Date(new Date().getFullYear(), currentMonth + 1, 0),
      },
    },
  });

  console.log(
    new Date(new Date().getFullYear(), currentMonth, 1),
    new Date(new Date().getFullYear(), currentMonth + 1, 0)
  );

  console.log("hello1");
  const mensuralLeavesThisMonth = leavesThisMonth.reduce((acc, leave) => {
    console.log("hello");
    console.log(leave);
    return (
      acc +
      leave.dates.reduce((count, date) => {
        const leaveDate = new Date(date);
        console.log(leave, leaveDate);

        if (!isWeekendOrPublicHoliday(leaveDate)) {
          return count + (leave.leaveDay[0] === "Half_Day" ? 0.5 : 1);
        }
        return count;
      }, 0)
    );
  }, 0);

  if (mensuralLeavesThisMonth + totalLeaveDays > 1.5) {
    return {
      isValid: false,
      message:
        "You cannot apply for more than 1.5 menstrual leave days in a month.",
    };
  }

  for (const date of formattedMensuralLeaveDates) {
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
  }

  return {
    isValid: true,
    message:
      "Menstrual leave request is valid. Leaves can be taken as 1 full day and a half-day, or split into half-days as needed.",
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
  console.log(diffDays);

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

  if (maternityLeavesTaken + diffDays > totalMaternityLeaveLimit) {
    return {
      isValid: false,
      message: `You have exceeded your maternity leave limit of ${totalMaternityLeaveLimit} days. You have ${remainingMaternityLeaves} days remaining. Please contact HR for additional support.`,
    };
  }

  if (diffDays > 65) {
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

  let userData;
  try {
    userData = await User.findOne({ slackId: user });
    if (!userData) {
      return {
        isValid: false,
        message: "User data not found.",
      };
    }
  } catch (err) {
    console.error(err);
    return {
      isValid: false,
      message:
        "An error occurred while fetching your leave records. Please try again later.",
    };
  }

  const paternityLeavesTaken = userData.paternityLeave || 0;
  const totalPaternityLeaveLimit = 20;
  const remainingPaternityLeaves =
    totalPaternityLeaveLimit - paternityLeavesTaken;

  if (paternityLeavesTaken + diffDays > totalPaternityLeaveLimit) {
    return {
      isValid: false,
      message: `You have exceeded your paternity leave limit of ${totalPaternityLeaveLimit} days. You have ${remainingPaternityLeaves} days remaining. Please contact HR for additional support.`,
    };
  }

  if (diffDays > 10) {
    return {
      isValid: false,
      message: "Paternity leave cannot exceed 10 days at a stretch.",
    };
  }

  const fourWeeksFromNow = new Date(currentDate);
  fourWeeksFromNow.setDate(currentDate.getDate() + 28);
  if (startDate < fourWeeksFromNow) {
    return {
      isValid: false,
      message: "Leave must be applied for at least 4 weeks in advance.",
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
