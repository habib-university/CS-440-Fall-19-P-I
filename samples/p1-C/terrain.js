var gl;

var normals = [];
var axis = 0;

var xAxis = 0;
var yAxis = 1;
var zAxis = 2;
var theta = [0, 0, 0];
var thetaLoc;
var modelViewMatrix;
var modelView;

var distance = [0, 0, 0.6];
var distanceLoc;

var groundLevel = -0.5;
var colors = [];
var renderTriangles;

var points = [];
function init() {
    var canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    //canvas.width = canvas.width;
    //canvas.height = -canvas.height;

    // Configure WebGL

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);

    var vertices = [];

    var indices = [];

    var xPoints = [];
    var zPoints = [];

    var worldWidth = 500;
    var worldHeight = 500;
    var numCellsWide = 20;
    var numCellsHigh = 20;

    var startZPosition = -1;
    var startXPosition = -1;

    var cellXSize = 0.1;
    var cellYSize = 0.1;

    var numVerticesWide = numCellsWide + 1;
    var numVerticesHigh = numCellsHigh + 1;

    var numVertices = (numCellsWide + 1) * (numCellsHigh + 1);

    var numTrianglesWide = numCellsWide * 2;
    var numTrianglesHigh = numCellsHigh;

    var numTriangles = numTrianglesWide * numTrianglesHigh;
    // Load shaders and initialize attribute buffers

    var program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);
    gl.clearColor(0, 0, 0, 1.0);

    function heightMap(width, height) {
        var data = new Array(width);
        for (var b = 0; b < width; ++b) {
            data[b] = new Array(height);
        }
        noise.seed(Math.random());
        for (var i = 0; i < width; i++) {
            for (var j = 0; j < height; j++) {
                var value = noise.simplex2(i, j);
                data[i][j] = Math.abs(value)*2 - 1.0;
            }
        }
        return data;
    }

    function createTerrain(worldWidth, worldHeight, numCellsWide, numCellsWide) {
        var ydata = heightMap(worldWidth, worldHeight);
        var worldZPosition = startZPosition;
        for (var i = 0; i < worldHeight; i++) {
            var worldXPosition = startXPosition;
            for (var j = 0; j < numVerticesWide; j++) {
                vertices.push(vec3(worldXPosition, ydata[i][j], worldZPosition));
                normals.push(vec3(0, 0, 0));
                worldXPosition += cellXSize;
            }
            worldZPosition += cellYSize;
        }
        var startVertex = 0;

        for (var cellY = 0; cellY < numCellsHigh; cellY++) {
            for (var cellX = 0; cellX < worldWidth; cellX++) {
                indices.push(startVertex, startVertex + cellXSize, startVertex + numVerticesWide);
                indices.push(startVertex + cellXSize, startVertex + numVerticesWide + cellXSize, startVertex + numVerticesWide);
                startVertex++;
            }
            startVertex++;
        }

        for (var vert = 0; vert < vertices.length; vert++){
            points = vertices;
        }
    }

    createTerrain(worldWidth, worldHeight, numCellsWide, numCellsHigh, numVerticesWide, numVerticesHigh);


    var eye = vec3(0, 0.0, 3.0);
    var at = vec3(0.0, 0.0, 0.0);
    var up = vec3(0, 1, 1);

    modelViewMatrix = lookAt(eye, at, up);
    modelView = gl.getUniformLocation(program, "modelViewMatrix");
    gl.uniformMatrix4fv(modelView, false, modelViewMatrix);
    
    // Load the data into the GPU

    var bufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

    // Associate our shader variables with our data buffer

    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    //indices buffer
    var indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    thetaLoc = gl.getUniformLocation(program, "theta");

    distanceLoc = gl.getUniformLocation(program, "distance");

    wireShading(flatten(points));

    document.getElementById("wireFraming").onclick = function() {
        wireShading(flatten(points));
        gl.bindBuffer(gl.ARRAY_BUFFER, bufferColor);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
        renderTriangles = false;
        render(points);
    }
    document.getElementById("flatShading").onclick = function() {
        flatShading(flatten(points));
        gl.bindBuffer(gl.ARRAY_BUFFER, bufferColor);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
        renderTriangles = false;
        render(points);
    }
    document.getElementById("smoothShading").onclick = function() {
        smoothShading(flatten(points));
        gl.bindBuffer(gl.ARRAY_BUFFER, bufferColor);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
        renderTriangles = true;
        render(points);
    }

    var bufferColor = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferColor);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);

    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);


    document.getElementById("PitchAxis").onclick = function () {
        theta[xAxis] += 20.0;
        gl.uniform3fv(thetaLoc, theta);
        render(points);
    };

    document.getElementById("YawAxis").onclick = function () {
        theta[yAxis] += 20.0;
        gl.uniform3fv(thetaLoc, theta);
        render(points);
    };

    document.getElementById("RollAxis").onclick = function () {
        theta[zAxis] += 20.0;
        gl.uniform3fv(thetaLoc, theta);
        render(points);
    };
    render(points);
}

