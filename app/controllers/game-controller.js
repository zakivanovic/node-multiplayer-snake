'use strict';

const ServerConfig = require('../configs/server-config');

const AdminService = require('../services/admin-service');
const BoardOccupancyService = require('../services/board-occupancy-service');
const BotDirectionService = require('../services/bot-direction-service');
const FoodService = require('../services/food-service');
const GameControlsService = require('../services/game-controls-service');
const ImageService = require('../services/image-service');
const NameService = require('../services/name-service');
const NotificationService = require('../services/notification-service');
const PlayerService = require('../services/player-service');

const Coordinate = require('../models/coordinate');
const PlayerContainer = require('../models/player-container');
const PlayerStatBoard = require('../models/player-stat-board');

class GameController {

    constructor() {
        // Model Containers
        this.playerContainer = new PlayerContainer();
        this.playerStatBoard = new PlayerStatBoard();

        // Services
        this.nameService = new NameService();
        this.boardOccupancyService = new BoardOccupancyService();
        this.notificationService = new NotificationService();
        this.botDirectionService = new BotDirectionService(this.boardOccupancyService);
        this.foodService = new FoodService(this.playerStatBoard, this.boardOccupancyService,
            this.nameService, this.notificationService);
        this.imageService = new ImageService(this.playerContainer, this.playerStatBoard, this.notificationService);
        this.playerService = new PlayerService(this.playerContainer, this.playerStatBoard, this.boardOccupancyService,
            this.imageService, this.nameService, this.notificationService, this.runGameCycle.bind(this));
        this.adminService = new AdminService(this.playerContainer, this.foodService, this.nameService,
            this.notificationService, this.playerService);
        this.playerService.init(this.adminService.getPlayerStartLength.bind(this.adminService));

        this.board = [];
        for(var i=0; i<50; i++) {
            this.board[i] = new Array(50);
        }
    }

    // Listen for Socket IO events
    listen(io) {
        this.notificationService.setSockets(io.sockets);
        const self = this;
        io.sockets.on(ServerConfig.IO.DEFAULT_CONNECTION, socket => {
            //socket.on(ServerConfig.IO.INCOMING.CANVAS_CLICKED, self._canvasClicked.bind(self, socket));
            //socket.on(ServerConfig.IO.INCOMING.KEY_DOWN, self._keyDown.bind(self, socket.id));

            // Player Service
            socket.on(ServerConfig.IO.INCOMING.NEW_PLAYER,
                self.playerService.addPlayer.bind(self.playerService, socket));
            socket.on(ServerConfig.IO.INCOMING.NAME_CHANGE,
                self.playerService.changePlayerName.bind(self.playerService, socket));
            socket.on(ServerConfig.IO.INCOMING.COLOR_CHANGE,
                self.playerService.changeColor.bind(self.playerService, socket));
            socket.on(ServerConfig.IO.INCOMING.JOIN_GAME,
                self.playerService.playerJoinGame.bind(self.playerService, socket.id));
            socket.on(ServerConfig.IO.INCOMING.SPECTATE_GAME,
                self.playerService.playerSpectateGame.bind(self.playerService, socket.id));
            socket.on(ServerConfig.IO.INCOMING.DISCONNECT,
                self.playerService.disconnectPlayer.bind(self.playerService, socket.id));
            socket.on(ServerConfig.IO.INCOMING.DISCONNECT,
                    self.removePlayer.bind(self, socket.id));
            // Image Service
            socket.on(ServerConfig.IO.INCOMING.CLEAR_UPLOADED_BACKGROUND_IMAGE,
                self.imageService.clearBackgroundImage.bind(self.imageService, socket.id));
            socket.on(ServerConfig.IO.INCOMING.BACKGROUND_IMAGE_UPLOAD,
                self.imageService.updateBackgroundImage.bind(self.imageService, socket.id));
            socket.on(ServerConfig.IO.INCOMING.CLEAR_UPLOADED_IMAGE,
                self.imageService.clearPlayerImage.bind(self.imageService, socket.id));
            socket.on(ServerConfig.IO.INCOMING.IMAGE_UPLOAD,
                self.imageService.updatePlayerImage.bind(self.imageService, socket.id));
            // Admin Service
            socket.on(ServerConfig.IO.INCOMING.BOT_CHANGE,
                self.adminService.changeBots.bind(self.adminService, socket.id));
            socket.on(ServerConfig.IO.INCOMING.FOOD_CHANGE,
                self.adminService.changeFood.bind(self.adminService, socket.id));
            socket.on(ServerConfig.IO.INCOMING.SPEED_CHANGE,
                self.adminService.changeSpeed.bind(self.adminService, socket.id));
            socket.on(ServerConfig.IO.INCOMING.START_LENGTH_CHANGE,
                self.adminService.changeStartLength.bind(self.adminService, socket.id));
        });
    }

