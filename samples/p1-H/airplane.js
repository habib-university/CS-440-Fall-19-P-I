// this value is the elevation of the corners of the map.
// the generated corners will all share this elevation so the
// transitions will be smooth on infinite flying
var RAND_CORNER_SIZE = Math.random() * (.1- (-.45)) + -.45;

var gl;
var numPoints;
var program;
var movementLoc;

var yValsVertical = [];
var yValsSides = [];
var xmin = 0;
var xmax = 0;
var ymin = 0;
var ymax = 0;
var grid = [];
var gridSize = 8;
var width = 33;
var depth = 33;

// array for normals for flat shading
var normalFlat = [];
// var vertices = [];
var colors = [];
var flatColors = [];
var groundLevel = 0;

//how to render colors/polygons
var wireframe = false;
var flatShading = true;
var smoothShading = false;

//pause movement
var pause = false;
//autopilot
var autopilot = false;

//true is parallel
var projectionType = false;

// multiplier effectively changes the fov for parallel viewing
// smaller is like zooming
var multiplier = 1.3;
// changes the altitude of the parallel camera
var altitude = 1;

// fov parameter for projection viewing
var fov = 60;
//default vals for projection
var aspect;

var flightMovement = vec3(0,0,0);

// Initial camera position
var cameraPos = vec3(0.0, 1.5, 0.0);

var pitch = 0;
var yaw = 0;
var roll = 0;

// Vectors used to computer the camera in the lookat functions
var right = vec3(1.0, 0.0, 0.0);
var forward = vec3(0.0, 0.0, -1.0);
var up = vec3(0.0, 1.0, 0.0);

// Speed variable
var speed = vec3(0.007, 0.007, 0.007);

//Max and min heights for the plane
var maxHeight = 3;
var minHeight = 0.7;

function randomIntFromInterval(min,max){
    return Math.floor(Math.random()*(max-min+1)+min);
}

window.onload = function init()
{
    //set up
    var canvas = document.getElementById( "gl-canvas" );

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;

    gl.enable(gl.DEPTH_TEST);


    //  Configure WebGL
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 0.0, 0.0, 0.0, 1.0 );

    //  Load shaders and initialize attribute buffers
    program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

        // KEYBOARD FUNCTIONALITY
    document.addEventListener('keydown', function(event) {
        switch(event.keyCode){
            case 38:
                // Button for speeding up
                if(speed[1] < 0.05){
                    speed = add(speed, vec3(0.001,0.001,0.001));
                }
                break;
            case 40:
                // Button for slowing down
                if(speed[1] > 0.003){
                    speed = subtract(speed, vec3(0.001,0.001,0.001));
                }
                break;
            case 87:
                // Button for controlling the upward pitch
                if(pitch < 0){
                    pitch = 0;
                }
                pitch += 0.25;
                pitchFun(radians(pitch));

                break;
            case 68:
                // Button for controlling right roll
                if(roll > 0){
                    roll =0;
                }
                roll -= 0.01;
                rollFun(roll);

                break;

            case 65:
                // Button for controlling left roll
                if(roll < 0){
                   roll =0;
                }
                roll += 0.01;
                rollFun(roll);

                break;
            case 83:
                // Button for controlling the downward pitch
                if(pitch > 0){
                    pitch = 0;
                }
                pitch -= 0.25;
                pitchFun(radians(pitch));
                break;
            case 69:
                // Button for controlling the right yaw
                if(yaw > 0) {
                    yaw = 0;
                }
                yaw -= 0.25;
                yawFun(radians(yaw));
                break;
            case 81:
                // Button for controlling the right yaw
                if(yaw < 0){
                    yaw = 0;
                }
                yaw += 0.25;
                yawFun(radians(yaw));
                break;
        }
    });

    // BUTTONS
    document.getElementById('Parallel').onclick = function(){
        projectionType = true;
    };

    document.getElementById('Perspective').onclick = function(){
        projectionType = false;
    };

    document.getElementById('Wireframe').onclick = function(){
        wireframe = true;
    };
    document.getElementById('Smooth').onclick = function(){
        wireframe = false;
        smoothShading = true;
        flatShading = false;
    };

    document.getElementById('Flat').onclick = function(){
        wireframe = false;
        flatShading = true;
        smoothShading = false;
    };

    document.getElementById('pauseButton').onclick = function(){
        pause = true;
    };

    document.getElementById('playButton').onclick = function(){
        pause = false;
    };

    document.getElementById('AutoButton').onclick = function(){
        autopilot = !autopilot;
    };

    // SLIDERS
    document.getElementById("parallelFOV").oninput = function (){
        multiplier = this.value* .01;
    };

    document.getElementById("perspectiveFOV").oninput = function (){
        fov = this.value;
    };

    // Compute data.
    getStarterGrid();

    render();
};

