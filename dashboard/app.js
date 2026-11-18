// Kestrel Radar — the dashboard's page: a sortable, filterable board, a detail view for every
// protocol, a live-token view set aside, and a model sandbox that re-ranks the board from the
// row's own figures. No framework, no network: all data comes from ../data.js.
(function () {
  'use strict';
  var DATA = window.RADAR;
  var app = document.getElementById('board');

  /** The model in one function: the page recomputes a row from the snapshot figures, exactly as
      lib/model.ts does, so the sandbox and the detail view always agree with board.json. */
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var extra = Math.max(0, Math.min((row.chains ? row.chains.length : 1) - 1, model.breadth_max_chains));
    var breadth = 1 + extra * model.breadth_per_chain;
    return Math.max(1, Math.round(row.tvl_usd * model.base_multiple * growthMult * maturity * breadth));
  }

  function fmtUsd(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + String(Math.round(n));
  }
  function fmtPct(v) {
    if (v === null || v === undefined) return '—';
    return (v > 0 ? '+' : '') + v.toFixed(1) + '%';
  }
  function fmtAge(d) {
    if (d === null || d === undefined) return '—';
    if (d >= 365) return (d / 365).toFixed(1) + 'y';
    return d + 'd';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  var state = {
    q: '', category: 'all', chain: 'all', watchlist: false, minTvl: 0,
    tab: 'pre-token', sort: 'implied', dir: -1, selected: null,
    sandbox: null, // {base_multiple, growth_weight, maturity_floor} once a slider moves
  };

  function watchSet() {
    var s = {};
    DATA.rows.forEach(function (r) { if (DATA.watchlistSlugs[r.slug]) s[r.slug] = true; });
    return s;
  }

  function activeModel() {
    if (!state.sandbox) return DATA.model;
    return {
      base_multiple: state.sandbox.base_multiple,
      growth_weight: state.sandbox.growth_weight,
      growth_floor: DATA.model.growth_floor,
      growth_cap: DATA.model.growth_cap,
      maturity_floor: state.sandbox.maturity_floor,
      maturity_range: DATA.model.maturity_range,
      maturity_days: DATA.model.maturity_days,
      unknown_age_days: DATA.model.unknown_age_days,
      breadth_per_chain: DATA.model.breadth_per_chain,
      breadth_max_chains: DATA.model.breadth_max_chains,
    };
  }

  /** Rows with the sandbox applied: recomputed implied values, re-ranked, ties broken by slug. */
  function viewRows() {
    var model = activeModel();
    var rows = DATA.rows.map(function (r) {
      var copy = {};
      for (var k in r) copy[k] = r[k];
      copy.implied_value_usd = impliedOf(r, model);
      return copy;
    });
    rows.sort(function (a, b) { return b.implied_value_usd - a.implied_value_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0); });
    rows.forEach(function (r, i) { r.display_rank = i + 1; });
    return rows;
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var ws = watchSet();
    return viewRows().filter(function (r) {
      if (state.tab !== 'pre-token') return false;
      if (state.watchlist && !ws[r.slug]) return false;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (state.minTvl > 0 && r.tvl_usd < state.minTvl) return false;
      if (q && (r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0)) return false;
      return true;
    });
  }

  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var va, vb;
      if (key === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
      else if (key === 'category') { va = (a.category || 'Other').toLowerCase(); vb = (b.category || 'Other').toLowerCase(); }
      else if (key === 'tvl') { va = a.tvl_usd; vb = b.tvl_usd; }
      else if (key === 'growth') { va = a.change_7d === null ? -9999 : a.change_7d; vb = b.change_7d === null ? -9999 : b.change_7d; }
      else if (key === 'age') { va = a.age_days === null ? -1 : a.age_days; vb = b.age_days === null ? -1 : b.age_days; }
      else { va = a.implied_value_usd; vb = b.implied_value_usd; }
      if (va < vb) return -1 * state.dir;
      if (va > vb) return 1 * state.dir;
      return a.slug < b.slug ? -1 : 1;
    });
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (attrs[k] === null || attrs[k] === undefined) continue;
        if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k === 'onclick') node.addEventListener('click', attrs[k]);
        else if (k === 'oninput') node.addEventListener('input', attrs[k]);
        else if (k === 'onchange') node.addEventListener('change', attrs[k]);
        else node.setAttribute(k, attrs[k]);
      }
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c === null || c === undefined) return;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  function header() {
    return el('header', { class: 'masthead' }, [
      el('div', { class: 'eyebrow', text: 'Token launch radar · snapshot ' + DATA.as_of }),
      el('h1', null, [document.createTextNode('Kestrel '), el('span', { class: 'amber', text: 'Radar' })]),
      el('p', { text: 'Every protocol DefiLlama tracks that records no token yet, ranked by what its launch would be worth — from the snapshot alone. The watchlist is the floor; the early radar adds the pre-token protocols below it.' }),
      el('div', { class: 'facts' }, [
        el('div', { class: 'fact' }, [el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })]),
        el('div', { class: 'fact' }, [el('span', { text: 'Board rows' }), el('b', { text: String(DATA.board_size) })]),
        el('div', { class: 'fact' }, [el('span', { text: 'Early rows below floor' }), el('b', { text: String(DATA.early_size) })]),
        el('div', { class: 'fact' }, [el('span', { text: 'Live-token set aside' }), el('b', { text: String(DATA.live_size) })]),
        el('div', { class: 'fact' }, [el('span', { text: 'Watchlist floor' }), el('b', { text: fmtUsd(DATA.floor_usd) })]),
        el('div', { class: 'fact' }, [el('span', { text: 'Model' }), el('b', { text: DATA.model_version })]),
      ]),
    ]);
  }

  function lede() {
    return el('section', { class: 'panel lede' }, [
      el('p', { text: 'A launch is the token a protocol may issue one day. This board asks what that token would be worth if the protocol’s record stayed as it is — and what a reader should do to farm the protocol before it issues one. It never predicts whether or when a token is issued.' }),
      el('p', { class: 'sub', text: '“Records no token” means the snapshot’s record carries none: a protocol on the board may still have a token its DefiLlama record does not carry. Implied value is this radar’s model, not a price and not a promise. Source: ' + DATA.source }),
    ]);
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var catSel = el('select', { 'aria-label': 'Category', onchange: function (e) { state.category = e.target.value; writeHash(); render(); } },
      [el('option', { value: 'all', text: 'All categories' })].concat(categories.map(function (c) {
        return el('option', { value: c, text: c, selected: state.category === c ? 'selected' : null });
      })));
    var chainSel = el('select', { 'aria-label': 'Chain', onchange: function (e) { state.chain = e.target.value; writeHash(); render(); } },
      [el('option', { value: 'all', text: 'All chains' })].concat(chains.map(function (c) {
        return el('option', { value: c, text: c, selected: state.chain === c ? 'selected' : null });
      })));
    var tvlSel = el('select', { 'aria-label': 'Minimum TVL', onchange: function (e) { state.minTvl = Number(e.target.value); writeHash(); render(); } },
      [['0', 'Any TVL'], ['50000000', 'TVL $50M+'], ['100000000', 'TVL $100M+'], ['500000000', 'TVL $500M+'], ['1000000000', 'TVL $1B+']].map(function (o) {
        return el('option', { value: o[0], text: o[1], selected: String(state.minTvl) === o[0] ? 'selected' : null });
      }));
    var search = el('input', { type: 'search', placeholder: 'Search name or slug…', value: state.q, 'aria-label': 'Search', oninput: function (e) { state.q = e.target.value; writeHash(); render(); } });
    var watch = el('label', { class: 'check' }, [
      el('input', { type: 'checkbox', checked: state.watchlist ? 'checked' : null, onchange: function (e) { state.watchlist = e.target.checked; writeHash(); render(); } }),
      document.createTextNode('Watchlist only'),
    ]);
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token board', onclick: function () { state.tab = 'pre-token'; writeHash(); render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; writeHash(); render(); } });
    var n = state.tab === 'pre-token' ? filteredRows().length + ' rows shown' : DATA.live.length + ' live-token protocols';
    return el('section', { class: 'panel controls' }, [
      el('div', { class: 'field' }, [el('label', { text: 'Search' }), search]),
      el('div', { class: 'field' }, [el('label', { text: 'Category' }), catSel]),
      el('div', { class: 'field' }, [el('label', { text: 'Chain' }), chainSel]),
      el('div', { class: 'field' }, [el('label', { text: 'Minimum TVL' }), tvlSel]),
      watch,
      el('div', { class: 'field' }, [el('label', { text: 'Token status' }), el('div', { class: 'tabs' }, [pre, live])]),
      el('span', { class: 'count sub', text: n }),
    ]);
  }

  function sortHeader(key, label, numeric) {
    var b = el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } writeHash(); render(); } },
      [document.createTextNode(label), state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null]);
    return el('th', { class: numeric ? 'num' : null }, b);
  }

  function boardTable() {
    var list = sortedRows(filteredRows());
    var ws = watchSet();
    var body = el('tbody', null, list.map(function (r) {
      var g = r.change_7d;
      var row = el('tr', { class: (r.display_rank <= 3 ? 'top3 ' : '') + (state.selected === r.slug ? 'selected' : ''), onclick: function () { openDetail(r.slug); } }, [
        el('td', null, el('span', { class: 'rankbadge', text: String(r.display_rank) })),
        el('td', null, [el('b', { text: r.name }), document.createTextNode(' '), ws[r.slug] ? el('span', { class: 'tag watch', text: 'watchlist' }) : null, el('div', { class: 'sub', text: r.slug })]),
        el('td', null, el('span', { class: 'tag', text: r.category || 'Other' })),
        el('td', { text: (r.chains || []).slice(0, 3).join(', ') || '—' }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (g === null ? '' : g > 0 ? 'pos' : g < 0 ? 'neg' : ''), text: fmtPct(g) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: fmtUsd(r.implied_value_usd) }),
      ]);
      return row;
    }));
    if (list.length === 0) {
      return el('section', { class: 'panel' }, [
        el('div', { class: 'empty' }, [
          el('h2', { text: 'No protocol matches that filter' }),
          el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchlist = false; state.minTvl = 0; writeHash(); render(); } }),
        ]),
      ]);
    }
    var table = el('table', null, [
      el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' + (state.sandbox ? ' Sandbox view: re-ranked with your constants — board.json keeps the submitted ranking.' : '') }),
      el('thead', null, el('tr', null, [
        sortHeader('implied', 'Rank', true), sortHeader('name', 'Protocol'),
        sortHeader('category', 'Category'), el('th', { text: 'Chains' }),
        sortHeader('tvl', 'TVL', true), sortHeader('growth', '7d', true),
        sortHeader('age', 'Age', true), sortHeader('implied', 'Implied value', true),
      ])),
      body,
    ]);
    return el('section', { class: 'panel' }, el('div', { class: 'tablewrap' }, table));
  }

  function liveTable() {
    var table = el('table', null, [
      el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
      el('thead', null, el('tr', null, [
        el('th', { text: 'Status' }), el('th', { text: 'Protocol' }), el('th', { text: 'Category' }),
        el('th', { text: 'Chains' }), el('th', { class: 'num', text: 'TVL' }),
        el('th', { class: 'num', text: '7d' }), el('th', { class: 'num', text: 'Market cap' }),
      ])),
      el('tbody', null, DATA.live.map(function (r) {
        return el('tr', null, [
          el('td', null, el('span', { class: 'tag', text: 'live' })),
          el('td', null, [el('b', { text: r.name }), el('div', { class: 'sub', text: r.slug })]),
          el('td', null, el('span', { class: 'tag', text: r.category || 'Other' })),
          el('td', { text: (r.chains || []).slice(0, 3).join(', ') || '—' }),
          el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
          el('td', { class: 'num', text: fmtPct(r.change_7d) }),
          el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        ]);
      })),
    ]);
    return el('section', { class: 'panel' }, el('div', { class: 'tablewrap' }, table));
  }

  function sandboxState() {
    if (!state.sandbox) return { base: DATA.model.base_multiple, growth: DATA.model.growth_weight, floor: DATA.model.maturity_floor };
    return { base: state.sandbox.base_multiple, growth: state.sandbox.growth_weight, floor: state.sandbox.maturity_floor };
  }

  function modelPanel() {
    var m = DATA.model;
    var s = sandboxState();
    function slider(id, label, min, max, step, value, onmove, hint) {
      return el('div', { class: 'slider' }, [
        el('label', { for: id }, [document.createTextNode(label + ' '), el('output', { id: id + '-out', text: String(value) })]),
        el('input', { id: id, type: 'range', min: String(min), max: String(max), step: String(step), value: String(value), oninput: onmove }),
        el('p', { class: 'sub', text: hint }),
      ]);
    }
    function ensureSandbox() {
      if (!state.sandbox) state.sandbox = { base_multiple: m.base_multiple, growth_weight: m.growth_weight, maturity_floor: m.maturity_floor };
      return state.sandbox;
    }
    var formula = 'implied = round( tvl_usd x ' + m.base_multiple + ' x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') x (1 + 0.03 x min(chains - 1, 5)) )';
    return el('section', { class: 'panel model' }, [
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'One function scores every protocol, from the snapshot’s own figures. No name is special-cased and no row is hand-picked.' }),
      el('div', { class: 'formula', text: formula }),
      el('div', { class: 'modelgrid' }, [
        el('div', { class: 'cell' }, [el('span', { text: 'Base multiple' }), el('b', { text: 'TVL x ' + m.base_multiple })]),
        el('div', { class: 'cell' }, [el('span', { text: 'Growth weight' }), el('b', { text: 'x ' + m.growth_weight + ' of 7d change' })]),
        el('div', { class: 'cell' }, [el('span', { text: 'Maturity' }), el('b', { text: m.maturity_floor + ' + up to ' + m.maturity_range + ' over ' + (m.maturity_days / 365) + 'y' })]),
        el('div', { class: 'cell' }, [el('span', { text: 'Chain breadth' }), el('b', { text: '+3% per extra chain, max 5' })]),
      ]),
      el('h3', { text: 'Try the model yourself' }),
      el('p', { class: 'sandbox-note', text: 'Move a slider and the board re-ranks from the same figures, live. This is a sandbox: board.json keeps the submitted ranking.' }),
      el('div', { class: 'sandbox' }, [
        slider('sb-base', 'Base multiple', 0.1, 0.5, 0.01, s.base, function (e) { ensureSandbox().base_multiple = Number(e.target.value); document.getElementById('sb-base-out').textContent = e.target.value; writeHash(); render(); }, 'How much of a protocol’s TVL its token would be worth.'),
        slider('sb-growth', 'Growth weight', 0, 1, 0.05, s.growth, function (e) { ensureSandbox().growth_weight = Number(e.target.value); document.getElementById('sb-growth-out').textContent = e.target.value; writeHash(); render(); }, 'How much seven-day growth moves the value.'),
        slider('sb-floor', 'Maturity floor', 0.3, 0.8, 0.05, s.floor, function (e) { ensureSandbox().maturity_floor = Number(e.target.value); document.getElementById('sb-floor-out').textContent = e.target.value; writeHash(); render(); }, 'The value a brand-new protocol starts from.'),
      ]),
      el('p', null, [
        el('button', { class: 'button', type: 'button', text: 'Reset model', onclick: function () { state.sandbox = null; writeHash(); render(); } }),
      ]),
      el('p', { class: 'sub', text: 'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed — the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days. The early radar is every pre-token protocol below the watchlist floor, by TVL, and the live-token protocols are set aside with their market caps shown.' }),
    ]);
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function whyLine(row) {
    var parts = [];
    if (row.display_rank <= 3) parts.push('one of the three most valuable launches on the board');
    else if (row.display_rank <= 10) parts.push('in the top 10 by implied value');
    else if (row.display_rank <= 40) parts.push('inside the watchlist band by value');
    else parts.push('an early find below the watchlist floor');
    if (row.change_7d !== null && row.change_7d > 20) parts.push('growing fast (' + fmtPct(row.change_7d) + ' in 7 days)');
    if (row.age_days !== null && row.age_days > 730) parts.push('running ' + fmtAge(row.age_days) + ' with no token');
    if ((row.chains || []).length >= 3) parts.push('live on ' + row.chains.length + ' chains');
    return 'Ranked #' + row.display_rank + ' because it is ' + parts.join(', ') + '.';
  }

  function openDetail(slug) {
    var row = viewRows().filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = row.farm_steps || [];
    dialog.appendChild(el('div', { class: 'detail-head' }, [
      el('div', null, [
        el('span', { class: 'brand', text: 'Rank ' + row.display_rank + ' of ' + DATA.board_size }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') }),
      ]),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } }),
    ]));
    dialog.appendChild(el('section', { class: 'detail-section' }, [
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' }, [
        el('div', null, [el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })]),
        el('div', null, [el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })]),
        el('div', null, [el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })]),
        el('div', null, [el('span', { text: 'Chains' }), el('b', { class: 'num', text: String((row.chains || []).length) })]),
        el('div', null, [el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })]),
        el('div', null, [el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })]),
        el('div', null, [el('span', { text: 'Breadth multiplier' }), el('b', { class: 'num', text: String(row.breadth_multiplier) })]),
        el('div', null, [el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })]),
      ]),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(impliedOf(row, activeModel())) + (impliedOf(row, activeModel()) === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the sandbox is on.') + ' This is an estimate, not a price.' }),
      el('p', { class: 'why', text: whyLine(row) }),
    ]));
    dialog.appendChild(el('section', { class: 'detail-section' }, [
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, [el('b', { text: action }), el('span', { class: 'cost', text: tail })]);
      })),
    ]));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function readHash() {
    var h = window.location.hash || '';
    var q = {};
    h.replace(/^#/, '').split('&').forEach(function (part) {
      var kv = part.split('=');
      if (kv[0]) q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    if (q.view === 'filtered') {
      var cats = {};
      DATA.rows.forEach(function (r) { var c = r.category || 'Other'; cats[c] = (cats[c] || 0) + 1; });
      var top = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; })[0];
      state.category = top || 'all';
      state.watchlist = true;
    }
    if (q.tab) state.tab = q.tab;
    if (q.q) state.q = q.q;
    if (q.category) state.category = q.category;
    if (q.chain) state.chain = q.chain;
    if (q.watchlist === '1') state.watchlist = true;
    if (q.mintvl) state.minTvl = Number(q.mintvl) || 0;
    if (q.sort) state.sort = q.sort;
    if (q.dir) state.dir = Number(q.dir) || -1;
    if (q.detail) state.selected = q.detail;
    if (q.base || q.growth || q.floor) {
      state.sandbox = {
        base_multiple: Number(q.base) || DATA.model.base_multiple,
        growth_weight: Number(q.growth) || DATA.model.growth_weight,
        maturity_floor: Number(q.floor) || DATA.model.maturity_floor,
      };
    }
  }

  function writeHash() {
    var parts = [];
    if (state.tab !== 'pre-token') parts.push('tab=' + state.tab);
    if (state.q) parts.push('q=' + encodeURIComponent(state.q));
    if (state.category !== 'all') parts.push('category=' + encodeURIComponent(state.category));
    if (state.chain !== 'all') parts.push('chain=' + encodeURIComponent(state.chain));
    if (state.watchlist) parts.push('watchlist=1');
    if (state.minTvl > 0) parts.push('mintvl=' + state.minTvl);
    if (state.sort !== 'implied' || state.dir !== -1) parts.push('sort=' + state.sort + '&dir=' + state.dir);
    if (state.selected) parts.push('detail=' + state.selected);
    if (state.sandbox) parts.push('base=' + state.sandbox.base_multiple + '&growth=' + state.sandbox.growth_weight + '&floor=' + state.sandbox.maturity_floor);
    var next = parts.length ? '#' + parts.join('&') : '#board';
    try { window.history.replaceState(null, '', next); } catch (e) { window.location.hash = next; }
  }

  function render() {
    if (!DATA || !DATA.rows) {
      app.innerHTML = '<section class="panel"><h2>No data</h2><p>The dashboard data did not load.</p></section>';
      app.setAttribute('aria-busy', 'false');
      window.__shotReady = true;
      return;
    }
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
    window.__shotReady = true;
  }

  // The watchlist as a lookup, built once from the board's own rows is not possible: the snapshot's
  // watchlist is not in data.js, so the page carries it in the rows themselves.
  DATA.watchlistSlugs = {};
  DATA.rows.forEach(function (r) { if (r.on_watchlist) DATA.watchlistSlugs[r.slug] = true; });

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
