"""Original RPB Legacy Blueprint book, authored and rendered on the cloud runner."""
import sys
sys.path.append('/usr/lib/python3/dist-packages')
import bpy,math,os
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def material(name,color,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=.38;return m
wine=material('Oxblood leather',(.19,.025,.055));gold=material('Antique gold',(.72,.43,.14),.65);paper=material('Warm paper',(.86,.76,.57));dark=material('Ink',(.025,.015,.019));white=material('Eye ivory',(.98,.91,.74))
root=bpy.data.objects.new('Blueprint',None);bpy.context.collection.objects.link(root)
def cube(name,loc,size,mat,bevel=.035):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat);o.parent=root
 if bevel:
  mod=o.modifiers.new('Soft leather edges','BEVEL');mod.width=bevel;mod.segments=3;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
cube('Paper block',(0,0,0),(1.95,.43,2.62),paper)
cube('Back cover',(0,.28,0),(2.13,.13,2.83),wine)
cube('Front cover',(0,-.29,0),(2.13,.15,2.83),wine)
cube('Rounded leather spine',(-1.04,0,0),(.19,.70,2.83),wine,.07)
for x in [-.91,.91]:cube('Gold border',(x,-.378,0),(.016,.012,2.53),gold,.004)
for z in [-1.26,1.26]:cube('Gold border',(0,-.378,z),(1.84,.012,.016),gold,.004)
for z in [-.95,.95]:cube('Spine band',(-1.055,-.015,z),(.20,.73,.075),gold,.012)
for z in [-1.18,-1.05,-.92,-.79,-.66,-.53,-.40,-.27,-.14,0,.14,.27,.40,.53,.66,.79,.92,1.05,1.18]:
 cube('Page edge',(1.0,.02,z),(.012,.37,.008),gold,.002)
def text(name,words,z,size):
 c=bpy.data.curves.new(name,'FONT');c.body=words;c.align_x='CENTER';c.align_y='CENTER';c.size=size;c.extrude=.004;c.bevel_depth=.001
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.location=(0,-.39,z);o.rotation_euler=(math.pi/2,0,0);c.materials.append(gold);o.parent=root
text('RPB emboss','RPB',1.00,.24);text('Title','LEGACY',.68,.245);text('Subtitle','BLUEPRINT',.39,.15)
def sphere(name,loc,scale,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat);o.parent=root;bpy.ops.object.shade_smooth();return o
for x in [-.34,.34]:
 sphere('Eye',(x,-.40,-.06),(.16,.038,.21),white)
 sphere('Pupil',(x+.017,-.442,-.07),(.072,.025,.115),dark)
 sphere('Catchlight',(x+.039,-.465,-.025),(.022,.012,.031),white)
mouth=sphere('Speaking mouth',(0,-.405,-.47),(.22,.03,.035),dark)
bpy.context.view_layer.objects.active=mouth;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
mouth.shape_key_add(name='Basis');jaw=mouth.shape_key_add(name='jawOpen')
for v in jaw.data:v.co.z*=4
rounder=mouth.shape_key_add(name='mouthRound')
for v in rounder.data:v.co.x*=.65
cube('Ribbon stem',(.63,-.41,-1.00),(.17,.032,.60),gold,.012)
# Ribbon tail extends below the book and gives the guide a distinct silhouette.
tail=cube('Ribbon',(.63,-.25,-1.49),(.17,.04,.40),gold,.008);tail.rotation_euler.y=-.14
text('Five moves','FORM · PROTECT · SCALE',-.86,.071)
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
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.film_transparent=True;scene.render.resolution_x=800;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.view_settings.view_transform='Standard';scene.render.filepath=os.path.abspath('public/assets/blueprint-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath('design/blueprint.blend'));bpy.ops.render.render(write_still=True)
