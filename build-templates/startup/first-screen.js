/* Our Love Story startup screen; independent project code. */
let gl, program, texture, buffer, frame, active = false;
const options = { alpha: false, antialias: true, depth: true, stencil: true, premultipliedAlpha: false, preserveDrawingBuffer: false };
function shader(type, source) {
  const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('启动画面着色器不可用');
  return s;
}
function paint() {
  if (!active) return;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.96, 0.91, 0.86, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  if (texture) { gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bindTexture(gl.TEXTURE_2D, texture); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
  frame = requestAnimationFrame(paint);
}
function start(alpha, antialias, useWebgl2) {
  return Promise.resolve().then(() => {
    options.alpha = alpha === 'true'; options.antialias = antialias !== 'false';
    gl = useWebgl2 === 'true' ? window.canvas.getContext('webgl2', options) : null;
    window.WebGL2RenderingContext = !!gl;
    if (!gl) gl = window.canvas.getContext('webgl', options);
    if (!gl) throw new Error('无法创建启动画面');
    const vs = shader(gl.VERTEX_SHADER, 'attribute vec2 p; varying vec2 uv; void main(){gl_Position=vec4(p,0.,1.);uv=(p+1.)/2.;}');
    const fs = shader(gl.FRAGMENT_SHADER, 'precision mediump float; varying vec2 uv; uniform sampler2D image; void main(){gl_FragColor=texture2D(image,uv);}');
    program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('启动画面不可用');
    buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    gl.useProgram(program); const position = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    active = true; paint();
    return new Promise((resolve) => {
      const image = new Image(); image.onload = () => {
        if (!active) return resolve();
        texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image); resolve();
      };
      image.onerror = () => resolve(); // Keep the warm background if the picture cannot load.
      image.src = 'love_loading.jpg';
    });
  });
}
function setProgress() { return Promise.resolve(); }
function end() {
  active = false;
  if (frame != null) cancelAnimationFrame(frame);
  if (gl) { gl.bindTexture(gl.TEXTURE_2D, null); gl.bindBuffer(gl.ARRAY_BUFFER, null); gl.useProgram(null); if (texture) gl.deleteTexture(texture); if (buffer) gl.deleteBuffer(buffer); if (program) gl.deleteProgram(program); }
  texture = buffer = program = null; gl = null;
  return Promise.resolve();
}
module.exports = { start, end, setProgress };
