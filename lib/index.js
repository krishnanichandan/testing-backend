"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const DbManager_1 = require("./db/DbManager");
const GameRoom_1 = require("./rooms/GameRoom");
const LobbyRoom_1 = require("./rooms/LobbyRoom");
const colyseus_1 = require("colyseus");
const ws_transport_1 = require("@colyseus/ws-transport");
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const https_1 = require("https");
const express_1 = __importDefault(require("express"));
const index_1 = __importDefault(require("./Routes/index"));
const monitor_1 = require("@colyseus/monitor");
dotenv.config();
const port = parseInt(process.env.PORT || '3000', 10);
const app = (0, express_1.default)();
let gameServer = null;
// Validate environment variables
if (!process.env.NODE_ENV) {
    console.error('NODE_ENV is not defined');
    process.exit(1);
}
// Initialize server based on environment
if (process.env.NODE_ENV === 'development') {
    gameServer = new colyseus_1.Server({
        server: (0, http_1.createServer)(app),
        transport: new ws_transport_1.WebSocketTransport({
            pingInterval: 5000,
            pingMaxRetries: 4,
        }),
    });
}
else {
    const privateKey = process.env.PRIVATE_KEY;
    const certificate = process.env.FULL_CHAIN;
    const credentials = { key: privateKey, cert: certificate };
    app.use((0, cors_1.default)({ origin: process.env.ALLOWED_ORIGINS || '*' }));
    app.options('*', (0, cors_1.default)());
    gameServer = new colyseus_1.Server({
        server: (0, https_1.createServer)(credentials, app),
    });
}
// Initialize Express and Game Server
initializeExpress(app);
initializeGameServer(gameServer);
gameServer.listen(port).then(() => {
    console.log(`Server is running on port ${port}`);
});
function initializeGameServer(gameServer) {
    gameServer.define('lobby', LobbyRoom_1.LobbyRoom);
    gameServer.define('game', GameRoom_1.GameRoom);
    initializeDependencies();
}
function initializeExpress(app) {
    console.log('Initializing Express...');
    app.use(express_1.default.json({ limit: '30mb' }));
    app.use(express_1.default.urlencoded({ limit: '30mb', extended: true }));
    app.use((0, cors_1.default)());
    // CORS middleware
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, PATCH, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Accept-Version, device-id, env, User-IP, x-api-key');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
        next();
    });
    // Routes
    app.use('/', index_1.default);
    app.use('/colyseus', (0, monitor_1.monitor)());
    // Error handling middleware
    app.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(500).json({ message: 'Internal Server Error' });
    });
}
function initializeDependencies() {
    DbManager_1.DbManager.Instance.init()
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
