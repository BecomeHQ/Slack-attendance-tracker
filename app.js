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

const saveSlackUsers = async (accessToken) => {
  try {
    const response = await fetch("https://slack.com/api/users.lookupByEmail", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    const data = await response.json();
    console.log("Users fetched from Slack:", data);

    // if (data.ok && data.members) {
    //   for (const user of data.members) {
    //     const { id: slackUserId, profile } = user;
    //     const email = profile?.email;
    //     const username = profile?.real_name || user.name;

    //     if (email) {
    //       let existingUser = await User.findOne({ email });
    //       if (!existingUser) {
    //         const newUser = new User({
    //           username,
    //           email,
    //           slackUserId,
    //         });
    //         await newUser.save();
    //         console.log(
    //           `User saved: ${username}, Email: ${email}, Slack ID: ${slackUserId}`
    //         );
    //       } else {
    //         console.log(
    //           `User already exists: ${existingUser.username}, Email: ${email}, Slack ID: ${slackUserId}`
    //         );
    //       }
    //     }
    //   }
    // }
  } catch (error) {
    console.error("Error fetching users from Slack:", error);
  }
};

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
