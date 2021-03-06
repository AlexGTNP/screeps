'use strict';

Creep.prototype.harvesterBeforeStorage = function() {
  this.say('beforeStorage', true);
  var methods = [
    Creep.getEnergy
  ];
  if (this.room.storage && this.room.storage.store.energy > config.creep.energyFromStorageThreshold) {
    methods = [Creep.getEnergyFromStorage];
  }

  if (this.room.controller.ticksToDowngrade < CONTROLLER_DOWNGRADE[this.room.controller.level] / 10 || this.room.controller.level == 1) {
    methods.push(Creep.upgradeControllerTask);
  }

  methods.push(Creep.transferEnergy);

  let structures = this.room.find(FIND_MY_CONSTRUCTION_SITES, {
    filter: function(object) {
      if (object.structureType == STRUCTURE_RAMPART) {
        return false;
      }
      if (object.structureType == STRUCTURE_WALL) {
        return false;
      }
      if (object.structureType == STRUCTURE_CONTROLLER) {
        return false;
      }
      return true;
    }
  });

  if (structures.length > 0) {
    methods.push(Creep.constructTask);
  }

  if (this.room.controller.level < 9) {
    methods.push(Creep.upgradeControllerTask);
  } else {
    methods.push(Creep.repairStructure);
  }

  Creep.execute(this, methods);
  return true;
};

Creep.prototype.checkForTransfer = function(direction) {
  if (!direction) {
    return false;
  }

  var pos;
  var creeps;
  var other_creep;
  var index_calc;
  var offset;
  var new_path;

  //  for (var direction = 1; direction < 9; direction++) {
  let adjacentPos = this.pos.getAdjacentPosition(direction);

  if (adjacentPos.x < 0 || adjacentPos.y < 0) {
    return false;
  }
  if (adjacentPos.x > 49 || adjacentPos.y > 49) {
    return false;
  }

  creeps = adjacentPos.lookFor('creep');

  for (var name in creeps) {
    other_creep = creeps[name];
    if (!Game.creeps[other_creep.name]) {
      continue;
    }
    if (other_creep.carry.energy < 50) {
      continue;
    }
    if (Game.creeps[other_creep.name].memory.role == 'carry') {
      return other_creep.carry.energy + this.carry.energy >= this.carryCapacity;
    }
    continue;
  }
  //  }
  return false;
};

Creep.prototype.pickupWhileMoving = function(reverse) {
  if (this.room.name == this.memory.base && this.memory.routing.pathPos < 2) {
    return reverse;
  }

  if (_.sum(this.carry) < this.carryCapacity) {
    let creep = this;
    // TODO Extract to somewhere (also in creep_harvester, creep_carry, config_creep_resources)
    let pickableResources = function(object) {
      return creep.pos.getRangeTo(object.pos.x, object.pos.y) < 2;
    };

    let resources = _.filter(this.room.getDroppedResources(), pickableResources);

    if (resources.length > 0) {
      let resource = Game.getObjectById(resources[0].id);
      this.pickup(resource);
      return _.sum(this.carry) + resource.amount > 0.5 * this.carryCapacity;
    }

    if (this.room.name == this.memory.routing.targetRoom) {
      let containers = this.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: function(object) {
          if (object.structureType == STRUCTURE_CONTAINER) {
            return true;
          }
          return false;
        }
      });
      for (let container of containers) {
        let returnCode = this.withdraw(container, RESOURCE_ENERGY);
        if (returnCode == OK) {}
        return container.store.energy > 10;
      }
    }
  }
  return reverse;
};

Creep.prototype.handleExractor = function() {
  if (!this.room.terminal) {
    this.suicide();
    return true;
  }
  let carrying = _.sum(this.carry);
  if (carrying == this.carryCapacity) {
    let search = PathFinder.search(
      this.pos, {
        pos: this.room.terminal.pos,
        range: 1
      }, {
        roomCallback: this.room.getAvoids(this.room, {}, true),
      }
    );
    let returnCode = this.move(this.pos.getDirectionTo(search.path[0]));
    for (let key in this.carry) {
      if (this.carry[key] === 0) {
        continue;
      }
      let returnCode = this.transfer(this.room.terminal, key);
      return true;
    }
  }

  let minerals = this.room.find(FIND_MINERALS);
  if (minerals.length > 0) {
    let posMem = this.room.memory.position.creep[minerals[0].id];
    let pos = new RoomPosition(posMem.x, posMem.y, posMem.roomName);
    let search = PathFinder.search(
      this.pos, {
        pos: pos,
        range: 0
      }, {
        roomCallback: this.room.getAvoids(this.room, {}, true),
      }
    );
    let returnCode = this.move(this.pos.getDirectionTo(search.path[0]));
    this.harvest(minerals[0]);
  }
  return true;
};