window.onload = init;

function map_point(P, Q, A, B, X) {
    /**
    Mapping and Linear Interpolation:
    Determines the alpha value from the points P, X, and Q,
    and determines where the corresponding point should be
    between A and B.
    */
    var px = subtract(X, P);
    var pq = subtract(Q, P);
    var alpha = length(px) / length(pq);
    return mix(A, B, alpha);
}

function smoothShading(points) {
    var newColors = [];
    for (let pix = 0; pix < points.length; pix += 3) {
        yCord = points[pix + 1];
        if (yCord < groundLevel) {
            // blue if below surface
            colorVal = vec4(0, 0, 1, 1);
        }
        else if(yCord < 0.5){
            // green to brown for second half
            colorVal = map_point(vec2(0, 0), vec2(1, 0),
                vec4(0, 1, 0, 1), vec4(0.5, 0.5, 0, 1), 
                vec2(Math.abs(yCord), 0));
        }
        else{
            colorVal = map_point(vec2(0, 0), vec2(1, 0),
            vec4(0.5, 0.5, 0, 1), vec4(0.7, 0.7, 0.3, 0.5),  
            vec2(Math.abs(yCord), 0));
        }
        newColors.push(colorVal);
    }
    colors = newColors;
}

function flatShading(points) {
    var newColors = [];
    for (let pix = 0; pix < points.length; pix += 3) {
        yCord = points[pix + 1];
        if(yCord < 0){
            colorVal = map_point(vec2(0, 0), vec2(1, 0),
            vec4(0, 0, 0, 0.5), vec4(0, 0, 0, 1),
            vec2(-yCord, 0));
        }
        else{
            colorVal = map_point(vec2(0, 0), vec2(1, 0),
            vec4(0, 0, 0, 0), vec4(0, 0, 0, 0.5),
            vec2(yCord, 0));
        }
        newColors.push(colorVal);
    }
    colors = newColors;
}

function wireShading(points){
    var newColors = [];
    for(let pix = 0; pix<points.length; pix+=3){
        newColors.push(vec4(0, 0, 0, 0));
    }
    colors = newColors;
}

function flyby(){
    distance[zAxis] += 0.0001;
    gl.uniform3fv(distanceLoc, distance);
    render(points);
}

function render(points) {
    gl.clear(gl.COLOR_BUFFER_BIT);

    if(renderTriangles){
        // for(var i = 0; i < points.length/3; ++i){
        //     gl.drawArrays(gl.TRIANGLE, 3*i, 3);
        // }
        gl.drawElements(gl.TRIANGLE_FAN, points.length, gl.UNSIGNED_SHORT, 0);
    }

    if(!renderTriangles){
        gl.drawElements(gl.LINE_STRIP, points.length, gl.UNSIGNED_SHORT, 0);
    }
    requestAnimationFrame(flyby);
}

