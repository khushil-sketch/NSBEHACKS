// XRPL Service for Song Battle App
// Handles wallet generation, payments, and transaction verification on XRP Ledger Testnet

const xrpl = require("xrpl");

// Master wallet credentials (generated for testnet - auto-funded with 100 XRP)
const MASTER_WALLET = {
  address: "rHaJxBQppcVSpUBMiyViRqQiRvTLM6jefm",
  seed: "sEdTKuknME769bmxbVrrKmka93q8q7Q",
};

// Battle escrow wallet (will be generated on first use)
let battleEscrowWallet = null;

// XRPL client connection (reused across function calls)
let client = null;

/**
 * Connect to XRPL Testnet
 * Reuses existing connection if available
 */
async function getClient() {
  if (client && client.isConnected()) {
    return client;
  }

  client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
  await client.connect();
  console.log("Connected to XRPL Testnet");
  return client;
}

/**
 * Generate a new XRPL wallet
 * @return {Object} Wallet object with address and seed
 */
function generateWallet() {
  const wallet = xrpl.Wallet.generate();
  console.log("Generated new wallet:", wallet.address);

  return {
    address: wallet.address,
    seed: wallet.seed,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Fund a wallet from the master wallet
 * @param {string} targetAddress - Address to fund
 * @param {number} amount - Amount of XRP to send
 * @return {Promise<Object>} Transaction result with hash and success status
 */
async function fundWallet(targetAddress, amount) {
  try {
    const xrplClient = await getClient();
    const masterWallet = xrpl.Wallet.fromSeed(MASTER_WALLET.seed);

    console.log(`Funding ${targetAddress} with ${amount} XRP from master wallet`);

    // Prepare payment transaction
    const payment = {
      TransactionType: "Payment",
      Account: MASTER_WALLET.address,
      Destination: targetAddress,
      Amount: xrpl.xrpToDrops(amount.toString()), // Convert XRP to drops (1 XRP = 1,000,000 drops)
      Memos: [{
        Memo: {
          MemoData: Buffer.from(JSON.stringify({
            purpose: "Initial wallet funding",
            app: "song-battle",
          })).toString("hex"),
        },
      }],
    };

    // Sign and submit transaction
    const prepared = await xrplClient.autofill(payment);
    const signed = masterWallet.sign(prepared);
    const result = await xrplClient.submitAndWait(signed.tx_blob);

    console.log("Funding transaction result:", result.result.meta.TransactionResult);

    if (result.result.meta.TransactionResult === "tesSUCCESS") {
      return {
        success: true,
        txHash: result.result.hash,
        validated: result.result.validated,
      };
    } else {
      return {
        success: false,
        error: result.result.meta.TransactionResult,
        txHash: result.result.hash,
      };
    }
  } catch (error) {
    console.error("Error funding wallet:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send XRP payment from one wallet to another
 * @param {Object} fromWallet - Wallet object with seed
 * @param {string} toAddress - Destination address
 * @param {number} amount - Amount of XRP to send
 * @param {Object} metadata - Optional metadata to include in memo
 * @return {Promise<Object>} Transaction result
 */
async function sendPayment(fromWallet, toAddress, amount, metadata = {}) {
  try {
    const xrplClient = await getClient();
    const wallet = xrpl.Wallet.fromSeed(fromWallet.seed);

    console.log(`Sending ${amount} XRP from ${wallet.address} to ${toAddress}`);

    // Prepare payment transaction with memo
    const payment = {
      TransactionType: "Payment",
      Account: wallet.address,
      Destination: toAddress,
      Amount: xrpl.xrpToDrops(amount.toString()),
      Memos: [{
        Memo: {
          MemoData: Buffer.from(JSON.stringify({
            app: "song-battle",
            ...metadata,
          })).toString("hex"),
        },
      }],
    };

    // Sign and submit transaction
    const prepared = await xrplClient.autofill(payment);
    const signed = wallet.sign(prepared);
    const result = await xrplClient.submitAndWait(signed.tx_blob);

    console.log("Payment transaction result:", result.result.meta.TransactionResult);
    console.log("Transaction hash:", result.result.hash);

    if (result.result.meta.TransactionResult === "tesSUCCESS") {
      return {
        success: true,
        txHash: result.result.hash,
        validated: result.result.validated,
        fee: result.result.Fee,
      };
    } else {
      return {
        success: false,
        error: result.result.meta.TransactionResult,
        txHash: result.result.hash,
      };
    }
  } catch (error) {
    console.error("Error sending payment:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get wallet balance in XRP
 * @param {string} address - XRPL address
 * @return {Promise<number>} Balance in XRP
 */
async function getBalance(address) {
  try {
    const xrplClient = await getClient();
    const response = await xrplClient.request({
      command: "account_info",
      account: address,
      ledger_index: "validated",
    });

    const balanceDrops = response.result.account_data.Balance;
    const balanceXRP = Number(xrpl.dropsToXrp(balanceDrops));

    console.log(`Balance for ${address}: ${balanceXRP} XRP`);
    return balanceXRP;
  } catch (error) {
    console.error("Error getting balance:", error);
    // If account doesn't exist yet, return 0
    if (error.data && error.data.error === "actNotFound") {
      return 0;
    }
    throw error;
  }
}

/**
 * Verify a transaction was successful
 * @param {string} txHash - Transaction hash
 * @return {Promise<Object>} Transaction details
 */
async function verifyTransaction(txHash) {
  try {
    const xrplClient = await getClient();
    const response = await xrplClient.request({
      command: "tx",
      transaction: txHash,
    });

    return {
      success: response.result.meta.TransactionResult === "tesSUCCESS",
      validated: response.result.validated,
      result: response.result.meta.TransactionResult,
      details: response.result,
    };
  } catch (error) {
    console.error("Error verifying transaction:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get or create battle escrow wallet
 * This wallet holds all bids during the battle
 * @return {Object} Escrow wallet with address and seed
 */
function getBattleEscrowWallet() {
  if (!battleEscrowWallet) {
    // For hackathon: Generate a dedicated escrow wallet
    // In production, this would be stored securely in Firebase config
    battleEscrowWallet = generateWallet();
    console.log("Battle escrow wallet created:", battleEscrowWallet.address);
  }
  return battleEscrowWallet;
}

/**
 * Disconnect from XRPL
 * Call this when Cloud Function is shutting down
 */
async function disconnect() {
  if (client && client.isConnected()) {
    await client.disconnect();
    console.log("Disconnected from XRPL");
  }
}

module.exports = {
  generateWallet,
  fundWallet,
  sendPayment,
  getBalance,
  verifyTransaction,
  getBattleEscrowWallet,
  getClient,
  disconnect,
  MASTER_WALLET,
};
