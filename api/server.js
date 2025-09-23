// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const pool = require('../db/mysql'); // MySQL pool
const applicationsRoutes = require("./applications.js");
const careersRoutes = require("./careers.js");
const profileRoutes = require("./profileRoutes.js");
const employerRoutes = require("./employerRoutes");
const adminApplicationsRoutes = require("./adminApplications");
const requireAdmin = require("./requireAdmin");
const { sendOtpEmail } = require('../GmailMailer');
const XLSX = require('xlsx');

const { imageUpload, excelUpload, resumeUpload } = require("./uploadConfig");
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3002;

// ----------------------
// Middleware
// ----------------------
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// ✅ Static files (frontend assets, default-profile.png, etc.)
app.use(express.static(path.join(__dirname, "../public")));

// ✅ Session (must be before routes)
app.use(session({
  secret: process.env.SESSION_SECRET || "alumni2025",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false, maxAge: 1000 * 60 * 60 } // 1hr
}));

// ----------------------
// Routes
// ----------------------
app.use("/api/applications", applicationsRoutes);
app.use("/api/careers", careersRoutes);
app.use("/api/fullInformation", profileRoutes);
app.use("/api/employers", employerRoutes);
app.use("/api/admin-applications", adminApplicationsRoutes);

app.use("/api/admin-applications", requireAdmin, adminApplicationsRoutes);


// Public homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/homepage.html"));
});

// Excel import
app.post("/api/alumni/import", excelUpload.single("file"), (req, res) => {
  res.json({ success: true, filename: req.file.originalname });
});

// ✅ Serve uploaded files
app.use(express.static(path.join(__dirname, "../public")));
app.use("/uploads/resumes", express.static(path.join(__dirname, "../public/uploads/resumes")));
app.use("/uploads/profilePics", express.static(path.join(__dirname, "../public/uploads/profilePics")));
app.use("/uploads", express.static(path.join(__dirname, "../public/uploads"))); // fixed path!

// ----------------------
// Sockets
// ----------------------
app.locals.io = io;
io.on("connection", socket => {
  console.log("🔌 Socket connected:", socket.id);
});

app.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    // generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000);

    // send email
    await sendOtpEmail(email, otp);

    res.json({ success: true, message: "OTP sent", otp }); // ⚠️ don't return otp in production
  } catch (err) {
    console.error("❌ /send-otp error:", err);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
});




// Create tables if not exist
async function initTables() {
  const sql = {
    alumni: `CREATE TABLE IF NOT EXISTS alumni (
      id INT AUTO_INCREMENT PRIMARY KEY,
      firstName VARCHAR(100),
      lastName VARCHAR(100),
      initial VARCHAR(100),
      suffix VARCHAR(10),
      dateBirth DATE NULL,
      major VARCHAR(100),
      graduated YEAR
    )`,
    responses: `CREATE TABLE IF NOT EXISTS responses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,          -- 👈 Added
      careerId INT,                 -- 👈 Already there
      firstName VARCHAR(100),
      lastName VARCHAR(100),
      interested VARCHAR(100),
      employmentStatus VARCHAR(100),
      inlineWork VARCHAR(100),
      dateSubmitted DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    registration: `CREATE TABLE IF NOT EXISTS registration (
      id INT AUTO_INCREMENT PRIMARY KEY,
      firstName VARCHAR(100),
      lastName VARCHAR(100),
      personalEmail VARCHAR(150),
      gender VARCHAR(20),
      userName VARCHAR(100) UNIQUE,
      passWord VARCHAR(255)
    )`,
    fullInformation: `CREATE TABLE IF NOT EXISTS fullInformation (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userName VARCHAR(100),       -- ✅ Link with registration.userName
      firstName VARCHAR(100),
      lastName VARCHAR(100),
      initial VARCHAR(10),
      suffix VARCHAR(10),
      gender VARCHAR(20),
      civilStatus VARCHAR(50),
      dateBirth DATE,
      maiden VARCHAR(100),
      phoneNo VARCHAR(50),
      major VARCHAR(100),
      yearStarted YEAR,
      graduated YEAR,
      studentNo VARCHAR(50),
      profilePic VARCHAR(255),     -- ✅ Profile picture path
      profileConfirmed TINYINT(1) NOT NULL DEFAULT 0 -- ✅ 0 = not confirmed, 1 = confirmed
    )`,
    events: `CREATE TABLE IF NOT EXISTS events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255),
      description TEXT,
      location VARCHAR(255),
      datePosted DATETIME DEFAULT CURRENT_TIMESTAMP,
      eventDateTime DATETIME,
      image VARCHAR(255),  -- ✅ store relative file path (e.g. /uploads/events/event-123.png)
      status ENUM('active','deleted') DEFAULT 'active' -- ✅ soft delete
    )`,

    careers: `CREATE TABLE IF NOT EXISTS careers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255),
      description TEXT,
      link VARCHAR(255),
      userId VARCHAR(100),
      datePosted DATETIME DEFAULT CURRENT_TIMESTAMP,
      image VARCHAR(255),  -- ✅ store relative file path (e.g. /uploads/careers/career-456.jpg)
      status ENUM('active','deleted') DEFAULT 'active' -- ✅ soft delete
    )`,
    homeregs: `CREATE TABLE IF NOT EXISTS homeregs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      firstName VARCHAR(100),
      middleInitial VARCHAR(10),
      lastName VARCHAR(100),
      sex VARCHAR(20),
      program VARCHAR(100),
      yearGraduated YEAR,
      addon VARCHAR(100),
      image LONGBLOB,
      status VARCHAR(50) DEFAULT 'PENDING',
      submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    teams: `CREATE TABLE IF NOT EXISTS teams (
      id INT AUTO_INCREMENT PRIMARY KEY,
      teamName VARCHAR(255) NOT NULL,
      ageRange VARCHAR(50) NOT NULL,
      submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(50) DEFAULT 'PENDING'
    )`,
    members: `CREATE TABLE IF NOT EXISTS members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      teamId INT NOT NULL,
      firstName VARCHAR(100) NOT NULL,
      middleInitial VARCHAR(10),
      lastName VARCHAR(100) NOT NULL,
      FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE
    )`,
    athletes: `CREATE TABLE IF NOT EXISTS athletes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      firstName VARCHAR(100) NOT NULL,
      middleName VARCHAR(100),
      lastName VARCHAR(100) NOT NULL,
      gender VARCHAR(20) NOT NULL,
      extension VARCHAR(10),
      yearGraduated YEAR,
      submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(50) DEFAULT 'PENDING',
      sportType VARCHAR(100) NOT NULL
    )`,
    gallery: `CREATE TABLE IF NOT EXISTS gallery (
      id INT AUTO_INCREMENT PRIMARY KEY,
      image LONGBLOB NOT NULL,
      datePosted DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    requests: `CREATE TABLE IF NOT EXISTS requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fullName VARCHAR(255) NOT NULL,
      degree VARCHAR(255) NOT NULL,
      yearGraduated YEAR NOT NULL,
      studentNo VARCHAR(50) NOT NULL,
      phoneNo VARCHAR(50) NOT NULL,
      email VARCHAR(150) NOT NULL,
      idImage LONGBLOB NOT NULL,
      status VARCHAR(50) DEFAULT 'PENDING',
      submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    employers: `CREATE TABLE IF NOT EXISTS employers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employerName VARCHAR(255) NOT NULL,
      businessName VARCHAR(255) NOT NULL,
      businessAddress VARCHAR(255) NOT NULL,
      landlineNo VARCHAR(50) NOT NULL,
      mobileNo VARCHAR(50) NOT NULL,
      companyEmail VARCHAR(150) NOT NULL,
      companyWebsite VARCHAR(255) NOT NULL,
      companyLogo VARCHAR(255) DEFAULT '/images/default-company.png',
      profileConfirmed TINYINT(1) DEFAULT 0,
      preferredUserId VARCHAR(100) UNIQUE,
      preferredPassword VARCHAR(255),
      status VARCHAR(50) DEFAULT 'PENDING',
      submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    idposts: `CREATE TABLE IF NOT EXISTS idposts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      datePosted DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    notifications: `CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      link VARCHAR(255),
      message TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    applications: `CREATE TABLE IF NOT EXISTS applications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userName VARCHAR(50) NOT NULL,
      careerId INT NOT NULL,
      careerTitle VARCHAR(200) NOT NULL,
      companyName VARCHAR(200) NOT NULL,
      firstName VARCHAR(100) NOT NULL,
      lastName VARCHAR(100) NOT NULL,
      phoneNo VARCHAR(20) NOT NULL,
      email VARCHAR(100) NOT NULL,
      resumePath VARCHAR(255) NOT NULL,
      dateSubmitted DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (careerId) REFERENCES careers(id) ON DELETE CASCADE
    )`,
    applicant: `CREATE TABLE applicant (
      id INT AUTO_INCREMENT PRIMARY KEY,       -- archive’s own ID
      originalAppId INT NOT NULL,              -- reference to applications.id
      userName VARCHAR(50) NOT NULL,
      careerId INT NOT NULL,
      employerId VARCHAR(100) NOT NULL,        -- ✅ match careers.userId (VARCHAR)
      careerTitle VARCHAR(200) NOT NULL,
      companyName VARCHAR(200) NOT NULL,
      firstName VARCHAR(100) NOT NULL,
      lastName VARCHAR(100) NOT NULL,
      phoneNo VARCHAR(20) NOT NULL,
      email VARCHAR(100) NOT NULL,
      resumePath VARCHAR(255) NOT NULL,
      dateSubmitted DATETIME,
      archivedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  };
  for (const [name, ddl] of Object.entries(sql)) {
    await pool.query(ddl);
    console.log(`✅ Initialized table: ${name}`);
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Example: login route
app.get('/api/auth/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  res.json(req.session.user);
});

