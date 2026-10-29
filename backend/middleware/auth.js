const jwt = require('jsonwebtoken');

async function authMiddleware(req, res, next) {
  const header = req.get('authorization') || '';
  const match = /^Bearer\s+([A-Za-z0-9_.-]+)$/i.exec(header);
  if (!match) return res.status(401).json({ message: 'Authentication required' });
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    return res.status(503).json({ message: 'Authentication is not configured' });
  }
  try {
    const decoded = jwt.verify(match[1], process.env.JWT_SECRET);
    if (!decoded.userId || !Number.isInteger(decoded.authVersion) || !['patient', 'doctor', 'admin'].includes(decoded.role)) {
      return res.status(401).json({ message: 'Invalid authentication token' });
    }
    const [accounts] = await req.app.locals.pool.execute('SELECT auth_version FROM users WHERE id=? LIMIT 1', [decoded.userId]);
    if (!accounts[0] || Number(accounts[0].auth_version) !== decoded.authVersion) return res.status(401).json({ message: 'This session is no longer valid. Please sign in again.' });
    req.user = decoded;
    next();
  } catch (error) {
    if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError' || error?.name === 'NotBeforeError') {
      return res.status(401).json({ message: 'Invalid or expired authentication token' });
    }
    return next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ message: 'Insufficient permissions' });
}

function requireVerified(req, res, next) {
  if (req.user?.emailVerified !== true) {
    return res.status(403).json({ message: 'Verify your email before continuing', code: 'EMAIL_NOT_VERIFIED' });
  }
  return next();
}

module.exports = authMiddleware;
module.exports.requireRole = requireRole;
module.exports.requireVerified = requireVerified;
