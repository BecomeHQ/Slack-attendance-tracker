const { Leave } = require("../models/holidays");
const {
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
} = require("../utils/verify");
const { User } = require("../models/user.js");
const e = require("express");
const { Attendance } = require("../models/checkin");
const { publicHolidaysList, restrictedHolidaysList } = require("../mode.js");

const applyLeave = async ({ command, ack, client, body }) => {
  await ack();

  try {
    const result = await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "leave_application_modal",
        title: {
          type: "plain_text",
          text: "Apply for Leave",
        },
        blocks: [
          {
            type: "input",
            block_id: "leave_type",
            element: {
              type: "static_select",
              placeholder: {
                type: "plain_text",
                text: "Select leave type",
              },
              options: [
                {
                  text: {
                    type: "plain_text",
                    text: "Sick Leave",
                  },
                  value: "Sick_Leave",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Restricted Holiday",
                  },
                  value: "Restricted_Holiday",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Burnout",
                  },
                  value: "Burnout",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Period Leaves",
                  },
                  value: "Period_Leaves",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Compensatory Leave",
                  },
                  value: "Compensatory_Leave",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Casual Leave",
                  },
                  value: "Casual_Leave",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Maternity Leave",
                  },
                  value: "Maternity_Leave",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Paternity Leave",
                  },
                  value: "Paternity_Leave",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Bereavement Leave",
                  },
                  value: "Bereavement_Leave",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Unpaid Leave",
                  },
                  value: "Unpaid_Leave",
                },
              ],
              action_id: "leave_type_select",
            },
            label: {
              type: "plain_text",
              text: "Leave Type",
            },
          },
          {
            type: "input",
            block_id: "dates",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select start date",
              },
              action_id: "start_date",
            },
            label: {
              type: "plain_text",
              text: "Start Date",
            },
          },
          {
            type: "input",
            block_id: "end_dates",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select end date",
              },
              action_id: "end_date",
            },
            label: {
              type: "plain_text",
              text: "End Date",
            },
          },
          {
            type: "input",
            block_id: "reason",
            element: {
              type: "plain_text_input",
              multiline: true,
              action_id: "reason_input",
            },
            label: {
              type: "plain_text",
              text: "Reason",
            },
          },
        ],
        submit: {
          type: "plain_text",
          text: "Submit",
        },
      },
    });
  } catch (error) {
    console.error(error);
  }
};

const leave_application_modal = async ({ ack, body, view, client }) => {
  await ack();

  const user = body.user.id;
  const fromDate = view.state.values.dates.start_date.selected_date;
  const toDate = view.state.values.end_dates.end_date.selected_date;
  const reason =
    view.state.values.reason.reason_input.value || "No reason provided";
  const type =
    view.state.values.leave_type.leave_type_select.selected_option?.value;

  let verificationResult;

  switch (type) {
    case "Sick_Leave":
      verificationResult = await verifySickLeave(user, fromDate, toDate);
      break;
    case "Burnout":
      verificationResult = await verifyBurnoutLeave(
        user,
        fromDate,
        toDate,
        reason
      );
      break;
    case "Restricted_Holiday":
      verificationResult = await verifyRestrictedHoliday(
        user,
        fromDate,
        toDate
      );
      break;
    case "Casual_Leave":
      verificationResult = await verifyCasualLeave(user, fromDate, toDate);
      break;
    case "Mensural_Leaves":
      verificationResult = await verifyMensuralLeave(user, fromDate, toDate);
      break;
    case "Maternity_Leave":
      verificationResult = await verifyMaternityLeave(user, fromDate, toDate);
      break;
    case "Paternity_Leave":
      verificationResult = await verifyPaternityLeave(user, fromDate, toDate);
      break;
    case "Bereavement_Leave":
      verificationResult = await verifyBereavementLeave(user, fromDate, toDate);
      break;
    case "Unpaid_Leave":
      verificationResult = await verifyUnpaidLeave(user, fromDate, toDate);
      break;
    case "Internship_Leave":
      verificationResult = await verifyInternshipLeave(user, fromDate, toDate);
      break;
    case "Personal_Leave":
      verificationResult = await verifyPersonalLeave(user, fromDate, toDate);
      break;
    default:
      verificationResult = { isValid: false, message: "Invalid leave type." };
  }

  if (!verificationResult || !verificationResult.isValid) {
    await client.chat.postMessage({
      channel: user,
      text: `${verificationResult?.message || "An unknown error occurred."}`,
    });
    return;
  }

  const leaveDetails = `
    *Leave Request Details:*
    *User:* <@${user}>
    *Leave Type:* ${type}
    *From:* ${fromDate}
    *To:* ${toDate}
    *Reason:* ${reason}
  `;

  try {
    const leave = new Leave({
      user,
      fromDate,
      toDate,
      reason,
      leaveType: type,
    });
    await leave.save();
    await client.chat.postMessage({
      channel: user,
      text: `:white_check_mark: Your leave request has been submitted for approval!\n\n${leaveDetails}`,
    });

    const adminUserId = process.env.ADMIN_USER_ID;
    await client.chat.postMessage({
      channel: adminUserId,
      text: `:bell: New leave request submitted!\n\n${leaveDetails}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:bell: New leave request submitted!\n\n${leaveDetails}`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Approve",
                emoji: true,
              },
              style: "primary",
              action_id: `approve_leave_${leave._id}`,
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Reject",
                emoji: true,
              },
              style: "danger",
              action_id: `reject_leave_${leave._id}`,
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error("Error saving leave to database:", error);
    await client.chat.postMessage({
      channel: user,
      text: `:x: There was an error submitting your leave request. Please try again later.`,
    });
  }
};

