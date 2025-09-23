// routes/careers.js
const express = require("express");
const router = express.Router();
const pool = require("../db/mysql");
const path = require("path");
const multer = require("multer");

// Memory storage for images (BLOB)
const uploadImage = multer({ storage: multer.memoryStorage() });

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
// Employer: Get careers
// ---------------------------
router.get("/", authorizeEmployer, async (req, res) => {
  try {
    const user = req.session.user;
    const [rows] = await pool.execute(
      "SELECT id, title, description, link, userId, datePosted FROM careers WHERE userId = ? ORDER BY datePosted DESC",
      [user.preferredUserId]
    );
    res.json({ careers: rows });
  } catch (err) {
    console.error("❌ Error fetching careers:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------------------
// Employer/Admin: Add career
// ---------------------------
// --- Middleware: authorize admin or employer ---
function authorizeAdminOrEmployer(req, res, next) {
  const user = req.session?.user;
  if (!user || (!user.isAdmin && !user.isEmployer)) {
    return res.status(403).json({ error: 'Unauthorized access' });
  }
  next();
}

// --- Multer storage for career images ---
const careerStorage = multer.diskStorage({
  destination: "public/uploads/careers",
  filename: (req, file, cb) => {
    cb(null, "career-" + Date.now() + path.extname(file.originalname));
  },
});

const careerUpload = multer({ storage: careerStorage });

// --- Route: add new career ---
router.post(
  "/add",
  authorizeAdminOrEmployer,
  careerUpload.single("image"),
  async (req, res) => {
    const { title, description, link } = req.body;
    const user = req.session.user;

    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    try {
      const userId = user.isAdmin ? "admin" : user.preferredUserId;
      const imagePath = `/uploads/careers/${req.file.filename}`; // store relative path

      await pool.execute(
        `INSERT INTO careers (title, description, link, userId, datePosted, image)
         VALUES (?, ?, ?, ?, NOW(), ?)`,
        [title || null, description || null, link || null, userId, imagePath]
      );

      res.json({ success: true });
    } catch (err) {
      console.error("❌ Career insert error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);


// ---------------------------
// Serve career image
// ---------------------------
router.get("/image/:id", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT image FROM careers WHERE id = ?", [req.params.id]);
    if (!rows.length || !rows[0].image) return res.status(404).send("No image found");

    res.setHeader("Content-Type", "image/jpeg");
    res.send(rows[0].image);
  } catch (err) {
    console.error("❌ Career image fetch error:", err);
    res.status(500).send("Server error");
  }
});

// ---------------------------
// Public: Careers
// ---------------------------
router.get("/public", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, title, description, link, datePosted, image FROM careers WHERE status='active' ORDER BY datePosted DESC"
    );

    // Ensure the frontend can use the path directly
    const careers = rows.map(c => ({
      ...c,
      image: c.image ? `/uploads/careers/${path.basename(c.image)}` : null
    }));

    res.json({ careers });
  } catch (err) {
    console.error("❌ Error fetching public careers:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
