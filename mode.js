const { PublicHoliday, RestrictedHoliday } = require("./models/holidays.js");

const publicHolidaysList = [
  { date: new Date("2026-01-01"), name: "New Year" },
  { date: new Date("2026-01-15"), name: "Pongal" },
  { date: new Date("2026-01-16"), name: "Thiruvalluvar Day" },
  { date: new Date("2026-01-26"), name: "Republic Day" },
  { date: new Date("2026-03-19"), name: "Telugu New Year/Ugadi" },
  { date: new Date("2026-03-21"), name: "Ramzan/Idul Fitr" },
  { date: new Date("2026-03-31"), name: "Mahavir Jayanthi" },
  { date: new Date("2026-04-03"), name: "Good Friday" },
  { date: new Date("2026-04-14"), name: "Tamil New Year" },
  { date: new Date("2026-04-14"), name: "Dr Ambedkar Jayanthi" },
  { date: new Date("2026-05-01"), name: "Worker's Day" },
  { date: new Date("2026-05-28"), name: "Bakrid" },
  { date: new Date("2026-06-26"), name: "Muharram" },
  { date: new Date("2026-08-15"), name: "Independence Day" },
  { date: new Date("2026-08-26"), name: "Eid-e-Milad" },
  { date: new Date("2026-09-04"), name: "Krishna Jayanthi" },
  { date: new Date("2026-09-14"), name: "Ganesh Chaturthi" },
  { date: new Date("2026-10-02"), name: "Gandhi Jayanthi" },
];

async function addPublicHolidays() {
  try {
    await PublicHoliday.insertMany(publicHolidaysList);
    console.log("publicHolidays added to the database successfully.");
  } catch (error) {
    console.error("Error adding publicHolidays to the database:", error);
  }
}

// addPublicHolidays();

const restrictedHolidaysList = [
  { date: new Date("2026-01-03"), name: "Induja S Nair's Birthday" },
  { date: new Date("2026-01-05"), name: "Guru Gobind Singh's Birthday" },
  { date: new Date("2026-01-13"), name: "Lohri" },
  { date: new Date("2026-01-17"), name: "Uzhavar Thirunal" },
  { date: new Date("2026-02-01"), name: "Guru Ravi Das's Birthday" },
  { date: new Date("2026-02-08"), name: "Kajol's Birthday" },
  { date: new Date("2026-02-14"), name: "Valentines Day" },
  { date: new Date("2026-02-19"), name: "Shivaji Jayanti" },
  { date: new Date("2026-02-20"), name: "Prity's Birthday" },
  { date: new Date("2026-03-04"), name: "Holi / Dolyatra" },
  { date: new Date("2026-03-13"), name: "Jamat-Ul-Vida" },
  { date: new Date("2026-03-30"), name: "Arjun's Birthday" },
  { date: new Date("2026-03-31"), name: "Pooja Shah's Birthday" },
  { date: new Date("2026-03-31"), name: "Maha Shivratri" },
  { date: new Date("2026-04-07"), name: "Vasanth's Birthday" },
  { date: new Date("2026-04-14"), name: "Vaisakhadi" },
  { date: new Date("2026-04-18"), name: "Preksha Dugar's Birthday" },
  { date: new Date("2026-04-21"), name: "Arun Thangavel's Birthday" },
  { date: new Date("2026-04-30"), name: "Pooja Raghu's Birthday" },
  { date: new Date("2026-05-06"), name: "Akshaya's Birthday" },
  { date: new Date("2026-05-09"), name: "Tagore Birthday" },
  { date: new Date("2026-05-27"), name: "Gayathri's Birthday" },
  { date: new Date("2026-06-13"), name: "Vignesh's Birthday" },
  { date: new Date("2026-07-04"), name: "Praveen Kumar's Birthday" },
  { date: new Date("2026-07-16"), name: "Rath Yatra" },
  { date: new Date("2026-07-31"), name: "Gautham's Birthday" },
  { date: new Date("2026-08-06"), name: "Achuthan's Birthday" },
  { date: new Date("2026-08-26"), name: "Onam" },
  { date: new Date("2026-08-28"), name: "Raksha Bandhan" },
  { date: new Date("2026-09-08"), name: "Paryushan festival" },
  { date: new Date("2026-09-12"), name: "Soham's Birthday" },
  { date: new Date("2026-10-03"), name: "Gokul's Birthday" },
  { date: new Date("2026-10-19"), name: "Dussehra (Maha Ashtami)" },
  { date: new Date("2026-10-24"), name: "Shri Karthick Adhithya's Birthday" },
  { date: new Date("2026-11-04"), name: "Samshritha Kumar's Birthday" },
  { date: new Date("2026-11-05"), name: "Samuel Sleeba's Birthday" },
  { date: new Date("2026-11-07"), name: "B S Arun Sandeep's Birthday" },
  { date: new Date("2026-11-09"), name: "Afridha Aneez's Birthday" },
  { date: new Date("2026-11-13"), name: "Shruti Ramnath's Birthday" },
  { date: new Date("2026-12-03"), name: "Indhu Kanth L's Birthday" },
  { date: new Date("2026-12-07"), name: "Juhi Bhanot's Birthday" },
  { date: new Date("2026-12-19"), name: "Divya Sanchana Ananth's Birthday" },
  { date: new Date("2026-12-30"), name: "Harish Venkatesh's Birthday" },
];

async function addRestrictedHolidays() {
  try {
    await RestrictedHoliday.insertMany(restrictedHolidaysList);
    console.log("Restricted holidays added to the database successfully.");
  } catch (error) {
    console.error("Error adding restricted holidays to the database:", error);
  }
}

// addRestrictedHolidays();

module.exports = {
  publicHolidaysList,
  restrictedHolidaysList,
};
