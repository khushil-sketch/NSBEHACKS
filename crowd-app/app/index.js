import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, ActivityIndicator, Alert } from 'react-native';

// Firebase imports
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// Import the initialized services from your central config file
import { db, auth, functions } from '../fireBaseConfig';

// --- Main App Component ---
export default function App() {
  const [battle, setBattle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isBidding, setIsBidding] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [lastTxHash, setLastTxHash] = useState(null);

  // Effect for handling user authentication and wallet loading
  useEffect(() => {
    // For a hackathon, anonymous sign-in is the fastest way to get a user ID
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("User is signed in anonymously with UID:", user.uid);

        // Try to load user's wallet from Firestore
        try {
          const walletRef = doc(db, `users/${user.uid}/data/wallet`);
          const walletSnap = await getDoc(walletRef);

          if (walletSnap.exists()) {
            const walletData = walletSnap.data();
            setWallet(walletData);
            console.log("Loaded wallet:", walletData.address);
          } else {
            console.log("No wallet found - will be created on first bid");
          }
        } catch (err) {
          console.error("Error loading wallet:", err);
        }
      } else {
        console.log("No user signed in, attempting to sign in...");
        signInAnonymously(auth).catch(e => console.error("Anonymous sign-in failed:", e));
      }
    });
    return unsubscribe; // Cleanup on unmount
  }, []);

  // Effect for listening to the 'current_battle' document
  useEffect(() => {
    setLoading(true);
    const battleRef = doc(db, 'battles', 'current_battle');

    const unsubscribe = onSnapshot(battleRef, (docSnap) => {
      if (docSnap.exists()) {
        console.log("Battle data updated:", docSnap.data());
        setBattle(docSnap.data());
        setError(null);
      } else {
        setError("No active battle found. The DJ needs to start one!");
        setBattle(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Firestore listener error:", err);
      setError("Failed to connect to the battle.");
      setLoading(false);
    });

    return () => unsubscribe(); // Cleanup the listener when the component unmounts
  }, []);

  // Function to call our 'placeBid' cloud function
  const handlePlaceBid = async (songChoice) => {
    console.log("handlePlaceBid called for:", songChoice);

    if (!auth.currentUser) {
      console.log("User not signed in yet. Aborting bid.");
      Alert.alert("Error", "You are not signed in yet. Please wait a moment and try again.");
      return;
    }

    console.log("User is signed in. UID:", auth.currentUser.uid);

    // Force token refresh to ensure we have a valid auth token
    try {
      const token = await auth.currentUser.getIdToken(true);
      console.log("Got fresh ID token:", token.substring(0, 20) + "...");
    } catch (err) {
      console.error("Failed to get ID token:", err);
      Alert.alert("Error", "Authentication issue. Please refresh the page.");
      return;
    }

    console.log("Proceeding with bid.");
    setIsBidding(true);

    try {
      console.log("Preparing to call 'placeBid' function...");
      const placeBid = httpsCallable(functions, 'placeBid', { timeout: 30000 }); // 30 second timeout for wallet creation
      const result = await placeBid({ songChoice: songChoice, bidAmount: 5 }); // Hardcoding 5 XRP for now

      console.log("Function call successful. Result:", result.data);

      // Store transaction hash
      if (result.data.txHash) {
        setLastTxHash(result.data.txHash);
        console.log("Transaction hash:", result.data.txHash);
      }

      // Update wallet state if returned
      if (result.data.walletAddress) {
        setWallet(prev => prev || { address: result.data.walletAddress });
      }

      Alert.alert(
        "Success!",
        `Bid placed successfully!\n\nTransaction: ${result.data.txHash?.substring(0, 16)}...`,
        [
          { text: "OK" },
          {
            text: "View on XRPL Explorer",
            onPress: () => console.log(`https://testnet.xrpl.org/transactions/${result.data.txHash}`)
          }
        ]
      );
    } catch (err) {
      console.error("Function call failed with error:", err);
      Alert.alert("Error", err.message || "Failed to place bid.");
    } finally {
      console.log("Executing finally block.");
      setIsBidding(false);
    }
  };

  if (loading) {
    return <View style={styles.container}><ActivityIndicator size="large" /><Text>Finding the party...</Text></View>;
  }

  if (error) {
    return <View style={styles.container}><Text style={styles.errorText}>{error}</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Song Battle!</Text>

      {/* Wallet Info */}
      {wallet && (
        <View style={styles.walletInfo}>
          <Text style={styles.walletLabel}>Your XRPL Wallet:</Text>
          <Text style={styles.walletAddress}>{wallet.address}</Text>
          <Text style={styles.walletBalance}>Balance: {wallet.balance || '...'} XRP</Text>
        </View>
      )}

      {/* Last Transaction */}
      {lastTxHash && (
        <View style={styles.txInfo}>
          <Text style={styles.txLabel}>Last Transaction:</Text>
          <Text style={styles.txHash}>{lastTxHash.substring(0, 24)}...</Text>
          <Text style={styles.explorerLink}>
            View on testnet.xrpl.org
          </Text>
        </View>
      )}

      {battle && battle.status === 'active' ? (
        <View style={styles.battleContainer}>
          <View style={styles.songCard}>
            <Text style={styles.songTitle}>{battle.songA.title}</Text>
            <Text>{battle.songA.artist}</Text>
            <Text style={styles.bidTotal}>{battle.songA.totalBids} XRP</Text>
            <Button title="Boost Song A (+5)" onPress={() => handlePlaceBid('songA')} disabled={isBidding} />
          </View>
          <View style={styles.vs}><Text style={styles.vsText}>VS</Text></View>
          <View style={styles.songCard}>
            <Text style={styles.songTitle}>{battle.songB.title}</Text>
            <Text>{battle.songB.artist}</Text>
            <Text style={styles.bidTotal}>{battle.songB.totalBids} XRP</Text>
            <Button title="Boost Song B (+5)" onPress={() => handlePlaceBid('songB')} disabled={isBidding} />
          </View>
        </View>
      ) : (
        <Text>Waiting for the DJ to start the next battle...</Text>
      )}
      {isBidding && <ActivityIndicator style={styles.bidIndicator} size="large" color="#0000ff" />}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 20 },
  walletInfo: { backgroundColor: '#f0f0f0', padding: 15, borderRadius: 8, width: '100%', marginBottom: 15 },
  walletLabel: { fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 5 },
  walletAddress: { fontSize: 12, fontFamily: 'monospace', color: '#333', marginBottom: 5 },
  walletBalance: { fontSize: 16, fontWeight: 'bold', color: '#4A90E2' },
  txInfo: { backgroundColor: '#e8f5e9', padding: 12, borderRadius: 8, width: '100%', marginBottom: 15 },
  txLabel: { fontSize: 12, fontWeight: 'bold', color: '#2e7d32', marginBottom: 3 },
  txHash: { fontSize: 11, fontFamily: 'monospace', color: '#1b5e20', marginBottom: 3 },
  explorerLink: { fontSize: 11, color: '#4A90E2', textDecorationLine: 'underline' },
  battleContainer: { width: '100%' },
  songCard: { padding: 20, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  songTitle: { fontSize: 18, fontWeight: 'bold' },
  bidTotal: { fontSize: 24, fontWeight: 'bold', color: '#4A90E2', marginVertical: 10 },
  vs: { alignItems: 'center', marginVertical: 5 },
  vsText: { fontSize: 20, fontWeight: 'bold', color: '#888' },
  errorText: { color: 'red', fontSize: 16 },
  bidIndicator: { position: 'absolute' },
});