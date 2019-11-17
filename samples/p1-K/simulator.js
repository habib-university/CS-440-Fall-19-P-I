////////////////////////////////////////////////////////////////////////////////
// Enums
////////////////////////////////////////////////////////////////////////////////

let axes =
{
    X: 0,
    Y: 1,
    Z: 2
};

let shaderTypeToEnum =
{
    "flat"      : 0,
    "smooth"    : 1,
    "wireframe" : 2,
};



////////////////////////////////////////////////////////////////////////////////
// Constants
////////////////////////////////////////////////////////////////////////////////

const resolution = 0.5;   // must be a power of 2

// Terrain generation parameters
const heightMean = 4 * resolution;
const heightSdev = 4 * resolution;
const terrainRandDivisions = 1;
const terrainLength = 32 * resolution;
const numVerts = terrainLength + 1;     // vertices per length of terrain tile
const terrainSdevFactor = 0.3;
const tileBuffer = 7;                   // extra tiles rendered on either side

// Plane parameters
const initPlanePosition = [0, 4 * resolution, 0];
const turnSpeed = 0.01;
const minAltitude = 5 * resolution;
const maxAltitude = 7 * resolution;

// Heights at which colors change
const colorMinHeight = -8 * resolution;
const colorChangeHeight = 6 * resolution;
const colorMaxHeight = 14 * resolution;

// Colors for specific heights
const lightBlue = vec4(0.596, 0.756, 0.925, 1);
const midBlue = vec4(0.447, 0.549, 0.654, 1);
const darkBlue = vec4(0.282, 0.321, 0.458, 1);

const lightGreen = vec4(0.596, 0.925, 0.654, 1);
const midGreen = vec4(0.4, 0.662, 0.501, 1);
const darkGreen = vec4(0.321, 0.419, 0.360, 1);

const lightBrown = vec4(0.866, 0.768, 0.596, 1);
const midBrown = vec4(0.694, 0.603, 0.447, 1);
const darkBrown = vec4(0.525, 0.447, 0.313, 1);

const lightWhite = vec4(0.992, 0.933, 0.886, 1);
const midWhite = vec4(0.937, 0.898, 0.862, 1);
const darkWhite = vec4(0.850, 0.827, 0.807, 1);

const lighting = vec3(2.0, 2.0, 10.0);

const bColor = vec4(0, 0, 0, 1);
const clearColor = vec4(0.388, 0.211, 0.305, 1);

const white = vec3(1, 1, 1);
const sky = vec3(0.1875, 0.6914, 0.90625);

const indices = generateIndices();


////////////////////////////////////////////////////////////////////////////////
// Global variables
////////////////////////////////////////////////////////////////////////////////

let gl;
let program;
let plane_location_loc;
let heading_loc;
let up_loc;
let bColor_loc;
let backfacing_loc;
let shaderType_loc;
let discreteColors_loc;
let vPosition;
let vColor;
let vNormal;

let positionBuffer;
let lColorBuffer;
let mColorBuffer;
let dColorBuffer;

let normalsBuffer;

let normals;

let vertices;
let lColors;
let mColors;
let dColors;

let planePosition = initPlanePosition;
let planeTile = planePosition.slice(0).map(Math.floor);
let currPlaneTile2D;

let flightSpeed = 0.004;

let heading = [0, 0, -1];
let up = [0, 1, 0];
let right = [1, 0, 0];
let axis = axes.X;        // current axis of rotation
let heightMap;
let initialized = false;
let shaderType = "flat";
let outline = 0;
let smooth = true;
let discreteColors = true;
let paused = false;


let heightMaps = {};
let keystate = {};



////////////////////////////////////////////////////////////////////////////////
// Functions
////////////////////////////////////////////////////////////////////////////////

/**
 * Function called when the window is first loaded
 */
