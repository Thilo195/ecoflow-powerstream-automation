import { InfluxDB, Point } from '@influxdata/influxdb-client';
let writeApi = null;

//lazy init
export function logToInflux(metrics, targetWatts, ecoflowData) {
    if (!writeApi) {
        const url = process.env.INFLUX_URL;
        const token = process.env.INFLUX_TOKEN ? process.env.INFLUX_TOKEN.trim() : undefined;
        const org = process.env.INFLUX_ORG;
        const bucket = process.env.INFLUX_BUCKET;

        if (!url) {
            console.error("[InfluxDB] Error: INFLUX_URL missing in environment.");
            return;
        }

        const influxDB = new InfluxDB({ url, token });
        writeApi = influxDB.getWriteApi(org, bucket, 's');
        console.log("[InfluxDB] Connection successful.");
    }

    if (!metrics || metrics.current_power_w === undefined) return;

    const point = new Point('smart_meter')
        .floatField('grid_power_w', metrics.current_power_w)
        .floatField('ecoflow_target_w', targetWatts);

    if (metrics.total_consumption_kwh !== undefined) point.floatField('total_consumption_kwh', metrics.total_consumption_kwh);
    if (metrics.power_L1_w !== undefined) point.floatField('power_l1_w', metrics.power_L1_w);
    if (metrics.power_L2_w !== undefined) point.floatField('power_l2_w', metrics.power_L2_w);
    if (metrics.power_L3_w !== undefined) point.floatField('power_l3_w', metrics.power_L3_w);

    if (ecoflowData) {
        if (ecoflowData.battery_soc !== undefined) {
            point.intField('battery_soc', ecoflowData.battery_soc);
        }
        if (ecoflowData.pv_power_w !== undefined) {
            point.floatField('pv_power_w', ecoflowData.pv_power_w);
        }
    }

    writeApi.writePoint(point);
}