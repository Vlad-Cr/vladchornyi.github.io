'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let BackgroundVideoModel;
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let InputCounter = 0.0;
let ScalePointLocationU = 0.0;
let ScalePointLocationV = 0.0;
let ControllerScaleValue = 1;
let CanvasWidth;
let CanvasHeight;
let SurfaceTexture;

let EyeSeparationValue = 7.0;
let FieldOfViewValue = 45.0;
let NearClippingDistanceValue = 1.0;
let ConvergenceDistanceValue = 10;

let StrCamera = new StereoCamera(
            ConvergenceDistanceValue,    // Convergence
            EyeSeparationValue,          // Eye Separation
            1.33,                         // Aspect Ratio
            FieldOfViewValue,            // FOV along Y in degrees
            NearClippingDistanceValue,   // Near Clipping Distance
            20000.0);                    // Far Clipping Distance

let WorldMatrix = m4.translation(0, 0, -10);
let ModelView = m4.translation(0, 0, 0);
let ProjectionMatrix = m4.translation(0, 0, 0);

let TextureWebCam;
let video;

function deg2rad(angle) {
    return angle * Math.PI / 180;
}

// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iTextureBuffer = gl.createBuffer();

    this.iPointVertexBuffer = gl.createBuffer();

    this.count = 0;

    this.BufferData = function(vertices, normals, texCoords) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
       
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STREAM_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextureBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STREAM_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iPointVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0]), gl.DYNAMIC_DRAW);

        this.count = vertices.length/3;
    }

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iNormalVertex, 3, gl.FLOAT, true, 0, 0);
        gl.enableVertexAttribArray(shProgram.iNormalVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextureBuffer);
        gl.vertexAttribPointer(shProgram.iTextureCoords, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iTextureCoords);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
    }
}

// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    this.iAttribVertex = -1;
    this.iNormalVertex = -1;
    this.iTextureCoords = -1;

    this.iColor = -1;

    this.iModelViewProjectionMatrix = -1;
    this.iWorldMatrix = -1;
    this.iWorldInverseTranspose = -1;

    this.iLightWorldPosition = -1;
    this.iLightDirection = -1;

    this.iViewWorldPosition = -1;

    this.iTexture = -1;

    this.iScalePointLocation = -1;
    this.iScaleValue = -1;

    this.iScalePointWorldLocation = -1;
   
    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

function draw() { 
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    let SpaceBallView = spaceball.getViewMatrix();

    DrawWebCamVideo();

    gl.clear(gl.DEPTH_BUFFER_BIT) ;

    StrCamera.Update(ConvergenceDistanceValue, EyeSeparationValue, FieldOfViewValue, NearClippingDistanceValue);

    let Matrixes = StrCamera.ApplyLeftFrustum();
    ModelView = Matrixes[0];
    ModelView = m4.multiply(ModelView, SpaceBallView);
    ProjectionMatrix = Matrixes[1];

    gl.colorMask(true, false, false, false);
    DrawSurface();

    gl.clear(gl.DEPTH_BUFFER_BIT) ;

    Matrixes = StrCamera.ApplyRightFrustum();
    ModelView = Matrixes[0];
    ModelView = m4.multiply(ModelView, SpaceBallView);
    ProjectionMatrix = Matrixes[1];

    gl.colorMask(false, true, true, false);
    DrawSurface();

    gl.colorMask(true, true, true, true);
}

function DrawSurface()
{
    let WorldViewMatrix = m4.multiply(WorldMatrix, ModelView );
    let ModelViewProjection = m4.multiply(ProjectionMatrix, WorldViewMatrix);

    let worldInverseMatrix = m4.inverse(WorldViewMatrix);
    let worldInverseTransposeMatrix = m4.transpose(worldInverseMatrix);

    gl.uniform3fv(shProgram.iViewWorldPosition, [0, 0, 0]); 

    gl.uniform3fv(shProgram.iLightWorldPosition, CalcParabola());
    gl.uniform3fv(shProgram.iLightDirection, [0, -1, 0]);

    gl.uniformMatrix4fv(shProgram.iWorldInverseTranspose, false, worldInverseTransposeMatrix);
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, ModelViewProjection );
    gl.uniformMatrix4fv(shProgram.iWorldMatrix, false, WorldViewMatrix );
    
    gl.uniform4fv(shProgram.iColor, [0.5,0.5,0.5,1] );
    gl.uniform2fv(shProgram.iScalePointLocation, [ScalePointLocationU / 360.0, ScalePointLocationV / 90.0] );
    gl.uniform1f(shProgram.iScaleValue, ControllerScaleValue);
    gl.bindTexture(gl.TEXTURE_2D, SurfaceTexture);
    gl.uniform1i(shProgram.iTexture, 0);
    
    surface.Draw();
}

