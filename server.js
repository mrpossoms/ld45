var path = require('path');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
const g = require("./static/js/g.js");
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

// game.server.setup(50);

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

	// g.for_each(game.server.players, function(player)
	// {
	// 	console.log("update")
	// 	game.server.player.update(player, dt);
	// });

	for (var player_id in game.server.players)
	{
		// console.log('update');
		game.server.player.update(game.server.players[player_id], dt);
	}
}, dt * 1000);

/*
app.get('/', function(res, req)
{
	res.sendFile('static/index.html');
});
*/

// express setup
app.use(express.static(path.join(__dirname, 'static')));
//app.use(express.static('static'));
http.listen(3001, function() { console.log('Running!'); });
