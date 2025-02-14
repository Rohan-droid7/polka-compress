# PolkaCompress

PolkaCompress is a full-stack hackathon project that demonstrates interaction between:

- **Solidity smart contracts** on an EVM-compatible environment of the **Polkadot Hub Testnet**, and
- A **Rust compression contract** compiled for **PolkaVM**.

The goal is to **compress large data in Rust before storing it on-chain via Solidity**, reducing storage costs while keeping the compression logic in a high-performance language.

## Architecture

- **Frontend (Next.js)**: Simple dApp for uploading text/JSON and viewing compression stats.
- **Solidity `CompressedStorage` contract**:
  - Receives raw bytes from users.
  - Calls a **compressor contract** that bridges into PolkaVM (or wraps the Rust binary).
  - Stores compressed bytes on-chain.
  - Emits `DataStored(id, originalSize, compressedSize)`.
- **Rust compression engine (PolkaVM)**:
  - Implements `compress` and `decompress` using `lz4_flex`.
  - Exposes raw FFI-style functions callable from a wrapper contract / precompile.
- **Storage layer**:
  - Compressed data is stored in `mapping(uint256 => bytes) storedData` with an incrementing `counter`.

Data flow:

1. User submits text/JSON from the frontend.
2. Frontend encodes it to `bytes` and calls `CompressedStorage.storeData`.
3. `CompressedStorage` calls `compressor.compress(data)` implemented by Rust on PolkaVM.
4. Compressed bytes are stored in a mapping on the Solidity side.
5. To read, `retrieveData(id)` loads compressed bytes and calls `compressor.decompress`, which returns original data.

## Why Rust instead of Solidity for compression?

- **Performance**: Compression algorithms are CPU-intensive; Rust can run them efficiently.
- **Gas/storage savings**: Pushing the heavy computation off of Solidity:
  - Reduces execution gas in the EVM layer.
  - Allows more sophisticated algorithms than would be practical to implement in Solidity.
- **Safety**: Rust’s type system and `no_std` support make it suitable for deterministic, sandboxed environments like PolkaVM.

## How compression reduces storage cost

On-chain storage is expensive. If:

- Original payload is \( N \) bytes.
- Compressed payload is \( M \) bytes with \( M < N \).

Then:

- You pay storage cost proportional to \( M \) instead of \( N \).
- The effective saving is \( 1 - M/N \).

The frontend displays:

- **Original size** (bytes submitted),
- **Compressed size** (bytes stored),
- **Compression ratio** \( M / N \).

## Project structure

- `contracts/`
  - `ICompressor.sol` – interface for compression engines
  - `CompressedStorage.sol` – main Solidity storage contract
- `rust-compressor/`
  - `Cargo.toml` – Rust crate definition
  - `src/lib.rs` – PolkaVM-ready Rust compression library
- `frontend/`
  - Next.js app with:
    - `pages/index.tsx` – main dApp UI
    - `components/` – (placeholder for further UI components)
- `scripts/`
  - `deploy.js` – deployment script using `ethers.js`
- `README.md` – this document

## Solidity contracts

### `ICompressor.sol`

Defines the minimal interface expected from any compression engine:

- `compress(bytes calldata data) external returns (bytes memory)`
- `decompress(bytes calldata data) external returns (bytes memory)`

### `CompressedStorage.sol`

State:

- `address public compressor`
- `mapping(uint256 => bytes) public storedData`
- `uint256 public counter`

Events:

- `event DataStored(uint256 id,uint256 originalSize,uint256 compressedSize);`

Constructor:

- Accepts `compressor` address that implements `ICompressor`.

Functions:

- `storeData(bytes calldata data) external returns (uint256 id)`
  - Calls `compressor.compress(data)`.
  - Stores the compressed bytes in `storedData[++counter]`.
  - Emits `DataStored(id, data.length, compressed.length)`.
  - Returns the new `id`.
- `retrieveData(uint256 id) external returns (bytes memory)`
  - Loads compressed bytes from `storedData[id]`.
  - Calls `compressor.decompress(stored)`.
  - Returns the decompressed data.

## Rust compression contract (PolkaVM)

Location: `rust-compressor/`

### Dependencies

`Cargo.toml`:

- `lz4_flex = "0.11"`

Configured as:

- `crate-type = ["cdylib", "rlib"]` – for FFI-style exports suitable for PolkaVM/wasm toolchains.

### API

Exposed functions in `src/lib.rs`:

- `compress(ptr: *const u8, len: usize, out_ptr: *mut u8) -> usize`
- `decompress(ptr: *const u8, len: usize, out_ptr: *mut u8) -> usize`

These are `#[no_mangle] extern "C"` functions that:

- Read `len` bytes from `ptr`.
- Compress/decompress them using `lz4_flex`.
- Write the result into the caller-provided `out_ptr`.
- Return the number of bytes written.

In a full integration, a **wrapper contract or precompile** on PolkaVM:

