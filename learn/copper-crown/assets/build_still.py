"""Create Copper Crown's editable, animated Blender scene and web model.

Run with Blender, e.g. blender -b -t 4 --python build_still.py -- --assets DIR.
The illustration is transparent to expose the condenser; it is not a
dimensioned fabrication drawing. One scene unit is approximately 160 mm.
"""
import bpy
import math
import os
import sys
import numpy as np
from mathutils import Vector


ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ASSETS = os.path.abspath(ARGS[ARGS.index('--assets') + 1]) if '--assets' in ARGS else os.path.dirname(os.path.abspath(__file__))
os.makedirs(ASSETS, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for data in bpy.data.materials:
    bpy.data.materials.remove(data)


def surface_texture(name, rgb, seed, kind):
    """Create a tileable, exportable surface map; no Blender-only noise nodes."""
    n = 512
    yy, xx = np.mgrid[0:n,0:n].astype(np.float32) / n
    rng = np.random.default_rng(seed)
    mottled = np.zeros((n,n), dtype=np.float32)
    for i in range(22):
        freq_x = int(rng.integers(1, 14))
        freq_y = int(rng.integers(1, 14))
        phase = float(rng.uniform(0,2*math.pi))
        amp = .32 / (1 + i*.23)
        mottled += amp*np.sin(2*math.pi*(freq_x*xx+freq_y*yy)+phase)
    grain = rng.normal(0,1,(n,n)).astype(np.float32)
    brushed = .012*np.sin(yy*math.pi*2*180) + .008*np.sin(yy*math.pi*2*71)
    # The domed lid uses a gentler map: broad UV rings there otherwise read as wood.
    variation = (.022 if kind=='lid' else .065)*mottled + .02*grain + brushed
    color = np.empty((n,n,4), dtype=np.float32)
    base = np.asarray(rgb, dtype=np.float32)
    for i in range(3): color[:,:,i] = np.clip(base[i]*(1+variation), .015,.96)
    # Restrained oxidation belongs only on the decorative, exterior metals.
    if kind in {'copper','brass','lid'}:
        aged = np.clip((mottled-.7)*(.035 if kind=='lid' else .09),0,.09)
        color[:,:,:3] = color[:,:,:3]*(1-aged[:,:,None]) + np.asarray([.22,.29,.23])[None,None,:]*aged[:,:,None]
    color[:,:,3] = 1
    image = bpy.data.images.new(name, width=n, height=n, alpha=True)
    image.pixels.foreach_set(color.reshape(-1))
    image.filepath_raw = os.path.join(ASSETS, name+'.png')
    image.file_format = 'PNG'
    image.save()
    image.pack()
    return image


def material(name, color, metal=0, rough=.35, alpha=1, emission=None, texture=None):
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
    if texture:
        tex = m.node_tree.nodes.new('ShaderNodeTexImage')
        tex.name = 'Exported hand-weathered surface'
        tex.image = texture
        m.node_tree.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    return m


patinated_copper = surface_texture('copper-crown-patinated-copper', (.62,.27,.13), 93, 'copper')
brushed_lid = surface_texture('copper-crown-brushed-lid', (.62,.27,.13), 81, 'lid')
worked_brass = surface_texture('copper-crown-worked-brass', (.68,.46,.21), 16, 'brass')
black_iron = surface_texture('copper-crown-black-iron', (.14,.15,.13), 44, 'iron')
copper = material('Aged copper | exterior only', (.34, .115, .052), .78, .31, texture=patinated_copper)
copper_lid = material('Brushed copper crown | exterior only', (.34,.115,.052),.8,.29,texture=brushed_lid)
brass = material('Brushed brass | exterior only', (.55, .30, .095), .82, .28, texture=worked_brass)
steel = material('316L stainless | vapor path', (.47, .53, .53), .8, .24)
dark = material('Blackened steel', (.045, .048, .046), .66, .32, texture=black_iron)
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
    uv = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        j, i = divmod(poly.index, steps)
        vals=((i/steps,j/(len(profile)-1)),((i+1)/steps,j/(len(profile)-1)),
              ((i+1)/steps,(j+1)/(len(profile)-1)),(i/steps,(j+1)/(len(profile)-1)))
        for li, value in zip(poly.loop_indices, vals): uv.data[li].uv = value
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    own(ob, parent, mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def jacket_strip(name, x, angle, radius, width, z0, z1, mat, parent):
    """A narrow curved decorative reinforcement outside the kettle."""
    sides=8
    v=[]
    for z in (z0,z1):
        for i in range(sides+1):
            a=angle-width/2+width*i/sides
            v.append((x+radius*math.cos(a),radius*math.sin(a),z))
    f=[(i,i+1,sides+i+2,sides+i+1) for i in range(sides)]
    m=bpy.data.meshes.new(name);m.from_pydata(v,[],f);m.update()
    uv=m.uv_layers.new(name='UVMap')
    for poly in m.polygons:
        i=poly.index
        for li,u in zip(poly.loop_indices, ((i/sides,0),((i+1)/sides,0),((i+1)/sides,1),(i/sides,1))):
            uv.data[li].uv=u
    o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);own(o,parent,mat)
    solid=o.modifiers.new('Exterior strap thickness','SOLIDIFY');solid.thickness=.009
    for poly in m.polygons: poly.use_smooth=True
    return o


def hollow_fitting(name, center, outer, inner, depth, direction, mat, parent, sides=12):
    """A bored union; the central vapor/vent tube remains unobstructed."""
    verts=[]
    for z in (-depth/2,depth/2):
        for radius in (outer,inner):
            for i in range(sides):
                a=2*math.pi*i/sides
                verts.append((radius*math.cos(a),radius*math.sin(a),z))
    faces=[]
    for i in range(sides):
        n=(i+1)%sides
        faces.extend([(i,n,2*sides+n,2*sides+i),
                      (sides+n,sides+i,3*sides+i,3*sides+n),
                      (i,sides+i,sides+n,n),
                      (2*sides+n,3*sides+n,3*sides+i,2*sides+i)])
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    uv=mesh.uv_layers.new(name='UVMap')
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            v=mesh.vertices[mesh.loops[li].vertex_index].co
            uv.data[li].uv=((math.atan2(v.y,v.x)/(2*math.pi))%1, (v.z/depth)+.5)
    ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob)
    ob.location=center; ob.rotation_euler=Vector(direction).to_track_quat('Z','Y').to_euler()
    own(ob,parent,mat);bevel(ob,.003,2)
    return ob


