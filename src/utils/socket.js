const { Server } = require('socket.io');

let io;
const userSockets = new Map(); // userId -> socketId

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);

        socket.on('authenticate', (userId) => {
            if (userId) {
                userSockets.set(String(userId), socket.id);
                console.log(`User ${userId} authenticated with socket ${socket.id}`);
            }
        });

        socket.on('disconnect', () => {
            // Find and remove userId entry
            for (const [userId, socketId] of userSockets.entries()) {
                if (socketId === socket.id) {
                    userSockets.delete(userId);
                    console.log(`User ${userId} disconnected`);
                    break;
                }
            }
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};

const emitToUser = (userId, event, data) => {
    const socketId = userSockets.get(String(userId));
    if (socketId && io) {
        io.to(socketId).emit(event, data);
        console.log(`Notification emitted to User ${userId} (Socket: ${socketId})`);
        return true;
    }
    console.log(`Failed to emit notification to User ${userId}: Socket not found`);
    return false;
};

const emitToAll = (event, data) => {
    if (io) {
        io.emit(event, data);
        console.log(`Broadcast event: ${event}`);
        return true;
    }
    return false;
};

module.exports = {
    initSocket,
    getIO,
    emitToUser,
    emitToAll
};
