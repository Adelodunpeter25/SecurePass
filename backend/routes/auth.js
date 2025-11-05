const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

async function createSession(userId, token) {
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [sessionId, userId, token, expiresAt.toISOString()],
      function(err) {
        if (err) reject(err);
        else resolve(sessionId);
      }
    );
  });
}

async function authRoutes(fastify, options) {
  fastify.post('/register', async (request, reply) => {
    const { name, email, password } = request.body;
    
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();
      
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
          [userId, name, email, hashedPassword],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      
      const token = jwt.sign({ userId, email, name }, JWT_SECRET, { expiresIn: '30d' });
      await createSession(userId, token);
      
      reply.send({ token, userId, name });
    } catch (error) {
      reply.code(400).send({ error: 'Registration failed' });
    }
  });

  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body;
    
    try {
      const user = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      if (!user || !await bcrypt.compare(password, user.password_hash)) {
        reply.code(401).send({ error: 'Invalid credentials' });
        return;
      }
      
      const token = jwt.sign({ userId: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
      await createSession(user.id, token);
      
      reply.send({ token, userId: user.id, name: user.name });
    } catch (error) {
      reply.code(400).send({ error: 'Login failed' });
    }
  });

  fastify.get('/verify', { preHandler: authenticate }, async (request, reply) => {
    // Check if session exists in database
    const session = await new Promise((resolve, reject) => {
      db.get(
        'SELECT s.*, u.name, u.email FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.user_id = ? AND s.expires_at > datetime("now")',
        [request.user.userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!session) {
      reply.code(401).send({ error: 'Session expired' });
      return;
    }

    reply.send({
      email: session.email,
      name: session.name
    });
  });

  fastify.post('/logout', { preHandler: authenticate }, async (request, reply) => {
    // Delete session from database
    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM sessions WHERE user_id = ?',
        [request.user.userId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    reply.send({ success: true });
  });
}

module.exports = authRoutes;
