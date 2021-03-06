var WebSocketServer = require('websocket').server;
var http = require('http');
var fs = require('fs');

var server = http.createServer();
var globals = require('./globals');

var users = globals.users;
var map = globals.map;

var enemies = globals.enemies;

var messageStack = {};

var Map = function(x,y){
  this.x = x;
  this.y = y;

  this.users = [];
  this.npcs = [];
  this.enemies = {};
  this.objects = [];
  this.tiles = {};
}

var User = function(){
  
  this.connection;

  this.id = generateId();

  this.x = globals.startX;
  this.y = globals.startY;
  this.lvl = globals.startLvl;
  this.hp = globals.startHp;

  users[this.id] = this;

  this.getChunk = function(){
    return lowerTo(this.x, 1920)+","+lowerTo(this.y, 1080);
  }

  this.die = function(){

    console.log("dieing: "+this.id);

    var msg = {};
    msg.type = "death";
    msg.id = this.id;

    toAll(JSON.stringify(msg));

    this.hp = globals.startHp;

  }

  this.hit = function(dmg){

    this.hp = this.hp - dmg;

    if(this.hp < 0){
      this.die();
    }

  }


}; 

var Enemy = function(type, x, y, hp){
  this.id = generateId();

  this.type = type;

  this.x = x;
  this.y = y;
  this.hp = hp;

  enemies[this.id] = this;

  this.quit = function(){

    console.log("quiting: "+this.id);

    var msg = {};
    msg.type = "death";
    msg.id = this.id;

    toAll(JSON.stringify(msg));


    if(enemies[this.id] == null){
      console.log("couldn't find enemy in enemies: "+this.id);
    }
    if(map[this.chunk].enemies[this.id] == null){
      console.log("couldn't find enemy in map: "+this.id);
    }

    delete enemies[this.id];
    delete map[this.chunk].enemies[this.id];
  }

  this.hit = function(dmg){

    if(dmg < 0){
      /* WHYY IS THISS HAPPENINNNGGGGGGGG */
      dmg = 100;
    }

    this.hp = this.hp - dmg;

    if(this.hp < 0){
      this.quit();
    }

  }

}; 

getCommandMap(function(map){
  globals.commandMap = map;
});

autoGenerateMap();

function originIsAllowed(origin) {
  // put logic here to detect whether the specified origin is allowed.
  return true;
}

server.listen(globals.port, function() {
    console.log(' Server is listening on port 2000');
    setStackInterval();
});

wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false
});

wsServer.on('request', function(request) {
  if (!originIsAllowed(request.origin)) {
    // Make sure we only accept requests from an allowed origin
    request.reject();
    console.log('Connection from origin ' + request.origin + ' rejected.');
    return;
  }

  var user = new User();
  user.connection = request.accept(null, request.origin); 
  
  sendUTF(user.id, 
    '{"type":"id", "user":{ "id":'+user.id+', "lvl":1, "hp":'+user.hp+', "x":'+user.x+', "y":'+user.y+', "color":"'+user.color+'" } }'
  );
  
  var all  = {"type":"allUsers","users":[]};

  for ( i in users) {
    if(users[i].id != user.id){
      var obj = {
        "id":users[i].id,
        "lvl":users[i].lvl,
        "hp":users[i].hp,
        "x":users[i].x,
        "y":users[i].y,
        "color":users[i].color
      }
      
      all.users.push(obj);
    }
  }

  sendUTF(user.id, JSON.stringify(all));
  
  toAll(' { "type":"newUser", "user":{ "id":'+user.id+', "color":"'+user.color+'" } }');
  console.log(user.id+" connected");
  
  user.connection.on('message', function(message) {
    if(message.type=="utf8"){
      //console.log('Received Message from '+user.id);
      if(isJson(message.utf8Data))
      {

        var msgArray = JSON.parse(parseMsg(message.utf8Data));

        for (key in msgArray){
          
          var msg = msgArray[key];

          if(msg.type=="move")
          {
            //console.log(user.id+" move action: "+msg.action+" to: "+msg.direction);
            toAll(
              '{"type":"move","id":"'+user.id+'","action":"'+msg.action+'","direction":"'+msg.direction+'","position":{"x":'+msg.position.x+',"y":'+msg.position.y+'} }',
              user.id
            );

            user.x = msg.position.x;
            user.y = msg.position.y;
          }

          if(msg.type == "shoot")
          {
            toAll(
              '{"type":"shoot","id":"'+user.id+'","action":"'+msg.action+'","direction":"'+msg.direction+'","position":{"x":'+msg.position.x+',"y":'+msg.position.y+'} }',
              user.id
            );
            user.x = msg.position.x;
            user.y = msg.position.y;
          }

          if(msg.type == "getMap")
          {

            if( map[msg.cords] ) {

              var message = { "type":"mapData" };
              message.map = map[msg.cords];

              sendUTF(user.id, JSON.stringify(message));

            }else{
              console.log("The requested cordinates where not a map cordinate. x: "+msg.x+" y:"+msg.y);
            }
          }

          if(msg.type == "enemyHit"){
            if(enemies[msg.id]){
              // Make sure the enemie wasnt dead before (inevitable lag shizzle)
              enemies[msg.id].hit(msg.dmg);
            }
          }
          if(msg.type == "playerHit"){

            if(users[msg.id]){
              users[msg.id].hit(msg.dmg);
            }

          }

        }    
      } else console.log("invalid json: "+message.utf8Data);
    }
  });

  user.connection.on('close', function(reasonCode, description) {
    toAll('{"type":"userQuit","id":'+user.id+'}');
    delete users[user.id];
  }); 
});

