import * as ethers from 'ethers';
import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';

const PROJECT_ID = 'f018499b1e4a94d961ab67aeeeff3254';

const botTestnet = {
  id: 968, chainNamespace: 'eip155', caipNetworkId: 'eip155:968',
  name: 'BOT Chain Testnet',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.bohr.life'] } },
  blockExplorers: { default: { name: 'BOT Scan', url: 'https://scan.bohr.life' } },
};
const botMainnet = {
  id: 677, chainNamespace: 'eip155', caipNetworkId: 'eip155:677',
  name: 'BOT Chain',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.botchain.ai'] } },
  blockExplorers: { default: { name: 'BOT Scan', url: 'https://scan.botchain.ai' } },
};
const RPC = { 968: 'https://rpc.bohr.life', 677: 'https://rpc.botchain.ai' };

// Filled after mainnet deploy — null = contract not live on that chain (honest UI)
const CONTRACTS = { 968: { addr: null, deployBlock: null }, 677: { addr: '0xfDC1c968B086A4159499292635Ab9F87f1eb3E5B', deployBlock: 26069099 } };

const ABI = [
  'function totalSupply() view returns (uint256)',
  'function nextTokenId() view returns (uint256)',
  'function ownerOf(uint256) view returns (address)',
  'function tokenURI(uint256) view returns (string)',
  'function paymentToken() view returns (address)',
  'function getAllListed() view returns (uint256[])',
  'function getListing(uint256) view returns (tuple(address seller, uint256 price, bool active))',
  'function royalties(uint256) view returns (address recipient, uint256 percentage)',
  'function mint(string uri)',
  'function list(uint256 tokenId, uint256 price)',
  'function buy(uint256 tokenId)',
  'function setRoyalty(uint256 tokenId, address recipient, uint256 percentage)',
  'event NFTSold(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price)',
];
const ERC20_ABI = [
  'function allowance(address owner,address spender) view returns (uint256)',
  'function approve(address spender,uint256 amount) returns (bool)',
];

const modal = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [botMainnet, botTestnet],
  defaultNetwork: botMainnet,
  projectId: PROJECT_ID,
  metadata: { name: 'Gallery', description: 'NFT marketplace on BOT Chain', url: location.origin, icons: [location.origin + '/logo.png'] },
  themeVariables: { '--w3m-accent': '#ec4899' },
  features: { analytics: false },
});

const $ = (id) => document.getElementById(id);
const g = window.__g;
const GP = ethers.parseUnits('20', 'gwei'); // mainnet 677 enforces a 20 gwei floor
let chain = 677;
let readProvider = new ethers.JsonRpcProvider(RPC[chain]);
let signer = null, account = null, walletProvider = null, _connectResolve = null;
let flt = -1, listings = [], totalTokens = 0, ownedIds = [];
let busy = false;

const caipOf = (id) => (id === 677 ? botMainnet.caipNetworkId : botTestnet.caipNetworkId);
const chainName = () => (chain === 677 ? 'mainnet' : 'testnet');
const addrOf = () => CONTRACTS[chain].addr;
const gasOv = () => (chain === 677 ? { gasPrice: GP } : {});
const seedOf = (id) => (id + 1) * 7 + 2;
const styleOf = (id) => seedOf(id) % 5;

function toast(m) {
  const t = $('toast');
  t.textContent = m;
  t.classList.add('on');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('on'), 3000);
}

function count(el, to) {
  const from = +el.dataset.v || 0;
  el.dataset.v = to;
  const t0 = performance.now();
  (function f(t) {
    const k = Math.min(1, (t - t0) / 800);
    el.textContent = +(from + (to - from) * k).toFixed(2);
    if (k < 1) requestAnimationFrame(f);
  })(t0);
}

function errM(e) {
  const m = (e && (e.shortMessage || e.reason || e.message)) || 'Transaction failed';
  if (/user rejected|user denied|action_rejected|cancelled/i.test(m)) return 'Transaction cancelled';
  return m.slice(0, 170);
}

function readC() {
  const addr = addrOf();
  return addr ? new ethers.Contract(addr, ABI, readProvider) : null;
}

async function writeC() {
  if (!signer) {
    const ok = await connect();
    if (!ok) return null;
  }
  const addr = addrOf();
  if (!addr) {
    toast(`Gallery contract isn't live on ${chainName()} yet`);
    return null;
  }
  return new ethers.Contract(addr, ABI, signer);
}

