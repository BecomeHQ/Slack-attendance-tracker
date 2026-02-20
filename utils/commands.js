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
  verifyWFHLeave,
} = require("../utils/verify");
const { User } = require("../models/user.js");
const { Attendance } = require("../models/checkin");
const { publicHolidaysList, restrictedHolidaysList } = require("../mode.js");
const app = require("../utils/slack-instance.js");
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const options = { day: "numeric", month: "short", year: "numeric" };
  return date.toLocaleDateString("en-US", options);
};

const calculateLeaveDays = (dates) => {
  if (!Array.isArray(dates) || dates.length === 0) {
    return 0;
  }
  return dates.length;
};

const isWeekendOrPublicHoliday = (date) => {
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const isPublicHoliday =
    Array.isArray(publicHolidaysList) &&
    publicHolidaysList.some(
      (holiday) => holiday.date.getTime() === date.getTime()
    );
  return isWeekend || isPublicHoliday;
};

/** Fetch Slack user's full/real name so leave requests show FULL NAME (not username). */
const getSlackUserDisplayName = async (client, userId) => {
  try {
    const result = await client.users.info({ user: userId });
    const u = result?.user;
    return u?.real_name || u?.profile?.real_name || u?.name || u?.username || null;
  } catch (e) {
    return null;
  }
};

const applyLeave = async ({ command, ack, client, body }) => {
  await ack();

  try {
    const userId = body.user_id;
    const leaveType = command.text;

    if (leaveType === "Sick_Leave") {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: "modal",
          callback_id: "sick_leave_application_modal",
          title: {
            type: "plain_text",
            text: "Apply for Sick Leave",
          },
          blocks: [
            {
              type: "actions",
              block_id: "add_dates",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "Add Dates",
                  },
                  action_id: "add_dates_button",
                },
              ],
            },
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
                      text: "Full Day",
                    },
                    value: "Full_Day",
                  },
                  {
                    text: {
                      type: "plain_text",
                      text: "Half Day",
                    },
                    value: "Half_Day",
                  },
                ],
                action_id: "leave_type_select",
              },
              label: {
                type: "plain_text",
                text: "Type",
              },
            },
            {
              type: "input",
              block_id: "half_day",
              element: {
                type: "static_select",
                placeholder: {
                  type: "plain_text",
                  text: "Select half",
                },
                options: [
                  {
                    text: {
                      type: "plain_text",
                      text: "First Half",
                    },
                    value: "First_Half",
                  },
                  {
                    text: {
                      type: "plain_text",
                      text: "Second Half",
                    },
                    value: "Second_Half",
                  },
                ],
                action_id: "half_day_select",
              },
              label: {
                type: "plain_text",
                text: "Half Day",
              },
              optional: true, // Make this optional
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
    }
  } catch (error) {
    console.error(error);
  }
};

const openLeaveTypeModal = async ({ ack, body, client }) => {
  await ack();
  try {
    const userId = body.user_id;
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
        casualLeave: 8,
        burnout: 8,
        mensuralLeaves: 18,
        unpaidLeave: 20,
        internshipLeave: 10,
        wfhLeave: 10,
        bereavementLeave: 5,
        maternityLeave: 65, // 13 weeks
        paternityLeave: 20,
        restrictedHoliday: 4,
      };

    const leaveBalances = {
      sickLeave: totalLeaves.sickLeave - (user.sickLeave || 0),
      casualLeave: totalLeaves.casualLeave - (user.casualLeave || 0),
      burnout: totalLeaves.burnout - (user.burnout || 0),
      mensuralLeaves: totalLeaves.mensuralLeaves - (user.mensuralLeaves || 0),
      unpaidLeave: totalLeaves.unpaidLeave - (user.unpaidLeave || 0),
      internshipLeave:
        totalLeaves.internshipLeave - (user.internshipLeave || 0),
      wfhLeave: totalLeaves.wfhLeave - (user.wfhLeave || 0),
      bereavementLeave:
        totalLeaves.bereavementLeave - (user.bereavementLeave || 0),
      maternityLeave: totalLeaves.maternityLeave - (user.maternityLeave || 0),
      paternityLeave: totalLeaves.paternityLeave - (user.paternityLeave || 0),
      restrictedHoliday:
        totalLeaves.restrictedHoliday - (user.restrictedHoliday || 0),
    };

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "leave_type_modal",
        title: {
          type: "plain_text",
          text: "Select Leave Type",
        },
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "Please select the type of leave you want to apply for:",
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: `Sick Leave (${leaveBalances.sickLeave})`,
                },
                value: "sick_leave",
                action_id: "select_sick_leave",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: `Casual Leave (${leaveBalances.casualLeave})`,
                },
                value: "casual_leave",
                action_id: "select_casual_leave",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: `Burnout Leave (${leaveBalances.burnout})`,
                },
                value: "burnout_leave",
                action_id: "select_burnout_leave",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: `Mensural Leave (${leaveBalances.mensuralLeaves})`,
                },
                value: "mensural_leave",
                action_id: "select_mensural_leave",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: `Unpaid Leave (${leaveBalances.unpaidLeave})`,
                },
                value: "unpaid_leave",
                action_id: "select_unpaid_leave",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: `Internship Leave (${leaveBalances.internshipLeave})`,
                },
                value: "internship_leave",
                action_id: "select_internship_leave",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: `Work-from-Home Leave (${leaveBalances.wfhLeave})`,
                },
                value: "workfrom_home_leave",
                action_id: "select_workhome_leave",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: `Bereavement Leave (${leaveBalances.bereavementLeave})`,
                },
                action_id: "select_bereavement_leave",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: `Maternity Leave (${leaveBalances.maternityLeave})`,
                },
                action_id: "select_maternity_leave",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: `Paternity Leave (${leaveBalances.paternityLeave})`,
                },
                action_id: "select_paternity_leave",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: `Restricted Leave (${leaveBalances.restrictedHoliday})`,
                },
                action_id: "select_restricted_leave",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Compensatory Leave",
                },
                action_id: "select_compensatory_leave",
              },
            ],
          },
        ],
      },
    });
  } catch (error) {
    console.error("Error opening leave type modal:", error);
  }
};

const handleAddMoreDays = async ({ ack, body, client, action }) => {
  await ack();
  try {
    await client.views.update({
      view_id: body.view.id,
      view: {
        type: "modal",
        callback_id: "date_selection_modal",
        title: {
          type: "plain_text",
          text: "Select Dates",
        },
        blocks: [
          {
            type: "input",
            block_id: "dates_1",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select a date",
              },
              action_id: "date_select_1",
            },
            label: {
              type: "plain_text",
              text: "Date 1",
            },
          },
          {
            type: "input",
            block_id: "leave_type_1",
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
                    text: "Full Day",
                  },
                  value: "Full_Day",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Half Day",
                  },
                  value: "Half_Day",
                },
              ],
              action_id: "leave_type_select_1",
            },
            label: {
              type: "plain_text",
              text: "Type",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "half_day_1",
            element: {
              type: "static_select",
              placeholder: {
                type: "plain_text",
                text: "Select half",
              },
              options: [
                {
                  text: {
                    type: "plain_text",
                    text: "First Half",
                  },
                  value: "First_Half",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Second Half",
                  },
                  value: "Second_Half",
                },
              ],
              action_id: "half_day_select_1",
            },
            label: {
              type: "plain_text",
              text: "Half Day",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "dates_2",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select a date",
              },
              action_id: "date_select_2",
            },
            label: {
              type: "plain_text",
              text: "Date 2",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "leave_type_2",
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
                    text: "Full Day",
                  },
                  value: "Full_Day",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Half Day",
                  },
                  value: "Half_Day",
                },
              ],
              action_id: "leave_type_select_2",
            },
            label: {
              type: "plain_text",
              text: "Type",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "half_day_2",
            element: {
              type: "static_select",
              placeholder: {
                type: "plain_text",
                text: "Select half",
              },
              options: [
                {
                  text: {
                    type: "plain_text",
                    text: "First Half",
                  },
                  value: "First_Half",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Second Half",
                  },
                  value: "Second_Half",
                },
              ],
              action_id: "half_day_select_2",
            },
            label: {
              type: "plain_text",
              text: "Half Day",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "dates_3",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select a date",
              },
              action_id: "date_select_3",
            },
            label: {
              type: "plain_text",
              text: "Date 3",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "leave_type_3",
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
                    text: "Full Day",
                  },
                  value: "Full_Day",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Half Day",
                  },
                  value: "Half_Day",
                },
              ],
              action_id: "leave_type_select_3",
            },
            label: {
              type: "plain_text",
              text: "Type",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "half_day_3",
            element: {
              type: "static_select",
              placeholder: {
                type: "plain_text",
                text: "Select half",
              },
              options: [
                {
                  text: {
                    type: "plain_text",
                    text: "First Half",
                  },
                  value: "First_Half",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Second Half",
                  },
                  value: "Second_Half",
                },
              ],
              action_id: "half_day_select_3",
            },
            label: {
              type: "plain_text",
              text: "Half Day",
            },
            optional: true,
          },
        ],
        submit: {
          type: "plain_text",
          text: "Done",
        },
      },
    });
  } catch (error) {
    console.error("Error opening add dates modal:", error);
  }
};

