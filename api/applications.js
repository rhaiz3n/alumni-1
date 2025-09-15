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

    if (!req.session.user) {
      return res.status(401).json({ error: "Not logged in" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Resume (PDF) is required" });
    }

    // ✅ Save with userName so we can fetch later
    await pool.execute(
      `INSERT INTO applications (userName, firstName, lastName, phoneNo, email, resumePath, careerId)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.session.user.userName, // ✅ logged-in user
        firstName,
        lastName,
        phoneNo,
        email,
        req.file.filename,
        parseInt(careerId, 10)
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Application insert error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Employer: Get applications for a specific career they own
router.get("/career/:careerId", async (req, res) => {
  try {
    const sessionUser = req.session.user;

    // 🔒 Must be logged in as employer
    if (!sessionUser || !sessionUser.isEmployer) {
      return res.status(401).json({ error: "Unauthorized. Employer login required." });
    }

    const careerId = req.params.careerId;

    // 🔒 Ensure this career belongs to the logged-in employer
    const [careerCheck] = await pool.execute(
      "SELECT id FROM careers WHERE id = ? AND employerId = ?",
      [careerId, sessionUser.id]
    );

    if (!careerCheck.length) {
      return res.status(403).json({ error: "Unauthorized to view applications for this career" });
    }

    // ✅ Fetch applications for that career
    const [apps] = await pool.execute(
      `SELECT id, firstName, lastName, email, phoneNo, resumePath, dateSubmitted
       FROM applications
       WHERE careerId = ?
       ORDER BY dateSubmitted DESC`,
      [careerId]
    );

    res.json(apps);
  } catch (err) {
    console.error("❌ Failed to load applications:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// ✅ User: Get their own applications
router.get("/user/:userName", async (req, res) => {
  const { userName } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.resumePath, a.dateSubmitted,
              c.title AS careerTitle,
              c.link AS company
       FROM applications a
       JOIN careers c ON a.careerId = c.id
       WHERE a.userName = ?
       ORDER BY a.dateSubmitted DESC`,
      [userName]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Failed to fetch user applications:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
