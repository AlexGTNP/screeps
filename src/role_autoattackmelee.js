'use strict';

/*
 * autoattackmelle is the first wave of autoattacks
 *
 * Kills tower and spawn, hostile creeps and construction sites
 */

roles.autoattackmelee = {};

roles.autoattackmelee.getPartConfig = function(room, energy, heal) {
  var parts = [MOVE, ATTACK];
  return room.getPartConfig(energy, parts).sort().reverse();
};

roles.autoattackmelee.energyRequired = function(room) {
  let offset = 300;
  if (!room.misplacedSpawn || room.controller.level <= 2) {
    offset = 0;
  }
  return Math.min(room.energyCapacityAvailable - offset, 3250);
};

roles.autoattackmelee.energyBuild = function(room, energy) {
  let offset = 300;
  if (!room.misplacedSpawn || room.controller.level <= 2) {
    offset = 0;
  }
  return Math.min(room.energyCapacityAvailable - offset, 3250);
};

roles.autoattackmelee.died = function(name, memory) {
  console.log('--->', name, 'Died naturally?');
  delete Memory.creeps[name];
};

roles.autoattackmelee.preMove = function(creep) {
  //  creep.log('!!!!!!!!!!!!!!!! Autoattacking');
};

roles.autoattackmelee.action = function(creep) {
  if (!creep.memory.notified) {
    creep.log('Attacking');
    Game.notify(Game.time + ' ' + creep.room.name + ' Attacking');
    creep.memory.notified = true;
  }
  var spawn = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
    filter: function(object) {
      if (object.structureType == STRUCTURE_SPAWN) {
        return true;
      }
      return false;
    }
  });

  if (spawn === null) {
    var hostile_creep = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
      filter: creep.room.findAttackCreeps
    });
    if (hostile_creep === null) {
      var structures = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
        filter: function(object) {
          if (object.structureType == STRUCTURE_CONTROLLER) {
            return false;
          }
          return true;
        }
      });

      if (structures === null) {
        var constructionSites = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
        creep.moveTo(constructionSites);
        return true;
      }

      creep.moveTo(structures);
      creep.attack(structures);
      return true;
    }
    creep.moveTo(hostile_creep);
    creep.attack(hostile_creep);
    return true;
  }
  //  var path = creep.pos.findPathTo(spawn, {
  //    ignoreDestructibleStructures: true
  //  });
  let search = PathFinder.search(
    creep.pos, {
      pos: spawn.pos,
      range: 1
    }, {
      maxRooms: 1
    }
  );
  creep.move(creep.pos.getDirectionTo(search.path[0]));
  creep.attack(spawn);
  return true;
};

roles.autoattackmelee.execute = function(creep) {
  creep.log('Execute!!!');
};
