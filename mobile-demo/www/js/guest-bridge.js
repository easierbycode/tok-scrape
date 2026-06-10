(function() {
    if (window.__lpBridgeLoaded) return;
    window.__lpBridgeLoaded = true;
    console.log('[LP-guest] bridge active');

    function post(msg) {
        var s = JSON.stringify(msg);
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.cordova_iab) {
            window.webkit.messageHandlers.cordova_iab.postMessage(s);
        } else if (window.cordova_iab && window.cordova_iab.postMessage) {
            window.cordova_iab.postMessage(s);
        }
    }

    var btn = document.createElement('button');
    btn.id = '__lifeFab';
    btn.textContent = 'LP';
    var style = {
        position: 'fixed',
        bottom: '100px',
        right: '20px',
        width: '72px',
        height: '72px',
        borderRadius: '36px',
        background: '#e8650a',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: '900',
        fontSize: '22px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        zIndex: '2147483647',
        cursor: 'pointer',
        border: '3px solid #ffffff',
        outline: 'none',
        userSelect: 'none',
        webkitUserSelect: 'none',
        visibility: 'visible',
        opacity: '1',
        pointerEvents: 'auto'
    };
    for (var k in style) btn.style[k] = style[k];

    btn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[LP-guest] LP button clicked');
        post({ type: 'run-extension' });
    };

    function ensureButton() {
        if (document.getElementById('__lifeFab')) return;
        var target = document.body || document.documentElement;
        if (target) {
            target.appendChild(btn);
            console.log('[LP-guest] button injected');
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
