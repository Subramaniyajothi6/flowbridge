// FlowBridge page runtime: renders the design's templates with React.
(function (root) {
  var R = root.React;
  var registry = {};
  var ATTR = { 'class': 'className', 'for': 'htmlFor', tabindex: 'tabIndex', autocomplete: 'autoComplete', readonly: 'readOnly', spellcheck: 'spellCheck', colspan: 'colSpan', rowspan: 'rowSpan', maxlength: 'maxLength', autofocus: 'autoFocus' };
  var camel = function (s) { return s.replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); }); };
  var lookup = function (expr, scope) {
    var e = expr.trim();
    if (e === 'true') return true;
    if (e === 'false') return false;
    if (/^\d+$/.test(e)) return +e;
    var parts = e.split('.'), v = scope;
    for (var i = 0; i < parts.length; i++) { if (v === undefined || v === null) return undefined; v = v[parts[i]]; }
    return v;
  };
  var WHOLE = /^\{\{([^}]*)\}\}$/;
  var value = function (raw, scope) {
    var w = WHOLE.exec(raw);
    if (w) return lookup(w[1], scope);
    return raw.replace(/\{\{([^}]*)\}\}/g, function (m, e) { var v = lookup(e, scope); return v === undefined || v === null || v === false ? '' : String(v); });
  };
  var styleObject = function (s) {
    var out = {};
    var depth = 0, cur = '', parts = [];
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ';' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
    }
    parts.push(cur);
    parts.forEach(function (p) {
      var at = p.indexOf(':');
      if (at < 0) return;
      var k = p.slice(0, at).trim(), v = p.slice(at + 1).trim();
      if (!k || v === '') return;
      out[k.indexOf('--') === 0 ? k : camel(k.replace(/^-webkit-/, 'Webkit-'))] = v;
    });
    return out;
  };
  var attrs = function (a, scope) {
    var p = {};
    Object.keys(a).forEach(function (k) {
      if (k.indexOf('hint-') === 0) return;
      var v = value(a[k], scope);
      if (k === 'style') { p.style = styleObject(String(v)); return; }
      var name = ATTR[k] || (/^(aria|data)-/.test(k) ? k : (k.indexOf('-') > 0 ? camel(k) : k));
      if (/^(aria|data)-/.test(k) && typeof v === 'boolean') v = String(v);
      p[name] = v;
    });
    return p;
  };
  var kids = function (nodes, scope) {
    var out = [];
    nodes.forEach(function (n, i) {
      var r = one(n, scope, i);
      if (r !== null && r !== undefined) out.push(r);
    });
    return out;
  };
  var one = function (n, scope, key) {
    if (typeof n === 'string') {
      var t = value(n, scope);
      return t === undefined || t === null || t === false || t === true ? null : t;
    }
    if (n.t === 'sc-if') {
      if (!lookup(WHOLE.exec(n.a.value)[1], scope)) return null;
      return R.createElement.apply(null, [R.Fragment, { key: key }].concat(kids(n.c, scope)));
    }
    if (n.t === 'sc-for') {
      var list = lookup(WHOLE.exec(n.a.list)[1], scope) || [];
      return R.createElement.apply(null, [R.Fragment, { key: key }].concat(list.map(function (item, i) {
        var inner = Object.create(scope);
        inner[n.a.as] = item;
        return R.createElement.apply(null, [R.Fragment, { key: i }].concat(kids(n.c, inner)));
      })));
    }
    if (n.t === 'dc-import') {
      var props = { key: key };
      Object.keys(n.a).forEach(function (k) {
        if (k === 'name' || k.indexOf('hint-') === 0) return;
        props[camel(k)] = value(n.a[k], scope);
      });
      return R.createElement(FB.component(n.a.name), props);
    }
    var p = attrs(n.a, scope);
    p.key = key;
    if (p.value !== undefined && !p.onChange && (n.t === 'input' || n.t === 'textarea')) { p.defaultValue = p.value; delete p.value; }
    return R.createElement.apply(null, [n.t, p].concat(kids(n.c, scope)));
  };
  var FB = root.FB = {
    def: function (name, ast, dflt, factory) { registry[name] = { ast: ast, dflt: dflt, factory: factory, K: null }; },
    component: function (name) {
      var d = registry[name];
      if (!d) throw Error('Unknown component ' + name);
      if (!d.K) {
        var K = d.factory(R.Component);
        K.prototype.render = function () {
          var vals = this.renderVals ? this.renderVals() : {};
          return R.createElement.apply(null, [R.Fragment, null].concat(kids(d.ast, Object.assign({}, vals))));
        };
        K.defaultProps = d.dflt;
        K.displayName = name;
        d.K = K;
      }
      return d.K;
    },
    element: function (name) { return R.createElement(FB.component(name)); },
    mount: function (name) {
      var el = document.getElementById('root');
      if (el.firstChild && !document.documentElement.classList.contains('fb-wait')) { root.ReactDOM.hydrateRoot(el, FB.element(name), { onRecoverableError: function () {} }); return; }
      el.innerHTML = '';
      var r = root.ReactDOM.createRoot(el);
      root.ReactDOM.flushSync(function () { r.render(FB.element(name)); });
      document.documentElement.classList.remove('fb-wait');
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);

FB.def("Analytics",[{"t":"div","a":{"class":"app"},"c":[{"t":"dc-import","a":{"name":"Sidebar","active":"analytics","hint-size":"232px,100vh"},"c":[]},{"t":"div","a":{"class":"main"},"c":[{"t":"dc-import","a":{"name":"Topbar","page":"{{pageName}}","hint-size":"100%,56px"},"c":[]},{"t":"main","a":{"class":"page"},"c":[{"t":"div","a":{"class":"page-head"},"c":[{"t":"div","a":{},"c":[{"t":"h1","a":{"class":"page-title"},"c":["{{pageName}}"]},{"t":"p","a":{"class":"page-sub"},"c":["{{pageSub}}"]}]},{"t":"div","a":{"class":"seg-ctl","role":"group","aria-label":"Date range"},"c":[{"t":"sc-for","a":{"list":"{{ranges}}","as":"r","hint-placeholder-count":"3"},"c":[{"t":"button","a":{"class":"{{r.cls}}","aria-pressed":"{{r.on}}","onClick":"{{r.pick}}"},"c":["{{r.l}}"]}]}]}]},{"t":"section","a":{"class":"card stats","aria-label":"Summary for the selected range"},"c":[{"t":"sc-for","a":{"list":"{{stats}}","as":"s","hint-placeholder-count":"4"},"c":[{"t":"div","a":{"class":"stat"},"c":[{"t":"span","a":{"class":"stat-l"},"c":["{{s.l}}"]},{"t":"span","a":{"class":"stat-v"},"c":["{{s.v}}"]},{"t":"span","a":{"class":"stat-d"},"c":["{{s.d}}"]}]}]}]},{"t":"section","a":{"class":"card"},"c":[{"t":"div","a":{"class":"card-h"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Execution trend"]},{"t":"button","a":{"class":"btn btn-sm btn-g","aria-pressed":"{{tableOn}}","onClick":"{{toggleTable}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{tableIc}}","s":"13","hint-size":"13px,13px"},"c":[]},"{{tableL}}"]}]},{"t":"sc-if","a":{"value":"{{showChart}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"div","a":{"class":"card-b col","style":"gap: 6px","onMouseLeave":"{{clear}}"},"c":[{"t":"div","a":{"class":"row between small"},"c":[{"t":"span","a":{"class":"muted"},"c":["Successful runs per day"]},{"t":"span","a":{"class":"dim num"},"c":["Peak {{peakS}}"]}]},{"t":"div","a":{"class":"bars {{hoverCls}}","style":"height: 200px; border-bottom: 1px solid var(--line-2)"},"c":[{"t":"sc-for","a":{"list":"{{days}}","as":"d","hint-placeholder-count":"30"},"c":[{"t":"div","a":{"class":"bar-col {{d.cls}}","onMouseEnter":"{{d.hover}}"},"c":[{"t":"div","a":{"class":"bar","style":"height: {{d.sh}}%"},"c":[]}]}]},{"t":"sc-if","a":{"value":"{{tip}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"chart-tip","style":"left: {{tip.left}}%; top: 4px"},"c":[{"t":"strong","a":{},"c":["{{tip.l}}"]},{"t":"br","a":{},"c":[]},"{{tip.s}} succeeded",{"t":"br","a":{},"c":[]},"{{tip.f}} failed, {{tip.rate}} success",{"t":"br","a":{},"c":[]},"{{tip.d}} average"]}]}]},{"t":"div","a":{"class":"row between small","style":"margin-top: 8px"},"c":[{"t":"span","a":{"class":"muted"},"c":["Failed runs per day"]},{"t":"span","a":{"class":"dim num"},"c":["Peak {{peakF}}"]}]},{"t":"div","a":{"class":"bars {{hoverCls}}","style":"height: 56px; border-bottom: 1px solid var(--line-2)"},"c":[{"t":"sc-for","a":{"list":"{{days}}","as":"d","hint-placeholder-count":"30"},"c":[{"t":"div","a":{"class":"bar-col {{d.cls}}","onMouseEnter":"{{d.hover}}"},"c":[{"t":"div","a":{"class":"bar","style":"height: {{d.fh}}%; background: var(--err-m)"},"c":[]}]}]}]},{"t":"div","a":{"class":"row between small muted","style":"margin-top: 8px"},"c":[{"t":"span","a":{},"c":["Average duration per day"]},{"t":"span","a":{"class":"dim num"},"c":["Peak {{peakD}}"]}]},{"t":"div","a":{"class":"bars {{hoverCls}}","style":"height: 44px; border-bottom: 1px solid var(--line-2)"},"c":[{"t":"sc-for","a":{"list":"{{days}}","as":"d","hint-placeholder-count":"30"},"c":[{"t":"div","a":{"class":"bar-col {{d.cls}}","onMouseEnter":"{{d.hover}}"},"c":[{"t":"div","a":{"class":"bar","style":"height: {{d.dh}}%; background: #958E87"},"c":[]}]}]}]},{"t":"div","a":{"class":"row between small dim num"},"c":[{"t":"span","a":{},"c":["{{first}}"]},{"t":"span","a":{},"c":["{{last}}"]}]}]}]},{"t":"sc-if","a":{"value":"{{showTable}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"tbl-wrap","style":"max-height: 360px; overflow: auto; margin-top: 10px"},"c":[{"t":"table","a":{"class":"tbl"},"c":[{"t":"thead","a":{},"c":[{"t":"tr","a":{},"c":[{"t":"th","a":{},"c":["Date"]},{"t":"th","a":{"class":"r"},"c":["Successful"]},{"t":"th","a":{"class":"r"},"c":["Failed"]},{"t":"th","a":{"class":"r"},"c":["Success rate"]},{"t":"th","a":{"class":"r"},"c":["Average duration"]}]}]},{"t":"tbody","a":{},"c":[{"t":"sc-for","a":{"list":"{{tableRows}}","as":"d"},"c":[{"t":"tr","a":{},"c":[{"t":"td","a":{},"c":["{{d.l}}"]},{"t":"td","a":{"class":"r num"},"c":["{{d.s}}"]},{"t":"td","a":{"class":"r num"},"c":["{{d.f}}"]},{"t":"td","a":{"class":"r num"},"c":["{{d.rate}}"]},{"t":"td","a":{"class":"r num"},"c":["{{d.d}}"]}]}]}]}]}]}]}]},{"t":"div","a":{"class":"g-21"},"c":[{"t":"section","a":{"class":"card"},"c":[{"t":"div","a":{"class":"card-h","style":"padding-bottom: 10px"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Most active workflows"]},{"t":"span","a":{"class":"small dim"},"c":["Sorted by runs"]}]},{"t":"div","a":{"class":"tbl-wrap"},"c":[{"t":"table","a":{"class":"tbl"},"c":[{"t":"thead","a":{},"c":[{"t":"tr","a":{},"c":[{"t":"th","a":{},"c":["Workflow"]},{"t":"th","a":{"class":"r"},"c":["Runs"]},{"t":"th","a":{"class":"r"},"c":["Success"]},{"t":"th","a":{"class":"r hide-m"},"c":["Failure"]},{"t":"th","a":{"class":"r hide-m"},"c":["Avg. duration"]}]}]},{"t":"tbody","a":{},"c":[{"t":"sc-for","a":{"list":"{{wfs}}","as":"w","hint-placeholder-count":"5"},"c":[{"t":"tr","a":{},"c":[{"t":"td","a":{},"c":[{"t":"a","a":{"class":"link-row","href":"{{wfHref}}"},"c":["{{w.n}}"]}]},{"t":"td","a":{"class":"r num"},"c":["{{w.runs}}"]},{"t":"td","a":{"class":"r num"},"c":["{{w.rate}}"]},{"t":"td","a":{"class":"r num hide-m"},"c":["{{w.fail}}"]},{"t":"td","a":{"class":"r num hide-m"},"c":["{{w.dur}}"]}]}]}]}]}]}]},{"t":"section","a":{"class":"card"},"c":[{"t":"div","a":{"class":"card-h"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Why runs failed"]}]},{"t":"div","a":{"class":"card-b col","style":"gap: 13px"},"c":[{"t":"sc-for","a":{"list":"{{reasons}}","as":"r","hint-placeholder-count":"5"},"c":[{"t":"div","a":{"class":"col","style":"gap: 5px"},"c":[{"t":"div","a":{"class":"row between","style":"gap: 12px; font-size: 13px"},"c":[{"t":"span","a":{"class":"trunc"},"c":["{{r.l}}"]},{"t":"span","a":{"class":"num strong"},"c":["{{r.c}}"]}]},{"t":"div","a":{"class":"hbar err"},"c":[{"t":"i","a":{"style":"width: {{r.p}}%"},"c":[]}]}]}]}]}]}]},{"t":"section","a":{"class":"card"},"c":[{"t":"div","a":{"class":"card-h"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Integration usage"]},{"t":"span","a":{"class":"small dim"},"c":["Steps run per app"]}]},{"t":"div","a":{"class":"card-b","style":"display: grid; grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr)); gap: 13px 32px"},"c":[{"t":"sc-for","a":{"list":"{{apps}}","as":"a","hint-placeholder-count":"7"},"c":[{"t":"div","a":{"class":"row","style":"gap: 10px"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"{{a.m}}","s":"26","hint-size":"26px,26px"},"c":[]},{"t":"div","a":{"class":"grow col","style":"gap: 5px"},"c":[{"t":"div","a":{"class":"row between","style":"font-size: 13px"},"c":[{"t":"span","a":{},"c":["{{a.n}}"]},{"t":"span","a":{"class":"num strong"},"c":["{{a.c}}"]}]},{"t":"div","a":{"class":"hbar"},"c":[{"t":"i","a":{"style":"width: {{a.p}}%"},"c":[]}]}]}]}]}]}]}]}]}]}],{},function(DCLogic){

const FB_ACC = {
  admin: { k: 'admin', n: 'Jonah Thomas', f: 'Jonah', i: 'JT', a: 'a5', r: 'Administrator', e: 'jonah@meridianlogistics.example' },
  creator: { k: 'creator', n: 'Priya Raman', f: 'Priya', i: 'PR', a: '', r: 'Workflow Creator', e: 'priya@meridianlogistics.example' },
  operator: { k: 'operator', n: 'Rahul Shah', f: 'Rahul', i: 'RS', a: 'a3', r: 'Technical Operator', e: 'rahul@meridianlogistics.example' },
  business: { k: 'business', n: 'Lena Costa', f: 'Lena', i: 'LC', a: 'a2', r: 'Business User', e: 'lena@meridianlogistics.example' }
};
const FB_CANS = {
  admin: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 1 },
  creator: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 0 },
  operator: { edit: 0, builder: 1, publish: 0, retry: 1, data: 1, integ: 0, integView: 1, admin: 0 },
  business: { edit: 0, builder: 0, publish: 0, retry: 0, data: 0, integ: 0, integView: 0, admin: 0 }
};
const fbStored = () => { let k = ''; try { k = localStorage.getItem('fb-role') || ''; } catch (e) {} if (!k) { try { const m = /fb-role:(\w+)/.exec(window.name || ''); if (m) k = m[1]; } catch (e) {} } return FB_ACC[k] ? k : ''; };
const fbSetRole = (k) => { try { if (k) localStorage.setItem('fb-role', k); else localStorage.removeItem('fb-role'); } catch (e) {} try { window.name = k ? 'fb-role:' + k : ''; } catch (e) {} };
const FB_ME = FB_ACC[fbStored() || 'creator'], FB_C = FB_CANS[FB_ME.k];
const S = [727,809,683,165,271,729,603,628,783,765,221,295,823,705,610,713,758,203,213,808,806,688,737,832,289,181,719,788,684,676];
const F = [11,14,15,6,4,14,15,12,12,15,7,4,13,15,14,11,14,7,6,12,15,15,52,31,7,7,12,13,15,14];
const D = [2.3,2.2,2.4,2.1,2.0,2.3,2.5,2.4,2.2,2.3,2.0,2.1,2.4,2.5,2.3,2.2,2.4,2.0,2.1,2.3,2.4,2.5,4.6,3.7,2.2,2.1,2.3,2.4,2.3,2.4];
const L = ['7 Oct','8 Oct','9 Oct','10 Oct','11 Oct','12 Oct','13 Oct','14 Oct','15 Oct','16 Oct','17 Oct','18 Oct','19 Oct','20 Oct','21 Oct','22 Oct','23 Oct','24 Oct','25 Oct','26 Oct','27 Oct','28 Oct','29 Oct','30 Oct','31 Oct','1 Nov','2 Nov','3 Nov','4 Nov','5 Nov'];
const WF = [
  { n: 'New customer onboarding', runs: 4812, rate: 97.6, dur: '3.4 s' },
  { n: 'Invoice paid to ledger', runs: 3266, rate: 99.6, dur: '1.4 s' },
  { n: 'Support ticket triage', runs: 2944, rate: 96.1, dur: '1.8 s' },
  { n: 'Lead sync to PostgreSQL', runs: 2190, rate: 99.1, dur: '4.2 s' },
  { n: 'Overdue task reminders', runs: 930, rate: 100, dur: '3.0 s' }
];
const WHY = [['Gmail daily sending limit', 143], ['External API returned a server error', 71], ['Slack channel not found', 87], ['PostgreSQL connection timed out', 64], ['Incoming data failed validation', 37]].sort((a, b) => b[1] - a[1]);
const APPS = [['Gm', 'Gmail', 6210], ['Pg', 'PostgreSQL', 5980], ['Sl', 'Slack', 5140], ['Api', 'Custom HTTP API', 4305], ['Gs', 'Google Sheets', 2640], ['Mg', 'MongoDB', 1120], ['Dc', 'Discord', 860]];
const n0 = (v) => Math.round(v).toLocaleString('en-GB');
const sum = (a) => a.reduce((x, y) => x + y, 0);
class Component extends DCLogic {
  state = { range: 30, hover: -1, table: false };
  renderVals() {
    const st = this.state, n = st.range, h = st.hover;
    const s = S.slice(-n), f = F.slice(-n), d = D.slice(-n), l = L.slice(-n);
    const ts = sum(s), tf = sum(f), tot = ts + tf;
    const avg = d.reduce((acc, v, i) => acc + v * (s[i] + f[i]), 0) / tot;
    const k = tot / 18314, kf = tf / 402;
    const maxS = Math.max(...s), maxF = Math.max(...f), maxD = Math.max(...d);
    const rateOf = (i) => (s[i] / (s[i] + f[i]) * 100).toFixed(1) + '%';
    const scaled = WHY.map(([w, c]) => [w, Math.max(1, Math.round(c * kf))]);
    const maxW = Math.max(...scaled.map((r) => r[1]));
    return {
      pageName: FB_ME.k === 'business' ? 'Reports' : 'Analytics', pageSub: FB_ME.k === 'business' ? 'How well your automations are working. Test runs are not included.' : 'How reliably your published workflows ran, and where to look when they did not. Test runs are not included.',
      wfHref: FB_C.builder ? '/builder' : '/executions',
      ranges: [7, 14, 30].map((r) => ({ l: 'Last ' + r + ' days', cls: r === n ? 'is-on' : '', on: r === n ? 'true' : 'false', pick: () => this.setState({ range: r, hover: -1 }) })),
      stats: [
        { l: 'Total runs', v: n0(tot), d: ts.toLocaleString('en-GB') + ' succeeded' },
        { l: 'Success rate', v: (ts / tot * 100).toFixed(1) + '%', d: 'Runs that finished every step' },
        { l: 'Failure rate', v: (tf / tot * 100).toFixed(1) + '%', d: tf + ' failed runs' },
        { l: 'Average duration', v: avg.toFixed(1) + ' s', d: 'Across all workflows' }
      ],
      tableOn: st.table ? 'true' : 'false', tableIc: st.table ? 'chart' : 'list', tableL: st.table ? 'View as chart' : 'View as table',
      toggleTable: () => this.setState({ table: !st.table }), showChart: !st.table, showTable: st.table,
      clear: () => this.setState({ hover: -1 }), hoverCls: h >= 0 ? 'has-hover' : '',
      days: s.map((v, i) => ({
        sh: Math.round(v / maxS * 96), fh: Math.max(4, Math.round(f[i] / maxF * 100)), dh: Math.round(d[i] / maxD * 100),
        cls: i === h ? 'is-h' : '', hover: () => this.setState({ hover: i })
      })),
      tip: h >= 0 && h < n ? { l: l[h], s: n0(s[h]), f: f[h], rate: rateOf(h), d: d[h].toFixed(1) + ' s', left: Math.min(88, Math.max(12, (h + 0.5) / n * 100)) } : false,
      peakS: n0(maxS), peakF: maxF, peakD: maxD.toFixed(1) + ' s', first: l[0], last: l[n - 1],
      tableRows: l.map((x, i) => ({ l: x, s: n0(s[i]), f: f[i], rate: rateOf(i), d: d[i].toFixed(1) + ' s' })).reverse(),
      wfs: WF.map((w) => ({ n: w.n, runs: n0(w.runs * k), rate: w.rate.toFixed(1) + '%', fail: (100 - w.rate).toFixed(1) + '%', dur: w.dur })),
      reasons: scaled.map(([w, c]) => ({ l: w, c, p: Math.round(c / maxW * 100) })),
      apps: APPS.map(([m, a, c]) => ({ m, n: a, c: n0(c * k), p: Math.round(c / 6210 * 100) }))
    };
  }
}

return Component;
});
FB.def("AppLogo",[{"t":"span","a":{"aria-hidden":"true","style":"width: {{size}}px; height: {{size}}px; border-radius: {{radius}}px; background: {{bg}}; display: grid; place-items: center; flex: none"},"c":[{"t":"img","a":{"src":"{{uri}}","alt":"","style":"width: {{inner}}px; height: {{inner}}px; object-fit: contain; display: block"},"c":[]}]}],{"app":"slack","s":36},function(DCLogic){

const L = {"gmail":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-17.92 -47.31 291.84 291.84'%3E%3Cdefs%3E%3ClinearGradient id='SVGHzDbHcwG' x1='165' x2='165' y1='44' y2='166' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%2360d673'/%3E%3Cstop offset='.17' stop-color='%2342c868'/%3E%3Cstop offset='.39' stop-color='%230ebc5f'/%3E%3Cstop offset='.62' stop-color='%2300a9bb'/%3E%3Cstop offset='.86' stop-color='%233c90ff'/%3E%3Cstop offset='1' stop-color='%233186ff'/%3E%3C/linearGradient%3E%3ClinearGradient id='SVG41ATXboZ' x1='8' x2='184' y1='46.13' y2='46.13' gradientUnits='userSpaceOnUse'%3E%3Cstop offset='.08' stop-color='%23ff63a0'/%3E%3Cstop offset='.3' stop-color='%23fc413d'/%3E%3Cstop offset='.5' stop-color='%23fc413d'/%3E%3Cstop offset='.65' stop-color='%23fc413d'/%3E%3Cstop offset='.72' stop-color='%23fc5c30'/%3E%3Cstop offset='.86' stop-color='%23feb10c'/%3E%3Cstop offset='.91' stop-color='%23fec700'/%3E%3Cstop offset='.96' stop-color='%23ffdb0f'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath fill='url(%23SVGHzDbHcwG)' d='M146 44h38v110c0 6.627-5.373 12-12 12h-20a6 6 0 0 1-6-6z' transform='translate(-11.636 -37.818)scale(1.45454)'/%3E%3Cpath fill='%23fc413d' d='M55.273 26.182H0v160c0 9.638 7.816 17.454 17.455 17.454h29.09a8.727 8.727 0 0 0 8.728-8.728z'/%3E%3Cpath fill='url(%23SVG41ATXboZ)' d='M39.226 30.456c-8.033-6.752-20.018-5.714-26.77 2.319c-6.752 8.032-5.714 20.017 2.319 26.77l76.078 63.949a8 8 0 0 0 10.295 0l76.078-63.95c8.032-6.752 9.07-18.737 2.318-26.77c-6.752-8.032-18.737-9.07-26.769-2.318L96 78.18z' transform='translate(-11.636 -37.818)scale(1.45454)'/%3E%3C/svg%3E","bg":"#F3F4F9"},"slack":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-17.89 -18.00 291.35 291.35'%3E%3Cpath fill='%23e01e5a' d='M53.841 161.32c0 14.832-11.987 26.82-26.819 26.82S.203 176.152.203 161.32c0-14.831 11.987-26.818 26.82-26.818H53.84zm13.41 0c0-14.831 11.987-26.818 26.819-26.818s26.819 11.987 26.819 26.819v67.047c0 14.832-11.987 26.82-26.82 26.82c-14.83 0-26.818-11.988-26.818-26.82z'/%3E%3Cpath fill='%2336c5f0' d='M94.07 53.638c-14.832 0-26.82-11.987-26.82-26.819S79.239 0 94.07 0s26.819 11.987 26.819 26.819v26.82zm0 13.613c14.832 0 26.819 11.987 26.819 26.819s-11.987 26.819-26.82 26.819H26.82C11.987 120.889 0 108.902 0 94.069c0-14.83 11.987-26.818 26.819-26.818z'/%3E%3Cpath fill='%232eb67d' d='M201.55 94.07c0-14.832 11.987-26.82 26.818-26.82s26.82 11.988 26.82 26.82s-11.988 26.819-26.82 26.819H201.55zm-13.41 0c0 14.832-11.988 26.819-26.82 26.819c-14.831 0-26.818-11.987-26.818-26.82V26.82C134.502 11.987 146.489 0 161.32 0s26.819 11.987 26.819 26.819z'/%3E%3Cpath fill='%23ecb22e' d='M161.32 201.55c14.832 0 26.82 11.987 26.82 26.818s-11.988 26.82-26.82 26.82c-14.831 0-26.818-11.988-26.818-26.82V201.55zm0-13.41c-14.831 0-26.818-11.988-26.818-26.82c0-14.831 11.987-26.818 26.819-26.818h67.25c14.832 0 26.82 11.987 26.82 26.819s-11.988 26.819-26.82 26.819z'/%3E%3C/svg%3E","bg":"#F3F4F9"},"pg":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-22.23 -31.17 300.46 300.46'%3E%3Cpath d='M255.008 158.086c-1.535-4.649-5.556-7.887-10.756-8.664c-2.452-.366-5.26-.21-8.583.475c-5.792 1.195-10.089 1.65-13.225 1.738c11.837-19.985 21.462-42.775 27.003-64.228c8.96-34.689 4.172-50.492-1.423-57.64C233.217 10.847 211.614.683 185.552.372c-13.903-.17-26.108 2.575-32.475 4.549c-5.928-1.046-12.302-1.63-18.99-1.738c-12.537-.2-23.614 2.533-33.079 8.15c-5.24-1.772-13.65-4.27-23.362-5.864c-22.842-3.75-41.252-.828-54.718 8.685C6.622 25.672-.937 45.684.461 73.634c.444 8.874 5.408 35.874 13.224 61.48c4.492 14.718 9.282 26.94 14.237 36.33c7.027 13.315 14.546 21.156 22.987 23.972c4.731 1.576 13.327 2.68 22.368-4.85c1.146 1.388 2.675 2.767 4.704 4.048c2.577 1.625 5.728 2.953 8.875 3.74c11.341 2.835 21.964 2.126 31.027-1.848c.056 1.612.099 3.152.135 4.482c.06 2.157.12 4.272.199 6.25c.537 13.374 1.447 23.773 4.143 31.049c.148.4.347 1.01.557 1.657c1.345 4.118 3.594 11.012 9.316 16.411c5.925 5.593 13.092 7.308 19.656 7.308c3.292 0 6.433-.432 9.188-1.022c9.82-2.105 20.973-5.311 29.041-16.799c7.628-10.86 11.336-27.217 12.007-52.99q.13-1.094.244-2.088l.16-1.362l1.797.158l.463.031c10.002.456 22.232-1.665 29.743-5.154c5.935-2.754 24.954-12.795 20.476-26.351'/%3E%3Cpath fill='%23336791' d='M237.906 160.722c-29.74 6.135-31.785-3.934-31.785-3.934c31.4-46.593 44.527-105.736 33.2-120.211c-30.904-39.485-84.399-20.811-85.292-20.327l-.287.052c-5.876-1.22-12.451-1.946-19.842-2.067c-13.456-.22-23.664 3.528-31.41 9.402c0 0-95.43-39.314-90.991 49.444c.944 18.882 27.064 142.873 58.218 105.422c11.387-13.695 22.39-25.274 22.39-25.274c5.464 3.63 12.006 5.482 18.864 4.817l.533-.452c-.166 1.7-.09 3.363.213 5.332c-8.026 8.967-5.667 10.541-21.711 13.844c-16.235 3.346-6.698 9.302-.471 10.86c7.549 1.887 25.013 4.561 36.813-11.958l-.47 1.885c3.144 2.519 5.352 16.383 4.982 28.952c-.37 12.568-.617 21.197 1.86 27.937c2.479 6.74 4.948 21.905 26.04 17.386c17.623-3.777 26.756-13.564 28.027-29.89c.901-11.606 2.942-9.89 3.07-20.267l1.637-4.912c1.887-15.733.3-20.809 11.157-18.448l2.64.232c7.99.363 18.45-1.286 24.589-4.139c13.218-6.134 21.058-16.377 8.024-13.686z'/%3E%3Cpath fill='%23fff' d='M108.076 81.525c-2.68-.373-5.107-.028-6.335.902c-.69.523-.904 1.129-.962 1.546c-.154 1.105.62 2.327 1.096 2.957c1.346 1.784 3.312 3.01 5.258 3.28q.423.059.842.058c3.245 0 6.196-2.527 6.456-4.392c.325-2.336-3.066-3.893-6.355-4.35m88.784.073c-.256-1.831-3.514-2.353-6.606-1.923c-3.088.43-6.082 1.824-5.832 3.659c.2 1.427 2.777 3.863 5.827 3.863q.387 0 .78-.054c2.036-.282 3.53-1.575 4.24-2.32c1.08-1.136 1.706-2.402 1.591-3.225'/%3E%3Cpath fill='%23fff' d='M247.802 160.025c-1.134-3.429-4.784-4.532-10.848-3.28c-18.005 3.716-24.453 1.142-26.57-.417c13.995-21.32 25.508-47.092 31.719-71.137c2.942-11.39 4.567-21.968 4.7-30.59c.147-9.463-1.465-16.417-4.789-20.665c-13.402-17.125-33.072-26.311-56.882-26.563c-16.369-.184-30.199 4.005-32.88 5.183c-5.646-1.404-11.801-2.266-18.502-2.376c-12.288-.199-22.91 2.743-31.704 8.74c-3.82-1.422-13.692-4.811-25.765-6.756c-20.872-3.36-37.458-.814-49.294 7.571c-14.123 10.006-20.643 27.892-19.38 53.16c.425 8.501 5.269 34.653 12.913 59.698c10.062 32.964 21 51.625 32.508 55.464c1.347.449 2.9.763 4.613.763c4.198 0 9.345-1.892 14.7-8.33a530 530 0 0 1 20.261-22.926c4.524 2.428 9.494 3.784 14.577 3.92q.016.2.035.398a118 118 0 0 0-2.57 3.175c-3.522 4.471-4.255 5.402-15.592 7.736c-3.225.666-11.79 2.431-11.916 8.435c-.136 6.56 10.125 9.315 11.294 9.607c4.074 1.02 7.999 1.523 11.742 1.523c9.103 0 17.114-2.992 23.516-8.781c-.197 23.386.778 46.43 3.586 53.451c2.3 5.748 7.918 19.795 25.664 19.794c2.604 0 5.47-.303 8.623-.979c18.521-3.97 26.564-12.156 29.675-30.203c1.665-9.645 4.522-32.676 5.866-45.03c2.836.885 6.487 1.29 10.434 1.289c8.232 0 17.731-1.749 23.688-4.514c6.692-3.108 18.768-10.734 16.578-17.36m-44.106-83.48c-.061 3.647-.563 6.958-1.095 10.414c-.573 3.717-1.165 7.56-1.314 12.225c-.147 4.54.42 9.26.968 13.825c1.108 9.22 2.245 18.712-2.156 28.078a37 37 0 0 1-1.95-4.009c-.547-1.326-1.735-3.456-3.38-6.404c-6.399-11.476-21.384-38.35-13.713-49.316c2.285-3.264 8.084-6.62 22.64-4.813m-17.644-61.787c21.334.471 38.21 8.452 50.158 23.72c9.164 11.711-.927 64.998-30.14 110.969a171 171 0 0 0-.886-1.117l-.37-.462c7.549-12.467 6.073-24.802 4.759-35.738c-.54-4.488-1.05-8.727-.92-12.709c.134-4.22.692-7.84 1.232-11.34c.663-4.313 1.338-8.776 1.152-14.037c.139-.552.195-1.204.122-1.978c-.475-5.045-6.235-20.144-17.975-33.81c-6.422-7.475-15.787-15.84-28.574-21.482c5.5-1.14 13.021-2.203 21.442-2.016M66.674 175.778c-5.9 7.094-9.974 5.734-11.314 5.288c-8.73-2.912-18.86-21.364-27.791-50.624c-7.728-25.318-12.244-50.777-12.602-57.916c-1.128-22.578 4.345-38.313 16.268-46.769c19.404-13.76 51.306-5.524 64.125-1.347c-.184.182-.376.352-.558.537c-21.036 21.244-20.537 57.54-20.485 59.759c-.002.856.07 2.068.168 3.735c.362 6.105 1.036 17.467-.764 30.334c-1.672 11.957 2.014 23.66 10.111 32.109a36 36 0 0 0 2.617 2.468c-3.604 3.86-11.437 12.396-19.775 22.426m22.479-29.993c-6.526-6.81-9.49-16.282-8.133-25.99c1.9-13.592 1.199-25.43.822-31.79c-.053-.89-.1-1.67-.127-2.285c3.073-2.725 17.314-10.355 27.47-8.028c4.634 1.061 7.458 4.217 8.632 9.645c6.076 28.103.804 39.816-3.432 49.229c-.873 1.939-1.698 3.772-2.402 5.668l-.546 1.466c-1.382 3.706-2.668 7.152-3.465 10.424c-6.938-.02-13.687-2.984-18.819-8.34m1.065 37.9c-2.026-.506-3.848-1.385-4.917-2.114c.893-.42 2.482-.992 5.238-1.56c13.337-2.745 15.397-4.683 19.895-10.394c1.031-1.31 2.2-2.794 3.819-4.602l.002-.002c2.411-2.7 3.514-2.242 5.514-1.412c1.621.67 3.2 2.702 3.84 4.938c.303 1.056.643 3.06-.47 4.62c-9.396 13.156-23.088 12.987-32.921 10.526m69.799 64.952c-16.316 3.496-22.093-4.829-25.9-14.346c-2.457-6.144-3.665-33.85-2.808-64.447c.011-.407-.047-.8-.159-1.17a15.4 15.4 0 0 0-.456-2.162c-1.274-4.452-4.379-8.176-8.104-9.72c-1.48-.613-4.196-1.738-7.46-.903c.696-2.868 1.903-6.107 3.212-9.614l.549-1.475c.618-1.663 1.394-3.386 2.214-5.21c4.433-9.848 10.504-23.337 3.915-53.81c-2.468-11.414-10.71-16.988-23.204-15.693c-7.49.775-14.343 3.797-17.761 5.53c-.735.372-1.407.732-2.035 1.082c.954-11.5 4.558-32.992 18.04-46.59c8.489-8.56 19.794-12.788 33.568-12.56c27.14.444 44.544 14.372 54.366 25.979c8.464 10.001 13.047 20.076 14.876 25.51c-13.755-1.399-23.11 1.316-27.852 8.096c-10.317 14.748 5.644 43.372 13.315 57.129c1.407 2.521 2.621 4.7 3.003 5.626c2.498 6.054 5.732 10.096 8.093 13.046c.724.904 1.426 1.781 1.96 2.547c-4.166 1.201-11.649 3.976-10.967 17.847c-.55 6.96-4.461 39.546-6.448 51.059c-2.623 15.21-8.22 20.875-23.957 24.25m68.104-77.936c-4.26 1.977-11.389 3.46-18.161 3.779c-7.48.35-11.288-.838-12.184-1.569c-.42-8.644 2.797-9.547 6.202-10.503c.535-.15 1.057-.297 1.561-.473q.469.383 1.032.756c6.012 3.968 16.735 4.396 31.874 1.271l.166-.033c-2.042 1.909-5.536 4.471-10.49 6.772'/%3E%3C/svg%3E","bg":"#F3F4F9"},"mongo":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-184.67 -49.64 625.34 625.34'%3E%3Cpath fill='%2301ec64' d='M175.622 61.108C152.612 33.807 132.797 6.078 128.749.32a1.03 1.03 0 0 0-1.492 0c-4.048 5.759-23.863 33.487-46.874 60.788c-197.507 251.896 31.108 421.89 31.108 421.89l1.917 1.28c1.704 26.234 5.966 63.988 5.966 63.988h17.045s4.26-37.54 5.965-63.987l1.918-1.494c.213.214 228.828-169.78 31.32-421.677m-47.726 418.05s-10.227-8.744-12.997-13.222v-.428l12.358-274.292c0-.853 1.279-.853 1.279 0l12.357 274.292v.428c-2.77 4.478-12.997 13.223-12.997 13.223'/%3E%3C/svg%3E","bg":"#F3F4F9"},"discord":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-17.92 -46.83 291.84 291.84'%3E%3Cpath fill='%235865f2' d='M216.856 16.597A208.5 208.5 0 0 0 164.042 0c-2.275 4.113-4.933 9.645-6.766 14.046q-29.538-4.442-58.533 0c-1.832-4.4-4.55-9.933-6.846-14.046a207.8 207.8 0 0 0-52.855 16.638C5.618 67.147-3.443 116.4 1.087 164.956c22.169 16.555 43.653 26.612 64.775 33.193A161 161 0 0 0 79.735 175.3a136.4 136.4 0 0 1-21.846-10.632a109 109 0 0 0 5.356-4.237c42.122 19.702 87.89 19.702 129.51 0a132 132 0 0 0 5.355 4.237a136 136 0 0 1-21.886 10.653c4.006 8.02 8.638 15.67 13.873 22.848c21.142-6.58 42.646-16.637 64.815-33.213c5.316-56.288-9.08-105.09-38.056-148.36M85.474 135.095c-12.645 0-23.015-11.805-23.015-26.18s10.149-26.2 23.015-26.2s23.236 11.804 23.015 26.2c.02 14.375-10.148 26.18-23.015 26.18m85.051 0c-12.645 0-23.014-11.805-23.014-26.18s10.148-26.2 23.014-26.2c12.867 0 23.236 11.804 23.015 26.2c0 14.375-10.148 26.18-23.015 26.18'/%3E%3C/svg%3E","bg":"#F3F4F9"},"mysql":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-27.33 -26.53 291.84 291.84'%3E%3Cpath fill='%2300546b' d='M235.648 194.212c-13.918-.347-24.705 1.045-33.752 4.872c-2.61 1.043-6.786 1.044-7.134 4.35c1.392 1.392 1.566 3.654 2.784 5.567c2.09 3.479 5.741 8.177 9.047 10.614c3.653 2.783 7.308 5.566 11.134 8.002c6.786 4.176 14.442 6.611 21.053 10.787c3.829 2.434 7.654 5.568 11.482 8.177c1.914 1.39 3.131 3.654 5.568 4.523v-.521c-1.219-1.567-1.567-3.828-2.784-5.568c-1.738-1.74-3.48-3.306-5.22-5.046c-5.045-6.784-11.308-12.7-18.093-17.571c-5.567-3.828-17.747-9.047-20.008-15.485c0 0-.175-.173-.348-.347c3.827-.348 8.35-1.74 12.005-2.784c5.915-1.567 11.308-1.218 17.398-2.784c2.783-.696 5.567-1.566 8.35-2.436v-1.565c-3.13-3.132-5.392-7.307-8.698-10.265c-8.873-7.657-18.617-15.137-28.707-21.4c-5.394-3.48-12.354-5.742-18.095-8.699c-2.086-1.045-5.567-1.566-6.784-3.306c-3.133-3.827-4.873-8.872-7.134-13.396c-5.044-9.57-9.917-20.182-14.267-30.272c-3.13-6.786-5.044-13.572-8.872-19.834c-17.92-29.577-37.406-47.497-67.33-65.07c-6.438-3.653-14.093-5.219-22.27-7.132c-4.348-.175-8.699-.522-13.048-.697c-2.784-1.218-5.568-4.523-8.004-6.089C34.006 4.573 8.429-8.996 1.122 8.924c-4.698 11.308 6.96 22.442 10.96 28.185c2.96 4.001 6.786 8.524 8.874 13.048c1.218 2.956 1.565 6.09 2.783 9.221c2.785 7.653 5.393 16.18 9.048 23.314c1.914 3.653 4.001 7.48 6.437 10.786c1.392 1.913 3.827 2.784 4.35 5.915c-2.435 3.48-2.61 8.7-4.003 13.049c-6.263 19.66-3.826 44.017 5.046 58.457c2.783 4.348 9.395 13.92 18.268 10.265c7.83-3.131 6.09-13.048 8.35-21.747c.524-2.09.176-3.48 1.219-4.872v.349c2.436 4.87 4.871 9.569 7.133 14.44c5.394 8.524 14.788 17.398 22.617 23.314c4.177 3.13 7.482 8.524 12.702 10.438v-.523h-.349c-1.044-1.566-2.61-2.261-4.001-3.48c-3.131-3.13-6.612-6.958-9.047-10.438c-7.306-9.744-13.745-20.53-19.486-31.665c-2.783-5.392-5.22-11.308-7.481-16.701c-1.045-2.09-1.045-5.22-2.784-6.263c-2.61 3.827-6.437 7.133-8.351 11.83c-3.304 7.481-3.653 16.702-4.871 26.27c-.696.176-.349 0-.697.35c-5.566-1.394-7.48-7.134-9.569-12.006c-5.22-12.352-6.09-32.186-1.565-46.452c1.218-3.654 6.438-15.136 4.35-18.616c-1.044-3.306-4.525-5.22-6.438-7.829c-2.261-3.306-4.698-7.48-6.263-11.135c-4.176-9.743-6.264-20.53-10.787-30.273c-2.088-4.524-5.74-9.22-8.699-13.396c-3.305-4.697-6.959-8.004-9.569-13.571c-.869-1.913-2.088-5.045-.696-7.133c.348-1.392 1.043-1.913 2.436-2.261c2.262-1.915 8.7.521 10.96 1.565c6.438 2.608 11.831 5.046 17.225 8.699c2.435 1.74 5.045 5.046 8.176 5.916h3.654c5.568 1.217 11.83.348 17.05 1.913c9.222 2.957 17.572 7.307 25.054 12.005c22.792 14.44 41.58 34.97 54.282 59.501c2.088 4 2.957 7.656 4.871 11.83c3.655 8.526 8.178 17.225 11.83 25.576c3.654 8.176 7.133 16.528 12.353 23.314c2.61 3.652 13.048 5.567 17.746 7.481c3.48 1.565 8.874 2.958 12.005 4.871c5.915 3.652 11.83 7.83 17.398 11.83c2.784 2.088 11.482 6.438 12.005 9.917'/%3E%3Cpath fill='%2300546b' d='M58.186 43.022c-2.957 0-5.044.35-7.132.871v.348h.348c1.393 2.784 3.827 4.698 5.566 7.133c1.393 2.783 2.61 5.568 4.003 8.352c.173-.175.347-.348.347-.348c2.437-1.741 3.654-4.524 3.654-8.7c-1.044-1.217-1.218-2.435-2.088-3.653c-1.043-1.741-3.306-2.61-4.698-4.003'/%3E%3C/svg%3E","bg":"#F3F4F9"},"gdrive":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-17.92 -15.29 291.84 291.84'%3E%3Cdefs%3E%3ClinearGradient id='SVGjzk6ueva' x1='86.924%25' x2='7.63%25' y1='94.294%25' y2='45.952%25'%3E%3Cstop offset='9%25' stop-color='%23ffe921'/%3E%3Cstop offset='100%25' stop-color='%23fec700'/%3E%3C/linearGradient%3E%3ClinearGradient id='SVGb0f7AcFJ' x1='99.538%25' x2='23.437%25' y1='93.901%25' y2='54.033%25'%3E%3Cstop offset='15%25' stop-color='%23a9a8ff'/%3E%3Cstop offset='33%25' stop-color='%236d97ff'/%3E%3Cstop offset='48%25' stop-color='%233186ff'/%3E%3C/linearGradient%3E%3ClinearGradient id='SVGxMwz6dYk' x1='87.128%25' x2='-.639%25' y1='51.518%25' y2='93.078%25'%3E%3Cstop offset='55%25' stop-color='%230ebc5f'/%3E%3Cstop offset='85%25' stop-color='%2378c9ff'/%3E%3C/linearGradient%3E%3Cpath id='SVGAiIt3btS' d='M77.303 29.27c22.531-39.026 78.863-39.027 101.394 0l69.373 120.158c22.531 39.027-5.633 87.81-50.698 87.81H58.628c-45.065 0-73.23-48.783-50.698-87.81z'/%3E%3C/defs%3E%3Cmask id='SVG6FLXsceq' fill='%23fff'%3E%3Cuse href='%23SVGAiIt3btS'/%3E%3C/mask%3E%3Cg mask='url(%23SVG6FLXsceq)'%3E%3Cpath fill='url(%23SVGjzk6ueva)' d='M341.719 295.937H200.166l-29.293-50.735l70.777-122.589z' transform='translate(-42.87 -58.67)'/%3E%3Cpath fill='url(%23SVGb0f7AcFJ)' d='m0 295.916l100.069-173.325v.003l-29.282 50.723h58.57l70.783 122.596l-200.138.001z' transform='translate(-42.87 -58.67)'/%3E%3Cpath fill='url(%23SVGxMwz6dYk)' d='m170.881 0l70.781 122.6l-29.286 50.726H70.812z' transform='translate(-42.87 -58.67)'/%3E%3C/g%3E%3C/svg%3E","bg":"#F3F4F9"},"gcal":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-28.49 -19.22 312.98 312.98'%3E%3Cdefs%3E%3ClinearGradient id='SVGAUTqNcwQ' x1='83' x2='83' y1='76' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%234fa0ff'/%3E%3Cstop offset='1' stop-color='%233186ff'/%3E%3C/linearGradient%3E%3ClinearGradient id='SVGMJemac7b' x1='89.06' x2='89.06' y1='21.75' y2='96.39' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%23a9a8ff'/%3E%3Cstop offset='.8' stop-color='%233c90ff'/%3E%3C/linearGradient%3E%3Cfilter id='SVGGQyK4bRj' width='152' height='112' x='20' y='-4' color-interpolation-filters='sRGB' filterUnits='userSpaceOnUse'%3E%3CfeFlood flood-opacity='0' result='BackgroundImageFix'/%3E%3CfeBlend in='SourceGraphic' in2='BackgroundImageFix' result='shape'/%3E%3CfeGaussianBlur result='effect1_foregroundBlur_37330_7673' stdDeviation='6'/%3E%3C/filter%3E%3C/defs%3E%3Cmask id='SVGcTVVObIw' width='154' height='152' x='19' y='20' maskUnits='userSpaceOnUse' style='mask-type:alpha'%3E%3Cpath fill='%233c90ff' d='M19.867 49.392C17.818 33.82 29.94 20 45.645 20h100.71c15.706 0 27.827 13.82 25.778 29.392L166 96l6.133 46.608C174.182 158.18 162.061 172 146.355 172H45.645c-15.706 0-27.827-13.82-25.778-29.392L26 96z'/%3E%3C/mask%3E%3Cmask id='SVGBwV4Xb4k' width='154' height='152' x='19' y='20' maskUnits='userSpaceOnUse' style='mask-type:alpha'%3E%3Cpath fill='%233186ff' d='M19.867 49.392C17.818 33.82 29.94 20 45.645 20h100.71c15.706 0 27.827 13.82 25.778 29.392L166 96l6.133 46.608C174.182 158.18 162.061 172 146.355 172H45.645c-15.706 0-27.827-13.82-25.778-29.392L26 96z'/%3E%3C/mask%3E%3Cpath fill='%23bbe2ff' d='M20.824 48.078c0-26.641 21.596-48.239 48.238-48.239h117.917c26.641 0 48.238 21.598 48.238 48.239v50.918c0 26.641-21.597 48.239-48.238 48.239H69.062c-26.642 0-48.238-21.598-48.238-48.239z'/%3E%3Cpath fill='%233c90ff' d='M.502 69.169c-3.432-26.082 16.871-49.23 43.177-49.23h168.683c26.306 0 46.609 23.148 43.178 49.23l-10.273 78.066l10.273 78.066c3.431 26.082-16.872 49.23-43.178 49.23H43.679c-26.307 0-46.609-23.148-43.177-49.23l10.272-78.066z'/%3E%3Cg mask='url(%23SVGcTVVObIw)' transform='translate(-32.775 -13.56)scale(1.67495)'%3E%3Cpath fill='url(%23SVGAUTqNcwQ)' d='M0 0h166v76H0z' transform='matrix(1 0 0 -1 13 172)'/%3E%3C/g%3E%3Cg mask='url(%23SVGBwV4Xb4k)' transform='translate(-32.775 -13.56)scale(1.67495)'%3E%3Cpath fill='url(%23SVGMJemac7b)' d='M32 27.2C32 16.596 40.596 8 51.2 8h89.6c10.604 0 19.2 8.596 19.2 19.2V96H32z' filter='url(%23SVGGQyK4bRj)'/%3E%3C/g%3E%3Cpath fill='%23fff' d='M93.438 209.77q-10.521 0-18.051-3.421q-7.528-3.422-12.746-9.153q-5.133-5.82-7.273-11.379q-2.137-5.558-1.711-6.758a3.47 3.47 0 0 1 1.711-1.882l9.497-3.765q1.196-.598 2.395-.17q1.196.34 2.822 3.935q1.714 3.592 4.79 7.613a24 24 0 0 0 7.529 6.245q4.368 2.226 10.779 2.225q10.351 0 16.426-5.99q6.16-5.986 6.16-15.226q0-10.01-6.503-15.4q-6.5-5.476-17.195-5.476h-8.981a3.17 3.17 0 0 1-2.225-.853q-.853-.94-.855-2.139v-9.153q0-1.284.854-2.14a3.06 3.06 0 0 1 2.226-.94h7.783q9.583 0 15.4-5.22q5.817-5.218 5.816-13.517q.002-8.21-5.218-13.258t-14.371-5.049q-5.135.001-8.898 1.712a19.3 19.3 0 0 0-6.502 4.791a38.3 38.3 0 0 0-4.705 6.33q-1.964 3.252-3.165 3.593q-1.195.256-2.31-.426l-8.983-4.364q-1.11-.599-1.454-1.882q-.342-1.284 2.055-5.989q2.48-4.788 7.526-9.752a35.2 35.2 0 0 1 11.807-7.7q6.758-2.74 15.741-2.738q16.681.001 26.434 8.81q9.752 8.73 9.753 23.099q0 9.926-4.79 17.196q-4.706 7.27-13.347 10.268v.341q10.438 3.08 16.425 11.291c4.05 5.421 6.075 11.891 6.074 19.419q0 16.17-11.293 26.522q-11.29 10.35-29.429 10.35zm85.841-1.967q-1.452 0-2.567-1.112a3.78 3.78 0 0 1-1.026-2.652v-95.131l-19.249 13.859q-1.026.77-2.396.514a3.3 3.3 0 0 1-2.052-1.283l-5.561-7.871a3.32 3.32 0 0 1-.6-2.397q.258-1.365 1.369-2.136l34.133-24.382q.43-.343.942-.514q.515-.256 1.197-.256h7.188q1.455.001 2.31 1.027q.941.94.941 2.396v116.174q0 1.542-1.112 2.652a3.35 3.35 0 0 1-2.568 1.112z'/%3E%3C/svg%3E","bg":"#F3F4F9"},"notion":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-24.51 -18.73 305.01 305.01'%3E%3Cpath fill='%23fff' d='M16.092 11.538L164.09.608c18.179-1.56 22.85-.508 34.28 7.801l47.243 33.282C253.406 47.414 256 48.975 256 55.207v182.527c0 11.439-4.155 18.205-18.696 19.24L65.44 267.378c-10.913.517-16.11-1.043-21.825-8.327L8.826 213.814C2.586 205.487 0 199.254 0 191.97V29.726c0-9.352 4.155-17.153 16.092-18.188'/%3E%3Cpath d='M164.09.608L16.092 11.538C4.155 12.573 0 20.374 0 29.726v162.245c0 7.284 2.585 13.516 8.826 21.843l34.789 45.237c5.715 7.284 10.912 8.844 21.825 8.327l171.864-10.404c14.532-1.035 18.696-7.801 18.696-19.24V55.207c0-5.911-2.336-7.614-9.21-12.66l-1.185-.856L198.37 8.409C186.94.1 182.27-.952 164.09.608M69.327 52.22c-14.033.945-17.216 1.159-25.186-5.323L23.876 30.778c-2.06-2.086-1.026-4.69 4.163-5.207l142.274-10.395c11.947-1.043 18.17 3.12 22.842 6.758l24.401 17.68c1.043.525 3.638 3.637.517 3.637L71.146 52.095zm-16.36 183.954V81.222c0-6.767 2.077-9.887 8.3-10.413L230.02 60.93c5.724-.517 8.31 3.12 8.31 9.879v153.917c0 6.767-1.044 12.49-10.387 13.008l-161.487 9.361c-9.343.517-13.489-2.594-13.489-10.921M212.377 89.53c1.034 4.681 0 9.362-4.681 9.897l-7.783 1.542v114.404c-6.758 3.637-12.981 5.715-18.18 5.715c-8.308 0-10.386-2.604-16.609-10.396l-50.898-80.079v77.476l16.1 3.646s0 9.362-12.989 9.362l-35.814 2.077c-1.043-2.086 0-7.284 3.63-8.318l9.351-2.595V109.823l-12.98-1.052c-1.044-4.68 1.55-11.439 8.826-11.965l38.426-2.585l52.958 81.113v-71.76l-13.498-1.552c-1.043-5.733 3.111-9.896 8.3-10.404z'/%3E%3C/svg%3E","bg":"#F3F4F9"},"airtable":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-12.31 -43.68 291.84 291.84'%3E%3Cpath fill='%23ffbf00' d='M114.259 2.701L18.86 42.176c-5.305 2.195-5.25 9.73.089 11.847l95.797 37.989a35.54 35.54 0 0 0 26.208 0l95.799-37.99c5.337-2.115 5.393-9.65.086-11.846L141.442 2.7a35.55 35.55 0 0 0-27.183 0'/%3E%3Cpath fill='%2326b5f8' d='M136.35 112.757v94.902c0 4.514 4.55 7.605 8.746 5.942l106.748-41.435a6.39 6.39 0 0 0 4.035-5.941V71.322c0-4.514-4.551-7.604-8.747-5.941l-106.748 41.434a6.39 6.39 0 0 0-4.035 5.942'/%3E%3Cpath fill='%23ed3049' d='m111.423 117.654l-31.68 15.296l-3.217 1.555L9.65 166.548C5.411 168.593 0 165.504 0 160.795V71.72c0-1.704.874-3.175 2.046-4.283a7.3 7.3 0 0 1 1.618-1.213c1.598-.959 3.878-1.215 5.816-.448l101.41 40.18c5.155 2.045 5.56 9.268.533 11.697'/%3E%3Cpath fill-opacity='.25' d='m111.423 117.654l-31.68 15.296L2.045 67.438a7.3 7.3 0 0 1 1.618-1.213c1.598-.959 3.878-1.215 5.816-.448l101.41 40.18c5.155 2.045 5.56 9.268.533 11.697'/%3E%3C/svg%3E","bg":"#F3F4F9"},"shopify":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-37.85 -7.94 331.22 331.22'%3E%3Cpath fill='%2395bf46' d='M223.774 57.34c-.201-1.46-1.48-2.268-2.537-2.357a19614 19614 0 0 0-23.383-1.743s-15.507-15.395-17.209-17.099c-1.703-1.703-5.029-1.185-6.32-.805c-.19.056-3.388 1.043-8.678 2.68c-5.18-14.906-14.322-28.604-30.405-28.604c-.444 0-.901.018-1.358.044C129.31 3.407 123.644.779 118.75.779c-37.465 0-55.364 46.835-60.976 70.635c-14.558 4.511-24.9 7.718-26.221 8.133c-8.126 2.549-8.383 2.805-9.45 10.462C21.3 95.806.038 260.235.038 260.235l165.678 31.042l89.77-19.42S223.973 58.8 223.775 57.34M156.49 40.848l-14.019 4.339c.005-.988.01-1.96.01-3.023c0-9.264-1.286-16.723-3.349-22.636c8.287 1.04 13.806 10.469 17.358 21.32m-27.638-19.483c2.304 5.773 3.802 14.058 3.802 25.238c0 .572-.005 1.095-.01 1.624c-9.117 2.824-19.024 5.89-28.953 8.966c5.575-21.516 16.025-31.908 25.161-35.828m-11.131-10.537c1.617 0 3.246.549 4.805 1.622c-12.007 5.65-24.877 19.88-30.312 48.297l-22.886 7.088C75.694 46.16 90.81 10.828 117.72 10.828'/%3E%3Cpath fill='%235e8e3e' d='M221.237 54.983a19614 19614 0 0 0-23.383-1.743s-15.507-15.395-17.209-17.099c-.637-.634-1.496-.959-2.394-1.099l-12.527 256.233l89.762-19.418S223.972 58.8 223.774 57.34c-.201-1.46-1.48-2.268-2.537-2.357'/%3E%3Cpath fill='%23fff' d='m135.242 104.585l-11.069 32.926s-9.698-5.176-21.586-5.176c-17.428 0-18.305 10.937-18.305 13.693c0 15.038 39.2 20.8 39.2 56.024c0 27.713-17.577 45.558-41.277 45.558c-28.44 0-42.984-17.7-42.984-17.7l7.615-25.16s14.95 12.835 27.565 12.835c8.243 0 11.596-6.49 11.596-11.232c0-19.616-32.16-20.491-32.16-52.724c0-27.129 19.472-53.382 58.778-53.382c15.145 0 22.627 4.338 22.627 4.338'/%3E%3C/svg%3E","bg":"#F3F4F9"},"github":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-17.92 -26.34 291.84 291.84'%3E%3Cpath fill='%23161614' d='M128.001 0C57.317 0 0 57.307 0 128.001c0 56.554 36.676 104.535 87.535 121.46c6.397 1.185 8.746-2.777 8.746-6.158c0-3.052-.12-13.135-.174-23.83c-35.61 7.742-43.124-15.103-43.124-15.103c-5.823-14.795-14.213-18.73-14.213-18.73c-11.613-7.944.876-7.78.876-7.78c12.853.902 19.621 13.19 19.621 13.19c11.417 19.568 29.945 13.911 37.249 10.64c1.149-8.272 4.466-13.92 8.127-17.116c-28.431-3.236-58.318-14.212-58.318-63.258c0-13.975 5-25.394 13.188-34.358c-1.329-3.224-5.71-16.242 1.24-33.874c0 0 10.749-3.44 35.21 13.121c10.21-2.836 21.16-4.258 32.038-4.307c10.878.049 21.837 1.47 32.066 4.307c24.431-16.56 35.165-13.12 35.165-13.12c6.967 17.63 2.584 30.65 1.255 33.873c8.207 8.964 13.173 20.383 13.173 34.358c0 49.163-29.944 59.988-58.447 63.157c4.591 3.972 8.682 11.762 8.682 23.704c0 17.126-.148 30.91-.148 35.126c0 3.407 2.304 7.398 8.792 6.14C219.37 232.5 256 184.537 256 128.002C256 57.307 198.691 0 128.001 0m-80.06 182.34c-.282.636-1.283.827-2.194.39c-.929-.417-1.45-1.284-1.15-1.922c.276-.655 1.279-.838 2.205-.399c.93.418 1.46 1.293 1.139 1.931m6.296 5.618c-.61.566-1.804.303-2.614-.591c-.837-.892-.994-2.086-.375-2.66c.63-.566 1.787-.301 2.626.591c.838.903 1 2.088.363 2.66m4.32 7.188c-.785.545-2.067.034-2.86-1.104c-.784-1.138-.784-2.503.017-3.05c.795-.547 2.058-.055 2.861 1.075c.782 1.157.782 2.522-.019 3.08m7.304 8.325c-.701.774-2.196.566-3.29-.49c-1.119-1.032-1.43-2.496-.726-3.27c.71-.776 2.213-.558 3.315.49c1.11 1.03 1.45 2.505.701 3.27m9.442 2.81c-.31 1.003-1.75 1.459-3.199 1.033c-1.448-.439-2.395-1.613-2.103-2.626c.301-1.01 1.747-1.484 3.207-1.028c1.446.436 2.396 1.602 2.095 2.622m10.744 1.193c.036 1.055-1.193 1.93-2.715 1.95c-1.53.034-2.769-.82-2.786-1.86c0-1.065 1.202-1.932 2.733-1.958c1.522-.03 2.768.818 2.768 1.868m10.555-.405c.182 1.03-.875 2.088-2.387 2.37c-1.485.271-2.861-.365-3.05-1.386c-.184-1.056.893-2.114 2.376-2.387c1.514-.263 2.868.356 3.061 1.403'/%3E%3C/svg%3E","bg":"#F3F4F9"},"jira":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-7.07 -28.69 291.11 291.11'%3E%3Cdefs%3E%3ClinearGradient id='SVGSBI7obaC' x1='98.031%25' x2='58.888%25' y1='.161%25' y2='40.766%25'%3E%3Cstop offset='18%25' stop-color='%230052cc'/%3E%3Cstop offset='100%25' stop-color='%232684ff'/%3E%3C/linearGradient%3E%3ClinearGradient id='SVGHifZlbzE' x1='100.665%25' x2='55.402%25' y1='.455%25' y2='44.727%25'%3E%3Cstop offset='18%25' stop-color='%230052cc'/%3E%3Cstop offset='100%25' stop-color='%232684ff'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath fill='%232684ff' d='M244.658 0H121.707a55.5 55.5 0 0 0 55.502 55.502h22.649V77.37c.02 30.625 24.841 55.447 55.466 55.467V10.666C255.324 4.777 250.55 0 244.658 0'/%3E%3Cpath fill='url(%23SVGSBI7obaC)' d='M183.822 61.262H60.872c.019 30.625 24.84 55.447 55.466 55.467h22.649v21.938c.039 30.625 24.877 55.43 55.502 55.43V71.93c0-5.891-4.776-10.667-10.667-10.667'/%3E%3Cpath fill='url(%23SVGHifZlbzE)' d='M122.951 122.489H0c0 30.653 24.85 55.502 55.502 55.502h22.72v21.867c.02 30.597 24.798 55.408 55.396 55.466V133.156c0-5.891-4.776-10.667-10.667-10.667'/%3E%3C/svg%3E","bg":"#F3F4F9"},"trello":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-17.92 -17.92 291.84 291.84'%3E%3Cdefs%3E%3ClinearGradient id='SVG2lcyn7oz' x1='50%25' x2='50%25' y1='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%230091e6'/%3E%3Cstop offset='100%25' stop-color='%230079bf'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='256' height='256' fill='url(%23SVG2lcyn7oz)' rx='25'/%3E%3Crect width='78.08' height='112' x='144.64' y='33.28' fill='%23fff' rx='12'/%3E%3Crect width='78.08' height='176' x='33.28' y='33.28' fill='%23fff' rx='12'/%3E%3C/svg%3E","bg":"#F3F4F9"},"twilio":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-17.92 -17.92 291.84 291.84'%3E%3Cpath fill='%23f12e45' d='M128 0c70.656 0 128 57.344 128 128s-57.344 128-128 128S0 198.656 0 128S57.344 0 128 0m0 33.792c-52.224 0-94.208 41.984-94.208 94.208S75.776 222.208 128 222.208s94.208-41.984 94.208-94.208S180.224 33.792 128 33.792m31.744 99.328c14.704 0 26.624 11.92 26.624 26.624s-11.92 26.624-26.624 26.624s-26.624-11.92-26.624-26.624s11.92-26.624 26.624-26.624m-63.488 0c14.704 0 26.624 11.92 26.624 26.624s-11.92 26.624-26.624 26.624s-26.624-11.92-26.624-26.624s11.92-26.624 26.624-26.624m63.488-63.488c14.704 0 26.624 11.92 26.624 26.624s-11.92 26.624-26.624 26.624s-26.624-11.92-26.624-26.624s11.92-26.624 26.624-26.624m-63.488 0c14.704 0 26.624 11.92 26.624 26.624s-11.92 26.624-26.624 26.624s-26.624-11.92-26.624-26.624s11.92-26.624 26.624-26.624'/%3E%3C/svg%3E","bg":"#F3F4F9"},"zendesk":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-17.92 -48.91 291.84 291.84'%3E%3Cpath fill='%2303363d' d='M118.25 51.233v142.773H0zm0-51.233c0 32.644-26.481 59.125-59.125 59.125S0 32.645 0 0zm19.5 194.006c0-32.677 26.449-59.125 59.125-59.125S256 161.361 256 194.006zm0-51.266V0H256z'/%3E%3C/svg%3E","bg":"#F3F4F9"},"telegram":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-17.92 -17.92 291.84 291.84'%3E%3Cdefs%3E%3ClinearGradient id='SVG6DaOZcwt' x1='50%25' x2='50%25' y1='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%232aabee'/%3E%3Cstop offset='100%25' stop-color='%23229ed9'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath fill='url(%23SVG6DaOZcwt)' d='M128 0C94.06 0 61.48 13.494 37.5 37.49A128.04 128.04 0 0 0 0 128c0 33.934 13.5 66.514 37.5 90.51C61.48 242.506 94.06 256 128 256s66.52-13.494 90.5-37.49c24-23.996 37.5-56.576 37.5-90.51s-13.5-66.514-37.5-90.51C194.52 13.494 161.94 0 128 0'/%3E%3Cpath fill='%23fff' d='M57.94 126.648q55.98-24.384 74.64-32.152c35.56-14.786 42.94-17.354 47.76-17.441c1.06-.017 3.42.245 4.96 1.49c1.28 1.05 1.64 2.47 1.82 3.467c.16.996.38 3.266.2 5.038c-1.92 20.24-10.26 69.356-14.5 92.026c-1.78 9.592-5.32 12.808-8.74 13.122c-7.44.684-13.08-4.912-20.28-9.63c-11.26-7.386-17.62-11.982-28.56-19.188c-12.64-8.328-4.44-12.906 2.76-20.386c1.88-1.958 34.64-31.748 35.26-34.45c.08-.338.16-1.598-.6-2.262c-.74-.666-1.84-.438-2.64-.258c-1.14.256-19.12 12.152-54 35.686c-5.1 3.508-9.72 5.218-13.88 5.128c-4.56-.098-13.36-2.584-19.9-4.708c-8-2.606-14.38-3.984-13.82-8.41c.28-2.304 3.46-4.662 9.52-7.072'/%3E%3C/svg%3E","bg":"#F3F4F9"},"whatsapp":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-18.57 -18.00 293.14 293.14'%3E%3Cdefs%3E%3ClinearGradient id='SVGK3KZq49U' x1='50%25' x2='50%25' y1='100%25' y2='0%25'%3E%3Cstop offset='0%25' stop-color='%231faf38'/%3E%3Cstop offset='100%25' stop-color='%2360d669'/%3E%3C/linearGradient%3E%3ClinearGradient id='SVGefMkoEOd' x1='50%25' x2='50%25' y1='100%25' y2='0%25'%3E%3Cstop offset='0%25' stop-color='%23f9f9f9'/%3E%3Cstop offset='100%25' stop-color='%23fff'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath fill='url(%23SVGK3KZq49U)' d='M5.463 127.456c-.006 21.677 5.658 42.843 16.428 61.499L4.433 252.697l65.232-17.104a123 123 0 0 0 58.8 14.97h.054c67.815 0 123.018-55.183 123.047-123.01c.013-32.867-12.775-63.773-36.009-87.025c-23.23-23.25-54.125-36.061-87.043-36.076c-67.823 0-123.022 55.18-123.05 123.004'/%3E%3Cpath fill='url(%23SVGefMkoEOd)' d='M1.07 127.416c-.007 22.457 5.86 44.38 17.014 63.704L0 257.147l67.571-17.717c18.618 10.151 39.58 15.503 60.91 15.511h.055c70.248 0 127.434-57.168 127.464-127.423c.012-34.048-13.236-66.065-37.3-90.15C194.633 13.286 162.633.014 128.536 0C58.276 0 1.099 57.16 1.071 127.416m40.24 60.376l-2.523-4.005c-10.606-16.864-16.204-36.352-16.196-56.363C22.614 69.029 70.138 21.52 128.576 21.52c28.3.012 54.896 11.044 74.9 31.06c20.003 20.018 31.01 46.628 31.003 74.93c-.026 58.395-47.551 105.91-105.943 105.91h-.042c-19.013-.01-37.66-5.116-53.922-14.765l-3.87-2.295l-40.098 10.513z'/%3E%3Cpath fill='%23fff' d='M96.678 74.148c-2.386-5.303-4.897-5.41-7.166-5.503c-1.858-.08-3.982-.074-6.104-.074c-2.124 0-5.575.799-8.492 3.984c-2.92 3.188-11.148 10.892-11.148 26.561s11.413 30.813 13.004 32.94c1.593 2.123 22.033 35.307 54.405 48.073c26.904 10.609 32.379 8.499 38.218 7.967c5.84-.53 18.844-7.702 21.497-15.139c2.655-7.436 2.655-13.81 1.859-15.142c-.796-1.327-2.92-2.124-6.105-3.716s-18.844-9.298-21.763-10.361c-2.92-1.062-5.043-1.592-7.167 1.597c-2.124 3.184-8.223 10.356-10.082 12.48c-1.857 2.129-3.716 2.394-6.9.801c-3.187-1.598-13.444-4.957-25.613-15.806c-9.468-8.442-15.86-18.867-17.718-22.056c-1.858-3.184-.199-4.91 1.398-6.497c1.431-1.427 3.186-3.719 4.78-5.578c1.588-1.86 2.118-3.187 3.18-5.311c1.063-2.126.531-3.986-.264-5.579c-.798-1.593-6.987-17.343-9.819-23.64'/%3E%3C/svg%3E","bg":"#F3F4F9"},"dropbox":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-17.92 -42.04 291.84 291.84'%3E%3Cpath fill='%230061ff' d='M63.995 0L0 40.771l63.995 40.772L128 40.771zM192 0l-64 40.775l64 40.775l64.001-40.775zM0 122.321l63.995 40.772L128 122.321L63.995 81.55zM192 81.55l-64 40.775l64 40.774l64-40.774zM64 176.771l64.005 40.772L192 176.771L128.005 136z'/%3E%3C/svg%3E","bg":"#F3F4F9"},"asana":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-17.92 -15.09 291.84 291.84'%3E%3Cpath fill='%23f06a6a' d='M200.325 125.27c-30.749 0-55.675 24.927-55.675 55.677s24.926 55.677 55.675 55.677S256 211.696 256 180.947c0-30.75-24.926-55.677-55.675-55.677m-144.65.005C24.927 125.275 0 150.197 0 180.947s24.927 55.677 55.675 55.677c30.75 0 55.678-24.928 55.678-55.677c0-30.75-24.928-55.672-55.678-55.672m128-69.6c0 30.75-24.927 55.68-55.674 55.68c-30.75 0-55.676-24.93-55.676-55.68C72.325 24.928 97.25 0 128 0c30.747 0 55.673 24.93 55.673 55.674'/%3E%3C/svg%3E","bg":"#F3F4F9"},"webhook":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-17.86 -14.43 290.93 290.93'%3E%3Cpath fill='%23c73a63' d='M119.54 100.503c-10.61 17.836-20.775 35.108-31.152 52.25c-2.665 4.401-3.984 7.986-1.855 13.58c5.878 15.454-2.414 30.493-17.998 34.575c-14.697 3.851-29.016-5.808-31.932-21.543c-2.584-13.927 8.224-27.58 23.58-29.757c1.286-.184 2.6-.205 4.762-.367l23.358-39.168C73.612 95.465 64.868 78.39 66.803 57.23c1.368-14.957 7.25-27.883 18-38.477c20.59-20.288 52.002-23.573 76.246-8.001c23.284 14.958 33.948 44.094 24.858 69.031c-6.854-1.858-13.756-3.732-21.343-5.79c2.854-13.865.743-26.315-8.608-36.981c-6.178-7.042-14.106-10.733-23.12-12.093c-18.072-2.73-35.815 8.88-41.08 26.618c-5.976 20.13 3.069 36.575 27.784 48.967'/%3E%3Cpath fill='%234b4b4b' d='M149.841 79.41c7.475 13.187 15.065 26.573 22.587 39.836c38.02-11.763 66.686 9.284 76.97 31.817c12.422 27.219 3.93 59.457-20.465 76.25c-25.04 17.238-56.707 14.293-78.892-7.851c5.654-4.733 11.336-9.487 17.407-14.566c21.912 14.192 41.077 13.524 55.305-3.282c12.133-14.337 11.87-35.714-.615-49.75c-14.408-16.197-33.707-16.691-57.035-1.143c-9.677-17.168-19.522-34.199-28.893-51.491c-3.16-5.828-6.648-9.21-13.77-10.443c-11.893-2.062-19.571-12.275-20.032-23.717c-.453-11.316 6.214-21.545 16.634-25.53c10.322-3.949 22.435-.762 29.378 8.014c5.674 7.17 7.477 15.24 4.491 24.083c-.83 2.466-1.905 4.852-3.07 7.774'/%3E%3Cpath fill='%234a4a4a' d='M167.707 187.21h-45.77c-4.387 18.044-13.863 32.612-30.19 41.876c-12.693 7.2-26.373 9.641-40.933 7.29c-26.808-4.323-48.728-28.456-50.658-55.63c-2.184-30.784 18.975-58.147 47.178-64.293c1.947 7.071 3.915 14.21 5.862 21.264c-25.876 13.202-34.832 29.836-27.59 50.636c6.375 18.304 24.484 28.337 44.147 24.457c20.08-3.962 30.204-20.65 28.968-47.432c19.036 0 38.088-.197 57.126.097c7.434.117 13.173-.654 18.773-7.208c9.22-10.784 26.191-9.811 36.121.374c10.148 10.409 9.662 27.157-1.077 37.127c-10.361 9.62-26.73 9.106-36.424-1.26c-1.992-2.136-3.562-4.673-5.533-7.298'/%3E%3C/svg%3E","bg":"#F3F4F9"},"sheets":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-1.68 -1.68 27.36 27.36'%3E%3Cpath fill='%2334A853' d='M11.318 12.545H7.91v-1.909h3.41v1.91zM14.728 0v6h6l-6-6zm1.363 10.636h-3.41v1.91h3.41v-1.91zm0 3.273h-3.41v1.91h3.41v-1.91zM20.727 6.5v15.864c0 .904-.732 1.636-1.636 1.636H4.909a1.636 1.636 0 0 1-1.636-1.636V1.636C3.273.732 4.005 0 4.909 0h9.318v6.5h6.5zm-3.273 2.773H6.545v7.909h10.91v-7.91zm-6.136 4.636H7.91v1.91h3.41v-1.91z'/%3E%3C/svg%3E","bg":"#F3F4F9"},"hubspot":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-0.60 -1.98 27.36 27.36'%3E%3Cpath fill='%23FF7A59' d='M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z'/%3E%3C/svg%3E","bg":"#F3F4F9"},"stripe":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-1.68 -1.68 27.36 27.36'%3E%3Cpath fill='%23635BFF' d='M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z'/%3E%3C/svg%3E","bg":"#F3F4F9"},"mailchimp":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-1.68 -1.68 27.36 27.36'%3E%3Cpath fill='%23FFE01B' d='M11.267 0C6.791-.015-1.82 10.246 1.397 12.964l.79.669a3.88 3.88 0 0 0-.22 1.792c.084.84.518 1.644 1.22 2.266.666.59 1.542.964 2.392.964 1.406 3.24 4.62 5.228 8.386 5.34 4.04.12 7.433-1.776 8.854-5.182.093-.24.488-1.316.488-2.267 0-.956-.54-1.352-.885-1.352-.01-.037-.078-.286-.172-.586-.093-.3-.19-.51-.19-.51.375-.563.382-1.065.332-1.35-.053-.353-.2-.653-.496-.964-.296-.311-.902-.63-1.753-.868l-.446-.124c-.002-.019-.024-1.053-.043-1.497-.014-.32-.042-.822-.197-1.315-.186-.668-.508-1.253-.911-1.627 1.112-1.152 1.806-2.422 1.804-3.511-.003-2.095-2.576-2.729-5.746-1.416l-.672.285A678.22 678.22 0 0 0 12.7.504C12.304.159 11.817.002 11.267 0zm.073.873c.166 0 .322.019.465.058.297.084 1.28 1.224 1.28 1.224s-1.826 1.013-3.52 2.426c-2.28 1.757-4.005 4.311-5.037 7.082-.811.158-1.526.618-1.963 1.253-.261-.218-.748-.64-.834-.804-.698-1.326.761-3.902 1.781-5.357C5.834 3.44 9.37.867 11.34.873zm3.286 3.273c.04-.002.06.05.028.074-.143.11-.299.26-.413.414a.04.04 0 0 0 .031.064c.659.004 1.587.235 2.192.574.041.023.012.103-.034.092-.915-.21-2.414-.369-3.97.01-1.39.34-2.45.863-3.224 1.426-.04.028-.086-.023-.055-.06.896-1.035 1.999-1.935 2.987-2.44.034-.018.07.019.052.052-.079.143-.23.447-.278.678-.007.035.032.063.062.042.615-.42 1.684-.868 2.622-.926zm3.023 3.205l.056.001a.896.896 0 0 1 .456.146c.534.355.61 1.216.638 1.845.015.36.059 1.229.074 1.478.034.571.184.651.487.751.17.057.33.098.563.164.706.198 1.125.4 1.39.658.157.162.23.333.253.497.083.608-.472 1.36-1.942 2.041-1.607.746-3.557.935-4.904.785l-.471-.053c-1.078-.145-1.693 1.247-1.046 2.201.417.615 1.552 1.015 2.688 1.015 2.604 0 4.605-1.111 5.35-2.072a.987.987 0 0 0 .06-.085c.036-.055.006-.085-.04-.054-.608.416-3.31 2.069-6.2 1.571 0 0-.351-.057-.672-.182-.255-.1-.788-.344-.853-.891 2.333.72 3.801.039 3.801.039a.072.072 0 0 0 .042-.072.067.067 0 0 0-.074-.06s-1.911.283-3.718-.378c.197-.64.72-.408 1.51-.345a11.045 11.045 0 0 0 3.647-.394c.818-.234 1.892-.697 2.727-1.356.281.618.38 1.299.38 1.299s.219-.04.4.073c.173.106.299.326.213.895-.176 1.063-.628 1.926-1.387 2.72a5.714 5.714 0 0 1-1.666 1.244c-.34.18-.704.334-1.087.46-2.863.935-5.794-.093-6.739-2.3a3.545 3.545 0 0 1-.189-.522c-.403-1.455-.06-3.2 1.008-4.299.065-.07.132-.153.132-.256 0-.087-.055-.179-.102-.243-.374-.543-1.669-1.466-1.409-3.254.187-1.284 1.31-2.189 2.357-2.135.089.004.177.01.266.015.453.027.85.085 1.223.1.625.028 1.187-.063 1.853-.618.225-.187.405-.35.71-.401.028-.005.092-.028.215-.028zm.022 2.18a.42.42 0 0 0-.06.005c-.335.054-.347.468-.228 1.04.068.32.187.595.32.765.175-.02.343-.022.498 0 .089-.205.104-.557.024-.942-.112-.535-.261-.872-.554-.868zm-3.66 1.546a1.724 1.724 0 0 0-1.016.326c-.16.117-.311.28-.29.378.008.032.031.056.088.063.131.015.592-.217 1.122-.25.374-.023.684.094.923.2.239.104.386.173.443.113.037-.038.026-.11-.031-.204-.118-.192-.36-.387-.618-.497a1.601 1.601 0 0 0-.621-.129zm4.082.81c-.171-.003-.313.186-.317.42-.004.236.131.43.303.432.172.003.314-.185.318-.42.004-.236-.132-.429-.304-.432zm-3.58.172c-.05 0-.102.002-.155.008-.311.05-.483.152-.593.247-.094.082-.152.173-.152.237a.075.075 0 0 0 .075.076c.07 0 .228-.063.228-.063a1.98 1.98 0 0 1 1.001-.104c.157.018.23.027.265-.026.01-.016.022-.049-.01-.1-.063-.103-.311-.269-.66-.275zm2.26.4c-.127 0-.235.051-.283.148-.075.154.035.363.246.466.21.104.443.063.52-.09.075-.155-.035-.364-.246-.467a.542.542 0 0 0-.237-.058zm-11.635.024c.048 0 .098 0 .149.003.73.04 1.806.6 2.052 2.19.217 1.41-.128 2.843-1.449 3.069-.123.02-.248.029-.374.026-1.22-.033-2.539-1.132-2.67-2.435-.145-1.44.591-2.548 1.894-2.811.117-.024.252-.04.398-.042zm-.07.927a1.144 1.144 0 0 0-.847.364c-.38.418-.439.988-.366 1.19.027.073.07.094.1.098.064.008.16-.039.22-.2a1.2 1.2 0 0 0 .017-.052 1.58 1.58 0 0 1 .157-.37.689.689 0 0 1 .955-.199c.266.174.369.5.255.81-.058.161-.154.469-.133.721.043.511.357.717.64.738.274.01.466-.143.515-.256.029-.067.005-.107-.011-.125-.043-.053-.113-.037-.18-.021a.638.638 0 0 1-.16.022.347.347 0 0 1-.294-.148c-.078-.12-.073-.3.013-.504.011-.028.025-.058.04-.092.138-.308.368-.825.11-1.317-.195-.37-.513-.602-.894-.65a1.135 1.135 0 0 0-.138-.01z'/%3E%3C/svg%3E","bg":"#241C15"},"http":{"uri":"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0.65 0.65 22.71 22.71'%3E%3Cpath fill='none' stroke='%233538E8' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' d='M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18'/%3E%3C/svg%3E","bg":"#ECEDFE"}};
const M = { Gm: 'gmail', Sl: 'slack', Gs: 'sheets', Pg: 'pg', Mg: 'mongo', Dc: 'discord', Wh: 'webhook', Api: 'http' };
class Component extends DCLogic {
  renderVals() {
    const a = L[this.props.app] || L[M[this.props.app]] || L.http, size = this.props.s ?? 36;
    return { ...a, size, inner: Math.round(size * 0.72), radius: Math.round(size * 0.24) };
  }
}

return Component;
});
FB.def("Builder",[{"t":"sc-if","a":{"value":"{{fbDenied}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"dc-import","a":{"name":"NoAccess","hint-size":"100%,100vh"},"c":[]}]},{"t":"sc-if","a":{"value":"{{fbOk}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"div","a":{"class":"b-root {{roCls}} {{tileCls}}","style":"min-height: 480px","onPointerMove":"{{onMove}}","onPointerUp":"{{onUp}}"},"c":[{"t":"header","a":{"class":"b-top wrap"},"c":[{"t":"a","a":{"class":"btn btn-g btn-ic tip-b","href":"/workflows","aria-label":"Back to workflows","data-tip":"Back to workflows"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"left","s":"17","hint-size":"17px,17px"},"c":[]}]},{"t":"label","a":{"for":"b-name","style":"position: absolute; width: 1px; height: 1px; overflow: hidden"},"c":["Workflow name"]},{"t":"input","a":{"id":"b-name","class":"b-name","value":"{{name}}","onChange":"{{onName}}"},"c":[]},{"t":"span","a":{"class":"badge {{liveCls}} b-desk","title":"{{liveTitle}}"},"c":[{"t":"span","a":{"class":"dot {{liveDot}}"},"c":[]},"{{liveLabel}}"]},{"t":"sc-if","a":{"value":"{{readOnly}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"span","a":{"class":"badge b-off b-desk","title":"Your role can view this workflow but not change it"},"c":["View only"]}]},{"t":"span","a":{"class":"small muted b-hide-md b-desk b-edit"},"c":["{{saveNote}}"]},{"t":"div","a":{"class":"grow"},"c":[]},{"t":"div","a":{"class":"row b-desk b-edit","style":"gap: 2px"},"c":[{"t":"button","a":{"class":"btn btn-g btn-ic tip-b","aria-label":"Workflow settings","data-tip":"Workflow settings","onClick":"{{openSettings}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"gear","s":"16","hint-size":"16px,16px"},"c":[]}]},{"t":"button","a":{"class":"btn btn-g btn-ic tip-b","aria-label":"Undo","data-tip":"Undo (Ctrl+Z)","disabled":"{{noUndo}}","onClick":"{{undo}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"undo","s":"16","hint-size":"16px,16px"},"c":[]}]},{"t":"button","a":{"class":"btn btn-g btn-ic tip-b","aria-label":"Redo","data-tip":"Redo (Ctrl+Y)","disabled":"{{noRedo}}","onClick":"{{redo}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"redo","s":"16","hint-size":"16px,16px"},"c":[]}]}]},{"t":"span","a":{"class":"b-div b-desk b-edit"},"c":[]},{"t":"sc-if","a":{"value":"{{issueCount}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"button","a":{"class":"btn btn-sm b-desk b-edit","style":"color: var(--err); border-color: #F0B8BE; height: 34px","onClick":"{{openProblems}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"alert","s":"14","hint-size":"14px,14px"},"c":[]},"{{issueLabel}}"]}]},{"t":"button","a":{"class":"btn b-desk b-edit","onClick":"{{save}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"save","s":"15","hint-size":"15px,15px"},"c":[]},"Save"]},{"t":"sc-if","a":{"value":"{{running}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"button","a":{"class":"btn b-desk b-edit","onClick":"{{stop}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"stop","s":"14","hint-size":"14px,14px"},"c":[]},"Stop test"]}]},{"t":"sc-if","a":{"value":"{{idle}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"button","a":{"class":"btn b-desk b-edit","onClick":"{{test}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"test","s":"14","hint-size":"14px,14px"},"c":[]},"Test workflow"]}]},{"t":"div","a":{"class":"row b-desk b-edit","style":"gap: 1px; position: relative"},"c":[{"t":"button","a":{"class":"btn btn-p","style":"border-radius: var(--r) 0 0 var(--r)","disabled":"{{pubDisabled}}","title":"{{pubTitle}}","onClick":"{{openPublish}}"},"c":[{"t":"sc-if","a":{"value":"{{ahead}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"span","a":{"class":"dot warn"},"c":[]}]},"{{pubLabel}} "]},{"t":"button","a":{"class":"btn btn-p btn-ic","style":"border-radius: 0 var(--r) var(--r) 0; width: 30px","aria-label":"More publishing options","aria-expanded":"{{menuOpen}}","onClick":"{{toggleMenu}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"down","s":"14","hint-size":"14px,14px"},"c":[]}]},{"t":"sc-if","a":{"value":"{{menuOpen}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"pop","style":"right: 0; top: 40px; width: 280px"},"c":[{"t":"button","a":{"class":"menu-i danger","disabled":"{{cannotUnpublish}}","style":"opacity: {{unpubOpacity}}","onClick":"{{askUnpublish}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"stop","s":"14","hint-size":"14px,14px"},"c":[]},"Unpublish"]},{"t":"div","a":{"class":"menu-sep"},"c":[]},{"t":"div","a":{"class":"menu-h"},"c":["Published versions"]},{"t":"sc-for","a":{"list":"{{versions}}","as":"v","hint-placeholder-count":"3"},"c":[{"t":"div","a":{"class":"row","style":"padding: 7px 9px; gap: 9px; font-size: 13px; align-items: flex-start"},"c":[{"t":"span","a":{"class":"dot {{v.dot}}","style":"margin-top: 6px"},"c":[]},{"t":"span","a":{"class":"grow"},"c":[{"t":"span","a":{"class":"strong","style":"display: block"},"c":["{{v.n}}"]},{"t":"span","a":{"class":"small muted","style":"display: block"},"c":["{{v.sub}}"]}]}]}]}]}]}]}]},{"t":"div","a":{"class":"b-mobile"},"c":[{"t":"div","a":{"class":"notice info"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"flow","s":"16","hint-size":"16px,16px"},"c":[]},{"t":"span","a":{"class":"grow"},"c":["Editing needs a larger screen. Open this workflow on a desktop to change its steps."]}]},{"t":"div","a":{"class":"card card-b col","style":"gap: 8px"},"c":[{"t":"div","a":{"class":"strong"},"c":["New customer onboarding"]},{"t":"div","a":{"class":"row between small"},"c":[{"t":"span","a":{"class":"muted"},"c":["Status"]},{"t":"span","a":{"class":"badge b-ok"},"c":[{"t":"span","a":{"class":"dot ok"},"c":[]},"Published"]}]},{"t":"div","a":{"class":"row between small"},"c":[{"t":"span","a":{"class":"muted"},"c":["Runs, last 30 days"]},{"t":"span","a":{"class":"num strong"},"c":["4,812"]}]},{"t":"div","a":{"class":"row between small"},"c":[{"t":"span","a":{"class":"muted"},"c":["Success rate"]},{"t":"span","a":{"class":"num strong"},"c":["97.6%"]}]}]},{"t":"a","a":{"class":"btn btn-p","href":"/executions"},"c":["View the latest failed run"]},{"t":"a","a":{"class":"btn","href":"/executions"},"c":["All executions"]}]},{"t":"div","a":{"class":"b-body b-desk"},"c":[{"t":"aside","a":{"class":"b-pal","aria-label":"Steps you can add"},"c":[{"t":"div","a":{"style":"padding: 12px 14px 0; font-size: 14px; font-weight: 650; letter-spacing: -0.01em"},"c":["{{palTitle}}"]},{"t":"div","a":{"style":"padding: 10px 10px 2px; position: relative"},"c":[{"t":"span","a":{"class":"search-ic","style":"left: 20px; top: 19px"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"search","s":"14","hint-size":"14px,14px"},"c":[]}]},{"t":"label","a":{"for":"pal-q","style":"position: absolute; width: 1px; height: 1px; overflow: hidden"},"c":["Search steps"]},{"t":"input","a":{"id":"pal-q","class":"input","style":"padding-left: 30px","type":"search","placeholder":"Search steps and apps","value":"{{palQ}}","onChange":"{{onPalQ}}"},"c":[]}]},{"t":"div","a":{"class":"b-pal-scroll"},"c":[{"t":"sc-for","a":{"list":"{{palette}}","as":"g","hint-placeholder-count":"4"},"c":[{"t":"div","a":{"class":"pal-h"},"c":["{{g.title}}"]},{"t":"sc-for","a":{"list":"{{g.items}}","as":"p"},"c":[{"t":"button","a":{"class":"pal-i","onPointerDown":"{{p.down}}","onClick":"{{p.click}}","title":"Drag onto the canvas, or click to add after the selected step"},"c":[{"t":"sc-if","a":{"value":"{{p.mono}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"{{p.mono}}","s":"28","hint-size":"28px,28px"},"c":[]}]},{"t":"sc-if","a":{"value":"{{p.icon}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"span","a":{"class":"n-ic {{p.group}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{p.icon}}","s":"15","hint-size":"15px,15px"},"c":[]}]}]},{"t":"span","a":{"class":"grow"},"c":[{"t":"span","a":{"class":"strong trunc","style":"display: block; font-size: 13px"},"c":["{{p.title}}"]},{"t":"span","a":{"class":"small muted trunc","style":"display: block"},"c":["{{p.desc}}"]}]}]}]}]},{"t":"sc-if","a":{"value":"{{palEmpty}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"p","a":{"class":"small muted","style":"padding: 14px 4px"},"c":["No step matches that search."]}]}]}]},{"t":"div","a":{"class":"b-center"},"c":[{"t":"sc-if","a":{"value":"{{debug}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"notice {{debugCls}}","style":"border-radius: 0; flex: none; padding: 8px 14px; font-size: 13px","role":"status"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{debugIc}}","s":"15","hint-size":"15px,15px"},"c":[]},{"t":"span","a":{"class":"grow"},"c":["{{debugText}}"]},{"t":"button","a":{"class":"btn btn-sm","onClick":"{{exitDebug}}"},"c":["Exit debug"]}]}]},{"t":"sc-if","a":{"value":"{{importNote}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"notice info","style":"border-radius: 0; flex: none; padding: 8px 14px; font-size: 13px","role":"status"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"template","s":"15","hint-size":"15px,15px"},"c":[]},{"t":"span","a":{"class":"grow"},"c":["{{importNote}}"]},{"t":"button","a":{"class":"btn btn-sm btn-g btn-ic","aria-label":"Dismiss","onClick":"{{dismissImport}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"x","s":"14","hint-size":"14px,14px"},"c":[]}]}]}]},{"t":"div","a":{"class":"canvas {{panCls}} {{glideCls}}","tabindex":"0","aria-label":"Workflow canvas. Arrow keys move the selected step, Delete removes it.","style":"background-size: {{gridSize}}px {{gridSize}}px; background-position: {{px}}px {{py}}px","onPointerDown":"{{onBgDown}}","onWheel":"{{onWheel}}","onKeyDown":"{{onKey}}"},"c":[{"t":"div","a":{"class":"world {{glideCls}}","style":"transform: translate({{px}}px, {{py}}px) scale({{zoom}})"},"c":[{"t":"svg","a":{"class":"edges","aria-hidden":"true"},"c":[{"t":"sc-for","a":{"list":"{{edgeViews}}","as":"e","hint-placeholder-count":"5"},"c":[{"t":"path","a":{"class":"e-hit","d":"{{e.d}}","onClick":"{{e.select}}","onMouseEnter":"{{e.hover}}","onMouseLeave":"{{e.unhover}}"},"c":[]},{"t":"path","a":{"class":"e {{e.cls}}","d":"{{e.d}}"},"c":[]}]},{"t":"sc-if","a":{"value":"{{draft}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"path","a":{"class":"e draft","d":"{{draft}}"},"c":[]}]}]},{"t":"sc-for","a":{"list":"{{edgeViews}}","as":"e","hint-placeholder-count":"5"},"c":[{"t":"sc-if","a":{"value":"{{e.flowing}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"packet","style":"offset-path: path('{{e.d}}')"},"c":[]}]},{"t":"sc-if","a":{"value":"{{e.tag}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"span","a":{"class":"e-tag {{e.tagCls}}","style":"left: {{e.mx}}px; top: {{e.my}}px"},"c":["{{e.tag}}"]}]},{"t":"sc-if","a":{"value":"{{e.showTools}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"e-tools row","style":"position: absolute; left: {{e.mx}}px; top: {{e.my}}px; transform: translate(-50%, -50%); gap: 2px; background: var(--surface); border: 1px solid var(--line-2); border-radius: var(--r); padding: 2px; box-shadow: var(--sh-2); z-index: 3","onMouseEnter":"{{e.hover}}","onMouseLeave":"{{e.unhover}}"},"c":[{"t":"button","a":{"class":"btn btn-g btn-sm btn-ic","aria-label":"Insert a step in this connection","title":"Insert a step here","onClick":"{{e.insert}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"plus","s":"14","hint-size":"14px,14px"},"c":[]}]},{"t":"button","a":{"class":"btn btn-g btn-sm btn-ic","style":"color: var(--err)","aria-label":"Remove this connection","title":"Remove this connection","onClick":"{{e.remove}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"trash","s":"14","hint-size":"14px,14px"},"c":[]}]}]}]}]},{"t":"sc-for","a":{"list":"{{nodeViews}}","as":"n","hint-placeholder-count":"6"},"c":[{"t":"div","a":{"class":"node {{n.cls}} {{n.trig}}","style":"left: {{n.x}}px; top: {{n.y}}px; animation-delay: {{n.delay}}ms","onPointerDown":"{{n.down}}","onDoubleClick":"{{n.open}}"},"c":[{"t":"button","a":{"class":"node-b","aria-label":"{{n.aria}}","onClick":"{{n.select}}"},"c":[{"t":"sc-if","a":{"value":"{{n.logo}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"{{n.logo}}","s":"28","hint-size":"28px,28px"},"c":[]}]},{"t":"sc-if","a":{"value":"{{n.noLogo}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"span","a":{"class":"n-ic {{n.group}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{n.icon}}","s":"15","hint-size":"15px,15px"},"c":[]}]}]},{"t":"span","a":{"class":"grow"},"c":[{"t":"span","a":{"class":"node-t trunc"},"c":["{{n.title}}"]},{"t":"span","a":{"class":"node-d trunc"},"c":["{{n.desc}}"]}]}]},{"t":"div","a":{"class":"node-f"},"c":[{"t":"span","a":{"class":"dot {{n.footDot}}"},"c":[]},{"t":"span","a":{"class":"trunc"},"c":["{{n.foot}}"]}]},{"t":"sc-if","a":{"value":"{{n.badge}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"span","a":{"class":"node-x {{n.badge}}"},"c":[{"t":"span","a":{"class":"row {{n.badgeSpin}}","style":"gap: 0"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{n.badgeIc}}","s":"11","hint-size":"11px,11px"},"c":[]}]}]}]},{"t":"sc-if","a":{"value":"{{n.hasIn}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"span","a":{"class":"port {{n.inCls}}","style":"left: 0; top: {{n.inY}}px; pointer-events: none"},"c":[{"t":"i","a":{},"c":[]}]}]},{"t":"sc-for","a":{"list":"{{n.outs}}","as":"o"},"c":[{"t":"button","a":{"class":"port","style":"left: 100%; top: {{o.y}}px","aria-label":"{{o.aria}}","title":"{{o.aria}}","onPointerDown":"{{o.down}}"},"c":[{"t":"i","a":{},"c":[]}]}]},{"t":"sc-if","a":{"value":"{{n.showPlus}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"button","a":{"class":"port-plus","style":"top: {{n.inY}}px","aria-label":"Add the next step","title":"Add the next step","onClick":"{{n.addNext}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"plus","s":"14","hint-size":"14px,14px"},"c":[]}]}]},{"t":"sc-if","a":{"value":"{{n.selected}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"node-bar"},"c":[{"t":"button","a":{"class":"btn btn-g btn-sm btn-ic","aria-label":"Open full step view","title":"Open full step view (double-click)","onClick":"{{n.open}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"fit","s":"14","hint-size":"14px,14px"},"c":[]}]},{"t":"button","a":{"class":"btn btn-g btn-sm btn-ic b-edit","aria-label":"Duplicate step","title":"Duplicate (Ctrl+D)","onClick":"{{n.duplicate}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"copy","s":"14","hint-size":"14px,14px"},"c":[]}]},{"t":"button","a":{"class":"btn btn-g btn-sm btn-ic b-edit","style":"color: var(--err)","aria-label":"Delete step","title":"Delete","onClick":"{{n.askDelete}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"trash","s":"14","hint-size":"14px,14px"},"c":[]}]}]}]}]}]}]},{"t":"sc-if","a":{"value":"{{hint}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"hint-bar"},"c":["{{hint}}"]}]},{"t":"sc-if","a":{"value":"{{checklist}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"section","a":{"class":"card","style":"position: absolute; left: 12px; top: 12px; width: 300px; z-index: 7; box-shadow: var(--sh-3)","aria-label":"After publishing"},"c":[{"t":"div","a":{"class":"row between","style":"padding: 11px 12px 7px"},"c":[{"t":"span","a":{},"c":[{"t":"span","a":{"class":"strong","style":"font-size: 13px; display: block"},"c":["{{checklistTitle}}"]},{"t":"span","a":{"class":"small muted","style":"display: block"},"c":["The production webhook now accepts events."]}]},{"t":"button","a":{"class":"btn btn-g btn-sm btn-ic","aria-label":"Dismiss checklist","onClick":"{{closeChecklist}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"x","s":"14","hint-size":"14px,14px"},"c":[]}]}]},{"t":"sc-for","a":{"list":"{{checkItems}}","as":"c","hint-placeholder-count":"3"},"c":[{"t":"button","a":{"class":"step-row","style":"align-items: flex-start; padding: 8px 12px; font-size: 12.5px; border-bottom: 0; border-top: 1px solid var(--line)","onClick":"{{c.act}}"},"c":[{"t":"span","a":{"class":"tl-n {{c.cls}}","style":"width: 18px; height: 18px; flex: none"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{c.ic}}","s":"11","hint-size":"11px,11px"},"c":[]}]},{"t":"span","a":{"class":"grow"},"c":[{"t":"span","a":{"class":"strong","style":"display: block"},"c":["{{c.t}}"]},{"t":"span","a":{"class":"small muted","style":"display: block"},"c":["{{c.d}}"]}]}]}]}]}]},{"t":"sc-if","a":{"value":"{{isEmpty}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"empty","style":"position: absolute; inset: 0; justify-content: center; pointer-events: none"},"c":[{"t":"div","a":{"class":"empty-ic"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"webhook","s":"20","hint-size":"20px,20px"},"c":[]}]},{"t":"div","a":{"class":"strong"},"c":["Every workflow starts with a trigger"]},{"t":"div","a":{"class":"small muted"},"c":["Drag a Webhook, Schedule or Manual trigger here from the left."]}]}]},{"t":"div","a":{"class":"canvas-tools","role":"group","aria-label":"Zoom"},"c":[{"t":"button","a":{"class":"btn btn-g btn-sm","style":"width: auto; padding: 0 8px; font-size: 12px; white-space: nowrap","aria-pressed":"{{tilePressed}}","title":"Switch how steps are drawn","onClick":"{{toggleTile}}"},"c":["{{tileLabel}}"]},{"t":"button","a":{"class":"btn btn-g btn-sm btn-ic","aria-label":"Zoom out","onClick":"{{zoomOut}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"minus","s":"14","hint-size":"14px,14px"},"c":[]}]},{"t":"span","a":{"class":"pct","style":"display: inline-grid; place-items: center"},"c":["{{zoomPct}}"]},{"t":"button","a":{"class":"btn btn-g btn-sm btn-ic","aria-label":"Zoom in","onClick":"{{zoomIn}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"plus","s":"14","hint-size":"14px,14px"},"c":[]}]},{"t":"button","a":{"class":"btn btn-g btn-sm btn-ic","aria-label":"Fit workflow to view","title":"Fit to view","onClick":"{{fit}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"fit","s":"14","hint-size":"14px,14px"},"c":[]}]},{"t":"button","a":{"class":"btn btn-g btn-sm btn-ic","aria-label":"Tidy up the workflow","title":"Tidy up: arrange steps automatically","onClick":"{{tidy}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"tidy","s":"14","hint-size":"14px,14px"},"c":[]}]}]}]},{"t":"section","a":{"class":"b-bot","aria-label":"Test runs and problems"},"c":[{"t":"div","a":{"class":"b-bot-h"},"c":[{"t":"button","a":{"class":"tab {{tabRun}}","style":"border-bottom: 0; margin: 0; padding: 6px 9px","onClick":"{{showRun}}"},"c":["Test run"]},{"t":"button","a":{"class":"tab {{tabProb}}","style":"border-bottom: 0; margin: 0; padding: 6px 9px","onClick":"{{showProb}}"},"c":["Setup",{"t":"sc-if","a":{"value":"{{issueCount}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"span","a":{"class":"nav-count","style":"margin: 0"},"c":["{{issueCount}}"]}]}]},{"t":"sc-if","a":{"value":"{{runBadge}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"span","a":{"class":"badge {{runBadge.cls}}"},"c":[{"t":"span","a":{"class":"row {{runBadge.spin}}","style":"gap: 0"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{runBadge.ic}}","s":"13","hint-size":"13px,13px"},"c":[]}]},"{{runBadge.l}}"]}]},{"t":"div","a":{"class":"grow"},"c":[]},{"t":"label","a":{"class":"small muted b-hide-md b-edit","for":"scn"},"c":["Test with"]},{"t":"select","a":{"id":"scn","class":"select b-edit","style":"width: 190px; height: 28px; font-size: 12px","value":"{{scenario}}","onChange":"{{onScenario}}"},"c":[{"t":"option","a":{"value":"ok"},"c":["Valid customer"]},{"t":"option","a":{"value":"invalid"},"c":["Invalid email address"]},{"t":"option","a":{"value":"fail"},"c":["Gmail limit reached"]}]},{"t":"button","a":{"class":"btn btn-g btn-sm btn-ic","aria-label":"{{botLabel}}","aria-expanded":"{{botOpen}}","onClick":"{{toggleBot}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{botIc}}","s":"15","hint-size":"15px,15px"},"c":[]}]}]},{"t":"sc-if","a":{"value":"{{botOpen}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"b-bot-b"},"c":[{"t":"sc-if","a":{"value":"{{isRunTab}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"sc-if","a":{"value":"{{noRun}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"div","a":{"class":"empty","style":"flex: 1; padding: 28px"},"c":[{"t":"div","a":{"class":"strong"},"c":["No test run yet"]},{"t":"div","a":{"class":"small muted"},"c":["Choose sample data above, then click Test workflow. Tests do not send real emails or messages."]},{"t":"button","a":{"class":"btn btn-sm","onClick":"{{loadDebug}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"retry","s":"13","hint-size":"13px,13px"},"c":[]},"Debug failed run EX-48213"]}]}]},{"t":"sc-if","a":{"value":"{{hasRun}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"style":"width: 300px; flex: none; overflow: auto"},"c":[{"t":"sc-for","a":{"list":"{{stepViews}}","as":"s"},"c":[{"t":"button","a":{"class":"step-row","onClick":"{{s.select}}"},"c":[{"t":"span","a":{"class":"tl-n {{s.cls}}","style":"width: 18px; height: 18px"},"c":[{"t":"span","a":{"class":"row {{s.spin}}","style":"gap: 0"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{s.ic}}","s":"11","hint-size":"11px,11px"},"c":[]}]}]},{"t":"span","a":{"class":"grow trunc"},"c":["{{s.title}}"]},{"t":"span","a":{"class":"small dim num"},"c":["{{s.ms}}"]}]}]},{"t":"sc-if","a":{"value":"{{failedStep}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"row wrap","style":"padding: 10px 14px"},"c":[{"t":"button","a":{"class":"btn btn-sm btn-p","onClick":"{{retry}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"retry","s":"13","hint-size":"13px,13px"},"c":[]},"Retry from failed step"]},{"t":"a","a":{"class":"btn btn-sm","href":"/executions"},"c":["Inspect run"]}]}]}]},{"t":"div","a":{"class":"log","tabindex":"0","aria-label":"Run log"},"c":[{"t":"sc-for","a":{"list":"{{logs}}","as":"l"},"c":[{"t":"div","a":{"class":"{{l.c}}"},"c":["{{l.t}}  {{l.m}}"]}]}]}]}]},{"t":"sc-if","a":{"value":"{{isProbTab}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"style":"flex: 1; overflow: auto"},"c":[{"t":"div","a":{"class":"col","style":"padding: 10px 14px; gap: 6px; border-bottom: 1px solid var(--line)"},"c":[{"t":"div","a":{"class":"row between small"},"c":[{"t":"span","a":{"class":"strong"},"c":["{{setupTitle}}"]},{"t":"span","a":{"class":"muted"},"c":["{{setupNext}}"]}]},{"t":"div","a":{"class":"hbar"},"c":[{"t":"i","a":{"style":"width: {{setupPct}}%; background: var(--ok-m)"},"c":[]}]}]},{"t":"sc-if","a":{"value":"{{needTrigger}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"step-row","style":"color: var(--err)"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"alert","s":"15","hint-size":"15px,15px"},"c":[]},{"t":"span","a":{"class":"strong"},"c":["Add a trigger so this workflow can start"]}]}]},{"t":"sc-for","a":{"list":"{{setupItems}}","as":"i","hint-placeholder-count":"5"},"c":[{"t":"button","a":{"class":"step-row","onClick":"{{i.select}}"},"c":[{"t":"span","a":{"class":"tl-n {{i.cls}}","style":"width: 18px; height: 18px"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{i.ic}}","s":"11","hint-size":"11px,11px"},"c":[]}]},{"t":"span","a":{"class":"strong"},"c":["{{i.title}}"]},{"t":"span","a":{"class":"muted grow trunc"},"c":["{{i.msg}}"]},{"t":"span","a":{"class":"small","style":"color: var(--brand-ink); font-weight: 600"},"c":["{{i.action}}"]}]}]}]}]}]}]}]}]},{"t":"aside","a":{"class":"b-cfg","style":"display: {{cfgDisplay}}"},"c":[{"t":"dc-import","a":{"name":"ConfigPanel","node":"{{panelNode}}","upstream":"{{panelUp}}","on-validity":"{{onValidity}}","on-title":"{{onTitle}}","on-close":"{{closePanel}}","on-saved":"{{onPanelSaved}}","on-field":"{{onField}}","focus-req":"{{focusReq}}","prod-req":"{{prodReq}}","hint-size":"372px,100%"},"c":[]}]}]},{"t":"sc-if","a":{"value":"{{ghost}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"ghost","style":"left: {{ghost.x}}px; top: {{ghost.y}}px"},"c":[{"t":"sc-if","a":{"value":"{{ghost.app}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"{{ghost.app}}","s":"28","hint-size":"28px,28px"},"c":[]}]},{"t":"sc-if","a":{"value":"{{ghost.noApp}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"span","a":{"class":"n-ic {{ghost.group}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{ghost.icon}}","s":"15","hint-size":"15px,15px"},"c":[]}]}]},"{{ghost.title}}"]}]},{"t":"sc-if","a":{"value":"{{wfOpen}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"scrim"},"c":[{"t":"div","a":{"class":"modal","style":"width: min(520px, 100%)","role":"dialog","aria-modal":"true","aria-labelledby":"wf-t"},"c":[{"t":"h2","a":{"id":"wf-t"},"c":["Workflow settings"]},{"t":"div","a":{"class":"col","style":"gap: 12px"},"c":[{"t":"div","a":{"class":"row between","style":"gap: 16px"},"c":[{"t":"div","a":{"class":"grow"},"c":[{"t":"div","a":{"class":"label"},"c":["Alert me when a live run fails"]},{"t":"div","a":{"class":"hint"},"c":["Sent once all retries are used. Test runs never send alerts."]}]},{"t":"button","a":{"class":"toggle {{alertCls}}","role":"switch","aria-checked":"{{alertAria}}","aria-label":"Alert me when a live run fails","onClick":"{{flipAlert}}"},"c":[]}]},{"t":"sc-if","a":{"value":"{{alertOn}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"wf-to"},"c":["Send alerts to"]},{"t":"select","a":{"id":"wf-to","class":"select","value":"{{alertTo}}","onChange":"{{onAlertTo}}"},"c":[{"t":"option","a":{},"c":["Slack: #ops-alerts"]},{"t":"option","a":{},"c":["Email: workflow owner"]},{"t":"option","a":{},"c":["Email: everyone with access"]}]}]}]},{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"wf-sf"},"c":["Keep data from failed runs"]},{"t":"select","a":{"id":"wf-sf","class":"select"},"c":[{"t":"option","a":{},"c":["Keep"]},{"t":"option","a":{},"c":["Do not keep"]}]},{"t":"span","a":{"class":"hint"},"c":["Needed for replay, retry and Debug in builder."]}]},{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"wf-ss"},"c":["Keep data from successful runs"]},{"t":"select","a":{"id":"wf-ss","class":"select"},"c":[{"t":"option","a":{},"c":["Keep"]},{"t":"option","a":{},"c":["Do not keep"]}]}]},{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"wf-to2"},"c":["Stop a run after"]},{"t":"select","a":{"id":"wf-to2","class":"select"},"c":[{"t":"option","a":{},"c":["10 minutes"]},{"t":"option","a":{},"c":["1 minute"]},{"t":"option","a":{},"c":["1 hour"]}]}]}]},{"t":"div","a":{"class":"modal-a"},"c":[{"t":"button","a":{"class":"btn","onClick":"{{closeSettings}}"},"c":["Cancel"]},{"t":"button","a":{"class":"btn btn-p","onClick":"{{saveSettings}}"},"c":["Save settings"]}]}]}]}]},{"t":"sc-if","a":{"value":"{{pubOpen}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"scrim"},"c":[{"t":"div","a":{"class":"modal","role":"dialog","aria-modal":"true","aria-labelledby":"pub-t"},"c":[{"t":"h2","a":{"id":"pub-t"},"c":["Publish workflow"]},{"t":"p","a":{"class":"muted","style":"text-wrap: pretty"},"c":["{{pubIntro}}"]},{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"pub-n"},"c":["Version name ",{"t":"span","a":{"class":"req","aria-label":"required"},"c":["*"]}]},{"t":"input","a":{"id":"pub-n","class":"input {{pubBad}}","value":"{{pubName}}","onChange":"{{onPubName}}"},"c":[]},{"t":"sc-if","a":{"value":"{{pubErr}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"span","a":{"class":"err-msg"},"c":["{{pubErr}}"]}]}]},{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"pub-d"},"c":["What changed (optional)"]},{"t":"textarea","a":{"id":"pub-d","class":"area","rows":"3","placeholder":"For example: added the sales team notification","value":"{{pubNote}}","onChange":"{{onPubNote}}"},"c":[]}]},{"t":"div","a":{"class":"modal-a"},"c":[{"t":"button","a":{"class":"btn","onClick":"{{closePublish}}"},"c":["Cancel"]},{"t":"button","a":{"class":"btn btn-p","onClick":"{{doPublish}}"},"c":["Publish"]}]}]}]}]},{"t":"sc-if","a":{"value":"{{modal}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"scrim"},"c":[{"t":"div","a":{"class":"modal","role":"dialog","aria-modal":"true","aria-labelledby":"m-t"},"c":[{"t":"h2","a":{"id":"m-t"},"c":["{{modal.title}}"]},{"t":"p","a":{"class":"muted","style":"text-wrap: pretty"},"c":["{{modal.body}}"]},{"t":"div","a":{"class":"modal-a"},"c":[{"t":"button","a":{"class":"btn","onClick":"{{cancelModal}}"},"c":["Cancel"]},{"t":"button","a":{"class":"btn btn-d","onClick":"{{confirmModal}}"},"c":["{{modal.action}}"]}]}]}]}]},{"t":"sc-if","a":{"value":"{{toast}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"toast","style":"right: auto; bottom: auto; left: 264px; top: 150px","role":"status"},"c":[{"t":"span","a":{"class":"grow"},"c":["{{toast.text}}"]},{"t":"sc-if","a":{"value":"{{toast.undo}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"button","a":{"class":"t-a","onClick":"{{undo}}"},"c":["Undo"]}]},{"t":"sc-if","a":{"value":"{{toast.inspect}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"a","a":{"href":"/executions"},"c":["Inspect"]}]}]}]}]}]}],{},function(DCLogic){

const FB_ACC = {
  admin: { k: 'admin', n: 'Jonah Thomas', f: 'Jonah', i: 'JT', a: 'a5', r: 'Administrator', e: 'jonah@meridianlogistics.example' },
  creator: { k: 'creator', n: 'Priya Raman', f: 'Priya', i: 'PR', a: '', r: 'Workflow Creator', e: 'priya@meridianlogistics.example' },
  operator: { k: 'operator', n: 'Rahul Shah', f: 'Rahul', i: 'RS', a: 'a3', r: 'Technical Operator', e: 'rahul@meridianlogistics.example' },
  business: { k: 'business', n: 'Lena Costa', f: 'Lena', i: 'LC', a: 'a2', r: 'Business User', e: 'lena@meridianlogistics.example' }
};
const FB_CANS = {
  admin: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 1 },
  creator: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 0 },
  operator: { edit: 0, builder: 1, publish: 0, retry: 1, data: 1, integ: 0, integView: 1, admin: 0 },
  business: { edit: 0, builder: 0, publish: 0, retry: 0, data: 0, integ: 0, integView: 0, admin: 0 }
};
const fbStored = () => { let k = ''; try { k = localStorage.getItem('fb-role') || ''; } catch (e) {} if (!k) { try { const m = /fb-role:(\w+)/.exec(window.name || ''); if (m) k = m[1]; } catch (e) {} } return FB_ACC[k] ? k : ''; };
const fbSetRole = (k) => { try { if (k) localStorage.setItem('fb-role', k); else localStorage.removeItem('fb-role'); } catch (e) {} try { window.name = k ? 'fb-role:' + k : ''; } catch (e) {} };
const FB_ME = FB_ACC[fbStored() || 'creator'], FB_C = FB_CANS[FB_ME.k];
let W = 224, H = 92, IN_Y = 46, OUT_T = 30, OUT_F = 62;
const MIN_Z = 0.35, MAX_Z = 1.5;
const setTile = (on) => { W = on ? 88 : 224; H = on ? 88 : 92; IN_Y = on ? 44 : 46; OUT_T = on ? 26 : 30; OUT_F = on ? 62 : 62; };
const KIND = {
  webhook: { g: 'trigger', ic: 'webhook', title: 'Webhook', desc: 'When another app sends data', foot: 'Listening for events', ok: true },
  schedule: { g: 'trigger', ic: 'clock', title: 'Schedule', desc: 'At times you choose', foot: 'Every weekday, 09:00', ok: true },
  manual: { g: 'trigger', ic: 'cursor', title: 'Manual trigger', desc: 'When someone clicks Run', foot: 'Ready', ok: true },
  http: { g: 'action', ic: 'globe', title: 'HTTP request', desc: 'Call any web API', foot: 'Ready', ms: 318 },
  email: { g: 'action', ic: 'mail', title: 'Send email', desc: 'Send from a connected account', foot: 'Gmail connected', ms: 640, app: 'gmail' },
  database: { g: 'action', ic: 'table', title: 'Create database record', desc: 'Add a row to a table', foot: 'PostgreSQL connected', ms: 86, app: 'pg' },
  update: { g: 'action', ic: 'edit', title: 'Update record', desc: 'Change an existing row', foot: 'PostgreSQL connected', ms: 74, app: 'pg' },
  notify: { g: 'action', ic: 'send', title: 'Send notification', desc: 'Post to a team channel', foot: 'Slack connected', ms: 210, app: 'slack' },
  app: { g: 'action', ic: 'plug', title: 'App step', desc: 'Use a connected app', foot: 'Ready', ms: 240 },
  condition: { g: 'logic', ic: 'split', title: 'Condition', desc: 'Choose a path using rules', foot: 'Ready', two: true, ms: 4 },
  filter: { g: 'logic', ic: 'filter', title: 'Filter', desc: 'Continue only on a match', foot: 'Ready', ms: 3 },
  branch: { g: 'logic', ic: 'branch', title: 'Branch', desc: 'Split into two paths', foot: 'Ready', two: true, ms: 3 },
  delay: { g: 'logic', ic: 'hourglass', title: 'Delay', desc: 'Wait before continuing', foot: 'Waits 15 minutes', ok: true, ms: 900 }
};
const SETUP_MSG = {
  app: 'Choose an account and an action.',
  http: 'Add the URL to call.', email: 'Choose the account, then add recipient, subject and message.',
  database: 'Choose a table and map its columns.', update: 'Choose a table and map its columns.',
  notify: 'Choose a channel and write the message.', condition: 'Add a rule to decide the path.',
  filter: 'Add a rule for what continues.', branch: 'Add a rule to decide the path.'
};
const OUTPUTS = {
  webhook: { label: 'Webhook', title: 'Webhook trigger', fields: [['first_name', 'Ada'], ['last_name', 'Okafor'], ['email', 'ada.okafor@brightpath.example'], ['company', 'Brightpath Foods'], ['plan', 'Growth']] },
  schedule: { label: 'Schedule', title: 'Schedule', fields: [['fired_at', '2026-11-05T09:00:00+05:30']] },
  manual: { label: 'Manual', title: 'Manual trigger', fields: [['started_by', 'Priya Raman']] },
  condition: { label: 'Validate', title: 'Validate customer', fields: [['is_valid', 'true']] },
  database: { label: 'Database', title: 'Save to database', fields: [['customer_id', 'cus_90417'], ['created_at', '2026-11-05T10:42:19Z']] },
  http: { label: 'Http', title: 'HTTP request', fields: [['status', '201'], ['id', 'crm_55120']] },
  email: { label: 'Email', title: 'Send email', fields: [['message_id', '18f3a9c2e1b04d77']] }
};
const PALETTE = [
  { title: 'Triggers', items: ['webhook', 'schedule', 'manual'] },
  { title: 'Actions', items: ['http', 'email', 'database', 'update', 'notify'] },
  { title: 'Logic', items: ['condition', 'filter', 'branch', 'delay'] }
];
const APPS = [
  { mono: 'gmail', kind: 'email', title: 'Gmail', desc: 'Send email' },
  { mono: 'slack', kind: 'notify', title: 'Slack', desc: 'Post a message' },
  { mono: 'pg', kind: 'database', title: 'PostgreSQL', desc: 'Add a row' },
  { mono: 'sheets', kind: 'database', title: 'Google Sheets', desc: 'Add a row', preset: { conn: 'Google Sheets: Finance' } }
];
const MORE_APPS = [{"mono":"mongo","kind":"app","title":"MongoDB","desc":"Create and update documents"},{"mono":"mysql","kind":"app","title":"MySQL","desc":"Read and write rows"},{"mono":"discord","kind":"app","title":"Discord","desc":"Send a channel message"},{"mono":"telegram","kind":"app","title":"Telegram","desc":"Send a message"},{"mono":"whatsapp","kind":"app","title":"WhatsApp","desc":"Send a customer message"},{"mono":"twilio","kind":"app","title":"Twilio","desc":"Send a text message"},{"mono":"mailchimp","kind":"app","title":"Mailchimp","desc":"Add a subscriber"},{"mono":"gdrive","kind":"app","title":"Google Drive","desc":"Save or share a file"},{"mono":"dropbox","kind":"app","title":"Dropbox","desc":"Upload a file"},{"mono":"airtable","kind":"app","title":"Airtable","desc":"Create a record"},{"mono":"gcal","kind":"app","title":"Google Calendar","desc":"Create an event"},{"mono":"notion","kind":"app","title":"Notion","desc":"Add a page"},{"mono":"trello","kind":"app","title":"Trello","desc":"Add a card"},{"mono":"asana","kind":"app","title":"Asana","desc":"Create a task"},{"mono":"jira","kind":"app","title":"Jira","desc":"Create an issue"},{"mono":"github","kind":"app","title":"GitHub","desc":"Open an issue"},{"mono":"hubspot","kind":"app","title":"HubSpot","desc":"Update a contact or deal"},{"mono":"zendesk","kind":"app","title":"Zendesk","desc":"Create a ticket"},{"mono":"shopify","kind":"app","title":"Shopify","desc":"Update an order or product"},{"mono":"stripe","kind":"app","title":"Stripe","desc":"Look up a payment or invoice"}];
const seedNodes = () => [
  { id: 'hook', kind: 'webhook', title: 'Webhook trigger', desc: 'New customer registration', x: 40, y: 140, ok: true },
  { id: 'validate', kind: 'condition', title: 'Validate customer', desc: 'Email and company check', x: 340, y: 140, ok: true },
  { id: 'save', kind: 'database', title: 'Save to database', desc: 'customers table', x: 640, y: 80, ok: true },
  { id: 'mail', kind: 'email', title: 'Send welcome email', desc: 'To the new customer', x: 940, y: 80, ok: true },
  { id: 'notify', kind: 'notify', title: 'Notify sales team', desc: 'Slack message', x: 1240, y: 80, ok: false, msg: 'Channel is required.', showErr: true },
  { id: 'flag', kind: 'notify', title: 'Flag invalid lead', desc: 'Slack, #ops-data-quality', x: 640, y: 260, ok: true }
];
const seedEdges = () => [
  { id: 'e1', from: 'hook', fp: 'o', to: 'validate' },
  { id: 'e2', from: 'validate', fp: 't', to: 'save' },
  { id: 'e3', from: 'save', fp: 'o', to: 'mail' },
  { id: 'e4', from: 'mail', fp: 'o', to: 'notify' },
  { id: 'e5', from: 'validate', fp: 'f', to: 'flag' }
];
const outsOf = (n) => (KIND[n.kind].two ? [{ p: 't', y: OUT_T, l: 'Rules pass' }, { p: 'f', y: OUT_F, l: 'Rules fail' }] : [{ p: 'o', y: IN_Y, l: 'Next step' }]);
const isTrigger = (n) => KIND[n.kind].g === 'trigger';
const laneOf = (x1, y1, x2, y2, nodes) => {
  const inRange = (nodes || []).filter((n) => n.x < x1 + 44 && n.x + W > x2 - 44);
  let ly = Math.max(y1, y2) + 92;
  inRange.forEach((n) => { if (n.y + H + 26 > ly) ly = n.y + H + 26; });
  const clear = (x, step) => {
    for (let i = 0; i < 12; i++) {
      const hit = (nodes || []).find((n) => n.x - 14 < x && x < n.x + W + 14 && n.y - 14 < ly && n.y + H + 14 > Math.min(y1, y2));
      if (!hit) break;
      x = step < 0 ? hit.x - 22 : hit.x + W + 22;
    }
    return x;
  };
  return { ly, out: clear(x1 + 28, 1), inn: clear(x2 - 28, -1) };
};
const curve = (x1, y1, x2, y2, nodes) => {
  if (x2 < x1 + 24) {
    const r = 10, { ly, out, inn } = laneOf(x1, y1, x2, y2, nodes);
    return 'M' + x1 + ' ' + y1 + ' H' + (out - r) + ' Q' + out + ' ' + y1 + ',' + out + ' ' + (y1 + r) + ' V' + (ly - r) + ' Q' + out + ' ' + ly + ',' + (out - r) + ' ' + ly + ' H' + (inn + r) + ' Q' + inn + ' ' + ly + ',' + inn + ' ' + (ly - r) + ' V' + (y2 + r) + ' Q' + inn + ' ' + y2 + ',' + (inn + r) + ' ' + y2 + ' H' + x2;
  }
  const d = Math.max(36, Math.abs(x2 - x1) / 2);
  return 'M' + x1 + ' ' + y1 + ' C' + (x1 + d) + ' ' + y1 + ',' + (x2 - d) + ' ' + y2 + ',' + x2 + ' ' + y2;
};
const fmt = (ms) => '+' + (ms / 1000).toFixed(2).padStart(5, '0') + 's';
const dur = (ms) => (ms >= 1000 ? (ms / 1000).toFixed(1) + ' s' : ms + ' ms');

class Component extends DCLogic {
  state = {
    name: 'New customer onboarding', nodes: seedNodes(), edges: seedEdges(),
    sel: null, selEdge: null, px: 40, py: 110, zoom: 0.72,
    past: [], future: [], dirty: true, live: true, version: 14,
    drag: null, draftPt: null, ghost: null, target: null,
    palQ: '', bot: false, botTab: 'run', scenario: 'ok',
    exec: {}, edgeExec: {}, attempt: null, steps: [], logs: [], run: null,
    modal: null, toast: null, glide: false, fresh: null, focusReq: 0,
    debug: null, debugFixed: false, importNote: '',
    hoverEdge: null, insertEdge: null, wfOpen: false, alertOn: false, alertDraft: false, alertTo: 'Slack: #ops-alerts', checklist: false, urlSeen: false,
    ahead: true, liveName: 'Version 14', pubOpen: false, pubName: '', pubNote: '', pubErr: '', menuOpen: false,
    versions: [
      { n: 'Version 14', by: 'Priya Raman', when: '3 Nov, 14:20' },
      { n: 'Version 13', by: 'Priya Raman', when: '21 Oct, 09:48' },
      { n: 'Version 12', by: 'Rahul Shah', when: '2 Oct, 16:05' }
    ]
  };
  glideOn() {
    this.setState({ glide: true });
    clearTimeout(this.glideT);
    this.glideT = setTimeout(() => this.setState({ glide: false }), 420);
  }
  seq = 1; timers = []; lastNode = null;

  autoFit = () => {
    const c = this.canvas();
    if (!c) return;
    if (!this.ro && window.ResizeObserver) { this.ro = new ResizeObserver(this.autoFit); this.ro.observe(c); }
    if (this.touched || c.offsetWidth < 420 || c.offsetHeight < 150) return;
    this.fitted = true;
    this.fitView(.55);
  };
  componentDidMount() {
    if (!FB_C.builder) return;
    let storedTile = false;
    try { storedTile = localStorage.getItem('fb-step-style') === 'tile'; } catch (e) {}
    if (storedTile) { setTile(true); this.setState({ tile: true }); }
    if (!FB_C.edit) {
      const lock = () => {
        document.querySelectorAll('#b-name, .b-cfg input, .b-cfg select, .b-cfg textarea').forEach((el) => { el.disabled = true; });
        document.querySelectorAll('.b-cfg button:not([role="tab"]):not([aria-label="Close panel"]):not([aria-label="Open full step view"]):not([aria-label^="Copy"]):not([aria-pressed])').forEach((el) => { el.disabled = true; if (el.getAttribute('role') !== 'switch') el.style.display = 'none'; });
      };
      lock();
      this.roWatch = new MutationObserver(lock);
      this.roWatch.observe(document.body, { childList: true, subtree: true });
    }
    [60, 300, 800, 1500, 2600].forEach((ms) => this.t(this.autoFit, ms));
    window.addEventListener('resize', this.autoFit);
    if (this.props.debugRun) this.t(() => this.enterDebug(this.props.debugRun), 120);
    else if (this.props.template) this.t(() => this.loadTemplate(this.props.template), 120);
  }
  enterDebug(id) {
    this.timers.forEach(clearTimeout); this.timers = [];
    this.clock = 38100;
    this.via = { validate: 'e1', save: 'e2', mail: 'e3', notify: 'e4', flag: 'e5' };
    const nodes = seedNodes().map((n) => (n.id === 'notify' ? { ...n, ok: true, msg: '', showErr: false, preset: { channel: '#sales-leads' } } : n));
    this.setState({
      debug: id, debugFixed: false, importNote: '', nodes, edges: seedEdges(), sel: 'mail', selEdge: null, bot: true, botTab: 'run', attempt: null,
      exec: { hook: 'ok', validate: 'ok', save: 'ok', mail: 'err', notify: 'skip', flag: 'skip' },
      edgeExec: { e1: 'ok', e2: 'ok', e3: 'err', e4: 'skip', e5: 'skip' },
      run: { status: 'failed', failed: 'mail' },
      steps: [
        { id: 'hook', title: 'Webhook trigger', s: 'ok', ms: '12 ms' }, { id: 'validate', title: 'Validate customer', s: 'ok', ms: '4 ms' },
        { id: 'save', title: 'Save to database', s: 'ok', ms: '86 ms' }, { id: 'mail', title: 'Send welcome email', s: 'err', ms: '38.1 s' }
      ],
      logs: [
        { c: '', t: '10:42:18', m: 'Loaded data from ' + id + ', Version 14.' },
        { c: 'o1', t: '10:42:18', m: 'Steps 1 to 3 use the saved results and will not run again.' },
        { c: 'e1', t: '10:42:56', m: 'Send welcome email failed: Gmail 429 rateLimitExceeded.' }
      ]
    });
    this.touched = false;
    this.t(this.autoFit, 200);
  }
  loadTemplate(t) {
    this.timers.forEach(clearTimeout); this.timers = [];
    const MAP = { Webhook: 'webhook', Schedule: 'schedule', Validate: 'condition', Condition: 'condition', Filter: 'filter', Save: 'database', Email: 'email', Notify: 'notify', Delay: 'delay' };
    const nodes = t.steps.map((label, i) => {
      const kind = MAP[label] || 'http', k = KIND[kind];
      return { id: 'tp' + i, kind, title: k.title, desc: k.desc, x: 40 + i * 300, y: 140, ok: !!k.ok, blank: true, msg: k.ok ? '' : (SETUP_MSG[kind] || 'Finish setting up this step.') };
    });
    const edges = nodes.slice(1).map((n, i) => ({ id: 'te' + i, from: nodes[i].id, fp: outsOf(nodes[i])[0].p, to: n.id }));
    const need = nodes.filter((n) => !n.ok).length;
    this.setState({
      name: t.name, nodes, edges, sel: null, selEdge: null, past: [], future: [], live: false, ahead: true, dirty: false, version: 0, liveName: '', versions: [],
      bot: true, botTab: 'prob', exec: {}, edgeExec: {}, run: null, steps: [], logs: [], debug: null,
      importNote: 'Imported from Templates. ' + need + (need === 1 ? ' step needs' : ' steps need') + ' setup before you can test or publish.'
    });
    this.touched = false;
    this.t(this.autoFit, 200);
  }
  componentWillUnmount() { this.timers.forEach(clearTimeout); clearTimeout(this.toastTimer); clearTimeout(this.glideT); window.removeEventListener('resize', this.autoFit); if (this.ro) this.ro.disconnect(); }
  t(fn, ms) { const h = setTimeout(fn, ms); this.timers.push(h); return h; }
  canvas() { return (this.rootEl || document).querySelector('.canvas'); }
  node(id) { return this.state.nodes.find((n) => n.id === id); }

  say(text, extra) {
    clearTimeout(this.toastTimer);
    this.setState({ toast: { text, ...(extra || {}) } });
    this.toastTimer = setTimeout(() => this.setState({ toast: null }), 4500);
  }
  commit(patch) {
    const { nodes, edges, past } = this.state;
    this.setState({ ...patch, past: past.concat({ nodes, edges }).slice(-60), future: [], dirty: true });
  }
  undo() {
    const { past, future, nodes, edges } = this.state;
    if (!past.length) return;
    const prev = past[past.length - 1];
    this.setState({ ...prev, past: past.slice(0, -1), future: future.concat({ nodes, edges }), dirty: true, toast: null, sel: prev.nodes.some((n) => n.id === this.state.sel) ? this.state.sel : null, selEdge: null });
  }
  redo() {
    const { past, future, nodes, edges } = this.state;
    if (!future.length) return;
    const next = future[future.length - 1];
    this.setState({ ...next, future: future.slice(0, -1), past: past.concat({ nodes, edges }), dirty: true, sel: next.nodes.some((n) => n.id === this.state.sel) ? this.state.sel : null, selEdge: null });
  }

  toWorld(cx, cy) {
    const c = this.canvas(), r = c.getBoundingClientRect(), s = r.width / c.offsetWidth || 1;
    return { x: ((cx - r.left) / s - this.state.px) / this.state.zoom, y: ((cy - r.top) / s - this.state.py) / this.state.zoom };
  }
  inCanvas(cx, cy) {
    const r = this.canvas().getBoundingClientRect();
    return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
  }
  scale() { const c = this.canvas(); return c.getBoundingClientRect().width / c.offsetWidth || 1; }
  fitView(floor) {
    const c = this.canvas(), ns = this.state.nodes;
    if (!c || !ns.length) return;
    const minX = Math.min(...ns.map((n) => n.x)), maxX = Math.max(...ns.map((n) => n.x + W + 56));
    const minY = Math.min(...ns.map((n) => n.y)), maxY = Math.max(...ns.map((n) => n.y + H));
    const cw = c.offsetWidth, ch = c.offsetHeight;
    const zoom = Math.max(MIN_Z, Math.min(1, (cw - 100) / (maxX - minX), (ch - 60) / (maxY - minY)));
    if (floor && zoom < floor) { this.setState({ zoom: floor, px: Math.round(24 - minX * floor), py: Math.round((ch - (maxY - minY) * floor) / 2 - minY * floor) }); return; }
    this.setState({ zoom, px: Math.round((cw - (maxX - minX) * zoom) / 2 - minX * zoom), py: Math.round((ch - (maxY - minY) * zoom) / 2 - minY * zoom) });
  }
  zoomTo(z, ox, oy) {
    this.touched = true;
    const c = this.canvas(), { zoom, px, py } = this.state;
    const nz = Math.max(MIN_Z, Math.min(MAX_Z, z));
    const cx = ox ?? c.offsetWidth / 2, cy = oy ?? c.offsetHeight / 2;
    this.setState({ zoom: nz, px: Math.round(cx - (cx - px) * nz / zoom), py: Math.round(cy - (cy - py) * nz / zoom) });
  }
  select(id) {
    this.touched = true;
    const n = this.node(id), c = this.canvas();
    const patch = { sel: id, selEdge: null };
    if (n && c) {
      const opening = !this.state.sel, vw = c.offsetWidth - (opening ? 372 : 0), { zoom, px, py } = this.state;
      const right = (n.x + W) * zoom + px, left = n.x * zoom + px;
      if (right > vw - 36) patch.px = Math.round(px - (right - (vw - 36)));
      else if (left < 36) patch.px = Math.round(px + (36 - left));
      if (py + n.y * zoom < 50) patch.py = Math.round(50 - n.y * zoom);
      if (patch.px !== undefined || patch.py !== undefined) this.glideOn();
    }
    this.setState(patch);
  }

  tidy() {
    const { nodes, edges } = this.state;
    if (!nodes.length) return;
    this.commit({ nodes: this.arrange(nodes, edges) });
    this.touched = false;
    this.t(() => { this.glideOn(); this.fitView(.55); this.touched = true; }, 30);
    this.say('Workflow tidied. Undo puts it back.', { undo: true });
  }
  arrange(nodes, edges) {
    const level = {};
    nodes.forEach((n) => { level[n.id] = 0; });
    for (let pass = 0; pass < nodes.length; pass++) edges.forEach((e) => { if (level[e.from] !== undefined && level[e.to] !== undefined && level[e.to] < level[e.from] + 1) level[e.to] = level[e.from] + 1; });
    const unlinked = (n) => !edges.some((e) => e.from === n.id || e.to === n.id);
    const cols = {};
    nodes.forEach((n) => { const l = unlinked(n) ? -1 : level[n.id]; (cols[l] = cols[l] || []).push(n); });
    const rank = (n) => { const e = edges.find((x) => x.to === n.id); return !e ? 0 : e.fp === 't' ? 0 : e.fp === 'f' ? 2 : 1; };
    const pos = {};
    Object.keys(cols).forEach((l) => {
      const list = cols[l].slice().sort((a, b) => rank(a) - rank(b));
      list.forEach((n, i) => { pos[n.id] = Number(l) < 0 ? { x: 40 + i * 300, y: 420 } : { x: 40 + Number(l) * 300, y: 160 + (i - (list.length - 1) / 2) * 170 }; });
    });
    return nodes.map((n) => ({ ...n, ...pos[n.id] }));
  }
  addNode(item, x, y, afterSel) {
    const { nodes, edges, sel } = this.state, k = KIND[item.kind];
    if (k.g === 'trigger' && nodes.some(isTrigger)) { this.say('A workflow can only have one trigger. Remove the existing one first.'); return; }
    const id = 'n' + this.seq++;
    const prev = afterSel && sel ? this.node(sel) : null;
    this.touched = true;
    let px = prev ? prev.x + 300 : x, py = prev ? prev.y : y;
    if (afterSel) { for (let i = 0; i < 30 && nodes.some((n) => Math.abs(n.x - px) < W + 24 && Math.abs(n.y - py) < H + 24); i++) { if (prev) py += H + 44; else py += H + 44; } }
    const node = { id, kind: item.kind, app: item.mono || k.app || '', foot0: item.mono ? item.title + ' connected' : '', preset: item.preset, title: item.appTitle || k.title, desc: item.appTitle ? item.desc : k.desc, x: Math.round(px / 10) * 10, y: Math.round(py / 10) * 10, ok: !!k.ok, blank: true, msg: k.ok ? '' : (SETUP_MSG[item.kind] || 'Finish setting up this step.') };
    let nextEdges = edges;
    if (prev && !isTrigger(node)) {
      const port = outsOf(prev)[0].p;
      nextEdges = edges.concat({ id: 'e' + id, from: prev.id, fp: port, to: id });
    }
    const ins = this.state.insertEdge && edges.find((e) => e.id === this.state.insertEdge);
    if (ins && !isTrigger(node)) {
      nextEdges = edges.filter((e) => e.id !== ins.id).concat(
        { id: 'e' + id + 'a', from: ins.from, fp: ins.fp, to: id },
        { id: 'e' + id + 'b', from: id, fp: outsOf(node)[0].p, to: ins.to }
      );
      this.commit({ nodes: this.arrange(nodes.concat(node), nextEdges), edges: nextEdges, sel: null, selEdge: null, fresh: id, insertEdge: null });
      this.glideOn();
      this.t(() => this.select(id), 40);
      return;
    }
    this.commit({ nodes: nodes.concat(node), edges: nextEdges, sel: id, selEdge: null, fresh: id, insertEdge: null });
    this.t(() => this.select(id), 40);
  }
  connect(fromId, fp, toId) {
    const { edges } = this.state, to = this.node(toId);
    if (fromId === toId) return;
    if (isTrigger(to)) { this.say('A trigger starts the workflow, so nothing can connect into it.'); return; }
    if (edges.some((e) => e.from === fromId && e.fp === fp && e.to === toId)) return;
    const reach = (a, b) => a === b || edges.some((e) => e.from === a && reach(e.to, b));
    if (reach(toId, fromId)) { this.say('That connection would create a loop, so it was not added.'); return; }
    this.commit({ edges: edges.concat({ id: 'e' + this.seq++, from: fromId, fp, to: toId }) });
  }
  duplicate(id) {
    const n = this.node(id);
    if (isTrigger(n)) { this.say('A workflow can only have one trigger.'); return; }
    const nid = 'n' + this.seq++;
    this.commit({ nodes: this.state.nodes.concat({ ...n, id: nid, title: n.title + ' copy', x: n.x + 30, y: n.y + 120, showErr: false }), sel: nid, selEdge: null });
  }
  remove(id) {
    const { nodes, edges, sel } = this.state, n = this.node(id);
    this.commit({ nodes: nodes.filter((x) => x.id !== id), edges: edges.filter((e) => e.from !== id && e.to !== id), sel: sel === id ? null : sel, modal: null });
    this.say(n.title + ' deleted.', { undo: true });
  }
  issuesOf() {
    const { nodes, edges } = this.state, out = [];
    if (nodes.length && !nodes.some(isTrigger)) out.push({ id: nodes[0].id, title: 'Workflow', msg: 'Add a trigger so this workflow can start.' });
    nodes.forEach((n) => {
      if (!n.ok) out.push({ id: n.id, title: n.title, msg: n.msg || 'Finish setting up this step.' });
      if (!isTrigger(n) && !edges.some((e) => e.to === n.id)) out.push({ id: n.id, title: n.title, msg: 'Not connected. Drag a line into its left port.' });
    });
    return out;
  }
  blockIfIssues(verb) {
    const list = this.issuesOf();
    if (!this.state.nodes.length) { this.say('Add a trigger to get started.'); return true; }
    if (!list.length) return false;
    this.setState({ bot: true, botTab: 'prob' });
    this.select(list[0].id);
    this.say('Fix ' + list.length + (list.length === 1 ? ' problem' : ' problems') + ' before you can ' + verb + '.');
    return true;
  }

  /* simulated run, walks the real graph */
  startRun(scn, fromId) {
    this.timers.forEach(clearTimeout); this.timers = [];
    const trig = this.state.nodes.find(isTrigger);
    this.clock = fromId ? this.clock : 0;
    this.via = fromId ? this.via : {};
    this.setState({
      bot: true, botTab: 'run', attempt: null,
      run: { status: 'running' },
      exec: fromId ? this.state.exec : {}, edgeExec: fromId ? this.state.edgeExec : {},
      steps: fromId ? this.state.steps.filter((s) => s.id !== fromId) : [],
      logs: fromId ? this.state.logs.concat({ c: 'w1', t: fmt(this.clock), m: 'Retrying from failed step. Earlier steps are not run again.' }) : [{ c: '', t: fmt(0), m: 'Test run started with sample data.' }]
    });
    this.t(() => this.stepRun([fromId || trig.id], scn), 120);
  }
  stepRun(queue, scn) {
    if (!queue.length) { this.finish(); return; }
    const id = queue[0], rest = queue.slice(1), n = this.node(id);
    if (!n) { this.stepRun(rest, scn); return; }
    const edgeId = this.via[id];
    this.setState({ exec: { ...this.state.exec, [id]: 'running' }, edgeExec: edgeId ? { ...this.state.edgeExec, [edgeId]: 'flow' } : this.state.edgeExec });
    this.t(() => {
      if (scn === 'fail' && n.kind === 'email') this.attempt(n, 1, rest, edgeId);
      else this.pass(n, rest, scn, edgeId);
    }, 620);
  }
  attempt(n, i, rest, edgeId) {
    const waits = [5000, 10000, 20000];
    const log = { c: 'w1', t: fmt(this.clock += 300), m: 'Gmail returned 429 rateLimitExceeded. Retry ' + i + ' of 3 in ' + waits[i - 1] / 1000 + ' s.' };
    this.clock += waits[i - 1];
    this.setState({ attempt: { id: n.id, n: i }, logs: this.state.logs.concat(log) });
    this.t(() => {
      if (i < 3) { this.attempt(n, i + 1, rest, edgeId); return; }
      const edgeExec = { ...this.state.edgeExec }, exec = { ...this.state.exec, [n.id]: 'err' };
      if (edgeId) edgeExec[edgeId] = 'err';
      this.markSkip(n.id, exec, edgeExec);
      this.setState({
        exec, edgeExec, attempt: null,
        steps: this.state.steps.concat({ id: n.id, title: n.title, s: 'err', ms: dur(this.clock - (this.startedAt || 0)) }),
        logs: this.state.logs.concat({ c: 'e1', t: fmt(this.clock += 300), m: n.title + ' failed after 3 retries. Later steps skipped.' }),
        run: { status: 'failed', failed: n.id }
      });
      this.say(n.title + ' failed. Nothing after it ran.', { inspect: true });
    }, 520);
  }
  markSkip(id, exec, edgeExec) {
    this.state.edges.filter((e) => e.from === id).forEach((e) => {
      edgeExec[e.id] = 'skip';
      if (!exec[e.to]) { exec[e.to] = 'skip'; this.markSkip(e.to, exec, edgeExec); }
    });
  }
  pass(n, rest, scn, edgeId) {
    const k = KIND[n.kind], ms = k.ms || 12;
    this.clock += ms;
    const exec = { ...this.state.exec, [n.id]: 'ok' }, edgeExec = { ...this.state.edgeExec };
    if (edgeId) edgeExec[edgeId] = 'ok';
    const outs = this.state.edges.filter((e) => e.from === n.id);
    const chosen = k.two ? outs.filter((e) => e.fp === (scn === 'invalid' ? 'f' : 't')) : outs;
    outs.filter((e) => !chosen.includes(e)).forEach((e) => {
      edgeExec[e.id] = 'skip';
      if (!exec[e.to]) { exec[e.to] = 'skip'; this.markSkip(e.to, exec, edgeExec); }
    });
    chosen.forEach((e) => { this.via[e.to] = e.id; });
    const note = k.two ? ' Took the ' + (scn === 'invalid' ? 'Invalid' : 'Valid') + ' path.' : '';
    this.setState({
      exec, edgeExec,
      steps: this.state.steps.concat({ id: n.id, title: n.title, s: 'ok', ms: dur(ms) }),
      logs: this.state.logs.concat({ c: 'o1', t: fmt(this.clock), m: n.title + ' succeeded in ' + dur(ms) + '.' + note })
    });
    this.t(() => this.stepRun(rest.concat(chosen.map((e) => e.to)), scn), 160);
  }
  finish() {
    const n = this.state.steps.filter((s) => s.s === 'ok').length;
    this.setState({ run: { status: 'success' }, logs: this.state.logs.concat({ c: 'o1', t: fmt(this.clock), m: 'Run finished: ' + n + ' steps succeeded.' }) });
    if (this.state.debug) { this.say('The fix worked. Publish it, then retry ' + this.state.debug + ' from Execution Details.'); return; }
    this.say('Test passed: ' + n + ' steps in ' + (this.clock / 1000).toFixed(2) + ' s. Test runs are not counted in your stats.');
  }

  renderVals() {
    const s = this.state, { nodes, edges, zoom, px, py, sel, selEdge, exec, edgeExec, attempt } = s;
    const issues = this.issuesOf();
    const bad = new Set(issues.map((i) => i.id));
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const running = !!(s.run && s.run.status === 'running');
    const ahead = s.ahead || s.dirty;

    const nodeViews = nodes.map((n, idx) => {
      const k = KIND[n.kind], x = exec[n.id], isBad = bad.has(n.id) && !x;
      const att = attempt && attempt.id === n.id ? attempt.n : 0;
      const foot = att ? 'Retry ' + att + ' of 3' : x === 'running' ? 'Running' : x === 'ok' ? (s.debug && ['hook', 'validate', 'save'].includes(n.id) ? 'Using data from ' + s.debug : 'Succeeded') : x === 'err' ? 'Failed after 3 retries' : x === 'skip' ? 'Skipped' : isBad ? (n.ok ? 'Not connected' : 'Needs setup') : (k.g === 'trigger' && !s.live ? 'Not live, publish to start' : (n.foot0 || k.foot));
      const footDot = att ? 'warn' : x === 'ok' ? 'ok' : x === 'err' ? 'err' : isBad ? 'err' : x || (k.g === 'trigger' && !s.live) ? '' : 'ok';
      const badge = x === 'ok' ? 'ok' : x === 'err' ? 'err' : x === 'running' ? 'run' : isBad ? 'warn' : '';
      return {
        ...n, group: k.g, icon: k.ic, logo: n.app || k.app || '', noLogo: !(n.app || k.app), foot, footDot, badge,
        badgeIc: x === 'ok' ? 'check' : x === 'err' ? 'x' : x === 'running' ? 'loader' : 'alert',
        badgeSpin: x === 'running' ? 'spin' : '',
        selected: n.id === sel, hasIn: k.g !== 'trigger',
        inCls: s.target === n.id ? 'is-t' : '',
        delay: n.id === s.fresh ? 0 : idx * 80,
        showPlus: !k.two && !x && !edges.some((e) => e.from === n.id),
        addNext: (e) => {
          e.stopPropagation();
          this.select(n.id);
          const box = document.getElementById('pal-q');
          if (box) box.focus({ preventScroll: true });
          this.say('Choose the next step from the left. It connects to ' + n.title + ' automatically.');
        },
        open: () => { this.select(n.id); this.setState({ focusReq: this.state.focusReq + 1 }); },
        cls: [n.id === s.fresh ? 'is-new' : '', n.id === sel ? 'is-sel' : '', isBad ? 'is-bad' : '', x === 'running' ? 'running' : '', x === 'ok' ? 'x-ok' : '', x === 'err' ? 'x-err' : '', x === 'skip' ? 'x-skip' : ''].join(' '),
        aria: n.title + ', ' + n.desc + ', ' + foot,
        inY: IN_Y, trig: isTrigger(n) ? 'is-trig' : '',
        select: () => this.select(n.id),
        duplicate: () => this.duplicate(n.id),
        askDelete: () => this.setState({ modal: { kind: 'delete', id: n.id, title: 'Delete ' + n.title + '?', body: 'Its settings and connections will be removed from this draft. You can undo this until you leave the page.', action: 'Delete step' } }),
        down: (e) => {
          if (e.target.closest('.node-bar') || e.target.closest('button.port') || e.target.closest('.port-plus')) return;
          e.stopPropagation();
          e.currentTarget.closest('.canvas').focus({ preventScroll: true });
          this.setState({ drag: { type: 'node', id: n.id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y, moved: false } });
        },
        outs: outsOf(n).map((o) => ({
          ...o, aria: 'Drag to connect: ' + o.l,
          down: (e) => {
            e.stopPropagation(); e.preventDefault();
            this.setState({ drag: { type: 'link', id: n.id, fp: o.p, y: o.y }, draftPt: this.toWorld(e.clientX, e.clientY) });
          }
        }))
      };
    });

    const edgeViews = edges.filter((e) => byId[e.from] && byId[e.to]).map((e) => {
      const a = byId[e.from], b = byId[e.to];
      const y1 = a.y + outsOf(a).find((o) => o.p === e.fp).y, x1 = a.x + W, x2 = b.x, y2 = b.y + IN_Y;
      const st = edgeExec[e.id] || '';
      const branch = e.fp === 't' ? 'Valid' : e.fp === 'f' ? 'Invalid' : '';
      const showTools = !running && (e.id === selEdge || e.id === s.hoverEdge);
      return {
        showTools,
        hover: () => { clearTimeout(this.heT); if (this.state.hoverEdge !== e.id) this.setState({ hoverEdge: e.id }); },
        unhover: () => { clearTimeout(this.heT); this.heT = setTimeout(() => this.setState({ hoverEdge: null }), 350); },
        insert: () => {
          this.setState({ insertEdge: e.id, hoverEdge: null, selEdge: null, sel: null });
          const box = document.getElementById('pal-q');
          if (box) box.focus({ preventScroll: true });
        },
        id: e.id, d: curve(x1, y1, x2, y2, s.nodes), mx: Math.round((x1 + x2) / 2), my: x2 < x1 + 24 ? laneOf(x1, y1, x2, y2, s.nodes).ly : Math.round((y1 + y2) / 2),
        cls: (e.id === selEdge ? 'is-sel ' : '') + (e.to === s.fresh ? 'is-new ' : '') + st,
        flowing: st === 'flow',
        selected: e.id === selEdge,
        tag: showTools ? '' : branch || (st === 'ok' ? '1 item' : ''), tagCls: st === 'ok' ? 'ok' : '',
        select: () => this.setState({ selEdge: e.id, sel: null }),
        remove: () => this.commit({ edges: edges.filter((x) => x.id !== e.id), selEdge: null, hoverEdge: null })
      };
    });

    let draft = '';
    if (s.drag && s.drag.type === 'link' && s.draftPt) {
      const a = byId[s.drag.id];
      if (a) draft = curve(a.x + W, a.y + s.drag.y, s.draftPt.x, s.draftPt.y);
    }

    const q = s.palQ.trim().toLowerCase();
    const mkItem = (item) => {
      const k = KIND[item.kind];
      return {
        mono: item.mono || '', icon: item.mono ? '' : k.ic, group: k.g, title: item.title || k.title, desc: item.desc || k.desc,
        down: (e) => this.setState({ drag: { type: 'pal', item, sx: e.clientX, sy: e.clientY, moved: false } }),
        click: (e) => {
          if (e.detail !== 0) return;
          const c = this.canvas(), w = this.toWorld(c.getBoundingClientRect().left + 80, c.getBoundingClientRect().top + 80);
          this.addNode({ ...item, appTitle: item.mono ? item.title : '' }, w.x, w.y, true);
        }
      };
    };
    const groups = PALETTE.map((g) => ({ title: g.title, items: g.items.map((kind) => ({ kind })) })).concat({ title: 'Connected apps', items: APPS }, { title: 'More apps', items: MORE_APPS });
    const palette = groups.map((g) => ({
      title: g.title,
      items: g.items.map(mkItem).filter((i) => !q || (i.title + i.desc).toLowerCase().includes(q))
    })).filter((g) => g.items.length);

    const curNode = sel ? byId[sel] : null;
    if (curNode) this.lastNode = curNode;
    const shown = curNode || this.lastNode || nodes[0] || { id: 'none', kind: 'manual', title: 'Step' };
    const ancestors = [];
    const walk = (id) => edges.filter((e) => e.to === id).forEach((e) => { if (!ancestors.includes(e.from)) { ancestors.push(e.from); walk(e.from); } });
    walk(shown.id);
    const seen = {};
    const panelUp = ancestors.map((id) => byId[id]).filter(Boolean).sort((a, b) => a.x - b.x).map((n) => OUTPUTS[n.kind]).filter((o) => o && !seen[o.label] && (seen[o.label] = 1));

    const run = s.run;
    const runBadge = !run ? false : run.status === 'running' ? { cls: 'b-run', ic: 'loader', spin: 'spin', l: 'Testing' } : run.status === 'failed' ? { cls: 'b-err', ic: 'x', spin: '', l: 'Test failed' } : { cls: 'b-ok', ic: 'check', spin: '', l: 'Test passed' };
    const n = issues.length;
    return {
      tileCls: this.state.tile ? 'b-tile' : '', tilePressed: this.state.tile ? 'true' : 'false', tileLabel: this.state.tile ? 'Card view' : 'Tile view',
      toggleTile: () => {
        const on = !this.state.tile;
        setTile(on);
        try { localStorage.setItem('fb-step-style', on ? 'tile' : 'card'); } catch (e) {}
        this.setState({ tile: on }, () => { this.glideOn(); this.fitView(); });
      },
      roCls: FB_C.edit ? '' : 'b-ro', readOnly: !FB_C.edit,
      fbDenied: !FB_C.builder, fbOk: !(!FB_C.builder),
      name: s.name, onName: (e) => this.setState({ name: e.target.value, dirty: true }),
      liveCls: s.live ? 'b-ok' : 'b-off', liveDot: s.live ? 'ok' : '', liveLabel: s.live ? 'Published, ' + s.liveName : 'Not published',
      liveTitle: s.live ? s.liveName + ' receives production events' : 'The production webhook rejects events until you publish',
      saveNote: s.dirty ? 'Unsaved draft' + (s.live ? ': ' + s.liveName + ' stays live' : '') : (ahead && s.live ? 'Draft saved. Publish to make it live' : 'All changes saved'),
      ahead, pubLabel: s.live && !ahead ? 'Published' : 'Publish', pubDisabled: s.live && !ahead,
      pubTitle: s.live && !ahead ? 'Nothing new to publish. The live version matches this draft.' : (n ? 'Fix ' + n + (n === 1 ? ' problem' : ' problems') + ' to publish' : 'Choose a version name and go live'),
      openPublish: () => {
        if (this.blockIfIssues('publish')) return;
        this.setState({ pubOpen: true, pubName: 'Version ' + (s.version + 1), pubNote: '', pubErr: '', menuOpen: false });
      },
      closePublish: () => this.setState({ pubOpen: false }), pubOpen: s.pubOpen, pubName: s.pubName, pubNote: s.pubNote, pubErr: s.pubErr, pubBad: s.pubErr ? 'bad' : '',
      pubIntro: s.live ? 'This replaces ' + s.liveName + '. New events use the new version, and runs in progress finish on the old one.' : 'The production webhook will start accepting events as soon as you publish.',
      onPubName: (e) => this.setState({ pubName: e.target.value, pubErr: '' }), onPubNote: (e) => this.setState({ pubNote: e.target.value }),
      doPublish: () => {
        const name = s.pubName.trim();
        if (!name) { this.setState({ pubErr: 'Give this version a name.' }); return; }
        this.setState({ pubOpen: false, checklist: true, future: [], live: true, ahead: false, dirty: false, liveName: name, version: s.version + 1, versions: [{ n: name, by: FB_ME.n, when: 'Just now' }].concat(s.versions) });
      },
      menuOpen: s.menuOpen, toggleMenu: () => this.setState({ menuOpen: !s.menuOpen }),
      cannotUnpublish: !s.live, unpubOpacity: s.live ? 1 : 0.5,
      askUnpublish: () => this.setState({ menuOpen: false, modal: { kind: 'off', title: 'Unpublish ' + s.liveName + '?', body: 'The production webhook will reject new events until you publish again. Runs in progress will finish. Your draft is kept.', action: 'Unpublish' } }),
      versions: s.versions.map((v, i) => ({ n: v.n, sub: v.by + ', ' + v.when + (i === 0 && s.live ? ', live' : ''), dot: i === 0 && s.live ? 'ok' : '' })),
      noUndo: !s.past.length, noRedo: !s.future.length,
      undo: () => this.undo(), redo: () => this.redo(),
      issueCount: n, issueLabel: n + (n === 1 ? ' problem' : ' problems'), issues: issues.map((i) => ({ ...i, select: () => this.select(i.id) })), noIssues: n === 0,
      openProblems: () => this.setState({ bot: true, botTab: 'prob' }),
      save: () => {
        this.setState({ dirty: false, ahead: true });
        if (n) { this.say('Draft saved. Fix ' + n + (n === 1 ? ' problem' : ' problems') + ' before you can publish it.'); return; }
        this.say(s.live ? 'Draft saved. ' + s.liveName + ' stays live until you publish.' : 'Draft saved.');
      },
      running, idle: !running,
      test: () => { if (!this.blockIfIssues('test')) this.startRun(s.scenario); },
      stop: () => { this.timers.forEach(clearTimeout); this.timers = []; this.setState({ run: null, exec: {}, edgeExec: {}, attempt: null, steps: [], logs: [] }); this.say('Test stopped.'); },
      retry: () => this.startRun(s.debug && !s.debugFixed ? 'fail' : 'retry', run.failed),
      debug: s.debug, debugFixed: s.debugFixed,
      debugCls: s.debugFixed ? 'ok' : 'warn', debugIc: s.debugFixed ? 'check' : 'alert',
      debugText: !s.debug ? '' : s.debugFixed ? 'Debugging ' + s.debug + ': sending account changed. Click Retry from failed step to test the fix. No real email is sent.' : 'Debugging ' + s.debug + ' with its real data. Gmail refused hello@ at its daily limit. Try changing Send from to support@ in the panel.',
      exitDebug: () => { this.timers.forEach(clearTimeout); this.timers = []; this.setState({ debug: null, debugFixed: false, run: null, exec: {}, edgeExec: {}, attempt: null, steps: [], logs: [] }); },
      loadDebug: () => this.enterDebug('EX-48213'),
      onField: (id, k, val) => { if (this.state.debug && id === 'mail' && k === 'account') this.setState({ debugFixed: String(val).includes('support@') }); },
      importNote: s.importNote, dismissImport: () => this.setState({ importNote: '' }),
      needTrigger: nodes.length > 0 && !nodes.some(isTrigger),
      setupTitle: (() => { const ready = nodes.filter((x) => !bad.has(x.id)).length; return ready + ' of ' + nodes.length + ' steps ready'; })(),
      setupNext: n ? 'Fix these before you test or publish' : 'Ready to test and publish',
      setupPct: nodes.length ? Math.round(nodes.filter((x) => !bad.has(x.id)).length / nodes.length * 100) : 0,
      setupItems: nodes.map((x) => { const i = issues.find((y) => y.id === x.id && y.title === x.title); return { title: x.title, msg: i ? i.msg : 'Ready', cls: i ? 'err' : 'ok', ic: i ? 'alert' : 'check', action: i ? 'Fix' : 'Open', select: () => this.select(x.id) }; }),
      modal: s.modal, cancelModal: () => this.setState({ modal: null }),
      confirmModal: () => {
        if (s.modal.kind === 'delete') this.remove(s.modal.id);
        else { this.setState({ live: false, ahead: true, modal: null }); this.say('Unpublished. The production webhook now rejects new events.'); }
      },
      toast: s.toast,
      palette, palEmpty: palette.length === 0, palQ: s.palQ, onPalQ: (e) => this.setState({ palQ: e.target.value }),
      nodeViews, edgeViews, draft, px, py, zoom,
      glideCls: s.glide ? 'is-glide' : '', focusReq: s.focusReq, prodReq: s.prodReq || 0,
      palTitle: nodes.some(isTrigger) ? 'What happens next?' : 'What triggers this workflow?',
      gridSize: Math.max(8, Math.round(22 * zoom)),
      zoomPct: Math.round(zoom * 100) + '%',
      panCls: s.drag && s.drag.type === 'pan' ? 'is-pan' : '',
      isEmpty: nodes.length === 0,
      tidy: () => this.tidy(),
      openSettings: () => this.setState({ wfOpen: true, alertDraft: s.alertOn, menuOpen: false }),
      wfOpen: s.wfOpen, closeSettings: () => this.setState({ wfOpen: false }),
      alertOn: s.alertDraft, alertCls: s.alertDraft ? 'is-on' : '', alertAria: s.alertDraft ? 'true' : 'false',
      flipAlert: () => this.setState({ alertDraft: !s.alertDraft }), alertTo: s.alertTo, onAlertTo: (e) => this.setState({ alertTo: e.target.value }),
      saveSettings: () => { this.setState({ wfOpen: false, alertOn: s.alertDraft }); if (!s.checklist) this.say(s.alertDraft ? 'Failures will alert ' + s.alertTo + '.' : 'Workflow settings saved.'); },
      checklist: s.checklist, closeChecklist: () => this.setState({ checklist: false }),
      checklistTitle: s.liveName + ' is live',
      checkItems: [
        { t: 'Turn on failure alerts', d: s.alertOn ? 'On, sending to ' + s.alertTo : 'Hear about a failed run right away', cls: s.alertOn ? 'ok' : 'skip', ic: s.alertOn ? 'check' : 'bell', act: () => this.setState({ wfOpen: true, alertDraft: true }) },
        { t: 'Connect the sending app', d: s.urlSeen ? 'Production URL opened' : 'Paste the Production URL into it', cls: s.urlSeen ? 'ok' : 'skip', ic: s.urlSeen ? 'check' : 'link', act: () => { const tr = s.nodes.find(isTrigger); this.setState({ urlSeen: true, prodReq: (s.prodReq || 0) + 1 }); if (tr) { this.select(tr.id); this.t(() => { this.glideOn(); this.setState({ px: Math.round(336 - tr.x * this.state.zoom) }); }, 30); } } },
        { t: 'Watch your first live run', d: 'It appears in Executions, tagged Live', cls: 'skip', ic: 'runs', act: () => this.setState({ checklist: false }) }
      ],
      hint: s.insertEdge ? 'Choose a step on the left to insert it into this connection. Press Esc to cancel.' : s.drag && s.drag.type === 'link' ? 'Drop on a step to connect it' : s.drag && s.drag.type === 'pal' && s.drag.moved ? 'Drop on the canvas to add this step' : '',
      zoomIn: () => { this.glideOn(); this.zoomTo(zoom + 0.1); }, zoomOut: () => { this.glideOn(); this.zoomTo(zoom - 0.1); }, fit: () => { this.glideOn(); this.fitView(); },
      ghost: s.ghost,
      onBgDown: (e) => {
        if (e.target.closest('.canvas-tools') || e.target.closest('.e-tools') || e.target.closest('.node-bar') || e.target.closest('.port-plus') || e.target.closest('section.card')) return;
        e.currentTarget.focus({ preventScroll: true });
        this.touched = true;
        this.setState({ drag: { type: 'pan', sx: e.clientX, sy: e.clientY, ox: px, oy: py, moved: false } });
      },
      onWheel: (e) => {
        const c = e.currentTarget, r = c.getBoundingClientRect(), sc = r.width / c.offsetWidth || 1;
        this.zoomTo(zoom * (e.deltaY < 0 ? 1.08 : 0.926), (e.clientX - r.left) / sc, (e.clientY - r.top) / sc);
      },
      onKey: (e) => {
        if (e.target.tagName === 'INPUT') return;
        if (!FB_C.edit && e.key !== 'Escape') return;
        const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
        if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); return; }
        if (mod && k === 'y') { e.preventDefault(); this.redo(); return; }
        if (e.key === 'Escape') { this.setState({ sel: null, selEdge: null, drag: null, insertEdge: null }); return; }
        if (selEdge && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); this.commit({ edges: edges.filter((x) => x.id !== selEdge), selEdge: null }); return; }
        if (!sel) return;
        if (mod && k === 'd') { e.preventDefault(); this.duplicate(sel); return; }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          const cur = byId[sel];
          this.setState({ modal: { kind: 'delete', id: sel, title: 'Delete ' + cur.title + '?', body: 'Its settings and connections will be removed from this draft. You can undo this until you leave the page.', action: 'Delete step' } });
          return;
        }
        const d = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
        if (d) { e.preventDefault(); this.commit({ nodes: nodes.map((x) => (x.id === sel ? { ...x, x: x.x + d[0], y: x.y + d[1] } : x)) }); }
      },
      onMove: (e) => {
        this.rootEl = e.currentTarget;
        const d = s.drag;
        if (!d) return;
        if (!FB_C.edit && d.type !== 'pan' && e.buttons !== 0) return;
        if (e.buttons === 0) { this.setState({ drag: null, ghost: null, draftPt: null, target: null }); return; }
        if (d.type === 'pan') {
          const sc = this.scale();
          this.setState({ px: d.ox + (e.clientX - d.sx) / sc, py: d.oy + (e.clientY - d.sy) / sc, drag: { ...d, moved: d.moved || Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4 } });
        } else if (d.type === 'node') {
          const dist = Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy);
          if (!d.moved && dist < 4) return;
          const f = this.scale() * zoom;
          const nx = Math.round((d.ox + (e.clientX - d.sx) / f) / 10) * 10, ny = Math.round((d.oy + (e.clientY - d.sy) / f) / 10) * 10;
          const patch = { nodes: nodes.map((x) => (x.id === d.id ? { ...x, x: nx, y: ny } : x)), drag: { ...d, moved: true } };
          if (!d.moved) { patch.past = s.past.concat({ nodes, edges }).slice(-60); patch.future = []; patch.dirty = true; }
          this.setState(patch);
        } else if (d.type === 'link') {
          const pt = this.toWorld(e.clientX, e.clientY);
          const hit = nodes.find((x) => x.id !== d.id && !isTrigger(x) && pt.x > x.x - 24 && pt.x < x.x + W && pt.y > x.y - 10 && pt.y < x.y + H + 10);
          this.setState({ draftPt: pt, target: hit ? hit.id : null });
        } else if (d.type === 'pal') {
          const dist = Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy);
          if (!d.moved && dist < 5) return;
          const rr = e.currentTarget.getBoundingClientRect(), sc = rr.width / e.currentTarget.offsetWidth || 1, k = KIND[d.item.kind];
          this.setState({ drag: { ...d, moved: true }, ghost: { x: (e.clientX - rr.left) / sc, y: (e.clientY - rr.top) / sc, title: d.item.title || k.title, group: k.g, icon: k.ic, app: d.item.mono || k.app || '', noApp: !(d.item.mono || k.app) } });
        }
      },
      onUp: (e) => {
        this.rootEl = e.currentTarget;
        const d = s.drag;
        if (!d) return;
        const clear = { drag: null, ghost: null, draftPt: null, target: null };
        if (d.type === 'pan') { this.setState(d.moved ? clear : { ...clear, sel: null, selEdge: null, insertEdge: null }); return; }
        if (d.type === 'node') { this.setState(clear); if (!d.moved) this.select(d.id); return; }
        if (d.type === 'link') { const t = s.target; this.setState(clear); if (t) this.connect(d.id, d.fp, t); return; }
        if (d.type === 'pal') {
          this.setState(clear);
          const item = { ...d.item, appTitle: d.item.mono ? d.item.title : '' };
          if (!d.moved) { const c = this.canvas().getBoundingClientRect(), w = this.toWorld(c.left + 120, c.top + 120); this.addNode(item, w.x, w.y, true); return; }
          if (this.inCanvas(e.clientX, e.clientY)) { const w = this.toWorld(e.clientX, e.clientY); this.addNode(item, w.x - W / 2, w.y - H / 2, false); }
        }
      },
      tabRun: s.botTab === 'run' ? 'is-on' : '', tabProb: s.botTab === 'prob' ? 'is-on' : '',
      showRun: () => this.setState({ bot: true, botTab: 'run' }), showProb: () => this.setState({ bot: true, botTab: 'prob' }),
      isRunTab: s.botTab === 'run', isProbTab: s.botTab === 'prob',
      botOpen: s.bot, botIc: s.bot ? 'down' : 'runs', botLabel: s.bot ? 'Collapse panel' : 'Expand panel',
      toggleBot: () => this.setState({ bot: !s.bot }),
      scenario: s.scenario, onScenario: (e) => this.setState({ scenario: e.target.value }),
      runBadge, noRun: !run, hasRun: !!run,
      stepViews: s.steps.map((st) => ({
        ...st, cls: st.s === 'ok' ? 'ok' : 'err', ic: st.s === 'ok' ? 'check' : 'x', spin: '',
        select: () => this.select(st.id)
      })),
      failedStep: !!(run && run.status === 'failed'),
      logs: s.logs,
      cfgDisplay: curNode ? 'flex' : 'none',
      panelNode: { ...shown, exec: exec[shown.id] || '', published: s.live, liveName: s.liveName }, panelUp,
      onValidity: (id, ok, msg) => {
        const cur = this.node(id);
        if (cur && (cur.ok !== ok || cur.msg !== msg)) this.setState({ nodes: this.state.nodes.map((x) => (x.id === id ? { ...x, ok, msg } : x)), dirty: true });
      },
      onTitle: (id, title) => this.setState({ nodes: this.state.nodes.map((x) => (x.id === id ? { ...x, title } : x)), dirty: true }),
      closePanel: () => this.setState({ sel: null }),
      onPanelSaved: () => this.say('Step settings saved to the draft.')
    };
  }
}

return Component;
});
FB.def("ClosingFlow",[{"t":"div","a":{"class":"cf","id":"cf-root"},"c":[{"t":"div","a":{},"c":[{"t":"h2","a":{"class":"cf-h"},"c":["What do you want to stop doing ",{"t":"span","a":{"class":"h-g"},"c":["by hand?"]}]},{"t":"div","a":{"class":"cf-list","role":"group","aria-label":"Choose a task to automate"},"c":[{"t":"sc-for","a":{"list":"{{options}}","as":"o","hint-placeholder-count":"4"},"c":[{"t":"button","a":{"class":"cf-o {{o.cls}}","aria-pressed":"{{o.on}}","onClick":"{{o.pick}}"},"c":[{"t":"span","a":{"class":"cf-mk"},"c":[]},"{{o.l}}"]}]}]}]},{"t":"div","a":{"class":"cf-p"},"c":[{"t":"div","a":{"class":"cf-top"},"c":[{"t":"span","a":{},"c":["{{name}}"]},{"t":"span","a":{},"c":["Example run"]}]},{"t":"div","a":{"class":"cf-steps"},"c":[{"t":"sc-for","a":{"list":"{{steps}}","as":"s","hint-placeholder-count":"3"},"c":[{"t":"div","a":{"class":"cf-s {{s.cls}}"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"{{s.app}}","s":"42","hint-size":"42px,42px"},"c":[]},{"t":"div","a":{"class":"cf-t"},"c":[{"t":"b","a":{},"c":["{{s.t}}"]},{"t":"span","a":{},"c":["{{s.d}}"]}]},{"t":"span","a":{"class":"cf-st"},"c":[{"t":"sc-if","a":{"value":"{{s.done}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"check","s":"13","hint-size":"13px,13px"},"c":[]}]}]}]}]}]},{"t":"div","a":{"class":"cf-end","aria-live":"polite"},"c":["{{endLine}}"]},{"t":"div","a":{"class":"cf-a"},"c":[{"t":"a","a":{"class":"cf-go","href":"/register"},"c":["Start with this workflow",{"t":"dc-import","a":{"name":"Icon","g":"arrow","s":"16","hint-size":"16px,16px"},"c":[]}]},{"t":"span","a":{"class":"cf-in"},"c":["Have an account? ",{"t":"a","a":{"href":"/sign-in"},"c":["Sign in"]}]}]}]}]}],{},function(DCLogic){

const TASKS = [
  { l: 'Copying orders into a spreadsheet', n: 'Orders to spreadsheet', end: 'The order is in the sheet and the team knows. Nobody copied anything.', s: [
    { app: 'shopify', t: 'Shopify', d: 'A new order comes in' },
    { app: 'sheets', t: 'Google Sheets', d: 'Adds the order as a new row' },
    { app: 'slack', t: 'Slack', d: 'Tells the team it is logged' }
  ] },
  { l: 'Chasing failed payments', n: 'Failed payment follow-up', end: 'The customer has a link to pay, and the account is flagged for sales.', s: [
    { app: 'stripe', t: 'Stripe', d: 'A payment fails' },
    { app: 'gmail', t: 'Gmail', d: 'Emails the customer a link to pay' },
    { app: 'hubspot', t: 'HubSpot', d: 'Flags the account for follow-up' }
  ] },
  { l: 'Sorting support tickets', n: 'Support ticket triage', end: 'Urgent tickets reach the right people straight away.', s: [
    { app: 'zendesk', t: 'Zendesk', d: 'A new ticket opens' },
    { app: 'slack', t: 'Slack', d: 'Posts urgent tickets to the on-call channel' },
    { app: 'jira', t: 'Jira', d: 'Creates an issue for engineering' }
  ] },
  { l: 'Passing new leads to sales', n: 'Lead sync', end: 'The lead is saved and sales can pick it up right away.', s: [
    { app: 'sheets', t: 'Google Sheets', d: 'A new lead is added' },
    { app: 'pg', t: 'PostgreSQL', d: 'Saves the lead to your database' },
    { app: 'slack', t: 'Slack', d: 'Alerts the sales channel' }
  ] }
];
const STEP_MS = 950, HOLD_MS = 3200;
const motionOff = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return true; } };
class Component extends DCLogic {
  state = { i: 0, step: 3 };
  visible = false;
  componentDidMount() {
    if (motionOff()) return;
    const el = document.getElementById('cf-root');
    if (window.IntersectionObserver && el) {
      this.io = new IntersectionObserver((es) => es.forEach((e) => {
        const was = this.visible;
        this.visible = e.isIntersecting;
        if (this.visible && !was) this.play();
        if (!this.visible) clearTimeout(this.timer);
      }));
      this.io.observe(el);
    }
  }
  componentWillUnmount() { clearTimeout(this.timer); if (this.io) this.io.disconnect(); }
  play() { clearTimeout(this.timer); this.setState({ step: 0 }); this.timer = setTimeout(() => this.tick(), STEP_MS); }
  tick() {
    if (!this.visible) return;
    if (document.hidden) { this.timer = setTimeout(() => this.tick(), HOLD_MS); return; }
    const next = this.state.step + 1;
    this.setState({ step: next });
    this.timer = setTimeout(() => (next >= 3 ? this.play() : this.tick()), next >= 3 ? HOLD_MS : STEP_MS);
  }
  renderVals() {
    const { i, step } = this.state, task = TASKS[i];
    return {
      options: TASKS.map((t, n) => ({
        l: t.l, cls: n === i ? 'is-on' : '', on: n === i ? 'true' : 'false',
        pick: () => { this.setState({ i: n }, () => { if (motionOff()) this.setState({ step: 3 }); else this.play(); }); }
      })),
      name: task.n,
      steps: task.s.map((x, n) => ({ ...x, done: n < step, cls: n < step ? 'is-done' : n === step ? 'is-on' : '' })),
      endLine: step >= 3 ? task.end : ''
    };
  }
}

return Component;
});
FB.def("ConfigPanel",[{"t":"section","a":{"class":"cfg {{focusCls}}","aria-label":"Step configuration","style":"height: {{panelH}}; box-shadow: {{focusShadow}}"},"c":[{"t":"div","a":{"class":"cfg-h"},"c":[{"t":"div","a":{"class":"row","style":"gap: 9px"},"c":[{"t":"sc-if","a":{"value":"{{logo}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"{{logo}}","s":"28","hint-size":"28px,28px"},"c":[]}]},{"t":"sc-if","a":{"value":"{{noLogo}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"span","a":{"class":"n-ic {{group}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{icon}}","s":"15","hint-size":"15px,15px"},"c":[]}]}]},{"t":"div","a":{"class":"grow"},"c":[{"t":"label","a":{"for":"{{uid}}-title","style":"position: absolute; width: 1px; height: 1px; overflow: hidden"},"c":["Step name"]},{"t":"input","a":{"id":"{{uid}}-title","class":"cfg-title","value":"{{title}}","onChange":"{{onTitle}}"},"c":[]}]},{"t":"sc-if","a":{"value":"{{showExpand}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"button","a":{"class":"btn btn-g btn-sm btn-ic","aria-label":"Open full step view","title":"Open full step view","onClick":"{{openFocus}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"fit","s":"14","hint-size":"14px,14px"},"c":[]}]}]},{"t":"sc-if","a":{"value":"{{showClose}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"button","a":{"class":"btn btn-g btn-sm btn-ic","aria-label":"Close panel","onClick":"{{close}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"x","s":"15","hint-size":"15px,15px"},"c":[]}]}]}]},{"t":"p","a":{"class":"small muted","style":"margin: 3px 0 8px 37px; text-wrap: pretty"},"c":["{{about}}"]},{"t":"sc-if","a":{"value":"{{showTabs}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"div","a":{"class":"tabs","style":"overflow-y: hidden","role":"tablist","aria-label":"Step details"},"c":[{"t":"sc-for","a":{"list":"{{tabs}}","as":"t","hint-placeholder-count":"3"},"c":[{"t":"button","a":{"class":"tab {{t.cls}}","role":"tab","aria-selected":"{{t.sel}}","onClick":"{{t.pick}}"},"c":["{{t.l}}"]}]}]}]},{"t":"sc-if","a":{"value":"{{isFocus}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"style":"height: 10px; border-bottom: 1px solid var(--line)"},"c":[]}]}]},{"t":"div","a":{"class":"cfg-main"},"c":[{"t":"sc-if","a":{"value":"{{isFocus}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"aside","a":{"class":"cfg-col l","aria-label":"Data from earlier steps"},"c":[{"t":"div","a":{"class":"cfg-col-h"},"c":["INPUT: drag a value into a field, or click to insert it"]},{"t":"sc-if","a":{"value":"{{noUpstream}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"p","a":{"class":"small muted"},"c":["A trigger starts the workflow, so it has no input."]}]},{"t":"sc-for","a":{"list":"{{focusGroups}}","as":"g"},"c":[{"t":"div","a":{"class":"strong","style":"font-size: 12px; margin-top: 4px"},"c":["{{g.title}}"]},{"t":"sc-for","a":{"list":"{{g.items}}","as":"i"},"c":[{"t":"button","a":{"class":"drag-i","draggable":"true","onDragStart":"{{i.start}}","onClick":"{{i.click}}"},"c":[{"t":"span","a":{"class":"mono","style":"color: var(--data)"},"c":["{{i.key}}"]},{"t":"span","a":{"class":"dim trunc"},"c":["{{i.sample}}"]}]}]}]}]}]},{"t":"div","a":{"class":"cfg-b"},"c":[{"t":"sc-if","a":{"value":"{{isConfig}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"sc-if","a":{"value":"{{listening}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"notice info","style":"padding: 9px 11px; font-size: 12px","role":"status"},"c":[{"t":"span","a":{"class":"row spin","style":"gap: 0"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"loader","s":"14","hint-size":"14px,14px"},"c":[]}]},{"t":"span","a":{"class":"grow"},"c":["Waiting for a test event. Send a request to the Test URL now."]},{"t":"button","a":{"class":"btn btn-sm","onClick":"{{useSample}}"},"c":["Use sample event"]}]}]},{"t":"sc-if","a":{"value":"{{banner}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"notice err","style":"padding: 8px 10px; font-size: 12px","role":"alert"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"alert","s":"14","hint-size":"14px,14px"},"c":[]},{"t":"span","a":{"class":"grow"},"c":["{{banner}}"]}]}]},{"t":"sc-for","a":{"list":"{{fields}}","as":"f","hint-placeholder-count":"4"},"c":[{"t":"div","a":{"class":"field"},"c":[{"t":"div","a":{"class":"label"},"c":[{"t":"label","a":{"for":"{{f.id}}"},"c":["{{f.l}}"]},{"t":"sc-if","a":{"value":"{{f.req}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"span","a":{"class":"req","aria-label":"required"},"c":["*"]}]},{"t":"sc-if","a":{"value":"{{f.vars}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"button","a":{"class":"data-btn","aria-expanded":"{{f.open}}","onClick":"{{f.togglePick}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"data","s":"13","hint-size":"13px,13px"},"c":[]},"Insert data"]}]},{"t":"sc-if","a":{"value":"{{f.isToggle}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"button","a":{"id":"{{f.id}}","class":"toggle {{f.onCls}}","style":"margin-left: auto","role":"switch","aria-checked":"{{f.checked}}","onClick":"{{f.flip}}","aria-label":"{{f.l}}"},"c":[]}]}]},{"t":"sc-if","a":{"value":"{{f.isCopy}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"row","style":"gap: 6px"},"c":[{"t":"input","a":{"id":"{{f.id}}","class":"input mono","readonly":"","value":"{{f.value}}"},"c":[]},{"t":"button","a":{"class":"btn btn-ic","aria-label":"Copy webhook URL","onClick":"{{f.copy}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{f.copyIc}}","s":"15","hint-size":"15px,15px"},"c":[]}]}]}]},{"t":"sc-if","a":{"value":"{{f.isUrls}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"col","style":"gap: 7px"},"c":[{"t":"div","a":{"class":"seg-ctl","role":"group","aria-label":"Webhook address type","style":"align-self: flex-start"},"c":[{"t":"sc-for","a":{"list":"{{f.urlTabs}}","as":"u"},"c":[{"t":"button","a":{"class":"{{u.cls}}","aria-pressed":"{{u.on}}","onClick":"{{u.pick}}"},"c":["{{u.l}}"]}]}]},{"t":"div","a":{"class":"row","style":"gap: 6px; align-items: flex-start"},"c":[{"t":"span","a":{"id":"{{f.id}}","class":"preview mono grow","style":"word-break: break-all; line-height: 1.5"},"c":["{{f.urlValue}}"]},{"t":"button","a":{"class":"btn btn-ic","aria-label":"Copy this address","onClick":"{{f.copyUrl}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{f.copyIc}}","s":"15","hint-size":"15px,15px"},"c":[]}]}]},{"t":"div","a":{"class":"row small","style":"gap: 6px; align-items: flex-start"},"c":[{"t":"span","a":{"class":"dot {{f.urlDot}}","style":"margin-top: 5px"},"c":[]},{"t":"span","a":{"class":"muted","style":"text-wrap: pretty"},"c":["{{f.urlHint}}"]}]}]}]},{"t":"sc-if","a":{"value":"{{f.isSelect}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"select","a":{"id":"{{f.id}}","class":"select {{f.bad}}","value":"{{f.value}}","onChange":"{{f.change}}","aria-invalid":"{{f.invalid}}"},"c":[{"t":"sc-for","a":{"list":"{{f.options}}","as":"o"},"c":[{"t":"option","a":{"value":"{{o.v}}"},"c":["{{o.l}}"]}]}]}]},{"t":"sc-if","a":{"value":"{{f.isText}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"input","a":{"id":"{{f.id}}","class":"input {{f.bad}} {{f.dropCls}}","spellCheck":"false","value":"{{f.value}}","placeholder":"{{f.ph}}","onChange":"{{f.change}}","onFocus":"{{f.noteFocus}}","onDragOver":"{{f.over}}","onDragLeave":"{{f.leave}}","onDrop":"{{f.drop}}","aria-invalid":"{{f.invalid}}"},"c":[]}]},{"t":"sc-if","a":{"value":"{{f.isArea}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"textarea","a":{"id":"{{f.id}}","class":"area {{f.bad}} {{f.dropCls}}","spellCheck":"false","rows":"4","placeholder":"{{f.ph}}","value":"{{f.value}}","onChange":"{{f.change}}","onFocus":"{{f.noteFocus}}","onDragOver":"{{f.over}}","onDragLeave":"{{f.leave}}","onDrop":"{{f.drop}}","aria-invalid":"{{f.invalid}}"},"c":[]}]},{"t":"sc-if","a":{"value":"{{f.isMap}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"col","style":"gap: 6px"},"c":[{"t":"div","a":{"class":"map-row small dim"},"c":[{"t":"span","a":{},"c":["Column"]},{"t":"span","a":{},"c":[]},{"t":"span","a":{},"c":["Value from earlier step"]}]},{"t":"sc-for","a":{"list":"{{f.rows}}","as":"m"},"c":[{"t":"div","a":{"class":"map-row"},"c":[{"t":"input","a":{"class":"input mono","aria-label":"Column name","value":"{{m.dest}}","onChange":"{{m.changeDest}}"},"c":[]},{"t":"span","a":{"class":"dim"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"left","s":"14","hint-size":"14px,14px"},"c":[]}]},{"t":"select","a":{"class":"select is-data","aria-label":"Value for {{m.dest}}","value":"{{m.src}}","onChange":"{{m.changeSrc}}"},"c":[{"t":"sc-for","a":{"list":"{{tokens}}","as":"o"},"c":[{"t":"option","a":{"value":"{{o.v}}"},"c":["{{o.l}}"]}]}]}]}]},{"t":"button","a":{"class":"btn btn-g btn-sm","style":"align-self: flex-start","onClick":"{{f.addRow}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"plus","s":"13","hint-size":"13px,13px"},"c":[]},"Add column"]}]}]},{"t":"sc-if","a":{"value":"{{f.isRules}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"col","style":"gap: 6px"},"c":[{"t":"sc-for","a":{"list":"{{f.rules}}","as":"r"},"c":[{"t":"div","a":{"class":"rule"},"c":[{"t":"div","a":{"class":"row between"},"c":[{"t":"span","a":{"class":"small strong"},"c":["Rule {{r.n}}"]},{"t":"button","a":{"class":"btn btn-g btn-sm btn-ic","aria-label":"Remove rule {{r.n}}","onClick":"{{r.remove}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"trash","s":"13","hint-size":"13px,13px"},"c":[]}]}]},{"t":"select","a":{"class":"select is-data {{r.badL}}","aria-label":"Value to check","value":"{{r.l}}","onChange":"{{r.changeL}}"},"c":[{"t":"sc-for","a":{"list":"{{tokens}}","as":"o"},"c":[{"t":"option","a":{"value":"{{o.v}}"},"c":["{{o.l}}"]}]}]},{"t":"select","a":{"class":"select","aria-label":"Comparison","value":"{{r.op}}","onChange":"{{r.changeOp}}"},"c":[{"t":"sc-for","a":{"list":"{{ops}}","as":"o"},"c":[{"t":"option","a":{"value":"{{o.v}}"},"c":["{{o.l}}"]}]}]},{"t":"sc-if","a":{"value":"{{r.needs}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"input","a":{"class":"input {{r.badR}}","aria-label":"Value to compare with","placeholder":"Value to compare with","value":"{{r.r}}","onChange":"{{r.changeR}}"},"c":[]}]}]}]},{"t":"button","a":{"class":"btn btn-g btn-sm","style":"align-self: flex-start","onClick":"{{f.addRule}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"plus","s":"13","hint-size":"13px,13px"},"c":[]},"Add rule"]}]}]},{"t":"sc-if","a":{"value":"{{f.open}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"picker"},"c":[{"t":"sc-if","a":{"value":"{{noUpstream}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"small muted","style":"padding: 8px"},"c":["Connect an earlier step to use its data here."]}]},{"t":"sc-for","a":{"list":"{{f.groups}}","as":"g"},"c":[{"t":"div","a":{"class":"picker-h"},"c":["{{g.title}}"]},{"t":"sc-for","a":{"list":"{{g.items}}","as":"i"},"c":[{"t":"button","a":{"class":"picker-i","onClick":"{{i.pick}}"},"c":[{"t":"span","a":{"class":"mono","style":"color: var(--data)"},"c":["{{i.key}}"]},{"t":"span","a":{"class":"dim trunc"},"c":["{{i.sample}}"]}]}]}]}]}]},{"t":"sc-if","a":{"value":"{{f.preview}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"preview"},"c":[{"t":"span","a":{"class":"strong"},"c":["Preview: "]},"{{f.preview}}"]}]},{"t":"sc-if","a":{"value":"{{f.err}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"err-msg","role":"alert"},"c":[{"t":"span","a":{"style":"margin-top: 2px"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"alert","s":"12","hint-size":"12px,12px"},"c":[]}]},{"t":"span","a":{},"c":["{{f.err}}"]}]}]},{"t":"sc-if","a":{"value":"{{f.h}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"hint"},"c":["{{f.h}}"]}]}]}]},{"t":"sc-if","a":{"value":"{{hasAdv}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"button","a":{"class":"btn btn-g btn-sm","style":"align-self: flex-start","aria-expanded":"{{advOpen}}","onClick":"{{toggleAdv}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{advIc}}","s":"13","hint-size":"13px,13px"},"c":[]},"{{advLabel}}"]}]}]},{"t":"sc-if","a":{"value":"{{isInput}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"sc-if","a":{"value":"{{inputJson}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"p","a":{"class":"small muted"},"c":["Sample data this step receives from earlier steps."]},{"t":"pre","a":{"class":"code","tabindex":"0"},"c":["{{inputJson}}"]}]},{"t":"sc-if","a":{"value":"{{noInput}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"empty","style":"padding: 32px 12px"},"c":[{"t":"div","a":{"class":"empty-ic"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"webhook","s":"20","hint-size":"20px,20px"},"c":[]}]},{"t":"div","a":{"class":"strong"},"c":["A trigger starts the workflow"]},{"t":"div","a":{"class":"small muted"},"c":["It has no input. Its output is the first data available to later steps."]}]}]}]},{"t":"sc-if","a":{"value":"{{isOutput}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"sc-if","a":{"value":"{{outErr}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"notice err","style":"align-items: flex-start; font-size: 12px"},"c":[{"t":"span","a":{"style":"margin-top: 1px"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"alert","s":"14","hint-size":"14px,14px"},"c":[]}]},{"t":"span","a":{"class":"grow"},"c":[{"t":"strong","a":{},"c":["Gmail refused this email."]}," The account reached its daily sending limit. All 3 retries failed."]}]}]},{"t":"sc-if","a":{"value":"{{outJson}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"row between small"},"c":[{"t":"span","a":{"class":"badge b-ok"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"check","s":"13","hint-size":"13px,13px"},"c":[]},"{{outLabel}}"]},{"t":"span","a":{"class":"dim num"},"c":["{{outMs}}"]}]},{"t":"pre","a":{"class":"code","tabindex":"0"},"c":["{{outJson}}"]}]},{"t":"sc-if","a":{"value":"{{outEmpty}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"empty","style":"padding: 32px 12px"},"c":[{"t":"div","a":{"class":"empty-ic"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"play","s":"20","hint-size":"20px,20px"},"c":[]}]},{"t":"div","a":{"class":"strong"},"c":["No output yet"]},{"t":"div","a":{"class":"small muted"},"c":["Test this step to see the data it produces."]}]}]}]}]},{"t":"sc-if","a":{"value":"{{isFocus}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"aside","a":{"class":"cfg-col","style":"border-left: 1px solid var(--line)","aria-label":"Step output"},"c":[{"t":"div","a":{"class":"cfg-col-h"},"c":["OUTPUT"]},{"t":"sc-if","a":{"value":"{{outErr}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"notice err","style":"font-size: 12px"},"c":[{"t":"strong","a":{},"c":["Gmail refused this email."]}," The account reached its daily sending limit."]}]},{"t":"sc-if","a":{"value":"{{outJson}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"row between small"},"c":[{"t":"span","a":{"class":"badge b-ok"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"check","s":"13","hint-size":"13px,13px"},"c":[]},"{{outLabel}}"]},{"t":"span","a":{"class":"dim num"},"c":["{{outMs}}"]}]},{"t":"pre","a":{"class":"code","tabindex":"0"},"c":["{{outJson}}"]}]},{"t":"sc-if","a":{"value":"{{outEmpty}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"p","a":{"class":"small muted"},"c":["Click Test step to see what this step produces."]}]}]}]}]},{"t":"div","a":{"class":"cfg-f"},"c":[{"t":"button","a":{"class":"btn","style":"flex: 1","onClick":"{{test}}","disabled":"{{testing}}"},"c":[{"t":"span","a":{"class":"row {{testSpin}}","style":"gap: 0"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{testIc}}","s":"14","hint-size":"14px,14px"},"c":[]}]},"{{testLabel}} "]},{"t":"button","a":{"class":"btn btn-p","style":"flex: 1","onClick":"{{save}}"},"c":[{"t":"sc-if","a":{"value":"{{saved}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"check","s":"14","hint-size":"14px,14px"},"c":[]}]},"{{saveLabel}} "]}]}]}],{"kind":"email"},function(DCLogic){

const META = {
  webhook: { t: 'Webhook trigger', g: 'trigger', ic: 'webhook', a: 'Starts this workflow when another app sends data to the address below.' },
  schedule: { t: 'Schedule', g: 'trigger', ic: 'clock', a: 'Starts this workflow automatically at the times you choose.' },
  manual: { t: 'Manual trigger', g: 'trigger', ic: 'cursor', a: 'Starts this workflow when someone on your team clicks Run.' },
  http: { t: 'HTTP request', g: 'action', ic: 'globe', a: 'Calls any web API, and passes its response to the next step.' },
  email: { t: 'Send email', g: 'action', ic: 'mail', a: 'Sends an email from a connected account.' },
  database: { t: 'Create database record', g: 'action', ic: 'table', a: 'Adds a row to a database, using data from earlier steps.' },
  update: { t: 'Update record', g: 'action', ic: 'edit', a: 'Changes an existing row that matches the value you choose.' },
  notify: { t: 'Send notification', g: 'action', ic: 'send', a: 'Posts a message to a team channel.' },
  condition: { t: 'Condition', g: 'logic', ic: 'split', a: 'Sends each item down one of two paths, depending on your rules.' },
  filter: { t: 'Filter', g: 'logic', ic: 'filter', a: 'Lets an item continue only when it matches your rules.' },
  branch: { t: 'Branch', g: 'logic', ic: 'branch', a: 'Splits the workflow into two paths based on your rules.' },
  app: { t: 'App step', g: 'action', ic: 'plug', a: 'Uses one of your apps as a step in this workflow.' },
  delay: { t: 'Delay', g: 'logic', ic: 'hourglass', a: 'Waits for a set time before running the next step.' }
};
const CAT = [
  { label: 'Webhook', title: 'Webhook trigger', fields: [['first_name', 'Ada'], ['last_name', 'Okafor'], ['email', 'ada.okafor@brightpath.example'], ['company', 'Brightpath Foods'], ['plan', 'Growth']] },
  { label: 'Validate', title: 'Validate customer', fields: [['is_valid', 'true']] },
  { label: 'Database', title: 'Save to database', fields: [['customer_id', 'cus_90417'], ['created_at', '2026-11-05T10:42:19Z']] }
];
const ADV = [
  { k: 'onFail', t: 'select', l: 'If this step fails', adv: true, opts: ['Retry 3 times, then stop the run', 'Stop the run immediately', 'Continue to the next step'], h: 'Retries wait 5, 10, then 20 seconds, so a short outage can recover on its own.' },
  { k: 'timeout', t: 'text', l: 'Timeout in seconds', adv: true }
];
const LOGIC = [
  { k: 'match', t: 'select', l: 'Passes when', opts: ['All rules are true', 'Any rule is true'] },
  { k: 'rules', t: 'rules', l: 'Rules' }
];
const MAP = { k: 'map', t: 'map', l: 'Field mapping', h: 'Choose which earlier value fills each column.' };
const KIND_APP = { email: 'gmail', database: 'pg', update: 'pg', notify: 'slack' };
const APP_ACTIONS = { mongo: ['Create a document', 'Update a document', 'Find documents'], mysql: ['Insert a row', 'Update a row', 'Run a query'], discord: ['Send a channel message'], telegram: ['Send a message', 'Send a file'], whatsapp: ['Send a template message', 'Send a text message'], twilio: ['Send a text message', 'Make a phone call'], mailchimp: ['Add a subscriber', 'Tag a subscriber'], gdrive: ['Upload a file', 'Share a file', 'Find a file'], dropbox: ['Upload a file', 'Find a file'], airtable: ['Create a record', 'Update a record'], gcal: ['Create an event', 'Update an event'], notion: ['Add a page', 'Update a database item'], trello: ['Add a card', 'Move a card'], asana: ['Create a task', 'Complete a task'], jira: ['Create an issue', 'Move an issue'], github: ['Open an issue', 'Comment on a pull request'], hubspot: ['Create or update a contact', 'Update a deal'], zendesk: ['Create a ticket', 'Update a ticket'], shopify: ['Update an order', 'Update a product'], stripe: ['Look up a payment', 'Look up an invoice'] };
const FORM = {
  app: [
    { k: 'conn', t: 'select', l: 'Account', req: true, ph: 'Choose an account', opts: [], h: 'You will sign in to this app the first time you use it.' },
    { k: 'action', t: 'select', l: 'Action', req: true, ph: 'Choose an action', opts: [] },
    { k: 'details', t: 'area', l: 'Details', vars: true, ph: 'What should this step send? Use Insert data to add values from earlier steps.' },
    ...ADV
  ],
  webhook: [
    { k: 'urls', t: 'urls', l: 'Webhook addresses' },
    { k: 'method', t: 'select', l: 'Accepted method', opts: ['POST', 'PUT', 'GET'] },
    { k: 'auth', t: 'select', l: 'Verify the sender', opts: ['Signature (HMAC-SHA256)', 'API key in header', 'No verification'], h: 'Requests that fail verification are rejected and logged.' },
    { k: 'respond', t: 'toggle', l: 'Reply immediately', h: 'Tells the sender the event was received, then runs in the background.' }
  ],
  schedule: [
    { k: 'freq', t: 'select', l: 'Repeat', opts: ['Every weekday', 'Every day', 'Every week', 'Every hour'] },
    { k: 'time', t: 'text', l: 'Time', req: true, ph: '09:00' },
    { k: 'tz', t: 'select', l: 'Time zone', opts: ['Asia/Kolkata', 'Europe/London', 'America/New_York', 'UTC'] }
  ],
  manual: [{ k: 'who', t: 'select', l: 'Who can run this', opts: ['Business Users and above', 'Workflow Creators and above', 'Administrators only'] }],
  http: [
    { k: 'method', t: 'select', l: 'Method', opts: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
    { k: 'url', t: 'text', l: 'URL', req: true, vars: true, ph: 'https://api.example.com/v1/contacts' },
    { k: 'cred', t: 'select', l: 'Authentication', opts: ['CRM API key (stored securely)', 'No authentication', 'Add a new credential'] },
    { k: 'body', t: 'area', l: 'Request body', vars: true, ph: 'JSON to send' },
    ...ADV
  ],
  email: [
    { k: 'account', t: 'select', l: 'Send from', req: true, ph: 'Choose an account', opts: ['Gmail: hello@meridianlogistics.example', 'Gmail: support@meridianlogistics.example'] },
    { k: 'to', t: 'text', l: 'To', req: true, vars: true, ph: 'name@company.com' },
    { k: 'subject', t: 'text', l: 'Subject', req: true, vars: true, ph: 'What is this email about?' },
    { k: 'body', t: 'area', l: 'Message', req: true, vars: true, ph: 'Write your message' },
    ...ADV
  ],
  database: [
    { k: 'conn', t: 'select', l: 'Database', opts: ['PostgreSQL: Meridian production', 'MongoDB: Marketing', 'Google Sheets: Finance'] },
    { k: 'table', t: 'select', l: 'Table', req: true, ph: 'Choose a table', opts: ['customers', 'leads', 'invoices'] },
    MAP,
    { k: 'exists', t: 'select', l: 'If the record already exists', opts: ['Update the existing record', 'Skip this step', 'Fail the step'], h: 'Prevents duplicates if this step runs again during a retry.' },
    ...ADV
  ],
  update: [
    { k: 'conn', t: 'select', l: 'Database', opts: ['PostgreSQL: Meridian production', 'MongoDB: Marketing'] },
    { k: 'table', t: 'select', l: 'Table', req: true, ph: 'Choose a table', opts: ['customers', 'leads', 'invoices'] },
    MAP,
    ...ADV
  ],
  notify: [
    { k: 'conn', t: 'select', l: 'Send with', opts: ['Slack: Meridian workspace', 'Discord: Ops server'] },
    { k: 'channel', t: 'select', l: 'Channel', req: true, ph: 'Choose a channel', opts: ['#sales-leads', '#ops-data-quality', '#customer-success'] },
    { k: 'msg', t: 'area', l: 'Message', req: true, vars: true, ph: 'Write the message' },
    ...ADV
  ],
  condition: LOGIC,
  filter: LOGIC,
  branch: LOGIC,
  delay: [
    { k: 'amount', t: 'text', l: 'Wait for', req: true, ph: '15' },
    { k: 'unit', t: 'select', l: 'Unit', opts: ['minutes', 'hours', 'days'] }
  ]
};
const FAIL = { onFail: 'Retry 3 times, then stop the run', timeout: '30' };
const DEFAULTS = {
  webhook: { testUrl: 'https://hooks.flowbridge.example/test/mrdn-4f2a/new-customer', prodUrl: 'https://hooks.flowbridge.example/live/mrdn-4f2a/new-customer', urlMode: 'test', method: 'POST', auth: 'Signature (HMAC-SHA256)', respond: true },
  schedule: { freq: 'Every weekday', time: '09:00', tz: 'Asia/Kolkata' },
  manual: { who: 'Business Users and above' },
  http: { method: 'POST', url: 'https://crm.meridianlogistics.example/v2/contacts', cred: 'CRM API key (stored securely)', body: '{\n  "email": "{Webhook.email}",\n  "company": "{Webhook.company}"\n}', ...FAIL },
  email: { account: 'Gmail: hello@meridianlogistics.example', to: '{Webhook.email}', subject: 'Welcome to Meridian, {Webhook.first_name}', body: 'Hi {Webhook.first_name},\n\nThanks for registering {Webhook.company}. Your account manager will be in touch within one working day.', ...FAIL },
  database: { conn: 'PostgreSQL: Meridian production', table: 'customers', map: [['email', '{Webhook.email}'], ['first_name', '{Webhook.first_name}'], ['company', '{Webhook.company}'], ['plan', '{Webhook.plan}']], exists: 'Update the existing record', ...FAIL },
  update: { conn: 'PostgreSQL: Meridian production', table: 'customers', map: [['plan', '{Webhook.plan}']], ...FAIL },
  notify: { conn: 'Slack: Meridian workspace', channel: '', msg: 'New customer: {Webhook.company}\nContact: {Webhook.first_name} {Webhook.last_name}, {Webhook.email}\nPlan: {Webhook.plan}', ...FAIL },
  condition: { match: 'All rules are true', rules: [{ l: '{Webhook.email}', op: 'is a valid email', r: '' }, { l: '{Webhook.company}', op: 'is not empty', r: '' }] },
  delay: { amount: '15', unit: 'minutes' }
};
DEFAULTS.filter = DEFAULTS.condition; DEFAULTS.branch = DEFAULTS.condition;
const BY_ID = { flag: { channel: '#ops-data-quality', msg: 'Rejected registration from {Webhook.email}: failed validation.' } };
const BLANK = {
  app: { conn: '', action: '', details: '' },
  http: { url: '', body: '' }, email: { to: '', subject: '', body: '', account: '' }, database: { table: '', map: [['email', '']] }, update: { table: '', map: [['email', '']] },
  notify: { channel: '', msg: '' }, condition: { rules: [{ l: '', op: 'is not empty', r: '' }] }, filter: { rules: [{ l: '', op: 'is not empty', r: '' }] }, branch: { rules: [{ l: '', op: 'is not empty', r: '' }] }
};
const OPS = ['is a valid email', 'is not empty', 'is empty', 'equals', 'does not equal', 'contains', 'is greater than'];
const NEEDS = { equals: 1, 'does not equal': 1, contains: 1, 'is greater than': 1 };
const OUT = {
  app: { label: 'Step finished', ms: '240 ms', json: { success: true, id: 'res_48213' } },
  webhook: { label: 'Event received', ms: '12 ms', json: { first_name: 'Ada', last_name: 'Okafor', email: 'ada.okafor@brightpath.example', company: 'Brightpath Foods', plan: 'Growth' } },
  http: { label: '201 Created', ms: '318 ms', json: { status: 201, body: { id: 'crm_55120', synced: true } } },
  email: { label: 'Email sent', ms: '640 ms', json: { message_id: '18f3a9c2e1b04d77', accepted: ['ada.okafor@brightpath.example'] } },
  database: { label: '1 row written', ms: '86 ms', json: { customer_id: 'cus_90417', created_at: '2026-11-05T10:42:19Z', action: 'inserted' } },
  update: { label: '1 row updated', ms: '74 ms', json: { rows_updated: 1 } },
  notify: { label: 'Message posted', ms: '210 ms', json: { channel: '#sales-leads', ts: '1793875339.0021' } },
  condition: { label: 'Path taken: Valid', ms: '4 ms', json: { is_valid: true, rules_passed: 2, rules_total: 2 } },
  schedule: { label: 'Fired on schedule', ms: '2 ms', json: { fired_at: '2026-11-05T09:00:00+05:30' } },
  manual: { label: 'Started by you', ms: '1 ms', json: { started_by: 'Priya Raman' } },
  delay: { label: 'Wait finished', ms: '15 min', json: { waited_minutes: 15 } }
};
OUT.filter = OUT.condition; OUT.branch = OUT.condition;
const clone = (o) => JSON.parse(JSON.stringify(o));
const join = (cur, tok) => { const s = cur || ''; return s && !/\s$/.test(s) ? s + ' ' + tok : s + tok; };
const TOKEN = /\{([A-Za-z]+\.[a-z_]+)\}/g;

class Component extends DCLogic {
  state = { tab: 'config', pick: '', adv: false, tick: 0, focus: false, dropK: '' };
  store = {}; touched = {}; tried = {}; saved = {}; testState = {};
  componentDidUpdate(prev) {
    if (this.keyOf(prev) !== this.keyOf(this.props)) this.setState({ tab: 'config', pick: '', adv: false });
    if (this.props.focusReq && prev.focusReq !== this.props.focusReq) this.setState({ focus: true });
  }
  componentWillUnmount() { clearTimeout(this.timer); }
  keyOf(p) { return p.node ? p.node.id : 'k-' + (p.kind ?? 'email'); }
  formOf(kind) {
    const list = FORM[kind] || [], n = this.props.node;
    if (kind !== 'app' || !n) return list;
    const name = n.title;
    return list.map((f) => (f.k === 'conn' ? { ...f, opts: ['New ' + name + ' account'] } : f.k === 'action' ? { ...f, opts: APP_ACTIONS[n.app] || ['Run this step'] } : f));
  }
  kindOf() { return this.props.node ? this.props.node.kind : (this.props.kind ?? 'email'); }
  bump() { this.setState({ tick: this.state.tick + 1 }); }
  vals(key, kind) {
    if (!this.store[key]) {
      const n = this.props.node;
      let v = clone(DEFAULTS[kind] || {});
      if (n && n.blank) v = { ...v, ...clone(BLANK[kind] || {}) };
      if (n && BY_ID[n.id]) v = { ...v, ...BY_ID[n.id] };
      if (n && n.preset) v = { ...v, ...n.preset };
      if (!n && this.props.demo) v[this.props.demo] = '';
      if (kind === 'notify' && !n) v.channel = '#sales-leads';
      this.store[key] = v;
    }
    return this.store[key];
  }
  errorsOf(kind, v) {
    const e = {};
    this.formOf(kind).forEach((f) => {
      const val = v[f.k];
      if (f.req && !String(val ?? '').trim()) e[f.k] = f.l + ' is required.';
    });
    if (kind === 'email' && v.to && !v.to.includes('{') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.to)) e.to = 'Enter an email address, or insert one from an earlier step.';
    if (kind === 'http' && v.url && !v.url.includes('{') && !/^https?:\/\//.test(v.url)) e.url = 'A URL must start with https:// or http://.';
    if (v.map && v.map.some((m) => !m[0] || !m[1])) e.map = 'Every column needs a name and a value.';
    if (v.rules) {
      if (!v.rules.length) e.rules = 'Add at least one rule.';
      else if (v.rules.some((r) => !r.l || (NEEDS[r.op] && !r.r))) e.rules = 'Complete every rule before saving.';
    }
    return e;
  }
  report(key, kind) {
    const n = this.props.node;
    if (!n || !this.props.onValidity) return;
    const errs = Object.values(this.errorsOf(kind, this.vals(key, kind)));
    this.props.onValidity(n.id, errs.length === 0, errs[0] || '');
  }
  change(key, kind, k, val) {
    this.vals(key, kind)[k] = val;
    this.touched[key + k] = true;
    this.saved[key] = false;
    this.report(key, kind);
    if (this.props.node && this.props.onField) this.props.onField(this.props.node.id, k, val);
    this.bump();
  }
  renderVals() {
    const key = this.keyOf(this.props), kind = this.kindOf(), meta = META[kind] || META.http;
    const v = this.vals(key, kind), node = this.props.node;
    if (this.props.prodReq && this.prodSeen !== this.props.prodReq) { this.prodSeen = this.props.prodReq; if (kind === 'webhook') v.urlMode = 'prod'; }
    const isTrigger = meta.g === 'trigger';
    const up = isTrigger ? [] : (this.props.upstream ?? CAT);
    const sample = {};
    up.forEach((g) => g.fields.forEach(([k, s]) => { sample[g.label + '.' + k] = s; }));
    const resolve = (s) => String(s).replace(TOKEN, (m, t) => (t in sample ? sample[t] : '[missing: ' + t + ']'));
    const tokens = [{ v: '', l: 'Choose a value' }].concat(Object.keys(sample).map((t) => ({ v: '{' + t + '}', l: t })));
    const errs = this.errorsOf(kind, v);
    const all = this.tried[key] || !!this.props.demo || (node && node.showErr);
    const showErr = (k) => (all || this.touched[key + k]) && errs[k] ? errs[k] : '';
    const list = this.formOf(kind).filter((f) => !f.adv || this.state.adv);
    const uid = 'c-' + key;
    const isLive = node ? node.published !== false : true, liveName = (node && node.liveName) || 'Version 14';
    const fields = list.map((f) => {
      const val = v[f.k], err = showErr(f.k), pickId = key + f.k, open = this.state.pick === pickId;
      const opts = f.opts ? (f.ph ? [{ v: '', l: f.ph }] : []).concat(f.opts.map((o) => ({ v: o, l: o }))) : [];
      const hasToken = typeof val === 'string' && /\{[A-Za-z]+\.[a-z_]+\}/.test(val);
      return {
        k: f.k, l: f.l, h: f.h || '', ph: f.ph || '', req: !!f.req, vars: !!f.vars, id: uid + '-' + f.k,
        isCopy: f.t === 'copy', isSelect: f.t === 'select', isText: f.t === 'text', isArea: f.t === 'area',
        isToggle: f.t === 'toggle', isMap: f.t === 'map', isRules: f.t === 'rules', isUrls: f.t === 'urls',
        urlTabs: f.t === 'urls' ? [['test', 'Test URL'], ['prod', 'Production URL']].map(([id, l]) => ({ l, cls: v.urlMode === id ? 'is-on' : '', on: v.urlMode === id ? 'true' : 'false', pick: () => { v.urlMode = id; this.copied = ''; this.bump(); } })) : [],
        urlValue: v.urlMode === 'prod' ? v.prodUrl : v.testUrl,
        urlDot: v.urlMode === 'test' ? (this.testState[key] === 'listening' ? 'warn' : '') : (isLive ? 'ok' : ''),
        urlHint: v.urlMode === 'test' ? (this.testState[key] === 'listening' ? 'Listening now. This address only works while you are listening.' : 'Only works while you click Listen for test event. Test runs are not counted in your stats.') : (isLive ? 'Live on ' + liveName + '. Paste this into the app that sends the data.' : 'Not live. Requests are rejected until you publish this workflow.'),
        copyUrl: () => { try { navigator.clipboard.writeText(v.urlMode === 'prod' ? v.prodUrl : v.testUrl); } catch (e) {} this.copied = key; this.bump(); },
        value: val ?? '', options: opts, err, bad: err ? 'bad' : '', invalid: err ? 'true' : 'false',
        open, preview: hasToken ? resolve(val) : '',
        change: (e) => this.change(key, kind, f.k, e.target.value),
        dropCls: this.state.dropK === f.k ? 'is-drop' : '',
        noteFocus: () => { this.lastField = f.k; },
        over: (e) => { e.preventDefault(); if (this.state.dropK !== f.k) this.setState({ dropK: f.k }); },
        leave: () => this.setState({ dropK: '' }),
        drop: (e) => { e.preventDefault(); const tok = this.dragTok; this.setState({ dropK: '' }); if (tok) this.change(key, kind, f.k, join(v[f.k], tok)); },
        togglePick: () => this.setState({ pick: open ? '' : pickId }),
        groups: open ? up.map((g) => ({
          title: g.title,
          items: g.fields.map(([fk, s]) => ({
            key: fk, sample: s,
            pick: () => { this.change(key, kind, f.k, join(v[f.k], '{' + g.label + '.' + fk + '}')); this.setState({ pick: '' }); }
          }))
        })) : [],
        copyIc: this.copied === key ? 'check' : 'copy',
        copy: () => { try { navigator.clipboard.writeText(val); } catch (e) {} this.copied = key; this.bump(); },
        flip: () => this.change(key, kind, f.k, !val),
        checked: val ? 'true' : 'false', onCls: val ? 'is-on' : '',
        rows: f.t === 'map' ? (val || []).map((m, i) => ({
          dest: m[0], src: m[1],
          changeDest: (e) => { v.map[i][0] = e.target.value; this.change(key, kind, 'map', v.map); },
          changeSrc: (e) => { v.map[i][1] = e.target.value; this.change(key, kind, 'map', v.map); }
        })) : [],
        addRow: () => { v.map.push(['', '']); this.change(key, kind, 'map', v.map); },
        rules: f.t === 'rules' ? (val || []).map((r, i) => ({
          n: i + 1, l: r.l, op: r.op, r: r.r, needs: !!NEEDS[r.op],
          badL: err && !r.l ? 'bad' : '', badR: err && !r.r ? 'bad' : '',
          changeL: (e) => { r.l = e.target.value; this.change(key, kind, 'rules', v.rules); },
          changeOp: (e) => { r.op = e.target.value; this.change(key, kind, 'rules', v.rules); },
          changeR: (e) => { r.r = e.target.value; this.change(key, kind, 'rules', v.rules); },
          remove: () => { v.rules.splice(i, 1); this.change(key, kind, 'rules', v.rules); }
        })) : [],
        addRule: () => { v.rules.push({ l: '', op: 'is not empty', r: '' }); this.change(key, kind, 'rules', v.rules); }
      };
    });
    const tab = this.state.tab;
    const ts = this.testState[key];
    const exec = node ? node.exec : '';
    const ran = ts === 'ok' || exec === 'ok';
    const out = OUT[kind];
    const input = {};
    up.forEach((g) => { input[g.label] = Object.fromEntries(g.fields); });
    const anyAdv = this.formOf(kind).some((f) => f.adv);
    const errCount = Object.keys(errs).length;
    const focus = this.state.focus;
    const firstVar = this.formOf(kind).find((f) => f.vars);
    return {
      isFocus: focus, focusCls: focus ? 'is-focus' : '',
      focusShadow: focus ? '0 0 0 100vmax rgba(38,31,24,.45)' : 'none',
      showExpand: !focus, showClose: !!(node && this.props.onClose) || focus, showTabs: !focus,
      openFocus: () => this.setState({ focus: true }),
      focusGroups: up.map((g) => ({
        title: g.title,
        items: g.fields.map(([fk, s]) => {
          const tok = '{' + g.label + '.' + fk + '}';
          return {
            key: fk, sample: s,
            start: (e) => { this.dragTok = tok; try { e.dataTransfer.setData('text/plain', tok); e.dataTransfer.effectAllowed = 'copy'; } catch (err) {} },
            click: () => { const k = this.lastField || (firstVar && firstVar.k); if (k) this.change(key, kind, k, join(v[k], tok)); }
          };
        })
      })),
      uid, fields, tokens, ops: OPS.map((o) => ({ v: o, l: o })),
      panelH: this.props.onClose ? 'calc(100vh - 54px)' : '860px',
      group: meta.g, icon: meta.ic, about: kind === 'app' && node ? node.desc + ', using your ' + node.title + ' account.' : meta.a, logo: (node && node.app) || KIND_APP[kind] || '', noLogo: !((node && node.app) || KIND_APP[kind]),
      title: node ? node.title : (this.store[key].title ?? meta.t),
      onTitle: (e) => { if (node && this.props.onTitle) this.props.onTitle(node.id, e.target.value); else { v.title = e.target.value; this.bump(); } },
      embedded: !!(node && this.props.onClose),
      close: () => { if (focus) this.setState({ focus: false }); else if (this.props.onClose) this.props.onClose(); },
      noUpstream: up.length === 0,
      tabs: [['config', 'Configure'], ['input', 'Input'], ['output', 'Output']].map(([id, l]) => ({
        l, cls: tab === id ? 'is-on' : '', sel: tab === id ? 'true' : 'false', pick: () => this.setState({ tab: id })
      })),
      isConfig: focus || tab === 'config', isInput: !focus && tab === 'input', isOutput: !focus && tab === 'output',
      banner: this.tried[key] && errCount ? 'Fix ' + errCount + (errCount === 1 ? ' field' : ' fields') + ' before this step can run.' : '',
      hasAdv: anyAdv, advOpen: this.state.adv, advIc: this.state.adv ? 'minus' : 'plus',
      advLabel: this.state.adv ? 'Hide advanced options' : 'Advanced options',
      toggleAdv: () => this.setState({ adv: !this.state.adv }),
      inputJson: up.length ? JSON.stringify(input, null, 2) : '', noInput: up.length === 0,
      outErr: exec === 'err',
      outJson: ran && out && exec !== 'err' ? JSON.stringify(out.json, null, 2) : '',
      outLabel: out ? out.label : '', outMs: out ? out.ms : '',
      outEmpty: !ran && exec !== 'err',
      testing: ts === 'running',
      testIc: ts === 'running' ? 'loader' : ts === 'listening' ? 'stop' : kind === 'webhook' ? 'webhook' : 'play', testSpin: ts === 'running' ? 'spin' : '',
      testLabel: ts === 'running' ? 'Testing' : ts === 'listening' ? 'Stop listening' : kind === 'webhook' ? 'Listen for test event' : 'Test step',
      listening: ts === 'listening',
      useSample: () => { clearTimeout(this.timer); this.testState[key] = 'ok'; this.setState({ tab: 'output' }); },
      test: () => {
        if (errCount) { this.tried[key] = true; this.setState({ tab: 'config' }); return; }
        if (ts === 'listening') { clearTimeout(this.timer); this.testState[key] = ''; this.bump(); return; }
        if (kind === 'webhook') {
          this.testState[key] = 'listening'; v.urlMode = 'test'; this.setState({ tab: 'config' });
          clearTimeout(this.timer);
          this.timer = setTimeout(() => { this.testState[key] = 'ok'; this.setState({ tab: 'output' }); }, 6000);
          return;
        }
        this.testState[key] = 'running'; this.bump();
        clearTimeout(this.timer);
        this.timer = setTimeout(() => { this.testState[key] = 'ok'; this.setState({ tab: 'output' }); }, 850);
      },
      saved: !!this.saved[key],
      saveLabel: this.saved[key] ? 'Saved' : 'Save',
      save: () => {
        if (errCount) { this.tried[key] = true; this.setState({ tab: 'config' }); return; }
        this.saved[key] = true; this.report(key, kind);
        if (this.props.onSaved) this.props.onSaved();
        this.bump();
      }
    };
  }
}

return Component;
});
FB.def("DesignSystem",[{"t":"main","a":{"class":"page","style":"max-width: 1360px; padding-top: 36px"},"c":[{"t":"div","a":{},"c":[{"t":"h1","a":{"class":"page-title","style":"font-size: 30px"},"c":["Design system"]},{"t":"p","a":{"class":"page-sub"},"c":["Colour carries meaning here: indigo is for actions, violet is for data moving between steps, and green, red and amber are only for run status."]}]},{"t":"section","a":{"class":"card card-b"},"c":[{"t":"h2","a":{"class":"ds-h"},"c":["Colour tokens"]},{"t":"div","a":{"style":"display: grid; grid-template-columns: repeat(auto-fill, minmax(min(150px, 100%), 1fr)); gap: 12px"},"c":[{"t":"sc-for","a":{"list":"{{colors}}","as":"c","hint-placeholder-count":"16"},"c":[{"t":"div","a":{"class":"col","style":"gap: 5px"},"c":[{"t":"div","a":{"style":"height: 48px; border-radius: var(--r); background: {{c.v}}; border: 1px solid var(--line)"},"c":[]},{"t":"span","a":{"class":"small strong"},"c":["{{c.n}}"]},{"t":"span","a":{"class":"mono dim"},"c":["{{c.v}}"]},{"t":"span","a":{"class":"small muted"},"c":["{{c.u}}"]}]}]}]}]},{"t":"div","a":{"class":"ds-grid"},"c":[{"t":"section","a":{"class":"card card-b"},"c":[{"t":"h2","a":{"class":"ds-h"},"c":["Type scale: Manrope, with DM Mono for IDs and data"]},{"t":"div","a":{"class":"col","style":"gap: 10px"},"c":[{"t":"sc-for","a":{"list":"{{type}}","as":"t","hint-placeholder-count":"6"},"c":[{"t":"div","a":{"class":"row between","style":"gap: 12px; align-items: baseline"},"c":[{"t":"span","a":{"style":"font-size: {{t.s}}px; font-weight: {{t.w}}; letter-spacing: {{t.l}}em; font-family: {{t.f}}"},"c":["{{t.n}}"]},{"t":"span","a":{"class":"mono dim","style":"white-space: nowrap"},"c":["{{t.s}}/{{t.w}}"]}]}]}]}]},{"t":"section","a":{"class":"card card-b col","style":"gap: 16px"},"c":[{"t":"div","a":{},"c":[{"t":"h2","a":{"class":"ds-h"},"c":["Spacing: 4 px base"]},{"t":"div","a":{"class":"row","style":"align-items: flex-end; gap: 10px"},"c":[{"t":"sc-for","a":{"list":"{{space}}","as":"s","hint-placeholder-count":"7"},"c":[{"t":"div","a":{"class":"col","style":"align-items: center; gap: 4px"},"c":[{"t":"div","a":{"style":"width: {{s}}px; height: {{s}}px; background: var(--brand-t); border: 1px solid #F5CFBB"},"c":[]},{"t":"span","a":{"class":"mono dim"},"c":["{{s}}"]}]}]}]}]},{"t":"div","a":{},"c":[{"t":"h2","a":{"class":"ds-h"},"c":["Radius"]},{"t":"div","a":{"class":"row","style":"gap: 12px"},"c":[{"t":"sc-for","a":{"list":"{{radii}}","as":"r","hint-placeholder-count":"4"},"c":[{"t":"div","a":{"class":"col","style":"align-items: center; gap: 4px"},"c":[{"t":"div","a":{"style":"width: 54px; height: 40px; background: var(--sunken); border: 1px solid var(--line-2); border-radius: {{r.v}}"},"c":[]},{"t":"span","a":{"class":"small muted"},"c":["{{r.n}}"]}]}]}]}]},{"t":"div","a":{},"c":[{"t":"h2","a":{"class":"ds-h"},"c":["Elevation"]},{"t":"div","a":{"class":"row wrap","style":"gap: 16px"},"c":[{"t":"div","a":{"class":"card","style":"width: 110px; padding: 12px; box-shadow: var(--sh-1)"},"c":[{"t":"span","a":{"class":"small"},"c":["Controls"]}]},{"t":"div","a":{"class":"card","style":"width: 110px; padding: 12px; box-shadow: var(--sh-2)"},"c":[{"t":"span","a":{"class":"small"},"c":["Nodes"]}]},{"t":"div","a":{"class":"card","style":"width: 110px; padding: 12px; box-shadow: var(--sh-3)"},"c":[{"t":"span","a":{"class":"small"},"c":["Overlays"]}]}]}]}]}]},{"t":"div","a":{"class":"ds-grid"},"c":[{"t":"section","a":{"class":"card card-b"},"c":[{"t":"h2","a":{"class":"ds-h"},"c":["Buttons"]},{"t":"div","a":{"class":"col","style":"gap: 12px"},"c":[{"t":"div","a":{"class":"row wrap"},"c":[{"t":"button","a":{"class":"btn btn-p"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"plus","s":"15","hint-size":"15px,15px"},"c":[]},"Primary"]},{"t":"button","a":{"class":"btn"},"c":["Secondary"]},{"t":"button","a":{"class":"btn btn-g"},"c":["Ghost"]},{"t":"button","a":{"class":"btn btn-d"},"c":["Destructive"]}]},{"t":"div","a":{"class":"row wrap"},"c":[{"t":"button","a":{"class":"btn btn-sm btn-p"},"c":["Small"]},{"t":"button","a":{"class":"btn btn-sm"},"c":["Small"]},{"t":"button","a":{"class":"btn btn-ic","aria-label":"Icon button"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"gear","s":"16","hint-size":"16px,16px"},"c":[]}]},{"t":"button","a":{"class":"btn btn-p","disabled":"{{ true }}"},"c":["Disabled"]},{"t":"button","a":{"class":"btn","disabled":"{{ true }}"},"c":[{"t":"span","a":{"class":"row spin","style":"gap: 0"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"loader","s":"14","hint-size":"14px,14px"},"c":[]}]},"Loading"]}]},{"t":"div","a":{"class":"seg-ctl","style":"align-self: flex-start"},"c":[{"t":"button","a":{"class":"is-on"},"c":["7 days"]},{"t":"button","a":{},"c":["14 days"]},{"t":"button","a":{},"c":["30 days"]}]}]}]},{"t":"section","a":{"class":"card card-b"},"c":[{"t":"h2","a":{"class":"ds-h"},"c":["Status: always icon plus label, never colour alone"]},{"t":"div","a":{"class":"row wrap"},"c":[{"t":"span","a":{"class":"badge b-ok"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"check","s":"13","hint-size":"13px,13px"},"c":[]},"Success"]},{"t":"span","a":{"class":"badge b-err"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"x","s":"13","hint-size":"13px,13px"},"c":[]},"Failed"]},{"t":"span","a":{"class":"badge b-run"},"c":[{"t":"span","a":{"class":"row spin","style":"gap: 0"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"loader","s":"13","hint-size":"13px,13px"},"c":[]}]},"Running"]},{"t":"span","a":{"class":"badge b-warn"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"clock","s":"13","hint-size":"13px,13px"},"c":[]},"Retrying"]},{"t":"span","a":{"class":"badge b-off"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"minus","s":"13","hint-size":"13px,13px"},"c":[]},"Skipped"]}]},{"t":"h2","a":{"class":"ds-h","style":"margin-top: 18px"},"c":["Workflow state: what is live right now"]},{"t":"div","a":{"class":"row wrap"},"c":[{"t":"span","a":{"class":"badge b-ok"},"c":[{"t":"span","a":{"class":"dot ok"},"c":[]},"Published"]},{"t":"span","a":{"class":"badge b-warn"},"c":[{"t":"span","a":{"class":"dot warn"},"c":[]},"Published, draft edited"]},{"t":"span","a":{"class":"badge b-off"},"c":[{"t":"span","a":{"class":"dot"},"c":[]},"Draft"]},{"t":"span","a":{"class":"badge b-run","style":"padding: 0 8px"},"c":["Live"]},{"t":"span","a":{"class":"badge b-off","style":"padding: 0 8px"},"c":["Test"]},{"t":"span","a":{"class":"badge b-warn"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"alert","s":"12","hint-size":"12px,12px"},"c":[]},"Needs setup"]}]},{"t":"h2","a":{"class":"ds-h","style":"margin-top: 18px"},"c":["Step trace: where a run stopped, at a glance"]},{"t":"div","a":{"class":"col small muted","style":"gap: 8px"},"c":[{"t":"span","a":{"class":"row","style":"gap: 10px"},"c":[{"t":"span","a":{"class":"trace"},"c":[{"t":"i","a":{"class":"seg ok"},"c":[]},{"t":"i","a":{"class":"seg ok"},"c":[]},{"t":"i","a":{"class":"seg ok"},"c":[]},{"t":"i","a":{"class":"seg ok"},"c":[]},{"t":"i","a":{"class":"seg ok"},"c":[]}]},"All steps succeeded"]},{"t":"span","a":{"class":"row","style":"gap: 10px"},"c":[{"t":"span","a":{"class":"trace"},"c":[{"t":"i","a":{"class":"seg ok"},"c":[]},{"t":"i","a":{"class":"seg ok"},"c":[]},{"t":"i","a":{"class":"seg run"},"c":[]},{"t":"i","a":{"class":"seg skip"},"c":[]},{"t":"i","a":{"class":"seg skip"},"c":[]}]},"Running step 3"]},{"t":"span","a":{"class":"row","style":"gap: 10px"},"c":[{"t":"span","a":{"class":"trace"},"c":[{"t":"i","a":{"class":"seg ok"},"c":[]},{"t":"i","a":{"class":"seg ok"},"c":[]},{"t":"i","a":{"class":"seg ok"},"c":[]},{"t":"i","a":{"class":"seg err"},"c":[]},{"t":"i","a":{"class":"seg skip"},"c":[]}]},"Failed at step 4, taller mark for non-colour reading"]}]}]}]},{"t":"div","a":{"class":"ds-grid"},"c":[{"t":"section","a":{"class":"card card-b col","style":"gap: 12px"},"c":[{"t":"h2","a":{"class":"ds-h","style":"margin: 0"},"c":["Inputs and validation"]},{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"ds-a"},"c":["Default"]},{"t":"input","a":{"id":"ds-a","class":"input","placeholder":"name@company.com"},"c":[]}]},{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"ds-b"},"c":["Error ",{"t":"span","a":{"class":"req"},"c":["*"]}]},{"t":"input","a":{"id":"ds-b","class":"input bad","value":"sales@"},"c":[]},{"t":"span","a":{"class":"err-msg"},"c":["Enter an email address, or insert one from an earlier step."]}]},{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"ds-c"},"c":["Dropdown"]},{"t":"select","a":{"id":"ds-c","class":"select"},"c":[{"t":"option","a":{},"c":["Gmail: hello@meridianlogistics.example"]},{"t":"option","a":{},"c":["Gmail: support@meridianlogistics.example"]}]}]},{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"ds-d"},"c":["Data from an earlier step"]},{"t":"select","a":{"id":"ds-d","class":"select is-data"},"c":[{"t":"option","a":{},"c":["Webhook.email"]},{"t":"option","a":{},"c":["Webhook.company"]}]},{"t":"div","a":{"class":"preview"},"c":[{"t":"span","a":{"class":"strong"},"c":["Preview: "]},"ada.okafor@brightpath.example"]}]},{"t":"div","a":{"class":"row"},"c":[{"t":"button","a":{"class":"toggle is-on","role":"switch","aria-checked":"true","aria-label":"On example"},"c":[]},{"t":"span","a":{"class":"small"},"c":["On"]},{"t":"button","a":{"class":"toggle","role":"switch","aria-checked":"false","aria-label":"Off example"},"c":[]},{"t":"span","a":{"class":"small"},"c":["Off"]}]}]},{"t":"section","a":{"class":"card card-b col","style":"gap: 14px"},"c":[{"t":"h2","a":{"class":"ds-h","style":"margin: 0"},"c":["Tabs, chips and notices"]},{"t":"div","a":{"class":"tabs","style":"overflow-y: hidden"},"c":[{"t":"sc-for","a":{"list":"{{tabs}}","as":"t","hint-placeholder-count":"3"},"c":[{"t":"button","a":{"class":"tab {{t.cls}}","onClick":"{{t.pick}}"},"c":["{{t.l}}"]}]}]},{"t":"div","a":{"class":"row wrap","style":"gap: 6px"},"c":[{"t":"button","a":{"class":"chip is-on"},"c":["All"]},{"t":"button","a":{"class":"chip"},"c":["Failed"]},{"t":"button","a":{"class":"chip"},"c":["Running"]}]},{"t":"div","a":{"class":"notice err"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"alert","s":"15","hint-size":"15px,15px"},"c":[]},"Something failed and needs action."]},{"t":"div","a":{"class":"notice warn"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"clock","s":"15","hint-size":"15px,15px"},"c":[]},"Something needs attention soon."]},{"t":"div","a":{"class":"notice ok"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"check","s":"15","hint-size":"15px,15px"},"c":[]},"Something recovered."]},{"t":"div","a":{"class":"notice info"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"help","s":"15","hint-size":"15px,15px"},"c":[]},"Something worth knowing."]}]},{"t":"section","a":{"class":"card card-b col","style":"gap: 14px"},"c":[{"t":"h2","a":{"class":"ds-h","style":"margin: 0"},"c":["Overlays"]},{"t":"div","a":{"class":"toast","style":"position: static; align-self: flex-start"},"c":[{"t":"span","a":{},"c":["Test passed: 5 steps succeeded."]},{"t":"button","a":{"class":"t-a"},"c":["Undo"]}]},{"t":"div","a":{"class":"col","style":"gap: 2px; width: 210px; border: 1px solid var(--line); border-radius: var(--r-l); box-shadow: var(--sh-3); padding: 6px"},"c":[{"t":"button","a":{"class":"menu-i"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"copy","s":"14","hint-size":"14px,14px"},"c":[]},"Duplicate"]},{"t":"button","a":{"class":"menu-i danger"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"trash","s":"14","hint-size":"14px,14px"},"c":[]},"Delete"]}]},{"t":"div","a":{"class":"modal","style":"width: 100%; animation: none; border: 1px solid var(--line)"},"c":[{"t":"h2","a":{},"c":["Delete this workflow?"]},{"t":"p","a":{"class":"muted"},"c":["Destructive actions always say what will happen."]},{"t":"div","a":{"class":"modal-a"},"c":[{"t":"button","a":{"class":"btn"},"c":["Cancel"]},{"t":"button","a":{"class":"btn btn-d"},"c":["Delete workflow"]}]}]}]}]},{"t":"section","a":{"class":"card card-b"},"c":[{"t":"h2","a":{"class":"ds-h"},"c":["Workflow nodes: categories and states"]},{"t":"div","a":{"style":"display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 36px 24px; padding: 20px 14px"},"c":[{"t":"sc-for","a":{"list":"{{nodes}}","as":"n","hint-placeholder-count":"8"},"c":[{"t":"div","a":{"class":"col","style":"gap: 8px"},"c":[{"t":"span","a":{"class":"small strong muted"},"c":["{{n.label}}"]},{"t":"div","a":{"style":"position: relative; width: 224px; height: 92px"},"c":[{"t":"div","a":{"class":"node {{n.cls}}","style":"left: 0; top: 0"},"c":[{"t":"div","a":{"class":"node-b"},"c":[{"t":"span","a":{"class":"n-ic {{n.group}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{n.icon}}","s":"15","hint-size":"15px,15px"},"c":[]}]},{"t":"span","a":{"class":"grow"},"c":[{"t":"span","a":{"class":"node-t trunc"},"c":["{{n.title}}"]},{"t":"span","a":{"class":"node-d trunc"},"c":["{{n.desc}}"]}]}]},{"t":"div","a":{"class":"node-f"},"c":[{"t":"span","a":{"class":"dot {{n.dot}}"},"c":[]},{"t":"span","a":{"class":"trunc"},"c":["{{n.foot}}"]}]},{"t":"sc-if","a":{"value":"{{n.badge}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"span","a":{"class":"node-x {{n.badge}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{n.badgeIc}}","s":"11","hint-size":"11px,11px"},"c":[]}]}]},{"t":"sc-if","a":{"value":"{{n.hasIn}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"span","a":{"class":"port","style":"left: 0; top: 46px; pointer-events: none"},"c":[{"t":"i","a":{},"c":[]}]}]},{"t":"span","a":{"class":"port","style":"left: 100%; top: 46px; pointer-events: none"},"c":[{"t":"i","a":{},"c":[]}]}]}]}]}]}]}]},{"t":"section","a":{"class":"card card-b"},"c":[{"t":"h2","a":{"class":"ds-h"},"c":["Connection styles"]},{"t":"div","a":{"style":"display: grid; grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr)); gap: 16px"},"c":[{"t":"sc-for","a":{"list":"{{edges}}","as":"e","hint-placeholder-count":"6"},"c":[{"t":"div","a":{"class":"col","style":"gap: 6px"},"c":[{"t":"svg","a":{"viewBox":"0 0 170 40","aria-hidden":"true","style":"width: 170px; height: 40px"},"c":[{"t":"path","a":{"class":"e {{e.cls}}","d":"M4 30C60 30 110 10 166 10"},"c":[]}]},{"t":"span","a":{"class":"small muted"},"c":["{{e.l}}"]}]}]}]}]},{"t":"section","a":{"class":"card"},"c":[{"t":"div","a":{"class":"card-h","style":"padding-bottom: 10px"},"c":[{"t":"h2","a":{"class":"ds-h","style":"margin: 0"},"c":["Table"]}]},{"t":"div","a":{"class":"tbl-wrap"},"c":[{"t":"table","a":{"class":"tbl"},"c":[{"t":"thead","a":{},"c":[{"t":"tr","a":{},"c":[{"t":"th","a":{},"c":["Workflow"]},{"t":"th","a":{},"c":["Status"]},{"t":"th","a":{"class":"r"},"c":["Duration"]}]}]},{"t":"tbody","a":{},"c":[{"t":"tr","a":{"class":"is-fail"},"c":[{"t":"td","a":{"class":"strong"},"c":["New customer onboarding"]},{"t":"td","a":{},"c":[{"t":"span","a":{"class":"badge b-err"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"x","s":"13","hint-size":"13px,13px"},"c":[]},"Failed"]}]},{"t":"td","a":{"class":"r num"},"c":["38.2 s"]}]},{"t":"tr","a":{},"c":[{"t":"td","a":{"class":"strong"},"c":["Support ticket triage"]},{"t":"td","a":{},"c":[{"t":"span","a":{"class":"badge b-ok"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"check","s":"13","hint-size":"13px,13px"},"c":[]},"Success"]}]},{"t":"td","a":{"class":"r num"},"c":["1.6 s"]}]},{"t":"tr","a":{},"c":[{"t":"td","a":{"class":"strong","style":"width: 45%"},"c":[{"t":"span","a":{"class":"skel","style":"width: 60%"},"c":[]}]},{"t":"td","a":{},"c":[{"t":"span","a":{"class":"skel","style":"width: 60px"},"c":[]}]},{"t":"td","a":{"class":"r"},"c":[{"t":"span","a":{"class":"skel","style":"width: 40px; margin-left: auto"},"c":[]}]}]}]}]}]}]}]}],{},function(DCLogic){

class Component extends DCLogic {
  state = { tab: 0 };
  renderVals() {
    return {
      colors: [
        { n: 'Ink', v: '#261F18', u: 'Primary text' }, { n: 'Ink 2', v: '#615952', u: 'Secondary text' }, { n: 'Ink 3', v: '#78716A', u: 'Captions' },
        { n: 'Line', v: '#EBE8E6', u: 'Dividers' }, { n: 'Line 2', v: '#DBD7D4', u: 'Control borders' }, { n: 'Background', v: '#F9F8F7', u: 'App ground' }, { n: 'Surface', v: '#FFFFFF', u: 'Cards, panels' },
        { n: 'Brand', v: '#C2410C', u: 'Actions' }, { n: 'Brand tint', v: '#FCEEE6', u: 'Selected states' }, { n: 'Data', v: '#D28E33', u: 'Variables, mapping' }, { n: 'Data tint', v: '#FEF6EC', u: 'Variable chips' },
        { n: 'Success', v: '#0A7445', u: 'Text on tint' }, { n: 'Success mark', v: '#16A367', u: 'Bars, edges' }, { n: 'Error', v: '#BE1E2D', u: 'Text on tint' }, { n: 'Error mark', v: '#E0404F', u: 'Bars, edges' }, { n: 'Warning', v: '#8A5206', u: 'Text on tint' }
      ],
      type: [
        { n: 'Page title', s: 24, w: 650, l: -0.022, f: 'var(--sans)' }, { n: 'Dialog title', s: 16, w: 640, l: -0.012, f: 'var(--sans)' },
        { n: 'Card title', s: 14, w: 620, l: -0.008, f: 'var(--sans)' }, { n: 'Body and table text', s: 13, w: 400, l: 0, f: 'var(--sans)' },
        { n: 'Caption and label', s: 12, w: 500, l: 0, f: 'var(--sans)' }, { n: 'EX-48213, Webhook.email', s: 12, w: 500, l: -0.01, f: 'var(--mono)' }
      ],
      space: [4, 8, 12, 16, 20, 24, 32],
      radii: [{ n: 'Small 5', v: '5px' }, { n: 'Control 7', v: '7px' }, { n: 'Card 10', v: '10px' }, { n: 'Dialog 12', v: '12px' }],
      tabs: ['Configure', 'Input', 'Output'].map((l, i) => ({ l, cls: this.state.tab === i ? 'is-on' : '', pick: () => this.setState({ tab: i }) })),
      nodes: [
        { label: 'Trigger', group: 'trigger', icon: 'webhook', title: 'Webhook trigger', desc: 'New customer registration', foot: 'Listening for events', dot: 'ok', cls: '', hasIn: false, badge: '' },
        { label: 'Action', group: 'action', icon: 'db', title: 'Save to database', desc: 'customers table', foot: 'PostgreSQL connected', dot: 'ok', cls: '', hasIn: true, badge: '' },
        { label: 'Logic', group: 'logic', icon: 'split', title: 'Validate customer', desc: 'Email and company check', foot: 'Ready', dot: 'ok', cls: '', hasIn: true, badge: '' },
        { label: 'Selected', group: 'action', icon: 'mail', title: 'Send welcome email', desc: 'To the new customer', foot: 'Gmail connected', dot: 'ok', cls: 'is-sel', hasIn: true, badge: '' },
        { label: 'Needs setup', group: 'action', icon: 'send', title: 'Notify sales team', desc: 'Slack message', foot: 'Needs setup', dot: 'err', cls: 'is-bad', hasIn: true, badge: 'warn', badgeIc: 'alert' },
        { label: 'Running', group: 'action', icon: 'mail', title: 'Send welcome email', desc: 'To the new customer', foot: 'Running', dot: '', cls: 'running', hasIn: true, badge: 'run', badgeIc: 'loader' },
        { label: 'Succeeded', group: 'action', icon: 'db', title: 'Save to database', desc: 'customers table', foot: 'Succeeded', dot: 'ok', cls: 'x-ok', hasIn: true, badge: 'ok', badgeIc: 'check' },
        { label: 'Failed', group: 'action', icon: 'mail', title: 'Send welcome email', desc: 'To the new customer', foot: 'Failed after 3 retries', dot: 'err', cls: 'x-err', hasIn: true, badge: 'err', badgeIc: 'x' }
      ],
      edges: [
        { cls: '', l: 'Default' }, { cls: 'is-sel', l: 'Selected' }, { cls: 'draft', l: 'Being drawn' },
        { cls: 'flow', l: 'Data flowing' }, { cls: 'ok', l: 'Completed' }, { cls: 'err', l: 'Into a failed step' }, { cls: 'skip', l: 'Skipped path' }
      ]
    };
  }
}

return Component;
});
FB.def("Docs",[{"t":"div","a":{"style":"background: var(--surface); min-height: 100vh"},"c":[{"t":"div","a":{"style":"position: sticky; top: 0; z-index: 30"},"c":[{"t":"dc-import","a":{"name":"SiteNav","hint-size":"100%,65px"},"c":[]}]},{"t":"div","a":{"class":"d-g"},"c":[{"t":"nav","a":{"class":"d-side","aria-label":"Documentation topics"},"c":[{"t":"sc-for","a":{"list":"{{topics}}","as":"t","hint-placeholder-count":"5"},"c":[{"t":"button","a":{"class":"d-t {{t.cls}}","aria-current":"{{t.cur}}","onClick":"{{t.pick}}"},"c":["{{t.t}}"]}]}]},{"t":"article","a":{"class":"d-art {{artCls}}"},"c":[{"t":"h1","a":{},"c":["{{doc.t}}"]},{"t":"p","a":{},"c":["{{doc.intro}}"]},{"t":"div","a":{"class":"d-pts","style":"margin-top: 14px"},"c":[{"t":"sc-for","a":{"list":"{{doc.points}}","as":"p","hint-placeholder-count":"4"},"c":[{"t":"div","a":{"class":"d-pt"},"c":[{"t":"b","a":{},"c":["{{p.h}}"]},{"t":"p","a":{},"c":["{{p.b}}"]}]}]}]},{"t":"sc-if","a":{"value":"{{showPerms}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"h2","a":{"class":"d-perm-h","id":"roles"},"c":["What each role can do"]},{"t":"p","a":{"class":"d-perm-s"},"c":["Administrators change a person's role under Team & Users."]},{"t":"section","a":{"class":"card"},"c":[{"t":"div","a":{"class":"tbl-wrap"},"c":[{"t":"table","a":{"class":"tbl"},"c":[{"t":"thead","a":{},"c":[{"t":"tr","a":{},"c":[{"t":"th","a":{},"c":["Permission"]},{"t":"th","a":{"style":"text-align: center"},"c":["Administrator"]},{"t":"th","a":{"style":"text-align: center"},"c":["Workflow Creator"]},{"t":"th","a":{"style":"text-align: center"},"c":["Technical Operator"]},{"t":"th","a":{"style":"text-align: center"},"c":["Business User"]}]}]},{"t":"tbody","a":{},"c":[{"t":"sc-for","a":{"list":"{{perms}}","as":"p","hint-placeholder-count":"10"},"c":[{"t":"tr","a":{},"c":[{"t":"td","a":{"style":"white-space: normal; min-width: 220px"},"c":["{{p.l}}"]},{"t":"sc-for","a":{"list":"{{p.cells}}","as":"c"},"c":[{"t":"td","a":{"style":"text-align: center"},"c":[{"t":"span","a":{"style":"display: inline-flex; color: {{c.color}}","aria-label":"{{c.aria}}","role":"img"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{c.ic}}","s":"15","hint-size":"15px,15px"},"c":[]}]}]}]}]}]}]}]}]}]}]},{"t":"sc-if","a":{"value":"{{hasNext}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"button","a":{"class":"btn","style":"margin-top: 22px","onClick":"{{goNext}}"},"c":["Next: {{nextT}}",{"t":"dc-import","a":{"name":"Icon","g":"arrow","s":"15","hint-size":"15px,15px"},"c":[]}]}]},{"t":"sc-if","a":{"value":"{{isLast}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"a","a":{"class":"btn btn-p","style":"margin-top: 22px","href":"/register"},"c":["Get started"]}]}]}]},{"t":"dc-import","a":{"name":"SiteFooter","hint-size":"100%,340px"},"c":[]}]}],{},function(DCLogic){

const PERMS = [
  ['View dashboards and run history', 1, 1, 1, 1],
  ['Run workflows made available to them', 1, 1, 1, 1],
  ['Create, edit and test workflows', 1, 1, 0, 0],
  ['Publish and unpublish workflows', 1, 1, 0, 0],
  ['See step input and output data', 1, 1, 1, 0],
  ['Retry failed runs', 1, 1, 1, 0],
  ['Connect and manage integrations', 1, 1, 0, 0],
  ['View and test integrations', 1, 1, 1, 0],
  ['Manage members and roles', 1, 0, 0, 0],
  ['Change workspace and security settings', 1, 0, 0, 0]
];
const DOCS = [
  { t: 'Getting started', intro: 'Build and publish your first workflow in four steps.', points: [
    { h: '1. Create your workspace', b: 'Sign up with your work email. Your workspace holds your workflows, connected apps and team.' },
    { h: '2. Start a workflow', b: 'Pick a template, or open a blank canvas and add a trigger: the event that starts the workflow.' },
    { h: '3. Add and connect steps', b: 'Add steps from the panel on the left, then draw a line from one to the next. Open a step to fill in its settings.' },
    { h: '4. Test, then publish', b: 'Click Test workflow to try it with sample data. When it works, click Publish to make it live.' }
  ] },
  { t: 'Workflows and steps', intro: 'A workflow is a series of steps that runs when its trigger fires.', points: [
    { h: 'Triggers', b: 'A webhook, a schedule or a manual click. Each workflow has one trigger.' },
    { h: 'Actions', b: 'Steps that do the work: send an email, save a record, post a message or call an API.' },
    { h: 'Logic', b: 'Conditions and branches send data down different paths. Delays wait before continuing.' },
    { h: 'Using data between steps', b: 'Any step can use data from earlier steps. Click Insert data in a field, or drag a value into it.' }
  ] },
  { t: 'Publishing and versions', intro: 'What you edit and what runs are kept separate, so changes never reach live runs by accident.', points: [
    { h: 'Draft', b: 'Your working copy. Saving a draft does not change anything that is live.' },
    { h: 'Published', b: 'The version that handles real events. Each publish creates a named version you can go back to.' },
    { h: 'Test and Production URLs', b: 'Webhook triggers have two addresses. The Test URL only works while you are listening; the Production URL needs a published version.' },
    { h: 'Test runs and live runs', b: 'Test runs are labelled and never count toward your statistics or usage.' }
  ] },
  { t: 'When a run fails', intro: 'Every failure shows where it happened, why and what to do next.', points: [
    { h: 'Automatic retries', b: 'Steps can retry with a growing wait between attempts. You choose how many times, and what happens if they all fail.' },
    { h: 'Reading a failed run', b: 'Open the run from Executions. The timeline marks the failed step and each attempt shows what the service returned.' },
    { h: 'Fixing it', b: 'Retry from the failed step, run from the start, or use Debug in builder to fix the step using the data from that run.' },
    { h: 'Failure alerts', b: 'Turn on alerts in Workflow settings to hear about a failed live run through Slack or email.' }
  ] },
  { t: 'Team and roles', intro: 'Four roles control what each person can see and change.', points: [
    { h: 'Administrator', b: 'Full access, including members, integrations and security.' },
    { h: 'Workflow Creator', b: 'Creates, tests and publishes workflows, and connects the apps they use.' },
    { h: 'Technical Operator', b: 'Monitors runs, investigates failures, retries them and tests integrations.' },
    { h: 'Business User', b: 'Watches activity and runs the automations made available to them.' }
  ] }
];
class Component extends DCLogic {
  state = { i: 0 };
  componentDidMount() { let h = ''; try { h = window.location.hash; } catch (e) {} if (h === '#roles') this.setState({ i: DOCS.length - 1 }); }
  renderVals() {
    const i = this.state.i, go = (n) => () => { this.setState({ i: n }); try { window.scrollTo(0, 0); } catch (e) {} };
    return {
      topics: DOCS.map((d, n) => ({ t: d.t, cls: n === i ? 'is-on' : '', cur: n === i ? 'page' : 'false', pick: go(n) })),
      doc: DOCS[i],
      showPerms: i === DOCS.length - 1, artCls: i === DOCS.length - 1 ? 'is-wide' : '',
      perms: PERMS.map(([l, ...cells]) => ({ l, cells: cells.map((c) => ({ ic: c ? 'check' : 'minus', color: c ? 'var(--ok)' : '#958E87', aria: c ? 'Allowed' : 'Not allowed' })) })),
      hasNext: i < DOCS.length - 1, isLast: i === DOCS.length - 1,
      nextT: i < DOCS.length - 1 ? DOCS[i + 1].t : '', goNext: go(i + 1)
    };
  }
}

return Component;
});
FB.def("ExecChart",[{"t":"div","a":{"style":"background: var(--surface); border-radius: var(--r-l)"},"c":[{"t":"div","a":{"class":"card-h"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Workflow activity"]},{"t":"div","a":{"class":"seg-ctl","role":"group","aria-label":"Date range"},"c":[{"t":"sc-for","a":{"list":"{{ranges}}","as":"r","hint-placeholder-count":"3"},"c":[{"t":"button","a":{"class":"{{r.cls}}","aria-pressed":"{{r.on}}","onClick":"{{r.pick}}"},"c":["{{r.l}}"]}]}]}]},{"t":"div","a":{"class":"card-b col","style":"gap: 6px","onMouseLeave":"{{clear}}"},"c":[{"t":"div","a":{"class":"row between small"},"c":[{"t":"span","a":{"class":"muted"},"c":["Successful runs per day"]},{"t":"span","a":{"class":"dim"},"c":["Peak {{peakS}}"]}]},{"t":"div","a":{"class":"bars {{hoverCls}}","style":"height: 168px; border-bottom: 1px solid var(--line-2)"},"c":[{"t":"sc-for","a":{"list":"{{days}}","as":"d","hint-placeholder-count":"30"},"c":[{"t":"div","a":{"class":"bar-col {{d.cls}}","onMouseEnter":"{{d.hover}}"},"c":[{"t":"div","a":{"class":"bar","style":"height: {{d.sh}}%"},"c":[]}]}]},{"t":"sc-if","a":{"value":"{{tip}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"chart-tip","style":"left: {{tip.left}}%; top: 4px"},"c":[{"t":"strong","a":{},"c":["{{tip.l}}"]},{"t":"br","a":{},"c":[]},"{{tip.s}} succeeded",{"t":"br","a":{},"c":[]},"{{tip.f}} failed, {{tip.rate}} success"]}]}]},{"t":"div","a":{"class":"row between small","style":"margin-top: 8px"},"c":[{"t":"span","a":{"class":"muted"},"c":["Failed runs per day"]},{"t":"span","a":{"class":"dim"},"c":["Peak {{peakF}}"]}]},{"t":"div","a":{"class":"bars {{hoverCls}}","style":"height: 44px; border-bottom: 1px solid var(--line-2)"},"c":[{"t":"sc-for","a":{"list":"{{days}}","as":"d","hint-placeholder-count":"30"},"c":[{"t":"div","a":{"class":"bar-col {{d.cls}}","onMouseEnter":"{{d.hover}}"},"c":[{"t":"div","a":{"class":"bar","style":"height: {{d.fh}}%; background: var(--err-m)"},"c":[]}]}]}]},{"t":"div","a":{"class":"row between small dim num"},"c":[{"t":"span","a":{},"c":["{{first}}"]},{"t":"span","a":{},"c":["{{last}}"]}]}]}]}],{},function(DCLogic){

const S = [727,809,683,165,271,729,603,628,783,765,221,295,823,705,610,713,758,203,213,808,806,688,737,832,289,181,719,788,684,676];
const F = [11,14,15,6,4,14,15,12,12,15,7,4,13,15,14,11,14,7,6,12,15,15,52,31,7,7,12,13,15,14];
const L = ['7 Oct','8 Oct','9 Oct','10 Oct','11 Oct','12 Oct','13 Oct','14 Oct','15 Oct','16 Oct','17 Oct','18 Oct','19 Oct','20 Oct','21 Oct','22 Oct','23 Oct','24 Oct','25 Oct','26 Oct','27 Oct','28 Oct','29 Oct','30 Oct','31 Oct','1 Nov','2 Nov','3 Nov','4 Nov','5 Nov'];
class Component extends DCLogic {
  state = { range: 30, hover: -1 };
  renderVals() {
    const n = this.state.range;
    const s = S.slice(-n), f = F.slice(-n), l = L.slice(-n);
    const maxS = Math.max(...s), maxF = Math.max(...f);
    const h = this.state.hover;
    const tip = h >= 0 && h < n ? {
      l: l[h], s: s[h].toLocaleString('en-GB'), f: f[h],
      rate: (s[h] / (s[h] + f[h]) * 100).toFixed(1) + '%',
      left: Math.min(84, Math.max(16, (h + 0.5) / n * 100))
    } : false;
    return {
      ranges: [7, 14, 30].map((r) => ({
        l: r + ' days', on: r === n ? 'true' : 'false', cls: r === n ? 'is-on' : '',
        pick: () => this.setState({ range: r, hover: -1 })
      })),
      days: s.map((v, i) => ({
        sh: Math.round(v / maxS * 96),
        fh: Math.max(4, Math.round(f[i] / maxF * 100)),
        cls: i === h ? 'is-h' : '',
        hover: () => this.setState({ hover: i })
      })),
      hoverCls: h >= 0 ? 'has-hover' : '',
      clear: () => this.setState({ hover: -1 }),
      tip,
      peakS: maxS.toLocaleString('en-GB'),
      peakF: maxF,
      first: l[0],
      last: l[n - 1]
    };
  }
}

return Component;
});
FB.def("ExecutionDetail",[{"t":"sc-if","a":{"value":"{{debugOpen}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"dc-import","a":{"name":"Builder","debug-run":"EX-48213","hint-size":"100%,100vh"},"c":[]}]},{"t":"div","a":{"class":"app","style":"display: {{appDisplay}}"},"c":[{"t":"dc-import","a":{"name":"Sidebar","active":"executions","hint-size":"232px,100vh"},"c":[]},{"t":"div","a":{"class":"main"},"c":[{"t":"dc-import","a":{"name":"Topbar","parent":"Executions","phref":"/executions","page":"EX-48213","hint-size":"100%,56px"},"c":[]},{"t":"main","a":{"class":"page"},"c":[{"t":"div","a":{"class":"page-head"},"c":[{"t":"div","a":{},"c":[{"t":"div","a":{"class":"row wrap","style":"gap: 10px"},"c":[{"t":"h1","a":{"class":"page-title"},"c":["New customer onboarding"]},{"t":"span","a":{"class":"badge {{status.b}}"},"c":[{"t":"span","a":{"class":"row {{status.spin}}","style":"gap: 0"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{status.ic}}","s":"13","hint-size":"13px,13px"},"c":[]}]},"{{status.l}}"]}]},{"t":"p","a":{"class":"page-sub"},"c":[{"t":"span","a":{"class":"mono"},"c":["EX-48213"]},", for ada.okafor@brightpath.example"]}]},{"t":"div","a":{"class":"row wrap"},"c":[{"t":"sc-if","a":{"value":"{{canEdit}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"button","a":{"class":"btn","onClick":"{{debugBuilder}}","title":"Opens this run's data in the builder, so you can fix it and test again"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"flow","s":"15","hint-size":"15px,15px"},"c":[]},"Debug in builder"]}]},{"t":"sc-if","a":{"value":"{{canRetry}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"button","a":{"class":"btn","onClick":"{{askRestart}}"},"c":["Run from start"]},{"t":"div","a":{"style":"position: relative"},"c":[{"t":"button","a":{"class":"btn btn-p","aria-expanded":"{{retryOpen}}","onClick":"{{toggleRetry}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"retry","s":"15","hint-size":"15px,15px"},"c":[]},"Retry from failed step",{"t":"dc-import","a":{"name":"Icon","g":"down","s":"13","hint-size":"13px,13px"},"c":[]}]},{"t":"sc-if","a":{"value":"{{retryOpen}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"pop","style":"right: 0; top: 40px; width: 280px"},"c":[{"t":"button","a":{"class":"menu-i","onClick":"{{retry}}"},"c":[{"t":"span","a":{},"c":[{"t":"span","a":{"class":"strong","style":"display: block"},"c":["Use the current version"]},{"t":"span","a":{"class":"small muted","style":"display: block"},"c":["Version 15, with your latest changes"]}]}]},{"t":"button","a":{"class":"menu-i","onClick":"{{retry}}"},"c":[{"t":"span","a":{},"c":[{"t":"span","a":{"class":"strong","style":"display: block"},"c":["Use the original version"]},{"t":"span","a":{"class":"small muted","style":"display: block"},"c":["Version 14, exactly as it ran"]}]}]},{"t":"div","a":{"class":"menu-sep"},"c":[]},{"t":"div","a":{"class":"small muted","style":"padding: 5px 9px 7px; text-wrap: pretty"},"c":["Starts at step 4, so steps 1 to 3 won't repeat. A retry counts as 1 run toward your usage."]}]}]}]}]}]}]},{"t":"sc-if","a":{"value":"{{isFailed}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"section","a":{"class":"notice err","style":"align-items: flex-start; padding: 14px 16px","role":"alert"},"c":[{"t":"span","a":{"style":"margin-top: 2px"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"alert","s":"17","hint-size":"17px,17px"},"c":[]}]},{"t":"div","a":{"class":"grow col","style":"gap: 3px; min-width: 240px"},"c":[{"t":"strong","a":{"style":"font-size: 14px"},"c":["Step 4, Send welcome email, failed after 3 retries"]},{"t":"span","a":{},"c":["Gmail refused the email because hello@meridianlogistics.example reached its daily sending limit. The customer was saved, but has not been emailed and sales has not been told."]},{"t":"span","a":{},"c":[{"t":"strong","a":{},"c":["Next step:"]}," retry once the limit resets, around 13:30 today, or change the sending account in the builder. Retrying will not create a duplicate customer."]}]}]}]},{"t":"sc-if","a":{"value":"{{isDone}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"notice ok","role":"status"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"check","s":"16","hint-size":"16px,16px"},"c":[]},{"t":"span","a":{},"c":["Recovered. The welcome email was sent and sales was notified. Steps 1 to 3 were not repeated."]}]}]},{"t":"section","a":{"class":"rp","aria-label":"Replay this run"},"c":[{"t":"div","a":{"class":"row between wrap"},"c":[{"t":"div","a":{"class":"row","style":"gap: 10px"},"c":[{"t":"strong","a":{"style":"font-size: 15px"},"c":["Replay the original run"]},{"t":"span","a":{"class":"small","style":"color: #CAC4BF"},"c":["Read-only, event {{rpPos}} of {{rpTotal}}"]}]},{"t":"button","a":{"class":"btn btn-sm","aria-label":"{{rpPlayL}}","onClick":"{{rpToggle}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{rpPlayIc}}","s":"13","hint-size":"13px,13px"},"c":[]},"{{rpPlayL}}"]}]},{"t":"div","a":{"class":"rp-track"},"c":[{"t":"sc-for","a":{"list":"{{rpNodes}}","as":"n","hint-placeholder-count":"5"},"c":[{"t":"button","a":{"class":"rp-n {{n.cls}}","onClick":"{{n.pick}}"},"c":["{{n.t}}",{"t":"small","a":{},"c":["{{n.sub}}"]}]},{"t":"sc-if","a":{"value":"{{n.more}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"span","a":{"class":"rp-c"},"c":[{"t":"i","a":{"style":"width: {{n.link}}%"},"c":[]}]}]}]}]},{"t":"label","a":{"for":"rp-range","style":"position: absolute; width: 1px; height: 1px; overflow: hidden"},"c":["Scrub through the run"]},{"t":"input","a":{"id":"rp-range","class":"rp-range","type":"range","min":"0","max":"{{rpMax}}","step":"1","value":"{{rp}}","onChange":"{{rpScrub}}"},"c":[]},{"t":"div","a":{"class":"rp-cap","aria-live":"polite"},"c":["{{rpCap}}"]}]},{"t":"section","a":{"class":"card stats","aria-label":"Execution overview"},"c":[{"t":"sc-for","a":{"list":"{{overview}}","as":"o","hint-placeholder-count":"5"},"c":[{"t":"div","a":{"class":"stat"},"c":[{"t":"span","a":{"class":"stat-l"},"c":["{{o.l}}"]},{"t":"span","a":{"class":"strong num","style":"font-size: 15px"},"c":["{{o.v}}"]}]}]}]},{"t":"div","a":{"class":"row wrap","style":"gap: 20px; align-items: flex-start"},"c":[{"t":"section","a":{"class":"card","style":"flex: 1 1 340px; min-width: 0; overflow: hidden"},"c":[{"t":"div","a":{"class":"card-h","style":"padding-bottom: 12px"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Timeline"]},{"t":"span","a":{"class":"small dim"},"c":["Select a step to inspect it"]}]},{"t":"div","a":{"style":"border-top: 1px solid var(--line)"},"c":[{"t":"sc-for","a":{"list":"{{steps}}","as":"s","hint-placeholder-count":"5"},"c":[{"t":"button","a":{"class":"tl-i {{s.cls}}","aria-pressed":"{{s.pressed}}","onClick":"{{s.pick}}"},"c":[{"t":"span","a":{"class":"tl-n {{s.st}}"},"c":[{"t":"span","a":{"class":"row {{s.spin}}","style":"gap: 0"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{s.ic}}","s":"13","hint-size":"13px,13px"},"c":[]}]}]},{"t":"span","a":{"style":"min-width: 0"},"c":[{"t":"span","a":{"class":"strong trunc","style":"display: block; font-size: 13px"},"c":["{{s.n}}. {{s.t}}"]},{"t":"span","a":{"class":"small muted trunc","style":"display: block"},"c":["{{s.sub}}"]},{"t":"span","a":{"class":"gantt","style":"display: block"},"c":[{"t":"i","a":{"class":"{{s.barCls}}","style":"left: {{s.barL}}%; width: {{s.barW}}%"},"c":[]}]}]},{"t":"span","a":{"class":"small num muted"},"c":["{{s.ms}}"]}]}]}]}]},{"t":"section","a":{"class":"card","style":"flex: 2 1 520px; min-width: 0"},"c":[{"t":"div","a":{"class":"card-h","style":"padding-bottom: 4px"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["{{cur.n}}. {{cur.t}}"]},{"t":"span","a":{"class":"badge {{cur.b}}"},"c":["{{cur.lab}}"]}]},{"t":"div","a":{"class":"tabs","style":"padding: 0 10px; overflow-y: hidden","role":"tablist","aria-label":"Step data"},"c":[{"t":"sc-for","a":{"list":"{{tabs}}","as":"t","hint-placeholder-count":"4"},"c":[{"t":"button","a":{"class":"tab {{t.cls}}","role":"tab","aria-selected":"{{t.sel}}","onClick":"{{t.pick}}"},"c":["{{t.l}}"]}]}]},{"t":"div","a":{"class":"card-b col","style":"gap: 12px"},"c":[{"t":"sc-if","a":{"value":"{{tabErr}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"sc-if","a":{"value":"{{cur.err}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"div","a":{"class":"col","style":"gap: 10px"},"c":[{"t":"div","a":{"class":"row wrap","style":"gap: 24px"},"c":[{"t":"div","a":{},"c":[{"t":"div","a":{"class":"small muted"},"c":["Error type"]},{"t":"div","a":{"class":"strong"},"c":["Rate limit reached"]}]},{"t":"div","a":{},"c":[{"t":"div","a":{"class":"small muted"},"c":["Service response"]},{"t":"div","a":{"class":"mono strong"},"c":["429 rateLimitExceeded"]}]},{"t":"div","a":{},"c":[{"t":"div","a":{"class":"small muted"},"c":["Attempts"]},{"t":"div","a":{"class":"strong num"},"c":["1 + 3 retries"]}]}]},{"t":"div","a":{},"c":[{"t":"div","a":{"class":"small muted","style":"margin-bottom: 5px"},"c":["What each attempt saw"]},{"t":"div","a":{"class":"col","style":"border: 1px solid var(--line); border-radius: var(--r)"},"c":[{"t":"sc-for","a":{"list":"{{attempts}}","as":"a","hint-placeholder-count":"4"},"c":[{"t":"div","a":{"class":"row wrap small","style":"padding: 7px 10px; border-bottom: 1px solid var(--line); gap: 2px 10px"},"c":[{"t":"span","a":{"class":"strong","style":"width: 66px"},"c":["{{a.n}}"]},{"t":"span","a":{"class":"num muted","style":"width: 64px"},"c":["{{a.t}}"]},{"t":"span","a":{"class":"mono grow att-r"},"c":["{{a.r}}"]},{"t":"span","a":{"class":"dim att-w"},"c":["{{a.w}}"]}]}]}]}]},{"t":"pre","a":{"class":"code","tabindex":"0","aria-label":"Raw error"},"c":["{{cur.err}}"]}]}]},{"t":"sc-if","a":{"value":"{{noErr}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"p","a":{"class":"muted","style":"padding: 20px 0"},"c":["No error on this step."]}]}]},{"t":"sc-if","a":{"value":"{{tabIn}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"p","a":{"class":"small muted"},"c":["What this step received."]},{"t":"pre","a":{"class":"code","tabindex":"0"},"c":["{{cur.input}}"]}]},{"t":"sc-if","a":{"value":"{{tabOut}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"sc-if","a":{"value":"{{cur.output}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"p","a":{"class":"small muted"},"c":["What this step produced."]},{"t":"pre","a":{"class":"code","tabindex":"0"},"c":["{{cur.output}}"]}]},{"t":"sc-if","a":{"value":"{{noOut}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"p","a":{"class":"muted","style":"padding: 20px 0"},"c":["{{cur.noOutMsg}}"]}]}]},{"t":"sc-if","a":{"value":"{{tabLogs}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"log","style":"border: 1px solid var(--line); border-radius: var(--r); max-height: 340px","tabindex":"0","aria-label":"Execution log"},"c":[{"t":"sc-for","a":{"list":"{{logs}}","as":"l"},"c":[{"t":"div","a":{"class":"{{l.c}}"},"c":["{{l.t}}  {{l.m}}"]}]}]}]}]}]}]}]}]},{"t":"sc-if","a":{"value":"{{modal}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"scrim"},"c":[{"t":"div","a":{"class":"modal","role":"dialog","aria-modal":"true","aria-labelledby":"rs-t"},"c":[{"t":"h2","a":{"id":"rs-t"},"c":["Run every step again?"]},{"t":"p","a":{"class":"muted","style":"text-wrap: pretty"},"c":["Steps 1 to 3 already succeeded. Running them again updates the existing customer record, and may repeat anything else they do. To avoid that, use Retry from failed step."]},{"t":"div","a":{"class":"modal-a"},"c":[{"t":"button","a":{"class":"btn","onClick":"{{closeModal}}"},"c":["Cancel"]},{"t":"button","a":{"class":"btn btn-d","onClick":"{{restart}}"},"c":["Run from start"]}]}]}]}]},{"t":"sc-if","a":{"value":"{{toast}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"toast","role":"status"},"c":["{{toast}}"]}]}]}],{},function(DCLogic){

const FB_ACC = {
  admin: { k: 'admin', n: 'Jonah Thomas', f: 'Jonah', i: 'JT', a: 'a5', r: 'Administrator', e: 'jonah@meridianlogistics.example' },
  creator: { k: 'creator', n: 'Priya Raman', f: 'Priya', i: 'PR', a: '', r: 'Workflow Creator', e: 'priya@meridianlogistics.example' },
  operator: { k: 'operator', n: 'Rahul Shah', f: 'Rahul', i: 'RS', a: 'a3', r: 'Technical Operator', e: 'rahul@meridianlogistics.example' },
  business: { k: 'business', n: 'Lena Costa', f: 'Lena', i: 'LC', a: 'a2', r: 'Business User', e: 'lena@meridianlogistics.example' }
};
const FB_CANS = {
  admin: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 1 },
  creator: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 0 },
  operator: { edit: 0, builder: 1, publish: 0, retry: 1, data: 1, integ: 0, integView: 1, admin: 0 },
  business: { edit: 0, builder: 0, publish: 0, retry: 0, data: 0, integ: 0, integView: 0, admin: 0 }
};
const fbStored = () => { let k = ''; try { k = localStorage.getItem('fb-role') || ''; } catch (e) {} if (!k) { try { const m = /fb-role:(\w+)/.exec(window.name || ''); if (m) k = m[1]; } catch (e) {} } return FB_ACC[k] ? k : ''; };
const fbSetRole = (k) => { try { if (k) localStorage.setItem('fb-role', k); else localStorage.removeItem('fb-role'); } catch (e) {} try { window.name = k ? 'fb-role:' + k : ''; } catch (e) {} };
const FB_ME = FB_ACC[fbStored() || 'creator'], FB_C = FB_CANS[FB_ME.k];
const PAYLOAD = { first_name: 'Ada', last_name: 'Okafor', email: 'ada.okafor@brightpath.example', company: 'Brightpath Foods', plan: 'Growth' };
const J = (o) => JSON.stringify(o, null, 2);
const ERR = J({ error: { code: 429, status: 'rateLimitExceeded', message: 'Daily user sending limit exceeded.', domain: 'usageLimits' }, step: 'mail', attempt: 4, next_action: 'none: retries exhausted' });
const STEPS = [
  { n: 1, t: 'Webhook trigger', sub: 'Signature verified', st: 'ok', ms: '12 ms', l: 0, w: 1, input: J({ headers: { 'x-flowbridge-signature': 'sha256=••••••••' }, body: PAYLOAD }), output: J(PAYLOAD) },
  { n: 2, t: 'Validate customer', sub: 'Took the Valid path', st: 'ok', ms: '4 ms', l: 1, w: 1, input: J(PAYLOAD), output: J({ is_valid: true, rules_passed: 2, rules_total: 2 }) },
  { n: 3, t: 'Save to database', sub: 'PostgreSQL, customers', st: 'ok', ms: '86 ms', l: 2, w: 1, input: J({ table: 'customers', values: { email: PAYLOAD.email, first_name: 'Ada', company: PAYLOAD.company, plan: 'Growth' } }), output: J({ customer_id: 'cus_90417', action: 'inserted', created_at: '2026-11-05T10:42:19Z' }) },
  { n: 4, t: 'Send welcome email', sub: 'Gmail, failed after 3 retries', st: 'err', ms: '38.1 s', l: 3, w: 97, input: J({ from: 'hello@meridianlogistics.example', to: PAYLOAD.email, subject: 'Welcome to Meridian, Ada' }), err: ERR, doneOut: J({ message_id: '18f3a9c2e1b04d77', accepted: [PAYLOAD.email] }) },
  { n: 5, t: 'Notify sales team', sub: 'Skipped, an earlier step failed', st: 'skip', ms: 'Not run', l: 0, w: 0, input: J({ channel: '#sales-leads' }), doneOut: J({ channel: '#sales-leads', ts: '1793875339.0021' }) }
];
const LOGS = [
  { c: '', t: '10:42:18.204', m: 'Run started by webhook. Workflow version 14.' },
  { c: 'o1', t: '10:42:18.216', m: 'Webhook trigger succeeded. Signature verified.' },
  { c: 'o1', t: '10:42:18.220', m: 'Validate customer succeeded. Took the Valid path.' },
  { c: 'o1', t: '10:42:18.306', m: 'Save to database succeeded. Inserted cus_90417.' },
  { c: 'w1', t: '10:42:18.912', m: 'Send welcome email: attempt 1 returned 429. Retry in 5 s.' },
  { c: 'w1', t: '10:42:24.640', m: 'Send welcome email: attempt 2 returned 429. Retry in 10 s.' },
  { c: 'w1', t: '10:42:35.301', m: 'Send welcome email: attempt 3 returned 429. Retry in 20 s.' },
  { c: 'e1', t: '10:42:56.402', m: 'Send welcome email: attempt 4 returned 429. Retries exhausted.' },
  { c: 'e1', t: '10:42:56.404', m: 'Run failed at step 4. Notify sales team skipped.' }
];
const RP = [
  { s: ['run','wait','wait','wait','wait'], l: [0,0,0,0], f: 1 },
  { s: ['ok','run','wait','wait','wait'], l: [100,0,0,0], f: 2 },
  { s: ['ok','ok','run','wait','wait'], l: [100,100,0,0], f: 3 },
  { s: ['ok','ok','ok','run','wait'], l: [100,100,100,0], f: 4 },
  { s: ['ok','ok','ok','retry','wait'], l: [100,100,100,0], f: 4, sub: 'Retry 1 of 3, waiting 5 s' },
  { s: ['ok','ok','ok','retry','wait'], l: [100,100,100,0], f: 4, sub: 'Retry 2 of 3, waiting 10 s' },
  { s: ['ok','ok','ok','retry','wait'], l: [100,100,100,0], f: 4, sub: 'Retry 3 of 3, waiting 20 s' },
  { s: ['ok','ok','ok','err','wait'], l: [100,100,100,0], f: 4 },
  { s: ['ok','ok','ok','err','skip'], l: [100,100,100,0], f: 4 }
];
const RP_SUB = { wait: 'Waiting', run: 'Running', err: 'Failed after 3 retries', skip: 'Skipped' };
class Component extends DCLogic {
  state = { sel: 4, tab: 'err', phase: 'failed', active: 0, modal: false, toast: '', extra: [], rp: 8, playing: false, retryOpen: false };
  rpGo(i) {
    const f = RP[i].f, err = RP[i].s[3] === 'err' && f === 4;
    this.setState({ rp: i, sel: f, tab: err ? 'err' : (this.state.tab === 'logs' ? 'logs' : 'in') });
  }
  rpPlay() {
    this.setState({ playing: true });
    const next = () => {
      if (!this.state.playing) return;
      if (this.state.rp >= RP.length - 1) { this.setState({ playing: false }); return; }
      this.rpGo(this.state.rp + 1);
      this.rpT = setTimeout(next, 850);
      this.timers.push(this.rpT);
    };
    this.rpGo(this.state.rp >= RP.length - 1 ? 0 : this.state.rp);
    this.rpT = setTimeout(next, 850);
    this.timers.push(this.rpT);
  }
  timers = [];
  componentWillUnmount() { this.timers.forEach(clearTimeout); }
  later(fn, ms) { this.timers.push(setTimeout(fn, ms)); }
  say(t) { this.setState({ toast: t }); this.later(() => this.setState({ toast: '' }), 3500); }
  startRetry() {
    this.setState({ phase: 'retrying', active: 4, modal: false, retryOpen: false, sel: 4, tab: 'logs', extra: [{ c: 'w1', t: '13:34:02.118', m: 'Retry started by ' + FB_ME.n + ', from step 4.' }] });
    this.later(() => this.setState({ active: 5, sel: 5, extra: this.state.extra.concat({ c: 'o1', t: '13:34:02.764', m: 'Send welcome email succeeded in 640 ms.' }) }), 1100);
    this.later(() => {
      this.setState({ phase: 'done', active: 0, extra: this.state.extra.concat({ c: 'o1', t: '13:34:02.975', m: 'Notify sales team succeeded in 210 ms. Run recovered.' }) });
      this.say('Run recovered. Nothing was duplicated.');
    }, 2200);
  }
  renderVals() {
    const s = this.state, done = s.phase === 'done', retrying = s.phase === 'retrying';
    const statusOf = (st) => {
      if (done) return 'ok';
      if (retrying && st.n === s.active) return 'run';
      if (retrying && st.n === 4 && s.active === 5) return 'ok';
      return st.st;
    };
    const steps = STEPS.map((st) => {
      const x = statusOf(st), failing = x === 'err';
      const recovered = (done || (retrying && s.active === 5)) && st.n === 4;
      return {
        ...st, st: x,
        ic: x === 'ok' ? 'check' : x === 'err' ? 'x' : x === 'run' ? 'loader' : 'minus',
        spin: x === 'run' ? 'spin' : '',
        cls: (st.n === s.sel ? 'is-on ' : '') + (failing ? 'is-fail' : ''),
        pressed: st.n === s.sel ? 'true' : 'false',
        sub: x === 'run' ? 'Running now' : recovered ? 'Gmail, sent on retry' : done && st.n === 5 ? 'Slack, #sales-leads' : st.sub,
        ms: x === 'run' ? '' : recovered ? '640 ms' : done && st.n === 5 ? '210 ms' : st.ms,
        barCls: failing ? 'err' : '', barL: st.l, barW: done && st.n === 5 ? 1 : st.w,
        pick: () => this.setState({ sel: st.n, tab: st.n === 4 && s.phase === 'failed' ? 'err' : 'in' })
      };
    });
    const c = steps[s.sel - 1], raw = STEPS[s.sel - 1], cs = c.st;
    const hasErr = cs === 'err';
    const out = cs === 'ok' ? (raw.output || raw.doneOut) : '';
    const ev = RP[s.rp], log = LOGS[s.rp];
    return {
      rp: s.rp, rpMax: RP.length - 1, rpPos: s.rp + 1, rpTotal: RP.length,
      rpCap: log.t + '  ' + log.m,
      rpPlayL: s.playing ? 'Pause' : 'Play', rpPlayIc: s.playing ? 'stop' : 'play',
      rpToggle: () => { if (s.playing) this.setState({ playing: false }); else this.rpPlay(); },
      rpScrub: (e) => { this.setState({ playing: false }); this.rpGo(Number(e.target.value)); },
      rpNodes: STEPS.map((st, i) => {
        const x = ev.s[i];
        return {
          t: st.t, cls: x === 'run' ? 'running' : x,
          sub: x === 'retry' ? ev.sub : x === 'ok' ? st.ms : RP_SUB[x],
          more: i < STEPS.length - 1, link: ev.l[i] ?? 0,
          pick: () => this.setState({ sel: st.n, tab: st.n === 4 && s.phase === 'failed' ? 'err' : 'in' })
        };
      }),
      debugOpen: !!s.debugOpen, appDisplay: s.debugOpen ? 'none' : 'flex',
      debugBuilder: () => { this.timers.forEach(clearTimeout); this.setState({ debugOpen: true, playing: false }); },
      retryOpen: s.retryOpen, toggleRetry: () => this.setState({ retryOpen: !s.retryOpen }),
      status: done ? { b: 'b-ok', ic: 'check', l: 'Recovered', spin: '' } : retrying ? { b: 'b-run', ic: 'loader', l: 'Retrying', spin: 'spin' } : { b: 'b-err', ic: 'x', l: 'Failed', spin: '' },
      isFailed: s.phase === 'failed', isDone: done, canRetry: !!FB_C.retry && s.phase === 'failed', canEdit: !!FB_C.edit,
      overview: [
        { l: 'Started', v: 'Today, 10:42:18' }, { l: 'Duration', v: '38.2 s' }, { l: 'Run type', v: 'Live, from webhook' },
        { l: 'Workflow version', v: 'Version 14' }, { l: 'Steps completed', v: done ? '5 of 5' : '3 of 5' }
      ],
      steps,
      cur: {
        n: c.n, t: c.t, err: hasErr ? raw.err : '', input: raw.input, output: out,
        lab: cs === 'ok' ? 'Success' : cs === 'err' ? 'Failed' : cs === 'run' ? 'Running' : 'Skipped',
        b: cs === 'ok' ? 'b-ok' : cs === 'err' ? 'b-err' : cs === 'run' ? 'b-run' : 'b-off',
        noOutMsg: cs === 'err' ? 'This step produced no output because it failed. See the Error tab.' : cs === 'run' ? 'This step is still running.' : 'This step did not run, because an earlier step failed.'
      },
      tabs: [['err', 'Error'], ['in', 'Input'], ['out', 'Output'], ['logs', 'Logs']].filter(([id]) => FB_C.data || (id !== 'in' && id !== 'out')).map(([id, l]) => ({ l, cls: s.tab === id ? 'is-on' : '', sel: s.tab === id ? 'true' : 'false', pick: () => this.setState({ tab: id }) })),
      tabErr: s.tab === 'err', tabIn: s.tab === 'in', tabOut: s.tab === 'out', tabLogs: s.tab === 'logs',
      noErr: !hasErr, noOut: !out,
      attempts: [
        { n: 'Attempt 1', t: '10:42:18', r: '429 rateLimitExceeded', w: 'Waited 5 s' },
        { n: 'Attempt 2', t: '10:42:24', r: '429 rateLimitExceeded', w: 'Waited 10 s' },
        { n: 'Attempt 3', t: '10:42:35', r: '429 rateLimitExceeded', w: 'Waited 20 s' },
        { n: 'Attempt 4', t: '10:42:56', r: '429 rateLimitExceeded', w: 'Stopped' }
      ],
      logs: LOGS.concat(s.extra),
      retry: () => this.startRetry(),
      askRestart: () => this.setState({ modal: true }), closeModal: () => this.setState({ modal: false }),
      restart: () => this.startRetry(),
      modal: s.modal, toast: s.toast
    };
  }
}

return Component;
});
FB.def("Executions",[{"t":"div","a":{"class":"app"},"c":[{"t":"dc-import","a":{"name":"Sidebar","active":"executions","hint-size":"232px,100vh"},"c":[]},{"t":"div","a":{"class":"main"},"c":[{"t":"dc-import","a":{"name":"Topbar","page":"{{pageName}}","hint-size":"100%,56px"},"c":[]},{"t":"main","a":{"class":"page"},"c":[{"t":"div","a":{"class":"page-head"},"c":[{"t":"div","a":{},"c":[{"t":"h1","a":{"class":"page-title"},"c":["{{pageName}}"]},{"t":"p","a":{"class":"page-sub"},"c":["{{pageSub}}"]}]},{"t":"sc-if","a":{"value":"{{canExport}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"button","a":{"class":"btn","onClick":"{{exportCsv}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"download","s":"15","hint-size":"15px,15px"},"c":[]},"Export CSV"]}]}]},{"t":"section","a":{"class":"card stats","aria-label":"Execution totals, last 30 days"},"c":[{"t":"sc-for","a":{"list":"{{stats}}","as":"s","hint-placeholder-count":"4"},"c":[{"t":"div","a":{"class":"stat"},"c":[{"t":"span","a":{"class":"stat-l"},"c":[{"t":"span","a":{"class":"dot {{s.dot}}"},"c":[]},"{{s.l}}"]},{"t":"span","a":{"class":"stat-v"},"c":["{{s.v}}"]}]}]}]},{"t":"div","a":{"class":"row wrap","style":"gap: 10px"},"c":[{"t":"sc-if","a":{"value":"{{canExport}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"div","a":{"class":"seg-ctl","role":"group","aria-label":"Run type"},"c":[{"t":"sc-for","a":{"list":"{{modes}}","as":"m","hint-placeholder-count":"3"},"c":[{"t":"button","a":{"class":"{{m.cls}}","aria-pressed":"{{m.on}}","onClick":"{{m.pick}}"},"c":["{{m.l}}"]}]}]}]},{"t":"div","a":{"class":"row wrap","style":"gap: 6px","role":"group","aria-label":"Filter by status"},"c":[{"t":"sc-for","a":{"list":"{{chips}}","as":"c","hint-placeholder-count":"5"},"c":[{"t":"button","a":{"class":"chip {{c.cls}}","aria-pressed":"{{c.on}}","onClick":"{{c.pick}}"},"c":["{{c.l}}"]}]}]},{"t":"div","a":{"class":"grow"},"c":[]},{"t":"span","a":{"class":"row f-i","style":"gap: 6px"},"c":[{"t":"label","a":{"class":"small muted","for":"ex-wf"},"c":["Workflow"]},{"t":"select","a":{"id":"ex-wf","class":"select","style":"width: 210px","value":"{{wf}}","onChange":"{{onWf}}"},"c":[{"t":"sc-for","a":{"list":"{{wfOptions}}","as":"o"},"c":[{"t":"option","a":{"value":"{{o}}"},"c":["{{o}}"]}]}]}]},{"t":"span","a":{"class":"row f-i","style":"gap: 6px"},"c":[{"t":"label","a":{"class":"small muted","for":"ex-date"},"c":["Date"]},{"t":"select","a":{"id":"ex-date","class":"select","style":"width: 140px","value":"{{date}}","onChange":"{{onDate}}"},"c":[{"t":"option","a":{"value":"today"},"c":["Today"]},{"t":"option","a":{"value":"7"},"c":["Last 7 days"]},{"t":"option","a":{"value":"30"},"c":["Last 30 days"]}]}]}]},{"t":"section","a":{"class":"card"},"c":[{"t":"div","a":{"class":"tbl-wrap"},"c":[{"t":"table","a":{"class":"tbl"},"c":[{"t":"thead","a":{},"c":[{"t":"tr","a":{},"c":[{"t":"th","a":{},"c":["Workflow"]},{"t":"th","a":{"class":"hide-m hide-t"},"c":["Execution ID"]},{"t":"th","a":{"class":"hide-m hide-t"},"c":["Run type"]},{"t":"th","a":{"class":"hide-m hide-t"},"c":["Trigger"]},{"t":"th","a":{"class":"hide-m"},"c":["Steps"]},{"t":"th","a":{},"c":["Status"]},{"t":"th","a":{"class":"hide-m"},"c":["Started"]},{"t":"th","a":{"class":"r hide-m hide-t"},"c":["Duration"]},{"t":"th","a":{"class":"r"},"c":[{"t":"span","a":{"style":"position: absolute; width: 1px; height: 1px; overflow: hidden"},"c":["Actions"]}]}]}]},{"t":"tbody","a":{},"c":[{"t":"sc-for","a":{"list":"{{rows}}","as":"r","hint-placeholder-count":"10"},"c":[{"t":"tr","a":{"class":"{{r.rowCls}}"},"c":[{"t":"td","a":{},"c":[{"t":"a","a":{"class":"link-row","href":"/executions"},"c":["{{r.wf}}"]},{"t":"sc-if","a":{"value":"{{r.note}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"small","style":"color: var(--err)"},"c":["{{r.note}}"]}]}]},{"t":"td","a":{"class":"hide-m hide-t"},"c":[{"t":"span","a":{"class":"mono"},"c":["{{r.id}}"]}]},{"t":"td","a":{"class":"hide-m hide-t"},"c":[{"t":"span","a":{"class":"badge {{r.modeCls}}","style":"padding: 0 8px"},"c":["{{r.mode}}"]},{"t":"div","a":{"class":"small dim"},"c":["{{r.ver}}"]}]},{"t":"td","a":{"class":"hide-m hide-t"},"c":[{"t":"span","a":{"class":"row muted","style":"gap: 6px"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{r.tIc}}","s":"14","hint-size":"14px,14px"},"c":[]},"{{r.trig}}"]}]},{"t":"td","a":{"class":"hide-m"},"c":[{"t":"span","a":{"class":"trace","title":"{{r.traceLabel}}"},"c":[{"t":"sc-for","a":{"list":"{{r.traceSegs}}","as":"t"},"c":[{"t":"i","a":{"class":"seg {{t}}"},"c":[]}]}]}]},{"t":"td","a":{},"c":[{"t":"span","a":{"class":"badge {{r.b}}"},"c":[{"t":"span","a":{"class":"row {{r.spin}}","style":"gap: 0"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{r.ic}}","s":"13","hint-size":"13px,13px"},"c":[]}]},"{{r.label}}"]}]},{"t":"td","a":{"class":"hide-m muted"},"c":["{{r.at}}"]},{"t":"td","a":{"class":"r num hide-m hide-t"},"c":["{{r.dur}}"]},{"t":"td","a":{"class":"r"},"c":[{"t":"sc-if","a":{"value":"{{r.canRetry}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"button","a":{"class":"btn btn-sm","onClick":"{{r.retry}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"retry","s":"13","hint-size":"13px,13px"},"c":[]},"Retry"]}]},{"t":"sc-if","a":{"value":"{{r.canView}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"a","a":{"class":"btn btn-sm btn-g","href":"/executions"},"c":["View"]}]}]}]}]}]}]}]},{"t":"sc-if","a":{"value":"{{none}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"empty"},"c":[{"t":"div","a":{"class":"empty-ic"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"runs","s":"22","hint-size":"22px,22px"},"c":[]}]},{"t":"div","a":{"class":"strong"},"c":["No runs match these filters"]},{"t":"button","a":{"class":"btn","onClick":"{{clear}}"},"c":["Clear filters"]}]}]}]},{"t":"div","a":{"class":"row between small muted wrap"},"c":[{"t":"span","a":{},"c":["Showing {{count}} of {{matched}} runs. History is kept for 90 days."]},{"t":"div","a":{"class":"row"},"c":[{"t":"button","a":{"class":"btn btn-sm","disabled":"{{ true }}"},"c":["Previous"]},{"t":"button","a":{"class":"btn btn-sm"},"c":["Next"]}]}]}]}]},{"t":"sc-if","a":{"value":"{{toast}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"toast","role":"status"},"c":["{{toast}}"]}]}]}],{},function(DCLogic){

const FB_ACC = {
  admin: { k: 'admin', n: 'Jonah Thomas', f: 'Jonah', i: 'JT', a: 'a5', r: 'Administrator', e: 'jonah@meridianlogistics.example' },
  creator: { k: 'creator', n: 'Priya Raman', f: 'Priya', i: 'PR', a: '', r: 'Workflow Creator', e: 'priya@meridianlogistics.example' },
  operator: { k: 'operator', n: 'Rahul Shah', f: 'Rahul', i: 'RS', a: 'a3', r: 'Technical Operator', e: 'rahul@meridianlogistics.example' },
  business: { k: 'business', n: 'Lena Costa', f: 'Lena', i: 'LC', a: 'a2', r: 'Business User', e: 'lena@meridianlogistics.example' }
};
const FB_CANS = {
  admin: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 1 },
  creator: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 0 },
  operator: { edit: 0, builder: 1, publish: 0, retry: 1, data: 1, integ: 0, integView: 1, admin: 0 },
  business: { edit: 0, builder: 0, publish: 0, retry: 0, data: 0, integ: 0, integView: 0, admin: 0 }
};
const fbStored = () => { let k = ''; try { k = localStorage.getItem('fb-role') || ''; } catch (e) {} if (!k) { try { const m = /fb-role:(\w+)/.exec(window.name || ''); if (m) k = m[1]; } catch (e) {} } return FB_ACC[k] ? k : ''; };
const fbSetRole = (k) => { try { if (k) localStorage.setItem('fb-role', k); else localStorage.removeItem('fb-role'); } catch (e) {} try { window.name = k ? 'fb-role:' + k : ''; } catch (e) {} };
const FB_ME = FB_ACC[fbStored() || 'creator'], FB_C = FB_CANS[FB_ME.k];
const ST = {
  ok: { b: 'b-ok', ic: 'check', label: 'Success', spin: '' },
  err: { b: 'b-err', ic: 'x', label: 'Failed', spin: '' },
  run: { b: 'b-run', ic: 'loader', label: 'Running', spin: 'spin' },
  retry: { b: 'b-warn', ic: 'clock', label: 'Retrying', spin: '' }
};
const TRIG = { Webhook: 'webhook', Schedule: 'calendar', Manual: 'cursor' };
const DATA = [
  { wf: 'Invoice paid to ledger', id: 'EX-48214', trig: 'Webhook', s: 'run', t: ['ok','ok','run','skip'], tl: 'Running step 3 of 4', at: 'Today, 10:43:02', dur: '1.9 s' },
  { wf: 'New customer onboarding', id: 'EX-48213', trig: 'Webhook', s: 'err', t: ['ok','ok','ok','err','skip'], tl: 'Failed at step 4 of 5', note: 'Failed at Send welcome email', at: 'Today, 10:42:18', dur: '38.2 s' },
  { wf: 'Support ticket triage', id: 'EX-48212', trig: 'Webhook', s: 'ok', t: ['ok','ok','ok','ok'], tl: 'All 4 steps succeeded', at: 'Today, 10:41:40', dur: '1.6 s' },
  { wf: 'Support ticket triage', id: 'EX-48211', trig: 'Webhook', s: 'err', t: ['ok','err','skip','skip'], tl: 'Failed at step 2 of 4', note: 'Failed at Post to on-call: Slack channel not found', at: 'Today, 10:39:12', dur: '0.8 s' },
  { wf: 'Lead sync to PostgreSQL', id: 'EX-48210', trig: 'Schedule', s: 'retry', t: ['ok','run','skip'], tl: 'Retrying step 2 of 3', at: 'Today, 10:38:00', dur: '12.4 s' },
  { wf: 'New customer onboarding', id: 'EX-48209', trig: 'Webhook', s: 'ok', t: ['ok','ok','ok','ok','ok'], tl: 'All 5 steps succeeded', at: 'Today, 10:36:27', dur: '2.8 s' },
  { wf: 'Invoice paid to ledger', id: 'EX-48208', trig: 'Webhook', s: 'ok', t: ['ok','ok','ok','ok'], tl: 'All 4 steps succeeded', at: 'Today, 10:31:55', dur: '1.2 s' },
  { wf: 'Overdue task reminders', id: 'EX-48207', trig: 'Schedule', s: 'ok', t: ['ok','ok','ok'], tl: 'All 3 steps succeeded', at: 'Today, 09:00:00', dur: '3.1 s' },
  { wf: 'Lead sync to PostgreSQL', id: 'EX-48202', trig: 'Schedule', s: 'err', t: ['ok','err','skip'], tl: 'Failed at step 2 of 3', note: 'Failed at Insert leads: connection timed out', at: 'Today, 08:30:00', dur: '30.4 s' },
  { wf: 'Refund approval routing', id: 'EX-48198', trig: 'Manual', s: 'ok', t: ['ok','ok'], tl: 'All 2 steps succeeded', at: 'Yesterday, 17:52:10', dur: '0.9 s' }
];
const VER = { 'New customer onboarding': 'Version 14', 'Invoice paid to ledger': 'Version 9', 'Support ticket triage': 'Version 22', 'Lead sync to PostgreSQL': 'Version 6', 'Overdue task reminders': 'Version 3', 'Refund approval routing': 'Draft' };
const ALL = DATA.map((r) => ({ ...r, mode: r.trig === 'Manual' ? 'Test' : 'Live' })).concat([
  { wf: 'New customer onboarding', id: 'EX-48206', trig: 'Manual', s: 'err', t: ['ok','ok','ok','err','skip'], tl: 'Test failed at step 4 of 5', note: 'Test run: Gmail limit reached', at: 'Today, 08:52:41', dur: '36.3 s', mode: 'Test' },
  { wf: 'New customer onboarding', id: 'EX-48205', trig: 'Manual', s: 'ok', t: ['ok','ok','ok','ok','ok'], tl: 'All 5 steps succeeded in a test', at: 'Today, 08:50:12', dur: '1.0 s', mode: 'Test' }
]);
class Component extends DCLogic {
  state = { f: FB_ME.k === 'operator' ? 'err' : 'all', wf: 'All workflows', date: '30', mode: 'Live', data: ALL, toast: '' };
  componentWillUnmount() { (this.timers || []).forEach(clearTimeout); }
  say(t) { this.setState({ toast: t }); (this.timers = this.timers || []).push(setTimeout(() => this.setState({ toast: '' }), 3500)); }
  renderVals() {
    const s = this.state;
    const rows = s.data.filter((r) => (s.mode === 'All' || r.mode === s.mode) && (s.f === 'all' || r.s === s.f || (s.f === 'run' && r.s === 'retry')) && (s.wf === 'All workflows' || r.wf === s.wf) && (s.date !== 'today' || r.at.startsWith('Today')));
    return {
      pageName: FB_ME.k === 'business' ? 'Activity' : 'Executions', canExport: FB_ME.k !== 'business', pageSub: { business: 'What your automations have done recently.', operator: 'Showing failed runs first. Choose All to see every run.' }[FB_ME.k] || 'Every workflow run, and which step it reached. Totals count live runs only, so testing never skews your numbers.',
      modes: ['Live', 'Test', 'All'].map((l) => ({ l, cls: s.mode === l ? 'is-on' : '', on: s.mode === l ? 'true' : 'false', pick: () => this.setState({ mode: l }) })),
      stats: [
        { l: 'Total live executions', v: '18,321', dot: '' },
        { l: 'Successful', v: '17,912', dot: 'ok' },
        { l: 'Failed', v: '402', dot: 'err' },
        { l: 'Running now', v: '7', dot: 'run' }
      ],
      chips: [['all', 'All'], ['err', 'Failed'], ['run', 'Running'], ['ok', 'Successful']].map(([id, l]) => ({ l, cls: s.f === id ? 'is-on' : '', on: s.f === id ? 'true' : 'false', pick: () => this.setState({ f: id }) })),
      wf: s.wf, onWf: (e) => this.setState({ wf: e.target.value }),
      wfOptions: ['All workflows', ...new Set(DATA.map((r) => r.wf))],
      date: s.date, onDate: (e) => this.setState({ date: e.target.value }),
      rows: rows.map((r) => ({
        ...r, ...ST[r.s], tIc: TRIG[r.trig], traceSegs: r.t, traceLabel: r.tl, note: r.note || '',
        modeCls: r.mode === 'Test' ? 'b-test' : 'b-off', ver: VER[r.wf] || '',
        rowCls: r.s === 'err' ? 'is-fail' : '', canRetry: !!FB_C.retry && r.s === 'err' && r.mode === 'Live', canView: !(FB_C.retry && r.s === 'err' && r.mode === 'Live'),
        retry: () => {
          this.setState({ data: s.data.map((x) => (x.id === r.id ? { ...x, s: 'run', note: '', t: x.t.map((seg) => (seg === 'err' ? 'run' : seg)), tl: 'Retrying from the failed step' } : x)) });
          this.say('Retrying ' + r.id + ' from the failed step. This counts as 1 run.');
          (this.timers = this.timers || []).push(setTimeout(() => {
            this.setState({ data: this.state.data.map((x) => (x.id === r.id ? { ...x, s: 'ok', t: x.t.map(() => 'ok'), tl: 'All steps succeeded after retry', dur: x.dur } : x)) });
            this.say(r.id + ' succeeded after retry.');
          }, 1600));
        }
      })),
      none: rows.length === 0, count: rows.length, matched: s.f === 'all' && s.wf === 'All workflows' && s.date === '30' && s.mode === 'Live' ? '18,321' : rows.length,
      clear: () => this.setState({ f: 'all', wf: 'All workflows', date: '30', mode: 'Live' }),
      exportCsv: () => this.say('Export started. The CSV will be emailed to you when it is ready.'),
      toast: s.toast
    };
  }
}

return Component;
});
FB.def("Home",[{"t":"div","a":{"id":"h-root","style":"background: #14100C; min-height: 100vh"},"c":[{"t":"div","a":{"id":"h-prog","class":"h-prog"},"c":[]},{"t":"div","a":{"style":"position: sticky; top: 0; z-index: 30"},"c":[{"t":"dc-import","a":{"name":"SiteNav","tone":"dark","on-jump":"{{jump}}","hint-size":"100%,65px"},"c":[]}]},{"t":"section","a":{"class":"h-hero","onPointerMove":"{{heroMove}}"},"c":[{"t":"div","a":{"class":"h-blob h-b1"},"c":[]},{"t":"div","a":{"class":"h-blob h-b2"},"c":[]},{"t":"div","a":{"class":"h-blob h-b3"},"c":[]},{"t":"div","a":{"class":"h-dots"},"c":[]},{"t":"div","a":{"class":"h-spot"},"c":[]},{"t":"div","a":{"class":"h-wrap","style":"position: relative"},"c":[{"t":"div","a":{"class":"h-top"},"c":[{"t":"div","a":{},"c":[{"t":"div","a":{"class":"h-eyebrow"},"c":[{"t":"span","a":{"class":"h-pulse"},"c":[]},"Try it below. Nothing to install."]},{"t":"h1","a":{},"c":["Automate your ",{"t":"span","a":{"class":"h-words"},"c":[{"t":"sc-for","a":{"list":"{{words}}","as":"w","hint-placeholder-count":"4"},"c":[{"t":"span","a":{"class":"h-g {{w.cls}}"},"c":["{{w.t}}"]}]}]}," and see every step."]}]},{"t":"div","a":{"class":"h-side"},"c":[{"t":"p","a":{},"c":["FlowBridge runs your business processes across the tools you already use. When something fails, it shows the exact step, the reason and what to do next."]},{"t":"div","a":{"class":"h-cta"},"c":[{"t":"a","a":{"class":"h-btn h-btn-p","href":"/register"},"c":["Get started",{"t":"dc-import","a":{"name":"Icon","g":"arrow","s":"16","hint-size":"16px,16px"},"c":[]}]},{"t":"a","a":{"class":"h-btn h-btn-g","href":"/docs"},"c":["Read the docs"]}]}]}]},{"t":"div","a":{"class":"h-stage","aria-label":"Interactive workflow demo with sample data"},"c":[{"t":"div","a":{"class":"h-tb"},"c":[{"t":"sc-for","a":{"list":"{{tabs}}","as":"t","hint-placeholder-count":"4"},"c":[{"t":"button","a":{"class":"h-tab {{t.cls}}","aria-pressed":"{{t.on}}","onClick":"{{t.pick}}"},"c":["{{t.n}}"]}]},{"t":"span","a":{"style":"flex: 1"},"c":[]},{"t":"button","a":{"class":"h-break {{breakCls}}","aria-pressed":"{{breakOn}}","onClick":"{{toggleBreak}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"alert","s":"14","hint-size":"14px,14px"},"c":[]},"{{breakLabel}}"]},{"t":"button","a":{"class":"h-run","disabled":"{{running}}","onClick":"{{runNow}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{runIc}}","s":"13","hint-size":"13px,13px"},"c":[]},"{{runLabel}}"]}]},{"t":"div","a":{"class":"h-body"},"c":[{"t":"div","a":{"class":"h-canvas","onPointerMove":"{{dragMove}}","onPointerUp":"{{dragEnd}}","onPointerLeave":"{{dragEnd}}"},"c":[{"t":"div","a":{"class":"sig-world","style":"transform: scale({{scale}}); opacity: {{worldOp}}; transition: opacity .18s"},"c":[{"t":"svg","a":{"class":"sig-edges","aria-hidden":"true"},"c":[{"t":"sc-for","a":{"list":"{{edges}}","as":"e","hint-placeholder-count":"5"},"c":[{"t":"path","a":{"class":"sig-e {{e.cls}}","d":"{{e.d}}"},"c":[]}]}]},{"t":"sc-for","a":{"list":"{{edges}}","as":"e","hint-placeholder-count":"5"},"c":[{"t":"sc-if","a":{"value":"{{e.flowing}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"packet","style":"offset-path: path('{{e.d}}')"},"c":[]}]}]},{"t":"sc-for","a":{"list":"{{nodes}}","as":"n","hint-placeholder-count":"5"},"c":[{"t":"div","a":{"class":"sig-n {{n.cls}}","style":"left: {{n.x}}px; top: {{n.y}}px","role":"button","aria-label":"{{n.t}}, show its data","onPointerDown":"{{n.down}}"},"c":[{"t":"sc-if","a":{"value":"{{n.logo}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"{{n.logo}}","s":"30","hint-size":"30px,30px"},"c":[]}]},{"t":"sc-if","a":{"value":"{{n.noLogo}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"span","a":{"class":"sig-ic"},"c":[{"t":"span","a":{"class":"row {{n.spin}}","style":"gap: 0"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{n.icon}}","s":"15","hint-size":"15px,15px"},"c":[]}]}]}]},{"t":"span","a":{"style":"min-width: 0"},"c":[{"t":"span","a":{"class":"trunc","style":"display: block"},"c":["{{n.t}}"]},{"t":"small","a":{"class":"trunc"},"c":["{{n.sub}}"]}]}]}]}]},{"t":"sc-if","a":{"value":"{{showHint}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"div","a":{"class":"h-hint"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"cursor","s":"13","hint-size":"13px,13px"},"c":[]},"Drag a step, or click it to see its data"]}]},{"t":"sc-if","a":{"value":"{{failed}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"h-alert","role":"status"},"c":[{"t":"div","a":{"class":"grow"},"c":[{"t":"b","a":{},"c":["{{failT}}"]},{"t":"small","a":{},"c":["{{failWhy}}"]}]},{"t":"button","a":{"class":"h-run","onClick":"{{fix}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"retry","s":"13","hint-size":"13px,13px"},"c":[]},"Fix and retry"]}]}]}]},{"t":"div","a":{"class":"h-log"},"c":[{"t":"sc-if","a":{"value":"{{hasSel}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"h-log-h"},"c":[{"t":"span","a":{},"c":["Data from {{selName}}"]},{"t":"button","a":{"aria-label":"Close step data","style":"background: none; border: 0; color: #C1BAB3; padding: 0","onClick":"{{clearSel}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"x","s":"13","hint-size":"13px,13px"},"c":[]}]}]},{"t":"pre","a":{"class":"h-json"},"c":["{{selJson}}"]}]},{"t":"sc-if","a":{"value":"{{noSel}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"div","a":{"class":"h-log-h"},"c":[{"t":"span","a":{},"c":["Run log"]},{"t":"span","a":{},"c":["sample data"]}]},{"t":"div","a":{"class":"h-log-b"},"c":[{"t":"sc-for","a":{"list":"{{log}}","as":"l","hint-placeholder-count":"6"},"c":[{"t":"div","a":{"class":"h-line {{l.cls}}"},"c":[{"t":"i","a":{},"c":["{{l.t}}"]},"{{l.m}}"]}]}]}]}]}]},{"t":"div","a":{"class":"h-vlist"},"c":[{"t":"sc-for","a":{"list":"{{vrows}}","as":"r","hint-placeholder-count":"5"},"c":[{"t":"div","a":{"class":"h-vrow {{r.cls}}"},"c":[{"t":"sc-if","a":{"value":"{{r.logo}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"{{r.logo}}","s":"26","hint-size":"26px,26px"},"c":[]}]},{"t":"sc-if","a":{"value":"{{r.noLogo}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"span","a":{"class":"h-vi"},"c":[{"t":"span","a":{"class":"row {{r.spin}}","style":"gap: 0"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{r.icon}}","s":"13","hint-size":"13px,13px"},"c":[]}]}]}]},"{{r.t}}",{"t":"small","a":{},"c":["{{r.sub}}"]}]}]},{"t":"sc-if","a":{"value":"{{failed}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"style":"padding: 8px 2px 4px"},"c":[{"t":"p","a":{"class":"small","style":"color: #FFC5CB; margin-bottom: 8px"},"c":["{{failWhy}}"]},{"t":"button","a":{"class":"h-run","onClick":"{{fix}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"retry","s":"13","hint-size":"13px,13px"},"c":[]},"Fix and retry"]}]}]}]}]}]}]},{"t":"section","a":{"class":"h-sec","id":"use-cases"},"c":[{"t":"div","a":{"class":"h-wrap"},"c":[{"t":"div","a":{"data-rv":""},"c":[{"t":"div","a":{"class":"h-kick"},"c":["Use cases"]},{"t":"h2","a":{},"c":["Build one right now. Pick your steps."]}]},{"t":"div","a":{"class":"h-comp","data-rv":""},"c":[{"t":"div","a":{"class":"h-teams","role":"group","aria-label":"Start from a team"},"c":[{"t":"sc-for","a":{"list":"{{teams}}","as":"t","hint-placeholder-count":"4"},"c":[{"t":"button","a":{"class":"h-team {{t.cls}}","aria-pressed":"{{t.on}}","onClick":"{{t.pick}}"},"c":["{{t.l}}"]}]}]},{"t":"div","a":{"class":"h-slots"},"c":[{"t":"sc-for","a":{"list":"{{slots}}","as":"s","hint-placeholder-count":"3"},"c":[{"t":"div","a":{"class":"h-slot","role":"group","aria-label":"{{s.t}}"},"c":[{"t":"div","a":{"class":"h-slot-t"},"c":["{{s.t}}"]},{"t":"sc-for","a":{"list":"{{s.opts}}","as":"o","hint-placeholder-count":"4"},"c":[{"t":"button","a":{"class":"h-opt {{o.cls}}","aria-pressed":"{{o.on}}","onClick":"{{o.pick}}"},"c":[{"t":"sc-if","a":{"value":"{{o.logo}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"{{o.logo}}","s":"24","hint-size":"24px,24px"},"c":[]}]},{"t":"sc-if","a":{"value":"{{o.noLogo}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{o.g}}","s":"15","hint-size":"15px,15px"},"c":[]}]},"{{o.l}}"]}]}]}]}]},{"t":"div","a":{"class":"h-result"},"c":[{"t":"div","a":{"class":"h-say"},"c":["{{say}}"]},{"t":"div","a":{"class":"h-flow"},"c":[{"t":"sc-for","a":{"list":"{{flow}}","as":"f","hint-placeholder-count":"3"},"c":[{"t":"span","a":{"class":"h-flink {{f.linkCls}}","style":"display: {{f.linkShow}}"},"c":[{"t":"i","a":{},"c":[]}]},{"t":"span","a":{"class":"h-fnode {{f.cls}}"},"c":[{"t":"sc-if","a":{"value":"{{f.logo}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"{{f.logo}}","s":"28","hint-size":"28px,28px"},"c":[]}]},{"t":"sc-if","a":{"value":"{{f.noLogo}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"span","a":{"class":"sig-ic","style":"width: 28px; height: 28px"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{f.icon}}","s":"14","hint-size":"14px,14px"},"c":[]}]}]},"{{f.l}}"]}]}]},{"t":"a","a":{"class":"h-btn h-btn-p","style":"height: 40px; font-size: 14px","href":"/register"},"c":["Build this for real",{"t":"dc-import","a":{"name":"Icon","g":"arrow","s":"15","hint-size":"15px,15px"},"c":[]}]}]}]}]}]},{"t":"section","a":{"class":"h-sec","id":"how","style":"background: #FAF8F8"},"c":[{"t":"div","a":{"class":"h-wrap"},"c":[{"t":"div","a":{"data-rv":""},"c":[{"t":"div","a":{"class":"h-kick"},"c":["How it works"]},{"t":"h2","a":{},"c":["From first idea to a running workflow"]}]},{"t":"div","a":{"class":"h-3"},"c":[{"t":"article","a":{"class":"h-card","data-rv":"","onPointerMove":"{{tilt}}","onPointerLeave":"{{untilt}}"},"c":[{"t":"div","a":{"class":"h-art","aria-hidden":"true"},"c":[{"t":"span","a":{"class":"a-t","style":"left: 18%"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"gmail","s":"50","hint-size":"50px,50px"},"c":[]}]},{"t":"span","a":{"class":"a-line"},"c":[]},{"t":"span","a":{"class":"a-dot"},"c":[]},{"t":"span","a":{"class":"a-t","style":"right: 18%"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"slack","s":"50","hint-size":"50px,50px"},"c":[]}]},{"t":"span","a":{"class":"a-ok"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"check","s":"13","hint-size":"13px,13px"},"c":[]}]}]},{"t":"div","a":{"class":"h-cc"},"c":[{"t":"b","a":{},"c":["Connect your apps"]},{"t":"p","a":{},"c":["Sign in to the tools you use. Credentials are encrypted and never shown again."]}]}]},{"t":"article","a":{"class":"h-card","data-rv":"","onPointerMove":"{{tilt}}","onPointerLeave":"{{untilt}}"},"c":[{"t":"div","a":{"class":"h-art","aria-hidden":"true"},"c":[{"t":"span","a":{"class":"a-n","style":"left: 9%"},"c":[]},{"t":"span","a":{"class":"a-c","style":"left: calc(9% + 62px); right: calc(50% + 31px); animation-delay: .35s"},"c":[]},{"t":"span","a":{"class":"a-n","style":"left: 50%; margin-left: -31px; animation-delay: .5s"},"c":[]},{"t":"span","a":{"class":"a-c","style":"left: calc(50% + 31px); right: calc(9% + 62px); animation-delay: .85s"},"c":[]},{"t":"span","a":{"class":"a-n","style":"right: 9%; animation-delay: 1s"},"c":[]}]},{"t":"div","a":{"class":"h-cc"},"c":[{"t":"b","a":{},"c":["Build and test"]},{"t":"p","a":{},"c":["Drag steps onto a canvas, or start from a template. Test with sample data before anything goes live."]}]}]},{"t":"article","a":{"class":"h-card","data-rv":"","onPointerMove":"{{tilt}}","onPointerLeave":"{{untilt}}"},"c":[{"t":"div","a":{"class":"h-art","aria-hidden":"true"},"c":[{"t":"span","a":{"class":"a-sw"},"c":["Publish"]},{"t":"span","a":{"class":"a-tr"},"c":[{"t":"i","a":{"style":"animation-delay: 0s"},"c":[]},{"t":"i","a":{"style":"animation-delay: .25s"},"c":[]},{"t":"i","a":{"style":"animation-delay: .5s"},"c":[]},{"t":"i","a":{"style":"animation-delay: .75s"},"c":[]}]}]},{"t":"div","a":{"class":"h-cc"},"c":[{"t":"b","a":{},"c":["Publish and watch"]},{"t":"p","a":{},"c":["Publish a version when it is ready. Every run is recorded, step by step."]}]}]}]}]}]},{"t":"section","a":{"class":"h-sec h-dark","id":"failures"},"c":[{"t":"div","a":{"class":"h-wrap h-fx"},"c":[{"t":"div","a":{"data-rv":""},"c":[{"t":"div","a":{"class":"h-kick"},"c":["When a run fails"]},{"t":"h2","a":{},"c":["You know why. Then you fix it."]},{"t":"p","a":{"class":"h-lead"},"c":["No digging through logs. FlowBridge retries on its own, tells you what happened in plain language and restarts from the step that failed. Try it."]}]},{"t":"div","a":{"class":"h-box","data-rv":"","aria-live":"polite"},"c":[{"t":"div","a":{"class":"h-row"},"c":[{"t":"span","a":{"class":"h-dot"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"check","s":"12","hint-size":"12px,12px"},"c":[]}]},"Webhook trigger",{"t":"small","a":{},"c":["12 ms"]}]},{"t":"div","a":{"class":"h-row"},"c":[{"t":"span","a":{"class":"h-dot"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"check","s":"12","hint-size":"12px,12px"},"c":[]}]},"Save to database",{"t":"small","a":{},"c":["86 ms"]}]},{"t":"div","a":{"class":"h-row"},"c":[{"t":"span","a":{"class":"h-dot {{fx.mailCls}}"},"c":[{"t":"span","a":{"class":"row {{fx.mailSpin}}","style":"gap: 0"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{fx.mailIc}}","s":"12","hint-size":"12px,12px"},"c":[]}]}]},"Send welcome email",{"t":"small","a":{},"c":["{{fx.mailSub}}"]}]},{"t":"div","a":{"class":"h-why {{fx.whyCls}}"},"c":["{{fx.why}}",{"t":"sc-if","a":{"value":"{{fx.waiting}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"h-bar"},"c":[{"t":"i","a":{},"c":[]}]}]}]},{"t":"div","a":{"class":"h-row","style":"opacity: {{fx.notifyOp}}"},"c":[{"t":"span","a":{"class":"h-dot {{fx.notifyCls}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{fx.notifyIc}}","s":"12","hint-size":"12px,12px"},"c":[]}]},"Notify sales team",{"t":"small","a":{},"c":["{{fx.notifySub}}"]}]},{"t":"div","a":{"class":"h-act"},"c":[{"t":"sc-if","a":{"value":"{{fx.canRetry}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"button","a":{"class":"h-run","onClick":"{{fxRetry}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"retry","s":"13","hint-size":"13px,13px"},"c":[]},"Retry from failed step"]}]},{"t":"sc-if","a":{"value":"{{fx.canReset}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"button","a":{"class":"h-run","style":"background: rgba(255,255,255,.12); color: #fff","onClick":"{{fxReset}}"},"c":["See the failure again"]}]}]}]}]}]},{"t":"section","a":{"class":"h-sec","id":"integrations"},"c":[{"t":"div","a":{"class":"h-wrap","data-rv":""},"c":[{"t":"div","a":{"class":"h-kick"},"c":["Integrations"]},{"t":"h2","a":{},"c":["Works with the tools you already use"]},{"t":"p","a":{"class":"h-lead"},"c":["Pick any tool to see what it connects with. These 26 are examples of what a workflow can use."]}]},{"t":"div","a":{"class":"h-wrap","data-rv":"","style":"margin-top: 32px"},"c":[{"t":"dc-import","a":{"name":"IntegrationHub","start":"stripe","hint-size":"100%,600px"},"c":[]}]}]},{"t":"section","a":{"class":"h-end"},"c":[{"t":"div","a":{"class":"h-blob h-b1","style":"top: 0"},"c":[]},{"t":"div","a":{"class":"h-blob h-b2","style":"top: 40px"},"c":[]},{"t":"div","a":{"class":"h-dots"},"c":[]},{"t":"div","a":{"class":"h-wrap","style":"position: relative","data-rv":""},"c":[{"t":"dc-import","a":{"name":"ClosingFlow","hint-size":"100%,520px"},"c":[]}]}]},{"t":"dc-import","a":{"name":"SiteFooter","on-jump":"{{jump}}","hint-size":"100%,340px"},"c":[]}]}],{},function(DCLogic){

const W = 178, H = 58, WORLD_W = 1110, WORLD_H = 400;
const WF = [
  { n: 'New customer onboarding', sub: 'Webhook, 4,812 runs',
    nodes: [
      { id: 'a', t: 'Webhook trigger', s: 'New registration', ic: 'webhook', x: 16, y: 106 },
      { id: 'b', t: 'Validate customer', s: 'Email and company', ic: 'split', x: 240, y: 106 },
      { id: 'c', t: 'Save to database', s: 'PostgreSQL', ic: 'db', x: 464, y: 40 },
      { id: 'd', t: 'Send welcome email', s: 'Gmail', ic: 'mail', x: 688, y: 40 },
      { id: 'e', t: 'Notify sales team', s: 'Slack', ic: 'send', x: 912, y: 40 },
      { id: 'f', t: 'Flag invalid lead', s: 'Slack', ic: 'alert', x: 464, y: 176 }
    ],
    edges: [['a','b'],['b','c'],['c','d'],['d','e'],['b','f']],
    seq: [{ n: 'a', ms: 12 }, { e: 0, n: 'b', ms: 4 }, { e: 1, n: 'c', ms: 86 }, { e: 2, n: 'd', ms: 640 }, { e: 3, n: 'e', ms: 210 }], skip: { n: ['f'], e: [4] } },
  { n: 'Invoice paid to ledger', sub: 'Webhook, 3,266 runs',
    nodes: [
      { id: 'a', t: 'Invoice paid', s: 'Webhook', ic: 'webhook', x: 30, y: 106 },
      { id: 'b', t: 'Match the invoice', s: 'HTTP request', ic: 'globe', x: 310, y: 106 },
      { id: 'c', t: 'Add to ledger', s: 'Google Sheets', ic: 'db', x: 590, y: 106 },
      { id: 'd', t: 'Email the receipt', s: 'Gmail', ic: 'mail', x: 870, y: 106 }
    ],
    edges: [['a','b'],['b','c'],['c','d']],
    seq: [{ n: 'a', ms: 10 }, { e: 0, n: 'b', ms: 318 }, { e: 1, n: 'c', ms: 412 }, { e: 2, n: 'd', ms: 590 }], skip: { n: [], e: [] } },
  { n: 'Support ticket triage', sub: 'Webhook, 2,944 runs',
    nodes: [
      { id: 'a', t: 'New ticket', s: 'Webhook', ic: 'webhook', x: 30, y: 106 },
      { id: 'b', t: 'Check priority', s: 'Condition', ic: 'split', x: 300, y: 106 },
      { id: 'c', t: 'Post to on-call', s: 'Slack', ic: 'send', x: 570, y: 40 },
      { id: 'd', t: 'Send auto-reply', s: 'Gmail', ic: 'mail', x: 570, y: 176 },
      { id: 'e', t: 'Log the ticket', s: 'PostgreSQL', ic: 'db', x: 870, y: 40 }
    ],
    edges: [['a','b'],['b','c'],['c','e'],['b','d']],
    seq: [{ n: 'a', ms: 9 }, { e: 0, n: 'b', ms: 3 }, { e: 1, n: 'c', ms: 240, failOnce: 'channel_not_found' }, { e: 2, n: 'e', ms: 92 }], skip: { n: ['d'], e: [3] } },
  { n: 'Lead sync to PostgreSQL', sub: 'Schedule, 2,190 runs',
    nodes: [
      { id: 'a', t: 'Every 15 minutes', s: 'Schedule', ic: 'calendar', x: 30, y: 106 },
      { id: 'b', t: 'Read new rows', s: 'Google Sheets', ic: 'filter', x: 310, y: 106 },
      { id: 'c', t: 'Insert leads', s: 'PostgreSQL', ic: 'db', x: 590, y: 106 },
      { id: 'd', t: 'Post a summary', s: 'Slack', ic: 'send', x: 870, y: 106 }
    ],
    edges: [['a','b'],['b','c'],['c','d']],
    seq: [{ n: 'a', ms: 2 }, { e: 0, n: 'b', ms: 280 }, { e: 1, n: 'c', ms: 5120, retry: true }, { e: 2, n: 'd', ms: 205 }], skip: { n: [], e: [] } }
];
const LOGO_OF = {"Gmail":"gmail","Slack":"slack","PostgreSQL":"pg","Google Sheets":"sheets"};
const OPT_LOGO = { 'Save to database': 'pg', 'Add to Google Sheets': 'sheets', 'Send an email': 'gmail', 'Post to Slack': 'slack', 'Post to Discord': 'discord' };
const WORDS = ['onboarding', 'invoices', 'support tickets', 'lead sync'];
const BRK = [
  { k: 3, why: 'Gmail reached its daily sending limit (429).' },
  { k: 1, why: 'The invoice service did not respond (504).' },
  { k: 2, why: 'Slack could not find that channel (404).' },
  { k: 2, why: 'The database connection timed out.' }
];
const SAMPLE = [
  { company: 'Brightpath Foods', email: 'ada.okafor@brightpath.example', plan: 'Growth' },
  { invoice: 'INV-2291', amount: 1840, currency: 'INR', paid: true },
  { ticket: 'T-5521', priority: 'urgent', subject: 'Cannot sign in' },
  { rows: 12, sheet: 'New leads', inserted: 12 }
];
const OPTS = [
  { t: 'WHEN', o: [['webhook', 'New sign-up', 'someone signs up'], ['webhook', 'Invoice paid', 'an invoice is paid'], ['webhook', 'New ticket', 'a ticket comes in'], ['calendar', 'Every 15 minutes', 'every 15 minutes']] },
  { t: 'THEN', o: [['db', 'Save to database', 'save it to the database'], ['filter', 'Add to Google Sheets', 'add it to Google Sheets'], ['split', 'Check priority', 'check its priority'], ['globe', 'Call an API', 'call your API']] },
  { t: 'FINALLY', o: [['mail', 'Send an email', 'send an email'], ['send', 'Post to Slack', 'post to Slack'], ['alert', 'Alert on-call', 'alert the on-call team'], ['send', 'Post to Discord', 'post to Discord']] }
];
const TEAMS = [['Sales', [0, 0, 1]], ['Finance', [1, 1, 0]], ['Support', [2, 2, 2]], ['Operations', [3, 0, 3]]];
const curve = (a, b) => {
  const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2, d = Math.max(30, Math.abs(x2 - x1) / 2);
  return 'M' + x1 + ' ' + y1 + ' C' + (x1 + d) + ' ' + y1 + ',' + (x2 - d) + ' ' + y2 + ',' + x2 + ' ' + y2;
};
const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const now = () => new Date().toTimeString().slice(0, 8);

class Component extends DCLogic {
  state = {
    cur: 0, exec: {}, edge: {}, sub: {}, fade: false, scale: 0.84, auto: !reduced(), running: false, broken: false, failed: null,
    log: [], pos: {}, sel: null, dragged: false, picks: [0, 0, 1], team: 0, sweep: 0, fx: 'failed'
  };
  timers = []; drag = null; fxT = [];
  later(fn, ms) { const h = setTimeout(fn, ms); this.timers.push(h); return h; }
  clear() { this.timers.forEach(clearTimeout); this.timers = []; }
  say(m, cls) { this.setState((st) => ({ log: st.log.concat({ t: now(), m, cls: cls || '' }).slice(-11) })); }
  measure = () => {
    const el = document.querySelector('.h-canvas');
    if (el && el.offsetWidth) this.setState({ scale: Math.min(1, el.offsetWidth / WORLD_W) });
  };
  onScroll = () => {
    const d = document.documentElement, p = d.scrollTop / Math.max(1, d.scrollHeight - d.clientHeight);
    const b = document.getElementById('h-prog');
    if (b) b.style.setProperty('--p', p.toFixed(4));
  };
  componentDidMount() {
    this.measure();
    const target = location.hash.slice(1);
    if (['use-cases', 'how', 'failures', 'integrations'].includes(target)) setTimeout(() => { const el = document.getElementById(target); if (el) el.scrollIntoView({ block: 'start' }); }, 200);
    window.addEventListener('resize', this.measure);
    window.addEventListener('scroll', this.onScroll, { passive: true });
    setTimeout(this.measure, 300);
    if (this.state.auto) this.later(() => this.run(0), 700); else this.say('Press Run to start.');
    this.sweepT = setInterval(() => { if (this.compVisible && !document.hidden) this.setState((st) => ({ sweep: (st.sweep + 1) % 5 })); }, 800);
    if (window.IntersectionObserver) {
      this.vis = new IntersectionObserver((es) => es.forEach((e) => {
        if (e.target.classList.contains('h-result')) { this.compVisible = e.isIntersecting; return; }
        this.stageVisible = e.isIntersecting;
        if (e.isIntersecting && this.pending !== undefined && this.state.auto) { const p = this.pending; this.pending = undefined; this.run((p + 1) % WF.length); }
      }));
      ['.h-stage', '.h-result'].forEach((q) => { const el = document.querySelector(q); if (el) this.vis.observe(el); });
    } else { this.compVisible = true; this.stageVisible = true; }
    const root = document.getElementById('h-root');
    if (root && window.IntersectionObserver && !reduced()) {
      root.classList.add('rv-on');
      this.io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.setAttribute('data-in', '1'); this.io.unobserve(e.target); } }), { threshold: 0.12 });
      root.querySelectorAll('[data-rv]').forEach((el) => this.io.observe(el));
    }
  }
  componentWillUnmount() {
    this.clear(); this.fxT.forEach(clearTimeout); clearInterval(this.sweepT);
    window.removeEventListener('resize', this.measure); window.removeEventListener('scroll', this.onScroll);
    if (this.io) this.io.disconnect();
    if (this.vis) this.vis.disconnect();
    cancelAnimationFrame(this.hmf);
  }
  run(i) {
    this.clear();
    this.setState({ fade: this.state.cur !== i, running: true, failed: null, sel: null });
    this.later(() => {
      this.setState({ cur: i, exec: {}, edge: {}, sub: {}, fade: false });
      this.say('Run started: ' + WF[i].n);
      this.later(() => this.step(i, 0), 350);
    }, 180);
  }
  done(i) {
    this.setState({ running: false });
    this.say('Run finished. All steps succeeded.', 'ok');
    if (this.state.auto) this.later(() => { if (this.stageVisible === false || document.hidden) this.pending = i; else this.run((i + 1) % WF.length); }, 2400);
  }
  step(i, k) {
    const wf = WF[i], st = wf.seq[k], name = (id) => wf.nodes.find((n) => n.id === id).t;
    if (!st) { this.done(i); return; }
    const runNode = () => {
      const edge = { ...this.state.edge };
      if (st.e !== undefined) edge[st.e] = 'ok';
      this.setState({ edge, exec: { ...this.state.exec, [st.n]: 'running' }, sub: { ...this.state.sub, [st.n]: 'Running' } });
      if (this.state.broken && BRK[i].k === k) {
        const mark = (c, t, m) => { this.setState({ exec: { ...this.state.exec, [st.n]: c }, sub: { ...this.state.sub, [st.n]: t } }); this.say(m, 'warn'); };
        this.later(() => mark('retry', 'Retry 1 of 3', name(st.n) + ': retry 1 of 3'), 450);
        this.later(() => mark('retry', 'Retry 2 of 3', name(st.n) + ': retry 2 of 3'), 1000);
        this.later(() => mark('retry', 'Retry 3 of 3', name(st.n) + ': retry 3 of 3'), 1550);
        this.later(() => {
          const exec = { ...this.state.exec, [st.n]: 'err' }, e2 = { ...this.state.edge }, sub = { ...this.state.sub, [st.n]: 'Failed' };
          if (st.e !== undefined) e2[st.e] = 'err';
          wf.seq.slice(k + 1).forEach((r) => { exec[r.n] = 'skip'; if (r.e !== undefined) e2[r.e] = 'skip'; });
          this.setState({ exec, edge: e2, sub, running: false, failed: { k, n: name(st.n), why: BRK[i].why } });
          this.say(name(st.n) + ' failed. ' + BRK[i].why, 'err');
        }, 2100);
        return;
      }
      this.later(() => {
        const label = st.ms >= 1000 ? (st.ms / 1000).toFixed(1) + ' s' : st.ms + ' ms';
        this.setState({ exec: { ...this.state.exec, [st.n]: 'ok' }, sub: { ...this.state.sub, [st.n]: label } });
        this.say(name(st.n) + ' succeeded in ' + label, 'ok');
        this.step(i, k + 1);
      }, 520);
    };
    if (k === 0) { const exec = {}, edge = {}; wf.skip.n.forEach((n) => { exec[n] = 'skip'; }); wf.skip.e.forEach((e) => { edge[e] = 'skip'; }); this.setState({ exec, edge }); runNode(); return; }
    this.setState({ edge: { ...this.state.edge, [st.e]: 'flow' } });
    this.later(runNode, 560);
  }
  fix() {
    const s = this.state, i = s.cur, wf = WF[i], k = s.failed.k;
    this.clear();
    const exec = { ...s.exec }, edge = { ...s.edge }, sub = { ...s.sub };
    wf.seq.slice(k).forEach((r) => { delete exec[r.n]; delete sub[r.n]; if (r.e !== undefined) delete edge[r.e]; });
    this.setState({ exec, edge, sub, broken: false, failed: null, running: true, auto: true });
    this.say('Fixed. Retrying from ' + s.failed.n + '.');
    this.later(() => this.step(i, k), 250);
  }
  fxRun() {
    this.fxT.forEach(clearTimeout);
    this.setState({ fx: 'waiting' });
    this.fxT = [setTimeout(() => this.setState({ fx: 'sending' }), 2000), setTimeout(() => this.setState({ fx: 'notifying' }), 2800), setTimeout(() => this.setState({ fx: 'done' }), 3500)];
  }
  renderVals() {
    const s = this.state, wf = WF[s.cur], at = (n) => s.pos[s.cur + ':' + n.id] || n;
    const by = Object.fromEntries(wf.nodes.map((n) => [n.id, at(n)]));
    const stateOf = (n) => s.exec[n.id] || '';
    const logoOf = (x, n) => (x === '' || x === 'skip' ? LOGO_OF[n.s] || '' : '');
    const iconOf = (x, ic) => (x === 'ok' ? 'check' : x === 'err' ? 'x' : x === 'running' ? 'loader' : x === 'retry' ? 'clock' : ic);
    const selNode = s.sel && wf.nodes.find((n) => n.id === s.sel);
    const pick = s.picks.map((p, i) => OPTS[i].o[p]);
    const fx = s.fx;
    return {
      heroMove: (e) => {
        const c = e.currentTarget, cx = e.clientX, cy = e.clientY;
        if (this.hmf) return;
        this.hmf = requestAnimationFrame(() => { this.hmf = 0; const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (cx - r.left) + 'px'); c.style.setProperty('--my', (cy - r.top) + 'px'); });
      },
      jump: (id, i) => {
        if (i !== undefined) { const t = TEAMS[i]; if (t) this.setState({ team: i, picks: t[1].slice() }); }
        setTimeout(() => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); }, 60);
      },
      words: WORDS.map((t, i) => ({ t, cls: i === s.cur ? 'is-on' : '' })),
      tabs: WF.map((w, i) => ({ n: w.n, cls: i === s.cur ? 'is-on' : '', on: i === s.cur ? 'true' : 'false', pick: () => this.run(i) })),
      breakOn: s.broken ? 'true' : 'false', breakCls: s.broken ? 'is-on' : '', breakLabel: s.broken ? 'Step will fail' : 'Break a step',
      toggleBreak: () => {
        const broken = !s.broken;
        this.setState({ broken, auto: !broken && s.auto });
        if (broken) { this.say('Next run will fail on purpose.', 'warn'); this.run(s.cur); }
      },
      running: s.running, runIc: s.running ? 'loader' : 'play', runLabel: s.running ? 'Running' : 'Run',
      runNow: () => this.run(s.cur),
      scale: s.scale, worldOp: s.fade ? 0 : 1,
      edges: wf.edges.map(([a, b], i) => ({ d: curve(by[a], by[b]), cls: s.edge[i] || 'h-idle', flowing: s.edge[i] === 'flow' })),
      nodes: wf.nodes.map((n) => {
        const x = stateOf(n), p = at(n);
        return {
          t: n.t, x: p.x, y: p.y, logo: logoOf(x, n), noLogo: !logoOf(x, n), sub: s.sub[n.id] || (x === 'skip' ? 'Skipped' : n.s), icon: iconOf(x, n.ic),
          spin: x === 'running' ? 'spin' : '', cls: x + (s.sel === n.id ? ' is-sel' : ''),
          down: (e) => { e.preventDefault(); this.drag = { id: n.id, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false }; }
        };
      }),
      dragMove: (e) => {
        const d = this.drag;
        if (!d) return;
        const dx = (e.clientX - d.sx) / s.scale, dy = (e.clientY - d.sy) / s.scale;
        if (!d.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
        d.moved = true;
        const x = Math.max(0, Math.min(WORLD_W - W, Math.round(d.ox + dx))), y = Math.max(0, Math.min(WORLD_H - H, Math.round(d.oy + dy)));
        this.setState({ pos: { ...s.pos, [s.cur + ':' + d.id]: { x, y } }, dragged: true, auto: false });
      },
      dragEnd: () => { const d = this.drag; this.drag = null; if (d && !d.moved) this.setState({ sel: d.id, auto: false }); },
      showHint: !s.dragged && !s.failed && !s.sel,
      failed: !!s.failed, failT: s.failed ? s.failed.n + ' failed after 3 retries' : '', failWhy: s.failed ? s.failed.why : '',
      fix: () => this.fix(),
      hasSel: !!selNode, noSel: !selNode, selName: selNode ? selNode.t : '', clearSel: () => { this.setState({ sel: null, auto: !reduced() }); if (!s.running && !s.failed && !reduced()) this.later(() => this.run((s.cur + 1) % WF.length), 1200); },
      selJson: selNode ? JSON.stringify({ step: selNode.t, app: selNode.s, status: s.exec[selNode.id] || 'waiting', data: s.exec[selNode.id] === 'ok' ? SAMPLE[s.cur] : null }, null, 2) : '',
      log: s.log,
      vrows: wf.seq.map((q) => { const n = wf.nodes.find((m) => m.id === q.n), x = stateOf(n); return { t: n.t, logo: logoOf(x, n), noLogo: !logoOf(x, n), sub: s.sub[n.id] || n.s, cls: x, icon: iconOf(x, n.ic), spin: x === 'running' ? 'spin' : '' }; }),
      teams: TEAMS.map(([l, p], i) => ({ l, cls: i === s.team ? 'is-on' : '', on: i === s.team ? 'true' : 'false', pick: () => this.setState({ team: i, picks: p.slice() }) })),
      slots: OPTS.map((g, gi) => ({ t: g.t, opts: g.o.map(([ig, l], oi) => ({ g: ig, l, logo: OPT_LOGO[l] || '', noLogo: !OPT_LOGO[l], cls: s.picks[gi] === oi ? 'is-on' : '', on: s.picks[gi] === oi ? 'true' : 'false',
        pick: () => { const picks = s.picks.slice(); picks[gi] = oi; this.setState({ picks, team: -1, sweep: 0 }); } })) })),
      say: 'When ' + pick[0][2] + ', ' + pick[1][2] + ', then ' + pick[2][2] + '.',
      flow: pick.map((p, i) => ({ logo: s.sweep > i ? '' : OPT_LOGO[p[1]] || '', noLogo: s.sweep > i || !OPT_LOGO[p[1]], icon: s.sweep > i ? 'check' : p[0], l: p[1], linkShow: i ? 'block' : 'none', linkCls: s.sweep >= i && i ? 'is-done' : '', cls: s.sweep === i ? 'is-hot' : s.sweep > i ? 'is-done' : '' })),
      tilt: (e) => { const c = e.currentTarget, r = c.getBoundingClientRect(); c.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 9).toFixed(2) + 'deg'); c.style.setProperty('--rx', (((e.clientY - r.top) / r.height - 0.5) * -9).toFixed(2) + 'deg'); },
      untilt: (e) => { e.currentTarget.style.setProperty('--rx', '0deg'); e.currentTarget.style.setProperty('--ry', '0deg'); },
      fx: {
        mailCls: fx === 'failed' ? 'err' : fx === 'waiting' ? 'warn' : fx === 'sending' ? 'run' : '',
        mailIc: fx === 'failed' ? 'x' : fx === 'waiting' ? 'clock' : fx === 'sending' ? 'loader' : 'check', mailSpin: fx === 'sending' ? 'spin' : '',
        mailSub: fx === 'failed' ? '3 retries used' : fx === 'waiting' ? 'Waiting' : fx === 'sending' ? 'Sending' : '640 ms',
        whyCls: fx === 'failed' ? 'err' : fx === 'done' || fx === 'notifying' ? 'ok' : 'warn', waiting: fx === 'waiting',
        why: fx === 'failed' ? 'Gmail reached its daily sending limit. The customer was saved but not emailed. Retrying will not create a duplicate.' : fx === 'waiting' ? 'Waiting for the sending limit to reset.' : fx === 'sending' ? 'Limit reset. Sending the email now.' : 'Email sent. The customer was only saved once.',
        notifyCls: fx === 'done' ? '' : fx === 'notifying' ? 'run' : 'skip', notifyIc: fx === 'done' ? 'check' : fx === 'notifying' ? 'loader' : 'minus',
        notifySub: fx === 'done' ? '210 ms' : fx === 'notifying' ? 'Sending' : 'Not run', notifyOp: fx === 'done' || fx === 'notifying' ? 1 : 0.55,
        canRetry: fx === 'failed', canReset: fx === 'done'
      },
      fxRetry: () => this.fxRun(), fxReset: () => this.setState({ fx: 'failed' }),
    };
  }
}

return Component;
});
FB.def("Icon",[{"t":"svg","a":{"viewBox":"0 0 24 24","aria-hidden":"true","style":"width: {{size}}px; height: {{size}}px; display: block; flex: none; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round"},"c":[{"t":"path","a":{"d":"{{d}}"},"c":[]}]}],{"g":"check","s":16},function(DCLogic){

const P = {
  overview: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  flow: 'M5 3h4a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2ZM7 11v4a2 2 0 0 0 2 2h4M15 13h4a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2Z',
  template: 'M4 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1ZM15 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1ZM15 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1ZM4 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1Z',
  plug: 'M12 22v-5M15 8V2M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1zM9 8V2',
  runs: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2',
  chart: 'M13 17V9M18 17v-3M3 3v16a2 2 0 0 0 2 2h16M8 17V5',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3.128a4 4 0 0 1 0 7.744M22 21v-2a4 4 0 0 0-3-3.87M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
  gear: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z',
  help: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01',
  search: 'M21 21l-4.34-4.34M3 11a8 8 0 1 0 16 0a8 8 0 1 0 -16 0',
  bell: 'M10.268 21a2 2 0 0 0 3.464 0M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326',
  plus: 'M5 12h14M12 5v14',
  minus: 'M5 12h14',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  alert: 'M21.73 18l-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01',
  clock: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0M12 6v6l4 2',
  play: 'M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z',
  stop: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2Z',
  more: 'M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
  right: 'M9 18l6-6-6-6',
  left: 'M15 18l-6-6 6-6',
  down: 'M6 9l6 6 6-6',
  arrow: 'M5 12h14M12 5l7 7-7 7',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11',
  redo: 'M15 14l5-5-5-5M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13',
  fit: 'M15 3h6v6M21 3l-7 7M3 21l7-7M9 21H3v-6',
  tidy: 'M16 22l-1-4M19 14a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2h-3a1 1 0 0 1-1-1V4a2 2 0 0 0-4 0v5a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2v1a1 1 0 0 0 1 1M19 14H5l-1.973 6.767A1 1 0 0 0 4 22h16a1 1 0 0 0 .973-1.233zM8 22l1-4',
  webhook: 'M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2M6 17l3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06M12 6l3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8',
  calendar: 'M8 2v3M16 2v3M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2ZM3 9h18',
  cursor: 'M14 4.1 12 6M5.1 8l-2.9-.8M6 12l-1.9 2M7.2 2.2 8 5.1M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z',
  globe: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20',
  mail: 'M22 7l-8.991 5.727a2 2 0 0 1-2.009 0L2 7M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2Z',
  db: 'M3 5a9 3 0 1 0 18 0a9 3 0 1 0 -18 0M3 5V19A9 3 0 0 0 21 19V5M3 12A9 3 0 0 0 21 12',
  edit: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497zM15 5l4 4',
  send: 'M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11zM21.854 2.147l-10.94 10.939',
  split: 'M16 3h5v5M8 3H3v5M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3M15 9l6-6',
  branch: 'M9 18a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M3 6a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M15 6a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9M12 12v3',
  filter: 'M2 5h20M6 12h12M9 19h6',
  hourglass: 'M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2',
  copy: 'M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2ZM4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2',
  trash: 'M10 11v6M14 11v6M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  save: 'M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7M7 3v4a1 1 0 0 0 1 1h7',
  retry: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5',
  key: 'M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4zM16 7.5a0.5 0.5 0 1 0 1 0a0.5 0.5 0 1 0 -1 0',
  shield: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1zM9 12l2 2 4-4',
  lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-7a2 2 0 0 1 2 -2ZM7 11V7a5 5 0 0 1 10 0v4',
  grid: 'M4 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1ZM15 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1ZM15 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1ZM4 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1Z',
  list: 'M3 5h.01M3 12h.01M3 19h.01M8 5h13M8 12h13M8 19h13',
  sort: 'M21 16l-4 4-4-4M17 20V4M3 8l4-4 4 4M7 4v16',
  panel: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2ZM9 3v18',
  external: 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  logout: 'M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4',
  loader: 'M12 2v4M16.2 7.8l2.9-2.9M18 12h4M16.2 16.2l2.9 2.9M12 18v4M4.9 19.1l2.9-2.9M2 12h4M4.9 4.9l2.9 2.9',
  eye: 'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  data: 'M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1',
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M8 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  download: 'M12 15V3M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5',
  book: 'M12 5v16M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z',
  test: 'M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2M6.453 15h11.094M8.5 2h7',
  table: 'M12 3v18M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2ZM3 9h18M3 15h18'
};
class Component extends DCLogic {
  renderVals() {
    return { d: P[this.props.g] || P.more, size: this.props.s ?? 16 };
  }
}

return Component;
});
FB.def("IntegrationHub",[{"t":"section","a":{"class":"ih","aria-label":"Tools FlowBridge connects"},"c":[{"t":"div","a":{"class":"ih-stage {{readyCls}}","id":"ih-stage"},"c":[{"t":"div","a":{"class":"ih-glow"},"c":[]},{"t":"svg","a":{"class":"ih-ln","aria-hidden":"true"},"c":[{"t":"sc-for","a":{"list":"{{lines}}","as":"e","hint-placeholder-count":"8"},"c":[{"t":"path","a":{"class":"{{e.cls}}","d":"{{e.d}}"},"c":[]}]}]},{"t":"sc-for","a":{"list":"{{lines}}","as":"e","hint-placeholder-count":"8"},"c":[{"t":"sc-if","a":{"value":"{{e.hot}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"packet","style":"offset-path: path('{{e.d}}')"},"c":[]}]}]},{"t":"sc-for","a":{"list":"{{apps}}","as":"a","hint-placeholder-count":"26"},"c":[{"t":"button","a":{"class":"ih-a {{a.cls}}","style":"left: {{a.x}}px; top: {{a.y}}px; opacity: {{a.op}}; z-index: {{a.z}}; transform: translate(-50%, -50%) scale({{a.k}})","aria-label":"{{a.label}}","aria-pressed":"{{a.pressed}}","onClick":"{{a.pick}}","onMouseEnter":"{{a.enter}}","onMouseLeave":"{{a.leave}}","onFocus":"{{a.enter}}","onBlur":"{{a.leave}}"},"c":[{"t":"span","a":{"class":"ih-i"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"{{a.id}}","s":"84","hint-size":"84px,84px"},"c":[]}]}]}]}]},{"t":"div","a":{"class":"ih-cap","aria-live":"polite"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"{{capApp}}","s":"42","hint-size":"42px,42px"},"c":[]},{"t":"div","a":{"class":"ih-t"},"c":[{"t":"b","a":{},"c":["{{capT}}"]},{"t":"span","a":{},"c":["{{capD}}"]}]},{"t":"a","a":{"class":"ih-cta","href":"/register"},"c":["Build this workflow",{"t":"dc-import","a":{"name":"Icon","g":"arrow","s":"15","hint-size":"15px,15px"},"c":[]}]}]}]}],{"start":"stripe"},function(DCLogic){

const A = [['gmail','Gmail','Send emails and start workflows from new mail.','a new email arrives','send an email'],['slack','Slack','Post messages to channels and people.','a Slack message is posted','post to Slack'],['sheets','Google Sheets','Add and update rows, or start from a new row.','a new row is added','add a row to Google Sheets'],['pg','PostgreSQL','Insert, update and query your records.','a database record changes','save it to PostgreSQL'],['mongo','MongoDB','Create and update documents.','a document is created','save it to MongoDB'],['discord','Discord','Send alerts to your server channels.','a Discord message is posted','post to Discord'],['mysql','MySQL','Read and write rows in your tables.','a MySQL row changes','save it to MySQL'],['gdrive','Google Drive','Save, find and share files.','a file is added to Drive','save the file to Google Drive'],['gcal','Google Calendar','Create events, or start when one begins.','a calendar event starts','add a Google Calendar event'],['notion','Notion','Add pages and update database items.','a Notion page is updated','add a Notion page'],['airtable','Airtable','Create and update records in your bases.','an Airtable record is added','add an Airtable record'],['hubspot','HubSpot','Keep contacts and deals up to date.','a new deal is created','update the HubSpot contact'],['shopify','Shopify','Start from new orders and update products.','a Shopify order comes in','update the Shopify order'],['stripe','Stripe','React to payments, invoices and subscriptions.','a Stripe payment arrives','look up the Stripe payment'],['github','GitHub','Open issues and react to pull requests.','a pull request is opened','open a GitHub issue'],['jira','Jira','Create and move issues as work progresses.','a Jira issue is created','create a Jira issue'],['trello','Trello','Add cards and move them between lists.','a Trello card moves','add a Trello card'],['mailchimp','Mailchimp','Add subscribers and tag audiences.','someone subscribes','add a Mailchimp subscriber'],['twilio','Twilio','Send text messages and alerts.','a text message arrives','send a text with Twilio'],['zendesk','Zendesk','Create tickets and update their status.','a support ticket opens','create a Zendesk ticket'],['telegram','Telegram','Send messages to chats and channels.','a Telegram message arrives','send a Telegram message'],['whatsapp','WhatsApp','Send customer messages and updates.','a WhatsApp message arrives','send a WhatsApp message'],['dropbox','Dropbox','Upload files and react to new ones.','a file is added to Dropbox','upload it to Dropbox'],['asana','Asana','Create tasks and assign them.','an Asana task is completed','create an Asana task'],['webhook','Webhook','Receive events from any app.','a webhook is received','send a webhook'],['http','Custom HTTP API','Call any REST API.','an API responds','call your API']].map(([id,n,d,when,then])=>({id,n,d,when,then}));
const BY = Object.fromEntries(A.map((a)=>[a.id,a]));
const P = {
  stripe:['slack','sheets','pg','gmail','hubspot','notion','discord','airtable'],
  slack:['stripe','zendesk','github','hubspot','jira','gcal','gmail','webhook'],
  gmail:['notion','sheets','slack','asana','hubspot','dropbox','trello','airtable'],
  sheets:['stripe','shopify','hubspot','gmail','slack','mailchimp','airtable','webhook'],
  pg:['stripe','shopify','webhook','http','slack','hubspot','sheets','zendesk'],
  mongo:['webhook','http','stripe','shopify','slack','github','zendesk','sheets'],
  discord:['github','stripe','shopify','zendesk','webhook','gcal','jira','trello'],
  mysql:['stripe','shopify','webhook','http','hubspot','sheets','slack','zendesk'],
  gdrive:['gmail','slack','notion','dropbox','asana','trello','airtable','sheets'],
  gcal:['slack','gmail','notion','asana','hubspot','zendesk','trello','twilio'],
  notion:['slack','gmail','github','jira','gcal','asana','gdrive','airtable'],
  airtable:['slack','gmail','stripe','shopify','hubspot','mailchimp','webhook','sheets'],
  hubspot:['slack','gmail','stripe','mailchimp','zendesk','sheets','gcal','twilio'],
  shopify:['stripe','slack','sheets','gmail','mailchimp','zendesk','hubspot','whatsapp'],
  github:['slack','jira','discord','trello','notion','asana','webhook','telegram'],
  jira:['github','slack','zendesk','notion','gmail','trello','asana','webhook'],
  trello:['slack','github','gmail','gcal','jira','notion','asana','zendesk'],
  mailchimp:['shopify','stripe','hubspot','sheets','airtable','gmail','slack','webhook'],
  twilio:['zendesk','hubspot','shopify','stripe','slack','sheets','pg','gcal'],
  zendesk:['slack','jira','hubspot','gmail','twilio','whatsapp','notion','shopify'],
  telegram:['github','webhook','stripe','shopify','zendesk','sheets','gcal','http'],
  whatsapp:['shopify','zendesk','hubspot','stripe','twilio','sheets','gcal','webhook'],
  dropbox:['gmail','slack','gdrive','notion','asana','trello','airtable','sheets'],
  asana:['slack','gmail','hubspot','gcal','github','zendesk','notion','gdrive'],
  webhook:['slack','pg','mongo','sheets','gmail','discord','telegram','http'],
  http:['pg','mongo','slack','webhook','sheets','stripe','hubspot','zendesk']
};
const TOUR = ['stripe','zendesk','shopify','github','gmail'];
const motionOff = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return true; } };
class Component extends DCLogic {
  state = { center: this.props.start || 'stripe', hover: null, w: 1060, h: 520, ready: false };
  lastUser = 0; visible = true; step = 0; tourAt = 0; timer = null;
  componentDidMount() {
    const el = document.getElementById('ih-stage');
    const measure = () => { if (el && el.clientWidth) this.setState({ w: el.clientWidth, h: el.clientHeight }); };
    measure();
    if (window.ResizeObserver && el) { this.ro = new ResizeObserver(measure); this.ro.observe(el); }
    if (window.IntersectionObserver && el) { this.io = new IntersectionObserver((es) => es.forEach((e) => { this.visible = e.isIntersecting; })); this.io.observe(el); }
    setTimeout(() => this.setState({ ready: true }), 60);
    if (!motionOff()) this.timer = setInterval(() => this.tick(), 2400);
  }
  componentWillUnmount() { clearInterval(this.timer); if (this.ro) this.ro.disconnect(); if (this.io) this.io.disconnect(); }
  tick() {
    const stage = document.getElementById('ih-stage');
    if (stage && stage.matches(':hover')) { this.lastUser = Date.now(); return; }
    if (!this.visible || document.hidden || Date.now() - this.lastUser < 9000) return;
    const s = this.state, list = P[s.center];
    if (this.step >= 4) {
      this.step = 0; this.tourAt = (this.tourAt + 1) % TOUR.length;
      this.setState({ center: TOUR[this.tourAt], hover: null });
      return;
    }
    this.setState({ hover: list[this.step % list.length] });
    this.step += 1;
  }
  renderVals() {
    const s = this.state, w = s.w, h = s.h, small = w < 640, cx = w / 2, cy = h / 2;
    const parts = P[s.center], rest = A.map((a) => a.id).filter((id) => id !== s.center && !parts.includes(id));
    const SIZE = { c: small ? 64 : 84, p: small ? 38 : 48, o: small ? 24 : 30 };
    const pos = {};
    pos[s.center] = { x: cx, y: cy, size: SIZE.c, op: 1, z: 3 };
    const rx = w * (small ? 0.3 : 0.25), ry = h * 0.3;
    parts.forEach((id, i) => { const t = -Math.PI / 2 + (i / parts.length) * Math.PI * 2; pos[id] = { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t), size: SIZE.p, op: 1, z: 2 }; });
    const ox = w / 2 - (small ? 20 : 36), oy = h / 2 - 24;
    rest.forEach((id, i) => { const t = -Math.PI / 2 + 0.1 + (i / rest.length) * Math.PI * 2; pos[id] = { x: cx + ox * Math.cos(t), y: cy + oy * Math.sin(t), size: SIZE.o, op: 0.5, z: 1 }; });
    const round = (v) => Math.round(v * 10) / 10;
    const hot = parts.includes(s.hover) ? s.hover : null, c = BY[s.center], hv = hot && BY[hot];
    return {
      readyCls: s.ready ? 'ih-s' : '',
      lines: parts.map((id) => ({ d: 'M' + round(pos[id].x) + ' ' + round(pos[id].y) + ' L' + round(cx) + ' ' + round(cy), cls: id === hot ? 'is-on' : '', hot: id === hot })),
      apps: A.map((a) => {
        const p = pos[a.id];
        return {
          id: a.id, x: round(p.x), y: round(p.y), op: p.op, z: p.z, k: round(p.size / 84 * 1000) / 1000,
          cls: a.id === hot ? 'is-hot' : '', pressed: a.id === s.center ? 'true' : 'false',
          label: a.id === s.center ? a.n + ', in the centre' : 'Move ' + a.n + ' to the centre',
          pick: () => { this.lastUser = Date.now(); if (a.id !== s.center) this.setState({ center: a.id, hover: null }); },
          enter: () => { this.lastUser = Date.now(); this.setState({ hover: a.id }); },
          leave: () => { this.setState({ hover: null }); }
        };
      }),
      capApp: hv ? hot : s.center,
      capT: hv ? 'When ' + c.when + ', ' + hv.then + '.' : c.n + ' pairs well with these ' + parts.length + ' tools',
      capD: hv ? 'Click ' + hv.n + ' to move it to the centre.' : c.d + ' Hover a tool to see the workflow, or click one to move it to the centre.'
    };
  }
}

return Component;
});
FB.def("Integrations",[{"t":"sc-if","a":{"value":"{{fbDenied}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"dc-import","a":{"name":"NoAccess","hint-size":"100%,100vh"},"c":[]}]},{"t":"sc-if","a":{"value":"{{fbOk}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"div","a":{"class":"app"},"c":[{"t":"dc-import","a":{"name":"Sidebar","active":"integrations","hint-size":"232px,100vh"},"c":[]},{"t":"div","a":{"class":"main"},"c":[{"t":"dc-import","a":{"name":"Topbar","page":"Integrations","hint-size":"100%,56px"},"c":[]},{"t":"main","a":{"class":"page"},"c":[{"t":"div","a":{"class":"page-head"},"c":[{"t":"div","a":{},"c":[{"t":"h1","a":{"class":"page-title"},"c":["Integrations"]},{"t":"p","a":{"class":"page-sub"},"c":["Connect the apps your workflows use. Credentials are encrypted, and never shown again after you save them."]}]}]},{"t":"sc-if","a":{"value":"{{viewOnly}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"notice info"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"plug","s":"16","hint-size":"16px,16px"},"c":[]},{"t":"span","a":{"class":"grow"},"c":["Your role can view connected apps and test them. Ask an Administrator or Workflow Creator to connect or change them."]}]}]},{"t":"div","a":{"class":"tabs","style":"overflow-y: hidden","role":"tablist","aria-label":"Integrations view"},"c":[{"t":"sc-for","a":{"list":"{{tabs}}","as":"t","hint-placeholder-count":"2"},"c":[{"t":"button","a":{"class":"tab {{t.cls}}","role":"tab","aria-selected":"{{t.sel}}","onClick":"{{t.pick}}"},"c":["{{t.l}}"]}]}]},{"t":"sc-if","a":{"value":"{{isDirectory}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"div","a":{"class":"row wrap","style":"gap: 10px"},"c":[{"t":"div","a":{"style":"position: relative; flex: 1 1 240px; max-width: 340px"},"c":[{"t":"span","a":{"class":"search-ic"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"search","s":"15","hint-size":"15px,15px"},"c":[]}]},{"t":"label","a":{"for":"in-q","style":"position: absolute; width: 1px; height: 1px; overflow: hidden"},"c":["Search integrations"]},{"t":"input","a":{"id":"in-q","class":"input","style":"padding-left: 32px","type":"search","placeholder":"Search integrations","value":"{{q}}","onChange":"{{onQ}}"},"c":[]}]},{"t":"div","a":{"class":"row wrap","style":"gap: 6px","role":"group","aria-label":"Filter by category"},"c":[{"t":"sc-for","a":{"list":"{{cats}}","as":"c","hint-placeholder-count":"5"},"c":[{"t":"button","a":{"class":"chip {{c.cls}}","aria-pressed":"{{c.on}}","onClick":"{{c.pick}}"},"c":["{{c.l}}"]}]}]}]},{"t":"div","a":{"class":"g-auto"},"c":[{"t":"sc-for","a":{"list":"{{apps}}","as":"a","hint-placeholder-count":"8"},"c":[{"t":"article","a":{"class":"card","style":"padding: 15px; display: flex; flex-direction: column; gap: 10px"},"c":[{"t":"div","a":{"class":"row","style":"gap: 11px; align-items: flex-start"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"{{a.id}}","s":"36","hint-size":"36px,36px"},"c":[]},{"t":"div","a":{"class":"grow"},"c":[{"t":"h2","a":{"class":"strong","style":"font-size: 14px"},"c":["{{a.n}}"]},{"t":"div","a":{"class":"small muted"},"c":["{{a.cat}}"]}]},{"t":"span","a":{"class":"badge {{a.sCls}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{a.sIc}}","s":"12","hint-size":"12px,12px"},"c":[]},"{{a.sL}}"]}]},{"t":"p","a":{"class":"small muted","style":"min-height: 34px; text-wrap: pretty"},"c":["{{a.d}}"]},{"t":"div","a":{"class":"row between","style":"border-top: 1px solid var(--line); padding-top: 10px; margin-top: auto"},"c":[{"t":"span","a":{"class":"small dim row","style":"gap: 5px"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{a.authIc}}","s":"13","hint-size":"13px,13px"},"c":[]},"{{a.auth}}"]},{"t":"sc-if","a":{"value":"{{a.canAct}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"button","a":{"class":"btn btn-sm {{a.btnCls}}","onClick":"{{a.act}}"},"c":["{{a.btn}}"]}]}]}]}]}]},{"t":"sc-if","a":{"value":"{{noApps}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"card empty"},"c":[{"t":"div","a":{"class":"empty-ic"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"plug","s":"22","hint-size":"22px,22px"},"c":[]}]},{"t":"div","a":{"class":"strong"},"c":["No integration matches"]},{"t":"p","a":{"class":"muted","style":"max-width: 44ch"},"c":["The Custom HTTP API step can connect to any app with a web API."]}]}]}]},{"t":"sc-if","a":{"value":"{{isAccounts}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"section","a":{"class":"card"},"c":[{"t":"div","a":{"class":"tbl-wrap"},"c":[{"t":"table","a":{"class":"tbl tbl-stack"},"c":[{"t":"thead","a":{},"c":[{"t":"tr","a":{},"c":[{"t":"th","a":{},"c":["Account"]},{"t":"th","a":{},"c":["Status"]},{"t":"th","a":{"class":"hide-m"},"c":["Used by"]},{"t":"th","a":{"class":"hide-m"},"c":["Last checked"]},{"t":"th","a":{"class":"hide-m"},"c":["Added by"]},{"t":"th","a":{"class":"r"},"c":["Actions"]}]}]},{"t":"tbody","a":{},"c":[{"t":"sc-for","a":{"list":"{{accounts}}","as":"c","hint-placeholder-count":"5"},"c":[{"t":"tr","a":{},"c":[{"t":"td","a":{},"c":[{"t":"span","a":{"class":"row","style":"gap: 10px"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"{{c.app}}","s":"30","hint-size":"30px,30px"},"c":[]},{"t":"span","a":{},"c":[{"t":"span","a":{"class":"strong"},"c":["{{c.n}}"]},{"t":"span","a":{"class":"small muted","style":"display: block"},"c":["{{c.acct}}"]}]}]}]},{"t":"td","a":{},"c":[{"t":"span","a":{"class":"badge {{c.sCls}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{c.sIc}}","s":"12","hint-size":"12px,12px"},"c":[]},"{{c.sL}}"]}]},{"t":"td","a":{"class":"hide-m muted"},"c":["{{c.used}}"]},{"t":"td","a":{"class":"hide-m muted"},"c":["{{c.checked}}"]},{"t":"td","a":{"class":"hide-m muted"},"c":["{{c.by}}"]},{"t":"td","a":{"class":"r"},"c":[{"t":"span","a":{"class":"row","style":"gap: 4px; justify-content: flex-end"},"c":[{"t":"button","a":{"class":"btn btn-sm","onClick":"{{c.test}}"},"c":[{"t":"span","a":{"class":"row {{c.spin}}","style":"gap: 0"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{c.tIc}}","s":"13","hint-size":"13px,13px"},"c":[]}]},"{{c.tL}}"]},{"t":"sc-if","a":{"value":"{{canInteg}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"button","a":{"class":"btn btn-sm","onClick":"{{c.manage}}"},"c":["Manage"]},{"t":"button","a":{"class":"btn btn-sm btn-g","style":"color: var(--err)","onClick":"{{c.askRemove}}"},"c":["Disconnect"]}]}]}]}]}]}]}]}]}]}]}]}]},{"t":"sc-if","a":{"value":"{{connect}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"scrim"},"c":[{"t":"div","a":{"class":"modal","role":"dialog","aria-modal":"true","aria-labelledby":"cn-t"},"c":[{"t":"div","a":{"class":"row","style":"gap: 10px"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"{{connect.app}}","s":"36","hint-size":"36px,36px"},"c":[]},{"t":"h2","a":{"id":"cn-t"},"c":["Connect {{connect.n}}"]}]},{"t":"sc-if","a":{"value":"{{connect.oauth}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"p","a":{"class":"muted","style":"text-wrap: pretty"},"c":["You will sign in with {{connect.n}} and approve access. FlowBridge stores an encrypted token, never your password."]},{"t":"div","a":{"class":"preview"},"c":[{"t":"span","a":{"class":"strong"},"c":["FlowBridge will be able to: "]},"{{connect.scope}}"]}]},{"t":"sc-if","a":{"value":"{{connect.form}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"sc-for","a":{"list":"{{connect.fields}}","as":"f"},"c":[{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"{{f.id}}"},"c":["{{f.l}}"]},{"t":"input","a":{"id":"{{f.id}}","class":"input {{f.bad}}","type":"{{f.type}}","placeholder":"{{f.ph}}","value":"{{f.v}}","onChange":"{{f.change}}"},"c":[]},{"t":"sc-if","a":{"value":"{{f.err}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"span","a":{"class":"err-msg"},"c":["{{f.err}}"]}]}]}]},{"t":"div","a":{"class":"hint row","style":"gap: 5px"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"lock","s":"13","hint-size":"13px,13px"},"c":[]},"Encrypted at rest. Not visible to anyone after saving."]}]},{"t":"sc-if","a":{"value":"{{connect.none}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"p","a":{"class":"muted"},"c":["This one needs no account. Add it to any workflow from the builder."]}]},{"t":"div","a":{"class":"modal-a"},"c":[{"t":"button","a":{"class":"btn","onClick":"{{closeConnect}}"},"c":["Cancel"]},{"t":"sc-if","a":{"value":"{{connect.oauth}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"button","a":{"class":"btn","onClick":"{{saveLater}}"},"c":["Set up later"]}]},{"t":"button","a":{"class":"btn btn-p","onClick":"{{doConnect}}","disabled":"{{connecting}}"},"c":[{"t":"sc-if","a":{"value":"{{connecting}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"span","a":{"class":"row spin","style":"gap: 0"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"loader","s":"14","hint-size":"14px,14px"},"c":[]}]}]},"{{connectLabel}}"]}]}]}]}]},{"t":"sc-if","a":{"value":"{{manage}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"scrim"},"c":[{"t":"div","a":{"class":"modal","style":"width: min(620px, 100%)","role":"dialog","aria-modal":"true","aria-labelledby":"mg-t"},"c":[{"t":"div","a":{"class":"row","style":"gap: 10px"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"{{manage.app}}","s":"36","hint-size":"36px,36px"},"c":[]},{"t":"div","a":{"class":"grow"},"c":[{"t":"h2","a":{"id":"mg-t"},"c":["{{manage.n}}"]},{"t":"div","a":{"class":"small muted"},"c":["{{manage.acct}}"]}]},{"t":"span","a":{"class":"badge {{manage.sCls}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{manage.sIc}}","s":"12","hint-size":"12px,12px"},"c":[]},"{{manage.sL}}"]}]},{"t":"div","a":{"class":"tabs","style":"overflow-y: hidden","role":"tablist","aria-label":"Credential details"},"c":[{"t":"sc-for","a":{"list":"{{mgTabs}}","as":"t","hint-placeholder-count":"3"},"c":[{"t":"button","a":{"class":"tab {{t.cls}}","role":"tab","aria-selected":"{{t.sel}}","onClick":"{{t.pick}}"},"c":["{{t.l}}"]}]}]},{"t":"sc-if","a":{"value":"{{mgConn}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"div","a":{"class":"col","style":"gap: 12px; height: 270px; overflow-y: auto"},"c":[{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"mg-scope"},"c":["Where this credential can be used"]},{"t":"select","a":{"id":"mg-scope","class":"select","value":"{{mgScope}}","onChange":"{{onScope}}"},"c":[{"t":"option","a":{"value":"all"},"c":["Any domain"]},{"t":"option","a":{"value":"list"},"c":["Only these domains"]}]},{"t":"span","a":{"class":"hint"},"c":["Limits the damage if a workflow sends data to the wrong place."]}]},{"t":"sc-if","a":{"value":"{{mgIsList}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"mg-dom"},"c":["Allowed domains"]},{"t":"input","a":{"id":"mg-dom","class":"input mono","value":"{{mgDomains}}","onChange":"{{onDomains}}","placeholder":"api.company.com, *.company.com"},"c":[]}]}]},{"t":"div","a":{"class":"preview row","style":"gap: 7px; align-items: flex-start"},"c":[{"t":"span","a":{"style":"margin-top: 2px"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"lock","s":"13","hint-size":"13px,13px"},"c":[]}]},{"t":"span","a":{},"c":["The secret is encrypted and is never shown again, even to Administrators. To change it, reconnect."]}]}]}]},{"t":"sc-if","a":{"value":"{{mgShare}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"col","style":"gap: 2px; height: 270px; overflow-y: auto"},"c":[{"t":"p","a":{"class":"small muted","style":"margin-bottom: 6px"},"c":["People you share with can use this in their workflows, but can never see the secret."]},{"t":"sc-for","a":{"list":"{{mgPeople}}","as":"p","hint-placeholder-count":"4"},"c":[{"t":"div","a":{"class":"row","style":"padding: 7px 0; gap: 10px; border-bottom: 1px solid var(--line)"},"c":[{"t":"span","a":{"class":"avatar {{p.a}}"},"c":["{{p.i}}"]},{"t":"span","a":{"class":"grow"},"c":[{"t":"span","a":{"class":"strong","style":"display: block; font-size: 13px"},"c":["{{p.n}}"]},{"t":"span","a":{"class":"small muted"},"c":["{{p.r}}"]}]},{"t":"button","a":{"class":"toggle {{p.cls}}","role":"switch","aria-checked":"{{p.on}}","aria-label":"Share with {{p.n}}","onClick":"{{p.flip}}"},"c":[]}]}]}]}]},{"t":"sc-if","a":{"value":"{{mgUsed}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"col","style":"gap: 2px; height: 270px; overflow-y: auto"},"c":[{"t":"p","a":{"class":"small muted","style":"margin-bottom: 6px"},"c":["{{manage.used}} use this credential. Disconnecting it stops these from working."]},{"t":"sc-for","a":{"list":"{{manage.wfs}}","as":"w","hint-placeholder-count":"3"},"c":[{"t":"a","a":{"class":"menu-i","href":"/builder"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"flow","s":"14","hint-size":"14px,14px"},"c":[]},"{{w}}"]}]},{"t":"sc-if","a":{"value":"{{manage.moreL}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"span","a":{"class":"small muted","style":"padding: 6px 9px"},"c":["{{manage.moreL}}"]}]}]}]},{"t":"div","a":{"class":"modal-a"},"c":[{"t":"button","a":{"class":"btn","onClick":"{{closeManage}}"},"c":["Close"]},{"t":"button","a":{"class":"btn btn-p","onClick":"{{saveManage}}"},"c":["Save changes"]}]}]}]}]},{"t":"sc-if","a":{"value":"{{removing}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"scrim"},"c":[{"t":"div","a":{"class":"modal","role":"dialog","aria-modal":"true","aria-labelledby":"rm-t"},"c":[{"t":"h2","a":{"id":"rm-t"},"c":["Disconnect {{removing.n}}?"]},{"t":"p","a":{"class":"muted","style":"text-wrap: pretty"},"c":["The stored credential is deleted. {{removing.intro}}"]},{"t":"sc-if","a":{"value":"{{removing.hasWfs}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"col","style":"gap: 4px; background: var(--err-t); border-radius: var(--r); padding: 9px 11px; font-size: 13px; color: #7E111C"},"c":[{"t":"sc-for","a":{"list":"{{removing.wfs}}","as":"w"},"c":[{"t":"span","a":{"class":"strong"},"c":["{{w}}"]}]},{"t":"sc-if","a":{"value":"{{removing.moreL}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"span","a":{},"c":["{{removing.moreL}}"]}]}]}]},{"t":"div","a":{"class":"modal-a"},"c":[{"t":"button","a":{"class":"btn","onClick":"{{closeRemove}}"},"c":["Cancel"]},{"t":"button","a":{"class":"btn btn-d","onClick":"{{doRemove}}"},"c":["Disconnect"]}]}]}]}]},{"t":"sc-if","a":{"value":"{{toast}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"toast","role":"status"},"c":["{{toast}}"]}]}]}]}],{},function(DCLogic){

const FB_ACC = {
  admin: { k: 'admin', n: 'Jonah Thomas', f: 'Jonah', i: 'JT', a: 'a5', r: 'Administrator', e: 'jonah@meridianlogistics.example' },
  creator: { k: 'creator', n: 'Priya Raman', f: 'Priya', i: 'PR', a: '', r: 'Workflow Creator', e: 'priya@meridianlogistics.example' },
  operator: { k: 'operator', n: 'Rahul Shah', f: 'Rahul', i: 'RS', a: 'a3', r: 'Technical Operator', e: 'rahul@meridianlogistics.example' },
  business: { k: 'business', n: 'Lena Costa', f: 'Lena', i: 'LC', a: 'a2', r: 'Business User', e: 'lena@meridianlogistics.example' }
};
const FB_CANS = {
  admin: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 1 },
  creator: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 0 },
  operator: { edit: 0, builder: 1, publish: 0, retry: 1, data: 1, integ: 0, integView: 1, admin: 0 },
  business: { edit: 0, builder: 0, publish: 0, retry: 0, data: 0, integ: 0, integView: 0, admin: 0 }
};
const fbStored = () => { let k = ''; try { k = localStorage.getItem('fb-role') || ''; } catch (e) {} if (!k) { try { const m = /fb-role:(\w+)/.exec(window.name || ''); if (m) k = m[1]; } catch (e) {} } return FB_ACC[k] ? k : ''; };
const fbSetRole = (k) => { try { if (k) localStorage.setItem('fb-role', k); else localStorage.removeItem('fb-role'); } catch (e) {} try { window.name = k ? 'fb-role:' + k : ''; } catch (e) {} };
const FB_ME = FB_ACC[fbStored() || 'creator'], FB_C = FB_CANS[FB_ME.k];
const APPS = [
  { id: 'gmail', n: 'Gmail', mono: 'Gm', cat: 'Email', d: 'Send emails from your team addresses, and start workflows from new mail.', auth: 'OAuth', type: 'oauth', scope: 'send email and read message status.' },
  { id: 'slack', n: 'Slack', mono: 'Sl', cat: 'Messaging', d: 'Post messages to channels and notify people when something happens.', auth: 'OAuth', type: 'oauth', scope: 'post messages and list channels.' },
  { id: 'sheets', n: 'Google Sheets', mono: 'Gs', cat: 'Files', d: 'Add and update rows, or start a workflow when a row changes.', auth: 'OAuth', type: 'oauth', scope: 'read and edit the spreadsheets you choose.' },
  { id: 'pg', n: 'PostgreSQL', mono: 'Pg', cat: 'Databases', d: 'Insert, update and query records in your own database.', auth: 'Connection string', type: 'form', fields: [['Host', 'db.company.com'], ['Database', 'production'], ['Username', 'flowbridge'], ['Password', '', 'password']] },
  { id: 'mongo', n: 'MongoDB', mono: 'Mg', cat: 'Databases', d: 'Create and update documents in any collection.', auth: 'Connection string', type: 'form', fields: [['Connection string', 'mongodb+srv://cluster.example.net', 'password'], ['Database', 'marketing']] },
  { id: 'discord', n: 'Discord', mono: 'Dc', cat: 'Messaging', d: 'Send alerts and updates to a server channel through a webhook.', auth: 'Webhook URL', type: 'form', fields: [['Webhook URL', 'https://discord.com/api/webhooks/…', 'password']] },
  { id: 'gdrive', n: 'Google Drive', mono: 'Gd', cat: 'Files', d: 'Save, find and share files from any workflow.', auth: 'OAuth', type: 'oauth', scope: 'read and add files in the folders you choose.' },
  { id: 'dropbox', n: 'Dropbox', mono: 'Db', cat: 'Files', d: 'Upload files, and start a workflow when a new one arrives.', auth: 'OAuth', type: 'oauth', scope: 'read and add files in your Dropbox.' },
  { id: 'airtable', n: 'Airtable', mono: 'At', cat: 'Files', d: 'Create and update records in your bases.', auth: 'API key', type: 'form', fields: [['Personal access token', '', 'password'], ['Base ID', 'appXXXXXXXX']] },
  { id: 'mysql', n: 'MySQL', mono: 'My', cat: 'Databases', d: 'Read and write rows in your MySQL tables.', auth: 'API key', type: 'form', fields: [['Host', 'db.company.com'], ['Database', 'production'], ['Username', 'flowbridge'], ['Password', '', 'password']] },
  { id: 'mailchimp', n: 'Mailchimp', mono: 'Mc', cat: 'Email', d: 'Add subscribers and tag your audiences.', auth: 'API key', type: 'form', fields: [['API key', '', 'password']] },
  { id: 'telegram', n: 'Telegram', mono: 'Tg', cat: 'Messaging', d: 'Send messages to chats and channels through your bot.', auth: 'API key', type: 'form', fields: [['Bot token', '', 'password']] },
  { id: 'whatsapp', n: 'WhatsApp', mono: 'Wa', cat: 'Messaging', d: 'Send customer messages and updates through WhatsApp Business.', auth: 'API key', type: 'form', fields: [['Phone number ID', ''], ['Access token', '', 'password']] },
  { id: 'twilio', n: 'Twilio', mono: 'Tw', cat: 'Messaging', d: 'Send text messages and alerts.', auth: 'API key', type: 'form', fields: [['Account SID', ''], ['Auth token', '', 'password']] },
  { id: 'gcal', n: 'Google Calendar', mono: 'Gc', cat: 'Productivity', d: 'Create events, or start a workflow when one begins.', auth: 'OAuth', type: 'oauth', scope: 'read and create events on the calendars you choose.' },
  { id: 'notion', n: 'Notion', mono: 'No', cat: 'Productivity', d: 'Add pages and update database items.', auth: 'OAuth', type: 'oauth', scope: 'read and edit the pages you share with FlowBridge.' },
  { id: 'trello', n: 'Trello', mono: 'Tr', cat: 'Productivity', d: 'Add cards and move them between lists.', auth: 'OAuth', type: 'oauth', scope: 'read and edit your boards and cards.' },
  { id: 'asana', n: 'Asana', mono: 'As', cat: 'Productivity', d: 'Create tasks and assign them to your team.', auth: 'OAuth', type: 'oauth', scope: 'read and create tasks in your projects.' },
  { id: 'jira', n: 'Jira', mono: 'Ji', cat: 'Productivity', d: 'Create and move issues as work progresses.', auth: 'OAuth', type: 'oauth', scope: 'read and edit issues in your projects.' },
  { id: 'hubspot', n: 'HubSpot', mono: 'Hs', cat: 'Customers', d: 'Keep contacts and deals up to date.', auth: 'OAuth', type: 'oauth', scope: 'read and edit contacts and deals.' },
  { id: 'zendesk', n: 'Zendesk', mono: 'Zd', cat: 'Customers', d: 'Create tickets and update their status.', auth: 'OAuth', type: 'oauth', scope: 'read and edit support tickets.' },
  { id: 'shopify', n: 'Shopify', mono: 'Sh', cat: 'Commerce', d: 'Start workflows from new orders and update products.', auth: 'OAuth', type: 'oauth', scope: 'read orders and edit products.' },
  { id: 'stripe', n: 'Stripe', mono: 'St', cat: 'Commerce', d: 'React to payments, invoices and subscriptions.', auth: 'API key', type: 'form', fields: [['Restricted API key', '', 'password']] },
  { id: 'github', n: 'GitHub', mono: 'Gh', cat: 'Developer', d: 'Open issues and react to pull requests.', auth: 'OAuth', type: 'oauth', scope: 'read repositories and create issues.' },
  { id: 'webhook', n: 'Webhook', mono: 'Wh', cat: 'Developer', d: 'Receive events from any app that can send a web request.', auth: 'No account needed', type: 'none' },
  { id: 'http', n: 'Custom HTTP API', mono: 'Api', cat: 'Developer', d: 'Call any REST API with stored keys, tokens or basic authentication.', auth: 'API key or token', type: 'form', fields: [['Credential name', 'CRM API key'], ['API key', '', 'password']] }
];
const SEED = [
  { app: 'gmail', mono: 'Gm', n: 'Gmail', acct: 'hello@meridianlogistics.example', st: 'warn', used: '6 workflows', count: '6 workflows', checked: 'Quota reached today, 10:42', by: 'Anika Menon' },
  { app: 'slack', mono: 'Sl', n: 'Slack', acct: 'Meridian workspace', st: 'ok', used: '9 workflows', count: '9 workflows', checked: '4 minutes ago', by: 'Anika Menon' },
  { app: 'sheets', mono: 'Gs', n: 'Google Sheets', acct: 'finance@meridianlogistics.example', st: 'expiring', used: '3 workflows', count: '3 workflows', checked: 'Token expires in 3 days', by: 'Rahul Shah' },
  { app: 'pg', mono: 'Pg', n: 'PostgreSQL', acct: 'Meridian production', st: 'ok', used: '7 workflows', count: '7 workflows', checked: '4 minutes ago', by: 'Rahul Shah' },
  { app: 'http', mono: 'Api', n: 'Custom HTTP API', acct: 'CRM API key', st: 'ok', used: '2 workflows', count: '2 workflows', checked: 'Yesterday, 18:10', by: 'Jonah Thomas' }
];
const WFS = {
  gmail: ['New customer onboarding', 'Invoice paid to ledger', 'Weekly sales digest'],
  slack: ['New customer onboarding', 'Support ticket triage', 'Overdue task reminders'],
  sheets: ['Invoice paid to ledger', 'Lead sync to PostgreSQL'],
  pg: ['New customer onboarding', 'Lead sync to PostgreSQL', 'Overdue task reminders'],
  http: ['Invoice paid to ledger', 'Support ticket triage']
};
const PEOPLE = [
  { i: 'JT', a: 'a5', n: 'Jonah Thomas', r: 'Administrator' }, { i: 'AM', a: 'a4', n: 'Anika Menon', r: 'Administrator' },
  { i: 'RS', a: 'a3', n: 'Rahul Shah', r: 'Technical Operator' }, { i: 'LC', a: 'a2', n: 'Lena Costa', r: 'Business User' }
];
const usage = (a) => {
  const list = WFS[a.app] || [], total = parseInt(a.count, 10) || 0, more = total - list.length;
  return { wfs: total ? list : [], moreL: total && more > 0 ? 'and ' + more + ' more' : '' };
};
const ST = {
  setup: { c: 'b-warn', ic: 'alert', l: 'Needs setup' },
  ok: { c: 'b-ok', ic: 'check', l: 'Connected' }, warn: { c: 'b-warn', ic: 'alert', l: 'Limit reached' },
  expiring: { c: 'b-warn', ic: 'clock', l: 'Expiring soon' }, none: { c: 'b-off', ic: 'link', l: 'Not connected' }, ready: { c: 'b-ok', ic: 'check', l: 'Ready' }
};
class Component extends DCLogic {
  state = { tab: FB_ME.k === 'operator' ? 'acc' : 'dir', q: '', cat: 'All', accounts: SEED, connect: null, vals: {}, errs: {}, busy: false, testing: null, removing: null, toast: '', manage: null, mgTab: 'conn', mgScope: 'all', mgDomains: '', shared: { 'Rahul Shah': true } };
  componentWillUnmount() { clearTimeout(this.t1); clearTimeout(this.t2); }
  say(t) { clearTimeout(this.t2); this.setState({ toast: t }); this.t2 = setTimeout(() => this.setState({ toast: '' }), 3500); }
  renderVals() {
    const s = this.state, q = s.q.trim().toLowerCase();
    const cats = ['All', 'Email', 'Messaging', 'Files', 'Databases', 'Productivity', 'Customers', 'Commerce', 'Developer'];
    const apps = APPS.filter((a) => (s.cat === 'All' || a.cat === s.cat) && (!q || (a.n + a.cat + a.d).toLowerCase().includes(q))).map((a) => {
      const acc = s.accounts.find((c) => c.app === a.id);
      const st = a.type === 'none' ? ST.ready : acc ? ST[acc.st] : ST.none;
      return {
        ...a, sCls: st.c, sIc: st.ic, sL: st.l,
        authIc: a.type === 'oauth' ? 'shield' : a.type === 'none' ? 'webhook' : 'key',
        btn: a.type === 'none' ? 'How it works' : acc ? 'Manage' : 'Connect', btnCls: a.type !== 'none' && !acc ? 'btn-p' : '', canAct: !!FB_C.integ || a.type === 'none',
        act: () => (acc ? this.setState({ tab: 'acc' }) : this.setState({ connect: a, vals: {}, errs: {} }))
      };
    });
    const c = s.connect;
    return {
      canInteg: !!FB_C.integ, viewOnly: !FB_C.integ,
      fbDenied: !FB_C.integView, fbOk: !(!FB_C.integView),
      tabs: [['dir', 'Directory'], ['acc', 'Connected accounts (' + s.accounts.length + ')']].map(([id, l]) => ({ l, cls: s.tab === id ? 'is-on' : '', sel: s.tab === id ? 'true' : 'false', pick: () => this.setState({ tab: id }) })),
      isDirectory: s.tab === 'dir', isAccounts: s.tab === 'acc',
      q: s.q, onQ: (e) => this.setState({ q: e.target.value }),
      cats: cats.map((l) => ({ l, cls: s.cat === l ? 'is-on' : '', on: s.cat === l ? 'true' : 'false', pick: () => this.setState({ cat: l }) })),
      apps, noApps: apps.length === 0,
      accounts: s.accounts.map((a) => {
        const st = ST[a.st], tst = s.testing === a.app;
        return {
          ...a, sCls: st.c, sIc: st.ic, sL: st.l, spin: tst ? 'spin' : '', tIc: tst ? 'loader' : 'retry', tL: tst ? 'Testing' : 'Test',
          test: () => {
            this.setState({ testing: a.app });
            this.t1 = setTimeout(() => { this.setState({ testing: null, accounts: s.accounts.map((x) => (x.app === a.app ? { ...x, checked: 'Just now' } : x)) }); this.say(a.st === 'warn' ? 'Connected, but Gmail reports the daily sending limit is reached.' : a.n + ' connection is working.'); }, 800);
          },
          manage: () => this.setState({ manage: a, mgTab: 'conn', mgScope: 'all', mgDomains: '' }),
          askRemove: () => this.setState({ removing: a })
        };
      }),
      connect: c ? {
        app: c.id, n: c.n, mono: c.mono, scope: c.scope, oauth: c.type === 'oauth', form: c.type === 'form', none: c.type === 'none',
        fields: (c.fields || []).map(([l, ph, type]) => ({
          l, ph, type: type || 'text', id: 'cf-' + l.replace(/\W/g, ''), v: s.vals[l] || '', err: s.errs[l] || '', bad: s.errs[l] ? 'bad' : '',
          change: (e) => this.setState({ vals: { ...s.vals, [l]: e.target.value }, errs: { ...s.errs, [l]: '' } })
        }))
      } : false,
      connecting: s.busy,
      connectLabel: !c ? '' : s.busy ? 'Testing connection' : c.type === 'oauth' ? 'Continue to ' + c.n : c.type === 'none' ? 'Got it' : 'Test and save',
      closeConnect: () => { clearTimeout(this.t1); this.setState({ connect: null, busy: false }); },
      doConnect: () => {
        if (c.type === 'none') { this.setState({ connect: null }); return; }
        if (c.type === 'form') {
          const errs = {};
          c.fields.forEach(([l]) => { if (!(s.vals[l] || '').trim()) errs[l] = l + ' is required.'; });
          if (Object.keys(errs).length) { this.setState({ errs }); return; }
        }
        this.setState({ busy: true });
        this.t1 = setTimeout(() => {
          const acct = c.type === 'form' ? (s.vals.Database || s.vals['Credential name'] || 'New connection') : 'ops@meridianlogistics.example';
          this.setState({ busy: false, connect: null, accounts: s.accounts.concat({ app: c.id, mono: c.mono, n: c.n, acct, st: 'ok', used: 'No workflows yet', count: 'No workflows', checked: 'Just now', by: FB_ME.n }) });
          this.say(c.n + ' connected. You can now use it in any workflow.');
        }, 900);
      },
      saveLater: () => { this.setState({ connect: null, tab: 'acc', accounts: s.accounts.concat({ app: c.id, mono: c.mono, n: c.n, acct: 'Not connected yet', st: 'setup', used: 'No workflows yet', count: 'No workflows', checked: 'Never', by: FB_ME.n }) }); this.say(c.n + ' saved. Connect it before a workflow can use it.'); },
      manage: s.manage ? (() => { const st = ST[s.manage.st], u = usage(s.manage); return { ...s.manage, sCls: st.c, sIc: st.ic, sL: st.l, wfs: u.wfs, moreL: u.moreL }; })() : false,
      mgTabs: [['conn', 'Connection'], ['share', 'Sharing'], ['used', 'Used by']].map(([id, l]) => ({ l, cls: s.mgTab === id ? 'is-on' : '', sel: s.mgTab === id ? 'true' : 'false', pick: () => this.setState({ mgTab: id }) })),
      mgConn: s.mgTab === 'conn', mgShare: s.mgTab === 'share', mgUsed: s.mgTab === 'used',
      mgScope: s.mgScope, mgIsList: s.mgScope === 'list', mgDomains: s.mgDomains,
      onScope: (e) => this.setState({ mgScope: e.target.value }), onDomains: (e) => this.setState({ mgDomains: e.target.value }),
      mgPeople: PEOPLE.map((p) => ({ ...p, cls: s.shared[p.n] ? 'is-on' : '', on: s.shared[p.n] ? 'true' : 'false', flip: () => this.setState({ shared: { ...s.shared, [p.n]: !s.shared[p.n] } }) })),
      closeManage: () => this.setState({ manage: null }),
      saveManage: () => {
        if (s.mgScope === 'list' && !s.mgDomains.trim()) { this.say('Add at least one domain, or choose Any domain.'); return; }
        const n = s.manage.n; this.setState({ manage: null }); this.say(n + ' settings saved.');
      },
      removing: s.removing ? (() => { const u = usage(s.removing); return { n: s.removing.n, hasWfs: u.wfs.length > 0, wfs: u.wfs, moreL: u.moreL, intro: u.wfs.length ? 'These workflows will fail until you connect another account:' : 'No workflows use it.' }; })() : false,
      closeRemove: () => this.setState({ removing: null }),
      doRemove: () => { const r = s.removing; this.setState({ removing: null, accounts: s.accounts.filter((x) => x.app !== r.app) }); this.say(r.n + ' disconnected.'); },
      toast: s.toast
    };
  }
}

return Component;
});
FB.def("Main",[{"t":"div","a":{"class":"app"},"c":[{"t":"dc-import","a":{"name":"Sidebar","active":"overview","hint-size":"232px,100vh"},"c":[]},{"t":"div","a":{"class":"main"},"c":[{"t":"dc-import","a":{"name":"Topbar","page":"Overview","hint-size":"100%,56px"},"c":[]},{"t":"main","a":{"class":"page"},"c":[{"t":"div","a":{"class":"page-head"},"c":[{"t":"div","a":{},"c":[{"t":"h1","a":{"class":"page-title"},"c":["Good morning, {{meF}}"]},{"t":"p","a":{"class":"page-sub"},"c":["{{summary}}"]}]},{"t":"sc-if","a":{"value":"{{isCreatorView}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"a","a":{"class":"btn btn-p","href":"/builder"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"plus","s":"15","hint-size":"15px,15px"},"c":[]},"Create workflow"]}]},{"t":"sc-if","a":{"value":"{{roleAct}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"a","a":{"class":"btn btn-p","href":"{{roleHref}}"},"c":["{{roleAct}}"]}]}]},{"t":"sc-if","a":{"value":"{{signedIn}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"notice info"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"users","s":"16","hint-size":"16px,16px"},"c":[]},{"t":"span","a":{"class":"grow"},"c":[{"t":"b","a":{},"c":["{{meR}}."]}," {{roleNote}}"]}]}]},{"t":"sc-if","a":{"value":"{{isCreatorView}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"section","a":{"class":"card stats","aria-label":"Platform health, last 30 days"},"c":[{"t":"sc-for","a":{"list":"{{stats}}","as":"s","hint-placeholder-count":"5"},"c":[{"t":"div","a":{"class":"stat"},"c":[{"t":"span","a":{"class":"stat-l"},"c":["{{s.l}}"]},{"t":"span","a":{"class":"stat-v"},"c":["{{s.v}}"]},{"t":"span","a":{"class":"stat-d"},"c":["{{s.d}}"]}]}]}]},{"t":"div","a":{"class":"g-21"},"c":[{"t":"div","a":{"class":"col","style":"gap: 20px; min-width: 0"},"c":[{"t":"section","a":{"class":"card","aria-label":"Failed runs that need action"},"c":[{"t":"div","a":{"class":"card-h","style":"padding-bottom: 10px"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Needs your attention"]},{"t":"a","a":{"class":"small strong","href":"/executions"},"c":["All failures"]}]},{"t":"sc-for","a":{"list":"{{attention}}","as":"a","hint-placeholder-count":"3"},"c":[{"t":"div","a":{"class":"d-att {{a.goneCls}}"},"c":[{"t":"div","a":{},"c":[{"t":"div","a":{"class":"row between","style":"padding: 11px 16px; border-top: 1px solid var(--line); gap: 12px"},"c":[{"t":"span","a":{"class":"grow"},"c":[{"t":"span","a":{"class":"strong","style":"display: block; font-size: 13px"},"c":["{{a.wf}}"]},{"t":"span","a":{"class":"small","style":"display: block; color: {{a.whyColor}}; text-wrap: pretty"},"c":["{{a.why}}"]}]},{"t":"a","a":{"class":"btn btn-sm btn-g","href":"/executions"},"c":["Review"]},{"t":"sc-if","a":{"value":"{{canRetry}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"button","a":{"class":"btn btn-sm","disabled":"{{a.busy}}","onClick":"{{a.retry}}"},"c":[{"t":"span","a":{"class":"row {{a.spin}}","style":"gap: 0"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{a.ic}}","s":"13","hint-size":"13px,13px"},"c":[]}]},"{{a.btn}}"]}]}]}]}]}]},{"t":"sc-if","a":{"value":"{{allClear}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"d-allclear"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"check","s":"16","hint-size":"16px,16px"},"c":[]},"All clear. Nothing needs you right now."]}]}]},{"t":"section","a":{"class":"card"},"c":[{"t":"div","a":{"class":"card-h","style":"padding-bottom: 10px"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Recent executions"]},{"t":"span","a":{"class":"row","style":"gap: 14px"},"c":[{"t":"span","a":{"class":"d-live"},"c":[{"t":"i","a":{},"c":[]},"Updating live"]},{"t":"a","a":{"class":"small strong","href":"/executions"},"c":["View all"]}]}]},{"t":"div","a":{"class":"tbl-wrap"},"c":[{"t":"table","a":{"class":"tbl"},"c":[{"t":"thead","a":{},"c":[{"t":"tr","a":{},"c":[{"t":"th","a":{},"c":["Workflow"]},{"t":"th","a":{"class":"hide-m"},"c":["Steps"]},{"t":"th","a":{},"c":["Status"]},{"t":"th","a":{"class":"r hide-m"},"c":["Started"]}]}]},{"t":"tbody","a":{},"c":[{"t":"sc-for","a":{"list":"{{runs}}","as":"r","hint-placeholder-count":"5"},"c":[{"t":"tr","a":{"class":"{{r.rowCls}}"},"c":[{"t":"td","a":{},"c":[{"t":"a","a":{"class":"link-row","href":"/executions"},"c":["{{r.wf}}"]}]},{"t":"td","a":{"class":"hide-m"},"c":[{"t":"span","a":{"class":"trace","title":"{{r.traceLabel}}"},"c":[{"t":"sc-for","a":{"list":"{{r.trace}}","as":"t"},"c":[{"t":"i","a":{"class":"seg {{t}}"},"c":[]}]}]}]},{"t":"td","a":{},"c":[{"t":"span","a":{"class":"badge {{r.b}}"},"c":[{"t":"span","a":{"class":"row {{r.spin}}","style":"gap: 0"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{r.ic}}","s":"13","hint-size":"13px,13px"},"c":[]}]},"{{r.label}}"]}]},{"t":"td","a":{"class":"r muted hide-m"},"c":["{{r.at}}"]}]}]}]}]}]}]}]},{"t":"div","a":{"class":"col","style":"gap: 20px; min-width: 0"},"c":[{"t":"section","a":{"class":"card"},"c":[{"t":"div","a":{"class":"card-h"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Most used workflows"]}]},{"t":"div","a":{"class":"card-b col","style":"gap: 11px"},"c":[{"t":"sc-for","a":{"list":"{{top}}","as":"w","hint-placeholder-count":"4"},"c":[{"t":"div","a":{"class":"row between","style":"gap: 12px"},"c":[{"t":"a","a":{"class":"trunc","style":"color: var(--ink); font-size: 13px; font-weight: 550","href":"{{wfHref}}"},"c":["{{w.n}}"]},{"t":"span","a":{"class":"num small muted"},"c":["{{w.c}}"]}]}]}]}]},{"t":"section","a":{"class":"card"},"c":[{"t":"div","a":{"class":"card-h"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Recent activity"]}]},{"t":"div","a":{"class":"card-b col","style":"gap: 12px"},"c":[{"t":"sc-for","a":{"list":"{{feed}}","as":"f","hint-placeholder-count":"3"},"c":[{"t":"div","a":{"class":"row","style":"align-items: flex-start; gap: 10px"},"c":[{"t":"span","a":{"class":"avatar {{f.a}}","style":"width: 24px; height: 24px; font-size: 10px"},"c":["{{f.i}}"]},{"t":"div","a":{"class":"grow"},"c":[{"t":"div","a":{"style":"font-size: 13px; text-wrap: pretty"},"c":["{{f.t}}"]},{"t":"div","a":{"class":"small dim"},"c":["{{f.w}}"]}]}]}]}]}]}]}]},{"t":"section","a":{"class":"card"},"c":[{"t":"dc-import","a":{"name":"ExecChart","hint-size":"100%,330px"},"c":[]}]},{"t":"sc-if","a":{"value":"{{canEdit}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"section","a":{"class":"col","style":"gap: 10px"},"c":[{"t":"div","a":{"class":"row between"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Start from a template"]},{"t":"a","a":{"class":"small strong","href":"/templates"},"c":["Browse all"]}]},{"t":"div","a":{"class":"row wrap","style":"gap: 8px"},"c":[{"t":"sc-for","a":{"list":"{{templates}}","as":"t","hint-placeholder-count":"3"},"c":[{"t":"a","a":{"class":"btn","href":"/templates","style":"height: 38px"},"c":[{"t":"span","a":{"class":"row","style":"gap: 3px"},"c":[{"t":"sc-for","a":{"list":"{{t.apps}}","as":"a"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"{{a}}","s":"22","hint-size":"22px,22px"},"c":[]}]}]},"{{t.n}}"]}]}]}]}]}]},{"t":"sc-if","a":{"value":"{{isRoleView}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"dc-import","a":{"name":"RoleOverview","hint-size":"100%,760px"},"c":[]}]}]}]}]}],{},function(DCLogic){

const FB_ACC = {
  admin: { k: 'admin', n: 'Jonah Thomas', f: 'Jonah', i: 'JT', a: 'a5', r: 'Administrator', e: 'jonah@meridianlogistics.example' },
  creator: { k: 'creator', n: 'Priya Raman', f: 'Priya', i: 'PR', a: '', r: 'Workflow Creator', e: 'priya@meridianlogistics.example' },
  operator: { k: 'operator', n: 'Rahul Shah', f: 'Rahul', i: 'RS', a: 'a3', r: 'Technical Operator', e: 'rahul@meridianlogistics.example' },
  business: { k: 'business', n: 'Lena Costa', f: 'Lena', i: 'LC', a: 'a2', r: 'Business User', e: 'lena@meridianlogistics.example' }
};
const FB_CANS = {
  admin: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 1 },
  creator: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 0 },
  operator: { edit: 0, builder: 1, publish: 0, retry: 1, data: 1, integ: 0, integView: 1, admin: 0 },
  business: { edit: 0, builder: 0, publish: 0, retry: 0, data: 0, integ: 0, integView: 0, admin: 0 }
};
const fbStored = () => { let k = ''; try { k = localStorage.getItem('fb-role') || ''; } catch (e) {} if (!k) { try { const m = /fb-role:(\w+)/.exec(window.name || ''); if (m) k = m[1]; } catch (e) {} } return FB_ACC[k] ? k : ''; };
const fbSetRole = (k) => { try { if (k) localStorage.setItem('fb-role', k); else localStorage.removeItem('fb-role'); } catch (e) {} try { window.name = k ? 'fb-role:' + k : ''; } catch (e) {} };
const FB_ME = FB_ACC[fbStored() || 'creator'], FB_C = FB_CANS[FB_ME.k];
const STATUS = {
  ok: { b: 'b-ok', ic: 'check', label: 'Success', spin: '' },
  err: { b: 'b-err', ic: 'x', label: 'Failed', spin: '' },
  run: { b: 'b-run', ic: 'loader', label: 'Running', spin: 'spin' }
};
const RUNS = [
  { wf: 'Invoice paid to ledger', s: 'run', trace: ['ok', 'ok', 'run', 'skip'], traceLabel: 'Running step 3 of 4', at: 'Today, 10:43' },
  { wf: 'New customer onboarding', s: 'err', trace: ['ok', 'ok', 'ok', 'err', 'skip'], traceLabel: 'Failed at step 4 of 5', at: 'Today, 10:42' },
  { wf: 'Support ticket triage', s: 'ok', trace: ['ok', 'ok', 'ok', 'ok'], traceLabel: 'All 4 steps succeeded', at: 'Today, 10:41' },
  { wf: 'New customer onboarding', s: 'ok', trace: ['ok', 'ok', 'ok', 'ok', 'ok'], traceLabel: 'All 5 steps succeeded', at: 'Today, 10:36' },
  { wf: 'Overdue task reminders', s: 'ok', trace: ['ok', 'ok', 'ok'], traceLabel: 'All 3 steps succeeded', at: 'Today, 09:00' }
];
const ATT = [
  { wf: 'New customer onboarding', why: 'Failed at Send welcome email: Gmail daily limit reached' },
  { wf: 'Support ticket triage', why: 'Failed at Post to on-call: Slack channel not found' },
  { wf: 'Lead sync to PostgreSQL', why: 'Failed at Insert leads: connection timed out' }
];
const NEW = [
  { wf: 'Support ticket triage', n: 4 }, { wf: 'Invoice paid to ledger', n: 4 }, { wf: 'New customer onboarding', n: 5 }, { wf: 'Lead sync to PostgreSQL', n: 4 }
];
const n0 = (v) => Math.round(v).toLocaleString('en-GB');
const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
class Component extends DCLogic {
  state = { t: reduced() ? 1 : 0, ok: 17912, failed: 402, att: {}, rows: RUNS, tick: 0, clock: 44 };
  ts = [];
  componentDidMount() {
    if (this.state.t < 1) {
      const start = performance.now();
      const go = (now) => { const t = Math.min(1, (now - start) / 900); this.setState({ t: 1 - Math.pow(1 - t, 3) }); if (t < 1) this.raf = requestAnimationFrame(go); };
      this.raf = requestAnimationFrame(go);
    }
    if (!reduced()) this.iv = setInterval(() => this.arrive(), 3200);
  }
  componentWillUnmount() { cancelAnimationFrame(this.raf); clearInterval(this.iv); this.ts.forEach(clearTimeout); }
  arrive() {
    const s = this.state, rows = s.rows.slice();
    const run = rows.findIndex((r) => r.s === 'run');
    if (run >= 0) {
      const r = rows[run], at = r.trace.indexOf('run');
      const trace = r.trace.slice();
      trace[at] = 'ok';
      if (at + 1 < trace.length) { trace[at + 1] = 'run'; rows[run] = { ...r, trace, traceLabel: 'Running step ' + (at + 2) + ' of ' + trace.length }; this.setState({ rows }); return; }
      rows[run] = { ...r, trace, s: 'ok', traceLabel: 'All ' + trace.length + ' steps succeeded', fresh: true };
      this.setState({ rows, ok: s.ok + 1 });
      return;
    }
    const n = NEW[s.tick % NEW.length], trace = ['run'].concat(Array(n.n - 1).fill('skip'));
    rows.unshift({ wf: n.wf, s: 'run', trace, traceLabel: 'Running step 1 of ' + n.n, at: 'Today, 10:' + s.clock, fresh: true, key: s.tick });
    this.setState({ rows: rows.slice(0, 5), tick: s.tick + 1, clock: s.clock + 1 });
  }
  retry(i) {
    this.setState({ att: { ...this.state.att, [i]: 'busy' } });
    this.ts.push(setTimeout(() => this.setState({ att: { ...this.state.att, [i]: 'ok' }, ok: this.state.ok + 1, failed: this.state.failed - 1 }), 1500));
    this.ts.push(setTimeout(() => this.setState({ att: { ...this.state.att, [i]: 'gone' } }), 2700));
  }
  renderVals() {
    const s = this.state, open = ATT.filter((a, i) => s.att[i] !== 'gone' && s.att[i] !== 'ok').length, c = s.t;
    const rate = (s.ok / (s.ok + s.failed)) * 100;
    return {
      isCreatorView: FB_ME.k === 'creator', isRoleView: FB_ME.k !== 'creator', roleAct: { admin: 'Invite member', operator: 'Open all failures' }[FB_ME.k] || '', roleHref: FB_ME.k === 'admin' ? '/team' : '/executions',
      meF: FB_ME.f, meR: FB_ME.r, canEdit: !!FB_C.edit, canRetry: !!FB_C.retry, signedIn: !!fbStored(), roleNote: {"admin":"You have full access, including members, integrations and security.","creator":"You can build, test and publish workflows, and connect integrations. You can't manage members.","operator":"You can investigate failures, retry runs and test integrations. You can't edit or publish workflows.","business":"You can watch activity and run published workflows. You can't edit workflows, retry failed runs or see step data."}[FB_ME.k], wfHref: FB_C.builder ? '/builder' : '/executions',
      summary: ({ admin: '2 connections and 1 invite need an Administrator.', operator: '3 failed runs and 2 integrations need you.', business: 'Your automations are running. 3 had a problem, and the technical team can see them.' })[FB_ME.k] || (open ? 'Most things are running well. ' + open + (open === 1 ? ' failed run needs' : ' failed runs need') + ' you.' : 'Everything is running well. Nothing needs you.'),
      stats: [
        { l: 'Total workflows', v: n0(24 * c), d: '6 drafts' },
        { l: 'Published', v: n0(18 * c), d: '7 running now' },
        { l: 'Successful runs', v: n0(s.ok * c), d: 'Last 30 days' },
        { l: 'Failed runs', v: n0(s.failed * c), d: open + ' need action' },
        { l: 'Success rate', v: (rate * c).toFixed(1) + '%', d: 'Up 0.6 pts' }
      ],
      allClear: open === 0 && Object.values(s.att).every((v) => v === 'gone'),
      attention: ATT.map((a, i) => {
        const st = s.att[i];
        return {
          wf: a.wf, why: st === 'busy' ? 'Retrying from the failed step' : st === 'ok' || st === 'gone' ? 'Retry succeeded. All steps finished.' : a.why,
          whyColor: st === 'busy' ? 'var(--ink-2)' : st === 'ok' || st === 'gone' ? 'var(--ok)' : 'var(--err)',
          goneCls: st === 'gone' ? 'is-gone' : '', busy: !!st, spin: st === 'busy' ? 'spin' : '', ic: st === 'busy' ? 'loader' : st ? 'check' : 'retry',
          btn: st === 'busy' ? 'Retrying' : st ? 'Done' : 'Retry', retry: () => this.retry(i)
        };
      }),
      runs: s.rows.map((r) => ({ ...r, ...STATUS[r.s], rowCls: (r.s === 'err' ? 'is-fail ' : '') + (r.fresh ? 'is-fresh-row' : '') })),
      top: [
        { n: 'New customer onboarding', c: '4,812' },
        { n: 'Invoice paid to ledger', c: '3,266' },
        { n: 'Support ticket triage', c: '2,944' },
        { n: 'Lead sync to PostgreSQL', c: '2,190' }
      ],
      feed: [
        { i: 'RS', a: 'a3', t: 'Rahul Shah acknowledged 2 failures in Lead sync to PostgreSQL', w: '12 minutes ago' },
        { i: 'PR', a: '', t: (FB_ME.k === 'creator' ? 'You' : 'Priya Raman') + ' published New customer onboarding, Version 14', w: '1 hour ago' },
        { i: 'AM', a: 'a4', t: 'Anika Menon reconnected the Slack workspace integration', w: 'Yesterday, 17:20' }
      ],
      templates: [
        { n: 'Welcome new customers', apps: ['Gm', 'Sl'] },
        { n: 'Log form replies to a sheet', apps: ['Gs', 'Gm'] },
        { n: 'Escalate urgent tickets', apps: ['Dc', 'Sl'] }
      ]
    };
  }
}

return Component;
});
FB.def("NoAccess",[{"t":"main","a":{"style":"min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px; background: var(--bg)"},"c":[{"t":"div","a":{"class":"card col","style":"width: min(440px, 100%); padding: 28px; gap: 14px"},"c":[{"t":"div","a":{"class":"empty-ic","style":"margin: 0"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"alert","s":"22","hint-size":"22px,22px"},"c":[]}]},{"t":"div","a":{},"c":[{"t":"h1","a":{"class":"page-title","style":"font-size: 22px"},"c":["Your role can't open this page"]},{"t":"p","a":{"class":"page-sub"},"c":["You are signed in as {{name}}, {{role}}. Ask an Administrator if you need access."]}]},{"t":"div","a":{"class":"row wrap"},"c":[{"t":"a","a":{"class":"btn btn-p","href":"/overview"},"c":["Back to Overview"]},{"t":"a","a":{"class":"btn","href":"/sign-in","onClick":"{{out}}"},"c":["Use another account"]}]}]}]}],{},function(DCLogic){

const FB_ACC = {
  admin: { k: 'admin', n: 'Jonah Thomas', f: 'Jonah', i: 'JT', a: 'a5', r: 'Administrator', e: 'jonah@meridianlogistics.example' },
  creator: { k: 'creator', n: 'Priya Raman', f: 'Priya', i: 'PR', a: '', r: 'Workflow Creator', e: 'priya@meridianlogistics.example' },
  operator: { k: 'operator', n: 'Rahul Shah', f: 'Rahul', i: 'RS', a: 'a3', r: 'Technical Operator', e: 'rahul@meridianlogistics.example' },
  business: { k: 'business', n: 'Lena Costa', f: 'Lena', i: 'LC', a: 'a2', r: 'Business User', e: 'lena@meridianlogistics.example' }
};
const FB_CANS = {
  admin: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 1 },
  creator: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 0 },
  operator: { edit: 0, builder: 1, publish: 0, retry: 1, data: 1, integ: 0, integView: 1, admin: 0 },
  business: { edit: 0, builder: 0, publish: 0, retry: 0, data: 0, integ: 0, integView: 0, admin: 0 }
};
const fbStored = () => { let k = ''; try { k = localStorage.getItem('fb-role') || ''; } catch (e) {} if (!k) { try { const m = /fb-role:(\w+)/.exec(window.name || ''); if (m) k = m[1]; } catch (e) {} } return FB_ACC[k] ? k : ''; };
const fbSetRole = (k) => { try { if (k) localStorage.setItem('fb-role', k); else localStorage.removeItem('fb-role'); } catch (e) {} try { window.name = k ? 'fb-role:' + k : ''; } catch (e) {} };
const FB_ME = FB_ACC[fbStored() || 'creator'], FB_C = FB_CANS[FB_ME.k];
class Component extends DCLogic {
  renderVals() {
    return { name: FB_ME.n, role: FB_ME.r, out: () => fbSetRole('') };
  }
}

return Component;
});
FB.def("NodeConfig",[{"t":"div","a":{"style":"width: 2000px; height: 960px; box-sizing: border-box; background: var(--bg); padding: 24px 20px; display: flex; flex-direction: column; gap: 16px; font-family: var(--sans); color: var(--ink)"},"c":[{"t":"div","a":{"class":"row between"},"c":[{"t":"h1","a":{"class":"page-title","style":"font-size: 20px"},"c":["Node configuration"]},{"t":"span","a":{"class":"row small muted","style":"gap: 6px"},"c":[{"t":"span","a":{"class":"var"},"c":["Insert data"]},"Violet always marks data from an earlier step"]}]},{"t":"div","a":{"style":"display: grid; grid-template-columns: repeat(5, 372px); gap: 16px; justify-content: space-between"},"c":[{"t":"div","a":{"class":"card","style":"overflow: hidden"},"c":[{"t":"dc-import","a":{"name":"ConfigPanel","kind":"webhook","hint-size":"372px,860px"},"c":[]}]},{"t":"div","a":{"class":"card","style":"overflow: hidden"},"c":[{"t":"dc-import","a":{"name":"ConfigPanel","kind":"http","hint-size":"372px,860px"},"c":[]}]},{"t":"div","a":{"class":"card","style":"overflow: hidden"},"c":[{"t":"dc-import","a":{"name":"ConfigPanel","kind":"email","demo":"subject","hint-size":"372px,860px"},"c":[]}]},{"t":"div","a":{"class":"card","style":"overflow: hidden"},"c":[{"t":"dc-import","a":{"name":"ConfigPanel","kind":"database","hint-size":"372px,860px"},"c":[]}]},{"t":"div","a":{"class":"card","style":"overflow: hidden"},"c":[{"t":"dc-import","a":{"name":"ConfigPanel","kind":"condition","hint-size":"372px,860px"},"c":[]}]}]}]}],{},function(DCLogic){

class Component extends DCLogic {
  renderVals() { return {}; }
}

return Component;
});
FB.def("Register",[{"t":"div","a":{"style":"min-height: 100vh; background: var(--surface); display: flex; flex-wrap: wrap"},"c":[{"t":"main","a":{"style":"flex: 1 1 460px; min-width: 0; display: flex; flex-direction: column; padding: 28px clamp(20px, 6vw, 88px); gap: 28px"},"c":[{"t":"a","a":{"href":"/","aria-label":"FlowBridge home","class":"row","style":"gap: 9px; font-weight: 680; font-size: 15px; letter-spacing: -0.02em; color: var(--ink); align-self: flex-start"},"c":[{"t":"svg","a":{"viewBox":"0 0 28 28","aria-hidden":"true","style":"width: 28px; height: 28px"},"c":[{"t":"rect","a":{"width":"28","height":"28","rx":"7","style":"fill: #C2410C"},"c":[]},{"t":"path","a":{"d":"M6.5 18.5C9 9.5 19 9.5 21.5 18.5","style":"fill: none; stroke: #FFFFFF; stroke-width: 2.4; stroke-linecap: round"},"c":[]},{"t":"circle","a":{"cx":"6.5","cy":"19","r":"2.6","style":"fill: #FFFFFF"},"c":[]},{"t":"circle","a":{"cx":"21.5","cy":"19","r":"2.6","style":"fill: #FFFFFF"},"c":[]}]}," FlowBridge"]},{"t":"div","a":{"style":"margin: auto 0; max-width: 420px; width: 100%; display: flex; flex-direction: column; gap: 18px"},"c":[{"t":"sc-if","a":{"value":"{{isForm}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"div","a":{},"c":[{"t":"h1","a":{"class":"page-title","style":"font-size: 28px"},"c":["Create your workspace"]},{"t":"p","a":{"class":"page-sub"},"c":["Connect your apps and automate your first process today."]}]},{"t":"sc-for","a":{"list":"{{fields}}","as":"f","hint-placeholder-count":"4"},"c":[{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"{{f.id}}"},"c":["{{f.l}}"]},{"t":"input","a":{"id":"{{f.id}}","class":"input {{f.bad}}","style":"height: 40px","type":"{{f.type}}","autocomplete":"{{f.auto}}","value":"{{f.v}}","onChange":"{{f.change}}","aria-invalid":"{{f.invalid}}"},"c":[]},{"t":"sc-if","a":{"value":"{{f.err}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"span","a":{"class":"err-msg"},"c":["{{f.err}}"]}]},{"t":"sc-if","a":{"value":"{{f.h}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"span","a":{"class":"hint"},"c":["{{f.h}}"]}]}]}]},{"t":"button","a":{"class":"btn btn-p","style":"height: 42px","onClick":"{{submit}}","disabled":"{{busy}}"},"c":[{"t":"sc-if","a":{"value":"{{busy}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"span","a":{"class":"row spin","style":"gap: 0"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"loader","s":"15","hint-size":"15px,15px"},"c":[]}]}]},"{{submitL}}"]},{"t":"p","a":{"class":"small muted"},"c":["Already have an account? ",{"t":"a","a":{"href":"/sign-in"},"c":["Sign in"]}]}]},{"t":"sc-if","a":{"value":"{{isStart}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{},"c":[{"t":"h1","a":{"class":"page-title","style":"font-size: 28px"},"c":["Welcome, {{first}}"]},{"t":"p","a":{"class":"page-sub"},"c":["How would you like to build your first automation?"]}]},{"t":"a","a":{"class":"card","href":"/templates","style":"padding: 15px; color: inherit; display: flex; gap: 12px; align-items: center"},"c":[{"t":"span","a":{"class":"n-ic action","style":"width: 36px; height: 36px"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"template","s":"18","hint-size":"18px,18px"},"c":[]}]},{"t":"span","a":{"class":"grow"},"c":[{"t":"span","a":{"class":"strong","style":"display: block"},"c":["Start from a template"]},{"t":"span","a":{"class":"small muted","style":"display: block"},"c":["Recommended if this is your first workflow."]}]},{"t":"dc-import","a":{"name":"Icon","g":"right","s":"16","hint-size":"16px,16px"},"c":[]}]},{"t":"a","a":{"class":"card","href":"/builder","style":"padding: 15px; color: inherit; display: flex; gap: 12px; align-items: center"},"c":[{"t":"span","a":{"class":"n-ic logic","style":"width: 36px; height: 36px"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"flow","s":"18","hint-size":"18px,18px"},"c":[]}]},{"t":"span","a":{"class":"grow"},"c":[{"t":"span","a":{"class":"strong","style":"display: block"},"c":["Build from scratch"]},{"t":"span","a":{"class":"small muted","style":"display: block"},"c":["Open a blank canvas and add your own steps."]}]},{"t":"dc-import","a":{"name":"Icon","g":"right","s":"16","hint-size":"16px,16px"},"c":[]}]},{"t":"a","a":{"class":"small strong","href":"/overview","onClick":"{{asOwner}}","style":"align-self: flex-start"},"c":["Skip for now and see the overview"]}]}]}]},{"t":"aside","a":{"class":"hide-m","style":"flex: 1 1 460px; min-width: 0; background: #261F18; color: #FFFFFF; padding: clamp(28px, 6vw, 88px); display: flex; flex-direction: column; justify-content: center; gap: 28px"},"c":[{"t":"h2","a":{"style":"font-size: 26px; line-height: 1.25; font-weight: 620; letter-spacing: -0.02em; max-width: 22ch; text-wrap: balance"},"c":["Automate the process. See every step it takes."]},{"t":"div","a":{"class":"col","style":"gap: 0; max-width: 420px"},"c":[{"t":"sc-for","a":{"list":"{{demo}}","as":"d","hint-placeholder-count":"5"},"c":[{"t":"div","a":{"class":"row","style":"gap: 12px; padding: 11px 0; border-top: 1px solid rgba(255,255,255,.14)"},"c":[{"t":"span","a":{"class":"tl-n {{d.c}}","style":"width: 20px; height: 20px"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{d.i}}","s":"12","hint-size":"12px,12px"},"c":[]}]},{"t":"span","a":{"class":"grow","style":"font-size: 14px"},"c":["{{d.t}}"]},{"t":"span","a":{"class":"small num","style":"color: #CAC4BF"},"c":["{{d.m}}"]}]}]}]}]}]}],{},function(DCLogic){

const FB_ACC = {
  admin: { k: 'admin', n: 'Jonah Thomas', f: 'Jonah', i: 'JT', a: 'a5', r: 'Administrator', e: 'jonah@meridianlogistics.example' },
  creator: { k: 'creator', n: 'Priya Raman', f: 'Priya', i: 'PR', a: '', r: 'Workflow Creator', e: 'priya@meridianlogistics.example' },
  operator: { k: 'operator', n: 'Rahul Shah', f: 'Rahul', i: 'RS', a: 'a3', r: 'Technical Operator', e: 'rahul@meridianlogistics.example' },
  business: { k: 'business', n: 'Lena Costa', f: 'Lena', i: 'LC', a: 'a2', r: 'Business User', e: 'lena@meridianlogistics.example' }
};
const FB_CANS = {
  admin: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 1 },
  creator: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 0 },
  operator: { edit: 0, builder: 1, publish: 0, retry: 1, data: 1, integ: 0, integView: 1, admin: 0 },
  business: { edit: 0, builder: 0, publish: 0, retry: 0, data: 0, integ: 0, integView: 0, admin: 0 }
};
const fbStored = () => { let k = ''; try { k = localStorage.getItem('fb-role') || ''; } catch (e) {} if (!k) { try { const m = /fb-role:(\w+)/.exec(window.name || ''); if (m) k = m[1]; } catch (e) {} } return FB_ACC[k] ? k : ''; };
const fbSetRole = (k) => { try { if (k) localStorage.setItem('fb-role', k); else localStorage.removeItem('fb-role'); } catch (e) {} try { window.name = k ? 'fb-role:' + k : ''; } catch (e) {} };
const FB_ME = FB_ACC[fbStored() || 'creator'], FB_C = FB_CANS[FB_ME.k];
const F = [
  { k: 'name', l: 'Full name', type: 'text', auto: 'name' },
  { k: 'email', l: 'Work email', type: 'email', auto: 'email' },
  { k: 'org', l: 'Organisation', type: 'text', auto: 'organization' },
  { k: 'pass', l: 'Password', type: 'password', auto: 'new-password', h: 'At least 12 characters.' }
];
const check = (k, v) => {
  const t = (v || '').trim();
  if (k === 'name' && !t) return 'Enter your name.';
  if (k === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t)) return 'Enter a valid work email.';
  if (k === 'org' && !t) return 'Enter your organisation name.';
  if (k === 'pass' && (v || '').length < 12) return 'Use at least 12 characters.';
  return '';
};
class Component extends DCLogic {
  state = { v: {}, tried: false, busy: false, step: 'form' };
  componentWillUnmount() { clearTimeout(this.t); }
  renderVals() {
    const s = this.state;
    return {
      asOwner: () => fbSetRole('admin'),
      isForm: s.step === 'form', isStart: s.step === 'start', busy: s.busy, submitL: s.busy ? 'Creating workspace' : 'Create workspace',
      first: (s.v.name || 'there').trim().split(' ')[0],
      fields: F.map((f) => {
        const err = s.tried ? check(f.k, s.v[f.k]) : '';
        return { ...f, id: 'r-' + f.k, h: err ? '' : f.h || '', v: s.v[f.k] || '', err, bad: err ? 'bad' : '', invalid: err ? 'true' : 'false', change: (e) => this.setState({ v: { ...s.v, [f.k]: e.target.value } }) };
      }),
      submit: () => {
        if (F.some((f) => check(f.k, s.v[f.k]))) { this.setState({ tried: true }); return; }
        fbSetRole('admin');
        this.setState({ busy: true });
        this.t = setTimeout(() => this.setState({ busy: false, step: 'start' }), 800);
      },
      demo: [
        { t: 'Customer registers', m: '12 ms', c: 'ok', i: 'check' },
        { t: 'Details are validated', m: '4 ms', c: 'ok', i: 'check' },
        { t: 'Customer is saved to your database', m: '86 ms', c: 'ok', i: 'check' },
        { t: 'Welcome email is sent', m: '640 ms', c: 'ok', i: 'check' },
        { t: 'Sales team is notified', m: '210 ms', c: 'ok', i: 'check' }
      ]
    };
  }
}

return Component;
});
FB.def("Responsive",[{"t":"div","a":{"style":"width: 2520px; height: 1000px; box-sizing: border-box; background: var(--sunken); padding: 28px 20px; display: flex; gap: 40px; align-items: flex-start; font-family: var(--sans); color: var(--ink); font-size: 14px"},"c":[{"t":"div","a":{"class":"col","style":"gap: 12px"},"c":[{"t":"h2","a":{"class":"strong","style":"font-size: 14px"},"c":["Tablet, 760 px: icon rail, full monitoring"]},{"t":"div","a":{"style":"width: 760px; height: 880px; background: var(--bg); border: 1px solid var(--line-2); border-radius: 18px; overflow: hidden; display: flex"},"c":[{"t":"div","a":{"class":"col","style":"width: 60px; background: var(--surface); border-right: 1px solid var(--line); padding: 12px 10px; gap: 4px; align-items: center"},"c":[{"t":"svg","a":{"viewBox":"0 0 28 28","aria-hidden":"true","style":"width: 28px; height: 28px; margin-bottom: 12px"},"c":[{"t":"rect","a":{"width":"28","height":"28","rx":"7","style":"fill: #C2410C"},"c":[]},{"t":"path","a":{"d":"M6.5 18.5C9 9.5 19 9.5 21.5 18.5","style":"fill: none; stroke: #FFFFFF; stroke-width: 2.4; stroke-linecap: round"},"c":[]},{"t":"circle","a":{"cx":"6.5","cy":"19","r":"2.6","style":"fill: #FFFFFF"},"c":[]},{"t":"circle","a":{"cx":"21.5","cy":"19","r":"2.6","style":"fill: #FFFFFF"},"c":[]}]},{"t":"sc-for","a":{"list":"{{rail}}","as":"r","hint-placeholder-count":"8"},"c":[{"t":"span","a":{"class":"nav {{r.cls}}","style":"justify-content: center; padding: 0; height: 40px"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{r.g}}","s":"18","hint-size":"18px,18px"},"c":[]}]}]}]},{"t":"div","a":{"class":"grow col"},"c":[{"t":"div","a":{"class":"row between","style":"height: 52px; padding: 0 20px; background: var(--surface); border-bottom: 1px solid var(--line)"},"c":[{"t":"b","a":{"style":"font-weight: 600"},"c":["Overview"]},{"t":"span","a":{"class":"row"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"bell","s":"18","hint-size":"18px,18px"},"c":[]},{"t":"span","a":{"class":"avatar"},"c":["PR"]}]}]},{"t":"div","a":{"class":"col","style":"padding: 18px 20px; gap: 16px"},"c":[{"t":"div","a":{"class":"row between"},"c":[{"t":"h3","a":{"class":"page-title","style":"font-size: 20px"},"c":["Good morning, Priya"]},{"t":"span","a":{"class":"btn btn-p"},"c":["Create workflow"]}]},{"t":"div","a":{"class":"card","style":"display: grid; grid-template-columns: repeat(3, minmax(0, 1fr))"},"c":[{"t":"sc-for","a":{"list":"{{kpis}}","as":"k","hint-placeholder-count":"3"},"c":[{"t":"div","a":{"class":"stat"},"c":[{"t":"span","a":{"class":"stat-l"},"c":["{{k.l}}"]},{"t":"span","a":{"class":"stat-v","style":"font-size: 22px"},"c":["{{k.v}}"]}]}]}]},{"t":"div","a":{"class":"card card-b col","style":"gap: 8px"},"c":[{"t":"div","a":{"class":"row between"},"c":[{"t":"span","a":{"class":"card-t"},"c":["Workflow activity"]},{"t":"span","a":{"class":"small muted"},"c":["Last 14 days"]}]},{"t":"div","a":{"class":"bars","style":"height: 130px; border-bottom: 1px solid var(--line-2)"},"c":[{"t":"sc-for","a":{"list":"{{bars}}","as":"b","hint-placeholder-count":"14"},"c":[{"t":"div","a":{"class":"bar-col"},"c":[{"t":"div","a":{"class":"bar","style":"height: {{b}}%"},"c":[]}]}]}]}]},{"t":"div","a":{"class":"card"},"c":[{"t":"div","a":{"class":"card-h","style":"padding-bottom: 10px"},"c":[{"t":"span","a":{"class":"card-t"},"c":["Recent executions"]}]},{"t":"table","a":{"class":"tbl"},"c":[{"t":"tbody","a":{},"c":[{"t":"sc-for","a":{"list":"{{runs}}","as":"r","hint-placeholder-count":"5"},"c":[{"t":"tr","a":{},"c":[{"t":"td","a":{},"c":[{"t":"span","a":{"class":"strong"},"c":["{{r.w}}"]},{"t":"div","a":{"class":"mono dim"},"c":["{{r.id}}"]}]},{"t":"td","a":{},"c":[{"t":"span","a":{"class":"trace"},"c":[{"t":"sc-for","a":{"list":"{{r.t}}","as":"t"},"c":[{"t":"i","a":{"class":"seg {{t}}"},"c":[]}]}]}]},{"t":"td","a":{},"c":[{"t":"span","a":{"class":"badge {{r.b}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{r.i}}","s":"13","hint-size":"13px,13px"},"c":[]},"{{r.l}}"]}]},{"t":"td","a":{"class":"r num"},"c":["{{r.d}}"]}]}]}]}]}]}]}]}]}]},{"t":"div","a":{"class":"col","style":"gap: 12px"},"c":[{"t":"h2","a":{"class":"strong","style":"font-size: 14px"},"c":["Phone: overview"]},{"t":"div","a":{"class":"col","style":"width: 390px; height: 844px; background: var(--bg); border: 1px solid var(--line-2); border-radius: 28px; overflow: hidden"},"c":[{"t":"div","a":{"class":"row between","style":"height: 52px; flex: none; padding: 0 16px; background: var(--surface); border-bottom: 1px solid var(--line)"},"c":[{"t":"b","a":{"style":"font-weight: 600"},"c":["Overview"]},{"t":"span","a":{"class":"row"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"bell","s":"18","hint-size":"18px,18px"},"c":[]},{"t":"span","a":{"class":"avatar"},"c":["PR"]}]}]},{"t":"div","a":{"class":"grow col","style":"padding: 16px; gap: 14px; overflow: hidden"},"c":[{"t":"h3","a":{"class":"page-title","style":"font-size: 20px"},"c":["Good morning, Priya"]},{"t":"div","a":{"class":"notice err","style":"padding: 11px 12px; align-items: flex-start"},"c":[{"t":"span","a":{"style":"margin-top: 2px"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"alert","s":"15","hint-size":"15px,15px"},"c":[]}]},{"t":"span","a":{"class":"grow"},"c":[{"t":"strong","a":{},"c":["New customer onboarding"]}," failed at Send welcome email."]}]},{"t":"div","a":{"class":"card col"},"c":[{"t":"sc-for","a":{"list":"{{phoneKpis}}","as":"k","hint-placeholder-count":"4"},"c":[{"t":"div","a":{"class":"row between","style":"padding: 12px 14px; border-bottom: 1px solid var(--line)"},"c":[{"t":"span","a":{"class":"muted"},"c":["{{k.l}}"]},{"t":"span","a":{"class":"strong num","style":"font-size: 17px"},"c":["{{k.v}}"]}]}]}]},{"t":"div","a":{"class":"card card-b col","style":"gap: 8px"},"c":[{"t":"span","a":{"class":"card-t"},"c":["Last 7 days"]},{"t":"div","a":{"class":"bars","style":"height: 96px; border-bottom: 1px solid var(--line-2); gap: 6px"},"c":[{"t":"sc-for","a":{"list":"{{bars7}}","as":"b","hint-placeholder-count":"7"},"c":[{"t":"div","a":{"class":"bar-col"},"c":[{"t":"div","a":{"class":"bar","style":"height: {{b}}%"},"c":[]}]}]}]}]}]},{"t":"div","a":{"class":"row","style":"height: 60px; flex: none; background: var(--surface); border-top: 1px solid var(--line); justify-content: space-around; padding: 0 6px"},"c":[{"t":"sc-for","a":{"list":"{{tabsA}}","as":"t","hint-placeholder-count":"5"},"c":[{"t":"span","a":{"class":"nav {{t.cls}}","style":"flex-direction: column; gap: 2px; height: 50px; justify-content: center; padding: 0; flex: 1; font-size: 10.5px"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{t.g}}","s":"18","hint-size":"18px,18px"},"c":[]},"{{t.l}}"]}]}]}]}]},{"t":"div","a":{"class":"col","style":"gap: 12px"},"c":[{"t":"h2","a":{"class":"strong","style":"font-size: 14px"},"c":["Phone: executions"]},{"t":"div","a":{"class":"col","style":"width: 390px; height: 844px; background: var(--bg); border: 1px solid var(--line-2); border-radius: 28px; overflow: hidden"},"c":[{"t":"div","a":{"class":"row between","style":"height: 52px; flex: none; padding: 0 16px; background: var(--surface); border-bottom: 1px solid var(--line)"},"c":[{"t":"b","a":{"style":"font-weight: 600"},"c":["Executions"]},{"t":"dc-import","a":{"name":"Icon","g":"filter","s":"18","hint-size":"18px,18px"},"c":[]}]},{"t":"div","a":{"class":"grow col","style":"padding: 14px 16px; gap: 10px; overflow: hidden"},"c":[{"t":"div","a":{"class":"row","style":"gap: 6px"},"c":[{"t":"span","a":{"class":"chip","style":"height: 36px"},"c":["All"]},{"t":"span","a":{"class":"chip is-on","style":"height: 36px"},"c":["Failed"]},{"t":"span","a":{"class":"chip","style":"height: 36px"},"c":["Running"]}]},{"t":"sc-for","a":{"list":"{{runCards}}","as":"r","hint-placeholder-count":"5"},"c":[{"t":"div","a":{"class":"card","style":"padding: 12px 14px; display: flex; flex-direction: column; gap: 7px"},"c":[{"t":"div","a":{"class":"row between"},"c":[{"t":"span","a":{"class":"strong trunc"},"c":["{{r.w}}"]},{"t":"span","a":{"class":"badge {{r.b}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{r.i}}","s":"13","hint-size":"13px,13px"},"c":[]},"{{r.l}}"]}]},{"t":"span","a":{"class":"trace"},"c":[{"t":"sc-for","a":{"list":"{{r.t}}","as":"t"},"c":[{"t":"i","a":{"class":"seg {{t}}"},"c":[]}]}]},{"t":"div","a":{"class":"row between small muted"},"c":[{"t":"span","a":{},"c":["{{r.a}}"]},{"t":"span","a":{"class":"num"},"c":["{{r.d}}"]}]}]}]}]},{"t":"div","a":{"class":"row","style":"height: 60px; flex: none; background: var(--surface); border-top: 1px solid var(--line); justify-content: space-around; padding: 0 6px"},"c":[{"t":"sc-for","a":{"list":"{{tabsB}}","as":"t","hint-placeholder-count":"5"},"c":[{"t":"span","a":{"class":"nav {{t.cls}}","style":"flex-direction: column; gap: 2px; height: 50px; justify-content: center; padding: 0; flex: 1; font-size: 10.5px"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{t.g}}","s":"18","hint-size":"18px,18px"},"c":[]},"{{t.l}}"]}]}]}]}]},{"t":"div","a":{"class":"col","style":"gap: 12px"},"c":[{"t":"h2","a":{"class":"strong","style":"font-size: 14px"},"c":["Phone: failed run, one-tap retry"]},{"t":"div","a":{"class":"col","style":"width: 390px; height: 844px; background: var(--bg); border: 1px solid var(--line-2); border-radius: 28px; overflow: hidden"},"c":[{"t":"div","a":{"class":"row","style":"height: 52px; flex: none; padding: 0 16px; background: var(--surface); border-bottom: 1px solid var(--line)"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"left","s":"18","hint-size":"18px,18px"},"c":[]},{"t":"b","a":{"style":"font-weight: 600"},"c":["EX-48213"]},{"t":"span","a":{"class":"badge b-err","style":"margin-left: auto"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"x","s":"13","hint-size":"13px,13px"},"c":[]},"Failed"]}]},{"t":"div","a":{"class":"grow col","style":"padding: 16px; gap: 14px; overflow: hidden"},"c":[{"t":"div","a":{},"c":[{"t":"div","a":{"class":"strong","style":"font-size: 16px"},"c":["New customer onboarding"]},{"t":"div","a":{"class":"small muted"},"c":["Today, 10:42, took 38.2 s"]}]},{"t":"div","a":{"class":"notice err","style":"padding: 12px; font-size: 13px; align-items: flex-start"},"c":[{"t":"span","a":{},"c":[{"t":"strong","a":{},"c":["Send welcome email failed."]}," Gmail's daily sending limit was reached. The customer was saved. Retry around 13:30."]}]},{"t":"div","a":{"class":"card","style":"overflow: hidden"},"c":[{"t":"sc-for","a":{"list":"{{detail}}","as":"s","hint-placeholder-count":"5"},"c":[{"t":"div","a":{"class":"row","style":"padding: 11px 12px; border-bottom: 1px solid var(--line); gap: 10px"},"c":[{"t":"span","a":{"class":"tl-n {{s.c}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{s.i}}","s":"13","hint-size":"13px,13px"},"c":[]}]},{"t":"span","a":{"class":"grow trunc"},"c":["{{s.t}}"]},{"t":"span","a":{"class":"small muted num"},"c":["{{s.m}}"]}]}]}]},{"t":"span","a":{"class":"btn btn-p","style":"height: 46px"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"retry","s":"15","hint-size":"15px,15px"},"c":[]},"Retry from failed step"]}]}]}]},{"t":"div","a":{"class":"col","style":"gap: 12px"},"c":[{"t":"h2","a":{"class":"strong","style":"font-size: 14px"},"c":["Phone: builder stays on desktop"]},{"t":"div","a":{"class":"col","style":"width: 390px; height: 844px; background: var(--bg); border: 1px solid var(--line-2); border-radius: 28px; overflow: hidden"},"c":[{"t":"div","a":{"class":"row","style":"height: 52px; flex: none; padding: 0 16px; background: var(--surface); border-bottom: 1px solid var(--line)"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"left","s":"18","hint-size":"18px,18px"},"c":[]},{"t":"b","a":{"style":"font-weight: 600"},"c":["New customer onboarding"]}]},{"t":"div","a":{"class":"col","style":"padding: 16px; gap: 14px"},"c":[{"t":"div","a":{"class":"notice info","style":"align-items: flex-start; padding: 12px"},"c":[{"t":"span","a":{"style":"margin-top: 2px"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"flow","s":"15","hint-size":"15px,15px"},"c":[]}]},{"t":"span","a":{"class":"grow"},"c":["Editing needs a larger screen. Open this workflow on a desktop to change its steps."]}]},{"t":"div","a":{"class":"card card-b col","style":"gap: 10px"},"c":[{"t":"div","a":{"class":"row between"},"c":[{"t":"span","a":{"class":"muted"},"c":["Status"]},{"t":"span","a":{"class":"badge b-ok"},"c":[{"t":"span","a":{"class":"dot ok"},"c":[]},"Published"]}]},{"t":"div","a":{"class":"row between"},"c":[{"t":"span","a":{"class":"muted"},"c":["Runs, last 30 days"]},{"t":"span","a":{"class":"strong num"},"c":["4,812"]}]},{"t":"div","a":{"class":"row between"},"c":[{"t":"span","a":{"class":"muted"},"c":["Success rate"]},{"t":"span","a":{"class":"strong num"},"c":["97.6%"]}]}]},{"t":"span","a":{"class":"btn btn-p","style":"height: 46px"},"c":["View the latest failed run"]},{"t":"span","a":{"class":"btn","style":"height: 46px"},"c":["Unpublish workflow"]}]}]}]}]}],{},function(DCLogic){

const S14 = [823,705,610,713,758,203,213,808,806,688,737,832,289,181,719,788,684,676].slice(-14);
const pct = (a) => { const m = Math.max(...a); return a.map((v) => Math.round(v / m * 96)); };
const tabs = (on) => [['overview', 'Overview'], ['flow', 'Workflows'], ['runs', 'Runs'], ['chart', 'Analytics'], ['gear', 'Settings']].map(([g, l]) => ({ g, l, cls: g === on ? 'is-on' : '' }));
const OK = { b: 'b-ok', i: 'check', l: 'Success' }, ERR = { b: 'b-err', i: 'x', l: 'Failed' };
class Component extends DCLogic {
  renderVals() {
    return {
      rail: ['overview', 'flow', 'template', 'plug', 'runs', 'chart', 'users', 'gear'].map((g) => ({ g, cls: g === 'overview' ? 'is-on' : '' })),
      kpis: [{ l: 'Published workflows', v: '18' }, { l: 'Failed runs', v: '402' }, { l: 'Success rate', v: '97.8%' }],
      bars: pct(S14), bars7: pct(S14.slice(-7)),
      runs: [
        { w: 'New customer onboarding', id: 'EX-48213', t: ['ok','ok','ok','err','skip'], d: '38.2 s', ...ERR },
        { w: 'Support ticket triage', id: 'EX-48212', t: ['ok','ok','ok','ok'], d: '1.6 s', ...OK },
        { w: 'New customer onboarding', id: 'EX-48209', t: ['ok','ok','ok','ok','ok'], d: '2.8 s', ...OK },
        { w: 'Invoice paid to ledger', id: 'EX-48208', t: ['ok','ok','ok','ok'], d: '1.2 s', ...OK },
        { w: 'Overdue task reminders', id: 'EX-48207', t: ['ok','ok','ok'], d: '3.1 s', ...OK }
      ],
      phoneKpis: [{ l: 'Published workflows', v: '18' }, { l: 'Successful runs', v: '17,912' }, { l: 'Failed runs', v: '402' }, { l: 'Success rate', v: '97.8%' }],
      tabsA: tabs('overview'), tabsB: tabs('runs'),
      runCards: [
        { w: 'New customer onboarding', t: ['ok','ok','ok','err','skip'], a: 'Today, 10:42', d: '38.2 s', ...ERR },
        { w: 'Support ticket triage', t: ['ok','err','skip','skip'], a: 'Today, 10:39', d: '0.8 s', ...ERR },
        { w: 'Lead sync to PostgreSQL', t: ['ok','err','skip'], a: 'Today, 08:30', d: '30.4 s', ...ERR }
      ],
      detail: [
        { t: 'Webhook trigger', m: '12 ms', c: 'ok', i: 'check' }, { t: 'Validate customer', m: '4 ms', c: 'ok', i: 'check' },
        { t: 'Save to database', m: '86 ms', c: 'ok', i: 'check' }, { t: 'Send welcome email', m: '38.1 s', c: 'err', i: 'x' },
        { t: 'Notify sales team', m: 'Not run', c: 'skip', i: 'minus' }
      ]
    };
  }
}

return Component;
});
FB.def("RoleOverview",[{"t":"div","a":{"class":"ro"},"c":[{"t":"section","a":{"class":"card stats","aria-label":"{{statsLabel}}"},"c":[{"t":"sc-for","a":{"list":"{{stats}}","as":"s","hint-placeholder-count":"4"},"c":[{"t":"div","a":{"class":"stat"},"c":[{"t":"span","a":{"class":"stat-l"},"c":["{{s.l}}"]},{"t":"span","a":{"class":"stat-v"},"c":["{{s.v}}"]},{"t":"span","a":{"class":"stat-d"},"c":["{{s.d}}"]}]}]}]},{"t":"sc-if","a":{"value":"{{isAdmin}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"div","a":{"class":"ro-2"},"c":[{"t":"section","a":{"class":"card","aria-label":"Needs an Administrator"},"c":[{"t":"div","a":{"class":"card-h","style":"padding-bottom: 10px"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Needs an Administrator"]}]},{"t":"sc-for","a":{"list":"{{adminTasks}}","as":"t","hint-placeholder-count":"3"},"c":[{"t":"div","a":{"class":"ro-r"},"c":[{"t":"span","a":{"class":"ro-sq","style":"background: {{t.bg}}; color: {{t.fg}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{t.g}}","s":"16","hint-size":"16px,16px"},"c":[]}]},{"t":"span","a":{"class":"ro-t"},"c":[{"t":"b","a":{},"c":["{{t.t}}"]},{"t":"span","a":{},"c":["{{t.d}}"]}]},{"t":"a","a":{"class":"btn btn-sm","href":"{{t.href}}"},"c":["{{t.a}}"]}]}]}]},{"t":"section","a":{"class":"card","aria-label":"Team by role"},"c":[{"t":"div","a":{"class":"card-h","style":"padding-bottom: 10px"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Team by role"]},{"t":"a","a":{"class":"small strong","href":"/team"},"c":["Manage team"]}]},{"t":"sc-for","a":{"list":"{{team}}","as":"m","hint-placeholder-count":"4"},"c":[{"t":"div","a":{"class":"ro-r"},"c":[{"t":"span","a":{"class":"ro-t"},"c":[{"t":"b","a":{},"c":["{{m.r}}"]},{"t":"span","a":{},"c":["{{m.names}}"]}]},{"t":"span","a":{"class":"num strong"},"c":["{{m.n}}"]}]}]}]}]},{"t":"section","a":{"class":"card","aria-label":"Workspace changes"},"c":[{"t":"div","a":{"class":"card-h","style":"padding-bottom: 10px"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Recent workspace changes"]},{"t":"a","a":{"class":"small strong","href":"/settings"},"c":["Settings"]}]},{"t":"sc-for","a":{"list":"{{audit}}","as":"a","hint-placeholder-count":"4"},"c":[{"t":"div","a":{"class":"ro-r"},"c":[{"t":"span","a":{"class":"avatar {{a.a}}","style":"flex: none"},"c":["{{a.i}}"]},{"t":"span","a":{"class":"ro-t"},"c":[{"t":"b","a":{},"c":["{{a.t}}"]},{"t":"span","a":{},"c":["{{a.w}}"]}]},{"t":"span","a":{"class":"small muted"},"c":["{{a.d}}"]}]}]}]}]},{"t":"sc-if","a":{"value":"{{isOperator}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"ro-2"},"c":[{"t":"section","a":{"class":"card","aria-label":"Failure queue"},"c":[{"t":"div","a":{"class":"card-h","style":"padding-bottom: 10px"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Failure queue"]},{"t":"a","a":{"class":"small strong","href":"/executions"},"c":["All executions"]}]},{"t":"sc-for","a":{"list":"{{queue}}","as":"q","hint-placeholder-count":"3"},"c":[{"t":"div","a":{"class":"ro-r"},"c":[{"t":"span","a":{"class":"ro-t"},"c":[{"t":"b","a":{},"c":["{{q.wf}}"]},{"t":"span","a":{"class":"{{q.cls}}"},"c":["{{q.why}}"]}]},{"t":"a","a":{"class":"btn btn-sm btn-g","href":"/executions"},"c":["Investigate"]},{"t":"button","a":{"class":"btn btn-sm","disabled":"{{q.busy}}","onClick":"{{q.retry}}"},"c":["{{q.btn}}"]}]}]}]},{"t":"section","a":{"class":"card","aria-label":"Integration health"},"c":[{"t":"div","a":{"class":"card-h","style":"padding-bottom: 10px"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Integration health"]},{"t":"a","a":{"class":"small strong","href":"/integrations"},"c":["Check all"]}]},{"t":"sc-for","a":{"list":"{{health}}","as":"h","hint-placeholder-count":"5"},"c":[{"t":"div","a":{"class":"ro-r"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"{{h.app}}","s":"30","hint-size":"30px,30px"},"c":[]},{"t":"span","a":{"class":"ro-t"},"c":[{"t":"b","a":{},"c":["{{h.n}}"]},{"t":"span","a":{},"c":["{{h.d}}"]}]},{"t":"span","a":{"class":"badge {{h.cls}}"},"c":[{"t":"span","a":{"class":"dot {{h.dot}}"},"c":[]},"{{h.s}}"]}]}]}]}]},{"t":"section","a":{"class":"card","aria-label":"Least reliable workflows"},"c":[{"t":"div","a":{"class":"card-h","style":"padding-bottom: 10px"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Least reliable workflows, last 30 days"]},{"t":"a","a":{"class":"small strong","href":"/analytics"},"c":["Analytics"]}]},{"t":"sc-for","a":{"list":"{{weak}}","as":"w","hint-placeholder-count":"3"},"c":[{"t":"div","a":{"class":"ro-r"},"c":[{"t":"span","a":{"class":"ro-t"},"c":[{"t":"b","a":{},"c":["{{w.n}}"]},{"t":"span","a":{},"c":["{{w.runs}} runs"]}]},{"t":"span","a":{"class":"num strong"},"c":["{{w.rate}}"]}]}]}]}]},{"t":"sc-if","a":{"value":"{{isBusiness}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"section","a":{"class":"card","aria-label":"Your automations"},"c":[{"t":"div","a":{"class":"card-h"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Your automations"]},{"t":"a","a":{"class":"small strong","href":"/workflows"},"c":["See all"]}]},{"t":"div","a":{"class":"ro-auto"},"c":[{"t":"sc-for","a":{"list":"{{autos}}","as":"a","hint-placeholder-count":"6"},"c":[{"t":"article","a":{"class":"ro-c"},"c":[{"t":"b","a":{},"c":["{{a.n}}"]},{"t":"p","a":{},"c":["{{a.d}}"]},{"t":"div","a":{"class":"ro-c-f"},"c":[{"t":"span","a":{"class":"small muted"},"c":["Last run: {{a.last}}"]},{"t":"button","a":{"class":"btn btn-sm","disabled":"{{a.busy}}","onClick":"{{a.run}}"},"c":["{{a.btn}}"]}]}]}]}]}]},{"t":"section","a":{"class":"card","aria-label":"What happened today"},"c":[{"t":"div","a":{"class":"card-h","style":"padding-bottom: 10px"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["What happened today"]},{"t":"a","a":{"class":"small strong","href":"/executions"},"c":["All activity"]}]},{"t":"sc-for","a":{"list":"{{today}}","as":"t","hint-placeholder-count":"5"},"c":[{"t":"div","a":{"class":"ro-r"},"c":[{"t":"span","a":{"class":"dot {{t.dot}}","style":"flex: none"},"c":[]},{"t":"span","a":{"class":"ro-t"},"c":[{"t":"b","a":{},"c":["{{t.t}}"]}]},{"t":"span","a":{"class":"small muted"},"c":["{{t.w}}"]}]}]}]}]},{"t":"sc-if","a":{"value":"{{toast}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"toast","role":"status"},"c":["{{toast}}"]}]}]}],{},function(DCLogic){

const FB_ACC = {
  admin: { k: 'admin', n: 'Jonah Thomas', f: 'Jonah', i: 'JT', a: 'a5', r: 'Administrator', e: 'jonah@meridianlogistics.example' },
  creator: { k: 'creator', n: 'Priya Raman', f: 'Priya', i: 'PR', a: '', r: 'Workflow Creator', e: 'priya@meridianlogistics.example' },
  operator: { k: 'operator', n: 'Rahul Shah', f: 'Rahul', i: 'RS', a: 'a3', r: 'Technical Operator', e: 'rahul@meridianlogistics.example' },
  business: { k: 'business', n: 'Lena Costa', f: 'Lena', i: 'LC', a: 'a2', r: 'Business User', e: 'lena@meridianlogistics.example' }
};
const FB_CANS = {
  admin: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 1 },
  creator: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 0 },
  operator: { edit: 0, builder: 1, publish: 0, retry: 1, data: 1, integ: 0, integView: 1, admin: 0 },
  business: { edit: 0, builder: 0, publish: 0, retry: 0, data: 0, integ: 0, integView: 0, admin: 0 }
};
const fbStored = () => { let k = ''; try { k = localStorage.getItem('fb-role') || ''; } catch (e) {} if (!k) { try { const m = /fb-role:(\w+)/.exec(window.name || ''); if (m) k = m[1]; } catch (e) {} } return FB_ACC[k] ? k : ''; };
const fbSetRole = (k) => { try { if (k) localStorage.setItem('fb-role', k); else localStorage.removeItem('fb-role'); } catch (e) {} try { window.name = k ? 'fb-role:' + k : ''; } catch (e) {} };
const FB_ME = FB_ACC[fbStored() || 'creator'], FB_C = FB_CANS[FB_ME.k];
const STATS = {
  admin: [['Members', '6', '1 invite pending'], ['Connected apps', '5', '2 need attention'], ['Runs used', '18,321', '73% of 25,000 this period'], ['Two-factor sign-in', 'Required', 'For everyone']],
  operator: [['Failed runs', '3', 'Need action now'], ['Retrying now', '1', 'Lead sync to PostgreSQL'], ['Failure rate', '2.2%', '402 of 18,314 runs, last 30 days'], ['Integrations', '2', 'Need attention']],
  business: [['Automations running', '18', 'Published and active'], ['Finished successfully', '17,912', 'Last 30 days'], ['Had a problem', '3', 'The technical team can see these']]
};
const QUEUE = [
  { id: 'a', wf: 'New customer onboarding', why: 'Failed at Send welcome email: Gmail daily limit reached' },
  { id: 'b', wf: 'Support ticket triage', why: 'Failed at Post to on-call: Slack channel not found' },
  { id: 'c', wf: 'Lead sync to PostgreSQL', why: 'Failed at Insert leads: connection timed out' }
];
const HEALTH = [
  { app: 'gmail', n: 'Gmail', d: 'Quota reached today, 10:42', s: 'Limit reached', cls: 'b-warn', dot: 'warn' },
  { app: 'sheets', n: 'Google Sheets', d: 'Token expires in 3 days', s: 'Expiring', cls: 'b-warn', dot: 'warn' },
  { app: 'slack', n: 'Slack', d: 'Checked 4 minutes ago', s: 'Healthy', cls: 'b-ok', dot: 'ok' },
  { app: 'pg', n: 'PostgreSQL', d: 'Checked 4 minutes ago', s: 'Healthy', cls: 'b-ok', dot: 'ok' },
  { app: 'http', n: 'Custom HTTP API', d: 'Checked yesterday, 18:10', s: 'Healthy', cls: 'b-ok', dot: 'ok' }
];
const AUTOS = [
  { n: 'New customer onboarding', d: 'Saves each new customer, sends a welcome email and alerts sales.', last: '2 min ago' },
  { n: 'Invoice paid to ledger', d: 'Adds paid invoices to the finance sheet and emails a receipt.', last: 'running now' },
  { n: 'Support ticket triage', d: 'Sorts new tickets by priority and posts urgent ones to on-call.', last: '3 min ago' },
  { n: 'Overdue task reminders', d: 'Each weekday, reminds owners about tasks past their due date.', last: 'today, 09:00' },
  { n: 'Weekly sales digest', d: 'Sends closed deals to sales leads every Monday.', last: '2 Nov, 08:30' },
  { n: 'Lead sync to PostgreSQL', d: 'Copies new rows from the leads sheet into the sales database.', last: '6 min ago' }
];
class Component extends DCLogic {
  state = { fixed: {}, busy: {}, toast: '' };
  componentWillUnmount() { clearTimeout(this.tt); (this.ts || []).forEach(clearTimeout); }
  say(t) { clearTimeout(this.tt); this.setState({ toast: t }); this.tt = setTimeout(() => this.setState({ toast: '' }), 3500); }
  later(f, ms) { (this.ts = this.ts || []).push(setTimeout(f, ms)); }
  mark(id, name, done) {
    this.setState({ busy: { ...this.state.busy, [id]: true } });
    this.later(() => { this.setState({ busy: { ...this.state.busy, [id]: false }, fixed: { ...this.state.fixed, [id]: true } }); this.say(done(name)); }, 1100);
  }
  renderVals() {
    const s = this.state, k = FB_ME.k;
    return {
      isAdmin: k === 'admin', isOperator: k === 'operator', isBusiness: k === 'business',
      statsLabel: k === 'admin' ? 'Workspace summary' : k === 'operator' ? 'Run health' : 'Automation summary',
      stats: (STATS[k] || []).map(([l, v, d]) => ({ l, v, d })),
      adminTasks: [
        { g: 'plug', bg: 'var(--warn-t)', fg: 'var(--warn)', t: 'The Google Sheets token expires in 3 days', d: '3 workflows use this connection.', a: 'Review', href: '/integrations' },
        { g: 'alert', bg: 'var(--warn-t)', fg: 'var(--warn)', t: 'Gmail reached its daily limit', d: '6 workflows use this connection.', a: 'Review', href: '/integrations' },
        { g: 'users', bg: 'var(--brand-t)', fg: 'var(--brand-ink)', t: 'Sara Khan has not accepted her invite', d: 'Invited yesterday as a Business User.', a: 'Open team', href: '/team' }
      ],
      team: [
        { r: 'Administrator', names: 'Jonah Thomas, Anika Menon', n: 2 },
        { r: 'Workflow Creator', names: 'Priya Raman', n: 1 },
        { r: 'Technical Operator', names: 'Rahul Shah', n: 1 },
        { r: 'Business User', names: 'Lena Costa, Sara Khan (invited)', n: 2 }
      ],
      audit: [
        { i: 'AM', a: 'a4', w: 'Anika Menon', t: 'Reconnected the Slack integration', d: 'Yesterday, 17:20' },
        { i: 'JT', a: 'a5', w: 'Jonah Thomas', t: 'Invited sara@meridianlogistics.example', d: 'Yesterday, 11:02' },
        { i: 'RS', a: 'a3', w: 'Rahul Shah', t: 'Rotated the PostgreSQL credential', d: '28 Oct, 14:37' },
        { i: 'JT', a: 'a5', w: 'Jonah Thomas', t: 'Created the Reporting export API key', d: '3 Oct, 10:15' }
      ],
      queue: QUEUE.map((q) => {
        const done = s.fixed[q.id], busy = !!s.busy[q.id];
        return { ...q, why: done ? 'Retried and succeeded just now' : q.why, cls: done ? '' : 'err', busy: busy || !!done, btn: busy ? 'Retrying' : done ? 'Done' : 'Retry', retry: () => this.mark(q.id, q.wf, (n) => n + ' succeeded after retry.') };
      }),
      health: HEALTH,
      weak: [{ n: 'Support ticket triage', rate: '96.1%', runs: '2,944' }, { n: 'New customer onboarding', rate: '97.6%', runs: '4,812' }, { n: 'Lead sync to PostgreSQL', rate: '99.1%', runs: '2,190' }],
      autos: AUTOS.map((a) => {
        const busy = !!s.busy[a.n], done = s.fixed[a.n];
        return { ...a, last: done ? 'just now' : a.last, busy, btn: busy ? 'Starting' : 'Run now', run: () => this.mark(a.n, a.n, (n) => n + ' started. You can follow it in Activity.') };
      }),
      today: [
        { dot: 'err', t: "New customer onboarding couldn't send a welcome email, because Gmail reached its daily limit.", w: '10:42' },
        { dot: '', t: 'Invoice paid to ledger is running now.', w: '10:43' },
        { dot: 'ok', t: 'Support ticket triage finished.', w: '10:41' },
        { dot: 'warn', t: 'Lead sync to PostgreSQL is trying again after a timeout.', w: '10:38' },
        { dot: 'ok', t: 'Overdue task reminders were sent.', w: '09:00' }
      ],
      toast: s.toast
    };
  }
}

return Component;
});
FB.def("Settings",[{"t":"sc-if","a":{"value":"{{fbDenied}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"dc-import","a":{"name":"NoAccess","hint-size":"100%,100vh"},"c":[]}]},{"t":"sc-if","a":{"value":"{{fbOk}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"div","a":{"class":"app"},"c":[{"t":"dc-import","a":{"name":"Sidebar","active":"{{navActive}}","hint-size":"232px,100vh"},"c":[]},{"t":"div","a":{"class":"main"},"c":[{"t":"dc-import","a":{"name":"Topbar","page":"{{crumb}}","hint-size":"100%,56px"},"c":[]},{"t":"main","a":{"class":"page","style":"max-width: 1120px"},"c":[{"t":"div","a":{"class":"page-head"},"c":[{"t":"div","a":{},"c":[{"t":"h1","a":{"class":"page-title"},"c":["{{heading}}"]},{"t":"p","a":{"class":"page-sub"},"c":["{{sub}}"]}]},{"t":"sc-if","a":{"value":"{{isTeam}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"button","a":{"class":"btn btn-p","onClick":"{{openInvite}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"plus","s":"15","hint-size":"15px,15px"},"c":[]},"Invite member"]}]},{"t":"sc-if","a":{"value":"{{isCreds}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"button","a":{"class":"btn btn-p","onClick":"{{newKey}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"plus","s":"15","hint-size":"15px,15px"},"c":[]},"Create API key"]}]}]},{"t":"div","a":{"class":"tabs","style":"overflow-y: hidden","role":"tablist","aria-label":"Settings sections"},"c":[{"t":"sc-for","a":{"list":"{{tabs}}","as":"t","hint-placeholder-count":"7"},"c":[{"t":"button","a":{"class":"tab {{t.cls}}","role":"tab","aria-selected":"{{t.sel}}","onClick":"{{t.pick}}"},"c":["{{t.l}}"]}]}]},{"t":"sc-if","a":{"value":"{{isProfile}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"section","a":{"class":"card card-b col","style":"gap: 16px; max-width: 640px"},"c":[{"t":"div","a":{"class":"row","style":"gap: 14px"},"c":[{"t":"span","a":{"class":"avatar {{meA}}","style":"width: 52px; height: 52px; font-size: 16px"},"c":["{{meI}}"]},{"t":"div","a":{},"c":[{"t":"div","a":{"class":"strong"},"c":["{{meN}}"]},{"t":"div","a":{"class":"small muted"},"c":["{{meR}}"]}]}]},{"t":"div","a":{"style":"display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 14px"},"c":[{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"p-n"},"c":["Full name"]},{"t":"input","a":{"id":"p-n","class":"input {{nameBad}}","value":"{{profileName}}","onChange":"{{onName}}"},"c":[]},{"t":"sc-if","a":{"value":"{{nameErr}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"span","a":{"class":"err-msg"},"c":["{{nameErr}}"]}]}]},{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"p-e"},"c":["Work email"]},{"t":"input","a":{"id":"p-e","class":"input","type":"email","value":"{{meE}}","readonly":""},"c":[]},{"t":"span","a":{"class":"hint"},"c":["Ask an Administrator to change this."]}]},{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"p-t"},"c":["Time zone"]},{"t":"select","a":{"id":"p-t","class":"select"},"c":[{"t":"option","a":{},"c":["Asia/Kolkata"]},{"t":"option","a":{},"c":["Europe/London"]},{"t":"option","a":{},"c":["UTC"]}]},{"t":"span","a":{"class":"hint"},"c":["Run times are shown in this time zone."]}]}]},{"t":"div","a":{"class":"row"},"c":[{"t":"button","a":{"class":"btn btn-p","onClick":"{{saveProfile}}"},"c":["Save profile"]}]}]}]},{"t":"sc-if","a":{"value":"{{isWorkspace}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"section","a":{"class":"card card-b col","style":"gap: 16px; max-width: 640px"},"c":[{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"w-n"},"c":["Workspace name"]},{"t":"input","a":{"id":"w-n","class":"input","value":"Meridian Logistics"},"c":[]}]},{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"w-r"},"c":["Keep run history for"]},{"t":"select","a":{"id":"w-r","class":"select"},"c":[{"t":"option","a":{},"c":["90 days"]},{"t":"option","a":{},"c":["30 days"]},{"t":"option","a":{},"c":["1 year"]}]},{"t":"span","a":{"class":"hint"},"c":["Input and output data is deleted after this time. Summary figures stay in Analytics."]}]},{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"w-d"},"c":["Default retries for new steps"]},{"t":"select","a":{"id":"w-d","class":"select"},"c":[{"t":"option","a":{},"c":["Retry 3 times, then stop the run"]},{"t":"option","a":{},"c":["Stop the run immediately"]}]}]},{"t":"div","a":{"class":"row"},"c":[{"t":"button","a":{"class":"btn btn-p","onClick":"{{saveGeneric}}"},"c":["Save workspace"]}]}]},{"t":"section","a":{"class":"card card-b col","style":"gap: 8px; max-width: 640px"},"c":[{"t":"div","a":{"class":"row between"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Plan and usage"]},{"t":"span","a":{"class":"small muted"},"c":["Resets 1 Dec"]}]},{"t":"div","a":{"class":"hbar"},"c":[{"t":"i","a":{"style":"width: 73%"},"c":[]}]},{"t":"div","a":{"class":"small muted"},"c":["18,321 of 25,000 live runs used. Live runs and retries count. Test runs are free."]}]},{"t":"section","a":{"class":"col","style":"gap: 8px; max-width: 640px"},"c":[{"t":"div","a":{"class":"row between"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Danger zone"]},{"t":"span","a":{"class":"small muted"},"c":["Administrators only"]}]},{"t":"div","a":{"class":"row between wrap","style":"gap: 12px; border: 1px solid #F0B8BE; background: var(--err-t); border-radius: var(--r-l); padding: 13px 16px"},"c":[{"t":"div","a":{"class":"grow","style":"min-width: 240px"},"c":[{"t":"div","a":{"class":"strong","style":"font-size: 13px; color: #7E111C"},"c":["Delete this workspace"]},{"t":"div","a":{"class":"small","style":"color: #7E111C"},"c":["Removes every workflow, run and credential for good. This cannot be undone."]}]},{"t":"button","a":{"class":"btn btn-d","onClick":"{{openDanger}}"},"c":["Delete workspace"]}]}]}]},{"t":"sc-if","a":{"value":"{{isTeam}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"section","a":{"class":"card"},"c":[{"t":"div","a":{"class":"tbl-wrap"},"c":[{"t":"table","a":{"class":"tbl tbl-stack"},"c":[{"t":"thead","a":{},"c":[{"t":"tr","a":{},"c":[{"t":"th","a":{},"c":["Member"]},{"t":"th","a":{},"c":["Role"]},{"t":"th","a":{"class":"hide-m"},"c":["Last active"]},{"t":"th","a":{"class":"r"},"c":[{"t":"span","a":{"style":"position: absolute; width: 1px; height: 1px; overflow: hidden"},"c":["Actions"]}]}]}]},{"t":"tbody","a":{},"c":[{"t":"sc-for","a":{"list":"{{members}}","as":"m","hint-placeholder-count":"6"},"c":[{"t":"tr","a":{},"c":[{"t":"td","a":{},"c":[{"t":"span","a":{"class":"row","style":"gap: 10px"},"c":[{"t":"span","a":{"class":"avatar {{m.a}}"},"c":["{{m.i}}"]},{"t":"span","a":{},"c":[{"t":"span","a":{"class":"strong"},"c":["{{m.n}}"]},{"t":"sc-if","a":{"value":"{{m.pending}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"span","a":{"class":"badge b-warn","style":"margin-left: 6px; height: 18px; padding: 0 6px"},"c":["Invited"]}]},{"t":"span","a":{"class":"small muted","style":"display: block"},"c":["{{m.e}}"]}]}]}]},{"t":"td","a":{},"c":[{"t":"select","a":{"class":"select","style":"width: 180px","aria-label":"Role for {{m.n}}","value":"{{m.role}}","onChange":"{{m.setRole}}"},"c":[{"t":"option","a":{},"c":["Administrator"]},{"t":"option","a":{},"c":["Workflow Creator"]},{"t":"option","a":{},"c":["Business User"]},{"t":"option","a":{},"c":["Technical Operator"]}]}]},{"t":"td","a":{"class":"hide-m muted"},"c":["{{m.last}}"]},{"t":"td","a":{"class":"r"},"c":[{"t":"button","a":{"class":"btn btn-sm btn-g","style":"color: var(--err)","onClick":"{{m.ask}}"},"c":["Remove"]}]}]}]}]}]}]}]},{"t":"p","a":{"class":"small muted"},"c":["Not sure which role to choose? ",{"t":"a","a":{"href":"/docs#roles"},"c":["See what each role can do"]},"."]}]},{"t":"sc-if","a":{"value":"{{isCreds}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"sc-if","a":{"value":"{{newSecret}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"notice ok","role":"status","style":"align-items: flex-start"},"c":[{"t":"span","a":{"style":"margin-top: 1px"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"key","s":"16","hint-size":"16px,16px"},"c":[]}]},{"t":"div","a":{"class":"grow col","style":"gap: 4px; min-width: 240px"},"c":[{"t":"strong","a":{},"c":["Copy this key now. You will not see it again."]},{"t":"span","a":{"class":"mono","style":"word-break: break-all"},"c":["{{newSecret}}"]}]}]}]},{"t":"section","a":{"class":"card"},"c":[{"t":"div","a":{"class":"card-h","style":"padding-bottom: 10px"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["FlowBridge API keys"]}]},{"t":"div","a":{"class":"tbl-wrap"},"c":[{"t":"table","a":{"class":"tbl"},"c":[{"t":"thead","a":{},"c":[{"t":"tr","a":{},"c":[{"t":"th","a":{},"c":["Name"]},{"t":"th","a":{},"c":["Key"]},{"t":"th","a":{"class":"hide-m"},"c":["Created"]},{"t":"th","a":{"class":"hide-m"},"c":["Last used"]},{"t":"th","a":{"class":"r"},"c":[{"t":"span","a":{"style":"position: absolute; width: 1px; height: 1px; overflow: hidden"},"c":["Actions"]}]}]}]},{"t":"tbody","a":{},"c":[{"t":"sc-for","a":{"list":"{{keys}}","as":"k","hint-placeholder-count":"2"},"c":[{"t":"tr","a":{},"c":[{"t":"td","a":{"class":"strong"},"c":["{{k.n}}"]},{"t":"td","a":{},"c":[{"t":"span","a":{"class":"mono"},"c":["{{k.mask}}"]}]},{"t":"td","a":{"class":"hide-m muted"},"c":["{{k.c}}"]},{"t":"td","a":{"class":"hide-m muted"},"c":["{{k.u}}"]},{"t":"td","a":{"class":"r"},"c":[{"t":"button","a":{"class":"btn btn-sm btn-g","style":"color: var(--err)","onClick":"{{k.ask}}"},"c":["Revoke"]}]}]}]}]}]}]}]},{"t":"section","a":{"class":"card card-b row between wrap"},"c":[{"t":"div","a":{},"c":[{"t":"div","a":{"class":"strong"},"c":["Integration credentials"]},{"t":"div","a":{"class":"small muted"},"c":["OAuth tokens, database logins and third-party API keys are managed with their integrations."]}]},{"t":"a","a":{"class":"btn","href":"/integrations"},"c":["Manage integrations"]}]}]},{"t":"sc-if","a":{"value":"{{isNotify}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"section","a":{"class":"card","style":"max-width: 760px"},"c":[{"t":"sc-for","a":{"list":"{{notes}}","as":"n","hint-placeholder-count":"5"},"c":[{"t":"div","a":{"class":"row between","style":"padding: 13px 16px; border-bottom: 1px solid var(--line); gap: 16px"},"c":[{"t":"div","a":{"class":"grow"},"c":[{"t":"div","a":{"class":"strong","style":"font-size: 13px"},"c":["{{n.l}}"]},{"t":"div","a":{"class":"small muted"},"c":["{{n.d}}"]}]},{"t":"div","a":{"class":"row","style":"gap: 18px"},"c":[{"t":"label","a":{"class":"row small muted","style":"gap: 6px"},"c":["Email",{"t":"button","a":{"class":"toggle {{n.eCls}}","role":"switch","aria-checked":"{{n.eOn}}","aria-label":"Email for {{n.l}}","onClick":"{{n.flipE}}"},"c":[]}]},{"t":"label","a":{"class":"row small muted","style":"gap: 6px"},"c":["In app",{"t":"button","a":{"class":"toggle {{n.aCls}}","role":"switch","aria-checked":"{{n.aOn}}","aria-label":"In-app for {{n.l}}","onClick":"{{n.flipA}}"},"c":[]}]}]}]}]}]}]},{"t":"sc-if","a":{"value":"{{isSecurity}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"section","a":{"class":"card","style":"max-width: 760px"},"c":[{"t":"div","a":{"class":"row between","style":"padding: 14px 16px; border-bottom: 1px solid var(--line); gap: 16px"},"c":[{"t":"div","a":{"class":"grow"},"c":[{"t":"div","a":{"class":"strong","style":"font-size: 13px"},"c":["Require two-factor sign-in"]},{"t":"div","a":{"class":"small muted"},"c":["Everyone in this workspace must use an authenticator app."]}]},{"t":"button","a":{"class":"toggle {{mfaCls}}","role":"switch","aria-checked":"{{mfaOn}}","aria-label":"Require two-factor sign-in","onClick":"{{flipMfa}}"},"c":[]}]},{"t":"div","a":{"class":"row between wrap","style":"padding: 14px 16px; border-bottom: 1px solid var(--line); gap: 16px"},"c":[{"t":"div","a":{"class":"grow"},"c":[{"t":"label","a":{"class":"strong","style":"font-size: 13px","for":"s-t"},"c":["Sign out after inactivity"]},{"t":"div","a":{"class":"small muted"},"c":["Applies to all members."]}]},{"t":"select","a":{"id":"s-t","class":"select","style":"width: 150px"},"c":[{"t":"option","a":{},"c":["8 hours"]},{"t":"option","a":{},"c":["1 hour"]},{"t":"option","a":{},"c":["24 hours"]}]}]},{"t":"div","a":{"class":"row between wrap","style":"padding: 14px 16px; gap: 16px"},"c":[{"t":"div","a":{"class":"grow"},"c":[{"t":"div","a":{"class":"strong","style":"font-size: 13px"},"c":["Credential encryption"]},{"t":"div","a":{"class":"small muted"},"c":["Stored secrets are encrypted at rest and never returned to the browser."]}]},{"t":"span","a":{"class":"badge b-ok"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"shield","s":"13","hint-size":"13px,13px"},"c":[]},"Enabled"]}]}]},{"t":"section","a":{"class":"card","style":"max-width: 760px"},"c":[{"t":"div","a":{"class":"card-h","style":"padding-bottom: 10px"},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Recent security activity"]}]},{"t":"div","a":{"class":"tbl-wrap"},"c":[{"t":"table","a":{"class":"tbl"},"c":[{"t":"tbody","a":{},"c":[{"t":"sc-for","a":{"list":"{{audit}}","as":"a","hint-placeholder-count":"4"},"c":[{"t":"tr","a":{},"c":[{"t":"td","a":{"class":"strong"},"c":["{{a.w}}"]},{"t":"td","a":{"style":"white-space: normal"},"c":["{{a.t}}"]},{"t":"td","a":{"class":"r muted"},"c":["{{a.d}}"]}]}]}]}]}]}]}]}]}]},{"t":"sc-if","a":{"value":"{{invite}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"scrim"},"c":[{"t":"div","a":{"class":"modal","role":"dialog","aria-modal":"true","aria-labelledby":"iv-t"},"c":[{"t":"h2","a":{"id":"iv-t"},"c":["Invite a team member"]},{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"iv-e"},"c":["Work email"]},{"t":"input","a":{"id":"iv-e","class":"input {{inviteBad}}","type":"email","placeholder":"name@meridianlogistics.example","value":"{{inviteEmail}}","onChange":"{{onInviteEmail}}"},"c":[]},{"t":"sc-if","a":{"value":"{{inviteErr}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"span","a":{"class":"err-msg"},"c":["{{inviteErr}}"]}]}]},{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"iv-r"},"c":["Role"]},{"t":"select","a":{"id":"iv-r","class":"select","value":"{{inviteRole}}","onChange":"{{onInviteRole}}"},"c":[{"t":"option","a":{},"c":["Administrator"]},{"t":"option","a":{},"c":["Workflow Creator"]},{"t":"option","a":{},"c":["Business User"]},{"t":"option","a":{},"c":["Technical Operator"]}]},{"t":"span","a":{"class":"hint"},"c":["{{inviteHint}}"]}]},{"t":"div","a":{"class":"modal-a"},"c":[{"t":"button","a":{"class":"btn","onClick":"{{closeInvite}}"},"c":["Cancel"]},{"t":"button","a":{"class":"btn btn-p","onClick":"{{sendInvite}}"},"c":["Send invite"]}]}]}]}]},{"t":"sc-if","a":{"value":"{{dangerOpen}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"scrim"},"c":[{"t":"div","a":{"class":"modal","role":"dialog","aria-modal":"true","aria-labelledby":"dz-t"},"c":[{"t":"h2","a":{"id":"dz-t"},"c":["Delete Meridian Logistics?"]},{"t":"p","a":{"class":"muted","style":"text-wrap: pretty"},"c":["This permanently deletes 24 workflows, all run history and every stored credential. All 6 members lose access immediately."]},{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"dz-n"},"c":["Type Meridian Logistics to confirm"]},{"t":"input","a":{"id":"dz-n","class":"input","value":"{{dangerText}}","onChange":"{{onDanger}}","autocomplete":"off"},"c":[]}]},{"t":"div","a":{"class":"modal-a"},"c":[{"t":"button","a":{"class":"btn","onClick":"{{closeDanger}}"},"c":["Cancel"]},{"t":"button","a":{"class":"btn btn-d","disabled":"{{dangerBlocked}}","onClick":"{{doDanger}}"},"c":["Delete workspace"]}]}]}]}]},{"t":"sc-if","a":{"value":"{{confirm}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"scrim"},"c":[{"t":"div","a":{"class":"modal","role":"dialog","aria-modal":"true","aria-labelledby":"cf-t"},"c":[{"t":"h2","a":{"id":"cf-t"},"c":["{{confirm.title}}"]},{"t":"p","a":{"class":"muted","style":"text-wrap: pretty"},"c":["{{confirm.body}}"]},{"t":"div","a":{"class":"modal-a"},"c":[{"t":"button","a":{"class":"btn","onClick":"{{closeConfirm}}"},"c":["Cancel"]},{"t":"button","a":{"class":"btn btn-d","onClick":"{{doConfirm}}"},"c":["{{confirm.action}}"]}]}]}]}]},{"t":"sc-if","a":{"value":"{{toast}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"toast","role":"status"},"c":["{{toast}}"]}]}]}]}],{"section":"profile","nav":"settings"},function(DCLogic){

const FB_ACC = {
  admin: { k: 'admin', n: 'Jonah Thomas', f: 'Jonah', i: 'JT', a: 'a5', r: 'Administrator', e: 'jonah@meridianlogistics.example' },
  creator: { k: 'creator', n: 'Priya Raman', f: 'Priya', i: 'PR', a: '', r: 'Workflow Creator', e: 'priya@meridianlogistics.example' },
  operator: { k: 'operator', n: 'Rahul Shah', f: 'Rahul', i: 'RS', a: 'a3', r: 'Technical Operator', e: 'rahul@meridianlogistics.example' },
  business: { k: 'business', n: 'Lena Costa', f: 'Lena', i: 'LC', a: 'a2', r: 'Business User', e: 'lena@meridianlogistics.example' }
};
const FB_CANS = {
  admin: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 1 },
  creator: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 0 },
  operator: { edit: 0, builder: 1, publish: 0, retry: 1, data: 1, integ: 0, integView: 1, admin: 0 },
  business: { edit: 0, builder: 0, publish: 0, retry: 0, data: 0, integ: 0, integView: 0, admin: 0 }
};
const fbStored = () => { let k = ''; try { k = localStorage.getItem('fb-role') || ''; } catch (e) {} if (!k) { try { const m = /fb-role:(\w+)/.exec(window.name || ''); if (m) k = m[1]; } catch (e) {} } return FB_ACC[k] ? k : ''; };
const fbSetRole = (k) => { try { if (k) localStorage.setItem('fb-role', k); else localStorage.removeItem('fb-role'); } catch (e) {} try { window.name = k ? 'fb-role:' + k : ''; } catch (e) {} };
const FB_ME = FB_ACC[fbStored() || 'creator'], FB_C = FB_CANS[FB_ME.k];
const MEMBERS = [
  { i: 'JT', a: 'a5', n: 'Jonah Thomas', e: 'jonah@meridianlogistics.example', role: 'Administrator', last: 'Today, 09:14' },
  { i: 'AM', a: 'a4', n: 'Anika Menon', e: 'anika@meridianlogistics.example', role: 'Administrator', last: 'Yesterday, 17:20' },
  { i: 'PR', a: '', n: 'Priya Raman', e: 'priya@meridianlogistics.example', role: 'Workflow Creator', last: 'Active now' },
  { i: 'RS', a: 'a3', n: 'Rahul Shah', e: 'rahul@meridianlogistics.example', role: 'Technical Operator', last: '12 minutes ago' },
  { i: 'LC', a: 'a2', n: 'Lena Costa', e: 'lena@meridianlogistics.example', role: 'Business User', last: '3 Nov, 15:02' },
  { i: 'SK', a: 'a2', n: 'Sara Khan', e: 'sara@meridianlogistics.example', role: 'Business User', last: 'Invite sent yesterday', pending: true }
];
const NOTES = [
  { k: 'fail', l: 'A workflow you own fails', d: 'Sent once all retries are used.', e: true, a: true },
  { k: 'digest', l: 'Daily failure summary', d: 'Every failed run from the past day, at 09:00.', e: true, a: false },
  { k: 'token', l: 'A credential is about to expire', d: 'Sent 7 days and 3 days before expiry.', e: true, a: true },
  { k: 'review', l: 'Someone changes your workflow', d: 'When another person edits or deactivates it.', e: false, a: true },
  { k: 'invite', l: 'A new member joins', d: 'Administrators only.', e: false, a: false }
];
const HINT = {
  Administrator: 'Full access, including members, integrations and security.',
  'Workflow Creator': 'Builds, tests and activates workflows.',
  'Business User': 'Watches activity and runs available automations.',
  'Technical Operator': 'Investigates failures, retries runs and tests integrations.'
};
const COPY = {
  profile: ['Settings', 'Your personal details and preferences.'], workspace: ['Settings', 'Defaults that apply to everyone in Meridian Logistics.'],
  team: ['Team & Users', 'People in this workspace and the role each one has.'],
  creds: ['Settings', 'Keys for calling FlowBridge from your own systems.'], notify: ['Settings', 'Choose what reaches you, and where.'], security: ['Settings', 'Sign-in rules and how secrets are protected.']
};
class Component extends DCLogic {
  state = {
    sec: null, profileName: FB_ME.n, members: MEMBERS, invite: false, inviteEmail: '', inviteRole: 'Business User', inviteTried: false,
    keys: [{ n: 'Production CRM sync', mask: 'fb_live_••••••••3f9a', c: '12 Aug 2026', u: '2 hours ago' }, { n: 'Reporting export', mask: 'fb_live_••••••••a71c', c: '3 Oct 2026', u: 'Yesterday' }],
    secret: '', notes: NOTES, mfa: true, confirm: null, toast: ''
  };
  componentWillUnmount() { clearTimeout(this.tt); }
  say(t) { clearTimeout(this.tt); this.setState({ toast: t }); this.tt = setTimeout(() => this.setState({ toast: '' }), 3500); }
  renderVals() {
    const s = this.state, ask = s.sec || this.props.section || 'profile';
    const sec = FB_C.admin || ['profile', 'notify'].includes(ask) ? ask : 'profile';
    const email = s.inviteEmail.trim(), emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    const inviteErr = s.inviteTried && !emailOk ? 'Enter a valid work email.' : '';
    const nameErr = s.profileName.trim() ? '' : 'Name is required.';
    const copy = COPY[sec];
    return {
      meA: FB_ME.a, meI: FB_ME.i, meN: FB_ME.n, meR: FB_ME.r, meE: FB_ME.e,
      fbDenied: this.props.section === 'team' && !FB_C.admin, fbOk: !(this.props.section === 'team' && !FB_C.admin),
      navActive: this.props.nav ?? 'settings', crumb: copy[0], heading: copy[0], sub: copy[1],
      tabs: [['profile', 'Profile'], ['workspace', 'Workspace'], ['team', 'Team members'], ['creds', 'API credentials'], ['notify', 'Notifications'], ['security', 'Security']].filter(([id]) => FB_C.admin || ['profile', 'notify'].includes(id)).map(([id, l]) => ({ l, cls: sec === id ? 'is-on' : '', sel: sec === id ? 'true' : 'false', pick: () => this.setState({ sec: id }) })),
      isProfile: sec === 'profile', isWorkspace: sec === 'workspace', isTeam: sec === 'team', isCreds: sec === 'creds', isNotify: sec === 'notify', isSecurity: sec === 'security',
      profileName: s.profileName, onName: (e) => this.setState({ profileName: e.target.value }), nameErr, nameBad: nameErr ? 'bad' : '',
      dangerOpen: !!s.dangerOpen, dangerText: s.dangerText || '', dangerBlocked: (s.dangerText || '') !== 'Meridian Logistics',
      openDanger: () => this.setState({ dangerOpen: true, dangerText: '' }), closeDanger: () => this.setState({ dangerOpen: false }),
      onDanger: (e) => this.setState({ dangerText: e.target.value }),
      doDanger: () => { this.setState({ dangerOpen: false }); this.say('Prototype only: in the real product this would delete the workspace.'); },
      saveProfile: () => { if (!nameErr) this.say('Profile saved.'); }, saveGeneric: () => this.say('Workspace settings saved.'),
      members: s.members.map((m) => ({
        ...m, pending: !!m.pending, last: m.e === FB_ME.e ? 'Active now' : m.last === 'Active now' ? 'Today, 08:52' : m.last,
        setRole: (e) => { this.setState({ members: s.members.map((x) => (x.e === m.e ? { ...x, role: e.target.value } : x)) }); this.say(m.n + ' is now ' + e.target.value + '.'); },
        ask: () => this.setState({ confirm: { kind: 'member', id: m.e, title: 'Remove ' + m.n + '?', body: 'They lose access immediately. Workflows they built keep running, and are reassigned to an Administrator.', action: 'Remove member' } })
      })),
      keys: s.keys.map((k) => ({ ...k, ask: () => this.setState({ confirm: { kind: 'key', id: k.n, title: 'Revoke ' + k.n + '?', body: 'Anything using this key stops working straight away. This cannot be undone.', action: 'Revoke key' } }) })),
      newSecret: s.secret,
      newKey: () => { this.setState({ secret: 'fb_live_7Qm2xV9pLc4TzR8nK1sW6dYh0Bf3GjUa', keys: s.keys.concat({ n: 'New API key', mask: 'fb_live_••••••••3GjU', c: '5 Nov 2026', u: 'Never' }) }); this.say('API key created.'); },
      notes: s.notes.map((n) => {
        const flip = (f) => () => this.setState({ notes: s.notes.map((x) => (x.k === n.k ? { ...x, [f]: !x[f] } : x)) });
        return { ...n, eCls: n.e ? 'is-on' : '', aCls: n.a ? 'is-on' : '', eOn: n.e ? 'true' : 'false', aOn: n.a ? 'true' : 'false', flipE: flip('e'), flipA: flip('a') };
      }),
      mfaCls: s.mfa ? 'is-on' : '', mfaOn: s.mfa ? 'true' : 'false', flipMfa: () => { this.setState({ mfa: !s.mfa }); this.say(s.mfa ? 'Two-factor sign-in is now optional.' : 'Two-factor sign-in is now required.'); },
      audit: [
        { w: 'Anika Menon', t: 'Reconnected the Slack integration', d: 'Yesterday, 17:20' },
        { w: 'Jonah Thomas', t: 'Invited sara@meridianlogistics.example', d: 'Yesterday, 11:02' },
        { w: 'Rahul Shah', t: 'Rotated the PostgreSQL credential', d: '28 Oct, 14:37' },
        { w: 'Jonah Thomas', t: 'Created the Reporting export API key', d: '3 Oct, 10:15' }
      ],
      invite: s.invite, openInvite: () => this.setState({ invite: true, inviteEmail: '', inviteTried: false }), closeInvite: () => this.setState({ invite: false }),
      inviteEmail: s.inviteEmail, onInviteEmail: (e) => this.setState({ inviteEmail: e.target.value }), inviteErr, inviteBad: inviteErr ? 'bad' : '',
      inviteRole: s.inviteRole, onInviteRole: (e) => this.setState({ inviteRole: e.target.value }), inviteHint: HINT[s.inviteRole],
      sendInvite: () => {
        if (!emailOk) { this.setState({ inviteTried: true }); return; }
        this.setState({ invite: false, members: s.members.concat({ i: email.slice(0, 2).toUpperCase(), a: 'a2', n: email.split('@')[0], e: email, role: s.inviteRole, last: 'Invite sent just now', pending: true }) });
        this.say('Invite sent to ' + email + '.');
      },
      confirm: s.confirm, closeConfirm: () => this.setState({ confirm: null }),
      doConfirm: () => {
        const c = s.confirm;
        if (c.kind === 'member') { this.setState({ confirm: null, members: s.members.filter((m) => m.e !== c.id) }); this.say('Member removed.'); }
        else { this.setState({ confirm: null, keys: s.keys.filter((k) => k.n !== c.id), secret: '' }); this.say('API key revoked.'); }
      },
      toast: s.toast
    };
  }
}

return Component;
});
FB.def("Sidebar",[{"t":"nav","a":{"class":"side {{sideCls}}","aria-label":"Main"},"c":[{"t":"a","a":{"class":"side-brand","href":"/overview","aria-label":"FlowBridge overview"},"c":[{"t":"svg","a":{"viewBox":"0 0 28 28","aria-hidden":"true","style":"width: 28px; height: 28px; flex: none"},"c":[{"t":"rect","a":{"width":"28","height":"28","rx":"7","style":"fill: #C2410C"},"c":[]},{"t":"path","a":{"d":"M6.5 18.5C9 9.5 19 9.5 21.5 18.5","style":"fill: none; stroke: #FFFFFF; stroke-width: 2.4; stroke-linecap: round"},"c":[]},{"t":"circle","a":{"cx":"6.5","cy":"19","r":"2.6","style":"fill: #FFFFFF"},"c":[]},{"t":"circle","a":{"cx":"21.5","cy":"19","r":"2.6","style":"fill: #FFFFFF"},"c":[]}]},{"t":"span","a":{"class":"side-word"},"c":["FlowBridge"]}]},{"t":"sc-for","a":{"list":"{{items}}","as":"it","hint-placeholder-count":"8"},"c":[{"t":"a","a":{"class":"nav tip {{it.cls}}","href":"{{it.href}}","aria-current":"{{it.current}}","aria-label":"{{it.l}}","data-tip":"{{it.l}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{it.g}}","s":"17","hint-size":"17px,17px"},"c":[]},{"t":"span","a":{"class":"nav-label"},"c":["{{it.l}}"]},{"t":"sc-if","a":{"value":"{{it.count}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"span","a":{"class":"nav-count"},"c":["{{it.count}}"]}]}]}]},{"t":"div","a":{"class":"side-gap"},"c":[]},{"t":"div","a":{"style":"position: relative","class":"m-hide"},"c":[{"t":"button","a":{"class":"nav tip","data-tip":"Help and support","aria-label":"Help and support","aria-expanded":"{{helpOpen}}","onClick":"{{toggleHelp}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"help","s":"17","hint-size":"17px,17px"},"c":[]},{"t":"span","a":{"class":"nav-label"},"c":["Help and support"]}]},{"t":"sc-if","a":{"value":"{{helpOpen}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"pop","style":"left: 8px; bottom: 42px; width: 216px"},"c":[{"t":"a","a":{"class":"menu-i","href":"#"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"book","s":"15","hint-size":"15px,15px"},"c":[]},"Documentation"]},{"t":"a","a":{"class":"menu-i","href":"#"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"webhook","s":"15","hint-size":"15px,15px"},"c":[]},"Webhook guide"]},{"t":"a","a":{"class":"menu-i","href":"#"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"mail","s":"15","hint-size":"15px,15px"},"c":[]},"Contact support"]}]}]}]},{"t":"button","a":{"class":"nav tip side-collapse m-hide","data-tip":"Expand sidebar","aria-label":"{{collapseLabel}}","onClick":"{{toggle}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"panel","s":"17","hint-size":"17px,17px"},"c":[]},{"t":"span","a":{"class":"nav-label"},"c":["Collapse"]}]},{"t":"div","a":{"class":"user"},"c":[{"t":"span","a":{"class":"avatar {{meA}}"},"c":["{{meI}}"]},{"t":"div","a":{"class":"user-meta grow"},"c":[{"t":"div","a":{"class":"strong trunc","style":"font-size: 13px"},"c":["{{meN}}"]},{"t":"div","a":{"class":"small dim trunc"},"c":["{{meR}}"]}]}]}]}],{"active":"overview"},function(DCLogic){

const FB_ACC = {
  admin: { k: 'admin', n: 'Jonah Thomas', f: 'Jonah', i: 'JT', a: 'a5', r: 'Administrator', e: 'jonah@meridianlogistics.example' },
  creator: { k: 'creator', n: 'Priya Raman', f: 'Priya', i: 'PR', a: '', r: 'Workflow Creator', e: 'priya@meridianlogistics.example' },
  operator: { k: 'operator', n: 'Rahul Shah', f: 'Rahul', i: 'RS', a: 'a3', r: 'Technical Operator', e: 'rahul@meridianlogistics.example' },
  business: { k: 'business', n: 'Lena Costa', f: 'Lena', i: 'LC', a: 'a2', r: 'Business User', e: 'lena@meridianlogistics.example' }
};
const FB_CANS = {
  admin: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 1 },
  creator: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 0 },
  operator: { edit: 0, builder: 1, publish: 0, retry: 1, data: 1, integ: 0, integView: 1, admin: 0 },
  business: { edit: 0, builder: 0, publish: 0, retry: 0, data: 0, integ: 0, integView: 0, admin: 0 }
};
const fbStored = () => { let k = ''; try { k = localStorage.getItem('fb-role') || ''; } catch (e) {} if (!k) { try { const m = /fb-role:(\w+)/.exec(window.name || ''); if (m) k = m[1]; } catch (e) {} } return FB_ACC[k] ? k : ''; };
const fbSetRole = (k) => { try { if (k) localStorage.setItem('fb-role', k); else localStorage.removeItem('fb-role'); } catch (e) {} try { window.name = k ? 'fb-role:' + k : ''; } catch (e) {} };
const FB_ME = FB_ACC[fbStored() || 'creator'], FB_C = FB_CANS[FB_ME.k];
const NAV = [
  { k: 'overview', l: 'Overview', g: 'overview', href: '/overview' },
  { k: 'workflows', l: 'Workflows', g: 'flow', href: '/workflows' },
  { k: 'templates', l: 'Templates', g: 'template', href: '/templates', hide: true },
  { k: 'integrations', l: 'Integrations', g: 'plug', href: '/integrations', hide: true },
  { k: 'executions', l: 'Executions', g: 'runs', href: '/executions', count: '3' },
  { k: 'analytics', l: 'Analytics', g: 'chart', href: '/analytics' },
  { k: 'team', l: 'Team & Users', g: 'users', href: '/team', hide: true },
  { k: 'settings', l: 'Settings', g: 'gear', href: '/settings' }
];
const read = () => { try { return localStorage.getItem('fb-side') === '1'; } catch (e) { return false; } };
const write = (v) => { try { localStorage.setItem('fb-side', v ? '1' : '0'); } catch (e) {} };
class Component extends DCLogic {
  state = { col: read(), help: false };
  renderVals() {
    const a = this.props.active ?? 'overview';
    const col = this.state.col;
    return {
      meA: FB_ME.a, meI: FB_ME.i, meN: FB_ME.n, meR: FB_ME.r,
      sideCls: col ? 'is-col' : '',
      helpOpen: this.state.help,
      collapseLabel: col ? 'Expand sidebar' : 'Collapse sidebar',
      toggle: () => { write(!col); this.setState({ col: !col, help: false }); },
      toggleHelp: () => this.setState({ help: !this.state.help }),
      items: NAV.filter((n) => (n.k === 'templates' ? FB_C.edit : n.k === 'integrations' ? FB_C.integView : n.k === 'team' ? FB_C.admin : true)).map((n) => ({
        ...n,
        l: (FB_ME.k === 'business' && { workflows: 'Automations', executions: 'Activity', analytics: 'Reports' }[n.k]) || n.l,
        count: (FB_C.retry && FB_ME.k !== 'admin' && n.count) || '',
        cls: (n.k === a ? 'is-on ' : '') + (n.hide ? 'm-hide' : ''),
        current: n.k === a ? 'page' : 'false'
      }))
    };
  }
}

return Component;
});
FB.def("SignIn",[{"t":"div","a":{"style":"min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 32px 16px; background: var(--bg)"},"c":[{"t":"a","a":{"href":"/","aria-label":"FlowBridge home","class":"row","style":"gap: 9px; font-weight: 700; font-size: 16px; letter-spacing: -0.02em; color: var(--ink)"},"c":[{"t":"svg","a":{"viewBox":"0 0 28 28","aria-hidden":"true","style":"width: 28px; height: 28px"},"c":[{"t":"rect","a":{"width":"28","height":"28","rx":"7","style":"fill: #C2410C"},"c":[]},{"t":"path","a":{"d":"M6.5 18.5C9 9.5 19 9.5 21.5 18.5","style":"fill: none; stroke: #FFFFFF; stroke-width: 2.4; stroke-linecap: round"},"c":[]},{"t":"circle","a":{"cx":"6.5","cy":"19","r":"2.6","style":"fill: #FFFFFF"},"c":[]},{"t":"circle","a":{"cx":"21.5","cy":"19","r":"2.6","style":"fill: #FFFFFF"},"c":[]}]},"FlowBridge"]},{"t":"main","a":{"class":"card col","style":"margin: auto 0; width: min(400px, 100%); padding: 28px; gap: 16px"},"c":[{"t":"div","a":{},"c":[{"t":"h1","a":{"class":"page-title","style":"font-size: 24px"},"c":["Sign in"]},{"t":"p","a":{"class":"page-sub"},"c":["Welcome back to your workspace."]}]},{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"si-e"},"c":["Work email"]},{"t":"input","a":{"id":"si-e","class":"input {{emailBad}}","style":"height: 40px","type":"email","autocomplete":"email","value":"{{email}}","onChange":"{{onEmail}}","aria-invalid":"{{emailInv}}"},"c":[]},{"t":"sc-if","a":{"value":"{{emailErr}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"span","a":{"class":"err-msg"},"c":["{{emailErr}}"]}]}]},{"t":"div","a":{"class":"field"},"c":[{"t":"label","a":{"class":"label","for":"si-p"},"c":["Password"]},{"t":"input","a":{"id":"si-p","class":"input {{passBad}}","style":"height: 40px","type":"password","autocomplete":"current-password","value":"{{pass}}","onChange":"{{onPass}}","aria-invalid":"{{passInv}}"},"c":[]},{"t":"sc-if","a":{"value":"{{passErr}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"span","a":{"class":"err-msg"},"c":["{{passErr}}"]}]}]},{"t":"a","a":{"class":"btn btn-p","style":"height: 42px","href":"/overview","onClick":"{{submit}}"},"c":["Sign in"]},{"t":"p","a":{"class":"small muted"},"c":["New to FlowBridge? ",{"t":"a","a":{"href":"/register"},"c":["Get started"]}]},{"t":"section","a":{"class":"col","aria-label":"Test accounts","style":"gap: 8px; border-top: 1px solid var(--line); padding-top: 14px"},"c":[{"t":"div","a":{},"c":[{"t":"h2","a":{"class":"card-t"},"c":["Test accounts"]},{"t":"p","a":{"class":"small muted","style":"margin-top: 2px"},"c":["Click one to fill in the form. Password for all: ",{"t":"span","a":{"class":"mono"},"c":["{{testPass}}"]}]}]},{"t":"sc-for","a":{"list":"{{accounts}}","as":"a","hint-placeholder-count":"4"},"c":[{"t":"button","a":{"class":"btn","style":"height: auto; padding: 8px 10px; justify-content: flex-start; text-align: left; gap: 10px","aria-pressed":"{{a.on}}","onClick":"{{a.pick}}"},"c":[{"t":"span","a":{"class":"avatar {{a.a}}","style":"flex: none"},"c":["{{a.i}}"]},{"t":"span","a":{"style":"min-width: 0"},"c":[{"t":"span","a":{"class":"strong","style":"display: block; font-size: 13px"},"c":["{{a.r}}"]},{"t":"span","a":{"class":"small muted trunc","style":"display: block; font-weight: 400"},"c":["{{a.e}}"]}]}]}]}]}]}]}],{},function(DCLogic){

const FB_ACC = {
  admin: { k: 'admin', n: 'Jonah Thomas', f: 'Jonah', i: 'JT', a: 'a5', r: 'Administrator', e: 'jonah@meridianlogistics.example' },
  creator: { k: 'creator', n: 'Priya Raman', f: 'Priya', i: 'PR', a: '', r: 'Workflow Creator', e: 'priya@meridianlogistics.example' },
  operator: { k: 'operator', n: 'Rahul Shah', f: 'Rahul', i: 'RS', a: 'a3', r: 'Technical Operator', e: 'rahul@meridianlogistics.example' },
  business: { k: 'business', n: 'Lena Costa', f: 'Lena', i: 'LC', a: 'a2', r: 'Business User', e: 'lena@meridianlogistics.example' }
};
const FB_CANS = {
  admin: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 1 },
  creator: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 0 },
  operator: { edit: 0, builder: 1, publish: 0, retry: 1, data: 1, integ: 0, integView: 1, admin: 0 },
  business: { edit: 0, builder: 0, publish: 0, retry: 0, data: 0, integ: 0, integView: 0, admin: 0 }
};
const fbStored = () => { let k = ''; try { k = localStorage.getItem('fb-role') || ''; } catch (e) {} if (!k) { try { const m = /fb-role:(\w+)/.exec(window.name || ''); if (m) k = m[1]; } catch (e) {} } return FB_ACC[k] ? k : ''; };
const fbSetRole = (k) => { try { if (k) localStorage.setItem('fb-role', k); else localStorage.removeItem('fb-role'); } catch (e) {} try { window.name = k ? 'fb-role:' + k : ''; } catch (e) {} };
const FB_ME = FB_ACC[fbStored() || 'creator'], FB_C = FB_CANS[FB_ME.k];
const TEST_PASS = '';
const findAccount = (email) => Object.values(FB_ACC).find((a) => a.e === email.trim().toLowerCase());
class Component extends DCLogic {
  state = { email: "", pass: "", tried: false, wrong: false };
  renderVals() {
    const s = this.state;
    const emailErr = s.tried && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email) ? 'Enter your work email.' : '';
    const passErr = s.tried && !s.pass ? 'Enter your password.' : s.wrong ? 'That email and password do not match a test account.' : '';
    return {
      email: s.email, pass: s.pass, emailErr, passErr,
      emailBad: emailErr ? 'bad' : '', passBad: passErr ? 'bad' : '',
      emailInv: emailErr ? 'true' : 'false', passInv: passErr ? 'true' : 'false',
      testPass: TEST_PASS,
      accounts: Object.values(FB_ACC).map((a) => ({ ...a, on: s.email === a.e ? 'true' : 'false', pick: () => this.setState({ email: a.e, pass: TEST_PASS, tried: false, wrong: false }) })),
      onEmail: (e) => this.setState({ email: e.target.value, wrong: false }),
      onPass: (e) => this.setState({ pass: e.target.value, wrong: false }),
      submit: (e) => {
        const ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email) && s.pass;
        if (!ok) { e.preventDefault(); this.setState({ tried: true, wrong: false }); return; }
        const acc = findAccount(s.email);
        if (!acc || s.pass !== TEST_PASS) { e.preventDefault(); this.setState({ tried: true, wrong: true }); return; }
        fbSetRole(acc.k);
      }
    };
  }
}

return Component;
});
FB.def("SiteFooter",[{"t":"footer","a":{"class":"sf"},"c":[{"t":"div","a":{"class":"sf-in"},"c":[{"t":"div","a":{"class":"sf-g"},"c":[{"t":"div","a":{"class":"sf-main"},"c":[{"t":"a","a":{"class":"sf-brand","href":"/","aria-label":"FlowBridge home"},"c":[{"t":"svg","a":{"viewBox":"0 0 28 28","aria-hidden":"true","style":"width: 28px; height: 28px"},"c":[{"t":"rect","a":{"width":"28","height":"28","rx":"7","style":"fill: #C2410C"},"c":[]},{"t":"path","a":{"d":"M6.5 18.5C9 9.5 19 9.5 21.5 18.5","style":"fill: none; stroke: #FFFFFF; stroke-width: 2.4; stroke-linecap: round"},"c":[]},{"t":"circle","a":{"cx":"6.5","cy":"19","r":"2.6","style":"fill: #FFFFFF"},"c":[]},{"t":"circle","a":{"cx":"21.5","cy":"19","r":"2.6","style":"fill: #FFFFFF"},"c":[]}]},"FlowBridge"]},{"t":"p","a":{"class":"sf-tag"},"c":["Automate the work between your apps, and see every step it takes."]}]},{"t":"nav","a":{"aria-label":"Product"},"c":[{"t":"div","a":{"class":"sf-h"},"c":["PRODUCT"]},{"t":"div","a":{"class":"sf-l"},"c":[{"t":"sc-for","a":{"list":"{{product}}","as":"l","hint-placeholder-count":"4"},"c":[{"t":"a","a":{"href":"{{l.href}}","onClick":"{{l.go}}"},"c":["{{l.t}}"]}]}]}]},{"t":"nav","a":{"aria-label":"Learn"},"c":[{"t":"div","a":{"class":"sf-h"},"c":["LEARN"]},{"t":"div","a":{"class":"sf-l"},"c":[{"t":"a","a":{"href":"/docs"},"c":["Docs"]},{"t":"a","a":{"href":"/docs"},"c":["Getting started"]},{"t":"a","a":{"href":"/templates"},"c":["Templates"]}]}]},{"t":"nav","a":{"aria-label":"Account"},"c":[{"t":"div","a":{"class":"sf-h"},"c":["ACCOUNT"]},{"t":"div","a":{"class":"sf-l"},"c":[{"t":"a","a":{"href":"/sign-in"},"c":["Sign in"]},{"t":"a","a":{"href":"/register"},"c":["Create a workspace"]},{"t":"a","a":{"href":"/overview"},"c":["Dashboard"]}]}]}]},{"t":"div","a":{"class":"sf-b"},"c":[{"t":"span","a":{},"c":["© 2026 FlowBridge"]},{"t":"span","a":{},"c":["The runs shown on this page are examples."]}]}]}]}],{},function(DCLogic){

const PRODUCT = [['Use cases', 'use-cases'], ['How it works', 'how'], ['When a run fails', 'failures'], ['Integrations', 'integrations']];
class Component extends DCLogic {
  renderVals() {
    return {
      product: PRODUCT.map(([t, id]) => ({
        t, href: '/#' + id,
        go: (e) => { if (this.props.onJump) { e.preventDefault(); this.props.onJump(id); } }
      }))
    };
  }
}

return Component;
});
FB.def("SiteNav",[{"t":"header","a":{"class":"s-nav {{toneCls}}"},"c":[{"t":"div","a":{"class":"s-in"},"c":[{"t":"a","a":{"class":"s-brand","href":"/","aria-label":"FlowBridge home"},"c":[{"t":"svg","a":{"viewBox":"0 0 28 28","aria-hidden":"true","style":"width: 28px; height: 28px"},"c":[{"t":"rect","a":{"width":"28","height":"28","rx":"7","style":"fill: #C2410C"},"c":[]},{"t":"path","a":{"d":"M6.5 18.5C9 9.5 19 9.5 21.5 18.5","style":"fill: none; stroke: #FFFFFF; stroke-width: 2.4; stroke-linecap: round"},"c":[]},{"t":"circle","a":{"cx":"6.5","cy":"19","r":"2.6","style":"fill: #FFFFFF"},"c":[]},{"t":"circle","a":{"cx":"21.5","cy":"19","r":"2.6","style":"fill: #FFFFFF"},"c":[]}]},"FlowBridge"]},{"t":"nav","a":{"class":"s-links","aria-label":"Main"},"c":[{"t":"div","a":{"style":"position: relative"},"c":[{"t":"button","a":{"class":"s-l","aria-expanded":"{{useOpen}}","onClick":"{{toggleUse}}"},"c":["Use cases",{"t":"dc-import","a":{"name":"Icon","g":"down","s":"14","hint-size":"14px,14px"},"c":[]}]},{"t":"sc-if","a":{"value":"{{useOpen}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"pop","style":"top: 42px; left: 0; width: 280px"},"c":[{"t":"sc-for","a":{"list":"{{uses}}","as":"u","hint-placeholder-count":"4"},"c":[{"t":"a","a":{"class":"menu-i","href":"{{u.href}}","onClick":"{{u.go}}","style":"align-items: flex-start"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{u.g}}","s":"15","hint-size":"15px,15px"},"c":[]},{"t":"span","a":{"class":"grow"},"c":[{"t":"span","a":{"class":"strong","style":"display: block"},"c":["{{u.t}}"]},{"t":"span","a":{"class":"small muted","style":"display: block"},"c":["{{u.d}}"]}]}]}]}]}]}]},{"t":"a","a":{"class":"s-l","href":"/docs"},"c":["Docs"]},{"t":"div","a":{"style":"position: relative"},"c":[{"t":"button","a":{"class":"s-l","aria-expanded":"{{moreOpen}}","onClick":"{{toggleMore}}"},"c":["More",{"t":"dc-import","a":{"name":"Icon","g":"down","s":"14","hint-size":"14px,14px"},"c":[]}]},{"t":"sc-if","a":{"value":"{{moreOpen}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"pop","style":"top: 42px; left: 0; width: 220px"},"c":[{"t":"sc-for","a":{"list":"{{more}}","as":"m","hint-placeholder-count":"3"},"c":[{"t":"a","a":{"class":"menu-i","href":"{{m.href}}","onClick":"{{m.go}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{m.g}}","s":"15","hint-size":"15px,15px"},"c":[]},"{{m.t}}"]}]}]}]}]}]},{"t":"div","a":{"class":"s-act"},"c":[{"t":"a","a":{"class":"btn btn-g s-signin","href":"/sign-in"},"c":["Sign in"]},{"t":"a","a":{"class":"btn btn-p","href":"/register"},"c":["Get started"]},{"t":"button","a":{"class":"btn btn-g btn-ic s-burger","aria-label":"Menu","aria-expanded":"{{menuOpen}}","onClick":"{{toggleMenu}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{menuIc}}","s":"18","hint-size":"18px,18px"},"c":[]}]}]}]},{"t":"sc-if","a":{"value":"{{menuOpen}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"s-sheet"},"c":[{"t":"sc-for","a":{"list":"{{sheet}}","as":"l","hint-placeholder-count":"6"},"c":[{"t":"a","a":{"href":"{{l.href}}","onClick":"{{l.go}}"},"c":["{{l.t}}"]}]}]}]}]}],{},function(DCLogic){

const USES = [
  { t: 'Sales', d: 'Turn new sign-ups into followed-up leads', g: 'users', i: 0 },
  { t: 'Finance', d: 'Record paid invoices and send receipts', g: 'chart', i: 1 },
  { t: 'Support', d: 'Route urgent tickets to the right people', g: 'alert', i: 2 },
  { t: 'Operations', d: 'Keep your systems in sync on a schedule', g: 'retry', i: 3 }
];
const MORE = [
  { t: 'How it works', id: 'how', g: 'flow' },
  { t: 'When a run fails', id: 'failures', g: 'alert' },
  { t: 'Integrations', id: 'integrations', g: 'plug' }
];
class Component extends DCLogic {
  state = { open: '' };
  jump(id, i) {
    return (e) => {
      this.setState({ open: '' });
      if (this.props.onJump) { e.preventDefault(); this.props.onJump(id, i); }
    };
  }
  renderVals() {
    const o = this.state.open;
    const flip = (k) => () => this.setState({ open: o === k ? '' : k });
    const uses = USES.map((u) => ({ ...u, href: '/#use-cases', go: this.jump('use-cases', u.i) }));
    const more = MORE.map((m) => ({ ...m, href: '/#' + m.id, go: this.jump(m.id) }));
    return {
      toneCls: this.props.tone === 'dark' ? 'is-dark' : '', useOpen: o === 'use', moreOpen: o === 'more', menuOpen: o === 'menu',
      toggleUse: flip('use'), toggleMore: flip('more'), toggleMenu: flip('menu'),
      menuIc: o === 'menu' ? 'x' : 'list',
      uses, more,
      sheet: [
        { t: 'Use cases', href: '/#use-cases', go: this.jump('use-cases') },
        { t: 'Docs', href: '/docs', go: () => {} },
        { t: 'How it works', href: '/#how', go: this.jump('how') },
        { t: 'When a run fails', href: '/#failures', go: this.jump('failures') },
        { t: 'Integrations', href: '/#integrations', go: this.jump('integrations') },
        { t: 'Sign in', href: '/sign-in', go: () => {} }
      ]
    };
  }
}

return Component;
});
FB.def("Team",[{"t":"dc-import","a":{"name":"Settings","section":"team","nav":"team","hint-size":"100%,100vh"},"c":[]}],{},function(DCLogic){

class Component extends DCLogic {
  renderVals() { return {}; }
}

return Component;
});
FB.def("Templates",[{"t":"sc-if","a":{"value":"{{fbDenied}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"dc-import","a":{"name":"NoAccess","hint-size":"100%,100vh"},"c":[]}]},{"t":"sc-if","a":{"value":"{{fbOk}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"sc-if","a":{"value":"{{using}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"dc-import","a":{"name":"Builder","template":"{{using}}","hint-size":"100%,100vh"},"c":[]}]},{"t":"div","a":{"class":"app","style":"display: {{appDisplay}}"},"c":[{"t":"dc-import","a":{"name":"Sidebar","active":"templates","hint-size":"232px,100vh"},"c":[]},{"t":"div","a":{"class":"main"},"c":[{"t":"dc-import","a":{"name":"Topbar","page":"Templates","hint-size":"100%,56px"},"c":[]},{"t":"main","a":{"class":"page"},"c":[{"t":"div","a":{"class":"page-head"},"c":[{"t":"div","a":{},"c":[{"t":"h1","a":{"class":"page-title"},"c":["Templates"]},{"t":"p","a":{"class":"page-sub"},"c":["Ready-made workflows for common processes. Each one opens in the builder for you to connect your apps and adjust."]}]},{"t":"a","a":{"class":"btn","href":"/builder"},"c":["Start from scratch"]}]},{"t":"div","a":{"class":"row wrap","style":"gap: 6px","role":"group","aria-label":"Filter by team"},"c":[{"t":"sc-for","a":{"list":"{{cats}}","as":"c","hint-placeholder-count":"5"},"c":[{"t":"button","a":{"class":"chip {{c.cls}}","aria-pressed":"{{c.on}}","onClick":"{{c.pick}}"},"c":["{{c.l}}"]}]}]},{"t":"div","a":{"class":"g-auto"},"c":[{"t":"sc-for","a":{"list":"{{items}}","as":"t","hint-placeholder-count":"8"},"c":[{"t":"article","a":{"class":"card","style":"padding: 15px; display: flex; flex-direction: column; gap: 10px"},"c":[{"t":"div","a":{"class":"col","style":"gap: 4px"},"c":[{"t":"h2","a":{"class":"strong","style":"font-size: 14px"},"c":["{{t.n}}"]},{"t":"p","a":{"class":"small muted","style":"min-height: 34px; text-wrap: pretty"},"c":["{{t.d}}"]}]},{"t":"div","a":{"class":"row small muted","style":"gap: 5px; flex-wrap: wrap"},"c":[{"t":"sc-for","a":{"list":"{{t.steps}}","as":"s"},"c":[{"t":"span","a":{"class":"row","style":"gap: 5px"},"c":[{"t":"span","a":{"class":"badge b-off","style":"padding: 0 7px"},"c":["{{s.l}}"]},{"t":"sc-if","a":{"value":"{{s.more}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"right","s":"11","hint-size":"11px,11px"},"c":[]}]}]}]}]},{"t":"div","a":{"class":"row between","style":"border-top: 1px solid var(--line); padding-top: 10px; margin-top: auto"},"c":[{"t":"span","a":{"class":"row","style":"gap: 4px"},"c":[{"t":"sc-for","a":{"list":"{{t.apps}}","as":"a"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"{{a}}","s":"26","hint-size":"26px,26px"},"c":[]}]}]},{"t":"button","a":{"class":"btn btn-sm","onClick":"{{t.use}}"},"c":["Use template"]}]}]}]}]}]}]}]}]}],{},function(DCLogic){

const FB_ACC = {
  admin: { k: 'admin', n: 'Jonah Thomas', f: 'Jonah', i: 'JT', a: 'a5', r: 'Administrator', e: 'jonah@meridianlogistics.example' },
  creator: { k: 'creator', n: 'Priya Raman', f: 'Priya', i: 'PR', a: '', r: 'Workflow Creator', e: 'priya@meridianlogistics.example' },
  operator: { k: 'operator', n: 'Rahul Shah', f: 'Rahul', i: 'RS', a: 'a3', r: 'Technical Operator', e: 'rahul@meridianlogistics.example' },
  business: { k: 'business', n: 'Lena Costa', f: 'Lena', i: 'LC', a: 'a2', r: 'Business User', e: 'lena@meridianlogistics.example' }
};
const FB_CANS = {
  admin: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 1 },
  creator: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 0 },
  operator: { edit: 0, builder: 1, publish: 0, retry: 1, data: 1, integ: 0, integView: 1, admin: 0 },
  business: { edit: 0, builder: 0, publish: 0, retry: 0, data: 0, integ: 0, integView: 0, admin: 0 }
};
const fbStored = () => { let k = ''; try { k = localStorage.getItem('fb-role') || ''; } catch (e) {} if (!k) { try { const m = /fb-role:(\w+)/.exec(window.name || ''); if (m) k = m[1]; } catch (e) {} } return FB_ACC[k] ? k : ''; };
const fbSetRole = (k) => { try { if (k) localStorage.setItem('fb-role', k); else localStorage.removeItem('fb-role'); } catch (e) {} try { window.name = k ? 'fb-role:' + k : ''; } catch (e) {} };
const FB_ME = FB_ACC[fbStored() || 'creator'], FB_C = FB_CANS[FB_ME.k];
const T = [
  { c: 'Sales', n: 'Welcome new customers', d: 'Save each registration, send a welcome email and alert the sales team.', s: ['Webhook', 'Validate', 'Save', 'Email', 'Notify'], apps: ['Pg', 'Gm', 'Sl'] },
  { c: 'Sales', n: 'Sync leads to your database', d: 'Copy new spreadsheet rows into your sales database every 15 minutes.', s: ['Schedule', 'Filter', 'Save'], apps: ['Gs', 'Pg'] },
  { c: 'Finance', n: 'Record paid invoices', d: 'Add each paid invoice to a finance sheet and email the receipt.', s: ['Webhook', 'Save', 'Email'], apps: ['Gs', 'Gm'] },
  { c: 'Finance', n: 'Chase overdue invoices', d: 'Check daily for unpaid invoices and send a polite reminder.', s: ['Schedule', 'Filter', 'Email'], apps: ['Mg', 'Gm'] },
  { c: 'Support', n: 'Escalate urgent tickets', d: 'Route tickets by priority and notify the on-call channel.', s: ['Webhook', 'Condition', 'Notify'], apps: ['Dc', 'Sl'] },
  { c: 'Support', n: 'Follow up after 3 days', d: 'Wait three days after a ticket closes, then ask for feedback.', s: ['Webhook', 'Delay', 'Email'], apps: ['Gm'] },
  { c: 'Operations', n: 'Remind task owners', d: 'Each weekday, message people about tasks past their due date.', s: ['Schedule', 'Filter', 'Notify'], apps: ['Pg', 'Sl'] },
  { c: 'Operations', n: 'Log form replies to a sheet', d: 'Add every form submission as a new row, then confirm by email.', s: ['Webhook', 'Save', 'Email'], apps: ['Gs', 'Gm'] }
];
class Component extends DCLogic {
  state = { cat: 'All' };
  renderVals() {
    const cat = this.state.cat;
    return {
      fbDenied: !FB_C.edit, fbOk: !(!FB_C.edit),
      cats: ['All', 'Sales', 'Finance', 'Support', 'Operations'].map((l) => ({ l, cls: cat === l ? 'is-on' : '', on: cat === l ? 'true' : 'false', pick: () => this.setState({ cat: l }) })),
      items: T.filter((t) => cat === 'All' || t.c === cat).map((t) => ({ ...t, steps: t.s.map((l, i) => ({ l, more: i < t.s.length - 1 })), use: () => this.setState({ using: { name: t.n, steps: t.s } }) })),
      using: this.state.using || false, appDisplay: this.state.using ? 'none' : 'flex'
    };
  }
}

return Component;
});
FB.def("Topbar",[{"t":"header","a":{"class":"top"},"c":[{"t":"nav","a":{"class":"crumbs","aria-label":"Breadcrumb"},"c":[{"t":"sc-if","a":{"value":"{{parent}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"a","a":{"href":"{{phref}}"},"c":["{{parent}}"]},{"t":"dc-import","a":{"name":"Icon","g":"right","s":"12","hint-size":"12px,12px"},"c":[]}]},{"t":"b","a":{"class":"trunc"},"c":["{{page}}"]}]},{"t":"div","a":{"class":"hide-m","style":"position: relative; margin-left: auto"},"c":[{"t":"sc-if","a":{"value":"{{showUsage}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"button","a":{"class":"row small","style":"gap: 8px; background: none; border: 0; padding: 6px 8px; border-radius: var(--r-s); color: var(--ink-2)","aria-expanded":"{{usageOpen}}","aria-label":"Usage: 18,321 of 25,000 runs this period","onClick":"{{toggleUsage}}"},"c":[{"t":"span","a":{"class":"hbar","style":"width: 64px; display: block"},"c":[{"t":"i","a":{"style":"width: 73%"},"c":[]}]},{"t":"span","a":{"class":"num use-t","style":"white-space: nowrap"},"c":["18,321 of 25,000 runs"]}]},{"t":"sc-if","a":{"value":"{{usageOpen}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"pop","style":"top: 40px; right: 0; width: 290px; padding: 13px"},"c":[{"t":"div","a":{"class":"row between"},"c":[{"t":"span","a":{"class":"strong","style":"font-size: 13px"},"c":["Usage this period"]},{"t":"span","a":{"class":"small muted"},"c":["Resets 1 Dec"]}]},{"t":"div","a":{"class":"hbar","style":"margin: 9px 0 5px"},"c":[{"t":"i","a":{"style":"width: 73%"},"c":[]}]},{"t":"div","a":{"class":"small muted"},"c":["18,321 of 25,000 live runs used. At this rate you will stay within your plan."]},{"t":"div","a":{"class":"menu-sep","style":"margin: 10px 0"},"c":[]},{"t":"div","a":{"class":"small muted","style":"text-wrap: pretty"},"c":["Live runs and retries count. Test runs are free."]}]}]}]}]},{"t":"div","a":{"class":"search","style":"margin-left: 0"},"c":[{"t":"span","a":{"class":"search-ic"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"search","s":"15","hint-size":"15px,15px"},"c":[]}]},{"t":"label","a":{"for":"fb-search","style":"position: absolute; width: 1px; height: 1px; overflow: hidden"},"c":["Search FlowBridge"]},{"t":"input","a":{"id":"fb-search","class":"input","type":"search","placeholder":"Search workflows, runs, integrations","value":"{{q}}","onChange":"{{onQ}}"},"c":[]},{"t":"sc-if","a":{"value":"{{hasQ}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"pop","style":"top: 40px; left: 0; right: 0"},"c":[{"t":"sc-for","a":{"list":"{{results}}","as":"r","hint-placeholder-count":"3"},"c":[{"t":"a","a":{"class":"menu-i","href":"{{r.href}}"},"c":[{"t":"sc-if","a":{"value":"{{r.app}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"dc-import","a":{"name":"AppLogo","app":"{{r.app}}","s":"20","hint-size":"20px,20px"},"c":[]}]},{"t":"sc-if","a":{"value":"{{r.noApp}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{r.g}}","s":"15","hint-size":"15px,15px"},"c":[]}]},{"t":"span","a":{"class":"grow trunc"},"c":["{{r.t}}"]},{"t":"span","a":{"class":"small dim"},"c":["{{r.k}}"]}]}]},{"t":"sc-if","a":{"value":"{{noResults}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"small muted","style":"padding: 10px"},"c":["Nothing matches that search."]}]}]}]}]},{"t":"div","a":{"class":"row top-actions","style":"position: relative"},"c":[{"t":"span","a":{"class":"hide-m","style":"display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 13px; font-size: 12px; font-weight: 620; white-space: nowrap; background: {{chipBg}}; color: {{chipFg}}"},"c":["{{meR}}"]},{"t":"button","a":{"class":"btn btn-g btn-ic tip-b","data-tip":"Notifications","aria-label":"Notifications, 2 unread","aria-expanded":"{{bellOpen}}","onClick":"{{toggleBell}}","style":"position: relative"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"bell","s":"17","hint-size":"17px,17px"},"c":[]},{"t":"sc-if","a":{"value":"{{unread}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"span","a":{"class":"dot err","style":"position: absolute; top: 6px; right: 7px; border: 1px solid #fff; width: 8px; height: 8px"},"c":[]}]}]},{"t":"button","a":{"class":"avatar {{meA}}","aria-label":"Account menu","aria-expanded":"{{meOpen}}","onClick":"{{toggleMe}}"},"c":["{{meI}}"]},{"t":"sc-if","a":{"value":"{{bellOpen}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"pop","style":"top: 42px; right: 0; width: min(340px, 86vw)"},"c":[{"t":"div","a":{"class":"row between","style":"padding: 5px 9px"},"c":[{"t":"span","a":{"class":"strong","style":"font-size: 13px"},"c":["Notifications"]},{"t":"button","a":{"class":"btn btn-g btn-sm","onClick":"{{markRead}}"},"c":["Mark all read"]}]},{"t":"a","a":{"class":"menu-i","href":"/executions","style":"align-items: flex-start"},"c":[{"t":"span","a":{"class":"dot err","style":"margin-top: 6px"},"c":[]},{"t":"span","a":{"class":"grow"},"c":["New customer onboarding failed at Send welcome email",{"t":"span","a":{"class":"small dim","style":"display: block"},"c":["2 minutes ago"]}]}]},{"t":"a","a":{"class":"menu-i","href":"/executions","style":"align-items: flex-start"},"c":[{"t":"span","a":{"class":"dot warn","style":"margin-top: 6px"},"c":[]},{"t":"span","a":{"class":"grow"},"c":["Lead sync to PostgreSQL is retrying after a timeout",{"t":"span","a":{"class":"small dim","style":"display: block"},"c":["6 minutes ago"]}]}]},{"t":"sc-if","a":{"value":"{{canInteg}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"a","a":{"class":"menu-i","href":"/integrations","style":"align-items: flex-start"},"c":[{"t":"span","a":{"class":"dot","style":"margin-top: 6px"},"c":[]},{"t":"span","a":{"class":"grow"},"c":["The Google Sheets token expires in 3 days",{"t":"span","a":{"class":"small dim","style":"display: block"},"c":["Today, 08:00"]}]}]}]}]}]},{"t":"sc-if","a":{"value":"{{meOpen}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"pop","style":"top: 42px; right: 0; width: 230px"},"c":[{"t":"div","a":{"style":"padding: 7px 9px"},"c":[{"t":"div","a":{"class":"strong","style":"font-size: 13px"},"c":["{{meN}}"]},{"t":"div","a":{"class":"small muted"},"c":["{{meR}}, Meridian Logistics"]}]},{"t":"div","a":{"class":"menu-sep m-only"},"c":[]},{"t":"sc-if","a":{"value":"{{canEdit}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"a","a":{"class":"menu-i m-only","href":"/templates"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"template","s":"15","hint-size":"15px,15px"},"c":[]},"Templates"]}]},{"t":"sc-if","a":{"value":"{{canInteg}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"a","a":{"class":"menu-i m-only","href":"/integrations"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"plug","s":"15","hint-size":"15px,15px"},"c":[]},"Integrations"]}]},{"t":"div","a":{"class":"menu-sep"},"c":[]},{"t":"a","a":{"class":"menu-i","href":"/settings"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"user","s":"15","hint-size":"15px,15px"},"c":[]},"Your profile"]},{"t":"sc-if","a":{"value":"{{canAdmin}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"a","a":{"class":"menu-i","href":"/team"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"users","s":"15","hint-size":"15px,15px"},"c":[]},"Team members"]}]},{"t":"div","a":{"class":"menu-sep"},"c":[]},{"t":"div","a":{"class":"menu-h"},"c":["Switch test account"]},{"t":"sc-for","a":{"list":"{{others}}","as":"o","hint-placeholder-count":"3"},"c":[{"t":"a","a":{"class":"menu-i","href":"/overview","onClick":"{{o.pick}}"},"c":[{"t":"span","a":{"class":"avatar {{o.a}}","style":"width: 24px; height: 24px; font-size: 10px; flex: none"},"c":["{{o.i}}"]},{"t":"span","a":{"class":"grow trunc"},"c":["{{o.r}}"]}]}]},{"t":"div","a":{"class":"menu-sep"},"c":[]},{"t":"a","a":{"class":"menu-i","href":"/","onClick":"{{signOut}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"logout","s":"15","hint-size":"15px,15px"},"c":[]},"Sign out"]}]}]}]}]}],{"page":"Overview","parent":"","phref":""},function(DCLogic){

const FB_ACC = {
  admin: { k: 'admin', n: 'Jonah Thomas', f: 'Jonah', i: 'JT', a: 'a5', r: 'Administrator', e: 'jonah@meridianlogistics.example' },
  creator: { k: 'creator', n: 'Priya Raman', f: 'Priya', i: 'PR', a: '', r: 'Workflow Creator', e: 'priya@meridianlogistics.example' },
  operator: { k: 'operator', n: 'Rahul Shah', f: 'Rahul', i: 'RS', a: 'a3', r: 'Technical Operator', e: 'rahul@meridianlogistics.example' },
  business: { k: 'business', n: 'Lena Costa', f: 'Lena', i: 'LC', a: 'a2', r: 'Business User', e: 'lena@meridianlogistics.example' }
};
const FB_CANS = {
  admin: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 1 },
  creator: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 0 },
  operator: { edit: 0, builder: 1, publish: 0, retry: 1, data: 1, integ: 0, integView: 1, admin: 0 },
  business: { edit: 0, builder: 0, publish: 0, retry: 0, data: 0, integ: 0, integView: 0, admin: 0 }
};
const fbStored = () => { let k = ''; try { k = localStorage.getItem('fb-role') || ''; } catch (e) {} if (!k) { try { const m = /fb-role:(\w+)/.exec(window.name || ''); if (m) k = m[1]; } catch (e) {} } return FB_ACC[k] ? k : ''; };
const fbSetRole = (k) => { try { if (k) localStorage.setItem('fb-role', k); else localStorage.removeItem('fb-role'); } catch (e) {} try { window.name = k ? 'fb-role:' + k : ''; } catch (e) {} };
const FB_ME = FB_ACC[fbStored() || 'creator'], FB_C = FB_CANS[FB_ME.k];
const INDEX = [
  { t: 'New customer onboarding', k: 'Workflow', g: 'flow', href: '/builder' },
  { t: 'Invoice paid to ledger', k: 'Workflow', g: 'flow', href: '/builder' },
  { t: 'Support ticket triage', k: 'Workflow', g: 'flow', href: '/builder' },
  { t: 'EX-48213, failed', k: 'Run', g: 'runs', href: '/executions' },
  { t: 'Gmail', k: 'Integration', g: 'plug', app: 'gmail', href: '/integrations' },
  { t: 'Slack', k: 'Integration', g: 'plug', app: 'slack', href: '/integrations' },
  { t: 'PostgreSQL', k: 'Integration', g: 'plug', app: 'pg', href: '/integrations' }
];
class Component extends DCLogic {
  state = { q: '', open: '', unread: true };
  renderVals() {
    const q = this.state.q.trim().toLowerCase();
    const results = q ? INDEX.filter((r) => (FB_C.integView || r.k !== 'Integration')).map((r) => (r.k === 'Workflow' && !FB_C.builder ? { ...r, href: '/executions' } : r)).filter((r) => (r.t + r.k).toLowerCase().includes(q)).slice(0, 6).map((r) => ({ ...r, app: r.app || '', noApp: !r.app })) : [];
    const flip = (k) => () => this.setState({ open: this.state.open === k ? '' : k });
    return {
      showUsage: FB_ME.k === 'admin' || FB_ME.k === 'creator', chipBg: 'var(--sunken)', chipFg: 'var(--ink-2)',
      meA: FB_ME.a, meI: FB_ME.i, meN: FB_ME.n, meR: FB_ME.r, canInteg: !!FB_C.integView, canEdit: !!FB_C.edit, canAdmin: !!FB_C.admin,
      others: Object.values(FB_ACC).filter((a) => a.k !== FB_ME.k).map((a) => ({ ...a, pick: () => fbSetRole(a.k) })),
      signOut: () => fbSetRole(''),
      page: this.props.page ?? 'Overview',
      parent: this.props.parent ?? '',
      phref: this.props.phref ?? '#',
      q: this.state.q,
      onQ: (e) => this.setState({ q: e.target.value, open: '' }),
      hasQ: !!q,
      results,
      noResults: !!q && results.length === 0,
      unread: this.state.unread,
      usageOpen: this.state.open === 'usage', toggleUsage: flip('usage'),
      bellOpen: this.state.open === 'bell',
      meOpen: this.state.open === 'me',
      toggleBell: flip('bell'),
      toggleMe: flip('me'),
      markRead: () => this.setState({ unread: false, open: '' })
    };
  }
}

return Component;
});
FB.def("Workflows",[{"t":"div","a":{"class":"app"},"c":[{"t":"dc-import","a":{"name":"Sidebar","active":"workflows","hint-size":"232px,100vh"},"c":[]},{"t":"div","a":{"class":"main"},"c":[{"t":"dc-import","a":{"name":"Topbar","page":"{{pageName}}","hint-size":"100%,56px"},"c":[]},{"t":"main","a":{"class":"page"},"c":[{"t":"div","a":{"class":"page-head"},"c":[{"t":"div","a":{},"c":[{"t":"h1","a":{"class":"page-title"},"c":["{{pageName}}"]},{"t":"p","a":{"class":"page-sub"},"c":["{{pageSub}}"]}]},{"t":"sc-if","a":{"value":"{{canEdit}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"a","a":{"class":"btn btn-p","href":"/builder"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"plus","s":"15","hint-size":"15px,15px"},"c":[]},"Create workflow"]}]}]},{"t":"div","a":{"class":"row wrap","style":"gap: 10px"},"c":[{"t":"div","a":{"style":"position: relative; flex: 1 1 240px; max-width: 340px"},"c":[{"t":"span","a":{"class":"search-ic"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"search","s":"15","hint-size":"15px,15px"},"c":[]}]},{"t":"label","a":{"for":"wf-q","style":"position: absolute; width: 1px; height: 1px; overflow: hidden"},"c":["Search workflows"]},{"t":"input","a":{"id":"wf-q","class":"input","style":"padding-left: 32px","type":"search","placeholder":"Search workflows","value":"{{q}}","onChange":"{{onQ}}"},"c":[]}]},{"t":"div","a":{"class":"row","style":"gap: 6px","role":"group","aria-label":"Filter by status"},"c":[{"t":"sc-for","a":{"list":"{{chips}}","as":"c","hint-placeholder-count":"3"},"c":[{"t":"button","a":{"class":"chip {{c.cls}}","aria-pressed":"{{c.on}}","onClick":"{{c.pick}}"},"c":["{{c.l}}"]}]}]},{"t":"div","a":{"class":"grow"},"c":[]},{"t":"label","a":{"class":"small muted","for":"wf-sort"},"c":["Sort by"]},{"t":"select","a":{"id":"wf-sort","class":"select","style":"width: 160px","value":"{{sort}}","onChange":"{{onSort}}"},"c":[{"t":"option","a":{"value":"updated"},"c":["Last updated"]},{"t":"option","a":{"value":"name"},"c":["Name"]},{"t":"option","a":{"value":"runs"},"c":["Most runs"]},{"t":"option","a":{"value":"rate"},"c":["Lowest success rate"]}]},{"t":"div","a":{"class":"seg-ctl hide-m","role":"group","aria-label":"Layout"},"c":[{"t":"button","a":{"class":"{{listCls}}","aria-label":"List view","aria-pressed":"{{isList}}","onClick":"{{toList}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"list","s":"15","hint-size":"15px,15px"},"c":[]}]},{"t":"button","a":{"class":"{{gridCls}}","aria-label":"Grid view","aria-pressed":"{{isGrid}}","onClick":"{{toGrid}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"grid","s":"15","hint-size":"15px,15px"},"c":[]}]}]}]},{"t":"sc-if","a":{"value":"{{loading}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"card col","aria-label":"Loading workflows"},"c":[{"t":"sc-for","a":{"list":"{{skeleton}}","as":"s","hint-placeholder-count":"6"},"c":[{"t":"div","a":{"class":"row","style":"padding: 16px; gap: 24px; border-bottom: 1px solid var(--line)"},"c":[{"t":"div","a":{"class":"grow col","style":"gap: 7px"},"c":[{"t":"span","a":{"class":"skel","style":"width: 34%"},"c":[]},{"t":"span","a":{"class":"skel","style":"width: 58%; height: 10px"},"c":[]}]},{"t":"span","a":{"class":"skel hide-m","style":"width: 70px"},"c":[]},{"t":"span","a":{"class":"skel hide-m","style":"width: 90px"},"c":[]},{"t":"span","a":{"class":"skel","style":"width: 56px"},"c":[]}]}]}]}]},{"t":"sc-if","a":{"value":"{{isEmptyWs}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"card empty"},"c":[{"t":"div","a":{"class":"empty-ic"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"flow","s":"22","hint-size":"22px,22px"},"c":[]}]},{"t":"h2","a":{"class":"card-t","style":"font-size: 16px"},"c":["Automate your first process"]},{"t":"p","a":{"class":"muted","style":"max-width: 46ch; text-wrap: pretty"},"c":["Pick something your team does by hand, like welcoming a new customer. Start with a template and adapt it, or build from scratch."]},{"t":"div","a":{"class":"row wrap","style":"justify-content: center; margin-top: 6px"},"c":[{"t":"a","a":{"class":"btn btn-p","href":"/templates"},"c":["Browse templates"]},{"t":"a","a":{"class":"btn","href":"/builder"},"c":["Start from scratch"]}]}]}]},{"t":"sc-if","a":{"value":"{{noMatch}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"card empty"},"c":[{"t":"div","a":{"class":"empty-ic"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"search","s":"22","hint-size":"22px,22px"},"c":[]}]},{"t":"h2","a":{"class":"card-t","style":"font-size: 16px"},"c":["No workflows match"]},{"t":"p","a":{"class":"muted"},"c":["Try a different name, or clear your filters."]},{"t":"button","a":{"class":"btn","onClick":"{{clear}}"},"c":["Clear filters"]}]}]},{"t":"sc-if","a":{"value":"{{showList}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"section","a":{"class":"card","style":"overflow: visible"},"c":[{"t":"div","a":{"class":"tbl-wrap","style":"overflow: visible"},"c":[{"t":"table","a":{"class":"tbl"},"c":[{"t":"thead","a":{},"c":[{"t":"tr","a":{},"c":[{"t":"th","a":{},"c":["Workflow"]},{"t":"th","a":{},"c":["Status"]},{"t":"th","a":{"class":"hide-m"},"c":["Last run"]},{"t":"th","a":{"class":"r hide-m"},"c":["Success rate"]},{"t":"th","a":{"class":"r hide-m hide-t"},"c":["Runs, 30 days"]},{"t":"th","a":{"class":"hide-m hide-t"},"c":["Last updated"]},{"t":"th","a":{},"c":[{"t":"span","a":{"style":"position: absolute; width: 1px; height: 1px; overflow: hidden"},"c":["Actions"]}]}]}]},{"t":"tbody","a":{},"c":[{"t":"sc-for","a":{"list":"{{rows}}","as":"w","hint-placeholder-count":"8"},"c":[{"t":"tr","a":{},"c":[{"t":"td","a":{"style":"white-space: normal; min-width: 240px"},"c":[{"t":"a","a":{"class":"link-row","href":"{{wfHref}}"},"c":["{{w.n}}"]},{"t":"div","a":{"class":"small muted"},"c":["{{w.d}}"]}]},{"t":"td","a":{},"c":[{"t":"span","a":{"class":"badge {{w.sCls}}"},"c":[{"t":"span","a":{"class":"dot {{w.sDot}}"},"c":[]},"{{w.sL}}"]}]},{"t":"td","a":{"class":"hide-m"},"c":[{"t":"span","a":{"class":"row","style":"gap: 6px"},"c":[{"t":"span","a":{"class":"{{w.lastColor}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{w.lastIc}}","s":"13","hint-size":"13px,13px"},"c":[]}]},{"t":"span","a":{"class":"muted"},"c":["{{w.last}}"]}]}]},{"t":"td","a":{"class":"r num hide-m"},"c":["{{w.rateL}}"]},{"t":"td","a":{"class":"r num hide-m hide-t"},"c":["{{w.runsL}}"]},{"t":"td","a":{"class":"muted hide-m hide-t"},"c":["{{w.upd}}"]},{"t":"td","a":{"class":"r","style":"position: relative; width: 44px"},"c":[{"t":"button","a":{"class":"btn btn-g btn-sm btn-ic","aria-label":"Actions for {{w.n}}","aria-expanded":"{{w.menu}}","onClick":"{{w.toggleMenu}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"more","s":"16","hint-size":"16px,16px"},"c":[]}]},{"t":"sc-if","a":{"value":"{{w.menu}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"pop","style":"right: 12px; top: 40px; width: 190px; text-align: left"},"c":[{"t":"sc-if","a":{"value":"{{w.on}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"button","a":{"class":"menu-i","onClick":"{{w.run}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"play","s":"14","hint-size":"14px,14px"},"c":[]},"Run now"]}]},{"t":"sc-if","a":{"value":"{{canBuilder}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"a","a":{"class":"menu-i","href":"/builder"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"edit","s":"14","hint-size":"14px,14px"},"c":[]},"{{builderL}}"]}]},{"t":"a","a":{"class":"menu-i","href":"/executions"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"runs","s":"14","hint-size":"14px,14px"},"c":[]},"View runs"]},{"t":"sc-if","a":{"value":"{{canEdit}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"button","a":{"class":"menu-i","onClick":"{{w.dup}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"copy","s":"14","hint-size":"14px,14px"},"c":[]},"Duplicate"]}]},{"t":"sc-if","a":{"value":"{{canPublish}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"button","a":{"class":"menu-i","onClick":"{{w.flip}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{w.flipIc}}","s":"14","hint-size":"14px,14px"},"c":[]},"{{w.flipL}}"]}]},{"t":"sc-if","a":{"value":"{{canEdit}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"div","a":{"class":"menu-sep"},"c":[]},{"t":"button","a":{"class":"menu-i danger","onClick":"{{w.askDel}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"trash","s":"14","hint-size":"14px,14px"},"c":[]},"Delete"]}]}]}]}]}]}]}]}]}]}]}]},{"t":"sc-if","a":{"value":"{{showGrid}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"g-auto"},"c":[{"t":"sc-for","a":{"list":"{{rows}}","as":"w","hint-placeholder-count":"8"},"c":[{"t":"article","a":{"class":"card","style":"padding: 15px; display: flex; flex-direction: column; gap: 10px; position: relative"},"c":[{"t":"div","a":{"class":"row between","style":"align-items: flex-start"},"c":[{"t":"a","a":{"class":"link-row","href":"{{wfHref}}"},"c":["{{w.n}}"]},{"t":"sc-if","a":{"value":"{{canMenu}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"button","a":{"class":"btn btn-g btn-sm btn-ic","aria-label":"Actions for {{w.n}}","aria-expanded":"{{w.menu}}","onClick":"{{w.toggleMenu}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"more","s":"16","hint-size":"16px,16px"},"c":[]}]},{"t":"sc-if","a":{"value":"{{w.menu}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"pop","style":"right: 12px; top: 46px; width: 190px"},"c":[{"t":"sc-if","a":{"value":"{{w.on}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"button","a":{"class":"menu-i","onClick":"{{w.run}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"play","s":"14","hint-size":"14px,14px"},"c":[]},"Run now"]}]},{"t":"sc-if","a":{"value":"{{canBuilder}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"a","a":{"class":"menu-i","href":"/builder"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"edit","s":"14","hint-size":"14px,14px"},"c":[]},"{{builderL}}"]}]},{"t":"sc-if","a":{"value":"{{canEdit}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"button","a":{"class":"menu-i","onClick":"{{w.dup}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"copy","s":"14","hint-size":"14px,14px"},"c":[]},"Duplicate"]}]},{"t":"sc-if","a":{"value":"{{canPublish}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"button","a":{"class":"menu-i","onClick":"{{w.flip}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"{{w.flipIc}}","s":"14","hint-size":"14px,14px"},"c":[]},"{{w.flipL}}"]}]},{"t":"sc-if","a":{"value":"{{canEdit}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"button","a":{"class":"menu-i danger","onClick":"{{w.askDel}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"trash","s":"14","hint-size":"14px,14px"},"c":[]},"Delete"]}]}]}]}]},{"t":"sc-if","a":{"value":"{{isBiz}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"button","a":{"class":"btn btn-sm","onClick":"{{w.run}}"},"c":[{"t":"dc-import","a":{"name":"Icon","g":"play","s":"13","hint-size":"13px,13px"},"c":[]},"Run now"]}]}]},{"t":"p","a":{"class":"small muted","style":"min-height: 34px; text-wrap: pretty"},"c":["{{w.d}}"]},{"t":"div","a":{"class":"row between"},"c":[{"t":"span","a":{"class":"badge {{w.sCls}}"},"c":[{"t":"span","a":{"class":"dot {{w.sDot}}"},"c":[]},"{{w.sL}}"]},{"t":"span","a":{"class":"small muted"},"c":["{{w.last}}"]}]},{"t":"div","a":{"class":"row between small","style":"border-top: 1px solid var(--line); padding-top: 9px"},"c":[{"t":"span","a":{},"c":[{"t":"span","a":{"class":"strong num"},"c":["{{w.rateL}}"]}," ",{"t":"span","a":{"class":"muted"},"c":["success"]}]},{"t":"span","a":{},"c":[{"t":"span","a":{"class":"strong num"},"c":["{{w.runsL}}"]}," ",{"t":"span","a":{"class":"muted"},"c":["runs"]}]}]}]}]}]}]},{"t":"sc-if","a":{"value":"{{showFooter}}","hint-placeholder-val":"{{ true }}"},"c":[{"t":"div","a":{"class":"row between small muted wrap"},"c":[{"t":"span","a":{},"c":["Showing {{rowCount}} on this page, of {{total}} workflows"]},{"t":"div","a":{"class":"row"},"c":[{"t":"button","a":{"class":"btn btn-sm","disabled":"{{ true }}"},"c":["Previous"]},{"t":"button","a":{"class":"btn btn-sm"},"c":["Next"]}]}]}]}]}]},{"t":"sc-if","a":{"value":"{{modal}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"scrim"},"c":[{"t":"div","a":{"class":"modal","role":"dialog","aria-modal":"true","aria-labelledby":"del-t"},"c":[{"t":"h2","a":{"id":"del-t"},"c":["Delete {{modal.n}}?"]},{"t":"p","a":{"class":"muted","style":"text-wrap: pretty"},"c":["It will stop running immediately. Its {{modal.runs}} past runs stay in execution history for 90 days. This cannot be undone."]},{"t":"div","a":{"class":"modal-a"},"c":[{"t":"button","a":{"class":"btn","onClick":"{{closeModal}}"},"c":["Cancel"]},{"t":"button","a":{"class":"btn btn-d","onClick":"{{confirmDel}}"},"c":["Delete workflow"]}]}]}]}]},{"t":"sc-if","a":{"value":"{{toast}}","hint-placeholder-val":"{{ false }}"},"c":[{"t":"div","a":{"class":"toast","role":"status"},"c":["{{toast}}"]}]}]}],{"viewState":"normal"},function(DCLogic){

const FB_ACC = {
  admin: { k: 'admin', n: 'Jonah Thomas', f: 'Jonah', i: 'JT', a: 'a5', r: 'Administrator', e: 'jonah@meridianlogistics.example' },
  creator: { k: 'creator', n: 'Priya Raman', f: 'Priya', i: 'PR', a: '', r: 'Workflow Creator', e: 'priya@meridianlogistics.example' },
  operator: { k: 'operator', n: 'Rahul Shah', f: 'Rahul', i: 'RS', a: 'a3', r: 'Technical Operator', e: 'rahul@meridianlogistics.example' },
  business: { k: 'business', n: 'Lena Costa', f: 'Lena', i: 'LC', a: 'a2', r: 'Business User', e: 'lena@meridianlogistics.example' }
};
const FB_CANS = {
  admin: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 1 },
  creator: { edit: 1, builder: 1, publish: 1, retry: 1, data: 1, integ: 1, integView: 1, admin: 0 },
  operator: { edit: 0, builder: 1, publish: 0, retry: 1, data: 1, integ: 0, integView: 1, admin: 0 },
  business: { edit: 0, builder: 0, publish: 0, retry: 0, data: 0, integ: 0, integView: 0, admin: 0 }
};
const fbStored = () => { let k = ''; try { k = localStorage.getItem('fb-role') || ''; } catch (e) {} if (!k) { try { const m = /fb-role:(\w+)/.exec(window.name || ''); if (m) k = m[1]; } catch (e) {} } return FB_ACC[k] ? k : ''; };
const fbSetRole = (k) => { try { if (k) localStorage.setItem('fb-role', k); else localStorage.removeItem('fb-role'); } catch (e) {} try { window.name = k ? 'fb-role:' + k : ''; } catch (e) {} };
const FB_ME = FB_ACC[fbStored() || 'creator'], FB_C = FB_CANS[FB_ME.k];
const DATA = [
  { n: 'New customer onboarding', d: 'Validates each registration, saves it, sends a welcome email and alerts sales.', on: true, ahead: true, last: '2 min ago, failed', lastS: 'err', rate: 97.6, runs: 4812, upd: '3 Nov, Priya Raman', ord: 8 },
  { n: 'Invoice paid to ledger', d: 'Adds paid invoices to the finance sheet and emails a receipt.', on: true, last: 'Running now', lastS: 'run', rate: 99.6, runs: 3266, upd: '28 Oct, Rahul Shah', ord: 6 },
  { n: 'Support ticket triage', d: 'Sorts new tickets by priority and posts urgent ones to the on-call channel.', on: true, last: '3 min ago', lastS: 'ok', rate: 96.1, runs: 2944, upd: '30 Oct, Anika Menon', ord: 7 },
  { n: 'Lead sync to PostgreSQL', d: 'Copies new rows from the leads sheet into the sales database every 15 minutes.', on: true, last: '6 min ago, retrying', lastS: 'warn', rate: 99.1, runs: 2190, upd: '19 Oct, Rahul Shah', ord: 4 },
  { n: 'Overdue task reminders', d: 'Each weekday, reminds owners about tasks past their due date.', on: true, last: 'Today, 09:00', lastS: 'ok', rate: 100, runs: 930, upd: '12 Oct, Priya Raman', ord: 3 },
  { n: 'Weekly sales digest', d: 'Summarises closed deals and sends them to sales leads every Monday.', on: true, last: '2 Nov, 08:30', lastS: 'ok', rate: 100, runs: 4, upd: '6 Oct, Jonah Thomas', ord: 2 },
  { n: 'Refund approval routing', d: 'Sends refund requests over a set amount to a manager for sign-off.', on: false, last: 'Never run', lastS: 'none', rate: null, runs: 0, upd: '4 Nov, Anika Menon', ord: 9 },
  { n: 'Contract renewal alerts', d: 'Warns account managers 60 days before a contract expires.', on: false, last: '14 Sep, 10:00', lastS: 'ok', rate: 100, runs: 0, upd: '14 Sep, Jonah Thomas', ord: 1 }
];
const LAST = { err: ['x', 'color-err'], run: ['loader', 'color-run'], ok: ['check', 'color-ok'], warn: ['clock', 'color-warn'], none: ['minus', 'dim'] };
class Component extends DCLogic {
  state = { q: '', f: 'all', sort: FB_ME.k === 'operator' ? 'rate' : 'updated', view: FB_ME.k === 'business' ? 'grid' : 'list', loading: true, data: DATA, menu: null, modal: null, toast: '' };
  componentDidMount() { this.timer = setTimeout(() => this.setState({ loading: false }), 650); }
  componentWillUnmount() { clearTimeout(this.timer); clearTimeout(this.tt); }
  say(t) { clearTimeout(this.tt); this.setState({ toast: t }); this.tt = setTimeout(() => this.setState({ toast: '' }), 3500); }
  renderVals() {
    const s = this.state, vs = this.props.viewState ?? 'normal';
    const loading = s.loading || vs === 'loading', emptyWs = vs === 'empty' && !loading;
    const q = s.q.trim().toLowerCase();
    let rows = s.data.filter((w) => (FB_ME.k !== 'business' || w.on) && (s.f === 'all' || (s.f === 'on') === w.on) && (!q || (w.n + w.d).toLowerCase().includes(q)));
    const by = { updated: (a, b) => b.ord - a.ord, name: (a, b) => a.n.localeCompare(b.n), runs: (a, b) => b.runs - a.runs, rate: (a, b) => (a.rate ?? 101) - (b.rate ?? 101) };
    rows = rows.slice().sort(by[s.sort]);
    const ready = !loading && !emptyWs && rows.length > 0;
    return {
      canMenu: FB_ME.k !== 'business', isBiz: FB_ME.k === 'business',
      pageName: FB_ME.k === 'business' ? 'Automations' : 'Workflows', pageSub: { business: 'The automations you can run. Start one whenever you need it.', operator: 'Least reliable first, so the workflows most likely to need you are at the top.', admin: 'Every automation in the workspace, across all teams.' }[FB_ME.k] || 'Every automation in your workspace, with how each one is performing.',
      canEdit: !!FB_C.edit, canPublish: !!FB_C.publish, canBuilder: !!FB_C.builder, builderL: FB_C.edit ? 'Open in builder' : 'View workflow', wfHref: FB_C.builder ? '/builder' : '/executions',
      loading, isEmptyWs: emptyWs, noMatch: !loading && !emptyWs && rows.length === 0,
      skeleton: [1, 2, 3, 4, 5, 6],
      q: s.q, onQ: (e) => this.setState({ q: e.target.value }),
      clear: () => this.setState({ q: '', f: 'all' }),
      chips: (FB_ME.k === 'business' ? [] : [['all', 'All'], ['on', 'Published'], ['off', 'Draft']]).map(([id, l]) => ({ l, cls: s.f === id ? 'is-on' : '', on: s.f === id ? 'true' : 'false', pick: () => this.setState({ f: id }) })),
      sort: s.sort, onSort: (e) => this.setState({ sort: e.target.value }),
      listCls: s.view === 'list' ? 'is-on' : '', gridCls: s.view === 'grid' ? 'is-on' : '',
      isList: s.view === 'list' ? 'true' : 'false', isGrid: s.view === 'grid' ? 'true' : 'false',
      toList: () => this.setState({ view: 'list', menu: null }), toGrid: () => this.setState({ view: 'grid', menu: null }),
      showList: ready && s.view === 'list', showGrid: ready && s.view === 'grid', showFooter: ready,
      rowCount: rows.length, total: 24,
      rows: rows.map((w) => ({
        ...w,
        sCls: FB_ME.k === 'business' ? 'b-ok' : w.on ? (w.ahead ? 'b-warn' : 'b-ok') : 'b-off', sDot: FB_ME.k === 'business' ? 'ok' : w.on ? (w.ahead ? 'warn' : 'ok') : '', sL: FB_ME.k === 'business' ? 'Active' : w.on ? (w.ahead ? 'Published, draft edited' : 'Published') : 'Draft',
        lastIc: LAST[w.lastS][0], lastColor: LAST[w.lastS][1],
        rateL: w.rate === null ? 'No runs' : w.rate.toFixed(1) + '%', runsL: w.runs.toLocaleString('en-GB'),
        menu: s.menu === w.n,
        run: () => { this.setState({ menu: null }); this.say(w.n + ' started. Follow it in Executions.'); },
        toggleMenu: () => this.setState({ menu: s.menu === w.n ? null : w.n }),
        flipIc: w.on ? 'stop' : 'play', flipL: w.on ? 'Unpublish' : 'Publish',
        flip: () => { this.setState({ menu: null, data: s.data.map((x) => (x.n === w.n ? { ...x, on: !x.on } : x)) }); this.say(w.n + (w.on ? ' unpublished. Its webhook now rejects new events.' : ' published.')); },
        dup: () => { const i = s.data.indexOf(s.data.find((x) => x.n === w.n)); const c = s.data.slice(); c.splice(i + 1, 0, { ...w, n: w.n + ' copy', on: false, last: 'Never run', lastS: 'none', rate: null, runs: 0, upd: 'Just now, ' + FB_ME.n, ord: 10 }); this.setState({ menu: null, data: c }); this.say('Copy created. It stays a draft until you publish it.'); },
        askDel: () => this.setState({ menu: null, modal: { n: w.n, runs: w.runs.toLocaleString('en-GB') } })
      })),
      modal: s.modal, closeModal: () => this.setState({ modal: null }),
      confirmDel: () => { const n = s.modal.n; this.setState({ modal: null, data: s.data.filter((x) => x.n !== n) }); this.say(n + ' deleted.'); },
      toast: s.toast
    };
  }
}

return Component;
});