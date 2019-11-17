"use strict";

// global variables
var program, canvas, gl;
var numDivisions = 3;
var index = 0;
var mvm_loc;
// coordinate arrays
var vertices = [];
var indVertices = [];
var indices = [];
var normals = [];
var colors = [];
// size of terrain plane
var planeSize = 10;
// size of triangles that make up terrain
var triSize = 0.2;
// length of rows and columns in terrain plane
var rowColLen = planeSize / triSize;
// viewing matrices
var model_view_matrix = [];
var projectionMatrix = [];
var normalMatrix, normalMatrixLoc;
// viewing modes
var wireframe = false;
var flag = true;
// starting coordinate for terrain generation
var seed = [vec4(-5, 0, -5, 1)];
// bounding box for terrain
var maxX = -Infinity;
var minX = Infinity;
var maxZ = -Infinity;
var minZ = Infinity;
// speed of plane
var speed = vec3(0, 0, -0.01);
var pause = false;
// viewing variables
var airplane_position = vec3(0, 1, 0);
var up_vector = vec3(0, 1, 0);
//perspective viewing variables
var fovy = 40;
var aspect = 1;
var near = 0.1;
var far = -1;
//parallel viewing variables
var orth_left = -2;
var orth_right = 2;
var orth_top = 5;
var orth_bottom = -2;
var orth_near = 0;
var orth_far = 5;
var smooth = false;
// true if perspective view, false if orthogonal
var is_perspective = true;
//set altitute min and max
var min_altitude = 0.5;
var max_altitude = 1.5;

window.onload = function init() {
  canvas = document.getElementById("gl-canvas");

  gl = WebGLUtils.setupWebGL(canvas);
  if (!gl) { alert("WebGL isn't available"); }

  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  gl.enable(gl.DEPTH_TEST);

  noise.seed(Math.random());

  // makes terrain
  triangulate();
  firstBoundaryUpdate();
  mountainize();

  // turn terrain into actual vertices that can be used
  getNormalsAndVecs();

  program = initShaders(gl, "vertex-shader", "fragment-shader");
  gl.useProgram(program);

  fillBuffers();

  // ------ add listeners -------

  //parallel or perspective
  document.getElementById("parallelPerspective").onclick = function () {
    is_perspective = !is_perspective;
  }
  document.getElementById("wireframe").onclick = function () {
    wireframe = !wireframe;
  }

  //change speed
  document.getElementById("speedup").onclick = function () {
    speed = scale(1.5, speed);
  }
  document.getElementById("slowdown").onclick = function () {
    speed = scale(1/1.5, speed);
  }

  //changing angles
  document.getElementById("rollCounterclockwise").onclick = function () {
    rollByDegree(355);
  }
  document.getElementById("rollClockwise").onclick = function () {
    rollByDegree(5);
  }
  document.getElementById("yawLeft").onclick = function () {
    yawByDegree(5);
  }
  document.getElementById("yawRight").onclick = function () {
    yawByDegree(355);
  }
  document.getElementById("pitchUp").onclick = function () {
    pitchByDegree(5);
  }
  document.getElementById("pitchDown").onclick = function () {
    pitchByDegree(355);
  }

  // change viewing paramaters
  document.getElementById("orthLeft").oninput = function (event) {
    orth_left = parseFloat(event.srcElement.value);
  }
  document.getElementById("orthRight").oninput = function (event) {
    orth_right = parseFloat(event.srcElement.value);
  }
  document.getElementById("orthTop").oninput = function (event) {
    orth_top = parseFloat(event.srcElement.value);
  }
  document.getElementById("orthBottom").oninput = function (event) {
    orth_bottom = parseFloat(event.srcElement.value);
  }
  document.getElementById("orthNear").oninput = function (event) {
    orth_near = parseFloat(event.srcElement.value);
  }
  document.getElementById("orthFar").oninput = function (event) {
    orth_far = parseFloat(event.srcElement.value);
  }

  document.getElementById("shading").addEventListener('click', function(e) {
    smooth = !smooth;
    fillBuffers();
  });
  render();
}

function fillBuffers() {
  // load data into the GPU
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);
  // associate shader variables with data buffer
  var vPosition = gl.getAttribLocation(program, "vPosition");
  gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vPosition);

  // load colors into the GPU
  gl.bindBuffer( gl.ARRAY_BUFFER, gl.createBuffer() );
  gl.bufferData( gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW );
  // associate shader variables with data buffer
  var vColor = gl.getAttribLocation( program, "vColor" );
  gl.vertexAttribPointer( vColor, 3, gl.FLOAT, false, 0, 0 );
  gl.enableVertexAttribArray( vColor );

  gl.uniform1i(gl.getUniformLocation(program, "smooth"), smooth);

}


