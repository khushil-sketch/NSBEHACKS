// Quick script to create a test battle in Firestore
const admin = require("firebase-admin");

// Initialize Firebase Admin
const serviceAccount = require("./serviceAccountKey.json"); // You'll need to download this from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function createTestBattle() {
  const battleRef = db.collection("battles").doc("current_battle");

  const testBattle = {
    status: "active",
    songA: {
      title: "Blinding Lights",
      artist: "The Weeknd",
      totalBids: 0,
    },
    songB: {
      title: "Levitating",
      artist: "Dua Lipa",
      totalBids: 0,
    },
    bids: {},
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await battleRef.set(testBattle);
  console.log("✅ Test battle created successfully!");
  console.log("Battle ID: current_battle");
  console.log("Song A:", testBattle.songA.title, "-", testBattle.songA.artist);
  console.log("Song B:", testBattle.songB.title, "-", testBattle.songB.artist);

  process.exit(0);
}

createTestBattle().catch(console.error);
