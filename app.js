require("dotenv").config();
require("./connect/db-connect");
const { User } = require("./models/user");
const app = require("./utils/slack-instance");
const {
  leave_application_modal,
  applyLeave,
  manageLeaves,
  approveLeave,
  rejectLeave,
} = require("./utils/commands");
// const validNames = require("./utils/user");

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

app.command("/apply-leave-bot", applyLeave);

app.view("leave_application_modal", leave_application_modal);

app.command("/manage-leaves", manageLeaves);

app.action(/approve_leave_(.*)/, approveLeave);

app.action(/reject_leave_(.*)/, rejectLeave);

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log("⚡️ Slack Bolt app is running!");
})();