function toAll(msg,exeption){
 // console.log("toAll: "+msg)//+" exeption: "+exeption);

  for (i in users){
    if(users[i].id != exeption)
    {
      sendUTF(users[i].id, msg);
    }
  }
}

function isJson(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        console.log(e);
        return false;
    }
    return true;
}

function getCommandMap(callback){
  fs.readFile(__dirname + '/../website/js/commandMap.json', 'utf8', function (err, data) {
    if (err) {
      console.log(err);
      return;
    }
   
    if(isJson(data)){
      callback(JSON.parse(data));
    }else{
      console.log("Error reading command map");
    }
  });
}

function sendUTF(userId, msg){

  if(globals.useTimeStamps){
    msg = JSON.parse(msg);
    msg.timeStamp = new Date().getTime();
    msg = JSON.stringify(msg);
  }

  globals.commandMap.commands.forEach(function(command, key){


    var find = '"'+command+'"';
    var re = new RegExp(find, 'g');

    msg = msg.replace(re,'"'+key+'"');
  });

  addToStack(userId, msg);
}

function parseMsg(msg){

  globals.commandMap.commands.forEach(function(command, key){

    var find = '"'+key+'"';
    var re = new RegExp(find, 'g');

    msg = msg.replace(re,'"'+command+'"');
  });

  return msg;
}


function setStackInterval(){
  setInterval(emptyStack, globals.stackSpeed);
}

function addToStack(userId, msg){
  if( typeof messageStack[userId] == 'undefined'){
    messageStack[userId] = [];
  }

  messageStack[userId].push(msg);
}

function emptyStack(){

  for (userId in messageStack){

    if(users[userId] == null){
      console.log("fail");
      /*
        When a user quits the stack of the user should be emptied but somehow delete mmessageStack[userId] doesn't do the trick
        Should be fixed probaply
      */
      continue;
    }

    if(messageStack[userId].length > 0 ){
      message = [];
      messageStack[userId].forEach(function(msg){
        message.push(JSON.parse(msg));
      });

      users[userId].connection.sendUTF(JSON.stringify(message));
    }
  }

  messageStack = {};

}

function emptyStackFromUser(userId){
  delete messageStack[userId];
}

function autoGenerateMap(){
  
  for (var y = -globals.mapSize; y < globals.mapSize; y++) {
    for (var x = -globals.mapSize; x < globals.mapSize; x++) { 

      var tileMap = new Map(x*1920, y*1080);


      var tiles = {};

      for(var f1 = 0; f1 < 10; f1++){
        for(var f2 = 0; f2 < 10; f2++){
          tiles[f1*192+","+f2*108] = {
            'x':f1*192,
            'y':f2*108,
            "image":"tile-1"
          }
        }
      }

      tileMap['tiles'] = tiles;

      for(var i = 0; i < 5; i++){

        var tX = Math.floor((Math.random()*1920)+1);
        var tY  = Math.floor((Math.random()*1080)+1);

        tileMap.objects.push(
          {
            "type":"rock",
            "x":tX,
            "y":tY
          }
        );
      }

      for(var i = 0; i < 3; i++){

        var tX = Math.floor((Math.random()*1900)+21);
        var tY = Math.floor((Math.random()*1060)+21);

        var enemy = new Enemy("spriteGod", tX, tY, 2000); 

        /* SHOULD BE FIXED THE enemy.getchunk() because this wil only work for non moving enemies (kinda) */
        enemy.chunk = x*1920+","+y*1080;

        tileMap.enemies[enemy.id] = enemy;
      }


      map[x*1920+","+y*1080] = tileMap;

    }
  }

  console.log("Loaded Map");

}

function generateId(){
  var a = false;
  var id;

  while(a == false)
  {
    var id = Math.floor((Math.random()*1000000)+1);
    var b = true;
    for (key in users) {
      if(id == key) b = false;
    } 
    for (key in enemies) {
      if(id == key) b = false;
    } 

    if(b==true) a=true;
  }

  return id;
}

function lowerTo(number, target){
  var temp = number / target;
  temp = Math.floor(temp);

  return temp * target
}
