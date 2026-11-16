// Token Radar dashboard: renders window.RADAR into the board, the detail
// view and the live-token table. No network, no framework. State lives in
// the URL hash so a view can be opened directly: #detail=<slug> opens a
// protocol, #cat=<category> filters by category, #q=<text> searches.

(function () {
  var R = window.RADAR;
  var rows = R.rows;
  var bySlug = {};
  rows.forEach(function (r) { bySlug[r.slug] = r; });
  var maxImplied = rows.length ? rows[0].implied_value_usd : 1;

  function $(id) { return document.getElementById(id); }

  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + n;
  }
  function pct(v) {
    if (v === null || v === undefined) return '—';
    var s = (v > 0 ? '+' : '') + v.toFixed(1) + '%';
    return v > 0 ? '<span class="up">' + s + '</span>' : v < 0 ? '<span class="down">' + s + '</span>' : s;
  }
  function age(v) {
    if (v === null || v === undefined) return '—';
    if (v >= 365) return (v / 365).toFixed(1) + 'y';
    return v + 'd';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---- header and stats ----
  $('asOf').textContent = R.as_of;
  $('source').textContent = R.source;
  var top = rows[0];
  if (top) {
    $('topValue').textContent = money(top.implied_value_usd);
    $('topName').textContent = '#' + top.rank + ' ' + top.name;
  }
  $('stats').innerHTML = [
    ['<b>' + rows.length + '</b>', 'protocols ranked, pre-token only'],
    ['<b>' + R.watchlist_size + ' / ' + R.watchlist_size + '</b>', 'watchlist protocols covered'],
    ['<b>' + R.validation.peers + '</b>', 'live-token peers priced the model'],
    ['<b>' + money(top ? top.implied_value_usd : 0) + '</b>', 'highest implied value on the board'],
  ].map(function (s) { return '<div class="stat">' + s[0] + '<span>' + s[1] + '</span></div>'; }).join('');

  var v = R.validation;
  $('validation').innerHTML =
    '<strong>Checked, not claimed.</strong> The model was back-tested on the ' + v.peers +
    ' live-token protocols in this same snapshot: each one was re-priced with its category multiple computed without it. ' +
    'Median miss ' + (Math.exp(v.median_log_error)).toFixed(1) + '&times;; ' +
    Math.round(v.within_2x * 100) + '% landed within 2&times; of their real market cap, ' +
    Math.round(v.within_3x * 100) + '% within 3&times;. ' +
    'The multiple is a yardstick for ranking, not a price target.';

  // ---- filters ----
  var cats = [];
  var chains = [];
  rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
    r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort();
  chains.sort();
  cats.forEach(function (c) { $('cat').insertAdjacentHTML('beforeend', '<option>' + esc(c) + '</option>'); });
  chains.forEach(function (c) { $('chain').insertAdjacentHTML('beforeend', '<option>' + esc(c) + '</option>'); });

  var state = { q: '', cat: '', chain: '', sort: 'implied', watchOnly: false };

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = rows.filter(function (r) {
      if (state.watchOnly && !isWatch(r.slug)) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var sorts = {
      implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      growth: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); },
      age: function (a, b) { return (b.age_days || 0) - (a.age_days || 0); },
      name: function (a, b) { return a.name < b.name ? -1 : 1; },
    };
    return list.sort(sorts[state.sort] || sorts.implied);
  }

  // The watchlist is the floor: the board carries every slug on it, so the
  // toggle is answered from the rows the model marked. Rank 1..40 are not
  // the watchlist; the set is the snapshot's own list, carried in data.js.
  var watchSet = {};
  (R.watchlist || []).forEach(function (s) { watchSet[s] = true; });
  function isWatch(slug) { return !!watchSet[slug]; }

  function renderBoard() {
    var list = filtered();
    $('count').textContent = 'Showing ' + list.length + ' of ' + rows.length + ' ranked protocols';
    $('rows').innerHTML = list.map(function (r) {
      var w = Math.max(2, Math.round((r.implied_value_usd / maxImplied) * 100));
      var chains = r.chains.length > 3 ? r.chains.slice(0, 3).join(', ') + ' +' + (r.chains.length - 3) : r.chains.join(', ');
      return '<tr data-slug="' + esc(r.slug) + '">' +
        '<td class="num rank">' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span>' + (isWatch(r.slug) ? '<span class="tag">watchlist</span>' : '') + '</td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td class="chains">' + esc(chains || '—') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + r.peer_multiple.toFixed(2) + '&times;</td>' +
        '<td class="num"><b>' + money(r.implied_value_usd) + '</b><span class="bar"><i style="width:' + w + '%"></i></span></td>' +
        '</tr>';
    }).join('');
  }

  // ---- live-token table ----
  $('liveRows').innerHTML = R.live.map(function (p) {
    return '<tr>' +
      '<td><span class="name">' + esc(p.name) + '</span></td>' +
      '<td>' + esc(p.category || '—') + '</td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td>' +
      '<td class="num">' + money(p.mcap_usd) + '</td>' +
      '<td class="num">' + (p.ratio === null ? '—' : p.ratio.toFixed(2) + '&times;') + '</td>' +
      '<td class="num">' + pct(p.change_7d) + '</td>' +
      '</tr>';
  }).join('');

  // ---- detail view ----
  function peersInCategory(cat) {
    return R.live.filter(function (p) { return p.category === cat; }).slice(0, 6);
  }
  function openDetail(slug) {
    var r = bySlug[slug];
    if (!r) return;
    document.querySelectorAll('#rows tr.active').forEach(function (tr) { tr.classList.remove('active'); });
    var tr = document.querySelector('#rows tr[data-slug="' + slug + '"]');
    if (tr) tr.classList.add('active');
    $('dRank').textContent = 'Rank #' + r.rank + ' · ' + (isWatch(r.slug) ? 'on the watchlist' : 'early find, below the watchlist floor');
    $('dName').textContent = r.name;
    $('dSub').textContent = (r.category || 'Uncategorised') + ' · ' + (r.chains.join(', ') || 'no chain listed') + ' · tracked since ' + (r.listed_at || 'unknown');
    $('dStats').innerHTML = [
      ['Implied value', '<b>' + money(r.implied_value_usd) + '</b>'],
      ['TVL', '<b>' + money(r.tvl_usd) + '</b>'],
      ['7-day change', '<b>' + pct(r.change_7d) + '</b>'],
      ['Age', '<b>' + age(r.age_days) + '</b>'],
    ].map(function (c) { return '<div class="cell"><span>' + c[0] + '</span>' + c[1] + '</div>'; }).join('');
    var base = r.tvl_usd * r.peer_multiple;
    $('dModel').innerHTML = [
      ['TVL', money(r.tvl_usd)],
      ['Peer multiple (' + (r.category || 'Uncategorised') + ')', r.peer_multiple.toFixed(2) + '&times;'],
      ['Base value (TVL &times; multiple)', money(Math.round(base))],
      ['Growth multiplier', '&times;' + r.growth_multiplier.toFixed(2)],
      ['Maturity multiplier', '&times;' + r.maturity_multiplier.toFixed(2)],
      ['Chain multiplier', '&times;' + r.chain_multiplier.toFixed(2)],
      ['Implied value', '<b>' + money(r.implied_value_usd) + '</b>'],
    ].map(function (row) { return '<tr><td>' + row[0] + '</td><td class="num">' + row[1] + '</td></tr>'; }).join('');
    $('dSteps').innerHTML = r.farm_steps.map(function (s) {
      var m = s.match(/^(.*?) Cost: (.*?) Time: (.*?)\.?$/);
      if (!m) return '<li>' + esc(s) + '</li>';
      return '<li>' + esc(m[1]) + '<span class="meta">Cost: ' + esc(m[2]) + ' · Time: ' + esc(m[3]) + '</span></li>';
    }).join('');
    var peers = peersInCategory(r.category);
    $('dPeers').innerHTML = peers.length === 0
      ? '<tr><td>No live-token peer in this category is in the snapshot, so the global median multiple was used.</td></tr>'
      : '<tr><th>Protocol</th><th class="num">TVL</th><th class="num">Market cap</th><th class="num">Mcap / TVL</th></tr>' +
        peers.map(function (p) {
          return '<tr><td><span class="name">' + esc(p.name) + '</span></td><td class="num">' + money(p.tvl_usd) + '</td><td class="num">' + money(p.mcap_usd) + '</td><td class="num">' + (p.ratio === null ? '—' : p.ratio.toFixed(2) + '&times;') + '</td></tr>';
        }).join('');
    $('detail').hidden = false;
    $('detail').scrollIntoView({ behavior: 'auto', block: 'start' });
    if (location.hash.indexOf('detail=') < 0) {
      try { history.replaceState(null, '', '#detail=' + slug); } catch (e) { /* file:// */ }
    }
  }
  $('dClose').addEventListener('click', function () {
    $('detail').hidden = true;
    document.querySelectorAll('#rows tr.active').forEach(function (tr) { tr.classList.remove('active'); });
    try { history.replaceState(null, '', '#'); } catch (e) { /* file:// */ }
  });
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) openDetail(tr.getAttribute('data-slug'));
  });

  // ---- filter events ----
  $('q').addEventListener('input', function () { state.q = this.value; renderBoard(); });
  $('cat').addEventListener('change', function () { state.cat = this.value; renderBoard(); });
  $('chain').addEventListener('change', function () { state.chain = this.value; renderBoard(); });
  $('sort').addEventListener('change', function () { state.sort = this.value; renderBoard(); });
  $('watchOnly').addEventListener('change', function () { state.watchOnly = this.checked; renderBoard(); });

  // ---- hash state: #detail=<slug>, #cat=<category>, #q=<text> ----
  var hash = (location.hash || '').slice(1);
  var params = {};
  hash.split('&').forEach(function (part) {
    var kv = part.split('=');
    if (kv[0]) params[kv[0]] = decodeURIComponent(kv[1] || '');
  });
  if (params.cat) { state.cat = params.cat; $('cat').value = params.cat; }
  if (params.q) { state.q = params.q; $('q').value = params.q; }
  if (params.sort) { state.sort = params.sort; $('sort').value = params.sort; }
  renderBoard();
  if (params.detail) openDetail(params.detail);
  else if (params.view === 'board') $('boardPanel').scrollIntoView({ behavior: 'auto', block: 'start' });
})();
