'use strict';

/*
 * defendranged is called after 'threshold' when a room is attacked
 *
 * Tries to fight against the hostile creeps from ramparts if possible
 */

roles.defendranged = {};

roles.defendranged.getPartConfig = function(room, energy, heal) {
  var parts = [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK];
  return room.getPartConfig(energy, parts);
};

roles.defendranged.energyRequired = function(room) {
  return Math.max(200, room.energyAvailable);
};

roles.defendranged.energyBuild = function(room) {
  return Math.max(200, room.energyAvailable);
};

// TODO This overwrites the target so redo and enable again
//module.exports.action = function(creep) {
//  creep.memory.countdown = creep.memory.countdown || 100;
//
//  let hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
//  if (hostiles.length === 0) {
//    if (recycleCreep(creep)) {
//      return true;
//    }
//    creep.waitRampart();
//    return true;
//  }
//
//  hostiles = _.sortBy(hostiles, function(object) {
//    return creep.pos.getRangeTo(object.pos);
//  });
//  let target = hostiles[0];
//  creep.memory.countdown = 100;
//  creep.memory.target = target.pos;
//
//  if (creep.fightRampart(target)) {
//    creep.say('fightRampart');
//    return true;
//  }
//
//  creep.say('fightRanged');
//  return creep.fightRanged(target);
//};

roles.defendranged.execute = function(creep) {
  creep.memory.countdown = creep.memory.countdown || 100;

  let recycleCreep = function(creep) {
    creep.say('recycle');
    if (creep.room.controller && creep.room.controller.my) {
      if (creep.memory.countdown > 0) {
        creep.memory.countdown -= 1;
        creep.say('rnd');
        creep.moveRandom();
        return false;
      }
    }
    if (creep.room.name != creep.memory.base) {
      if (creep.stayInRoom()) {
        return true;
      }
    }
    return Creep.recycleCreep(creep);
  };

  let hostiles = creep.room.find(FIND_HOSTILE_CREEPS, {
    filter: creep.room.findAttackCreeps
  });
  if (hostiles.length === 0) {
    if (recycleCreep(creep)) {
      return true;
    }
    creep.waitRampart();
    return true;
  }

  hostiles = _.sortBy(hostiles, function(object) {
    return creep.pos.getRangeTo(object.pos);
  });
  let target = hostiles[0];
  creep.memory.countdown = 100;
  creep.memory.target = target.pos;

  if (creep.fightRampart(target)) {
    creep.say('fightRampart');
    return true;
  }

  creep.say('fightRanged');
  return creep.fightRanged(target);
};
