const { restrictedHolidays } = require("../mode");
const { User } = require("../models/user");

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

  const diffTime = Math.abs(endDate - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

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

  if (sickLeavesTaken + diffDays > 12) {
    return {
      isValid: false,
      message:
        "You have exceeded your yearly sick leave limit of 12 days. Please contact HR for additional support.",
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

const verifyBurnoutLeave = async (user, fromDate, toDate, explanation) => {
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

  const diffTime = Math.abs(endDate - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const burnoutLeavesTaken = 0; // This should be fetched from the user's leave records

  if (burnoutLeavesTaken + diffDays > 6) {
    return {
      isValid: false,
      message:
        "You have exceeded your yearly burnout leave limit of 6 days. Please contact HR for additional support.",
    };
  }

  if (diffDays > 2) {
    return {
      isValid: false,
      message: "You can take a maximum of 2 consecutive burnout leaves.",
    };
  }

  if (!explanation || explanation.length < 1) {
    return {
      isValid: false,
      message:
        "You must provide a written explanation for your burnout leave request at least 24 hours prior.",
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

  const diffTime = Math.abs(endDate - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const casualLeavesTaken = 0; // This should be fetched from the user's leave records

  if (casualLeavesTaken + diffDays > 6) {
    return {
      isValid: false,
      message:
        "You have exceeded your yearly casual leave limit of 6 days. Please contact HR for additional support.",
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

  const diffTime = Math.abs(endDate - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const mensuralLeavesTaken = 0;

  if (mensuralLeavesTaken + diffDays > 18) {
    return {
      isValid: false,
      message:
        "You have exceeded your yearly mensural leave limit of 18 days. Please contact HR for additional support.",
    };
  }

  return {
    isValid: true,
    message:
      "Mensural leave request is valid. You can take leave as full days or half-days. Please inform your team lead in advance to ensure smooth workflow management.",
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

  const diffTime = Math.abs(endDate - startDate);
  const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));

  if (diffWeeks > 13) {
    return {
      isValid: false,
      message: "Maternity leave cannot exceed 13 weeks.",
    };
  }

  return {
    isValid: true,
    message:
      "Maternity leave request is valid. Please inform your team lead in advance to ensure smooth workflow management.",
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

  const diffTime = Math.abs(endDate - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 20) {
    return {
      isValid: false,
      message: "Paternity leave cannot exceed 4 weeks (20 working days).",
    };
  }

  if (diffDays > 10 && diffDays % 10 !== 0) {
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

  return {
    isValid: true,
    message:
      "Paternity leave request is valid. Please inform your team lead in advance to ensure smooth workflow management.",
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

  const diffTime = Math.abs(toDate - fromDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 5) {
    return {
      isValid: false,
      message:
        "You may take up to 5 continuous days of paid bereavement leave to cope with the loss of a loved one.",
    };
  }

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

  const diffTime = Math.abs(toDate - fromDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 20) {
    return {
      isValid: false,
      message:
        "You may take leave without pay for a maximum of 20 working days.",
    };
  }

  if (user.yearsOfService < 2) {
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

  const diffTime = Math.abs(toDate - fromDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 2) {
    return {
      isValid: false,
      message:
        "Interns are eligible for a maximum of 2 paid leave days per month.",
    };
  }

  if (user.yearsOfService < 0) {
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

const verifyPersonalLeave = async (user, fromDate, toDate) => {
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

  const diffTime = Math.abs(toDate - fromDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 6) {
    return {
      isValid: false,
      message: "You can choose up to 6 restricted holidays in a year.",
    };
  }

  const isHoliday = restrictedHolidays.some(
    (holiday) =>
      new Date(holiday).getTime() >= fromDate.getTime() &&
      new Date(holiday).getTime() <= toDate.getTime()
  );

  if (isHoliday) {
    return {
      isValid: false,
      message:
        "Restricted holiday requests must be submitted for approval over email.",
    };
  }

  if (user.yearsOfService < 0) {
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
      "Personal leave request is valid. Please ensure to submit your request for approval.",
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
