# ColorWars 🎮

A strategic board game where players dominate the board by converting all opponent's cells into their color using strategic dot explosions and chain reactions.

![ColorWars Game Screenshot](https://via.placeholder.com/800x400/667eea/ffffff?text=ColorWars+Game+Board)

## 🎯 Game Overview

ColorWars is an engaging strategy game where two players compete to control the board through explosive chain reactions. Place dots strategically to trigger massive chain reactions that convert opponent cells to your color!

### 🎲 Core Mechanics

- **Turn-Based Gameplay**: Players alternate placing dots on the board
- **Strategic Placement**: Place dots only on empty cells or your own cells
- **Critical Mass**: Each cell has a maximum dot capacity based on its position
- **Chain Reactions**: Exploding cells trigger cascading reactions across the board
- **Total Domination**: Win by eliminating all opponent dots from the board

### 💥 Explosion Rules

| Cell Position | Max Dots | Adjacent Cells |
|---------------|----------|----------------|
| Corner        | 2        | 2 neighbors    |
| Edge          | 3        | 3 neighbors    |
| Center        | 4        | 4 neighbors    |

When a cell reaches its maximum capacity, it explodes:
- Sends 1 dot to each adjacent cell
- Converts adjacent opponent cells to your color
- Can trigger chain reactions in neighboring cells

## 🚀 Quick Start

### Local Play (No Installation Required)

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/colorwars-game.git
   cd colorwars-game
   ```

2. Open `index.html` in your web browser

3. Start playing locally with a friend!

### Online Multiplayer Setup

1. Install Node.js dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open `http://localhost:3000` in your browser

4. Share the URL with friends to play online!

## 🎮 Game Features

### 🎯 Game Modes

- **Local Multiplayer**: Play with a friend on the same device
- **vs Computer**: Challenge AI opponents with 3 difficulty levels
- **Online Multiplayer**: Play with friends over the internet

### 🎨 Visual Features

- **Beautiful Animations**: Smooth explosion and chain reaction effects
- **Modern UI**: Clean, responsive design with gradient backgrounds
- **Sound Effects**: Audio feedback for moves, explosions, and victories
- **Responsive Design**: Works on desktop, tablet, and mobile devices

### ⚙️ Customization Options

- **Board Sizes**: 6x6, 8x8, or 9x9 grids
- **AI Difficulty**: Easy, Medium, or Hard computer opponents
- **Sound Toggle**: Enable/disable sound effects
- **Animation Toggle**: Enable/disable visual animations

### 🔧 Game Controls

- **New Game**: Start a fresh game
- **Undo**: Take back your last move (local games only)
- **Hint**: Get AI suggestions for your next move
- **Rules**: View complete game rules and instructions

## 🎲 How to Play

### Basic Rules

1. **Choose Your Color**: Red goes first, followed by Blue
2. **Place Dots**: Click on empty cells or your own cells to add dots
3. **Trigger Explosions**: When a cell reaches its maximum capacity, it explodes
4. **Chain Reactions**: Explosions can trigger more explosions
5. **Dominate**: Win by eliminating all opponent dots

### Strategy Tips

- **Corner Control**: Corner cells explode with only 2 dots
- **Edge Advantage**: Edge cells are easier to trigger than center cells
- **Chain Planning**: Look for opportunities to create massive chain reactions
- **Defensive Play**: Sometimes it's better to build up your own cells
- **Timing**: The right move at the right time can flip the entire board

### Advanced Tactics

- **Sacrifice Plays**: Sometimes losing cells can set up bigger gains
- **Zone Control**: Dominate sections of the board systematically
- **Patience**: Don't rush - wait for the perfect chain reaction opportunity
- **Pattern Recognition**: Learn common explosion patterns

## 🏗️ Technical Details

### Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Real-time Communication**: Socket.IO
- **Styling**: Modern CSS with animations and responsive design
- **Audio**: Web Audio API for sound effects

### File Structure

```
colorwars-game/
├── index.html          # Main game interface
├── style.css           # Styling and animations
├── script.js           # Game logic and AI
├── server.js           # Online multiplayer server
├── package.json        # Dependencies and scripts
└── README.md          # This file
```

### Browser Compatibility

- **Chrome**: 60+ ✅
- **Firefox**: 55+ ✅
- **Safari**: 12+ ✅
- **Edge**: 79+ ✅
- **Mobile**: iOS Safari 12+, Android Chrome 60+ ✅

## 🤖 AI Implementation

The game features three AI difficulty levels:

- **Easy**: Random valid moves
- **Medium**: Prefers explosive moves and strategic positioning
- **Hard**: Evaluates all possible moves and chooses optimally

The AI uses a sophisticated evaluation function that considers:
- Board control percentage
- Potential chain reactions
- Strategic positioning
- Defensive considerations

## 🌐 Online Multiplayer

The online multiplayer mode supports:
- **Real-time Gameplay**: Instant move synchronization
- **Room System**: Create or join game rooms
- **Spectator Mode**: Watch ongoing games
- **Reconnection**: Resume games after disconnection
- **Player Statistics**: Track wins, losses, and game history

## 📱 Mobile Support

ColorWars is fully responsive and optimized for mobile devices:
- **Touch Controls**: Tap to place dots
- **Responsive Layout**: Adapts to screen size
- **Mobile-First Design**: Optimized for smaller screens
- **Accessibility**: Full keyboard and screen reader support

## 🎨 Customization

### Themes

The game supports easy customization:
- **Color Schemes**: Modify player colors in CSS
- **Board Sizes**: Adjustable from 4x4 to 12x12
- **Animation Speeds**: Configurable timing
- **Sound Packs**: Replaceable audio files

### Extending the Game

- **New Game Modes**: Add time limits, power-ups, or special cells
- **Tournament Mode**: Bracket-style competitions
- **Statistics**: Detailed game analytics
- **Replays**: Save and replay games

## 🐛 Troubleshooting

### Common Issues

1. **Game Not Loading**: Check browser console for errors
2. **Sounds Not Playing**: Ensure audio is enabled in browser
3. **Online Mode Issues**: Verify server is running and ports are open
4. **Performance**: Disable animations on slower devices

### Debug Mode

Add `?debug=true` to the URL to enable debug features:
- Move validation visualization
- AI decision explanations
- Performance metrics

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/colorwars-game.git

# Install dependencies
npm install

# Start development server
npm run dev

# The game will be available at http://localhost:3000
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎉 Acknowledgments

- Game concept inspired by classic chain reaction games
- UI design influenced by modern web game aesthetics
- Sound effects generated using Web Audio API
- Special thanks to the open-source community

## 🚀 AWS Deployment

### Option 1: AWS Elastic Beanstalk (Recommended)

1. **Install AWS CLI and EB CLI**:
   ```bash
   # Install AWS CLI
   pip install awscli
   
   # Install EB CLI
   pip install awsebcli
   
   # Configure AWS credentials
   aws configure
   ```

2. **Initialize Elastic Beanstalk**:
   ```bash
   # In your project directory
   eb init
   
   # Select region (e.g., us-east-1)
   # Choose Node.js platform
   # Select latest Node.js version
   ```

3. **Create and Deploy**:
   ```bash
   # Create environment
   eb create colorwars-production
   
   # Deploy your app
   eb deploy
   
   # Open in browser
   eb open
   ```

### Option 2: AWS App Runner

1. **Create `apprunner.yaml`**:
   ```yaml
   version: 1.0
   runtime: nodejs18
   build:
     commands:
       build:
         - npm install
   run:
     runtime-version: 18.17.0
     command: npm start
     network:
       port: 3000
       env: PORT
   ```

2. **Deploy via AWS Console**:
   - Go to AWS App Runner
   - Connect your GitHub repository
   - Choose automatic deployment
   - Your app will be live!

### Option 3: AWS Lambda + API Gateway (Serverless)

1. **Install Serverless Framework**:
   ```bash
   npm install -g serverless
   serverless create --template aws-nodejs --path colorwars-serverless
   ```

2. **Configure `serverless.yml`**:
   ```yaml
   service: colorwars-game
   provider:
     name: aws
     runtime: nodejs18.x
   functions:
     app:
       handler: lambda.handler
       events:
         - http:
             path: /{proxy+}
             method: ANY
         - http:
             path: /
             method: ANY
   ```

### AWS Deployment Configuration Files

- ✅ `.ebextensions/` - Elastic Beanstalk configuration
- ✅ `buildspec.yml` - AWS CodeBuild configuration
- ✅ `package.json` - Optimized for AWS with Node.js 18.x
- ✅ Environment variables - Supports AWS PORT configuration

### Cost Estimation (Monthly)

- **Elastic Beanstalk (t3.micro)**: ~$8-15/month
- **App Runner**: ~$7-12/month  
- **Lambda**: ~$0-5/month (pay per use)

### Post-Deployment

Your game will be accessible at:
- **Elastic Beanstalk**: `https://colorwars-production.region.elasticbeanstalk.com`
- **App Runner**: `https://xxx.region.awsapprunner.com`
- **Lambda**: `https://xxx.execute-api.region.amazonaws.com`

## 📞 Support

Need help? Here are your options:

- **Issues**: Report bugs on GitHub Issues
- **Discussions**: Join conversations in GitHub Discussions
- **Wiki**: Check the project wiki for detailed guides
- **Community**: Join our Discord server for real-time help

---

**Ready to dominate the board? Start playing ColorWars now!** 🎮✨

*Created with ❤️ by the ColorWars Development Team* 