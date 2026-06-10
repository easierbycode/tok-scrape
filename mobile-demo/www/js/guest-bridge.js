(function() {
    if (window.__lifeBridgeLoaded) return;
    window.__lifeBridgeLoaded = true;

    // Create the floating LP button
    const btn = document.createElement('div');
    Object.assign(btn.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '56px',
        height: '56px',
        borderRadius: '28px',
        background: 'linear-gradient(150deg, #e8650a, #c65308)',
        color: 'white',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 'bold',
        fontSize: '18px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: '2147483647',
        cursor: 'pointer',
        userSelect: 'none',
        webkitUserSelect: 'none'
    });
    btn.textContent = 'LP';
    btn.onclick = function() {
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.cordova_iab) {
            window.webkit.messageHandlers.cordova_iab.postMessage(JSON.stringify({
                type: 'run-extension'
            }));
        }
    };
    document.body.appendChild(btn);

    // Polyfill chrome.runtime.sendMessage
    if (!window.chrome) window.chrome = {};
    if (!window.chrome.runtime) window.chrome.runtime = {};
    window.chrome.runtime.sendMessage = function(message, callback) {
        const messageId = Math.random().toString(36).substring(7);
        if (callback) {
            if (!window.__lifeCallbacks) window.__lifeCallbacks = {};
            window.__lifeCallbacks[messageId] = callback;
        }

        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.cordova_iab) {
            window.webkit.messageHandlers.cordova_iab.postMessage(JSON.stringify({
                id: messageId,
                payload: message
            }));
        }
    };

    // Global handler for responses from host
    window.__lifeOnResponse = function(messageId, response) {
        if (window.__lifeCallbacks && window.__lifeCallbacks[messageId]) {
            window.__lifeCallbacks[messageId](response);
            delete window.__lifeCallbacks[messageId];
        }
    };
})();