// Calculate the pitch and adjust the up and forward vectors
function pitchFun(angle){
  var cos = vec3(Math.cos(angle),Math.cos(angle),Math.cos(angle));
  var sin = vec3(Math.sin(angle),Math.sin(angle),Math.sin(angle));
  var pitchAmount = add(mult(forward,cos), mult(up, sin));
  forward = normalize(pitchAmount);
  up = cross(right, forward);
}

// Calculate the roll and use this to update the up vector
function rollFun(angle){
    var cos = vec3(Math.cos(angle),Math.cos(angle),Math.cos(angle));
  var sin = vec3(Math.sin(angle),Math.sin(angle),Math.sin(angle));
  right = normalize(add((mult(right, cos)), mult(up, sin)));
  up = cross(right, forward);
}

// Calculate the yaw and update the forward vector accordingly
function yawFun(angle){
  var cos = vec3(Math.cos(angle),Math.cos(angle),Math.cos(angle));
  var sin = vec3(Math.sin(angle),Math.sin(angle),Math.sin(angle));
  right = normalize(add((mult(right, cos)), mult(forward, sin)));
  forward = cross(up, right);
}

// This function creates the viewing camera
// Here we also handle the parallel and perspective viewing
function setCamera(){
    var camera;
    var projectionMatrixLoc;
    var projectionMatrix;
    var near = 0.1;
    var far = 8;

    camera = lookAt(cameraPos, add(cameraPos, forward) , up);
    if(projectionType){
        projectionMatrix = mult(ortho(-1*multiplier, 1*multiplier,
          -1*multiplier, 1*multiplier, -1*multiplier, 1*multiplier), camera);
    }else{
        projectionMatrix = mult(perspective( fov, aspect, near, far ), camera);
    }

    projectionMatrixLoc = gl.getUniformLocation(program, "projection");
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

}

// These are all functions for the autopilot functionality

// Function to determine speed up
function autoSpeed_fast(interval){
    for(var i = 0; i < interval; i++){
        if(speed[1] < 0.05){
            speed = add(speed, vec3(0.001,0.001,0.001));
        }
    }
}

// Function to determine speed down
function autoSpeed_slow(interval){
    for(var i = 0; i < interval; i++){
        if(speed[1] > 0.003){
            speed = subtract(speed, vec3(0.001,0.001,0.001));
        }
    }
}

// Function to yaw towards the left
function turn_left(interval){
    for(var i = 0; i < interval; i++){
        if(yaw < 0){
            yaw = 0;
        }
        yaw += 0.25;
        yawFun(radians(yaw));
    }
}

// Function to yaw towards the right
function turn_right(interval){
    for(var i = 0; i < interval; i++){
        if(yaw > 0){
            yaw = 0;
        }
        yaw -= 0.25;
        yawFun(radians(yaw));
    }
}

// Function to roll towards the left
function roll_left(interval){
    for(var i = 0; i < interval; i++){
        if(roll < 0){
            roll =0;
        }
        roll += 0.01;
        rollFun(roll);
    }
}

// Function to roll towards the right
function roll_right(interval){
    for(var i=0; i < interval; i++){
        if(roll > 0){
            roll =0;
        }
        roll -= 0.01;
        rollFun(roll);
    }
}

// Function that psuedo randomly chooses random actions to perform on
// Autopilot
function auto_pilot(){
    // Choose an action and allow for some space so it can look fluid
    action_choice = randomIntFromInterval(1, 100);
    // Choose a speed iteration amount
    speed_interval = randomIntFromInterval(1,7);
    // Choose how much to turn by
    turn_interval = randomIntFromInterval(1,3);
    // Randomly choose a pitch amount
    pitch_interval = randomIntFromInterval(1,2);

    // Choose an action to perform
    switch(action_choice){
         case 1:
            autoSpeed_fast(speed_interval);
            break;
        case 2:
            autoSpeed_slow(speed_interval);
            break;
        case 3:
            turn_right(turn_interval);
            break;
        case 4:
            turn_left(turn_interval);
            break;
        case 5:
            roll_right(pitch_interval);
            break;
        case 6:
            roll_left(pitch_interval);
            break;
    };

}

