// nsbehacks-backend/functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize the Firebase Admin SDK
admin.initializeApp();

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

  // For the hackathon, we will stub the XRPL payment check.
  // In a real app, you would first verify a payment was received on the XRPL.
  // Once you integrate the xrpl.js library, you will 
  // replace that console.log with actual code to connect to the XRP Ledger
  console.log(
      `Received bid of ${bidAmount} from user ${userId} for ${songChoice}.`,
  );

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
    return {success: true, message: "Bid placed successfully!"};
    
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
