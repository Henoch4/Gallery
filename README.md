# Gallery — NFT marketplace on BOT Chain

> Gallery — NFT marketplace on BOT Chain

## What it does

Gallery — NFT marketplace on BOT Chain The entire lifecycle lives in one contract, every button in the UI calls a real function on it — there is no mock backend.

## Contract

| | |
|---|---|
| File | `contracts/Gallery.sol` |
| Contract name | `Gallery` (inherits `ERC721Enumerable, ReentrancyGuard, Ownable`) |
| Solidity | `^0.8.20` |
| State functions | 9 (of which 0 payable) |
| Deployed (mainnet 677) | not yet deployed — placeholder `0x000…000` |

### Function surface

| Function | Type | Returns |
|---|---|---|
| `mint` | write | uint256 |
| `list` | write | result / revert |
| `delist` | write | result / revert |
| `buy` | write | result / revert |
| `setRoyalty` | write | result / revert |
| `getListing` | view | Listing memory |
| `getAllListed` | view | uint256[] memory |
| `_setTokenURI` | write | result / revert |
| `tokenURI` | view | string memory |

### Events

| Event | Signature |
|---|---|
| `NFTMinted` | (uint256 indexed tokenId, address indexed creator, string tokenURI) |
| `NFTListed` | (uint256 indexed tokenId, address indexed seller, uint256 price) |
| `NFTSold` | (uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price) |
| `NFTDelisted` | (uint256 indexed tokenId, address indexed seller) |
| `RoyaltySet` | (uint256 indexed tokenId, address recipient, uint256 percentage) |

## Network

| | |
|---|---|
| Chain | BOT Chain Mainnet (chainId `677`) |
| RPC | `https://rpc.botchain.ai` |
| Explorer | `https://scan.botchain.ai` |
| Native currency | BOT (18 decimals) |
| Testnet | BOT Chain Testnet (chainId `968`) - `https://rpc.bohr.life` |

## Frontend

- **Wallet connection** - [Reown/AppKit](https://reown.com) (Web3Modal v2, inline modal, `subscribeAccount` / `subscribeNetwork`)
- **Web3 library** - ethers.js v6 (`BrowserProvider`, `Contract`, `parseEther`)
- **Animation** - GSAP 3 + ScrollTrigger (`expo.out` entrances, `prefers-reduced-motion` fallback renders content instantly)
- **Zero build step** - single `index.html`, CDN imports via ESM import map; no bundler, no framework runtime
- **Accessibility** - auto-generated `aria-label`s on all binary and form controls, focus-visible styles, button busy states

## Run it locally

```bash
git clone https://github.com/Henoch4/Gallery.git
cd Gallery
# open the frontend directly (no build step)
start frontend/index.html   # Windows
# or serve it if your browser blocks file:// modules:
npx serve frontend
```

> **Note** — contract addresses: the UI reads its deploy target from the `CA` constant at the top of the inline script. Until the contract is deployed to mainnet 677, the demo runs against the deterministic sample data built into the page; after deployment, set `CA['677']` to the real address and every button goes live.