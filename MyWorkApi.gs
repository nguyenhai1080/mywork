/** PR03 - Client-facing My Work API. */
function apiGetMyWork(options) {
  return getMyWork_(options || {});
}

function apiMyWorkHealth() {
  const data = getMyWork_({});
  return {
    success: true,
    version: data.version,
    today: data.today,
    activeTasks: data.summary.totalActive
  };
}
