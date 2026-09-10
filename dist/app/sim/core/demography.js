export const BANDS = 21; // 0–4, 5–9, …, 100+
const BAND_YEARS = 5;
const MID = Array.from({ length: BANDS }, (_, i) => i * BAND_YEARS + 2.5);
// Fertility schedule by band 15–19 … 45–49 (shares of the total fertility rate).
const ASFR_SHAPE = [0.05, 0.22, 0.30, 0.25, 0.13, 0.04, 0.01];
const FEMALE = 0.49;
/** Annual mortality by age for a life expectancy of ~80 (Gompertz plus a child term). */
function baseMortality(age) {
    const gompertz = 0.00004 * Math.exp(0.085 * age);
    const child = age < 5 ? 0.003 : 0;
    return Math.min(0.6, gompertz + child);
}
/**
 * Old-age mortality multiplier for a life expectancy target. LE 80 → 1; every
 * ten years of extra life roughly halves old-age mortality; famine and state
 * failure are added separately by the caller.
 */
export function mortalityScale(lifeExpectancy) {
    return Math.pow(80 / Math.max(45, lifeExpectancy), 2.4);
}
/** Build a pyramid with the given median age and size, using the base life table and an exponential age gradient. */
export function initialCohorts(totalM, medianAge) {
    const survival = [1];
    for (let i = 1; i < BANDS; i++)
        survival[i] = survival[i - 1] * Math.pow(1 - baseMortality(MID[i - 1]), BAND_YEARS);
    const shape = (k) => survival.map((s, i) => s * Math.exp(-k * MID[i]));
    const medianOf = (w) => {
        const tot = w.reduce((a, b) => a + b, 0);
        let acc = 0;
        for (let i = 0; i < BANDS; i++) {
            if (acc + w[i] >= tot / 2)
                return i * BAND_YEARS + BAND_YEARS * (tot / 2 - acc) / w[i];
            acc += w[i];
        }
        return 100;
    };
    let lo = -0.05, hi = 0.08;
    for (let it = 0; it < 40; it++) {
        const k = (lo + hi) / 2;
        if (medianOf(shape(k)) > medianAge)
            lo = k;
        else
            hi = k;
    }
    const w = shape((lo + hi) / 2);
    const tot = w.reduce((a, b) => a + b, 0);
    return w.map((x) => x / tot * totalM);
}
export function medianAgeOf(cohorts) {
    const tot = cohorts.reduce((a, b) => a + b, 0);
    if (tot <= 0)
        return 30;
    let acc = 0;
    for (let i = 0; i < BANDS; i++) {
        if (acc + cohorts[i] >= tot / 2)
            return i * BAND_YEARS + BAND_YEARS * (tot / 2 - acc) / Math.max(1e-9, cohorts[i]);
        acc += cohorts[i];
    }
    return 100;
}
/** Working-age share: 15 up to a retirement age that moves with healthy life (65 at LE 80, ~96 at LE 130). */
export function workingShareOf(cohorts, lifeExpectancy) {
    const tot = cohorts.reduce((a, b) => a + b, 0);
    if (tot <= 0)
        return 0;
    const retire = lifeExpectancy <= 80 ? 65 : 40 + 25 * (lifeExpectancy - 40) / 40;
    let w = 0;
    for (let i = 3; i < BANDS; i++) {
        const lo = i * BAND_YEARS, hi = lo + BAND_YEARS;
        if (hi <= retire)
            w += cohorts[i];
        else if (lo < retire)
            w += cohorts[i] * (retire - lo) / BAND_YEARS;
    }
    return w / tot;
}
/** Scale the pyramid so it sums to `total` (after migration, off-world moves, births added elsewhere). */
export function reconcile(p) {
    const sum = p.cohorts.reduce((a, b) => a + b, 0);
    if (sum <= 0) {
        if (p.total > 1e-6)
            p.cohorts = initialCohorts(p.total, p.medianAge);
        else {
            p.total = 0;
            p.cohorts = Array(BANDS).fill(0);
            p.workingShare = 0;
        }
        return;
    }
    const f = p.total / sum;
    if (Math.abs(f - 1) > 1e-9)
        for (let i = 0; i < BANDS; i++)
            p.cohorts[i] *= f;
}
/**
 * Advance one month. Returns crude birth and death rates (per year).
 * extraDeath: additional annual mortality from famine, state failure, heat (applied to every band, doubled for the very young and very old).
 * birthSuppression: 0..1 share of births lost to hardship, hunger, crowding this month.
 */
export function stepCohorts(p, extraDeath, birthSuppression, dt) {
    const c = p.cohorts;
    const total = c.reduce((a, b) => a + b, 0);
    if (total <= 0)
        return { birthRate: 0, deathRate: 0 };
    // births
    let births = 0;
    for (let k = 0; k < ASFR_SHAPE.length; k++)
        births += c[3 + k] * FEMALE * p.fertility * ASFR_SHAPE[k] / BAND_YEARS;
    // longevity therapies extend the fertile window a little (45–54)
    if (p.lifeExpectancy > 95)
        births += (c[9] + c[10]) * FEMALE * p.fertility * 0.03 / BAND_YEARS;
    births *= (1 - birthSuppression) * dt;
    // deaths
    // Longer life expectancy is modelled as slower aging past 40: at LE 80 a
    // 100-year-old dies like a 100-year-old; at LE 130 like a 67-year-old.
    const slow = 40 / Math.max(40, p.lifeExpectancy - 40);
    const scale = p.lifeExpectancy < 80 ? mortalityScale(p.lifeExpectancy) : 1;
    let deaths = 0;
    for (let i = 0; i < BANDS; i++) {
        const vulnerable = i === 0 || i >= 14 ? 2 : 1;
        const age = MID[i] <= 40 ? MID[i] : 40 + (MID[i] - 40) * (p.lifeExpectancy >= 80 ? slow : 1);
        const m = Math.min(0.9, baseMortality(age) * scale + extraDeath * vulnerable);
        const d = c[i] * m * dt;
        c[i] -= d;
        deaths += d;
    }
    // aging: a fifth of each band moves up every year
    const move = dt / BAND_YEARS;
    for (let i = BANDS - 1; i >= 1; i--) {
        const x = c[i - 1] * move;
        c[i - 1] -= x;
        c[i] += x;
    }
    c[0] += births;
    p.total = Math.max(0, c.reduce((a, b) => a + b, 0));
    if (p.total < 1e-6) {
        p.total = 0;
        for (let i = 0; i < BANDS; i++)
            c[i] = 0;
    }
    p.medianAge = medianAgeOf(c);
    p.workingShare = workingShareOf(c, p.lifeExpectancy);
    return { birthRate: births / dt / total, deathRate: deaths / dt / total };
}
/** Age-band summary for the UI: 0–14, 15–39, 40–64, 65–84, 85+ as shares. */
export function ageGroups(p) {
    const c = p.cohorts;
    const tot = Math.max(1e-9, c.reduce((a, b) => a + b, 0));
    const sum = (a, b) => c.slice(a, b).reduce((x, y) => x + y, 0) / tot;
    return [sum(0, 3), sum(3, 8), sum(8, 13), sum(13, 17), sum(17, BANDS)];
}
