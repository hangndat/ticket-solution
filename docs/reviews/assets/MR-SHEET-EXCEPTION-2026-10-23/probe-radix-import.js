import("https://esm.sh/@radix-ui/react-dialog@1.1.4")
  .then(function (m) {
    return JSON.stringify({
      keys: Object.keys(m).slice(0, 12),
      Root: !!m.Root,
      Content: !!m.Content,
      Portal: !!m.Portal,
    });
  })
  .catch(function (e) {
    return JSON.stringify({ err: String(e) });
  });