const handleDateSelectionSubmission = async ({ ack, body, view, client }) => {
  await ack();
  console.log("View ID:", body.view.id);

  const selectedDates1 = view.state.values.dates_1.date_select_1.selected_date;
  const leaveType1 =
    view.state.values.leave_type_1.leave_type_select_1.selected_option?.value ||
    "Full_Day";
  const halfDay1 =
    leaveType1 === "Half_Day"
      ? view.state.values.half_day_1.half_day_select_1.selected_option?.value
      : null;

  const selectedDates2 = view.state.values.dates_2.date_select_2.selected_date;
  const leaveType2 =
    view.state.values.leave_type_2.leave_type_select_2.selected_option?.value ||
    "Full_Day";
  const halfDay2 =
    leaveType2 === "Half_Day"
      ? view.state.values.half_day_2.half_day_select_2.selected_option?.value
      : null;

  const selectedDates3 = view.state.values.dates_3.date_select_3.selected_date;
  const leaveType3 =
    view.state.values.leave_type_3.leave_type_select_3.selected_option?.value ||
    "Full_Day";
  const halfDay3 =
    leaveType3 === "Half_Day"
      ? view.state.values.half_day_3.half_day_select_3.selected_option?.value
      : null;

  const leaveDetails = [];

  if (selectedDates1 && leaveType1) {
    leaveDetails.push(
      `*Date:* ${selectedDates1}\n*Type:* ${leaveType1}\n*Half Day:* ${
        halfDay1 || "N/A"
      }`
    );
  }
  if (selectedDates2 && leaveType2) {
    leaveDetails.push(
      `*Date:* ${selectedDates2}\n*Type:* ${leaveType2}\n*Half Day:* ${
        halfDay2 || "N/A"
      }`
    );
  }
  if (selectedDates3 && leaveType3) {
    leaveDetails.push(
      `*Date:* ${selectedDates3 || "N/A"}\n*Type:* ${leaveType3}\n*Half Day:* ${
        halfDay3 || "N/A"
      }`
    );
  }

  if (leaveDetails.length === 0) {
    console.error("No dates selected.");
    return;
  }

  console.log(leaveDetails.join("\n\n"));

  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "sick_leave_application_modal",
        title: {
          type: "plain_text",
          text: "Apply for Sick Leave",
        },
        blocks: [
          {
            type: "input",
            block_id: "selected_dates",
            element: {
              type: "plain_text_input",
              action_id: "selected_dates_input",
              initial_value: selectedDates1, // Changed to selectedDates1 for clarity
              multiline: false,
            },
            label: {
              type: "plain_text",
              text: "Selected Dates",
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Selected Dates:*\n${leaveDetails.join("\n\n")}`, // Ensure proper formatting
            },
          },
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
                    text: "Full Day",
                  },
                  value: "Full_Day",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Half Day",
                  },
                  value: "Half_Day",
                },
              ],
              action_id: "leave_type_select",
            },
            label: {
              type: "plain_text",
              text: "Type",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "half_day",
            element: {
              type: "static_select",
              placeholder: {
                type: "plain_text",
                text: "Select half",
              },
              options: [
                {
                  text: {
                    type: "plain_text",
                    text: "First Half",
                  },
                  value: "First_Half",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Second Half",
                  },
                  value: "Second_Half",
                },
              ],
              action_id: "half_day_select",
            },
            label: {
              type: "plain_text",
              text: "Half Day",
            },
            optional: true,
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
            optional: true,
          },
        ],
        submit: {
          type: "plain_text",
          text: "Submit",
        },
      },
    });
  } catch (error) {
    console.error("Error opening modal with selected dates:", error);
  }
};

const rejectLeave = async ({ ack, body, client, action }) => {
  await ack();
  const leaveId = action.action_id.split("_")[2];

  if (!leaveId) {
    console.error("Leave ID is undefined.");
    await client.chat.postMessage({
      channel: body.user.id,
      text: "An error occurred while rejecting the leave request. Please try again.",
    });
    return;
  }

  try {
    const leaveRequest = await Leave.findById(leaveId);

    if (!leaveRequest) {
      throw new Error("Leave request not found");
    }

    const userName =
      (await getSlackUserDisplayName(client, leaveRequest.user)) ||
      leaveRequest.user;

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "reject_leave_reason_modal",
        private_metadata: JSON.stringify({
          leaveId,
          channelId: body.channel.id,
          messageTs: body.message.ts,
        }),
        title: {
          type: "plain_text",
          text: "Reject Leave Request",
        },
        submit: {
          type: "plain_text",
          text: "Submit",
        },
        close: {
          type: "plain_text",
          text: "Cancel",
        },
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `You are rejecting a leave request from *<@${leaveRequest.user}>* (${userName}).\n\n*Duration:* ${formatDate(
                formatDate(leaveRequest.dates[0])
              )} to ${formatDate(
                formatDate(
                  leaveRequest.dates[leaveRequest.dates.length - 1]
                )
              )}\n*Leave Type:* ${leaveRequest.leaveType}`,
            },
          },
          {
            type: "input",
            block_id: "rejection_reason_block",
            element: {
              type: "plain_text_input",
              action_id: "rejection_reason_input",
              multiline: true,
              placeholder: {
                type: "plain_text",
                text: "Provide a clear reason for rejecting this leave request",
              },
            },
            label: {
              type: "plain_text",
              text: "Rejection reason (required)",
            },
          },
        ],
      },
    });
  } catch (error) {
    console.error("Error opening rejection modal:", error);
    await client.chat.postMessage({
      channel: body.user.id,
      text: "An error occurred while opening the rejection form. Please try again.",
    });
  }
};

const handleRejectLeaveReasonSubmission = async ({ ack, body, view, client }) => {
  const { leaveId, channelId, messageTs } = JSON.parse(
    view.private_metadata || "{}"
  );

  const rejectionReason =
    view.state.values.rejection_reason_block.rejection_reason_input.value?.trim() ||
    "";

  if (!leaveId) {
    await ack();
    console.error("Leave ID missing in rejection modal submission.");
    await client.chat.postMessage({
      channel: body.user.id,
      text: "Unable to process this rejection because the leave ID was missing. Please try again.",
    });
    return;
  }

  if (!rejectionReason) {
    await ack({
      response_action: "errors",
      errors: {
        rejection_reason_block: "Please provide a reason for rejecting this leave.",
      },
    });
    return;
  }

  await ack();

  try {
    const leaveRequest = await Leave.findByIdAndUpdate(
      leaveId,
      { status: "Rejected" },
      { new: true }
    );

    if (!leaveRequest) {
      throw new Error("Leave request not found while saving rejection reason");
    }

    if (channelId && messageTs) {
      await client.chat.update({
        channel: channelId,
        ts: messageTs,
        text: `Leave request for <@${leaveRequest.user}> has been rejected and removed from the list.`,
        blocks: [],
      });
    }

    await client.chat.postMessage({
      channel: leaveRequest.user,
      text: `Your leave request from ${formatDate(
        formatDate(leaveRequest.dates[0])
      )} to ${formatDate(
        formatDate(leaveRequest.dates[leaveRequest.dates.length - 1])
      )} has been rejected.`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Your leave request has been *rejected* ❌\n\n*Duration:* ${formatDate(
              formatDate(leaveRequest.dates[0])
            )} to ${formatDate(
              formatDate(
                leaveRequest.dates[leaveRequest.dates.length - 1]
              )
            )}\n*Leave Type:* ${
              leaveRequest.leaveType
            }\n*Reason for rejection:* ${rejectionReason}`,
          },
        },
      ],
    });

    await client.chat.postMessage({
      channel: body.user.id,
      text: "The leave request has been rejected and the reason has been shared with the applicant.",
    });
  } catch (error) {
    console.error("Error processing leave rejection:", error);
    await client.chat.postMessage({
      channel: body.user.id,
      text: "An error occurred while rejecting the leave request. Please try again.",
    });
  }
};

