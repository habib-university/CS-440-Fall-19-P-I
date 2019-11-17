var gl;

var size = Math.pow(2, 4) + 1;
var map = [];
var max = size - 1;
var roughness = 0.5; // between 0 and 1
                     // smooth is near 0 mountainous is near 1

var fColor;
var near = -10;
var far = 10;
const black = vec4(0.0, 0.0, 0.0, 1.0);
const red = vec4(1.0, 0.0, 0.0, 1.0);
const blue = vec4(0.0, 0.0, 1.0, 1.0);
const green = vec4(0.0, 1.0, 0.0, 1.0);
const white = vec4(1.0, 1.0, 1.0, 1.0);
const brown = vec4(0.4, 0.3, 0.1, 1.0);


// Model View Variables
var at = vec3(0.0, 0.6, 0.0);
var up = vec3(0.0, 1.0, 0.0);
var eye = vec3(0, 0.6, -1);
// console.log(eye[2]);

// Ortho projection
var left = -1.0;
var right = 1.0;
var ytop = 1.0;
var bottom = -1.0;

// Parallel projection
var fov = 60;

var modeViewMatrix, projectionMatrix;
var modelViewMatrixLoc, projectionMatrixLoc;

// holds vertices
var vertices = [];

// container to hold chunks
var chunks = [];

// boolean to control fill and blend toggles
var fill = true;
var blend = false;

var perspectiveView = true;

//tilt angle
var tiltA = 0.0;

//yaw angle
var yawA = 0.0;

//roll angle
var rollA = 0.0;

//speed of the plane
var speed = 0.005;

//direction of the plane
var direction;
var velocity;

//for chunk generation
var chunkAdded = false;
var initx = 0;
var initz = 0;
var xmove = 0;
var zmove = 0;
var zpos = 2;
var zneg = -2;
var xpos = 2;
var xneg = -2;

var vBufferId;

window.onkeydown = function(e) {
   var key = e.keyCode ? e.keyCode : e.which;

   if (key == 87) { // w -- pitch up
    tiltA+=1;
    at[1]+=Math.cos(tiltA * Math.PI/180)/10;
    at[2]+=Math.sin(tiltA * Math.PI/180)/10;
   }
   if (key == 83) { // s -- pitch down
     tiltA-=1;
      at[1]-=Math.cos(tiltA * Math.PI/180)/10;
      at[2]-=Math.sin(tiltA * Math.PI/180)/10;
   }
   if (key == 65) { // a -- yaw left
     yawA-=0.1;
      at[0]-=Math.cos(yawA * Math.PI/270)/10;
      at[2]-=Math.sin(yawA * Math.PI/270)/10;
   }
   if (key == 68) { // d -- yaw right
     yawA+=0.1;
      at[0]+=Math.cos(yawA * Math.PI/180)/10;
      at[2]+=Math.sin(yawA * Math.PI/180)/10;
   }

   if (key == 81) { //q -- roll left
      rollA -= 1.0;
      up[1] -= Math.sin(rollA * Math.PI/180)/10;
      up[0] -= Math.cos(rollA * Math.PI/180)/10;
   }

   if (key == 69 ) { //e  -- roll right
      rollA += 1.0;
      up[1] += Math.sin(rollA * Math.PI/180)/10;
      up[0] += Math.cos(rollA * Math.PI/180)/10;
   }
   if (key == 84) { // t
     fill = !fill;
     render();
   }
   if (key == 82) { // r
     blend = !blend;
     render();
   }
   if (key == 66) { // b
     perspectiveView = !perspectiveView;
     render();
   }
   if (key == 90){//z
     left  *= 0.9; right *= 0.9;
   }
   if(key == 88){//x
     left *= 1.1; right *= 1.1;
   }
   if(key == 67){//c
     ytop  *= 0.9; bottom *= 0.9;
    fov+=5;
   }
   if(key == 86){//v
     ytop *= 1.1; bottom *= 1.1;
     fov-=5;
   }
   if(key == 38){//up
     speed*=2;
   }
   if(key == 40){//down
      speed/=2;
   }

}

window.onload = function init()
{
    var canvas = document.getElementById( "gl-canvas" );

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( .52, .8, .92, 1.0 );
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.0, 2.0);

    for (var i = 0; i < size; i++) {
      map[i] = new Array();
      for (var j = 0; j < size; j++) {
        map[i][j] = 0;
      }
    }
    map[0][0] = 0.4;
    map[max][0] = 0.4;
    map[max][max] = 0.4;
    map[0][max] = 0.4;
    divide(max);

    chunks.push(createChunk(2, 2));
    chunks.push(createChunk(2, 0));
    chunks.push(createChunk(2, -2));
    chunks.push(createChunk(0,0));
    chunks.push(createChunk(0, 2))
    chunks.push(createChunk(0, -2))
    chunks.push(createChunk(-2,0));
    chunks.push(createChunk(-2,-2));
    chunks.push(createChunk(-2,2));

    // make initial chunks
    for (let i = 0; i < chunks.length; i++) {
      vertices = vertices.concat(chunks[i]);
    }

    //  Load shaders and initialize attribute buffers
    //
    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    vBufferId = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vBufferId );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(vertices), gl.DYNAMIC_DRAW);

    var vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );

    fColor = gl.getUniformLocation(program, "fColor");

    modelViewMatrixLoc = gl.getUniformLocation( program, "modelViewMatrix" );
    projectionMatrixLoc = gl.getUniformLocation( program, "projectionMatrix" );

    render();
}

