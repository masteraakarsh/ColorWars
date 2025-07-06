// ColorWars Game Logic
class ColorWarsGame {
    constructor() {
        this.playerCount = 2; // Default to 2 players
        this.players = ['red', 'blue']; // Will be updated based on player count
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
        this.boardSize = this.boardSizeMap[this.playerCount];
        this.board = [];
        this.currentPlayerIndex = 0;
        this.currentPlayer = this.players[this.currentPlayerIndex];
        this.gameMode = 'local';
        this.gameState = 'playing'; // 'playing', 'ended'
        this.soundEnabled = true;
        this.animationEnabled = true;
        this.moveHistory = [];
        this.isAnimating = false;
        this.aiDifficulty = 'medium';
        
        // Timer properties
        this.turnTimer = null;
        this.timeLeft = 30;
        this.timerEnabled = true;
        
        // Player information
        this.playerNames = {};
        this.connectedPlayers = {};
        this.isOnlineGame = false;
        this.previousPlayerCount = 2; // Store previous player count for mode switching
        this.isHost = false; // Track if current player is the host
        
        // Check if server is available for online play
        this.serverAvailable = this.checkServerAvailability();
        
        this.initializeGame();
        this.setupEventListeners();
    }

    checkServerAvailability() {
        // Check if we're on GitHub Pages or similar static hosting
        const hostname = window.location.hostname;
        const isStaticHosting = hostname.includes('github.io') || 
                               hostname.includes('netlify.app') || 
                               hostname.includes('vercel.app') ||
                               window.location.protocol === 'file:';
        
        if (isStaticHosting) {
            // Disable online multiplayer option
            setTimeout(() => {
                const gameModeSelect = document.getElementById('game-mode');
                if (gameModeSelect) {
                    const onlineOption = gameModeSelect.querySelector('option[value="online"]');
                    if (onlineOption) {
                        onlineOption.disabled = true;
                        onlineOption.textContent = 'Online Multiplayer (Server Required)';
                    }
                }
            }, 100);
            return false;
        }
        return true;
    }

    setPlayerCount(count) {
        if (count < 2 || count > 4) {
            console.error('Player count must be between 2 and 4');
            return;
        }
        
        this.playerCount = count;
        this.players = this.playerColors[count];
        this.boardSize = this.boardSizeMap[count];
        this.currentPlayerIndex = 0;
        this.currentPlayer = this.players[this.currentPlayerIndex];
        
        // Initialize default player names for local games
        this.initializePlayerNames();
        
        this.initializeGame();
    }

    initializePlayerNames() {
        this.playerNames = {};
        this.connectedPlayers = {};
        
        for (let i = 0; i < this.playerCount; i++) {
            const color = this.players[i];
            const colorName = color.charAt(0).toUpperCase() + color.slice(1);
            
            // In AI mode, the second player is the computer
            if (this.gameMode === 'ai' && i === 1) {
                this.playerNames[color] = 'Computer';
            } else {
                this.playerNames[color] = `${colorName} Player`;
            }
            
            if (!this.isOnlineGame) {
                this.connectedPlayers[color] = {
                    name: this.playerNames[color],
                    color: color,
                    connected: true
                };
            }
        }
    }

    initializeGame() {
        this.createBoard();
        this.renderBoard();
        this.updatePlayerCardsVisibility();
        this.updateUI();
        this.resetPlayerStats();
        this.startTimer(); // Start timer for first player
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
        
        // Clear any lingering animation classes before destroying the board
        const allDots = boardElement.querySelectorAll('.dot');
        allDots.forEach(dot => {
            dot.classList.remove('expanding');
        });
        
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
        
        // Check if this empty cell can be clicked (first move for each player)
        if (!cellData.owner) {
            const isFirstMoveAllowed = this.moveHistory.length < this.playerCount;
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
        
        // In AI mode, only allow human player (first player) to click
        if (this.gameMode === 'ai' && this.currentPlayer !== this.players[0]) return;
        
        if (this.gameMode === 'online') {
            if (this.isValidMove(row, col)) {
                await this.makeOnlineMove(row, col);
            }
            return;
        }
        
        if (this.isValidMove(row, col)) {
            await this.makeMove(row, col, this.currentPlayer);
            
            if (this.gameState === 'playing') {
                // In AI mode, trigger AI move if it's now the AI's turn
                if (this.gameMode === 'ai' && this.currentPlayer === this.players[1]) {
                    setTimeout(() => this.makeAIMove(), 500);
                }
            }
        }
    }

    isValidMove(row, col) {
        const cell = this.board[row][col];
        
        // First move for each player can be on any empty cell
        if (this.moveHistory.length < this.playerCount && cell.owner === null) {
            return true;
        }
        
        // After first moves, players can only click their own cells
        return cell.owner === this.currentPlayer;
    }

    async makeMove(row, col, player) {
        // Stop the timer when a move is made
        this.stopTimer();
        
        // Check if this is a first move for this player
        const playerMoves = this.moveHistory.filter(move => move.player === player);
        const isFirstMove = playerMoves.length === 0;

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
            player: this.currentPlayer,
            move: { row, col }
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

        // Check for explosion (but not on first moves)
        if (!isFirstMove && this.board[row][col].dots >= this.board[row][col].maxDots) {
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
                
                // First clear any existing expanding classes to prevent conflicts
                dots.forEach(dot => dot.classList.remove('expanding'));
                
                // Then add expanding animation after a small delay
                setTimeout(() => {
                    dots.forEach(dot => dot.classList.add('expanding'));
                    
                    // Remove expanding class after animation completes
                    setTimeout(() => {
                        dots.forEach(dot => dot.classList.remove('expanding'));
                    }, 600); // Slightly longer than the longest CSS animation duration to ensure cleanup
                }, 10);
            }
        }, 100);

