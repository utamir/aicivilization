import * as THREE from 'three';
export const skyState = {
    /** 0 = full day, 1 = full night (twilight band from the sun's elevation). */
    nightFactor: 0,
    /** Peaks at sunrise/sunset (evening/morning glow); drives warm horizon tints. */
    duskFactor: 0,
    /** Horizon/fog color the SkyRig derives each frame; water reflects it. */
    fogColor: new THREE.Color('#b8c8d8'),
    /** Normalized direction of the sun from the scene origin. */
    sunDir: new THREE.Vector3(0.9, 0.5, 0.45).normalize(),
};