window.onload = function init()
{
    // Find HTML elements
    let canvas = document.getElementById("gl-canvas");

    // Add listeners for key presses
    canvas.addEventListener('keyup', (e) => keystate[e.key] = false);
    canvas.addEventListener('keydown', (e) => {keystate[e.key] = true; 
        e.preventDefault();});
	canvas.focus();
	
    window.onkeydown = function(event)
    {
        switch (String.fromCharCode(event.keyCode))
        {
            case " ":
                paused = !paused;
                break;
        }
    };

    // Setup WebGL
    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    // Configure WebGL
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.clearColor(sky[0], sky[1], sky[2], 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.getExtension('OES_element_index_uint');  // allows for 32 bit gl values

    // Load shaders and initialize attribute buffers
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

	plane_location_loc = gl.getUniformLocation(program, "plane_location");
    heading_loc = gl.getUniformLocation(program, "heading");
    up_loc = gl.getUniformLocation(program, "up");
    gl.uniform1f(gl.getUniformLocation(program, "scale"), 1.0 / terrainLength);
    bColor_loc = gl.getUniformLocation(program, "bColor");
    backfacing_loc = gl.getUniformLocation(program, "backfacing");
    shaderType_loc = gl.getUniformLocation(program, "shaderType");
    discreteColors_loc = gl.getUniformLocation(program, "discreteColors");
    ortho_loc = gl.getUniformLocation(program, "ortho");
	let lighting_loc = gl.getUniformLocation(program, "lighting");

	gl.uniform3fv(lighting_loc, lighting);

	generateTerrain(planeTile);

    // Load vertex data into the GPU
    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.DYNAMIC_DRAW);

    // Associate out shader variables with our data buffer
    vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // Load normal data into the GPU
    normalsBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.DYNAMIC_DRAW);

	// Associate out shader variables with our data buffer
    vNormal = gl.getAttribLocation(program, "vNormal");
    gl.vertexAttribPointer(vNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vNormal);

    // Load vertex light color data into the GPU
    lColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, lColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(lColors), gl.DYNAMIC_DRAW);

    // Associate out shader variables with our data buffer
    vLColor = gl.getAttribLocation(program, "vLColor");
    gl.vertexAttribPointer(vLColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vLColor);

    // Load vertex med color data into the GPU
    mColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, mColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(mColors), gl.DYNAMIC_DRAW);

    // Associate out shader variables with our data buffer
    vMColor = gl.getAttribLocation(program, "vMColor");
    gl.vertexAttribPointer(vMColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vMColor);

    // Load vertex dark color data into the GPU
    dColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, dColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(dColors), gl.DYNAMIC_DRAW);

    // Associate out shader variables with our data buffer
    vDColor = gl.getAttribLocation(program, "vDColor");
    gl.vertexAttribPointer(vDColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vDColor);

    // Load vectors for camera position into GPU
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
        new Uint32Array(indices), gl.STATIC_DRAW);

    // discreteColors is initially enabled to create proper sized buffers, 
    // then disabled
	discreteColors = false;
	generateColors(heightMaps, currPlaneTile2D);
	
    initialized = true;

    //Checkboxes for properties
    document.getElementById("shaderType").onchange = function()
    {
        shaderType = this.value;
        generateColors(heightMaps, currPlaneTile2D);
        if (shaderType == "wireframe")
        {
            // White background.
            gl.clearColor(1, 1, 1, 1);
        }
        else
        {
            if (shaderType == 'smooth')
            {
                smooth = 1;
                generateSmoothNormals();
            }
            else
            {
                smooth = 0;
                generateFlatNormals();
            }
            gl.clearColor(sky[0], sky[1], sky[2], 1.0);
        }
        canvas.focus();
    };

    document.getElementById("projectionType").onchange = function()
    {
        let orth = this.value === "orthogonal";
        gl.uniform1i(ortho_loc, orth ? 1 : 0);
        canvas.focus();
    };

    document.getElementById("outline").oninput = function()
    {
        outline = this.checked ? 1 : 0;
        canvas.focus();
    };

    document.getElementById("discreteColors").oninput = function()
    {
        discreteColors = this.checked ? 1 : 0;
        generateColors(heightMaps, currPlaneTile2D);
        canvas.focus();
    };

    // Render terrain
    render();
};

