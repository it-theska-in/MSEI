// Runs on inspection-os.msei.in pages. Does nothing on its own: it only answers the
// popup, and fills the page only when the user clicks "Fill this chapter".
// It never clicks Save or Save & Continue.

(() => {
  const getState = () =>
    new Promise((res) => chrome.storage.local.get(["data", "settings"], (s) => res({ data: s.data, settings: s.settings || {} })));

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg?.type === "MSE_INFO") {
      reply({ info: MSEFill.pageInfo(document), rows: MSEFill.gridRows(document).length });
    } else if (msg?.type === "MSE_FILL") {
      getState().then(({ data, settings }) => {
        if (!data) return reply({ error: "No Excel loaded. Choose the Annexure II file first." });
        reply(MSEFill.fill(document, data, {
          overwrite: !!settings.overwrite,
          defaultRemarkNA: settings.defaultRemarkNA || "",
          defaultRemarkNC: settings.defaultRemarkNC || ""
        }));
      });
      return true; // reply is async
    }
  });
})();
