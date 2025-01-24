require("dotenv").config();
require("./connect/db-connect");
const app = require("./utils/slack-instance");
const {
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
  verifyInternshipLeave,
  openLeaveTypeModal,
  handleLeaveTypeSelection,
  handleSickLeaveSubmission,
  handleAddMoreDays,
  handleDateSelectionSubmission,
  handleCasualLeaveSubmission,
  handleMensuralLeaveSubmission,
  handleUnpaidLeaveSubmission,
  handleBurnoutLeaveSubmission,
  handleWorkFromHomeSubmission,
} = require("./utils/commands");
const validNames = require("./utils/user");
const { User } = require("./models/user");

// const saveSlackUsers = async () => {
//   try {
//     const response = await fetch(`https://slack.com/api/users.list`, {
//       method: "GET",
//       headers: {
//         Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
//         "Content-Type": "application/x-www-form-urlencoded",
//       },
//     });
//     const data = await response.json();

//     if (data.ok && Array.isArray(data.members)) {
//       const userMap = {};

//       for (const user of data.members) {
//         const { id: slackUserId, name } = user;
//         if (validNames.includes(name)) {
//           const newUser = new User({ username: name, slackId: slackUserId });
//           await newUser.save();
//           userMap[name] = { slackUserId };
//         }
//       }
//       console.log("Filtered User map:", userMap);
//     }
//   } catch (error) {
//     console.error("Error fetching users from Slack:", error);
//   }
// };

// saveSlackUsers();

app.command("/apply-leave-bot", openLeaveTypeModal);

app.view("date_selection_modal", handleDateSelectionSubmission);

app.view("sick_leave_application_modal", handleSickLeaveSubmission);

app.view("casual_leave_application_modal", handleCasualLeaveSubmission);

app.view("burnout_leave_application_modal", handleBurnoutLeaveSubmission);

app.view("mensural_leave_application_modal", handleMensuralLeaveSubmission);

app.view("unpaid_leave_application_modal", handleUnpaidLeaveSubmission);

app.command("/manage-leaves", manageLeaves);

app.action(/approve_leave_(.*)/, approveLeave);

app.action(/reject_leave_(.*)/, rejectLeave);

app.command("/jibble-in", checkIn);

app.command("/jibble-out", checkOut);

app.command("/onleave", onLeave);

app.command("/check-balance", checkBalance);

app.command("/upcoming-holidays", showUpcomingHolidays);

app.command("/upcoming-leaves", upcomingLeaves);

app.action(/select_(.*)_leave/, handleLeaveTypeSelection);

app.action("add_more_days_button", handleAddMoreDays);

app.action("date_select", handleDateSelectionSubmission);

app.view("work_from_home_application_modal", handleWorkFromHomeSubmission);

(async () => {
  await app.start(process.env.PORT || 1000);
  console.log("⚡️ Slack Bolt app is running!");
})();