Creep.prototype.handleUpgrader = function() {
  let say = function(creep) {
    let sentence = ['Don\'t', 'like'];
    for (let player in Memory.players) {
      sentence.push(player);
      sentence.push(Memory.players[player].idiot);
    }
    let word = Game.time % sentence.length;
    creep.say(sentence[word], true);

  };
  say(this);
  this.spawnReplacement(1);
  var room = Game.rooms[this.room.name];
  if (room.memory.attack_timer > 50 && room.controller.level > 6) {
    if (room.controller.ticksToDowngrade > 10000) {
      return true;
    }
  }

  var returnCode = this.upgradeController(this.room.controller);
  if (returnCode == OK) {
    if (!room.memory.upgraderUpgrade) {
      room.memory.upgraderUpgrade = 0;
    }
    var work_parts = 0;
    for (var part_i in this.body) {
      if (this.body[part_i].type == 'work') {
        work_parts++;
      }
    }
    room.memory.upgraderUpgrade += Math.min(work_parts, this.carry.energy);
  }

  returnCode = this.withdraw(this.room.storage, RESOURCE_ENERGY);

  if (returnCode == ERR_FULL) {
    return true;
  }
  if (returnCode === OK) {
    return true;
  }
  return true;
};

Creep.prototype.buildContainer = function() {
  if (this.room.name == this.memory.base) {
    return false;
  }
  // TODO Not in base room
  var objects = this.pos.findInRange(FIND_STRUCTURES, 0, {
    filter: function(object) {
      if (object.structureType == STRUCTURE_CONTAINER) {
        return true;
      }
      return false;
    }
  });
  if (objects.length === 0) {
    if (this.carry.energy >= 50) {
      let constructionSites = this.pos.findInRange(FIND_CONSTRUCTION_SITES, 0, {
        filter: function(object) {
          if (object.structureType != STRUCTURE_CONTAINER) {
            return false;
          }
          return true;
        }
      });
      if (constructionSites.length > 0) {
        let returnCode = this.build(constructionSites[0]);
        if (returnCode != OK) {
          this.log('build container: ' + returnCode);
        }
        return true;
      }

      let returnCode = this.pos.createConstructionSite(STRUCTURE_CONTAINER);
      if (returnCode == OK) {
        this.log('Create cs for container');
        return true;
      }
      if (returnCode == ERR_INVALID_TARGET) {
        let constructionSites = this.pos.findInRange(FIND_CONSTRUCTION_SITES, 0);
        for (let constructionSite of constructionSites) {
          constructionSite.remove();
        }
        return false;
      }
      if (returnCode != ERR_FULL) {
        this.log('Container: ' + returnCode + ' pos: ' + this.pos);
      }
      return false;
    }
  }
  if (objects.length > 0) {
    let object = objects[0];
    if (object.hits < object.hitsMax) {
      this.repair(object);
    }
  }
};

Creep.prototype.pickupEnergy = function() {
  // TODO Extract to somewhere (also in creep_harvester, creep_carry, config_creep_resources)
  let creep = this;
  let pickableResources = function(object) {
    return creep.pos.getRangeTo(object.pos.x, object.pos.y) < 2;
  };

  let resources = _.filter(this.room.getDroppedResources(), pickableResources);
  if (resources.length > 0) {
    let resource = Game.getObjectById(resources[0].id);
    let returnCode = this.pickup(resource);
    return returnCode == OK;
  }

  let containers = this.pos.findInRange(FIND_STRUCTURES, 1, {
    filter: function(object) {
      if (object.structureType == STRUCTURE_CONTAINER) {
        return true;
      }
      return false;
    }
  });
  if (containers.length > 0) {
    let returnCode = this.withdraw(containers[0], RESOURCE_ENERGY);
    if (returnCode == OK) {
      return true;
    }
  }

  let sourcers = this.pos.findInRange(FIND_MY_CREEPS, 1, {
    filter: function(object) {
      if (object.memory.role == 'sourcer') {
        return true;
      }
      return false;
    }
  });
  if (sourcers.length > 0) {
    let returnCode = sourcers[0].transfer(this, RESOURCE_ENERGY);
    if (returnCode == OK) {
      return true;
    }
  }

  return false;
};

