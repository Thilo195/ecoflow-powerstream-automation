import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PID } from './src/logic/pid_controller.js';
import { SerialDataSource } from './src/hardware/serial_data_source.js';
import { EcoflowMQTT } from './src/services/ecoflow_mqtt.js';
import { EcoflowBLE } from './src/services/ecoflow_ble.js';
import { startServer } from './src/web/webserver.js';
import { logToInflux } from './src/db/influx_logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });



const TARGET_SETPOINT = -50;

const pidController = new PID({
    kp: 0.4,
    ki: 0.3,
    kd: 0.05,
    outputMin: 0,
    outputMax: 800,
});

const ecoflowMQTT = new EcoflowMQTT();
const ecoflowBLE = new EcoflowBLE();

await ecoflowMQTT.connect();
await ecoflowBLE.connect();

const dataSource = new SerialDataSource();

let latestData = {
    smartMeter: {},
    ecoflowTargetWatts: 0,
    targetSetpoint: TARGET_SETPOINT,
    ecoflow: {
        battery_soc: 0,
        pv_power_w: 0
    }
};

dataSource.initialize(metric => {
    if (metric) {
        latestData.smartMeter = metric;
        
        if (ecoflowMQTT && ecoflowMQTT.isConnected) {
            latestData.ecoflow.battery_soc = ecoflowMQTT.batterySoc || 0;
            latestData.ecoflow.pv_power_w = ecoflowMQTT.pvPower || 0;
        }
        
        if (metric.current_power_w !== undefined) {
            try {
                const actualValue = metric.current_power_w;

                const controlOutput = pidController.update(TARGET_SETPOINT, -actualValue);
                
                latestData.ecoflowTargetWatts = controlOutput;
                console.log(`Time: ${new Date().toISOString()} | Grid: ${actualValue.toFixed(2)}W --> Ecoflow Target: ${controlOutput.toFixed(2)}W`);

                if (ecoflowBLE && ecoflowBLE.isConnected) {
                    ecoflowBLE.setWatts(controlOutput);
                }

                logToInflux(metric, controlOutput, latestData.ecoflow);
            }
            catch (ex) {
            }
        }
    }
});

const port = process.env.PORT || 8080;
startServer(port, () => latestData);