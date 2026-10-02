"""Original RPB Blueprint gavel; generated in Blender on the cloud runner."""
import sys
sys.path.append('/usr/lib/python3/dist-packages')
import bpy,math,os
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def material(name,color,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=.32;return m
wood=material('Warm mahogany',(.22,.065,.033));endwood=material('Polished end grain',(.32,.105,.045));gold=material('Brushed antique brass',(.72,.43,.14),.65);dark=material('Espresso',(.025,.012,.009));white=material('Warm ivory eyes',(.98,.93,.83))
root=bpy.data.objects.new('Blueprint Gavel',None);bpy.context.collection.objects.link(root)
def cylinder(name,loc,radius,depth,mat,horizontal=False):
 bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=radius,depth=depth,location=loc);o=bpy.context.object;o.name=name
 if horizontal:o.rotation_euler.y=math.pi/2
 o.data.materials.append(mat);o.parent=root
 bevel=o.modifiers.new('Rounded polished edges','BEVEL');bevel.width=.04;bevel.segments=3;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=bevel.name)
 o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o
# Classic gavel silhouette: broad horizontal barrel, upright handle and sounding block.
cylinder('Mahogany gavel head',(0,0,.72),.52,2.02,wood,True)
for x in [-1.06,1.06]:
 cylinder('Brass collar',(x,0,.72),.57,.15,gold,True)
 cylinder('Wood striking face',(x+(-.12 if x<0 else .12),0,.72),.60,.19,endwood,True)
cylinder('Handle neck',(0,0,.03),.17,.50,gold)
cylinder('Mahogany handle',(0,0,-.63),.16,1.06,wood)
cylinder('Handle grip',(0,0,-1.01),.21,.40,endwood)
for z in [-.92,-1.09]:cylinder('Grip brass ring',(0,0,z),.216,.045,gold)
cylinder('Sounding block foot',(0,0,-1.50),.82,.16,wood)
cylinder('Sounding block gold trim',(0,0,-1.40),.77,.06,gold)
cylinder('Sounding block top',(0,0,-1.34),.73,.07,endwood)
def sphere(name,loc,scale,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat);o.parent=root;bpy.ops.object.shade_smooth();return o
for x in [-.29,.29]:
 sphere('Expressive eye',(x,-.508,.79),(.145,.055,.175),white)
 sphere('Pupil',(x+.014,-.565,.785),(.067,.028,.10),dark)
 sphere('Catchlight',(x+.032,-.591,.826),(.022,.012,.03),white)
mouth=sphere('Speaking mouth',(0,-.472,.46),(.18,.035,.034),dark)
bpy.context.view_layer.objects.active=mouth;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
mouth.shape_key_add(name='Basis');jaw=mouth.shape_key_add(name='jawOpen')
for v in jaw.data:v.co.z*=4
rounder=mouth.shape_key_add(name='mouthRound')
for v in rounder.data:v.co.x*=.65
def text(name,words,loc,size):
 c=bpy.data.curves.new(name,'FONT');c.body=words;c.align_x='CENTER';c.align_y='CENTER';c.size=size;c.extrude=.003
 ob=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(math.pi/2,0,0);c.materials.append(gold);ob.parent=root
text('RPB lettering','RPB',(0,-.40,1.085),.16)
text('Legacy lettering','LEGACY',(0,-.795,-1.50),.095)
for o in list(root.children):
 if o.type=='FONT':
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
os.makedirs('public/assets',exist_ok=True);os.makedirs('design',exist_ok=True)
bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for o in root.children:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath('public/assets/blueprint.glb'),export_format='GLB',use_selection=True,export_animations=False)
bpy.ops.object.camera_add(location=(.5,-7,.25));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,-.05))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=3.7;bpy.context.scene.camera=cam
for loc,power,size in [((-3,-4,5),450,4),((3,-2,1),260,3),((1,3,3),360,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=False;scene.render.film_transparent=True;scene.render.resolution_x=800;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.view_settings.view_transform='Standard';scene.render.filepath=os.path.abspath('public/assets/blueprint-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath('design/blueprint.blend'));bpy.ops.render.render(write_still=True)
