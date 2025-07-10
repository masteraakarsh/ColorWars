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
        
        // Online sidebar tracking
        this.gameStartTime = null;
        this.gameTimeInterval = null;
        
        // Check if server is available for online play
        this.serverAvailable = this.checkServerAvailability();
        
        this.initializeGame();
        this.setupEventListeners();
        this.setupOnlineSidebarEvents();
        this.setupModalCloseEvents();
    }

    checkServerAvailability() {
        // Check if we're on GitHub Pages or similar static hosting
        const hostname = window.location.hostname;
        const isStaticHosting = hostname.includes('github.io') || 
                               hostname.includes('netlify.app') || 
                               hostname.includes('vercel.app') ||
                               window.location.protocol === 'file:';
        
        if (isStaticHosting) {
            // Disable online multiplayer button
            setTimeout(() => {
                const playOnlineBtn = document.getElementById('play-online-btn');
                if (playOnlineBtn) {
                    playOnlineBtn.disabled = true;
                    playOnlineBtn.textContent = 'Play Online (Server Required)';
                    playOnlineBtn.title = 'Online multiplayer requires a server. This is a static site.';
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
        
        // Complete cleanup of all animations and styles before re-rendering
        const allDots = boardElement.querySelectorAll('.dot');
        allDots.forEach(dot => {
            dot.classList.remove('expanding');
            dot.style.transform = '';
            dot.style.animation = '';
        });

        const allCells = boardElement.querySelectorAll('.cell');
        allCells.forEach(cell => {
            cell.classList.remove('exploding', 'chain-reaction', 'placing-dot');
            cell.style.transform = '';
            cell.style.animation = '';
        });
        
        // Clear the board and recreate from scratch
        boardElement.innerHTML = '';
        boardElement.className = `game-board size-${this.boardSize}`;

        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const cell = this.createCellElement(row, col);
                boardElement.appendChild(cell);
            }
        }

        // Force reflow to ensure proper layout
        boardElement.offsetHeight;
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
        
        // First move for each player starts with dots based on cell capacity
        if (isFirstMove) {
            // Start with 3 dots, but don't exceed cell's maximum capacity
            this.board[row][col].dots = Math.min(3, this.board[row][col].maxDots);
        } else {
            this.board[row][col].dots++;
        }

        // Play sound effect
        this.playSound('place');

        // Check for explosion (but not on first moves)
        if (!isFirstMove && this.board[row][col].dots >= this.board[row][col].maxDots) {
            await this.explode(row, col, player);
        }

        // Update UI - this will create the proper dot structure
        this.renderBoard();
        this.updatePlayerStats();
        
        // Add expanding animation to newly placed dots with improved timing
        this.addDotExpandingAnimation(row, col);

        // Check for win condition
        const winner = this.checkWinCondition();
        if (winner) {
            this.gameState = 'ended';
            this.endGame(winner);
        } else {
            this.switchPlayer();
        }
    }

    addDotExpandingAnimation(row, col) {
        // Use requestAnimationFrame to ensure DOM is updated before adding animation
        requestAnimationFrame(() => {
            const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (cellElement) {
                const dots = cellElement.querySelectorAll('.dot');
                
                if (dots.length > 0) {
                    // Clean up any existing expanding classes first
                    dots.forEach(dot => {
                        dot.classList.remove('expanding');
                        // Force reflow to ensure class removal takes effect
                        dot.offsetHeight;
                    });
                    
                    // Add expanding animation with proper timing
                    requestAnimationFrame(() => {
                        dots.forEach(dot => dot.classList.add('expanding'));
                        
                        // Clean up after animation completes
                        setTimeout(() => {
                            dots.forEach(dot => {
                                if (dot.parentElement) { // Check if dot still exists
                                    dot.classList.remove('expanding');
                                }
                            });
                        }, 500); // Match CSS animation duration
                    });
                }
            }
        });
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
        // Update both regular and online player displays
        for (let i = 1; i <= 4; i++) {
            const playerCard = document.getElementById(`player${i}-card`);
            if (playerCard) {
                if (i <= this.playerCount) {
                    playerCard.style.display = 'flex';
                    // Update active state
                    if (this.players[i-1] === this.currentPlayer) {
                        playerCard.classList.add('active');
                    } else {
                        playerCard.classList.remove('active');
                    }
                } else {
                    playerCard.style.display = 'none';
                }
            }
        }
        
        // Update online sidebar player list
        if (this.isOnlineGame) {
            this.updateOnlinePlayersList();
        }
    }

    endGame(winner) {
        this.gameState = 'ended';
        this.stopTimer(); // Stop timer when game ends
        this.stopGameTimer(); // Stop online game timer
        
        this.playSound('win');
        
        // Add end game message to online sidebar
        if (this.isOnlineGame) {
            const winnerName = this.connectedPlayers[winner]?.name?.replace(' (You)', '') || 
                             `${winner.charAt(0).toUpperCase() + winner.slice(1)} Player`;
            this.addOnlineMessage(`🎉 ${winnerName} wins!`, 'system');
            this.updateOnlineSidebarInfo();
        }
        
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
            // Ensure regular sidebar is shown for local games
            this.showRegularSidebar();
        } else {
            // For online games, keep the online sidebar
            this.updateOnlineSidebarInfo();
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
        
        // First move for each player starts with dots based on cell capacity
        if (isFirstMove) {
            // Start with 3 dots, but don't exceed cell's maximum capacity
            this.board[move.row][move.col].dots = Math.min(3, this.board[move.row][move.col].maxDots);
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
        // Only start timer if enabled and game is playing
        if (!this.timerEnabled || this.gameState !== 'playing') {
            return;
        }
        
        // Don't start timer for local multiplayer
        if (this.gameMode === 'local') {
            return;
        }
        
        this.stopTimer(); // Clear any existing timer
        
        this.timeLeft = 30;
        this.updateTimerDisplay();
        
        // Update online sidebar immediately
        if (this.isOnlineGame) {
            this.updateOnlineGameStatus();
        }
        
        this.turnTimer = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();
            
            // Update online sidebar timer
            if (this.isOnlineGame) {
                this.updateOnlineGameStatus();
            }
            
            if (this.timeLeft <= 0) {
                this.stopTimer();
                if (this.gameMode === 'online') {
                    this.addOnlineMessage('Time\'s up!', 'system');
                } else {
                    this.handleTimeUp();
                }
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
        const onlineTimeLeft = document.getElementById('online-time-left');
        
        if (timerDisplay) {
            timerDisplay.textContent = this.timeLeft;
        }
        
        // Update online sidebar timer as well
        if (onlineTimeLeft && this.isOnlineGame) {
            onlineTimeLeft.textContent = this.timeLeft;
            const onlineTimer = document.getElementById('online-timer');
            if (onlineTimer) {
                if (this.timeLeft <= 10) {
                    onlineTimer.classList.add('warning');
                } else {
                    onlineTimer.classList.remove('warning');
                }
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
            this.stopGameTimer();
            // Show regular sidebar when not in online mode
            this.showRegularSidebar();
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
        document.getElementById('play-online-btn').addEventListener('click', () => this.showMultiplayerModal());
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
            this.changeGameMode(e.target.value);
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
        
        // If not in an online game, reset the modal to initial state
        if (!this.isOnlineGame) {
            this.resetMultiplayerModal();
        }
        
        // Initialize Socket.IO if not already done
        if (!this.socket) {
            this.initializeSocket();
        }
    }

    resetMultiplayerModal() {
        const roomInfo = document.getElementById('room-info');
        const createSection = document.querySelector('.multiplayer-section:first-of-type');
        const joinSection = document.querySelector('.multiplayer-section:last-of-type');
        const divider = document.querySelector('.multiplayer-divider');

        // Hide room info
        if (roomInfo) {
            roomInfo.style.display = 'none';
            roomInfo.classList.remove('room-created-animation');
        }

        // Show create and join sections
        if (createSection) {
            createSection.style.display = 'block';
        }
        if (joinSection) {
            joinSection.style.display = 'block';
        }
        if (divider) {
            divider.style.display = 'block';
        }

        // Clear form inputs
        const inputs = document.querySelectorAll('#multiplayer-modal input[type="text"]');
        inputs.forEach(input => input.value = '');
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
        
        // Show online sidebar instead of waiting room UI
        this.showOnlineSidebar();
        this.addOnlineMessage(`Room created! Room ID: ${data.roomId}`, 'system');
        this.addOnlineMessage('Share the Room ID with friends to invite them!', 'system');
        
        // Show waiting room UI in modal
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
        
        // Show online sidebar
        this.showOnlineSidebar();
        this.addOnlineMessage(`Joined room ${data.roomId}`, 'join');
        
        // Check if game is ready to start or already started
        if (data.gameState.gameStatus === 'playing') {
            this.startOnlineGame(data.gameState);
        } else {
            // Show waiting room
            this.showWaitingRoom(data.gameState);
        }
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

    handlePlayerJoined(data) {
        // Update connected players information
        this.updateConnectedPlayersFromGameState(data.gameState);
        
        // Update host status if necessary
        if (data.gameState.hostId && data.gameState.hostId === this.socket.id) {
            this.isHost = true;
        }
        
        // Show notification that a player joined
        this.showPlayerJoinedNotification(data.player);
        this.addOnlineMessage(`${data.player.name} joined the game`, 'join');
        
        // Update online sidebar
        this.updateOnlineSidebarInfo();
        
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
        if (this.connectedPlayers[data.oldColor]) {
            const playerData = this.connectedPlayers[data.oldColor];
            delete this.connectedPlayers[data.oldColor];
            this.connectedPlayers[data.newColor] = {
                ...playerData,
                color: data.newColor
            };
        }
        
        // Update online sidebar
        this.updateOnlineSidebarInfo();
        this.addOnlineMessage(`Player changed color to ${data.newColor}`, 'system');
        
        // Update waiting room display if visible
        this.updateWaitingRoomDisplay();
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
        
        // Start game timer
        this.startGameTimer();
        
        // Update online sidebar for game start
        this.updateOnlineSidebarInfo();
        this.addOnlineMessage('Game started! Good luck!', 'system');
        
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

    handleOnlineMove(data) {
        // Clear any "move sent" messages
        this.addOnlineMessage(`${data.player.name} made a move`, 'system');
        
        // Update board state from server immediately
        this.board = data.gameState.board;
        this.currentPlayer = data.gameState.currentPlayer;
        this.moveHistory = data.gameState.moveHistory;
        this.gameState = data.gameState.gameStatus === 'ended' ? 'ended' : 'playing';
        
        // Comprehensive cleanup of all animations before updating
        this.clearAllAnimations();
        this.isAnimating = false;
        
        // Immediately update the board and UI
        this.renderBoard();
        this.updateUI();
        this.updatePlayerStats();
        
        // Update online sidebar with new game state
        this.updateOnlineSidebarInfo();
        
        if (data.gameState.gameStatus === 'ended') {
            this.showGameWinNotification(data.gameState.winner);
            this.endGame(data.gameState.winner);
            this.stopGameTimer();
            this.addOnlineMessage(`Game ended! Winner: ${data.gameState.winner}`, 'system');
        } else {
            // Start timer for the new current player
            if (this.gameState === 'playing') {
                this.startTimer();
            }
            
            // Show whose turn it is
            const currentPlayerInfo = this.connectedPlayers[this.currentPlayer];
            if (currentPlayerInfo) {
                if (this.currentPlayer === this.playerColor) {
                    this.addOnlineMessage('Your turn!', 'system');
                } else {
                    this.addOnlineMessage(`${currentPlayerInfo.name}'s turn`, 'system');
                }
            }
        }
        
        // Play sound for the move
        this.playSound('place');
    }

    handlePlayerDisconnected(data) {
        // Update player information
        if (this.connectedPlayers[data.player.color]) {
            this.connectedPlayers[data.player.color].connected = false;
            this.connectedPlayers[data.player.color].name = 'Waiting...';
        }
        
        this.addOnlineMessage(`${data.player.name} left the game`, 'leave');
        
        // Update online sidebar
        this.updateOnlineSidebarInfo();
        
        // Update waiting room if in waiting state
        if (this.gameState === 'waiting') {
            this.updateWaitingRoomDisplay();
        }
        
        // Show disconnection notification
        this.showPlayerDisconnectedNotification(data.player);
    }

    updateConnectionStatus(status, message) {
        const statusIndicator = document.getElementById('online-status-indicator');
        const statusText = document.getElementById('online-status-text');
        
        if (statusIndicator && statusText) {
            statusIndicator.className = `status-indicator ${status}`;
            statusText.textContent = message;
        }
        
        if (this.isOnlineGame) {
            this.addOnlineMessage(message, 'system');
        }
    }

    updateTurnTimer() {
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
        }
        
        this.timeLeft = 30;
        
        if (this.timerEnabled && this.gameState === 'playing') {
            // Update online sidebar timer immediately
            this.updateOnlineGameStatus();
            
            this.turnTimer = setInterval(() => {
                this.timeLeft--;
                
                // Update both regular timer and online sidebar timer
                this.updateTimerDisplay();
                this.updateOnlineGameStatus();
                
                if (this.timeLeft <= 0) {
                    this.stopTimer();
                    if (this.gameMode === 'online') {
                        // In online mode, server handles timeout
                        this.addOnlineMessage('Time\'s up!', 'system');
                    } else {
                        this.handleTimeUp();
                    }
                }
            }, 1000);
        }
    }

    async makeOnlineMove(row, col) {
        if (this.playerColor !== this.currentPlayer) {
            this.addOnlineMessage('It\'s not your turn!', 'system');
            return;
        }
        
        // Provide immediate visual feedback
        const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (cellElement) {
            cellElement.classList.add('placing-dot');
            setTimeout(() => {
                cellElement.classList.remove('placing-dot');
            }, 600);
        }
        
        // Stop timer for this turn
        this.stopTimer();
        
        // Send move to server
        this.socket.emit('makeMove', { row, col });
        
        // Show that move is being processed
        this.addOnlineMessage('Move sent...', 'system');
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

    showPlayerDisconnectedNotification(player) {
        // Create a notification for player leaving
        const notification = document.createElement('div');
        notification.className = 'disconnected-notification';
        notification.textContent = `${player.name} has left the game.`;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Hide notification after 3 seconds
        setTimeout(() => {
            notification.classList.add('hide');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 500);
        }, 3000);
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
            // Clear any inline transform styles that might interfere
            dot.style.transform = '';
            dot.style.animation = '';
        });
        
        const allCells = document.querySelectorAll('.cell');
        allCells.forEach(cell => {
            cell.classList.remove('exploding', 'chain-reaction', 'placing-dot');
            // Clear any inline styles from animations
            cell.style.transform = '';
            cell.style.animation = '';
        });

        // Force a reflow to ensure all changes take effect
        document.body.offsetHeight;
        
        // Re-render the board to ensure proper dot structure
        if (this.board && this.gameState !== 'setup') {
            requestAnimationFrame(() => {
                this.renderBoard();
            });
        }
    }

    showWaitingRoomUI() {
        const multiplayerModal = document.getElementById('multiplayer-modal');
        const roomInfo = document.getElementById('room-info');
        const createSection = document.querySelector('.multiplayer-section:first-of-type');
        const joinSection = document.querySelector('.multiplayer-section:last-of-type');
        const divider = document.querySelector('.multiplayer-divider');
        
        if (multiplayerModal) {
            multiplayerModal.style.display = 'block';
        }
        
        // Hide create and join sections
        if (createSection) {
            createSection.style.display = 'none';
        }
        if (joinSection) {
            joinSection.style.display = 'none';
        }
        if (divider) {
            divider.style.display = 'none';
        }
        
        // Show room info section
        if (roomInfo) {
            roomInfo.style.display = 'block';
            roomInfo.classList.add('room-created-animation');
        }
        
        // Update online sidebar if it's visible
        if (this.isOnlineGame) {
            this.updateOnlineSidebarInfo();
            this.addOnlineMessage('Waiting for players to join...', 'system');
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

    setupOnlineSidebarEvents() {
        // Copy Room ID button
        const copyRoomBtn = document.getElementById('copy-room-btn');
        if (copyRoomBtn) {
            copyRoomBtn.addEventListener('click', () => this.copyRoomId());
        }

        // Leave Room button
        const leaveRoomBtn = document.getElementById('leave-room-btn');
        if (leaveRoomBtn) {
            leaveRoomBtn.addEventListener('click', () => this.leaveOnlineRoom());
        }

        // Invite Friends button
        const inviteFriendsBtn = document.getElementById('invite-friends-btn');
        if (inviteFriendsBtn) {
            inviteFriendsBtn.addEventListener('click', () => this.showInviteFriends());
        }

        // Online Settings button
        const onlineSettingsBtn = document.getElementById('online-settings-btn');
        if (onlineSettingsBtn) {
            onlineSettingsBtn.addEventListener('click', () => this.showOnlineSettings());
        }

        // Start Online Game button
        const startOnlineGameBtn = document.getElementById('start-online-game-btn');
        if (startOnlineGameBtn) {
            startOnlineGameBtn.addEventListener('click', () => this.startGame());
        }
    }

    showOnlineSidebar() {
        const regularSidebar = document.getElementById('regular-sidebar');
        const onlineSidebar = document.getElementById('online-sidebar');
        
        if (regularSidebar && onlineSidebar) {
            // Add transition class for smooth animation
            regularSidebar.style.opacity = '0';
            setTimeout(() => {
                regularSidebar.style.display = 'none';
                onlineSidebar.style.display = 'block';
                onlineSidebar.style.opacity = '0';
                
                // Trigger reflow
                onlineSidebar.offsetHeight;
                
                onlineSidebar.style.opacity = '1';
                this.updateOnlineSidebarInfo();
            }, 150);
        }
    }

    showRegularSidebar() {
        const regularSidebar = document.getElementById('regular-sidebar');
        const onlineSidebar = document.getElementById('online-sidebar');
        
        if (regularSidebar && onlineSidebar) {
            // Add transition class for smooth animation
            onlineSidebar.style.opacity = '0';
            setTimeout(() => {
                onlineSidebar.style.display = 'none';
                regularSidebar.style.display = 'block';
                regularSidebar.style.opacity = '0';
                
                // Trigger reflow
                regularSidebar.offsetHeight;
                
                regularSidebar.style.opacity = '1';
            }, 150);
        }
    }

    updateOnlineSidebarInfo() {
        if (!this.isOnlineGame) return;

        // Update room information
        this.updateRoomInfo();
        
        // Update players list
        this.updateOnlinePlayersList();
        
        // Update game status
        this.updateOnlineGameStatus();
        
        // Update controls visibility
        this.updateOnlineControls();
        
        // Update statistics
        this.updateOnlineStats();
    }

    updateRoomInfo() {
        const roomIdElement = document.getElementById('online-room-id');
        const statusIndicator = document.getElementById('online-status-indicator');
        const statusText = document.getElementById('online-status-text');

        if (roomIdElement && this.currentRoomId) {
            roomIdElement.textContent = this.currentRoomId;
        }

        if (statusIndicator && statusText) {
            if (this.socket && this.socket.connected) {
                statusIndicator.className = 'status-indicator connected';
                statusText.textContent = 'Connected';
            } else {
                statusIndicator.className = 'status-indicator disconnected';
                statusText.textContent = 'Disconnected';
            }
        }
    }

    updateOnlinePlayersList() {
        const playersList = document.getElementById('online-players-list');
        if (!playersList) return;

        playersList.innerHTML = '';

        // Create player cards for all expected players
        for (let i = 0; i < this.playerCount; i++) {
            const color = this.players[i];
            const playerCard = document.createElement('div');
            playerCard.className = 'online-player-card';
            playerCard.id = `online-player-${color}`;

            if (this.connectedPlayers[color]) {
                const player = this.connectedPlayers[color];
                
                if (player.connected) {
                    playerCard.classList.remove('waiting');
                    if (this.currentPlayer === color && this.gameState === 'playing') {
                        playerCard.classList.add('current-turn');
                    }
                } else {
                    playerCard.classList.add('waiting');
                }

                playerCard.innerHTML = `
                    <div class="online-player-color player-${color}">
                        <div class="color-indicator ${player.connected ? 'connected' : 'disconnected'}"></div>
                    </div>
                    <div class="online-player-info">
                        <div class="online-player-name">${player.name}</div>
                        <div class="online-player-status">${player.connected ? 'Connected' : 'Waiting...'}</div>
                    </div>
                    <div class="online-player-cells">${this.countPlayerCells(color)}</div>
                `;
            } else {
                playerCard.classList.add('waiting');
                playerCard.innerHTML = `
                    <div class="online-player-color player-${color}">
                        <div class="color-indicator disconnected"></div>
                    </div>
                    <div class="online-player-info">
                        <div class="online-player-name">Waiting...</div>
                        <div class="online-player-status">Open slot</div>
                    </div>
                    <div class="online-player-cells">0</div>
                `;
            }

            playersList.appendChild(playerCard);
        }
    }

    updateOnlineGameStatus() {
        const gamePhase = document.getElementById('online-game-phase');
        const turnInfo = document.getElementById('online-turn-info');
        const currentPlayerSpan = document.getElementById('online-current-player');
        const timeLeft = document.getElementById('online-time-left');

        if (!gamePhase) return;

        if (this.gameState === 'waiting') {
            gamePhase.textContent = 'Waiting for players...';
            if (turnInfo) turnInfo.style.display = 'none';
        } else if (this.gameState === 'playing') {
            gamePhase.textContent = 'Game in progress';
            if (turnInfo) {
                turnInfo.style.display = 'flex';
                if (currentPlayerSpan) {
                    const playerName = this.connectedPlayers[this.currentPlayer]?.name?.replace(' (You)', '') || 
                                     `${this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1)} Player`;
                    currentPlayerSpan.textContent = `${playerName}'s turn`;
                }
                if (timeLeft) {
                    timeLeft.textContent = this.timeLeft;
                    const timerElement = document.getElementById('online-timer');
                    if (timerElement) {
                        if (this.timeLeft <= 10) {
                            timerElement.classList.add('warning');
                        } else {
                            timerElement.classList.remove('warning');
                        }
                    }
                }
            }
        } else if (this.gameState === 'ended') {
            gamePhase.textContent = 'Game finished';
            if (turnInfo) turnInfo.style.display = 'none';
        }
    }

    updateOnlineControls() {
        const startGameBtn = document.getElementById('start-online-game-btn');
        
        if (startGameBtn) {
            if (this.isHost && this.gameState === 'waiting') {
                // Check if all players are connected
                const connectedCount = Object.values(this.connectedPlayers).filter(p => p.connected).length;
                if (connectedCount >= 2) {
                    startGameBtn.style.display = 'block';
                    startGameBtn.disabled = false;
                } else {
                    startGameBtn.style.display = 'block';
                    startGameBtn.disabled = true;
                    startGameBtn.textContent = `Waiting for players (${connectedCount}/${this.playerCount})`;
                }
            } else {
                startGameBtn.style.display = 'none';
            }
        }
    }

    updateOnlineStats() {
        const totalMovesElement = document.getElementById('total-moves-count');
        const gameTimeElement = document.getElementById('game-time-display');

        if (totalMovesElement) {
            totalMovesElement.textContent = this.moveHistory.length;
        }

        if (gameTimeElement && this.gameStartTime) {
            const elapsed = Math.floor((Date.now() - this.gameStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            gameTimeElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    startGameTimer() {
        this.gameStartTime = Date.now();
        this.gameTimeInterval = setInterval(() => {
            this.updateOnlineStats();
        }, 1000);
    }

    stopGameTimer() {
        if (this.gameTimeInterval) {
            clearInterval(this.gameTimeInterval);
            this.gameTimeInterval = null;
        }
    }

    addOnlineMessage(message, type = 'system') {
        const messagesContainer = document.getElementById('messages-container');
        if (!messagesContainer) return;

        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}-message`;
        messageElement.innerHTML = `<span class="message-text">${message}</span>`;

        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Keep only last 10 messages
        const messages = messagesContainer.querySelectorAll('.message');
        if (messages.length > 10) {
            messages[0].remove();
        }
    }

    copyRoomId() {
        if (this.currentRoomId) {
            navigator.clipboard.writeText(this.currentRoomId).then(() => {
                this.addOnlineMessage('Room ID copied to clipboard!', 'system');
                
                // Show visual feedback
                const copyBtn = document.getElementById('copy-room-btn');
                if (copyBtn) {
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = '✓';
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                    }, 1000);
                }
            }).catch(() => {
                this.addOnlineMessage('Failed to copy Room ID', 'system');
            });
        }
    }

    leaveOnlineRoom() {
        if (this.socket && this.currentRoomId) {
            this.socket.emit('leaveRoom');
            this.isOnlineGame = false;
            this.connectedPlayers = {};
            this.currentRoomId = null;
            this.gameState = 'playing';
            this.stopGameTimer();
            
            // Show regular sidebar
            this.showRegularSidebar();
            
            // Reset to local game
            this.gameMode = 'local';
            this.newGame();
            
            // Reset multiplayer modal to initial state
            this.resetMultiplayerModal();
            
            this.addOnlineMessage('Left the room', 'leave');
        }
    }

    showInviteFriends() {
        if (this.currentRoomId) {
            const shareText = `Join my ColorWars game! Room ID: ${this.currentRoomId}`;
            if (navigator.share) {
                navigator.share({
                    title: 'ColorWars Game Invitation',
                    text: shareText,
                    url: window.location.href
                });
            } else {
                navigator.clipboard.writeText(shareText).then(() => {
                    this.addOnlineMessage('Invitation copied to clipboard!', 'system');
                });
            }
        }
    }

    showOnlineSettings() {
        const settingsModal = document.getElementById('online-settings-modal');
        if (settingsModal) {
            settingsModal.style.display = 'block';
            this.loadOnlineSettings();
        }
    }

    loadOnlineSettings() {
        // Load saved settings from localStorage or use defaults
        const settings = JSON.parse(localStorage.getItem('colorwars-online-settings') || '{}');
        
        // Apply settings to form elements
        this.applySettingsToForm(settings);
        
        // Set up settings form event listeners
        this.setupOnlineSettingsEvents();
    }

    applySettingsToForm(settings) {
        const elements = {
            'online-timer-enabled': settings.timerEnabled !== false,
            'online-timer-duration': settings.timerDuration || 30,
            'auto-start-enabled': settings.autoStart !== false,
            'rematch-enabled': settings.rematchEnabled !== false,
            'room-privacy': settings.roomPrivacy || 'private',
            'max-players': settings.maxPlayers || '2',
            'spectator-mode': settings.spectatorMode || false,
            'reconnect-timeout': settings.reconnectTimeout || 60,
            'sound-effects': settings.soundEffects !== false,
            'move-animations': settings.moveAnimations !== false,
            'turn-notifications': settings.turnNotifications !== false,
            'color-theme': settings.colorTheme || 'default',
            'chat-enabled': settings.chatEnabled !== false,
            'emoji-reactions': settings.emojiReactions !== false,
            'status-sharing': settings.statusSharing || false,
            'connection-quality': settings.connectionQuality || 'auto',
            'sync-frequency': settings.syncFrequency || 250,
            'lag-compensation': settings.lagCompensation !== false,
            'anonymous-mode': settings.anonymousMode || false,
            'block-invites': settings.blockInvites || false,
            'data-usage': settings.dataUsage || false
        };

        for (let [id, value] of Object.entries(elements)) {
            const element = document.getElementById(id);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = value;
                } else if (element.type === 'range') {
                    element.value = value;
                    // Update value display
                    const valueDisplay = document.getElementById(id.replace('-', '-value').replace('duration', 'value').replace('timeout', 'value').replace('frequency', 'value'));
                    if (valueDisplay) valueDisplay.textContent = value;
                } else {
                    element.value = value;
                }
            }
        }
    }

    setupOnlineSettingsEvents() {
        // Timer duration slider
        const timerSlider = document.getElementById('online-timer-duration');
        const timerValue = document.getElementById('timer-value');
        if (timerSlider && timerValue) {
            timerSlider.addEventListener('input', () => {
                timerValue.textContent = timerSlider.value;
            });
        }

        // Reconnect timeout slider
        const reconnectSlider = document.getElementById('reconnect-timeout');
        const reconnectValue = document.getElementById('reconnect-value');
        if (reconnectSlider && reconnectValue) {
            reconnectSlider.addEventListener('input', () => {
                reconnectValue.textContent = reconnectSlider.value;
            });
        }

        // Sync frequency slider
        const syncSlider = document.getElementById('sync-frequency');
        const syncValue = document.getElementById('sync-value');
        if (syncSlider && syncValue) {
            syncSlider.addEventListener('input', () => {
                syncValue.textContent = syncSlider.value;
            });
        }

        // Save settings button
        const saveBtn = document.getElementById('save-online-settings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveOnlineSettings());
        }

        // Reset settings button
        const resetBtn = document.getElementById('reset-online-settings');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetOnlineSettings());
        }

        // Close modal button
        const closeBtn = document.getElementById('close-online-settings');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.getElementById('online-settings-modal').style.display = 'none';
            });
        }
    }

    saveOnlineSettings() {
        const settings = {};
        const elements = [
            'online-timer-enabled', 'online-timer-duration', 'auto-start-enabled', 'rematch-enabled',
            'room-privacy', 'max-players', 'spectator-mode', 'reconnect-timeout',
            'sound-effects', 'move-animations', 'turn-notifications', 'color-theme',
            'chat-enabled', 'emoji-reactions', 'status-sharing',
            'connection-quality', 'sync-frequency', 'lag-compensation',
            'anonymous-mode', 'block-invites', 'data-usage'
        ];

        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                if (element.type === 'checkbox') {
                    settings[this.camelCase(id)] = element.checked;
                } else if (element.type === 'range') {
                    settings[this.camelCase(id)] = parseInt(element.value);
                } else {
                    settings[this.camelCase(id)] = element.value;
                }
            }
        });

        localStorage.setItem('colorwars-online-settings', JSON.stringify(settings));
        
        // Apply some settings immediately
        this.timerEnabled = settings.onlineTimerEnabled;
        this.timeLeft = settings.onlineTimerDuration;
        this.soundEnabled = settings.soundEffects;
        this.animationEnabled = settings.moveAnimations;

        // Show success message
        this.addOnlineMessage('Settings saved successfully!', 'system');
        
        // Close modal
        document.getElementById('online-settings-modal').style.display = 'none';
    }

    resetOnlineSettings() {
        localStorage.removeItem('colorwars-online-settings');
        this.loadOnlineSettings();
        this.addOnlineMessage('Settings reset to defaults', 'system');
    }

    camelCase(str) {
        return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
    }

    handleTimeUp() {
        // Handle time expiration for non-online games
        if (this.gameMode === 'ai') {
            // In AI mode, automatically make AI move if it's AI's turn
            if (this.currentPlayer === this.players[1]) {
                this.makeAIMove();
            } else {
                // Skip human player's turn
                this.switchPlayer();
                if (this.currentPlayer === this.players[1]) {
                    setTimeout(() => this.makeAIMove(), 500);
                }
            }
        } else if (this.gameMode === 'local') {
            // In local mode, just switch to next player
            this.switchPlayer();
        }
        
        this.playSound('place'); // Play notification sound
        this.updateUI();
        this.startTimer(); // Start timer for next player
    }

    // Improved modal handling for online games
    closeMultiplayerModal() {
        const modal = document.getElementById('multiplayer-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // If we were in an online game and close the modal, stay in online mode
        if (this.isOnlineGame && this.gameState === 'playing') {
            // Keep online sidebar visible during gameplay
            this.showOnlineSidebar();
        } else if (!this.isOnlineGame) {
            // Reset modal to initial state if not in online game
            this.resetMultiplayerModal();
        }
    }

    // Close all modals when clicking outside
    setupModalCloseEvents() {
        // Close multiplayer modal when clicking outside
        const multiplayerModal = document.getElementById('multiplayer-modal');
        if (multiplayerModal) {
            multiplayerModal.addEventListener('click', (event) => {
                if (event.target === multiplayerModal) {
                    this.closeMultiplayerModal();
                }
            });
        }

        // Close settings modal when clicking outside
        const settingsModal = document.getElementById('online-settings-modal');
        if (settingsModal) {
            settingsModal.addEventListener('click', (event) => {
                if (event.target === settingsModal) {
                    settingsModal.style.display = 'none';
                }
            });
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