// api/profileRoutes.js
const express = require("express");
const router = express.Router();
const { profilePicUpload } = require("./uploadConfig");
const pool = require("../db/mysql");
const fs = require("fs");
const path = require("path");

// ✅ Upload profile picture with auto-delete old one
router.post("/upload-picture", profilePicUpload.single("profilePic"), async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const newImageUrl = "/uploads/profilePics/" + req.file.filename;

  try {
    // 1️⃣ Get old profile picture from DB
    const [rows] = await pool.execute(
      "SELECT profilePic FROM fullInformation WHERE userName = ?",
      [req.session.user.userName]
    );

    const oldImage = rows[0]?.profilePic;

    // 2️⃣ Delete old file if it exists and is not default
    if (oldImage && !oldImage.includes("default-profile.png")) {
      const oldPath = path.join(__dirname, "../public", oldImage);
      fs.unlink(oldPath, err => {
        if (err) console.warn("⚠️ Could not delete old profile picture:", err);
      });
    }

    // 3️⃣ Save new profile picture in DB
    await pool.execute(
      "UPDATE fullInformation SET profilePic = ? WHERE userName = ?",
      [newImageUrl, req.session.user.userName]
    );

    res.json({ success: true, imageUrl: newImageUrl });
  } catch (err) {
    console.error("❌ DB update error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ Get logged-in user's full information
router.get("/me", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT fi.id,
              fi.userName,
              fi.firstName,
              fi.lastName,
              fi.gender,
              fi.civilStatus,
              fi.dateBirth,
              fi.maiden,
              fi.phoneNo,
              fi.major,
              fi.yearStarted,
              fi.graduated,
              fi.studentNo,
              fi.profilePic,
              fi.profileConfirmed,   -- ✅ added
              r.personalEmail
       FROM fullInformation fi
       JOIN registration r ON fi.userName = r.userName
       WHERE fi.userName = ?`,
      [req.session.user.userName]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Error fetching user info:", err);
    res.status(500).json({ error: "Database error" });
  }
});







// ✅ Get profile picture (with fallback to default)
router.get("/get-profile", async (req, res) => {
  try {
    const userName = req.session?.user?.userName;
    if (!userName) return res.status(401).json({ error: "Unauthorized" });

    const [rows] = await pool.query(
      "SELECT profilePic FROM fullInformation WHERE userName = ?",
      [userName]
    );

    let profilePic = rows[0]?.profilePic || "/images/default-profile.png";
    res.json({ profilePic });
  } catch (err) {
    console.error("❌ Get profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});




// POST /api/fullInformation/confirm
router.post("/confirm", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Not logged in" });

  try {
    const [rows] = await pool.execute(
      "SELECT profilePic, profileConfirmed FROM fullInformation WHERE userName = ?",
      [req.session.user.userName]
    );

    if (!rows.length) return res.status(404).json({ error: "User not found" });

    const { profilePic, profileConfirmed } = rows[0];

    // Already confirmed → do nothing
    if (profileConfirmed) {
      return res.json({ success: true, message: "Already confirmed" });
    }

    // Must have uploaded picture first
    if (!profilePic || profilePic.includes("default-profile.png") || profilePic.includes("/images/default-profile")) {
      return res.status(400).json({ error: "You must upload a profile picture first" });
    }

    // Update DB → mark confirmed forever
    await pool.execute(
      "UPDATE fullInformation SET profileConfirmed = 1 WHERE userName = ?",
      [req.session.user.userName]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Confirm profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


router.get("/fullInformation", async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;
    const search = `%${req.query.search || ""}%`;

    // ✅ Query with correct params
    const [rows] = await pool.execute(
      `SELECT id, firstName, lastName, initial, suffix, gender, civilStatus,
              dateBirth, maiden, phoneNo, major, yearStarted, graduated,
              studentNo, profilePic
       FROM fullInformation
       WHERE firstName LIKE ? OR lastName LIKE ? OR studentNo LIKE ?
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [search, search, search, limit, offset]   // ✅ 5 params for 5 ?
    );

    // ✅ Count for pagination
    const [[{ count }]] = await pool.execute(
      `SELECT COUNT(*) as count
       FROM fullInformation
       WHERE firstName LIKE ? OR lastName LIKE ? OR studentNo LIKE ?`,
      [search, search, search]
    );

    res.json({
      rows,
      totalPages: Math.ceil(count / limit)
    });
  } catch (err) {
    console.error("❌ Error fetching fullInformation:", err);
    res.status(500).json({ error: "Database error" });
  }
});


module.exports = router;