/**
 * Changes the planes yaw, ie the "side to side" rotation
 * @param {Number} angle angle by which to change the yaw
 */
function changeYaw(angle)
{
    quat = Quaternion.fromAxisAngle(up, angle);
    heading = quat.rotateVector(heading);
    right = quat.rotateVector(right);
}

/**
 * Changes the plane's pitch, ie the "up and down" rotation
 * @param {Number} angle agle by which to change the pitch
 */
function changePitch(angle)
{
    quat = Quaternion.fromAxisAngle(right, angle);
    heading = quat.rotateVector(heading);
    up = quat.rotateVector(up);
}

/**
 * Rolls the plane, which does not change the flight direction
 * @param {Number} angle angle by which to roll the plane
 */
function changeRoll(angle)
{
    quat = Quaternion.fromAxisAngle(heading, angle);
    right = quat.rotateVector(right);
    up = quat.rotateVector(up);
}

/**
 * Causes the plane to move based on its heading and flightSpeed
 */
function updatePlaneLocation()
{
    planePosition[axes.X] += flightSpeed * heading[axes.X];
    planePosition[axes.Y] = Math.min(
        Math.max(planePosition[axes.Y] + (flightSpeed * heading[axes.Y]),
            minAltitude),
        maxAltitude);
    planePosition[axes.Z] += flightSpeed * heading[axes.Z];
}

function updatePlane()
{
    let lastTile = planeTile.slice(0);
    updatePlaneLocation();
    planeTile = planePosition.slice(0).map(Math.floor);

    // If the plane has passed over a new tile, generate new terrain
    if (!arrayEqual(lastTile, planeTile))
    {
        generateTerrain(planeTile);
    }

    // Apply correct control for WASD or arrow key inputs
    if (keystate.a || keystate.ArrowLeft)
    {
        changeYaw(-turnSpeed);
    }
    if (keystate.d || keystate.ArrowRight)
    {
        changeYaw(turnSpeed);
    }
    if (keystate.w || keystate.ArrowUp)
    {
        changePitch(turnSpeed);
    }
    if (keystate.s || keystate.ArrowDown)
    {
        changePitch(-turnSpeed);
    }
    if (keystate.q)
    {
        changeRoll(turnSpeed);
    }
    if (keystate.e)
    {
        changeRoll(-turnSpeed);
    }
    if (keystate.u)
    {
        flightSpeed += 0.0001;
    }
    if (keystate.i)
    {
        flightSpeed -= 0.0001;
        // No negative flight speed (although this would be funny).
        flightSpeed = Math.max(flightSpeed, 0);
    }
}

/**
 * Renders the current state
 */
function render()
{
    if (!paused)
    {
        updatePlane();
    }

    // Render using drawElements
    gl.uniform3fv(plane_location_loc, flatten(planePosition));
    gl.uniform3fv(heading_loc, flatten(heading));
    gl.uniform3fv(up_loc, flatten(up));
    gl.uniform4fv(bColor_loc, bColor);
    gl.uniform1i(shaderType_loc, shaderTypeToEnum[shaderType]);
    gl.uniform1i(discreteColors_loc, discreteColors);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (shaderType !== "wireframe")
    {
        if (outline == 1)
        {
            gl.enable(gl.CULL_FACE);
            gl.uniform1i(backfacing_loc, 1);
            gl.cullFace(gl.BACK);
            gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);

            gl.uniform1i(backfacing_loc, 0);
            gl.cullFace(gl.FRONT);
            gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);
        }
        else
        {
            gl.disable(gl.CULL_FACE);
            gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);
        }
    }
    else
    {
        gl.drawElements(gl.LINES, indices.length, gl.UNSIGNED_INT, 0);
    }
    // Continue to render next frame
    requestAnimFrame(render);
}