const manageLeaves = async ({ command, ack, client, body }) => {
  await ack();

  try {
    const pendingLeaves = await Leave.find({ status: "Pending" });

    if (pendingLeaves.length === 0) {
      await client.chat.postMessage({
        channel: body.user_id,
        text: "There are no pending leave requests at the moment.",
      });
      return;
    }

    const blocks = pendingLeaves
      .map((leave, index) => [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Leave Request ${index + 1}*\n*User:* <@${
              leave.user
            }>\n*From:* ${leave.fromDate}\n*To:* ${leave.toDate}\n*Reason:* ${
              leave.reason
            }`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Approve",
                emoji: true,
              },
              style: "primary",
              action_id: `approve_leave_${leave._id}`,
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Reject",
                emoji: true,
              },
              style: "danger",
              action_id: `reject_leave_${leave._id}`,
            },
          ],
        },
        {
          type: "divider",
        },
      ])
      .flat();

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "manage_leaves_modal",
        title: {
          type: "plain_text",
          text: "Manage Leave Requests",
        },
        blocks: blocks,
      },
    });
  } catch (error) {
    console.error("Error fetching pending leaves:", error);
    await client.chat.postMessage({
      channel: body.user_id,
      text: "An error occurred while fetching leave requests. Please try again.",
    });
  }
};

const approveLeave = async ({ ack, body, client, action }) => {
  await ack();
  const leaveId = action.action_id.split("_")[2];

  try {
    const leaveRequest = await Leave.findByIdAndUpdate(
      leaveId,
      { status: "Approved" },
      { new: true }
    );
    console.log(leaveRequest);

    if (!leaveRequest) {
      throw new Error("Leave request not found");
    }

    const user = await User.findOne({ slackId: leaveRequest.user });
    if (!user) {
      throw new Error("User not found");
    }

    const leaveDays = calculateLeaveDays(
      leaveRequest.fromDate,
      leaveRequest.toDate
    );
    console.log({ leaveDays });

    if (leaveRequest.leaveType === "Sick_Leave") {
      user.sickLeave = (user.sickLeave || 0) + leaveDays;
    } else if (leaveRequest.leaveType === "Burnout") {
      user.burnout = (user.burnout || 0) + leaveDays;
    } else if (leaveRequest.leaveType === "Paternity_Leave") {
      user.paternityLeave = (user.paternityLeave || 0) + leaveDays;
    } else if (leaveRequest.leaveType === "Casual_Leave") {
      user.casualLeave = (user.casualLeave || 0) + leaveDays;
    } else if (leaveRequest.leaveType === "Bereavement_Leave") {
      user.bereavementLeave = (user.bereavementLeave || 0) + leaveDays;
    } else if (leaveRequest.leaveType === "Restricted_Holiday") {
      user.restrictedHoliday = (user.restrictedHoliday || 0) + leaveDays;
    } else if (leaveRequest.leaveType === "Mensural_Leaves") {
      user.mensuralLeaves = (user.mensuralLeaves || 0) + leaveDays;
    } else if (leaveRequest.leaveType === "Maternity_Leave") {
      user.maternityLeave = (user.maternityLeave || 0) + leaveDays;
    } else if (leaveRequest.leaveType === "Unpaid_Leave") {
      user.unpaidLeave = (user.unpaidLeave || 0) + leaveDays;
    } else if (leaveRequest.leaveType === "WFH") {
      user.wfh = (user.wfh || 0) + leaveDays;
    } else if (leaveRequest.leaveType === "Half_Sick_Leave") {
      user.halfSickLeave = (user.halfSickLeave || 0) + leaveDays;
    } else if (leaveRequest.leaveType === "Half_Restricted_Holiday") {
      user.halfRestrictedHoliday =
        (user.halfRestrictedHoliday || 0) + leaveDays;
    } else if (leaveRequest.leaveType === "Half_Burnout") {
      user.halfBurnout = (user.halfBurnout || 0) + leaveDays;
    } else if (leaveRequest.leaveType === "Half_Period_Leaves") {
      user.halfPeriodLeaves = (user.halfPeriodLeaves || 0) + leaveDays;
    } else if (leaveRequest.leaveType === "Half_Compensatory_Leave") {
      user.halfCompensatoryLeave =
        (user.halfCompensatoryLeave || 0) + leaveDays;
    } else if (leaveRequest.leaveType === "Half_Casual_Leave") {
      user.halfCasualLeave = (user.halfCasualLeave || 0) + leaveDays;
    } else if (leaveRequest.leaveType === "Half_Maternity_Leave") {
      user.halfMaternityLeave = (user.halfMaternityLeave || 0) + leaveDays;
    } else if (leaveRequest.leaveType === "Half_Paternity_Leave") {
      user.halfPaternityLeave = (user.halfPaternityLeave || 0) + leaveDays;
    }

    await user.save();

    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: `Leave request for <@${leaveRequest.user}> has been approved and removed from the list.`,
      blocks: [],
    });

    await client.chat.postMessage({
      channel: leaveRequest.user,
      text: `Your leave request from ${leaveRequest.fromDate} to ${leaveRequest.toDate} has been approved! ✅`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Your leave request has been *approved*! ✅\n\n*Duration:* ${leaveRequest.fromDate} to ${leaveRequest.toDate}\n*Reason:* ${leaveRequest.reason}`,
          },
        },
      ],
    });
  } catch (error) {
    console.error("Error approving leave:", error);
    await client.chat.postMessage({
      channel: body.user.id,
      text: "An error occurred while approving the leave request. Please try again.",
    });
  }
};

