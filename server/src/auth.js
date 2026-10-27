import jwt from 'jsonwebtoken';
export function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Login is required.' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET || 'development_secret'); next(); }
  catch { res.status(401).json({ message: 'Your session is invalid or expired.' }); }
}
export function authorizeAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  next();
}
