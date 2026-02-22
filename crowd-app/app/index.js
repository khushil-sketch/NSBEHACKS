import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, ActivityIndicator, Alert } from 'react-native';

// Firebase imports
import { doc, onSnapshot } from 'firebase/firestore';
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

  // Effect for handling user authentication
  useEffect(() => {
    // For a hackathon, anonymous sign-in is the fastest way to get a user ID
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("User is signed in anonymously with UID:", user.uid);
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

    console.log("User is signed in. Proceeding with bid.");
    setIsBidding(true);

    try {
      console.log("Preparing to call 'placeBid' function...");
      const placeBid = httpsCallable(functions, 'placeBid');
      const result = await placeBid({ songChoice: songChoice, bidAmount: 5 }); // Hardcoding 5 XRP for now

      console.log("Function call successful. Result:", result.data);
      Alert.alert("Success", "Your bid was placed!");
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
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 30 },
  battleContainer: { width: '100%' },
  songCard: { padding: 20, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  songTitle: { fontSize: 18, fontWeight: 'bold' },
  bidTotal: { fontSize: 24, fontWeight: 'bold', color: '#4A90E2', marginVertical: 10 },
  vs: { alignItems: 'center', marginVertical: 5 },
  vsText: { fontSize: 20, fontWeight: 'bold', color: '#888' },
  errorText: { color: 'red', fontSize: 16 },
  bidIndicator: { position: 'absolute' },
});