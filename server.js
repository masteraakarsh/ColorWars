const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Game state management
const gameRooms = new Map();
const playerRooms = new Map();

// Serve static files
app.use(express.static(path.join(__dirname)));

// Main route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Game room class
class GameRoom {
    constructor(roomId) {
        this.id = roomId;
        this.players = [];
        this.gameState = {
            board: null,
            currentPlayer: 'red',
            gameStatus: 'waiting', // 'waiting', 'playing', 'ended'
            boardSize: 6,
            moveHistory: []
        };
        this.spectators = [];
        this.createdAt = new Date();
    }

    addPlayer(socket, playerName) {
        if (this.players.length >= 2) {
            return { success: false, message: 'Room is full' };
        }

        const player = {
            id: socket.id,
            name: playerName,
            color: this.players.length === 0 ? 'red' : 'blue',
            socket: socket
        };

        this.players.push(player);
        
        if (this.players.length === 2) {
            this.gameState.gameStatus = 'playing';
            this.initializeBoard();
        }

        // Return player data without socket object to avoid circular reference
        return { 
            success: true, 
            player: {
                id: player.id,
                name: player.name,
                color: player.color
            }
        };
    }

    removePlayer(socketId) {
        this.players = this.players.filter(p => p.id !== socketId);
        this.spectators = this.spectators.filter(s => s.id !== socketId);
        
        if (this.players.length === 0) {
            return true; // Room should be deleted
        }
        
        if (this.players.length === 1 && this.gameState.gameStatus === 'playing') {
            this.gameState.gameStatus = 'waiting';
        }
        
        return false;
    }

    addSpectator(socket, playerName) {
        const spectator = {
            id: socket.id,
            name: playerName,
            socket: socket
        };

        this.spectators.push(spectator);
        return { 
            success: true, 
            spectator: {
                id: spectator.id,
                name: spectator.name
            }
        };
    }

    initializeBoard() {
        this.gameState.board = [];
        for (let row = 0; row < this.gameState.boardSize; row++) {
            this.gameState.board[row] = [];
            for (let col = 0; col < this.gameState.boardSize; col++) {
                this.gameState.board[row][col] = {
                    owner: null,
                    dots: 0,
                    maxDots: this.getMaxDots(row, col)
                };
            }
        }
    }

    getMaxDots(row, col) {
        const size = this.gameState.boardSize;
        const isCorner = (row === 0 || row === size - 1) && 
                         (col === 0 || col === size - 1);
        const isEdge = row === 0 || row === size - 1 || 
                       col === 0 || col === size - 1;
        
        if (isCorner) return 2;
        if (isEdge) return 3;
        return 4;
    }

    makeMove(row, col, playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return { success: false, message: 'Player not found' };
        
        if (this.gameState.gameStatus !== 'playing') {
            return { success: false, message: 'Game not in progress' };
        }
        
        if (player.color !== this.gameState.currentPlayer) {
            return { success: false, message: 'Not your turn' };
        }

                 const cell = this.gameState.board[row][col];
         
         // Check if this is a valid move (same logic as client)
         if (this.gameState.moveHistory.length === 0 && player.color === 'red' && cell.owner === null) {
             // Red player's first move - allowed
         } else if (this.gameState.moveHistory.length === 1 && player.color === 'blue' && cell.owner === null) {
             // Blue player's first move - allowed
         } else if (cell.owner !== player.color) {
             return { success: false, message: 'Invalid move - can only click your own cells' };
         }

        // Save move to history
        this.gameState.moveHistory.push({
            board: this.deepCopyBoard(),
            player: this.gameState.currentPlayer,
            move: { row, col }
        });

                 // Make the move
         this.gameState.board[row][col].owner = player.color;
         
         // First move for each player starts with 3 dots
         const isFirstMove = (this.gameState.moveHistory.length === 0 && player.color === 'red') || 
                            (this.gameState.moveHistory.length === 1 && player.color === 'blue');
         
         if (isFirstMove) {
             this.gameState.board[row][col].dots = 3;
         } else {
             this.gameState.board[row][col].dots++;
         }

        // Handle explosions
        this.handleExplosions(row, col, player.color);

        // Check win condition
        const winner = this.checkWinCondition();
        if (winner) {
            this.gameState.gameStatus = 'ended';
            this.gameState.winner = winner;
        } else {
            // Switch turns
            this.gameState.currentPlayer = this.gameState.currentPlayer === 'red' ? 'blue' : 'red';
        }

        return { 
            success: true, 
            gameState: {
                board: this.gameState.board,
                currentPlayer: this.gameState.currentPlayer,
                gameStatus: this.gameState.gameStatus,
                boardSize: this.gameState.boardSize,
                moveHistory: this.gameState.moveHistory.map(move => ({
                    player: move.player,
                    move: move.move
                })),
                winner: this.gameState.winner
            }
        };
    }

