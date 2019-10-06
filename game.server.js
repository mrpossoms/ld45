const g = require("./static/js/g.js");

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
    for (var i = 0; i < this.state.asteroids.length; i++) {
      var previousPosition = this.state.asteroids[i].position;
      var velocity;
      if (!this.state.asteroids[i].captured) {
        this.state.asteroids[i].position = this.state.asteroids[i].position.add(
          this.state.asteroids[i].velocity
        );
        velocity = this.state.asteroids[i].velocity;
      } else {
        // For captured asteroids
        var player = this.state.asteroids[i].player;
        this.state.asteroids[i].position = player.state.position.add(
          player.forward()
        );
        velocity = player.state.velocity;
      }
      // TODO: Add ray code with previous position and velocity and asteroid player to check if they scored
    }

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
      var asteroid = {
        level: 0,
        position: [
          Math.random() * 501 - 250,
          Math.random() * 50 - 25,
          Math.random() * 501 - 250
        ],
        velocity: [
          Math.random(0, 0.66) - 0.33,
          Math.random(0, 0.66) - 0.33,
          Math.random(0, 0.66) - 0.33
        ]
      };
      this.state.asteroids.push(asteroid);
    }
  }
};
