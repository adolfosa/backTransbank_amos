const transbankService = require('../services/transbankService');

function autoReconnectPOS() {
  const preferredPort = process.env.TBK_PORT_PATH;

  return transbankService.connectToPort(preferredPort)
    .then(port => {
      console.log(`✅ POS reconectado exitosamente en puerto preferido: ${port.path}`);
      return true;
    })
    .catch(err => {
      console.warn(`⚠️ Falló reconexión en puerto preferido (${preferredPort}): ${err.message}`);

      return transbankService.listAvailablePorts()
        .then(ports => {
          const acmPorts = ports.filter(p => p.path.includes('ACM'));

          let index = 0;

          function tryNextPort() {
            if (index >= acmPorts.length) {
              return Promise.resolve(false);
            }

            const port = acmPorts[index++];
            return transbankService.connectToPort(port.path)
              .then(() => {
                console.log(`✅ POS reconectado exitosamente en puerto alternativo: ${port.path}`);
                return true;
              })
              .catch(err => {
                console.warn(`❌ No se pudo reconectar por ${port.path}: ${err.message}`);
                return tryNextPort();
              });
          }

          return tryNextPort();
        })
        .catch(error => {
          console.error(`❌ Error listando puertos para reconexión: ${error.message}`);
          return false;
        });
    });
}

module.exports = autoReconnectPOS;