def ring_axis(name, center, major, minor, direction, mat, parent):
    ob=torus(name, center, major, minor, mat, parent)
    ob.rotation_euler=Vector(direction).to_track_quat('Z','Y').to_euler()
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
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.convert(target='MESH')
    ob.select_set(False)
    return ob


def instrument(name, center, radius, label, parent, needle=.1):
    """External temperature indicator; values are illustrative, not pressure."""
    x,y,z=center
    o=cylinder(name+' knurled bezel', (x,y,z),radius,.075,brass,parent,48,.004)
    o.rotation_euler.x=math.pi/2
    o=cylinder(name+' dark separator', (x,y-.041,z),radius*.87,.012,dark,parent,48,.003)
    o.rotation_euler.x=math.pi/2
    o=cylinder(name+' enamel face', (x,y-.049,z),radius*.81,.008,cream,parent,64,.002)
    o.rotation_euler.x=math.pi/2
    ring_axis(name+' fine bezel', (x,y-.055,z),radius*.83,.008,(0,1,0),steel,parent)
    for i in range(25):
        a=math.radians(-128+256*i/24)
        inner=radius*(.60 if i%6==0 else .68)
        outer=radius*.77
        path(name+' graduation',[(x+inner*math.sin(a),y-.057,z+inner*math.cos(a)),
                                  (x+outer*math.sin(a),y-.057,z+outer*math.cos(a))],
             .0035,dark,parent)
    numbers=(0,40,80,120) if label=='TEMP' else (0,20,40,60)
    for i,number in enumerate(numbers):
        a=math.radians(-128+256*i/3)
        text_obj(str(number),name+' scale value',
                 (x+.50*radius*math.sin(a),y-.066,z+.50*radius*math.cos(a)),
                 radius*.15,dark,parent)
    a=math.radians(-128+256*needle)
    path(name+' needle',[(x-.09*radius*math.sin(a),y-.063,z-.09*radius*math.cos(a)),
                         (x+.62*radius*math.sin(a),y-.063,z+.62*radius*math.cos(a))],
         .007,dark,parent)
    uvball(name+' needle pin',(x,y-.071,z),(.022,.012,.022),brass,parent,16,8)
    text_obj(label,name+' label',(x,y-.067,z-.16*radius),radius*.23,dark,parent)
    text_obj('°C',name+' units',(x,y-.067,z-.48*radius),radius*.19,dark,parent)


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
for x in (-2.2,2.28):
    for y in (-.62,.62):
        cylinder('Machined isolation foot', (x,y,-.025), .12,.075,dark,base,32,.008)
        torus('Isolation foot brass rim', (x,y,.015),.092,.013,brass,base)
