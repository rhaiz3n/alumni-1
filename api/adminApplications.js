// api/adminApplications.js
const express = require("express");
const router = express.Router();
const pool = require("../db/mysql");

// GET /api/admin-applications
// Returns applications for careers that belong to the logged-in user
router.get("/", async (req, res) => {
  try {
    if (!req.session?.user) {
      return res.status(401).json({ error: "Not logged in" });
    }

    // ✅ Use userName instead of numeric ID
    const sessionUserId = req.session.user.userName;

    const sql = `
      SELECT
        aa.firstName,
        aa.lastName,
        aa.phoneNo,
        aa.email,
        aa.resumePath AS resume,
        aa.dateSubmitted AS submittedAt,
        aa.userName AS applicantUserName,
        aa.careerId,
        aa.careerTitle,
        aa.companyName,
        aa.archivedAt
      FROM applications_archive aa
      WHERE aa.employerId = ?   -- stored as careers.userId (VARCHAR)
      ORDER BY aa.dateSubmitted DESC
    `;

    const [rows] = await pool.query(sql, [sessionUserId]);

    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching admin applications (archive):", err);
    res.status(500).json({ error: "Server error" });
  }
});




module.exports = router;