// uses the diamond square method of terrain generation
// thank you to these sources
// http://jmecom.github.io/blog/2015/diamond-square/
// http://stevelosh.com/blog/2016/06/diamond-square/
function getTerrain(width, depth, first, xoffset, zoffset){
    // make y vals array
    yVals = [];

    // make all y vals on plane 0
    for(var i = 0; i < width; i++){
        var rows = []
        for(var j = 0; j < depth; j++){
            rows.push(0);
        }
        yVals.push(rows);
    }

    // hardcode the corners of the y vals
    // them the same value so that when infinite flight is implemented
    // the environments look like they belong together
    yVals[0][0] = RAND_CORNER_SIZE;
    yVals[0][depth-1] = RAND_CORNER_SIZE;
    yVals[width-1][0] = RAND_CORNER_SIZE;
    yVals[width-1][depth-1] = RAND_CORNER_SIZE;

    // step size of algorithm
    var step = width-1;
    // range of variance to add to the averages
    var minRange = -0.4;
    var maxRange = 0.4;

    while(step > 1){
        var midPoint = Math.floor(step/2);

        for(var z = 0; z< depth-1; z+= step){
            for(var x = 0; x< width-1; x+=step){
                // break into components of square
                var topL = yVals[x][z];
                var topR = yVals[x+step][z];
                var botL = yVals[x][z+step];
                var botR = yVals[x+step][z+step];
                // take average and set y
                var avg = (topL+topR+botL+botR)/4
                yVals[x+midPoint][z+midPoint] = avg + (Math.random()
                * (maxRange- (minRange)) + minRange);
            }
        }


        var even = true;
        for(var z = 0; z< depth; z+=midPoint){
            var begin = even ? 0 : midPoint;
            for(var x = begin; x< width; x+=midPoint){
                // break into omponents of diamond
                var t = yVals[x][z+midPoint] || 0;
                var b = yVals[x][z-midPoint] || 0;
                var l = x - midPoint > 0 ? yVals[x-midPoint][z] : 0;
                var r = x + midPoint < width ? yVals[x+midPoint][z] : 0;
                // take average and set y
                var avg = (t+b+l+r)/4
                yVals[x][z] = avg + (Math.random() *
                (maxRange- (minRange)) + minRange)
            }
            //flip even
            even = !even;
        }

        step = Math.floor(step/2);
        // bring values closer to convergence if need be
        minRange += 0.007;
        maxRange -= 0.007;
    }
    if(first){
        yValsVertical = yVals[0];
        for(var x = 0; x < width; x++){
            yValsSides.push(yVals[x][0]);
        }
    }
    yVals[0] = yValsVertical;
    yVals[width-1] = yValsVertical;
    for(var x = 0; x < width; x++){
        yVals[x][0] = yValsSides[x];
        yVals[x][depth-1] = yValsSides[x];
    }

    return makeVerts(yVals, width, depth, xoffset, zoffset);
}


// uses yVals to make the proper verts and then triangulates
function makeVerts(yVals, width, depth, xoffset, zoffset){
    var stepWidth = gridSize/(width-1);
    var stepDepth = gridSize/(depth-1);

    var tempVerts = [];

    // gets x and y correct
    for(var x = -1*(gridSize/2); x <= (gridSize/2); x+=stepWidth){
        for(var z = -1*(gridSize/2); z <= (gridSize/2); z+=stepDepth){
            tempVerts.push(vec2(x,z));
        }
    }
    var verts = [];
    // puts in proper y values
    for(var i = 0; i < tempVerts.length; i++){
        var xz = tempVerts[i];
        var y = yVals[Math.floor(i/width)][i%depth];
        // if y is below groundvalue then hardcode val
        y = y<groundLevel ? groundLevel-.1 : y;
        verts.push(vec3(xz[0]+xoffset, y, xz[1]+zoffset));
    }

    //triangulates
    var triVerts = [];
    for(var x = 0; x < width-1; x++){
        for(var z = 0; z < depth-1; z++){
            // break verts into components
            var topL = verts[z+(x*depth)];
            var topR = verts[z+((x+1)*depth)];
            var botL = verts[z+1+(x*depth)];
            var botR = verts[z+1+((x+1)*depth)];

            triVerts.push(topL);
            triVerts.push(topR);
            triVerts.push(botL);
            triVerts.push(botL);
            triVerts.push(topR);
            triVerts.push(botR);
        }
    }
    return triVerts;
}

