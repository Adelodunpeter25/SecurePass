const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

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
      
      const token = jwt.sign({ userId, email, name }, JWT_SECRET);
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
      
      const token = jwt.sign({ userId: user.id, email: user.email, name: user.name }, JWT_SECRET);
      reply.send({ token, userId: user.id, name: user.name });
    } catch (error) {
      reply.code(400).send({ error: 'Login failed' });
    }
  });

  fastify.get('/verify', { preHandler: authenticate }, async (request, reply) => {
    reply.send({
      email: request.user.email,
      name: request.user.name
    });
  });
}

module.exports = authRoutes;
