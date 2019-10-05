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
			player.state = {
				mesh: 'mesh/player-0',
				texture: 'tex/player-0',
				position: [0, 0, 0],
                q:        [0, 0, 0, 1],
                velocity: [0, 0, 0],
                thrust:   [0, 0, 0],
                roll: 0
            };

            player.forward = function() { return player.state.q.quat_rotate_vector([0, 0, 1]); }
            player.up = function() { return player.state.q.quat_rotate_vector([0, 1, 0]); }
            player.right = function() { return player.state.q.quat_rotate_vector([1, 0, 0]); }

			console.log('player: ' + player.id + ' connected');
		},
		on_message: function(player, message)
		{
			switch(message.topic)
			{
				case 'thrust':
					player.state.thrust = message.thrust;
					break;
				case 'ori':
					player.state.q = message.q;
					break;
				case 'roll':
					player.state.roll = message.roll;
					break;

			}
		},
		update: function(player, dt)
		{


		},
		disconnected: function(player)
		{
			console.log('player: ' + player.id + ' disconnected');
		}
	},
	// main game loop
	update: function(dt)
	{
		this.state.players = {};

		// update all player dynamics
		for (var player_key in this.players)
		{
			var player = this.players[player_key];

			player.state.q = player.state.q.quat_mul([].quat_rotation([0, 0, 1], player.state.roll * dt));

			// create a summed thrust vector
			const t = player.state.thrust;
			const r_acc = player.right().mul(t[0]);
			const u_acc = player.up().mul(t[1]);
			const f_acc = player.forward().mul(t[2]);
			const acc = r_acc.add(u_acc).add(f_acc);

			// accelerate player
			player.state.velocity = player.state.velocity.add(acc.mul(dt));

			player.state.velocity = player.state.velocity.mul(1 - dt);

			player.state.position = player.state.position.add(player.state.velocity);
			this.player.update(player, dt);

			this.state.players[player_key] = player.state;
		}

		// send states to all players
		for (var player_key in this.players)
		{
			var player = this.players[player_key];

			player.send({topic:'state', player_id: player_key, state: this.state});
		}
	}
};