        // Check for win condition
        const winner = this.checkWinCondition();
        if (winner) {
            this.gameState = 'ended';
            this.endGame(winner);
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
        
        // Wait for explosion animation
        await this.delay(400);
        
        // Get adjacent cells
        const adjacentCells = this.getAdjacentCells(row, col);
        const chainReactionCells = [];
        
        // First, update all adjacent cells and identify which ones will chain explode
        for (const [adjRow, adjCol] of adjacentCells) {
            // Convert cell to current player's color and add dot
            this.board[adjRow][adjCol].owner = player;
            this.board[adjRow][adjCol].dots++;
            
            // Add chain reaction animation
            const adjCellElement = document.querySelector(`[data-row="${adjRow}"][data-col="${adjCol}"]`);
            adjCellElement.classList.add('chain-reaction');
            
            // Check if this cell should explode
            if (this.board[adjRow][adjCol].dots >= this.board[adjRow][adjCol].maxDots) {
                chainReactionCells.push([adjRow, adjCol]);
            }
        }
        
        // Update the board visualization to show the dots spreading
        this.renderBoard();
        
        // Wait for chain reaction animation
        await this.delay(300);
        
        // Remove explosion animation from original cell
        cellElement.classList.remove('exploding');
        
        // Remove chain reaction animations
        adjacentCells.forEach(([adjRow, adjCol]) => {
            const adjCellElement = document.querySelector(`[data-row="${adjRow}"][data-col="${adjCol}"]`);
            adjCellElement.classList.remove('chain-reaction');
        });
        
        // Now process chain explosions one by one with delays
        for (let i = 0; i < chainReactionCells.length; i++) {
            const [chainRow, chainCol] = chainReactionCells[i];
            
            // Add a small delay between chain explosions for visual clarity
            if (i > 0) {
                await this.delay(200);
            }
            
            // Recursively explode this cell
            await this.explode(chainRow, chainCol, player);
        }
        
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
        const playerCellCounts = {};
        let activePlayers = 0;
        let winner = null;
        
        // Count cells for each player
        for (let player of this.players) {
            const cellCount = this.countPlayerCells(player);
            playerCellCounts[player] = cellCount;
            if (cellCount > 0) {
                activePlayers++;
                winner = player;
            }
        }
        
        // Win condition: only one player has cells remaining (after all players have made their first move)
        if (this.moveHistory.length >= this.playerCount && activePlayers === 1) {
            return winner;
        }
        
        return null;
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
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerCount;
        this.currentPlayer = this.players[this.currentPlayerIndex];
        this.updateUI();
        this.startTimer(); // Start timer for next player
    }

    updateUI() {
        // Update turn indicator
        const turnIndicator = document.querySelector('.turn-indicator');
        const playerName = this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1) + ' Player';
        turnIndicator.textContent = `${playerName}'s Turn`;
        turnIndicator.className = `turn-indicator color-${this.currentPlayer}`;
        
        // Add turn alert animation
        this.showTurnAlert(playerName);
        
        // Update player cards
        for (let i = 0; i < this.playerCount; i++) {
            const player = this.players[i];
            const playerCard = document.getElementById(`player${i + 1}-card`);
            if (playerCard) {
                const isActive = this.currentPlayer === player;
                playerCard.classList.toggle('active', isActive);
                
                // Add pulse animation to active player
                if (isActive) {
                    playerCard.style.animation = 'pulse 1.5s ease-in-out infinite';
                } else {
                    playerCard.style.animation = '';
                }
            }
        }
        