for x in (-2.36,2.44):
    cube('Plinth corner inlay',(x,0,.213),(.055,1.39,.012),brass,base,.006)
cube('Front maker plate',(.05,-.922,.095),(1.17,.032,.095),brass,base,.012)
cube('Maker plate inset',(.05,-.941,.095),(1.08,.009,.068),dark,base,.006)
text_obj('C O P P E R   C R O W N','Engraved maker plate',(.05,-.949,.095),.037,cream,base)
for x in (-.47,.57):
    uvball('Maker plate pin',(x,-.948,.095),(.013,.008,.013),steel,base,12,8)

bx = -1.23
cylinder('Black electric heater', (bx, 0, .32), .80, .24, dark, boiler)
torus('Heater brass lower bead', (bx, 0, .235), .75, .035, brass, boiler)
torus('Heater brass upper bead', (bx, 0, .425), .75, .035, brass, boiler)
for i in range(24):
    a = 2*math.pi*i/24
    uvball('Heater rivet', (bx+.78*math.cos(a), .78*math.sin(a), .33), (.035,.035,.035), brass, boiler, 12, 8)
for i in range(16):
    a=2*math.pi*i/16
    x,y=bx+.802*math.cos(a),.802*math.sin(a)
    vent_slot=cube('Heater cooling louvre bezel',(x,y,.39),(.095,.018,.035),brass,boiler,.006)
    vent_slot.rotation_euler.z=a+math.pi/2
    slot=cube('Heater cooling louvre',(x+.012*math.cos(a),y+.012*math.sin(a),.39),(.075,.008,.017),dark,boiler,.004)
    slot.rotation_euler.z=a+math.pi/2
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
for i in range(8):
    a=2*math.pi*i/8+math.pi/8
    jacket_strip('Riveted exterior jacket strap',bx,a,.731,.115,.64,1.43,brass,boiler)
    for z in (.72,1.35):
        uvball('Strap fastener',(bx+.742*math.cos(a),.742*math.sin(a),z),(.027,.027,.027),steel,boiler,12,8)
for z in (.54,.61,1.46,1.53):
    torus('Turned bead on jacket',(bx,0,z),.724,.009,dark,boiler)