/* ---- wallet core (Reown AppKit) ---- */
function getProvider() {
  if (walletProvider) return walletProvider;
  try {
    if (modal && typeof modal.getWalletProvider === 'function') {
      const p = modal.getWalletProvider('eip155') || modal.getWalletProvider();
      if (p) { walletProvider = p; return p; }
    }
  } catch (e) {}
  return null;
}

async function syncFromProvider(wp) {
  const bp = new ethers.BrowserProvider(wp);
  signer = await bp.getSigner();
  account = await signer.getAddress();
  updateConnectedUI();
  console.log('[Gallery] Wallet connected:', account);
}

function updateConnectedUI() {
  $('connectBtn').textContent = account ? account.slice(0, 6) + '...' + account.slice(-4) : 'Connect wallet';
}

async function connect() {
  try {
    if (modal.getIsConnectedState()) {
      const wp = getProvider();
      if (wp) {
        await syncFromProvider(wp);
        updateConnectedUI();
        return true;
      }
    }
  } catch (err) {}
  const pending = new Promise((resolve) => { _connectResolve = resolve; });
  try { modal.open(); } catch (err) { _connectResolve = null; return false; }
  const timeout = new Promise((resolve) => setTimeout(() => resolve(!!signer), 120000));
  return Promise.race([pending, timeout]);
}

function onConnectClick() {
  let isConn = false;
  try { isConn = modal.getIsConnectedState(); } catch (e) {}
  if (isConn && getProvider()) {
    try { modal.open({ view: 'Account' }); } catch (e) { try { modal.open(); } catch (_) {} }
    return;
  }
  connect();
}

modal.subscribeProviders((state) => {
  if (state && state['eip155']) walletProvider = state['eip155'];
});

modal.subscribeAccount(async (state) => {
  if (state && state.isConnected && state.address) {
    account = state.address;
    const wp = getProvider();
    if (wp) {
      try { await syncFromProvider(wp); updateConnectedUI(); } catch (e) {}
    }
    if (_connectResolve) { _connectResolve(!!signer); _connectResolve = null; }
    refresh();
  } else {
    const was = !!account;
    account = null; signer = null; ownedIds = [];
    updateConnectedUI();
    if (was) console.log('[Gallery] disconnected');
    if (_connectResolve) { _connectResolve(false); _connectResolve = null; }
    refresh();
  }
});

modal.subscribeState((state) => {
  if (state && state.open === false && _connectResolve && !signer) {
    _connectResolve(false); _connectResolve = null;
  }
});

/* ---- data ---- */
async function volumeOf(c) {
  const dep = CONTRACTS[chain].deployBlock;
  if (dep == null) return null;
  let head;
  try { head = await readProvider.getBlockNumber(); } catch (e) { return null; }
  let from = dep, sum = 0n;
  const ev = c.filters.NFTSold();
  while (from <= head) {
    const to = Math.min(from + 4999, head);
    try {
      const logs = await c.queryFilter(ev, from, to);
      for (const l of logs) sum += l.args.price;
    } catch (e) { return null; }
    from = to + 1;
  }
  return sum;
}

async function scanOwned(c, total) {
  if (!account) return [];
  const ids = [];
  const n = Math.min(total, 300);
  for (let start = 0; start < n; start += 20) {
    const batch = [];
    for (let i = start; i < Math.min(start + 20, n); i++) {
      batch.push(
        c.ownerOf(i).then((o) => { if (o.toLowerCase() === account) ids.push(i); }).catch(() => {})
      );
    }
    await Promise.all(batch);
  }
  return ids.sort((a, b) => a - b);
}

