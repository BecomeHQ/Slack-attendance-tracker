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
  { date: new Date("2025-01-06"), name: "Guru Gobind Singh's Birthday" },
  { date: new Date("2025-01-13"), name: "Lohri" },
  { date: new Date("2025-01-16"), name: "Uzavar Thirunal" },
  { date: new Date("2025-02-12"), name: "Guru Ravi Das's Birthday" },
  { date: new Date("2025-02-14"), name: "Valentines Day" },
  { date: new Date("2025-02-19"), name: "Shivaji Jayanti" },
  { date: new Date("2025-02-26"), name: "Maha Shivratri" },
  { date: new Date("2025-03-14"), name: "Holi / Dolyatra" },
  { date: new Date("2025-03-28"), name: "Jamat-Ul-Vida" },
  { date: new Date("2025-04-15"), name: "Vaisakhadi" },
  { date: new Date("2025-05-09"), name: "Tagore Birthday" },
  { date: new Date("2025-06-27"), name: "Rath Yatra" },
  { date: new Date("2025-08-21"), name: "Paryushan festival" },
  { date: new Date("2025-09-04"), name: "Onam" },
  { date: new Date("2025-09-29"), name: "Dussehra (Maha Saptami)" },
  { date: new Date("2025-09-30"), name: "Dussehra (Maha Ashtami)" },
  { date: new Date("2025-10-07"), name: "Maharishi Valmiki's Birthday" },
  { date: new Date("2025-10-10"), name: "Karaka Chaturthi (Karwa Chouth)" },
  { date: new Date("2025-10-22"), name: "Govardhan Puja / Gujarati New Year" },
  { date: new Date("2025-10-23"), name: "Bhai Duj" },
  { date: new Date("2025-10-28"), name: "Surya Sashthi (Chhat Puja)" },
  { date: new Date("2025-11-24"), name: "Guru Teg Bahadur's Birthday" },
  { date: new Date("2025-12-24"), name: "Christmas Eve" },
  { date: new Date("2025-12-31"), name: "New Year Eve" },
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