torus('Stainless kettle lip', (bx, 0, 1.69), .67, .045, steel, boiler)
cube('Heater control plaque', (bx, -.804, .345), (.42,.05,.16), brass, boiler, .02)
cylinder('Heater indicator', (bx-.13, -.84, .345), .027, .018, glow, boiler, 24, .003).rotation_euler.x = math.pi/2
text_obj('HEAT', 'Heater label', (bx+.045,-.834,.345), .078, dark, boiler)
# A conceptual physical representation of a separate heater temperature limit.
cube('Independent heater temperature limit housing', (bx+.44,-.71,.36), (.25,.10,.16), dark, boiler,.016)
text_obj('LIMIT', 'Temperature limit label', (bx+.44,-.766,.365), .046, cream, boiler)
path('Limit sensor lead', [(bx+.49,-.74,.43),(bx+.58,-.65,.47),(bx+.64,-.48,.50),(bx+.64,-.37,.55)], .012,dark,boiler)
uvball('External high temperature probe', (bx+.64,-.37,.55), (.04,.04,.05),steel,boiler,16,8)
instrument('Kettle temperature indicator',(bx,-.765,1.10),.255,'TEMP',boiler,.54)
# The handle carries no fluid; it is bolted to the external jacket.
for side in (-1,1):
    x=bx+side*.74
    path('Copper jacket carrying handle',[(x,0,1.40),(x+side*.09,0,1.40),
         (x+side*.17,0,1.35),(x+side*.17,0,1.18),(x+side*.10,0,1.12),(x,0,1.12)],.027,brass,boiler)
    for z in (1.13,1.40):
        uvball('Handle external fastener',(x,0,z),(.05,.05,.05),brass,boiler,16,8)
# An accessible, plainly labelled heater dial outside the hot vessel.
dial_x=bx-.46
cube('Heater dial plinth',(dial_x,-.71,.31),(.25,.13,.18),dark,boiler,.015)
o=cylinder('Machined heater dial',(dial_x,-.79,.31),.065,.026,brass,boiler,48,.005);o.rotation_euler.x=math.pi/2
o=cylinder('Black heater knob',(dial_x,-.809,.31),.046,.02,dark,boiler,32,.003);o.rotation_euler.x=math.pi/2
path('Knob index',[(dial_x,-.823,.31),(dial_x+.005,-.823,.346)],.004,cream,boiler)
text_obj('OFF     HEAT','Dial positions',(dial_x,-.786,.397),.035,cream,boiler)

# Smooth capped dome: decorative outer surface, with stainless underside and fittings.
lathe('Removable domed lid', bx, 0, [(0,1.95),(.16,1.945),(.34,1.91),(.51,1.84),(.62,1.76),(.67,1.69)], copper_lid, lid)
lathe('Stainless lid liner (wetted face)', bx, 0, [(0,1.927),(.16,1.922),(.34,1.887),(.51,1.817),(.62,1.737),(.67,1.667)], steel, lid)
torus('Lid steel gasket rim', (bx, 0, 1.69), .67, .035, steel, lid)
torus('Lid collar', (bx, 0, 1.94), .16, .025, brass, lid)
for i in range(14):
    a = 2*math.pi*i/14
    uvball('Lid perimeter rivet', (bx+.66*math.cos(a), .66*math.sin(a),1.72), (.03,.03,.03), brass, lid, 12, 8)
for z,r in ((1.73,.65),(1.78,.60),(1.84,.49)):
    torus('Dome turned detail',(bx,0,z),r,.008,brass,lid)
for i in range(6):
    a=2*math.pi*i/6+math.pi/6
    x,y=bx+.655*math.cos(a),.655*math.sin(a)
    clip=cube('Lid external clamp',(x,y,1.735),(.13,.070,.036),dark,lid,.008)
    clip.rotation_euler.z=a
    uvball('Lid clamp polished pin',(x,y,1.76),(.022,.022,.022),brass,lid,12,8)

# The entire wetted vapor route is modeled as stainless; decorative collars are external.
path('Central riser', [(bx,0,1.92),(bx,0,2.13)], .065, steel, header)
uvball('Demister separator vessel', (bx,0,2.25), (.20,.20,.22), steel, header, 48,24)
torus('Demister external brass collar', (bx,0,2.25), .20, .018, brass, header)
for z in (2.16,2.34):
    r=.20*math.sqrt(1-((z-2.25)/.22)**2)
    torus('Demister turned collar',(bx,0,z),r,.008,brass,header)
