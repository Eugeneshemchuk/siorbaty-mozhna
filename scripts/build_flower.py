#!/usr/bin/env python3
"""Draw the Flower of Life as a stroke-only SVG (used as a CSS mask, so colour comes from the theme).
19 circles within 2R of the centre, plus lattice circles further out clipped to the union of those 19
(the traditional 'completed petals' form), inside a double enclosing ring."""
import math

R, B = 100, 300                       # petal circle radius, enclosing ring radius (3R)
C = B + 24                            # canvas half-size


def lattice(max_d):
    pts = set()
    for i in range(-8, 9):
        for j in range(-8, 9):
            x, y = R * (i + j / 2), R * j * math.sqrt(3) / 2
            if math.hypot(x, y) <= max_d + 0.01:
                pts.add((round(x, 3), round(y, 3)))
    return sorted(pts)


core, outer = lattice(2 * R), lattice(4 * R)
circ = lambda pts: "".join(f'<circle cx="{x}" cy="{y}" r="{R}"/>' for x, y in pts)
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-C} {-C} {2*C} {2*C}" fill="none" stroke="#000" stroke-width="3">'
       f'<g transform="rotate(90)"><defs><clipPath id="u">{circ(core).replace("<circle", "<circle fill=\"#000\"")}</clipPath></defs>'
       f'<g clip-path="url(#u)">{circ(outer)}</g>{circ(core)}'
       f'<circle r="{B}"/><circle r="{B + 14}"/></g></svg>')
open("assets/illustrations/flower-of-life.svg", "w").write(svg)
print(len(core), "core +", len(outer), "lattice circles,", len(svg), "bytes")
