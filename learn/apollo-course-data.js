/** Pure, deterministic teaching content. Distances are km; orbital time is seconds.
 * These are planar two-body exercises, not reconstructed Apollo flight solutions. */
const MU = 398600.4418;
const RADIUS = 6378.137;
const G0 = 9.80665;
const DEG = Math.PI / 180;
const wrap = angle => ((angle % 360) + 360) % 360;
const fmt = (value, digits = 5) => Number(value.toFixed(digits)).toString();
const magnitude = (x, y) => Math.hypot(x, y);
const heading = (x, y) => wrap(Math.atan2(y, x) / DEG);
const circular = r => Math.sqrt(MU / r);
const period = r => 2 * Math.PI * Math.sqrt(r ** 3 / MU);
const exhaust = isp => G0 * isp;
function transfer(r1, r2) {
  const a = (r1 + r2) / 2;
  const v1 = circular(r1), v2 = circular(r2);
  const u1 = Math.sqrt(MU * (2 / r1 - 1 / a));
  const u2 = Math.sqrt(MU * (2 / r2 - 1 / a));
  return { a, v1, v2, u1, u2, dv1: u1 - v1, dv2: v2 - u2,
    time: Math.PI * Math.sqrt(a ** 3 / MU) };
}
function burn(m0, isp, force, throttle, dv) {
  const ve = exhaust(isp), mf = m0 * Math.exp(-1000 * Math.abs(dv) / ve);
  const fuel = m0 - mf, flow = force * throttle / ve;
  return { mf, fuel, flow, duration: fuel / flow };
}
const MIT = { title: 'MIT OpenCourseWare · Review of classical astrodynamics', url: 'https://ocw.mit.edu/courses/16-522-space-propulsion-spring-2015/6127948308ccbe73c1c44751e2509ae0_MIT16_522S15_Lecture5.pdf' };
const ROCKET = { title: 'NASA Glenn · Ideal rocket equation', url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/' };
const ISP = { title: 'NASA Glenn · Specific impulse', url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/specific-impulse/' };
const control = (key, label, min, max, step, value, unit = '') => ({ key, label, min, max, step, value, unit });
const orbitalControls = () => [control('r1', 'Departure radius', 6700, 10000, 100, 7000, 'km'), control('r2', 'Arrival radius', 11000, 30000, 100, 14000, 'km')];
const workedTransfer = transfer(7000, 14000);
const workedBurn = burn(10000, 450, 180000, 0.6, 0.5);
const workedMission = burn(10000, 450, 180000, 0.6, workedTransfer.dv1);
const workedMissionArrival = burn(workedMission.mf, 450, 180000, 0.6, workedTransfer.dv2);

export const LESSONS = [
  {
    id: 'vectors', title: 'Give a velocity a direction', kicker: '01 · Coordinate tools',
    goal: 'Resolve vectors, recover the correct quadrant, and translate a local burn into the fixed map frame.',
    paragraphs: [
      'A position r = (x, y) locates the spacecraft relative to Earth’s center. A velocity v = (vx, vy) describes how that position changes. The components may be negative; the magnitude, or speed, cannot. This course uses kilometers and seconds, so velocity is in km/s. Divide a value in m/s by 1000 to obtain km/s.',
      'Our map bearings increase counterclockwise: +x points right/east at 0°, +y points up at 90°, and left is 180°. These are mathematical bearings, not geographic compass bearings. Use cos and sin to split a magnitude into components. To reverse that calculation, atan2(y, x) keeps both signs; atan(y/x) alone can point into the wrong quadrant.',
      'An inertial bearing is measured against the fixed map axes. A local radial direction points away from Earth; a local tangential direction points 90° counterclockwise from radial. For a circular counterclockwise orbit, that tangent is prograde, meaning along orbital motion. Negative radial is inward, and negative tangential opposes the positive tangent. A craft on an eccentric orbit can also have radial velocity: its full prograde velocity direction need not equal the local tangent.'
    ],
    equations: [
      { formula: 'vx = v cos θ; vy = v sin θ', meaning: 'v is speed in km/s and θ is the counterclockwise map bearing in degrees. The calculator’s trig functions use degrees.' },
      { formula: 'v = √(vx² + vy²); θ = wrap360[atan2(vy, vx)]', meaning: 'Recover magnitude and bearing. wrap360 adds or removes whole revolutions. A zero vector has no defined bearing.' },
      { formula: 'Δv = vdesired − vcurrent', meaning: 'Subtract components to find the velocity change an engine must supply; pointing toward a destination is generally a different direction.' },
      { formula: 'Δvx = Δvr cos θ − Δvt sin θ; Δvy = Δvr sin θ + Δvt cos θ', meaning: 'θ is the position bearing; Δvr and Δvt are signed radial and counterclockwise tangential burn components.' }
    ],
    worked: { prompt: 'A velocity is (−3, +4) km/s. Find its speed and map bearing.', steps: ['Keep the signs: vx = −3, vy = +4, placing the vector in quadrant II.', 'Speed = √((−3)² + 4²) = √25 = 5 km/s.', 'atan2(4, −3) = 126.86990°. It already lies between 0° and 360°.', 'Check: 5 cos(126.86990°) ≈ −3 and 5 sin(126.86990°) ≈ 4 km/s.'], answer: '5 km/s at 126.86990°.' },
    pitfalls: ['Do not use a compass convention: 90° here points up, not east.', 'An engine changes velocity; its commanded vector is desired velocity minus current velocity.'],
    visual: { kind: 'vectors', controls: [control('magnitude', 'Velocity magnitude', 0, 8, 0.1, 5, 'km/s'), control('angle', 'Map bearing', 0, 360, 1, 127, '°')] }, references: [MIT]
  },
  {
    id: 'calculus', title: 'Turn force into a future position', kicker: '02 · Calculus in motion',
    goal: 'Connect derivatives, acceleration integrals, and small numerical steps without confusing a model with an exact trajectory.',
    paragraphs: [
      'Velocity is the derivative of position, and acceleration is the derivative of velocity. For a spacecraft near Earth, gravity points inward. The vector formula divides by r³ because the numerator already contains a position vector of length r; its acceleration magnitude is μ/r². Here μ = 398600.4418 km³/s², r is distance from Earth’s center in km, and gravity is in km/s².',
      'Integrating acceleration accumulates a velocity change: Δv = ∫a dt. Likewise, integrating velocity accumulates displacement. An engine’s force impulse is ∫F dt in newton-seconds; dividing that impulse by mass gives velocity change only when mass can be treated as constant. A rocket loses mass, so later we integrate F/m(t), leading to a logarithm.',
      'A computer repeatedly evaluates the equations at small time steps. Explicit Euler uses the old position and velocity for both updates. It is easy to inspect but accumulates error and can distort orbital energy. Trapezoidal quadrature improves an integral when endpoint samples are available; practical propagation needs a suitable integrator, convergence checks using smaller steps, and sufficiently complete forces. Apollo targeting included more than this Earth-only teaching model.'
    ],
    equations: [
      { formula: 'dr/dt = v; dv/dt = −μr/|r|³ + athrust', meaning: 'r is the position vector in km; v is km/s; both acceleration terms must be in km/s². Convert F/m from m/s² by dividing by 1000.' },
      { formula: 'Δv = ∫₀ᵀ a(t) dt; Δr = ∫₀ᵀ v(t) dt', meaning: 'Integrals have signed components. Equal time with positive and negative velocity can produce zero displacement.' },
      { formula: 'rnext = r + v Δt; vnext = v + a(r) Δt', meaning: 'One explicit Euler step, using the same old state on both right-hand sides; Δt is in seconds.' },
      { formula: '∫₀²ʰ v dt ≈ h(v₀ + 2v₁ + v₂)/2', meaning: 'Composite trapezoidal estimate from three equally spaced velocity samples at 0, h, and 2h.' }
    ],
    worked: { prompt: 'Start at (7000, 0) km with velocity (0, 7.5) km/s. Take one explicit Euler step of 10 s without thrust.', steps: [`Gravity magnitude = ${MU}/7000² = ${fmt(MU / 7000 ** 2, 8)} km/s².`, 'The acceleration points left: a = (−0.0081347029, 0) km/s².', 'Position uses old velocity: rnext = (7000, 0) + (0, 7.5) × 10 = (7000, 75) km.', `Velocity uses old acceleration: vnext = (0, 7.5) + (−${fmt(MU / 7000 ** 2, 8)}, 0) × 10 ≈ (−${fmt(MU / 7000 ** 2 * 10, 8)}, 7.5) km/s.`], answer: 'rnext = (7000, 75) km; vnext ≈ (−0.08134703, 7.5) km/s. This is one approximate step.' },
    pitfalls: ['Using newly updated velocity in the position update changes the specified Euler method.', 'A smooth-looking path is not an accuracy test. Compare smaller steps and conserved quantities during coast.'],
    visual: { kind: 'gravity', controls: [control('radius', 'Earth-centered radius', 6600, 20000, 100, 7000, 'km'), control('step', 'Integration step', 1, 120, 1, 10, 's')] }, references: [MIT, ISP]
  },
  {
    id: 'orbits', title: 'Read the shape of an orbit', kicker: '03 · Gravity and energy',
    goal: 'Calculate circular motion and use energy to predict speed around an ellipse.',
    paragraphs: [
      'Orbit is continuous falling with sideways velocity. For a circle, inward gravitational acceleration μ/r² must equal the centripetal acceleration v²/r. Cancel one factor of r to obtain circular speed. The period is circumference divided by that speed. Radius r is measured from Earth’s center: add Earth’s radius, 6378.137 km, to an altitude above the surface.',
      'Specific mechanical energy means energy per unit spacecraft mass: ε = v²/2 − μ/r, in km²/s². With only a stationary spherical Earth and no engine firing, ε stays constant. Negative energy describes a bound orbit; zero is the ideal escape boundary; positive energy permits escape. A bound mathematical orbit can still hit Earth, so negative energy alone does not make a safe flight.',
      'An ellipse has nearest radius rp, farthest radius ra, and semimajor axis a = (rp + ra)/2. Its energy is −μ/(2a). Equating the two energy expressions gives vis-viva, which tells you speed at any allowed radius. At the same radius, a larger a means a higher speed. Speed is greatest near Earth, not constant around the ellipse.'
    ],
    equations: [
      { formula: 'r = RE + h; vc = √(μ/r)', meaning: 'RE = 6378.137 km, h is altitude in km, and vc is circular speed in km/s.' },
      { formula: 'T = 2π√(r³/μ); n = 360°/T', meaning: 'T is one circular revolution in seconds; n is angular rate in degrees per second.' },
      { formula: 'ε = v²/2 − μ/r = −μ/(2a)', meaning: 'The last equality applies to a bound two-body ellipse; specific energy is in km²/s².' },
      { formula: 'v = √[μ(2/r − 1/a)]; vescape = √(2μ/r)', meaning: 'Vis-viva gives elliptical speed; escape speed corresponds to ε = 0. Radius must lie on the specified orbit.' }
    ],
    worked: { prompt: 'Find speed and period for a circular orbit at radius 7000 km.', steps: [`vc = √(${MU}/7000) = ${fmt(circular(7000))} km/s.`, `T = 2π√(7000³/${MU}) = ${fmt(period(7000), 2)} s.`, `Convert seconds to minutes: ${fmt(period(7000), 2)}/60 ≈ ${fmt(period(7000) / 60, 3)} min.`, `Its altitude is 7000 − ${RADIUS} = ${fmt(7000 - RADIUS, 3)} km, not 7000 km.`], answer: `${fmt(circular(7000))} km/s and ${fmt(period(7000), 2)} s (${fmt(period(7000) / 60, 3)} minutes).` },
    pitfalls: ['Do not put altitude directly into an Earth-centered gravity formula.', 'Matching position without matching velocity can produce a fast flyby rather than a rendezvous.'],
    visual: { kind: 'orbit', controls: [control('radius', 'Earth-centered radius', 6600, 30000, 100, 7000, 'km'), control('speedFactor', 'Speed / circular speed', 0.6, 1.5, 0.01, 1, '×')] }, references: [MIT]
  },
  {
    id: 'propulsion', title: 'Budget an engine firing', kicker: '04 · Thrust, fuel, and the logarithm',
    goal: 'Convert a desired velocity change into propellant and burn time, and recognize finite-burn limits.',
    paragraphs: [
      'Thrust F is a force in newtons. Throttle q is a fraction from zero to one, so delivered thrust is qF. At instantaneous mass m in kg, thrust acceleration is qF/m in m/s². Specific impulse Isp, measured in seconds, converts to effective exhaust speed ve = g0 Isp; g0 = 9.80665 m/s² is a reference constant, not the local orbital gravity.',
      'At fixed thrust and exhaust speed, propellant flow is qF/ve in kg/s. As fuel leaves, the same force accelerates less mass. Integrating this changing acceleration gives Δv = ve ln(m0/mf). That result is in m/s; divide by 1000 for this course’s km/s. Inverting the logarithm gives mf and therefore fuel consumed. Constant mass flow then gives duration.',
      'These engine calculations isolate an ideal thrust contribution. An instantaneous maneuver assumes position does not change during the burn. A long orbital firing violates that approximation: gravity and the direction of motion evolve while the engine runs. Holding the original inertial bearing keeps pointing at fixed map axes; continuously pointing prograde follows the changing velocity direction. Integrate the chosen steering law and m(t) to verify the actual arrival.',
      'Dry mass is the structure and payload that cannot be burned. Reject a plan that needs mf below dry mass. More throttle shortens an ideal burn without changing ideal fuel required for the same Δv and Isp, but it changes the finite trajectory and therefore may change the maneuver that is actually required.'
    ],
    equations: [
      { formula: 'athrust = qF/m; ve = g0 Isp; ṁprop = qF/ve', meaning: 'Acceleration is m/s², exhaust speed m/s, and positive propellant consumption kg/s. Spacecraft dm/dt = −ṁprop.' },
      { formula: 'Δv = (g0 Isp/1000) ln(m0/mf)', meaning: 'Ideal velocity-change magnitude in km/s; m0 and mf include remaining fuel and dry mass.' },
      { formula: 'mf = m0 exp[−1000Δv/(g0 Isp)]', meaning: 'Invert the rocket equation for final mass in kg. Propellant used is m0 − mf.' },
      { formula: 'tburn = (m0 − mf)/(qF/(g0 Isp))', meaning: 'Seconds of constant-thrust, constant-Isp burning; only feasible while fuel remains.' }
    ],
    worked: { prompt: 'Plan an ideal 0.5 km/s burn: m0 = 10000 kg, F = 180000 N, q = 0.6, Isp = 450 s, dry mass = 6000 kg.', steps: [`ve = ${G0} × 450 = ${fmt(exhaust(450), 4)} m/s.`, `mf = 10000 exp(−1000 × 0.5/${fmt(exhaust(450), 4)}) = ${fmt(workedBurn.mf, 2)} kg.`, `Fuel = 10000 − mf = ${fmt(workedBurn.fuel, 2)} kg; mf stays above 6000 kg.`, `Flow = 0.6 × 180000/${fmt(exhaust(450), 4)} = ${fmt(workedBurn.flow, 4)} kg/s.`, `Duration = fuel/flow = ${fmt(workedBurn.duration, 3)} s.`], answer: `${fmt(workedBurn.fuel, 2)} kg of propellant and ${fmt(workedBurn.duration, 3)} s in the ideal engine model.` },
    pitfalls: ['Convert Δv from km/s to m/s inside the exponential; a missing factor of 1000 gives a misleading fuel budget.', 'An ideal engine duration is a starting estimate, not proof that a long curved orbital burn achieves an impulsive transfer.'],
    visual: { kind: 'engine', controls: [control('throttle', 'Throttle', 0.1, 1, 0.05, 0.6, 'fraction'), control('duration', 'Burn duration', 0, 120, 1, 40, 's')] }, references: [ROCKET, ISP]
  },
  {
    id: 'transfer', title: 'Build a two-burn transfer', kicker: '05 · Connecting circular orbits',
    goal: 'Calculate both velocity changes and the coast time for outward and inward Hohmann transfers.',
    paragraphs: [
      'A Hohmann transfer joins two coplanar circular orbits with half an ellipse tangent to both circles. Here both circles are around the same Earth, and both spacecraft motions are counterclockwise. The first impulse changes departure speed. The second changes the speed at the other end to match the arrival circle. This is a useful mathematical building block, not an exact model of Apollo’s Earth–Moon three-body flight.',
      'The transfer ellipse has a = (r1 + r2)/2. Apply vis-viva at each endpoint. Signed Δv values are measured along the local counterclockwise tangent: positive is a prograde increase, negative a retrograde decrease. For an outward transfer both endpoint impulses are prograde; for an inward transfer both are retrograde. The fuel budget uses the sum of their magnitudes.',
      'The coast covers half an orbital revolution on the ellipse. Kepler’s period relation gives π√(a³/μ). Burns are assumed instantaneous, with no atmosphere, plane change, Moon, Sun, or finite-thrust losses. At arrival, compare the transfer velocity to the target circular velocity: touching the correct radius is only the start of the second maneuver.'
    ],
    equations: [
      { formula: 'a = (r1 + r2)/2; vci = √(μ/ri)', meaning: 'r1 and r2 are Earth-centered circular radii in km. a is the transfer semimajor axis.' },
      { formula: 'vt1 = √[μ(2/r1 − 1/a)]; vt2 = √[μ(2/r2 − 1/a)]', meaning: 'Endpoint transfer speeds in km/s, before adding the corresponding circularization impulse.' },
      { formula: 'Δv1 = vt1 − vc1; Δv2 = vc2 − vt2', meaning: 'Signed changes along the local counterclockwise tangent. Required ideal budget is |Δv1| + |Δv2|.' },
      { formula: 'tcoast = π√(a³/μ)', meaning: 'Time in seconds to travel halfway around the ideal transfer ellipse.' }
    ],
    worked: { prompt: 'Transfer from radius 7000 km to 14000 km. Find both signed impulses and coast time.', steps: ['a = (7000 + 14000)/2 = 10500 km.', `At departure, vc1 = ${fmt(workedTransfer.v1)} and vt1 = ${fmt(workedTransfer.u1)} km/s; Δv1 = +${fmt(workedTransfer.dv1)} km/s.`, `At arrival, vt2 = ${fmt(workedTransfer.u2)} and vc2 = ${fmt(workedTransfer.v2)} km/s; Δv2 = +${fmt(workedTransfer.dv2)} km/s.`, `Coast = π√(10500³/${MU}) = ${fmt(workedTransfer.time, 2)} s.`, `Total ideal budget = ${fmt(workedTransfer.dv1)} + ${fmt(workedTransfer.dv2)} ≈ ${fmt(workedTransfer.dv1 + workedTransfer.dv2)} km/s.`], answer: `Burn +${fmt(workedTransfer.dv1)} km/s, coast ${fmt(workedTransfer.time, 2)} s, then burn +${fmt(workedTransfer.dv2)} km/s.` },
    pitfalls: ['The second impulse is not optional when the task asks for a circular arrival orbit.', 'Use signed impulses for steering and absolute magnitudes for propellant consumption.'],
    visual: { kind: 'transfer', controls: orbitalControls() }, references: [MIT]
  },
  {
    id: 'intercept', title: 'Meet a target in space and time', kicker: '06 · Phase and relative velocity',
    goal: 'Choose a departure phase, wait for a launch opportunity, and distinguish interception from velocity matching.',
    paragraphs: [
      'A target orbiting Earth does not wait at your destination. Its angular rate on a circular orbit is n = √(μ/r³) radians per second, or 360/T degrees per second. On an ideal half-ellipse transfer, your arrival position is 180° beyond your departure position. Work backward: the target’s initial lead must be 180° minus the angle it travels during your coast.',
      'Phase means target bearing minus departure-spacecraft bearing, wrapped into one revolution. Both vehicles may be moving before departure. Their phase changes at n2 − n1, so a desired phase can require waiting. For an inner departure orbit and outer target, n1 > n2 and the target’s lead decreases. The next valid waiting time is the smallest nonnegative solution, allowing whole revolutions.',
      'Position coincidence is interception. Rendezvous also requires a small relative velocity vrel = vspacecraft − vtarget. A vehicle can pass directly through a target’s position at a dangerous closing speed. Inspect both components of relative velocity and budget an arrival maneuver. The Moon is not a passive circular target in the real Apollo problem: lunar gravity and the chosen lunar encounter must also be included.'
    ],
    equations: [
      { formula: 'n = √(μ/r³) rad/s = 360/T deg/s', meaning: 'Use consistent angular units. Multiply rad/s by 180/π before combining with degree bearings.' },
      { formula: 'φrequired = wrap360(180° − n2 tcoast)', meaning: 'Required initial target lead for a counterclockwise ideal half-ellipse transfer, with n2 in degrees/s.' },
      { formula: 'φ(t) = wrap360[φnow + (n2 − n1)t]', meaning: 'Relative phase during a wait while both vehicles remain in their departure circles.' },
      { formula: 'vrel = vSC − vtarget; closing-speed magnitude = |vrel|', meaning: 'Subtract velocity components in the same fixed frame. Zero position error alone does not imply zero closing speed.' }
    ],
    worked: { prompt: 'At radius 7000 km, depart for a circular target at 14000 km. How far ahead should the target start?', steps: [`The transfer coast is ${fmt(workedTransfer.time, 2)} s.`, `Target period = ${fmt(period(14000), 2)} s; n2 = 360/T = ${fmt(360 / period(14000), 8)} deg/s.`, `During coast, the target advances n2t = ${fmt(360 / period(14000) * workedTransfer.time, 4)}°.`, `Required lead = 180° − advance = ${fmt(wrap(180 - 360 / period(14000) * workedTransfer.time), 4)}°.`, `Arrival speed mismatch is vc2 − vt2 = ${fmt(workedTransfer.dv2)} km/s, requiring a second burn.`], answer: `${fmt(wrap(180 - 360 / period(14000) * workedTransfer.time), 4)}° ahead; then match velocity at arrival.` },
    pitfalls: ['Do not aim at the target’s current bearing; predict where it will be when you arrive.', 'A phase can be wrapped by 360°, but a waiting time cannot be made positive by taking an arbitrary absolute value.'],
    visual: { kind: 'intercept', controls: [...orbitalControls(), control('phase', 'Target’s initial lead', 0, 360, 1, 63, '°')] }, references: [MIT]
  },
  {
    id: 'correction', title: 'Turn a predicted miss into a correction', kicker: '07 · Linearization and feedback',
    goal: 'Solve simple targeting corrections, then recognize where the linear approximation stops being trustworthy.',
    paragraphs: [
      'Tracking updates an estimate of the spacecraft’s state. Propagating that estimate gives a predicted arrival point. Define the error here as desired arrival minus predicted arrival: e = rtarget − rpredicted. This explicit sign convention matters. If the target is farther right than the predicted arrival, ex is positive and the simple drift correction points right.',
      'For a short, nearly straight coast with little change in gravity, an immediate velocity change contributes roughly Δr = Δv τ after remaining time τ. Thus Δv ≈ e/τ. The result is km/s if e is km and τ is seconds. It is a local estimate: on a long curved orbital arc, gravity rotates and couples the effect of each velocity component.',
      'A more useful linear model is e ≈ J Δv. Entry Jij is the change in arrival coordinate i per change in present velocity component j, so its units are seconds. You can estimate a column of J by propagating a small positive and negative trial change. Solve the two simultaneous equations, apply a bounded correction, propagate again, and re-estimate. A nearly singular J, a large requested correction, or a changed arrival time can invalidate the local solution.'
    ],
    equations: [
      { formula: 'e = rtarget − rpredicted; Δv ≈ e/τ', meaning: 'e is the desired change in arrival position, not predicted minus desired; this drift estimate neglects acceleration changes.' },
      { formula: 'Jij ≈ [ri(v + δvj) − ri(v − δvj)]/(2δvj)', meaning: 'A central finite difference of propagated arrival position estimates sensitivity. Use km and km/s, giving seconds.' },
      { formula: '[ex, ey]ᵀ = [[Jxx, Jxy], [Jyx, Jyy]] [Δvx, Δvy]ᵀ', meaning: 'The off-diagonal terms capture coupling between a velocity change on one axis and a later position change on the other.' },
      { formula: 'det J = JxxJyy − JxyJyx; Δvx = (exJyy − Jxyey)/det J; Δvy = (Jxxey − exJyx)/det J', meaning: 'Two-by-two solution when det J is not zero; near-singular matrices amplify uncertainty and require care.' }
    ],
    worked: { prompt: 'The desired arrival is 120 km right and 60 km down from the predicted arrival. There are 1200 s left. Estimate a drift correction.', steps: ['Set e = (+120, −60) km, using target minus prediction.', 'Δvx ≈ 120/1200 = +0.1 km/s.', 'Δvy ≈ −60/1200 = −0.05 km/s.', 'Magnitude = √(0.1² + (−0.05)²) = 0.11180 km/s; bearing = 333.43495°.', 'Propagate the corrected state to verify the miss actually decreases; do not assume the drift approximation is exact.'], answer: 'Approximately (+0.1, −0.05) km/s, or 0.11180 km/s at 333.43495°.' },
    pitfalls: ['A sign mistake doubles the miss instead of correcting it.', 'For a real orbital arc, e/τ is only an estimate. Recompute the trajectory and check arrival velocity as well as position.'],
    visual: { kind: 'correction', controls: [control('errorX', 'Desired minus predicted x', -300, 300, 10, 120, 'km'), control('errorY', 'Desired minus predicted y', -300, 300, 10, -60, 'km'), control('remaining', 'Time remaining', 100, 3000, 100, 1200, 's')] }, references: [MIT]
  },
  {
    id: 'mission', title: 'Write a flight plan you can test', kicker: '08 · Navigation checkout',
    goal: 'Combine phase, vector steering, engine duration, fuel limits, coast, and arrival velocity into one verifiable plan.',
    paragraphs: [
      'Begin with a known state and a clearly defined objective. A target radius, a target position at a specific time, and a rendezvous with low relative velocity are different objectives. For a two-circle exercise, compute the transfer’s first impulse, coast duration, second impulse, and departure phase before touching the engine controls.',
      'Translate a signed tangential impulse into a fixed map bearing at the burn location. For a counterclockwise orbit at position bearing θ, a prograde impulse points at θ + 90° and a retrograde impulse at θ − 90°, wrapped into 0–360°. Compute its magnitude, convert it to an ideal engine duration, and check that fuel use preserves dry mass and a reserve for arrival.',
      'The flight console applies instantaneous velocity changes, deducts ideal propellant, and reports the equivalent engine duration; its mission clock advances only while coasting. After coasting, inspect both position error and relative velocity, then correct and re-test. Real finite burns require a further model in which mass, position, velocity, and steering evolve together. Successful practice in this Earth-centered teaching model is not a reconstruction or validation of an Apollo mission.'
    ],
    equations: [
      { formula: 'θburn = wrap360(θposition + 90°) for prograde; wrap360(θposition − 90°) for retrograde', meaning: 'These bearings apply to a local tangential impulse on a counterclockwise orbit, not geographic headings.' },
      { formula: 'Δvbudget = |Δv1| + |Δv2|; mf = m0 exp(−1000Δvbudget/(g0 Isp))', meaning: 'Ideal sequential burns with the same Isp can share a total mass-ratio budget; steering and timing still need separate plans.' },
      { formula: 'tburn = [m0 − m0 exp(−1000|Δv|/(g0 Isp))] g0 Isp/(qF)', meaning: 'Compute each burn from its own initial mass. The second burn starts with less mass than the first.' },
      { formula: 'At arrival: check |rSC − rtarget| and |vSC − vtarget|', meaning: 'Small position and velocity errors are both needed for rendezvous. A target crossing alone is insufficient.' }
    ],
    worked: { prompt: 'Depart a 7000 km circle at position bearing 30° for a 14000 km target. Use m0 = 10000 kg, dry mass = 6000 kg, Isp = 450 s, F = 180000 N, and throttle 0.6.', steps: [`Ideal first Δv = +${fmt(workedTransfer.dv1)} km/s, so map bearing = 30° + 90° = 120°.`, `Target lead = ${fmt(wrap(180 - 360 / period(14000) * workedTransfer.time), 4)}° and ideal coast = ${fmt(workedTransfer.time, 2)} s.`, `First-burn propellant = ${fmt(workedMission.fuel, 2)} kg; equivalent engine duration = ${fmt(workedMission.duration, 3)} s; remaining mass = ${fmt(workedMission.mf, 2)} kg.`, `Arrival position bearing = 30° + 180° = 210°, so the prograde second burn points at 300°. Its Δv is +${fmt(workedTransfer.dv2)} km/s. Using the remaining ${fmt(workedMission.mf, 2)} kg, it needs ${fmt(workedMissionArrival.fuel, 2)} kg and ${fmt(workedMissionArrival.duration, 3)} equivalent engine seconds.`, `Total ideal propellant = ${fmt(workedMission.fuel + workedMissionArrival.fuel, 2)} kg, within the 4000 kg available. This separate worked example illustrates the method; recalculate from your mission’s initial state, then verify arrival position and relative velocity.`], answer: `Burn at 120° for ${fmt(workedMission.duration, 3)} equivalent engine seconds; coast ${fmt(workedTransfer.time, 2)} s; burn at 300° for ${fmt(workedMissionArrival.duration, 3)} equivalent engine seconds. Only coast advances the ideal console’s clock.` },
    pitfalls: ['Do not spend the entire fuel supply on departure; arrival may still need a substantial velocity change.', 'The ideal impulse and finite engine burn are different models. A correct calculation still needs a propagated check.'],
    visual: { kind: 'mission', controls: [] }, references: [MIT, ROCKET, ISP]
  }
];

function hashSeed(seed) {
  let h = 2166136261;
  for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function random(seed) {
  let state = hashSeed(seed);
  const next = () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  return { int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)), sign: () => next() < 0.5 ? -1 : 1, pick: values => values[Math.floor(next() * values.length)] };
}
const g = (label, value, unit = '') => ({ label, value, unit });
const muGiven = () => g('Earth gravity parameter μ', MU, 'km³/s²');
const g0Given = () => g('Reference acceleration g0', G0, 'm/s²');
const answer = (key, label, unit, value, tolerance = Math.max(Math.abs(value) * 0.005, 1e-7)) => ({ key, label, unit, value, tolerance });
const angleAnswer = (key, label, value) => ({ ...answer(key, label, '°', wrap(value), 0.3), angle: true });
const choice = (key, label, value, options) => ({ key, label, unit: '', value, tolerance: 0, options: options.map(([value, label]) => ({ value, label })) });
const q = (title, prompt, givens, answers, hints, steps, takeaway, viz) => ({ title, prompt, givens, answers, hints, steps, takeaway, viz });
const signedPair = rng => [rng.sign() * rng.int(1, 8), rng.sign() * rng.int(1, 8)];
const bearingForBurn = (positionAngle, signedDV) => wrap(positionAngle + (signedDV >= 0 ? 90 : -90));
const phaseFor = (r2, time) => wrap(180 - 360 / period(r2) * time);

const TEMPLATES = {
  vectors: [
    rng => {
      const speed = rng.int(5, 75) / 10, angle = rng.int(0, 359);
      const x = speed * Math.cos(angle * DEG), y = speed * Math.sin(angle * DEG);
      return q('Split a velocity', 'Resolve this velocity into fixed-map x and y components. Bearings run counterclockwise from +x; +y is 90°.',
        [g('Speed v', speed, 'km/s'), g('Map bearing θ', angle, '°')],
        [answer('vx', 'x velocity', 'km/s', x), answer('vy', 'y velocity', 'km/s', y)],
        ['Use vx = v cos θ and vy = v sin θ; keep the signs.', `The x component is ${speed} × cos(${angle}°). The calculator uses degrees.`],
        [`vx = ${speed} cos(${angle}°) ≈ ${fmt(x, 7)} km/s.`, `vy = ${speed} sin(${angle}°) ≈ ${fmt(y, 7)} km/s.`, `Check √(vx² + vy²) = ${speed} km/s; signs select the quadrant.`],
        'A bearing becomes two signed components; both are needed to predict motion.', { kind: 'vectors', magnitude: speed, angle, vx: x, vy: y });
    },
    rng => {
      const [vx, vy] = signedPair(rng), speed = magnitude(vx, vy), angle = heading(vx, vy);
      return q('Recover speed and quadrant', 'A navigator reports signed velocity components. Recover speed and the counterclockwise map bearing from +x.',
        [g('vx', vx, 'km/s'), g('vy', vy, 'km/s')], [answer('speed', 'Speed', 'km/s', speed), angleAnswer('angle', 'Map bearing', angle)],
        ['Use the Pythagorean magnitude and atan2(vy, vx).', `atan2(${vy}, ${vx}) keeps the quadrant. Wrap a negative result by adding 360°.`],
        [`Speed = √((${vx})² + (${vy})²) = ${fmt(speed)} km/s.`, `Raw atan2(${vy}, ${vx}) = ${fmt(Math.atan2(vy, vx) / DEG)}°.`, `Wrapped bearing = ${fmt(angle)}°. Multiplying speed by its cosine/sine recovers (${vx}, ${vy}).`],
        'atan2 uses both signs; a one-argument arctangent cannot distinguish opposite directions.', { kind: 'vectors', vx, vy, magnitude: speed, angle });
    },
    rng => {
      const current = signedPair(rng), delta = [rng.sign() * rng.int(1, 15) / 10, rng.sign() * rng.int(1, 15) / 10];
      const desired = current.map((v, i) => Number((v + delta[i]).toFixed(1)));
      const dx = desired[0] - current[0], dy = desired[1] - current[1];
      return q('Command the change, not the destination', 'An ideal brief burn must change the current velocity to the desired velocity. Calculate the required signed Δv components.',
        [g('Current vx', current[0], 'km/s'), g('Current vy', current[1], 'km/s'), g('Desired vx', desired[0], 'km/s'), g('Desired vy', desired[1], 'km/s')],
        [answer('dvx', 'Required Δvx', 'km/s', dx), answer('dvy', 'Required Δvy', 'km/s', dy)],
        ['Subtract current velocity from desired velocity, one component at a time.', `Δvx = ${desired[0]} − (${current[0]}); repeat for y.`],
        [`Δvx = ${desired[0]} − (${current[0]}) = ${fmt(dx)} km/s.`, `Δvy = ${desired[1]} − (${current[1]}) = ${fmt(dy)} km/s.`, `Adding (${fmt(dx)}, ${fmt(dy)}) to the current vector gives (${desired[0]}, ${desired[1]}) km/s.`],
        'The burn vector is a difference between velocities, not the desired velocity itself.', { kind: 'vectors', current, desired, dvx: dx, dvy: dy, magnitude: magnitude(dx, dy), angle: heading(dx, dy) });
    },
    rng => {
      const theta = rng.int(0, 359), radial = rng.sign() * rng.int(1, 12) / 10, tangential = rng.sign() * rng.int(1, 12) / 10;
      const c = Math.cos(theta * DEG), s = Math.sin(theta * DEG), dx = radial * c - tangential * s, dy = radial * s + tangential * c;
      return q('Rotate a local burn into the map', 'At this position bearing, outward is radial and counterclockwise is the positive tangential direction. Convert the signed local burn into fixed-map components.',
        [g('Position bearing θ', theta, '°'), g('Outward radial Δvr', radial, 'km/s'), g('Counterclockwise tangential Δvt', tangential, 'km/s')],
        [answer('dvx', 'Map Δvx', 'km/s', dx), answer('dvy', 'Map Δvy', 'km/s', dy)],
        ['Radial basis is (cos θ, sin θ); tangent basis is (−sin θ, cos θ).', 'Multiply each basis by its signed local component and add the two vectors.'],
        [`Radial basis ≈ (${fmt(c)}, ${fmt(s)}); tangent basis ≈ (${fmt(-s)}, ${fmt(c)}).`, `Δvx = ${radial} cos(${theta}°) − (${tangential}) sin(${theta}°) ≈ ${fmt(dx, 7)} km/s.`, `Δvy = ${radial} sin(${theta}°) + (${tangential}) cos(${theta}°) ≈ ${fmt(dy, 7)} km/s.`],
        'Local outward/prograde directions rotate with the spacecraft’s position; the map axes stay fixed.', { kind: 'vectors', radial, tangential, positionAngle: theta, magnitude: magnitude(dx, dy), angle: heading(dx, dy) });
    }
  ],
  calculus: [
    rng => {
      const x = rng.sign() * rng.int(3, 12) * 1000, y = rng.sign() * rng.int(6, 12) * 1000;
      const r = magnitude(x, y), ax = -MU * x / r ** 3, ay = -MU * y / r ** 3;
      return q('Evaluate the gravity vector', 'Use Earth-only gravity to compute acceleration at the displayed position. Both components must point toward the origin.',
        [g('x', x, 'km'), g('y', y, 'km'), muGiven()], [answer('ax', 'Gravity ax', 'km/s²', ax), answer('ay', 'Gravity ay', 'km/s²', ay)],
        ['First compute r = √(x² + y²), then a = −μ(x, y)/r³.', 'The vector denominator is r³; using r² here would leave an extra factor of distance.'],
        [`r = √((${x})² + (${y})²) = ${fmt(r, 5)} km.`, `ax = −${MU} × (${x}) / r³ ≈ ${fmt(ax, 10)} km/s².`, `ay = −${MU} × (${y}) / r³ ≈ ${fmt(ay, 10)} km/s².`, `Magnitude check: |a| = μ/r² ≈ ${fmt(MU / r ** 2, 10)} km/s².`],
        'An inward acceleration has signs opposite the position components.', { kind: 'gravity', x, y, radius: r, ax, ay, step: 10 });
    },
    rng => {
      const r = rng.int(68, 100) * 100, vx = rng.sign() * rng.int(1, 10) / 10, vy = rng.int(65, 80) / 10, dt = rng.int(1, 6) * 10;
      const xn = r + vx * dt, vxn = vx - MU / r ** 2 * dt;
      return q('Take one explicit Euler step', 'Start at (r, 0) with the given velocity. With no thrust, find the next x position and x velocity using explicit Euler: both updates use the old state.',
        [g('Initial x = radius r', r, 'km'), g('Initial y', 0, 'km'), g('Initial vx', vx, 'km/s'), g('Initial vy', vy, 'km/s'), g('Step Δt', dt, 's'), muGiven()],
        [answer('x', 'Next x position', 'km', xn, 0.1), answer('vx', 'Next x velocity', 'km/s', vxn)],
        ['Position uses old vx: xnext = x + vx Δt. Gravity gives ax = −μ/r².', 'Do not substitute the updated velocity into the position formula; that would be a different scheme.'],
        [`ax = −${MU}/${r}² ≈ ${fmt(-MU / r ** 2, 10)} km/s².`, `xnext = ${r} + (${vx}) × ${dt} = ${fmt(xn)} km.`, `vx,next = ${vx} + ax × ${dt} ≈ ${fmt(vxn, 8)} km/s.`, `For context, ynext = 0 + ${vy} × ${dt} = ${fmt(vy * dt)} km; this one step is an approximation.`],
        'Specifying the numerical update rule is part of specifying the answer.', { kind: 'gravity', radius: r, step: dt, vx, vy, nextX: xn, nextVx: vxn });
    },
    rng => {
      const a0 = rng.int(5, 25) / 10, k = rng.int(1, 8) / 100, time = rng.int(2, 8) * 10, v0 = rng.int(10, 60) / 10;
      const dv = (a0 * time + 0.5 * k * time ** 2) / 1000;
      return q('Integrate a changing acceleration', 'In a straight-line teaching model, acceleration along the motion is a(t) = a0 + kt. Gravity is excluded. Find the accumulated Δv and final speed.',
        [g('a0', a0, 'm/s²'), g('k', k, 'm/s³'), g('Burn interval T', time, 's'), g('Initial speed', v0, 'km/s')],
        [answer('dv', 'Accumulated Δv', 'km/s', dv), answer('speed', 'Final speed', 'km/s', v0 + dv)],
        ['Integrate a0 + kt from 0 to T; the integral of t is t²/2.', 'The integral initially produces m/s. Divide by 1000 before adding to the given km/s speed.'],
        [`Δv = ∫₀^${time} (${a0} + ${k}t) dt = ${a0} × ${time} + (${k}/2) × ${time}².`, `That is ${fmt(dv * 1000)} m/s = ${fmt(dv)} km/s.`, `Final speed = ${v0} + ${fmt(dv)} = ${fmt(v0 + dv)} km/s.`],
        'Velocity change is the area under an acceleration-time curve, not just the final acceleration times the duration.', { kind: 'gravity', a0, k, duration: time, initialSpeed: v0, deltaV: dv });
    },
    rng => {
      const h = rng.int(1, 6) * 10, v0 = rng.sign() * rng.int(5, 30) / 10, v1 = rng.sign() * rng.int(5, 30) / 10, v2 = rng.sign() * rng.int(5, 30) / 10;
      const displacement = h * (v0 + 2 * v1 + v2) / 2, avg = displacement / (2 * h);
      return q('Integrate signed velocity samples', 'Use the composite trapezoidal rule for three equally spaced x-velocity samples. Find x displacement and average x velocity over the full interval.',
        [g('Sample spacing h', h, 's'), g('v(0)', v0, 'km/s'), g('v(h)', v1, 'km/s'), g('v(2h)', v2, 'km/s')],
        [answer('displacement', 'x displacement', 'km', displacement), answer('average', 'Average x velocity', 'km/s', avg)],
        ['Add the area of two trapezoids, retaining negative signs.', `Δx ≈ (${h}/2)[${v0} + 2(${v1}) + (${v2})]; total time is ${2 * h} s.`],
        [`First interval: (${h}/2)(${v0} + ${v1}) = ${fmt(h * (v0 + v1) / 2)} km.`, `Second interval: (${h}/2)(${v1} + ${v2}) = ${fmt(h * (v1 + v2) / 2)} km.`, `Sum Δx = ${fmt(displacement)} km; average = Δx/${2 * h} = ${fmt(avg)} km/s.`],
        'Signed displacement can cancel even while the spacecraft travels a substantial distance.', { kind: 'gravity', samples: [v0, v1, v2], step: h, displacement });
    }
  ],
  orbits: [
    rng => {
      const altitude = rng.int(20, 300) * 10, r = RADIUS + altitude, speed = circular(r);
      return q('Convert altitude before calculating speed', 'A spacecraft is to follow a circular Earth orbit at this altitude. Find Earth-centered radius and circular speed.',
        [g('Altitude h', altitude, 'km'), g('Earth radius RE', RADIUS, 'km'), muGiven()],
        [answer('radius', 'Earth-centered radius', 'km', r, 0.05), answer('speed', 'Circular speed', 'km/s', speed)],
        ['Gravity uses distance from Earth’s center, not height above the surface.', 'Add RE + h, then calculate √(μ/r).'],
        [`r = ${RADIUS} + ${altitude} = ${fmt(r, 3)} km.`, `vc = √(${MU}/${fmt(r, 3)}) = ${fmt(speed, 7)} km/s.`, `Check vc²/r = μ/r² ≈ ${fmt(MU / r ** 2, 10)} km/s².`],
        'The radius/altitude distinction enters every Earth-centered orbital calculation.', { kind: 'orbit', radius: r, speedFactor: 1, altitude });
    },
    rng => {
      const r = rng.int(70, 250) * 100, time = period(r), rate = 360 / time;
      return q('Clock a circular orbit', 'Find the orbital period in seconds and counterclockwise angular rate in degrees per second.',
        [g('Circular radius', r, 'km'), muGiven()], [answer('period', 'Orbital period', 's', time), answer('rate', 'Angular rate', '°/s', rate)],
        ['Period is circumference divided by circular speed, or 2π√(r³/μ).', 'A full orbit is 360°. Divide 360 by your period to get degrees per second.'],
        [`vc = √(${MU}/${r}) = ${fmt(circular(r))} km/s.`, `T = 2π√(${r}³/${MU}) = ${fmt(time, 4)} s.`, `n = 360/${fmt(time, 4)} ≈ ${fmt(rate, 8)} deg/s.`],
        'Higher circular orbits have longer periods and lower angular rates.', { kind: 'orbit', radius: r, speedFactor: 1, period: time });
    },
    rng => {
      const rp = rng.int(70, 100) * 100, ra = rng.int(140, 240) * 100, r = rng.pick([rp, (rp + ra) / 2, ra]);
      const a = (rp + ra) / 2, v = Math.sqrt(MU * (2 / r - 1 / a)), energy = -MU / (2 * a);
      return q('Read speed from an ellipse', 'An Earth-centered ellipse has the listed nearest and farthest radii. At the listed current radius, find speed and specific mechanical energy.',
        [g('Nearest radius rp', rp, 'km'), g('Farthest radius ra', ra, 'km'), g('Current radius r', r, 'km'), muGiven()],
        [answer('speed', 'Speed at current radius', 'km/s', v), answer('energy', 'Specific energy', 'km²/s²', energy)],
        ['Compute semimajor axis a = (rp + ra)/2.', 'Use v² = μ(2/r − 1/a) and ε = −μ/(2a); energy is negative for this bound ellipse.'],
        [`a = (${rp} + ${ra})/2 = ${a} km.`, `v = √[${MU}(2/${r} − 1/${a})] = ${fmt(v, 7)} km/s.`, `ε = −${MU}/(2 × ${a}) = ${fmt(energy, 7)} km²/s².`],
        'Energy is constant during coast even though speed changes with radius.', { kind: 'orbit', radius: r, rp, ra, speedFactor: v / circular(r) });
    },
    rng => {
      const r = rng.int(70, 200) * 100, speed = Number((circular(r) * rng.pick([0.85, 1.1, 1.3, 1.48, 1.6])).toFixed(3));
      const energy = speed ** 2 / 2 - MU / r, state = energy < 0 ? 'bound' : 'unbound';
      return q('Test the escape energy', 'Ignore all bodies except spherical Earth. Compute specific energy and classify whether the mathematical two-body trajectory is bound or unbound. This does not test collision with Earth.',
        [g('Radius', r, 'km'), g('Speed', speed, 'km/s'), muGiven()],
        [answer('energy', 'Specific energy', 'km²/s²', energy), choice('state', 'Energy classification', state, [['bound', 'Bound: energy below zero'], ['unbound', 'Unbound: zero or positive energy']])],
        ['Specific energy is v²/2 − μ/r.', 'Negative energy is bound; compare the given speed with √(2μ/r) as an independent check.'],
        [`Kinetic term = ${speed}²/2 = ${fmt(speed ** 2 / 2)} km²/s².`, `ε = ${speed}²/2 − ${MU}/${r} = ${fmt(energy, 7)} km²/s², so the trajectory is ${state}.`, `Escape speed is √(2 × ${MU}/${r}) = ${fmt(Math.sqrt(2 * MU / r))} km/s.`],
        'A speed threshold distinguishes bound from escaping two-body motion, but it does not guarantee a safe periapsis.', { kind: 'orbit', radius: r, speedFactor: speed / circular(r), energy });
    }
  ],
  propulsion: [
    rng => {
      const force = rng.int(6, 24) * 10000, throttle = rng.int(2, 10) / 10, mass = rng.int(8, 20) * 1000, isp = rng.int(28, 45) * 10;
      const acc = force * throttle / mass, flow = force * throttle / exhaust(isp);
      return q('Thrust is not acceleration', 'At the initial mass, find the instantaneous thrust acceleration and positive propellant consumption rate. Exclude gravitational acceleration.',
        [g('Maximum thrust F', force, 'N'), g('Throttle q', throttle, 'fraction'), g('Current mass m', mass, 'kg'), g('Specific impulse Isp', isp, 's'), g0Given()],
        [answer('acceleration', 'Thrust acceleration', 'm/s²', acc), answer('flow', 'Propellant flow', 'kg/s', flow)],
        ['Delivered thrust is qF. Divide by mass for acceleration.', 'Effective exhaust speed is g0 Isp; mass consumption is qF divided by that speed.'],
        [`Delivered thrust = ${throttle} × ${force} = ${fmt(force * throttle)} N.`, `athrust = ${fmt(force * throttle)}/${mass} = ${fmt(acc)} m/s² (${fmt(acc / 1000, 8)} km/s²).`, `ve = ${G0} × ${isp} = ${fmt(exhaust(isp), 4)} m/s; flow = ${fmt(force * throttle)}/ve = ${fmt(flow, 7)} kg/s.`],
        'The same thrust produces more acceleration as mass decreases; Isp sets propellant efficiency.', { kind: 'engine', throttle, mass, force, isp, duration: 0 });
    },
    rng => {
      const m0 = rng.int(12, 20) * 1000, isp = rng.int(30, 45) * 10, force = rng.int(8, 18) * 10000, throttle = rng.int(3, 8) / 10, time = rng.int(10, 45);
      const flow = force * throttle / exhaust(isp), fuel = flow * time, mf = m0 - fuel, dv = exhaust(isp) / 1000 * Math.log(m0 / mf);
      return q('Integrate a timed burn with falling mass', 'For a constant-throttle ideal burn, find consumed propellant and ideal Δv. Use changing mass, not a fixed initial acceleration. Dry mass is 6000 kg.',
        [g('Initial mass m0', m0, 'kg'), g('Dry mass', 6000, 'kg'), g('Maximum thrust F', force, 'N'), g('Throttle q', throttle, 'fraction'), g('Isp', isp, 's'), g('Burn duration', time, 's'), g0Given()],
        [answer('fuel', 'Propellant used', 'kg', fuel), answer('dv', 'Ideal Δv magnitude', 'km/s', dv)],
        ['Fuel = duration × qF/(g0 Isp); subtract it from initial mass.', 'Then use (g0 Isp/1000) ln(m0/mf). The logarithm accounts for changing mass.'],
        [`ve = ${G0} × ${isp} = ${fmt(exhaust(isp), 4)} m/s; flow = ${fmt(flow, 7)} kg/s.`, `Fuel = ${fmt(flow, 7)} × ${time} ≈ ${fmt(fuel, 5)} kg; mf = ${fmt(mf, 5)} kg.`, `Δv = (${fmt(exhaust(isp), 4)}/1000) ln(${m0}/${fmt(mf, 5)}) ≈ ${fmt(dv, 8)} km/s.`, `Final mass ${fmt(mf, 2)} kg exceeds the 6000 kg dry mass.`],
        'A constant-thrust burn does not have constant acceleration when propellant is leaving.', { kind: 'engine', throttle, duration: time, mass: m0, force, isp, fuel });
    },
    rng => {
      const m0 = rng.int(9, 18) * 1000, isp = rng.int(30, 45) * 10, force = rng.int(8, 20) * 10000, throttle = rng.int(3, 10) / 10, dv = rng.int(5, 65) / 100;
      const b = burn(m0, isp, force, throttle, dv);
      return q('Invert the rocket equation', 'A guidance solution asks for this ideal velocity-change magnitude. Find the propellant required and constant-throttle engine duration. Assume sufficient fuel is available.',
        [g('Required Δv', dv, 'km/s'), g('Initial mass m0', m0, 'kg'), g('Isp', isp, 's'), g('Maximum thrust F', force, 'N'), g('Throttle q', throttle, 'fraction'), g0Given()],
        [answer('fuel', 'Required propellant', 'kg', b.fuel), answer('duration', 'Ideal burn duration', 's', b.duration)],
        ['Solve for mf = m0 exp[−1000Δv/(g0 Isp)].', 'Fuel is m0 − mf; divide fuel by qF/(g0 Isp) for duration.'],
        [`ve = ${G0} × ${isp} = ${fmt(exhaust(isp), 4)} m/s.`, `mf = ${m0} exp(−1000 × ${dv}/${fmt(exhaust(isp), 4)}) = ${fmt(b.mf, 5)} kg.`, `Fuel = ${m0} − mf = ${fmt(b.fuel, 5)} kg.`, `Flow = ${throttle} × ${force}/${fmt(exhaust(isp), 4)} = ${fmt(b.flow, 6)} kg/s; duration = ${fmt(b.duration, 6)} s.`],
        'Throttle sets the duration of this ideal impulse-equivalent burn; Isp and mass ratio set its ideal Δv.', { kind: 'engine', throttle, duration: b.duration, mass: m0, force, isp, deltaV: dv });
    },
    rng => {
      const m0 = rng.int(10, 18) * 1000, fuel = rng.int(3, 20) * 100, mf = m0 - fuel, isp = rng.int(28, 45) * 10, force = rng.int(8, 18) * 10000, throttle = rng.int(3, 10) / 10;
      const dv = exhaust(isp) / 1000 * Math.log(m0 / mf), duration = fuel * exhaust(isp) / (force * throttle);
      return q('Read a mass budget as an engine plan', 'A maneuver may consume the mass difference shown. Calculate its ideal Δv and constant-throttle duration; assume the stated final mass is above dry mass.',
        [g('Initial mass', m0, 'kg'), g('Final mass', mf, 'kg'), g('Isp', isp, 's'), g('Maximum thrust', force, 'N'), g('Throttle', throttle, 'fraction'), g0Given()],
        [answer('dv', 'Ideal Δv', 'km/s', dv), answer('duration', 'Duration', 's', duration)],
        ['The ratio inside ln is initial mass divided by final mass, not propellant divided by final mass.', 'The consumed mass is m0 − mf; use the mass flow to turn it into seconds.'],
        [`Consumed propellant = ${m0} − ${mf} = ${fuel} kg.`, `Δv = (${G0} × ${isp}/1000) ln(${m0}/${mf}) = ${fmt(dv, 8)} km/s.`, `Duration = ${fuel} × (${G0} × ${isp})/(${force} × ${throttle}) = ${fmt(duration, 6)} s.`],
        'The logarithm uses the whole spacecraft’s mass ratio, including remaining structure and payload.', { kind: 'engine', throttle, duration, mass: m0, finalMass: mf, force, isp });
    }
  ],
  transfer: [
    rng => {
      const r1 = rng.int(68, 95) * 100, r2 = rng.int(12, 24) * 1000, t = transfer(r1, r2);
      return q('Depart for a higher circle', 'Calculate the first signed tangential impulse and coast time for an outward Hohmann transfer. Positive Δv is along the counterclockwise motion; assume instantaneous burns.',
        [g('Departure radius r1', r1, 'km'), g('Arrival radius r2', r2, 'km'), muGiven()],
        [answer('dv1', 'Signed departure Δv', 'km/s', t.dv1), answer('coast', 'Coast time', 's', t.time)],
        ['The transfer semimajor axis is (r1 + r2)/2.', 'Departure Δv is the transfer speed at r1 minus circular speed there; coast is half the transfer period.'],
        [`a = (${r1} + ${r2})/2 = ${fmt(t.a)} km.`, `vc1 = √(μ/${r1}) = ${fmt(t.v1)}; vt1 = √[μ(2/${r1} − 1/${fmt(t.a)})] = ${fmt(t.u1)} km/s.`, `Δv1 = vt1 − vc1 = ${fmt(t.dv1, 7)} km/s, prograde.`, `t = π√(${fmt(t.a)}³/${MU}) = ${fmt(t.time, 4)} s.`],
        'Raising the far side of a circular orbit starts by increasing speed along the orbit.', { kind: 'transfer', r1, r2, deltaV1: t.dv1, coast: t.time });
    },
    rng => {
      const r1 = rng.int(14, 26) * 1000, r2 = rng.int(68, 95) * 100, t = transfer(r1, r2);
      return q('Depart inward without losing the sign', 'Transfer from the outer circle to the inner circle. Find signed first Δv along the counterclockwise tangent and the half-ellipse coast time.',
        [g('Departure radius r1', r1, 'km'), g('Arrival radius r2', r2, 'km'), muGiven()],
        [answer('dv1', 'Signed departure Δv', 'km/s', t.dv1), answer('coast', 'Coast time', 's', t.time)],
        ['A lower target circle requires reducing the departure speed.', 'Use vt1 − vc1 exactly as written. The formula itself supplies the negative sign.'],
        [`a = (${r1} + ${r2})/2 = ${fmt(t.a)} km.`, `vt1 = ${fmt(t.u1)} and vc1 = ${fmt(t.v1)} km/s at departure.`, `Δv1 = ${fmt(t.u1)} − ${fmt(t.v1)} ≈ ${fmt(t.dv1, 7)} km/s, retrograde.`, `Coast = π√(${fmt(t.a)}³/${MU}) = ${fmt(t.time, 4)} s.`],
        'An inward transfer begins with a retrograde impulse, not an inward-pointing impulse.', { kind: 'transfer', r1, r2, deltaV1: t.dv1, coast: t.time });
    },
    rng => {
      const inner = rng.int(68, 95) * 100, outer = rng.int(12, 24) * 1000, inward = rng.sign() < 0;
      const r1 = inward ? outer : inner, r2 = inward ? inner : outer, t = transfer(r1, r2);
      return q('Finish the transfer at arrival', 'The craft has reached the far end of its half-ellipse transfer. Find its transfer speed there and the signed tangential impulse needed to match the destination circular orbit.',
        [g('Original departure radius r1', r1, 'km'), g('Arrival radius r2', r2, 'km'), muGiven()],
        [answer('arrivalSpeed', 'Transfer speed at arrival', 'km/s', t.u2), answer('dv2', 'Signed arrival Δv', 'km/s', t.dv2)],
        ['Use vis-viva at r2 to find the transfer speed before the second burn.', 'The required second burn is circular speed at r2 minus transfer speed at r2.'],
        [`a = (${r1} + ${r2})/2 = ${fmt(t.a)} km.`, `vt2 = √[${MU}(2/${r2} − 1/${fmt(t.a)})] = ${fmt(t.u2, 7)} km/s.`, `vc2 = √(${MU}/${r2}) = ${fmt(t.v2, 7)} km/s.`, `Δv2 = vc2 − vt2 = ${fmt(t.dv2, 7)} km/s (${t.dv2 > 0 ? 'prograde' : 'retrograde'}).`],
        'The arrival burn matches velocity; reaching the destination radius alone does not circularize the orbit.', { kind: 'transfer', r1, r2, arrivalSpeed: t.u2, deltaV2: t.dv2 });
    },
    rng => {
      const low = rng.int(2, 10) * 100, high = rng.int(35, 130) * 100, inward = rng.sign() < 0;
      const h1 = inward ? high : low, h2 = inward ? low : high, r1 = RADIUS + h1, r2 = RADIUS + h2, t = transfer(r1, r2);
      const total = Math.abs(t.dv1) + Math.abs(t.dv2);
      return q('Budget both burns from altitudes', 'The orbit heights are given above Earth’s surface. Find the total ideal two-burn Δv budget and coast time; a fuel budget adds magnitudes, not signed cancellations.',
        [g('Departure altitude h1', h1, 'km'), g('Arrival altitude h2', h2, 'km'), g('Earth radius RE', RADIUS, 'km'), muGiven()],
        [answer('budget', 'Total Δv magnitude budget', 'km/s', total), answer('coast', 'Coast time', 's', t.time)],
        ['Convert each altitude to Earth-centered radius before using orbital formulas.', 'Calculate both signed impulses, then add their absolute values.'],
        [`r1 = ${RADIUS} + ${h1} = ${fmt(r1, 3)}; r2 = ${RADIUS} + ${h2} = ${fmt(r2, 3)} km.`, `a = (r1 + r2)/2 = ${fmt(t.a, 3)} km.`, `Δv1 = ${fmt(t.dv1, 7)} and Δv2 = ${fmt(t.dv2, 7)} km/s.`, `Budget = |Δv1| + |Δv2| = ${fmt(total, 7)} km/s; coast = ${fmt(t.time, 4)} s.`],
        'Neither subtracting the two burns nor using altitude as radius produces the correct mission budget.', { kind: 'transfer', r1, r2, deltaV1: t.dv1, deltaV2: t.dv2, coast: t.time });
    }
  ],
  intercept: [
    rng => {
      const r1 = rng.int(68, 95) * 100, r2 = rng.int(11, 28) * 1000, t = transfer(r1, r2), phase = phaseFor(r2, t.time);
      return q('Lead a moving circular target', 'Both orbits are counterclockwise. Find the target’s required initial lead relative to the departure craft for a half-ellipse intercept, and the transfer coast time.',
        [g('Departure circular radius r1', r1, 'km'), g('Target circular radius r2', r2, 'km'), muGiven()],
        [angleAnswer('phase', 'Required initial target lead', phase), answer('coast', 'Coast time', 's', t.time)],
        ['The transfer reaches 180° beyond the departure position after its coast.', 'Subtract the target’s angular advance n2 × coast from 180°, then wrap to 0–360°.'],
        [`a = (${r1} + ${r2})/2 = ${fmt(t.a)} km; coast = ${fmt(t.time, 4)} s.`, `n2 = (180/π)√(${MU}/${r2}³) = ${fmt(360 / period(r2), 8)} deg/s.`, `Target advance = n2 × coast = ${fmt(360 / period(r2) * t.time, 5)}°.`, `Required initial lead = wrap360(180° − advance) = ${fmt(phase, 5)}°.`],
        'Initial phase is chosen so both bodies occupy the arrival location at the same time.', { kind: 'intercept', r1, r2, phase, coast: t.time });
    },
    rng => {
      const T = rng.int(60, 180) * 60, theta = rng.int(0, 359), dt = rng.int(8, 90) * 60;
      const advance = 360 * dt / T, future = wrap(theta + advance);
      return q('Propagate a target bearing', 'A target follows a counterclockwise circular orbit with the stated period. Find its future map bearing and its unwrapped angular advance during the coast.',
        [g('Target period T', T, 's'), g('Current target bearing', theta, '°'), g('Elapsed coast time', dt, 's')],
        [angleAnswer('bearing', 'Future target bearing', future), answer('advance', 'Unwrapped angular advance', '°', advance)],
        ['The target moves 360/T degrees each second.', 'Add the advance to the current bearing, then wrap only the final bearing, not the requested unwrapped advance.'],
        [`n = 360/${T} = ${fmt(360 / T, 8)} deg/s.`, `Advance = n × ${dt} = ${fmt(advance, 6)}°.`, `Future bearing = wrap360(${theta} + ${fmt(advance, 6)}) = ${fmt(future, 6)}°.`],
        'A target may cross 0° or complete a full revolution while you coast; angular arithmetic must handle wrapping.', { kind: 'intercept', phase: theta, targetPeriod: T, coast: dt, futureBearing: future });
    },
    rng => {
      const target = [rng.sign() * rng.int(5, 45) / 10, rng.sign() * rng.int(5, 45) / 10];
      const delta = [rng.sign() * rng.int(1, 18) / 10, rng.sign() * rng.int(1, 18) / 10];
      const spacecraft = target.map((v, i) => Number((v + delta[i]).toFixed(1)));
      const dx = spacecraft[0] - target[0], dy = spacecraft[1] - target[1];
      return q('An intercept is not yet a rendezvous', 'The spacecraft and target reach the same position. Calculate spacecraft-minus-target relative velocity components in the fixed map frame.',
        [g('Spacecraft vx', spacecraft[0], 'km/s'), g('Spacecraft vy', spacecraft[1], 'km/s'), g('Target vx', target[0], 'km/s'), g('Target vy', target[1], 'km/s')],
        [answer('relativeX', 'Relative vx', 'km/s', dx), answer('relativeY', 'Relative vy', 'km/s', dy)],
        ['Subtract the target velocity from the spacecraft velocity.', 'A cancellation burn for rendezvous would need the negative of this relative vector.'],
        [`vrel,x = ${spacecraft[0]} − (${target[0]}) = ${fmt(dx)} km/s.`, `vrel,y = ${spacecraft[1]} − (${target[1]}) = ${fmt(dy)} km/s.`, `Relative speed = √((${fmt(dx)})² + (${fmt(dy)})²) = ${fmt(magnitude(dx, dy))} km/s, despite zero position error.`],
        'At the same location, a nonzero relative velocity still means a flyby.', { kind: 'intercept', spacecraftVelocity: spacecraft, targetVelocity: target, relativeX: dx, relativeY: dy });
    },
    rng => {
      const r1 = rng.int(68, 95) * 100, r2 = rng.int(12, 24) * 1000, now = rng.int(0, 359), t = transfer(r1, r2), required = phaseFor(r2, t.time);
      const relativeRate = 360 / period(r1) - 360 / period(r2), gap = wrap(now - required), wait = gap / relativeRate, synodic = 360 / relativeRate;
      return q('Wait for the next departure window', 'The departure craft remains in the inner circular orbit and the target in the outer circular orbit, both counterclockwise. Find the next nonnegative wait until Hohmann departure phase, and the time between repeated windows.',
        [g('Inner departure radius r1', r1, 'km'), g('Outer target radius r2', r2, 'km'), g('Current target lead', now, '°'), muGiven()],
        [answer('wait', 'Wait to next window', 's', wait), answer('windowPeriod', 'Time between windows', 's', synodic)],
        ['Derive the required lead from the Hohmann coast, then compare it with the current lead.', 'The lead decreases at n1 − n2. Wait = wrap360(current lead − required lead)/(n1 − n2).'],
        [`Transfer coast = ${fmt(t.time, 4)} s; required lead = ${fmt(required, 5)}°.`, `n1 − n2 = ${fmt(relativeRate, 8)} deg/s, positive for an inner departure orbit.`, `Lead to close = wrap360(${now} − ${fmt(required, 5)}) = ${fmt(gap, 5)}°.`, `Wait = gap/(n1 − n2) = ${fmt(wait, 4)} s; repeated-window period = 360/(n1 − n2) = ${fmt(synodic, 4)} s.`],
        'Both vehicles move during a wait; relative angular rate determines the next opportunity.', { kind: 'intercept', r1, r2, phase: now, requiredPhase: required, wait });
    }
  ],
  correction: [
    rng => {
      const ex = rng.sign() * rng.int(2, 30) * 10, ey = rng.sign() * rng.int(2, 30) * 10, time = rng.int(2, 25) * 100;
      const dx = ex / time, dy = ey / time;
      return q('Correct a signed arrival miss', 'Error means desired arrival minus predicted arrival. In a short straight-coast approximation, find the immediate Δv components that remove the miss after the remaining time.',
        [g('Desired minus predicted x', ex, 'km'), g('Desired minus predicted y', ey, 'km'), g('Time remaining τ', time, 's')],
        [answer('dvx', 'Correction Δvx', 'km/s', dx), answer('dvy', 'Correction Δvy', 'km/s', dy)],
        ['Use Δv ≈ e/τ independently on each axis.', 'The error sign already tells the needed correction direction; do not negate it again.'],
        [`Δvx = ${ex}/${time} = ${fmt(dx, 8)} km/s.`, `Δvy = ${ey}/${time} = ${fmt(dy, 8)} km/s.`, `Predicted drift change τΔv ≈ (${ex}, ${ey}) km. Verify with a propagated trajectory when gravity changes matter.`],
        'This drift estimate is a first correction guess, not an exact long-arc orbital solution.', { kind: 'correction', errorX: ex, errorY: ey, remaining: time, dvx: dx, dvy: dy });
    },
    rng => {
      const px = rng.sign() * rng.int(5, 20) * 100, py = rng.sign() * rng.int(5, 20) * 100;
      const ex = rng.sign() * rng.int(2, 20) * 10, ey = rng.sign() * rng.int(2, 20) * 10, tx = px + ex, ty = py + ey, time = rng.int(3, 20) * 100;
      const dx = ex / time, dy = ey / time, speed = magnitude(dx, dy), angle = heading(dx, dy);
      return q('Find a correction’s magnitude and bearing', 'The desired and predicted arrival coordinates share the same fixed frame. Under the straight-coast approximation, find correction magnitude and map bearing.',
        [g('Predicted arrival x', px, 'km'), g('Predicted arrival y', py, 'km'), g('Desired arrival x', tx, 'km'), g('Desired arrival y', ty, 'km'), g('Time remaining', time, 's')],
        [answer('magnitude', 'Correction magnitude', 'km/s', speed), angleAnswer('bearing', 'Correction map bearing', angle)],
        ['First form desired minus predicted on each axis.', 'Divide the error vector by remaining seconds, then use magnitude and atan2.'],
        [`e = (${tx} − (${px}), ${ty} − (${py})) = (${ex}, ${ey}) km.`, `Δv ≈ e/${time} = (${fmt(dx, 8)}, ${fmt(dy, 8)}) km/s.`, `Magnitude ≈ ${fmt(speed, 8)} km/s; wrap360[atan2(${fmt(dy, 8)}, ${fmt(dx, 8)})] = ${fmt(angle, 6)}°.`],
        'Subtract positions before finding a bearing; pointing from the origin to the target is a different vector.', { kind: 'correction', errorX: ex, errorY: ey, remaining: time, predicted: [px, py], desired: [tx, ty] });
    },
    rng => {
      const jx = rng.sign() * rng.int(4, 15) * 100, jy = rng.sign() * rng.int(4, 15) * 100;
      const ex = rng.sign() * rng.int(2, 25) * 10, ey = rng.sign() * rng.int(2, 25) * 10, dx = ex / jx, dy = ey / jy;
      return q('Use measured targeting sensitivity', 'Trial propagations give a diagonal arrival-sensitivity matrix: ex = Jxx Δvx and ey = Jyy Δvy, with cross terms zero. Solve for the correction; sensitivities may be negative.',
        [g('Desired arrival change ex', ex, 'km'), g('Desired arrival change ey', ey, 'km'), g('Jxx', jx, 's'), g('Jyy', jy, 's'), g('Jxy and Jyx', 0, 's')],
        [answer('dvx', 'Correction Δvx', 'km/s', dx), answer('dvy', 'Correction Δvy', 'km/s', dy)],
        ['Divide each requested position change by its measured sensitivity.', 'A negative sensitivity reverses the required sign: orbital geometry can turn a positive initial velocity change into a negative arrival displacement.'],
        [`Δvx = ex/Jxx = ${ex}/(${jx}) = ${fmt(dx, 8)} km/s.`, `Δvy = ey/Jyy = ${ey}/(${jy}) = ${fmt(dy, 8)} km/s.`, `Check JΔv = (${jx} × ${fmt(dx, 8)}, ${jy} × ${fmt(dy, 8)}) ≈ (${ex}, ${ey}) km; propagate again before trusting the correction.`],
        'A propagated sensitivity can differ in sign and size from simple time remaining.', { kind: 'correction', errorX: ex, errorY: ey, jacobian: [[jx, 0], [0, jy]], dvx: dx, dvy: dy });
    },
    rng => {
      const a = rng.int(5, 15) * 100, d = rng.int(7, 16) * 100, b = rng.sign() * rng.int(1, 4) * 50, c = rng.sign() * rng.int(1, 4) * 50;
      const ex = rng.sign() * rng.int(2, 25) * 10, ey = rng.sign() * rng.int(2, 25) * 10, det = a * d - b * c;
      const dx = (ex * d - b * ey) / det, dy = (a * ey - ex * c) / det;
      return q('Solve a coupled targeting correction', 'The supplied linear model predicts arrival displacement e = JΔv. Solve both coupled equations. All J entries have units of seconds; e is desired minus predicted position.',
        [g('ex', ex, 'km'), g('ey', ey, 'km'), g('Jxx', a, 's'), g('Jxy', b, 's'), g('Jyx', c, 's'), g('Jyy', d, 's')],
        [answer('dvx', 'Correction Δvx', 'km/s', dx), answer('dvy', 'Correction Δvy', 'km/s', dy)],
        ['The equations are Jxx Δvx + Jxy Δvy = ex and Jyx Δvx + Jyy Δvy = ey.', 'Eliminate one variable, or use det = JxxJyy − JxyJyx and the two-by-two inverse.'],
        [`det J = ${a} × ${d} − (${b}) × (${c}) = ${det} s².`, `Δvx = [${ex} × ${d} − (${b}) × (${ey})]/${det} = ${fmt(dx, 8)} km/s.`, `Δvy = [${a} × (${ey}) − (${ex}) × (${c})]/${det} = ${fmt(dy, 8)} km/s.`, `Substitution returns (${fmt(a * dx + b * dy)}, ${fmt(c * dx + d * dy)}) km. This verifies the linear solve, not the nonlinear trajectory.`],
        'Off-diagonal sensitivity couples the axes; correcting each axis independently would miss this solution.', { kind: 'correction', errorX: ex, errorY: ey, jacobian: [[a, b], [c, d]], dvx: dx, dvy: dy });
    }
  ],
  mission: [
    rng => {
      const r1 = rng.int(70, 90) * 100, r2 = rng.int(11, 17) * 1000, theta = rng.int(0, 359), m0 = rng.int(10, 15) * 1000, isp = 450, force = 180000, throttle = rng.int(4, 9) / 10;
      const t = transfer(r1, r2), b = burn(m0, isp, force, throttle, t.dv1), angle = bearingForBurn(theta, t.dv1);
      return q('Write a departure engine command', 'Plan the first ideal impulse from the inner circular orbit to the outer circle. Motion is counterclockwise. Give its fixed-map bearing, equivalent constant-throttle duration, and propellant use. Duration is an engine budget, not a finite-burn trajectory integration.',
        [g('Departure radius r1', r1, 'km'), g('Arrival radius r2', r2, 'km'), g('Departure position bearing', theta, '°'), g('Initial mass', m0, 'kg'), g('Isp', isp, 's'), g('Maximum thrust', force, 'N'), g('Throttle', throttle, 'fraction'), muGiven(), g0Given()],
        [angleAnswer('bearing', 'Departure burn bearing', angle), answer('duration', 'Equivalent engine duration', 's', b.duration), answer('fuel', 'Departure propellant', 'kg', b.fuel)],
        ['Compute signed first Hohmann Δv, then rotate the local tangent into the fixed frame.', 'A prograde command has bearing θ + 90°. Use the rocket equation to convert its magnitude into fuel and time.'],
        [`a = (${r1} + ${r2})/2 = ${fmt(t.a)} km; Δv1 = ${fmt(t.u1)} − ${fmt(t.v1)} ≈ ${fmt(t.dv1, 7)} km/s.`, `Δv1 is positive, so bearing = wrap360(${theta} + 90) = ${fmt(angle)}°.`, `mf = ${m0} exp[−1000 × ${fmt(t.dv1, 7)}/(${G0} × ${isp})] ≈ ${fmt(b.mf, 4)} kg.`, `Propellant = ${m0} − mf = ${fmt(b.fuel, 4)} kg; flow = ${fmt(b.flow, 6)} kg/s.`, `Equivalent duration = fuel/flow = ${fmt(b.duration, 5)} s. Reserve additional fuel for the arrival impulse.`],
        'A usable engine command combines a direction, a velocity-change magnitude, a fuel budget, and a duration estimate.', { kind: 'mission', r1, r2, positionAngle: theta, burnBearing: angle, deltaV: t.dv1, duration: b.duration, fuel: b.fuel, mass: m0, force, isp, throttle });
    },
    rng => {
      const inner = rng.int(70, 90) * 100, outer = rng.int(12, 20) * 1000, inward = rng.sign() < 0;
      const r1 = inward ? outer : inner, r2 = inward ? inner : outer, theta = rng.int(0, 359), mass = rng.int(8, 14) * 1000, isp = 450, force = 180000, throttle = rng.int(4, 9) / 10;
      const t = transfer(r1, r2), b = burn(mass, isp, force, throttle, t.dv2), angle = bearingForBurn(theta, t.dv2);
      return q('Match the arrival circle’s velocity', 'At the transfer endpoint, the spacecraft and a counterclockwise circular target share a position. Find the required arrival Δv magnitude, fixed-map bearing, and equivalent engine duration. The listed mass is the mass now, after departure fuel use.',
        [g('Original departure radius r1', r1, 'km'), g('Arrival radius r2', r2, 'km'), g('Arrival position bearing', theta, '°'), g('Current mass', mass, 'kg'), g('Isp', isp, 's'), g('Maximum thrust', force, 'N'), g('Throttle', throttle, 'fraction'), muGiven(), g0Given()],
        [answer('dv', 'Arrival Δv magnitude', 'km/s', Math.abs(t.dv2)), angleAnswer('bearing', 'Arrival burn bearing', angle), answer('duration', 'Equivalent engine duration', 's', b.duration)],
        ['Find transfer speed at r2 and compare it with the target’s circular speed.', 'Signed Δv2 = vc2 − vt2. Positive uses θ + 90°; negative uses θ − 90°.'],
        [`a = ${fmt(t.a)} km; transfer arrival speed = ${fmt(t.u2, 7)} km/s.`, `Target speed = ${fmt(t.v2, 7)} km/s; signed Δv2 = ${fmt(t.dv2, 7)} km/s.`, `Magnitude = ${fmt(Math.abs(t.dv2), 7)} km/s; bearing = wrap360(${theta} ${t.dv2 >= 0 ? '+ 90' : '− 90'}) = ${angle}°.`, `Rocket equation gives fuel = ${fmt(b.fuel, 4)} kg at this current mass; flow = ${fmt(b.flow, 6)} kg/s.`, `Equivalent duration = ${fmt(b.duration, 5)} s. The ideal impulse makes arrival relative velocity zero in this model.`],
        'Use the remaining mass for arrival engine timing, and explicitly remove relative velocity.', { kind: 'mission', r1, r2, positionAngle: theta, burnBearing: angle, deltaV: t.dv2, duration: b.duration, mass, force, isp, throttle });
    },
    rng => {
      const current = [rng.sign() * rng.int(20, 60) / 10, rng.sign() * rng.int(20, 60) / 10];
      const intended = [rng.sign() * rng.int(1, 12) / 10, rng.sign() * rng.int(1, 12) / 10];
      const desired = current.map((v, i) => Number((v + intended[i]).toFixed(1)));
      const dx = desired[0] - current[0], dy = desired[1] - current[1], dv = magnitude(dx, dy), angle = heading(dx, dy);
      const mass = 10000, dry = rng.int(65, 97) * 100, isp = rng.int(30, 45) * 10, capacity = exhaust(isp) / 1000 * Math.log(mass / dry), feasible = dv <= capacity;
      return q('Reject a command that consumes the spacecraft', 'Calculate the velocity-change magnitude and map bearing needed to match the desired velocity. Decide whether it is ideally feasible without falling below dry mass; allow using all available propellant and ignore reserve requirements for this check.',
        [g('Current vx', current[0], 'km/s'), g('Current vy', current[1], 'km/s'), g('Desired vx', desired[0], 'km/s'), g('Desired vy', desired[1], 'km/s'), g('Current mass', mass, 'kg'), g('Dry mass', dry, 'kg'), g('Isp', isp, 's'), g0Given()],
        [answer('dv', 'Required Δv magnitude', 'km/s', dv), angleAnswer('bearing', 'Required burn bearing', angle), choice('feasible', 'Fuel feasibility', feasible ? 'feasible' : 'insufficient', [['feasible', 'Feasible within available propellant'], ['insufficient', 'Insufficient propellant']])],
        ['Compute desired minus current velocity, then its magnitude and bearing.', 'Available ideal Δv = (g0 Isp/1000) ln(current mass/dry mass). Compare magnitudes.'],
        [`Required vector = (${desired[0]} − (${current[0]}), ${desired[1]} − (${current[1]})) = (${fmt(dx)}, ${fmt(dy)}) km/s.`, `Magnitude = ${fmt(dv, 7)} km/s; bearing = ${fmt(angle, 6)}°.`, `Capacity = (${G0} × ${isp}/1000) ln(${mass}/${dry}) = ${fmt(capacity, 7)} km/s.`, `Required ${fmt(dv, 5)} ${feasible ? '≤' : '>'} available ${fmt(capacity, 5)}, so the ideal maneuver is ${feasible ? 'feasible' : 'not feasible'} without violating dry mass.`],
        'Dry mass is a hard boundary. Correct direction and duration cannot rescue an infeasible fuel budget.', { kind: 'mission', currentVelocity: current, desiredVelocity: desired, mass, dryMass: dry, isp, deltaV: dv, burnBearing: angle, feasible });
    },
    rng => {
      const r1 = rng.int(70, 90) * 100, r2 = rng.int(11, 19) * 1000, m0 = rng.int(10, 16) * 1000, isp = rng.int(40, 45) * 10;
      const t = transfer(r1, r2), total = Math.abs(t.dv1) + Math.abs(t.dv2), phase = phaseFor(r2, t.time), fuel = m0 * (1 - Math.exp(-1000 * total / exhaust(isp)));
      return q('Close the entire ideal flight plan', 'For a counterclockwise two-burn transfer to a moving circular target, calculate the required initial target lead, total ideal Δv magnitude budget, and total propellant. Both burns use the same Isp; assume enough propellant is carried.',
        [g('Departure radius r1', r1, 'km'), g('Target radius r2', r2, 'km'), g('Initial spacecraft mass', m0, 'kg'), g('Isp for both burns', isp, 's'), muGiven(), g0Given()],
        [angleAnswer('phase', 'Required initial target lead', phase), answer('budget', 'Total ideal Δv budget', 'km/s', total), answer('fuel', 'Total ideal propellant', 'kg', fuel)],
        ['Compute both endpoint impulses and the transfer coast before choosing the target phase.', 'For identical Isp, sequential mass ratios multiply; use the sum of burn magnitudes in the exponential.'],
        [`a = ${fmt(t.a)} km; coast = ${fmt(t.time, 4)} s.`, `Phase = wrap360(180 − (360/${fmt(period(r2), 4)}) × ${fmt(t.time, 4)}) ≈ ${fmt(phase, 6)}°.`, `Δv1 = ${fmt(t.dv1, 7)} and Δv2 = ${fmt(t.dv2, 7)} km/s; budget = ${fmt(total, 7)} km/s.`, `Final mass = ${m0} exp[−1000 × ${fmt(total, 7)}/(${G0} × ${isp})] ≈ ${fmt(m0 - fuel, 4)} kg.`, `Total propellant = ${m0} − mf = ${fmt(fuel, 4)} kg. Arrival velocity matches the target only after the second burn.`],
        'A complete plan coordinates timing, both maneuvers, and the changing mass across the whole mission.', { kind: 'mission', r1, r2, phase, coast: t.time, deltaV1: t.dv1, deltaV2: t.dv2, mass: m0, isp, fuel });
    }
  ]
};

export function variantCount(lessonId) { return Object.hasOwn(TEMPLATES, lessonId) ? TEMPLATES[lessonId].length : 0; }
export function generateQuestion(lessonId, seed = 0, variantIndex) {
  if (!Object.hasOwn(TEMPLATES, lessonId)) throw new RangeError(`Unknown lesson: ${lessonId}`);
  const templates = TEMPLATES[lessonId];
  if (variantIndex !== undefined && (!Number.isInteger(variantIndex) || variantIndex < 0)) throw new RangeError('Variant index must be a nonnegative integer.');
  const variant = variantIndex === undefined ? hashSeed(`${lessonId}:${seed}`) % templates.length : variantIndex % templates.length;
  const rng = random(`${lessonId}:${String(seed)}:${variant}`);
  return { id: `${lessonId}-${variant}-${hashSeed(seed).toString(36)}`, lessonId, variant, ...templates[variant](rng) };
}

/** Parse a small arithmetic language, never JavaScript. Trigonometry uses degrees.
 * Returns a finite number; malformed expressions throw a learner-readable Error. */
export function parseCalculation(input) {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new Error('Enter a finite number.');
    return input;
  }
  if (typeof input !== 'string' || !input.trim()) throw new Error('Enter a number or calculation.');
  if (input.length > 400) throw new Error('Use a shorter calculation (up to 400 characters).');
  const source = input.trim().replaceAll('−', '-').replaceAll('×', '*').replaceAll('÷', '/');
  const tokens = [];
  let offset = 0;
  while (offset < source.length) {
    const rest = source.slice(offset);
    const space = /^\s+/.exec(rest);
    if (space) { offset += space[0].length; continue; }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
    const identifier = /^[A-Za-z][A-Za-z0-9]*/.exec(rest);
    if (number) { tokens.push({ type: 'number', value: Number(number[0]) }); offset += number[0].length; }
    else if (identifier) { tokens.push({ type: 'name', value: identifier[0].toLowerCase() }); offset += identifier[0].length; }
    else if ('+-*/^(),'.includes(source[offset])) { tokens.push({ type: source[offset], value: source[offset++] }); }
    else throw new Error('Use numbers, arithmetic, parentheses, and the listed functions only.');
    if (tokens.length > 160) throw new Error('Use a shorter calculation.');
  }
  tokens.push({ type: 'end' });
  let cursor = 0, depth = 0;
  const finite = value => {
    if (!Number.isFinite(value)) throw new Error('This calculation does not produce a finite real number.');
    return value;
  };
  const nested = fn => {
    if (++depth > 32) throw new Error('Use fewer nested operations.');
    try { return fn(); } finally { depth--; }
  };
  const take = type => tokens[cursor]?.type === type ? tokens[cursor++] : null;
  const expect = type => { if (!take(type)) throw new Error(`Expected ${type === ')' ? 'a closing parenthesis' : type}.`); };
  const call = (name, args) => {
    const unaryFunctions = ['sqrt', 'ln', 'exp', 'sin', 'cos', 'tan'];
    if (!unaryFunctions.includes(name) && name !== 'atan2') throw new Error(`Unknown function: ${name}.`);
    const count = name === 'atan2' ? 2 : 1;
    if (args.length !== count) throw new Error(`${name} requires ${count} argument${count === 1 ? '' : 's'}.`);
    const [x, y] = args;
    if (name === 'sqrt') return finite(Math.sqrt(x));
    if (name === 'ln') return finite(Math.log(x));
    if (name === 'exp') return finite(Math.exp(x));
    if (name === 'sin') return finite(Math.sin(x * DEG));
    if (name === 'cos') return finite(Math.cos(x * DEG));
    if (name === 'tan') {
      if (Math.abs(Math.cos(x * DEG)) < 1e-12) throw new Error('Tangent is undefined at this angle.');
      return finite(Math.tan(x * DEG));
    }
    if (x === 0 && y === 0) throw new Error('A zero vector has no bearing.');
    return finite(Math.atan2(x, y) / DEG);
  };
  const primary = () => nested(() => {
    const number = take('number');
    if (number) return finite(number.value);
    if (take('(')) { const value = sum(); expect(')'); return value; }
    const name = take('name');
    if (name) {
      if (name.value === 'pi') return Math.PI;
      expect('(');
      const args = [];
      if (!take(')')) {
        args.push(sum());
        while (take(',')) { if (args.length >= 2) throw new Error('A function accepts at most two arguments.'); args.push(sum()); }
        expect(')');
      }
      return call(name.value, args);
    }
    throw new Error('Expected a number, pi, or a function.');
  });
  const power = () => { const base = primary(); return take('^') ? finite(base ** unary()) : base; };
  // Unary signs have lower precedence than exponentiation; exponents associate right.
  const unary = () => nested(() => take('+') ? unary() : take('-') ? finite(-unary()) : power());
  const product = () => {
    let value = unary();
    while (true) {
      if (take('*')) value = finite(value * unary());
      else if (take('/')) { const divisor = unary(); if (divisor === 0) throw new Error('Division by zero is undefined.'); value = finite(value / divisor); }
      else return value;
    }
  };
  const sum = () => {
    let value = product();
    while (true) {
      if (take('+')) value = finite(value + product());
      else if (take('-')) value = finite(value - product());
      else return value;
    }
  };
  const result = sum();
  if (tokens[cursor].type !== 'end') throw new Error('Unexpected input. Use * for multiplication and check parentheses.');
  return finite(result);
}