// After introduction of `routing` take the direction to transfer to
Creep.prototype.transferToCreep = function(direction) {
  // TODO Only forward proper
  for (var index = -1; index < 2; index++) { // Only forward
    let indexCalc = (+direction + 7 + index) % 8 + 1;
    let adjacentPos = this.pos.getAdjacentPosition(indexCalc);
    if (adjacentPos.x < 0 || adjacentPos.y < 0) {
      continue;
    }
    if (adjacentPos.x > 49 || adjacentPos.y > 49) {
      continue;
    }
    var creeps = adjacentPos.lookFor('creep');
    for (var name in creeps) {
      var other_creep = creeps[name];
      if (!Game.creeps[other_creep.name]) {
        continue;
      }
      // Do we want this?
      if (Game.creeps[other_creep.name].memory.role == 'powertransporter') {
        continue;
      }
      if (other_creep.carry.energy == other_creep.carryCapacity) {
        continue;
      }
      var return_code = this.transfer(other_creep, RESOURCE_ENERGY);
      if (return_code == OK) {
        // return true;
        return this.carry.energy * 0.5 <= other_creep.carryCapacity - other_creep.carry.energy;
      }
    }
  }
  return false;
};

Creep.prototype.transferToStructures = function() {
  let transferred = false;

  let creep = this;

  let filterTransferrables = function(object) {
    if (object.structureType == STRUCTURE_TERMINAL && (object.store.energy || 0) > 10000) {
      return false;
    }

    if (creep.memory.role == 'harvester' && object.structureType == STRUCTURE_STORAGE) {
      return false;
    }

    if (creep.memory.role == 'harvester' && object.structureType == STRUCTURE_LINK) {
      return false;
    }

    if ((object.structureType == STRUCTURE_LAB ||
        object.structureType == STRUCTURE_EXTENSION ||
        object.structureType == STRUCTURE_SPAWN ||
        object.structureType == STRUCTURE_NUKER ||
        object.structureType == STRUCTURE_POWER_SPAWN ||
        object.structureType == STRUCTURE_TOWER ||
        object.structureType == STRUCTURE_LINK) &&
      object.energy == object.energyCapacity) {
      return false;
    }

    return creep.pos.getRangeTo(object.pos.x, object.pos.y) < 2;
  };

  let structures = _.filter(creep.room.getTransferableStructures(), filterTransferrables);
  if (structures.length > 0) {
    let returnCode = -1;
    for (let structureFromCache of structures) {
      let structure = Game.getObjectById(structureFromCache.id);
      //       let resource = 'energy';
      for (let resource in this.carry) {
        returnCode = this.transfer(structure, resource);
        if (returnCode == OK) {
          return {
            moreStructures: structures.length > 1,
            // TODO handle different type of resources on the structure side
            transferred: Math.min(this.carry[resource], structure.energyCapacity - structure.energy)
          };
        }
        this.log('TransferToStructure: ' + returnCode + ' pos: ' + structure.pos + ' resource: ' + resource);
      }
    }
  }
  return false;
};

function get_structure(creep) {
  // creep.log('findClosestByPath - now range');

  // var stack = new Error().stack;
  // console.log(stack);

  // var structure = creep.pos.findClosestByRange(FIND_STRUCTURES, {
  var structure = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
    filter: function(object) {
      if (object.energy == object.energyCapacity) {
        return false;
      }
      // TODO disabled high cpu
      // if (!object.isActive()) {
      // return false;
      // }
      if (!object.my) {
        return false;
      }
      if (object.structureType == STRUCTURE_EXTENSION) {
        return true;
      }
      if (object.structureType == STRUCTURE_SPAWN) {
        return true;
      }
      if (object.structureType == STRUCTURE_TOWER) {
        return true;
      }
      return false;
    }
  });
  return structure;
}

