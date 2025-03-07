import * as dotenv from 'dotenv';
import { Client } from 'colyseus.js';
import { DbManager } from './db/DbManager';
import { GameRoom } from './rooms/GameRoom';
import { LobbyRoom } from './rooms/LobbyRoom';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import cors from 'cors';
import { createServer as createLocalServer } from 'http';
import { createServer } from 'https';
import express from 'express';
import fs from 'fs';
import indexRouter from './Routes/index';
import { monitor } from '@colyseus/monitor';
import { Request, Response, NextFunction } from 'express';

dotenv.config();

const port = parseInt(process.env.PORT || '3000', 10);
const app = express();
let gameServer: Server = null;

// Validate environment variables
if (!process.env.NODE_ENV) {
    console.error('NODE_ENV is not defined');
    process.exit(1);
}

// Initialize server based on environment
if (process.env.NODE_ENV === 'development') {
    gameServer = new Server({
        server: createLocalServer(app),
        transport: new WebSocketTransport({
            pingInterval: 5000,
            pingMaxRetries: 4,
        }),
    });
} else {
    const privateKey = fs.readFileSync('privkey.pem', 'utf-8');
    const certificate = fs.readFileSync('fullchain.pem', 'utf-8');
    const credentials = { key: privateKey, cert: certificate };

    app.use(cors({ origin: process.env.ALLOWED_ORIGINS || '*' }));
    app.options('*', cors());

    gameServer = new Server({
        server: createServer(credentials, app),
    });
}

// Initialize Express and Game Server
initializeExpress(app);
initializeGameServer(gameServer);

gameServer.listen(port).then(() => {
    console.log(`Server is running on port ${port}`);
});

function initializeGameServer(gameServer: Server) {
    gameServer.define('lobby', LobbyRoom);
    gameServer.define('game', GameRoom);
    initializeDependencies();
}

function initializeExpress(app: express.Application) {
    console.log('Initializing Express...');

    app.use(express.json({ limit: '30mb' }));
    app.use(express.urlencoded({ limit: '30mb', extended: true }));
    app.use(cors());

    // CORS middleware
    app.use((req: Request, res: Response, next: NextFunction) => {
        res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, PATCH, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Origin', '*');
        res.header(
            'Access-Control-Allow-Headers',
            'Origin, X-Requested-With, Content-Type, Accept, Authorization, Accept-Version, device-id, env, User-IP, x-api-key',
        );
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
        next();
    });

    // Routes
    app.use('/', indexRouter);
    app.use('/colyseus', monitor());

    // Error handling middleware
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        console.error(err.stack);
        res.status(500).json({ message: 'Internal Server Error' });
    });
}

function initializeDependencies() {
    DbManager.Instance.init()
        .then(() => {
            console.log('Database initialized successfully');
        })
        .catch((error) => {
            console.error('Failed to initialize database:', error);
        });
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    gameServer.gracefullyShutdown().then(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    gameServer.gracefullyShutdown().then(() => process.exit(0));
});