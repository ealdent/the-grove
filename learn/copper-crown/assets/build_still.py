"""Create Copper Crown's editable, animated Blender scene and web model.

Run with Blender, e.g. blender -b -t 4 --python build_still.py -- --assets DIR.
The illustration is transparent to expose the condenser; it is not a
dimensioned fabrication drawing. One scene unit is approximately 160 mm.
"""
import bpy
import math
import os
import sys
from mathutils import Vector


ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ASSETS = os.path.abspath(ARGS[ARGS.index('--assets') + 1]) if '--assets' in ARGS else os.path.dirname(os.path.abspath(__file__))
os.makedirs(ASSETS, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for data in bpy.data.materials:
    bpy.data.materials.remove(data)


def material(name, color, metal=0, rough=.35, alpha=1, emission=None):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, alpha)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, alpha)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    b.inputs['Alpha'].default_value = alpha
    if emission:
        b.inputs['Emission Color'].default_value = (*emission, 1)
        b.inputs['Emission Strength'].default_value = 1.8
    if alpha < 1:
        m.surface_render_method = 'BLENDED'
    return m


copper = material('Aged copper | exterior only', (.34, .115, .052), .78, .31)
brass = material('Brushed brass | exterior only', (.55, .30, .095), .82, .28)
steel = material('316L stainless | vapor path', (.47, .53, .53), .8, .24)
dark = material('Blackened steel', (.045, .048, .046), .66, .32)
cream = material('Ivory enamel', (.81, .69, .46), .15, .32)
glass = material('Clear glass', (.27, .58, .57), .05, .16, .075)
receiver_glass = material('Carafe clear glass', (.27, .58, .57), .05, .16, .15)
water = material('Cooling water | illustrative', (.09, .40, .46), .06, .20, .06)
steam = material('Warm vapor flow guide', (.98, .76, .37), .1, .24, 1, (.45, .24, .06))
distillate = material('Condensate flow guide', (.25, .87, .94), .05, .2, 1, (.08, .52, .58))
glow = material('Heater indicator', (.95, .22, .035), .1, .25, 1, (.75, .10, .01))
floor_mat = material('Stage', (.037, .041, .036), .08, .59)


def own(o, group, mat=None):
    o.parent = group
    if mat:
        o.data.materials.append(mat)
    return o


def group(name):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    return o


def bevel(o, width=.02, segments=3):
    m = o.modifiers.new('Soft machined edges', 'BEVEL')
    m.width = width
    m.segments = segments
    o.modifiers.new('Corner normals', 'WEIGHTED_NORMAL')


def cylinder(name, loc, radius, depth, mat, parent, verts=64, bevel_width=.012):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    o = bpy.context.object
    o.name = name
    own(o, parent, mat)
    if bevel_width:
        bevel(o, bevel_width)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def cube(name, loc, scale, mat, parent, bevel_width=.035):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    own(o, parent, mat)
    if bevel_width:
        bevel(o, bevel_width)
    return o


