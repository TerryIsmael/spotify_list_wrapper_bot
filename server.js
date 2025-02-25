import app from './app.js'

const serverPort = app.get('serverPort');

const server = app.listen(serverPort, () => {
  console.log(`Servidor iniciado en el puerto ${serverPort}`);
});

export default server;