function DrawWebCamVideo()
{
    gl.bindTexture(gl.TEXTURE_2D, TextureWebCam);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    
    let ViewMatrix = m4.translation(0, 0, 0);
    let projection = m4.orthographic(-CanvasWidth / 2.0, CanvasWidth / 2.0, -CanvasHeight / 2.0, CanvasHeight / 2.0, 1.0, 20000);

    let WorldViewMatrix = m4.multiply(m4.translation(0, 0, -100), ViewMatrix);
    let ModelViewProjection = m4.multiply(projection, WorldViewMatrix);

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, ModelViewProjection );
    
    gl.uniform1i(shProgram.iTexture, 0);

    BackgroundVideoModel.Draw();
}

function CreateBackgroundData()
{
    let vertexList = [-CanvasWidth / 2.0, -CanvasHeight / 2.0, 0,
                        -CanvasWidth / 2.0, CanvasHeight / 2.0, 0,
                        CanvasWidth / 2.0, CanvasHeight / 2.0, 0,
                        -CanvasWidth / 2.0, -CanvasHeight / 2.0, 0,
                        CanvasWidth / 2.0, CanvasHeight / 2.0, 0,
                        CanvasWidth / 2.0, -CanvasHeight / 2.0, 0];
    let normalsList = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
    let textCoords = [1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1];

    return [vertexList, normalsList, textCoords];
}

function CreateSurfaceData()
{
    let step = 1.0;
    let uend = 360 + step;
    let vend = 90 + step;
    let DeltaU = 0.0001;
    let DeltaV = 0.0001;

    let vertexList = [];
    let normalsList = [];
    let textCoords = [];

    for (let u = 0; u < uend; u += step) {
        for (let v = 0; v < vend; v += step) {
            let unext = u + step;

            /*
            *-------*
            |       |
            |       |
            0-------*
            */
            let x = CalcX(u, v);
            let y = CalcY(u, v);
            let z = CalcZ(u, v);
            vertexList.push( x, y, z );

            /*
            0-------*
            |       |
            |       |
            *-------*
            */
            x = CalcX(unext, v);
            y = CalcY(unext, v);
            z = CalcZ(unext, v);
            vertexList.push( x, y, z );

            // Normals

            let DerivativeU = CalcDerivativeU(u, v, DeltaU);
            let DerivativeV = CalcDerivativeV(u, v, DeltaV);

            let result = m4.cross(DerivativeV, DerivativeU);
            normalsList.push(result[0], result[1], result[2]);

            DerivativeU = CalcDerivativeU(unext, v, DeltaU);
            DerivativeV = CalcDerivativeV(unext, v, DeltaV);

            result = m4.cross(DerivativeV, DerivativeU);
            normalsList.push(result[0], result[1], result[2]);

            textCoords.push(u / uend, v / vend);
            textCoords.push(unext / uend, v / vend);
        }
    }

    return [vertexList, normalsList, textCoords];
}

function CalcX(u, v)
{
    let uRad =  deg2rad(u);
    let vRad = deg2rad(v);

    return vRad * Math.cos(uRad);
}

function CalcY(u, v)
{
    let uRad =  deg2rad(u);
    let vRad = deg2rad(v);

    return vRad * Math.sin(uRad);
}

function CalcZ(u, v)
{
    let a = 1;
    let b = 1;
    let c = 1;

    let uRad =  deg2rad(u);
    let vRad = deg2rad(v);

    return c * Math.sqrt(a * a - (b * b * Math.cos(uRad) * Math.cos(uRad)));
}