function generateTerrain(planeTile)
{
    let planeTile2D = new vec2(planeTile[axes.X], planeTile[axes.Z]);

    // Create any needed heightMap tiles which have not already been generated
    for (x = planeTile2D[axes.X] - tileBuffer - 1;
        x <= planeTile2D[axes.X] + tileBuffer + 1; x++)
    {
        for (y = planeTile2D[axes.Y] - tileBuffer - 1;
            y <= planeTile2D[axes.Y] + tileBuffer + 1; y++)
        {
            position = new vec2(x, y);
            if (!(position in heightMaps))
            {
                heightMaps[position] = generateHeightMap(heightMaps, position);
            }
        }
    }
	currPlaneTile2D = planeTile2D;

	// Generate corresponding vertices and colors
    generateVertices(heightMaps, planeTile2D);
    generateColors(heightMaps, planeTile2D);
}

function generateHeightMap(heightMaps, tileLocation)
{
    // Initialize 2D array
    let heights = [];
    for (r = 0; r < terrainLength + 1; r++)
    {
        heights.push(new Array(numVerts));
    }

    // Track which borders are adjacent to an existing height map
    let top = 0;
    let bottom = 0;
    let right = 0;
    let left = 0;

    // Match borders with adjacent height maps if present in heightMaps
    let position = new vec2(tileLocation[0], tileLocation[1] - 1);
    if (position in heightMaps)
    {
        heights[0] = heightMaps[position][terrainLength].slice(0);
        top = 1;
    }
    position = new vec2(tileLocation[0], tileLocation[1] + 1);
    if (position in heightMaps)
    {
        heights[terrainLength] = heightMaps[position][0].slice(0);
        bottom = 1;
    }
    position = new vec2(tileLocation[0] + 1, tileLocation[1]);
    if (position in heightMaps)
    {
        for (r = 0; r <= terrainLength; r++)
        {
            heights[r][terrainLength] = heightMaps[position][r][0];
        }
        right = 1;
    }
    position = new vec2(tileLocation[0] - 1, tileLocation[1]);
    if (position in heightMaps)
    {
        for (r = 0; r <= terrainLength; r++)
        {
            heights[r][0] = heightMaps[position][r][terrainLength];
        }
        left = 1;
    }

    // Set initial points with random heights at terrainRandDivisions
    let randSpace = terrainLength / terrainRandDivisions;
    for (r = top * randSpace; r <= terrainLength - bottom; r += randSpace)
    {
        for (c = left * randSpace; c <= terrainLength - right; c += randSpace)
        {
            heights[r][c] = gaussian(heightMean, heightSdev);
        }
    }

    // Iteratively calculate the heights between existing heights until all
    // points have been filled in
    for (step = randSpace / 2; step >= 1; step /= 2)
    {
        // Calculate heights horizontally between two known heights
        for (r = top * step * 2; r <= terrainLength - bottom; r += step * 2)
        {
            for (c = step; c <= terrainLength; c += step * 2)
            {
                // Interpolate between two known heights and add a random factor
                heights[r][c] = (heights[r][c-step] + heights[r][c+step]) / 2
                    + gaussian(0, step * terrainSdevFactor);
            }
        }

        // Calculate heights vertically between two known heights
        for (r = step; r <= terrainLength; r += step * 2)
        {
            for (c = left * step * 2; c <= terrainLength - right; c += step * 2)
            {
                heights[r][c] = (heights[r-step][c] + heights[r+step][c]) / 2
                    + gaussian(0, step * terrainSdevFactor);
            }
        }

        // Calculate heights centered between four known heights
        for (r = step; r <= terrainLength; r += step * 2)
        {
            for (c = step; c <= terrainLength; c += step * 2)
            {
                heights[r][c] =
                    (heights[r-step][c-step] +
                    heights[r-step][c+step] +
                    heights[r+step][c-step] +
                    heights[r+step][c+step]) / 4
                    + gaussian(0, step * terrainSdevFactor);
            }
        }
    }

    return heights;
}