function colorPush(vertex){
    var color;
    if(vertex[1] < groundLevel){
        color = vec3(0,0,1);
    } else if (vertex[1] < groundLevel + .25){
        color = vec3(0,1,0);
    } else if (vertex[1] < groundLevel + .5){
        color = vec3(1,1,0);
    }
    else{
        color = vec3(1,1,1);
        }
    colors.push(color);
    return color;
}

// get starter grid
function getStarterGrid(){
    // 2 3 4
    // 5 1 6
    // 7 8 9
    // cal starter points
    var points1 = getTerrain(width,depth, true, 0, 0);
    var points2 = getTerrain(width,depth, false, (-1*gridSize),(-1*gridSize));
    var points3 = getTerrain(width,depth, false, 0, (-1*gridSize));
    var points4 = getTerrain(width,depth, false, gridSize, (-1*gridSize));
    var points5 = getTerrain(width,depth, false, (-1*gridSize), 0);
    var points6 = getTerrain(width,depth, false, gridSize,0);
    var points7 = getTerrain(width,depth, false, (-1*gridSize), gridSize);
    var points8 = getTerrain(width,depth, false, 0, gridSize);
    var points9 = getTerrain(width,depth, false, gridSize, gridSize);

    // set starter bounds
    xmin = (gridSize+(gridSize)/2)*-1;
    xmax = (gridSize+(gridSize)/2);
    zmin = (gridSize+(gridSize)/2)*-1;
    zmax = (gridSize+(gridSize)/2);
    grid[0] = points2;
    grid[1] = points3;
    grid[2] = points4;
    grid[3] = points5;
    grid[4] = points1;
    grid[5] = points6;
    grid[6] = points7;
    grid[7] = points8;
    grid[8] = points9;

    return fromGrid();
}

// use grid to return points
function fromGrid(){
    var vertices = [];
    for(var x = 0; x < grid.length; x++){
        vertices = vertices.concat(grid[x]);
    }

    // reset colors
    colors = [];
    flatColors = [];
    //loop for flat and smooth colors
    for(var i = 0; i < vertices.length; i+=3){
        var v1c;
        var v2c;
        var v3c;
        v1c = colorPush(vertices[i]);
        v2c = colorPush(vertices[i+1]);
        v3c = colorPush(vertices[i+2]);
        var div3 = vec3(.33, .33, .33);
        addC = add(v1c, add(v2c, v3c));
        avgC = mult(addC, div3);
        flatColors.push(avgC);
        flatColors.push(avgC);
        flatColors.push(avgC);
    }
    numPoints = vertices.length;

    // Load the coordinates into the GPU
    gl.bindBuffer( gl.ARRAY_BUFFER, gl.createBuffer() );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW );
    // Associate out shader variables with our data buffer
    var vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );
}

