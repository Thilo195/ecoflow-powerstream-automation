import { createSign, serialNo } from '../config/ecoflow_base.js';

function flatten(obj, prefix = '', out = {}) {
    for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
        else out[key] = v;
    }
    return out;
}

export async function readAllData() {
    try {

        const signHeaders = createSign();

        const url = `https://api-e.ecoflow.com/iot-open/sign/device/quota/all?sn=${encodeURIComponent(serialNo.powerstream)}`;

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
        // console.log(resonseData);

        const result = {
            pvToInvWatts: parseInt(resonseData.data['20_1.pvToInvWatts'])/10,
            batSoc: parseInt(resonseData.data['20_1.batSoc'])
        }

        console.log(result)
        
        return result

    } catch (error) {
        console.error(error);
    }
}

var lastSendWatts = -1

export async function setPermanentWatts(watts) {

    if (lastSendWatts == watts) return null;
    lastSendWatts = watts;

    const body = {
        sn: serialNo.powerstream,
        cmdCode: 'WN511_SET_PERMANENT_WATTS_PACK',
        params: { permanentWatts: Math.round(watts * 10) }, // 0,1 W -> *10
    };

    const flat = flatten(body);                
    const bodyPart = Object.keys(flat).sort()
        .map(k => `${k}=${flat[k]}`)
        .join('&');

    const signHeaders = createSign(bodyPart);

    const res = await fetch('https://api-e.ecoflow.com/iot-open/sign/device/quota', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            ...signHeaders
        },
        body: JSON.stringify(body),
    });

    const json = await res.json();
    // console.log(json);             

    if (json.code !== '0') throw new Error(`EcoFlow: ${json.code} ${json.message}`);
    return json;
}
