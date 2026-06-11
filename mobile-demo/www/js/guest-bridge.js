(function() {
    if (window.__lpBridgeLoaded) return;
    window.__lpBridgeLoaded = true;
    console.log('[LP-guest] bridge init');

    function post(msg) {
        var s = JSON.stringify(msg);
        console.log('[LP-guest] posting: ' + (s.length > 300 ? s.slice(0, 300) + '… (' + s.length + ' chars)' : s));
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.cordova_iab) {
            window.webkit.messageHandlers.cordova_iab.postMessage(s);
        } else if (window.cordova_iab && window.cordova_iab.postMessage) {
            window.cordova_iab.postMessage(s);
        }
    }

    var btn = document.createElement('div');
    btn.id = '__lifeFab';
    btn.textContent = 'LP';
    var style = {
        position: 'fixed',
        bottom: '80px',
        right: '20px',
        width: '64px',
        height: '64px',
        borderRadius: '32px',
        background: '#e8650a',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: '900',
        fontSize: '20px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        zIndex: '2147483647',
        cursor: 'pointer',
        userSelect: 'none',
        webkitUserSelect: 'none',
        visibility: 'visible',
        opacity: '1',
        border: '3px solid #ffffff',
        transition: 'transform 0.1s active'
    };
    for (var k in style) btn.style[k] = style[k];

    btn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[LP-guest] LP clicked');

        // Visual feedback
        btn.style.transform = 'scale(0.9)';
        btn.style.background = '#c65308';
        setTimeout(function() {
            btn.style.transform = 'scale(1)';
            btn.style.background = '#e8650a';
        }, 200);

        post({ type: 'run-extension', url: window.location.href });
    };

    function ensureButton() {
        if (document.getElementById('__lifeFab')) return;
        var target = document.body || document.documentElement;
        if (target) {
            target.appendChild(btn);
            console.log('[LP-guest] button added');
        }
    }

    setInterval(ensureButton, 1000);
    ensureButton();

    if (!window.chrome) window.chrome = {};
    if (!window.chrome.runtime) window.chrome.runtime = {};
    window.chrome.runtime.sendMessage = function(message, callback) {
        var id = Math.random().toString(36).substring(7);
        if (callback) {
            if (!window.__lifeCallbacks) window.__lifeCallbacks = {};
            window.__lifeCallbacks[id] = callback;
        }
        post({ id: id, payload: message });
    };

    window.__lifeOnResponse = function(id, response) {
        if (window.__lifeCallbacks && window.__lifeCallbacks[id]) {
            window.__lifeCallbacks[id](response);
            delete window.__lifeCallbacks[id];
        }
    };
})();
