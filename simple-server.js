#!/usr/bin/env node
// Ultra-simple HTTP server that starts immediately
const http = require('http');
const PORT = process.env.PORT || 8080;

console.log('=== SIMPLE SERVER STARTING ===');
console.log('PORT:', PORT);
console.log('Time:', new Date().toISOString());

const server = http.createServer((req, res) => {
  console.log('Request:', req.method, req.url);
  
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      message: 'Simple server is running',
      port: PORT,
      time: new Date().toISOString()
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Nexus Chat - Simple Server Running\nCheck /api/health');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('=== SERVER LISTENING ===');
  console.log('Address: 0.0.0.0:' + PORT);
  console.log('Health: http://0.0.0.0:' + PORT + '/api/health');
  console.log('========================');
});

server.on('error', (err) => {
  console.error('SERVER ERROR:', err);
  process.exit(1);
});