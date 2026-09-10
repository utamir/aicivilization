// Veloria — wealthy, open, science-forward coastal federation; strong services/AI,
// tight electricity grid, aging population.
// Ardan — industrial manufacturing powerhouse; export-driven, strategic autonomy,
// strong fabs & robotics, younger demographics, more state coordination.
// Nemea — resource-rich emerging giant; large young population, energy endowment,
// weaker institutions, fast catch-up potential.
export const CIV_DEFS = [
    {
        id: 'veloria', name: 'Veloria', epithet: 'The Knowledge Federation',
        color: '#5B8CFF',
        description: 'Wealthy, open federation of coastal city-states. Frontier AI research, world-class universities, tight power grid, aging population.',
        traits: {
            openness: 0.85, riskTolerance: 0.6, sciencePriority: 0.9,
            regulatoryCaution: 0.55, marketOrientation: 0.8, strategicAutonomy: 0.35,
            educationBase: 0.95, capitalWealth: 0.95, energyEndowment: 0.3,
        },
        population: { total: 42.3, workingShare: 0.62, medianAge: 43, education: 1.0, fertility: 1.45, urbanization: 0.86 },
        economy: { output: 1.0, unemployment: 0.048, gini: 0.36, publicDebt: 0.9, rdSpendShare: 0.034, capexAvailability: 1.0 },
        // demand ~287 TWh → avg ~32.8 GW; firm capacity above that
        energy: { demandTWh: 287, fossil: 14, nuclear: 6, solar: 9, wind: 10, hydro: 4, geothermal: 0.8, bioenergy: 1.2, ocean: 0.1, storageGWh: 24, gridCapGW: 40 },
        compute: { accelStock: 1.0, dcCapGW: 4.2 },
        society: { trust: 0.62, stability: 0.72, regCaution: 0.55 },
        researchCapacity: 1.0,
        // dense coasts, little farmland → structural importer; mild climate
        food: { land: 0.82, climateSensitivity: 0.7, artificial0: 0.02 },
        // dense coastal city-states: most usable land is already built; long shallow shelf
        land: { urban: 0.46, farm: 0.28, energy: 0.012, shelf: 0.22, seaExposure: 0.55 },
        culturalCohesion: 0.3,
    },
    {
        id: 'ardan', name: 'Ardan', epithet: 'The Industrial Engine',
        color: '#FFB454',
        description: 'Manufacturing superpower with deep semiconductor and robotics capacity. Strategically autonomous, state-coordinated investment, younger workforce.',
        traits: {
            openness: 0.4, riskTolerance: 0.5, sciencePriority: 0.7,
            regulatoryCaution: 0.35, marketOrientation: 0.45, strategicAutonomy: 0.9,
            educationBase: 0.75, capitalWealth: 0.8, energyEndowment: 0.55,
        },
        population: { total: 118, workingShare: 0.66, medianAge: 38, education: 0.8, fertility: 1.6, urbanization: 0.72 },
        economy: { output: 1.45, unemployment: 0.052, gini: 0.42, publicDebt: 0.65, rdSpendShare: 0.026, capexAvailability: 0.95 },
        energy: { demandTWh: 640, fossil: 52, nuclear: 8, solar: 16, wind: 14, hydro: 8, geothermal: 0.8, bioenergy: 2.0, ocean: 0.1, storageGWh: 30, gridCapGW: 88 },
        compute: { accelStock: 0.75, dcCapGW: 5.5 },
        society: { trust: 0.5, stability: 0.68, regCaution: 0.35 },
        researchCapacity: 0.85,
        // industrial agriculture, near self-sufficient; autonomy doctrine pushes food tech
        food: { land: 1.04, climateSensitivity: 1.0, artificial0: 0.01 },
        land: { urban: 0.30, farm: 0.46, energy: 0.015, shelf: 0.14, seaExposure: 0.30 },
        culturalCohesion: 0.5,
    },
    {
        id: 'nemea', name: 'Nemea', epithet: 'The Rising Land',
        color: '#4FD1A5',
        description: 'Vast, young, resource-rich republic. Abundant energy and raw materials, weaker institutions and grid, enormous catch-up potential.',
        traits: {
            openness: 0.55, riskTolerance: 0.7, sciencePriority: 0.45,
            regulatoryCaution: 0.3, marketOrientation: 0.6, strategicAutonomy: 0.5,
            educationBase: 0.5, capitalWealth: 0.4, energyEndowment: 0.9,
        },
        population: { total: 96, workingShare: 0.68, medianAge: 29, education: 0.55, fertility: 2.3, urbanization: 0.58 },
        economy: { output: 0.55, unemployment: 0.088, gini: 0.5, publicDebt: 0.5, rdSpendShare: 0.011, capexAvailability: 0.7 },
        energy: { demandTWh: 240, fossil: 26, nuclear: 2, solar: 6, wind: 6, hydro: 9, geothermal: 0.6, bioenergy: 1.8, ocean: 0.1, storageGWh: 8, gridCapGW: 32 },
        compute: { accelStock: 0.3, dcCapGW: 1.2 },
        society: { trust: 0.38, stability: 0.5, regCaution: 0.3 },
        researchCapacity: 0.4,
        // the breadbasket: vast fertile plains, big export surplus — but exposed to warming
        food: { land: 1.32, climateSensitivity: 1.35, artificial0: 0.0 },
        // vast plains, but the plains are farmland; the coast is short and deep
        land: { urban: 0.17, farm: 0.58, energy: 0.008, shelf: 0.09, seaExposure: 0.20 },
        culturalCohesion: 0.7,
    },
];
export function civDef(id) {
    return CIV_DEFS.find((c) => c.id === id);
}