// ✅ Get logged-in employer info
app.get('/api/employer/me', (req, res) => {
  if (!req.session.user || !req.session.user.isEmployer) {
    return res.json({ role: 'guest' });
  }

  res.json({
    role: 'employer',
    employerId: req.session.user.id,
    userId: req.session.user.preferredUserId,
    employerName: req.session.user.employerName || '' // ✅ ensure it exists
  });
});


// ✅ Insert alumni (single form submit)
app.post('/api/alumni', async (req, res) => {
  try {
    const b = req.body;

    // Helper: format date for MySQL (YYYY-MM-DD)
    function formatDates(value) {
      if (!value) return null;
      const d = new Date(value);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    const values = [
      b.firstName || null,
      b.lastName || null,
      b.initial || null,
      b.suffix || null,
      formatDates(b.dateBirth) || null, // ✅ format before insert
      b.major || null,
      b.graduated || null
    ];

    const [result] = await pool.execute(`
      INSERT INTO alumni (
        firstName, lastName, initial, suffix, dateBirth, major, graduated
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, values);

    res.json({ id: result.insertId });
  } catch (err) {
    console.error('❌ Alumni insert error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ✅ Fetch alumni (with formatted dateBirth for frontend)
app.post('/api/alumni', async (req, res) => {
  try {
    const b = req.body;
    const firstName = b.firstName?.trim();
    const lastName = b.lastName?.trim();

    // ✅ Check duplicate (case-insensitive)
    const [existing] = await pool.execute(
      `SELECT id FROM alumni WHERE LOWER(firstName) = LOWER(?) AND LOWER(lastName) = LOWER(?)`,
      [firstName, lastName]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        error: `Alumni "${firstName} ${lastName}" already exists`
      });
    }

    // Helper: format date for MySQL (YYYY-MM-DD)
    function formatDates(value) {
      if (!value) return null;
      const d = new Date(value);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    const values = [
      firstName,
      lastName,
      b.initial || null,
      b.suffix || null,
      formatDates(b.dateBirth) || null,
      b.major || null,
      b.graduated || null
    ];

    const [result] = await pool.execute(`
      INSERT INTO alumni (
        firstName, lastName, initial, suffix, dateBirth, major, graduated
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, values);

    res.json({ id: result.insertId });
  } catch (err) {
    console.error('❌ Alumni insert error:', err);
    res.status(500).json({ error: err.message });
  }
});



app.delete('/api/alumni/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM alumni WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Delete error:', err);
    res.status(500).json({ error: err.message });
  }
});


// --- Helper: normalize Excel headers ---
function normalizeKeys(row) {
  const normalized = {};
  for (const key in row) {
    const newKey = key
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');

    if (newKey === 'suffix' && (row[key] === '' || row[key] === null)) {
      normalized[newKey] = 'NONE';
    } else {
      normalized[newKey] = row[key];
    }
  }
  return normalized;
}


// --- Universal Date Parser ---
function parseDate(value) {
  if (!value) return null;

  if (value instanceof Date && !isNaN(value)) return value.toISOString().split("T")[0];

  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const parsedDate = new Date(excelEpoch.getTime() + value * 86400000);
    if (!isNaN(parsedDate)) return parsedDate.toISOString().split("T")[0];
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").trim();
    const parsed = Date.parse(cleaned);
    if (!isNaN(parsed)) return new Date(parsed).toISOString().split("T")[0];

    const match = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/);
    if (match) {
      const [ , monthName, day, year ] = match;
      const monthNames = {
        January: "01", February: "02", March: "03", April: "04",
        May: "05", June: "06", July: "07", August: "08",
        September: "09", October: "10", November: "11", December: "12"
      };
      const month = monthNames[monthName];
      if (month) return `${year}-${month}-${day.padStart(2,"0")}`;
    }
  }

  return null;
}

// --- Abbreviation logic ---
const programMap = {
  "bachelor of science in civil engineering": "BSCE",
  "bachelor of science in electrical engineering": "BSEE",
  "bachelor of science in mechanical engineering": "BSME",
  "bachelor of science in industrial education": "BSIE",
  "bsie major in home economics": "BSIE-HE",
  "bsie major in industrial arts": "BSIE-IA",
  "bsie major in information and communication technology": "BSIE-ICT",
  "bachelor of technical vocational teacher education": "BTVTEd",
  "btvted major in computer programming": "BTVTEd-CP",
  "btvted major in electrical technology": "BTVTEd-ET",
  "bachelor of engineering technology program": "BET",
  "bet major in computer engineering technology": "BET-CoET",
  "bet major in electrical technology": "BET-ET",
  "bet major in electronics technology": "BET-ElecT",
  "bet major in mechanical technology": "BET-MT",
  "bet mechanical engineering technology track: automotive technology": "BET-MT-Auto",
  "bet mechanical engineering technology track: power plant technology": "BET-MT-PP"
};

function abbreviateMajor(raw) {
  if (!raw) return null;
  const str = String(raw).trim();
  const key = str.toLowerCase();

  if (/^(bet(-ct|-et|-mt)?|bsce|bsee|bsme|bsie(-he|-ia|-ict)?|btvted(-cp|-et)?)$/i.test(str)) return str.toUpperCase();
  if (programMap[key]) return programMap[key];
  if (key.includes('bachelor of engineering technology')) {
    if (key.includes('construction')) return 'BET-CT';
    if (key.includes('electrical')) return 'BET-ET';
    if (key.includes('mechanical')) return 'BET-MT';
    return 'BET';
  }
  return str;
}

