'use strict';

Creep.prototype.handleDefender = function() {
  let fightRampart = function(creep) {
    let hostile = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
      filter: creep.room.findAttackCreeps
    });
    if (hostile === null) {
      return false;
    }

    let hostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS);
    if (hostiles.length > 1) {
      creep.rangedMassAttack();

    } else {
      creep.rangedAttack(hostile);
    }

    let rampart = hostile.pos.findInRange(FIND_MY_STRUCTURES, 3, {
      filter: function(object) {
        if (object.structureType == STRUCTURE_RAMPART) {
          return true;
        }
      }
    });
    if (rampart.length === 0) {
      return false;
    }
    creep.moveTo(rampart[0]);
    return true;
  };

  if (fightRampart(this)) {
    return true;
  }

  var range;
  var hostile = this.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
    filter: this.room.findAttackCreeps
  });
  if (hostile === null) {
    var myCreeps = this.room.find(FIND_MY_CREEPS, {
      filter: function(object) {
        if (object.hits < object.hitsMax) {
          return true;
        }
        return false;
      }
    });
    if (myCreeps.length > 0) {
      this.moveTo(myCreeps[0]);
      range = this.pos.getRangeTo(myCreeps[0]);
      if (range <= 1) {
        this.heal(myCreeps[0]);
      } else {
        this.rangedHeal(myCreeps[0]);
      }
      return true;
    }

    let friends = [];
    try {
      friends = require('friends');
    } catch (error) {

    }

    var allyCreeps = this.room.find(FIND_HOSTILE_CREEPS, {
      filter: function(object) {
        if (object.hits == object.hitsMax) {
          return false;
        }
        if (friends.indexOf(object.owner.username) > -1) {
          return true;
        }
        return false;
      }
    });
    if (allyCreeps.length > 0) {
      this.say('heal', true);
      this.moveTo(allyCreeps[0]);
      range = this.pos.getRangeTo(myCreeps[0]);
      if (range <= 1) {
        this.heal(allyCreeps[0]);
      } else {
        this.rangedHeal(allyCreeps[0]);
      }
      return true;
    }

    // TODO disabled for nextroom defender
    //    creep.say('reverse');
    //    creep.memory.reverse = true;
    //    let exitDir = creep.room.findExitTo(creep.memory.base);
    //    let returnCode = creep.moveTo(new RoomPosition(25, 25, creep.memory.base));
    //    if (returnCode != OK) {
    //      creep.log('No target, reverse: ' + returnCode);
    //    }

    let constructionSite = this.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, {
      filter: function(object) {
        if (!object.owner) {
          return false;
        }
        if (object.owner.username == Memory.username) {
          return false;
        }
        return true;
      }
    });
    if (constructionSite !== null) {
      this.say('kcs');
      this.log('Kill constructionSite: ' + JSON.stringify(constructionSite));
      this.moveTo(constructionSite);
      return true;
    }

    this.moveRandom();
    return true;
  }

  if (this.hits < 0.5 * this.hitsMax) {
    let direction = this.pos.getDirectionTo(hostile);
    this.rangedAttack(hostile);
    direction = (direction + 3) % 8 + 1;
    let pos = this.pos.getAdjacentPosition(direction);
    let terrain = pos.lookFor(LOOK_TERRAIN)[0];
    if (terrain == 'wall') {
      direction = (Math.random() * 8) + 1;
    }
    this.move(direction);
    return true;
  }

  range = this.pos.getRangeTo(hostile);
  if (range > 3) {
    this.moveTo(hostile);
  }
  if (range === 0) {
    this.log('Range: ' + range);
  }
  if (range < 3) {
    var direction = this.pos.getDirectionTo(hostile);
    direction = (direction + 3) % 8 + 1;
    if (!direction || direction === null || this.pos.x === 0 || this.pos.x == 49 || this.pos.y === 0 || this.pos.y == 49) {
      this.moveTo(25, 25);
      return true;
    }
    var pos = this.pos.getAdjacentPosition(direction);
    var field = pos.lookFor(LOOK_TERRAIN)[0];
    if (field == 'wall') {
      direction = Math.floor((Math.random() * 8) + 1);
    }
    let creeps = pos.lookFor('creep');
    if (creeps.length > 0) {
      direction = Math.floor((Math.random() * 8) + 1);
    }
    this.move(direction);
  }
  this.rangedAttack(hostile);
  return true;

};

