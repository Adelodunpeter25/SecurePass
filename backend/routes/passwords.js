const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

async function passwordRoutes(fastify, options) {
  fastify.get('/:domain', { preHandler: authenticate }, async (request, reply) => {
    const { domain } = request.params;
    const { userId } = request.user;
    
    try {
      const password = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM passwords WHERE user_id = ? AND website = ?',
          [userId, domain],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      
      if (!password) {
        reply.code(404).send({ error: 'No credentials found' });
        return;
      }
      
      reply.send(password);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch credentials' });
    }
  });

  fastify.post('/', { preHandler: authenticate }, async (request, reply) => {
    const { website, username, password_blob } = request.body;
    const { userId } = request.user;
    
    try {
      const passwordId = uuidv4();
      
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO passwords (id, user_id, website, username, password_blob) VALUES (?, ?, ?, ?, ?)',
          [passwordId, userId, website, username, password_blob],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      
      reply.send({ success: true, id: passwordId });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to save password' });
    }
  });

  fastify.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user;
    
    try {
      const passwords = await new Promise((resolve, reject) => {
        db.all(
          'SELECT id, website, username, created_at, updated_at FROM passwords WHERE user_id = ? ORDER BY updated_at DESC',
          [userId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });
      
      reply.send(passwords);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch passwords' });
    }
  });

  fastify.put('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const { website, username, password_blob } = request.body;
    const { userId } = request.user;
    
    try {
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE passwords SET website = ?, username = ?, password_blob = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
          [website, username, password_blob, id, userId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      
      reply.send({ success: true });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to update password' });
    }
  });

  fastify.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const { userId } = request.user;
    
    try {
      await new Promise((resolve, reject) => {
        db.run(
          'DELETE FROM passwords WHERE id = ? AND user_id = ?',
          [id, userId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      
      reply.send({ success: true });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to delete password' });
    }
  });
}

module.exports = passwordRoutes;
