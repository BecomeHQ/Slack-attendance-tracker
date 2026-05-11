/**
 * Maps each team member (Slack user id) to their direct lead's Slack user id.
 * Harish (operations) receives every leave request in addition to the member's lead.
 */
const TEAM_LEAVE_ROUTING = {
  GraphicDesign: [
    {
      username: "Achuthan",
      userSlackId: "U09US6G61V4",
      lead: "Pooja",
      leadSlackId: "U02MCTN385A",
    },
    {
      username: "Afridha",
      userSlackId: "U05E5KBAT26",
      lead: "Pooja",
      leadSlackId: "U02MCTN385A",
    },
    {
      username: "Arjun Vishnu",
      userSlackId: "U07G1Q5A1KR",
      lead: "Pooja",
      leadSlackId: "U02MCTN385A",
    },
    {
      username: "Gautham",
      userSlackId: "U06CGR4RPGV",
      lead: "Pooja",
      leadSlackId: "U02MCTN385A",
    },
    {
      username: "Shruti.r",
      userSlackId: "U09ECQP5KDK",
      lead: "Pooja",
      leadSlackId: "U02MCTN385A",
    },
    {
      username: "Soham.d",
      userSlackId: "U09US6GF20N",
      lead: "Pooja",
      leadSlackId: "U02MCTN385A",
    },
    {
      username: "Preetam.r",
      userSlackId: "U0A6NCL2FJR",
      lead: "Pooja",
      leadSlackId: "U02MCTN385A",
    },
  ],

  ContentTeam: [
    {
      username: "Adithi.s",
      userSlackId: "U0A7L4VS1PS",
      lead: "Samshritha Kumar",
      leadSlackId: "U0145T9FDH8",
    },
    {
      username: "Arun Thangavel",
      userSlackId: "U07F37E4S12",
      lead: "Samshritha Kumar",
      leadSlackId: "U0145T9FDH8",
    },
  ],

  Development: [
    {
      username: "Prity Dhara",
      userSlackId: "U08DHB3TTFX",
      lead: "Samuel Sleeba",
      leadSlackId: "U01CN2WA1T2",
    },
  ],

  DigitalTeam: [
    {
      username: "Arun Sandeep",
      userSlackId: "U05UDFQ1Z7A",
      lead: "Harish Venkatesh",
      leadSlackId: "UB05U84LX",
    },
    {
      username: "Gokul",
      userSlackId: "U08AU3DM092",
      lead: "Harish Venkatesh",
      leadSlackId: "UB05U84LX",
    },
    {
      username: "Praveen",
      userSlackId: "U099E470LM6",
      lead: "Harish Venkatesh",
      leadSlackId: "UB05U84LX",
    },
    {
      username: "Preksha Dugar",
      userSlackId: "U022F2W0HHP",
      lead: "Harish Venkatesh",
      leadSlackId: "UB05U84LX",
    },
    {
      username: "Vasanth Kumar",
      userSlackId: "U05DT5SQ0BS",
      lead: "Harish Venkatesh",
      leadSlackId: "UB05U84LX",
    },
  ],

  Marketing: [
    {
      username: "Pooja.r",
      userSlackId: "U099E4897GQ",
      lead: "Vignesh Arullingam",
      leadSlackId: "ULVHUR56Y",
    },
    {
      username: "Akshaya",
      userSlackId: "U093E411EUQ",
      lead: "Vignesh Arullingam",
      leadSlackId: "ULVHUR56Y",
    },
  ],

  ResearchTeam: [
    {
      username: "Gayathri Srinivasan",
      userSlackId: "U08VA01T7UZ",
      lead: "Indhu Kanth",
      leadSlackId: "USH087NMD",
    },
  ],

  OperationsGroup: [
    {
      username: "Kajol",
      userSlackId: "U099E481108",
      lead: "Harish Venkatesh",
      leadSlackId: "UB05U84LX",
    },
    {
      username: "Induja.s",
      userSlackId: "U09US6FJHAA",
      lead: "Harish Venkatesh",
      leadSlackId: "UB05U84LX",
    },
    {
      username: "Divya Sanchana",
      userSlackId: "U06S83SJJUU",
      lead: "Harish Venkatesh",
      leadSlackId: "UB05U84LX",
    },
    {
      username: "Indhu Kanth",
      userSlackId: "USH087NMD",
      lead: "Harish Venkatesh",
      leadSlackId: "UB05U84LX",
    },
    {
      username: "Samuel Sleeba",
      userSlackId: "U01CN2WA1T2",
      lead: "Harish Venkatesh",
      leadSlackId: "UB05U84LX",
    },
    {
      username: "Pooja",
      userSlackId: "U02MCTN385A",
      lead: "Harish Venkatesh",
      leadSlackId: "UB05U84LX",
    },
    {
      username: "Samshritha Kumar",
      userSlackId: "U0145T9FDH8",
      lead: "Harish Venkatesh",
      leadSlackId: "UB05U84LX",
    },
    {
      username: "Vignesh Arullingam",
      userSlackId: "ULVHUR56Y",
      lead: "Harish Venkatesh",
      leadSlackId: "UB05U84LX",
    },
    {
      username: "Mohana.r",
      userSlackId: "U0ACYVBJBS5",
      lead: "Harish Venkatesh",
      leadSlackId: "UB05U84LX",
    },
    {
      username: "Juhi",
      userSlackId: "U05F5TWC59B",
      lead: "Harish Venkatesh",
      leadSlackId: "UB05U84LX",
    },
  ],
};

const HARISH_SLACK_USER_ID = "UB05U84LX";

/** First roster entry wins if the same Slack id appears twice. */
const USER_TO_LEAD_SLACK_ID = new Map();
for (const members of Object.values(TEAM_LEAVE_ROUTING)) {
  if (!Array.isArray(members)) continue;
  for (const row of members) {
    if (
      row.userSlackId &&
      row.leadSlackId &&
      !USER_TO_LEAD_SLACK_ID.has(row.userSlackId)
    ) {
      USER_TO_LEAD_SLACK_ID.set(row.userSlackId, row.leadSlackId);
    }
  }
}

/**
 * @param {string} [applicantSlackUserId]
 * @returns {string[]} Unique Slack user ids: Harish + direct lead (when known).
 */
const getLeaveApproverIdsForApplicant = (applicantSlackUserId) => {
  const ids = new Set();
  if (HARISH_SLACK_USER_ID) {
    ids.add(HARISH_SLACK_USER_ID);
  }
  if (applicantSlackUserId) {
    const leadId = USER_TO_LEAD_SLACK_ID.get(applicantSlackUserId);
    if (leadId) {
      ids.add(leadId);
    }
  }
  return [...ids].filter(Boolean);
};

module.exports = {
  TEAM_LEAVE_ROUTING,
  HARISH_SLACK_USER_ID,
  getLeaveApproverIdsForApplicant,
};
