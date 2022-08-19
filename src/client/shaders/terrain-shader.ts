const _VS = `#version 300 es
precision highp float;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform int z;

in vec3 position;
in vec3 normal;

out vec3 vNormal;
out vec3 vPosition;

#define saturate(a) clamp( a, 0.0, 1.0 )

void main(){
    vNormal = normal;
    vPosition = position.xyz / vec3(4104.0, 1856.0, float(z));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // vPosition = gl_Position.xyz*vec3(0.5,0.5,0.5) + vec3(0.5,0.5,0.5);
  }
`;

const _FS = `#version 300 es

precision mediump sampler2DArray;
precision highp float;
precision highp int;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform vec3 cameraPosition;
uniform sampler2D diffuseTexture;
uniform sampler2D annotationTexture;
uniform sampler2D edgeTexture;
uniform int triPlanar;
uniform int canny;
uniform int annotation;

in vec3 vNormal;
in vec3 vPosition;

out vec4 out_FragColor;

vec3 blendNormal(vec3 normal){
	vec3 blending = abs(normal);
	blending /= (blending.x + blending.y + blending.z);
	return blending;
}

vec3 triplanarMapping (sampler2D tex, vec3 normal, vec3 position) {
  vec3 normalBlend = blendNormal(normal);
  vec2 x = position.zy;
  vec2 y = position.xz;
  vec2 z = position.xy;
  if (normal.x < 0.0) {
    x.x = -x.x;
  }
  if (normal.y < 0.0) {
    y.x = -y.x;
  }
  if (normal.z < 0.0) {
    z.x = -z.x;
  }
  vec3 xColor = texture(tex, x).rgb;
  vec3 yColor = texture(tex, y).rgb;
  vec3 zColor = texture(tex, z).rgb;
  return (xColor * normalBlend.x + yColor * normalBlend.y + zColor * normalBlend.z);
}

void main(){
    vec3 color;
    if (triPlanar == 0) {
        color = texture(diffuseTexture, vPosition.xy).rgb;
    } else {
        color = triplanarMapping(diffuseTexture, vNormal, vPosition);
    }
    if (canny == 1) {
        color = texture(edgeTexture, vPosition.xy).rgb;
    } else if (canny == 2) {
        color = vec3(color + texture(edgeTexture, vPosition.xy).rgb);
    }
    if (annotation == 1) {
        vec3 aColor = texture(annotationTexture, vPosition.xy).rgb;
        out_FragColor = vec4(color + aColor, 1.0);
    } else {
        out_FragColor = vec4(color, 1.0);
    }
}
`;
export const terrainShader = { _VS, _FS };
