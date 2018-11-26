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

const Coordinate = require('./app/models/coordinate');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(lessMiddleware(path.join(__dirname, 'public')));
// Expose all static resources in /public
app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(path.join(__dirname, 'public', 'favicon.png')));

// Redirect to the main page
app.get('/', (request, response) => {
    response.sendFile('game.html', { root: path.join(__dirname, 'app/views') });
});

app.get('/player/:playerId', (request, response) => {
    const player = gameController.playerContainer.getPlayer(request.params.playerId);
    response.json(player);
});

app.post('/capture', (request, response) => {
    const blockCoords = request.body.block.split(':');
    const playerId = request.body.id;

    const player = gameController.playerContainer.getPlayer(playerId);

    if (isPossible(player._segments, blockCoords)) {
        player._segments.push(new Coordinate(blockCoords[0], blockCoords[1]));
        response.json({ message: 'Block captured' });
    } else {
        response.json({ message: 'Invalid Block' });
    }
});

function isPossible(segments, blockCoords) {
    const x = blockCoords[0];
    const y = blockCoords[1];
    if(x == 0 || x == 50 || y == 0|| y == 50) {
        return false
    }
    for(let i =0; i < segments.length; ++i) {
        const seg = segments[i];
        if(x == seg.x && y == seg.y) {
            return false
        }
    }
    for(let i =0; i < segments.length; ++i) {
        const seg = segments[i];
        if(
            (x + 1 == seg.x && y == seg.y) ||
            (x - 1 == seg.x && y == seg.y) ||
            (y + 1 == seg.y && x == seg.x) ||
            (y - 1 == seg.y && x == seg.x)
        ) {
            return true;
        }
    }
    return false;
}

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
