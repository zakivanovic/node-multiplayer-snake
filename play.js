// create http request client to consume the QPX API
const request = require('request');

const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
  });
} else {
  function start() {
  // QPX REST API URL (I censored my api key)
  const url = 'http://localhost:3000/capture';

  let cpt = 0;

  let pos = {
    x:0, 
    y:0
  };

  let segments = [];

  const crd = ['x', 'y'];
  const step = [-1, 1];

  let socket = require('socket.io-client')('http://localhost:3000');

  socket.on('connect', () => {
    socket.emit('new player', `Toto${process.pid}`, '');
  });

  socket.on('new player info', (data) => {
    console.log('Received: ' + data + ' socketID : ' + socket.id);
    //socket.disconnect(); // kill client after server's response
  });

  socket.on('game update', (data) => {
    //if (!segments.length) {
      for(let i = 0; i < data.players.length; ++i) {
        const pl = data.players[i];
        if(pl.id === socket.id) {
          segments = JSON.parse(JSON.stringify(pl.segments));
        }
      }
    //}
    //socket.disconnect(); // kill client after server's response
  });

  socket.on('close', () => {
    console.log('Connection closed');
  });

  // fire request
  function capture() {

    if(!segments) return;

    for(let i = (segments.length - 1); i >= 0; --i) {

      if((segments.length - i) > 10) {
        return;
      }

      const c = crd[Math.round(Math.random())];
      const s = step[Math.round(Math.random())];
      segments[i][c] = parseInt(segments[i][c]) + s;

      const reqBody = {
          id: socket.id,
          block: {
            x : segments[i].x,
            y : segments[i].y
          }
      };

      console.log(`Toto${process.pid}`, reqBody.block);
      sendRequest(reqBody);

    }
  }

  function sendRequest(reqBody) {
    request(
      {
          uri : url,
          method: 'POST',
          json: reqBody,
      },
      function(error, response, body) {
        if (!error && response.statusCode === 200) {
          console.log(`Toto${process.pid}`, JSON.stringify(body));
          segments.push(reqBody.block);
        } else {
          console.log('error: ' + error);
          console.log('response: ' + JSON.stringify(response));
        }
      }
    );
  }

  let inter = setInterval(capture, 200);

  setTimeout(() => { clearInterval(inter); }, 300000);
  }

  start();
}