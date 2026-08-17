import { positionLocal, positionWorld, pow, mul, sub, vec3, float } from 'three/tsl';

// The World Curve pushes vertices downwards on the Y-axis based on their Z distance.
export const worldCurveNode = () => {
    // curve = (worldZ^2) * intensity
    const intensity = float(0.0003);
    const zSq = pow(positionWorld.z, 2);
    const drop = mul(zSq, intensity);

    // Apply drop to local Y
    return vec3(positionLocal.x, sub(positionLocal.y, drop), positionLocal.z);
};