- Allocates input/output buffers,
- Calls these functions,
- Bridges the resulting bytes back to the EVM-side `Compressor` contract that implements `ICompressor`.

### Building the Rust contract

1. **Install Rust (nightly recommended)**

   - Install via `rustup`:

   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup default stable
   ```

2. **Add a PolkaVM-compatible target**

   Depending on the current PolkaVM toolchain, this is typically a Wasm or custom target, such as:

   - `wasm32-unknown-unknown` for Wasm-based runtimes, or
   - A specific PolkaVM target (consult current Polkadot Hub / PolkaVM docs).

   Example for Wasm:

   ```bash
   rustup target add wasm32-unknown-unknown
   ```

3. **Build the contract**

   ```bash
   cd rust-compressor
   cargo build --release --target wasm32-unknown-unknown
   ```

   This produces a `.wasm` or binary artifact under `target/wasm32-unknown-unknown/release/` which you can then:

   - Deploy as a PolkaVM contract, or
   - Wrap into a precompile accessible from an EVM-compatible pallet.

4. **Wire into a Solidity-facing compressor**

   - Implement a small **Compressor** contract (not provided here) that:
     - Uses the PolkaVM runtime’s FFI or precompile interface to call the Rust functions.
     - Implements `ICompressor` by delegating to Rust.

## Frontend (Next.js)

Location: `frontend/`

Key file: `pages/index.tsx`

Features:

- Text/JSON input textarea.
- `Store with Compression` button:
  - Connects to wallet via `ethers` (`BrowserProvider`).
  - Calls `storeData(bytes)` on `CompressedStorage`.
  - Parses `DataStored` event from the transaction receipt.
  - Displays:
    - Original size,
    - Compressed size,
    - Compression ratio,
    - Stored `id`.
- `Retrieve & Decompress` button:
  - Uses the last stored `id`.
  - Calls `retrieveData(id)`.
  - Decodes bytes back to UTF-8 text and shows the result.

Configuration:

- Contract address is taken from:
  - `NEXT_PUBLIC_STORAGE_ADDRESS` (environment variable) or
  - A placeholder `0xYourStorageContract` in development.

### Running the frontend locally

```bash
cd frontend
npm install
npm run dev
```

Then open `http://localhost:3000` in your browser.

## Deployment

Location: `scripts/deploy.js`

Uses `ethers.js` to:

1. Connect to **Polkadot Hub Testnet** RPC (EVM endpoint).
2. Deploy the **compressor wrapper contract** (EVM or precompile wrapper for PolkaVM Rust).
3. Deploy the **`CompressedStorage`** contract, passing the compressor address.

### Prerequisites

- Node.js and npm installed.
- Build artifacts (ABI + bytecode) for:
  - `Compressor.json` – wrapper that implements `ICompressor` and calls Rust/PolkaVM.
  - `CompressedStorage.json` – compiled from `contracts/CompressedStorage.sol`.
- A funded deployer account on Polkadot Hub Testnet.

Place the artifacts in:

- `scripts/artifacts/Compressor.json`
- `scripts/artifacts/CompressedStorage.json`

### Environment variables

Set:

- `POLKADOT_HUB_TESTNET_RPC` – RPC URL for the Polkadot Hub Testnet EVM endpoint.
- `DEPLOYER_PRIVATE_KEY` – private key of deployer (keep this secret).

### Deploy

```bash
cd scripts
npm init -y
npm install ethers
node deploy.js
```

The script will output:

- Deployed compressor address.
- Deployed `CompressedStorage` address.
- A line you can copy into your `.env.local`:

```text
NEXT_PUBLIC_STORAGE_ADDRESS=0x...
```

## Example flow

1. **Deploy Rust compression engine**
   - Build and deploy `rust-compressor` as a PolkaVM contract.
   - Create a `Compressor` wrapper contract that exposes `compress`/`decompress` and bridges into PolkaVM.

2. **Deploy Solidity storage**
   - Deploy `CompressedStorage` with the `Compressor` wrapper address as constructor argument.

3. **Configure frontend**
   - Set `NEXT_PUBLIC_STORAGE_ADDRESS` to the `CompressedStorage` contract address.
   - Start the Next.js dev server.

4. **Use the dApp**
   - Paste some JSON (e.g. a large object) into the textarea.
   - Click **Store with Compression**:
     - Rust on PolkaVM compresses the bytes.
     - Solidity stores the compressed result.
   - Observe:
     - Original size vs. compressed size.
     - Compression ratio.
     - Assigned data `id`.
   - Click **Retrieve & Decompress**:
     - `CompressedStorage` loads compressed bytes.
     - Rust on PolkaVM decompresses them.
     - Frontend shows the original JSON.

This repository is designed as a **hackathon-ready blueprint**: you can plug in the latest PolkaVM toolchain and EVM bridge specifics while keeping the core architecture, contracts, and UX intact.

