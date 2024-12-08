import React, { useEffect, useState } from "react";
import { database } from "../firebase";
import { ref, onValue, DataSnapshot } from "firebase/database";

type LogData = {
    key: string;
    id: string;
    object_type: string;
    vehicle_status: string;
    median_speed: number;
    timestamp: string;
};

const PAGE_SIZE = 20;

const Logs: React.FC = () => {
  const [logs, setLogs] = useState<LogData[]>([]);
  const [visibleCount, setVisibleCount] = useState(20);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);

  const OFFLINE_TIMEOUT = 10000; // 10 seconds timeout
  let offlineTimer: NodeJS.Timeout;

  useEffect(() => {
    const logsRef = ref(database, "data");
    const unsubscribe = onValue(logsRef, (snapshot) => {
      const data = snapshot.val();

      // Clear offline timeout since we received data
      clearTimeout(offlineTimer);
      setIsOnline(true);

      if (data) {
        const formattedLogs: LogData[] = Object.keys(data).map((key) => ({
          key: key,
          id: data[key][1],
          object_type: data[key][0],
          median_speed: data[key][2],
          timestamp: data[key][3],
          vehicle_status: data[key][4],
        }));
        setLogs(formattedLogs.reverse());
      }
        // Start offline timeout to check if updates stop
        offlineTimer = setTimeout(() => {
            setIsOnline(false); // Set to offline if no updates are received within the timeout
        }, OFFLINE_TIMEOUT);
    });

    // Cleanup listener
    return () => {
        unsubscribe();
        clearTimeout(offlineTimer); // Clear timeout on component unmount
    };
  }, []);

    // Function to load more entries
    const handleLoadMore = () => {
        setVisibleCount((prevCount) => prevCount + 20);
    };

    return (
        <div className="container mx-auto p-6">
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-300">
                    <thead>
                        <tr className="bg-gray-200 text-gray-600 text-sm leading-normal">
                            <th className="py-3 px-6 text-left">ID</th>
                            <th className="py-3 px-6 text-left">Object Type</th>
                            <th className="py-3 px-6 text-left">Median Speed (km/h)</th>
                            <th className="py-3 px-6 text-left">Timestamp</th>
                            <th className="py-3 px-6 text-left">Vehicle Direction</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-600 text-sm font-light">
                        {logs.slice(0, visibleCount).map((item) => (
                            <tr key={item.key} className="border-b border-gray-200 hover:bg-gray-100">
                                <td className="py-3 px-6 text-left">{item.id}</td>
                                <td className="py-3 px-6 text-left">{item.object_type}</td>
                                <td className="py-3 px-6 text-left">{item.median_speed}</td>
                                <td className="py-3 px-6 text-left">{item.timestamp}</td>
                                <td className="py-3 px-6 text-left">{item.vehicle_status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

            {visibleCount < logs.length && (
                <button 
                    onClick={handleLoadMore}
                    className="w-full text-white bg-[#016299] hover:bg-[#015581] focus:ring-4 focus:outline-none font-regular rounded-lg text-sm my-3 px-5 py-2.5 text-center font-medium">
                    Load More
                </button>
            )}
            </div>
        </div>
    );
};

export default Logs;
