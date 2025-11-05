const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

async function passwordRoutes(fastify, options) {
  fastify.get('/:domain', { preHandler: authenticate }, async (request, reply) => {
    const { domain } = request.params;
    const { userId } = request.user;
    
    try {
      const result = await pool.query(
        'SELECT * FROM passwords WHERE user_id = $1 AND website = $2',
        [userId, domain]
      );
      
      if (result.rows.length === 0) {
        reply.code(404).send({ error: 'No credentials found' });
        return;
      }
      
      reply.send(result.rows[0]);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch credentials' });
    }
  });

  fastify.post('/', { preHandler: authenticate }, async (request, reply) => {
    const { website, username, password_blob } = request.body;
    const { userId } = request.user;
    
    try {
      const passwordId = uuidv4();
      
      await pool.query(
        'INSERT INTO passwords (id, user_id, website, username, password_blob, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
        [passwordId, userId, website, username, password_blob]
      );
      
      reply.send({ success: true, id: passwordId });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to save password' });
    }
  });

  fastify.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user;
    
    try {
      const result = await pool.query(
        'SELECT id, website, username, created_at, updated_at FROM passwords WHERE user_id = $1 ORDER BY updated_at DESC',
        [userId]
      );
      
      reply.send(result.rows);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch passwords' });
    }
  });
}

module.exports = passwordRoutes;
