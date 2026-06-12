import crypto from 'node:crypto';

export const serialNo = {
    powerstream: process.env.POWERSTREAM_SERIAL,
    delta3: process.env.DELTA3_SERIAL
};

export function createSign(bodyPart = '') {
    const accessKey = process.env.ECOFLOW_ACCESS_KEY;
    const secretKey = process.env.ECOFLOW_SECRET_KEY;

    if (!accessKey || !secretKey) {
        console.error("[EcoFlow API] Error: ECOFLOW_ACCESS_KEY or ECOFLOW_SECRET_KEY is missing in .env file!");
    }

    const timestamp = Date.now().toString();
    const nonce = Math.floor(100000 + Math.random() * 900000).toString();

    const signStr = bodyPart.length == 0 
        ? `accessKey=${accessKey}&nonce=${nonce}&timestamp=${timestamp}` 
        : `${bodyPart}&accessKey=${accessKey}&nonce=${nonce}&timestamp=${timestamp}`;
    
    const sign = crypto.createHmac('sha256', secretKey).update(signStr).digest('hex');

    return {
        accessKey,
        nonce,
        timestamp,
        sign
    };
}

export async function getMqttCredentials() {
    const signHeaders = createSign();

    const res = await fetch(
        'https://api-e.ecoflow.com/iot-open/sign/certification',
        {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...signHeaders
            },
        }
    );

    const json = await res.json();

    if (json.code !== '0') throw new Error(JSON.stringify(json));
    return json.data;
}

export async function listDevices() {
    const signHeaders = createSign();

    const response = await fetch(
        'https://api-e.ecoflow.com/iot-open/sign/device/list',
        {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...signHeaders
            },
        }
    );

    const data = await response.json();
    return data;
}