    handleExplosions(row, col, playerColor) {
        const cell = this.gameState.board[row][col];
        
        if (cell.dots >= cell.maxDots) {
            // Reset exploding cell
            cell.dots = 0;
            
            // Get adjacent cells
            const adjacent = this.getAdjacentCells(row, col);
            
            // Explode to adjacent cells
            for (const [adjRow, adjCol] of adjacent) {
                this.gameState.board[adjRow][adjCol].owner = playerColor;
                this.gameState.board[adjRow][adjCol].dots++;
                
                // Recursive explosion
                this.handleExplosions(adjRow, adjCol, playerColor);
            }
        }
    }

    getAdjacentCells(row, col) {
        const adjacent = [];
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        
        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            
            if (newRow >= 0 && newRow < this.gameState.boardSize && 
                newCol >= 0 && newCol < this.gameState.boardSize) {
                adjacent.push([newRow, newCol]);
            }
        }
        
        return adjacent;
    }

    checkWinCondition() {
        if (this.gameState.moveHistory.length <= 1) return null;
        
        const redCells = this.countPlayerCells('red');
        const blueCells = this.countPlayerCells('blue');
        
        if (redCells === 0) return 'blue';
        if (blueCells === 0) return 'red';
        
        return null;
    }

    countPlayerCells(color) {
        let count = 0;
        for (let row = 0; row < this.gameState.boardSize; row++) {
            for (let col = 0; col < this.gameState.boardSize; col++) {
                if (this.gameState.board[row][col].owner === color) {
                    count++;
                }
            }
        }
        return count;
    }

    deepCopyBoard() {
        return this.gameState.board.map(row => 
            row.map(cell => ({
                owner: cell.owner,
                dots: cell.dots,
                maxDots: cell.maxDots
            }))
        );
    }

    broadcastToRoom(event, data) {
        [...this.players, ...this.spectators].forEach(participant => {
            participant.socket.emit(event, data);
        });
    }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Create or join room
    socket.on('createRoom', (data) => {
        const roomId = uuidv4().substring(0, 8);
        const room = new GameRoom(roomId);
        
        gameRooms.set(roomId, room);
        playerRooms.set(socket.id, roomId);
        
        const result = room.addPlayer(socket, data.playerName);
        
        if (result.success) {
            socket.join(roomId);
            socket.emit('roomCreated', {
                roomId,
                player: result.player,
                gameState: room.gameState
            });
        } else {
            socket.emit('error', { message: result.message });
        }
    });

    socket.on('joinRoom', (data) => {
        const room = gameRooms.get(data.roomId);
        
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        playerRooms.set(socket.id, data.roomId);
        
        const result = room.addPlayer(socket, data.playerName);
        
        if (result.success) {
            socket.join(data.roomId);
            socket.emit('roomJoined', {
                roomId: data.roomId,
                player: result.player,
                gameState: room.gameState
            });
            
            // Notify all players in the room
            room.broadcastToRoom('playerJoined', {
                player: result.player,
                gameState: room.gameState
            });
        } else {
            // Try to add as spectator
            const spectatorResult = room.addSpectator(socket, data.playerName);
            if (spectatorResult.success) {
                socket.join(data.roomId);
                socket.emit('spectatorJoined', {
                    roomId: data.roomId,
                    spectator: spectatorResult.spectator,
                    gameState: room.gameState
                });
            } else {
                socket.emit('error', { message: result.message });
            }
        }
    });

    // Handle game moves
    socket.on('makeMove', (data) => {
        const roomId = playerRooms.get(socket.id);
        const room = gameRooms.get(roomId);
        
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        const result = room.makeMove(data.row, data.col, socket.id);
        
        if (result.success) {
            room.broadcastToRoom('moveMade', {
                move: { row: data.row, col: data.col },
                gameState: result.gameState
            });
        } else {
            socket.emit('error', { message: result.message });
        }
    });

    // Handle player disconnect
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        
        const roomId = playerRooms.get(socket.id);
        if (roomId) {
            const room = gameRooms.get(roomId);
            if (room) {
                const shouldDelete = room.removePlayer(socket.id);
                
                if (shouldDelete) {
                    gameRooms.delete(roomId);
                } else {
                    room.broadcastToRoom('playerDisconnected', {
                        playerId: socket.id,
                        gameState: room.gameState
                    });
                }
            }
            
            playerRooms.delete(socket.id);
        }
    });

    // Get room list
    socket.on('getRoomList', () => {
        const rooms = Array.from(gameRooms.values()).map(room => ({
            id: room.id,
            players: room.players.length,
            maxPlayers: 2,
            spectators: room.spectators.length,
            status: room.gameState.gameStatus,
            createdAt: room.createdAt
        }));
        
        socket.emit('roomList', rooms);
    });

    // Send welcome message
    socket.emit('connected', { message: 'Connected to ColorWars server' });
});

// Start server
server.listen(PORT, () => {
    console.log(`ColorWars server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to play!`);
});

// Cleanup empty rooms periodically
setInterval(() => {
    const now = new Date();
    for (const [roomId, room] of gameRooms.entries()) {
        if (room.players.length === 0 && room.spectators.length === 0) {
            const timeSinceCreation = now - room.createdAt;
            if (timeSinceCreation > 60000) { // 1 minute
                gameRooms.delete(roomId);
                console.log(`Cleaned up empty room: ${roomId}`);
            }
        }
    }
}, 30000); // Check every 30 seconds 