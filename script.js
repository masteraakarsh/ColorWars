// ColorWars Game Logic
class ColorWarsGame {
    constructor() {
        this.boardSize = 5;
        this.board = [];
        this.currentPlayer = 'red';
        this.gameMode = 'local';
        this.gameState = 'playing'; // 'playing', 'ended'
        this.soundEnabled = true;
        this.animationEnabled = true;
        this.moveHistory = [];
        this.isAnimating = false;
        this.aiDifficulty = 'medium';
        
        this.initializeGame();
        this.setupEventListeners();
    }

    initializeGame() {
        this.createBoard();
        this.renderBoard();
        this.updateUI();
        this.resetPlayerStats();
    }

    createBoard() {
        this.board = [];
        for (let row = 0; row < this.boardSize; row++) {
            this.board[row] = [];
            for (let col = 0; col < this.boardSize; col++) {
                this.board[row][col] = {
                    owner: null,
                    dots: 0,
                    maxDots: this.getMaxDots(row, col)
                };
            }
        }
    }

    getMaxDots(row, col) {
        const isCorner = (row === 0 || row === this.boardSize - 1) && 
                         (col === 0 || col === this.boardSize - 1);
        const isEdge = row === 0 || row === this.boardSize - 1 || 
                       col === 0 || col === this.boardSize - 1;
        
        if (isCorner) return 2;
        if (isEdge) return 3;
        return 4;
    }