function render()
{
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    modelViewMatrix = lookAt( eye, at, up );
    if(perspectiveView){
      projectionMatrix = perspective(fov, gl.canvas.width/gl.canvas.height, 0.1, 6);
    } else{
      projectionMatrix = ortho(left, right, bottom, ytop, near, far);
    }

    gl.uniformMatrix4fv( modelViewMatrixLoc, false, flatten(modelViewMatrix) );
    gl.uniformMatrix4fv( projectionMatrixLoc, false, flatten(projectionMatrix) );
    if (chunkAdded) {
      chunkAdded = false;
      vertices=[];
      for (let i = 0; i < chunks.length; i++) {
        vertices = vertices.concat(chunks[i]);
      }
      gl.bindBuffer( gl.ARRAY_BUFFER, vBufferId );
      gl.bufferData( gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);
    }

    drawChunk(vertices);


    move(); //move forward according to direction
    requestAnimFrame(render);
}

function divide(size) {
  var x,y, half = size/2;
  var scale = roughness;
  if (half < 1) return;

  for (y = half; y < max; y += size) {
    for (x = half; x < max; x += size) {
      square(x, y, half, Math.random()*scale*2-scale);
    }
  }

  for (y = half; y < max; y += size) {
    for (x = half; x < max; x += size) {
      diamond(x, y, half, Math.random()*scale*2-scale);
    }
  }
  divide(size/2);
}

function diamond(x, y, size, offset) {
  var average = map[x][y-size]+
  map[x][y+size]+
  map[x+size][y]+
  map[x-size][y];
  average /= 4;
  if (average + offset < 0) {
    map[x][y] = 0;
  }
  else {
    map[x][y] = average + offset;
  }
}

function square(x, y, size, offset) {
  var average = map[x][y]+
  map[x][y+size]+
  map[x+size][y]+
  map[x+size][y+size];
  average /= 4;
  if (average + offset < 0) {
    map[x][y] = 0;
  }
  else {
    map[x][y] = average + offset;
  }
}

function drawChunk(arr) {
  for(var i=0; i<arr.length; i+=3) {
    var max = Math.max(arr[i][1],arr[i+1][1],arr[i+2][1]);
      if(fill){
          if(max<=0){
            gl.uniform4fv(fColor, flatten(blue));
          } else if(max<=0.2){
            gl.uniform4fv(fColor, flatten(green));
          } else if(max<=0.4){
            gl.uniform4fv(fColor, flatten(brown));
          } else if(max<=0.6){
            gl.uniform4fv(fColor, flatten(white));
          } else{
            gl.uniform4fv(fColor, flatten(red));
          }
          gl.drawArrays( gl.TRIANGLES, i, 3 );
          gl.uniform4fv(fColor, flatten(black));
          gl.drawArrays( gl.LINE_LOOP, i, 3 );
      } else{
        if(max<=0){
          gl.uniform4fv(fColor, flatten(blue));
        } else if(max<=0.2){
          gl.uniform4fv(fColor, flatten(green));
        } else if(max<=0.4){
          gl.uniform4fv(fColor, flatten(brown));
        } else if(max<=0.6){
          gl.uniform4fv(fColor, flatten(white));
        } else{
          gl.uniform4fv(fColor, flatten(red));
        }
        gl.drawArrays( gl.LINE_LOOP, i, 3 );
      }
  }
}