function generateVertices(heightMaps, centerTile)
{
    vertices = [];
    for (x = centerTile[axes.X] - tileBuffer;
        x <= centerTile[axes.X] + tileBuffer; x++)
    {
        for (y = centerTile[axes.Y] - tileBuffer;
            y <= centerTile[axes.Y] + tileBuffer; y++)
        {
            let heightMap = heightMaps[new vec2(x, y)];
            for (r = 0; r <= terrainLength; r++)
            {
                for (c = 0; c <= terrainLength; c++)
                {
                    // vertex height cannot be negative due to water
                    vertices.push(new vec3(x * terrainLength + c,
                        Math.max(heightMap[r][c], 0), y * terrainLength +r));
                }
            }
        }
    }

    if (initialized)
    {
		//Update buffer data
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(vertices));
	}

    if (smooth)
    {
		generateSmoothNormals();
	}
    else
    {
		generateFlatNormals();
	}
}

function generateColors(heightMaps, centerTile)
{
    lColors = [];
    mColors = [];
    dColors = [];
    for (x = centerTile[axes.X] - tileBuffer;
        x <= centerTile[axes.X] + tileBuffer; x++)
    {
        for (y = centerTile[axes.Y] - tileBuffer;
            y <= centerTile[axes.Y] + tileBuffer; y++)
        {
            let heightMap = heightMaps[new vec2(x, y)];
            for (r = 0; r <= terrainLength; r++)
            {
                for (c = 0; c <= terrainLength; c++)
                {
                    // Determines which set of colors if discrete,
                    // otherwise computes between value
                    let vertColors = calculateColor(heightMap[r][c]);
                    if (shaderType == 'wireframe')
                    {
						lColors.push([1,1,1,1]);
					}
                    else if (discreteColors)
                    {
						lColors.push(vertColors[0]);
						mColors.push(vertColors[1]);
						dColors.push(vertColors[2]);
					}
                    else
                    {
						lColors.push(vertColors);
				    }
                }
            }
        }
    }
    if (initialized)
    {
		gl.bindBuffer(gl.ARRAY_BUFFER, lColorBuffer);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(lColors));

		gl.bindBuffer(gl.ARRAY_BUFFER, mColorBuffer);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(mColors));

		gl.bindBuffer(gl.ARRAY_BUFFER, dColorBuffer);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(dColors));
	}
}

function generateFlatNormals()
{
	normals = new Array(vertices.length);
    for (let i = 0; i < indices.length - 2; i += 2)
    {
		let index1 = indices[i];
		let index2 = indices[i + 1];
		let index3 = indices[i + 2];
		let u = subtract(vertices[index2] , vertices[index1]);
		let v = subtract(vertices[index3] , vertices[index1]);
		let normal = normalize(cross(u, v), false);
		normals[index1] = normal;
		normals[index2] = normal;
		normals[index3] = normal;
	}

    if (initialized)
    {
		gl.bindBuffer(gl.ARRAY_BUFFER, normalsBuffer);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(normals));
	}
}

function generateSmoothNormals()
{
	normals = new Array(vertices.length);
	let counts = new Array(vertices.length);
    for (let i = 0; i < indices.length - 2; i += 2)
    {
		let index1 = indices[i];
		let index2 = indices[i + 1];
		let index3 = indices[i + 2];
		let u = subtract(vertices[index2] , vertices[index1]);
		let v = subtract(vertices[index3] , vertices[index1]);

		let normal = cross(u, v);
		let normalLength = length( normal);
		normalLength = normalLength == 0 ? 1 : normalLength;
		normal[0] /= normalLength;
		normal[1] /= normalLength;
		normal[2] /= normalLength;

		//Initialize normal, or add to existing
        normals[index1] = normals[index1] == null ?
            normal : add(normals[index1], normal);
        normals[index2] = normals[index2] == null ?
            normal : add(normals[index2], normal);
        normals[index3] = normals[index3] == null ?
            normal : add(normals[index3], normal);

		//Increment counts
		counts[index1] = counts[index1] == null ? 1 : counts[index1] + 1;
		counts[index2] = counts[index2] == null ? 1 : counts[index2] + 1;
		counts[index3] = counts[index3] == null ? 1 : counts[index3] + 1;
	}

    for (let i = 0; i < normals.length; ++i)
    {
		normals[i][0] = normals[i][0] / counts[i];
		normals[i][1] = normals[i][1] / counts[i];
		normals[i][2] = normals[i][1] / counts[i];
	}

    if (initialized)
    {
		gl.bindBuffer(gl.ARRAY_BUFFER, normalsBuffer);
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(normals));
	}
}