    renderBoard() {
        const boardElement = document.getElementById('game-board');
        boardElement.innerHTML = '';
        boardElement.className = `game-board size-${this.boardSize}`;

        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const cell = this.createCellElement(row, col);
                boardElement.appendChild(cell);
            }
        }
    }

    createCellElement(row, col) {
        const cell = document.createElement('div');
        const cellData = this.board[row][col];
        
        let className = `cell ${cellData.owner || 'empty'}`;
        
        // Check if this empty cell can be clicked (first move only)
        if (!cellData.owner) {
            const isFirstMoveAllowed = (this.moveHistory.length === 0 && this.currentPlayer === 'red') || 
                                     (this.moveHistory.length === 1 && this.currentPlayer === 'blue');
            if (isFirstMoveAllowed) {
                className += ' first-move-allowed';
            }
        }
        
        cell.className = className;
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.tabIndex = 0;
        
        if (cellData.dots > 0) {
            const dotsContainer = document.createElement('div');
            
            // Set appropriate class based on dot count
            if (cellData.dots === 2) {
                dotsContainer.className = 'dots vertical';
            } else if (cellData.dots === 3) {
                dotsContainer.className = 'dots triangle';
            } else {
                dotsContainer.className = 'dots';
            }
            
            for (let i = 0; i < cellData.dots; i++) {
                const dot = document.createElement('div');
                dot.className = 'dot';
                dotsContainer.appendChild(dot);
            }
            
            cell.appendChild(dotsContainer);
        }

        // Add click event listener
        cell.addEventListener('click', () => this.handleCellClick(row, col));
        cell.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.handleCellClick(row, col);
            }
        });

        return cell;
    }

    async handleCellClick(row, col) {
        if (this.gameState !== 'playing' || this.isAnimating) return;
        
        if (this.gameMode === 'ai' && this.currentPlayer === 'blue') return;
        
        if (this.gameMode === 'online') {
            if (this.isValidMove(row, col)) {
                await this.makeOnlineMove(row, col);
            }
            return;
        }
        
        if (this.isValidMove(row, col)) {
            await this.makeMove(row, col, this.currentPlayer);
            
            if (this.gameState === 'playing') {
                if (this.gameMode === 'ai' && this.currentPlayer === 'blue') {
                    setTimeout(() => this.makeAIMove(), 500);
                }
            }
        }
    }

    isValidMove(row, col) {
        const cell = this.board[row][col];
        // Players can only click on their own cells, not empty cells
        // Exception: First move of the game can be on any empty cell
        if (this.moveHistory.length === 0 && this.currentPlayer === 'red' && cell.owner === null) {
            return true; // Red player's first move
        }
        if (this.moveHistory.length === 1 && this.currentPlayer === 'blue' && cell.owner === null) {
            return true; // Blue player's first move
        }
        return cell.owner === this.currentPlayer;
    }

    async makeMove(row, col, player) {
        // Check if this is a first move BEFORE adding to history
        const isFirstMove = (this.moveHistory.length === 0 && player === 'red') || 
                           (this.moveHistory.length === 1 && player === 'blue');

        // Add placement animation
        const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (cellElement) {
            cellElement.classList.add('placing-dot');
            setTimeout(() => {
                cellElement.classList.remove('placing-dot');
            }, 600);
        }

        // Save move for undo functionality
        this.moveHistory.push({
            board: this.deepCopyBoard(),
            player: this.currentPlayer
        });

        // Update undo button state
        document.getElementById('undo-btn').disabled = false;

        // Place dot(s)
        this.board[row][col].owner = player;
        
        // First move for each player starts with 3 dots
        if (isFirstMove) {
            this.board[row][col].dots = 3;
        } else {
            this.board[row][col].dots++;
        }

        // Play sound effect
        this.playSound('place');

        // Check for explosion
        if (this.board[row][col].dots >= this.board[row][col].maxDots) {
            await this.explode(row, col, player);
        }

        // Update UI
        this.renderBoard();
        this.updatePlayerStats();
        
        // Add expanding animation to newly placed dots
        setTimeout(() => {
            const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (cellElement) {
                const dots = cellElement.querySelectorAll('.dot');
                dots.forEach(dot => {
                    dot.classList.add('expanding');
                    setTimeout(() => {
                        dot.classList.remove('expanding');
                    }, 500);
                });
            }
        }, 100);

        // Check win condition
        if (this.checkWinCondition()) {
            this.endGame();
        } else {
            this.switchPlayer();
        }
    }

    async explode(row, col, player) {
        this.isAnimating = true;
        
        // Reset dots in exploding cell
        this.board[row][col].dots = 0;
        
        // Add explosion animation
        const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        cellElement.classList.add('exploding');
        
        this.playSound('explode');
        
        // Wait for animation
        await this.delay(300);
        
        // Get adjacent cells
        const adjacentCells = this.getAdjacentCells(row, col);
        const explosionPromises = [];
        
        for (const [adjRow, adjCol] of adjacentCells) {
            // Convert cell to current player's color and add dot
            this.board[adjRow][adjCol].owner = player;
            this.board[adjRow][adjCol].dots++;
            
            // Add chain reaction animation
            const adjCellElement = document.querySelector(`[data-row="${adjRow}"][data-col="${adjCol}"]`);
            adjCellElement.classList.add('chain-reaction');
            
            // Check if this cell should explode
            if (this.board[adjRow][adjCol].dots >= this.board[adjRow][adjCol].maxDots) {
                explosionPromises.push(this.explode(adjRow, adjCol, player));
            }
        }
        
        // Wait for all chain reactions to complete
        await Promise.all(explosionPromises);
        
        // Remove animation classes
        cellElement.classList.remove('exploding');
        adjacentCells.forEach(([adjRow, adjCol]) => {
            const adjCellElement = document.querySelector(`[data-row="${adjRow}"][data-col="${adjCol}"]`);
            adjCellElement.classList.remove('chain-reaction');
        });
        
        this.isAnimating = false;
    }

    getAdjacentCells(row, col) {
        const adjacent = [];
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        
        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            
            if (newRow >= 0 && newRow < this.boardSize && 
                newCol >= 0 && newCol < this.boardSize) {
                adjacent.push([newRow, newCol]);
            }
        }
        
        return adjacent;
    }

    checkWinCondition() {
        const redCells = this.countPlayerCells('red');
        const blueCells = this.countPlayerCells('blue');
        
        // Game ends when one player has no cells (except for the first move)
        if (this.moveHistory.length > 1) {
            return redCells === 0 || blueCells === 0;
        }
        
        return false;
    }

    countPlayerCells(player) {
        let count = 0;
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                if (this.board[row][col].owner === player) {
                    count++;
                }
            }
        }
        return count;
    }

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 'red' ? 'blue' : 'red';
        this.updateUI();
    }

    updateUI() {
        // Update turn indicator
        const turnIndicator = document.querySelector('.turn-indicator');
        const playerName = this.currentPlayer === 'red' ? 'Red Player' : 'Blue Player';
        turnIndicator.textContent = `${playerName}'s Turn`;
        
        // Update player cards
        document.getElementById('player1-card').classList.toggle('active', this.currentPlayer === 'red');
        document.getElementById('player2-card').classList.toggle('active', this.currentPlayer === 'blue');
        
        // Update game status
        this.updateGameStatus();
    }

    updateGameStatus() {
        const statusElement = document.getElementById('game-status');
        if (this.gameState === 'playing') {
            if (this.moveHistory.length < 2) {
                statusElement.textContent = 'Place your first dot anywhere on the board to start (3 dots)!';
            } else {
                statusElement.textContent = 'Click on your own cells to add dots and trigger chain reactions!';
            }
        }
    }

    updatePlayerStats() {
        const redCells = this.countPlayerCells('red');
        const blueCells = this.countPlayerCells('blue');
        
        document.getElementById('red-cells').textContent = redCells;
        document.getElementById('blue-cells').textContent = blueCells;
    }

    resetPlayerStats() {
        document.getElementById('red-cells').textContent = '0';
        document.getElementById('blue-cells').textContent = '0';
    }

    endGame() {
        this.gameState = 'ended';
        const redCells = this.countPlayerCells('red');
        const blueCells = this.countPlayerCells('blue');
        
        const winner = redCells > blueCells ? 'Red Player' : 'Blue Player';
        const winnerColor = redCells > blueCells ? 'red' : 'blue';
        
        this.playSound('win');
        
        // Show win modal
        const winModal = document.getElementById('win-modal');
        const winMessage = document.getElementById('win-message');
        const winStats = document.getElementById('win-stats');
        
        winMessage.textContent = `${winner} Wins!`;
        winMessage.style.color = winnerColor === 'red' ? '#ff4757' : '#3742fa';
        
        winStats.innerHTML = `
            <div>Red Cells: ${redCells}</div>
            <div>Blue Cells: ${blueCells}</div>
            <div>Total Moves: ${this.moveHistory.length}</div>
        `;
        
        winModal.style.display = 'block';
        
        // Update game status
        document.getElementById('game-status').textContent = `Game Over! ${winner} dominates the board!`;
    }

    newGame() {
        this.gameState = 'playing';
        this.currentPlayer = 'red';
        this.moveHistory = [];
        this.isAnimating = false;
        
        document.getElementById('undo-btn').disabled = true;
        
        this.createBoard();
        this.renderBoard();
        this.updateUI();
        this.resetPlayerStats();
        
        // Hide win modal
        document.getElementById('win-modal').style.display = 'none';
    }

    undoMove() {
        if (this.moveHistory.length === 0 || this.isAnimating) return;
        
        const lastMove = this.moveHistory.pop();
        this.board = lastMove.board;
        this.currentPlayer = lastMove.player;
        
        this.renderBoard();
        this.updateUI();
        this.updatePlayerStats();
        
        if (this.moveHistory.length === 0) {
            document.getElementById('undo-btn').disabled = true;
        }
        
        this.gameState = 'playing';
    }

    // AI Implementation
    async makeAIMove() {
        if (this.gameState !== 'playing' || this.isAnimating) return;
        
        const move = this.getAIMove();
        if (move) {
            await this.makeMove(move.row, move.col, 'blue');
        }
    }

    getAIMove() {
        const validMoves = this.getValidMoves('blue');
        if (validMoves.length === 0) return null;
        
        switch (this.aiDifficulty) {
            case 'easy':
                return validMoves[Math.floor(Math.random() * validMoves.length)];
            case 'medium':
                return this.getMediumAIMove(validMoves);
            case 'hard':
                return this.getHardAIMove(validMoves);
            default:
                return validMoves[0];
        }
    }

    getValidMoves(player) {
        const moves = [];
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                if (this.board[row][col].owner === null || this.board[row][col].owner === player) {
                    moves.push({ row, col });
                }
            }
        }
        return moves;
    }

    getMediumAIMove(validMoves) {
        // Prefer moves that will cause explosions
        const explosionMoves = validMoves.filter(move => {
            const cell = this.board[move.row][move.col];
            return cell.dots + 1 >= cell.maxDots;
        });
        
        if (explosionMoves.length > 0) {
            return explosionMoves[Math.floor(Math.random() * explosionMoves.length)];
        }
        
        // Otherwise, prefer moves near opponent cells
        const strategicMoves = validMoves.filter(move => {
            const adjacent = this.getAdjacentCells(move.row, move.col);
            return adjacent.some(([r, c]) => this.board[r][c].owner === 'red');
        });
        
        if (strategicMoves.length > 0) {
            return strategicMoves[Math.floor(Math.random() * strategicMoves.length)];
        }
        
        return validMoves[Math.floor(Math.random() * validMoves.length)];
    }

    getHardAIMove(validMoves) {
        // Evaluate each move and choose the best one
        let bestMove = null;
        let bestScore = -Infinity;
        
        for (const move of validMoves) {
            const score = this.evaluateMove(move, 'blue');
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        return bestMove;
    }

    evaluateMove(move, player) {
        // Create a copy of the board to simulate the move
        const boardCopy = this.deepCopyBoard();
        const originalBoard = this.board;
        
        this.board = boardCopy;
        
        // Simulate the move
        this.board[move.row][move.col].owner = player;
        this.board[move.row][move.col].dots++;
        
        // Simulate explosions
        this.simulateExplosions(move.row, move.col, player);
        
        // Calculate score
        const score = this.calculateBoardScore(player);
        
        // Restore original board
        this.board = originalBoard;
        
        return score;
    }

    simulateExplosions(row, col, player) {
        if (this.board[row][col].dots >= this.board[row][col].maxDots) {
            this.board[row][col].dots = 0;
            
            const adjacent = this.getAdjacentCells(row, col);
            for (const [adjRow, adjCol] of adjacent) {
                this.board[adjRow][adjCol].owner = player;
                this.board[adjRow][adjCol].dots++;
                
                if (this.board[adjRow][adjCol].dots >= this.board[adjRow][adjCol].maxDots) {
                    this.simulateExplosions(adjRow, adjCol, player);
                }
            }
        }
    }

    calculateBoardScore(player) {
        let score = 0;
        const opponent = player === 'red' ? 'blue' : 'red';
        
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const cell = this.board[row][col];
                if (cell.owner === player) {
                    score += cell.dots + 1;
                } else if (cell.owner === opponent) {
                    score -= cell.dots + 1;
                }
            }
        }
        
        return score;
    }

    deepCopyBoard() {
        return this.board.map(row => 
            row.map(cell => ({ ...cell }))
        );
    }

    // Sound Effects
    playSound(type) {
        if (!this.soundEnabled) return;
        
        // Create audio context if it doesn't exist
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Generate different sounds for different actions
        switch (type) {
            case 'place':
                this.generateTone(440, 0.1, 0.05);
                break;
            case 'explode':
                this.generateTone(220, 0.2, 0.1);
                break;
            case 'win':
                this.generateWinSound();
                break;
        }
    }

    generateTone(frequency, duration, volume) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    generateWinSound() {
        const notes = [440, 554, 659, 880];
        notes.forEach((freq, i) => {
            setTimeout(() => this.generateTone(freq, 0.3, 0.1), i * 150);
        });
    }

    // Utility function for delays
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Settings Management
    changeBoardSize(size) {
        this.boardSize = parseInt(size);
        this.newGame();
    }

    changeGameMode(mode) {
        this.gameMode = mode;
        
        // Enable/disable difficulty selector
        const difficultySelect = document.getElementById('difficulty');
        difficultySelect.disabled = mode !== 'ai';
        
        // Update player names
        const player2Name = document.querySelector('#player2-card .player-name');
        player2Name.textContent = mode === 'ai' ? 'Computer' : 'Blue Player';
        
        this.newGame();
    }

    changeDifficulty(difficulty) {
        this.aiDifficulty = difficulty;
    }

    toggleSound(enabled) {
        this.soundEnabled = enabled;
    }

    toggleAnimations(enabled) {
        this.animationEnabled = enabled;
        document.body.classList.toggle('no-animations', !enabled);
    }

    // Event Listeners Setup
    setupEventListeners() {
        // Game controls
        document.getElementById('new-game-btn').addEventListener('click', () => this.newGame());
        document.getElementById('undo-btn').addEventListener('click', () => this.undoMove());
        document.getElementById('hint-btn').addEventListener('click', () => this.showHint());
        
        // Settings
        document.getElementById('board-size').addEventListener('change', (e) => {
            this.changeBoardSize(e.target.value);
        });
        
        document.getElementById('game-mode').addEventListener('change', (e) => {
            if (e.target.value === 'online') {
                this.showMultiplayerModal();
            } else {
                this.changeGameMode(e.target.value);
            }
        });
        
        document.getElementById('difficulty').addEventListener('change', (e) => {
            this.changeDifficulty(e.target.value);
        });
        
        document.getElementById('sound-toggle').addEventListener('change', (e) => {
            this.toggleSound(e.target.checked);
        });
        
        document.getElementById('animation-toggle').addEventListener('change', (e) => {
            this.toggleAnimations(e.target.checked);
        });
        
        // Modal controls
        document.getElementById('rules-toggle').addEventListener('click', () => {
            document.getElementById('rules-modal').style.display = 'block';
        });
        
        document.getElementById('close-rules').addEventListener('click', () => {
            document.getElementById('rules-modal').style.display = 'none';
        });
        
        document.getElementById('play-again-btn').addEventListener('click', () => {
            this.newGame();
        });
        
        // Multiplayer modal controls
        document.getElementById('close-multiplayer').addEventListener('click', () => {
            document.getElementById('multiplayer-modal').style.display = 'none';
        });
        
        document.getElementById('create-room-btn').addEventListener('click', () => {
            const playerName = document.getElementById('create-player-name').value.trim();
            if (playerName) {
                this.createRoom(playerName);
            } else {
                alert('Please enter your name');
            }
        });
        
        document.getElementById('join-room-btn').addEventListener('click', () => {
            const playerName = document.getElementById('join-player-name').value.trim();
            const roomId = document.getElementById('room-id-input').value.trim();
            if (playerName && roomId) {
                this.joinRoom(playerName, roomId);
            } else {
                alert('Please enter your name and room ID');
            }
        });
        
        document.getElementById('copy-room-id').addEventListener('click', () => {
            const roomId = document.getElementById('current-room-id').textContent;
            navigator.clipboard.writeText(roomId).then(() => {
                const button = document.getElementById('copy-room-id');
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                setTimeout(() => {
                    button.textContent = originalText;
                }, 2000);
            });
        });
        
        // Close modals when clicking outside
        window.addEventListener('click', (event) => {
            const rulesModal = document.getElementById('rules-modal');
            const winModal = document.getElementById('win-modal');
            const multiplayerModal = document.getElementById('multiplayer-modal');
            
            if (event.target === rulesModal) {
                rulesModal.style.display = 'none';
            }
            if (event.target === winModal) {
                winModal.style.display = 'none';
            }
            if (event.target === multiplayerModal) {
                multiplayerModal.style.display = 'none';
            }
        });
    }

    showHint() {
        if (this.gameState !== 'playing' || this.isAnimating) return;
        
        const validMoves = this.getValidMoves(this.currentPlayer);
        if (validMoves.length === 0) return;
        
        // Find the best move for the current player
        let bestMove = null;
        let bestScore = -Infinity;
        
        for (const move of validMoves) {
            const score = this.evaluateMove(move, this.currentPlayer);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        if (bestMove) {
            // Highlight the suggested move
            const cellElement = document.querySelector(`[data-row="${bestMove.row}"][data-col="${bestMove.col}"]`);
            cellElement.style.boxShadow = '0 0 20px #ffff00';
            cellElement.style.transform = 'scale(1.1)';
            
            setTimeout(() => {
                cellElement.style.boxShadow = '';
                cellElement.style.transform = '';
            }, 2000);
        }
    }

    // Multiplayer functionality
    showMultiplayerModal() {
        const modal = document.getElementById('multiplayer-modal');
        modal.style.display = 'block';
        
        // Initialize Socket.IO if not already done
        if (!this.socket) {
            this.initializeSocket();
        }
    }

    initializeSocket() {
        // Try to connect to Socket.IO server
        try {
            this.socket = io();
            this.setupSocketListeners();
            this.updateConnectionStatus('connecting', 'Connecting to server...');
        } catch (error) {
            console.error('Failed to initialize Socket.IO:', error);
            this.updateConnectionStatus('disconnected', 'Connection failed - run server first');
        }
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            this.updateConnectionStatus('connected', 'Connected to server');
        });

        this.socket.on('disconnect', () => {
            this.updateConnectionStatus('disconnected', 'Disconnected from server');
        });

        this.socket.on('roomCreated', (data) => {
            this.handleRoomCreated(data);
        });

        this.socket.on('roomJoined', (data) => {
            this.handleRoomJoined(data);
        });

        this.socket.on('playerJoined', (data) => {
            this.handlePlayerJoined(data);
        });

        this.socket.on('moveMade', (data) => {
            this.handleOnlineMove(data);
        });

        this.socket.on('error', (data) => {
            alert('Error: ' + data.message);
        });
    }

    updateConnectionStatus(status, message) {
        const indicator = document.getElementById('status-indicator');
        const text = document.getElementById('status-text');
        
        indicator.className = `status-indicator ${status}`;
        text.textContent = message;
    }

    handleRoomCreated(data) {
        document.getElementById('current-room-id').textContent = data.roomId;
        document.getElementById('room-info').style.display = 'block';
        this.currentRoomId = data.roomId;
        this.playerColor = data.player.color;
        this.isOnlineGame = true;
    }

    handleRoomJoined(data) {
        this.currentRoomId = data.roomId;
        this.playerColor = data.player.color;
        this.isOnlineGame = true;
        
        // Start the game
        this.startOnlineGame(data.gameState);
    }

    handlePlayerJoined(data) {
        if (data.gameState.gameStatus === 'playing') {
            this.startOnlineGame(data.gameState);
        }
    }

    startOnlineGame(gameState) {
        // Close the multiplayer modal
        document.getElementById('multiplayer-modal').style.display = 'none';
        
        // Set up the game state
        this.gameMode = 'online';
        this.gameState = 'playing';
        this.board = gameState.board;
        this.currentPlayer = gameState.currentPlayer;
        this.boardSize = gameState.boardSize;
        this.moveHistory = gameState.moveHistory;
        
        // Update UI
        this.renderBoard();
        this.updateUI();
        this.updatePlayerStats();
        
        // Update player names
        const player1Name = document.querySelector('#player1-card .player-name');
        const player2Name = document.querySelector('#player2-card .player-name');
        
        if (this.playerColor === 'red') {
            player1Name.textContent = 'You (Red)';
            player2Name.textContent = 'Opponent (Blue)';
        } else {
            player1Name.textContent = 'Opponent (Red)';
            player2Name.textContent = 'You (Blue)';
        }
    }

    handleOnlineMove(data) {
        this.board = data.gameState.board;
        this.currentPlayer = data.gameState.currentPlayer;
        this.moveHistory = data.gameState.moveHistory;
        
        if (data.gameState.gameStatus === 'ended') {
            this.gameState = 'ended';
            this.endGame();
        } else {
            this.renderBoard();
            this.updateUI();
            this.updatePlayerStats();
        }
    }

    async makeOnlineMove(row, col) {
        if (this.playerColor !== this.currentPlayer) {
            return;
        }
        
        this.socket.emit('makeMove', { row, col });
    }

    createRoom(playerName) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('createRoom', { playerName });
        } else {
            alert('Not connected to server. Please try again.');
        }
    }

    joinRoom(playerName, roomId) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('joinRoom', { playerName, roomId });
        } else {
            alert('Not connected to server. Please try again.');
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.game = new ColorWarsGame();
});

// Add some CSS for animation disabling
const style = document.createElement('style');
style.textContent = `
    .no-animations * {
        animation: none !important;
        transition: none !important;
    }
`;
document.head.appendChild(style); 