import moment from "moment";

// Define Types for Inputs and Outputs
interface Trip {
  userId: string;
  start_coord: string;
  last_coord: string;
  mode: string;
  startTime: string;
  endTime: string;
}

interface UserLocation {
  home_lat: number;
  home_lon: number;
  work_lat: number;
  work_lon: number;
}

interface TourSummary {
  userId: string;
  tour_id: number;
  tour_type: string;
  total_distance_km: number;
  modes_used: string[];
  points: number;
}

interface BonusPoints {
  userId: string;
  year: number;
  week: number;
  bonus_points: number;
}

// Extended Trip with additional properties
interface ProcessedTrip extends Trip {
  distance_km: number;
  mode_standard: string;
  distance_from_home_start: number;
  distance_from_home_end: number;
  distance_from_work_start: number;
  distance_from_work_end: number;
  stop_type: string;
  tour_id: number;
}

// Result interface to encapsulate both TourSummaries and BonusPoints
interface Result {
  tourSummaries: TourSummary[];
  bonusPoints: BonusPoints[];
}

// Helper function to convert degrees to radians
const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

// Haversine distance calculation using built-in Math functions
const haversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Extract dominant mode
const getDominantMode = (modeJSON: string): string => {
  try {
    const modeData = JSON.parse(modeJSON.replace(/'/g, '"'));
    return Object.keys(modeData).reduce((a, b) =>
      modeData[a] > modeData[b] ? a : b
    );
  } catch (error) {
    console.error("Error parsing mode JSON:", error);
    return "Unknown";
  }
};

// Map mode names to standard modes
const modeMapping: { [key: string]: string } = {
  in_vehicle: "Car",
  taxi: "Car",
  bus: "Public Transport",
  intercity_rail: "Public Transport",
  metro: "Public Transport",
  on_bicycle: "Cycling",
  walking: "Walking",
  running: "Walking",
  scooter: "Electric Scooter",
  motorcycle: "Electric Scooter",
  airplane: "Airplane", // Included for completeness
  // Add more mappings as needed
};

// Sustainable modes and weighting factors based on the new table
const sustainableModes: {
  [key: string]: { ranges: { min: number; max: number; factor: number }[] };
} = {
  "Public Transport": {
    ranges: [
      { min: 0, max: 5, factor: 1.0 },
      { min: 5, max: 10, factor: 1.5 },
      { min: 10, max: Infinity, factor: 2.0 },
    ],
  },
  Cycling: {
    ranges: [
      { min: 0, max: 3, factor: 1.0 },
      { min: 3, max: 7, factor: 1.5 },
      { min: 7, max: Infinity, factor: 2.0 },
    ],
  },
  Walking: {
    ranges: [
      { min: 0, max: 1, factor: 1.0 },
      { min: 1, max: 3, factor: 1.5 },
      { min: 3, max: Infinity, factor: 2.0 },
    ],
  },
  "Electric Scooter": {
    ranges: [
      { min: 0, max: 5, factor: 1.0 },
      { min: 5, max: 10, factor: 1.2 },
      { min: 10, max: 20, factor: 1.3 },
      { min: 20, max: Infinity, factor: 1.4 },
    ],
  },
  "Electric Bike": {
    ranges: [
      { min: 0, max: 5, factor: 1.0 },
      { min: 5, max: 10, factor: 1.2 },
      { min: 10, max: 20, factor: 1.3 },
      { min: 20, max: Infinity, factor: 1.4 },
    ],
  },
};

// Function to get the weighting factor based on mode and distance
const getWeightingFactor = (mode: string, distance: number): number => {
  if (!(mode in sustainableModes)) {
    return 0; // Non-sustainable modes do not earn points
  }

  const modeRanges = sustainableModes[mode].ranges;
  for (const range of modeRanges) {
    if (distance > range.min && distance <= range.max) {
      return range.factor;
    }
    // Handle the case where distance equals the min boundary
    if (distance === range.min) {
      return range.factor;
    }
  }
  return 0; // Default to 0 if no range matches
};

// Calculate distances from home and work
const calculateDistances = (
  trips: Trip[],
  userLocation: UserLocation
): Trip[] => {
  return trips.map((trip) => {
    const [start_lat, start_lon] = trip.start_coord
      .replace(/[()]/g, "")
      .split(",")
      .map((coord) => parseFloat(coord.trim()));
    const [end_lat, end_lon] = trip.last_coord
      .replace(/[()]/g, "")
      .split(",")
      .map((coord) => parseFloat(coord.trim()));

    return {
      ...trip,
      // These properties will be added in the ProcessedTrip interface
      distance_km: 0, // To be calculated later
      mode_standard: "", // To be mapped later
      distance_from_home_start: haversineDistance(
        start_lat,
        start_lon,
        userLocation.home_lat,
        userLocation.home_lon
      ),
      distance_from_home_end: haversineDistance(
        end_lat,
        end_lon,
        userLocation.home_lat,
        userLocation.home_lon
      ),
      distance_from_work_start: haversineDistance(
        start_lat,
        start_lon,
        userLocation.work_lat,
        userLocation.work_lon
      ),
      distance_from_work_end: haversineDistance(
        end_lat,
        end_lon,
        userLocation.work_lat,
        userLocation.work_lon
      ),
    };
  });
};

// Classify stop types
const classifyStopType = (trip: ProcessedTrip): string => {
  const homeThreshold = 0.5; // 0.5 km
  const workThreshold = 0.5; // 0.5 km

  if (trip.distance_from_home_end < homeThreshold) {
    return "Home";
  } else if (trip.distance_from_work_end < workThreshold) {
    return "Work";
  } else {
    return "Intermediate";
  }
};

// Assign tour IDs based on time gaps and stop types
const assignTourIds = (trips: ProcessedTrip[]): ProcessedTrip[] => {
  let tourId = 0;
  return trips.map((trip, index) => {
    if (
      index === 0 ||
      moment(trip.startTime).diff(moment(trips[index - 1].endTime), "hours") > 1
    ) {
      tourId += 1;
    }
    return { ...trip, tour_id: tourId };
  });
};

// Summarize tours
const summarizeTours = (trips: ProcessedTrip[]): TourSummary[] => {
  const tours: TourSummary[] = [];

  const groupedTrips = trips.reduce((acc, trip) => {
    const key = `${trip.userId}-${trip.tour_id}`;
    acc[key] = acc[key] || [];
    acc[key].push(trip);
    return acc;
  }, {} as { [key: string]: ProcessedTrip[] });

  Object.values(groupedTrips).forEach((group: ProcessedTrip[]) => {
    const totalDistance = group.reduce(
      (sum, trip) => sum + trip.distance_km,
      0
    );
    const modesUsed = [...new Set(group.map((trip) => trip.mode_standard))];
    const startStopType = group[0].stop_type;
    const endStopType = group[group.length - 1].stop_type;

    let tourType = "Other";
    if (startStopType === "Home" && endStopType === "Work") {
      tourType = "Home-Work";
    } else if (startStopType === "Work" && endStopType === "Home") {
      tourType = "Work-Home";
    }

    tours.push({
      userId: group[0].userId,
      tour_id: group[0].tour_id,
      tour_type: tourType,
      total_distance_km: parseFloat(totalDistance.toFixed(2)),
      modes_used: modesUsed as string[],
      points: 0, // Points will be calculated later
    });
  });

  return tours;
};

// Calculate points for each tour based on the highest scoring trip
const calculateTourPoints = (
  tour: TourSummary,
  trips: ProcessedTrip[]
): number => {
  if (
    tour.tour_type !== "Home-Work" &&
    tour.tour_type !== "Work-Home"
  ) {
    return 0;
  }

  let maxPoints = 0;

  trips.forEach((trip) => {
    if (!(trip.mode_standard in sustainableModes)) {
      return; // Skip non-sustainable modes
    }
    const weightingFactor = getWeightingFactor(trip.mode_standard, trip.distance_km);
    if (weightingFactor > 0) {
      const basePoints = 1; // As per the table
      const tripPoints = basePoints * weightingFactor;
      if (tripPoints > maxPoints) {
        maxPoints = tripPoints;
      }
    }
  });

  return parseFloat(maxPoints.toFixed(2));
};

// Main function to calculate points and bonus points
export function calculatePoints(
  trips: Trip[],
  userLocations: { [key: string]: UserLocation }
): Result {
  // Step 1: Map trips to processed trips with distance and mode_standard
  const processedTrips: ProcessedTrip[] = trips.map((trip) => {
    const dominantMode = getDominantMode(trip.mode);
    const modeStandard =
      modeMapping[dominantMode] || "Other"; // Handle unmapped modes

    const [start_lat, start_lon] = trip.start_coord
      .replace(/[()]/g, "")
      .split(",")
      .map((coord) => parseFloat(coord.trim()));
    const [end_lat, end_lon] = trip.last_coord
      .replace(/[()]/g, "")
      .split(",")
      .map((coord) => parseFloat(coord.trim()));

    const distanceKm = haversineDistance(
      start_lat,
      start_lon,
      end_lat,
      end_lon
    );

    return {
      ...trip,
      distance_km: parseFloat(distanceKm.toFixed(2)),
      mode_standard: modeStandard,
      distance_from_home_start: 0, // To be calculated later
      distance_from_home_end: 0,
      distance_from_work_start: 0,
      distance_from_work_end: 0,
      stop_type: "", // To be classified later
      tour_id: 0, // To be assigned later
    };
  });

  // Step 2: Calculate distances from home and work for each trip
  const users = Object.keys(userLocations);
  const tripsWithDistances: ProcessedTrip[] = [];

  users.forEach((userId) => {
    const userLocation = userLocations[userId];
    const userTrips = processedTrips.filter(
      (trip) => trip.userId === userId
    );

    const calculatedTrips = calculateDistances(userTrips, userLocation);

    calculatedTrips.forEach((trip) => {
      const updatedTrip: ProcessedTrip = {
        ...trip,
        distance_km: trip.distance_km, // Already calculated
        mode_standard: trip.mode_standard, // Already mapped
        stop_type: classifyStopType(trip),
      };
      tripsWithDistances.push(updatedTrip);
    });
  });

  // Step 3: Sort trips chronologically per user
  tripsWithDistances.sort((a, b) =>
    moment(a.startTime).diff(moment(b.startTime))
  );

  // Step 4: Assign tour IDs
  const tripsWithTours = assignTourIds(tripsWithDistances);

  // Step 5: Summarize tours
  const tourSummaries = summarizeTours(tripsWithTours);

  // Step 6: Calculate points for each tour based on the highest scoring trip
  tourSummaries.forEach((tour) => {
    const userTrips = tripsWithTours.filter(
      (trip) => trip.userId === tour.userId && trip.tour_id === tour.tour_id
    );
    tour.points = calculateTourPoints(tour, userTrips);
  });

  // Step 7: Calculate bonus points based on weekly sustainable commuting
  const bonusPointsList: BonusPoints[] = [];
  const userWeekDaysMap: {
    [userId: string]: {
      [year_week: string]: {
        [date: string]: { homeWork: boolean; workHome: boolean };
      };
    };
  } = {};

  tourSummaries.forEach((tour) => {
    const userId = tour.userId;
    const tourDate = moment(
      tripsWithTours.find(
        (trip) =>
          trip.userId === userId && trip.tour_id === tour.tour_id
      )?.startTime || ""
    );

    if (!tourDate.isValid()) {
      return; // Skip invalid dates
    }

    const weekNumber = tourDate.isoWeek();
    const weekYear = tourDate.isoWeekYear();
    const dateString = tourDate.format("YYYY-MM-DD");
    const yearWeekKey = `${weekYear}-W${weekNumber}`;

    if (!(userId in userWeekDaysMap)) {
      userWeekDaysMap[userId] = {};
    }

    if (!(yearWeekKey in userWeekDaysMap[userId])) {
      userWeekDaysMap[userId][yearWeekKey] = {};
    }

    if (!(dateString in userWeekDaysMap[userId][yearWeekKey])) {
      userWeekDaysMap[userId][yearWeekKey][dateString] = {
        homeWork: false,
        workHome: false,
      };
    }

    if (tour.tour_type === "Home-Work" && tour.points > 0) {
      userWeekDaysMap[userId][yearWeekKey][dateString].homeWork = true;
    }

    if (tour.tour_type === "Work-Home" && tour.points > 0) {
      userWeekDaysMap[userId][yearWeekKey][dateString].workHome = true;
    }
  });

  // Now, iterate through userWeekDaysMap to calculate bonus points
  Object.keys(userWeekDaysMap).forEach((userId) => {
    Object.keys(userWeekDaysMap[userId]).forEach((yearWeek) => {
      const [yearStr, weekStr] = yearWeek.split("-W");
      const year = parseInt(yearStr, 10);
      const week = parseInt(weekStr, 10);
      const days = userWeekDaysMap[userId][yearWeek];
      let commutingDays = 0;

      Object.values(days).forEach((day) => {
        if (day.homeWork && day.workHome) {
          commutingDays += 1;
        }
      });

      let bonus = 0;
      if (commutingDays >= 5) {
        bonus = 3;
      } else if (commutingDays >= 3) {
        bonus = 2;
      }
      // Add more conditions if needed

      if (bonus > 0) {
        bonusPointsList.push({
          userId,
          year,
          week,
          bonus_points: bonus,
        });
      }
    });
  });

  return {
    tourSummaries,
    bonusPoints: bonusPointsList,
  };
}
