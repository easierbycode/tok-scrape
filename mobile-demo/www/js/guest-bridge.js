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

    // Lifepreneur logo mark — same trending-up icon + accent gradient as the
    // extension's Logo() in extension-creator-demo/lifepreneur.js
    // (#ed8740 ≈ color-mix(in oklab, #e8650a 78%, #fff), precomputed for old WebViews)
    var FAB_BG = 'linear-gradient(150deg, #ed8740, #e8650a)';
    var btn = document.createElement('div');
    btn.id = '__lifeFab';
    btn.innerHTML =
        '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M5 14.5 L10 9 L13.5 12.5 L19 6.5" stroke="#06130d" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M14.5 6.5 L19 6.5 L19 11" stroke="#06130d" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>';
    var style = {
        position: 'fixed',
        bottom: '80px',
        right: '20px',
        width: '64px',
        height: '64px',
        borderRadius: '32px',
        background: FAB_BG,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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
            btn.style.background = FAB_BG;
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
