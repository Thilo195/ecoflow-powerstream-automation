import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

export let latestMetrics = {};

export class SerialDataSource {
    initialize(callback = null) {
        const port = new SerialPort({
            path: '/dev/serial0',
            baudRate: 9600,
            dataBits: 7,
            parity: 'even',
            stopBits: 1
        });

        const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

        let metrics = {};

        parser.on('data', (line) => {
            // Current power (Watts)
            if (line.includes('1-0:16.7.0')) {
                metrics.current_power_w = this.extractValue(line);
            }
            // Total consumption (kWh) -> 1.8.0 or 1.8.1
            if (line.includes('1-0:1.8.0') || line.includes('1-0:1.8.1')) {
                metrics.total_consumption_kwh = this.extractValue(line);
            }
            // Total grid delivery/export (kWh) -> 2.8.0
            if (line.includes('1-0:2.8.0')) {
                metrics.total_delivery_kwh = this.extractValue(line);
            }
            if (line.includes('1-0:36.7.0')) {
                metrics.power_L1_w = this.extractValue(line);
            }
            if (line.includes('1-0:56.7.0')) {
                metrics.power_L2_w = this.extractValue(line);
            }
            else if (line.includes('1-0:76.7.0')) {
                metrics.power_L3_w = this.extractValue(line);
            }
            else if (line.includes('1-0:0.0.9') || line.includes('0.0.0') || line.includes('C.1.0')) {
                const serial = this.extractStringValue(line);
                if (serial) metrics.serial_number = serial;
            }

            // exclamation mark indicates end of data block
            if (line.includes("!")) {
                if (callback != null) callback(metrics);
                metrics = {};
            }
        });

        port.on('error', (err) => {
            console.error('Serial Port Error: ', err.message);
        });
    }

    extractStringValue(line) {
        try {
            const regex = /\((.*?)\)/;
            const match = line.match(regex);

            if (match && match[1]) {
                return match[1].split('*')[0].trim();
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    extractValue(line) {
        try {
            const regex = /\((.*?)\*/;
            const match = line.match(regex);

            if (match && match[1]) {
                return parseFloat(match[1]);
            }
            return null;
        } catch (e) {
            return null;
        }
    }
}