'use strict';

/*
 * Harvesting sources is done by sourcer
 *
 * Moves to the source and gets energy
 * In external rooms builds a container
 * In internal rooms transfers to the link
 *
 * If 'threshold' energy is in the container or on the ground
 * a carry is called
 */

roles.sourcer = {};

roles.sourcer.buildRoad = true;
roles.sourcer.killPrevious = true;

// TODO should be true, but flee must be fixed before 2016-10-13
roles.sourcer.flee = false;

roles.sourcer.getPartConfig = function(room, energy, heal) {
  var parts = [MOVE, CARRY, WORK, WORK, WORK, WORK, MOVE, MOVE, WORK, HEAL, MOVE, HEAL, MOVE, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE];
  return room.getPartConfig(energy, parts);
};

roles.sourcer.preMove = function(creep, directions) {
  // Misplaced spawn
  if (creep.room.name == creep.memory.base && (creep.room.memory.misplacedSpawn || creep.room.controller.level < 3)) {
    creep.say('smis', true);
    let targetId = creep.memory.target_id;
    if (creep.memory.routing) {
      targetId = creep.memory.routing.targetId;
    } else {
      console.log('No routing');
    }

    var source = creep.room.memory.position.creep[targetId];
    // TODO better the position from the room memory
    creep.moveTo(source.x, source.y);
    if (creep.pos.getRangeTo(source.x, source.y) > 0) {
      return true;
    }
  }

  if (!creep.room.controller) {
    var target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
      filter: function(object) {
        if (object.owner.username == 'Source Keeper') {
          return true;
        }
        return false;
      }
    });
    if (target !== null) {
      let range = creep.pos.getRangeTo(target);
      if (range > 6) {
        creep.memory.routing.reverse = false;
      }
      if (range < 6) {
        creep.memory.routing.reverse = true;
      }
    }
  }

  // TODO Check if this is working
  if (directions) {
    let pos = creep.pos.buildRoomPosition(directions.direction);
    creep.moveCreep(pos, (directions.direction + 3) % 8 + 1);
  }

  // TODO copied from nextroomer, should be extracted to a method or a creep flag
  // Remove structures in front
  if (!directions) {
    return false;
  }
  // TODO when is the forwardDirection missing?
  if (directions.forwardDirection) {
    let posForward = creep.pos.getAdjacentPosition(directions.forwardDirection);
    let structures = posForward.lookFor(LOOK_STRUCTURES);
    for (let structure of structures) {
      if (structure.structureType == STRUCTURE_ROAD) {
        continue;
      }
      if (structure.structureType == STRUCTURE_RAMPART && structure.my) {
        continue;
      }
      if (structure.structureType == STRUCTURE_SPAWN && structure.my) {
        continue;
      }
      creep.dismantle(structure);
      creep.say('dismantle', true);
      break;
    }
  }
};

roles.sourcer.energyBuild = function(room, energy, source, heal) {
  var max = 700;
  // TODO Only three parts for external sourcer (Double check how many parts)
  //  room.log('creep_sourcer.energyBuild source: ' + JSON.stringify(source));
  if (heal) {
    max = 1450;
  }
  energy = Math.max(200, Math.min(max, room.energyCapacityAvailable));
  return energy;
};

roles.sourcer.died = function(name, memory) {
  console.log(name, 'died', memory.base, memory.source.roomName);
  delete Memory.creeps[name];
};

roles.sourcer.action = function(creep) {
  // TODO Fix for sourcers without routing.targetId
  if (!creep.memory.routing.targetId) {
    if (!Game.rooms[creep.memory.source.roomName]) {
      creep.memory.routing.targetRoom = creep.memory.source.roomName;
      creep.memory.routing.reached = false;
      delete creep.memory.routing.route;
      return true;
    }

    let sourcePos = new RoomPosition(creep.memory.source.x, creep.memory.source.y, creep.memory.source.roomName);
    let sources = sourcePos.lookFor(LOOK_SOURCES);
    if (sources[0]) {
      creep.log('Reached, but not near source !!!!');
      creep.memory.routing.reached = false;
      creep.memory.routing.targetId = sources[0].id;
    } else {
      creep.log('!!! config_creep_routing sourcer No sources at source: ' + creep.memory.source + ' targetId: ' + creep.memory.targetId);
    }
  }

  // TODO check source keeper structure for ticksToSpawn
  if (!creep.room.controller) {
    var target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
      filter: function(object) {
        if (object.owner.username == 'Source Keeper') {
          return true;
        }
        return false;
      }
    });
    if (target !== null) {
      let range = creep.pos.getRangeTo(target);
      if (range < 5) {
        delete creep.memory.routing.reached;
        creep.memory.routing.reverse = true;
      }
    }
  }

  creep.handleSourcer();
  return true;
};

roles.sourcer.execute = function(creep) {
  creep.log('Execute!!!');
  creep.memory.routing.targetReached = true;
  creep.handleSourcer();
  //  throw new Error();
};
