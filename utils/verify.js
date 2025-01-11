const verifySickLeave = (user, fromDate, toDate) => {
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

  const sickLeavesTaken = 0;

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

module.exports = { verifySickLeave };
