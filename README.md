# 🎵 Song Battle - Gamified DJ Requests with XRP Payments

**NSBEHacks 2026 - Ripple XRP Challenge Submission**

A decentralized, gamified jukebox where party-goers bid XRP on songs they want to hear next. Instead of chaotic song requests, the crowd engages in real-time "Song Battles" where the highest bidder wins.

## 🎯 The Problem

- DJs receive chaotic, unorganized song requests
- No fair system for prioritizing requests
- DJs make $0 from song requests
- Party-goers have no way to guarantee their song gets played

## ✨ The Solution

**Song Battle** turns every song request into a revenue event by:
- Allowing users to bid XRP on songs in head-to-head battles
- Creating a transparent, blockchain-verified bidding system
- Automatically managing payments through the XRP Ledger
- Giving the crowd agency while monetizing the DJ's time

## 🏆 Ripple XRP Challenge Integration

This project leverages the **XRP Ledger (XRPL)** for:

### Core XRPL Features Used:
1. **Automatic Wallet Generation** - Users get XRPL wallets created on first bid
2. **Testnet Payments** - Real XRP transactions on XRPL Testnet
3. **Payment Verification** - Backend verifies transactions before updating app state
4. **Transaction Transparency** - All bids are publicly verifiable on XRPL Explorer
5. **Fast Settlement** - XRPL's 3-5 second finality for instant user feedback

### Why XRPL?
- ⚡ **Speed**: 3-5 second transaction confirmation (perfect for live events)
- 💰 **Low Fees**: Minimal transaction costs (~0.00001 XRP)
- 🌐 **Testnet**: Free testnet XRP for development and demos
- 🔍 **Transparency**: Public ledger for trust and verification

## 🏗️ Architecture

### Tech Stack

**Frontend (Crowd App):**
- Expo React Native (cross-platform: iOS, Android, Web)
- Firebase Firestore (real-time bid updates)
- Firebase Authentication (anonymous users)

**Backend:**
- Firebase Cloud Functions (serverless)
- `xrpl.js` library (XRPL integration)
- Firestore transactions (atomic updates)

**Blockchain:**
- XRP Ledger Testnet
- Custodial wallet architecture (server-managed for hackathon simplicity)

### Payment Flow

```
User clicks "Boost Song A (+5 XRP)"
         ↓
Frontend: Call placeBid(songChoice: "songA", bidAmount: 5)
         ↓
Backend: Check if user has XRPL wallet
         ↓
Backend: If no wallet → Generate + Fund with 1000 XRP from master wallet
         ↓
Backend: Send 5 XRP from user wallet to battle escrow wallet
         ↓
Backend: Verify transaction confirmed on XRPL
         ↓
Backend: Update Firestore (songA.totalBids += 5)
         ↓
Frontend: Real-time listener updates UI
         ↓
Frontend: Show transaction hash + XRPL Explorer link
```

### Data Architecture

**Firestore Structure:**
```javascript
battles/current_battle: {
  status: "active",
  songA: { title: "...", artist: "...", totalBids: 45 },
  songB: { title: "...", artist: "...", totalBids: 30 },
  bids: { {userId}: { song: "songA", amount: 5 } }
}

users/{userId}/data/wallet: {
  address: "rN7n7...",  // XRPL address
  seed: "sEdT...",      // Private key (hackathon only!)
  balance: 995,         // Cached XRP balance
  fundingTxHash: "ABC..." // Initial funding transaction
}
```

## 🚀 Setup & Installation

### Prerequisites
- Node.js 18+ (for Firebase Functions)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Firebase account (free tier works)

### Backend Setup

1. **Install Dependencies:**
   ```bash
   cd nsbehacks-backend/functions
   npm install
   ```

2. **Generate Master Wallet:**
   ```bash
   node generateMasterWallet.js
   ```
   - Copy the wallet address
   - Fund it with 50,000 XRP: https://faucet.altnet.rippletest.net/

3. **Deploy Firebase Functions:**
   ```bash
   cd ../
   firebase deploy --only functions
   ```

### Frontend Setup

1. **Install Dependencies:**
   ```bash
   cd crowd-app
   npm install
   ```

2. **Configure Firebase:**
   - Update `fireBaseConfig.js` with your Firebase project credentials

3. **Run the App:**
   ```bash
   # For web
   npm run web

   # For mobile (Expo Go app)
   npm start
   ```

### Create Test Battle

Use Firebase Console to create a document:
- Collection: `battles`
- Document ID: `current_battle`
- Fields:
  ```json
  {
    "status": "active",
    "songA": { "title": "Blinding Lights", "artist": "The Weeknd", "totalBids": 0 },
    "songB": { "title": "Levitating", "artist": "Dua Lipa", "totalBids": 0 },
    "bids": {}
  }
  ```

