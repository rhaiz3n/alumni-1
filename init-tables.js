// init-tables.js
require('dotenv').config();
const admin = require('./db/mysql');

async function initTables() {
  try {
    await admin.query(`CREATE DATABASE IF NOT EXISTS alumni_db`);
    console.log("✅ Database 'alumni_db' created or already exists");

    const conn = await admin.getConnection();
    await conn.changeUser({ database: 'alumni_db' });

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
      )`
    };

    for (const [name, ddl] of Object.entries(sql)) {
      await conn.query(ddl);
      console.log(`✅ Created table: ${name}`);
    }

    conn.release();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error initializing database:", err.message);
    process.exit(1);
  }
}

initTables();
