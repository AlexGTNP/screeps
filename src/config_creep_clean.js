'use strict';

Creep.prototype.handleStructurer = function() {
  var structure;

  if (!this.memory.routing.targetId) {
    return this.cleanSetTargetId();
  }

  structure = Game.getObjectById(this.memory.routing.targetId);
  //  this.log(JSON.stringify(structure));
  if (structure === null) {
    delete this.memory.routing.targetId;
    return;
  }

  let search = PathFinder.search(
    this.pos, {
      pos: structure.pos,
      range: 1
    }, {
      maxRooms: 1
    }
  );

  let pos = search.path[0];
  let returnCode = this.move(this.pos.getDirectionTo(pos));

  if (returnCode == ERR_NO_PATH) {
    this.moveRandom();
    //    delete this.memory.routing.targetId;
    return true;
  }
  if (returnCode != OK && returnCode != ERR_TIRED) {
    //this.log('move returnCode: ' + returnCode);
  }
  //  this.moveByPathMy();

  var return_code = this.dismantle(structure);
  if (return_code == OK) {
    this.setNextSpawn();
    this.spawnCarry();
  }
};

Creep.prototype.cleanController = function() {
  let search = PathFinder.search(
    this.pos, {
      pos: this.room.controller.pos,
      range: 1
    }, {
      maxRooms: 1
    }
  );
  let findStructuresToDismantle = function(object) {
    if (object.ticksToDecay === null) {
      return false;
    }
    if (object.structureType == STRUCTURE_CONTROLLER) {
      return false;
    }
    if (object.structureType == STRUCTURE_ROAD) {
      return false;
    }
    return true;
  };
  for (let pos of search.path) {
    let posObject = new RoomPosition(pos.x, pos.y, this.room.name);
    var structures = posObject.findInRange(FIND_STRUCTURES, 1, {
      filter: findStructuresToDismantle
    });

    if (structures.length > 0) {
      this.memory.target_id = structures[0].id;
      this.log('found on way to controller to dismantle: ' + structures[0].pos);
      return true;
    }
  }
  return false;
};

Creep.prototype.cleanExits = function() {
  var pos_last;
  let findStructuresToDismantle = function(object) {
    if (object.ticksToDecay === null) {
      return false;
    }
    if (object.structureType == STRUCTURE_CONTROLLER) {
      return false;
    }
    if (object.structureType == STRUCTURE_ROAD) {
      return false;
    }
    return true;
  };
  var exit_dirs = [FIND_EXIT_TOP, FIND_EXIT_RIGHT, FIND_EXIT_BOTTOM, FIND_EXIT_LEFT];
  for (var exit_dirs_i in exit_dirs) {
    var exits = this.room.find(exit_dirs[exit_dirs_i]);
    if (exits.length === 0) {
      continue;
    }
    var exit = exits[Math.floor(exits.length / 2)];
    var path = this.pos.findPathTo(exit);
    pos_last = path[path.length - 1];
    if (path.length === 0) {
      continue;
    }
    if (!exit.isEqualTo(pos_last.x, pos_last.y)) {
      var pos = new RoomPosition(pos_last.x, pos_last.y, this.room.name);
      var structure = pos.findClosestByRange(FIND_STRUCTURES, {
        filter: findStructuresToDismantle
      });

      if (structure !== null) {
        this.memory.routing.targetId = structure.id;
        this.log('new memory: ' + structure.id);
        return true;
      }
    }
  }
  return false;
};

Creep.prototype.cleanSetTargetId = function() {
  if (this.room.controller && !this.room.controller.my) {
    this.log('no targetId');
    if (this.cleanController()) {
      return true;
    }
    if (this.cleanExits()) {
      this.log('clean exits');
      return true;
    }
    let structure = this.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: function(object) {
        if (object.ticksToDecay === null) {
          return false;
        }
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
    if (structure !== null) {
      var structures = structure.pos.lookFor('structure');

      if (structures.length > 0) {
        for (var structures_i = 0; structures_i < structures.length; structures_i++) {
          if (structures[structures_i].structureType == 'rampart') {
            structure = structures[structures_i];
            break;
          }
        }
      }

      this.log('structure: ' + structure.id);
      this.memory.routing.targetId = structure.id;
      return true;
    }
  }
  this.memory.targetReached = true;
  return Creep.recycleCreep(this);

};
