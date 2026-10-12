"""Apollo Flight Dynamics — an original ManimGX 0.1.1 teaching film.

All trajectories are explicitly schematic. No historical trajectory is claimed.
See README.md for provenance, render instructions, and historical sources.
"""
from __future__ import annotations

import math
import numpy as np
import manimgx as m

BG = '#09090d'
WHITE = '#f4f4ee'
SIGNAL = '#ff6333'
BURN = '#ff6333'
LAVENDER = '#b6b1c5'
MUTED = '#9d9ba8'
RETICLE = '#42404f'
m.config.background_color = BG
m.config.pixel_width = 1600
m.config.pixel_height = 900
m.config.frame_rate = 30


def p(x, y):
    return np.array([x, y, 0.0])


def label(text, x, y, size=22, color=WHITE, font='monospace', left=False, heavy=False):
    item = m.Text(text, font=font, font_size=size, color=color, weight='BOLD' if heavy else 'NORMAL')
    if heavy:
        item.stretch(.82, 0)
    item.move_to(p(x, y))
    if left:
        item.align_to(p(x, y), m.LEFT)
    return item


def line(a, b, color=MUTED, width=1, opacity=1):
    return m.Line(p(*a), p(*b), color=color, stroke_width=width, stroke_opacity=opacity)


def route(points, color=SIGNAL, width=3.1):
    return m.VMobject(color=color, stroke_width=width).set_points_smoothly([p(*xy) for xy in points])


def cross(x, y, size=.12, color=MUTED):
    return m.VGroup(line((x-size,y),(x+size,y),color), line((x,y-size),(x,y+size),color))


def body(x, y, radius, color=WHITE, earth=False):
    g = m.VGroup(m.Circle(radius=radius, color=color, stroke_width=2.1,
                         fill_color=BG, fill_opacity=1).move_to(p(x,y)))
    if earth:
        g.add(m.Ellipse(width=radius*.7,height=radius*2,color=color,stroke_width=.75).move_to(p(x,y)))
        g.add(m.Ellipse(width=radius*2,height=radius*.55,color=color,stroke_width=.75).move_to(p(x,y)))
    else:
        g.add(m.Arc(radius=radius*.8,start_angle=-1.3,angle=2.6,color=color,stroke_width=.7).move_to(p(x+.07,y)))
    return g


def ship(x, y):
    return m.VGroup(m.Dot(p(x,y),radius=.052,color=WHITE),
                    m.Circle(radius=.115,color=SIGNAL,stroke_width=1).move_to(p(x,y)))


