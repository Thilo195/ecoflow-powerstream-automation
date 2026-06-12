import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export function startServer(port, getLatestData) {
    const app = express();
    
  
    app.use(cors());

    app.get('/data', (req, res) => {
        const data = getLatestData();
        if (data) {
            res.json(data);
        } else {
            res.status(503).json({ error: "Waiting for data..." });
        }
    });


    app.get('/', (req, res) => {
        const dateiPfad = path.join(__dirname, 'public', 'server.html');
        res.sendFile(dateiPfad);
    });

    app.listen(port, () => {
        console.log(`Express Webserver is running! Open in Browser: http://localhost:${port}`);
    });
}