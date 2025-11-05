const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');

async function authRoutes(fastify, options) {
  fastify.post('/register', async (request, reply) => {
    const { name, email, password } = request.body;
    
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();
      
      await pool.query(
        'INSERT INTO users (id, name, email, password_hash, created_at) VALUES ($1, $2, $3, $4, NOW())',
        [userId, name, email, hashedPassword]
      );
      
      const token = jwt.sign({ userId, email, name }, JWT_SECRET);
      reply.send({ token, userId, name });
    } catch (error) {
      reply.code(400).send({ error: 'Registration failed' });
    }
  });

  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body;
    
    try {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];
      
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
}

module.exports = authRoutes;
