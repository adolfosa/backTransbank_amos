const transbankService = require('../services/transbankService');
const responseHandler = require('../utils/responseHandler');
const axios = require('axios');

exports.processPayment = function (req, res) {
  const amount = req.body.amount;
  const ticketNumber = req.body.ticketNumber;

  if (!amount || isNaN(amount) || amount <= 0) {
    return responseHandler.error(res, 'Monto inválido', 400, 'INVALID_AMOUNT');
  }

  if (!ticketNumber || typeof ticketNumber !== 'string') {
    return responseHandler.error(res, 'Número de ticket/boleta inválido', 400, 'INVALID_TICKET');
  }

  console.log(`Iniciando transacción - Monto: ${amount}, Ticket: ${ticketNumber}`);

  transbankService.enviarVenta(amount, ticketNumber)
    .then(result => {
      const responseCode = result && result.responseCode;
      responseHandler.success(res, 'Resultado operación', result);
    })
    .catch(error => {
      const messageLower = (error.message || '').toLowerCase();
      const isUserCancelled = messageLower.includes('cancelada') || messageLower.includes('cancelado');
      const isPosDisconnected = messageLower.includes('no se pudo conectar') || messageLower.includes('pos no conectado') || messageLower.includes('pos desconectado');

      const statusCode = isUserCancelled || isPosDisconnected ? 400 : 500;
      let errorCode = 'UNKNOWN';
      let userMessage = 'Ocurrió un problema al procesar el pago';

      if (isUserCancelled) {
        errorCode = 'USER_CANCELLED';
        userMessage = 'Transacción cancelada por el usuario';
      } else if (isPosDisconnected) {
        errorCode = 'POS_DISCONNECTED';
        userMessage = 'El POS no está conectado';
      } else if (error.responseCode) {
        errorCode = error.responseCode;
      }

      console[isUserCancelled || isPosDisconnected ? 'warn' : 'error'](
        `Transacción ${isUserCancelled ? 'cancelada' : isPosDisconnected ? 'fallida por desconexión' : 'fallida'}: ${error.message}`,
        isUserCancelled || isPosDisconnected ? undefined : { stack: error.stack }
      );

      const meta = process.env.NODE_ENV === 'development' ? {
        detail: error.message,
        stack: error.stack
      } : {};

      responseHandler.error(res, userMessage, statusCode, errorCode, meta);
    });
};

exports.processRefund = function (req, res) {
  const amount = req.body.amount;
  const originalOperationNumber = req.body.originalOperationNumber;

  if (!amount || isNaN(amount) || amount <= 0) {
    return responseHandler.error(res, 'Monto inválido', 400, 'INVALID_AMOUNT');
  }

  if (!originalOperationNumber) {
    return responseHandler.error(res, 'Número de operación original requerido', 400, 'MISSING_OPERATION_NUMBER');
  }

  console.log(`Iniciando reversa - Monto: ${amount}, Operación original: ${originalOperationNumber}`);

  transbankService.enviarVentaReversa(amount, originalOperationNumber)
    .then(result => {
      console.log(`Reversa exitosa - Operación: ${result.operationNumber}`);
      responseHandler.success(res, 'Reversa exitosa', result);
    })
    .catch(error => {
      console.error(`Error en reversa: ${error.message}`, { stack: error.stack });
      responseHandler.error(res, error.message, 500, error.responseCode || 'UNKNOWN');
    });
};