Creep.prototype.transferMy = function() {
  var pos;
  var structures;
  var structure;
  var creeps;
  var other_creep;
  var offset;
  var index;
  var return_code;
  var name;

  for (let direction = 1; direction < 9; direction++) {
    let adjacentPos = this.pos.getAdjacentPosition(direction);
    if (adjacentPos.x < 0 || adjacentPos.y < 0) {
      continue;
    }
    if (adjacentPos.x > 49 || adjacentPos.y > 49) {
      continue;
    }
    creeps = adjacentPos.lookFor('creep');
    for (name in creeps) {
      other_creep = creeps[name];
      if (!other_creep.my) {
        continue;
      }
      if (other_creep.carry.energy == other_creep.carryCapacity) {
        continue;
      }
      return_code = this.transfer(other_creep, RESOURCE_ENERGY);
      return return_code === 0;
    }
  }
  return false;
};

Creep.prototype.getEnergy = function() {
  if (this.carry.energy == this.carryCapacity) {
    return false;
  }

  var target = this.pos.findClosestByRange(FIND_DROPPED_ENERGY, {
    filter: function(object) {
      return object.energy > 12;
    }
  });
  if (target !== null) {
    var energy_range = this.pos.getRangeTo(target);
    if (energy_range <= 1) {
      this.pickup(target);
      return false;
    }
    if (target.energy > 20 && energy_range < 18 && this.carry.energy === 0) {
      if (!this.memory.routing) {
        this.memory.routing = {};
      }
      if (!this.memory.routing.cache) {
        this.memory.routing.cache = {};
      }
      if (!this.memory.routing.cache[target.id]) {
        let search = PathFinder.search(
          this.pos, {
            pos: target.pos,
            range: 1
          }, {
            roomCallback: this.room.getAvoids(this.room, {}, true),
            maxRooms: 0
          }
        );
        if (search.path.length === 0 || search.incomplete) {
          this.say('deir');
          this.moveRandom();
          return true;
        }
        this.memory.routing.cache[target.id] = search;
      }

      let path = this.memory.routing.cache[target.id].path;
      let pos = _.findIndex(path, i => i.x == this.pos.x && i.y == this.pos.y);
      // if (pos < 0) {
      // this.log(JSON.stringify(path));
      // this.say('no path pos');
      // delete this.memory.routing.cache[target.id];
      // return true;
      // }
      // this.log(pos);
      if (!path[pos + 1]) {
        this.log('config_creep_resources.getEnergy EOP pos: ' + pos + ' path: ' + JSON.stringify(path) + ' target: ' + target.pos + ' pos: ' + this.pos);
        this.say('EOP');
        delete this.memory.routing.cache[target.id];
        this.moveRandom();
        return true;
      }
      if (this.pos.getRangeTo(path[pos + 1].x, path[pos + 1].y) > 1) {
        delete this.memory.routing.cache[target.id];
        return true;
      }
      this.say('de:' + this.pos.getDirectionTo(path[pos + 1].x, path[pos + 1].y), true);
      if (!this.pos.getDirectionTo(path[pos + 1].x, path[pos + 1].y)) {
        this.log(pos + ' ' + this.pos.getDirectionTo(path[pos + 1].x, path[pos + 1].y) + ' ' + JSON.stringify(path));
        this.say('no path pos');
        delete this.memory.routing.cache[target.id];
        return true;
      }
      let returnCode = this.move(this.pos.getDirectionTo(path[pos + 1].x, path[pos + 1].y));
      return true;
    }
  }

  let hostileStructures = this.room.find(FIND_HOSTILE_STRUCTURES, {
    filter: function(object) {
      if (object.structureType == STRUCTURE_CONTROLLER) {
        return false;
      }
      if (object.structureType == STRUCTURE_STORAGE && object.store.energy === 0) {
        return false;
      }
      if (object.energy === 0) {
        return false;
      }
      return true;
    }
  });
  hostileStructures = _.sortBy(hostileStructures, function(object) {
    if (object.structureType == STRUCTURE_STORAGE) {
      return 1;
    }
    return 2;
  });
  if (hostileStructures.length > 0 && !this.carry.energy) {
    let structure = hostileStructures[0];
    let range = this.pos.getRangeTo(structure);
    if (this.carry.energy === 0 || range < 5) {
      this.say('hostile');
      this.moveTo(structure);
      this.withdraw(structure, RESOURCE_ENERGY);
      return true;
    }
  }

  var range = null;
  var item = this.pos.findClosestByRange(FIND_SOURCES_ACTIVE);

  if (item === null) {
    if (this.carry.energy === 0) {
      var source = this.pos.findClosestByRange(FIND_SOURCES);
      this.moveTo(source, {
        reusePath: 5,
        ignoreCreeps: true,
        costCallback: this.room.getAvoids(this.room)

      });
      return true;
    } else {
      return false;
    }
  }

  range = this.pos.getRangeTo(item);
  if (this.carry.energy > 0 && range > 1) {
    return false;
  }

  if (range == 1) {
    let sourcers = this.pos.findInRange(FIND_MY_CREEPS, 1, {
      filter: function(object) {
        let creep = Game.getObjectById(object.id);
        if (creep.memory.role == 'sourcer' && creep.carry.energy > 0) {
          return true;
        }
        return false;
      }
    });
    if (sourcers.length > 0) {
      let returnCode = sourcers[0].transfer(this, RESOURCE_ENERGY);
      this.say('rr:' + returnCode);
      if (returnCode == OK) {
        return true;
      }
    }
  }

  if (typeof(this.memory.target) != 'undefined') {
    delete this.memory.target;
  }

  if (range == 1) {
    this.harvest(item);
    if (this.carry.energy >= this.carryCapacity) {
      var creep = this;
      var creep_without_energy = this.pos.findClosestByRange(FIND_MY_CREEPS, {
        filter: function(object) {
          return object.carry.energy === 0 && object.id != creep.id;
        }
      });
      range = this.pos.getRangeTo(creep_without_energy);

      if (range == 1) {
        this.transfer(creep_without_energy, RESOURCE_ENERGY);
      }
    }
    // TODO Somehow we move before preMove, canceling here
    this.cancelOrder('move');
    this.cancelOrder('moveTo');
    return true;
  } else {
    if (!this.memory.routing) {
      this.memory.routing = {};
    }
    this.memory.routing.reverse = false;
    if (this.room.memory.misplacedSpawn || this.room.controller.level < 3) {
      this.moveTo(item.pos);
    } else {
      this.moveByPathMy([{
        'name': this.room.name
      }], 0, 'pathStart', item.id, true, undefined);
    }
    return true;
  }
};