## 🧪 Testing the XRPL Integration

### Test Flow:

1. **Open the app** (web or mobile)
2. **User authenticates** automatically (anonymous)
3. **Click "Boost Song A (+5)"**
   - Backend creates XRPL wallet for user
   - Backend funds wallet with 1000 XRP
   - Backend sends 5 XRP to battle escrow
   - Transaction confirmed on XRPL
   - UI updates with new total
4. **Verify on XRPL Explorer:**
   - Copy transaction hash from app
   - Visit: https://testnet.xrpl.org/transactions/{txHash}
   - See your payment on the public ledger!

### Expected Behavior:

- ✅ Wallet address displayed at top of screen
- ✅ Balance shows 995 XRP after first 5 XRP bid (1000 - 5)
- ✅ Transaction hash shown with "View on XRPL Explorer" link
- ✅ Firestore totals update only after XRPL confirmation
- ✅ Multiple users can bid simultaneously

### Troubleshooting:

**"Failed to fund new wallet"**
- Master wallet needs funding from faucet
- Check: https://testnet.xrpl.org/accounts/rQH8XdPYN9RYnXVJBj5aV9CebJtE8ugt8k

**"Payment failed"**
- User wallet might have insufficient balance
- Check wallet balance on XRPL explorer

**Firebase Functions timeout**
- First call after idle = cold start (10+ seconds)
- Subsequent calls are fast (<2 seconds)

## 📁 Project Structure

```
nsbehacks/
├── crowd-app/               # Frontend (Expo React Native)
│   ├── app/
│   │   └── index.js        # Main battle screen with wallet display
│   ├── fireBaseConfig.js   # Firebase configuration
│   └── package.json
│
├── nsbehacks-backend/       # Backend (Firebase Functions)
│   ├── functions/
│   │   ├── index.js        # placeBid function with XRPL integration
│   │   ├── xrplService.js  # XRPL wallet & payment service
│   │   ├── generateMasterWallet.js  # Setup script
│   │   └── package.json
│   └── firebase.json
│
└── README.md               # This file
```

## 🔑 Key Files for Judges

### Backend XRPL Integration:

**[nsbehacks-backend/functions/xrplService.js](nsbehacks-backend/functions/xrplService.js)**
- Core XRPL functionality
- Wallet generation, funding, payments
- Connection to XRPL Testnet
- Transaction verification

**[nsbehacks-backend/functions/index.js](nsbehacks-backend/functions/index.js)** (lines 38-107)
- `placeBid` function with XRPL payment flow
- User wallet creation/retrieval
- Payment verification before Firestore updates
- Error handling for XRPL failures

### Frontend Display:

**[crowd-app/app/index.js](crowd-app/app/index.js)** (lines 99-117)
- Wallet information display
- Transaction hash with explorer link
- Real-time balance updates

## 🎬 Demo Video

[Demo Video Link - To Be Added]

**Demo shows:**
1. User A places bid → Wallet created + funded with 1000 XRP
2. 5 XRP sent to battle escrow
3. Transaction visible on XRPL Testnet Explorer
4. Firestore totals update in real-time
5. User B places bid → Separate wallet, separate transaction
6. Both transactions verified on public ledger

## 🌟 Future Roadmap

**Phase 1 (Current - Hackathon MVP):**
- ✅ XRPL wallet generation
- ✅ Real XRP payments on Testnet
- ✅ Transaction verification
- ✅ Real-time bid updates

**Phase 2 (Post-Hackathon):**
- DJ Command Center (React dashboard)
- Spotify API integration (queue control)
- Battle timer & automatic resolution
- Winner payout distribution
- "Vibe Credit" reward system for losers

**Phase 3 (Production):**
- User-controlled wallets (XUMM/Crossmark integration)
- Mainnet deployment
- Enhanced security (KMS for wallet seeds)
- Advanced analytics for DJs
- Multi-battle support

## 🔐 Security Notes

**For Hackathon Demo:**
- Custodial wallets (server-managed)
- Seeds stored in Firestore (NOT production-safe!)
- Testnet only (no real money)

**For Production:**
- User-controlled wallets (XUMM SDK)
- No seed storage (non-custodial)
- Hardware wallet support
- KMS encryption for any server-managed keys

## 👥 Team

**Solo Developer** - Built for NSBEHacks 2026

## 📜 License

MIT License - Built for educational purposes

---

## 🎓 NSBEHacks 2026 Submission

**Challenge:** Ripple XRP Challenge
**Category:** DeFi / Real-World Application
**Devpost:** [Link to be added]

**Impact:**
- Solves real problem (chaotic DJ requests)
- Monetizes DJ time (new revenue stream)
- Showcases XRPL's speed & low fees
- Real-world use case for crypto payments

---

Built with ❤️ using XRP Ledger | NSBEHacks 2026
