import mqtt from 'mqtt';
import { getMqttCredentials } from '../config/ecoflow_base.js';

export class EcoflowMQTT {
    cred = null;
    sn = null;
    isConnected = false;
    client = null;

    batterySoc = 0;
    pv1 = 0;
    pv2 = 0;

    get pvPower() {
        return this.pv1 + this.pv2;
    }

    setWatts(watts) {
        if (!this.isConnected || !this.sn) return;

        const setTopic = `/open/${this.cred.certificateAccount}/${this.sn}/set`;
        const cleanWatts = Math.max(0, Math.min(800, watts));

        // ecoflow logic: watts multiplied by 10 (deci-watts)
        const ecoWatts = Math.round(cleanWatts * 10);

        const payload = {
            id: Date.now(), 
            version: "1.0",
            cmdCode: "WN511_SET_PERMANENT_WATTS_PACK",
            params: {
                permanentWatts: ecoWatts
            }
        };

        this.client.publish(setTopic, JSON.stringify(payload), { qos: 1 }, (err) => {
            if (err) {
                console.error('Error sending data to PowerStream:', err);
            } 
        });
    }

    async connect() {
        this.sn = process.env.POWERSTREAM_SERIAL;

        if (!this.sn) {
            console.error('[EcoFlow MQTT] CRITICAL: POWERSTREAM_SERIAL missing in .env!');
            return;
        }

        const cred = await getMqttCredentials();

        const client = mqtt.connect(`mqtts://${cred.url}:${cred.port}`, {
            username: cred.certificateAccount,
            password: cred.certificatePassword,
            clientId: `bp_${cred.certificateAccount}_${Date.now()}`,
            protocol: cred.protocol,
            rejectUnauthorized: true,
        });

        client.on('connect', () => {
            this.isConnected = true;
            this.cred = cred;
            this.client = client;
            console.log('[EcoFlow] MQTT connected successfully');

            const quotaTopic = `/open/${cred.certificateAccount}/${this.sn}/quota`;
            
            console.log(`[EcoFlow] Try subscription: ${quotaTopic}`);

            client.subscribe([quotaTopic], (err) => {
                if (err) console.error('[EcoFlow] Subscribe-Error:', err);
                else console.log('[EcoFlow] Subscription successfull!');
            });
        });

        client.on('message', (topic, payload) => {
            try {
                const msg = JSON.parse(payload.toString());
                if (msg && msg.params) {
                    const p = msg.params;

                    if (p.batSoc !== undefined) {
                        this.batterySoc = p.batSoc;
                    }

                    if (p.pv1InputWatts !== undefined) {
                        this.pv1 = p.pv1InputWatts / 10;
                    }
                    if (p.pv2InputWatts !== undefined) {
                        this.pv2 = p.pv2InputWatts / 10;
                    }
                }
            } catch (e) {
            }
        });

        client.on('error', (err) => {
            console.error('[EcoFlow] MQTT Client Error:', err);
        });
    }
}