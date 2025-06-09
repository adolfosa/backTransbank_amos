Instrucciones de instalación y configuración Debian 8 en AMOS

---------------------------------------------------------------------------------------------------

1. Iniciar instalación desde el USB booteable

    - Inserta el pendrive con Debian 8 booteable con el AMOS apagado.
    - Enciende el AMOS mientras presionas la tecla Supr (o Del) para ingresar al BIOS.
    - Establece el pendrive como primera prioridad de booteo.
    - Guarda y reinicia.

---------------------------------------------------------------------------------------------------

2. Instalar Debian 8 desde interfaz gráfica

    - Selecciona la opción de instalación gráfica (ya que por consola puede fallar por componentes desactualizados).
    - Durante la instalación:
        - Crea el usuario root con contraseña: wit321.
        - Crea un usuario común:
            - Usuario: wit
            - Contraseña: wit321

---------------------------------------------------------------------------------------------------

3. Instalar Node.js desde segundo pendrive

    - Al finalizar la instalación, apaga el equipo.
    - Retira el pendrive de instalación.
    - Inserta el pendrive que contiene Node.js 10.24.1.

---------------------------------------------------------------------------------------------------

4. Copiar y extraer Node.js

    4.1 Copia el archivo node-v10.24.1-linux-x64.tar.gz al escritorio del usuario wit.
    4.2 Abre una terminal y ejecuta:

        cd ~/Escritorio
        tar -xzf node-v10.24.1-linux-x64.tar.gz
        su
        mv node-v10.24.1-linux-x64 /opt/
        exit

---------------------------------------------------------------------------------------------------

5. Agregar Node.js al PATH

    5.1 Desde el usuario común (wit), abre .bashrc:

        nano ~/.bashrc

    5.2 Agrega al final del archivo:

        export PATH=/opt/node-v10.24.1-linux-x64/bin:$PATH

    5.3 Guarda y cierra:

        Ctrl + O → Enter
        Ctrl + X

    5.4 Actualiza el entorno:

        source ~/.bashrc

---------------------------------------------------------------------------------------------------

6. Verificar instalación:

    node -v
    npm -v

---------------------------------------------------------------------------------------------------

Extras: Habilitar compilación de módulos nativos en Debian 8

1. Configurar repositorios viejos:

    su
    nano /etc/apt/sources.list

1.2 Reemplaza el contenido por:

    deb http://archive.debian.org/debian jessie main contrib non-free
    deb http://archive.debian.org/debian-security jessie/updates main contrib non-free

1.3 Guarda y cierra. Luego ejecuta:

    echo 'Acquire::Check-Valid-Until "false";' > /etc/apt/apt.conf.d/99no-check-valid-until
    echo 'APT::Get::AllowUnauthenticated "true";' > /etc/apt/apt.conf.d/99insecure-repo
    echo 'Acquire::AllowInsecureRepositories "true";' >> /etc/apt/apt.conf.d/99insecure-repo

    rm -rf /var/lib/apt/lists/*
    apt-get clean
    apt-get update

2. Instalar herramientas básicas (sin firmar):

    apt-get install make python --allow-unauthenticated

3. Instalar compiladores manualmente:

    mkdir ~/gcc-install && cd ~/gcc-install

    wget http://archive.debian.org/debian/pool/main/g/gcc-4.9/gcc-4.9_4.9.2-10_amd64.deb
    wget http://archive.debian.org/debian/pool/main/g/gcc-defaults/gcc_4.9.2-10_amd64.deb
    wget http://archive.debian.org/debian/pool/main/g/g++-4.9/g++-4.9.2-10_amd64.deb
    wget http://archive.debian.org/debian/pool/main/g/gcc-defaults/g++_4.9.2-10_amd64.deb

    dpkg -i *.deb

    apt-get install gcc g++ --allow-unauthenticated

3.2 Verificar que todo funcione:

    make --version
    gcc --version
    g++ --version
    python --version

---------------------------------------------------------------------------------------------------

Habilitar puertos usb de manera permanente:

    nano /etc/udev/rules.d/99-acm-permisos.rules

    dentro pegar esto:

        KERNEL=="ttyACM[0-1]", MODE="0777"

    actualizar rules:

        udevadm control --reload-rules
        udevadm trigger

    verificar con:

        su
        ls -l /dev/ttyACM*
        exit

    reiniciar pc

---------------------------------------------------------------------------------------------------

Listo para instalar dependencias nativas:

    cd ~/Escritorio/backTransbank_old
    npm install

---------------------------------------------------------------------------------------------------

1. Instalar y usar PM2 (versión compatible)

    npm install -g pm2@2.10.4

2. Verificar que funcione:

    pm2 -v

3. Iniciar el servidor con PM2:

    Ubícate en el directorio del servidor:

        cd ~/Escritorio/backTransbank_old/src
        pm2 start server.js --name servidor-1
        pm2 list

4. Guardar server:

    pm2 save
    pm2 startup

    copiar y pegar el comando que se entrega.

4. (opcional) Matar servidor:

    pm2 stop servidor-1
    pm2 delete servidor-1
    pm2 list