const handleLeaveTypeSelection = async ({ ack, body, client }) => {
  await ack();
  const action = body.actions[0];
  console.log((action));

  if (action.action_id === "select_sick_leave") {
    await client.views.update({
      view_id: body.view.id,
      view: {
        type: "modal",
        callback_id: "sick_leave_application_modal",
        title: {
          type: "plain_text",
          text: "Apply for Sick Leave",
        },
        blocks: [
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "*Sick Leaves:* Can avail immediately. For leaves exceeding 3 days, a medical certificate is required.",
              },
            ],
          },
          {
            type: "input",
            block_id: "dates_1",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date",
              },
              action_id: "date_select_1",
            },
            label: {
              type: "plain_text",
              text: "Date 1",
            },
          },
          {
            type: "input",
            block_id: "leave_type_1",
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
                    text: "Full Day",
                  },
                  value: "Full_Day",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "First Half",
                  },
                  value: "First_Half",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Second Half",
                  },
                  value: "Second_Half",
                },
              ],
              action_id: "leave_type_select_1",
            },
            label: {
              type: "plain_text",
              text: "Type",
            },
          },
          {
            type: "input",
            block_id: "dates_2",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date",
              },
              action_id: "date_select_2",
            },
            label: {
              type: "plain_text",
              text: "Date 2",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "leave_type_2",
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
                    text: "Full Day",
                  },
                  value: "Full_Day",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "First Half",
                  },
                  value: "First_Half",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Second Half",
                  },
                  value: "Second_Half",
                },
              ],
              action_id: "leave_type_select_2",
            },
            label: {
              type: "plain_text",
              text: "Type",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "dates_3",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date",
              },
              action_id: "date_select_3",
            },
            label: {
              type: "plain_text",
              text: "Date 3",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "leave_type_3",
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
                    text: "Full Day",
                  },
                  value: "Full_Day",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "First Half",
                  },
                  value: "First_Half",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Second Half",
                  },
                  value: "Second_Half",
                },
              ],
              action_id: "leave_type_select_3",
            },
            label: {
              type: "plain_text",
              text: "Type",
            },
            optional: true,
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
  } else if (action.action_id === "select_casual_leave") {
    await client.views.update({
      view_id: body.view.id,
      view: {
        type: "modal",
        callback_id: "casual_leave_application_modal",
        title: {
          type: "plain_text",
          text: "Apply for Casual Leave",
        },
        blocks: [
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "*Casual Leaves:* 1.5 days will be restored every month.",
              },
            ],
          },
          {
            type: "input",
            block_id: "dates_1",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date",
              },
              action_id: "date_select_1",
            },
            label: {
              type: "plain_text",
              text: "Date 1",
            },
          },
          {
            type: "input",
            block_id: "leave_type_1",
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
                    text: "Full Day",
                  },
                  value: "Full_Day",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "First Half",
                  },
                  value: "First_Half",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Second Half",
                  },
                  value: "Second_Half",
                },
              ],
              action_id: "leave_type_select_1",
            },
            label: {
              type: "plain_text",
              text: "Type",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "dates_2",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date",
              },
              action_id: "date_select_2",
            },
            label: {
              type: "plain_text",
              text: "Date 2",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "leave_type_2",
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
                    text: "Full Day",
                  },
                  value: "Full_Day",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "First Half",
                  },
                  value: "First_Half",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Second Half",
                  },
                  value: "Second_Half",
                },
              ],
              action_id: "leave_type_select_2",
            },
            label: {
              type: "plain_text",
              text: "Type",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "dates_3",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date",
              },
              action_id: "date_select_3",
            },
            label: {
              type: "plain_text",
              text: "Date 3",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "leave_type_3",
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
                    text: "Full Day",
                  },
                  value: "Full_Day",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "First Half",
                  },
                  value: "First_Half",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Second Half",
                  },
                  value: "Second_Half",
                },
              ],
              action_id: "leave_type_select_3",
            },
            label: {
              type: "plain_text",
              text: "Type",
            },
            optional: true,
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
  } else if (action.action_id === "select_burnout_leave") {
    await client.views.update({
      view_id: body.view.id,
      view: {
        type: "modal",
        callback_id: "burnout_leave_application_modal",
        title: {
          type: "plain_text",
          text: "Apply for Burnout Leave",
        },
        blocks: [
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "*Burnout Leave:* Can avail immediately. Rest and recover soon.",
              },
            ],
          },
          {
            type: "input",
            block_id: "dates_1",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select start date",
              },
              action_id: "start_date_select",
            },
            label: {
              type: "plain_text",
              text: "Start Date",
            },
          },
          {
            type: "input",
            block_id: "dates_2",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select end date",
              },
              action_id: "end_date_select",
            },
            label: {
              type: "plain_text",
              text: "End Date",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "leave_type_1",
            element: {
              type: "static_select",
              placeholder: {
                type: "plain_text",
                text: "Select leave type for Date 1",
              },
              options: [
                {
                  text: { type: "plain_text", text: "Full Day" },
                  value: "Full_Day",
                },
                {
                  text: { type: "plain_text", text: "Half Day" },
                  value: "Half_Day",
                },
              ],
              action_id: "leave_type_select_1",
            },
            label: {
              type: "plain_text",
              text: "Type (Date 1)",
            },
          },
          {
            type: "input",
            block_id: "half_day_1",
            element: {
              type: "static_select",
              placeholder: {
                type: "plain_text",
                text: "Select half",
              },
              options: [
                {
                  text: { type: "plain_text", text: "First Half" },
                  value: "First_Half",
                },
                {
                  text: { type: "plain_text", text: "Second Half" },
                  value: "Second_Half",
                },
              ],
              action_id: "half_day_select_1",
            },
            label: {
              type: "plain_text",
              text: "Half Day (Date 1)",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "leave_type_2",
            element: {
              type: "static_select",
              placeholder: {
                type: "plain_text",
                text: "Select leave type for Date 2",
              },
              options: [
                {
                  text: { type: "plain_text", text: "Full Day" },
                  value: "Full_Day",
                },
                {
                  text: { type: "plain_text", text: "Half Day" },
                  value: "Half_Day",
                },
              ],
              action_id: "leave_type_select_2",
            },
            label: {
              type: "plain_text",
              text: "Type (Date 2)",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "half_day_2",
            element: {
              type: "static_select",
              placeholder: {
                type: "plain_text",
                text: "Select half",
              },
              options: [
                {
                  text: { type: "plain_text", text: "First Half" },
                  value: "First_Half",
                },
                {
                  text: { type: "plain_text", text: "Second Half" },
                  value: "Second_Half",
                },
              ],
              action_id: "half_day_select_2",
            },
            label: {
              type: "plain_text",
              text: "Half Day (Date 2)",
            },
            optional: true,
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
  } else if (action.action_id === "select_mensural_leave") {
    await client.views.update({
      view_id: body.view.id,
      view: {
        type: "modal",
        callback_id: "mensural_leave_application_modal",
        title: {
          type: "plain_text",
          text: "Apply for Mensural Leave",
        },
        blocks: [
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "*Menstrual Leave:* Supportive leave policy for menstrual health.",
              },
            ],
          },
          {
            type: "input",
            block_id: "dates_1",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date",
              },
              action_id: "date_select_1",
            },
            label: {
              type: "plain_text",
              text: "Date 1",
            },
          },
          {
            type: "input",
            block_id: "leave_type_1",
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
                    text: "Full Day",
                  },
                  value: "Full_Day",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "First Half",
                  },
                  value: "First_Half",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Second Half",
                  },
                  value: "Second_Half",
                },
              ],
              action_id: "leave_type_select_1",
            },
            label: {
              type: "plain_text",
              text: "Leave Type",
            },
          },
          {
            type: "input",
            block_id: "dates_2",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date",
              },
              action_id: "date_select_2",
            },
            label: {
              type: "plain_text",
              text: "Date 2",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "leave_type_2",
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
                    text: "Full Day",
                  },
                  value: "Full_Day",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "First Half",
                  },
                  value: "First_Half",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Second Half",
                  },
                  value: "Second_Half",
                },
              ],
              action_id: "leave_type_select_2",
            },
            label: {
              type: "plain_text",
              text: "Leave Type",
            },
            optional: true,
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
  } else if (action.action_id === "select_unpaid_leave") {
    await client.views.update({
      view_id: body.view.id,
      view: {
        type: "modal",
        callback_id: "unpaid_leave_application_modal",
        title: {
          type: "plain_text",
          text: "Apply for Unpaid Leave",
        },
        blocks: [
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "*Unpaid Leave:* Includes Sabbatical and Marriage Leave. Taken when no other leave balance is available.",
              },
            ],
          },
          {
            type: "input",
            block_id: "dates_1",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date",
              },
              action_id: "date_select_1",
            },
            label: {
              type: "plain_text",
              text: "Date 1",
            },
          },
          {
            type: "input",
            block_id: "leave_type_1",
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
                    text: "Full Day",
                  },
                  value: "Full_Day",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "First Half",
                  },
                  value: "First_Half",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Second Half",
                  },
                  value: "Second_Half",
                },
              ],
              action_id: "leave_type_select_1",
            },
            label: {
              type: "plain_text",
              text: "Type",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "dates_2",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date",
              },
              action_id: "date_select_2",
            },
            label: {
              type: "plain_text",
              text: "Date 2",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "leave_type_2",
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
                    text: "Full Day",
                  },
                  value: "Full_Day",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "First Half",
                  },
                  value: "First_Half",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Second Half",
                  },
                  value: "Second_Half",
                },
              ],
              action_id: "leave_type_select_2",
            },
            label: {
              type: "plain_text",
              text: "Type",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "dates_3",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date",
              },
              action_id: "date_select_3",
            },
            label: {
              type: "plain_text",
              text: "Date 3",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "leave_type_3",
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
                    text: "Full Day",
                  },
                  value: "Full_Day",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "First Half",
                  },
                  value: "First_Half",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Second Half",
                  },
                  value: "Second_Half",
                },
              ],
              action_id: "leave_type_select_3",
            },
            label: {
              type: "plain_text",
              text: "Type",
            },
            optional: true,
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
  } else if (action.action_id === "select_workhome_leave") {
    await client.views.update({
      view_id: body.view.id,
      view: {
        type: "modal",
        callback_id: "work_from_home_application_modal",
        title: {
          type: "plain_text",
          text: "Apply for WFH Leave",
        },
        blocks: [
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "*WFH Leave:* Ensure WFH days are marked for the entire month by the 3rd working day.",
              },
            ],
          },
          {
            type: "input",
            block_id: "date",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date",
              },
              action_id: "date_select",
            },
            label: {
              type: "plain_text",
              text: "Date",
            },
          },
          {
            type: "input",
            block_id: "date_2",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select second date",
              },
              action_id: "date_select_2",
            },
            label: {
              type: "plain_text",
              text: "Second Date",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "date_3",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select third date",
              },
              action_id: "date_select_3",
            },
            label: {
              type: "plain_text",
              text: "Third Date",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "date_4",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select fourth date",
              },
              action_id: "date_select_4",
            },
            label: {
              type: "plain_text",
              text: "Fourth Date",
            },
            optional: true,
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
  } else if (action.action_id === "select_bereavement_leave") {
    try {
      await client.views.update({
        view_id: body.view.id,
        view: {
          type: "modal",
          callback_id: "bereavement_leave_application_modal",
          title: {
            type: "plain_text",
            text: "Bereavement Leave",
          },
          blocks: [
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: "*Bereavement Leave:* Unfortunate to see you here. Praying for more strength during difficult times.",
                },
              ],
            },
            {
              type: "input",
              block_id: "start_date",
              element: {
                type: "datepicker",
                initial_date: new Date().toISOString().split("T")[0],
                placeholder: {
                  type: "plain_text",
                  text: "Select start date",
                },
                action_id: "start_date_select",
              },
              label: {
                type: "plain_text",
                text: "Start Date",
              },
            },
            {
              type: "input",
              block_id: "end_date",
              element: {
                type: "datepicker",
                initial_date: new Date().toISOString().split("T")[0],
                placeholder: {
                  type: "plain_text",
                  text: "Select end date",
                },
                action_id: "end_date_select",
              },
              label: {
                type: "plain_text",
                text: "End Date",
              },
              optional: true,
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
      console.error("Failed to open bereavement leave modal:", error);
    }
  } else if (action.action_id === "select_maternity_leave") {
    try {
      await client.views.update({
        view_id: body.view.id,
        view: {
          type: "modal",
          callback_id: "maternity_leave_application_modal",
          title: {
            type: "plain_text",
            text: "Maternity Leave",
          },
          blocks: [
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: "*Maternity Leave:* Extended leave for mothers during and after pregnancy.",
                },
              ],
            },
            {
              type: "input",
              block_id: "start_date",
              element: {
                type: "datepicker",
                initial_date: new Date().toISOString().split("T")[0],
                placeholder: {
                  type: "plain_text",
                  text: "Select start date",
                },
                action_id: "start_date_select",
              },
              label: {
                type: "plain_text",
                text: "Start Date",
              },
            },
            {
              type: "input",
              block_id: "end_date",
              element: {
                type: "datepicker",
                initial_date: new Date().toISOString().split("T")[0],
                placeholder: {
                  type: "plain_text",
                  text: "Select end date",
                },
                action_id: "end_date_select",
              },
              label: {
                type: "plain_text",
                text: "End Date",
              },
              optional: true,
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
      console.error("Failed to open maternity leave modal:", error);
    }
  } else if (action.action_id === "select_paternity_leave") {
    try {
      await client.views.update({
        view_id: body.view.id,
        view: {
          type: "modal",
          callback_id: "paternity_leave_application_modal",
          title: {
            type: "plain_text",
            text: "Paternity Leave",
          },
          blocks: [
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: "*Paternity Leave:* Leave granted to fathers for post-birth bonding and support.",
                },
              ],
            },
            {
              type: "input",
              block_id: "start_date",
              element: {
                type: "datepicker",
                initial_date: new Date().toISOString().split("T")[0],
                placeholder: {
                  type: "plain_text",
                  text: "Select start date",
                },
                action_id: "start_date_select",
              },
              label: {
                type: "plain_text",
                text: "Start Date",
              },
            },
            {
              type: "input",
              block_id: "end_date",
              element: {
                type: "datepicker",
                initial_date: new Date().toISOString().split("T")[0],
                placeholder: {
                  type: "plain_text",
                  text: "Select end date",
                },
                action_id: "end_date_select",
              },
              label: {
                type: "plain_text",
                text: "End Date",
              },
              optional: true,
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
      console.error("Failed to open paternity leave modal:", error);
    }
  } else if (action.action_id === "select_restricted_leave") {
    await client.views.update({
      view_id: body.view.id,
      view: {
        type: "modal",
        callback_id: "restricted_holiday_application_modal",
        title: {
          type: "plain_text",
          text: "Restricted Holiday", // Shortened title
        },
        blocks: [
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "*Restricted Holidays:* Apply RH along with any important dates like birthdays, anniversaries, etc.",
              },
            ],
          },
          {
            type: "input",
            block_id: "dates_1",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date 1",
              },
              action_id: "date_select_1",
            },
            label: {
              type: "plain_text",
              text: "Date 1",
            },
          },
          {
            type: "input",
            block_id: "dates_2",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date 2",
              },
              action_id: "date_select_2",
            },
            label: {
              type: "plain_text",
              text: "Date 2",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "dates_3",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date 3",
              },
              action_id: "date_select_3",
            },
            label: {
              type: "plain_text",
              text: "Date 3",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "dates_4",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date 4",
              },
              action_id: "date_select_4",
            },
            label: {
              type: "plain_text",
              text: "Date 4",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "dates_5",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date 5",
              },
              action_id: "date_select_5",
            },
            label: {
              type: "plain_text",
              text: "Date 5",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "dates_6",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date 6",
              },
              action_id: "date_select_6",
            },
            label: {
              type: "plain_text",
              text: "Date 6",
            },
            optional: true,
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
  } else if (action.action_id === "select_internship_leave") {
    await client.views.update({
      view_id: body.view.id,
      view: {
        type: "modal",
        callback_id: "internship_holiday_application_modal",
        title: {
          type: "plain_text",
          text: "Internship Leave", // Shortened title
        },
        blocks: [
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "*Internship Leave:* Leave specific for internships or related commitments.",
              },
            ],
          },
          {
            type: "input",
            block_id: "dates_1",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date 1",
              },
              action_id: "date_select_1",
            },
            label: {
              type: "plain_text",
              text: "Date 1",
            },
          },
          {
            type: "input",
            block_id: "dates_2",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date 2",
              },
              action_id: "date_select_2",
            },
            label: {
              type: "plain_text",
              text: "Date 2",
            },
            optional: true,
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
  } else if (action.action_id === "select_compensatory_leave") {
    await client.views.update({
      view_id: body.view.id,
      view: {
        type: "modal",
        callback_id: "compensatory_leave_application_modal",
        title: {
          type: "plain_text",
          text: "Compensatory Leave",
        },
        blocks: [
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "*Internship Leave:* Leave specific for internships or related commitments.",
              },
            ],
          },
          {
            type: "input",
            block_id: "dates_1",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date 1",
              },
              action_id: "date_select_1",
            },
            label: {
              type: "plain_text",
              text: "Date 1",
            },
          },
          {
            type: "input",
            block_id: "dates_2",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date 2",
              },
              action_id: "date_select_2",
            },
            label: {
              type: "plain_text",
              text: "Date 2",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "leave_type_1",
            element: {
              type: "static_select",
              placeholder: {
                type: "plain_text",
                text: "Select leave type for Date 1",
              },
              options: [
                {
                  text: { type: "plain_text", text: "Full Day" },
                  value: "Full_Day",
                },
                {
                  text: { type: "plain_text", text: "Half Day" },
                  value: "Half_Day",
                },
              ],
              action_id: "leave_type_select_1",
            },
            label: {
              type: "plain_text",
              text: "Type (Date 1)",
            },
          },
          {
            type: "input",
            block_id: "half_day_1",
            element: {
              type: "static_select",
              placeholder: {
                type: "plain_text",
                text: "Select half",
              },
              options: [
                {
                  text: { type: "plain_text", text: "First Half" },
                  value: "First_Half",
                },
                {
                  text: { type: "plain_text", text: "Second Half" },
                  value: "Second_Half",
                },
              ],
              action_id: "half_day_select_1",
            },
            label: {
              type: "plain_text",
              text: "Half Day (Date 1)",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "leave_type_2",
            element: {
              type: "static_select",
              placeholder: {
                type: "plain_text",
                text: "Select leave type for Date 2",
              },
              options: [
                {
                  text: { type: "plain_text", text: "Full Day" },
                  value: "Full_Day",
                },
                {
                  text: { type: "plain_text", text: "Half Day" },
                  value: "Half_Day",
                },
              ],
              action_id: "leave_type_select_2",
            },
            label: {
              type: "plain_text",
              text: "Type (Date 2)",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "half_day_2",
            element: {
              type: "static_select",
              placeholder: {
                type: "plain_text",
                text: "Select half",
              },
              options: [
                {
                  text: { type: "plain_text", text: "First Half" },
                  value: "First_Half",
                },
                {
                  text: { type: "plain_text", text: "Second Half" },
                  value: "Second_Half",
                },
              ],
              action_id: "half_day_select_2",
            },
            label: {
              type: "plain_text",
              text: "Half Day (Date 2)",
            },
            optional: true,
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
  }
};

const openSickLeaveModal = async ({ ack, body, client }) => {
  await ack();

  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "sick_leave_application_modal",
        title: {
          type: "plain_text",
          text: "Apply for Sick Leave",
        },
        blocks: [
          {
            type: "input",
            block_id: "dates",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select date",
              },
              action_id: "date_select",
            },
            label: {
              type: "plain_text",
              text: "Date",
            },
          },
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
                    text: "Full Day",
                  },
                  value: "Full_Day",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Half Day",
                  },
                  value: "Half_Day",
                },
              ],
              action_id: "leave_type_select",
            },
            label: {
              type: "plain_text",
              text: "Type",
            },
          },
          {
            type: "input",
            block_id: "half_day",
            element: {
              type: "static_select",
              placeholder: {
                type: "plain_text",
                text: "Select half",
              },
              options: [
                {
                  text: {
                    type: "plain_text",
                    text: "First Half",
                  },
                  value: "First_Half",
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Second Half",
                  },
                  value: "Second_Half",
                },
              ],
              action_id: "half_day_select",
            },
            label: {
              type: "plain_text",
              text: "Half Day",
            },
            optional: true, // Make this optional
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
    console.error("Error opening sick leave modal:", error);
  }
};

