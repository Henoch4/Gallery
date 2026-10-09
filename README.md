# Gallery — NFT Marketplace on BOT Chain

Mint NFTs, list them, buy and sell — with creator royalties up to 10%.
2.5% marketplace fee, everything settled in WBOT on-chain.

## Networks
- Testnet — chainId 968 — RPC https://rpc.bohr.life — explorer https://scan.bohr.life
- Mainnet — chainId 677 — RPC https://rpc.botchain.ai — explorer https://scan.botchain.ai

## Deployments
- Mainnet (677): **deployed** — `0xfDC1c968B086A4159499292635Ab9F87f1eb3E5B` (block 26069099, tx `0xd5dc91fca6b63972a49314fee73ac703ebd8567e5a3d81e3273fdc7f5f5f79a0`, 20 gwei, gasUsed 2005339, 2026-10-09). Frontend wired and defaults to mainnet.
- Constructor: WBOT `0xD5452816194a3784dBa983426cCe7c122F4abd30` (payment token).

## Structure
- `frontend/` — static dApp (index.html + app.js). Wallet connect via Reown/AppKit, chain switch to mainnet 677.
- `contracts/Gallery.sol` — ERC-721 Enumerable: mint / list / delist / buy / setRoyalty. 2.5% fee, 10% max royalty.

## Run frontend
Serve the folder over HTTP (ES modules don't load from `file://`):
```
npx serve frontend
```

## Team Safe (2-of-2, all projects)
- Safe: `0x3f6599D5694044Ac0B357695843391220a5aE0c3` — owners `0x79d0…9188` + `0x7765…5D82`, threshold 2.
