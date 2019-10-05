var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var game = game || require('./game.server.js');

console.log(game);

function new_player_id()
{
	var id = null;
	do
	{
		id = Math.floor(Math.random() * 4096);
	}
	while (game.server.players[id] != undefined);

	return id;
}

// socket io setup
io.on('connection', function(player) {
	var player_id = new_player_id();

	player.id = player_id;
	game.server.players[player_id] = player;

	game.server.player.connected(player);

	player.on('message', function (msg) {
		game.server.player.on_message(player, msg);
	});

	player.on('disconnect', function() {
		game.server.player.disconnected(player);
		delete game.server.players[player_id];
	});
});

// game mainloop
const dt = 1 / 30;
setInterval(function() {
	game.server.update(dt);
}, dt * 1000);

// express setup
app.use(express.static('static'));
http.listen(8080, function() { console.log('Running!'); });
