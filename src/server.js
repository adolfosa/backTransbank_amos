require('dotenv').config();
const app = require('./app');
const transbankService = require('./services/transbankService');
const terminalController = require('./controllers/terminalController');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ENV = process.env.NODE_ENV || 'development';
const MAX_RETRIES = process.env.TBK_CONNECTION_RETRIES || 10;
const RETRY_DELAY = process.env.TBK_RETRY_DELAY_MS || 5000; // 5 segundos

function connectToPOS() {
  let attempt = 0;
  let connected = false;

  function tryConnect(resolve, reject) {
    if (attempt >= MAX_RETRIES || connected) {
      if (!connected) {
        console.error(`❌ No se pudo conectar a ningún puerto POS después de ${MAX_RETRIES} intentos`);
        return resolve(false);
      }
      return resolve(true);
    }

    attempt++;
    console.log(`Intento ${attempt} de conexión al POS...`);

    transbankService.closeConnection().catch(() => {}).then(() => {
      const preferredPort = process.env.TBK_PORT_PATH;

      transbankService.connectToPort(preferredPort).then(() => {
        console.log(`POS conectado a puerto preferido: ${preferredPort}`);
        connected = true;
        return transbankService.loadKey()
          .then(() => {
            console.log('🔐 Llaves cargadas exitosamente');
            return terminalController.startPOSMonitor();
          })
          .then(() => resolve(true));
      }).catch((initialError) => {
        console.warn(`No se pudo conectar a puerto preferido (${preferredPort}): ${initialError.message}`);

        transbankService.listAvailablePorts().then((allPorts) => {
          const acmPorts = allPorts.filter(p => p.path.includes('ACM'));
          let index = 0;

          function tryNextPort() {
            if (index >= acmPorts.length || connected) {
              if (!connected) {
                if (attempt < MAX_RETRIES) {
                  console.log(`Reintentando en ${RETRY_DELAY / 1000} segundos...`);
                  setTimeout(() => tryConnect(resolve, reject), RETRY_DELAY);
                } else {
                  resolve(false);
                }
              }
              return;
            }

            const port = acmPorts[index++];
            if (port.path === preferredPort) {
              return tryNextPort();
            }

            transbankService.connectToPort(port.path).then(() => {
              console.log(`POS conectado a puerto alternativo: ${port.path}`);
              connected = true;
              return transbankService.loadKey()
                .then(() => {
                  console.log('🔐 Llaves cargadas exitosamente');
                  return terminalController.startPOSMonitor();
                })
                .then(() => resolve(true));
            }).catch((err) => {
              console.warn(`Falló conexión a ${port.path}: ${err.message}`);
              tryNextPort();
            });
          }

          tryNextPort();
        }).catch((err) => {
          console.error(`Error al listar puertos: ${err.message}`);
          if (attempt < MAX_RETRIES) {
            setTimeout(() => tryConnect(resolve, reject), RETRY_DELAY);
          } else {
            resolve(false);
          }
        });
      });
    }).catch((err) => {
      console.error(`Error en intento ${attempt}: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        setTimeout(() => tryConnect(resolve, reject), RETRY_DELAY);
      } else {
        resolve(false);
      }
    });
  }

  return new Promise(tryConnect);
}

function startServer() {
  console.log(`Iniciando servidor en modo ${ENV}`);

  const sslOptions = {
    key: fs.readFileSync(path.resolve(__dirname, '../ssl/key.pem')),
    cert: fs.readFileSync(path.resolve(__dirname, '../ssl/cert.pem'))
  };

  const server = https.createServer(sslOptions, app).listen(PORT, () => {
    console.log(`Servidor Transbank POS con SSL escuchando en https://localhost:${PORT}`);

    connectToPOS().then(() => {
      console.log('Proceso de conexión al POS finalizado');
    });
  });

  function gracefulShutdown(signal) {
    console.log(`Recibida señal ${signal}. Cerrando servidor...`);

    Promise.race([
      new Promise(resolve => server.close(resolve)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout cerrando servidor')), 5000))
    ]).then(() => {
      console.log('Servidor HTTPS cerrado');
      return transbankService.closeConnection();
    }).then(() => {
      console.log('Conexión con POS cerrada correctamente');
      process.exit(0);
    }).catch((err) => {
      console.error('Error durante el shutdown:', err.message);
      process.exit(1);
    });
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    if (error.message.includes('POS') || error.message.includes('serialport')) {
      transbankService.closeConnection();
    }
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
}

startServer();