function CalcDerivativeU(u, v, uDelta)
{
    let x = CalcX(u, v);
    let y = CalcY(u, v);
    let z = CalcZ(u, v);

    let Dx = CalcX(u + uDelta, v);
    let Dy = CalcY(u + uDelta, v);
    let Dz = CalcZ(u + uDelta, v);

    let Dxdu = (Dx - x) / deg2rad(uDelta);
    let Dydu = (Dy - y) / deg2rad(uDelta);
    let Dzdu = (Dz - z) / deg2rad(uDelta);

    return [Dxdu, Dydu, Dzdu];
}

function CalcDerivativeV(u, v, vDelta)
{
    let x = CalcX(u, v);
    let y = CalcY(u, v);
    let z = CalcZ(u, v);

    let Dx = CalcX(u, v + vDelta);
    let Dy = CalcY(u, v + vDelta);
    let Dz = CalcZ(u, v + vDelta);

    let Dxdv = (Dx - x) / deg2rad(vDelta);
    let Dydv = (Dy - y) / deg2rad(vDelta);
    let Dzdv = (Dz - z) / deg2rad(vDelta);

    return [Dxdv, Dydv, Dzdv];
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iNormalVertex              = gl.getAttribLocation(prog, "normal");
    shProgram.iTextureCoords             = gl.getAttribLocation(prog, "texcoord");
    
    shProgram.iColor                     = gl.getUniformLocation(prog, "color");

    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iWorldInverseTranspose     = gl.getUniformLocation(prog, "WorldInverseTranspose");
    shProgram.iWorldMatrix               = gl.getUniformLocation(prog, "WorldMatrix");

    shProgram.iLightWorldPosition        = gl.getUniformLocation(prog, "LightWorldPosition");
    shProgram.iLightDirection            = gl.getUniformLocation(prog, "LightDirection");

    shProgram.iViewWorldPosition         = gl.getUniformLocation(prog, "ViewWorldPosition");
    
    shProgram.iTexture                   = gl.getUniformLocation(prog, "u_texture");

    shProgram.iScalePointLocation        = gl.getUniformLocation(prog, "ScalePointLocation");
    shProgram.iScaleValue                = gl.getUniformLocation(prog, "ScaleValue");

    shProgram.iScalePointWorldLocation   = gl.getUniformLocation(prog, "ScalePointWorldLocation");

    surface = new Model('Surface');
    let SurfaceData = CreateSurfaceData();
    surface.BufferData(SurfaceData[0], SurfaceData[1], SurfaceData[2]);

    BackgroundVideoModel = new Model();
    let BackgroundData = CreateBackgroundData();
    BackgroundVideoModel.BufferData(BackgroundData[0], BackgroundData[1], BackgroundData[2]);
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    // Canvas
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");

        CanvasWidth = canvas.scrollWidth;
        CanvasHeight = canvas.scrollHeight;

        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }

    // GL
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

 
    video = document.createElement('video');
    video.setAttribute('autoplay', true);
    window.vid = video;
        
    navigator.getUserMedia({ video: true, audio: false }, function (stream) {
        video.srcObject = stream;
    }, function (e) {
        console.error('Rejected!', e);
    });

    SetUpWebCamTexture();

    spaceball = new TrackballRotator(canvas, draw, 0);
    LoadTexture();
  
    playVideo();
}

function playVideo(){
    draw();
    setInterval(playVideo, 1/24);
}

const EyeSeparationRange = document.getElementById("eye_separation");
const FieldOfViewRange = document.getElementById("field_of_view");
const NearClippingDistanceRange = document.getElementById("near_clipping_distance");
const ConvergenceDistanceRange = document.getElementById("convergence_distance");

const EyeSeparationOut = document.getElementById("eye_separation_value");
const FieldOfViewOut = document.getElementById("field_of_view_value");
const NearClippingDistanceOut = document.getElementById("near_clipping_distance_value");
const ConvergenceDistanceOut = document.getElementById("convergence_distance_value");