const openTestModal = async ({ ack, body, client }) => {
  await ack();
  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "test_modal",
        title: {
          type: "plain_text",
          text: "Test Modal",
        },
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "This is a test modal.",
            },
          },
        ],
        submit: {
          type: "plain_text",
          text: "Close",
        },
      },
    });
  } catch (error) {
    console.error("Error opening test modal:", error);
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

    // Send message to the user
    // await client.chat.postMessage({
    //   channel: userId,
    //   text: `You have jibbled in at ${now.toLocaleTimeString()}.`,
    // });

    const attendanceChannelId =
      process.env.ATTENDANCE_CHANNEL_ID || "attendance"; // Use environment variable or fallback
    await client.chat.postMessage({
      channel: attendanceChannelId,
      text: `<@${userId}> has jibbled in at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
      unfurl_links: false,
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
  const time = now.toTimeString().split(" ")[0]; // Format: HH:MM:SS

  try {
    const attendance = await Attendance.findOne({
      user: userId,
      date: now.toISOString().split("T")[0],
    }).sort({ checkinTime: -1 });

    if (!attendance) {
      console.warn(
        `No check-in record found for user ${userId} on ${
          now.toISOString().split("T")[0]
        }`
      );

      // Inform the user that they haven't checked in yet
      await client.chat.postMessage({
        channel: userId,
        text: "❗ You have not checked in yet today. Please check in first before checking out.",
      });

      return; // Stop execution here
    }

    attendance.checkoutTime = time;
    await attendance.save();

    const attendanceChannelId =
      process.env.ATTENDANCE_CHANNEL_ID || "attendance";
    await client.chat.postMessage({
      channel: attendanceChannelId,
      text: `<@${userId}> has jibbled out at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
      unfurl_links: false,
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
      dates: { $elemMatch: { $lte: today } },
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
        return `*User:* <@${leave.user}>\n*Dates:* ${leave.dates
          .map(formatDate)
          .join(", ")}\n*Reason:* ${leave.reason}\n*Leave Type:* ${
          leave.leaveType
        }`;
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
        casualLeave: 8,
        burnout: 8,
        mensuralLeaves: 18,
        unpaidLeave: 20,
        internshipLeave: 10,
        wfhLeave: 10,
        bereavementLeave: 5,
        maternityLeave: 65, // 13 weeks
        paternityLeave: 20,
        restrictedHoliday: 4,
    };

    const leaveBalances = {
      sickLeave: totalLeaves.sickLeave - (user.sickLeave || 0),
      restrictedHoliday:
        totalLeaves.restrictedHoliday - (user.restrictedHoliday || 0),
      burnout: totalLeaves.burnout - (user.burnout || 0),
      mensuralLeaves: totalLeaves.mensuralLeaves - (user.mensuralLeaves || 0),
      casualLeave: totalLeaves.casualLeave - (user.casualLeave || 0),
      maternityLeave: totalLeaves.maternityLeave - (user.maternityLeave || 0),
      unpaidLeave: totalLeaves.unpaidLeave - (user.unpaidLeave || 0),
      paternityLeave: totalLeaves.paternityLeave - (user.paternityLeave || 0),
      bereavementLeave:
        totalLeaves.bereavementLeave - (user.bereavementLeave || 0),
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
      dates: { $elemMatch: { $gte: new Date(today) } },
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
        return `*User:* <@${leave.user}>\n*Dates:* ${leave.dates
          .map(formatDate)
          .join(", ")}\n*Leave Type:* ${leave.leaveType}\n*Reason:* ${
          leave.reason
        }`;
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

  if (!leaveId) {
    console.error("Leave ID is undefined.");
    await client.chat.postMessage({
      channel: body.user.id,
      text: "An error occurred while approving the leave request. Please try again.",
    });
    return;
  }

  try {
    const leaveRequest = await Leave.findByIdAndUpdate(
      leaveId,
      { status: "Approved" },
      { new: true }
    );

    if (!leaveRequest) {
      throw new Error("Leave request not found");
    }

    const user = await User.findOne({ slackId: leaveRequest.user });
    if (!user) {
      throw new Error("User not found");
    }

    const leaveDayArr = Array.isArray(leaveRequest.leaveDay)
      ? leaveRequest.leaveDay
      : [leaveRequest.leaveDay || "Full_Day"];
    const leaveDays = leaveDayArr.reduce((total, dayType) => {
      return total + (dayType === "Full_Day" ? 1 : 0.5);
    }, 0);

    let remainingLeaveBalance;
    let approvalMessage;
    console.log({ leaveRequest });

    const leaveDetails = `*From Date:* ${new Date(
      leaveRequest.dates[0]
    ).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}\n*To Date:* ${new Date(
      leaveRequest.dates[leaveRequest.dates.length - 1]
    ).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}\n*Reason:* ${leaveRequest.reason || "No reason provided"}`;

    if (leaveRequest.leaveType === "Sick_Leave") {
      user.sickLeave = (user.sickLeave || 0) + leaveDays;
      remainingLeaveBalance = 12 - user.sickLeave;
      approvalMessage = `🤒 *Your sick leave for ${formatDate(
        leaveRequest.dates[0]
      )} is approved*
Take it easy and focus on getting better. If you need any health resources, check out Plum or reach out if anything is urgent. Wishing you a speedy recovery!\n\n${leaveDetails}\n\n*Remaining Sick Leave Balance:* \`${remainingLeaveBalance} days\``;
    } else if (leaveRequest.leaveType === "Burnout_Leave") {
      user.burnout = (user.burnout || 0) + leaveDays;
      remainingLeaveBalance = 8 - user.burnout;
      approvalMessage = `🧠 *Your burnout leave for ${formatDate(
        leaveRequest.dates[0]
      )} is approved*
Your well-being matters. Take this time to rest and reflect. It might help to chat with your lead about finding more sustainable ways to work. Take care!\n\n${leaveDetails}\n\n*Remaining Burnout Leave Balance:* \`${remainingLeaveBalance} days\``;
    } else if (leaveRequest.leaveType === "Paternity_Leave") {
      let diffDays = 0;
      let startDate = new Date(leaveRequest.dates[0]);
      let endDate = new Date(leaveRequest.dates[1]);
      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setDate(d.getDate() + 1)
      ) {
        if (!isWeekendOrPublicHoliday(d)) {
          diffDays++;
        }
      }
      console.log(diffDays);
      user.paternityLeave = (user.paternityLeave || 0) + diffDays;
      remainingLeaveBalance = 20 - user.paternityLeave;
      approvalMessage = `🍼 *Your paternity leave starting ${formatDate(
        leaveRequest.dates[0]
      )} is approved*
Congratulations on this exciting new chapter! Wishing you and your family beautiful moments ahead.\n\n${leaveDetails}\n\n*Remaining Paternity Leave Balance:* \`${remainingLeaveBalance} days\``;
    } else if (leaveRequest.leaveType === "Casual_Leave") {
      user.casualLeave = (user.casualLeave || 0) + leaveDays;
      remainingLeaveBalance = 8 - user.casualLeave;
      approvalMessage = `🌼 *Your casual leave for ${formatDate(
        leaveRequest.dates[0]
      )} is approved*
Wishing you a peaceful and refreshing break. Enjoy your time off!\n\n${leaveDetails}\n\n*Remaining Casual Leave Balance:* \`${remainingLeaveBalance} days\``;
    } else if (leaveRequest.leaveType === "Bereavement_Leave") {
      approvalMessage = `🕊️ *Your bereavement leave for ${formatDate(
        leaveRequest.dates[0]
      )} is approved*
We are deeply sorry for your loss. Our thoughts are with you, and we're here if you need any support.\n\n${leaveDetails}`;
      user.bereavementLeave = (user.bereavementLeave || 0) + leaveDays;
      remainingLeaveBalance = 5 - user.bereavementLeave;
      approvalMessage += `\n\n*Remaining Bereavement Leave Balance:* \`${remainingLeaveBalance} days\``;
    } else if (leaveRequest.leaveType === "Restricted_Holiday") {
      user.restrictedHoliday = (user.restrictedHoliday || 0) + leaveDays;
      remainingLeaveBalance = 4 - user.restrictedHoliday;
      approvalMessage = `🌴 *Your leave for ${formatDate(
        leaveRequest.dates[0]
      )} is approved*
You have ${remainingLeaveBalance} restricted holidays remaining for the year. Hope you make the most of your break. Take this time to relax and recharge!\n\n${leaveDetails}\n\n*Remaining Restricted Holiday Balance:* \`${remainingLeaveBalance} days\``;
    } else if (leaveRequest.leaveType === "Mensural_Leave") {
      console.log("Mensural Leave");

      user.mensuralLeaves = (user.mensuralLeaves || 0) + leaveDays;
      remainingLeaveBalance = 18 - user.mensuralLeaves;
      approvalMessage = `💗 *Your menstrual leave for ${formatDate(
        leaveRequest.dates[0]
      )} is approved*
Rest well and take care. Let us know if you need any support.\n\n${leaveDetails}\n\n*Remaining Mensural Leave Balance:* \`${remainingLeaveBalance} days\``;
    } else if (leaveRequest.leaveType === "Maternity_Leave") {
      let diffDays = 0;
      let startDate = new Date(leaveRequest.dates[0]);
      let endDate = new Date(leaveRequest.dates[1]);
      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setDate(d.getDate() + 1)
      ) {
        if (!isWeekendOrPublicHoliday(d)) {
          diffDays++;
        }
      }
      console.log(diffDays);
      user.maternityLeave = (user.maternityLeave || 0) + diffDays;
      remainingLeaveBalance = 65 - user.maternityLeave;
      approvalMessage = `👶 *Your maternity leave starting ${formatDate(
        leaveRequest.dates[0]
      )} is approved*
Wishing you a joyful and safe journey into motherhood. We can't wait to meet your little one someday!\n\n${leaveDetails}\n\n*Remaining Maternity Leave Balance:* \`${remainingLeaveBalance} days\``;
    } else if (leaveRequest.leaveType === "Unpaid_Leave") {
      user.unpaidLeave = (user.unpaidLeave || 0) + leaveDays;
      remainingLeaveBalance = 20 - user.unpaidLeave;
      approvalMessage = `📝 *Your unpaid leave for ${formatDate(
        leaveRequest.dates[0]
      )} is approved*
We understand life can be unpredictable. If you need any assistance or resources during this time, don't hesitate to reach out.\n\n${leaveDetails}\n\n*Remaining Unpaid Leave Balance:* \`${remainingLeaveBalance} days\``;
    } else if (leaveRequest.leaveType === "Work_from_Home") {
      user.wfhLeave = (user.wfhLeave || 0) + leaveDays;
      remainingLeaveBalance = 10 - user.wfhLeave;
      approvalMessage = `🏡 *Your WFH day for ${formatDate(
        leaveRequest.dates[0]
      )} is approved*
Make yourself comfortable and stay productive. Remember, you can take 1 WFH day every week!\n\n${leaveDetails}\n\n*Remaining WFH Leave Balance:* \`${remainingLeaveBalance} days\``;
    } else if (leaveRequest.leaveType === "Internship_Leave") {
      user.internshipLeave = (user.internshipLeave || 0) + leaveDays;
      remainingLeaveBalance = 10 - user.internshipLeave;
      approvalMessage = `📚 *Your leave for ${formatDate(
        leaveRequest.dates[0]
      )} is approved*
Take your well-deserved break!\n\n${leaveDetails}\n\n*Remaining Internship Leave Balance:* \`${remainingLeaveBalance} days\``;
    } else if (leaveRequest.leaveType === "Compensatory_Leave") {
      user.compensatoryLeave = (user.compensatoryLeave || 0) + leaveDays;
      approvalMessage = `📚 *Your leave for ${formatDate(
        leaveRequest.dates[0]
      )} is approved*
Take your well-deserved break!\n\n${leaveDetails}`;
    }

    await user.save();

    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: `Leave request for <@${leaveRequest.user}> has been approved and removed from the list.`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Leave request for <@${leaveRequest.user}> has been approved and removed from the list.`,
          },
        },
      ],
    });

    // Notify the user directly
    await client.chat.postMessage({
      channel: leaveRequest.user,
      text: approvalMessage,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: approvalMessage,
          },
        },
      ],
    });

    // Also notify the attendance channel that this user is on leave
    try {
      const attendanceChannelId =
        process.env.ATTENDANCE_CHANNEL_ID || "attendance";

      const leaveDatesText = leaveRequest.dates
        .map((date) => formatDate(date))
        .join(", ");

      const attendanceMessage = `<@${leaveRequest.user}> is on *${leaveRequest.leaveType}* for ${leaveDatesText}.`;

      await client.chat.postMessage({
        channel: attendanceChannelId,
        text: attendanceMessage,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: attendanceMessage,
            },
          },
        ],
      });
    } catch (attendanceError) {
      console.error("Error notifying attendance channel about approved leave:", attendanceError);
    }
  } catch (error) {
    console.error("Error approving leave:", error);
    await client.chat.postMessage({
      channel: body.user.id,
      text: "An error occurred while approving the leave request. Please try again.",
    });
  }
};

const handleSickLeaveSubmission = async ({ ack, body, view, client }) => {
  await ack();

  const user = body.user.id;
  const userName = (await getSlackUserDisplayName(client, user)) || body.user.username;

  const selectedDates = [
    view.state.values.dates_1.date_select_1.selected_date,
    view.state.values.dates_2.date_select_2.selected_date,
    view.state.values.dates_3.date_select_3.selected_date,
  ].filter(Boolean);

  const leaveTypes = [
    view.state.values.leave_type_1.leave_type_select_1.selected_option?.value,
    view.state.values.leave_type_2.leave_type_select_2.selected_option?.value,
    view.state.values.leave_type_3.leave_type_select_3.selected_option?.value,
  ].filter(Boolean);

  if (selectedDates.length === 0) {
    console.error("No valid dates selected.");
    await client.chat.postMessage({
      channel: user,
      text: "No valid dates selected for sick leave. Please try again.",
    });
    return;
  }

  const reason =
    view.state.values.reason.reason_input.value || "No reason provided";

  const verificationResult = await verifySickLeave(
    user,
    selectedDates,
    leaveTypes,
    leaveTypes, // leaveTime set same as leaveDay
    reason
  );

  if (!verificationResult.isValid) {
    await client.chat.postMessage({
      channel: user,
      text: `Failed to submit sick leave request: ${verificationResult.message}. Please check the dates and try again.`,
    });
    return;
  }

  const leaveDetails =
    `*Leave Type:* Sick_Leave\n` +
    selectedDates
      .map((date, index) => {
        const fromDate = new Date(date).toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const leaveType = leaveTypes[index];
        return `*Date:* ${fromDate}\n*Type:* ${leaveType}`;
      })
      .join("\n\n");

  try {
    const leave = new Leave({
      user,
      dates: selectedDates,
      reason,
      leaveType: "Sick_Leave",
      leaveDay: leaveTypes,
      leaveTime: leaveTypes, // leaveTime set same as leaveDay
    });
    await leave.save();

    await client.chat.postMessage({
      channel: user,
      text: `:white_check_mark: Your leave request has been submitted for approval!\n\n${leaveDetails}`,
    });

    const adminUserId = process.env.ADMIN_USER_ID;
    await client.chat.postMessage({
      channel: adminUserId,
      text: `New Sick Leave request received!`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:bell: New Sick Leave request received from *${userName}*!\n\n${leaveDetails}`,
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

    await client.chat.postMessage({
      channel: user,
      text: `Sick leave request submitted successfully for the following dates: ${selectedDates
        .map((date) =>
          new Date(date).toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        )
        .join(", ")}.`,
    });
  } catch (error) {
    console.error("Error saving leave to database:", error);
    await client.chat.postMessage({
      channel: user,
      text: `:x: There was an error submitting your leave request. Please try again later.`,
    });
  }
};

