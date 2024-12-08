import React, { useEffect, useState } from "react";
import CountUp from "react-countup";
import { database } from "../firebase";
import { ref, onValue, DataSnapshot } from "firebase/database";

type LogData = {
  id: string;
  object_type: string;
  vehicle_status: string;
  median_speed: number;
  timestamp: string;
};

const HomePage: React.FC = () => {
  const [logs, setLogs] = useState<LogData[]>([]);
  const [stats, setStats] = useState({
    totalCars: 0,
    totalMotorcycles: 0,
    totalBuses: 0,
    totalTrucks: 0,
    totalFrames: 0,
    averageSpeeds: {
      car: 0,
      motorcycle: 0,
      bus: 0,
      truck: 0,
    },
  });

  useEffect(() => {
    const logsRef = ref(database, "data");
    const unsubscribe = onValue(logsRef, (snapshot) => {
      const data = snapshot.val();

      if (data) {
        const formattedLogs: LogData[] = Object.keys(data).map((key) => ({
          id: data[key][1],
          object_type: data[key][0],
          median_speed: data[key][2],
          timestamp: data[key][3],
          vehicle_status: data[key][4],
        }));
        setLogs(formattedLogs.reverse());
        calculateStats(formattedLogs);
      }
    });

    return () => unsubscribe()
  }, []);

  const calculateStats = (logs: LogData[]) => {
    const vehicleGroups = new Map<string, { object_type: string; speeds: number[] }>();
  
    logs.forEach((log) => {
      if (!vehicleGroups.has(log.id)) {
        vehicleGroups.set(log.id, { object_type: log.object_type, speeds: [] });
      }
      vehicleGroups.get(log.id)?.speeds.push(log.median_speed);
    });
  
    const stats = {
      totalCars: 0,
      totalMotorcycles: 0,
      totalBuses: 0,
      totalTrucks: 0,
      totalFrames: logs.length,
      averageSpeeds: {
        car: 0,
        motorcycle: 0,
        bus: 0,
        truck: 0,
      },
    };
  
    const typeSpeedSums = { car: 0, motorcycle: 0, bus: 0, truck: 0 };
    const typeCounts = { car: 0, motorcycle: 0, bus: 0, truck: 0 };
  
    vehicleGroups.forEach(({ object_type, speeds }) => {
      const avgSpeed = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
  
      switch (object_type) {
        case "car":
          stats.totalCars++;
          typeSpeedSums.car += avgSpeed;
          typeCounts.car++;
          break;
        case "motorcycle":
          stats.totalMotorcycles++;
          typeSpeedSums.motorcycle += avgSpeed;
          typeCounts.motorcycle++;
          break;
        case "bus":
          stats.totalBuses++;
          typeSpeedSums.bus += avgSpeed;
          typeCounts.bus++;
          break;
        case "truck":
          stats.totalTrucks++;
          typeSpeedSums.truck += avgSpeed;
          typeCounts.truck++;
          break;
        default:
          break;
      }
    });
  
    // Calculate overall average speeds for each type
    stats.averageSpeeds.car = typeCounts.car > 0 ? typeSpeedSums.car / typeCounts.car : 0;
    stats.averageSpeeds.motorcycle =
      typeCounts.motorcycle > 0 ? typeSpeedSums.motorcycle / typeCounts.motorcycle : 0;
    stats.averageSpeeds.bus = typeCounts.bus > 0 ? typeSpeedSums.bus / typeCounts.bus : 0;
    stats.averageSpeeds.truck = typeCounts.truck > 0 ? typeSpeedSums.truck / typeCounts.truck : 0;
  
    setStats(stats);
  };
  

  const data = [
    { id: 1, value: stats.totalCars, label: "Total Cars" },
    { id: 2, value: stats.totalMotorcycles, label: "Total Motorcycles" },
    { id: 3, value: stats.totalBuses, label: "Total Buses" },
    { id: 4, value: stats.totalTrucks, label: "Total Trucks" },
    { id: 5, value: stats.totalFrames, label: "Total Frames Detected" },
    { id: 6, value: stats.averageSpeeds.car, label: "Average Car Speed (km/h)", isSpeed: true },
    { id: 7, value: stats.averageSpeeds.motorcycle, label: "Average Motorcycle Speed (km/h)", isSpeed: true },
    { id: 8, value: stats.averageSpeeds.bus, label: "Average Bus Speed (km/h)", isSpeed: true },
    { id: 9, value: stats.averageSpeeds.truck, label: "Average Truck Speed (km/h)", isSpeed: true },
  ];

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col items-center py-10">
      <h2 className="text-2xl font-semibold text-gray-700 mb-6">Welcome to STRAM</h2>
      <div className="w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((item) => (
            <div
              key={item.id}
              className="bg-white shadow-md rounded-lg p-6 flex flex-col items-center text-center"
            >
              <CountUp
                start={item.value}
                end={item.value}
                duration={2}
                separator=","
                decimals={item.isSpeed ? 2 : 0}
                className="text-4xl font-bold text-gray-800"
              />
              <p className="text-sm text-gray-500 mt-2">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomePage;