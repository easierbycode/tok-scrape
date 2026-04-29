let _configParam = {"init_load": false};

window.getAccountInfoPromise = fetch(
  '/api/v1/streamer_desktop/account_info/get?version=1',
  {
    credentials: 'include',
  },
).then((res) => {
  return res.json();
});

window.getConfigPromise = fetch('/api/v1/streamer_desktop/home/info', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json', // 设置内容类型为JSON
  },
  body: JSON.stringify(_configParam),
  credentials: 'include',
}).then((res) => {
  return res.json();
});
