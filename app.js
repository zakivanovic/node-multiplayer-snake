'use strict';
const path = require('path');
const GameController = require('./app/controllers/game-controller');
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const favicon = require('serve-favicon');
const lessMiddleware = require('less-middleware');
const bodyParser = require('body-parser');
const rateLimit = require("express-rate-limit");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(lessMiddleware(path.join(__dirname, 'public')));
// Expose all static resources in /public
app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(path.join(__dirname, 'public', 'favicon.png')));

/* Set request limits */
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 15 minutes
    max: 8000 // limit each IP to 100 requests per windowMs
  });
   
  //  apply to all requests
  app.use(limiter);

// Redirect to the main page
app.get('/', (request, response) => {
    response.sendFile('game.html', { root: path.join(__dirname, 'app/views') });
});

app.get('/player/:playerId', (request, response) => {
    const player = gameController.playerContainer.getPlayer(request.params.playerId);
    response.json(player);
});

app.post('/capture', (request, response) => {
    const playerId = request.body.id;
    try {
        response.json(gameController.capture(playerId, request.body.block));
    } catch(e) {
        response.status(400).json({error : e.message});
    }
});

// Create the main controller
const gameController = new GameController();
gameController.listen(io);

const SERVER_PORT = process.env.PORT || 3000;
app.set('port', SERVER_PORT);

// Start Express server
server.listen(app.get('port'), () => {
    console.log('Express server listening on port %d in %s mode', app.get('port'), app.get('env'));
});

module.exports = app;
