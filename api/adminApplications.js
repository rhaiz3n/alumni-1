// api/adminApplications.js
const express = require("express");
const router = express.Router();
const pool = require("../db/mysql");

// GET /api/admin-applications
// Returns applications for careers that belong to the logged-in user
router.get("/", async (req, res) => {
  try {
    // must be logged in
    if (!req.session?.user) return res.status(401).json({ error: "Not logged in" });

    // session may contain different properties depending on your login flow.
    // Try username and numeric id (covers both cases).
    const sessionUserName = req.session.user.userName || "";
    const sessionUserId = req.session.user.id || "";

    // Query: join applications -> careers and filter by careers.userId
    // Alias columns to match front-end expectations: resume and submittedAt
    const sql = `
      SELECT
        a.firstName,
        a.lastName,
        a.phoneNo,
        a.email,
        a.resumePath AS resume,
        a.dateSubmitted AS submittedAt,
        a.userName AS applicantUserName,
        a.careerId
      FROM applications a
      JOIN careers c ON a.careerId = c.id
      WHERE c.userId = ? OR c.userId = ?
      ORDER BY a.dateSubmitted DESC
    `;

    const [rows] = await pool.query(sql, [sessionUserName, sessionUserId]);

    // rows is an array; send it back
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching admin applications:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