// --- Excel Upload Route ---
app.post('/api/alumni/upload-excel', excelUpload.single('file'), async (req, res) => {
  let connection;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer', raw: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) return res.status(400).json({ error: 'Excel file is empty' });

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const insertStmt = `
      INSERT INTO alumni (
        firstName, lastName, initial, suffix, dateBirth, major, graduated
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const insertedRows = [];

    for (let row of rawRows) {
      row = normalizeKeys(row);

      const firstName = row.first_name || row.firstname || null;
      const lastName  = row.last_name || row.lastname || null;
      if (!firstName || !lastName) continue;

      const [[existing]] = await connection.execute(
        `SELECT id FROM alumni WHERE LOWER(firstName)=? AND LOWER(lastName)=?`,
        [firstName.toLowerCase(), lastName.toLowerCase()]
      );
      if (existing) continue;

      let initial   = row.initial || row.middle_initial || null;
      const suffix = row.suffix || 'NONE';
      const rawDate = row.date_of_birth || row.dob || null;
      const dateBirth = parseDate(rawDate);

      if (initial) initial = initial.toString().trim().substring(0, 10);

      const majorRaw = row.course || row.major || row.program || null;
      const major = abbreviateMajor(majorRaw);

      let graduated = row.graduated || row.year_graduated || row.year || null;
      if (graduated) {
        graduated = parseInt(graduated.toString().trim(), 10);
        if (isNaN(graduated)) graduated = null;
      }

      const [result] = await connection.execute(insertStmt, [
        firstName, lastName, initial, suffix, dateBirth, major, graduated
      ]);

      insertedRows.push({ id: result.insertId, firstName, lastName, initial, suffix, dateBirth, major, graduated });
    }

    await connection.commit();
    connection.release();

    return res.json({ success: true, inserted: insertedRows.length, insertedRows });

  } catch (err) {
    console.error('❌ Excel upload error:', err);
    if (connection) {
      try { await connection.rollback(); connection.release(); } catch {}
    }
    res.status(500).json({ error: err.message || 'Server error' });
  }
});











// 📄 Paginated & searchable alumni fetch - FIXED VERSION
app.get('/api/alumni', async (req, res) => {
  const page = +req.query.page || 1;
  const limit = +req.query.limit || 100;
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : '%';

  try {
    // Count query - removed .promise()
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) AS total FROM alumni 
       WHERE firstName LIKE ? OR lastName LIKE ? OR major LIKE ?`,
      [search, search, search]
    );
    const total = countResult[0].total;

    // Data query - removed .promise() and used template literals for LIMIT/OFFSET
    const [rows] = await pool.execute(
      `SELECT * FROM alumni 
       WHERE firstName LIKE ? OR lastName LIKE ? OR major LIKE ? 
       ORDER BY id DESC 
       LIMIT ${limit} OFFSET ${offset}`,
      [search, search, search]
    );

    res.json({
      rows,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('❌ Alumni Fetch Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🧾 Submit career form (from user-homepage)
 // ✅ Import your broadcast function

// Add new job response + notify
app.post('/api/responses/add', async (req, res) => {
  const { userId, careerId, firstName, lastName, interested, employmentStatus, inlineWork } = req.body;
  
  // Validate required fields
  if (!userId || !careerId || !firstName || !lastName || !interested || !employmentStatus) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const dateSubmitted = formatDateTimeForMySQL(); // MySQL-compatible format
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // ✅ Insert into responses table with userId
    const [insertResult] = await connection.execute(`
      INSERT INTO responses (userId, careerId, firstName, lastName, interested, employmentStatus, inlineWork, dateSubmitted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, careerId, firstName, lastName, interested, employmentStatus, inlineWork || null, dateSubmitted]);

    // ✅ Insert into notifications table
    const message = `${firstName} ${lastName} submitted a job response.`;
    const notifLink = 'jobs-response.html';

    await connection.execute(`
      INSERT INTO notifications (name, message, link, createdAt)
      VALUES (?, ?, ?, ?)
    `, ['Jobs Responses', message, notifLink, dateSubmitted]);

    await connection.commit();
    connection.release();

    // ✅ Emit real-time notification
    io.emit('newNotification', {
      name: 'Jobs Responses',
      message,
      link: notifLink,
      createdAt: new Date().toISOString()
    });

    res.json({ success: true, insertedId: insertResult.insertId });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('❌ Responses Insert Error:', err);
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/responses/check', async (req, res) => {
  const { userId, careerId } = req.query;
  if (!userId || !careerId) {
    return res.status(400).json({ error: 'Missing userId or careerId' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT interested, dateSubmitted 
       FROM responses 
       WHERE userId = ? AND careerId = ? 
       ORDER BY dateSubmitted DESC 
       LIMIT 1`,
      [userId, careerId]
    );

    if (rows.length > 0) {
      res.json({
        submitted: true,
        dateSubmitted: rows[0].dateSubmitted,
        interested: rows[0].interested // Yes / No / Maybe
      });
    } else {
      res.json({ submitted: false });
    }
  } catch (err) {
    console.error("❌ /api/responses/check error:", err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/responses/checkFullSurvey', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const [rows] = await pool.query(
      `SELECT dateSubmitted 
       FROM responses 
       WHERE userId = ? 
       ORDER BY dateSubmitted DESC
       LIMIT 1`,
      [userId]
    );

    if (rows.length > 0) {
      res.json({ submittedAny: true, lastSubmittedDate: rows[0].dateSubmitted });
    } else {
      res.json({ submittedAny: false });
    }
  } catch (err) {
    console.error('❌ /checkFullSurvey error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 📄 GET paginated + searchable job responses
app.get('/api/responses', async (req, res) => {
  const page = +req.query.page || 1;
  const limit = +req.query.limit || 100;
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : '%';
  const careerId = req.query.careerId || null;

  try {
    const whereClause = careerId 
      ? `careerId = ? AND (firstName LIKE ? OR lastName LIKE ?)` 
      : `(firstName LIKE ? OR lastName LIKE ?)`;

    const params = careerId 
      ? [careerId, search, search] 
      : [search, search];

    // Count query
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) AS total FROM responses WHERE ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Data query
    const [rows] = await pool.execute(
      `SELECT * FROM responses 
       WHERE ${whereClause}
       ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    res.json({
      rows,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('❌ Responses Fetch Error:', err);
    res.status(500).json({ error: err.message });
  }
});


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function validateInteger(value, fieldName) {
  if (!value || value === '') return null;
  
  const parsed = parseInt(value);
  if (isNaN(parsed)) {
    console.log(`Warning: Invalid integer value "${value}" for field ${fieldName}, setting to null`);
    return null;
  }
  return parsed;
}

function formatDateTimeForMySQL(date = new Date()) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// ✅ Place this together with your other API routes
app.post('/api/registration/add', async (req, res) => {
  const {
    firstName, lastName, personalEmail,
    gender, userName, passWord,
    major, graduated
  } = req.body;

  // 🔹 Removed gender from required fields
  if (!firstName || !lastName || !personalEmail || !userName || !passWord || !major || !graduated) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const connection = await pool.getConnection();

  try {
    // 1️⃣ Check for existing username
    const [existingUserRows] = await connection.execute(
      `SELECT * FROM registration WHERE LOWER(userName) = LOWER(?)`,
      [userName]
    );
    if (existingUserRows.length > 0) {
      return res.status(409).json({ error: 'Username already taken. Please choose another.' });
    }

    // 2️⃣ Check if alumni info already registered (removed gender check here)
    const [duplicateRows] = await connection.execute(
      `SELECT * FROM registration WHERE LOWER(firstName) = LOWER(?) AND LOWER(lastName) = LOWER(?) AND LOWER(personalEmail) = LOWER(?)`,
      [firstName, lastName, personalEmail]
    );
    if (duplicateRows.length > 0) {
      return res.status(409).json({ error: 'This information has already created an account.' });
    }

    // 3️⃣ Validate against alumni table (removed gender check here)
    const graduatedYear = validateInteger(graduated, 'graduated');
    if (graduatedYear === null) {
      return res.status(400).json({ error: 'Graduated year must be a valid number.' });
    }

    const [alumniMatch] = await connection.execute(
      `SELECT * FROM alumni WHERE LOWER(firstName) = LOWER(?) AND LOWER(lastName) = LOWER(?) AND LOWER(major) = LOWER(?) AND graduated = ?`,
      [firstName, lastName, major, graduatedYear]
    );
    if (alumniMatch.length === 0) {
      return res.status(403).json({ error: 'Alumni record does not match our records.' });
    }

    // 4️⃣ Insert registration record (still keeps gender as requested)
    const [insertResult] = await connection.execute(
      `INSERT INTO registration (firstName, lastName, personalEmail, gender, userName, passWord) VALUES (?, ?, ?, ?, ?, ?)`,
      [firstName, lastName, personalEmail, gender, userName, passWord]
    );

    // 5️⃣ Insert into notifications - FIXED DATETIME FORMAT
    const now = new Date();
    const mysqlDateTime = now.toISOString().slice(0, 19).replace('T', ' '); // Convert to YYYY-MM-DD HH:MM:SS

    const notif = {
      name: 'Alumni Registration',
      message: `New alumni registration from ${firstName} ${lastName}`,
      link: 'data-registration.html',
      createdAt: mysqlDateTime // Use MySQL-compatible format
    };

    await connection.execute(
      `INSERT INTO notifications (name, link, message, createdAt) VALUES (?, ?, ?, ?)` ,
      [notif.name, notif.link, notif.message, notif.createdAt]
    );

    connection.release();

    // 6️⃣ Emit to admin inbox via socket.io - use ISO string for frontend
    io.emit('newNotification', {
      ...notif,
      createdAt: now.toISOString() // Frontend can handle ISO format
    });

    res.json({
      success: true,
      id: insertResult.insertId,
      message: 'Registration saved successfully.'
    });

  } catch (err) {
    connection.release();
    console.error('❌ Registration Error:', err);
    res.status(500).json({ error: err.message });
  }
});


// POST /api/verify-dob
app.post("/api/verify-dob", async (req, res) => {
  try {
    const { firstName, lastName, dob } = req.body; // dob should be YYYY-MM-DD

    if (!firstName || !lastName || !dob) {
      return res.status(400).json({ valid: false, error: "Missing fields" });
    }

    // Query stored DOB from DB
    const [rows] = await pool.execute(
      `SELECT dateBirth FROM alumni WHERE firstName = ? AND lastName = ? LIMIT 1`,
      [firstName, lastName]
    );

    if (rows.length === 0) {
      return res.json({ valid: false, error: "No matching record found" });
    }

    const dbDob = rows[0].dateBirth;

    // If your column is DATE type in MySQL, format it
    const inputDob = new Date(dob).toISOString().split("T")[0]; // "2001-06-23"
    const storedDob = new Date(dbDob).toISOString().split("T")[0];

    if (inputDob === storedDob) {
      return res.json({ valid: true });
    } else {
      return res.json({ valid: false, error: "Date of Birth does not match" });
    }
  } catch (err) {
    console.error("DOB verification error:", err);
    res.status(500).json({ valid: false, error: "Server error" });
  }
});





///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


// ✅ LOGIN API — Check username & password
app.post('/api/registration/login', async (req, res) => {
  const { userName, passWord } = req.body;

  if (!userName || !passWord) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT * FROM registration WHERE userName = ? AND passWord = ?`,
      [userName, passWord]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = rows[0];

    // ✅ Check if admin
    const isAdmin = userName.toLowerCase() === "admin";

    // ✅ Save session
    req.session.user = {
      id: user.id,
      userName: user.userName,
      firstName: user.firstName,
      lastName: user.lastName,
      personalEmail: user.personalEmail,
      gender: user.gender,
      isAdmin
    };
    req.session.userId = user.id;

    // ✅ Respond with user info + admin flag
    res.json({
      success: true,
      message: "Login successful",
      isAdmin,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        personalEmail: user.personalEmail,
        gender: user.gender,
        userName: user.userName
      }
    });
  } catch (err) {
    console.error("❌ Login DB Error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ Get logged-in user info
// Format MySQL DATE into YYYY-MM-DD
function formatDate(date) {
  if (!date) return null;
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}




app.get('/api/fullInformation/me', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }

  try {
    const [regRows] = await pool.execute(
      `SELECT id, firstName, lastName, personalEmail, gender, userName 
       FROM registration WHERE id = ?`,
      [req.session.user.id]
    );

    if (regRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = regRows[0];

    const [infoRows] = await pool.execute(
      `SELECT civilStatus, dateBirth, phoneNo, major, yearStarted, graduated, studentNo
       FROM fullInformation
       WHERE userName = ?`,
      [user.userName]
    );

    let extraInfo = {};
    if (infoRows.length > 0) {
      extraInfo = infoRows[0];
      if (extraInfo.dateBirth) {
        extraInfo.dateBirth = formatDate(extraInfo.dateBirth);
      }
    }

    const response = { ...user, ...extraInfo };
    console.log("📤 Sending user data:", response); // 🔍 DEBUG
    res.json(response);
  } catch (err) {
    console.error("❌ Fetch FullInformation User Error:", err);
    res.status(500).json({ error: "Database error" });
  }
});


app.put('/api/employers/me', async (req, res) => {
  if (!req.session.user || !req.session.user.isEmployer) {
    return res.status(401).json({ error: "Not logged in as employer" });
  }

  const { companyEmail, mobileNo, landlineNo } = req.body;

  try {
    await pool.execute(
      `UPDATE employers 
       SET companyEmail = ?, mobileNo = ?, landlineNo = ?
       WHERE id = ?`,
      [companyEmail, mobileNo, landlineNo, req.session.user.id]
    );

    res.json({ success: true, message: "Employer profile updated" });
  } catch (err) {
    console.error("❌ Update Employer Error:", err);
    res.status(500).json({ error: "Database error" });
  }
});


// Store uploaded files in /public/uploads/logos
const storage = multer.diskStorage({
  destination: "public/uploads/logos",
  filename: (req, file, cb) => {
    cb(null, "employer-" + Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

app.post("/api/employers/upload-logo", upload.single("logo"), async (req, res) => {
  if (!req.session.employer) {
    return res.status(401).json({ error: "Not logged in as employer" });
  }

  try {
    const filePath = "/uploads/logos/" + req.file.filename;

    await pool.execute(
      `UPDATE employers SET logoPath = ? WHERE id = ?`,
      [filePath, req.session.employer.id]
    );

    res.json({ success: true, logoPath: filePath });
  } catch (err) {
    console.error("❌ Upload Logo Error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ Employer: Get applications for their careers (from archive)
app.get('/api/applications/employer', async (req, res) => {
  if (!req.session.user || !req.session.user.isEmployer) {
    return res.status(401).json({ error: "Not logged in as employer" });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT 
         aa.originalAppId   AS id,
         aa.firstName,
         aa.lastName,
         aa.phoneNo,
         aa.email,
         aa.resumePath,
         aa.dateSubmitted,
         aa.careerTitle,
         aa.companyName
       FROM applicant aa
       WHERE aa.employerId = ?
       ORDER BY aa.dateSubmitted DESC`,
      [req.session.user.preferredUserId]  // ✅ employer's login ID
    );

    res.json(rows);
  } catch (err) {
    console.error("❌ Fetch Applicants Error (archive):", err);
    res.status(500).json({ error: "Database error" });
  }
});





// Applicants for logged-in employer
app.get('/api/applications/employer', async (req, res) => {
  if (!req.session.employer) {
    return res.status(401).json({ error: "Not logged in as employer" });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT 
         r.firstName, 
         r.lastName, 
         f.major, 
         f.graduated,
         r.personalEmail AS email, 
         aa.resumePath, 
         aa.dateSubmitted,
         aa.careerTitle, 
         aa.companyName
       FROM applicant aa
       JOIN registration r 
         ON aa.userName = r.userName
       LEFT JOIN fullInformation f 
         ON r.userName = f.userName
       WHERE aa.employerId = ?
       ORDER BY aa.dateSubmitted DESC`,
      [req.session.employer.id]
    );

    res.json(rows);
  } catch (err) {
    console.error("❌ Fetch Applicants Error (archive):", err);
    res.status(500).json({ error: "Database error" });
  }
});


// ----------------------
// Admin Applications Route
// ----------------------
app.get("/api/admin-applications", async (req, res) => {
  try {
    const employerId = req.session.user?.userName; // 👈 this is the admin username
    if (!employerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [rows] = await pool.query(
      `SELECT 
         aa.firstName, 
         aa.lastName, 
         aa.phoneNo, 
         aa.email, 
         aa.resumePath, 
         aa.dateSubmitted, 
         aa.archivedAt,
         aa.careerTitle,
         aa.companyName
       FROM applicant aa
       WHERE aa.employerId = ?   -- ✅ match admin username from careers.userId
       ORDER BY aa.dateSubmitted DESC`,
      [employerId]
    );

    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching applications (archive):", err);
    res.status(500).json({ error: "Server error" });
  }
});








// ✅ Update both registration + fullInformation safely
app.post('/api/fullInformation/update', async (req, res) => {
  if (!req.session.userId || !req.session.user?.userName) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  let { personalEmail, phoneNo, civilStatus } = req.body;
  personalEmail = personalEmail ?? null;
  phoneNo       = phoneNo ?? null;
  civilStatus   = civilStatus ?? null;

  try {
    // 1️⃣ Update registration (email only)
    await pool.execute(
      `UPDATE registration 
       SET personalEmail = ? 
       WHERE id = ?`,
      [personalEmail, req.session.userId]
    );

    // 2️⃣ Update fullInformation by userName (unique & stable)
    await pool.execute(
      `UPDATE fullInformation 
       SET civilStatus = ?, phoneNo = ? 
       WHERE userName = ?`,
      [civilStatus, phoneNo, req.session.user.userName]
    );

    res.json({ success: true, message: "✅ Profile updated!" });
  } catch (err) {
    console.error("❌ FullInformation Update Error:", err);
    res.status(500).json({ error: "Database error" });
  }
});









app.post('/api/employer/login', async (req, res) => {
  const { userId, password } = req.body;

  if (!userId || !password) {
    return res.status(400).json({ error: 'Missing User ID or Password' });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT * FROM employers 
       WHERE preferredUserId = ? AND preferredPassword = ?`,
      [userId, password]
    );

    if (rows.length === 0) {
      console.log('❌ Invalid credentials for employer:', userId);
      return res.status(401).json({ error: 'Invalid User ID or Password' });
    }

    const employer = rows[0];

    if (employer.status !== 'ACCEPTED') {
      console.log(`❌ Employer status not accepted (${employer.status}) for:`, userId);
      return res.status(403).json({ error: `Your account is ${employer.status}. Access denied.` });
    }

    // ✅ Save session
    req.session.user = {
      id: employer.id,
      preferredUserId: employer.preferredUserId,
      employerName: employer.employerName,  // 🔥 important
      isEmployer: true
    };

    console.log('✅ Employer Login successful for:', userId);

    // ✅ Respond with full info (include employerId)
    res.json({
      success: true,
      message: 'Login successful. Welcome Employer!',
      role: 'employer',
      employerId: employer.id,           // 🔥 use this to filter careers
      userId: employer.preferredUserId,  // their login name
      employerName: employer.employerName
    });

  } catch (err) {
    console.error('❌ Employer Login DB Error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



app.get('/api/registration', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 100;
  const search = req.query.search ? `%${req.query.search}%` : '%';
  const offset = (page - 1) * limit;

  // 🔎 Validate pagination values
  if (isNaN(limit) || isNaN(offset) || limit <= 0 || offset < 0) {
    return res.status(400).json({ error: 'Invalid pagination parameters' });
  }

  try {
    // 🧮 Count total matching rows
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as count FROM registration
       WHERE firstName LIKE ? OR lastName LIKE ? OR personalEmail LIKE ? OR userName LIKE ?`,
      [search, search, search, search]
    );
    const totalRows = countRows[0].count;
    const totalPages = Math.ceil(totalRows / limit);

    // 📄 Fetch paginated results
    const [rows] = await pool.execute(
      `SELECT firstName, lastName, personalEmail, gender, userName, passWord
       FROM registration
       WHERE firstName LIKE ? OR lastName LIKE ? OR personalEmail LIKE ? OR userName LIKE ?
       ORDER BY id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [search, search, search, search]
    );

    // ✅ Return result
    res.json({ rows, totalPages });
  } catch (err) {
    console.error('❌ Error fetching registration:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////

// Add these helper functions at the top of your server.js
function validateDate(dateValue) {
  if (!dateValue) return null;
  
  // If it's already in YYYY-MM-DD format, validate it
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return dateValue;
    }
  }
  
  // Try to parse other formats
  const date = new Date(dateValue);
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

// Updated fullInformation route with userName
app.post('/api/fullInformation/add', async (req, res) => {
  const {
    userName, // ✅ new field
    firstName, lastName, initial, suffix, gender,
    civilStatus, dateBirth, maiden, phoneNo,
    major, yearStarted, graduated, studentNo
  } = req.body;

  // Validation
  if (!userName || !firstName || !lastName || !gender || !major || !yearStarted || !graduated) {
    return res.status(400).json({
      error: 'Missing required fields: userName, firstName, lastName, gender, major, yearStarted, graduated'
    });
  }

  try {
    // Validate and format data
    const formattedDateBirth = validateDate(dateBirth);
    const validatedYearStarted = validateInteger(yearStarted, 'yearStarted');
    const validatedGraduated = validateInteger(graduated, 'graduated');

    if (!formattedDateBirth) {
      return res.status(400).json({ error: 'Invalid date format for dateBirth' });
    }

    if (validatedYearStarted === null) {
      return res.status(400).json({ error: 'Invalid yearStarted - must be a valid year' });
    }

    if (validatedGraduated === null) {
      return res.status(400).json({ error: 'Invalid graduated - must be a valid year' });
    }

    console.log('Formatted date for database:', formattedDateBirth);

    const [result] = await pool.execute(`
      INSERT INTO fullInformation (
        userName, firstName, lastName, initial, suffix, gender,
        civilStatus, dateBirth, maiden, phoneNo,
        major, yearStarted, graduated, studentNo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userName,
      firstName || null,
      lastName || null,
      initial || null,
      suffix || null,
      gender || null,
      civilStatus || null,
      formattedDateBirth,
      maiden || null,
      phoneNo || null,
      major || null,
      validatedYearStarted,
      validatedGraduated,
      studentNo || null
    ]);

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('❌ FullInformation Insert Error:', err);
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/fullInformation', async (req, res) => {
  const page = +req.query.page || 1;
  const limit = +req.query.limit || 100;
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : '%';

  try {
    // Count query
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) AS total FROM fullInformation 
       WHERE firstName LIKE ? OR lastName LIKE ?`,
      [search, search]
    );
    const total = countResult[0].total;

    // Data query - use template literals for LIMIT and OFFSET
    const [rows] = await pool.execute(
      `SELECT * FROM fullInformation 
       WHERE firstName LIKE ? OR lastName LIKE ? 
       ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`,
      [search, search]
    );

    res.json({
      rows,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('❌ FullInformation Fetch Error:', err);
    res.status(500).json({ error: err.message });
  }
});


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////
// Store uploaded event images in /public/uploads/events
const eventStorage = multer.diskStorage({
  destination: "public/uploads/events",
  filename: (req, file, cb) => {
    cb(null, "event-" + Date.now() + path.extname(file.originalname));
  },
});

const eventUpload = multer({ storage: eventStorage });



app.post("/api/events/add", eventUpload.single("image"), async (req, res) => {
  try {
    const { title, description, location, eventDateTime } = req.body;

    // store relative path (so we can serve via express static)
    const imagePath = req.file ? `/uploads/events/${req.file.filename}` : null;

    const [result] = await pool.query(
      `INSERT INTO events (title, description, location, eventDateTime, datePosted, image)
       VALUES (?, ?, ?, ?, NOW(), ?)`,
      [title, description, location, eventDateTime, imagePath]
    );

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error("❌ Event insert error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================== EVENTS API ==================
app.get("/api/events", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM events ORDER BY datePosted DESC");

    // ✅ Reformat eventDateTime so frontend reads it correctly
    const events = rows.map(event => {
      let formattedDateTime = null;

      if (event.eventDateTime) {
        // Convert MySQL DATETIME to ISO string without timezone
        const dt = new Date(event.eventDateTime);
        formattedDateTime = dt.toISOString().slice(0, 19).replace("T", " ");
        
        // 👇 Now convert to "YYYY-MM-DDTHH:mm:ss" (ISO-like without Z)
        formattedDateTime = formattedDateTime.replace(" ", "T");
      }

      return {
        ...event,
        eventDateTime: formattedDateTime
      };
    });

    res.json({ events });
  } catch (err) {
    console.error("❌ Failed to fetch events:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});


// 📌 GET: Events List (Only Active)
app.get('/api/events', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, description, location, datePosted, eventDateTime 
       FROM events 
       WHERE status = 'active'
       ORDER BY eventDateTime DESC`
    );

    const events = rows.map(row => {
      const eventDateTime = new Date(row.eventDateTime);
      const now = new Date();
      const isGray = eventDateTime < now;

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        location: row.location,
        datePosted: new Date(row.datePosted),
        eventDateTime,
        image: `/api/events/${row.id}/image`,
        isGray
      };
    });

    res.json({ events });
  } catch (err) {
    console.error("❌ Error fetching events:", err);
    res.status(500).json({ error: err.message });
  }
});



// 📌 GET: Careers List (Only Active)
app.get('/api/careers', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, title, description, link, userId, datePosted
      FROM careers 
      WHERE status = 'active'
      ORDER BY datePosted DESC
    `);

    const careers = rows.map(row => {
      const datePosted = new Date(row.datePosted);
      const now = new Date();

      // Career still turns gray after 5 days
      const grayDate = new Date(datePosted.getTime() + 5 * 24 * 60 * 60 * 1000);
      const isGray = now >= grayDate;

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        link: row.link,
        userId: row.userId,
        datePosted,
        image: `/api/careers/image/${row.id}`,
        isGray
      };
    });

    res.json({ careers });
  } catch (err) {
    console.error("❌ Error fetching careers:", err);
    res.status(500).json({ error: err.message });
  }
});







// 📌 PUT: Edit Event (with optional image update)
app.put('/api/events/:id', imageUpload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { title, description, location } = req.body;

  try {
    let query = `UPDATE events SET title = ?, description = ?, location = ?`;
    const params = [title, description, location];

    // ✅ If new image uploaded, store it as BLOB
    if (req.file) {
      query += `, image = ?`;
      params.push(req.file.buffer);
    }

    query += ` WHERE id = ?`;
    params.push(id);

    const [result] = await pool.execute(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Event update error:", err);
    res.status(500).json({ error: err.message });
  }
});



// 📌 HARD DELETE Event
app.delete('/api/events/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // hard delete from events table only
    const [result] = await pool.execute(
      `DELETE FROM events WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ success: true, message: 'Event hard deleted' });
  } catch (err) {
    console.error("❌ Event hard delete error:", err);
    res.status(500).json({ error: err.message });
  }
});




app.get('/api/careers/image/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT image FROM careers WHERE id = ?',
      [req.params.id]
    );

    if (!rows.length || !rows[0].image) {
      return res.status(404).send('No image found');
    }

    const imagePath = path.join(__dirname, 'public', rows[0].image.replace(/^\/+/, ''));
    res.sendFile(imagePath);
  } catch (err) {
    console.error("❌ Career image fetch error:", err);
    res.status(500).send('Server error');
  }
});


app.get('/api/events/image/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT image FROM events WHERE id = ?',
      [req.params.id]
    );

    if (!rows.length || !rows[0].image) {
      return res.status(404).send('No image found');
    }

    const imagePath = path.join(__dirname, 'public', rows[0].image.replace(/^\/+/, ''));
    res.sendFile(imagePath);
  } catch (err) {
    console.error("❌ Event image fetch error:", err);
    res.status(500).send('Server error');
  }
});




function authorizeAdminOrEmployer(req, res, next) {
  const user = req.session?.user;
  if (!user || (!user.isAdmin && !user.isEmployer)) {
    return res.status(403).json({ error: 'Unauthorized access' });
  }
  next();
}

const careerStorage = multer.diskStorage({
  destination: "public/uploads/careers",
  filename: (req, file, cb) => {
    cb(null, "career-" + Date.now() + path.extname(file.originalname));
  },
});

const careerUpload = multer({ storage: careerStorage });

app.post('/api/careers/add', authorizeAdminOrEmployer, careerUpload.single('image'), async (req, res) => {
  try {
    const { title, description, link } = req.body;
    const user = req.session.user;
    const postedBy = user.isEmployer ? user.preferredUserId : user.userName;

    // ✅ Store relative path, not binary
    const imagePath = req.file ? `/uploads/careers/${req.file.filename}` : null;

    const [result] = await pool.execute(
      `INSERT INTO careers (title, description, link, userId, datePosted, image)
       VALUES (?, ?, ?, ?, NOW(), ?)`,
      [title, description, link, postedBy, imagePath] // ← imagePath must be a string
    );

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error("❌ Career insert error:", err);
    res.status(500).json({ error: 'Server error' });
  }
});






app.get('/api/careers/all', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM careers ORDER BY datePosted DESC'
    );
    res.json({ careers: rows });
  } catch (err) {
    console.error("❌ Failed to fetch all careers:", err);
    res.status(500).json({ error: 'Server error' });
  }
});


app.get('/api/careers', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user || !user.isEmployer) return res.status(401).json({ error: 'Not logged in' });

    const [rows] = await pool.execute(
      'SELECT * FROM careers WHERE userId = ? ORDER BY datePosted DESC',
      [user.id]  // only fetch this employer's posts
    );

    res.json({ careers: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});



app.put('/api/careers/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, link } = req.body;

  try {
    const [result] = await pool.execute( // ✅ no .promise()
      `UPDATE careers SET title = ?, description = ?, link = ? WHERE id = ?`,
      [title, description, link, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Career not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📌 HARD DELETE Career (but keep applications)
app.delete('/api/careers/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // hard delete from careers table only
    const [result] = await pool.execute(
      `DELETE FROM careers WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Career not found' });
    }

    res.json({ success: true, message: 'Career hard deleted, applications preserved' });
  } catch (err) {
    console.error("❌ Career hard delete error:", err);
    res.status(500).json({ error: err.message });
  }
});




app.get('/api/careers/last-post/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    // Try student first
    let [rows] = await pool.query(
      `SELECT datePosted FROM careers WHERE userId = ? ORDER BY datePosted DESC LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      // Try employer with preferredUserId
      [rows] = await pool.query(
        `SELECT datePosted FROM careers WHERE userId = ? ORDER BY datePosted DESC LIMIT 1`,
        [userId] // employer's preferredUserId is stored as userId in careers table
      );
    }

    if (rows.length === 0) {
      return res.json({ lastPost: null });
    }

    res.json({ lastPost: rows[0].datePosted });
  } catch (err) {
    console.error("❌ Careers Last-Post Error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const uploadReceipt = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // optional limit: 5MB
});

app.post('/api/homeregs', uploadReceipt.single('receipt'), async (req, res) => {
  const { firstName, middleInitial, lastName, sex, program, yearGraduated, addon } = req.body;

  let imageBuffer = null;
  if (addon !== 'no addon') {
    if (!req.file) return res.status(400).json({ error: 'Receipt is required for selected add-on' });
    imageBuffer = req.file.buffer;
  }

  const status = 'PENDING';
  const submittedAt = new Date(); // Use Date object directly

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [insertResult] = await connection.execute(
      `INSERT INTO homeregs 
        (firstName, middleInitial, lastName, sex, program, yearGraduated, addon, image, status, submittedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [firstName, middleInitial || '', lastName, sex, program, yearGraduated, addon, imageBuffer, status, submittedAt]
    );

    const homeregId = insertResult.insertId;

    const notifMessage = `${firstName} ${lastName} submitted a HomeComing Registration Form.`;
    const createdAt = submittedAt;

    const [notifResult] = await connection.execute(
      `INSERT INTO notifications (name, message, link, createdAt)
       VALUES (?, ?, ?, ?)`,
      ['HomeComing event', notifMessage, 'event-registration.html', createdAt]
    );

    await connection.commit();
    connection.release();

    io.emit('newNotification', {
      id: notifResult.insertId,
      name: 'HomeComing Event Registration',
      message: notifMessage,
      link: 'event-registration.html',
      createdAt: createdAt.toISOString()
    });

    res.json({ success: true, id: homeregId });
  } catch (err) {
    await connection.rollback();
    connection.release();
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/homeregs', async (req, res) => {
  const page = +req.query.page || 1;
  const limit = +req.query.limit || 10;
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : '%';

  try {
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM homeregs WHERE firstName LIKE ? OR lastName LIKE ?`,
      [search, search]
    );
    const totalPages = Math.ceil(cnt / limit);

    const [rows] = await pool.query(
      `SELECT id, firstName, middleInitial, lastName, sex, program,
              yearGraduated, addon, image, status, submittedAt
       FROM homeregs
       WHERE firstName LIKE ? OR lastName LIKE ?
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [search, search, limit, offset]
    );

    const registrations = rows.map(row => ({
      id: row.id,
      firstName: row.firstName,
      middleInitial: row.middleInitial,
      lastName: row.lastName,
      sex: row.sex,
      program: row.program,
      yearGraduated: row.yearGraduated,
      addon: row.addon,
      status: row.status,
      submittedAt: row.submittedAt,
      image: row.image ? `data:image/png;base64,${row.image.toString('base64')}` : null
    }));

    res.json({ registrations, totalPages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.patch('/api/homeregs/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const [result] = await pool.execute(
      `UPDATE homeregs SET status = ? WHERE id = ?`,
      [status, id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////

// ✅ POST new team with players (Default status = 'PENDING')
app.post('/api/sportfest/mensBasketball', express.json(), async (req, res) => {
  const { teamName, ageRange, players } = req.body;

  if (!teamName || !ageRange || !Array.isArray(players) || players.length === 0) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const now = new Date(); // Let MySQL handle the timestamp format
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Insert team
    const [teamResult] = await connection.execute(
      `INSERT INTO teams (teamName, ageRange, submittedAt, status)
       VALUES (?, ?, ?, ?)`,
      [teamName, ageRange, now, 'PENDING']
    );
    const teamId = teamResult.insertId;

    // Insert players
    const playerStmt = `INSERT INTO members (teamId, firstName, middleInitial, lastName) VALUES (?, ?, ?, ?)`;
    for (const player of players) {
      await connection.execute(playerStmt, [
        teamId,
        player.firstName || '',
        player.middleInitial || '',
        player.lastName || ''
      ]);
    }

    // Notification
    const message = `Team "${teamName}" registered for Men's Basketball.`;
    const [notifResult] = await connection.execute(
      `INSERT INTO notifications (name, message, link, createdAt)
       VALUES (?, ?, ?, ?)`,
      ['Sports Registration', message, 'mensBasketball.html', now]
    );

    await connection.commit();
    connection.release();

    io.emit('newNotification', {
      id: notifResult.insertId,
      name: 'Sports Registration',
      message,
      link: 'mensBasketball.html',
      createdAt: now.toISOString()
    });

    res.json({
      success: true,
      teamId,
      playerCount: players.length,
      submittedAt: now
    });

  } catch (err) {
    await connection.rollback();
    connection.release();
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sportfest/teams', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, teamName, ageRange, submittedAt, status FROM teams ORDER BY id DESC'
    );
    res.json({ teams: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sportfest/teams/:id/members', async (req, res) => {
  const teamId = +req.params.id;
  try {
    const [rows] = await pool.query(
      'SELECT firstName, middleInitial, lastName FROM members WHERE teamId = ?',
      [teamId]
    );
    res.json({ members: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/sportfest/teams/:id/status', express.json(), async (req, res) => {
  const { status } = req.body;
  const id = +req.params.id;

  if (!['ACCEPTED', 'DECLINED', 'PENDING'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const [result] = await pool.execute(
      'UPDATE teams SET status = ? WHERE id = ?',
      [status, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Team not found' });
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////


app.post('/api/allsport/add', async (req, res) => {
  const {
    firstName, middleName, lastName, gender,
    extension, yearGraduated, sportType
  } = req.body;

  if (!firstName || !lastName || !gender) {
    return res.status(400).json({ error: 'First name, last name, and gender are required' });
  }

  const submittedAt = new Date(); // pass Date object directly
  const status = 'PENDING';

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [insertResult] = await connection.execute(`
      INSERT INTO athletes (
        firstName, middleName, lastName, gender,
        extension, yearGraduated, submittedAt, status, sportType
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        firstName, middleName || '', lastName, gender,
        extension || '', yearGraduated || null,
        submittedAt, status, sportType || ''
      ]
    );

    const athleteId = insertResult.insertId;
    const message = `Athlete "${firstName} ${lastName}" registered for ${sportType || 'Unknown Sport'}.`;

    const [notifResult] = await connection.execute(`
      INSERT INTO notifications (name, message, link, createdAt)
      VALUES (?, ?, ?, ?)`,
      ['Athlete Registration', message, 'allSport.html', submittedAt]
    );

    await connection.commit();
    connection.release();

    io.emit('newNotification', {
      id: notifResult.insertId,
      name: 'Athlete Registration',
      message,
      link: 'allSport.html',
      createdAt: submittedAt.toISOString()
    });

    res.json({ success: true, id: athleteId });
  } catch (err) {
    await connection.rollback();
    connection.release();
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/allsport/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['PENDING', 'ACCEPTED', 'DECLINED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const [result] = await pool.execute(
      `UPDATE athletes SET status = ? WHERE id = ?`,
      [status, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/allsport', async (req, res) => {
  const page = +req.query.page || 1;
  const limit = +req.query.limit || 50;
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : '%';

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM athletes
       WHERE firstName LIKE ? OR lastName LIKE ? OR middleName LIKE ?`,
      [search, search, search]
    );

    const [rows] = await pool.query(
      `SELECT * FROM athletes
       WHERE firstName LIKE ? OR lastName LIKE ? OR middleName LIKE ?
       ORDER BY submittedAt DESC
       LIMIT ? OFFSET ?`,
      [search, search, search, limit, offset]
    );

    res.json({
      rows,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/allsport/distinct-sports', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT sportType FROM athletes WHERE sportType IS NOT NULL AND sportType != ''`
    );
    res.json({ sports: rows.map(r => r.sportType) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////

const uploadPhoto = multer({ storage: multer.memoryStorage() });


app.post('/api/gallery/add-multiple', uploadPhoto.array('images', 25), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'At least one image required' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const insertQuery = `INSERT INTO gallery (image, datePosted) VALUES (?, NOW())`;
    for (const file of req.files) {
      await connection.execute(insertQuery, [file.buffer]);
    }

    await connection.commit();
    connection.release();

    res.json({ success: true, uploaded: req.files.length });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('❌ Gallery Upload Error:', err);
    res.status(500).json({ error: err.message });
  }
});


// GET: All Images
app.get('/api/gallery', async (req, res) => {
  try {
    const [rows] = await pool.query( // ✅ FIXED
      'SELECT id, image, datePosted FROM gallery ORDER BY datePosted DESC'
    );

    const items = rows.map(r => ({
      id: r.id,
      datePosted: r.datePosted,
      image: `data:image/jpeg;base64,${r.image.toString('base64')}`
    }));

    res.json({ items });
  } catch (err) {
    console.error('❌ Gallery Fetch Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE: Remove One
app.delete('/api/gallery/:id', async (req, res) => {
  const id = +req.params.id;
  try {
    const [result] = await pool.execute( // ✅ FIXED
      `DELETE FROM gallery WHERE id = ?`,
      [id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Gallery Delete Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/gallery/image/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT image FROM gallery WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).send('Not found');

    res.set('Content-Type', 'image/jpeg');
    res.send(rows[0].image);
  } catch (err) {
    console.error('❌ Gallery Image Fetch Error:', err);
    res.status(500).send(err.message);
  }
});

/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////////////////////////////////////

const idUpload = multer({ storage: multer.memoryStorage() });

app.post('/api/requests/add', idUpload.single('idImage'), async (req, res) => {
  const { fullName, degree, yearGraduated, studentNo, phoneNo, email } = req.body;
  const idImage = req.file;

  if (!fullName || !degree || !yearGraduated || !studentNo || !phoneNo || !email || !idImage) {
    return res.status(400).json({ error: 'Missing required fields or ID Image' });
  }

  // FIXED: Use MySQL datetime format instead of ISO
  const submittedAt = formatDateTimeForMySQL();
  const connection = await pool.getConnection(); // FIXED: Removed .promise()

  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(`
      INSERT INTO requests (fullName, degree, yearGraduated, studentNo, phoneNo, email, idImage, submittedAt, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [fullName, degree, yearGraduated, studentNo, phoneNo, email, idImage.buffer, submittedAt]
    );

    const message = `${fullName} submitted an ID request.`;
    const [notifResult] = await connection.execute(`
      INSERT INTO notifications (name, message, link, createdAt)
      VALUES (?, ?, ?, ?)`,
      ['ID Request Submitted', message, 'admin-id.html', submittedAt]
    );

    await connection.commit();
    connection.release();

    // Send ISO format to frontend for socket.io
    io.emit('newNotification', {
      id: notifResult.insertId,
      name: 'ID Request Submitted',
      message,
      link: 'admin-id.html',
      createdAt: new Date().toISOString() // ISO format for frontend
    });

    res.json({ success: true, id: result.insertId, message: 'Request with ID Image saved successfully' });

  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('❌ ID Request Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/requests/list', async (req, res) => {
  const page = +req.query.page || 1;
  const limit = +req.query.limit || 100;
  const search = `%${req.query.search || ''}%`;
  const offset = (page - 1) * limit;

  try {
    // FIXED: Removed .promise()
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) AS total FROM requests WHERE fullName LIKE ?`,
      [search]
    );
    const total = countResult[0].total;

    // FIXED: Use template literals for LIMIT/OFFSET and removed .promise()
    const [rows] = await pool.execute(
      `SELECT id, fullName, degree, yearGraduated, studentNo, phoneNo, email, submittedAt, status
       FROM requests
       WHERE fullName LIKE ?
       ORDER BY submittedAt DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [search]
    );

    res.json({
      requests: rows,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('❌ Requests List Error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.patch('/api/requests/:id/status', async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  const validStatuses = [
    'PENDING', 
    'ACCEPTED - PENDING', 
    'RELEASING', 
    'RELEASED', 
    'DECLINED'
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const [result] = await pool.execute(
      `UPDATE requests SET status = ? WHERE id = ?`,
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json({ success: true, message: `Status updated to ${status}` });
  } catch (err) {
    console.error('❌ Status Update Error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});


app.get('/api/requests/:id/image', async (req, res) => {
  const { id } = req.params;

  try {
    // FIXED: Removed .promise()
    const [rows] = await pool.execute(
      `SELECT idImage FROM requests WHERE id = ?`,
      [id]
    );

    if (rows.length === 0 || !rows[0].idImage) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.set('Content-Type', 'image/jpeg'); // Adjust based on your image type
    res.send(rows[0].idImage);
  } catch (err) {
    console.error('❌ Image Retrieval Error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});


app.get('/api/requests/user/byusername/:userName', async (req, res) => {
  const { userName } = req.params;

  try {
    const [rows] = await pool.execute(
      `SELECT r.* 
       FROM requests r 
       JOIN registration reg ON CONCAT(reg.firstName, ' ', reg.lastName) = r.fullName
       WHERE reg.userName = ?
       ORDER BY r.submittedAt DESC LIMIT 1`,
      [userName]
    );

    if (rows.length === 0) return res.json(null);
    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Error fetching request by username:", err);
    res.status(500).json({ error: "Database error" });
  }
});


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const otpStore = {};
const otpRateLimit = {};
const MAX_OTP_REQUESTS = 5;
const TIME_WINDOW_MS = 10 * 60 * 1000;

// 🔍 Step 1: Find User
app.post('/api/forgot/find-user', async (req, res) => {
  const { userName } = req.body;
  if (!userName) return res.status(400).json({ error: 'Username required' });

  try {
    const [rows] = await pool.execute(
      'SELECT personalEmail FROM registration WHERE userName = ?',
      [userName]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ email: rows[0].personalEmail });
  } catch (err) {
    console.error('/api/forgot/find-user - SQL Error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// 🛡️ OTP Rate Limiter Middleware
function otpLimiter(req, res, next) {
  const userName = req.body.userName || req.body.userId;
  if (!userName) return res.status(400).json({ error: 'Username is required' });

  const now = Date.now();
  otpRateLimit[userName] = (otpRateLimit[userName] || []).filter(ts => now - ts < TIME_WINDOW_MS);

  if (otpRateLimit[userName].length >= MAX_OTP_REQUESTS) {
    return res.status(429).json({ error: '❌ Too many OTP requests. Please try again later.' });
  }

  otpRateLimit[userName].push(now);
  next();
}

// 📤 Step 2: Send OTP
app.post('/api/forgot/send-otp', otpLimiter, async (req, res) => {
  const userKey = req.body.userName || req.body.userId;
  if (!userKey) return res.status(400).json({ error: 'Username or User ID is required' });

  try {
    const [regRows] = await pool.execute(
      'SELECT personalEmail FROM registration WHERE userName = ?',
      [userKey]
    );
    if (regRows.length > 0) {
      return sendOtpToUser(userKey, regRows[0].personalEmail, res);
    }

    const [empRows] = await pool.execute(
      'SELECT companyEmail FROM employers WHERE preferredUserId = ?',
      [userKey]
    );
    if (empRows.length === 0) return res.status(404).json({ error: 'User not found' });

    sendOtpToUser(userKey, empRows[0].companyEmail, res);
  } catch (err) {
    console.error('🔴 /send-otp error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// 📩 OTP Helper
function sendOtpToUser(userKey, email, res) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[userKey] = {
    code: otp,
    expires: Date.now() + (parseInt(process.env.OTP_EXPIRE_MINUTES || '10') * 60000)
  };

  sendOtpEmail(email, otp)
    .then(() => res.json({ success: true, message: '✅ OTP sent to email' }))
    .catch(error => {
      console.error('🔴 Email send failed:', error);
      res.status(500).json({ error: 'Failed to send email', details: error.message });
    });
}

// ✅ Step 3: Verify OTP
app.post('/api/forgot/verify-otp', (req, res) => {
  const userKey = req.body.userName || req.body.userId;
  const { otp } = req.body;

  const record = otpStore[userKey];
  if (!record || Date.now() > record.expires || otp !== record.code) {
    return res.status(400).json({ error: 'OTP expired or invalid' });
  }

  res.json({ success: true, message: 'OTP verified' });
});

// 🔁 Step 4: Reset Password
app.post('/api/forgot/reset-password', async (req, res) => {
  const userKey = req.body.userName || req.body.userId;
  const { newPassword } = req.body;

  try {
    const [result1] = await pool.execute(
      'UPDATE registration SET passWord = ? WHERE userName = ?',
      [newPassword, userKey]
    );
    if (result1.affectedRows > 0) {
      delete otpStore[userKey];
      return res.json({ success: true, message: 'Password reset successfully (Alumni)' });
    }

    const [result2] = await pool.execute(
      'UPDATE employers SET preferredPassword = ? WHERE preferredUserId = ?',
      [newPassword, userKey]
    );
    if (result2.affectedRows > 0) {
      delete otpStore[userKey];
      return res.json({ success: true, message: 'Password reset successfully (Employer)' });
    }

    return res.status(404).json({ error: 'User not found' });
  } catch (err) {
    console.error('🔴 /reset-password error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// 🧾 Step 5: Employer Email Finder
app.post('/api/employer/forgot/employer-user', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID required' });

  try {
    const [rows] = await pool.execute(
      'SELECT companyEmail FROM employers WHERE preferredUserId = ?',
      [userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Employer not found' });

    res.json({ email: rows[0].companyEmail });
  } catch (err) {
    console.error('🔴 /employer-user error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////




// ✅ Add Employer Registration
app.post('/api/employer/employers', async (req, res) => {
  const {
    employerName, businessName, businessAddress,
    landlineNo, mobileNo, companyEmail, companyWebsite,
    preferredUserId, preferredPassword
  } = req.body;

  // ✅ Validate Required Fields
  if (!employerName || !preferredUserId || !preferredPassword) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // ✅ Check if User ID Already Exists
    const [existingUsers] = await pool.execute(
      `SELECT * FROM employers WHERE LOWER(preferredUserId) = LOWER(?)`, 
      [preferredUserId]
    );

    if (existingUsers.length > 0) {
      console.log('❌ Employer username already taken');
      return res.status(409).json({ error: 'Preferred User ID is already taken. Please choose another.' });
    }

    // ✅ Insert Employer with MySQL datetime
    const submittedAt = formatDateTimeForMySQL();
    
    const [insertResult] = await pool.execute(`
      INSERT INTO employers (
        employerName, businessName, businessAddress,
        landlineNo, mobileNo, companyEmail, companyWebsite,
        preferredUserId, preferredPassword, submittedAt, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        employerName, businessName, businessAddress,
        landlineNo, mobileNo, companyEmail, companyWebsite,
        preferredUserId, preferredPassword, submittedAt
      ]
    );

    console.log('✅ Employer registered successfully. Sending notification...');

    const notif = {
      name: 'Employer Registrations',
      message: `New employer registration received from ${employerName}`,
      link: 'admin-employer.html',
      createdAt: submittedAt
    };

    // ✅ Insert into Notifications table
    await pool.execute(`
      INSERT INTO notifications (name, link, message, createdAt)
      VALUES (?, ?, ?, ?)`,
      [notif.name, notif.link, notif.message, notif.createdAt]
    );

    // ✅ Emit Real-time to Admins (use ISO format for frontend)
    io.emit('newNotification', {
      ...notif,
      createdAt: new Date().toISOString()
    });

    res.json({ 
      success: true, 
      id: insertResult.insertId, 
      message: 'Employer registered successfully.' 
    });

  } catch (err) {
    console.error('❌ Employer registration error:', err);
    res.status(500).json({ error: 'Failed to save employer registration' });
  }
});

// ✅ List Employers (Admin View) with pagination
app.get('/api/employer/list', async (req, res) => {
  const page = +req.query.page || 1;
  const limit = +req.query.limit || 100;
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : '%';

  try {
    // Get total count
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) AS total FROM employers 
       WHERE employerName LIKE ? OR businessName LIKE ?`,
      [search, search]
    );
    const total = countResult[0].total;

    // Get paginated data
    const [rows] = await pool.execute(
      `SELECT * FROM employers 
       WHERE employerName LIKE ? OR businessName LIKE ?
       ORDER BY submittedAt DESC 
       LIMIT ${limit} OFFSET ${offset}`,
      [search, search]
    );

    res.json({ 
      employers: rows,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total: total
    });

  } catch (err) {
    console.error('❌ Employer list error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ✅ Update Status
app.patch('/api/employer/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!['PENDING', 'ACCEPTED', 'ARCHIVED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const [result] = await pool.execute(
      `UPDATE employers SET status = ? WHERE id = ?`, 
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Employer not found' });
    }

    console.log(`Updated employer ${id} status to ${status}`);
    res.json({ 
      success: true, 
      message: `Employer status updated to ${status}` 
    });

  } catch (err) {
    console.error('❌ Employer status update error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// ✅ Get single employer details
app.get('/api/employer/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.execute(
      `SELECT * FROM employers WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Employer not found' });
    }

    res.json({ employer: rows[0] });

  } catch (err) {
    console.error('❌ Employer fetch error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ✅ Delete employer (if needed)
app.delete('/api/employer/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.execute(
      `DELETE FROM employers WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Employer not found' });
    }

    res.json({ 
      success: true, 
      message: 'Employer deleted successfully' 
    });

  } catch (err) {
    console.error('❌ Employer delete error:', err);
    res.status(500).json({ error: 'Failed to delete employer' });
  }
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ➕ Create Announcement
app.post('/api/admin/id-announcement', async (req, res) => {
  const { title, description } = req.body;
  
  
  // FIXED: Better validation check
  if (!title || !description || title.trim() === '' || description.trim() === '') {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  try {
    const datePosted = formatDateTimeForMySQL();
    
    const [result] = await pool.execute(
      'INSERT INTO idposts (title, description, datePosted) VALUES (?, ?, ?)',
      [title.trim(), description.trim(), datePosted]
    );
    
    res.json({ 
      success: true, 
      id: result.insertId,
      message: 'Announcement posted successfully!'
    });
    
  } catch (err) {
    console.error('❌ Error inserting announcement:', err);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// 📄 List Announcements
app.get('/api/admin/id-announcements', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, title, description, datePosted FROM idposts ORDER BY datePosted DESC`
    );
    res.json({ announcements: rows });
  } catch (err) {
    console.error('❌ Error fetching announcements:', err);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// 🗑️ Delete Announcement
app.delete('/api/admin/id-announcement/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute(
      `DELETE FROM idposts WHERE id = ?`,
      [id]
    );
    res.json({ success: true, deleted: result.affectedRows });
  } catch (err) {
    console.error('❌ Error deleting announcement:', err);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////




io.on('connection', async (socket) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM notifications ORDER BY createdAt DESC`);
    socket.emit('loadNotifications', rows);
  } catch (err) {
    console.error('❌ Socket notification load error:', err.message);
  }
});

// ➕ Add Notification
app.post('/api/notifications/add', async (req, res) => {
  const { name, link, message } = req.body;
  const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

  try {
    const [result] = await pool.execute(
      `INSERT INTO notifications (name, link, message, createdAt) VALUES (?, ?, ?, ?)`,
      [name, link, message, createdAt]
    );

    const newNotif = { id: result.insertId, name, link, message, createdAt };
    io.emit('newNotification', newNotif);
    res.json({ success: true, notification: newNotif });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📥 Inbox View
app.get('/api/admin/inbox', async (req, res) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM notifications ORDER BY createdAt DESC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🗑️ Delete All
app.delete('/api/notifications/clear', async (req, res) => {
  try {
    const [result] = await pool.execute(`DELETE FROM notifications`);
    console.log(`✅ All notifications cleared (${result.affectedRows} deleted)`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ❌ Delete One by ID
app.delete('/api/notifications/:id', async (req, res) => {
  try {
    const [result] = await pool.execute(`DELETE FROM notifications WHERE id = ?`, [req.params.id]);
    res.json({ success: true, deleted: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔔 Admin Notification Count (Pending Employers)
app.get('/api/admin/notifications/list', async (req, res) => {
  try {
    const [rows] = await pool.execute(`SELECT COUNT(*) as count FROM employers WHERE status = 'PENDING'`);
    res.json({
      notifications: [
        { name: 'Employer Registrations', count: rows[0].count, link: 'admin-employer.html' }
      ]
    });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});




//////////////////////////////////////////////////////////////////////////////////////////////////////
app.post('/api/applications/add', resumeUpload.single('resume'), async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNo } = req.body;
    const resumeBuffer = req.file.buffer; // resume in memory

    await pool.execute(
      `INSERT INTO applications (firstName, lastName, phoneNo, email, resumePath)
       VALUES (?, ?, ?, ?, ?)`,
      [firstName, lastName, phoneNo, email, req.file.originalname]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

