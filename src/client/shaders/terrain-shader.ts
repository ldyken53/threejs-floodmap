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
uniform sampler2D persTexture;
uniform sampler2D colormap;
uniform int annotation;
uniform int persShow;
uniform int segs;

in vec3 vNormal;
in vec3 vPosition;

out vec4 out_FragColor;

void main(){
    vec3 color = texture(diffuseTexture, vPosition.xy).rgb;
    
    if (persShow == 1) {
      color = color + 0.5 * texture(colormap, vec2(texture(persTexture, vPosition.xy).r * (255.0 / float(segs)), 0)).rgb;
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
