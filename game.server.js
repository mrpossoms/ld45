const g = require("./static/js/g.js");

const k = {
	moon: {
		mass: 1
	}
};

function tangent(position, body_position)
{
	const r = body_position.sub(position);
	return r.cross([0, 1, 0]).norm();
}

function gravitational_force(position, body_position, body_mass)
{
	const m = body_mass;
	const r = body_position.sub(position);
	const r_2 = r.dot(r);
	return r.norm().mul(m / r_2);
}


function asteroid_dynamics(asteroids, dt)
{
	for (var i = 0; i < asteroids.length; i++)
	{
		var a = asteroids[i];
		var previousPosition = a.position;
		var velocity;

		if (!a.captured)
		{
			var force = gravitational_force(a.position, [0, 0, 0], k.moon.mass);
			const do_n_body = false;
			for (var j = 0; do_n_body && j < asteroids.length; j++)
			{
				if (j == i) { continue; }
				const b = asteroids[j];
				const grav = gravitational_force(a.position, b.position, b.mass);

				force = force.add();
			}

			a.velocity = a.velocity.add(force);
			a.position = a.position.add(a.velocity);
		}
		else
		{
			// For captured as
			var player = a.player;
			a.position = player.state.position.add(player.forward());
			velocity = player.state.velocity;
		}
		// TODO: Add ray code with previous position and velocity and asteroid player to check if they scored
	}
}

module.exports.server = {
  // map of all connected players
  players: {},
  // complete game state
  state: {
    asteroids: []
  },
  // handlers for all player connection events
  player: {
    connected: function(player) {
      player.state = {
        mesh: "mesh/player-0",
        texture: "tex/player-0",
        position: [
          Math.random() * 101 - 50,
          Math.random() * 10 - 5,
          Math.random() * 101 - 50
        ],
        q: [0, 0, 0, 1],
        velocity: [0, 0, 0],
        thrust: [0, 0, 0],
        roll: 0
      };

      player.forward = function() {
        return player.state.q.quat_rotate_vector([0, 0, 1]);
      };
      player.up = function() {
        return player.state.q.quat_rotate_vector([0, 1, 0]);
      };
      player.right = function() {
        return player.state.q.quat_rotate_vector([1, 0, 0]);
      };

      console.log("player: " + player.id + " connected");
    },
    on_message: function(player, message) {
      switch (message.topic) {
        case "thrust":
          player.state.thrust = message.thrust;
          break;
        case "ori":
          player.state.q = message.q;
          break;
        case "roll":
          player.state.roll = message.roll;
          break;
        case "action":
          player.state.action = true;
          break;
      }
    },
    update: function(player, dt) {},
    disconnected: function(player) {
      console.log("player: " + player.id + " disconnected");
    }
  },
  // main game loop
  update: function(dt) {
    this.state.players = {};

    // update all player dynamics
    for (var player_key in this.players) {
      var player = this.players[player_key];

      player.state.q = player.state.q.quat_mul(
        [].quat_rotation([0, 0, 1], player.state.roll * dt)
      );

      // create a summed thrust vector
      const t = player.state.thrust;
      const r_acc = player.right().mul(t[0]);
      const u_acc = player.up().mul(t[1]);
      const f_acc = player.forward().mul(t[2]);
      const acc = r_acc.add(u_acc).add(f_acc);

      // accelerate player
      player.state.velocity = player.state.velocity.add(acc.mul(dt));

      // apply drag to the player
      player.state.velocity = player.state.velocity.mul(1 - dt);

      player.state.position = player.state.position.add(player.state.velocity);
      this.player.update(player, dt);

      // update state of asteroid if captured by player
      if (player.state.action !== undefined) {
        if (player.state.asteroidId !== undefined) {
          // throw asteroid
          this.state.asteroids[player.state.asteroidId].captured = false;
          this.state.asteroids[
            player.state.asteroidId
          ].velocity = player.velocity.add(player.forward().mul(0.33));
          delete player.state.asteroidId;
        } else {
          // grab asteroid
          for (var i = 0; this.state.asteroids; i++) {
            if (
              player.state.position
                .add(player.forward())
                .sub(this.state.asteroids[i].position)
                .len() <= 1 &&
              !this.state.asteroids[i].captured
            ) {
              player.state.asteroidId = i;
              this.state.asteroids[i].captured = true;
              this.state.asteroids[i].player = player;
            }
          }
        }
      }
      delete player.action;

      this.state.players[player_key] = player.state;
    }

    // update position of asteroids and if they would go through the gate
    asteroid_dynamics(this.state.asteroids, dt);

    // send states to all players
    for (var player_key in this.players) {
      var player = this.players[player_key];

      player.send({ topic: "state", player_id: player_key, state: this.state });
    }
  },
  //initial state
  setup: function(asteroidCount) {
    this.state.gate = { position: [0, 0, 0] };
    for (var i = 0; i < asteroidCount; i++) {
      const r = Math.random() * 50 + 50;
      const t = Math.random() * Math.PI * 2;
      const p = [ Math.cos(t) * r, Math.random() * 10 - 5, Math.sin(t) * r ];
      const v = tangent(p, [0, 0, 0]).mul(Math.sqrt(k.moon.mass / r));
      var asteroid = {
        level: 0,
        mass: 0.25 + Math.random(),
        position: p,
        velocity: v
      };
      this.state.asteroids.push(asteroid);
    }
  }
};
