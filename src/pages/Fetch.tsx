import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface VehicleData {
    id: string;
    object_type: string;
    median_speed: string;
    timestamp: string;
    vehicle_status: string;
}

const PAGE_SIZE = 5; // Number of rows per page

const Fetch: React.FC = () => {
    const [vehicleData, setVehicleData] = useState<VehicleData[]>([]);
    const [page, setPage] = useState<number>(0); // Track current page
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const fetchVehicleData = async (page: number) => {
        try {
            setLoading(true);
            const response = await axios.get(`http://localhost:5000/fetch?offset=${page * PAGE_SIZE}&limit=${PAGE_SIZE}`);
            setVehicleData((prevData) => [...prevData, ...response.data.data]);
        } catch (error) {
            console.error('Error fetching vehicle data:', error);
            setError('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVehicleData(page);
    }, [page]);

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-3xl font-bold mb-6 text-center">Vehicle Data</h1>
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-300">
                    <thead>
                        <tr className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
                            <th className="py-3 px-6 text-left">ID</th>
                            <th className="py-3 px-6 text-left">Object Type</th>
                            <th className="py-3 px-6 text-left">Median Speed</th>
                            <th className="py-3 px-6 text-left">Timestamp</th>
                            <th className="py-3 px-6 text-left">Vehicle Status</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-600 text-sm font-light">
                        {vehicleData.map((vehicle) => (
                            <tr key={vehicle.id} className="border-b border-gray-200 hover:bg-gray-100">
                                <td className="py-3 px-6 text-left whitespace-nowrap">{vehicle.id}</td>
                                <td className="py-3 px-6 text-left">{vehicle.object_type}</td>
                                <td className="py-3 px-6 text-left">{vehicle.median_speed}</td>
                                <td className="py-3 px-6 text-left">{vehicle.timestamp}</td>
                                <td className="py-3 px-6 text-left">{vehicle.vehicle_status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

            {/* Load More Button */}
            {!loading && (
                <button 
                    onClick={() => setPage((prevPage) => prevPage + 1)}
                    className="w-full text-white bg-[#016299] hover:bg-[#015581] focus:ring-4 focus:outline-none font-regular rounded-lg text-sm my-3 px-5 py-2.5 text-center">
                    Load More
                </button>
            )}

            {loading && <div>Loading...</div>}
            {error && <div>{error}</div>}
            </div>
        </div>
    );
};

export default Fetch;
