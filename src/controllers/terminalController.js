const transbankService = require('../services/transbankService');
const responseHandler = require('../utils/responseHandler');
const autoReconnectPOS = require('../utils/posReconnect');

const POLLING_INTERVAL_MS = 600000; // 10 minutos

let monitorActive = false;

function startPOSMonitor() {
  if (monitorActive) return;
  monitorActive = true;

  setInterval(function () {
    if (!transbankService.deviceConnected) {
      autoReconnectPOS().catch(() => {});
    }
  }, POLLING_INTERVAL_MS);
}

exports.startPOSMonitor = startPOSMonitor;

exports.startHealthMonitor = function (req, res) {
  try {
    startPOSMonitor();
    responseHandler.success(res, 'Monitor de salud del POS iniciado');
  } catch (error) {
    console.error('Error al iniciar monitor de salud:', error);
    responseHandler.error(res, error.message, 500, 'MONITOR_START_ERROR');
  }
};

exports.closeTerminal = function (req, res) {
  const printReport = req.body.printReport !== false;

  transbankService.sendCloseCommand(printReport)
    .then(result => {
      responseHandler.success(res, 'Cierre de terminal exitoso', result);
    })
    .catch(error => {
      console.error('Error en cierre de terminal:', error);
      responseHandler.error(res, error.message, 500, error.responseCode || 'UNKNOWN');
    });
};

exports.loadKey = function (req, res) {
  transbankService.loadKey()
    .then(result => {
      responseHandler.success(res, 'Inicialización del terminal completada', result);
    })
    .catch(error => {
      console.error('Error inicializando terminal:', error);
      responseHandler.error(res, error.message, 500, error.responseCode || 'UNKNOWN');
    });
};

exports.getLastTransaction = function (req, res) {
  transbankService.getLastTransaction()
    .then(result => {
      responseHandler.success(res, result.message, result.data);
    })
    .catch(error => {
      console.error('Error:', error);
      responseHandler.error(res, 'Error al obtener la transacción', 500);
    });
};

exports.listPorts = function (req, res) {
  transbankService.listAvailablePorts()
    .then(ports => {
      responseHandler.success(res, 'Puertos disponibles', ports);
    })
    .catch(error => {
      console.error('Error al listar puertos:', error);
      responseHandler.error(res, error.message, 500, 'PORTS_LIST_ERROR');
    });
};

exports.conectarPuerto = function (req, res) {
  const portPath = req.body.portPath || process.env.TBK_PORT_PATH;

  if (!portPath) {
    return responseHandler.error(res, 'Debe proporcionar un puerto válido', 400, 'MISSING_PORT');
  }

  let cerrar = Promise.resolve();
  if (transbankService.deviceConnected) {
    cerrar = transbankService.closeConnection();
  }

  cerrar
    .then(() => transbankService.connectToPort(portPath))
    .then(result => {
      responseHandler.success(res, `Conectado al puerto ${portPath}`, result);
    })
    .catch(error => {
      console.error('Error al conectar al puerto:', error);

      let errorCode = 'PORT_CONNECT_ERROR';
      let userMessage = error.message;

      if (error.message.includes('permission denied')) {
        errorCode = 'PORT_PERMISSION_DENIED';
        userMessage = 'Error de permisos en el puerto. Contacte al administrador';
      } else if (error.message.includes('not found')) {
        errorCode = 'PORT_NOT_FOUND';
        userMessage = 'Puerto no encontrado. Verifique la conexión física del POS';
      }

      responseHandler.error(res, userMessage, 500, errorCode);
    });
};

exports.statusPos = function (req, res) {
  try {
    responseHandler.success(res, 'Estado del POS', {
      connected: transbankService.deviceConnected,
      port: transbankService.connection ? transbankService.connection.path : null
    });
  } catch (error) {
    console.error('Error al obtener estado de conexión:', error);
    responseHandler.error(res, error.message, 500, 'STATUS_ERROR');
  }
};

exports.autoReconnectPOS = autoReconnectPOS;