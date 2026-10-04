const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        res.status(401);
        return next(new Error('Not authorized, user not found'));
      }

      return next();
    } catch (error) {
      res.status(401);
      return next(new Error('Not authorized, token failed'));
    }
  }

  if (!token) {
    res.status(401);
    return next(new Error('Not authorized, no token'));
  }
};

const authorizeRoles = (...roles) => {
  const allowed = roles.map((role) => role.toLowerCase());
  return (req, res, next) => {
    const userRole = (req.user?.role || '').toLowerCase();
    if (!req.user || !allowed.includes(userRole)) {
      res.status(403);
      return next(
        new Error(`Access denied. Required role(s): ${roles.join(', ')}`)
      );
    }
    next();
  };
};

const authorize = (...roles) => authorizeRoles(...roles);

module.exports = { protect, authorize, authorizeRoles };