const calculateLeaveDays = (fromDate, toDate) => {
  const start = new Date(fromDate);
  const end = new Date(toDate);
  const timeDiff = end - start;
  return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
};

const rejectLeave = async ({ ack, body, client, action }) => {
  await ack();
  const leaveId = action.action_id.split("_")[2];

  try {
    const leaveRequest = await Leave.findByIdAndUpdate(
      leaveId,
      { status: "Rejected" },
      { new: true }
    );

    if (!leaveRequest) {
      throw new Error("Leave request not found");
    }

    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: `Leave request for <@${leaveRequest.user}> has been rejected and removed from the list.`,
      blocks: [],
    });

    await client.chat.postMessage({
      channel: leaveRequest.user,
      text: `Your leave request from ${leaveRequest.fromDate} to ${leaveRequest.toDate} has been rejected.`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Your leave request has been *rejected* ❌\n\n*Duration:* ${leaveRequest.fromDate} to ${leaveRequest.toDate}\n\nPlease contact your supervisor for more information.`,
          },
        },
      ],
    });
  } catch (error) {
    console.error("Error rejecting leave:", error);
    await client.chat.postMessage({
      channel: body.user.id,
      text: "An error occurred while rejecting the leave request. Please try again.",
    });
  }
};

const checkIn = async ({ command, ack, client, body }) => {
  await ack();

  console.log("Body received in checkIn:", body);

  const userId = body.user_id;
  if (!userId) {
    console.error("User ID is undefined. Cannot check in.");
    await client.chat.postMessage({
      channel: body.channel_id,
      text: "There was an error checking you in. Please try again.",
    });
    return;
  }

  const now = new Date();
  const time = now.toTimeString().split(" ")[0]; // Get time in hr:min:seconds format (24 hr format)

  const formattedDate = now.toISOString().split("T")[0];
  const attendance = new Attendance({
    user: userId,
    checkinTime: `${time}`,
    checkoutTime: null,
    date: formattedDate.split("T")[0],
  });

  try {
    await attendance.save();
    await client.chat.postMessage({
      channel: userId,
      text: `You have checked in at ${now.toLocaleTimeString()}.`,
    });
  } catch (error) {
    console.error("Error saving check-in:", error);
    await client.chat.postMessage({
      channel: userId,
      text: "There was an error checking you in. Please try again.",
    });
  }
};

const checkOut = async ({ ack, body, client }) => {
  await ack();

  console.log("Body received in checkOut:", body);

  const userId = body.user_id;
  const now = new Date();
  const time = now.toTimeString().split(" ")[0]; // Get time in hr:min:seconds format (24 hr format)

  try {
    const attendance = await Attendance.findOne({
      user: userId,
      date: now.toISOString().split("T")[0],
    }).sort({ checkinTime: -1 });

    if (!attendance) {
      await client.chat.postMessage({
        channel: userId,
        text: "You have not checked in today.",
      });
      return;
    }

    attendance.checkoutTime = time;
    await attendance.save();

    await client.chat.postMessage({
      channel: userId,
      text: `You have checked out at ${now.toLocaleTimeString()}.`,
    });
  } catch (error) {
    console.error("Error saving check-out:", error);
    await client.chat.postMessage({
      channel: userId,
      text: "There was an error checking you out. Please try again.",
    });
  }
};

const onLeave = async ({ command, ack, client, body }) => {
  await ack();

  const today = new Date().toISOString().split("T")[0];

  try {
    const leavesToday = await Leave.find({
      fromDate: { $lte: today },
      toDate: { $gte: today },
      status: "Approved",
    });

    if (leavesToday.length === 0) {
      await client.chat.postMessage({
        channel: body.user_id,
        text: "No users are on leave today.",
      });
      return;
    }

    const leaveDetails = leavesToday
      .map((leave) => {
        return `*User:* <@${leave.user}>\n*From:* ${leave.fromDate}\n*To:* ${leave.toDate}\n*Reason:* ${leave.reason}`;
      })
      .join("\n\n");

    await client.chat.postMessage({
      channel: body.user_id,
      text: `*Users on leave today:*\n\n${leaveDetails}`,
    });
  } catch (error) {
    console.error("Error fetching leaves for today:", error);
    await client.chat.postMessage({
      channel: body.user_id,
      text: "An error occurred while fetching leave information. Please try again.",
    });
  }
};

const checkBalance = async ({ command, ack, client, body }) => {
  await ack();

  const userId = body.user_id;

  try {
    const user = await User.findOne({ slackId: userId });

    if (!user) {
      await client.chat.postMessage({
        channel: userId,
        text: "User not found. Please ensure your Slack ID is registered.",
      });
      return;
    }

    const totalLeaves = {
      sickLeave: 12,
      restrictedHoliday: 6,
      burnout: 6,
      mensuralLeaves: 18,
      casualLeave: 6,
      maternityLeave: 13,
      unpaidLeave: 20,
      paternityLeave: 20,
      bereavementLeave: 5,
    };

    const leaveBalances = {
      sickLeave: totalLeaves.sickLeave - user.sickLeave,
      restrictedHoliday: totalLeaves.restrictedHoliday - user.restrictedHoliday,
      burnout: totalLeaves.burnout - user.burnout,
      mensuralLeaves: totalLeaves.mensuralLeaves - user.mensuralLeaves,
      casualLeave: totalLeaves.casualLeave - user.casualLeave,
      maternityLeave: totalLeaves.maternityLeave - user.maternityLeave,
      unpaidLeave: totalLeaves.unpaidLeave - user.unpaidLeave,
      paternityLeave: totalLeaves.paternityLeave - user.paternityLeave,
      bereavementLeave: totalLeaves.bereavementLeave - user.bereavementLeave,
    };

    const leaveBalanceMessage = `
      *Leave Balances:*
      - Sick Leave: ${leaveBalances.sickLeave} days remaining
      - Restricted Holiday: ${leaveBalances.restrictedHoliday} days remaining
      - Burnout: ${leaveBalances.burnout} days remaining
      - Mensural Leaves: ${leaveBalances.mensuralLeaves} days remaining
      - Casual Leave: ${leaveBalances.casualLeave} days remaining
      - Maternity Leave: ${leaveBalances.maternityLeave} weeks remaining
      - Unpaid Leave: ${leaveBalances.unpaidLeave} days remaining
      - Paternity Leave: ${leaveBalances.paternityLeave} days remaining
      - Bereavement Leave: ${leaveBalances.bereavementLeave} days remaining
    `;

    await client.chat.postMessage({
      channel: userId,
      text: leaveBalanceMessage,
    });
  } catch (error) {
    console.error("Error fetching leave balances:", error);
    await client.chat.postMessage({
      channel: userId,
      text: "An error occurred while fetching your leave balances. Please try again.",
    });
  }
};

const showUpcomingHolidays = async ({ command, ack, client, body }) => {
  await ack();

  const today = new Date();
  const upcomingPublicHolidays = publicHolidaysList.filter(
    (holiday) => holiday.date >= today
  );
  const upcomingRestrictedHolidays = restrictedHolidaysList.filter(
    (holiday) => holiday.date >= today
  );

  const formatHolidays = (holidays) =>
    holidays
      .map((holiday) => `*${holiday.name}* - ${holiday.date.toDateString()}`)
      .join("\n");

  const publicHolidaysText = formatHolidays(upcomingPublicHolidays);
  const restrictedHolidaysText = formatHolidays(upcomingRestrictedHolidays);

  const message = `
    *Upcoming Public Holidays:*\n${publicHolidaysText || "None"}
    \n\n*Upcoming Restricted Holidays:*\n${restrictedHolidaysText || "None"}
  `;

  try {
    await client.chat.postMessage({
      channel: body.user_id,
      text: message,
    });
  } catch (error) {
    console.error("Error sending upcoming holidays:", error);
    await client.chat.postMessage({
      channel: body.user_id,
      text: "An error occurred while fetching upcoming holidays. Please try again.",
    });
  }
};

const upcomingLeaves = async ({ command, ack, client, body }) => {
  await ack();

  const today = new Date().toISOString().split("T")[0];
  console.log("Today's date:", today);

  try {
    const upcomingLeaves = await Leave.find({
      fromDate: { $gte: today },
      status: "Approved",
    });

    console.log("Upcoming leaves found:", upcomingLeaves);

    if (upcomingLeaves.length === 0) {
      await client.chat.postMessage({
        channel: body.user_id,
        text: "There are no upcoming leaves.",
      });
      return;
    }

    const leaveDetails = upcomingLeaves
      .map((leave) => {
        return `*User:* <@${leave.user}>\n*From:* ${leave.fromDate}\n*To:* ${leave.toDate}\n*Reason:* ${leave.reason}`;
      })
      .join("\n\n");

    await client.chat.postMessage({
      channel: body.user_id,
      text: `*Upcoming Leaves:*\n\n${leaveDetails}`,
    });
  } catch (error) {
    console.error("Error fetching upcoming leaves:", error);
    await client.chat.postMessage({
      channel: body.user_id,
      text: "An error occurred while fetching upcoming leaves. Please try again.",
    });
  }
};

module.exports = {
  leave_application_modal,
  applyLeave,
  manageLeaves,
  approveLeave,
  rejectLeave,
  checkIn,
  checkOut,
  onLeave,
  checkBalance,
  showUpcomingHolidays,
  upcomingLeaves,
};