/** Tolerance is absolute in answerSpec.unit; angular errors use the shortest arc. */
export function gradeAnswer(answerSpec, input) {
  if (answerSpec.options) {
    const parsed = typeof input === 'string' ? input.trim() : String(input);
    const valid = answerSpec.options.some(option => option.value === parsed);
    const correct = valid && parsed === answerSpec.value;
    return { correct, parsed: valid ? parsed : null, message: correct ? 'Correct.' : valid ? 'Not yet. Revisit the model and its limits.' : 'Select one of the listed choices.' };
  }
  let parsed;
  try { parsed = parseCalculation(input); }
  catch (error) { return { correct: false, parsed: null, message: error.message }; }
  if (!Number.isFinite(answerSpec.value) || !Number.isFinite(answerSpec.tolerance) || answerSpec.tolerance < 0) {
    return { correct: false, parsed, message: 'This answer could not be checked.' };
  }
  const error = answerSpec.angle ? Math.abs(wrap(wrap(parsed) - wrap(answerSpec.value) + 180) - 180) : Math.abs(parsed - answerSpec.value);
  const correct = error <= answerSpec.tolerance + Number.EPSILON * Math.max(1, Math.abs(answerSpec.value)) * 8;
  const tolerance = Number(answerSpec.tolerance.toPrecision(3));
  return { correct, parsed, message: correct ? 'Correct within the stated tolerance.' : `Not yet. Check signs and units; allowed absolute error is ±${tolerance}${answerSpec.unit ? ` ${answerSpec.unit}` : ''}.` };
}
