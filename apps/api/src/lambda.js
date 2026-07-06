// Punto de entrada para AWS Lambda (integración proxy con API Gateway).
// Handler a configurar en la función Lambda: src/lambda.handler
// La conexión a RDS se configura con variables de entorno de la Lambda
// (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_POOL_SIZE); aquí no se usa .env.
const serverless = require('serverless-http');
const app = require('./app');

module.exports.handler = serverless(app);
