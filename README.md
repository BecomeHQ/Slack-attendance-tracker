# Slack Attendance Tracker

This application tracks user attendance by allowing users to check in and check out using Slack commands. The app records timestamps and posts notifications to a dedicated attendance channel.

## Features

- `/jibble-in` command for users to check in
- `/jibble-out` command for users to check out
- Automatic posting of attendance updates to a designated Slack channel
- Recording of attendance data in a MongoDB database

## Setup

1. Create a Slack channel for attendance tracking (e.g., #attendance)
2. Get the channel ID of your attendance channel by right-clicking on the channel and selecting "Copy Link"
3. Add the channel ID to your environment variables:

```
ATTENDANCE_CHANNEL_ID=C012345ABCDE
```

4. Make sure your Slack bot is added to the attendance channel
5. Restart the application

## Usage

Users can check in and out using the following commands:

- `/jibble-in` - Records check-in time and posts a message to the attendance channel
- `/jibble-out` - Records check-out time and posts a message to the attendance channel

## How It Works

When a user checks in or checks out:

1. The timestamp is recorded in the database
2. A confirmation message is sent to the user
3. A notification is posted in the attendance channel showing the user's name and timestamp

## Configuration

You can customize the appearance and behavior of the attendance messages by modifying the `checkIn` and `checkOut` functions in `utils/commands.js`.

For example, you could change the message format or add additional information like total hours worked when checking out.

## Troubleshooting

If messages are not appearing in the attendance channel:

- Verify that your bot has been added to the channel
- Check that the `ATTENDANCE_CHANNEL_ID` environment variable is set correctly
- Ensure the bot has appropriate permissions (`chat:write`) for the channel
