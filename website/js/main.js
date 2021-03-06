$(window).ready(function(){
  console.log("ready");

  if ('WebSocket' in window){


    if(getHashValue("server")){
     addres = getHashValue("server");
    };

    offsetX = 0;
    offsetY = 0;

  getCommandMap(function(map){
    commandMap = map;

    Connection(function(){ //Starts the Connection (js/Connection)
      inputHandlers();
      initCanvas();

      setStackInterval();
      getMap();

      resize();
      $(window).resize(resize);

      setInterval(update, updateSpeed);
    });              
  });


  } else {
     console.log("to bad"); // Browser can't use websockets
  }
});



var lastUpdate = null;
var wasLagging = 0;

function update(array){
  
  var date =  new Date().getTime();

  if(date - lastUpdate > updateSpeed * 2){
    wasLagging++;
    
    if(wasLagging > 2){
      lagging = true;
      removeAllBullets();
    }
  }else{
    wasLagging = 0;
    lagging = false;
  }

  if(playerId > 0 ){
    offsetX = objects[playerId].x - standartWidth / 2;
    offsetY = objects[playerId].y - standartHeight / 2;
  }

  checkMap();

  lastUpdate = date;
}

function resize(){
  resizeCanvas();
}


function isJson(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

function getRandomColor() {
    var letters = '0123456789ABCDEF'.split('');
    var color = '#';
    for (var i = 0; i < 6; i++ ) {
      color += letters[Math.round(Math.random() * 15)];
    }
    return color;
}

function getCommandMap(callback){
  $.get('js/commandMap.json',function(data){
    callback(data);
  });
}

function clearIntertvalArray(array){

  for(key in array){

    if( typeof array[key] === 'object') {
      clearIntertvalArray(array[key]);
    }else{
      clearInterval(array[key]);
    }
  
  }

}


function getHashValue(key) {  
  if(location.hash)
    return location.hash.match(new RegExp(key+'=([^&]*)'))[1];

  return false;
}

function extend(subClass, superClass) {

    var F = function() {};

    F.prototype = superClass.prototype;

    subClass.prototype = new F();
    subClass.prototype.constructor = subClass;
    subClass.superclass = superClass.prototype;

    if(superClass.prototype.constructor === Object.prototype.constructor) {
        superClass.prototype.constructor = superClass;
    }
};

function getNewId(){
  var id = 0;

  var isUniquId = false;
  while(isUniquId == false)
  {
    id = Math.floor((Math.random()*1000000)+1);
    if(objects[id] != false){
      isUniquId = true;
    }
  }

  return id;

}


function checkMap(){

  currentX = lowerTo(offsetX, standartWidth);
  currentY = lowerTo(offsetY, standartHeight);


  if(mapState.current != currentX+","+currentY){



    for(var x = -2; x < 3; x++){
      for(var y = -2; y < 3; y++){
        
        if(y < -1 || y > 1 || x < -1 || x > 1){

          if(mapState.loaded[ (currentX - (standartWidth * x)) +","+ (currentY - (standartHeight * y)) ] != null ){
            dropMap((currentX - (standartWidth * x)) +","+ (currentY - (standartHeight * y)));
          }
        }
      }
    }

    for(var x = -1; x < 2; x++){
      for(var y = -1; y < 2; y++){
        if(mapState.loaded[ (currentX - (standartWidth * x)) +","+ (currentY - (standartHeight * y)) ] == null ){
          getMap((currentX - (standartWidth * x)) +","+ (currentY - (standartHeight * y)));
        }
      }
    }

    mapState.current = currentX+","+currentY;
  }
}

function lowerTo(number, target){
  var temp = number / target;
  temp = Math.floor(temp);

  return temp * target
}


function loadMap(map){

  var objects = {};

  for(obj in map.objects){
    obj = map.objects[obj];

    if(obj.type == "rock"){
      var rock = new Rock(obj.x + map.x, obj.y + map.y);
      objects[rock.id] = rock;
    }

  }
  map.objects = objects;


  var enemies = {};

  for(enemy in map.enemies){
      enemy = map.enemies[enemy];
      var spriteGod = new SpriteGod(enemy.id, enemy.x + map.x, enemy.y + map.y);
      enemies[spriteGod.id] = spriteGod;

  }
  map.enemies = enemies;

  var tiles = {};

  for(tile in map.tiles){
    tile = map.tiles[tile];
    var mapTile = new MapTile(map.x + tile.x, map.y + tile.y, tile.image);
    tiles[mapTile.id] = mapTile;
  }

  map.tiles = tiles;

  cord = map.x + "," + map.y;
  mapState.loaded[cord] = map;
}

function dropMap(cord){
  console.log("Dropping Map: "+cord);
  
  for(objId in mapState.loaded[cord].tiles){
    mapState.loaded[cord].tiles[objId].quit();
  }

  for(objId in mapState.loaded[cord].objects){
    mapState.loaded[cord].objects[objId].quit();
  }

  for(objId in mapState.loaded[cord].enemies){
    mapState.loaded[cord].enemies[objId].quit();
  }

  delete mapState.loaded[cord];
}


function getMap(cord){

  console.log("Loading map: "+cord);

  mapState.loaded[cord] = "loading";
  sendUTF('{"type":"getMap","cords":"'+cord+'" }');

}

function removeAllBullets(){

  /* Not working yet */

  console.log("removingAll");

  for (var id in objects){
    if( objects[id].type == "bullet" ){
      objects[id].quit();
    }
  }
}