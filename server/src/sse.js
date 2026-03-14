function createSseHub() {
  const clients = new Set();

  function addClient(req, res, initialPayload = {}) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    clients.add(res);

    res.write(`event: connected\ndata: ${JSON.stringify(initialPayload)}\n\n`);

    const keepAlive = setInterval(() => {
      res.write(": keepalive\n\n");
    }, 20000);

    req.on("close", () => {
      clearInterval(keepAlive);
      clients.delete(res);
    });
  }

  function broadcast(event, payload) {
    const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of clients) {
      client.write(message);
    }
  }

  return {
    addClient,
    broadcast,
    size: () => clients.size
  };
}

module.exports = {
  createSseHub
};
