const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

async function authenticate(request, reply) {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      reply.code(401).send({ error: 'No token provided' });
      return;
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    request.user = decoded;
  } catch (error) {
    reply.code(401).send({ error: 'Invalid token' });
  }
}

module.exports = { authenticate, JWT_SECRET };