Creep.prototype.construct = function() {
  this.say('construct', true);
  var target = this.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);

  if (target === null) {
    return false;
  }

  var range = this.pos.getRangeTo(target);
  if (range <= 3) {
    let returnCode = this.build(target);
    if (returnCode == OK) {
      if (range == 1) {
        this.move(((this.pos.getDirectionTo(target) + 3) % 8) + 1);
      } else {
        this.moveRandom(true);
      }
      return true;
    }
    if (returnCode == ERR_NOT_ENOUGH_RESOURCES) {
      return true;
    }
    if (returnCode == ERR_INVALID_TARGET) {
      this.log('config_creep_resource construct: ' + returnCode + ' ' + JSON.stringify(target.pos));
      this.moveRandom();
      let filterSpawns = function(object) {
        return object.structureType == STRUCTURE_SPAWN;
      };

      let structures = target.pos.lookFor('structure');
      for (let structureId in structures) {
        let structure = structures[structureId];
        if (structure.structureType == STRUCTURE_SPAWN) {
          let spawns = this.room.find(FIND_STRUCTURES, {
            filter: filterSpawns
          });
          if (spawns.length <= 1) {
            target.remove();
            return true;
          }
        }
        this.log('Destroying: ' + structure.structureType);
        structure.destroy();
      }
      return true;
    }
    this.log('config_creep_resource construct: ' + returnCode + ' ' + JSON.stringify(target.pos));
  } else {
    let callback = this.room.getMatrixCallback;

    if (this.room.memory.costMatrix && this.room.memory.costMatrix.base) {
      let room = this.room;
      let creep = this;
      callback = function(end) {
        let callbackInner = function(roomName) {
          let costMatrix = PathFinder.CostMatrix.deserialize(room.memory.costMatrix.base);
          costMatrix.set(creep.pos.x, creep.pos.y, 0);

          // TODO excluding structures, for the case where the spawn is in the wrong spot (I guess this can be handled better)
          let structures = room.find(FIND_STRUCTURES, {
            filter: function(object) {
              if (object.structureType == STRUCTURE_RAMPART) {
                return false;
              }
              if (object.structureType == STRUCTURE_ROAD) {
                return false;
              }
              if (object.structureType == STRUCTURE_CONTAINER) {
                return false;
              }
              return true;
            }
          });
          for (let structure of structures) {
            costMatrix.set(structure.pos.x, structure.pos.y, config.layout.structureAvoid);
          }

          return costMatrix;
        };
        return callbackInner;
      };
    }

    let search = PathFinder.search(
      this.pos, {
        pos: target.pos,
        range: 3
      }, {
        roomCallback: callback(target.pos),
        maxRooms: 0
      }
    );

    if (search.incomplete) {
      this.moveTo(target.pos);
      return true;
    }

    if (range > 5 && search.path.length == 1) {
      // TODO extract to a method and make sure, e.g. creep doesn't leave the room
      this.moveRandom();
      return true;
    }

    // TODO Stuck?
    if (!this.pos.getDirectionTo(search.path[0])) {
      this.moveRandom();
      return true;
    }

    let returnCode = this.move(this.pos.getDirectionTo(search.path[0]));
    if (returnCode != ERR_TIRED) {
      this.memory.lastPosition = this.pos;
    }
  }
  return true;

};

