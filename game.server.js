const g = require('./static/js/g.js');

module.exports.server = {
	// map of all connected players
	players: {},
	// complete game state
	state: {},
	// handlers for all player connection events
	player: {
		connected: function(player)
		{
			player.position = [0, 0, 0];
            player.q = [0, 0, 0, 1];
            player.velocity = [0, 0, 0];
            player.forward = function() { game.player.q.quat_rotate_vector([0, 0, 1]); }
            player.up = function() { game.player.q.quat_rotate_vector([0, 1, 0]); }
            player.right = function() { game.player.q.quat_rotate_vector([1, 0, 0]); }

			console.log('player: ' + player.id + ' connected');
		},
		on_message: function(player, message)
		{
			console.log('player: ' + player.id + ' on_message');
		},
		update: function(player, dt)
		{
			player.position = player.position.add(player.velocity);

		},
		disconnected: function(player)
		{
			console.log('player: ' + player.id + ' disconnected');
		}
	},
	// main game loop
	update: function(dt)
	{

	}
};
