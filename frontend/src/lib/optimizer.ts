export type RouteInputs = {
  distance1: number;
  distance2: number;
  deadline: number;
  minSpeed: number;
  maxSpeed: number;
};

export type FrontierPoint = { speed1: number; fuel: number };

export type OptimizationResult = {
  speed1: number;
  speed2: number;
  time1: number;
  time2: number;
  totalTime: number;
  fuel: number;
  equalSpeed: number;
  equalSpeedFuel: number | null;
  savingsPercent: number | null;
  feasibleSpeed1: [number, number];
  frontier: FrontierPoint[];
};

const SEGMENT_1 = { a: 0.002, b: 2 };
const SEGMENT_2 = { a: 0.003, b: 2 };
const EPSILON = 1e-9;

export function fuelConsumption(
  distance1: number,
  distance2: number,
  speed1: number,
  speed2: number,
): number {
  return (
    distance1 * (SEGMENT_1.a * speed1 ** 2 + SEGMENT_1.b / speed1) +
    distance2 * (SEGMENT_2.a * speed2 ** 2 + SEGMENT_2.b / speed2)
  );
}

export function optimizeRoute(input: RouteInputs): OptimizationResult {
  const { distance1, distance2, deadline, minSpeed, maxSpeed } = input;
  const values = [distance1, distance2, deadline, minSpeed, maxSpeed];
  if (!values.every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Enter a positive number in every route field.");
  }
  if (minSpeed >= maxSpeed) {
    throw new Error("Maximum speed must be greater than minimum speed.");
  }

  const fastestTime = (distance1 + distance2) / maxSpeed;
  const slowestTime = (distance1 + distance2) / minSpeed;
  if (deadline < fastestTime - EPSILON || deadline > slowestTime + EPSILON) {
    throw new Error(
      `That deadline is outside the selected speed range. This route takes between ${fastestTime.toFixed(2)} and ${slowestTime.toFixed(2)} hours.`,
    );
  }

  const lowTime1 = Math.max(
    distance1 / maxSpeed,
    deadline - distance2 / minSpeed,
  );
  const highTime1 = Math.min(
    distance1 / minSpeed,
    deadline - distance2 / maxSpeed,
  );
  if (lowTime1 > highTime1 + EPSILON) {
    throw new Error("No speed combination meets the deadline and both speed limits.");
  }

  const fuelAtTime1 = (time1: number) => {
    const time2 = deadline - time1;
    if (time1 <= 0 || time2 <= 0) return Number.POSITIVE_INFINITY;
    return fuelConsumption(distance1, distance2, distance1 / time1, distance2 / time2);
  };

  // The project objective is convex in segment 1 travel time. Golden-section
  // search locates its interior minimum; both boundaries are checked too.
  let bestTime1 = lowTime1;
  let bestFuel = fuelAtTime1(lowTime1);
  const highFuel = fuelAtTime1(highTime1);
  if (highFuel < bestFuel) {
    bestTime1 = highTime1;
    bestFuel = highFuel;
  }

  if (highTime1 - lowTime1 > EPSILON) {
    const ratio = (Math.sqrt(5) - 1) / 2;
    let left = lowTime1;
    let right = highTime1;
    let c = right - ratio * (right - left);
    let d = left + ratio * (right - left);
    let fc = fuelAtTime1(c);
    let fd = fuelAtTime1(d);
    for (let iteration = 0; iteration < 120 && right - left > 1e-12; iteration += 1) {
      if (fc <= fd) {
        right = d;
        d = c;
        fd = fc;
        c = right - ratio * (right - left);
        fc = fuelAtTime1(c);
      } else {
        left = c;
        c = d;
        fc = fd;
        d = left + ratio * (right - left);
        fd = fuelAtTime1(d);
      }
    }
    const interiorTime1 = (left + right) / 2;
    const interiorFuel = fuelAtTime1(interiorTime1);
    if (interiorFuel < bestFuel) {
      bestTime1 = interiorTime1;
      bestFuel = interiorFuel;
    }
  }

  const bestTime2 = deadline - bestTime1;
  const speed1 = distance1 / bestTime1;
  const speed2 = distance2 / bestTime2;
  const equalSpeed = (distance1 + distance2) / deadline;
  const baselineIsFeasible =
    equalSpeed >= minSpeed - EPSILON && equalSpeed <= maxSpeed + EPSILON;
  const equalSpeedFuel = baselineIsFeasible
    ? fuelConsumption(distance1, distance2, equalSpeed, equalSpeed)
    : null;
  const savingsPercent =
    equalSpeedFuel === null
      ? null
      : (100 * (equalSpeedFuel - bestFuel)) / equalSpeedFuel;

  const feasibleSpeed1: [number, number] = [
    distance1 / highTime1,
    distance1 / lowTime1,
  ];
  const frontier = Array.from({ length: 101 }, (_, index) => {
    const speed1AtPoint =
      feasibleSpeed1[0] +
      ((feasibleSpeed1[1] - feasibleSpeed1[0]) * index) / 100;
    const time2AtPoint = deadline - distance1 / speed1AtPoint;
    const speed2AtPoint = distance2 / time2AtPoint;
    return {
      speed1: speed1AtPoint,
      fuel: fuelConsumption(distance1, distance2, speed1AtPoint, speed2AtPoint),
    };
  });

  return {
    speed1,
    speed2,
    time1: bestTime1,
    time2: bestTime2,
    totalTime: bestTime1 + bestTime2,
    fuel: bestFuel,
    equalSpeed,
    equalSpeedFuel,
    savingsPercent,
    feasibleSpeed1,
    frontier,
  };
}
