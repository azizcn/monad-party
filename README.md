# 🎮 MONAD PARTY GAME

> Web3 multiplayer 2D party game on **Monad Testnet** (Chain ID: 10143)  
> Up to 8 players · 1 MON entry fee · Winner takes the pot (minus 5% platform fee)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Solidity + Hardhat → Monad Testnet |
| Backend | Node.js + Express + Socket.io + Ethers.js |
| Frontend | React + Vite + RainbowKit + Wagmi + Framer Motion |
| AI | Anthropic Claude claude-haiku-4-5 (trivia, bots, game master) |
| State | Zustand + Socket.io real-time sync |

## Project Structure

```
monad-party/
├── contracts/          # Solidity smart contract + Hardhat config
│   ├── contracts/MonadPartyGame.sol
│   ├── scripts/deploy.js
│   └── hardhat.config.js
├── backend/            # Node.js game server
│   ├── server.js       # Express + Socket.io
│   ├── gameEngine.js   # Mini-game logic + scoring
│   ├── aiAgent.js      # Claude AI integration
│   └── socketHandlers.js
└── frontend/           # React + Vite UI
    └── src/
        ├── pages/      # HomePage, LobbyPage, GameRoom
        ├── components/ # GameCanvas, GameOver, mini-games
        └── store/      # Zustand stores (game + wallet)
```

## Prerequisites

- Node.js v18+
- MetaMask or compatible EVM wallet
- MON tokens from [faucet.monad.xyz](https://faucet.monad.xyz)
- Anthropic API key (for AI trivia & bots)

---

## 🚀 Setup & Run

### 1. Smart Contract Deployment

```bash
cd contracts
npm install

# Copy and fill in your env
cp .env.example .env
# Edit .env: add PRIVATE_KEY

# Deploy to Monad Testnet
npm run deploy:testnet
# ✅ Contract address auto-written to backend/.env + frontend/.env
```

### 2. Backend

```bash
cd backend
npm install

# Copy and fill in your env
cp .env.example .env
# Edit .env: add ANTHROPIC_API_KEY, CONTRACT_ADDRESS (from deploy step)

npm run dev
# Server starts on http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
npm install

# Copy and fill in your env
cp .env.example .env
# Edit .env: set VITE_CONTRACT_ADDRESS (from deploy step)

npm run dev
# App starts on http://localhost:5173
```

---

## 🎮 How to Play

1. Open [localhost:5173](http://localhost:5173)
2. Connect your MetaMask wallet (switch to Monad Testnet)
3. Click **QUICK PLAY** → approve 1 MON transaction → wait for matchmaking
   - OR: **CREATE ROOM** to host your own
   - OR: **FIND ROOM** to join an existing lobby
4. Click **READY** when in the waiting lobby
5. Host clicks **START GAME** (need ≥2 players)
6. Play through 3 mini-game rounds:
   - ⚔️ **Last Standing** — WASD to move, knock out opponents
   - 💰 **Coin Rush** — click coins to collect, most wins
   - 💣 **Bomb Dodge** — move your cursor, avoid explosions
   - 🧠 **Crypto Trivia** — first correct answer wins
   - 🏔️ **Platform Survival** — platforms disappear, don't fall
7. Final scores tallied → on-chain payout to winner

---

## 🧪 Testing with 2 Windows

1. Open two browser windows, connect different MetaMask accounts
2. Window 1: Create Room → approve tx → wait in lobby
3. Window 2: Find Room → Join → approve tx → appears in lobby
4. Both click Ready → Window 1 (host) clicks Start Game

---

## Mini Games

| Game | Description | Duration |
|------|-------------|----------|
| Last Standing | Arena brawl, last alive wins | 90s |
| Coin Rush | Click coins, most collected wins | 30s |
| Bomb Dodge | Cursor-dodge bombs or get eliminated | 60s |
| Race | Checkpoint race (canvas game) | 60s |
| Trivia | AI-generated crypto question | 15s |
| Platform Survival | Platforms disappear, survive | 60s |

---

## Smart Contract Notes

- **Entry fee**: Exactly 1 MON (`1 * 10^18 wei`)
- **Platform fee**: 5% deducted from pot
- **endGame**: Called by backend operator wallet after determining winner
- **ReentrancyGuard** prevents double-spend attacks
- Deployed on Monad Testnet (chainId: 10143)

---

## Environment Variables Reference

### Backend `.env`
```
PORT=3001
FRONTEND_URL=http://localhost:5173
ANTHROPIC_API_KEY=sk-ant-...
PRIVATE_KEY=0x...  # Operator wallet private key
CONTRACT_ADDRESS=0x...
MONAD_RPC=https://testnet-rpc.monad.xyz
```

### Frontend `.env`
```
VITE_BACKEND_URL=http://localhost:3001
VITE_CONTRACT_ADDRESS=0x...
VITE_CHAIN_ID=10143
VITE_WALLETCONNECT_PROJECT_ID=...  # optional
```

---

## Links

- Monad Testnet Faucet: [faucet.monad.xyz](https://faucet.monad.xyz)
- Monad Explorer: [testnet.monadexplorer.com](https://testnet.monadexplorer.com)
- RPC: `https://testnet-rpc.monad.xyz`
- Chain ID: `10143`
