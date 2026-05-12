# Terminal Systems

A single-page, scroll-based **cinematic 3D logistics website** built with
[Three.js](https://threejs.org/) and
[GSAP / ScrollTrigger](https://greensock.com/scrolltrigger/).

A procedural sunset warehouse yard with semi-trucks, shipping containers,
and a foundation-model "digital twin" wireframe overlay that fades in
mid-scroll. No build step, no external assets — open and run.

## Run it

The page uses ES module imports via an import map, so it needs to be
served over `http://` (not `file://`). Any static server works:

```bash
# Python
python3 -m http.server 8080

# Node
npx serve .

# or any other static server
```

Then open <http://localhost:8080>.

## Files

| File         | Role                                                              |
| ------------ | ----------------------------------------------------------------- |
| `index.html` | Page structure, navigation, 5 scroll "acts," parallax layer DOM   |
| `styles.css` | Layout, typography, parallax layers, overlay reveal initial state |
| `main.js`    | Three.js scene + GSAP ScrollTrigger camera choreography           |

## The 5 acts

The page scroll is mapped onto five camera keyframes:

1. **Terminal** — wide establishing shot of the yard at sunset
2. **Markets** — pull right & down along the truck line
3. **Fleet** — close side-pass of the hero semi-truck
4. **Intelligence** — rise above the yard, wireframe AI mesh fades in
5. **Contact** — pullback / horizon reveal

Camera positions are interpolated with `smoothstep` easing in
`lerpKeyframes()` inside `main.js`.

## Performance notes

- Pixel ratio is capped at 2.
- Antialiasing is disabled on hi-DPI displays.
- Shadows use a single 2048² PCF shadow map from the sun only.
- The animation loop pauses while the tab is hidden.
- Procedural canvas textures keep the bundle at 0 bytes of binary art.

## Accessibility

- Respects `prefers-reduced-motion`: disables scrubbed scroll and
  reveal animations.
- Decorative canvas + parallax layers are `aria-hidden`.
- Text overlays remain readable without the WebGL context (the
  CSS gradient fallback paints the canvas while shaders compile).