    runGameCycle() {
        // Pause and reset the game if there aren't any players
        if (this.playerContainer.getNumberOfPlayers() - this.adminService.getBotIds().length === 0) {
            console.log('Game Paused');
            //this.boardOccupancyService.initializeBoard();
            this.adminService.resetGame();
            this.nameService.reinitialize();
            this.imageService.resetBackgroundImage();
            //this.foodService.reinitialize();
            this.playerContainer.reinitialize();
            this.playerStatBoard.reinitialize();
            return;
        }

        //this.playerService.movePlayers();
        //this.playerService.handlePlayerCollisions();
        this.playerService.respawnPlayers();

        this.foodService.consumeAndRespawnFood(this.playerContainer);

        const gameState = {
            players: this.playerContainer,
            food: this.foodService.getFood(),
            playerStats: this.playerStatBoard,
            walls: this.boardOccupancyService.getWallCoordinates(),
            speed: this.adminService.getGameSpeed(),
            numberOfBots: this.adminService.getBotIds().length,
            startLength: this.adminService.getPlayerStartLength(),
        };
        this.notificationService.broadcastGameState(gameState);

        setTimeout(this.runGameCycle.bind(this), 1000 / this.adminService.getGameSpeed());
    }

    removePlayer(playerId) {
        for(let i = 0; i < this.board.length; ++i) {
            for(let j = 0; j < this.board[i].length; ++j) {
                if (this.board[i][j] == playerId) {
                    this.board[i][j] = null;
                }
            }
        }
    }

    /**
     * capture block
     * @param {*} playerId 
     * @param {*} blockCoords 
     */
    capture(playerId, blockCoords) {
        const player = this.playerContainer.getPlayer(playerId);

        if(!player) throw Error('Invalid player ID');

        if (this.isPossible(player._segments, blockCoords)) {
            if (this.board[blockCoords.x][blockCoords.y]) {
                return { message: 'Block already captured by enemy' };
            }
            this.board[blockCoords.x][blockCoords.y] = playerId;
            player._segments.push(new Coordinate(blockCoords.x, blockCoords.y));
            this.playerStatBoard.resetScore(playerId);
            this.playerStatBoard.increaseScore(playerId, player._segments.length);
            return { message: 'Block captured' };
        } else {
            return { message: 'Invalid Block' };
        }
    }

    updateOtherPlayer(otherPlayerId, coords) {
        const otherPlayer = this.playerContainer.getPlayer(otherPlayerId);
        for(var j=0; j < otherPlayer.segments.length; ++j) {
            const coord = otherPlayer.segments[j];
            if(coord.x == coords[0] && coord.y == coords[1]) {
                otherPlayer.segments.splice(j,1);
                return;
            }
        }
    }

    isPossible(segments, blockCoords) {
        const x = parseInt(blockCoords.x);
        const y = parseInt(blockCoords.y);
        if(x == 0 || x == 50 || y == 0|| y == 50) {
            return false;
        }
        for(let i =0; i < segments.length; ++i) {
            const seg = segments[i];
            if(x == seg.x && y == seg.y) {
                return false;
            }
        }
        for(let i = 0; i < segments.length; ++i) {
            const seg = segments[i];
            if(
                ((x + 1) == seg.x && y == seg.y) ||
                ((x - 1) == seg.x && y == seg.y) ||
                ((y + 1) == seg.y && x == seg.x) ||
                ((y - 1) == seg.y && x == seg.x)
            ) {
                return true;
            }
        }
        return false;
    }

    /*******************************
     *  socket.io handling methods *
     *******************************/

    _canvasClicked(socket, x, y) {
        const player = this.playerContainer.getPlayer(socket.id);
        const coordinate = new Coordinate(x, y);
        if (this.boardOccupancyService.isPermanentWall(coordinate)) {
            return;
        }
        if (this.boardOccupancyService.isWall(coordinate)) {
            this.boardOccupancyService.removeWall(coordinate);
            this.notificationService.broadcastNotification(`${player.name} has removed a wall`, player.color);
        } else {
            this.boardOccupancyService.addWall(coordinate);
            this.notificationService.broadcastNotification(`${player.name} has added a wall`, player.color);
        }
    }

    _keyDown(playerId, keyCode) {
        GameControlsService.handleKeyDown(this.playerContainer.getPlayer(playerId), keyCode);
    }
}

module.exports = GameController;