        // Update game status
        this.updateGameStatus();
    }

    showTurnAlert(playerName) {
        // Don't show alerts for the first move or if animations are disabled
        if (this.moveHistory.length === 0 || !this.animationEnabled) return;
        
        // Add turn alert animation to turn indicator
        const turnIndicator = document.querySelector('.turn-indicator');
        turnIndicator.classList.add('turn-changed');
        
        // Remove the animation class after it completes
        setTimeout(() => {
            turnIndicator.classList.remove('turn-changed');
        }, 1000);
        
        // Show turn notification popup
        this.showTurnNotification(playerName);
        
        // Play turn sound
        if (this.soundEnabled) {
            this.playTurnSound();
        }
    }

    showTurnNotification(playerName) {
        // Remove any existing notification
        const existingNotification = document.querySelector('.turn-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Create new notification
        const notification = document.createElement('div');
        notification.className = 'turn-notification';
        notification.textContent = `${playerName}'s Turn!`;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Hide notification after 2 seconds
        setTimeout(() => {
            notification.classList.add('hide');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 500);
        }, 2000);
    }

    playTurnSound() {
        // Play a subtle notification sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);
    }

    updateGameStatus() {
        const statusElement = document.getElementById('game-status');
        if (this.gameState === 'playing') {
            if (this.moveHistory.length < this.playerCount) {
                if (this.gameMode === 'ai') {
                    statusElement.textContent = 'Playing vs Computer - Place your first dot anywhere to start (3 dots)!';
                } else {
                    statusElement.textContent = 'Place your first dot anywhere on the board to start (3 dots)!';
                }
            } else {
                if (this.gameMode === 'ai') {
                    if (this.currentPlayer === this.players[0]) {
                        statusElement.textContent = 'Your turn - Click on your own cells to add dots!';
                    } else {
                        statusElement.textContent = 'Computer is thinking...';
                    }
                } else {
                    statusElement.textContent = 'Click on your own cells to add dots and trigger chain reactions!';
                }
            }
        }
    }

    updatePlayerStats() {
        for (let i = 0; i < this.playerCount; i++) {
            const player = this.players[i];
            const cellCount = this.countPlayerCells(player);
            const cellsElement = document.getElementById(`${player}-cells`);
            if (cellsElement) {
                cellsElement.textContent = cellCount;
            }
        }
    }

    resetPlayerStats() {
        for (let i = 0; i < this.playerCount; i++) {
            const player = this.players[i];
            const cellsElement = document.getElementById(`${player}-cells`);
            if (cellsElement) {
                cellsElement.textContent = '0';
            }
        }
    }

    updatePlayerCardsVisibility() {
        // Show/hide player cards based on player count
        for (let i = 1; i <= 6; i++) {
            const playerCard = document.getElementById(`player${i}-card`);
            if (playerCard) {
                if (i <= this.playerCount) {
                    playerCard.style.display = 'flex';
                    
                    // Update player name and connection status
                    const color = this.players[i - 1];
                    const playerNameElement = playerCard.querySelector('.player-name');
                    const connectionStatus = playerCard.querySelector('.connection-status');
                    
                    if (playerNameElement) {
                        const playerInfo = this.connectedPlayers[color];
                        if (playerInfo) {
                            playerNameElement.textContent = playerInfo.name;
                            playerNameElement.title = `${playerInfo.name} (${color})`;
                            
                            // Add connection status indicator
                            if (!connectionStatus) {
                                const statusElement = document.createElement('div');
                                statusElement.className = 'connection-status';
                                playerCard.appendChild(statusElement);
                            }
                            
                            const statusElement = playerCard.querySelector('.connection-status');
                            if (statusElement) {
                                statusElement.className = `connection-status ${playerInfo.connected ? 'connected' : 'disconnected'}`;
                                statusElement.textContent = playerInfo.connected ? '●' : '○';
                                statusElement.title = playerInfo.connected ? 'Connected' : 'Disconnected';
                            }
                        }
                    }
                } else {
                    playerCard.style.display = 'none';
                }
            }
        }
    }

    endGame(winner) {
        this.gameState = 'ended';
        this.stopTimer(); // Stop timer when game ends
        
        this.playSound('win');
        
        // Show win modal
        const winModal = document.getElementById('win-modal');
        const winMessage = document.getElementById('win-message');
        const winStats = document.getElementById('win-stats');
        
        // Get winner name based on game mode
        let winnerName;
        if (this.isOnlineGame && this.connectedPlayers[winner]) {
            winnerName = this.connectedPlayers[winner].name;
            // Remove "(You)" suffix for display in win modal
            winnerName = winnerName.replace(' (You)', '');
        } else if (this.gameMode === 'ai' && winner === this.players[1]) {
            winnerName = 'Computer';
        } else {
            winnerName = this.playerNames[winner] || `${winner.charAt(0).toUpperCase() + winner.slice(1)} Player`;
        }
        
        winMessage.textContent = `${winnerName} Wins!`;
        winMessage.className = `color-${winner}`;
        
        // Generate stats for all players
        let statsHTML = `<div>Total Moves: ${this.moveHistory.length}</div>`;
        for (let player of this.players) {
            const cellCount = this.countPlayerCells(player);
            let playerDisplayName;
            
            if (this.isOnlineGame && this.connectedPlayers[player]) {
                playerDisplayName = this.connectedPlayers[player].name.replace(' (You)', '');
            } else if (this.gameMode === 'ai' && player === this.players[1]) {
                playerDisplayName = 'Computer';
            } else {
                playerDisplayName = this.playerNames[player] || `${player.charAt(0).toUpperCase() + player.slice(1)} Player`;
            }
            
            statsHTML += `<div>${playerDisplayName} Cells: ${cellCount}</div>`;
        }
        
        winStats.innerHTML = statsHTML;
        winModal.style.display = 'block';
        
        // Update game status
        document.getElementById('game-status').textContent = `Game Over! ${winnerName} dominates the board!`;
    }

    newGame() {
        this.gameState = 'playing';
        this.currentPlayerIndex = 0;
        this.currentPlayer = this.players[this.currentPlayerIndex];
        this.moveHistory = [];
        this.isAnimating = false;
        
        // Clear any lingering animations
        this.clearAllAnimations();
        
        document.getElementById('undo-btn').disabled = true;
        
        // Initialize player names for new game
        if (!this.isOnlineGame) {
            this.initializePlayerNames();
        }
        
        this.createBoard();
        this.renderBoard();
        this.updatePlayerCardsVisibility();
        this.updateUI();
        this.resetPlayerStats();
        this.startTimer(); // Start timer for new game
        
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
        
        // Update UI to show AI is thinking
        this.updateGameStatus();
        
        // In AI mode, the computer plays as the second player (index 1)
        const aiPlayer = this.players[1]; // Should be 'blue' in 2-player AI mode
        
        const move = this.getAIMove();
        if (move) {
            await this.makeMove(move.row, move.col, aiPlayer);
        }
    }

    getAIMove() {
        // In AI mode, the computer plays as the second player
        const aiPlayer = this.players[1]; // Should be 'blue' in 2-player AI mode
        const validMoves = this.getValidMoves(aiPlayer);
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
        const aiPlayer = this.players[1]; // AI player
        const strategicMoves = validMoves.filter(move => {
            const adjacent = this.getAdjacentCells(move.row, move.col);
            return adjacent.some(([r, c]) => {
                const cell = this.board[r][c];
                return cell.owner !== null && cell.owner !== aiPlayer;
            });
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
        const aiPlayer = this.players[1]; // AI player
        
        for (const move of validMoves) {
            const score = this.evaluateMove(move, aiPlayer);
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
        
        // Check if this is a first move for this player
        const playerMoves = this.moveHistory.filter(m => m.player === player);
        const isFirstMove = playerMoves.length === 0;
        
        // Simulate the move
        this.board[move.row][move.col].owner = player;
        
        // First move for each player starts with 3 dots
        if (isFirstMove) {
            this.board[move.row][move.col].dots = 3;
        } else {
            this.board[move.row][move.col].dots++;
        }
        
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
        
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const cell = this.board[row][col];
                if (cell.owner === player) {
                    score += cell.dots + 1;
                } else if (cell.owner !== null && cell.owner !== player) {
                    // Any opponent cell reduces the score
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

    // Timer methods
    startTimer() {
        // Only start timer when game is actually playing, not in waiting room
        if (!this.timerEnabled || this.gameState !== 'playing' || this.isOnlineGame && this.gameState === 'waiting') return;
        
        // Don't start timer for AI player in AI mode
        if (this.gameMode === 'ai' && this.currentPlayer === this.players[1]) return;
        
        this.stopTimer(); // Clear any existing timer
        this.timeLeft = 30;
        this.updateTimerDisplay();
        
        this.turnTimer = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();
            
            if (this.timeLeft <= 0) {
                this.onTimerExpired();
            }
        }, 1000);
    }

    stopTimer() {
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }
    }

    resetTimer() {
        this.timeLeft = 30;
        this.updateTimerDisplay();
    }

    updateTimerDisplay() {
        const timerDisplay = document.getElementById('timer-display');
        const timerContainer = document.getElementById('timer-container');
        
        if (timerDisplay) {
            timerDisplay.textContent = this.timeLeft;
            
            // Add warning style when time is running out
            if (this.timeLeft <= 10) {
                timerContainer.classList.add('timer-warning');
            } else {
                timerContainer.classList.remove('timer-warning');
            }
            
            // Add critical style when time is almost out
            if (this.timeLeft <= 5) {
                timerContainer.classList.add('timer-critical');
            } else {
                timerContainer.classList.remove('timer-critical');
            }
        }
    }

    onTimerExpired() {
        this.stopTimer();
        
        // In AI mode, don't expire timer for AI player
        if (this.gameMode === 'ai' && this.currentPlayer === this.players[1]) {
            return;
        }
        
        // Force a random move for the current player
        this.makeRandomMove();
    }

    makeRandomMove() {
        const validMoves = this.getValidMoves(this.currentPlayer);
        
        if (validMoves.length > 0) {
            // Pick a random valid move
            const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
            
            // Show timeout message
            this.showTimeoutMessage();
            
            // Make the move after a short delay
            setTimeout(() => {
                this.makeMove(randomMove.row, randomMove.col, this.currentPlayer);
            }, 1000);
        } else {
            // No valid moves available - this shouldn't happen in normal gameplay
            this.switchPlayer();
        }
    }

    showTimeoutMessage() {
        const playerName = this.playerNames[this.currentPlayer] || 
                          (this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1) + ' Player');
        
        // Create timeout notification
        const notification = document.createElement('div');
        notification.className = 'timeout-notification';
        notification.textContent = `${playerName} ran out of time! Making random move...`;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
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
        const playerCountSelect = document.getElementById('player-count');
        
        if (mode === 'ai') {
            difficultySelect.disabled = false;
            // AI mode only supports 2 players (human vs computer)
            this.previousPlayerCount = this.playerCount; // Save current selection
            playerCountSelect.disabled = true;
            playerCountSelect.value = '2';
            this.setPlayerCount(2);
            
            // Disable player names button in AI mode
            const setNamesBtn = document.getElementById('set-names-btn');
            if (setNamesBtn) {
                setNamesBtn.disabled = true;
                setNamesBtn.title = 'Player names are fixed in AI mode';
            }
        } else {
            difficultySelect.disabled = true;
            // Restore player count selection for other modes
            playerCountSelect.disabled = false;
            if (this.previousPlayerCount && mode !== 'online') {
                playerCountSelect.value = this.previousPlayerCount.toString();
                this.setPlayerCount(this.previousPlayerCount);
            }
            
            // Re-enable player names button
            const setNamesBtn = document.getElementById('set-names-btn');
            if (setNamesBtn) {
                setNamesBtn.disabled = false;
                setNamesBtn.title = 'Set custom names for players';
            }
        }
        
        // Reset to local multiplayer if switching away from online
        if (mode !== 'online') {
            this.isOnlineGame = false;
        }
        
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
        document.getElementById('set-names-btn').addEventListener('click', () => this.showPlayerNamesModal());
        document.getElementById('undo-btn').addEventListener('click', () => this.undoMove());
        document.getElementById('hint-btn').addEventListener('click', () => this.showHint());
        
        // Settings
        document.getElementById('player-count').addEventListener('change', (e) => {
            const count = parseInt(e.target.value);
            
            // Don't allow changing player count in AI mode
            if (this.gameMode === 'ai') {
                e.target.value = '2';
                return;
            }
            
            this.setPlayerCount(count);
            this.updatePlayerCardsVisibility();
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

        // Player names modal
        document.getElementById('close-player-names').addEventListener('click', () => {
            document.getElementById('player-names-modal').style.display = 'none';
        });
        
        document.getElementById('save-player-names').addEventListener('click', () => {
            this.savePlayerNames();
        });
        
        // Multiplayer modal controls
        document.getElementById('close-multiplayer').addEventListener('click', () => {
            document.getElementById('multiplayer-modal').style.display = 'none';
        });
        
        document.getElementById('create-room-btn').addEventListener('click', () => {
            const playerName = document.getElementById('create-player-name').value.trim();
            const playerColor = document.getElementById('create-player-color').value;
            if (playerName) {
                this.createRoom(playerName, playerColor);
            } else {
                alert('Please enter your name');
            }
        });
        
        document.getElementById('join-room-btn').addEventListener('click', () => {
            const playerName = document.getElementById('join-player-name').value.trim();
            const playerColor = document.getElementById('join-player-color').value;
            const roomId = document.getElementById('room-id-input').value.trim();
            if (playerName && roomId) {
                this.joinRoom(playerName, roomId, playerColor);
            } else {
                alert('Please enter your name and room ID');
            }
        });

        document.getElementById('copy-room-id').addEventListener('click', () => {
            const roomId = document.getElementById('current-room-id').textContent;
            navigator.clipboard.writeText(roomId).then(() => {
                const btn = document.getElementById('copy-room-id');
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 2000);
            }).catch(() => {
                alert('Failed to copy room ID. Please copy it manually: ' + roomId);
            });
        });
        
        // Add event listener for waiting room color selection (will be added dynamically)
        document.addEventListener('change', (event) => {
            if (event.target.id === 'waiting-room-color') {
                this.handleWaitingRoomColorChange(event.target.value);
            }
        });
        
        // Close modals when clicking outside
        window.addEventListener('click', (event) => {
            const rulesModal = document.getElementById('rules-modal');
            const winModal = document.getElementById('win-modal');
            const multiplayerModal = document.getElementById('multiplayer-modal');
            const playerNamesModal = document.getElementById('player-names-modal');
            
            if (event.target === rulesModal) {
                rulesModal.style.display = 'none';
            }
            if (event.target === winModal) {
                winModal.style.display = 'none';
            }
            if (event.target === multiplayerModal) {
                multiplayerModal.style.display = 'none';
            }
            if (event.target === playerNamesModal) {
                playerNamesModal.style.display = 'none';
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

    showPlayerNamesModal() {
        if (this.isOnlineGame) {
            alert('Color selection is only available in the waiting room for online games');
            return;
        }
        
        if (this.gameMode === 'ai') {
            alert('Player names are fixed in AI mode (Human vs Computer)');
            return;
        }
        
        if (this.gameState === 'playing') {
            alert('Color selection is only available when the game is not in progress');
            return;
        }
        
        const modal = document.getElementById('player-names-modal');
        const inputsContainer = document.getElementById('player-name-inputs');
        
        // Clear existing inputs
        inputsContainer.innerHTML = '';
        
        // Available colors for selection
        const allColors = ['red', 'blue', 'green', 'yellow'];
        
        // Create input for each player
        for (let i = 0; i < this.playerCount; i++) {
            const color = this.players[i];
            const playerInfo = this.connectedPlayers[color];
            
            const inputGroup = document.createElement('div');
            inputGroup.className = 'player-name-input-group';
            
            const colorIndicator = document.createElement('div');
            colorIndicator.className = `player-color-indicator player-${color}`;
            
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'player-name-input';
            nameInput.placeholder = `${color.charAt(0).toUpperCase() + color.slice(1)} Player`;
            nameInput.value = playerInfo ? playerInfo.name.replace(' (You)', '') : '';
            nameInput.maxLength = 20;
            nameInput.dataset.color = color;
            nameInput.dataset.playerIndex = i;
            
            const colorSelect = document.createElement('select');
            colorSelect.className = 'player-color-select';
            colorSelect.dataset.playerIndex = i;
            colorSelect.dataset.originalColor = color;
            
            // Add options for all colors
            allColors.forEach(colorOption => {
                const option = document.createElement('option');
                option.value = colorOption;
                option.textContent = colorOption.charAt(0).toUpperCase() + colorOption.slice(1);
                option.selected = colorOption === color;
                colorSelect.appendChild(option);
            });
            
            // Add event listener for color change
            colorSelect.addEventListener('change', (e) => {
                this.handleColorChange(e.target);
            });
            
            inputGroup.appendChild(colorIndicator);
            inputGroup.appendChild(nameInput);
            inputGroup.appendChild(colorSelect);
            inputsContainer.appendChild(inputGroup);
        }
        
        modal.style.display = 'block';
    }

    handleColorChange(selectElement) {
        const playerIndex = parseInt(selectElement.dataset.playerIndex);
        const newColor = selectElement.value;
        const oldColor = selectElement.dataset.originalColor;
        
        // Update the color indicator
        const colorIndicator = selectElement.parentElement.querySelector('.player-color-indicator');
        colorIndicator.className = `player-color-indicator player-${newColor}`;
        
        // Update the player's name input dataset
        const nameInput = selectElement.parentElement.querySelector('.player-name-input');
        nameInput.dataset.color = newColor;
        
        // Update the original color reference
        selectElement.dataset.originalColor = newColor;
        
        // Disable the selected color in other dropdowns
        this.updateColorDropdowns();
    }

    updateColorDropdowns() {
        const colorSelects = document.querySelectorAll('.player-color-select');
        const selectedColors = Array.from(colorSelects).map(select => select.value);
        
        colorSelects.forEach(select => {
            const currentValue = select.value;
            const options = select.querySelectorAll('option');
            
            options.forEach(option => {
                // Disable if color is selected by another player
                option.disabled = selectedColors.includes(option.value) && option.value !== currentValue;
            });
        });
    }

    savePlayerNames() {
        const inputs = document.querySelectorAll('.player-name-input');
        const colorSelects = document.querySelectorAll('.player-color-select');
        
        // Get new color arrangement
        const newColors = Array.from(colorSelects).map(select => select.value);
        const newPlayerNames = {};
        const newConnectedPlayers = {};
        
        inputs.forEach((input, index) => {
            const color = newColors[index];
            const name = input.value.trim() || `${color.charAt(0).toUpperCase() + color.slice(1)} Player`;
            
            newPlayerNames[color] = name;
            newConnectedPlayers[color] = {
                name: name,
                color: color,
                connected: true
            };
        });
        
        // Update game state with new colors
        this.players = newColors;
        this.playerNames = newPlayerNames;
        this.connectedPlayers = newConnectedPlayers;
        
        // If current player's color changed, update current player
        if (!newColors.includes(this.currentPlayer)) {
            this.currentPlayer = newColors[this.currentPlayerIndex];
        }
        
        // Update board with new colors (if game is in progress)
        if (this.moveHistory.length > 0) {
            this.updateBoardColors();
        }
        
        // Update UI
        this.updatePlayerCardsVisibility();
        this.updateUI();
        this.renderBoard();
        
        // Close modal
        document.getElementById('player-names-modal').style.display = 'none';
    }

    updateBoardColors() {
        // This is a complex operation - we need to map old colors to new colors
        // For now, we'll just reset the game if colors are changed mid-game
        if (this.moveHistory.length > 0) {
            const confirmed = confirm('Changing colors will reset the current game. Continue?');
            if (confirmed) {
                this.newGame();
            }
        }
    }

    handleWaitingRoomColorChange(newColor) {
        if (!this.isOnlineGame || !this.socket) return;
        
        // Check if color is already taken (client-side validation)
        const takenColors = Object.values(this.connectedPlayers)
            .filter(player => player.connected && player.color !== this.playerColor)
            .map(player => player.color);
            
        if (takenColors.includes(newColor)) {
            alert('This color is already taken by another player');
            // Reset to current color
            document.getElementById('waiting-room-color').value = this.playerColor;
            return;
        }
        
        // Store the attempted color change in case we need to revert
        const previousColor = this.playerColor;
        
        // Emit color change to server
        this.socket.emit('changeColor', { newColor });
        
        // Set up a temporary error handler for this color change
        const errorHandler = (data) => {
            if (data.message && data.message.includes('color')) {
                // This is likely a color-related error, revert the dropdown
                const colorSelect = document.getElementById('waiting-room-color');
                if (colorSelect) {
                    colorSelect.value = previousColor;
                }
                alert('Color change failed: ' + data.message);
            }
        };
        
        // Listen for errors temporarily
        this.socket.once('error', errorHandler);
        
        // Remove the error handler after a short delay (in case the change succeeds)
        setTimeout(() => {
            this.socket.off('error', errorHandler);
        }, 1000);
    }

    updateWaitingRoomDisplay() {
        const playerList = document.getElementById('waiting-room-player-list');
        const myColorSelect = document.getElementById('waiting-room-color');
        
        if (!playerList || !myColorSelect) return;
        
        // Clear existing player list
        playerList.innerHTML = '';
        
        // Add all connected players to the list
        Object.values(this.connectedPlayers).forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'waiting-room-player-item';
            
            const colorIndicator = document.createElement('div');
            colorIndicator.className = `waiting-room-player-color player-${player.color}`;
            
            const playerName = document.createElement('div');
            playerName.className = 'waiting-room-player-name';
            playerName.textContent = player.name;
            
            const statusIndicator = document.createElement('div');
            statusIndicator.className = 'waiting-room-player-status';
            statusIndicator.textContent = player.connected ? '✓' : '...';
            statusIndicator.style.color = player.connected ? '#2ed573' : '#999';
            
            playerItem.appendChild(colorIndicator);
            playerItem.appendChild(playerName);
            playerItem.appendChild(statusIndicator);
            playerList.appendChild(playerItem);
        });
        
        // Update my color selection dropdown
        if (this.playerColor) {
            myColorSelect.value = this.playerColor;
            
            // Update available options (disable taken colors)
            const takenColors = Object.values(this.connectedPlayers)
                .filter(player => player.connected && player.color !== this.playerColor)
                .map(player => player.color);
                
            const options = myColorSelect.querySelectorAll('option');
            options.forEach(option => {
                option.disabled = takenColors.includes(option.value);
            });
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

        this.socket.on('playerDisconnected', (data) => {
            this.handlePlayerDisconnected(data);
        });

        this.socket.on('roomReady', (data) => {
            this.handleRoomReady(data);
        });

        this.socket.on('gameStarted', (data) => {
            this.handleGameStarted(data);
        });

        this.socket.on('moveMade', (data) => {
            this.handleOnlineMove(data);
        });

        this.socket.on('colorChanged', (data) => {
            this.handleColorChanged(data);
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
        this.currentRoomId = data.roomId;
        this.playerColor = data.player.color;
        this.isOnlineGame = true;
        this.isHost = data.player.isHost;
        
        // Initialize connected players
        this.connectedPlayers = {};
        this.connectedPlayers[data.player.color] = {
            name: `${data.player.name} (You)`,
            color: data.player.color,
            connected: true
        };
        
        // Initialize other player slots as waiting
        for (let i = 0; i < this.playerCount; i++) {
            const color = this.players[i];
            if (color !== data.player.color) {
                this.connectedPlayers[color] = {
                    name: 'Waiting...',
                    color: color,
                    connected: false
                };
            }
        }
        
        // Show waiting room UI
        this.showWaitingRoomUI();
        this.updatePlayerCardsVisibility();
        this.updateHostUI();
        this.updateWaitingRoomDisplay();
    }

    handleRoomJoined(data) {
        this.currentRoomId = data.roomId;
        this.playerColor = data.player.color;
        this.isOnlineGame = true;
        this.isHost = data.player.isHost;
        
        // Update player information from game state
        this.updateConnectedPlayersFromGameState(data.gameState);
        
        // Check if game is ready to start or already started
        if (data.gameState.gameStatus === 'playing') {
            this.startOnlineGame(data.gameState);
        } else {
            // Show waiting room
            this.showWaitingRoom(data.gameState);
        }
    }

    handlePlayerJoined(data) {
        // Update connected players information
        this.updateConnectedPlayersFromGameState(data.gameState);
        
        // Update host status if necessary
        if (data.gameState.hostId && data.gameState.hostId === this.socket.id) {
            this.isHost = true;
        }
        
        // Show notification that a player joined
        this.showPlayerJoinedNotification(data.player);
        
        if (data.gameState.gameStatus === 'playing') {
            this.startOnlineGame(data.gameState);
        } else {
            // Update UI to show new player joined
            this.updatePlayerCardsVisibility();
            this.updateHostUI();
            this.updateWaitingRoomDisplay();
        }
    }

    handleColorChanged(data) {
        // Update the player's color in connected players
        this.updateConnectedPlayersFromGameState(data.gameState);
        
        // If this is my color change, update my player color
        if (data.playerId === this.socket.id) {
            this.playerColor = data.newColor;
        }
        
        // Update the waiting room display
        this.updateWaitingRoomDisplay();
        
        // Show notification about color change
        const playerName = this.connectedPlayers[data.newColor]?.name || 'A player';
        this.showTurnNotification(`${playerName} changed to ${data.newColor}`, 'player-joined');
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
        this.playerCount = gameState.playerCount;
        this.players = gameState.players;
        
        // Update connected players information
        this.updateConnectedPlayersFromGameState(gameState);
        
        // Update UI
        this.renderBoard();
        this.updatePlayerCardsVisibility();
        this.updateUI();
        this.updatePlayerStats();
        
        // Start timer now that the game is actually playing
        this.startTimer();
        
        // Show room ID during gameplay
        this.showRoomIdDuringGame();
    }

    updateConnectedPlayersFromGameState(gameState) {
        // Initialize connected players if not already done
        if (!this.connectedPlayers) {
            this.connectedPlayers = {};
        }
        
        // Update player count and colors if provided
        if (gameState.playerCount) {
            this.playerCount = gameState.playerCount;
            this.players = gameState.players || this.playerColors[this.playerCount];
        }
        
        // Mark all players as waiting initially
        for (let i = 0; i < this.playerCount; i++) {
            const color = this.players[i];
            if (!this.connectedPlayers[color]) {
                this.connectedPlayers[color] = {
                    name: 'Waiting...',
                    color: color,
                    connected: false
                };
            }
        }
        
        // Update with actual connected players from server
        if (gameState.connectedPlayers) {
            for (let color in gameState.connectedPlayers) {
                const serverPlayerInfo = gameState.connectedPlayers[color];
                this.connectedPlayers[color] = {
                    name: this.playerColor === color ? `${serverPlayerInfo.name} (You)` : serverPlayerInfo.name,
                    color: serverPlayerInfo.color,
                    connected: serverPlayerInfo.connected
                };
            }
        }
        
        // Fill in any missing slots with waiting status
        for (let i = 0; i < this.playerCount; i++) {
            const color = this.players[i];
            if (!this.connectedPlayers[color] || !this.connectedPlayers[color].connected) {
                this.connectedPlayers[color] = {
                    name: 'Waiting...',
                    color: color,
                    connected: false
                };
            }
        }
    }

    handleOnlineMove(data) {
        this.board = data.gameState.board;
        this.currentPlayer = data.gameState.currentPlayer;
        this.moveHistory = data.gameState.moveHistory;
        
        // Clean up any animation states before updating
        this.clearAllAnimations();
        
        if (data.gameState.gameStatus === 'ended') {
            this.gameState = 'ended';
            this.showGameWinNotification(data.gameState.winner);
            this.endGame(data.gameState.winner);
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

    createRoom(playerName, playerColor) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('createRoom', { 
                playerName: playerName,
                playerColor: playerColor || 'blue',
                playerCount: this.playerCount
            });
        } else {
            alert('Not connected to server. Please try again.');
        }
    }

    joinRoom(playerName, roomId, playerColor) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('joinRoom', { 
                playerName, 
                roomId, 
                playerColor: playerColor || 'yellow' 
            });
        } else {
            alert('Not connected to server. Please try again.');
        }
    }

    showPlayerJoinedNotification(player) {
        // Don't show notification for yourself
        if (player.color === this.playerColor) {
            return;
        }
        
        // Create notification message
        const playerName = player.name || `${player.color.charAt(0).toUpperCase() + player.color.slice(1)} Player`;
        const message = `${playerName} joined the game!`;
        
        // Show turn notification (reusing the existing turn notification system)
        this.showTurnNotification(message, 'player-joined');
        
        // Play sound
        this.playSound('place');
    }

    showGameWinNotification(winner) {
        if (!winner) return;
        
        // Get winner name
        const winnerInfo = this.connectedPlayers[winner];
        const winnerName = winnerInfo ? winnerInfo.name : `${winner.charAt(0).toUpperCase() + winner.slice(1)} Player`;
        
        // Create win message
        let message;
        if (winner === this.playerColor) {
            message = `🎉 You won! 🎉`;
        } else {
            message = `${winnerName} wins the game!`;
        }
        
        // Show notification
        this.showTurnNotification(message, 'game-won');
        
        // Play win sound
        this.playSound('win');
    }

    handlePlayerDisconnected(data) {
        // Update connected players information
        this.updateConnectedPlayersFromGameState(data.gameState);
        
        // Show notification that a player disconnected
        this.showTurnNotification('A player disconnected from the game', 'player-left');
        
        // Update UI
        this.updatePlayerCardsVisibility();
    }

    handleRoomReady(data) {
        this.updateConnectedPlayersFromGameState(data.gameState);
        this.updateHostUI();
        
        if (this.isHost) {
            this.showTurnNotification('🎮 All players joined! You can start the game.', 'game-started');
        } else {
            this.showTurnNotification('⏳ Waiting for host to start the game...', 'game-started');
        }
    }

    showWaitingRoom(gameState) {
        // Don't close the multiplayer modal - show waiting room inside it
        
        // Set up waiting room state
        this.gameMode = 'online';
        this.gameState = 'waiting';
        this.playerCount = gameState.playerCount;
        this.players = gameState.players;
        
        // Update connected players information
        this.updateConnectedPlayersFromGameState(gameState);
        
        // Show waiting room UI with animation
        this.showWaitingRoomUI();
        
        // Update UI
        this.updatePlayerCardsVisibility();
        this.updateHostUI();
        this.updateWaitingRoomDisplay();
        
        // Stop timer during waiting room
        this.stopTimer();
    }

    updateHostUI() {
        // Add or remove start game button based on host status and room state
        const existingButton = document.getElementById('start-game-btn');
        
        if (this.isHost && this.gameState === 'waiting' && this.isOnlineGame) {
            if (!existingButton) {
                const startButton = document.createElement('button');
                startButton.id = 'start-game-btn';
                startButton.className = 'btn btn-primary';
                startButton.textContent = 'Start Game';
                startButton.onclick = () => this.startGame();
                
                const gameControls = document.querySelector('.game-controls');
                gameControls.appendChild(startButton);
            }
        } else {
            if (existingButton) {
                existingButton.remove();
            }
        }
    }

    startGame() {
        if (this.socket && this.socket.connected) {
            this.socket.emit('startGame');
        } else {
            alert('Not connected to server. Please try again.');
        }
    }

    handleGameStarted(data) {
        // Show notification that the game has started
        this.showTurnNotification('🎮 Game Started! All players joined!', 'game-started');
        
        // Play sound
        this.playSound('place');
        
        // Remove start game button if it exists
        const startButton = document.getElementById('start-game-btn');
        if (startButton) {
            startButton.remove();
        }
        
        // Start the actual game
        this.startOnlineGame(data.gameState);
    }

    clearAllAnimations() {
        // Remove all animation classes from dots and cells
        const allDots = document.querySelectorAll('.dot');
        allDots.forEach(dot => {
            dot.classList.remove('expanding');
        });
        
        const allCells = document.querySelectorAll('.cell');
        allCells.forEach(cell => {
            cell.classList.remove('exploding', 'chain-reaction', 'placing-dot');
        });
    }

    showWaitingRoomUI() {
        // Add room created animation and show waiting room
        const roomInfo = document.getElementById('room-info');
        const multiplayerContent = document.querySelector('.multiplayer-content');
        
        if (roomInfo && multiplayerContent) {
            // Hide the create/join sections
            const sections = multiplayerContent.querySelectorAll('.multiplayer-section, .multiplayer-divider');
            sections.forEach(section => {
                section.style.display = 'none';
            });
            
            // Show room info with animation
            roomInfo.style.display = 'block';
            roomInfo.classList.add('room-created-animation');
            
            // Remove animation class after animation completes
            setTimeout(() => {
                roomInfo.classList.remove('room-created-animation');
            }, 500);
        }
    }

    showRoomIdDuringGame() {
        // Create or update room ID display during gameplay
        let roomIdDisplay = document.getElementById('game-room-id');
        
        if (!roomIdDisplay) {
            roomIdDisplay = document.createElement('div');
            roomIdDisplay.id = 'game-room-id';
            roomIdDisplay.className = 'game-room-id';
            
            // Insert before the current turn indicator
            const currentTurn = document.getElementById('current-turn');
            currentTurn.parentNode.insertBefore(roomIdDisplay, currentTurn);
        }
        
        if (this.currentRoomId) {
            roomIdDisplay.innerHTML = `
                <div class="room-id-label">Room ID:</div>
                <div class="room-id-value">${this.currentRoomId}</div>
                <button class="room-id-copy" onclick="navigator.clipboard.writeText('${this.currentRoomId}')">📋</button>
            `;
            roomIdDisplay.style.display = 'flex';
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