function render() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  //identity
  model_view_matrix = mat4();
  updateTerrain();

  if (!pause) {
    moveForward();
  }

  // toggle perspective or parallel
  if (is_perspective) {
    model_view_matrix = makePerspective(model_view_matrix);
  }
  else {
    model_view_matrix = makeParallel(model_view_matrix);
  }

  gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelViewMatrix"), false,
   flatten(model_view_matrix));
  if (wireframe) {
    for (var i = 0; i < vertices.length; i += 3) {
      gl.drawArrays(gl.LINE_LOOP, i, 3);
    }
  } else {
      gl.drawArrays(gl.TRIANGLES, 0, vertices.length);
  }

  requestAnimFrame(render);
}

// check if new terrain needs to be generated
function updateTerrain() {
  var terrainThreshold = planeSize / 3;
  // minX
  if (airplane_position[0] < (minX + terrainThreshold)) {
    minX = minX - planeSize;
    for (var i = 0; i < (maxZ - minZ) / planeSize; i++) {
      seed = [vec4(minX, seed[0][1], minZ + i * planeSize, seed[0][3])];
      terrain();
    }
  }
  // maxX
  if (airplane_position[0] > (maxX - terrainThreshold)) {
    for (var i = 0; i < (maxZ - minZ) / planeSize; i++) {
      seed = [vec4(maxX, seed[0][1], minZ + i * planeSize, seed[0][3])];
      terrain();
    }
    maxX = maxX + planeSize;
  }
  // minZ
  if (airplane_position[2] < (minZ + terrainThreshold)) {
    minZ = minZ - planeSize;
    for (var i = 0; i < (maxX - minX) / planeSize; i++) {
      seed = [vec4(minX + i * planeSize, seed[0][1], minZ, seed[0][3])];
      terrain();
    }
  }
  // maxZ
  if (airplane_position[2] > (maxZ - terrainThreshold)) {
    for (var i = 0; i < (maxX - minX) / planeSize; i++) {
      seed = [vec4(minX + i * planeSize, seed[0][1], maxZ, seed[0][3])];
      terrain();
    }
    maxZ = maxZ + planeSize;
  }
}

// ---- CREATE GEOGRAPHY ----
function triangulate() {
  //splits into a grid of triangles
  indVertices = [];
  indices = [];
  for (var row = 0; row <= rowColLen; row++) {
    for (var col = 0; col <= rowColLen; col++) {
      var x = seed[0][0] + row * triSize;
      var z = seed[0][2] + col * triSize;
      indVertices.push(vec4(x, 0, z, 1));

      if (row !== 0 && col !== 0) {
        var topRight = row * (rowColLen + 1) + col;
        var bottomLeft = topRight - rowColLen - 2;
        indices = indices.concat([bottomLeft, topRight - 1, topRight]);
        indices = indices.concat([bottomLeft, bottomLeft + 1, topRight]);
      }
    }
  }
}

function firstBoundaryUpdate() {
  var v1 = indVertices[0];
  var v2 = indVertices[(rowColLen + 1) * (rowColLen + 1) - 1];
  if (v1[0] < minX) {
    minX = v1[0];
  }
  if (v1[2] < minZ) {
    minZ = v1[2];
  }
  if (v2[0] > maxX) {
    maxX = v2[0];
  }
  if (v2[2] > maxZ) {
    maxZ = v2[2];
  }
}

function mountainize() {
  //creates heights for each (x,y) position
  for (var i = 0; i < indVertices.length; i++) {
    var x = indVertices[i][0];
    var z = indVertices[i][2];
    var y = noise.perlin2(x, z);
    if (y < 0) {
      y = 0;
    }
    indVertices[i] = vec4(x, y, z, 1);
  }
}

function getNormal(a, b, c) {
  let bminusa = subtract(b, a);
  let cminusa = subtract(c, a);
  return cross(bminusa, cminusa);
}