/**
 * Calculates the color for a given height
 * @param {Number} height height (y coordinate) of the vertex
 * @return {vec3} color at that height
 */
function calculateColor(height)
{
    // Interpolate from dark blue to blue in the water (everything below 0)
    if (height <= colorMinHeight)
    {
        if (discreteColors)
        {
			return [lightBlue, midBlue, darkBlue];
		}
        else
        {
			return darkBlue;
		}
    }
    if (height <= 0)
    {
        if (discreteColors)
        {
			return [lightBlue, midBlue, darkBlue];
		}
        else
        {
			return map_point(vec2(colorMinHeight, 0), vec2(0, 0),
			                 vec2(height, 0), darkBlue, lightBlue);
		}
    }

    // Interpolate from green to brown at low altitudes
    else if (height < colorChangeHeight)
    {
        if (discreteColors)
        {
			return [lightGreen, midGreen, darkGreen];
		}
        else
        {
			return map_point(vec2(colorMinHeight, 0), vec2(colorMaxHeight, 0),
			    vec2(height, 0), lightGreen, lightBrown)
		}
    }

    // Interpolate from brown to white at high altitudes
    else if (height < colorMaxHeight)
    {
        if (discreteColors)
        {
			return [lightBrown, midBrown, darkBrown];
		}
        else
        {
            return map_point(vec2(colorChangeHeight, 0),
                vec2(colorMaxHeight, 0), vec2(height, 0), midBrown, lightWhite)
		}
    }
    else
    {
        if (discreteColors)
        {
			return [lightWhite, midWhite, darkWhite];
		}
        else
        {
			return lightWhite;
		}
    }
}

/**
 * Generates the constant index list used to organize vertices into triangles
 * @returns {Number[]} vertex index list
 */
function generateIndices()
{
    let indices = [];
    let tiles = tileBuffer * 2 + 1;

    // Render each "square" of vertices as two triangles: NW, SW, NE, SE, NE, SW
    // Note that we do not do this for the last row and last column of vertices
    // to prevent walking off the e dge of the map
    for (x = 0; x < tiles; x++)
    {
        for (y = 0; y < tiles; y++)
        {
            let offset = (tiles * x + y) * numVerts * numVerts;
            for (r = 0; r < terrainLength; r++)
            {
                for (c = 0; c < terrainLength; c++)
                {
                    indices.push(r * numVerts + c + offset);
                    indices.push((r + 1) * numVerts + c + offset);
                    indices.push(r * numVerts + (c + 1) + offset);
                    indices.push((r + 1) * numVerts + (c + 1) + offset);
                    indices.push(r * numVerts + (c + 1) + offset);
                    indices.push((r + 1) * numVerts + c + offset);
                }
            }
        }
    }

    return indices;
}

/**
 * Generates a normally distributed random number with a given mean and sdev
 * @param {Number} mean the mean of the normal distribution
 * @param {Number} sdev the standard deviation of the normal distribution
 * @return {Number} normally distributed random number
 */
function gaussian(mean = 0, sdev = 1)
{
    // Generate a normally distributed random variable using the Box-Muller
    // transform
    r1 = Math.random() + Number.EPSILON;
    r2 = Math.random() + Number.EPSILON;
    return mean + sdev * Math.sqrt(-2.0 * Math.log(r1))
        * Math.sin(2.0 * Math.PI * r2);
}

/**
 * Checks if two arrays contain the same elements
 * @param {any[]} a1 first array
 * @param {any[]} a2 second array
 * @return {Boolean} true if the two arrays contain the same elements
 */
function arrayEqual(a1, a2)
{
    if (a1.length != a2.length)
    {
        return false;
    }

    for (i = 0; i < a1.length; i++)
    {
        if(a1[i] != a2[i])
        {
            return false;
        }
    }

    return true;
}