Creep.prototype.waitRampart = function() {
  this.say('waitRampart');
  let creep = this;
  let structure = this.pos.findClosestByPath(FIND_MY_STRUCTURES, {
    filter: function(object) {
      if (object.structureType != STRUCTURE_RAMPART) {
        return false;
      }
      return creep.pos.getRangeTo(object) > 0;
    }
  });

  let search = PathFinder.search(
    this.pos, {
      pos: structure.pos,
      range: 0
    }, {
      roomCallback: this.room.getAvoids(this.room, {}, true),
      maxRooms: 0
    }
  );

  if (search.incomplete) {
    this.moveRandom();
    return true;
  }
  let returnCode = this.move(this.pos.getDirectionTo(search.path[0]));
  return true;

};

Creep.prototype.fightRampart = function(target) {
  let position = target.pos.findClosestByRange(FIND_MY_STRUCTURES, {
    filter: function(object) {
      return object.structureType == STRUCTURE_RAMPART;
    }
  });

  if (position === null) {
    return false;
  }

  let range = target.pos.getRangeTo(position);
  if (range > 3) {
    return false;
  }

  let callback = this.room.getMatrixCallback;

  // TODO Extract the callback method to ... e.g. room and replace this.room.getAvoids
  if (this.room.memory.costMatrix && this.room.memory.costMatrix.base) {
    let room = this.room;
    callback = function(end) {
      let callbackInner = function(roomName) {
        let costMatrix = PathFinder.CostMatrix.deserialize(room.memory.costMatrix.base);
        // TODO the ramparts could be within existing walls (at least when converging to the newmovesim
        costMatrix.set(position.pos.x, position.pos.y, 0);
        return costMatrix;
      };
      return callbackInner;
    };
  }

  let search = PathFinder.search(
    this.pos, {
      pos: position.pos,
      range: 0
    }, {
      roomCallback: callback(position.pos),
      maxRooms: 1
    }
  );

  let returnCode = this.move(this.pos.getDirectionTo(search.path[0]));
  if (returnCode == OK) {
    return true;
  }
  if (returnCode == ERR_TIRED) {
    return true;
  }

  this.log('creep_fight.fightRampart returnCode: ' + returnCode + ' path: ' + JSON.stringify(search.path[0]));

  let targets = this.pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
    filter: this.room.findAttackCreeps
  });
  if (targets.length > 1) {
    this.rangedMassAttack();
  } else {
    this.rangedAttack(target);
  }
  return true;
};

Creep.prototype.flee = function(target) {
  let direction = this.pos.getDirectionTo(target);
  this.rangedAttack(target);
  direction = (direction + 3) % 8 + 1;
  let pos = this.pos.getAdjacentPosition(direction);
  let terrain = pos.lookFor(LOOK_TERRAIN)[0];
  if (terrain == 'wall') {
    direction = (Math.random() * 8) + 1;
  }
  this.move(direction);
  return true;
};

Creep.prototype.fightRanged = function(target) {
  if (this.hits < 0.5 * this.hitsMax) {
    return this.flee(target);
  }

  var range = this.pos.getRangeTo(target);
  var direction = null;

  if (range <= 2) {
    return this.flee(target);
  }
  if (range <= 3) {
    let returnCode = this.rangedAttack(target);
    if (returnCode == OK) {
      this.pos.createConstructionSite(STRUCTURE_RAMPART);
    }
    return true;
  }

  let creep = this;
  let callbackFunction = function(roomName) {
    let callback = creep.room.getAvoids(creep.room);
    let costMatrix = callback(roomName);
    for (let i = 0; i < 50; i++) {
      costMatrix.set(i, 0, 0xFF);
      costMatrix.set(i, 49, 0xFF);
      costMatrix.set(0, i, 0xFF);
      costMatrix.set(49, i, 0xFF);
    }
    let room = Game.rooms[roomName];
    let structures = room.find(FIND_STRUCTURES, {
      filter: function(object) {
        return object.structureType != STRUCTURE_ROAD;
      }
    });
    for (let i in structures) {
      let structure = structures[i];
      costMatrix.set(structure.pos.x, structure.pos.y, 0xFF);
    }
    return costMatrix;
  };

  let search = PathFinder.search(
    this.pos, {
      pos: target.pos,
      range: 3
    }, {
      roomCallback: callbackFunction,
      maxRooms: 1
    }
  );

  let returnCode = this.move(this.pos.getDirectionTo(search.path[0]));
  if (returnCode == OK) {
    return true;
  }
  if (returnCode == ERR_TIRED) {
    return true;
  }

  this.log('creep_ranged.attack_without_rampart returnCode: ' + returnCode);
};

