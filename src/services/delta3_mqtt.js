import mqtt from 'mqtt';
import { serialNo, getMqttCredentials } from './ecoflow_base.js';
import { setTimeout } from 'node:timers/promises';

const sn = serialNo.powerstream;

const cred = await getMqttCredentials()

const client = mqtt.connect(`mqtts://${cred.url}:${cred.port}`, {
    username: cred.certificateAccount,
    password: cred.certificatePassword,
    clientId: `bp_${cred.certificateAccount}_${Date.now()}`,
    protocol: cred.protocol,
    rejectUnauthorized: true,
});

client.on('connect', () => {
    console.log('MQTT verbunden');

    const quotaTopic = `/open/${cred.certificateAccount}/${sn}/quota`;
    const statusTopic = `/open/${cred.certificateAccount}/${sn}/status`;

    client.subscribe([quotaTopic, statusTopic], (err, granted) => {
        if (err) console.error('Subscribe-Fehler:', err);
        else console.log('Subscribed:', granted.map(g => g.topic).join(', '));
    });
});

client.on('message', (topic, payload) => {
    try {
        const msg = JSON.parse(payload.toString());
        // msg.params enthält die geänderten felder seit dem letzten push
        console.log(topic, JSON.stringify(msg, null, 2));
    } catch (e) {
        console.warn('Non-JSON payload on', topic);
    }
});

client.on('error', (err) => console.error('MQTT-Fehler:', err));

const setTopic = `/open/${cred.certificateAccount}/${sn}/set`;

export function setPermanentWatts(watts) {
    let cleanWatts = Math.max(0, Math.min(800, watts));

    let ecoWatts = Math.round(cleanWatts * 10);

    const payload = {
        id: Date.now(),
        version: "1.0",
        cmdCode: "WN511_SET_PERMANENT_WATTS_PACK",
        params: {
            permanentWatts: ecoWatts
        }
    };

    client.publish(setTopic, JSON.stringify(payload), { qos: 1 }, (err) => {
        if (err) {
            console.error('Error while sending to PowerStream:', err);
        } else {
            console.log(`-> MQTT: PowerStream Power set to ${cleanWatts} W`);
        }
    });
}

await setTimeout(10000);
setPermanentWatts(24);

