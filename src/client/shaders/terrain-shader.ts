const _VS = `#version 300 es
precision highp float;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

in vec3 position;
in vec3 normal;

out vec3 vNormal;
out vec3 vPosition;

#define saturate(a) clamp( a, 0.0, 1.0 )

void main(){
    vNormal = normal;
    vPosition = position.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // vPosition = gl_Position.xyz*vec3(0.5,0.5,0.5) + vec3(0.5,0.5,0.5);
  }
`

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
uniform float hoverValue;
uniform float segsMax;
uniform int guide;
uniform int z;

in vec3 vNormal;
in vec3 vPosition;

out vec4 out_FragColor;

vec4 sampleTexture(sampler2D sampleTex, vec2 coords) {
  return texture(sampleTex, coords / vec2(4104.0, 1856.0));
}

void main(){
    vec3 color = sampleTexture(diffuseTexture, vPosition.xy).rgb;
    vec4 _segID = sampleTexture(persTexture, vPosition.xy).rgba * 255.0;
      float segID = _segID.x*1000.0 + _segID.y*100.0 + _segID.z*10.0 + _segID.w*1.0;
      if(guide > 0){
        if(abs(segID - hoverValue) < 0.1){
           color = 0.3 * color + 0.7 * texture(colormap, vec2(segID / segsMax, 0)).rgb;
        }
      }
      else{
        if (persShow > 0) {
        
            if (persShow == 1 || persShow == 3) {
              color = 0.9 * color + 0.1 * texture(colormap, vec2(segID / segsMax, 0)).rgb;
            }
    
            if (persShow > 1) {
              const vec2 neighbors[12] = vec2[12](
                // Diagonal neighbors
                vec2(-1, -1), vec2(1, -1), vec2(1, 1),vec2(-1, 1), 
                // Cross neighbors
                vec2(-1, 0), vec2(0, -1), vec2(0, 1), vec2(1, 0),
                // Further cross neighbors
                vec2(-2, 0), vec2(0, -2), vec2(0, 2), vec2(2, 0)
              );
              for (int i = 0; i < 12; i++) {
                vec4 _segIDn = sampleTexture(persTexture, vPosition.xy + neighbors[i]).rgba * 255.0;
                float segIDn = _segIDn.x*1000.0 + _segIDn.y*100.0 + _segIDn.z*10.0 + _segID.w*1.0;
                if (abs(segIDn - segID) > 0.001) {
                  color = texture(colormap, vec2(segID / segsMax, 0)).rgb + vec3(1.0);
                  break;
                }
              }
            }    
          }
       }


    if (annotation == 1) {
        vec3 aColor = sampleTexture(annotationTexture, vPosition.xy).rgb;
        out_FragColor = vec4(color + aColor, 1.0);
    } else {
        out_FragColor = vec4(color, 1.0);
    }
}
`
export const terrainShader = { _VS, _FS }
