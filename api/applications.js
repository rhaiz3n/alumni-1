const express = require("express");
const multer = require("multer");
const path = require("path");
const pool = require("../db/mysql");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), "uploads/resumes"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  }
});

const uploadResume = multer({ storage });

router.post("/applications/add", uploadResume.single("resume"), async (req, res) => {
  try {
    const { firstName, lastName, phoneNo, email } = req.body;
    const resumePath = req.file ? req.file.filename : null;

    if (!firstName || !lastName || !phoneNo || !email || !resumePath) {
      return res.status(400).json({ error: "All fields are required" });
    }

    await pool.execute(
      `INSERT INTO applications (firstName, lastName, phoneNo, email, resumePath) 
       VALUES (?, ?, ?, ?, ?)`,
      [firstName, lastName, phoneNo, email, resumePath]
    );

    res.json({ success: true, message: "Application submitted successfully" });
  } catch (err) {
    console.error("🔥 Server Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;
