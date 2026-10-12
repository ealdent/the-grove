"""Apollo Flight Dynamics — an original ManimGX 0.1.1 teaching film.

All trajectories are explicitly schematic. No historical trajectory is claimed.
See README.md for provenance, render instructions, and historical sources.
"""
from __future__ import annotations

import math
import numpy as np
import manimgx as m

BG = '#101c1a'
IVORY = '#eee8d5'
MINT = '#adddc5'
RUST = '#db654b'
GOLD = '#c8af76'
MUTED = '#82968a'
GRID = '#20352f'
m.config.background_color = BG
m.config.pixel_width = 1600
m.config.pixel_height = 900
m.config.frame_rate = 30


def p(x, y):
    return np.array([x, y, 0.0])


def label(text, x, y, size=22, color=IVORY, font='monospace', left=False):
    item = m.Text(text, font=font, font_size=size, color=color)
    item.move_to(p(x, y))
    if left:
        item.align_to(p(x, y), m.LEFT)
    return item


def line(a, b, color=MUTED, width=1, opacity=1):
    return m.Line(p(*a), p(*b), color=color, stroke_width=width, stroke_opacity=opacity)


def route(points, color=MINT, width=2.4):
    return m.VMobject(color=color, stroke_width=width).set_points_smoothly([p(*xy) for xy in points])


def cross(x, y, size=.12, color=MUTED):
    return m.VGroup(line((x-size,y),(x+size,y),color), line((x,y-size),(x,y+size),color))


def body(x, y, radius, color=IVORY, earth=False):
    g = m.VGroup(m.Circle(radius=radius, color=color, stroke_width=1.8,
                         fill_color=BG, fill_opacity=1).move_to(p(x,y)))
    if earth:
        g.add(m.Ellipse(width=radius*.7,height=radius*2,color=color,stroke_width=.75).move_to(p(x,y)))
        g.add(m.Ellipse(width=radius*2,height=radius*.55,color=color,stroke_width=.75).move_to(p(x,y)))
    else:
        g.add(m.Arc(radius=radius*.8,start_angle=-1.3,angle=2.6,color=color,stroke_width=.7).move_to(p(x+.07,y)))
    return g