Creep.prototype.transferEnergyMy = function() {
  var exitDir;

  if (!this.memory.target) {
    var structure = get_structure(this);
    if (structure === null) {
      // this.log('transferEnergyMy: no structure');
      if (this.room.storage && this.room.storage.my) {
        this.memory.target = this.room.storage.id;
      } else {
        return false;
      }
    } else {
      this.memory.target = structure.id;
    }
  }

  var target = Game.getObjectById(this.memory.target);
  if (!target) {
    this.log('transferEnergyMy: Can not find target');
    delete this.memory.target;
    return false;
  }

  this.say('transferEnergy', true);
  var range = this.pos.getRangeTo(target);
  // this.log('target: ' + target.pos + ' range: ' + range);
  if (range == 1) {
    let returnCode = this.transfer(target, RESOURCE_ENERGY);
    if (returnCode != OK) {
      // TODO Enable and check again
      // this.log('transferEnergyMy: ' + returnCode + ' ' +
      // target.structureType + ' ' + target.pos);
    }
    delete this.memory.target;
  } else {
    let search = PathFinder.search(
      this.pos, {
        pos: target.pos,
        range: 1
      }, {
        roomCallback: this.room.getAvoids(this.room, {
          scout: true
        }, true),
        maxRooms: 1
      }
    );
    if (search.path.length === 0) {
      this.moveRandom();
      return true;
    }
    if (search.incomplete) {
      this.say('tr:incompl', true);
      let search = PathFinder.search(
        this.pos, {
          pos: target.pos,
          range: 1
        }, {
          maxRooms: 1
        });
      let returnCode = this.move(this.pos.getDirectionTo(search.path[0]));
    } else {
      this.say('tr:' + this.pos.getDirectionTo(search.path[0]), true);
      let returnCode = this.move(this.pos.getDirectionTo(search.path[0]));
    }
  }
  return true;
};

