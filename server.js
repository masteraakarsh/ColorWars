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
    constructor(roomId, playerCount = 2) {
        this.id = roomId;
        this.players = [];
        this.playerCount = playerCount;
        this.hostId = null; // Track who is the host
        this.playerColors = {
            2: ['red', 'blue'],
            3: ['red', 'blue', 'green'],
            4: ['red', 'blue', 'green', 'yellow']
        };
        this.boardSizeMap = {
            2: 5,  // 2 players: 5x5 board
            3: 6,  // 3 players: 6x6 board
            4: 7   // 4 players: 7x7 board
        };
        this.gameState = {
            board: null,
            currentPlayerIndex: 0,
            currentPlayer: this.playerColors[this.playerCount][0],
            gameStatus: 'waiting', // 'waiting', 'ready', 'playing', 'ended'
            boardSize: this.boardSizeMap[this.playerCount],
            moveHistory: [],
            playerCount: this.playerCount,
            players: this.playerColors[this.playerCount],
            connectedPlayers: {},
            hostId: null
        };
        this.spectators = [];
        this.createdAt = new Date();
    }

    addPlayer(socket, playerName, requestedColor = null) {
        if (this.players.length >= this.playerCount) {
            return { success: false, message: 'Room is full' };
        }

        // Determine the player's color
        let playerColor;
        if (requestedColor) {
            // Check if the requested color is valid for this player count
            if (!this.playerColors[this.playerCount].includes(requestedColor)) {
                return { success: false, message: 'Invalid color selection' };
            }
            
            // Check if the color is already taken
            const colorTaken = this.players.some(p => p.color === requestedColor);
            if (colorTaken) {
                return { success: false, message: 'This color is already taken by another player' };
            }
            
            playerColor = requestedColor;
        } else {
            // Assign the next available color
            playerColor = this.playerColors[this.playerCount][this.players.length];
        }

        const player = {
            id: socket.id,
            name: playerName,
            color: playerColor,
            socket: socket
        };

        this.players.push(player);
        
        // Set the first player as the host
        if (this.players.length === 1) {
            this.hostId = socket.id;
            this.gameState.hostId = socket.id;
        }
        
        // Update connected players in game state
        this.gameState.connectedPlayers[player.color] = {
            name: player.name,
            color: player.color,
            connected: true
        };
        
        // Update game status based on player count
        if (this.players.length === this.playerCount) {
            this.gameState.gameStatus = 'ready'; // Ready to start, but waiting for host
        }

        // Return player data without socket object to avoid circular reference
        return { 
            success: true, 
            player: {
                id: player.id,
                name: player.name,
                color: player.color,
                isHost: player.id === this.hostId
            }
        };
    }

    removePlayer(socketId) {
        const removedPlayer = this.players.find(p => p.id === socketId);
        
        this.players = this.players.filter(p => p.id !== socketId);
        this.spectators = this.spectators.filter(s => s.id !== socketId);
        
        // Update connected players in game state
        if (removedPlayer) {
            this.gameState.connectedPlayers[removedPlayer.color] = {
                name: 'Waiting...',
                color: removedPlayer.color,
                connected: false
            };
        }
        
        // If the host left, assign new host
        if (this.hostId === socketId && this.players.length > 0) {
            this.hostId = this.players[0].id;
            this.gameState.hostId = this.hostId;
        }
        
        if (this.players.length === 0) {
            return true; // Room should be deleted
        }
        
        if (this.players.length < this.playerCount && this.gameState.gameStatus === 'playing') {
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

    startGame(playerId) {
        // Only the host can start the game
        if (playerId !== this.hostId) {
            return { success: false, message: 'Only the host can start the game' };
        }

        // Check if all players are present
        if (this.players.length !== this.playerCount) {
            return { success: false, message: 'All players must be present to start the game' };
        }

        // Check if game is in ready state
        if (this.gameState.gameStatus !== 'ready') {
            return { success: false, message: 'Game is not ready to start' };
        }

        // Start the game
        this.gameState.gameStatus = 'playing';
        this.initializeBoard();

        return { success: true, gameState: this.gameState };
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
         if (this.gameState.moveHistory.length < this.playerCount && cell.owner === null) {
             // First move for each player - allowed
         } else if (cell.owner !== player.color) {
             return { success: false, message: 'Invalid move - can only click your own cells' };
         }

         // Check if this is a first move for this player
         const playerMoves = this.gameState.moveHistory.filter(move => move.player === player.color);
         const isFirstMove = playerMoves.length === 0;

        // Save move to history
        this.gameState.moveHistory.push({
            board: this.deepCopyBoard(),
            player: this.gameState.currentPlayer,
            move: { row, col }
        });

        // Make the move
        this.gameState.board[row][col].owner = player.color;
        
        // First move for each player starts with dots based on cell capacity
        if (isFirstMove) {
            // Start with 3 dots, but don't exceed cell's maximum capacity
            this.gameState.board[row][col].dots = Math.min(3, this.gameState.board[row][col].maxDots);
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
            this.gameState.currentPlayerIndex = (this.gameState.currentPlayerIndex + 1) % this.playerCount;
            this.gameState.currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex];
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
                winner: this.gameState.winner,
                playerCount: this.gameState.playerCount,
                players: this.gameState.players,
                connectedPlayers: this.gameState.connectedPlayers
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
        const playerCellCounts = {};
        let activePlayers = 0;
        let winner = null;
        
        // Count cells for each player
        for (let player of this.gameState.players) {
            const cellCount = this.countPlayerCells(player);
            playerCellCounts[player] = cellCount;
            if (cellCount > 0) {
                activePlayers++;
                winner = player;
            }
        }
        
        // Win condition: only one player has cells remaining (after all players have made their first move)
        if (this.gameState.moveHistory.length >= this.playerCount && activePlayers === 1) {
            return winner;
        }
        
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
        const playerCount = data.playerCount || 2;
        const room = new GameRoom(roomId, playerCount);
        
        gameRooms.set(roomId, room);
        playerRooms.set(socket.id, roomId);
        
        const result = room.addPlayer(socket, data.playerName, data.playerColor);
        
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
        
        const result = room.addPlayer(socket, data.playerName, data.playerColor);
        
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
            
            // If room is ready to start, notify players
            if (room.gameState.gameStatus === 'ready') {
                room.broadcastToRoom('roomReady', {
                    gameState: room.gameState
                });
            }
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

    // Handle host starting the game
    socket.on('startGame', () => {
        const roomId = playerRooms.get(socket.id);
        const room = gameRooms.get(roomId);
        
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        const result = room.startGame(socket.id);
        
        if (result.success) {
            room.broadcastToRoom('gameStarted', {
                gameState: result.gameState
            });
        } else {
            socket.emit('error', { message: result.message });
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

    // Handle color change in waiting room
    socket.on('changeColor', (data) => {
        const roomId = playerRooms.get(socket.id);
        const room = gameRooms.get(roomId);
        
        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        // Only allow color changes when game is in waiting or ready state
        if (room.gameState.gameStatus !== 'waiting' && room.gameState.gameStatus !== 'ready') {
            socket.emit('error', { message: 'Cannot change color during active game' });
            return;
        }

        const player = room.players.find(p => p.id === socket.id);
        if (!player) {
            socket.emit('error', { message: 'Player not found' });
            return;
        }

        const newColor = data.newColor;
        const oldColor = player.color;

        // Check if the new color is already taken by another player
        const colorTaken = room.players.some(p => p.id !== socket.id && p.color === newColor);
        if (colorTaken) {
            socket.emit('error', { message: 'This color is already taken by another player' });
            return;
        }

        // Check if the new color is valid for this player count
        const validColors = room.playerColors[room.playerCount];
        if (!validColors.includes(newColor)) {
            socket.emit('error', { message: 'Invalid color selection' });
            return;
        }

        // Update player color
        player.color = newColor;
        
        // Update connected players in game state
        if (room.gameState.connectedPlayers[oldColor]) {
            delete room.gameState.connectedPlayers[oldColor];
        }
        room.gameState.connectedPlayers[newColor] = {
            name: player.name,
            color: newColor,
            connected: true
        };

        // Broadcast color change to all players in the room
        room.broadcastToRoom('colorChanged', {
            playerId: socket.id,
            playerName: player.name,
            oldColor: oldColor,
            newColor: newColor,
            gameState: room.gameState
        });
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
            maxPlayers: room.playerCount,
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