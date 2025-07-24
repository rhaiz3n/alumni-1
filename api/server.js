// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const pool = require('../db/mysql'); // MySQL pool (mysql2)
const { sendOtpEmail } = require('../GmailMailer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only Excel files
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'));
    }
  }
});





// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static('uploads'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'alumni2025',
  resave: false,
  saveUninitialized: true
}));
app.locals.io = io;

io.on('connection', socket => {
  console.log('🔌 Socket connected:', socket.id);
});

// Create tables if not exist
async function initTables() {
  const sql = {
    alumni: `CREATE TABLE IF NOT EXISTS alumni (
      id INT AUTO_INCREMENT PRIMARY KEY,
      firstName VARCHAR(100),
      lastName VARCHAR(100),
      initial VARCHAR(10),
      suffix VARCHAR(10),
      civilStatus VARCHAR(50),
      dateBirth DATE,
      gender VARCHAR(20),
      phoneNo VARCHAR(50),
      major VARCHAR(100),
      yearStarted YEAR,
      graduated YEAR,
      studentNo VARCHAR(50)
    )`,
    responses: `CREATE TABLE IF NOT EXISTS responses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      firstName VARCHAR(100),
      lastName VARCHAR(100),
      interested VARCHAR(100),
      employmentStatus VARCHAR(100),
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
      studentNo VARCHAR(50)
    )`,
    events: `CREATE TABLE IF NOT EXISTS events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      image LONGBLOB,
      title VARCHAR(255),
      description TEXT,
      location VARCHAR(255),
      datePosted DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    careers: `CREATE TABLE IF NOT EXISTS careers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      image LONGBLOB,
      title VARCHAR(255),
      description TEXT,
      link VARCHAR(255),
      datePosted DATETIME DEFAULT CURRENT_TIMESTAMP
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
  };
  for (const [name, ddl] of Object.entries(sql)) {
    await pool.query(ddl);
    console.log(`✅ Initialized table: ${name}`);
  }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ➕ API: Add alumni
// 📥 Add new alumni
app.post('/api/alumni', async (req, res) => {
  try {
    const b = req.body;
    
    // Convert undefined values to null
    const values = [
      b.firstName || null,
      b.lastName || null,
      b.initial || null,
      b.suffix || null,
      b.civilStatus || null,
      b.dateBirth || null,
      b.gender || null,
      b.phoneNo || null,
      b.major || null,
      b.yearStarted || null,
      b.graduated || null,
      b.studentNo || null
    ];

    const [result] = await pool.execute(`
      INSERT INTO alumni (
        firstName, lastName, initial, suffix,
        civilStatus, dateBirth, gender,
        phoneNo, major, yearStarted,
        graduated, studentNo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, values);

    res.json({ id: result.insertId });
  } catch (err) {
    console.error('Alumni insert error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 📦 Upload Excel for alumni
// Helper function to parse various date formats
// Improved date parsing function
function parseDate(dateValue) {
  if (!dateValue) return null; // Return null, not undefined
  
  // If it's a string like "March 20 2002", parse it manually
  if (typeof dateValue === 'string') {
    const monthNames = {
      'January': '01', 'February': '02', 'March': '03', 'April': '04',
      'May': '05', 'June': '06', 'July': '07', 'August': '08',
      'September': '09', 'October': '10', 'November': '11', 'December': '12'
    };
    
    // Match pattern like "March 20 2002"
    const match = dateValue.match(/^(\w+)\s+(\d{1,2})\s+(\d{4})$/);
    if (match) {
      const monthName = match[1];
      const day = match[2].padStart(2, '0');
      const year = match[3];
      const month = monthNames[monthName];
      
      if (month) {
        const result = `${year}-${month}-${day}`;
        return result;
      }
    }
  }
  
  // Fallback to regular date parsing
  const date = new Date(dateValue);
  if (!isNaN(date.getTime())) {
    const result = date.getFullYear() + '-' + 
      String(date.getMonth() + 1).padStart(2, '0') + '-' + 
      String(date.getDate()).padStart(2, '0');
    return result;
  }
  
  return null; // Return null instead of undefined
}

// Updated Excel upload route
app.post('/api/alumni/upload-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!req.file.buffer) {
      return res.status(400).json({ error: 'File buffer not available. Check multer configuration.' });
    }

    let wb, sheet, rows;
    try {
    wb = XLSX.read(req.file.buffer, { 
      type: 'buffer', 
      cellDates: false, // Don't auto-convert to Date objects
      raw: false // Get formatted strings
    });
      sheet = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { raw: false }); // raw: false to get formatted strings
    } catch (xlsxError) {
      console.error('XLSX parsing error:', xlsxError);
      return res.status(400).json({ error: 'Invalid Excel file format' });
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'Excel file is empty or has no valid data' });
    }

    console.log(`Processing ${rows.length} rows from Excel file`);

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    const stmt = `
      INSERT INTO alumni (
        firstName, lastName, initial, suffix,
        civilStatus, dateBirth, gender,
        phoneNo, major, yearStarted, graduated, studentNo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    let insertedCount = 0;
    let errors = [];

    // In your Excel upload route, update the row processing:
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const dateBirth = parseDate(row['Date of Birth'] || row['dateBirth']);
        
        const values = [
          row['First Name'] || row['firstName'] || null,
          row['Last Name'] || row['lastName'] || null,
          row['Initial'] || row['initial'] || null,
          row['Suffix'] || row['suffix'] || null,
          row['Civil Status'] || row['civilStatus'] || null,
          dateBirth || null, // Make sure this is null, not undefined
          row['Gender'] || row['gender'] || null,
          row['Phone No.'] || row['Phone No'] || row['phoneNo'] || null,
          row['Major'] || row['major'] || null,
          row['Year Started'] != null ? String(row['Year Started']) : (row['yearStarted'] ? String(row['yearStarted']) : null),
          row['Graduated'] != null ? String(row['Graduated']) : (row['graduated'] ? String(row['graduated']) : null),
          row['Student No.'] || row['Student No'] || row['studentNo'] || null
        ];

        await connection.execute(stmt, values);
        insertedCount++;
      } catch (rowError) {
        console.error(`Error inserting row ${i + 1}:`, rowError.message);
        errors.push(`Row ${i + 1}: ${rowError.message}`);
      }
    }

    await connection.commit();
    connection.release();

    res.json({ 
      success: true, 
      totalRows: rows.length,
      inserted: insertedCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    console.error('Excel upload error:', err);
    res.status(500).json({ error: err.message });
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

// ✅ Add new job response + emit + notify
// Helper function for MySQL datetime format (add this at the top of server.js if not already there)
function formatDateTimeForMySQL(date = new Date()) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

app.post('/api/responses/add', async (req, res) => {
  const { firstName, lastName, interested, employmentStatus } = req.body;
  
  // Validate required fields
  if (!firstName || !lastName || !interested || !employmentStatus) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const dateSubmitted = formatDateTimeForMySQL(); // MySQL-compatible format

  const connection = await pool.getConnection(); // FIXED: Removed .promise()

  try {
    await connection.beginTransaction();

    // Insert into responses table
    const [insertResult] = await connection.execute(`
      INSERT INTO responses (firstName, lastName, interested, employmentStatus, dateSubmitted)
      VALUES (?, ?, ?, ?, ?)`,
      [firstName, lastName, interested, employmentStatus, dateSubmitted]
    );

    // Insert into notifications table
    const message = `${firstName} ${lastName} submitted a job response.`;
    const notifLink = 'jobs-response.html';

    await connection.execute(`
      INSERT INTO notifications (name, message, link, createdAt)
      VALUES (?, ?, ?, ?)`,
      ['Jobs Responses', message, notifLink, dateSubmitted]
    );

    await connection.commit();
    connection.release();

    // Emit real-time notification (use ISO format for frontend)
    io.emit('newNotification', {
      name: 'Jobs Responses',
      message,
      link: notifLink,
      createdAt: new Date().toISOString() // Frontend can handle ISO format
    });

    res.json({ success: true, insertedId: insertResult.insertId });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('❌ Responses Insert Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 📄 GET paginated + searchable job responses
app.get('/api/responses', async (req, res) => {
  const page = +req.query.page || 1;
  const limit = +req.query.limit || 100;
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : '%';

  try {
    // Count query - FIXED: Removed .promise()
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) AS total FROM responses 
       WHERE firstName LIKE ? OR lastName LIKE ?`,
      [search, search]
    );
    const total = countResult[0].total;

    // Data query - FIXED: Removed .promise() and used template literals for LIMIT/OFFSET
    const [rows] = await pool.execute(
      `SELECT * FROM responses 
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

  if (!firstName || !lastName || !personalEmail || !gender || !userName || !passWord || !major || !graduated) {
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

    // 2️⃣ Check if alumni info already registered
    const [duplicateRows] = await connection.execute(
      `SELECT * FROM registration WHERE LOWER(firstName) = LOWER(?) AND LOWER(lastName) = LOWER(?) AND LOWER(gender) = LOWER(?) AND LOWER(personalEmail) = LOWER(?)`,
      [firstName, lastName, gender, personalEmail]
    );
    if (duplicateRows.length > 0) {
      return res.status(409).json({ error: 'This information has already created an account.' });
    }

    // 3️⃣ Validate against alumni table
    const graduatedYear = validateInteger(graduated, 'graduated');
    if (graduatedYear === null) {
      return res.status(400).json({ error: 'Graduated year must be a valid number.' });
    }

    const [alumniMatch] = await connection.execute(
      `SELECT * FROM alumni WHERE LOWER(firstName) = LOWER(?) AND LOWER(lastName) = LOWER(?) AND LOWER(gender) = LOWER(?) AND LOWER(major) = LOWER(?) AND graduated = ?`,
      [firstName, lastName, gender, major, graduatedYear]
    );
    if (alumniMatch.length === 0) {
      return res.status(403).json({ error: 'Alumni record does not match our records.' });
    }

    // 4️⃣ Insert registration record
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
      `INSERT INTO notifications (name, link, message, createdAt) VALUES (?, ?, ?, ?)`,
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






///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


// ✅ LOGIN API — Check username & password
app.post('/api/registration/login', async (req, res) => {
  const { userName, passWord } = req.body;

  if (!userName || !passWord) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT * FROM registration 
       WHERE userName = ? AND passWord = ?`,
      [userName, passWord]
    );

    if (rows.length === 0) {
      console.log('❌ Invalid credentials');
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = rows[0];
    const isAdmin = userName.toLowerCase() === 'admin';

    req.session.user = {
      id: user.id,
      userName: user.userName,
      isAdmin
    };

    console.log('✅ Login successful for:', userName);
    res.json({ success: true, message: 'Login successful', isAdmin });
  } catch (err) {
    console.error('❌ Login DB Error:', err);
    res.status(500).json({ error: 'Database error' });
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

    req.session.user = {
      id: employer.id,
      preferredUserId: employer.preferredUserId,
      isEmployer: true
    };

    console.log('✅ Employer Login successful for:', userId);
    res.json({ success: true, message: 'Login successful. Welcome Employer!' });
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

  // Validate that limit and offset are valid positive integers
  if (isNaN(limit) || isNaN(offset) || limit <= 0 || offset < 0) {
    return res.status(400).json({ error: 'Invalid pagination parameters' });
  }

  try {
    // Count total rows for pagination
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as count FROM registration
       WHERE firstName LIKE ? OR lastName LIKE ? OR personalEmail LIKE ? OR userName LIKE ?`,
      [search, search, search, search]
    );
    const totalRows = countRows[0].count;
    const totalPages = Math.ceil(totalRows / limit);

    // Use template literals for LIMIT and OFFSET since they can't be parameterized
    const [rows] = await pool.execute(
      `SELECT * FROM registration
       WHERE firstName LIKE ? OR lastName LIKE ? OR personalEmail LIKE ? OR userName LIKE ?
       ORDER BY id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [search, search, search, search]
    );

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
function validateInteger(value, fieldName) {
  if (!value || value === '') return null;
  
  const parsed = parseInt(value);
  if (isNaN(parsed)) {
    console.log(`Warning: Invalid integer value "${value}" for field ${fieldName}, setting to null`);
    return null;
  }
  return parsed;
}

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

// Updated fullInformation route
app.post('/api/fullInformation/add', async (req, res) => {
  const {
    firstName, lastName, initial, suffix, gender,
    civilStatus, dateBirth, maiden, phoneNo,
    major, yearStarted, graduated, studentNo
  } = req.body;

  // Updated validation - allow some fields to be optional/empty
  if (!firstName || !lastName || !gender || !major || !yearStarted || !graduated) {
    return res.status(400).json({ error: 'Missing required fields: firstName, lastName, gender, major, yearStarted, graduated' });
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

    console.log('Formatted date for database:', formattedDateBirth); // Debug log

    const [result] = await pool.execute(`
      INSERT INTO fullInformation (
        firstName, lastName, initial, suffix, gender,
        civilStatus, dateBirth, maiden, phoneNo,
        major, yearStarted, graduated, studentNo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ]
    );

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


// 📦 Setup
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// 🧠 Helper for MySQL-compliant DATETIME
function mysqlDateNow() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// 📌 POST: Add Event
app.post('/api/events/add', uploadImage.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image' });

  const { title, description, location } = req.body;
  const datePosted = mysqlDateNow();

  try {
    const [result] = await pool.execute(
      `INSERT INTO events (image, title, description, location, datePosted)
       VALUES (?, ?, ?, ?, ?)`,
      [req.file.buffer, title, description, location, datePosted]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('❌ Error inserting event:', err);
    res.status(500).json({ error: err.message });
  }
});

// 📌 GET: Events List
app.get('/api/events', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, description, location, datePosted, image 
       FROM events ORDER BY datePosted DESC`
    );
    const events = rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      location: row.location,
      datePosted: row.datePosted,
      image: `data:image/jpeg;base64,${row.image.toString('base64')}`
    }));
    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📌 PUT: Edit Event
app.put('/api/events/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, location } = req.body;

  try {
    const [result] = await pool.execute(
      `UPDATE events SET title = ?, description = ?, location = ? WHERE id = ?`,
      [title, description, location, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Event not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📌 DELETE: Remove Event
app.delete('/api/events/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute(
      `DELETE FROM events WHERE id = ?`,
      [id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Event not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});






function authorizeAdminOrEmployer(req, res, next) {
  const user = req.session?.user;
  if (!user || (!user.isAdmin && !user.isEmployer)) {
    return res.status(403).json({ error: 'Unauthorized access' });
  }
  next();
}

app.post('/api/careers/add', authorizeAdminOrEmployer, uploadImage.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

  const { title, description, link } = req.body;
  const user = req.session.user;
  const postedBy = user.isAdmin ? user.userName : user.preferredUserId;
  const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const message = `${title} posted by ${postedBy}`;

  const connection = await pool.getConnection(); // ✅ no .promise()

  try {
    await connection.beginTransaction();

    const [careerResult] = await connection.execute(
      `INSERT INTO careers (image, title, description, link) VALUES (?, ?, ?, ?)`,
      [req.file.buffer, title, description, link]
    );

    const [notifResult] = await connection.execute(
      `INSERT INTO notifications (name, link, message, createdAt) VALUES (?, ?, ?, ?)`,
      [`Career Post by ${postedBy}`, 'career-posting.html', message, createdAt]
    );

    await connection.commit();
    connection.release();

    io.emit('newNotification', {
      id: notifResult.insertId,
      name: `Career Post by ${postedBy}`,
      message,
      link: 'career-posting.html',
      createdAt
    });

    res.json({ success: true, id: careerResult.insertId });
  } catch (err) {
    await connection.rollback();
    connection.release();
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/careers', async (req, res) => {
  try {
    const [rows] = await pool.query( // ✅ no .promise()
      `SELECT id, title, description, link, datePosted, image FROM careers ORDER BY datePosted DESC`
    );
    const careers = rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      link: row.link,
      datePosted: row.datePosted,
      image: `data:image/jpeg;base64,${row.image.toString('base64')}`
    }));
    res.json({ careers });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

app.delete('/api/careers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute( // ✅ no .promise()
      `DELETE FROM careers WHERE id = ?`,
      [id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Career not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
      ['Athlete Registration', message, 'allsport.html', submittedAt]
    );

    await connection.commit();
    connection.release();

    io.emit('newNotification', {
      id: notifResult.insertId,
      name: 'Athlete Registration',
      message,
      link: 'allsport.html',
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

// 🔧 Format datetime for MySQL
function mysqlDateNow() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// POST: Upload Multiple Images
app.post('/api/gallery/add-multiple', uploadPhoto.array('images', 25), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'At least one image required' });
  }

  const now = mysqlDateNow();

  const connection = await pool.getConnection(); // ✅ FIXED: removed `.promise()`

  try {
    await connection.beginTransaction();

    const insertQuery = `INSERT INTO gallery (image, datePosted) VALUES (?, ?)`;
    for (const file of req.files) {
      await connection.execute(insertQuery, [file.buffer, now]);
    }

    await connection.commit();
    connection.release();

    res.json({ success: true });
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
  const validStatus = (status || '').toUpperCase();

  if (!['PENDING', 'ACCEPTED', 'DECLINED'].includes(validStatus)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    // FIXED: Removed .promise()
    const [result] = await pool.execute(
      `UPDATE requests SET status = ? WHERE id = ?`,
      [validStatus, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json({ success: true, message: 'Status updated successfully' });
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
  
  if (!['PENDING', 'ACCEPTED', 'DECLINED'].includes(status)) {
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

app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));