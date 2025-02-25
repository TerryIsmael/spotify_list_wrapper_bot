import app from './app.js'

const server_port = app.get('serverPort');

const server = app.listen(server_port, () => {
  console.log(`Servidor iniciado en el puerto ${server_port}`);
});

export default server;