async function refresh() {
  if (busy) return;
  busy = true;
  const c = readC();
  const addr = addrOf();
  $('contractAddr').textContent = addr || '—';
  if (!c) {
    listings = []; totalTokens = 0; ownedIds = [];
    $('statTotal').textContent = '—';
    $('statListed').textContent = '—';
    $('statVolume').textContent = '—';
    $('yourNFTs').textContent = '—';
    buildRing([]);
    render();
    busy = false;
    return;
  }
  try {
    const [total, ids, vol] = await Promise.all([
      c.totalSupply().then((t) => Number(t)).catch(() => 0),
      c.getAllListed().then((a) => a.map((x) => Number(x))).catch(() => []),
      volumeOf(c),
    ]);
    totalTokens = total;
    const rows = await Promise.all(ids.map(async (id) => {
      try {
        const [l, r] = await Promise.all([c.getListing(id), c.royalties(id)]);
        return { id, seller: l.seller, price: ethers.formatEther(l.price), active: l.active, roy: Number(r.percentage) };
      } catch (e) { return null; }
    }));
    listings = rows.filter((r) => r && r.active);
    ownedIds = await scanOwned(c, total);
    $('statTotal').dataset.v = $('statTotal').dataset.v || 0;
    count($('statTotal'), total);
    count($('statListed'), listings.length);
    if (vol == null) { $('statVolume').textContent = '—'; delete $('statVolume').dataset.v; }
    else count($('statVolume'), Number(ethers.formatEther(vol)));
    $('yourNFTs').textContent = account ? ownedIds.length : '—';
    const ringIds = [];
    for (let i = 0; i < Math.min(total, 12); i++) ringIds.push(i);
    buildRing(ringIds);
    render();
  } catch (e) {
    console.warn('[Gallery] refresh failed:', e);
    render();
  }
  busy = false;
}

/* ---- render ---- */
function render() {
  const grid = $('nftGrid');
  const V = listings.filter((n) => flt < 0 || styleOf(n.id) === flt);
  if (!addrOf()) {
    grid.innerHTML = `<div class="empty">Gallery contract isn't live on ${chainName()} yet — trades open after the mainnet deploy.</div>`;
  } else if (!V.length) {
    grid.innerHTML = `<div class="empty">${listings.length ? 'No NFTs in this style yet.' : 'No NFTs listed yet — mint one above, then list it for sale.'}</div>`;
  } else {
    const AR = ['4/5', '1/1', '4/6', '5/4'];
    grid.innerHTML = V.map((n) => `
      <article class="card" data-id="${n.id}" style="aspect-ratio:${AR[n.id % 4]}">
        <img alt="Token #${n.id}" src="${g.art(seedOf(n.id))}">
        <button class="buy mono">Buy →</button>
        <div class="ov"><div><h4>Token #${n.id}</h4><span class="mono">#${n.id} · ${(n.roy / 100)}% royalty</span></div><span class="pr mono">${n.price} WBOT</span></div>
      </article>`).join('');
  }
  $('thumbs').innerHTML = ownedIds.slice(-6).map((id) =>
    `<img data-id="${id}" src="${g.art(seedOf(id))}" title="#${id} — click to list">`).join('');
  g.hov();
  g.tilt();
}

function buildRing(ids) {
  const stage = $('stage');
  const ring = $('ring');
  stage.style.display = ids.length ? '' : 'none';
  if (!ids.length) { ring.innerHTML = ''; ring._frames = []; return; }
  ring.innerHTML = ids.map((id) => `<div class="f"><img alt="" src="${g.art(seedOf(id))}"></div>`).join('');
  ring._frames = [...ring.children];
  layRing();
}

function layRing() {
  const ring = $('ring');
  const fr = ring._frames || [];
  if (!fr.length || !ring.offsetWidth) return;
  const z = Math.round(ring.offsetWidth / 2 / Math.tan(Math.PI / fr.length)) + 34;
  fr.forEach((f, i) => { f.style.transform = `rotateY(${i * 360 / fr.length}deg) translateZ(${z}px)`; });
}
addEventListener('resize', layRing);

/* ring animation (drag + scroll velocity) */
(function ringLoop() {
  const ring = $('ring');
  let ang = 0, vel = 0.15, drag = false, lx = 0, ly = scrollY;
  $('top').addEventListener('pointerdown', (e) => { drag = true; lx = e.clientX; });
  addEventListener('pointerup', () => { drag = false; });
  addEventListener('pointermove', (e) => { if (drag) { vel = (e.clientX - lx) * 0.25; lx = e.clientX; } });
  addEventListener('scroll', () => { vel += (scrollY - ly) * 0.02; ly = scrollY; });
  (function f() {
    ang += vel;
    vel += (0.15 - vel) * 0.04;
    if (ring._frames && ring._frames.length) ring.style.transform = `rotateX(-5deg) rotateY(${ang}deg)`;
    requestAnimationFrame(f);
  })();
})();

/* ---- actions ---- */
async function doMint() {
  const c = await writeC();
  if (!c) return;
  const uri = $('mintURI').value.trim();
  busy = false;
  try {
    toast('Minting…');
    const tx = await c.mint(uri, gasOv());
    await tx.wait();
    const id = totalTokens;
    toast(`Minted token #${id} — now list it for sale`);
    $('mintURI').value = '';
    refresh();
  } catch (e) { toast(errM(e)); }
}

