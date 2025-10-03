const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

module.exports = (req, res, next) => {
  // Get token from header
  const token = req.header('x-auth-token');
  
  // Check if no token
  if (!token) {
    console.log('❌ No token found in request headers for:', req.method, req.url);
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    // ✅ ADDED: Debug logging to verify user data
    console.log('✅ Token verified for user:', {
      id: req.user.id,
      role: req.user.role,
      stream: req.user.stream,
      route: req.url
    });
    
    next();
  } catch (err) {
    console.error('❌ Token verification failed:', {
      error: err.message,
      route: req.url,
      tokenPresent: !!token
    });
    
    // ✅ IMPROVED: More specific error messages
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: 'Token has expired' });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ msg: 'Invalid token' });
    } else {
      return res.status(401).json({ msg: 'Token is not valid' });
    }
  }
};