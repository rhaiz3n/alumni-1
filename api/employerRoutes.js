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
    // 1️⃣ Save into pendingLogo instead of companyLogo
    await pool.execute(
      "UPDATE employers SET pendingLogo = ? WHERE id = ?",
      [newLogoUrl, req.session.user.id]
    );

    console.log(`📥 Employer uploaded new logo (pending) for employerId=${req.session.user.id}: ${newLogoUrl}`);

    res.json({ success: true, pendingLogo: newLogoUrl, message: "Logo uploaded. Waiting for admin approval." });
  } catch (err) {
    console.error("❌ DB update error (pendingLogo):", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
});


// Admin approves pending logo
router.post("/approve-logo/:employerId", requireAdmin, async (req, res) => {
  const employerId = req.params.employerId;

  try {
    const [rows] = await pool.execute(
      "SELECT pendingLogo, companyLogo FROM employers WHERE id = ?",
      [employerId]
    );

    if (!rows.length || !rows[0].pendingLogo) {
      return res.status(400).json({ success: false, error: "No pending logo to approve" });
    }

    const { pendingLogo, companyLogo } = rows[0];

    // Delete old approved logo if not default
    if (companyLogo && !companyLogo.includes("default-company.png")) {
      const oldPath = path.join(__dirname, "../public", companyLogo);
      fs.unlink(oldPath, err => {
        if (err) console.warn("⚠️ Could not delete old logo:", err);
      });
    }

    // Move pending → companyLogo, clear pending
    await pool.execute(
      "UPDATE employers SET companyLogo = ?, pendingLogo = NULL WHERE id = ?",
      [pendingLogo, employerId]
    );

    res.json({ success: true, logoUrl: pendingLogo, message: "✅ Logo approved and updated!" });
  } catch (err) {
    console.error("❌ Logo approval error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

// ❌ Reject pending logo
router.post("/reject-logo/:id", requireAdmin, async (req, res) => {
  const employerId = req.params.id;

  try {
    // Get pending logo first
    const [rows] = await pool.execute(
      "SELECT pendingLogo FROM employers WHERE id = ?",
      [employerId]
    );

    if (!rows.length || !rows[0].pendingLogo) {
      return res.status(400).json({ success: false, error: "No pending logo to reject" });
    }

    const pendingLogo = rows[0].pendingLogo;

    // Delete the file if exists
    if (pendingLogo && !pendingLogo.includes("default-company.png")) {
      const filePath = path.join(__dirname, "../public", pendingLogo);
      fs.unlink(filePath, err => {
        if (err) console.warn("⚠️ Could not delete rejected logo:", err);
      });
    }

    // Clear pendingLogo
    await pool.execute(
      "UPDATE employers SET pendingLogo = NULL WHERE id = ?",
      [employerId]
    );

    res.json({ success: true, message: "❌ Pending logo rejected and removed." });
  } catch (err) {
    console.error("❌ Reject error:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

// ✅ Employer requests profile update (pending changes)
router.post("/update", requireEmployer, async (req, res) => {
  const employerId = req.session.user.id; // ✅ use logged-in employer's id
  const { landlineNo, mobileNo, companyEmail } = req.body;

  try {
    const fields = [];
    const values = [];

    if (landlineNo) {
      fields.push("pendingLandlineNo = ?");
      values.push(landlineNo);
    }
    if (mobileNo) {
      fields.push("pendingMobileNo = ?");
      values.push(mobileNo);
    }
    if (companyEmail) {
      fields.push("pendingCompanyEmail = ?");
      values.push(companyEmail);
    }

    if (!fields.length) {
      return res.status(400).json({ error: "No changes provided" });
    }

    values.push(employerId);

    await pool.query(
      `UPDATE employers SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    res.json({ success: true, message: "Changes submitted for admin approval" });
  } catch (err) {
    console.error("❌ Update error:", err);
    res.status(500).json({ error: "Database error" });
  }
});



// router.post("/api/employers/upload-logo", logoUpload.single("logo"), async (req, res) => {
//   if (!req.session.employer) {
//     return res.status(401).json({ error: "Not logged in as employer" });
//   }

//   try {
//     const filePath = "/uploads/companyLogos/" + req.file.filename;

//     await pool.execute(
//       `UPDATE employers SET companyLogo = ? WHERE id = ?`,
//       [filePath, req.session.employer.id]
//     );

//     res.json({ success: true, logoPath: filePath });
//   } catch (err) {
//     console.error("❌ Upload Logo Error:", err);
//     res.status(500).json({ error: "Database error" });
//   }
// });
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


// ✅ Fetch pending updates (logo + profile)
router.get("/:id/pending", async (req, res) => {
  const employerId = req.params.id;
  try {
    const [rows] = await pool.query(
      `SELECT companyLogo, pendingLogo,
              landlineNo, mobileNo, companyEmail,
              pendingLandlineNo, pendingMobileNo, pendingCompanyEmail
       FROM employers WHERE id = ?`,
      [employerId]
    );

    if (!rows.length) return res.status(404).json({ error: "Employer not found" });

    const emp = rows[0];
    res.json({
      currentLogo: emp.companyLogo,
      pendingLogo: emp.pendingLogo,
      currentProfile: {
        landlineNo: emp.landlineNo,
        mobileNo: emp.mobileNo,
        companyEmail: emp.companyEmail,
      },
      pendingProfile: {
        landlineNo: emp.pendingLandlineNo,
        mobileNo: emp.pendingMobileNo,
        companyEmail: emp.pendingCompanyEmail,
      }
    });
  } catch (err) {
    console.error("❌ Error fetching pending:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ Approve pending logo
router.post("/:id/approve-pending", requireAdmin, async (req, res) => {
  const employerId = req.params.id;
  try {
    await pool.query(
      `UPDATE employers 
       SET companyLogo = pendingLogo, 
           pendingLogo = NULL 
       WHERE id = ? AND pendingLogo IS NOT NULL`,
      [employerId]
    );
    res.json({ success: true, message: "✅ Pending logo approved" });
  } catch (err) {
    console.error("❌ Approve error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ❌ Reject pending logo
router.post("/:id/reject-pending", requireAdmin, async (req, res) => {
  const employerId = req.params.id;
  try {
    await pool.query(
      "UPDATE employers SET pendingLogo = NULL WHERE id = ?",
      [employerId]
    );
    res.json({ success: true, message: "❌ Pending logo rejected" });
  } catch (err) {
    console.error("❌ Reject error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ Approve pending profile fields (landline, mobile, email)
router.post("/:id/approve-profile", requireAdmin, async (req, res) => {
  const employerId = req.params.id;

  try {
    await pool.query(
      `UPDATE employers 
       SET landlineNo = COALESCE(pendingLandlineNo, landlineNo),
           mobileNo = COALESCE(pendingMobileNo, mobileNo),
           companyEmail = COALESCE(pendingCompanyEmail, companyEmail),
           pendingLandlineNo = NULL,
           pendingMobileNo = NULL,
           pendingCompanyEmail = NULL
       WHERE id = ?`,
      [employerId]
    );

    res.json({ success: true, message: "✅ Pending profile approved" });
  } catch (err) {
    console.error("❌ Approve profile error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ❌ Reject pending profile fields
router.post("/:id/reject-profile", requireAdmin, async (req, res) => {
  const employerId = req.params.id;

  try {
    await pool.query(
      `UPDATE employers 
       SET pendingLandlineNo = NULL,
           pendingMobileNo = NULL,
           pendingCompanyEmail = NULL
       WHERE id = ?`,
      [employerId]
    );

    res.json({ success: true, message: "❌ Pending profile rejected" });
  } catch (err) {
    console.error("❌ Reject profile error:", err);
    res.status(500).json({ error: "Database error" });
  }
});



// Admin guard
function requireAdmin(req, res, next) {
  if (!req.session.user || !req.session.user.isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

// ✅ List employers with pagination & search
router.get("/list", requireAdmin, async (req, res) => {
  const page = +req.query.page || 1;
  const limit = +req.query.limit || 100;
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : "%";

  try {
    const [countResult] = await pool.execute(
      "SELECT COUNT(*) AS total FROM employers WHERE employerName LIKE ? OR businessName LIKE ?",
      [search, search]
    );
    const total = countResult[0].total;

const [rows] = await pool.execute(
  `SELECT * FROM employers
   WHERE employerName LIKE ? OR businessName LIKE ?
   ORDER BY submittedAt DESC
   LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
  [search, search]
);


    res.json({
      employers: rows,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    console.error("❌ Employer list error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ Update employer status
router.patch("/:id/status", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["PENDING", "ACCEPTED", "ARCHIVED"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const [result] = await pool.execute(
      "UPDATE employers SET status = ? WHERE id = ?",
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Employer not found" });
    }

    res.json({ success: true, message: `Employer status updated to ${status}` });
  } catch (err) {
    console.error("❌ Employer status update error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});


module.exports = router;
