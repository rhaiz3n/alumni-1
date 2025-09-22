// middleware/requireAdmin.js
function requireAdmin(req, res, next) {
  if (!req.session.user || !req.session.user.isAdmin) {
    return res.status(403).json({ error: "⛔ Forbidden: Admins only" });
  }
  next();
}

module.exports = requireAdmin;