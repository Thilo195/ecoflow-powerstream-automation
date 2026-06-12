import { createSign, serialNo } from './ecoflow_base.js';

async function readPowerstream() {
    try {

        const signHeaders = createSign();

        const url = `https://api-e.ecoflow.com/iot-open/sign/device/quota/all?sn=${encodeURIComponent(serialNo.delta3)}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...signHeaders
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const resonseData = await response.json();
        console.log(resonseData);

        const result = {}

        console.log(result)
        
        return result

    } catch (error) {
        console.error('Fehler bei der Anfrage:', error);
    }
}

readPowerstream();