const handleCasualLeaveSubmission = async ({ ack, body, view, client }) => {
  await ack();

  const user = body.user.id;
  const userName = (await getSlackUserDisplayName(client, user)) || body.user.username;

  const selectedDates = [
    view.state.values.dates_1.date_select_1.selected_date,
    view.state.values.dates_2.date_select_2.selected_date,
    view.state.values.dates_3.date_select_3.selected_date,
  ].filter(Boolean);

  const leaveTypes = [
    view.state.values.leave_type_1.leave_type_select_1.selected_option?.value,
    view.state.values.leave_type_2.leave_type_select_2.selected_option?.value,
    view.state.values.leave_type_3.leave_type_select_3.selected_option?.value,
  ].filter(Boolean);

  if (selectedDates.length === 0) {
    console.error("No valid dates selected.");
    await client.chat.postMessage({
      channel: user,
      text: "No valid dates selected for casual leave. Please try again.",
    });
    return;
  }

  const reason =
    view.state.values.reason.reason_input.value || "No reason provided";

  const verificationResult = await verifyCasualLeave(
    user,
    selectedDates,
    leaveTypes,
    leaveTypes,
    reason
  );

  if (!verificationResult.isValid) {
    await client.chat.postMessage({
      channel: user,
      text: `Failed to submit casual leave request: ${verificationResult.message}. Please check the dates and try again.`,
    });
    return;
  }

  const leaveDetails =
    `*Leave Type:* Casual_Leave\n` +
    selectedDates
      .map((date, index) => {
        const fromDate = new Date(date).toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const leaveType = leaveTypes[index];
        return `*Date:* ${fromDate}\n*Type:* ${leaveType}\n*Half Day:* ${leaveType}`;
      })
      .join("\n\n");

  try {
    const leave = new Leave({
      user,
      dates: selectedDates,
      reason,
      leaveType: "Casual_Leave",
      leaveDay: leaveTypes,
      leaveTime: leaveTypes,
    });
    await leave.save();

    await client.chat.postMessage({
      channel: user,
      text: `:white_check_mark: Your casual leave request has been submitted for approval!\n\n${leaveDetails}`,
    });

    const adminUserId = process.env.ADMIN_USER_ID;
    await client.chat.postMessage({
      channel: adminUserId,
      text: `New Casual Leave request received!`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:bell: New Casual Leave request received from *${userName}*!\n\n${leaveDetails}`,
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
    console.error("Error submitting casual leave:", error);
    await client.chat.postMessage({
      channel: user,
      text: `:x: There was an error submitting your leave request. Please try again later.`,
    });
  }
};

const handleMensuralLeaveSubmission = async ({ ack, body, view, client }) => {
  await ack();

  const user = body.user.id;
  const userName = (await getSlackUserDisplayName(client, user)) || body.user.username;

  const selectedDates = [
    view.state.values.dates_1.date_select_1.selected_date,
    view.state.values.dates_2.date_select_2.selected_date,
  ].filter(Boolean);

  console.log("Selected Dates:", selectedDates);

  const leaveTypes = [
    view.state.values.leave_type_1.leave_type_select_1.selected_option?.value,
    view.state.values.leave_type_2.leave_type_select_2.selected_option?.value,
  ].filter(Boolean);

  console.log("Leave Types:", leaveTypes);

  if (selectedDates.length === 0) {
    console.error("No valid dates selected.");
    await client.chat.postMessage({
      channel: user,
      text: "No valid dates selected for mensural leave. Please try again.",
    });
    return;
  }

  const reason =
    view.state.values.reason.reason_input.value || "No reason provided";

  const verificationResult = await verifyMensuralLeave(
    user,
    selectedDates,
    leaveTypes,
    leaveTypes,
    reason
  );

  if (!verificationResult.isValid) {
    await client.chat.postMessage({
      channel: user,
      text: `Failed to submit mensural leave request: ${verificationResult.message}. Please check the dates and try again.`,
    });
    return;
  }
  const leaveDetails =
    `*Leave Type:* Mensural_Leave\n` +
    selectedDates
      .map((date, index) => {
        const fromDate = new Date(date).toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const leaveType = leaveTypes[index];
        const halfDay = leaveTypes[index];
        return `*Date:* ${fromDate}\n*Type:* ${leaveType}\n*Half Day:* ${halfDay}`;
      })
      .join("\n\n");

  try {
    const leave = new Leave({
      user,
      dates: selectedDates,
      reason,
      leaveType: "Mensural_Leave",
      leaveDay: leaveTypes,
      leaveTime: leaveTypes,
    });
    await leave.save();

    await client.chat.postMessage({
      channel: user,
      text: `:white_check_mark: Your mensural leave request has been submitted for approval!\n\n${leaveDetails}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:white_check_mark: Your mensural leave request has been submitted for approval!\n\n${leaveDetails}`,
          },
        },
      ],
    });

    const adminUserId = process.env.ADMIN_USER_ID;
    await client.chat.postMessage({
      channel: adminUserId,
      text: `New mensural leave request received!`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:bell: New mensural leave request received from @${userName}!\n\n${leaveDetails}`,
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
    console.error("Error submitting mensural leave:", error);
    await client.chat.postMessage({
      channel: user,
      text: `:x: There was an error submitting your mensural leave request. Please try again later.`,
    });
  }
};

const handleUnpaidLeaveSubmission = async ({ ack, body, view, client }) => {
  await ack();

  const user = body.user.id;
  const userName = (await getSlackUserDisplayName(client, user)) || body.user.username;

  const selectedDates = [
    view.state.values.dates_1.date_select_1.selected_date,
    view.state.values.dates_2.date_select_2.selected_date,
    view.state.values.dates_3.date_select_3.selected_date,
  ].filter(Boolean);

  console.log("Selected Dates:", selectedDates);

  const leaveTypes = [
    view.state.values.leave_type_1.leave_type_select_1.selected_option?.value,
    view.state.values.leave_type_2.leave_type_select_2.selected_option?.value,
    view.state.values.leave_type_3.leave_type_select_3.selected_option?.value,
  ].filter(Boolean);

  console.log("Leave Types:", leaveTypes);

  const reason =
    view.state.values.reason.reason_input.value || "No reason provided";

  const verificationResult = await verifyUnpaidLeave(
    user,
    selectedDates,
    leaveTypes,
    leaveTypes,
    reason
  );

  if (!verificationResult.isValid) {
    await client.chat.postMessage({
      channel: user,
      text: `Failed to submit unpaid leave request: ${verificationResult.message}. Please check the dates and try again.`,
    });
    return;
  }

  const leaveDetails = `*Leave Type:* Unpaid_Leave\n*From Date:* ${new Date(
    selectedDates[0]
  ).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}\n*To Date:* ${new Date(
    selectedDates[selectedDates.length - 1]
  ).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}\n*Reason:* ${reason}`;

  try {
    const leave = new Leave({
      user,
      dates: selectedDates,
      reason,
      leaveType: "Unpaid_Leave",
      leaveDay: leaveTypes,
      leaveTime: leaveTypes,
    });
    await leave.save();

    await client.chat.postMessage({
      channel: user,
      text: `:white_check_mark: Your unpaid leave request has been submitted for approval!\n\n${leaveDetails}`,
    });

    const adminUserId = process.env.ADMIN_USER_ID;
    await client.chat.postMessage({
      channel: adminUserId,
      text: `New leave request received!`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:bell: New unpaid leave request received from @${userName}!\n\n${leaveDetails}`,
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
    console.error("Error submitting unpaid leave:", error);
  }
};

const handleBurnoutLeaveSubmission = async ({ ack, body, view, client }) => {
  await ack();
  const user = body.user.id;
  const userName = (await getSlackUserDisplayName(client, user)) || body.user.username;
  const startDate = view.state.values.dates_1?.start_date_select?.selected_date;
  const endDate = view.state.values.dates_2?.end_date_select?.selected_date;
  const reason = view.state.values.reason?.reason_input?.value;
  const selectedDates = [startDate, endDate].filter(Boolean);
  const leaveType1 = view.state.values.leave_type_1?.leave_type_select_1?.selected_option?.value || "Full_Day";
  const halfDay1 = view.state.values.half_day_1?.half_day_select_1?.selected_option?.value || "Full_Day";
  const leaveType2 = view.state.values.leave_type_2?.leave_type_select_2?.selected_option?.value || "Full_Day";
  const halfDay2 = view.state.values.half_day_2?.half_day_select_2?.selected_option?.value || "Full_Day";
  const leaveDayArray = selectedDates.map((_, i) => (i === 0 ? leaveType1 : leaveType2));
  const leaveTimeArray = selectedDates.map((_, i) => {
    const type = i === 0 ? leaveType1 : leaveType2;
    const half = i === 0 ? halfDay1 : halfDay2;
    return type === "Half_Day" ? half : "Full_Day";
  });
  try {
    console.log("Selected Dates:", selectedDates);
    console.log("Reason for leave:", reason);

    if (selectedDates.length === 0) {
      console.error("No valid dates selected.");
      await client.chat.postMessage({
        channel: user,
        text: "No valid dates selected for burnout leave. Please try again.",
      });
      return;
    }

    const verificationResult = await verifyBurnoutLeave(
      user,
      selectedDates,
      leaveDayArray,
      leaveTimeArray,
      reason
    );

    if (!verificationResult.isValid) {
      await client.chat.postMessage({
        channel: user,
        text: `Failed to submit burnout leave request: ${verificationResult.message}. Please check the dates and try again.`,
      });
      return;
    }

    const leaveDetails =
      `*Leave Type:* Burnout_Leave\n` +
      selectedDates
        .map((date, i) => {
          const fromDate = new Date(date).toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
          const type = leaveDayArray[i];
          const half = leaveTimeArray[i];
          return `*Date:* ${fromDate}\n*Type:* ${type}${type === "Half_Day" ? `\n*Half Day:* ${half}` : ""}`;
        })
        .join("\n\n") +
      `\n*Reason:* ${reason || "No reason provided"}`;

    try {
      const leave = new Leave({
        user,
        dates: selectedDates,
        reason,
        leaveType: "Burnout_Leave",
        leaveDay: leaveDayArray,
        leaveTime: leaveTimeArray,
      });
      await leave.save();

      await client.chat.postMessage({
        channel: user,
        text: `:white_check_mark: Your burnout leave request has been submitted for approval!\n\n${leaveDetails}`,
      });

      const adminUserId = process.env.ADMIN_USER_ID;
      await client.chat.postMessage({
        channel: adminUserId,
        text: `New leave request received!`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `:bell: New burnout leave request received from @${userName}!\n\n${leaveDetails}`,
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

      await client.chat.postMessage({
        channel: user,
        text: `Burnout leave request submitted successfully for the following dates: ${selectedDates
          .map((date) =>
            new Date(date).toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          )
          .join(", ")}.`,
      });
    } catch (error) {
      console.error("Error saving leave to database:", error);
      await client.chat.postMessage({
        channel: user,
        text: `:x: There was an error submitting your burnout leave request. Please try again later.`,
      });
    }
  } catch (error) {
    console.error("Error handling burnout leave submission:", error);
    await client.chat.postMessage({
      channel: user,
      text: `:x: There was an error processing your burnout leave request. Please try again later.`,
    });
  }
};

const handleWorkFromHomeSubmission = async ({ ack, body, client, view }) => {
  await ack();
  const user = body.user.id;
  const userName = (await getSlackUserDisplayName(client, user)) || body.user.username;
  const selectedDates = [
    view.state.values.date.date_select.selected_date,
    view.state.values.date_2.date_select_2.selected_date,
    view.state.values.date_3.date_select_3.selected_date,
    view.state.values.date_4.date_select_4.selected_date,
  ]
    .filter(Boolean)
    .map((date) => new Date(date).toISOString().split("T")[0]);

  const reason =
    view.state.values.reason.reason_input.value || "No reason provided";
  console.log("Selected Dates:", selectedDates);
  console.log("Reason for leave:", reason);

  if (selectedDates.length === 0) {
    console.error("No valid dates selected.");
    await client.chat.postMessage({
      channel: user,
      text: "No valid dates selected for work from home leave. Please try again.",
    });
    return;
  }

  const verificationResult = await verifyWFHLeave(user, selectedDates, reason);

  if (!verificationResult.isValid) {
    await client.chat.postMessage({
      channel: user,
      text: `Failed to submit WFH Leave request: ${verificationResult.message}. Please check the dates and try again.`,
    });
    return;
  }

  try {
    const leave = new Leave({
      user,
      dates: selectedDates,
      reason,
      leaveType: "Work_from_Home",
      leaveDay: Array(selectedDates.length).fill("Full_Day"),
      leaveTime: Array(selectedDates.length).fill("Full_Day"),
    });
    await leave.save();

    const leaveDetails =
      `*Leave Type:* Work_from_Home\n` +
      selectedDates
        .map((date) => {
          const formattedDate = new Date(date).toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
          return `*Date:* ${formattedDate}\n*Type:* Full_Day\n*Half Day:* Full_Day`;
        })
        .join("\n\n");

    await client.chat.postMessage({
      channel: user,
      text: `:white_check_mark: Your WFH leave request has been submitted for approval!\n\n${leaveDetails}`,
    });

    const adminUserId = process.env.ADMIN_USER_ID;
    await client.chat.postMessage({
      channel: adminUserId,
      text: `New leave request received!`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:bell: New WFH leave request received from @${userName}!\n\n${leaveDetails}`,
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
      text: `:x: @${userName}, there was an error submitting your work from home leave request. Please try again later.`,
    });
  }
};

const handleBereavementLeaveSubmission = async ({
  ack,
  body,
  view,
  client,
}) => {
  await ack();

  const user = body.user.id;
  const userName = (await getSlackUserDisplayName(client, user)) || body.user.username;
  const startDate =
    view.state.values.start_date.start_date_select.selected_date;
  const endDate =
    view.state.values.end_date.end_date_select.selected_date || startDate;
  const reason =
    view.state.values.reason.reason_input.value || "No reason provided";

  const verificationResult = await verifyBereavementLeave(
    user,
    startDate,
    endDate
  );

  if (!verificationResult.isValid) {
    await client.chat.postMessage({
      channel: user,
      text: `Failed to submit bereavement leave request: ${verificationResult.message}.`,
    });
    return;
  }

  try {
    const leave = new Leave({
      user,
      dates: [startDate, endDate],
      leaveDay: "Full_Day",
      leaveTime: "Full_day",
      reason,
      leaveType: "Bereavement_Leave",
    });
    await leave.save();

    const leaveDetails = `*Leave Type:* Bereavement_Leave\n*From Date:* ${new Date(
      startDate
    ).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}\n*To Date:* ${new Date(endDate).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}\n*Reason:* ${reason}`;

    await client.chat.postMessage({
      channel: user,
      text: `:white_check_mark: Your bereavement leave request has been submitted for approval!\n\n${leaveDetails}`,
    });

    const adminUserId = process.env.ADMIN_USER_ID;
    await client.chat.postMessage({
      channel: adminUserId,
      text: `New leave request received!`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:bell: New bereavement leave request received from @${userName}!\n\n${leaveDetails}`,
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
      text: `:x: There was an error submitting your Bereavement Leave request. Please try again later.`,
    });
  }
};

const handleMaternityLeaveSubmission = async ({ ack, body, view, client }) => {
  await ack();

  const user = body.user.id;
  const userName = (await getSlackUserDisplayName(client, user)) || body.user.username;
  const startDate =
    view.state.values.start_date.start_date_select.selected_date;
  const endDate =
    view.state.values.end_date.end_date_select.selected_date || startDate;
  const reason =
    view.state.values.reason.reason_input.value || "No reason provided";

  const verificationResult = await verifyMaternityLeave(
    user,
    startDate,
    endDate
  );

  if (!verificationResult.isValid) {
    await client.chat.postMessage({
      channel: user,
      text: `Failed to submit maternity leave request: ${verificationResult.message}.`,
    });
    return;
  }

  try {
    const leave = new Leave({
      user,
      dates: [startDate, endDate],
      leaveDay: "Full_Day",
      leaveTime: "Full_day",
      reason,
      leaveType: "Maternity_Leave",
    });
    await leave.save();

    const leaveDetails = `*Leave Type:* Maternity_Leave\n*From Date:* ${new Date(
      startDate
    ).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}\n*To Date:* ${new Date(endDate).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}\n*Reason:* ${reason}`;

    await client.chat.postMessage({
      channel: user,
      text: `:white_check_mark: Your maternity leave request has been submitted for approval!\n\n${leaveDetails}`,
    });

    const adminUserId = process.env.ADMIN_USER_ID;
    await client.chat.postMessage({
      channel: adminUserId,
      text: `New leave request received!`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:bell: New maternity leave request received from @${userName}!\n\n${leaveDetails}`,
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
      text: `:x: @${userName}, there was an error submitting your Maternity Leave request. Please try again later.`,
    });
  }
};

const handlePaternityLeaveSubmission = async ({ ack, body, view, client }) => {
  await ack();

  const user = body.user.id;
  const userName = (await getSlackUserDisplayName(client, user)) || body.user.username;
  const startDate =
    view.state.values.start_date.start_date_select.selected_date;
  const endDate =
    view.state.values.end_date.end_date_select.selected_date || startDate;
  const reason =
    view.state.values.reason.reason_input.value || "No reason provided";

  const verificationResult = await verifyPaternityLeave(
    user,
    startDate,
    endDate
  );

  if (!verificationResult.isValid) {
    await client.chat.postMessage({
      channel: user,
      text: `Failed to submit paternity leave request: ${verificationResult.message}.`,
    });
    return;
  }

  try {
    const leave = new Leave({
      user,
      dates: [startDate, endDate],
      leaveDay: "Full_Day",
      leaveTime: "Full_day",
      reason,
      leaveType: "Paternity_Leave",
    });
    await leave.save();

    const leaveDetails = `*Leave Type:* Paternity_Leave\n*From Date:* ${new Date(
      startDate
    ).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}\n*To Date:* ${new Date(endDate).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}\n*Reason:* ${reason}`;

    await client.chat.postMessage({
      channel: user,
      text: `:white_check_mark: Your paternity leave request has been submitted for approval!\n\n${leaveDetails}`,
    });

    const adminUserId = process.env.ADMIN_USER_ID;
    await client.chat.postMessage({
      channel: adminUserId,
      text: `New leave request received!`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:bell: New paternity leave request received from @${userName}!\n\n${leaveDetails}`,
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
      text: `:x: @${userName}, there was an error submitting your Paternity Leave request. Please try again later.`,
    });
  }
};

const handleRestrictedHolidaySubmission = async ({
  ack,
  body,
  view,
  client,
}) => {
  await ack();

  const user = body.user.id;
  const userName = (await getSlackUserDisplayName(client, user)) || body.user.username;

  const selectedDates = [
    view.state.values.dates_1.date_select_1.selected_date,
    view.state.values.dates_2.date_select_2.selected_date,
    view.state.values.dates_3.date_select_3.selected_date,
    view.state.values.dates_4.date_select_4.selected_date,
    view.state.values.dates_5.date_select_5.selected_date,
    view.state.values.dates_6.date_select_6.selected_date,
  ].filter(Boolean);

  console.log("Selected Dates:", selectedDates);

  const reason =
    view.state.values.reason.reason_input.value || "No reason provided";

  const verificationResult = await verifyRestrictedHoliday(user, selectedDates);

  if (!verificationResult.isValid) {
    await client.chat.postMessage({
      channel: user,
      text: `Failed to submit restricted holiday request: ${verificationResult.message}. Please check the dates and try again.`,
    });
    return;
  }

  const leaveDetails = `*Leave Type:* Restricted_Holiday\n*From Date:* ${new Date(
    selectedDates[0]
  ).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}\n*To Date:* ${new Date(
    selectedDates[selectedDates.length - 1]
  ).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}\n*Reason:* ${reason}`;

  try {
    const leave = new Leave({
      user,
      dates: selectedDates,
      reason,
      leaveType: "Restricted_Holiday",
      leaveDay: Array(selectedDates.length).fill("Full_Day"),
      leaveTime: Array(selectedDates.length).fill("Full_Day"),
    });
    await leave.save();

    await client.chat.postMessage({
      channel: user,
      text: `:white_check_mark: Your restricted holiday request has been submitted for approval!\n\n${leaveDetails}`,
    });

    const adminUserId = process.env.ADMIN_USER_ID;
    await client.chat.postMessage({
      channel: adminUserId,
      text: `New leave request received!`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:bell: New restricted holiday request received from @${userName}!\n\n${leaveDetails}`,
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
    console.error("Error submitting restricted holiday:", error);
    await client.chat.postMessage({
      channel: user,
      text: `:x: @${userName}, there was an error submitting your restricted holiday request. Please try again later.`,
    });
  }
};

const handleInternshipLeaveSubmission = async ({ ack, body, view, client }) => {
  await ack();

  const user = body.user.id;
  const userName = (await getSlackUserDisplayName(client, user)) || body.user.username;
  const selectedDates = [
    view.state.values.dates_1.date_select_1.selected_date,
    view.state.values.dates_2?.date_select_2?.selected_date,
  ].filter(Boolean);

  const reason =
    view.state.values.reason.reason_input.value || "No reason provided";

  if (selectedDates.length > 2) {
    await client.chat.postMessage({
      channel: user,
      text: `:x: You cannot apply for more than 2 days of leave.`,
    });
    return;
  }

  for (const date of selectedDates) {
    const selectedDate = new Date(date);
    if (selectedDate < new Date()) {
      await client.chat.postMessage({
        channel: user,
        text: `:x: One of the selected dates is in the past. Please select a valid date.`,
      });
      return;
    }
    if (isWeekendOrPublicHoliday(selectedDate)) {
      await client.chat.postMessage({
        channel: user,
        text: `:x: One of the selected dates falls on a weekend or public holiday. Please select a valid date.`,
      });
      return;
    }
  }

  const overlappingLeaves = await Leave.find({
    user,
    status: { $ne: "Rejected" },
    dates: { $in: selectedDates.map((date) => new Date(date)) },
  });

  if (overlappingLeaves.length > 0) {
    await client.chat.postMessage({
      channel: user,
      text: `:x: There are overlapping leaves with the selected dates. Please select different dates.`,
    });
    return;
  }

  try {
    const leave = new Leave({
      user,
      reason,
      dates: selectedDates.map((date) => new Date(date)),
      status: "Pending",
      leaveType: "Internship_Leave",
      leaveDay: "Full_Day",
      leaveTime: "Full_Day",
    });
    await leave.save();
    const leaveDetails = `*Leave Type:* Internship_Leave\n*From Date:* ${new Date(
      selectedDates[0]
    ).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}\n*To Date:* ${new Date(
      selectedDates[selectedDates.length - 1]
    ).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}\n*Reason:* ${reason || "No reason provided"}`;

    const adminUserId = process.env.ADMIN_USER_ID;
    await client.chat.postMessage({
      channel: adminUserId,
      text: `New leave request received!`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:bell: New internship leave request received from @${userName}!\n\n${leaveDetails}`,
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
    console.error("Error submitting internship leave:", error);
    await client.chat.postMessage({
      channel: user,
      text: `:x: @${userName}, there was an error submitting your internship leave request. Please try again later.`,
    });
  }
};

const handleCompensatoryLeaveSubmission = async ({
  ack,
  body,
  view,
  client,
}) => {
  await ack();

  const user = body.user.id;
  const userName = (await getSlackUserDisplayName(client, user)) || body.user.username;

  const selectedDates = [
    view.state.values.dates_1?.date_select_1?.selected_date,
    view.state.values.dates_2?.date_select_2?.selected_date,
  ].filter(Boolean);

  const leaveType1 = view.state.values.leave_type_1?.leave_type_select_1?.selected_option?.value || "Full_Day";
  const halfDay1 = view.state.values.half_day_1?.half_day_select_1?.selected_option?.value || "Full_Day";
  const leaveType2 = view.state.values.leave_type_2?.leave_type_select_2?.selected_option?.value || "Full_Day";
  const halfDay2 = view.state.values.half_day_2?.half_day_select_2?.selected_option?.value || "Full_Day";
  const leaveDayArray = selectedDates.map((_, i) => (i === 0 ? leaveType1 : leaveType2));
  const leaveTimeArray = selectedDates.map((_, i) => {
    const type = i === 0 ? leaveType1 : leaveType2;
    const half = i === 0 ? halfDay1 : halfDay2;
    return type === "Half_Day" ? half : "Full_Day";
  });

  const reason =
    view.state.values.reason?.reason_input?.value || "No reason provided";

  if (selectedDates.length === 0) {
    await client.chat.postMessage({
      channel: user,
      text: "No valid dates selected for compensatory leave. Please try again.",
    });
    return;
  }

  // const verificationResult = await verifyCompensatoryLeave(
  //   user,
  //   selectedDates,
  //   reason
  // );

  // if (!verificationResult.isValid) {
  //   await client.chat.postMessage({
  //     channel: user,
  //     text: `Failed to submit compensatory leave request: ${verificationResult.message}. Please check the dates and try again.`,
  //   });
  //   return;
  // }

  const leaveDetails =
    `*Leave Type:* Compensatory_Leave\n` +
    selectedDates
      .map((date, i) => {
        const fromDate = new Date(date).toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const type = leaveDayArray[i];
        const half = leaveTimeArray[i];
        return `*Date:* ${fromDate}\n*Type:* ${type}${type === "Half_Day" ? `\n*Half Day:* ${half}` : ""}`;
      })
      .join("\n\n") +
    `\n*Reason:* ${reason || "No reason provided"}`;

  try {
    const leave = new Leave({
      user,
      reason,
      dates: selectedDates.map((date) => new Date(date)),
      status: "Pending",
      leaveType: "Compensatory_Leave",
      leaveDay: leaveDayArray,
      leaveTime: leaveTimeArray,
    });
    await leave.save();

    await client.chat.postMessage({
      channel: user,
      text: `:white_check_mark: Your compensatory leave request has been submitted for approval!\n\n${leaveDetails}`,
    });

    const adminUserId = process.env.ADMIN_USER_ID;
    await client.chat.postMessage({
      channel: adminUserId,
      text: `New compensatory leave request received!`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:bell: New compensatory leave request received from @${userName}!\n\n${leaveDetails}`,
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
    console.error("Error submitting compensatory leave:", error);
    await client.chat.postMessage({
      channel: user,
      text: `:x: @${userName}, there was an error submitting your compensatory leave request. Please try again later.`,
    });
  }
};

/**
 * Schedule a daily reminder at 11:00 AM for users
 * who have not jibbled in and are not on approved leave.
 *
 * Message:
 * "⏰ Reminder: Please make sure to Jibble in by 11:30 AM.
 * Not jibbled in by then will be marked as Half-Day Leave."
 */
const scheduleJibbleInReminder = () => {
  let lastRunDate = null;

  const checkAndSendReminders = async () => {
    const now = new Date();
    const currentDateStr = now.toISOString().split("T")[0];

    // Reset daily
    if (lastRunDate && lastRunDate !== currentDateStr) {
      lastRunDate = null;
    }

    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Run once at 11:00 AM each day
    if (currentHour !== 11 || currentMinute !== 0 || lastRunDate === currentDateStr) {
      return;
    }

    lastRunDate = currentDateStr;

    try {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch all registered Slack users
      const users = await User.find({});
      if (!users || users.length === 0) {
        return;
      }

      const slackIds = users.map((u) => u.slackId);

      // Users who have already jibbled in today
      const todaysAttendance = await Attendance.find({
        user: { $in: slackIds },
        date: currentDateStr,
      });
      const attendedUserIds = new Set(todaysAttendance.map((a) => a.user));

      // Users who are on approved leave today
      const todaysLeaves = await Leave.find({
        user: { $in: slackIds },
        status: "Approved",
        dates: {
          $elemMatch: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        },
      });
      const onLeaveUserIds = new Set(todaysLeaves.map((l) => l.user));

      const usersToRemind = users.filter(
        (u) => !attendedUserIds.has(u.slackId) && !onLeaveUserIds.has(u.slackId)
      );

      if (usersToRemind.length === 0) {
        return;
      }

      for (const user of usersToRemind) {
        try {
          await app.client.chat.postMessage({
            channel: user.slackId,
            text:
              "⏰ Reminder: Please make sure to Jibble in by 11:30 AM.\n" +
              "Not jibbled in by then will be marked as Half-Day Leave.",
          });
        } catch (postError) {
          console.error(
            `Failed to send jibble-in reminder to user ${user.slackId}:`,
            postError
          );
        }
      }
    } catch (error) {
      console.error("Error while processing jibble-in reminders:", error);
    }
  };

  // Check once per minute
  setInterval(checkAndSendReminders, 60 * 1000);
};

/**
 * Schedule a monthly summary on the last day of each month.
 *
 * For each registered user, sends a DM with:
 * - Number of working days in the month (days with a jibble-in record)
 * - Number of leave days taken in the month
 * - List of leave dates (and leave type) for the month
 *
 * Assumption: half-day leaves are counted as full leave days for this summary.
 */
const scheduleMonthlySummary = () => {
  let lastRunMonth = null;

  const checkAndSendMonthlySummaries = async () => {
    const now = new Date();

    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based

    const currentMonthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

    // Determine if today is the last day of the month
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const isLastDay = now.getDate() === lastDayOfMonth;

    // Skip if today is a weekend or public holiday
    // Normalize date to midnight for accurate comparison
    const todayNormalized = new Date(now);
    todayNormalized.setHours(0, 0, 0, 0);
    if (isWeekendOrPublicHoliday(todayNormalized)) {
      return;
    }

    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Run once at 18:00 (6 PM) on the last day of the month
    if (
      !isLastDay ||
      currentHour !== 18 ||
      currentMinute !== 0 ||
      lastRunMonth === currentMonthKey
    ) {
      return;
    }

    lastRunMonth = currentMonthKey;

    try {
      const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

      // All registered users
      const users = await User.find({});
      if (!users || users.length === 0) {
        return;
      }

      const slackIds = users.map((u) => u.slackId);

      // All attendance records for this month
      const attendanceMonthPrefix = `${currentMonthKey}-`;
      const monthAttendance = await Attendance.find({
        user: { $in: slackIds },
        date: { $regex: `^${attendanceMonthPrefix}` },
      });

      // All approved leaves that touch this month
      const monthLeaves = await Leave.find({
        user: { $in: slackIds },
        status: "Approved",
        dates: {
          $elemMatch: {
            $gte: monthStart,
            $lte: monthEnd,
          },
        },
      });

      // Group attendance by user -> set of dates
      const attendanceByUser = new Map();
      for (const a of monthAttendance) {
        if (!attendanceByUser.has(a.user)) {
          attendanceByUser.set(a.user, new Set());
        }
        attendanceByUser.get(a.user).add(a.date);
      }

      // Group leave dates by user (track half-day vs full-day)
      const leaveInfoByUser = new Map();
      for (const leave of monthLeaves) {
        const userId = leave.user;
        if (!leaveInfoByUser.has(userId)) {
          leaveInfoByUser.set(userId, []);
        }

        const leaveDayArray = Array.isArray(leave.leaveDay)
          ? leave.leaveDay
          : [leave.leaveDay];

        (leave.dates || []).forEach((rawDate, idx) => {
          if (!rawDate) return;
          const d = new Date(rawDate);
          if (d < monthStart || d > monthEnd) return;

          const leaveDayValue =
            leaveDayArray[idx] !== undefined
              ? leaveDayArray[idx]
              : leaveDayArray[0];

          let weight = 1;
          if (
            leaveDayValue === "Half_Day" ||
            leaveDayValue === "First_Half" ||
            leaveDayValue === "Second_Half"
          ) {
            weight = 0.5;
          }

          leaveInfoByUser.get(userId).push({
            date: d,
            leaveType: leave.leaveType,
            leaveDay: leaveDayValue,
            weight,
          });
        });
      }

      const monthNameFormatter = new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
      });
      const dateFormatter = new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      const monthLabel = monthNameFormatter.format(monthStart);

      for (const user of users) {
        const userId = user.slackId;

        const attendanceDatesSet = attendanceByUser.get(userId) || new Set();
        const workingDaysCount = attendanceDatesSet.size;

        const leaveEntries = leaveInfoByUser.get(userId) || [];
        // Sort leave entries by date
        leaveEntries.sort((a, b) => a.date - b.date);
        const leaveDaysCount = leaveEntries.reduce(
          (total, entry) => total + (entry.weight || 1),
          0
        );

        const leaveDatesText =
          leaveEntries.length === 0
            ? "None"
            : leaveEntries
                .map((entry) => {
                  const baseDate = dateFormatter.format(entry.date);
                  if (
                    entry.leaveDay === "Half_Day" ||
                    entry.leaveDay === "First_Half" ||
                    entry.leaveDay === "Second_Half"
                  ) {
                    return `• ${baseDate} (${entry.leaveType} - Half Day)`;
                  }
                  return `• ${baseDate} (${entry.leaveType})`;
                })
                .join("\n");

        const summaryText =
          `Here is your attendance summary for *${monthLabel}*:\n\n` +
          `*Working days (jibbled in):* ${workingDaysCount}\n` +
          `*Leave days taken:* ${leaveDaysCount}\n\n` +
          `*Leave dates:*\n${leaveDatesText}`;

        try {
          await app.client.chat.postMessage({
            channel: userId,
            text: summaryText,
          });
        } catch (postError) {
          console.error(
            `Failed to send monthly summary to user ${userId}:`,
            postError
          );
        }
      }
    } catch (error) {
      console.error("Error while processing monthly summaries:", error);
    }
  };

  // Check once per minute
  setInterval(checkAndSendMonthlySummaries, 60 * 1000);
};

module.exports = {
  applyLeave,
  manageLeaves,
  approveLeave,
  rejectLeave,
  handleRejectLeaveReasonSubmission,
  checkIn,
  checkOut,
  onLeave,
  checkBalance,
  showUpcomingHolidays,
  upcomingLeaves,
  handleLeaveTypeSelection,
  openLeaveTypeModal,
  handleSickLeaveSubmission,
  openSickLeaveModal,
  openTestModal,
  handleAddMoreDays,
  handleDateSelectionSubmission,
  handleCasualLeaveSubmission,
  handleMensuralLeaveSubmission,
  handleUnpaidLeaveSubmission,
  handleBurnoutLeaveSubmission,
  handleWorkFromHomeSubmission,
  handleBereavementLeaveSubmission,
  handleMaternityLeaveSubmission,
  handlePaternityLeaveSubmission,
  handleRestrictedHolidaySubmission,
  handleInternshipLeaveSubmission,
  handleCompensatoryLeaveSubmission,
  scheduleJibbleInReminder,
  scheduleMonthlySummary,
};