Creep.prototype.siege = function() {
  this.memory.hitsLost = this.memory.hitsLast - this.hits;
  this.memory.hitsLast = this.hits;

  if (this.hits - this.memory.hitsLost < this.hits / 2) {
    let exitNext = this.pos.findClosestByRange(FIND_EXIT);
    this.moveTo(exitNext);
    return true;
  }

  if (!this.memory.notified) {
    this.log('Attacking');
    Game.notify(Game.time + ' ' + this.room.name + ' Attacking');
    this.memory.notified = true;
  }
  var tower = this.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
    filter: function(object) {
      if (object.structureType == STRUCTURE_TOWER) {
        return true;
      }
      if (object.structureType == STRUCTURE_CONTROLLER) {
        return true;
      }
      return true;
    }
  });
  let target = tower;
  if (tower === null) {
    var spawn = this.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
      filter: function(object) {
        if (object.structureType == 'spawn') {
          return true;
        }
        return false;
      }
    });
    target = spawn;
  }
  if (target === null) {
    var cs = this.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
    this.moveTo(cs);
    return false;
  }
  var path = this.pos.findPathTo(target, {
    ignoreDestructibleStructures: false,
    ignoreCreeps: true
  });
  let returnCode;

  var posLast = path[path.length - 1];
  if (path.length === 0 || !target.pos.isEqualTo(posLast.x, posLast.y)) {
    var structure = this.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: function(object) {
        return object.structureType == STRUCTURE_RAMPART;
      }
    });
    returnCode = this.moveTo(structure);
    target = structure;
  } else {
    if (this.hits > this.hitsMax - 2000) {
      returnCode = this.moveByPath(path);
    }
  }

  let structures = target.pos.lookFor('structure');
  for (let i = 0; i < structures.length; i++) {
    if (structures[i].structureType == STRUCTURE_RAMPART) {
      target = structures[i];
      break;
    }
  }

  this.dismantle(target);
  return true;
};

Creep.prototype.squadHeal = function() {
  var range;
  var creepToHeal = this.pos.findClosestByRange(FIND_MY_CREEPS, {
    filter: function(object) {
      return object.hits < object.hitsMax / 1.5;
    }
  });

  if (creepToHeal !== null) {
    range = this.pos.getRangeTo(creepToHeal);
    if (range <= 1) {
      this.heal(creepToHeal);
    } else {
      this.rangedHeal(creepToHeal);
      this.moveTo(creepToHeal);
    }
    return true;
  }

  creepToHeal = this.pos.findClosestByRange(FIND_MY_CREEPS, {
    filter: function(object) {
      return object.hits < object.hitsMax;
    }
  });

  if (creepToHeal !== null) {
    range = this.pos.getRangeTo(creepToHeal);
    if (range > 1) {
      this.rangedHeal(creepToHeal);
    } else {
      this.heal(creepToHeal);
    }
    this.moveTo(creepToHeal);
    return true;
  }

  var attacker = this.pos.findClosestByRange(FIND_MY_CREEPS, {
    filter: function(object) {
      return object.memory.role == 'squadsiege';
    }
  });

  if (this.pos.x === 0 ||
    this.pos.x == 49 ||
    this.pos.y === 0 ||
    this.pos.y == 49
  ) {
    this.moveTo(25, 25);
    return true;
  }
  if (attacker === null) {
    var cs = this.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
    this.moveTo(cs);
    return false;
  }
  this.moveTo(attacker);
  return false;
};