function maintainGrid(){
    var zLoc = cameraPos[2]+forward[2];
    // only want to recalc points iff we change them
    var updated = false;
    var tempGrid = [];
    // z-axis
    // generate new top and reorder grid
    if(zLoc < zmin + gridSize){
        var zOffset = zmin+(gridSize/2)-gridSize

        var points0 = getTerrain(width,depth, false,
          (xmin+(gridSize/2)), zOffset);
        var points1 = getTerrain(width,depth, false,
          (xmin+(gridSize/2)+gridSize), zOffset);
        var points2 = getTerrain(width,depth, false,
          (xmin+(gridSize/2)+(2*gridSize)), zOffset);

        tempGrid[0] = points0;
        tempGrid[1] = points1;
        tempGrid[2] = points2;
        tempGrid[3] = grid[0];
        tempGrid[4] = grid[1];
        tempGrid[5] = grid[2];
        tempGrid[6] = grid[3];
        tempGrid[7] = grid[4];
        tempGrid[8] = grid[5];

        zmin -= gridSize;
        zmax -= gridSize;
        updated = true;
    }
    // generate new bottom and reorder
    else if(zLoc > zmax - gridSize){
        var zOffset = zmax-(gridSize/2)+gridSize;

        var points6 = getTerrain(width,depth, false,
          (xmin+(gridSize/2)),zOffset);
        var points7 = getTerrain(width,depth, false,
          (xmin+(gridSize/2)+gridSize),zOffset);
        var points8 = getTerrain(width,depth, false,
          (xmin+(gridSize/2)+(2*gridSize)),zOffset);

        tempGrid[0] = grid[3];
        tempGrid[1] = grid[4];
        tempGrid[2] = grid[5];
        tempGrid[3] = grid[6];
        tempGrid[4] = grid[7];
        tempGrid[5] = grid[8];
        tempGrid[6] = points6;
        tempGrid[7] = points7;
        tempGrid[8] = points8;

        zmin += gridSize;
        zmax += gridSize;
        updated = true;
    }

    // 0 1 2
    // 3 4 5
    // 6 7 8
    // x-axis
    var xLoc = cameraPos[0] + forward[0];
    // new left
    if(xLoc < (xmin + gridSize)){
        var xOffset = xmin+(gridSize/2)-gridSize

        var points0 = getTerrain(width,depth, false, xOffset,
          (zmin+(gridSize/2)));
        var points3 = getTerrain(width,depth, false, xOffset,
          (zmin+(gridSize/2)+gridSize));
        var points6 = getTerrain(width,depth, false, xOffset,
          (zmin+(gridSize/2)+2*gridSize));

        tempGrid[0] = points0;
        tempGrid[1] = grid[0]
        tempGrid[2] = grid[1];
        tempGrid[3] = points3;
        tempGrid[4] = grid[3];
        tempGrid[5] = grid[4];
        tempGrid[6] = points6;
        tempGrid[7] = grid[6];
        tempGrid[8] = grid[7];

        xmin -= gridSize;
        xmax -= gridSize;
        updated = true;
    }
    // new right
    else if(xLoc > (xmax-gridSize)){
        var xOffset = xmax-(gridSize/2)+gridSize;

        var points2 = getTerrain(width,depth, false, xOffset,
          (zmin+(gridSize/2)));
        var points5 = getTerrain(width,depth, false, xOffset,
          (zmin+(gridSize/2)+gridSize));
        var points8 = getTerrain(width,depth, false, xOffset,
          (zmin+(gridSize/2)+2*gridSize));

        tempGrid[0] = grid[1];
        tempGrid[1] = grid[2];
        tempGrid[2] = points2;
        tempGrid[3] = grid[4];
        tempGrid[4] = grid[5];
        tempGrid[5] = points5;
        tempGrid[6] = grid[7];
        tempGrid[7] = grid[8];
        tempGrid[8] = points8;

        xmin += gridSize;
        xmax += gridSize;
        updated = true;
    }


    if(updated){
        grid = tempGrid;
        fromGrid();
    }

}

function render() {
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Pause if the user wants to pause the game
    if(!pause){
        // Start autopilot mode if user wants autopilot
        if(autopilot){
            auto_pilot();
        }
        // Update the position of the camera
        var cameraUpdate = mult(speed, forward);
        cameraPos = add(cameraPos, cameraUpdate);
        // Restrict the camera to be within maxHeight and minHeight
        if(cameraPos[1] < minHeight){
            cameraPos = vec3(cameraPos[0], minHeight, cameraPos[2]);
        }else if(cameraPos[1] > maxHeight){
            cameraPos = vec3(cameraPos[0], maxHeight, cameraPos[2]);
        }
    }
    // Update the camera accordingly
    setCamera();

    maintainGrid();

    movementLoc = gl.getUniformLocation(program, "movement");
    gl.uniform3fv(movementLoc, flightMovement);

    var shadeChoice = flatShading ? flatColors : colors;
    // Load the colors into the GPU
    gl.bindBuffer( gl.ARRAY_BUFFER, gl.createBuffer() );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(shadeChoice), gl.STATIC_DRAW );
    // Associate out shader variables with our data buffer
    var vColor = gl.getAttribLocation( program, "vColor" );
    gl.vertexAttribPointer( vColor, 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vColor );

    var mode = wireframe ? gl.LINES : gl.TRIANGLES;
    gl.drawArrays( mode, 0, numPoints);

    requestAnimFrame(render);
}
