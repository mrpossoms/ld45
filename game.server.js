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

function debris_cleanup(debris, players)
{
  var list = [];

  for (var i = 0; i < debris.length; i++)
  {
    var a = debris[i];
    if (a.position.len() > k.moon.radius)
    {
      list.push(a);
    }
    else
    {
      if (a.deorbiter)
      {
        players[a.deorbiter].deorbited_debris++;
      }
    }
  }

  return list;
}

function ship_cleanup(state)
{
  var list = [];

  for (var i = 0; i < state.ships.length; i++)
  {
    var a = state.ships[i];
    const dist = a.position.len();
    if (dist >= k.moon.radius/2 && dist <= 1000)
    {
      list.push(a);
    }
    else
    {
      state.ships_saved++;
    }
  }

  return list;
}

function spawn_convoy(ships)
{
  var size = 2 + Math.floor(Math.random() * 10);
  const is_arriving = Math.random() > 0.5;

  var velocity = [0, 0, 0];
  var origin = [0, 0, 0];

  if (is_arriving)
  {
    velocity = [1, 0, 0];
    origin = [-1000, 0, 0];
  }
  else
  {
    velocity = [-1, 0, 0];
    origin = [-k.moon.radius/2, 0, 0];
  }

  for(;size--;)
  {
    const rf = function() { return 2 * (Math.random() - 0.5); }
    ships.push(spawn_ship(origin.add(velocity.mul(size * 3)).add([0, rf(), rf()]), velocity));
  }
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

function ship_dynamics(ships, dt)
{
  for (var i = 0; i < ships.length; i++)
  {
    var a = ships[i];
    const v = a.velocity.mul(-a.position[0] / 20);
    a.position = a.position.add(v.mul(dt));
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
    velocity: velocity,
    q: [].quat_rotation([0,1,0], Math.PI * velocity[0] - Math.PI/2)
  };
}

module.exports.server = {
  // map of all connected players
  players: {},
  // complete game state
  state: {
    debris: [],
    ships: [],
    ships_saved: 0,
    convoy_time: 30
  },
  // handlers for all player connection events
  player: {
    connected: function(player) {
      const r = 50;
      const p = [ -50, 0, 0 ];
      const v = tangent(p, [0, 0, 0]).mul(Math.sqrt(k.moon.mass / r));
      player.state = {
        position: p,
        q: [0, 0, 0, 1],
        velocity: v,
        thrust: [0, 0, 0],
        roll: 0,
        deorbited_debris: 0
      };

      function message_queue()
      {
        this.q = [];
        this.time = 0;
        this.peek = function()
        {
          if (this.empty()) { return ''; }
          return this.q[this.q.length - 1];
        };

        this.empty = function() { return this.q.length == 0; }

        this.push_msg = function(msg)
        {
          this.q.push(msg);
          this.time = msg.split(' ').length + 1;
        };

        this.update = function(dt)
        {
          this.time -= dt;

          if (this.time <= 0 && !this.empty())
          {
            this.q.pop();
            if (!this.empty())
            {
              this.time = this.peek().split(' ').length;
            }
          }
        };
      }

      player.message_queue = new message_queue();

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

      player.message_queue.push_msg('Push debris out of orbit to keep ships safe!');
      player.message_queue.push_msg('You are a space janitor of a busy moon settlement');
      player.message_queue.push_msg('Welcome janitor ' + player.id + '!');
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
    update: function(player, dt) { player.message_queue.update(dt); },
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
      const acc = r_acc.add(u_acc).add(f_acc);//.mul(0.1);

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
          d.deorbiter = player_key;
        }
      }

      // ship debris collision
      var debris_queue = []
      for (var i = 0; i < this.state.debris.length; i++)
      {
        var d = this.state.debris[i];
        const r = d.mass;

        for (var j = 0; j < this.state.ships.length; j++)
        {
          var s = this.state.ships[j];

          if (s.position.sub(d.position).len() < r + 1)
          {
            for(var l = (s.level + 1); l--;)
            {
              var deb = spawn_debris(s.position.add([].random_unit()));
              deb.velocity = deb.velocity.add([].random_unit().mul(0.05));
              debris_queue.push(deb);
            }

            for(var l = (s.level + 1); l--;)
            {
              var deb = spawn_debris(s.position.add([].random_unit()));
              deb.velocity = deb.velocity.add([].random_unit());
              deb.level = 0;
              debris_queue.push(deb);
            }

            s.position[0] = 2000;

            for (var player_key in this.players)
            {
              this.players[player_key].message_queue.push_msg('What are you doing up there?!')
              this.players[player_key].message_queue.push_msg('A ship was destroyed!!!')
            }
          }
        }
      }
      this.state.debris = this.state.debris.concat(debris_queue);

      // accelerate player
      grav = gravitational_force(player.state.position, [0, 0, 0], k.moon.mass);
      player.state.velocity = player.state.velocity.add(acc.mul(dt)).add(grav);

      // apply drag to the player
      player.state.velocity = player.state.velocity.mul(1 - dt);

      player.state.position = player.state.position.add(player.state.velocity);
      this.player.update(player, dt);

      this.state.players[player_key] = player.state;
    }


    this.state.convoy_time -= dt;

    if (this.state.convoy_time <= 0)
    {
      spawn_convoy(this.state.ships);
      this.state.convoy_time = 30;
      for (var player_key in this.players)
      {
        this.players[player_key].message_queue.push_msg('Ship traffic incoming!')
      }
    }

    // remove debris that have fallen into the moon
    this.state.debris = debris_cleanup(this.state.debris, this.state.players);

    this.state.ships = ship_cleanup(this.state);

    // update position of debris and if they would go through the gate
    debris_dynamics(this.state.debris, dt);

    ship_dynamics(this.state.ships, dt);

    // send states to all players
    const state_t = JSON.stringify(this.state, function(key, value) {
        // limit precision of floats
        if (typeof value === 'number') {
            return parseFloat(value.toFixed(3));
        }
        return value;
    });

    for (var player_key in this.players) {
      var player = this.players[player_key];



      player.send({ topic: "state", player_id: player_key, state: state_t, message: player.message_queue.peek() });
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
