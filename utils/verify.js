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

const validateOverlapWithHalfDayRules = async (
  user,
  date,
  newLeaveType,
  newDayType,
  newHalfSlot
) => {
  const dateStr = date.toISOString().split("T")[0];

  const existingLeaves = await Leave.find({
    user: user,
    dates: date,
    status: "Approved",
  });

  if (!existingLeaves || existingLeaves.length === 0) {
    return null;
  }

  // If the new leave is a full day, any existing leave is a conflict.
  if (newDayType === "Full_Day") {
    return `There is already an approved leave on ${dateStr}. Please select a different date.`;
  }

  const slot =
    newHalfSlot ||
    (newDayType === "First_Half" || newDayType === "Second_Half"
      ? newDayType
      : null);

  // If we don't know which half is being requested, be conservative and
  // disallow combining with any existing leave.
  if (!slot) {
    return `There is already an approved leave on ${dateStr}. Please select a different date.`;
  }

  const occupiedSlots = [];
  let hasNonSickBurnout = false;

  for (const leave of existingLeaves) {
    const idx = leave.dates.findIndex(
      (d) => d && d.getTime && d.getTime() === date.getTime()
    );
    if (idx === -1) {
      continue;
    }

    const leaveType = leave.leaveType;
    const dayType = Array.isArray(leave.leaveDay) ? leave.leaveDay[idx] : null;
    const timeType = Array.isArray(leave.leaveTime)
      ? leave.leaveTime[idx]
      : null;

    const isFullDay =
      dayType === "Full_Day" || timeType === "Full_Day" || !dayType;

    if (isFullDay) {
      occupiedSlots.push({ slot: "First_Half", type: leaveType });
      occupiedSlots.push({ slot: "Second_Half", type: leaveType });
    } else {
      let existingSlot = null;
      if (leaveType === "Burnout_Leave") {
        existingSlot = timeType || dayType;
      } else {
        existingSlot = dayType || timeType;
      }

      if (existingSlot === "First_Half" || existingSlot === "Second_Half") {
        occupiedSlots.push({ slot: existingSlot, type: leaveType });
      } else {
        // Unknown half specification – treat as occupying the whole day.
        occupiedSlots.push({ slot: "First_Half", type: leaveType });
        occupiedSlots.push({ slot: "Second_Half", type: leaveType });
      }
    }

    if (leaveType !== "Sick_Leave" && leaveType !== "Burnout_Leave") {
      hasNonSickBurnout = true;
    }
  }

  if (newLeaveType === "Casual_Leave") {
    if (occupiedSlots.length > 0) {
      return `Half-day Casual Leave cannot be combined with any other leave on ${dateStr}. Please select a different date.`;
    }
    return null;
  }

  if (newLeaveType === "Sick_Leave" || newLeaveType === "Burnout_Leave") {
    // Half-day Sick/Burnout can only be combined with each other.
    if (hasNonSickBurnout) {
      return `Half-day ${newLeaveType.replace(
        "_",
        " "
      )} can only be combined with a half-day of the other type on ${dateStr}.`;
    }

    const sameSlot = occupiedSlots.find((s) => s.slot === slot);
    if (sameSlot) {
      return `There is already a ${sameSlot.type.replace(
        "_",
        " "
      )} applied for the ${slot === "First_Half" ? "first" : "second"} half of ${dateStr}.`;
    }

    const otherSlot = occupiedSlots.find((s) => s.slot !== slot);
    if (!otherSlot) {
      // No other half is used – safe to apply this half-day.
      return null;
    }

    const expectedCounterpart =
      newLeaveType === "Sick_Leave" ? "Burnout_Leave" : "Sick_Leave";

    if (otherSlot.type !== expectedCounterpart) {
      return `Only a half-day Sick Leave and a half-day Burnout Leave can be combined on the same day (${dateStr}).`;
    }

    if (occupiedSlots.length > 1) {
      return `You can only combine one half-day Sick Leave with one half-day Burnout Leave on ${dateStr}.`;
    }

    return null;
  }

  // For all other leave types, keep the previous behavior: no overlaps.
  return `There is already an approved leave on ${dateStr}. Please select a different date.`;
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

  for (let i = 0; i < formattedDates.length; i++) {
    const date = formattedDates[i];
    const dayType = halfDays[i] || "Full_Day";

    if (isWeekendOrPublicHoliday(date)) {
      return {
        isValid: false,
        message: `The date ${
          date.toISOString().split("T")[0]
        } is a weekend or a public holiday. Please select a different date.`,
      };
    }

    const overlapMessage = await validateOverlapWithHalfDayRules(
      user,
      date,
      "Sick_Leave",
      dayType,
      dayType === "First_Half" || dayType === "Second_Half" ? dayType : null
    );
    if (overlapMessage) {
      return {
        isValid: false,
        message: overlapMessage,
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

const verifyBurnoutLeave = async (
  user,
  selectedDates,
  leaveDayArray,
  leaveTimeArray,
  reason
) => {
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

  const halfDays = leaveDayArray || Array(selectedDates.length).fill("Full_Day");
  const totalRequestedDays = halfDays.reduce(
    (total, dayType) => total + (dayType === "Full_Day" ? 1 : 0.5),
    0
  );

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
    const leaveDay = doc.leaveDay || [];
    doc.dates.forEach((date, idx) => {
      if (date >= quarterStart && date <= quarterEnd) {
        leavesThisQuarter += leaveDay[idx] === "Half_Day" ? 0.5 : 1;
      }
    });
  });

  if (leavesThisQuarter >= 2) {
    return {
      isValid: false,
      message: `You have already taken ${leavesThisQuarter} burnout leave days this quarter, and no more are allowed.`,
    };
  } else if (leavesThisQuarter + totalRequestedDays > 2) {
    return {
      isValid: false,
      message: `You can only take ${2 - leavesThisQuarter} more burnout leave day(s) this quarter.`,
    };
  }

  const formattedDates = selectedDates.map((date) => new Date(date));
  console.log("Formatted Dates for Verification:", formattedDates);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < formattedDates.length; i++) {
    const date = formattedDates[i];
    const dayType = halfDays[i] || "Full_Day";
    const halfSlot =
      leaveTimeArray && Array.isArray(leaveTimeArray)
        ? leaveTimeArray[i]
        : null;
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

    const overlapMessage = await validateOverlapWithHalfDayRules(
      user,
      date,
      "Burnout_Leave",
      dayType,
      halfSlot
    );
    if (overlapMessage) {
      return {
        isValid: false,
        message: overlapMessage,
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
    const totalBurnoutLeaves = (userData?.burnout || 0) + totalRequestedDays;
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

  if (totalCasualLeaves > 8) {
    return {
      isValid: false,
      message: `Exceeded the limit of 8 casual leaves per year. You have ${
        8
        - userData.casualLeave
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

const verifyMenstrualLeave = async (
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

  const formattedMenstrualLeaveDates = selectedDates.map(formatDate);
  console.log("Formatted Dates for Verification:", formattedMenstrualLeaveDates);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const date of formattedMenstrualLeaveDates) {
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

  const totalMenstrualLeaves = userData.menstrualLeave + totalLeaveDays;
  const remainingMenstrualLeaves = 18 - totalMenstrualLeaves;
  if (totalMenstrualLeaves > 18) {
    return {
      isValid: false,
      message: `Exceeded the limit of 18 paid menstrual leaves per year. You have ${
        remainingMenstrualLeaves < 0 ? 0 : remainingMenstrualLeaves
      } menstrual leave days remaining.`,
    };
  }

  const currentMonth = new Date().getMonth();
  const leavesThisMonth = await Leave.find({
    user: user,
    leaveType: "Menstrual_Leave",
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
  const menstrualLeavesThisMonth = leavesThisMonth.reduce((acc, leave) => {
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

  if (menstrualLeavesThisMonth + totalLeaveDays > 1.5) {
    return {
      isValid: false,
      message:
        "You cannot apply for more than 1.5 menstrual leave days in a month.",
    };
  }

  for (const date of formattedMenstrualLeaveDates) {
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
  // NOTE: Previously, personal leave was tied to restricted holiday rules:
  // - Limited to 6 restricted holidays per year
  // - Only allowed to be updated in the first week of each quarter
  // That logic has been temporarily disabled to open restricted holidays for all.
  // The original implementation is preserved below for reference.
  //
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
  
  // const currentMonth = new Date().getMonth();
  // const isQuarterStart = [0, 3, 6, 9].includes(currentMonth);
  // if (!isQuarterStart) {
  //   return {
  //     isValid: false,
  //     message:
  //       "Restricted holidays should be updated quarterly, during the first week of January, April, July, and October.",
  //   };
  // }

  return {
    isValid: true,
    message:
      "Personal leave request is valid. Please ensure to submit your request for approval over email.",
  };
};

const verifyRestrictedHoliday = async (user, selectedDates) => {
  if (!Array.isArray(selectedDates) || selectedDates.length === 0) {
    return {
      isValid: false,
      message: "No dates provided for restricted holiday.",
    };
  }
  // NOTE: Previously, restricted holidays could only be chosen:
  // - In the first week of each quarter (Jan/Apr/Jul/Oct)
  // - For dates strictly within the current quarter
  // That quarterly restriction has been disabled so restricted holidays are open for all now.
  // The original implementation is preserved below for reference.
  //
  // const currentDate = new Date();
  // const currentMonth = currentDate.getMonth();
  // const isQuarterStart = [0, 3, 6, 9].includes(currentMonth);
  // const isFirstWeek = currentDate.getDate() <= 7;
  //
  // if (!isQuarterStart || !isFirstWeek) {
  //   return {
  //     isValid: false,
  //     message:
  //       "Restricted holidays should be applied for the entire quarter and only in the first week of January, April, July, and October.",
  //   };
  // }
  //
  // const quarterStartDate = new Date(
  //   currentDate.getFullYear(),
  //   currentMonth,
  //   1
  // );
  // const quarterEndDate = new Date(
  //   currentDate.getFullYear(),
  //   currentMonth + 3,
  //   0
  // );

  for (const date of selectedDates) {
    const selectedDate = new Date(date);
    // if (selectedDate < quarterStartDate || selectedDate > quarterEndDate) {
    //   return {
    //     isValid: false,
    //     message: "Selected dates must be within the current quarter.",
    //   };
    // }

    if (isWeekendOrPublicHoliday(selectedDate)) {
      return {
        isValid: false,
        message: `The date ${
          selectedDate.toISOString().split("T")[0]
        } is a weekend or a public holiday. Please select a different date.`,
      };
    }
  }

  const formattedDates = selectedDates.map((date) => new Date(date));

  const overlappingLeave = await Leave.findOne({
    user: user,
    dates: { $in: formattedDates },
    status: "Approved",
  });
  if (overlappingLeave) {
    return {
      isValid: false,
      message: `There is already an approved leave on ${
        overlappingLeave.dates[0].toISOString().split("T")[0]
      }. Please select a different date.`,
    };
  }

  let diffDays = selectedDates.length;

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

const verifyWFHLeave = async (user, selectedDates, reason) => {
  if (!Array.isArray(selectedDates) || selectedDates.length === 0) {
    return { isValid: false, message: "No dates provided for WFH leave." };
  }

  const formattedDates = selectedDates.map((date) => new Date(date));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // if (today.getDate() > 3) {
  //   return {
  //     isValid: false,
  //     message: "WFH leave must be applied before the 3rd of the month.",
  //   };
  // }

  const weeks = new Set();
  for (const date of formattedDates) {
    const weekNumber = Math.floor(
      (date - new Date(date.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000)
    );
    weeks.add(weekNumber);
  }
  if (formattedDates.length > weeks.size) {
    return {
      isValid: false,
      message: "You can only apply for 1 WFH day per week.",
    };
  }

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

    const overlappingLeave = await Leave.findOne({
      user: user,
      dates: { $in: [date] },
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

  const userRecord = await User.findOne({ slackId: user });
  const wfhLeavesTaken = userRecord ? userRecord.wfhLeave : 0;
  const totalWFHLeaves = wfhLeavesTaken + selectedDates.length;
  const remainingWFHLeaves = 4 - totalWFHLeaves;

  if (totalWFHLeaves > 4) {
    return {
      isValid: false,
      message: `Exceeded the limit of 4 WFH leaves per month. You have ${
        remainingWFHLeaves < 0 ? 0 : remainingWFHLeaves
      } WFH leave days remaining.`,
    };
  }

  console.log(
    `WFH leave requested for the following dates: ${formattedDates
      .map((date) => date.toISOString().split("T")[0])
      .join(", ")}`
  );

  return {
    isValid: true,
    message: "WFH leave request is valid. Please inform your team lead.",
  };
};

module.exports = {
  verifySickLeave,
  verifyBurnoutLeave,
  verifyCasualLeave,
  verifyMenstrualLeave,
  verifyMaternityLeave,
  verifyPaternityLeave,
  verifyBereavementLeave,
  verifyUnpaidLeave,
  verifyInternshipLeave,
  verifyPersonalLeave,
  verifyRestrictedHoliday,
  verifyWFHLeave,
};