function generateVertices() {
  var points = []
  for(var i=0; i<size; i++) {
    for(var j=0; j<size;j++) {
      if (i == size-1 && j == size-1) {
          points.push(vec4(2*i/size-1, fade(map[i][j]), 2*j/size-1, 1.0));
          points.push(vec4(2*(i+1)/size-1, fade(map[i][j]), 2*j/size-1, 1.0));
          points.push(vec4(2*i/size-1, fade(map[i][j]), 2*(j+1)/size-1, 1.0));

          points.push(vec4(2*(i+1)/size-1, fade(map[i][j]), 2*j/size-1, 1.0));
          points.push(vec4(2*(i+1)/size-1, fade(map[i][j]), 2*(j+1)/size-1, 1.0));
          points.push(vec4(2*i/size-1, fade(map[i][j]), 2*(j+1)/size-1, 1.0));
        }
        if (i == size-1 && j != size-1) {
          points.push(vec4(2*i/size-1, fade(map[i][j]), 2*j/size-1, 1.0));
          points.push(vec4(2*(i+1)/size-1, fade(map[i][j]), 2*j/size-1, 1.0));
          points.push(vec4(2*i/size-1, fade(map[i][j+1]), 2*(j+1)/size-1, 1.0));

          points.push(vec4(2*(i+1)/size-1, fade(map[i][j]), 2*j/size-1, 1.0));
          points.push(vec4(2*(i+1)/size-1, fade(map[i][j+1]), 2*(j+1)/size-1, 1.0));
          points.push(vec4(2*i/size-1, fade(map[i][j+1]), 2*(j+1)/size-1, 1.0));
        }
        if (j == size-1 && i != size-1) {
          points.push(vec4(2*i/size-1, fade(map[i][j]), 2*j/size-1, 1.0));
          points.push(vec4(2*(i+1)/size-1, fade(map[i+1][j]), 2*j/size-1, 1.0));
          points.push(vec4(2*i/size-1, fade(map[i][j]), 2*(j+1)/size-1, 1.0));

          points.push(vec4(2*(i+1)/size-1, fade(map[i+1][j]), 2*j/size-1, 1.0));
          points.push(vec4(2*(i+1)/size-1, fade(map[i+1][j]), 2*(j+1)/size-1, 1.0));
          points.push(vec4(2*i/size-1, fade(map[i][j]), 2*(j+1)/size-1, 1.0));
        }
        if (i != size-1 && j != size-1) {
          points.push(vec4(2*i/size-1, fade(map[i][j]), 2*j/size-1, 1.0));
          points.push(vec4(2*(i+1)/size-1, fade(map[i+1][j]), 2*j/size-1, 1.0));
          points.push(vec4(2*i/size-1, fade(map[i][j+1]), 2*(j+1)/size-1, 1.0));

          points.push(vec4(2*(i+1)/size-1, fade(map[i+1][j]), 2*j/size-1, 1.0));
          points.push(vec4(2*(i+1)/size-1, fade(map[i+1][j+1]), 2*(j+1)/size-1, 1.0));
          points.push(vec4(2*i/size-1, fade(map[i][j+1]), 2*(j+1)/size-1, 1.0));
        }
    }
  }
  divide(max);
  return points;
}

function createChunk(zoffset, xoffset){
  var grid = generateVertices();
  for (let i = 0; i < grid.length; i++) {
    if (zoffset > 0) {
      grid[i][2] += zoffset;
    }
    if (zoffset < 0) {
      grid[i][2] += zoffset;
    }
    if (xoffset > 0) {
      grid[i][0] += xoffset;
    }
    if (xoffset < 0) {
      grid[i][0] += xoffset;
    }
  }
  return grid;
}

function fade(t) {
  return t*t*t*(t*(t*6-15)+10);
}

function move(){
  direction = normalize(subtract(at, eye));
  velocity = vec3(direction[0]*speed,direction[1]*speed, direction[2]*speed);
  eye = add(eye, velocity);
  at = add(at, velocity);
  var z_index = Math.floor((eye[2]+3)/2) % 3;
  if(eye[1]<0.3||eye[1]>0.7){
    eye[1] = 0.6;
    at[1]=0.6;
  }
  console.log(eye[1]);
  if (Math.abs(eye[2] - initz) >= 2) {
    chunkAdded = true;
    if (eye[2] > 0) {
      if (mod(Math.floor(eye[2]),2) == 0) {
        zmove = Math.floor(eye[2]) + 2;
      }
      else {
        zmove = (Math.floor(eye[2]) + 1)*2;
      }
      z_grids(zmove, xmove);
      initz = eye[2];
    }
    if (eye[2] < 0) {
      if (mod(Math.floor(eye[2]),2) == 0) {
        zmove = Math.floor(eye[2]) - 2;
      }
      else {
        zmove = (Math.floor(eye[2]) - 1)*2;
      }
      z_grids(zmove, xmove);
      initz = eye[2];
    }
  }

  if (Math.abs(eye[0] - initx) >= 2) {
    chunkAdded = true;
    if (eye[0] > 0) {
      if (mod(Math.floor(eye[0]),2) == 0) {
        xmove = Math.floor(eye[0]) + 2;
      }
      else {
        xmove = (Math.ceil(eye[0]) + 1)*2;
      }
      x_grids(zmove, xmove);
      initx = eye[0];
    }
    if (eye[0] < 0) {
      if (mod(Math.floor(eye[0]),2) == 0) {
        xmove = Math.floor(eye[0]) - 2;
      }
      else {
        xmove = (Math.ceil(eye[0]) - 1)*2;
      }
      x_grids(zmove, xmove);
      initx = eye[0];
    }
  }
}

function z_grids(zmov, xmov) {
  chunks.push(createChunk(zmov, xmov));
  chunks.push(createChunk(zmov, xmov-2));
  chunks.push(createChunk(zmov, xmov+2));
}

function x_grids(zmov, xmov) {
  chunks.push(createChunk(zmov, xmov));
  chunks.push(createChunk(zmov-2, xmov));
  chunks.push(createChunk(zmov+2, xmov));
}

function mod(n, m) {
  return ((n % m) + m) % m;
}
