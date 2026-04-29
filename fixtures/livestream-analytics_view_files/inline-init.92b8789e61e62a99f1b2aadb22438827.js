window.SC_DISABLE_SPEEDY = true;

// pwa
// Check that service workers are supported
if ('serviceWorker' in navigator) {
  // Use the window load event to keep the page load performant
  window.addEventListener('load', function () {
    var shouldAddServiceWorker = true;
    fetch(
      '/api/v1/streamer_desktop/settings/get?aid=253642&app_name=i18n_ecom_alliance'
    )
      .then(function (res) {
        return res.json();
      })
      .then(function (res) {
        if (
          res &&
          res.data &&
          res.data.pwa_degrade &&
          res.data.pwa_degrade.streamer === true
        ) {
          shouldAddServiceWorker = false;
          if (navigator.serviceWorker.getRegistrations) {
            navigator.serviceWorker.getRegistrations().then(function (sws) {
              sws.forEach(function (sw) {
                sw.unregister();
              });
            });
          }
        }
      })
      .finally(function () {
        if (shouldAddServiceWorker) {
          navigator.serviceWorker
            .register('/streamer/sw.js')
            .then(function (reg) {
              if (window.slardarWeb) {
                window.slardarWeb('sendEvent', {
                  name: 'pwa_sw_register_success',
                  metrics: { count: 1 },
                });
              }

              console.info('sw register successfully', reg);
            })
            .catch(function (e) {
              if (window.slardarWeb) {
                window.slardarWeb('captureException', e);
              }
            });
        }
      });
  });
}
