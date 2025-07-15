import { useState } from "react";
import { ethers } from "ethers";

// Minimal ABI for CompressedStorage
const STORAGE_ABI = [
  "event DataStored(uint256 id,uint256 originalSize,uint256 compressedSize)",
  "function storeData(bytes data) external returns (uint256)",
  "function retrieveData(uint256 id) external returns (bytes memory)",
];

export default function Home() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [storedId, setStoredId] = useState<number | null>(null);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  const [retrieved, setRetrieved] = useState<string | null>(null);

  // TODO: replace with deployed contract address
  const STORAGE_ADDRESS =
    process.env.NEXT_PUBLIC_STORAGE_ADDRESS ?? "0xYourStorageContract";

  async function getContract() {
    if (!(window as any).ethereum) {
      throw new Error("No injected wallet (MetaMask/Polkadot.js) found");
    }
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();
    return new ethers.Contract(STORAGE_ADDRESS, STORAGE_ABI, signer);
  }

  const handleStore = async () => {
    try {
      setStatus("Connecting wallet...");
      const contract = await getContract();

      const bytes = ethers.toUtf8Bytes(input);
      setOriginalSize(bytes.length);

      setStatus("Sending transaction...");
      const tx = await contract.storeData(bytes);
      setTxHash(tx.hash);

      setStatus("Waiting for confirmation...");
      const receipt = await tx.wait();

      let newId: number | null = null;
      let compSize: number | null = null;

      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed && parsed.name === "DataStored") {
            const [id, orig, comp] = parsed.args as any;
            newId = Number(id);
            setOriginalSize(Number(orig));
            compSize = Number(comp);
          }
        } catch {
          // ignore non-matching logs
        }
      }

      if (newId != null) {
        setStoredId(newId);
      }
      if (compSize != null) {
        setCompressedSize(compSize);
      }
      setStatus("Stored successfully");
    } catch (err: any) {
      console.error(err);
      setStatus(err.message ?? "Failed to store");
    }
  };

  const handleRetrieve = async () => {
    if (storedId == null) {
      setStatus("No id stored yet");
      return;
    }

    try {
      setStatus("Connecting wallet...");
      const contract = await getContract();

      setStatus("Calling retrieveData...");
      const bytes: Uint8Array = await contract.retrieveData(storedId);
      const text = ethers.toUtf8String(bytes);
      setRetrieved(text);
      setStatus("Retrieved and decompressed");
    } catch (err: any) {
      console.error(err);
      setStatus(err.message ?? "Failed to retrieve");
    }
  };

  const ratio =
    originalSize && compressedSize
      ? (compressedSize / originalSize).toFixed(2)
      : null;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at top left, #1e3a8a, #020617 60%, #020617)",
        color: "white",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          width: "100%",
          background: "rgba(15,23,42,0.95)",
          borderRadius: 24,
          padding: "2rem",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          border: "1px solid rgba(148,163,184,0.4)",
        }}
      >
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
          PolkaCompress
        </h1>
        <p style={{ color: "#9ca3af", marginBottom: 24 }}>
          Compress large JSON/text in Rust on PolkaVM, store compressed bytes
          via Solidity on Polkadot Hub Testnet.
        </p>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>1. Upload data</h2>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Paste JSON or text here...'
            style={{
              width: "100%",
              minHeight: 140,
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.5)",
              padding: 12,
              background: "#020617",
              color: "white",
              fontFamily: "monospace",
              fontSize: 14,
            }}
          />
          <button
            onClick={handleStore}
            style={{
              marginTop: 12,
              padding: "10px 20px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background:
                "linear-gradient(135deg,#22c55e,#16a34a,#0ea5e9,#6366f1)",
              backgroundSize: "200% 200%",
              color: "white",
              fontWeight: 600,
            }}
          >
            Store with Compression
          </button>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>2. Stats</h2>
          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              fontSize: 14,
            }}
          >
            <div>
              <span style={{ color: "#9ca3af" }}>Original size:</span>{" "}
              {originalSize != null ? `${originalSize} bytes` : "-"}
            </div>
            <div>
              <span style={{ color: "#9ca3af" }}>Compressed size:</span>{" "}
              {compressedSize != null ? `${compressedSize} bytes` : "-"}
            </div>
            <div>
              <span style={{ color: "#9ca3af" }}>Ratio:</span>{" "}
              {ratio ? `${ratio}x` : "-"}
            </div>
            <div>
              <span style={{ color: "#9ca3af" }}>Stored id:</span>{" "}
              {storedId != null ? storedId : "-"}
            </div>
          </div>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>3. Retrieve</h2>
          <button
            onClick={handleRetrieve}
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,0.7)",
              background: "transparent",
              color: "white",
              cursor: "pointer",
              fontWeight: 500,
            }}
            disabled={storedId == null}
          >
            Retrieve &amp; Decompress
          </button>
          {retrieved && (
            <pre
              style={{
                marginTop: 12,
                maxHeight: 200,
                overflow: "auto",
                background: "#020617",
                borderRadius: 12,
                padding: 12,
                border: "1px solid rgba(148,163,184,0.5)",
                fontSize: 13,
              }}
            >
              {retrieved}
            </pre>
          )}
        </section>

        <section>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Status</h2>
          <div style={{ fontSize: 14, color: "#e5e7eb" }}>
            {status ?? "Idle"}
          </div>
          {txHash && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#9ca3af" }}>
              Last tx: {txHash}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

