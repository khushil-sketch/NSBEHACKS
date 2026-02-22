// Quick script to generate master funding wallet for XRPL Testnet
const xrpl = require("xrpl");

async function generateMasterWallet() {
  console.log("Generating master wallet for XRPL Testnet...\n");
  console.log("Connecting to XRPL Testnet...");

  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
  await client.connect();

  console.log("Connected! Generating wallet and requesting testnet funds...\n");

  // Generate a new wallet and fund it from the testnet faucet
  const wallet = await client.fundWallet();

  console.log("=".repeat(60));
  console.log("MASTER WALLET GENERATED AND FUNDED!");
  console.log("=".repeat(60));
  console.log("Address:", wallet.wallet.address);
  console.log("Seed:", wallet.wallet.seed);
  console.log("Balance:", wallet.balance, "XRP");
  console.log("=".repeat(60));
  console.log("\nIMPORTANT: Save these credentials securely!");
  console.log("\n✅ Wallet automatically funded with", wallet.balance, "XRP");
  console.log("\nVerify on XRPL Explorer:");
  console.log("https://testnet.xrpl.org/accounts/" + wallet.wallet.address);
  console.log("\n");

  await client.disconnect();
  process.exit(0);
}

generateMasterWallet().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