function getNormalsAndVecs() {
  for (let i = 0; i < indices.length; i += 3) {
    let a = indVertices[indices[i]];
    let b = indVertices[indices[i + 1]];
    let c = indVertices[indices[i + 2]];

    vertices.push(a);
    vertices.push(b);
    vertices.push(c);
  }

  // update flat colors
  colors = Array();
  var white = vec3(1.0, 1.0, 1.0);
  var brown = vec3(0.36, 0.25, 0.20);
  var green = vec3(0.4, 1.0, 0.4);
  var blue = vec3(0.0, 0.4, 1.0);
  for (let i = 0; i < vertices.length; i+=3) {
    if (vertices[i+1][1] > 0.45) {
      colors.push(white);
      colors.push(white);
      colors.push(white);
    } else if (vertices[i+1][1] > 0.2) {
      colors.push(brown);
      colors.push(brown);
      colors.push(brown);
    } else if (vertices[i+1][1] > 0.05) {
      colors.push(green);
      colors.push(green);
      colors.push(green);
    } else {
      colors.push(blue);
      colors.push(blue);
      colors.push(blue);
    }
  }
}

// functions involved in terrain generation
function terrain() {
  triangulate();
  mountainize();
  getNormalsAndVecs();
  fillBuffers();
}


// ---- MOVE VIEW ----
function moveForward() {
  // CONSTRAIN ALTITUDE and move forward
  airplane_position = add(speed, airplane_position);
  if (airplane_position[1] < min_altitude) {
    airplane_position[1] = min_altitude;
  }
  else if (airplane_position[1] > max_altitude) {
    airplane_position[1] = max_altitude;
  }
}

function makePerspective(model_view_matrix) {
  // aim the camera
  // define normal direction of motion
  var direction = normalize(new vec3(speed));
  // define looking forward
  var look_at = add(airplane_position, direction);
  // create and multiply the lookat matrix
  var look_at_matrix = lookAt(airplane_position, look_at, up_vector);
  model_view_matrix = mult(look_at_matrix, model_view_matrix);
  // add perspective view matrix
  var perspective_matrix = perspective(fovy, aspect, near, far);
  model_view_matrix = mult(perspective_matrix, model_view_matrix);
  return model_view_matrix;
}

function makeParallel(model_view_matrix){
  // aim camera
  // define normal direction of motion
  var direction = normalize(new vec3(speed));
  // define looking forward
  var look_at = add(airplane_position, direction);
  // look slightly down
  look_at = add(look_at, vec3(0, -0.1, 0));
  // create and multiply the lookat matrix
  var look_at_matrix = lookAt(airplane_position, look_at, up_vector);
  model_view_matrix = mult(look_at_matrix, model_view_matrix);
  // add parallel view matrix
  var parallel_matrix = ortho(orth_left, orth_right, orth_bottom, orth_top,
    orth_near, orth_far);
  model_view_matrix = mult(parallel_matrix, model_view_matrix);
  return model_view_matrix;
}

function rollByDegree(degree){
  // define matrix to rotate around the direction of motion
  var rotate_matrix = rotate(degree, new vec3(speed));

  // rotate the upvector with that matrix
  var current_up = new vec3(up_vector);
  current_up.push(0);
  var new_up = new vec3();
  new_up[0] = dot(rotate_matrix[0], current_up);
  new_up[1] = dot(rotate_matrix[1], current_up);
  new_up[2] = dot(rotate_matrix[2], current_up);

  up_vector = new_up;
}

// define matrix to rotate around the direction of perpindicular to speed and up
function pitchByDegree(degree){
  var rotate_matrix = rotate(degree, cross(speed, up_vector));
  // for pitch rotate about speed cross up, rotate speed vector.

  // rotate the speed with that matrix
  var current_speed = new vec3(speed);
  current_speed.push(0);
  var new_speed = new vec3();
  new_speed[0] = dot(rotate_matrix[0], current_speed);
  new_speed[1] = dot(rotate_matrix[1], current_speed);
  new_speed[2] = dot(rotate_matrix[2], current_speed);

  speed = new_speed;
}

function yawByDegree(degree){
  // define matrix to rotate around the direction of up-vector
  var rotate_matrix = rotate(degree, new vec3(up_vector));

  // rotate the speed with that matrix
  var current_speed = new vec3(speed);
  current_speed.push(0);
  var new_speed = new vec3();
  new_speed[0] = dot(rotate_matrix[0], current_speed);
  new_speed[1] = dot(rotate_matrix[1], current_speed);
  new_speed[2] = dot(rotate_matrix[2], current_speed);

  speed = new_speed;
}