class ApolloFlightPlan(m.Scene):
    def construct(self):
        self.add(self.background())
        self.cover()
        self.state_vector()
        self.injection()
        self.intercept()
        self.encounter()
        self.correction()

    def background(self):
        # Optical registration marks, not engineering graph paper.
        g=m.VGroup()
        center=p(2.08,-.05)
        for radius,opacity in [(3.01,.50),(2.91,.23)]:
            g.add(m.Circle(radius=radius,color=RETICLE,stroke_width=.85,stroke_opacity=opacity).move_to(center))
        for angle in np.linspace(0,2*math.pi,48,endpoint=False):
            inner=2.94 if round(angle/(2*math.pi)*48)%4 else 2.83
            a=center+p(inner*math.cos(angle),inner*math.sin(angle))
            b=center+p(3.01*math.cos(angle),3.01*math.sin(angle))
            g.add(m.Line(a,b,color=RETICLE,stroke_width=.85,stroke_opacity=.72))
        for x,y,r in [(-6.38,-2.82,.015),(-5.2,-2.64,.011),(-1.73,2.58,.02),
                      (5.98,2.1,.015),(6.27,-1.74,.016),(5.8,-2.73,.011),
                      (.04,-2.69,.013),(3.05,2.73,.01),(6.13,.27,.01)]:
            g.add(m.Dot(p(x,y),radius=r,color=WHITE,fill_opacity=.38))
        for x,y in [(-6.55,2.95),(6.55,2.95),(-6.55,-3.08),(6.55,-3.08)]:
            g.add(cross(x,y,.1,RETICLE))
        g.add(m.Dot(p(-6.43,3.49),radius=.042,color=SIGNAL))
        g.add(label('APOLLO / OPTICAL NAVIGATION',-6.22,3.49,18,WHITE,left=True))
        g.add(label('THE GROVE  /  MOTION STUDY 01',6.5,3.49,16,MUTED).align_to(p(6.5,3.49),m.RIGHT))
        g.add(label('MANIMGX  /  FLIGHT DYNAMICS',-6.5,-3.56,16,MUTED,left=True))
        g.add(label('SCHEMATIC · NOT TO SCALE',6.5,-3.56,16,MUTED).align_to(p(6.5,-3.56),m.RIGHT))
        return g

    def chapter(self, number, title, lines, readout=None):
        names={'01':'VECTOR / MEASUREMENT','02':'IMPULSE / DEPARTURE',
               '03':'TIME / INTERCEPTION','04':'GRAVITY / CAPTURE','05':'ERROR / CORRECTION'}
        badge=m.Rectangle(width=.58,height=.44,fill_color=SIGNAL,fill_opacity=1,stroke_width=0).move_to(p(-6.01,2.58))
        heading=label(title.upper(),-6.3,1.5,43,WHITE,'sans-serif',True,True)
        if heading.width>3.76:
            heading.stretch_to_fit_width(3.76).align_to(p(-6.3,1.5),m.LEFT)
        g=m.VGroup(badge,label(number,-6.01,2.58,19,BG),
                   label(names[number],-5.52,2.58,15,LAVENDER,left=True),heading)
        for i,tx in enumerate(lines):
            g.add(label(tx,-6.3,.3-i*.38,20,MUTED,'sans-serif',True))
        if readout:
            eq=label(readout,-6.3,-2.2,23,WHITE,'monospace',True)
            if eq.width>3.8:
                eq.stretch_to_fit_width(3.8).align_to(p(-6.3,-2.2),m.LEFT)
            g.add(eq)
        self.play(m.FadeIn(g),run_time=.7)
        return g

    def close(self, *items):
        self.play(*[m.FadeOut(item) for item in items],run_time=.6)

    def cover(self):
        title=m.VGroup(label('APOLLO',-6.25,2.22,84,WHITE,'sans-serif',True,True),
                      label('THE WAY HOME',-6.25,1.25,34,SIGNAL,'sans-serif',True,True),
                      label('LUNAR TRAJECTORIES / APOLLO',6.24,2.57,16,LAVENDER).align_to(p(6.24,2.57),m.RIGHT))
        earth=body(-4,-.7,.58,earth=True)
        moon=body(4.2,-.1,.28)
        flight=route([(-4.38,-.8),(-3.2,-1.8),(-.2,-1.8),(2.9,-1.0),(4.65,-.64),(4.95,.14),(4.4,.78),(3.55,.48),(1.5,-.3),(-1.6,-.95),(-3.65,-.72)],SIGNAL,3.7)
        ann=m.VGroup(label('EARTH',-4,-2.09,18),label('MOON',4.2,-1.35,18),
                     label('POSITION / VELOCITY / TIME',0,-2.66,22,WHITE,'sans-serif',False,True))
        self.play(m.FadeIn(title),m.FadeIn(earth),m.FadeIn(moon),run_time=.8)
        self.play(m.Create(flight),m.FadeIn(ann),run_time=2.0)
        self.wait(1.6)
        self.close(title,earth,moon,flight,ann)

    def state_vector(self):
        words=self.chapter('01','Measure the\npresent.',[
            'Tracking provides evidence.', 'Navigation estimates position', 'and velocity at a known time.',
            'Those six numbers describe', 'a starting state.'],'x(t) = [ r, v ]')
        earth=body(2,-.3,.53,earth=True)
        orbit=m.Circle(radius=1.86,color=MUTED,stroke_width=1).move_to(p(2,-.3))
        craft=ship(3.49,.816)
        rad=m.Arrow(p(2,-.3),p(3.49,.816),color=SIGNAL,stroke_width=2,buff=.12)
        vel=m.Arrow(p(3.49,.816),p(2.65,1.94),color=LAVENDER,stroke_width=2,buff=.08)
        axes=m.VGroup(line((-.55,-.3),(5.7,-.3),MUTED,.8,.5),line((2,-2.35),(2,2.33),MUTED,.8,.5))
        info=m.VGroup(label('r',3.0,.15,28,SIGNAL,'sans-serif'),label('v',3.48,1.74,28,LAVENDER,'sans-serif'),
                       label('EARTH',2.85,-.96,17,MUTED),label('A STATE, AT A TIME',2,-2.68,18,MUTED))
        geometry=m.VGroup(earth,orbit,axes,craft,rad,vel,info)
        self.play(m.Create(orbit),m.FadeIn(earth),m.FadeIn(axes),run_time=1.6)
        self.play(m.Create(rad),m.Create(vel),m.FadeIn(craft),m.FadeIn(info),run_time=1.4)
        self.play(m.Indicate(craft,color=SIGNAL,scale_factor=1.7),run_time=1.2)
        self.wait(4.5)
        self.close(words,geometry)

    def injection(self):
        words=self.chapter('02','Change the\nfuture.',[
            'A prograde burn adds speed.', 'The far end of the path rises.', 'Translunar injection turns',
            'a low Earth orbit into', 'an outward lunar transfer.'],'Δv → NEW ORBIT')
        earth=body(-.7,-.2,.31,earth=True)
        park=m.Circle(radius=.72,color=MUTED,stroke_width=1.2).move_to(p(-.7,-.2))
        orbit=m.Ellipse(width=7.05,height=4.27,color=SIGNAL,stroke_width=2).move_to(p(2.105,-.2))
        trace=route([(2.105+3.525*math.cos(t),-.2+2.135*math.sin(t)) for t in np.linspace(math.pi,0,65)],SIGNAL)
        craft=ship(-1.42,-.2)
        burn=m.Arrow(p(-1.42,-.2),p(-1.42,1.22),color=BURN,stroke_width=4,buff=0)
        annotations=m.VGroup(label('TLI',-1.35,1.6,21,BURN),label('PARKING ORBIT',-.55,-2.25,17,MUTED),
                             label('IDEAL TWO-BODY VIEW',2.1,-2.65,18,MUTED),
                             label('HIGHER APOGEE',3.9,-.7,18,SIGNAL))
        geometry=m.VGroup(earth,park,orbit,craft,burn,annotations)
        self.play(m.FadeIn(earth),m.Create(park),m.FadeIn(craft),run_time=1)
        self.play(m.Create(burn),m.FadeIn(annotations),run_time=1)
        self.play(m.Create(orbit),run_time=2)
        self.play(m.MoveAlongPath(craft,trace),run_time=3.5,rate_func=m.linear)
        self.wait(1.2)
        self.close(words,geometry)

    def intercept(self):
        words=self.chapter('03','Aim where\nit will be.',[
            'The Moon moves as you coast.', 'Departure, burn direction', 'and flight time must agree.',
            'NASA refined the solution', 'with numerical integration.'],'r_SC(t) ≈ r_Moon(t)')
        earth=body(-.9,-.8,.35,earth=True)
        start=p(4.7,-1.98); end=p(4.62,1.43)
        moon=body(*start[:2],.28)
        ghost=m.Circle(radius=.28,color=MUTED,stroke_width=1).move_to(start)
        target=m.DashedVMobject(m.Circle(radius=.64,color=LAVENDER,stroke_width=1).move_to(end),num_dashes=20)
        lunarpath=route([(4.7,-1.98),(5.03,-.9),(5.04,.3),(4.62,1.43)],MUTED,1)
        transfer=route([(-1.18,-.71),(-.05,.55),(1.54,1.79),(3.2,1.8),(4.15,1.0)],SIGNAL,2.5)
        craft=ship(-1.18,-.71)
        notes=m.VGroup(label('MOON AT DEPARTURE',3.8,-2.57,16,MUTED),
                       label('MOON AT ARRIVAL',4.35,2.34,17,LAVENDER),
                       label('MEET IN SPACE AND TIME',1.2,-1.71,19,SIGNAL))
        geometry=m.VGroup(earth,moon,ghost,target,lunarpath,transfer,craft,notes)
        self.play(m.FadeIn(earth),m.FadeIn(moon),m.FadeIn(ghost),m.Create(target),m.FadeIn(notes),run_time=1)
        self.play(m.Create(lunarpath),m.Create(transfer),run_time=2)
        self.play(m.MoveAlongPath(craft,transfer),m.MoveAlongPath(moon,lunarpath),run_time=4,rate_func=m.linear)
        self.play(m.Indicate(target,color=LAVENDER,scale_factor=1.1),run_time=1)
        self.wait(.7)
        self.close(words,geometry)

    def encounter(self):
        words=self.chapter('04','Choose the\nencounter.',[
            'Lunar gravity bends the path.', 'Some transfers were designed', 'for a free return to Earth.',
            'To stay at the Moon, Apollo', 'fired a braking burn.'],'BRAKE → CAPTURE')
        moon=body(2.13,.15,.48)
        flyby=route([(-1.4,-1.9),(.25,-1.49),(2.64,-.79),(3.28,.22),(2.73,1.3),(1.1,1.27),(-.38,.3),(-1.4,-.59)],SIGNAL,2.5)
        capture=m.Circle(radius=1.2,color=LAVENDER,stroke_width=2).move_to(p(2.13,.15))
        craft=ship(-1.4,-1.9)
        burn=m.Arrow(p(3.33,.15),p(3.33,-.94),color=BURN,stroke_width=3,buff=0)
        notes=m.VGroup(label('FREE-RETURN GEOMETRY',1.1,2.3,18,SIGNAL),
                       label('BRAKE TO ENTER ORBIT',3.95,-1.78,18,BURN),
                       label('LUNAR ORBIT',4.67,.85,18,LAVENDER),
                       label('DIFFERENT TARGETS · DIFFERENT PATHS',1.95,-2.69,17,MUTED))
        geometry=m.VGroup(moon,flyby,capture,craft,burn,notes)
        self.play(m.FadeIn(moon),m.FadeIn(notes),run_time=1)
        self.play(m.Create(flyby),run_time=1.7)
        self.play(m.MoveAlongPath(craft,flyby),run_time=3.2,rate_func=m.linear)
        self.play(m.Create(capture),m.Create(burn),run_time=1.5)
        self.wait(1.3)
        self.close(words,geometry)

    def correction(self):
        words=self.chapter('05','Refine the\nsolution.',[
            'Tracking updates the state.', 'Small corrections trim', 'the miss at the destination.',
            'The return targets a narrow', 'Earth-entry corridor.'],'OBSERVE → SOLVE → Δv')
        earth=body(4.5,-.55,.85,earth=True)
        atmosphere=m.Arc(radius=1.03,start_angle=2.36,angle=.5,arc_center=p(4.5,-.55),color=LAVENDER,stroke_width=7,stroke_opacity=.65)
        # Explicitly schematic paths show different endpoint errors, not a simulated atmosphere.
        nominal=route([(-1.6,1.39),(.2,1.05),(1.7,.55),(3.2,.1),(3.6,-.05)],SIGNAL,2.5)
        miss=m.DashedVMobject(route([(-1.6,1.39),(.2,1.14),(2.2,1.11),(4.4,1.34),(5.66,1.59)],MUTED,1.2),num_dashes=35)
        craft=ship(-1.6,1.39)
        correction=m.Arrow(p(.2,1.05),p(.45,.33),color=BURN,stroke_width=3,buff=0)
        notes=m.VGroup(label('CORRECTION',.12,2.14,18,BURN),
                       label('ENTRY CORRIDOR',4.58,-2.05,18,LAVENDER),
                       label('MISS WITHOUT CORRECTION',3.96,2.1,16,MUTED),
                       label('THE FLIGHT PLAN IS A LIVING SOLUTION.',1.85,-2.7,18,SIGNAL))
        geometry=m.VGroup(earth,atmosphere,nominal,miss,craft,correction,notes)
        self.play(m.FadeIn(earth),m.FadeIn(atmosphere),m.FadeIn(notes),m.Create(miss),run_time=1.2)
        self.play(m.Create(correction),m.Create(nominal),run_time=1.8)
        self.play(m.MoveAlongPath(craft,nominal),run_time=3.5,rate_func=m.linear)
        self.wait(2.2)
        self.wait(.6)
