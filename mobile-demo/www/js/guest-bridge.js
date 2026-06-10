(function() {
    if (window.__lifeBridgeLoaded) return;
    window.__lifeBridgeLoaded = true;
    console.log('[LP-guest] bridge init');

    function post(msg) {
        var s = JSON.stringify(msg);
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
        bottom: '30px',
        right: '20px',
        width: '64px',
        height: '64px',
        borderRadius: '32px',
        background: '#e8650a',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: '800',
        fontSize: '20px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        zIndex: '2147483647',
        cursor: 'pointer',
        userSelect: 'none',
        webkitUserSelect: 'none',
        visibility: 'visible',
        opacity: '1'
    };
    for (var k in style) btn.style[k] = style[k];

    btn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[LP-guest] LP clicked');
        post({ type: 'run-extension' });
    };

    function ensureButton() {
        if (document.getElementById('__lifeFab')) return;
        var target = document.body || document.documentElement;
        if (target) {
            target.appendChild(btn);
            console.log('[LP-guest] button added');
        }
    }

    // Polling ensures button survives SPA route changes
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