for z in (1.995,2.105,2.46,2.53):
    hollow_fitting('Riser sanitary union',(bx,0,z),.085,.066,.048,(0,0,1),brass,header,8)
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
    hollow_fitting('Bored vapor-line union',(x,0,2.63),.09,.066,.085,(1,0,0),brass,header,8)
    ring_axis('Vapor union shoulder',(x-.047,0,2.63),.075,.009,(1,0,0),steel,header)
# Vent leaves lid separately, rises continuously and remains open, no valve or cap.
vent = [(bx-.34,.04,1.82),(bx-.34,.04,1.95),(bx-.43,.04,2.05),(bx-.45,.04,2.93),(bx-.50,.04,3.03),(bx-.63,.04,3.06)]
path('Independent open boiler vent', vent, .047, steel, header)
bpy.context.collection.objects['Independent open boiler vent'].parent = vent_group
torus('Vent entry collar', (bx-.34,.04,1.82), .07,.014,brass,vent_group)
hollow_fitting('Open vent tip ferrule',vent[-1],.062,.048,.055,(-.13,0,.03),brass,vent_group,12)
hollow_fitting('Open vent stem union',(bx-.45,.04,2.46),.063,.048,.055,(0,0,1),brass,vent_group,8)

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
for a in (math.radians(32),math.radians(148),math.radians(235),math.radians(305)):
    x,y=cx+.70*math.cos(a),.70*math.sin(a)
    path('Bath exterior support post',[(x,y,.43),(x,y,1.90)],.022,brass,bath)
    for z in (.50,1.03,1.84):
        uvball('Support hoop clamp',(x,y,z),(.042,.042,.035),brass,bath,12,8)
for z in (.63,1.66):
    # Low supply and high overflow nipples are outside the product coil.
    hollow_fitting('Open cooling-water hose connection',(cx+.70,.05,z),.060,.031,.10,(1,0,0),steel,bath,12)
    for dx in (.04,.065):
        ring_axis('Cooling hose barb',(cx+.70+dx,.05,z),.050,.006,(1,0,0),brass,bath)
    hollow_fitting('Cooling port hex gland',(cx+.71,.05,z),.072,.032,.040,(1,0,0),brass,bath,8)
    for dz in (-.11,.11):
        uvball('Cooling port flange screw',(cx+.69,.05,z+dz),(.022,.022,.022),brass,bath,12,8)
instrument('Cooling water thermometer',(cx+.56,-.48,1.39),.145,'COOL',bath,.36)
path('Coolant thermometer sensing lead',[(cx+.55,-.46,1.28),(cx+.64,-.42,1.20),
     (cx+.69,-.30,1.13),(cx+.67,-.22,1.07)],.009,steel,bath)
torus('Cooling-water surface glint',(cx,0,1.72),.63,.006,cream,bath)

coil_points=[]
N=280
for i in range(N+1):
    t=i/N
    theta=-math.pi/2 - 2*math.pi*5.0*t
    coil_points.append((cx+.44*math.cos(theta),.44*math.sin(theta),1.78-.77*t))
path('316L submerged condenser coil', coil_points,.0375,steel,coil)
outlet=[coil_points[-1], (1.55,-.44,1.00),(1.72,-.44,.99),(1.78,-.44,.96),(2.10,-.44,.94),(2.18,-.44,.90),(2.18,-.44,.86)]
path('Stainless distillate outlet, open to air',outlet,.0375,steel,coil)
hollow_fitting('Coil outlet service union',(1.75,-.44,.975),.057,.038,.060,(1,0,0),brass,coil,8)
hollow_fitting('Free outlet lip',outlet[-1],.049,.038,.040,(0,0,1),steel,coil,12)

