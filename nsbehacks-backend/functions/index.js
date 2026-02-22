// nsbehacks-backend/functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const xrplService = require("./xrplService");

// Initialize the Firebase Admin SDK
admin.initializeApp();

/**
 * Get user's XRPL wallet from Firestore
 * @param {string} userId - Firebase user ID
 * @return {Promise<Object|null>} Wallet object or null if doesn't exist
 */
async function getUserWallet(userId) {
  const db = admin.firestore();
  const userWalletDoc = await db.collection("users").doc(userId).collection("data").doc("wallet").get();

  if (userWalletDoc.exists) {
    return userWalletDoc.data();
  }
  return null;
}

/**
 * Save user's XRPL wallet to Firestore
 * @param {string} userId - Firebase user ID
 * @param {Object} wallet - Wallet object from xrplService
 * @param {string} fundingTxHash - Transaction hash of initial funding
 */
async function saveUserWallet(userId, wallet, fundingTxHash) {
  const db = admin.firestore();
  await db.collection("users").doc(userId).collection("data").doc("wallet").set({
    address: wallet.address,
    seed: wallet.seed, // For hackathon only - production would use encryption/KMS
    createdAt: wallet.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    fundingTxHash: fundingTxHash,
    balance: 50, // Initial funded amount
  });
  console.log(`Saved wallet for user ${userId}: ${wallet.address}`);
}

/**
 * Handles a user's bid on a song in the current battle.
 * This is a "Callable Function" that your front-end app will invoke directly.
 *
 * @param {object} data - The data sent from the client.
 * @param {string} data.songChoice - The song being bid on ('songA' or 'songB').
 * @param {number} data.bidAmount - The amount of XRP being bid.
 * @param {object} context - Authentication information about the user.
 * @param {string} context.auth.uid - The unique ID of the authenticated user.
 */
exports.placeBid = functions.https.onCall(async (data, context) => {
  // 1. Validate Input
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in to place a bid.",
    );
  }

  const {songChoice, bidAmount} = data;
  const userId = context.auth.uid;

  if ((songChoice !== "songA" && songChoice !== "songB") || bidAmount <= 0) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid song choice or bid amount.",
    );
  }

  // ===== XRPL PAYMENT INTEGRATION =====
  console.log(`Processing bid of ${bidAmount} XRP from user ${userId} for ${songChoice}`);

  // Get or create user's XRPL wallet
  let userWallet = await getUserWallet(userId);

  if (!userWallet) {
    console.log(`User ${userId} has no wallet. Creating and funding new wallet...`);

    // Generate new wallet for this user
    const newWallet = xrplService.generateWallet();

    // Fund the wallet with 50 XRP from master wallet (reduced for testnet demo)
    const fundingResult = await xrplService.fundWallet(newWallet.address, 50);

    if (!fundingResult.success) {
      throw new functions.https.HttpsError(
          "internal",
          `Failed to fund new wallet: ${fundingResult.error}`,
      );
    }

    // Save wallet to Firestore
    await saveUserWallet(userId, newWallet, fundingResult.txHash);

    // Use newly created wallet
    userWallet = newWallet;
    console.log(`New wallet created and funded: ${newWallet.address} (tx: ${fundingResult.txHash})`);
  }

  // Get battle escrow wallet (where all bids go)
  const escrowWallet = xrplService.getBattleEscrowWallet();
  console.log(`Battle escrow wallet: ${escrowWallet.address}`);

  // Send payment from user wallet to battle escrow
  console.log(`Sending ${bidAmount} XRP from ${userWallet.address} to ${escrowWallet.address}`);

  const paymentResult = await xrplService.sendPayment(
      userWallet,
      escrowWallet.address,
      bidAmount,
      {
        battleId: "current_battle",
        songChoice: songChoice,
        userId: userId,
      },
  );

  // Verify payment succeeded
  if (!paymentResult.success) {
    throw new functions.https.HttpsError(
        "internal",
        `Payment failed: ${paymentResult.error}`,
    );
  }

  console.log(`Payment successful! Transaction hash: ${paymentResult.txHash}`);

  // Update user's cached balance
  try {
    const newBalance = await xrplService.getBalance(userWallet.address);
    const db = admin.firestore();
    await db.collection("users").doc(userId).collection("data").doc("wallet").update({
      balance: newBalance,
    });
  } catch (balanceError) {
    console.warn("Failed to update cached balance:", balanceError);
    // Non-critical error, continue with bid placement
  }
  // ===== END XRPL PAYMENT INTEGRATION =====

  // 2. Update Firestore using a Transaction
  const db = admin.firestore();
  const battleRef = db.collection("battles").doc("current_battle");

  try {
    await db.runTransaction(async (transaction) => {
      const battleDoc = await transaction.get(battleRef);
      if (!battleDoc.exists) {
        throw new Error("Battle document does not exist!");
      }

      const battleData = battleDoc.data();

      // Ensure the battle is still active
      if (battleData.status !== "active") {
        throw new functions.https.HttpsError(
            "failed-precondition",
            "This battle is no longer active.",
        );
      }

      // Prepare the updates
      const newTotalBids = (battleData[songChoice].totalBids || 0) + bidAmount;
      const userBidPath = `bids.${userId}`; // Path for the user's bid in the map

      // Update the document
      transaction.update(battleRef, {
        [`${songChoice}.totalBids`]: newTotalBids,
        [userBidPath]: {
          song: songChoice,
          amount: bidAmount,
        },
      });
    });

    // Return success with transaction details
    return {
      success: true,
      message: "Bid placed successfully!",
      txHash: paymentResult.txHash,
      walletAddress: userWallet.address,
    };
  } catch (error) {
    console.error("Transaction failed: ", error);
    // Re-throw HTTPS errors, or wrap other errors
    if (error instanceof functions.https.HttpsError) {
      throw error;
    } else {
      throw new functions.https.HttpsError("internal", "Failed to place bid.");
    }
  }
});
