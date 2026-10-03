import bpy, math, os
from mathutils import Vector
out='public/assets/legal-match'
os.makedirs(out,exist_ok=True)
def mat(name,color,metal=0,rough=.32):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 return m
gold=mat('Brushed brass',(.73,.43,.12),.8)
wood=mat('Mahogany',(.22,.055,.024),0,.25)
cream=mat('Ivory',(.85,.76,.55))
red=mat('Oxblood leather',(.14,.018,.028),0,.4)
navy=mat('Midnight leather',(.015,.03,.045))
paper=mat('Gilded pages',(.8,.68,.43),.15)
black=mat('Ink',(.009,.012,.017),.2)
def box(name,loc,scale,material,bevel=.08):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 mod=o.modifiers.new('Soft crafted edges','BEVEL');mod.width=bevel;mod.segments=4;o.modifiers.new('Normals','WEIGHTED_NORMAL');return o
def cyl(name,loc,radius,depth,material,rotation=None):
 bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=radius,depth=depth,location=loc);o=bpy.context.object;o.name=name;o.data.materials.append(material)
 if rotation:o.rotation_euler=rotation
 mod=o.modifiers.new('Polished rim','BEVEL');mod.width=.04;mod.segments=3;o.modifiers.new('Normals','WEIGHTED_NORMAL');return o
def rod(a,b,r,material):
 a,b=Vector(a),Vector(b);o=cyl('Crafted rod',(a+b)/2,r,(b-a).length,material);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def sphere(loc,r,material):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=r,location=loc);bpy.context.object.data.materials.append(material);bpy.ops.object.shade_smooth()
def text(s,loc,size,material):
 bpy.ops.object.text_add(location=loc,rotation=(math.pi/2,0,0));o=bpy.context.object;o.data.body=s;o.data.align_x='CENTER';o.data.size=size;o.data.extrude=.008;o.data.materials.append(material)
def setup():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def gavel():
 cyl('Sound block',(0,0,.15),.85,.28,wood);cyl('Block rim',(0,0,.31),.78,.06,gold)
 rod((.4,.1,.42),(-.3,.1,1.65),.13,wood)
 cyl('Head',(-.45,.1,1.83),.36,1.4,wood,(0,math.pi/2,0))
 for x in [-1.08,.18]:cyl('Gold collar',(x,.1,1.83),.38,.1,gold,(0,math.pi/2,0))
def scales():
 cyl('Foot',(0,0,.12),.65,.22,gold);rod((0,0,.2),(0,0,2.15),.095,gold);sphere((0,0,2.22),.16,gold)
 rod((-1.05,0,1.94),(1.05,0,1.94),.06,gold)
 for x in [-1,1]:
  for y in [-.32,.32]:rod((x,0,1.96),(x,y,.8),.018,gold)
  cyl('Pan',(x,0,.76),.44,.07,gold)
def books():
 for i,m in enumerate([red,navy,wood]):
  z=.18+i*.5;box('Leather cover',(0,0,z),(2.35,1.55,.12),m,.035);box('Page block',(0,.02,z+.2),(2.17,1.38,.29),paper,.018);box('Cover',(0,0,z+.39),(2.35,1.55,.1),m,.03)
  for x in [-.8,.8]:box('Spine bands',(x,-.72,z+.2),(.06,.1,.35),gold,.015)
 text('LAW',(0,-.8,1.04),.23,gold)
def court():
 for i in range(3):box('Marble step',(0,0,.09+i*.16),(3.0-i*.25,1.9-i*.22,.16),cream,.025)
 for x in [-1,-.33,.33,1]:
  cyl('Base',(x,-.35,.58),.24,.16,cream);cyl('Column',(x,-.35,1.13),.15,1.05,cream);cyl('Capital',(x,-.35,1.7),.25,.17,cream)
 box('Entablature',(0,-.2,1.88),(2.9,1.5,.25),cream,.025)
 verts=[(-1.5,-.95,2.0),(1.5,-.95,2.0),(0,-.95,2.68),(-1.5,.55,2.0),(1.5,.55,2.0),(0,.55,2.68)]
 mesh=bpy.data.meshes.new('Pediment');mesh.from_pydata(verts,[],[(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)]);o=bpy.data.objects.new('Pediment',mesh);bpy.context.collection.objects.link(o);o.data.materials.append(cream)
 text('JUSTICE',(0,-.97,2.08),.2,gold)
def briefcase():
 box('Leather case',(0,0,.9),(2.45,.85,1.65),wood,.14);box('Seam',(0,-.442,.95),(2.28,.025,.035),gold,.006)
 for x in [-.74,.74]:box('Brass clasp',(x,-.46,1.02),(.2,.06,.28),gold,.035)
 rod((-.43,0,1.73),(-.43,0,2.08),.09,gold);rod((.43,0,1.73),(.43,0,2.08),.09,gold);rod((-.43,0,2.08),(.43,0,2.08),.1,wood)
def pen():
 box('Contract',(0,0,.12),(2.3,1.8,.13),cream,.025)
 for i in range(5):box('Printed line',(-.2,.4-i*.22,.194),(1.2,.018,.012),gold,.002)
 rod((-.75,-.5,.36),(.5,.55,1.78),.13,navy);rod((.4,.46,1.65),(.55,.59,1.86),.145,gold)
 a=Vector((-.75,-.5,.36));b=Vector((-.98,-.7,.08))
 bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=.015,radius2=.13,depth=(b-a).length,location=(a+b)/2);o=bpy.context.object;o.rotation_euler=(a-b).to_track_quat('Z','Y').to_euler();o.data.materials.append(gold)
for name,build in [('gavel',gavel),('scales',scales),('books',books),('court',court),('briefcase',briefcase),('pen',pen)]:
 setup();build()
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=96;scene.cycles.use_denoising=False
 scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
 scene.world.color=(.25,.25,.25)
 for loc,power,size in [((2,-4,6),650,4),((-4,-1,3),450,3),((1,4,5),800,3)]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add(location=(3.3,-6,4));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1.05))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=3.9;scene.camera=cam
 scene.render.filepath=out+'/'+name+'.png';bpy.ops.render.render(write_still=True)
