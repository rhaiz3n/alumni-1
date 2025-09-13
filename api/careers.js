// routes/careers.js
const express = require("express");
const router = express.Router();
const pool = require("../db/mysql");
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
router.post("/add", uploadImage.single("image"), async (req, res) => {
  const { title, description, link } = req.body;
  const user = req.session.user;

  if (!user || (!user.isEmployer && !user.isAdmin)) {
    return res.status(401).json({ error: "Not logged in as employer or admin" });
  }

  if (!req.file) return res.status(400).json({ error: "No image uploaded" });

  try {
    const userId = user.isAdmin ? "admin" : user.preferredUserId;

    await pool.execute(
      `INSERT INTO careers (title, description, link, userId, datePosted, image)
       VALUES (?, ?, ?, ?, NOW(), ?)`,
      [title || null, description || null, link || null, userId, req.file.buffer]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Career insert error:", err);
    res.status(500).json({ error: err.message });
  }
});

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
      "SELECT id, title, description, link, datePosted FROM careers ORDER BY datePosted DESC"
    );
    res.json({ careers: rows });
  } catch (err) {
    console.error("❌ Error fetching public careers:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
