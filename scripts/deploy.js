// Deployment script for PolkaCompress
// Uses ethers.js to deploy the Rust-based compressor (as a precompiled PolkaVM contract or EVM wrapper)
// and the Solidity CompressedStorage contract.
//
// NOTE:
// - You must provide the compiled artifacts (ABI + bytecode) for:
//   1. A compressor wrapper contract that calls into the PolkaVM Rust binary
//      (or the PolkaVM address directly, depending on how your toolchain exposes it).
//   2. The CompressedStorage.sol contract in ../contracts.
//
// This script is intentionally high-level so it can be adapted
// to the current Polkadot Hub Testnet tooling.

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  const rpcUrl =
    process.env.POLKADOT_HUB_TESTNET_RPC ||
    "https://your-polkadot-hub-testnet-rpc";
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("Set DEPLOYER_PRIVATE_KEY in your environment");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("Deployer:", wallet.address);

  // Load artifacts (replace paths with your build output)
  const compressorArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "artifacts", "Compressor.json"),
      "utf8"
    )
  );
  const storageArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "artifacts", "CompressedStorage.json"),
      "utf8"
    )
  );

  console.log("Deploying compressor (Rust/PolkaVM wrapper)...");
  const CompressorFactory = new ethers.ContractFactory(
    compressorArtifact.abi,
    compressorArtifact.bytecode,
    wallet
  );
  const compressor = await CompressorFactory.deploy();
  await compressor.waitForDeployment();
  const compressorAddress = await compressor.getAddress();
  console.log("Compressor deployed at:", compressorAddress);

  console.log("Deploying CompressedStorage...");
  const StorageFactory = new ethers.ContractFactory(
    storageArtifact.abi,
    storageArtifact.bytecode,
    wallet
  );
  const storage = await StorageFactory.deploy(compressorAddress);
  await storage.waitForDeployment();
  const storageAddress = await storage.getAddress();
  console.log("CompressedStorage deployed at:", storageAddress);

  console.log("\nExport these for the frontend:");
  console.log("NEXT_PUBLIC_STORAGE_ADDRESS=", storageAddress);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

