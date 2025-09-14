// api/profileRoutes.js
const express = require("express");
const router = express.Router();
const { profilePicUpload } = require("./uploadConfig");
const pool = require('../db/mysql');

// ✅ Upload profile picture
router.post("/upload-picture", profilePicUpload.single("profilePic"), async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not logged in" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const imageUrl = "/uploads/profilePics/" + req.file.filename;

  try {
    await pool.execute(
      "UPDATE registration SET profilePic = ? WHERE id = ?",
      [imageUrl, req.session.userId]
    );

    res.json({ success: true, imageUrl });
  } catch (err) {
    console.error("❌ DB update error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Get logged-in user info
router.get("/fullInformation/me", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not logged in" });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT id, userName, firstName, lastName, gender, civilStatus,
              dateBirth, maiden, phoneNo, major, yearStarted, graduated, studentNo, profilePic
      FROM fullInformation
      WHERE id = ?`,
      [req.session.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ DB error at /api/fullInformation/me:", err);
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


// Get logged-in user's full information
router.get("/me", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not logged in" });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT firstName, lastName, userName, personalEmail, gender, civilStatus, dateBirth, phoneNo, major, yearStarted, graduated, studentNo, profilePic 
       FROM registration 
       WHERE id = ?`,
      [req.session.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Error fetching user info:", err);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
