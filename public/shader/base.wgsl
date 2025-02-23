struct VertexInput{
    @location(0) position: vec4f,
    @location(1) normal: vec3f,
    @location(2) texcoord: vec2f,
    @builtin(vertex_index) vertexIndex: u32
}

// VertexOutput and FragmentInput
struct VertexOutput{ 
    @builtin(position) position: vec4f,
    @location(0) normal: vec3f,
    @location(1) texcoord: vec2f,
    @location(2) world_pos: vec3f
}

struct FragmentOutput{
    @location(0) frag_color: vec4f,
}

struct VUniform{
    normal_matrix: mat3x3f,
    u_matrix: mat4x4f,
}

struct FUniform {
    light_pos: vec3f,
    camera_pos: vec3f,
    ambient_light: vec3f,
    diffuse_light: vec3f,
    specular_light: vec3f
}

//////// Uniforms
@group(0) @binding(0) var<uniform> v_uniform: VUniform;
@group(0) @binding(1) var<uniform> f_uniform: FUniform;
///////  Samplers and Textures
@group(0) @binding(2) var the_sampler: sampler;
@group(0) @binding(3) var the_texture: texture_2d<f32>;


@vertex
fn v_main(vertex_input: VertexInput) -> VertexOutput
{
    var rectifiedPos = vertex_input.position;
    rectifiedPos = rectifiedPos * 0.005 + vec4(0.81, 0.43, 0.005 ,0.0);
    rectifiedPos.w = 1.0;

    var vertex_output: VertexOutput;
    vertex_output.position  = v_uniform.u_matrix * (rectifiedPos);
    vertex_output.normal    = vertex_input.normal;
    vertex_output.texcoord  = vertex_input.texcoord;
    vertex_output.world_pos = rectifiedPos.xyz;

    return vertex_output;
}



@fragment
fn f_main(fragment_input: VertexOutput) -> FragmentOutput
{

    var base_color  = textureSample(the_texture, the_sampler, fragment_input.texcoord);
    var normal_dir  = normalize(fragment_input.normal);
   
    var light_dir   = normalize(f_uniform.light_pos - fragment_input.world_pos);
    var view_dir    = normalize(f_uniform.camera_pos - fragment_input.world_pos);
 
    var diff        = max(dot(normal_dir, light_dir), 0.0) * 1.05;
    var half_dir    = normalize(light_dir + view_dir);
   
    var spec        = pow(max(dot(normal_dir, half_dir), 0.0), 64.0);
    var ambient     = f_uniform.ambient_light * base_color.rgb;
    var diffuse     = f_uniform.diffuse_light * base_color.rgb * diff;
    var specular    = f_uniform.specular_light * spec;

    var final_color = ambient + diffuse + specular;

    var fragment_output: FragmentOutput;
    fragment_output.frag_color = vec4f( vec3f(final_color),1.0);
    // fragment_output.frag_color = vec4f((half_dir + 1.0) / 2.0 ,1.0);
    return fragment_output;



}