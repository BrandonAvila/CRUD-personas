// Punto de entrada para ejecución local: carga .env y levanta el servidor HTTP.
require('dotenv').config();

const app = require('./app');

const puerto = Number(process.env.PORT || 3001);

app.listen(puerto, () => {
  console.log(`Microservicio CRUD escuchando en http://localhost:${puerto}`);
});
