// Serves binary MediaPipe assets from base64 text files, so hosts that only
// allow text/js/wasm files can run the model. Intercepts fetch and XHR by file name.
(function () {
  var NAMES = ['pose_landmark_lite.tflite', 'pose_solution_packed_assets.data', 'pose_web.binarypb'];
  var ASSETS = {};
  function base(u) { return String(u).split('?')[0].split('/').pop(); }
  function b64ToBytes(s) {
    var bin = atob(s.trim()), n = bin.length, out = new Uint8Array(n);
    for (var i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  var realFetch = window.fetch;
  window.fetch = function (input, init) {
    var u = typeof input === 'string' ? input : (input && input.url);
    var b = u && base(u);
    if (b && ASSETS[b]) return Promise.resolve(new Response(ASSETS[b].slice(0), { status: 200 }));
    return realFetch.apply(this, arguments);
  };

  var Real = window.XMLHttpRequest;
  function Fake() {
    var x = new Real(); var data = null;
    var origOpen = x.open, origSend = x.send;
    x.open = function (m, u) { var b = base(u); data = ASSETS[b] || null; return origOpen.apply(x, arguments); };
    x.send = function () {
      if (!data) return origSend.apply(x, arguments);
      setTimeout(function () {
        var buf = data.slice(0).buffer, rt = x.responseType;
        function def(k, v) { Object.defineProperty(x, k, { value: v, configurable: true }); }
        def('readyState', 4); def('status', 200); def('statusText', 'OK');
        def('response', rt === 'arraybuffer' ? buf : rt === 'blob' ? new Blob([buf]) : String.fromCharCode.apply(null, data));
        def('responseURL', '');
        ['readystatechange', 'load', 'loadend'].forEach(function (t) {
          var ev = new Event(t); if (typeof x['on' + t] === 'function') x['on' + t](ev); x.dispatchEvent(ev);
        });
      }, 0);
    };
    return x;
  }
  window.XMLHttpRequest = Fake;

  // Resolves when every asset is decoded into memory.
  window.loadMediaPipeAssets = function (dir) {
    return Promise.all(NAMES.map(function (n) {
      return realFetch.call(window, dir + n + '.b64.txt').then(function (r) {
        if (!r.ok) throw new Error('Missing ' + n);
        return r.text();
      }).then(function (t) { ASSETS[n] = b64ToBytes(t); });
    }));
  };
})();