EyeSeparationOut.textContent = EyeSeparationValue;
FieldOfViewOut.textContent = FieldOfViewValue;
NearClippingDistanceOut.textContent = NearClippingDistanceValue;
ConvergenceDistanceOut.textContent = ConvergenceDistanceValue;

EyeSeparationRange.addEventListener("input", (event) => {
    EyeSeparationValue = Number(event.target.value);
    EyeSeparationOut.textContent = EyeSeparationValue;
    draw();
  })

FieldOfViewRange.addEventListener("input", (event) => {
    FieldOfViewValue = Number(event.target.value);
    FieldOfViewOut.textContent = FieldOfViewValue;
    draw();
  })

NearClippingDistanceRange.addEventListener("input", (event) => {
    NearClippingDistanceValue = Number(event.target.value);
    NearClippingDistanceOut.textContent = NearClippingDistanceValue;
    draw();
  })

ConvergenceDistanceRange.addEventListener("input", (event) => {
    ConvergenceDistanceValue = Number(event.target.value);
    ConvergenceDistanceOut.textContent = ConvergenceDistanceValue;
    draw();
  })

window.addEventListener("keydown", function (event) {  
    switch (event.key) {
      case "ArrowLeft":
        ProcessArrowLeftDown();
        break;
      case "ArrowRight":
        ProcessArrowRightDown();
        break;
        case "W":
            ProcessWDown();
            break;
        case "w":
            ProcessWDown();
            break;
        case "S":
            ProcessSDown();
            break;
        case "s":
            ProcessSDown();
            break;
        case "A":
            ProcessADown();
            break;
        case "a":
            ProcessADown();
            break;
        case "D":
            ProcessDDown();
            break;
        case "d":
            ProcessDDown();
            break;
        case "+":
            ProcessPlusDown();
            break;
        case "-":
            ProcessSubtractDown();
            break;
      default:
            break; 
    }

    draw();
});

function ProcessArrowLeftDown()
{
    InputCounter -= 0.05;
}

function ProcessArrowRightDown()
{
    InputCounter += 0.05;
}

function CalcParabola()
{
    let TParam = Math.sin(InputCounter) * 1.2;
    return [TParam, 6, -10 + (TParam * TParam)];
}

function LoadTexture()
{
    SurfaceTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, SurfaceTexture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
 
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
              new Uint8Array([0, 0, 255, 255]));
 
    var image = new Image();
    image.crossOrigin = "anonymous"
    image.src = "https://i1.photo.2gis.com/images/profile/30258560049997155_fe3f.jpg";
    //image.src = "https://images.pexels.com/photos/3490253/pexels-photo-3490253.jpeg?cs=srgb&dl=pexels-ivy-son-3490253.jpg&fm=jpg";
    image.addEventListener('load', function() {
        gl.bindTexture(gl.TEXTURE_2D, SurfaceTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, image);

        console.log("Texture is loaded!");

        draw();
    });
}

function SetUpWebCamTexture()
{
    TextureWebCam = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, TextureWebCam);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

function ProcessWDown()
{
    ScalePointLocationV -= 5.0;
    ScalePointLocationV = clamp(ScalePointLocationV, 0.0, 90);
}

function ProcessSDown()
{
    ScalePointLocationV += 5.0;
    ScalePointLocationV = clamp(ScalePointLocationV, 0.0, 90);
}

function ProcessADown()
{
    ScalePointLocationU -= 5.0;
    ScalePointLocationU = clamp(ScalePointLocationU, 0.0, 360);
}

function ProcessDDown()
{
    ScalePointLocationU += 5.0;
    ScalePointLocationU = clamp(ScalePointLocationU, 0.0, 360);
}

function ProcessPlusDown()
{
    ControllerScaleValue += 0.05;
    ControllerScaleValue = clamp(ControllerScaleValue, 0.5, 2.0);
}

function ProcessSubtractDown()
{
    ControllerScaleValue -= 0.05;
    ControllerScaleValue = clamp(ControllerScaleValue, 0.5, 2.0);
}

function clamp(value, min, max)
{
    if(value < min)
    {
        value = min
    }
    else if(value > max)
    {
        value = max;
    }

    return value;
}