async function doList() {
  const c = await writeC();
  if (!c) return;
  const id = parseInt($('listId').value, 10);
  const priceStr = $('listPrice').value.trim();
  if (!Number.isInteger(id) || id < 0) return toast('Enter a valid token ID');
  let price;
  try { price = ethers.parseEther(priceStr || '0'); } catch (e) { return toast('Enter a valid price'); }
  if (price <= 0n) return toast('Enter a price greater than 0');
  try {
    toast('Listing…');
    const tx = await c.list(id, price, gasOv());
    await tx.wait();
    toast(`Listed #${id} for ${priceStr} WBOT`);
    refresh();
  } catch (e) { toast(errM(e)); }
}

async function doBuy(id) {
  const c = await writeC();
  if (!c) return;
  try {
    const l = await c.getListing(id);
    if (!l.active) return toast(`Token #${id} is not listed`);
    if (account && l.seller.toLowerCase() === account.toLowerCase()) return toast("You can't buy your own listing");
    const pt = await c.paymentToken();
    const erc20 = new ethers.Contract(pt, ERC20_ABI, signer);
    const price = l.price;
    const allow = await erc20.allowance(account, addrOf());
    if (allow < price) {
      toast('Approving WBOT for marketplace…');
      const at = await erc20.approve(addrOf(), ethers.MaxUint256, gasOv());
      await at.wait();
    }
    toast('Buying…');
    const tx = await c.buy(id, gasOv());
    await tx.wait();
    toast(`Bought #${id} — it's yours`);
    refresh();
  } catch (e) { toast(errM(e)); }
}

async function doRoyalty() {
  const c = await writeC();
  if (!c) return;
  const id = parseInt($('royaltyId').value, 10);
  const pct = parseFloat($('royaltyPct').value);
  const recip = $('royaltyRecipient').value.trim();
  if (!Number.isInteger(id) || id < 0) return toast('Enter a valid token ID');
  if (!(pct >= 0 && pct <= 10)) return toast('Max royalty is 10%');
  if (!ethers.isAddress(recip)) return toast('Enter a valid recipient address');
  try {
    toast('Setting royalty…');
    const tx = await c.setRoyalty(id, recip, Math.round(pct * 100), gasOv());
    await tx.wait();
    toast(`Royalty for #${id} set to ${pct}%`);
    refresh();
  } catch (e) { toast(errM(e)); }
}

/* ---- network toggle ---- */
function updateNetUI() {
  document.querySelectorAll('#netSel button').forEach((b) =>
    b.classList.toggle('on', +b.dataset.c === chain));
  $('contractAddr').textContent = addrOf() || '—';
}

async function switchChain(id) {
  if (id === chain) return;
  chain = id;
  readProvider = new ethers.JsonRpcProvider(RPC[chain]);
  updateNetUI();
  try { if (modal.getIsConnectedState()) await modal.switchNetwork(caipOf(id)); } catch (e) {}
  toast(`Viewing ${chain === 677 ? 'Mainnet 677' : 'Testnet 968'}`);
  refresh();
}

/* ---- init ---- */
$('connectBtn').addEventListener('click', (e) => { e.preventDefault(); onConnectClick(); });
$('netSel').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) switchChain(+b.dataset.c);
});
$('mintBtn').addEventListener('click', doMint);
$('listBtn').addEventListener('click', doList);
$('royaltyBtn').addEventListener('click', doRoyalty);
$('nftGrid').addEventListener('click', (e) => {
  const b = e.target.closest('.buy');
  if (b) doBuy(+b.closest('.card').dataset.id);
});
$('thumbs').addEventListener('click', (e) => {
  const i = e.target.closest('img');
  if (i) { $('listId').value = i.dataset.id; document.getElementById('tools').scrollIntoView(); }
});
$('chips').innerHTML = ['All', ...g.STY].map((s, i) =>
  `<button data-f="${i - 1}" class="${i ? '' : 'on'}">${s}</button>`).join('');
$('chips').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  flt = +b.dataset.f;
  document.querySelectorAll('#chips button').forEach((z) => z.classList.toggle('on', z === b));
  render();
});

setTimeout(async () => {
  try {
    if (!signer && modal.getIsConnectedState()) {
      const wp = getProvider();
      if (wp) { await syncFromProvider(wp); updateConnectedUI(); }
    }
  } catch (e) {}
  refresh();
}, 800);
refresh();
