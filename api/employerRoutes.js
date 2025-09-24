// api/employerRoutes.js
const express = require("express");
const router = express.Router();
const { logoUpload } = require("./uploadConfig"); 
const pool = require("../db/mysql");
const fs = require("fs");
const path = require("path");

// 🔒 Ensure employer is logged in
function requireEmployer(req, res, next) {
  if (!req.session.user || !req.session.user.isEmployer) {
    return res.status(401).json({ error: "Not logged in as employer" });
  }
  next();
}

/**
 * ✅ Upload company logo
 */
router.post("/upload-logo", requireEmployer, logoUpload.single("companyLogo"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No file uploaded" });
  }

  const newLogoUrl = "/uploads/companyLogos/" + req.file.filename;

  try {
    // 1️⃣ Get old logo
    const [rows] = await pool.execute(
      "SELECT companyLogo FROM employers WHERE id = ?",
      [req.session.user.id]
    );

    const oldLogo = rows[0]?.companyLogo;

    // 2️⃣ Delete old if not default
    if (oldLogo && !oldLogo.includes("default-company.png")) {
      const oldPath = path.join(__dirname, "../public", oldLogo);
      fs.unlink(oldPath, err => {
        if (err) console.warn("⚠️ Could not delete old logo:", err);
      });
    }

    // 3️⃣ Update DB
    await pool.execute(
      "UPDATE employers SET companyLogo = ? WHERE id = ?",
      [newLogoUrl, req.session.user.id]
    );

    console.log(`✅ Employer logo updated for employerId=${req.session.user.id}: ${newLogoUrl}`);

    // ✅ Always respond with the same contract
    res.json({ success: true, logoUrl: newLogoUrl });
  } catch (err) {
    console.error("❌ DB update error (logo):", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
});



router.post("/api/employers/upload-logo", logoUpload.single("logo"), async (req, res) => {
  if (!req.session.employer) {
    return res.status(401).json({ error: "Not logged in as employer" });
  }

  try {
    const filePath = "/uploads/companyLogos/" + req.file.filename;

    await pool.execute(
      `UPDATE employers SET companyLogo = ? WHERE id = ?`,
      [filePath, req.session.employer.id]
    );

    res.json({ success: true, logoPath: filePath });
  } catch (err) {
    console.error("❌ Upload Logo Error:", err);
    res.status(500).json({ error: "Database error" });
  }
});
/**
 * ✅ Get current employer profile
 */
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
              companyLogo,
              profileConfirmed
       FROM employers
       WHERE id = ?`,
      [req.session.user.id]
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

/**
 * ✅ Get logo only (fallback to default)
 */
router.get("/get-logo", requireEmployer, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT companyLogo FROM employers WHERE id = ?",
      [req.session.user.id]
    );

    let companyLogo = rows[0]?.companyLogo || "/images/default-company.png";
    res.json({ companyLogo });
  } catch (err) {
    console.error("❌ Get logo error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * ✅ Confirm employer profile
 */
router.post("/confirm", async (req, res) => {
  if (!req.session.user || !req.session.user.isEmployer) {
    return res.status(401).json({ error: "Not logged in as employer" });
  }

  try {
    const employerId = req.session.user.id;

    const [rows] = await pool.execute(
      "SELECT companyLogo, profileConfirmed FROM employers WHERE id = ?",
      [employerId]
    );

    if (!rows.length) return res.status(404).json({ error: "Employer not found" });

    const { companyLogo, profileConfirmed } = rows[0];

    if (profileConfirmed) {
      return res.json({ success: true, message: "Already confirmed" });
    }

    if (!companyLogo || companyLogo.includes("default-company.png")) {
      return res.status(400).json({ error: "You must upload a company logo first" });
    }

    await pool.execute(
      "UPDATE employers SET profileConfirmed = 1 WHERE id = ?",
      [employerId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Confirm employer profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// 🔹 Update employer profile
router.post("/update", requireEmployer, async (req, res) => {
  try {
    const employerId = req.session.user?.id;
    if (!employerId) {
      return res.status(401).json({ success: false, error: "Not logged in" });
    }

    const { landlineNo, mobileNo, companyEmail } = req.body;

    // ✅ Update employer info
    await pool.execute(
      `UPDATE employers
       SET landlineNo = ?, mobileNo = ?, companyEmail = ?
       WHERE id = ?`,
      [landlineNo, mobileNo, companyEmail, employerId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error updating employer:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
});


module.exports = router;
