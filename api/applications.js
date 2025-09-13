// routes/applications.js
const express = require("express");
const router = express.Router();
const pool = require("../db/mysql");
const multer = require("multer");
const path = require("path");


// ✅ Storage config (keep original name, force .pdf)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/resumes/");
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname
      .replace(/\s+/g, "_")     
      .replace(/[^a-zA-Z0-9_.-]/g, ""); 

    cb(null, Date.now() + "_" + safeName);
  }
});

// ✅ File filter to allow only PDFs
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== ".pdf") {
    return cb(new Error("Only PDF files are allowed"), false);
  }
  cb(null, true);
}

const upload = multer({ storage, fileFilter });


// Middleware
function authorizeEmployer(req, res, next) {
  const user = req.session.user;
  if (!user || !user.isEmployer) return res.status(401).json({ error: "Not logged in as employer" });
  next();
}

function authorizeAdmin(req, res, next) {
  const user = req.session.user;
  if (!user || !user.isAdmin) return res.status(401).json({ error: "Not logged in as admin" });
  next();
}


// ---------------------------
// POST /api/applications/add
// ---------------------------
router.post("/add", upload.single("resume"), async (req, res) => {
  try {
    const { firstName, lastName, phoneNo, email, careerId } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "Resume (PDF) is required" });
    }

    await pool.execute(
      `INSERT INTO applications (firstName, lastName, phoneNo, email, resumePath, careerId)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [firstName, lastName, phoneNo, email, req.file.filename, parseInt(careerId, 10)]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Application insert error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// ✅ Employer: Get applications for a specific career they own
router.get("/career/:careerId", authorizeEmployer, async (req, res) => {
  try {
    const user = req.session.user;
    const careerId = req.params.careerId;

    // ensure this career belongs to the logged-in employer
    const [careerCheck] = await pool.execute(
      "SELECT id FROM careers WHERE id = ? AND userId = ?",
      [careerId, user.preferredUserId]
    );

    if (!careerCheck.length) {
      return res.status(403).json({ error: "Unauthorized to view applications for this career" });
    }

    const [apps] = await pool.execute(
      `SELECT id, firstName, lastName, email, phoneNo, resumePath, dateSubmitted
       FROM applications WHERE careerId = ? ORDER BY dateSubmitted DESC`,
      [careerId]
    );

    res.json(apps);
  } catch (err) {
    console.error("❌ Failed to load applications:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
