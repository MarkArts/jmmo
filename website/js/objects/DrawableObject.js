var DrawableObject = function(args){
  
  this.spdX = 0;
  this.spdY = 0;

  for( key in args){
    this[key] = args[key];
  }

  this.dom = document.createElementNS("http://www.w3.org/2000/svg","use");
  this.dom.setAttribute("id",this.id);
  this.dom.setAttributeNS('http://www.w3.org/1999/xlink',"xlink:href","#"+this.image);

  this.intrs = [];

  this.addToWindow(this,function(){
    
    this.update();

    objects[this.id] = this;
    this.intrs['update'] = setInterval(this.update.bind(this) ,updateSpeed,this);
  
  }.bind(this));

  this.width = $("#"+this.image)[0].getBBox().width;
  this.height = $("#"+this.image)[0].getBBox().height;
}

DrawableObject.prototype.addToWindow = function(parent, callback) {

  $(parent.dom.setAttribute("fill",getRandomColor()));

  $("#main").append(parent.dom);

  callback();
};

DrawableObject.prototype.update = function(){

  this.dom.setAttribute("transform","translate("+this.x+","+this.y+")");

  this.x = this.x + this.spdX;
  this.y = this.y + this.spdY;
}

DrawableObject.prototype.quit = function(){

  $("#"+this.id).remove();

  clearIntertvalArray(this.intrs);

  delete objects[this.id];
}