def uvball(name, loc, scale, mat, parent, seg=24, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    own(o, parent, mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def torus(name, loc, major, minor, mat, parent):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=64, minor_segments=10, location=loc)
    o = bpy.context.object
    o.name = name
    own(o, parent, mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def path(name, points, radius, mat, parent):
    c = bpy.data.curves.new(name, type='CURVE')
    c.dimensions = '3D'
    c.resolution_u = 2
    c.bevel_depth = radius
    c.bevel_resolution = 4
    c.use_fill_caps = False
    c.resolution_u = 16
    s = c.splines.new('POLY')
    s.points.add(len(points) - 1)
    for p, xyz in zip(s.points, points):
        p.co = (*xyz, 1)
    o = bpy.data.objects.new(name, c)
    bpy.context.collection.objects.link(o)
    own(o, parent, mat)
    return o


def lathe(name, x, y, profile, mat, parent, steps=64):
    vs = []
    for radius, z in profile:
        for i in range(steps):
            t = 2 * math.pi * i / steps
            vs.append((x + radius * math.cos(t), y + radius * math.sin(t), z))
    fs = []
    for j in range(len(profile) - 1):
        for i in range(steps):
            k = (i + 1) % steps
            fs.append((j*steps+i, j*steps+k, (j+1)*steps+k, (j+1)*steps+i))
    me = bpy.data.meshes.new(name)
    me.from_pydata(vs, [], fs)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    own(ob, parent, mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def full_shell(name, x, radius, z0, z1, mat, parent):
    # A continuous transparent wall, open at the top.
    n = 72
    verts = []
    for z in (z0, z1):
        for i in range(n + 1):
            a = 2 * math.pi * i / n
            verts.append((x + radius*math.cos(a), radius*math.sin(a), z))
    faces = [(i, i+1, n+i+2, n+i+1) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    own(ob, parent, mat)
    solid = ob.modifiers.new('Glass thickness', 'SOLIDIFY')
    solid.thickness = .012
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def text_obj(text, name, loc, size, mat, parent, rotate=(math.pi/2, 0, 0)):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = text
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.size = size
    cu.extrude = .001
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = rotate
    own(ob, parent, mat)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.convert(target='MESH')
    ob.select_set(False)
    return ob


base = group('00 | shared plinth')
boiler = group('01 | heater and boiler')
lid = group('02 | removable lid')
header = group('03 | vapor line and demister')
vent_group = group('03b | independent open boiler vent')
bath = group('04 | open cooling bath')
coil = group('05 | descending condenser coil and outlet')
receiver = group('06 | freely open collection carafe')
flow = group('07 | animated flow illustration')

cube('Black iron display plinth', (.06, 0, .07), (5.35, 1.83, .18), dark, base, .09)
cube('Brass base inset', (.06, 0, .15), (5.12, 1.60, .045), brass, base, .015)
cube('Dark base top', (.06, 0, .18), (5.04, 1.54, .045), dark, base, .015)
for x in (-2.25, -.75, .75, 2.35):
    for y in (-.62, .62):
        cylinder('Plinth brass stud', (x, y, .21), .025, .02, brass, base, 16, .003)

bx = -1.23
cylinder('Black electric heater', (bx, 0, .32), .80, .24, dark, boiler)
torus('Heater brass lower bead', (bx, 0, .235), .75, .035, brass, boiler)
torus('Heater brass upper bead', (bx, 0, .425), .75, .035, brass, boiler)
for i in range(24):
    a = 2*math.pi*i/24
    uvball('Heater rivet', (bx+.78*math.cos(a), .78*math.sin(a), .33), (.035,.035,.035), brass, boiler, 12, 8)
lathe('Open stainless boiling kettle', bx, 0,
      [(0,.46),(.68,.46),(.69,.47),(.69,1.69),(.66,1.69),(.66,.49),(0,.49)],
      steel, boiler)
lathe('Decorative external copper jacket', bx, 0,
      [(.72,.49),(.72,1.64),(.70,1.64),(.70,.49)], copper, boiler)
for z in (.52, .64, 1.43, 1.59):
    torus('Boiler ornamental band', (bx, 0, z), .72, .027, brass, boiler)
for z in (.69, 1.38):
    for i in range(28):
        a = 2*math.pi*i/28
        uvball('Boiler jacket rivet', (bx+.725*math.cos(a), .725*math.sin(a), z), (.027,.027,.027), brass, boiler, 12, 8)
torus('Stainless kettle lip', (bx, 0, 1.69), .67, .045, steel, boiler)
cube('Heater control plaque', (bx, -.804, .345), (.42,.05,.16), brass, boiler, .02)
cylinder('Heater indicator', (bx-.13, -.84, .345), .027, .018, glow, boiler, 24, .003).rotation_euler.x = math.pi/2
text_obj('HEAT', 'Heater label', (bx+.045,-.834,.345), .078, dark, boiler)
# A conceptual physical representation of a separate heater temperature limit.
cube('Independent heater temperature limit housing', (bx+.44,-.71,.36), (.25,.10,.16), dark, boiler,.016)
text_obj('LIMIT', 'Temperature limit label', (bx+.44,-.766,.365), .046, cream, boiler)
path('Limit sensor lead', [(bx+.49,-.74,.43),(bx+.58,-.65,.47),(bx+.64,-.48,.50),(bx+.64,-.37,.55)], .012,dark,boiler)
uvball('External high temperature probe', (bx+.64,-.37,.55), (.04,.04,.05),steel,boiler,16,8)

# Smooth capped dome: decorative outer surface, with stainless underside and fittings.
lathe('Removable domed lid', bx, 0, [(0,1.95),(.16,1.945),(.34,1.91),(.51,1.84),(.62,1.76),(.67,1.69)], copper, lid)
lathe('Stainless lid liner (wetted face)', bx, 0, [(0,1.927),(.16,1.922),(.34,1.887),(.51,1.817),(.62,1.737),(.67,1.667)], steel, lid)
torus('Lid steel gasket rim', (bx, 0, 1.69), .67, .035, steel, lid)
torus('Lid collar', (bx, 0, 1.94), .16, .025, brass, lid)
for i in range(14):
    a = 2*math.pi*i/14
    uvball('Lid perimeter rivet', (bx+.66*math.cos(a), .66*math.sin(a),1.72), (.03,.03,.03), brass, lid, 12, 8)

# The entire wetted vapor route is modeled as stainless; decorative collars are external.
path('Central riser', [(bx,0,1.92),(bx,0,2.13)], .065, steel, header)
uvball('Demister separator vessel', (bx,0,2.25), (.20,.20,.22), steel, header, 48,24)
torus('Demister external brass collar', (bx,0,2.25), .20, .018, brass, header)
# Fine crossing stainless wires describe a removable demister mesh inside the
# sphere. It is intentionally visible only when the outer shell is hidden.
for i in range(-6, 7):
    off=i*.022
    half=math.sqrt(max(0,.17*.17-off*off))
    path('Demister mesh wire X', [(bx-half,off,2.25),(bx+half,off,2.25)],.0025,steel,header)
    path('Demister mesh wire Y', [(bx+off,-half,2.255),(bx+off,half,2.255)],.0025,steel,header)
vapor = [(bx,0,2.42), (bx,0,2.55),(-1.17,0,2.61),(-1.08,0,2.63),(.88,0,2.63),(1.02,0,2.59),(1.06,-.10,2.53),(1.06,-.44,2.42),(1.06,-.44,1.78)]
path('Stainless vapor bridge', vapor, .065, steel, header)
for x in (-.75,.10,.75):
    uvball('Vapor line brass ferrule', (x,0,2.63), (.075,.075,.075), brass, header, 20,10)
# Vent leaves lid separately, rises continuously and remains open, no valve or cap.
vent = [(bx-.34,.04,1.82),(bx-.34,.04,1.95),(bx-.43,.04,2.05),(bx-.45,.04,2.93),(bx-.50,.04,3.03),(bx-.63,.04,3.06)]
path('Independent open boiler vent', vent, .047, steel, header)
bpy.context.collection.objects['Independent open boiler vent'].parent = vent_group
torus('Vent entry collar', (bx-.34,.04,1.82), .07,.014,brass,vent_group)

cx = 1.06
cylinder('Bath steel bottom', (cx,0,.36), .72,.14,steel,bath)
torus('Bath base brass trim', (cx,0,.40),.71,.035,brass,bath)
full_shell('Continuous cooling vessel glass wall', cx,.69,.43,1.92,glass,bath)
full_shell('Illustrative cooling water', cx,.665,.44,1.73,water,bath)
for z in (.48, 1.02, 1.85, 1.93):
    torus('Bath brass hoop', (cx,0,z),.69,.025,brass,bath)
for a in [math.radians(v) for v in (5, 55, 125, 175, 210, 320)]:
    for z in (.48,1.85):
        uvball('Bath hoop stud', (cx+.70*math.cos(a),.70*math.sin(a),z), (.025,.025,.025),brass,bath,12,8)

coil_points=[]
N=280
for i in range(N+1):
    t=i/N
    theta=-math.pi/2 - 2*math.pi*5.0*t
    coil_points.append((cx+.44*math.cos(theta),.44*math.sin(theta),1.78-.77*t))
path('316L submerged condenser coil', coil_points,.0375,steel,coil)
outlet=[coil_points[-1], (1.55,-.44,1.00),(1.72,-.44,.99),(1.78,-.44,.96),(2.10,-.44,.94),(2.18,-.44,.90),(2.18,-.44,.86)]
path('Stainless distillate outlet, open to air',outlet,.0375,steel,coil)

# Carafe is presented open with an air gap between the tube and opening.
rx, ry = 2.18, -.44
lathe('Open glass collection carafe',rx,ry,[(.0,.22),(.27,.22),(.30,.27),(.30,.51),(.24,.57),(.13,.60),(.13,.66),(.15,.66)],receiver_glass,receiver)
torus('Carafe lip', (rx,ry,.66), .14,.015,steel,receiver)
lathe('Illustrative collected water',rx,ry,[(0,.23),(.275,.23),(.28,.27),(.28,.36),(0,.36)],water,receiver)

# Flow dots are a graphic overlay, not material particles or a fluid simulation.
def interpolate(pts, u):
    lengths=[0]
    for a,b in zip(pts,pts[1:]):
        lengths.append(lengths[-1]+(Vector(b)-Vector(a)).length)
    target=u*lengths[-1]
    for i in range(len(lengths)-1):
        if lengths[i+1]>=target:
            v=(target-lengths[i])/(lengths[i+1]-lengths[i] or 1)
            return Vector(pts[i]).lerp(Vector(pts[i+1]),v)
    return Vector(pts[-1])

vaporguide=[(bx,-.10,.70),(bx,-.10,1.3),(bx,-.10,1.95),(bx,-.1,2.38)]+[(x,y-.1,z) for x,y,z in vapor[1:]]
condguide=[(x,y-.075,z) for x,y,z in coil_points]+[(x,y-.075,z) for x,y,z in outlet[1:]]
for phase, route, mat, count in [('Vapor',vaporguide,steam,10),('Condensate',condguide,distillate,12)]:
    for i in range(count):
        o=uvball(phase+' moving illustration', (0,0,0), (.065,)*3, mat, flow, 12,8)
        for f in (1, 414):
            o.scale=(0,0,0)
            o.keyframe_insert(data_path='scale',frame=f)
        o.scale=(.065,.065,.065)
        o.keyframe_insert(data_path='scale',frame=425)
        # Key every rendered frame. Sampling every third frame lets Blender
        # interpolate across the modulo wrap and briefly sends a bead through
        # empty space rather than along the tubing.
        for f in range(420,577):
            # A complete route repeats every five seconds. Beads advance through it.
            u=((f-420)/60+i/count)%1
            o.location=interpolate(route,u)
            o.keyframe_insert(data_path='location',frame=f)


def assembly(o, first, last, shift):
    o.location = shift
    o.keyframe_insert(data_path='location', frame=1)
    o.keyframe_insert(data_path='location', frame=first)
    o.location = (0,0,0)
    o.keyframe_insert(data_path='location', frame=last)


# 12 fps, 48 seconds: physical components arrive before the flow illustration.
assembly(boiler, 18, 106, (0,0,5.0))
assembly(lid, 126, 168, (0,0,5.0))
assembly(header, 150, 228, (-.2,0,5.0))
assembly(vent_group, 150, 228, (-.2,0,5.0))
assembly(bath, 228, 275, (0,0,5.0))
assembly(coil, 266, 335, (0,0,5.0))
assembly(receiver, 350, 411, (0,0,5.0))

# Stage, lights, and camera remain outside the export collection.
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.065))
stage=bpy.context.object
stage.name='Render stage | not part of device'
stage.data.materials.append(floor_mat)
world=bpy.context.scene.world
world.color=(.035,.035,.035)
world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.055,.066,.058,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.35

def area(name, loc, power, size, color, target):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=power
    data.shape='DISK'
    data.size=size
    data.color=color
    ob=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(ob)
    ob.location=loc
    ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()

area('Large warm key',(-3,-5,7),850,5.0,(1,.72,.49),(0,0,1))
area('Cool condenser rim',(4,2,5),1000,4.0,(.42,.75,.83),(0,0,1.2))
area('Soft front fill',(3,-6,3),400,4.0,(1,.9,.73),(0,0,1))

bpy.ops.object.camera_add(location=(5.5,-10,5.0))
cam=bpy.context.object
cam.name='Cinematic camera'
cam.rotation_euler=(Vector((0,0,1.42))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO'
cam.data.ortho_scale=7.2
scene=bpy.context.scene
scene.camera=cam
scene.render.engine='CYCLES' if '--cycles' in ARGS else 'BLENDER_EEVEE'
scene.render.resolution_x=960
scene.render.resolution_y=540
scene.render.resolution_percentage=100
scene.render.fps=12
scene.frame_start=1
scene.frame_end=576
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
scene.render.image_settings.color_mode='RGBA'
scene.view_settings.view_transform='AgX'
scene.render.filepath=os.path.join(ASSETS,'frames','frame_')
scene.render.image_settings.color_depth='8'
scene.render.fps=12
scene.render.resolution_percentage=100

scene.frame_set(412)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ASSETS,'copper-crown.blend'))

# GLB is static assembled model. Do not export render stage, flow guides or animation.
bpy.ops.object.select_all(action='DESELECT')
export_groups={base,boiler,lid,header,vent_group,bath,coil,receiver}
for ob in scene.objects:
    if ob in export_groups or (ob.parent in export_groups and ob.type in {'MESH','CURVE'}):
        ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(ASSETS,'copper-crown.glb'), export_format='GLB', use_selection=True, export_animations=False, export_current_frame=True)

if '--still' in ARGS:
    scene.frame_set(412)
    scene.render.resolution_percentage=200
    scene.render.filepath=os.path.join(ASSETS,'copper-crown-poster.png')
    bpy.ops.render.render(write_still=True)
    scene.render.resolution_percentage=100
if '--render' in ARGS:
    os.makedirs(os.path.join(ASSETS,'frames'),exist_ok=True)
    scene.render.filepath=os.path.join(ASSETS,'frames','frame_')
    bpy.ops.render.render(animation=True)
