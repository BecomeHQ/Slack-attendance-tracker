const { PublicHoliday, RestrictedHoliday } = require("./models/holidays.js");

const publicHolidaysList = [
  { date: new Date("2024-01-01"), name: "New Year" },
  { date: new Date("2024-01-14"), name: "Pongal" },
  { date: new Date("2024-01-15"), name: "Thiruvalluvar Day" },
  { date: new Date("2024-01-26"), name: "Republic Day" },
  { date: new Date("2024-03-30"), name: "Telugu New Year/Ugadi" },
  { date: new Date("2024-03-31"), name: "Ramzan/Idul Fitr" },
  { date: new Date("2024-04-10"), name: "Mahavir Jayanti" },
  { date: new Date("2024-04-14"), name: "Tamil New Year" },
  { date: new Date("2024-04-14"), name: "Dr Ambedkar Jayanti" },
  { date: new Date("2024-04-18"), name: "Good Friday" },
  { date: new Date("2024-05-01"), name: "Worker's Day" },
  { date: new Date("2024-06-07"), name: "Bakrid" },
  { date: new Date("2024-07-06"), name: "Muharram" },
  { date: new Date("2024-08-15"), name: "Independence Day" },
  { date: new Date("2024-08-16"), name: "Krishna Jayanthi" },
  { date: new Date("2024-08-27"), name: "Ganesh Chaturthi" },
  { date: new Date("2024-09-05"), name: "Eid e Milad" },
  { date: new Date("2024-10-01"), name: "Ayutha Pooja" },
  { date: new Date("2024-10-02"), name: "Gandhi Jayanthi" },
  { date: new Date("2024-10-02"), name: "Vijaya Dasami" },
  { date: new Date("2024-10-20"), name: "Diwali" },
  { date: new Date("2024-12-25"), name: "Christmas" },
];

async function addPublicHolidays() {
  try {
    await PublicHoliday.insertMany(publicHolidaysList);
    console.log("publicHolidays added to the database successfully.");
  } catch (error) {
    console.error("Error adding publicHolidays to the database:", error);
  }
}

addPublicHolidays();

const restrictedHolidaysList = [
  { date: new Date("2024-01-06"), name: "Guru Gobind Singh's Birthday" },
  { date: new Date("2024-01-13"), name: "Lohri" },
  { date: new Date("2024-01-16"), name: "Uzavar Thirunal" },
  { date: new Date("2024-02-12"), name: "Guru Ravi Das's Birthday" },
  { date: new Date("2024-02-14"), name: "Valentines Day" },
  { date: new Date("2024-02-19"), name: "Shivaji Jayanti" },
  { date: new Date("2024-02-26"), name: "Maha Shivratri" },
  { date: new Date("2024-03-14"), name: "Holi / Dolyatra" },
  { date: new Date("2024-03-28"), name: "Jamat-Ul-Vida" },
  { date: new Date("2024-04-15"), name: "Vaisakhadi" },
  { date: new Date("2024-05-09"), name: "Tagore Birthday" },
  { date: new Date("2024-06-27"), name: "Rath Yatra" },
  { date: new Date("2024-08-21"), name: "Paryushan festival" },
  { date: new Date("2024-09-04"), name: "Onam" },
  { date: new Date("2024-09-29"), name: "Dussehra (Maha Saptami)" },
  { date: new Date("2024-09-30"), name: "Dussehra (Maha Ashtami)" },
  { date: new Date("2024-10-07"), name: "Maharishi Valmiki's Birthday" },
  { date: new Date("2024-10-10"), name: "Karaka Chaturthi (Karwa Chouth)" },
  { date: new Date("2024-10-22"), name: "Govardhan Puja / Gujarati New Year" },
  { date: new Date("2024-10-23"), name: "Bhai Duj" },
  { date: new Date("2024-10-28"), name: "Surya Sashthi (Chhat Puja)" },
  { date: new Date("2024-11-24"), name: "Guru Teg Bahadur's Birthday" },
  { date: new Date("2024-12-24"), name: "Christmas Eve" },
  { date: new Date("2024-12-31"), name: "New Year Eve" },
];

async function addRestrictedHolidays() {
  try {
    await RestrictedHoliday.insertMany(restrictedHolidaysList);
    console.log("Restricted holidays added to the database successfully.");
  } catch (error) {
    console.error("Error adding restricted holidays to the database:", error);
  }
}

addRestrictedHolidays();
