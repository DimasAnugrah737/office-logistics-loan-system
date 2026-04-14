const { Server } = require('socket.io');

let io;

/**
 * Initialize Socket.io for the backend server.
 * Manages real-time connections through a 'Rooms' system for high reliability.
 */
const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        },
        // Transport optimization and buffering
        pingTimeout: 60000,
        pingInterval: 25000
    });

    io.on('connection', (socket) => {
        console.log('Client connected to Socket.io:', socket.id);

        /**
         * Join private room based on userId.
         * This allows sending messages to a single user who may have multiple tabs open.
         */
        socket.on('authenticate', (userId) => {
            if (userId) {
                const roomName = `user:${userId}`;
                socket.join(roomName);
                console.log(`Socket ${socket.id} joined private room: ${roomName}`);
            }
        });

        socket.on('disconnect', (reason) => {
            console.log(`Client disconnected: ${socket.id} (Reason: ${reason})`);
        });
    });

    return io;
};

/**
 * Access the global io instance.
 */
const getIO = () => {
    if (!io) throw new Error('Socket.io not initialized');
    return io;
};

/**
 * Send an event/notification to a specific user (supports multi-tab).
 * @param {string|number} userId - Target User ID.
 * @param {string} event - Event name.
 * @param {Object} data - Data payload.
 */
const emitToUser = (userId, event, data) => {
    if (io && userId) {
        const roomName = `user:${userId}`;
        io.to(roomName).emit(event, data);
        console.log(`Notification emitted to room: ${roomName} [Event: ${event}]`);
        return true;
    }
    return false;
};

/**
 * Broadcast event to all connected clients.
 */
const emitToAll = (event, data) => {
    if (io) {
        io.emit(event, data);
        console.log(`Broadcast global event: ${event}`);
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
