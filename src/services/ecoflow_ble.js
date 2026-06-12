import noble from '@abandonware/noble';

export class EcoflowBLE {
     constructor() {
        this.isConnected = false;
        this.powerstreamPeripheral = null;
        this.txCharacteristic = null; 
        
        this.batterySoc = 0;
        this.pv1 = 0;
        this.pv2 = 0;
        
        this.rxBuffer = Buffer.alloc(0);
    }

    get pvPower() {
        return this.pv1 + this.pv2;
    }

   async connect() {
        console.log('[EcoFlow BLE] Start Bluetooth-Subsystem...');

        if (noble.state === 'poweredOn') {
            console.log('[EcoFlow BLE] Bluetooth Rasp already active. Searching for PowerStream...');
            noble.startScanning([], true);
        }

        noble.on('stateChange', (state) => {
            if (state === 'poweredOn') {
                console.log('[EcoFlow BLE] Bluetooth Rasp activated. Searching for PowerStream...');
                noble.startScanning([], true);
            } else {
                console.warn('[EcoFlow BLE] Bluetooth-Hardware is deactivated!');
                noble.stopScanning();
            }
        });

        noble.on('discover', (peripheral) => {
            const name = peripheral.advertisement.localName;
            
            if (name && (name.includes('PowerStream') || name.includes('HW511'))) {
                console.log(`[EcoFlow BLE] PowerStream found! Name: ${name}, MAC: ${peripheral.address}`);
                noble.stopScanning();
                this.powerstreamPeripheral = peripheral;
                this.setupDevice(peripheral);
            }
        });
    }

   

    setupDevice(peripheral) {
        peripheral.connect((error) => {
            if (error) {
                console.error('[EcoFlow BLE] Connection failed:', error);
                return;
            }
            
            this.isConnected = true;
            console.log('[EcoFlow BLE] Direct connection via Bluetooth established.');

            peripheral.discoverAllServicesAndCharacteristics((err, services, characteristics) => {
                if (err) return console.error(err);
                
                const targetChar = characteristics.find(c => 
                    c.uuid.toLowerCase().includes('ffd1') || 
                    c.properties.includes('write') || 
                    c.properties.includes('writeWithoutResponse')
                );

                if (!targetChar) {
                    console.error('[EcoFlow BLE] Error: Direct write characteristic not found.');
                    return;
                }

                this.txCharacteristic = targetChar;
                console.log('[EcoFlow BLE] Datachannel ready. Zero loss activated.');

                this.txCharacteristic.subscribe((err) => {
                    if (err) console.error('Subscribe Error', err);
                });

                this.txCharacteristic.on('data', (data) => {
                    this.parseIncomingData(data);
                });
            });
        });

        peripheral.on('disconnect', () => {
            console.warn('[EcoFlow BLE] Connection lost...');
            this.isConnected = false;
            noble.startScanning([], true);
        });
    }

  setWatts(watts) {
        if (!this.isConnected || !this.txCharacteristic) {
            // Silently return to prevent log spam while searching for the device
            return;
        }

        const cleanWatts = Math.max(0, Math.min(800, watts));
        const ecoWatts = Math.round(cleanWatts * 10);
        
        const header = Buffer.from([0xaa, 0x02, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
        const payload = Buffer.from([0x08, 0x20, 0x10, ecoWatts & 0xFF, (ecoWatts >> 8) & 0xFF]);
        const buffer = Buffer.concat([header, payload]);
        
        console.log(`[EcoFlow BLE] Set new target (${cleanWatts}W sent to PowerStream)`);

        this.txCharacteristic.write(buffer, true, (err) => {
            if (err) {
                console.error(`[EcoFlow BLE] Error: Message could not be delivered: ${err.message}`);
            } else {
                console.log(`[EcoFlow BLE] Successfully transmitted ${cleanWatts}W message.`);
            }
        });
    }

    parseIncomingData(buffer) {
        // 1. Sammle alle ankommenden BLE-Schnipsel im großen Puffer
        this.rxBuffer = Buffer.concat([this.rxBuffer, buffer]);

        // Verhindere, dass der Puffer bei Fehlern unendlich wächst (max 2048 Bytes)
        if (this.rxBuffer.length > 2048) {
            this.rxBuffer = this.rxBuffer.slice(this.rxBuffer.length - 1024);
        }

        try {
            // 2. Suche nach dem Start-Header (0xAA 0x02) im Puffer
            for (let i = 0; i < this.rxBuffer.length - 18; i++) {
                if (this.rxBuffer[i] === 0xaa && this.rxBuffer[i+1] === 0x02) {
                    
                    // Die Gesamtlänge der Nutzdaten steht in Byte 2 und 3
                    const payloadLength = this.rxBuffer.readUInt16LE(i + 2);
                    const packetLength = payloadLength + 18; // Header + Payload + Checksum

                    // 3. Warten, bis das fragmentierte Paket VOLLSTÄNDIG angekommen ist
                    if (this.rxBuffer.length >= i + packetLength) {
                        const packet = this.rxBuffer.slice(i, i + packetLength);
                        const cmdFunc = packet[12];

                        // 4. Nur Telemetrie-Pakete auswerten
                        if (cmdFunc === 0x20 || cmdFunc === 0x02) {
                            const payload = packet.slice(16, 16 + payloadLength);
                            
                            // Sichere Suche nach Batterie-Wert im gültigen Payload
                            for (let j = 0; j < payload.length - 2; j++) {
                                if (payload[j] === 0x3a && payload[j+1] === 0x01) {
                                    const soc = payload[j+2];
                                    if (soc >= 0 && soc <= 100) {
                                        this.batterySoc = soc;
                                    }
                                }
                            }
                        }

                        // Das fertig verarbeitete Paket aus dem Puffer löschen
                        this.rxBuffer = this.rxBuffer.slice(i + packetLength);
                        i = -1; // Schleife von vorne starten
                    }
                }
            }
        } catch (e) {
            console.error('[EcoFlow BLE] Parser error:', e.message);
        }
    }
}