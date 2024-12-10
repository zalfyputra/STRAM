import {
    BarElement,
    CategoryScale,
    ChartData,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip,
  } from "chart.js";
  import Plot from "react-plotly.js";
  import { onValue, ref } from "firebase/database";
  import React, { useEffect, useState } from "react";
  import { Bar, Line, Scatter } from "react-chartjs-2";
  import { database } from "../firebase";
  
  ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
  );
  
  type FirebaseEntry = {
    id: string;
    object_type: string;
    vehicle_direction: string;
    median_speed: number;
    timestamp: string;
  };
  
  const Stats: React.FC = () => {
    const [data, setData] = useState<FirebaseEntry[]>([]);
  
    useEffect(() => {
      const logsRef = ref(database, "/data");
      const unsubscribe = onValue(logsRef, (snapshot) => {
        const fetchedData = snapshot.val();
  
        console.log("Raw data fetched from Firebase:", fetchedData);
  
        if (fetchedData) {
          const formattedData: FirebaseEntry[] = Object.keys(fetchedData).map((key) => {
            const entry = fetchedData[key];
            if (Array.isArray(entry)) {
              // Handle array format
              return {
                object_type: entry[0],
                id: entry[1].toString(),
                median_speed: entry[2],
                timestamp: entry[3],
                vehicle_direction: entry[4],
              } as FirebaseEntry;
            } else if (typeof entry === "object") {
              // Handle object format
              return entry as FirebaseEntry;
            } else {
              console.warn("Invalid data format detected:", entry);
              return null;
            }
          }).filter((entry): entry is FirebaseEntry => entry !== null);
  
          console.log("Formatted data:", formattedData);
          setData(formattedData);
        } else {
          console.warn("No data found in Firebase or data is undefined.");
        }
      });
  
      return () => unsubscribe();
    }, []);
  
    if (!data.length) {
      console.log("No data available yet. Loading...");
      return <p>Loading...</p>;
    }
  
    // Preprocess data
    const groupedByTime = data.reduce<Record<string, FirebaseEntry[]>>((acc, entry) => {
      if (!entry || !entry.timestamp) {
        console.warn("Invalid entry detected:", entry);
        return acc;
      }
      const time = entry.timestamp.slice(0, 16);
      if (!acc[time]) acc[time] = [];
      acc[time].push(entry);
      return acc;
    }, {});
  
    console.log("Grouped data by time intervals:", groupedByTime);
  
    const timeIntervals = Object.keys(groupedByTime);
    console.log("Time intervals:", timeIntervals);
  
    // Scatter plot: Average Speed per ID
    const avgSpeedData = data.reduce<Record<string, { count: number; speedSum: number }>>(
      (acc, entry) => {
        if (!acc[entry.id]) acc[entry.id] = { count: 0, speedSum: 0 };
        acc[entry.id].speedSum += entry.median_speed;
        acc[entry.id].count++;
        return acc;
      },
      {}
    );
  
    const scatterData = {
      datasets: [
        {
          label: "Speed",
          data: Object.keys(avgSpeedData).map((id) => ({
            x: id,
            y: avgSpeedData[id].speedSum / avgSpeedData[id].count || 0,
          })),
          backgroundColor: "blue",
        },
      ],
    };
  
    const filteredData = data.filter(
      (entry, index, self) =>
        index === self.findIndex((e) => e.object_type === entry.object_type && e.id === entry.id)
    );
  
    console.log("Data after removing duplicates:", filteredData);
  
    // Line chart: Object Type Counts per Minute
    const objectTypeCounts = timeIntervals.map((interval) => {
      const entries = groupedByTime[interval];
      return entries.reduce<Record<string, number>>((acc, entry) => {
        acc[entry.object_type] = (acc[entry.object_type] || 0) + 1;
        return acc;
      }, {});
    });
  
    const objectTypeChartData = {
      labels: timeIntervals,
      datasets: Object.keys(objectTypeCounts[0] || {}).map((type, index) => ({
        label: type,
        data: objectTypeCounts.map((count) => count[type] || 0),
        borderColor: `hsl(${index * 60}, 70%, 50%)`,
        fill: false,
      })),
    };
  
    // Line chart: Alarms (Unusual Speeds)
    const alarmsData = data
      .filter((entry) => entry.median_speed > 100)
      .reduce<Record<string, Record<string, number>>>((acc, entry) => {
        const time = entry.timestamp.slice(0, 16);
        if (!acc[time]) acc[time] = {};
        acc[time][entry.object_type] = (acc[time][entry.object_type] || 0) + 1;
        return acc;
      }, {});
  
    const alarmsChartData = {
      labels: timeIntervals,
      datasets: Object.keys(alarmsData[timeIntervals[0]] || {}).map((type, index) => ({
        label: type,
        data: timeIntervals.map((time) => alarmsData[time]?.[type] || 0),
        borderColor: `hsl(${index * 90}, 70%, 50%)`,
        fill: false,
      })),
    };
  
    // Bar chart: Total Object Type Counts
    const totalObjectTypeCounts = data.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.object_type] = (acc[entry.object_type] || 0) + 1;
      return acc;
    }, {});
  
    const barChartData = {
      labels: Object.keys(totalObjectTypeCounts),
      datasets: [
        {
          label: "Object Type Counts",
          data: Object.values(totalObjectTypeCounts),
          backgroundColor: Object.keys(totalObjectTypeCounts).map(
            (_, index) => `hsl(${index * 50}, 70%, 50%)`
          ),
        },
      ],
    };
  
    // Line chart: Peak Times
    const peakTimeData = timeIntervals.map(
      (interval) => groupedByTime[interval].length
    );
  
    const peakTimeChartData = {
      labels: timeIntervals,
      datasets: [
        {
          label: "Vehicle Count",
          data: peakTimeData,
          borderColor: "orange",
          fill: false,
        },
      ],
    };
  
    // Bar chart: Average Speed per Object Type
    const avgSpeedByType = data.reduce<Record<string, { count: number; speedSum: number }>>(
      (acc, entry) => {
        if (!acc[entry.object_type]) acc[entry.object_type] = { count: 0, speedSum: 0 };
        acc[entry.object_type].speedSum += entry.median_speed;
        acc[entry.object_type].count++;
        return acc;
      },
      {}
    );
  
    const avgSpeedBarData = {
      labels: Object.keys(avgSpeedByType),
      datasets: [
        {
          label: "Average Speed",
          data: Object.keys(avgSpeedByType).map(
            (type) => avgSpeedByType[type].speedSum / avgSpeedByType[type].count
          ),
          backgroundColor: Object.keys(avgSpeedByType).map(
            (_, index) => `hsl(${index * 70}, 60%, 50%)`
          ),
        },
      ],
    };
  
    // Preprocess data for speed distribution
    const speedData = data.map((entry) => entry.median_speed);
    const maxSpeed = 100; // Set maximum speed limit to 100 km/h
    const binCount = 10; // Number of bins
    const binWidth = Math.ceil(maxSpeed / binCount); // Calculate bin width
  
    // Calculate histogram bins
    const histogramBins = Array(binCount).fill(0);
    speedData.forEach((speed) => {
      if (speed >= 0 && speed <= maxSpeed) { // Ensure speed is within the valid range
        const binIndex = Math.min(Math.floor(speed / binWidth), binCount - 1);
        histogramBins[binIndex]++;
      }
    });
  
    // Generate bin labels
    const binLabels = Array.from({ length: binCount }, (_, index) => {
      const lower = index * binWidth;
      const upper = lower + binWidth;
      return `${lower}-${upper} km/h`;
    });
  
    // Format data for Chart.js
    const histogramData: ChartData<"bar"> = {
      labels: binLabels,
      datasets: [
        {
          label: "Speed Distribution",
          data: histogramBins,
          backgroundColor: "purple",
        },
      ],
    };
  
    // Generate object types dynamically
    const objectTypes = Array.from(
      new Set(data.map((entry) => entry.object_type))
    );
    console.log("Object types:", objectTypes);
  
    // Preprocess data for the heatmap
    const groupedHeatmap = data.reduce<Record<string, FirebaseEntry[]>>((acc, entry) => {
      const time = entry.timestamp.slice(0, 16);
      if (!acc[time]) acc[time] = [];
      acc[time].push(entry);
      return acc;
    }, {});
  
    const timeInter = Object.keys(groupedHeatmap);
    const objTypes = Array.from(new Set(data.map((entry) => entry.object_type)));
  
    const heatmapDataGrid = timeInter.map((time) =>
      objectTypes.map(
        (type) =>
          groupedHeatmap[time]?.filter((entry) => entry.object_type === type).length || 0
      )
    );
  
    return (
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow-md rounded-lg p-4" style={{ height: '300px' }}>
          <Scatter data={scatterData} options={{ plugins: { title: { display: true, text: "Average Speed per ID" } } }} />
        </div>
        <div className="bg-white shadow-md rounded-lg p-4" style={{ height: '300px' }}>
          <Line data={objectTypeChartData} options={{ plugins: { title: { display: true, text: "Object Type Counts per Minute" } } }} />
        </div>
        <div className="bg-white shadow-md rounded-lg p-4" style={{ height: '300px' }}>
          <Line data={alarmsChartData} options={{ plugins: { title: { display: true, text: "Alarms (Unusual Speed)" } } }} />
        </div>
        <div className="bg-white shadow-md rounded-lg p-4" style={{ height: '300px' }}>
          <Bar data={barChartData} options={{ plugins: { title: { display: true, text: "Total Object Type Counts" } } }} />
        </div>
        <div className="bg-white shadow-md rounded-lg p-4" style={{ height: '300px' }}>
          <Line data={peakTimeChartData} options={{ plugins: { title: { display: true, text: "Peak Times" } } }} />
        </div>
        <div className="bg-white shadow-md rounded-lg p-4" style={{ height: '300px' }}>
          <Bar data={avgSpeedBarData} options={{ plugins: { title: { display: true, text: "Average Speed by Object Type" } } }} />
        </div>
        <div className="bg-white shadow-md rounded-lg p-4" style={{ height: '300px' }}>
          <Bar data={histogramData} options={{ plugins: { title: { display: true, text: "Speed Distribution" } }}} />
        </div>
        <div className="bg-white shadow-md rounded-lg p-4" style={{ height: '300px', overflow: 'hidden' }}>
          <Plot
            data={[
              {
                z: heatmapDataGrid,
                x: objectTypes,
                y: timeIntervals,
                type: "heatmap",
                colorscale: [
                  [0, "rgb(240, 248, 255)"], // Biru muda
                  [0.5, "rgb(135, 206, 250)"], // Biru sedang
                  [1, "rgb(0, 0, 139)"], // Biru tua
                ],
                showscale: true,
              },
            ]}
            layout={{
              title: "Heatmap Vehicle Arrival",
              xaxis: { title: "Vehicle Types", automargin: true },
              yaxis: { title: "Time Intervals", automargin: true },
              margin: { l: 50, r: 20, t: 50, b: 50 },
            }}
            style={{ width: '100%', height: '100%' }}
            config={{ responsive: true }}
          />
        </div>
      </div>
    );  
  };
  
  export default Stats;
  