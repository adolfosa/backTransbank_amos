const { POSAutoservicio } = require('transbank-pos-sdk');
const autoReconnectPOS = require('../utils/posReconnect');

function padTicket(input) {
  return input.padEnd(20, '0').substring(0, 20);
}

class TransbankService {
  constructor() {
    this.pos = new POSAutoservicio();
    this.connectedPort = null;
    this.pos.setDebug(false);
  }

connectToPort(portPath) {
  return this.pos.connect(portPath).then(response => {
    this.connectedPort = { path: portPath };
    // Copiamos manualmente las propiedades de response a connectedPort
    for (const key in response) {
      if (response.hasOwnProperty(key)) {
        this.connectedPort[key] = response[key];
      }
    }
    console.log(`Conectado manualmente al puerto ${portPath}`);
    return response;
  });
}

  listAvailablePorts() {
    return this.pos.listPorts().then(ports =>
      ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer || 'Desconocido'
      }))
    );
  }

  enviarVenta(amount, ticketNumber) {
    const self = this;

    function attemptVenta() {
      const ticket = padTicket(ticketNumber);
      return self.pos.sale(amount, ticket).then(response => {
        console.log(`Venta enviada - Operación: ${response.operationNumber}`);
        return response;
      });
    }

    if (!this.deviceConnected) {
      console.warn('POS desconectado al intentar enviar venta. Intentando reconexión previa...');
      return autoReconnectPOS().then(reconnected => {
        if (!reconnected) throw new Error('No se pudo reconectar al POS');
        return attemptVenta();
      }).catch(err => {
        console.error('Error durante la venta (reconexión):', err);
        throw err;
      });
    }

    return attemptVenta().catch(error => {
      const mensaje = error.message || '';
      const pendiente = mensaje.includes('still waiting for a response');
      const timeout = mensaje.includes('not been received');

      if (pendiente || timeout) {
        console.warn('⚠️ Estado bloqueado por transacción anterior. Reiniciando conexión...');
        return this.closeConnection().then(() => autoReconnectPOS());
      }

      console.error('Error durante la venta:', error);
      throw error;
    });
  }

  enviarVentaReversa(amount, originalOperationNumber) {
    const ticket = padTicket(originalOperationNumber);
    return this.pos.refund(amount, ticket, false).then(response => {
      console.log(`Reversa exitosa - Operación: ${response.operationNumber}`);
      return response;
    }).catch(error => {
      console.error('Error durante la reversa:', error);
      throw error;
    });
  }

  getLastTransaction() {
    return this.pos.getLastSale().then(response => {
      return {
        success: true,
        message: 'Transacción obtenida correctamente',
        data: {
          approved: response.successful,
          responseCode: response.responseCode === 0 ? '00' : 'UNKNOWN',
          operationNumber: response.operationNumber,
          amount: response.amount,
          cardNumber: response.last4Digits ? `••••${response.last4Digits}` : null,
          authorizationCode: response.authorizationCode,
          timestamp: response.realDate && response.realTime
            ? `${response.realDate} ${response.realTime}` : null,
          cardType: response.cardType,
          cardBrand: response.cardBrand,
          rawData: response
        }
      };
    }).catch(error => {
      console.error('Error al obtener última transacción:', error);
      throw error;
    });
  }

  sendCloseCommand(printReport) {
    return this.pos.closeDay({ printOnPos: printReport }, false).then(response => {
      console.log('Cierre de terminal exitoso');
      return response;
    }).catch(error => {
      console.error('Error durante el cierre de terminal:', error);
      throw error;
    });
  }

  loadKey() {
    return this.pos.loadKeys().then(() => {
      console.log('Inicialización del terminal completada (llaves cargadas)');
      return { success: true, message: 'Llaves cargadas correctamente' };
    }).catch(error => {
      console.error('Error al inicializar terminal (cargar llaves):', error);
      throw error;
    });
  }

  closeConnection() {
    if (this.connectedPort) {
      return this.pos.disconnect().then(() => {
        console.log('Conexión con POS cerrada correctamente');
        this.connectedPort = null;
      }).catch(error => {
        console.error('Error al cerrar conexión con POS:', error.message);
        this.connectedPort = null;
      });
    } else {
      console.warn('No hay conexión activa que cerrar');
      return Promise.resolve();
    }
  }

  get deviceConnected() {
    return this.connectedPort !== null;
  }

  get connection() {
    return this.connectedPort;
  }
}

module.exports = new TransbankService();
