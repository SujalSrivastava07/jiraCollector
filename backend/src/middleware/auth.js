import jwt from 'jsonwebtoken';
import { logger } from '../services/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-dev';

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, tenantId, iat, exp }
    next();
  } catch (error) {
    logger.warn({ error: error.message }, 'Invalid JWT token');
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
