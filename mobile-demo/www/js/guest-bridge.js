(function() {
    if (window.__lifeBridgeLoaded) return;
    window.__lifeBridgeLoaded = true;

    function post(msg) {
        const s = JSON.stringify(msg);
        // iOS/Browser
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.cordova_iab) {
            window.webkit.messageHandlers.cordova_iab.postMessage(s);
        }
        // Android
        else if (window.cordova_iab && window.cordova_iab.postMessage) {
            window.cordova_iab.postMessage(s);
        }
    }

    function ensureButton() {
        if (document.getElementById('life-mobile-btn')) return;

        const btn = document.createElement('div');
        btn.id = 'life-mobile-btn';
        Object.assign(btn.style, {
            position: 'fixed',
            bottom: '30px',
            right: '20px',
            width: '64px',
            height: '64px',
            borderRadius: '32px',
            background: 'linear-gradient(150deg, #e8650a, #c65308)',
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
        });
        btn.textContent = 'LP';
        btn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            post({ type: 'run-extension' });
        };
        (document.body || document.documentElement).appendChild(btn);
    }

    // Polling ensures button survives single-page-app route changes that clear the body
    setInterval(ensureButton, 1000);
    ensureButton();

    // Polyfill chrome.runtime.sendMessage
    if (!window.chrome) window.chrome = {};
    if (!window.chrome.runtime) window.chrome.runtime = {};
    window.chrome.runtime.sendMessage = function(message, callback) {
        const id = Math.random().toString(36).substring(7);
        if (callback) {
            if (!window.__lifeCallbacks) window.__lifeCallbacks = {};
            window.__lifeCallbacks[id] = callback;
        }
        post({ id, payload: message });
    };

    window.__lifeOnResponse = function(id, response) {
        if (window.__lifeCallbacks && window.__lifeCallbacks[id]) {
            window.__lifeCallbacks[id](response);
            delete window.__lifeCallbacks[id];
        }
    };
})();
