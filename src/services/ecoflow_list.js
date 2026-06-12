import { listDevices } from './ecoflow_base.js';

const data = await listDevices();
console.log(JSON.stringify(data, null, 2));
