import localtunnel from 'localtunnel';
(async () => {
  try {
    const tunnel = await localtunnel({ port: 8000 });
    console.log('TUNNEL_URL=' + tunnel.url);
    tunnel.on('close', () => {
      console.log('tunnel closed');
    });
  } catch (err) {
    console.error(err);
  }
})();
