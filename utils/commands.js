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
                  text: "Sick Leave",
                },
                value: "sick_leave",
                action_id: "select_sick_leave",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Casual Leave",
                },
                value: "casual_leave",
                action_id: "select_casual_leave",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Burnout Leave",
                },
                value: "burnout_leave",
                action_id: "select_burnout_leave",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Mensural Leave",
                },
                value: "mensural_leave",
                action_id: "select_mensural_leave",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Unpaid Leave",
                },
                value: "unpaid_leave",
                action_id: "select_unpaid_leave",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Internship Leave",
                },
                value: "internship_leave",
                action_id: "select_internship_leave",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Work-from-Home Leave",
                },
                value: "workfrom_home_leave",
                action_id: "select_workhome_leave",
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
      text: `Your leave request from ${formatDate(
        leaveRequest.fromDate
      )} to ${formatDate(leaveRequest.toDate)} has been rejected.`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Your leave request has been *rejected* ❌\n\n*Duration:* ${formatDate(
              leaveRequest.fromDate
            )} to ${formatDate(
              leaveRequest.toDate
            )}\n\nPlease contact your lead for more info.`,
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

const handleLeaveTypeSelection = async ({ ack, body, client }) => {
  await ack();
  const action = body.actions[0];

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
                    text: "Half Day",
                  },
                  value: "Half_Day",
                },
              ],
              action_id: "leave_type_select_1",
            },
            label: {
              type: "plain_text",
              text: "Leave Type",
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
                    text: "Half Day",
                  },
                  value: "Half_Day",
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
                    text: "Half Day",
                  },
                  value: "Half_Day",
                },
              ],
              action_id: "leave_type_select_3",
            },
            label: {
              type: "plain_text",
              text: "Leave Type",
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
            type: "input",
            block_id: "dates_1",
            element: {
              type: "datepicker",
              placeholder: {
                type: "plain_text",
                text: "Select start date",
              },
              action_id: "date_select_1",
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
              action_id: "date_select_2",
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
  } else if (action.action_id === "select_workhome_leave") {
    await client.views.update({
      view_id: body.view.id,
      view: {
        type: "modal",
        callback_id: "work_from_home_application_modal",
        title: {
          type: "plain_text",
          text: "Apply for Unpaid Leave",
        },
        blocks: [
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
        return `*User:* <@${leave.user}>\n*From:* ${formatDate(
          leave.fromDate
        )}\n*To:* ${formatDate(leave.toDate)}\n*Reason:* ${leave.reason}`;
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
        return `*User:* <@${leave.user}>\n*From:* ${formatDate(
          leave.fromDate
        )}\n*To:* ${formatDate(leave.toDate)}\n*Reason:* ${leave.reason}`;
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

    const leaveDays = leaveRequest.leaveDay.reduce((total, dayType) => {
      return total + (dayType === "Full_Day" ? 1 : 0.5);
    }, 0);

    let remainingLeaveBalance;
    let approvalMessage;
    console.log({ leaveRequest });

    if (leaveRequest.leaveType === "Sick_Leave") {
      user.sickLeave = (user.sickLeave || 0) + leaveDays;
      remainingLeaveBalance = 12 - user.sickLeave;
      approvalMessage = `🤒 Your sick leave for ${formatDate(
        leaveRequest.fromDate
      )} is approved. Take it easy and focus on getting better. If you need any health resources, check out Plum or reach out if anything is urgent. Wishing you a speedy recovery!`;
    } else if (leaveRequest.leaveType === "Burnout_Leave") {
      user.burnout = (user.burnout || 0) + leaveDays;
      remainingLeaveBalance = 6 - user.burnout;
      approvalMessage = `🧠 Your burnout leave for ${formatDate(
        leaveRequest.fromDate
      )} is approved. Your well-being matters. Take this time to rest and reflect. It might help to chat with your lead about finding more sustainable ways to work. Take care!`;
    } else if (leaveRequest.leaveType === "Paternity_Leave") {
      user.paternityLeave = (user.paternityLeave || 0) + leaveDays;
      remainingLeaveBalance = 20 - user.paternityLeave;
      approvalMessage = `🍼 Your paternity leave starting ${formatDate(
        leaveRequest.fromDate
      )} is approved! Congratulations on this exciting new chapter! Wishing you and your family beautiful moments ahead.`;
    } else if (leaveRequest.leaveType === "Casual_Leave") {
      user.casualLeave = (user.casualLeave || 0) + leaveDays;
      remainingLeaveBalance = 6 - user.casualLeave;
      approvalMessage = `🌼 Your casual leave for ${formatDate(
        leaveRequest.fromDate
      )} is approved! Wishing you a peaceful and refreshing break. Enjoy your time off!`;
    } else if (leaveRequest.leaveType === "Bereavement_Leave") {
      user.bereavementLeave = (user.bereavementLeave || 0) + leaveDays;
      remainingLeaveBalance = 5 - user.bereavementLeave;
    } else if (leaveRequest.leaveType === "Restricted_Holiday") {
      user.restrictedHoliday = (user.restrictedHoliday || 0) + leaveDays;
      remainingLeaveBalance = 6 - user.restrictedHoliday;
      approvalMessage = `🌴 Your leave for ${formatDate(
        leaveRequest.fromDate
      )} is approved! Hope you make the most of your break. Take this time to relax and recharge!`;
    } else if (leaveRequest.leaveType === "Mensural_Leaves") {
      user.mensuralLeaves = (user.mensuralLeaves || 0) + leaveDays;
      remainingLeaveBalance = 18 - user.mensuralLeaves;
    } else if (leaveRequest.leaveType === "Maternity_Leave") {
      user.maternityLeave = (user.maternityLeave || 0) + leaveDays;
      remainingLeaveBalance = 65 - user.maternityLeave;
      approvalMessage = `👶 Your maternity leave starting ${formatDate(
        leaveRequest.fromDate
      )} is approved. Wishing you a joyful and safe journey into motherhood. We can't wait to meet your little one someday!`;
    } else if (leaveRequest.leaveType === "Unpaid_Leave") {
      user.unpaidLeave = (user.unpaidLeave || 0) + leaveDays;
      remainingLeaveBalance = 20 - user.unpaidLeave;
      approvalMessage = `📝 Your unpaid leave for ${formatDate(
        leaveRequest.fromDate
      )} is approved. We understand life can be unpredictable. If you need any assistance or resources during this time, don't hesitate to reach out.`;
    } else if (leaveRequest.leaveType === "WFH_Leave") {
      user.wfhLeave = (user.wfhLeave || 0) + leaveDays;
      remainingLeaveBalance = 4 - user.wfhLeave;
      approvalMessage = `🏡 Your WFH day for ${formatDate(
        leaveRequest.fromDate
      )} is approved! Make yourself comfortable and stay productive. Remember, you can take 1 WFH day every week!`;
    } else if (leaveRequest.leaveType === "Internship_Leave") {
      user.internshipLeave = (user.internshipLeave || 0) + leaveDays;
      approvalMessage = `📚 Your leave for ${formatDate(
        leaveRequest.fromDate
      )} is approved. Take your well-deserved break!`;
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

  const halfDays = leaveTypes.map((type, index) => {
    if (type === "Full_Day") {
      return "Full_Day";
    } else {
      return (
        view.state.values[`half_day_${index + 1}`][
          `half_day_select_${index + 1}`
        ].selected_option?.value || "N/A"
      );
    }
  });

  console.log("Half Days:", halfDays);

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
    halfDays,
    reason
  );

  if (!verificationResult.isValid) {
    await client.chat.postMessage({
      channel: user,
      text: `Failed to submit sick leave request: ${verificationResult.message}. Please check the dates and try again.`,
    });
    return;
  }

  const leaveDetails = selectedDates
    .map((date, index) => {
      const fromDate = new Date(date).toISOString().split("T")[0];
      const leaveType = leaveTypes[index];
      const halfDay = halfDays[index];
      return `*Date:* ${fromDate}\n*Type:* ${leaveType}\n*Half Day:* ${halfDay}`;
    })
    .join("\n\n");

  try {
    const leave = new Leave({
      user,
      dates: selectedDates,
      reason,
      leaveType: "Sick_Leave",
      leaveDay: leaveTypes,
      leaveTime: halfDays,
    });
    await leave.save();

    await client.chat.postMessage({
      channel: user,
      text: `:white_check_mark: Your leave request has been submitted for approval!\n\n${leaveDetails}`,
    });

    const adminUserId = process.env.ADMIN_USER_ID;
    await client.chat.postMessage({
      channel: adminUserId,
      text: `:bell: New leave request received!\n\n${leaveDetails}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:bell: New leave request received!\n\n${leaveDetails}`,
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
        .map((date) => new Date(date).toISOString().split("T")[0])
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

  const halfDays = leaveTypes.map((type, index) => {
    if (type === "Full_Day") {
      return "Full_Day";
    } else {
      return (
        view.state.values[`half_day_${index + 1}`][
          `half_day_select_${index + 1}`
        ].selected_option?.value || "N/A"
      );
    }
  });

  console.log("Half Days:", halfDays);

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
    halfDays,
    reason
  );

  if (!verificationResult.isValid) {
    await client.chat.postMessage({
      channel: user,
      text: `Failed to submit casual leave request: ${verificationResult.message}. Please check the dates and try again.`,
    });
    return;
  }

  const leaveDetails = selectedDates
    .map((date, index) => {
      const fromDate = new Date(date).toISOString().split("T")[0];
      const leaveType = leaveTypes[index];
      const halfDay = halfDays[index];
      return `*Date:* ${fromDate}\n*Type:* ${leaveType}\n*Half Day:* ${halfDay}`;
    })
    .join("\n\n");

  try {
    const leave = new Leave({
      user,
      dates: selectedDates,
      reason,
      leaveType: "Casual_Leave",
      leaveDay: leaveTypes,
      leaveTime: halfDays,
    });
    await leave.save();

    await client.chat.postMessage({
      channel: user,
      text: `:white_check_mark: Your casual leave request has been submitted for approval!\n\n${leaveDetails}`,
    });

    const adminUserId = process.env.ADMIN_USER_ID;
    await client.chat.postMessage({
      channel: adminUserId,
      text: `:bell: New casual leave request received!\n\n${leaveDetails}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:bell: New casual leave request received!\n\n${leaveDetails}`,
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
  }
};

const handleMensuralLeaveSubmission = async ({ ack, body, view, client }) => {
  await ack();

  const user = body.user.id;

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

  const halfDays = leaveTypes.map((type, index) => {
    if (type === "Full_Day") {
      return "Full_Day";
    } else {
      return (
        view.state.values[`half_day_${index + 1}`][
          `half_day_select_${index + 1}`
        ].selected_option?.value || "N/A"
      );
    }
  });

  console.log("Half Days:", halfDays);

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
    halfDays,
    reason
  );

  if (!verificationResult.isValid) {
    await client.chat.postMessage({
      channel: user,
      text: `Failed to submit mensural leave request: ${verificationResult.message}. Please check the dates and try again.`,
    });
    return;
  }

  const leaveDetails = selectedDates
    .map((date, index) => {
      const fromDate = new Date(date).toISOString().split("T")[0];
      const leaveType = leaveTypes[index];
      const halfDay = halfDays[index];
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
      leaveTime: halfDays,
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
      text: `:bell: New mensural leave request received!\n\n${leaveDetails}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:bell: New mensural leave request received!\n\n${leaveDetails}`,
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
  }
};

const handleUnpaidLeaveSubmission = async ({ ack, body, view, client }) => {
  await ack();

  const user = body.user.id;

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

  const halfDays = leaveTypes.map((type, index) => {
    if (type === "Full_Day") {
      return "Full_Day";
    } else {
      return (
        view.state.values[`half_day_${index + 1}`][
          `half_day_select_${index + 1}`
        ].selected_option?.value || "N/A"
      );
    }
  });

  console.log("Half Days:", halfDays);

  const reason =
    view.state.values.reason.reason_input.value || "No reason provided";

  const verificationResult = await verifyUnpaidLeave(
    user,
    selectedDates,
    leaveTypes,
    halfDays,
    reason
  );

  if (!verificationResult.isValid) {
    await client.chat.postMessage({
      channel: user,
      text: `Failed to submit unpaid leave request: ${verificationResult.message}. Please check the dates and try again.`,
    });
    return;
  }

  const leaveDetails = selectedDates
    .map((date, index) => {
      const fromDate = new Date(date).toISOString().split("T")[0];
      const leaveType = leaveTypes[index];
      const halfDay = halfDays[index];
      return `*Date:* ${fromDate}\n*Type:* ${leaveType}\n*Half Day:* ${halfDay}`;
    })
    .join("\n\n");

  try {
    const leave = new Leave({
      user,
      dates: selectedDates,
      reason,
      leaveType: "Unpaid_Leave",
      leaveDay: leaveTypes,
      leaveTime: halfDays,
    });
    await leave.save();

    await client.chat.postMessage({
      channel: user,
      text: `:white_check_mark: Your unpaid leave request has been submitted for approval!\n\n${leaveDetails}`,
    });

    const adminUserId = process.env.ADMIN_USER_ID;
    await client.chat.postMessage({
      channel: adminUserId,
      text: `:bell: New unpaid leave request received!\n\n${leaveDetails}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:bell: New unpaid leave request received!\n\n${leaveDetails}`,
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
  const startDate = view.state.values.dates_1.start_date_select.selected_date;
  const endDate = view.state.values.dates_2.end_date_select.selected_date;
  const reason = view.state.values.reason.reason_input.value;
  const selectedDates = [startDate, endDate].filter(Boolean);
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
      reason
    );

    if (!verificationResult.isValid) {
      await client.chat.postMessage({
        channel: user,
        text: `Failed to submit burnout leave request: ${verificationResult.message}. Please check the dates and try again.`,
      });
      return;
    }

    const leaveDetails = selectedDates
      .map((date) => {
        const fromDate = new Date(date).toISOString().split("T")[0];
        return `*Date:* ${fromDate}\n*Type:* Full Day`;
      })
      .join("\n\n");

    try {
      const leave = new Leave({
        user,
        dates: selectedDates,
        reason,
        leaveType: "Burnout_Leave",
        leaveDay: Array(selectedDates.length).fill("Full_Day"),
        leaveTime: Array(selectedDates.length).fill("Full_Day"),
      });
      await leave.save();

      await client.chat.postMessage({
        channel: user,
        text: `:white_check_mark: Your burnout leave request has been submitted for approval!\n\n${leaveDetails}`,
      });

      const adminUserId = process.env.ADMIN_USER_ID;
      await client.chat.postMessage({
        channel: adminUserId,
        text: `:bell: New burnout leave request received!\n\n${leaveDetails}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `:bell: New burnout leave request received!\n\n${leaveDetails}`,
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
          .map((date) => new Date(date).toISOString().split("T")[0])
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
  const selectedDate = view.state.values.date.date_select.selected_date;
  const reason =
    view.state.values.reason.reason_input.value || "No reason provided"; // Default reason if not provided
  console.log("Selected Date:", new Date(selectedDate));
  console.log("Reason for leave:", reason);

  try {
    const leave = new Leave({
      user,
      dates: [new Date(selectedDate)], // Ensure date is converted to Date object
      reason,
      leaveType: "Work_from_Home",
      leaveDay: ["Full_Day"], // Assuming 'leaveDay' expects an array of strings
      leaveTime: ["Full_Day"], // Assuming 'leaveTime' expects an array of strings
    });
    console.log(leave);

    await leave.save();
    const leaveDetails = `*Date:* ${
      new Date(selectedDate).toISOString().split("T")[0]
    }\n*Type:* Full_Day\n*Half Day:* Full_Day`;
    await client.chat.postMessage({
      channel: user,
      text: `:white_check_mark: Your casual leave request has been submitted for approval!\n\n${leaveDetails}`,
    });

    const adminUserId = process.env.ADMIN_USER_ID;
    await client.chat.postMessage({
      channel: adminUserId,
      text: `:bell: New casual leave request received!\n\n${leaveDetails}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:bell: New casual leave request received!\n\n${leaveDetails}`,
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
      text: `:x: There was an error submitting your work from home leave request. Please try again later.`,
    });
  }
};

module.exports = {
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
};