# Carafe is presented open with an air gap between the tube and opening.
rx, ry = 2.18, -.44
lathe('Open glass collection carafe',rx,ry,[(.0,.22),(.27,.22),(.30,.27),(.30,.51),(.24,.57),(.13,.60),(.13,.66),(.15,.66)],receiver_glass,receiver)
torus('Carafe lip', (rx,ry,.66), .14,.015,steel,receiver)
lathe('Illustrative collected water',rx,ry,[(0,.23),(.275,.23),(.28,.27),(.28,.36),(0,.36)],water,receiver)
torus('Carafe reinforced glass foot',(rx,ry,.25),.28,.018,receiver_glass,receiver)
for i in range(5):
    z=.30+i*.045
    path('Carafe etched graduation',[(rx+.14,ry-.273,z),(rx+.14+(.10 if i%2==0 else .055),ry-.273,z)],.004,cream,receiver)
cube('Collector name plate',(rx,ry-.32,.24),(.30,.025,.055),brass,receiver,.008)
text_obj('COLLECT', 'Receiver identifier',(rx,ry-.338,.24),.032,dark,receiver)

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

# The editable scene keeps individual screws, tubes, and rigged part groups.
# The web copy combines evaluated geometry by parent group and material so the
# browser can still explode the eight named groups without hundreds of draws.
export_groups={base,boiler,lid,header,vent_group,bath,coil,receiver}
depsgraph=bpy.context.evaluated_depsgraph_get()
batches={}
for original in list(scene.objects):
    if original.parent not in export_groups or original.type not in {'MESH','CURVE'}:
        continue
    evaluated=original.evaluated_get(depsgraph)
    mesh=bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
    if not mesh or not mesh.polygons:
        continue
    # Curves and small custom rings may not have UVs. The fallback UV is for
    # their exterior trim; lathed jackets have authored cylindrical unwraps.
    if not mesh.uv_layers:
        uv=mesh.uv_layers.new(name='UVMap')
        for i,loop in enumerate(mesh.loops):
            v=mesh.vertices[loop.vertex_index].co
            uv.data[i].uv=((v.x*.35)%1,(v.z*.35)%1)
    if not mesh.materials and original.data.materials:
        mesh.materials.append(original.data.materials[0])
    mat=mesh.materials[0] if mesh.materials else None
    clone=bpy.data.objects.new('Export part '+original.name,mesh)
    bpy.context.collection.objects.link(clone)
    clone.parent=original.parent
    clone.matrix_world=original.matrix_world.copy()
    # Keep translucent objects distinct so the viewer can depth-sort the
    # bath, water, carafe, and glass foot independently.
    transparent=bool(mat and mat.diffuse_color[3] < 1)
    batches.setdefault((original.parent,mat,original.name if transparent else None),[]).append(clone)

merged=[]
for (parent,mat,_sort_key),objects in batches.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1: bpy.ops.object.join()
    ob=bpy.context.view_layer.objects.active
    ob.name='Web batch | '+parent.name+' | '+(mat.name if mat else 'unassigned')
    merged.append(ob)
bpy.ops.object.select_all(action='DESELECT')
for ob in export_groups: ob.select_set(True)
for ob in merged: ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(ASSETS,'copper-crown.glb'), export_format='GLB', use_selection=True, export_animations=False, export_current_frame=True)
for ob in merged: bpy.data.objects.remove(ob,do_unlink=True)

if '--still' in ARGS:
    scene.frame_set(412)
    scene.render.resolution_percentage=200
    # Poster only: physically rendered reflections and contact shadows. The
    # saved scene and assembly animation remain EEVEE for practical speed.
    original_engine=scene.render.engine
    scene.render.engine='CYCLES'
    scene.cycles.device='CPU'
    scene.cycles.samples=64
    scene.cycles.use_denoising=True
    scene.render.filepath=os.path.join(ASSETS,'copper-crown-poster.png')
    bpy.ops.render.render(write_still=True)
    scene.render.engine=original_engine
    scene.render.resolution_percentage=100
if '--render' in ARGS:
    os.makedirs(os.path.join(ASSETS,'frames'),exist_ok=True)
    scene.render.filepath=os.path.join(ASSETS,'frames','frame_')
    bpy.ops.render.render(animation=True)