Creep.prototype.handleReserver = function() {
  if (!this.memory.target_id) {
    this.memory.target_id = this.room.controller.id;
  }

  if (this.room.name != this.memory.routing.targetRoom) {
    this.memory.routing.reached = false;
    return false;
  }

  this.memory.level = 2;
  if (this.room.controller.reservation && this.room.controller.reservation.ticksToEnd > 4500) {
    this.memory.level = 1;
  }
  if (!this.room.controller.my && (!this.room.controller.reservation || this.room.controller.reservation.username != Memory.username)) {
    this.memory.level = 5;
  }
  let repairers = this.room.find(FIND_MY_CREEPS, {
    filter: function(object) {
      if (object.memory.role == 'repairer') {
        return true;
      }
      return false;
    }
  });
  if (repairers.length < 2) {
    this.spawnReplacement();
  }

  let callCleaner = function(creep) {
    if (creep.memory.base == creep.room.name) {
      return false;
    }

    if (!Game.rooms[creep.memory.base].storage) {
      return false;
    }

    if ((Game.time + creep.pos.x + creep.pos.y) % 1000 !== 0) {
      return false;
    }

    if (config.creep.structurer) {

      var structurers = creep.room.find(FIND_MY_CREEPS, {
        filter: function(object) {
          return object.memory.role == 'structurer';
        }
      });
      if (structurers.length > 0) {
        return false;
      }

      var resource_structures = creep.room.find(FIND_STRUCTURES, {
        filter: function(object) {
          if (object.structureType == STRUCTURE_CONTROLLER) {
            return false;
          }
          if (object.structureType == STRUCTURE_ROAD) {
            return false;
          }
          if (object.structureType == STRUCTURE_CONTAINER) {
            return false;
          }
          return true;
        }
      });

      if (resource_structures.length > 0 && !creep.room.controller.my) {
        creep.log('Call structurer from ' + creep.memory.base + ' because of ' + resource_structures[0].structureType);
        Game.rooms[creep.memory.base].memory.queue.push({
          role: 'structurer',
          target: creep.room.name
        });
        return true;
      }
    }
  };

  callCleaner(this);

  if (Game.time % 100 === 0 && this.room.controller.reservation && this.room.controller.reservation.username == Memory.username) {
    let checkSourcer = function(creep) {
      let checkSourcerMatch = function(sourcers, source_id) {
        for (var sourcer_i in sourcers) {
          var sourcer = sourcers[sourcer_i];
          if (sourcer.memory.target_id == source_id) {
            return true;
          }
        }
        return false;
      };
      var sources = creep.room.find(FIND_SOURCES);
      var sourcer = creep.room.find(FIND_MY_CREEPS, {
        filter: function(object) {
          return object.memory.role == 'sourcer';
        }
      });

      if (sourcer.length < sources.length) {
        for (var sources_id in sources) {
          if (checkSourcerMatch(sourcer, sources[sources_id].pos)) {
            creep.log('Matching sourcer found');
            continue;
          }

          var sourcer_spawn = {
            role: 'sourcer',
            source: sources[sources_id].pos,
            target: sources[sources_id].pos.roomName,
            target_id: sources[sources_id].id
          };

          Game.rooms[creep.memory.base].memory.queue.push(sourcer_spawn);
        }
      }

    };

    checkSourcer(this);
  }

  if (config.creep.reserverDefender) {
    var hostiles = this.room.find(FIND_HOSTILE_CREEPS, {
      filter: this.room.findAttackCreeps
    });
    if (hostiles.length > 0) {
      //this.log('Reserver under attack');
      if (!this.memory.defender_called) {
        Game.rooms[this.memory.base].memory.queue.push({
          role: 'defender',
          target: this.room.name
        });
        this.memory.defender_called = true;
      }
    }
  }

  var method = this.reserveController;
  var return_code;
  if (this.room.controller.owner && this.room.controller.owner != Memory.username) {
    this.say('attack');
    return_code = this.attackController(this.room.controller);
  } else {
    return_code = this.reserveController(this.room.controller);
  }

  if (return_code == OK || return_code == ERR_NO_BODYPART) {
    if (this.room.controller.reservation) {
      this.room.memory.reservation = {
        base: this.memory.base,
        tick: Game.time,
        ticksToLive: this.ticksToLive,
        reservation: this.room.controller.reservation.ticksToEnd
      };

    }
    this.memory.targetReached = true;
    this.setNextSpawn();
    return true;
  }
  if (return_code == ERR_NOT_IN_RANGE) {
    return true;
  }
  if (return_code == ERR_INVALID_TARGET) {
    return true;
  }

  this.log('reserver: ' + return_code);

  return true;

};