def ship(x, y):
    return m.VGroup(m.Dot(p(x,y),radius=.052,color=MINT),
                    m.Circle(radius=.115,color=MINT,stroke_width=1).move_to(p(x,y)))


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
        g=m.VGroup()
        for x in np.arange(-6.5,6.6,.5):
            g.add(line((x,-3.05),(x,2.8),GRID,.55,.65))
        for y in np.arange(-3,2.81,.5):
            g.add(line((-6.5,y),(6.5,y),GRID,.55,.65))
        g.add(line((-6.5,3.13),(6.5,3.13),MUTED,.8))
        g.add(line((-6.5,-3.22),(6.5,-3.22),MUTED,.8))
        g.add(label('APOLLO  /  FLIGHT DYNAMICS',-6.5,3.49,19,MINT,left=True))
        g.add(label('THE GROVE  ·  FIELD NOTES  001',6.5,3.49,16,MUTED).align_to(p(6.5,3.49),m.RIGHT))
        g.add(label('MANIMGX  /  A MATHEMATICAL FLIGHT FILM',-6.5,-3.56,16,MUTED,left=True))
        g.add(label('SCHEMATIC · NOT TO SCALE',6.5,-3.56,16,MUTED).align_to(p(6.5,-3.56),m.RIGHT))
        return g

    def chapter(self, number, title, lines, equation=None):
        g=m.VGroup(label(number+' / FIVE IDEAS',-6.3,2.54,18,GOLD,left=True),
                   label(title,-6.3,1.51,41,IVORY,'serif',True))
        for i,tx in enumerate(lines):
            g.add(label(tx,-6.3,.3-i*.38,20,MUTED,'sans-serif',True))
        if equation:
            eq=m.MathTex(equation,font_size=32,color=MINT).move_to(p(-4.3,-2.2))
            g.add(eq)
        g.add(line((-2.35,-2.72),(-2.35,2.72),MUTED,.7,.45))
        self.play(m.FadeIn(g),run_time=.7)
        return g

    def close(self, *items):
        self.play(*[m.FadeOut(item) for item in items],run_time=.6)

    def cover(self):
        title=m.VGroup(label('The shape of arrival.',0,2.2,62,IVORY,'serif'),
                      label('HOW NASA AIMED APOLLO AT A MOVING MOON',0,1.46,21,GOLD))
        earth=body(-4,-.7,.58,earth=True)
        moon=body(4.2,-.1,.28)
        flight=route([(-4.38,-.8),(-3.2,-1.8),(-.2,-1.8),(2.9,-1.0),(4.65,-.64),(4.95,.14),(4.4,.78),(3.55,.48),(1.5,-.3),(-1.6,-.95),(-3.65,-.72)],MINT,2.2)
        ann=m.VGroup(label('EARTH',-4,-2.09,18),label('MOON',4.2,-1.35,18),
                     label('POSITION. VELOCITY. TIME.',0,-2.61,23,MINT))
        self.play(m.FadeIn(title),m.FadeIn(earth),m.FadeIn(moon),run_time=.8)
        self.play(m.Create(flight),m.FadeIn(ann),run_time=2.0)
        self.wait(1.6)
        self.close(title,earth,moon,flight,ann)

    def state_vector(self):
        words=self.chapter('01','Measure the\npresent.',[
            'Tracking provides evidence.', 'Navigation estimates position', 'and velocity at a known time.',
            'Those six numbers describe', 'a starting state.'],r'\mathbf{x}(t)=(\mathbf{r},\mathbf{v})')
        earth=body(2,-.3,.53,earth=True)
        orbit=m.Circle(radius=1.86,color=MUTED,stroke_width=1).move_to(p(2,-.3))
        craft=ship(3.49,.816)
        rad=m.Arrow(p(2,-.3),p(3.49,.816),color=MINT,stroke_width=2,buff=.12)
        vel=m.Arrow(p(3.49,.816),p(2.65,1.94),color=GOLD,stroke_width=2,buff=.08)
        axes=m.VGroup(line((-.55,-.3),(5.7,-.3),MUTED,.8,.5),line((2,-2.35),(2,2.33),MUTED,.8,.5))
        info=m.VGroup(label('r',3.0,.15,31,MINT,'serif'),label('v',3.48,1.74,31,GOLD,'serif'),
                       label('EARTH',2.85,-.96,17,MUTED),label('A STATE, AT A TIME',2,-2.68,18,MUTED))
        geometry=m.VGroup(earth,orbit,axes,craft,rad,vel,info)
        self.play(m.Create(orbit),m.FadeIn(earth),m.FadeIn(axes),run_time=1.6)
        self.play(m.Create(rad),m.Create(vel),m.FadeIn(craft),m.FadeIn(info),run_time=1.4)
        self.play(m.Indicate(craft,color=MINT,scale_factor=1.7),run_time=1.2)
        self.wait(4.5)
        self.close(words,geometry)

    def injection(self):
        words=self.chapter('02','Change the\nfuture.',[
            'A prograde burn adds speed.', 'The far end of the path rises.', 'Translunar injection turns',
            'a low Earth orbit into', 'an outward lunar transfer.'],r'\Delta\mathbf{v}\;\longrightarrow\;\text{new orbit}')
        earth=body(-.7,-.2,.31,earth=True)
        park=m.Circle(radius=.72,color=MUTED,stroke_width=1.2).move_to(p(-.7,-.2))
        orbit=m.Ellipse(width=7.05,height=4.27,color=MINT,stroke_width=2).move_to(p(2.105,-.2))
        trace=route([(2.105+3.525*math.cos(t),-.2+2.135*math.sin(t)) for t in np.linspace(math.pi,0,65)],MINT)
        craft=ship(-1.42,-.2)
        burn=m.Arrow(p(-1.42,-.2),p(-1.42,1.22),color=RUST,stroke_width=4,buff=0)
        annotations=m.VGroup(label('TLI',-1.35,1.6,21,RUST),label('PARKING ORBIT',-.55,-2.25,17,MUTED),
                             label('IDEAL TWO-BODY VIEW',2.1,-2.65,18,MUTED),
                             label('HIGHER APOGEE',3.9,-.7,18,MINT))
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
            'NASA refined the solution', 'with numerical integration.'],r'\mathbf{r}_{SC}(t_f)\;\approx\;\mathbf{r}_{Moon}(t_f)')
        earth=body(-.9,-.8,.35,earth=True)
        start=p(4.7,-1.98); end=p(4.62,1.43)
        moon=body(*start[:2],.28)
        ghost=m.Circle(radius=.28,color=MUTED,stroke_width=1).move_to(start)
        target=m.DashedVMobject(m.Circle(radius=.64,color=GOLD,stroke_width=1).move_to(end),num_dashes=20)
        lunarpath=route([(4.7,-1.98),(5.03,-.9),(5.04,.3),(4.62,1.43)],MUTED,1)
        transfer=route([(-1.18,-.71),(-.05,.55),(1.54,1.79),(3.2,1.8),(4.15,1.0)],MINT,2.5)
        craft=ship(-1.18,-.71)
        notes=m.VGroup(label('MOON AT DEPARTURE',3.8,-2.57,16,MUTED),
                       label('MOON AT ARRIVAL',4.35,2.34,17,GOLD),
                       label('MEET IN SPACE AND TIME',1.2,-1.71,19,MINT))
        geometry=m.VGroup(earth,moon,ghost,target,lunarpath,transfer,craft,notes)
        self.play(m.FadeIn(earth),m.FadeIn(moon),m.FadeIn(ghost),m.Create(target),m.FadeIn(notes),run_time=1)
        self.play(m.Create(lunarpath),m.Create(transfer),run_time=2)
        self.play(m.MoveAlongPath(craft,transfer),m.MoveAlongPath(moon,lunarpath),run_time=4,rate_func=m.linear)
        self.play(m.Indicate(target,color=GOLD,scale_factor=1.1),run_time=1)
        self.wait(.7)
        self.close(words,geometry)

    def encounter(self):
        words=self.chapter('04','Choose the\nencounter.',[
            'Lunar gravity bends the path.', 'Some transfers were designed', 'for a free return to Earth.',
            'To stay at the Moon, Apollo', 'fired a braking burn.'],r'\text{brake}\;\longrightarrow\;\text{capture}')
        moon=body(2.13,.15,.48)
        flyby=route([(-1.4,-1.9),(.25,-1.49),(2.64,-.79),(3.28,.22),(2.73,1.3),(1.1,1.27),(-.38,.3),(-1.4,-.59)],MINT,2.5)
        capture=m.Ellipse(width=2.4,height=1.65,color=GOLD,stroke_width=2).move_to(p(2.13,.15))
        craft=ship(-1.4,-1.9)
        burn=m.Arrow(p(3.14,-.03),p(3.14,-1.12),color=RUST,stroke_width=3,buff=0)
        notes=m.VGroup(label('FREE-RETURN GEOMETRY',1.1,2.3,18,MINT),
                       label('BRAKE TO ENTER ORBIT',3.95,-1.78,18,RUST),
                       label('LUNAR ORBIT',4.67,.85,18,GOLD),
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
            'The return targets a narrow', 'Earth-entry corridor.'],r'\text{observe}\;\to\;\text{solve}\;\to\;\Delta v')
        earth=body(4.5,-.55,.85,earth=True)
        atmosphere=m.Arc(radius=1.03,start_angle=2.36,angle=.5,arc_center=p(4.5,-.55),color=GOLD,stroke_width=7,stroke_opacity=.65)
        # Explicitly schematic paths show different endpoint errors, not a simulated atmosphere.
        nominal=route([(-1.6,1.39),(.2,1.05),(1.7,.55),(3.2,.1),(3.6,-.05)],MINT,2.5)
        miss=m.DashedVMobject(route([(-1.6,1.39),(.2,1.14),(2.2,1.11),(4.4,1.34),(5.66,1.59)],MUTED,1.2),num_dashes=35)
        craft=ship(-1.6,1.39)
        correction=m.Arrow(p(.2,1.05),p(.45,.33),color=RUST,stroke_width=3,buff=0)
        notes=m.VGroup(label('CORRECTION',.12,2.14,18,RUST),
                       label('ENTRY CORRIDOR',4.58,-2.05,18,GOLD),
                       label('MISS WITHOUT CORRECTION',3.96,2.1,16,MUTED),
                       label('THE FLIGHT PLAN IS A LIVING SOLUTION.',1.85,-2.7,18,MINT))
        geometry=m.VGroup(earth,atmosphere,nominal,miss,craft,correction,notes)
        self.play(m.FadeIn(earth),m.FadeIn(atmosphere),m.FadeIn(notes),m.Create(miss),run_time=1.2)
        self.play(m.Create(correction),m.Create(nominal),run_time=1.8)
        self.play(m.MoveAlongPath(craft,nominal),run_time=3.5,rate_func=m.linear)
        self.wait(2.2)
        self.wait(.6)
