const g = require("./static/js/g.js");

const k = {
	moon: {
		mass: 1,
    radius: 30
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

function debris_cleanup(debris)
{
  var list = [];

  for (var i = 0; i < debris.length; i++)
  {
    var a = debris[i];
    if (a.position.len() > k.moon.radius)
    {
      list.push(a);
    }
  }

  return list;
}

function ship_cleanup(ships)
{
  var list = [];

  for (var i = 0; i < ships.length; i++)
  {
    var a = ships[i];
    const dist = a.position.len();
    if (dist > k.moon.radius && dist < 1000);
    {
      list.push(a);
    }
  }

  return list;
}

function debris_dynamics(debris, dt)
{
	for (var i = 0; i < debris.length; i++)
	{
		var a = debris[i];
		var previousPosition = a.position;
		var velocity;

		if (!a.captured)
		{
			var force = gravitational_force(a.position, [0, 0, 0], k.moon.mass);
			const do_n_body = false;

      // n-body calculation
			for (var j = 0; do_n_body && j < debris.length; j++)
			{
				if (j == i) { continue; }
				const b = debris[j];
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
		// TODO: Add ray code with previous position and velocity and debris player to check if they scored
	}
}

function spawn_debris(position)
{
  const r = position.len();
  const v = tangent(position, [0, 0, 0]).mul(Math.sqrt(k.moon.mass / r));

  return {
    level: Math.floor(Math.random() * 10),
    mass: 0.25 + Math.random(),
    position: position,
    velocity: v
  };
}

function spawn_ship(position, velocity)
{
  return {
    level: Math.floor(Math.random() * 10),
    position: position,
    velocity: velocity
  };
}

module.exports.server = {
  // map of all connected players
  players: {},
  // complete game state
  state: {
    debris: [],
    ships: [],
  },
  // handlers for all player connection events
  player: {
    connected: function(player) {
      const r = Math.random() + 50;
      const t = Math.random() * Math.PI * 2;
      const p = [ Math.cos(t) * r, Math.random() * 10 - 5, Math.sin(t) * r ];
      const v = tangent(p, [0, 0, 0]).mul(Math.sqrt(k.moon.mass / r));
      player.state = {
        position: p,
        q: [0, 0, 0, 1],
        velocity: v,
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
      const acc = r_acc.add(u_acc).add(f_acc).mul(0.1);

      // player debris collision
      for (var i = 0; i < this.state.debris.length; i++)
      {
        var d = this.state.debris[i];
        const r = d.mass;

        if (player.state.position.sub(d.position).len() < r)
        {
          const tmp = player.state.velocity;
          player.state.velocity = d.velocity;
          d.velocity = tmp;
        }
      }

      // accelerate player
      grav = gravitational_force(player.state.position, [0, 0, 0], k.moon.mass);
      player.state.velocity = player.state.velocity.add(acc.mul(dt)).add(grav);

      // apply drag to the player
      // player.state.velocity = player.state.velocity.mul(1 - dt);

      player.state.position = player.state.position.add(player.state.velocity);
      this.player.update(player, dt);

      // update state of debris if captured by player
      if (player.state.action !== undefined) {
        if (player.state.debrisId !== undefined) {
          // throw debris
          this.state.debris[player.state.debrisId].captured = false;
          this.state.debris[
            player.state.debrisId
          ].velocity = player.velocity.add(player.forward().mul(0.33));
          delete player.state.debrisId;
        } else {
          // grab debris
          for (var i = 0; this.state.debris; i++) {
            if (
              player.state.position
                .add(player.forward())
                .sub(this.state.debris[i].position)
                .len() <= 1 &&
              !this.state.debris[i].captured
            ) {
              player.state.debrisId = i;
              this.state.debris[i].captured = true;
              this.state.debris[i].player = player;
            }
          }
        }
      }
      delete player.action;

      this.state.players[player_key] = player.state;
    }

    // remove debris that have fallen into the moon
    this.state.debris = debris_cleanup(this.state.debris);

    // update position of debris and if they would go through the gate
    debris_dynamics(this.state.debris, dt);

    // send states to all players
    for (var player_key in this.players) {
      var player = this.players[player_key];

      player.send({ topic: "state", player_id: player_key, state: this.state });
    }
  },
  //initial state
  setup: function(debrisCount) {
    this.state.gate = { position: [0, 0, 0] };
    for (var i = 0; i < debrisCount; i++) {
      const r = Math.random() * 50 + 50;
      const t = Math.random() * Math.PI * 2;
      const p = [ Math.cos(t) * r, Math.random() * 10 - 5, Math.sin(t) * r ];
      this.state.debris.push(spawn_debris(p));
    }
  }
};
