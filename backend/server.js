const fastify = require('fastify')({ logger: true });

// Register CORS
fastify.register(require('@fastify/cors'), {
  origin: true
});

// Register routes
fastify.register(require('./routes/auth'), { prefix: '/api' });
fastify.register(require('./routes/passwords'), { prefix: '/api/passwords' });

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('SecurePass API server running on port 3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
