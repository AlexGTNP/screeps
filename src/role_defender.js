'use strict';

/*
 * Called to defend external rooms
 *
 * Fights against hostile creeps
 */

roles.defender = {};
roles.defender.boostActions = ['rangedAttack', 'heal'];

roles.defender.getPartConfig = function(room, energy, heal) {
  var parts = [MOVE, RANGED_ATTACK, MOVE, HEAL];
  return room.getPartConfig(energy, parts).sort().reverse();
};

roles.defender.energyRequired = function(room) {
  if (room.controller.level == 8) {
    return Math.min(room.energyCapacityAvailable, 6200);
  }
  return Math.min(room.energyCapacityAvailable, 1000);
};

roles.defender.energyBuild = function(room, energy) {
  if (room.controller.level == 8) {
    return Math.max(2000, Math.min(room.energyCapacityAvailable, 6200));
  }
  return Math.min(room.energyCapacityAvailable, 1000);
};

roles.defender.action = function(creep) {
  if (creep.room.name == creep.memory.base && creep.memory.reverse) {
    return Creep.recycleCreep(creep);
  }
  // TODO Better in premove
  if (creep.room.name != creep.memory.base) {
    let walls = creep.pos.findInRange(FIND_STRUCTURES, 1, {
      filter: function(object) {
        if (object.structureType == STRUCTURE_WALL) {
          return true;
        }
        if (object.structureType == STRUCTURE_RAMPART) {
          return true;
        }
        return false;
      }
    });
    if (walls.length > 0) {
      if (!creep.room.controller || !creep.room.controller.my) {
        creep.rangedAttack(walls[0]);
      }
    }
  }

  creep.heal(creep);
  var room = Game.rooms[creep.room.name];
  if (room.memory.hostile) {
    creep.handleDefender();
    return true;
  }

  creep.handleDefender();
  return true;
};

roles.defender.preMove = function(creep, directions) {
  creep.heal(creep);
  let target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
    filter: creep.room.findAttackCreeps
  });
  if (target !== null) {
    creep.handleDefender();
    return true;
  }
};

roles.defender.execute = function(creep) {
  creep.log('Execute!!!');
};
