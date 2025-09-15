// api/employerRoutes.js
const express = require("express");
const pool = require("../db/mysql");
const multer = require("multer");
const path = require("path");

const router = express.Router();

// ⚡ File upload setup for company logo
const storage = multer.diskStorage({
  destination: path.join(__dirname, "../public/uploads/companyLogos/"),  // ✅ inside /public
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

// Helper: check employer session
function requireEmployer(req, res, next) {
  if (!req.session.user || !req.session.user.isEmployer) {
    return res.status(401).json({ error: "Not logged in as employer" });
  }
  next();
}

// ✅ Get current employer profile
router.get("/me", requireEmployer, async (req, res) => {
  try {
    const [rows] = await pool.execute(
    `SELECT id,
            employerName,
            businessName,
            businessAddress,
            landlineNo,
            mobileNo,
            companyEmail,
            companyWebsite,
            preferredUserId,
            status,
            submittedAt,
            companyLogo,        -- ✅ correct field from your schema
            profileConfirmed
    FROM employers
    WHERE preferredUserId = ?`,
    [req.session.user.preferredUserId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Employer not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Error fetching employer info:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ Update editable fields
router.post("/update", requireEmployer, async (req, res) => {
  const { companyEmail, mobileNo, landlineNo } = req.body;

  try {
    await pool.execute(
      `UPDATE employers 
       SET companyEmail = ?, mobileNo = ?, landlineNo = ? 
       WHERE preferredUserId = ?`,
      [companyEmail, mobileNo, landlineNo, req.session.user.preferredUserId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error updating employer profile:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ Upload company logo
router.post("/upload-logo", requireEmployer, upload.single("companyLogo"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const logoPath = "/uploads/companyLogos/" + req.file.filename;

  try {
    await pool.execute(
      `UPDATE employers SET companyLogo = ? WHERE preferredUserId = ?`,
      [logoPath, req.session.user.preferredUserId]
    );
    res.json({ success: true, logoUrl: logoPath });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ Confirm profile (lock removal)
router.post("/confirm", requireEmployer, async (req, res) => {
  try {
    await pool.execute(
      `UPDATE employers SET profileConfirmed = 1 WHERE preferredUserId = ?`,
      [req.session.user.preferredUserId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Confirm error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ Get applicants (for employers)
router.get("/applicants", requireEmployer, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT a.id, a.firstName, a.lastName, a.phoneNo, a.email,
              a.resumePath, a.dateSubmitted
       FROM applications a
       WHERE a.careerId IN (
         SELECT id FROM careers WHERE employerId = ?
       )`,
      [req.session.user.id]   // ✅ use req.session.user
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Applicants error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
