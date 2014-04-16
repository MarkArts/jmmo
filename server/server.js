var WebSocketServer = require('websocket').server;
var http = require('http');
var fs = require('fs');

var server = http.createServer();
var globals = require('./globals');

var users = globals.users;
var map = globals.map;
/*
  
    x altijd deelbaar door 1920
    y altijd deelbaat door 1080

  {
    "x,y":{
     "users": [],
     "npcs": [],
     "enemies" : []
    }

    "x,y":[ objects ],
    "x,y":[ objects ],
    "x,y":[ objects ],
    "x,y":[ objects ],
    "x,y":[ objects ],
    "x,y":[ objects ],
  }

*/


var messageStack = {};

var Map = function(x,y){
  this.x = x;
  this.y = y;

  this.users;
  this.npcs;
  this.enemies;
}

var User = function(){
  
  this.connection;

  this.x;
  this.y;
  this.id;
  
  this.hp;
  this.lvl;
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
  
  user.x = globals.startX;
  user.y = globals.startY;
  user.lvl = globals.startLvl;
  user.hp = globals.startHp;

  var a = false;
  while(a == false)
  {
    user.id = Math.floor((Math.random()*1000000)+1);
    var b = true;
    for (var i=0; i < users.length; i++) {
      if(user.id==users[i].id) b = false;
    } 
    if(b==true) a=true;
  }
  
  users[user.id] = user;
  
  sendUTF(user.id, '{"type":"id","user":{"id":'+user.id+',"lvl":1,"hp":1000,"x":'+user.x+',"y":'+user.y+'}}');
  
  var all  = {"type":"allUsers","users":[]};

  for ( i in users) {
    if(users[i].id != user.id){
      var obj = {"id":users[i].id,"lvl":users[i].lvl,"hp":users[i].hp,"x":users[i].x,"y":users[i].y}
      all.users.push(obj);
    }
  }

  sendUTF(user.id, JSON.stringify(all));
  
  toAll('{"type":"newUser","user":{"id":'+user.id+'}}');
  console.log(user.id+" connected");
  
  user.connection.on('message', function(message) {
    if(message.type=="utf8"){
      console.log('Received Message from '+user.id);
      if(isJson(message.utf8Data))
      {
        var msg = parseMsg(message.utf8Data);
        msg = JSON.parse(msg);

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

          if( (msg.x % 1920) != 0 && (msg.y % 1080) != 0 ){
            var mapData = map[msg.x+","+msg.y];
            
            var message = { "type":"mapData" };
            message.map = mapData;

            sendUTF(JSON.stringify(message));

          }else{
            console.log("The requested cordinates where not a map cordinate. x: "+msg.x+" y:"+msg.y);
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
    msg = msg.replace('"'+command+'"','"'+key+'"');
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

    message = [];
    messageStack[userId].forEach(function(msg){
      message.push(JSON.parse(msg));
    });

    users[userId].connection.sendUTF(JSON.stringify(message));
  }

  messageStack = {};

}

function emptyStackFromUser(userId){
  delete messageStack[userId];
}

function autoGenerateMap(){
  
  for (var y = -20; y < 20; y++) {
    for (var x = -20; x < 20; x++) { 
      map[x*1920+","+y*1080] = new Map(x*1920,y*1080);
    }
  }

  console.log(map);

}