// Token Radar radar-2 dashboard. Reads window.RADAR (data.js beside
// dashboard/), renders the ranked board, filters, sort and a detail view
// for every protocol. No network: every byte shown is in data.js.
// The page recomputes each row's implied value and farm plan from the same
// snapshot figures as lib/model.ts, so the page and board.json agree.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var WATCH = {};
  (DATA.watchlist || []).forEach(function (s) { WATCH[s] = true; });
  var state = { q: '', category: 'all', chain: 'all', tvl: 0, wl: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var CAT = { Dexs: 0.34, Derivatives: 0.32, Lending: 0.3, CDP: 0.28, Yield: 0.28, 'Yield Aggregator': 0.27, 'Risk Curators': 0.26, 'Onchain Capital Allocator': 0.26, 'Collateral Markets': 0.26, 'Basis Trading': 0.24, CeDeFi: 0.24, RWA: 0.22, Payments: 0.22, Insurance: 0.22, 'Staking Pool': 0.2, Restaking: 0.2, Chain: 0.2, 'Governance Incentives': 0.18, 'Stablecoin Wrapper': 0.18, Bridge: 0.08, 'Canonical Bridge': 0.08, 'Liquid Staking': 0.08, 'Liquid Restaking': 0.08, 'Restaked BTC': 0.08 };
  function catMult(c) { return c === null || c === undefined ? 0.22 : (CAT[c] !== undefined ? CAT[c] : 0.25); }
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var w = growth >= 0 ? model.growth_weight_up : model.growth_weight_down;
    var growthMult = 1 + (growth / 100) * w;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var chainMult = 1 + model.chain_step * Math.min(Math.max(1, (row.chains || []).length) - 1, model.chain_max_extra);
    return Math.max(1, Math.min(model.implied_cap_usd, Math.round(row.tvl_usd * catMult(row.category) * growthMult * maturity * chainMult)));
  }
  function usd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n) { if (n === null || n === undefined || !isFinite(n)) return 'n/a'; return (n > 0 ? '+' : '') + n.toFixed(2) + '%'; }
  function ageFmt(d) { if (d === null || d === undefined) return 'unknown'; if (d >= 365) return (d / 365).toFixed(1) + 'y'; return Math.max(0, Math.round(d)) + 'd'; }
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) node.appendChild(x); });
      else if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    }
    return node;
  }
  // Farm plan, mirrored from lib/model.ts: same category branches, same
  // costs and times, so the detail view shows board.json's own plan.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) { if (p.tvl_usd >= 5e9) return 250; if (p.tvl_usd >= 1e9) return 150; if (p.tvl_usd >= 1e8) return 100; return 50; }
  function holdFor(age) { if (age === null || age === undefined) return 45; if (age < 180) return 60; if (age < 365) return 45; return 30; }
  function planFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase(), name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0 || c.indexOf('uncollateralized') >= 0) return { action: 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the loan position open.', second: 'Borrow a small amount against the deposit on ' + name + ', then repay it in the same week.', risk: 'Check the liquidation price on ' + name + ' before you borrow: a sharp move in the collateral can liquidate a small position first.' };
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('liquidity manager') >= 0 || c.indexOf('farm') >= 0) return { action: 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.', second: 'Swap $25 through ' + name + ' on ' + chain + ' so the wallet shows both providing and trading activity.', risk: "Check impermanent loss on " + name + "'s pool before you add liquidity: a one-sided price move can cost more than the fees you earn." };
    if (c.indexOf('bridge') >= 0) return { action: 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.', second: 'Bridge a second, smaller amount back the other way through ' + name + ' a week later.', risk: 'Bridge transfers through ' + name + ' can be delayed for hours: never bridge funds you need the same day, and check the destination address twice.' };
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return { action: "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt token.', second: 'Use the receipt token from ' + name + ' in one low-risk position on ' + chain + ', such as a lending deposit, and keep it there.', risk: 'A liquid-staking receipt can trade below its peg: check the peg for ' + name + ' on ' + chain + ' before you stake, and note that this is a derivative product, not a fresh launch.' };
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('basis trading') >= 0) return { action: 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position.', second: 'Close the position on ' + name + ' and open a second small one the following week, keeping the margin deposit in place.', risk: 'Check funding rates and the liquidation price on ' + name + ' before every trade: leveraged positions can be liquidated in minutes.' };
    if (c.indexOf('prediction') >= 0) return { action: 'Fund $' + capital + ' on ' + name + ' and place one market position on ' + chain + '.', second: 'Place a second small position on a different market on ' + name + ' the following week.', risk: "Prediction markets resolve on an oracle's answer: read the market's resolution rule on " + name + ' before you bet, and never stake more than you can lose.' };
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return { action: 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the vault shares.', second: 'Deposit a second, smaller amount into a different ' + name + ' vault on ' + chain + ' so the wallet shows two allocations.', risk: "A vault's strategy can change: read " + name + "'s current allocation on " + chain + ' before you deposit, and check who curates it.' };
    if (c.indexOf('stable') >= 0) return { action: 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and hold it.', second: 'Use the stable asset in one payment or swap on ' + chain + " through " + name + "'s app.", risk: "Check the stable asset's peg and backing on " + name + ' before you mint: a depegged stablecoin can lose value even while the position looks open.' };
    if (c.indexOf('rwa') >= 0) return { action: 'Mint $' + capital + ' of the yield asset on ' + name + ' on ' + chain + ' and hold it.', second: 'Test a small redemption of the yield asset on ' + name + ' so the wallet shows both minting and redeeming.', risk: "Real-world-asset products depend on an off-chain issuer: read " + name + "'s redemption terms and the issuer's name before you mint." };
    if (c.indexOf('insurance') >= 0) return { action: 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.', second: 'Renew or extend the cover on ' + name + ' before it lapses, rather than letting it expire.', risk: "Cover pays only on the policy's own terms: read what " + name + ' actually covers on ' + chain + ', and the claim deadline, before you buy.' };
    return { action: 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.', second: 'Make a second qualifying action on ' + name + ', such as a swap, a vote or a second deposit, a week later.', risk: "Check " + name + "'s own page on " + chain + ' for unaudited contracts or paused deposits before you put money in, and start with the smallest amount that still qualifies.' };
  }
  function stepText(s) { var t = s.text + ' Cost: ' + s.cost + '. Time: ' + s.time + '.'; if (t.length > 600) t = t.slice(0, 596) + '...'; return t; }
  function farmSteps(p) {
    var chain = chainOf(p), capital = capitalFor(p), hold = holdFor(p.age_days), plan = planFor(p, capital, chain), gas = capital >= 150 ? 8 : 4;
    return [
      { text: 'Open a fresh wallet for ' + p.name + ' on ' + chain + ' that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: plan.action, cost: '$' + capital + ' of capital and about $' + gas + ' of gas', time: '15 minutes to set up' },
      { text: plan.second, cost: 'about $2 to $5 of gas', time: '10 minutes' },
      { text: plan.risk, cost: 'nothing to check, and it can save the whole position', time: '10 minutes' },
      { text: 'Hold the position for at least ' + hold + ' days and make one qualifying action each week on ' + p.name + ', so the activity spans more than one snapshot.', cost: 'the $' + capital + ' stays in the position, about $2 of gas a week', time: hold + ' days' },
      { text: "Before you withdraw, open " + p.name + "'s own points or rewards page from the link it publishes and claim only there.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction for ' + p.name + ' on ' + chain + ' in a farm log, with an exit plan for unwinding the position.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }
  function readHash() {
    var params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tvl')) state.tvl = Number(params.get('tvl')) || 0;
    if (params.get('wl')) state.wl = params.get('wl') === '1';
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tvl) params.set('tvl', String(state.tvl));
    if (state.wl) params.set('wl', '1');
    if (state.selected) params.set('p', state.selected);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (r.tvl_usd < state.tvl) return false;
      if (state.wl && !WATCH[r.slug]) return false;
      if (!q) return true;
      return [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    return list.slice().sort(function (a, b) {
      var av, bv, k = state.sort;
      if (k === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (k === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (k === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (k === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }
  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' }, el('span', { text: 'Snapshot ' + DATA.as_of }), el('span', { text: 'DefiLlama protocol index' }), el('span', { text: DATA.model_version + ' model' })));
  }
  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor, by TVL.' }),
        el('p', { class: 'warn', text: 'Implied value is this entry\u2019s own claim, not a prediction that a token will be issued, or what it would trade at. A protocol records no token; that is not proof it has none.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      ));
  }
  function controls() {
    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (a, r) { return a.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, slug or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var catSel = el('select', { id: 'category', 'aria-label': 'Filter by category' }, el('option', { value: 'all', text: 'All categories' }), cats.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); }));
    catSel.addEventListener('change', function () { state.category = catSel.value; writeHash(); render(); });
    var chainSel = el('select', { id: 'chain', 'aria-label': 'Filter by chain' }, el('option', { value: 'all', text: 'All chains' }), chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); }));
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; writeHash(); render(); });
    var tvlSel = el('select', { id: 'tvl', 'aria-label': 'Minimum TVL' },
      [0, 10000000, 50000000, 100000000, 500000000].map(function (v) { return el('option', { value: String(v), text: v === 0 ? 'Any TVL' : 'TVL >= ' + usd(v), selected: v === state.tvl ? 'selected' : null }); }));
    tvlSel.addEventListener('change', function () { state.tvl = Number(tvlSel.value); writeHash(); render(); });
    var wl = el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: state.wl ? 'checked' : null }), ' Watchlist only');
    wl.querySelector('input').addEventListener('change', function (e) { state.wl = e.target.checked; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSel),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSel),
      el('div', { class: 'field' }, el('label', { for: 'tvl', text: 'TVL' }), tvlSel),
      wl,
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' }));
  }
  function sortHeader(key, label) {
    return el('th', { scope: 'col' }, el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } }, label, state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null));
  }
  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) return el('div', { class: 'panel' }, el('div', { class: 'empty' }, el('h2', { text: 'No protocol matches that filter' }), el('p', { text: 'Clear the search or pick another category, chain or TVL to see the board again.' }), el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.tvl = 0; state.wl = false; writeHash(); render(); } })));
    var max = list[0].implied_value_usd || 1, tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : pct(r.change_7d);
      var gc = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      tbody.appendChild(el('tr', { 'data-selected': state.selected === r.slug ? 'true' : 'false', tabindex: '0', onclick: function () { openDetail(r.slug); }, onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } } },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') + (r.derivative ? ' — derivative' : '') }))),
        el('td', { class: 'num', text: usd(r.tvl_usd) }),
        el('td', { class: 'num ' + gc, text: growth }),
        el('td', { class: 'num', text: ageFmt(r.age_days) }),
        el('td', null, el('div', { class: 'implied' }, el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })), el('span', { class: 'num', text: usd(r.implied_value_usd) }))),
        el('td', null, el('span', { class: r.derivative ? 'status derivative' : 'status', text: r.derivative ? 'derivative' : 'no token' }))));
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' }, el('table', null,
      el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
      el('thead', null, el('tr', null, sortHeader('implied', 'Rank'), sortHeader('name', 'Protocol'), sortHeader('tvl', 'TVL'), sortHeader('growth', '7d'), sortHeader('age', 'Age'), sortHeader('implied', 'Implied value'), el('th', { scope: 'col', text: 'Token' }))),
      tbody)));
  }
  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: usd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: pct(r.change_7d) }),
        el('td', { class: 'num', text: usd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))));
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' }, el('table', null,
      el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
      el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
      tbody)));
  }
  function modelPanel() {
    var m = DATA.model;
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked. Derivative categories (bridge and liquid-staking products) score at a 0.08 TVL multiple, because the underlying token already trades.' }),
      el('div', { class: 'formula' }, 'implied = min($5B, round( tvl_usd x categoryMultiple(0.08-0.34) x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight_up + ' up / ' + m.growth_weight_down + ' down) x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') x (1 + 0.03 x min(chains-1, 5)) ))'),
      el('p', { class: 'sub', text: 'TVL, seven-day growth, chain count and category come from the snapshot. Age is the time since the protocol was first listed; an unlisted age uses ' + m.unknown_age_days + ' days. Live-token protocols are set aside with their market caps shown.' }));
  }
  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });
  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug; writeHash(); dialog.textContent = '';
    var steps = farmSteps(row);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null, el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }), el('h2', { id: 'detail-title', text: row.name }), el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + ' — listed ' + (row.listed_at || 'date unknown') })),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: usd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: pct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: ageFmt(row.age_days) })),
        el('div', null, el('span', { text: 'Category multiple' }), el('b', { class: 'num', text: String(row.category_multiple) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Chain multiplier' }), el('b', { class: 'num', text: String(row.chain_multiplier) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: usd(row.implied_value_usd) }))),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the page recomputes this row as ' + usd(impliedOf(row, DATA.model)) + (impliedOf(row, DATA.model) === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + (row.derivative ? ' Derivative product: scored at the 0.08 multiple.' : '') + ' This is an estimate, not a price.' })));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) { var at = s.indexOf(' Cost: '); return el('li', null, el('b', { text: at >= 0 ? s.slice(0, at) : s }), el('span', { class: 'cost', text: at >= 0 ? s.slice(at + 1) : '' })); }))));
    if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); } else dialog.setAttribute('open', '');
  }
  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header()); shell.appendChild(lede()); shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    shell.appendChild(el('p', { class: 'foot', text: 'Snapshot ' + DATA.as_of + ' from ' + DATA.source + '. Implied values are this entry\u2019s own claims, not a prediction of issuance.' }));
    app.appendChild(shell); app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }
  readHash(); render();
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dialog.open) dialog.close(); });
})();
