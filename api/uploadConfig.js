// api/uploadConfig.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// 1. Image upload
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images allowed"), false);
    }
    cb(null, true);
  }
});

// 2. Excel upload
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel"
    ) cb(null, true);
    else cb(new Error("Only Excel files allowed"), false);
  }
});

// 3. Resume upload
const resumeUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/resumes"),
    filename: (req, file, cb) => {
      const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, unique + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/msword" ||
      file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) cb(null, true);
    else cb(new Error("Only PDF, DOC, DOCX allowed"), false);
  }
});

// ✅ Profile picture upload
const profilePicsDir = path.join(__dirname, "../public/uploads/profilePics");
fs.mkdirSync(profilePicsDir, { recursive: true });

const profilePicUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, profilePicsDir),
    filename: (req, file, cb) => {
      const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, unique + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only images allowed"), false);
    cb(null, true);
  }
});

// ✅ Company logo upload
const companyLogosDir = path.join(__dirname, "../public/uploads/companyLogos");
fs.mkdirSync(companyLogosDir, { recursive: true });

const logoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, companyLogosDir),
    filename: (req, file, cb) => {
      const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, unique + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only images allowed"), false);
    cb(null, true);
  }
});


module.exports = { imageUpload, excelUpload, resumeUpload, profilePicUpload, logoUpload};
