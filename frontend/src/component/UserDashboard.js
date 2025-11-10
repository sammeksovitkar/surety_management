import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { FaPlus, FaSignOutAlt, FaFilter, FaFileExcel, FaHome, FaUserCircle, FaTimesCircle, FaCalendarAlt, FaMoneyBillWave, FaMapMarkerAlt, FaFileContract, FaUserFriends, FaIdCard, FaBuilding } from 'react-icons/fa';
import { MdOutlineSecurity } from 'react-icons/md';

// --- Utility Components ---

// Message Component
const MessageComponent = ({ message, type }) => {
    if (!message) return null;
    const baseClasses = "py-3 px-6 rounded-xl font-semibold text-white mb-4 transition-all duration-300 transform animate-fade-in flex items-center shadow-lg mx-auto max-w-4xl";
    const typeClasses = type === "success" ? "bg-green-600" : "bg-red-600";
    const Icon = type === "success" ? MdOutlineSecurity : FaTimesCircle;
    return (
        <div className={`${baseClasses} ${typeClasses}`}>
            <Icon className="mr-3 text-xl" />
            {message}
        </div>
    );
};

// Form Input Component (COMPACT SPACING)
const FormInput = ({ label, id, name, value, onChange, type = 'text', required = false, error, children, icon: Icon, disabled = false }) => (
    // Vertical margin mb-2 (compact)
    <div className="flex flex-col mb-2">
        <label htmlFor={id} className="text-sm font-medium text-gray-700 flex items-center mb-1">
            {Icon && <Icon className="mr-2 text-indigo-600 text-base" />}
            {label} {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <div className="relative">
            {children ? children : (
                <input
                    type={type}
                    id={id}
                    name={name}
                    value={value}
                    onChange={onChange}
                    required={required}
                    disabled={disabled}
                    // Input padding py-1.5 px-2 (compact)
                    className={`w-full py-1.5 px-2 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-lg transition-all duration-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm text-base ${disabled ? 'bg-gray-200 cursor-not-allowed' : 'bg-white'}`}
                    maxLength={id === 'aadharNo' ? 12 : undefined}
                />
            )}
        </div>
        {error && <p className="text-red-500 text-xs mt-1 italic">{error}</p>}
    </div>
);


const UserDashboard = () => {



    // --- Environment Variables & Constants ---
    const backend_Url = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
    const policeStationsString = process.env.REACT_APP_COURT_STATIONS || "";
    const policeStations = useMemo(() =>
        policeStationsString.split(',').map(station => station.trim()).filter(station => station),
        [policeStationsString]);

    const token = localStorage.getItem('token');
    const config = { headers: { 'x-auth-token': token } };
    const navigate = useNavigate();

    // Constants for Selectors
    const MONTHS = [
        { value: '01', label: 'January' }, { value: '02', label: 'February' },
        { value: '03', label: 'March' }, { value: '04', label: 'April' },
        { value: '05', label: 'May' }, { value: '06', label: 'June' },
        { value: '07', label: 'July' }, { value: '08', label: 'August' },
        { value: '09', label: 'September' }, { value: '10', label: 'October' },
        { value: '11', label: 'November' }, { value: '12', label: 'December' }
    ];

    const YEARS = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const years = [];
        // Generate current year and 4 years back
        for (let i = 0; i < 5; i++) {
            years.push((currentYear - i).toString());
        }
        return years;
    }, []);

    // New: Act Name Options
    const ACT_OPTIONS = ['BNS', 'IPC', 'BNSS', 'MOTOR V', 'NI 138', 'OTHER'];

    // --- State Variables ---
    const [user, setUser] = useState(null);
    const [sureties, setSureties] = useState([]);
    const [formData, setFormData] = useState({
        shurityName: '', address: '', aadharNo: '', policeStation: '', caseFirNo: '',
        actName: '', section: '', accusedName: '', accusedAddress: '',
        shurityAmount: '',
        dateOfSurety: new Date().toISOString().slice(0, 10)
    });

    // UPDATED: Combined search term and added year/month filters
    const [filters, setFilters] = useState({
        searchTerm: '',
        policeStation: '',
        filterYear: '',
        filterMonth: ''
    });

    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [aadharError, setAadharError] = useState('');

    // --- Utility Functions ---
    const showMessage = (text, type) => {
        setMessage(text);
        setMessageType(type);
        setTimeout(() => {
            setMessage('');
            setMessageType('');
        }, 5000);
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/');
    };
    // --- LOGIC FOR POLICE STATION FIELD CONTROL ---
    // 1. Determine the value to pre-fill
    const initialPoliceStationValue = user?.village || '';
    const isPoliceStationDisabled = !!user?.village;
    const policeStationSelectValue = isPoliceStationDisabled ? initialPoliceStationValue : formData.policeStation;
    // --- Data Fetching ---
    const fetchUserData = async () => {
        try {
            const res = await axios.get(backend_Url + '/api/user/me', config);
            setUser(res.data);
        } catch (err) {
            console.error('Failed to fetch user data');
        }
    };

    const fetchSureties = async () => {
        try {
            const res = await axios.get(backend_Url + '/api/user/allsureties', config);
            setSureties(res.data);
        } catch (err) {
            showMessage('Failed to fetch surety records. Please ensure you have the necessary permissions.', 'error');
        }
    };

    useEffect(() => {
        fetchUserData();
        fetchSureties();
    }, []);

    useEffect(() => {
        // 1. Ensure user data has loaded and has a 'village' property
        // 2. Ensure we only update if the current form state doesn't already match the village
        if (user && user.village && formData.policeStation !== user.village) {
            
            // Set the policeStation in formData to the user's village
            // This ensures the value is present in the state when the form is submitted.
            setFormData(prevFormData => ({
                ...prevFormData,
                policeStation: user.village
            }));
        }
    }, [user, formData.policeStation]); // Re-run if 'user' or policeStation state changes

    // --- Form Handlers ---
    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });

        if (name === 'aadharNo') {
            // Aadhar validation: must be exactly 12 digits and numeric
            if (!/^\d*$/.test(value)) {
                setAadharError('Aadhar number must be numbers only.');
            } else if (value.length > 12) {
                setAadharError('Aadhar number cannot exceed 12 digits.');
            } else if (value.length !== 12 && value.length > 0) {
                setAadharError('Aadhar number must be 12 digits.');
            } else {
                setAadharError('');
            }
        }
    };

    const handleSubmitSurety = async (e) => {
        e.preventDefault();

        if (aadharError) {
            showMessage('Please fix the Aadhar number error before submitting.', 'error');
            return;
        }

        try {
            await axios.post(backend_Url + '/api/user/sureties', formData, config);
            showMessage('Surety record created successfully! 🎉', 'success');
            // Reset form and close modal
            setFormData({
                shurityName: '', address: '', aadharNo: '', policeStation: '', caseFirNo: '',
                actName: '', section: '', accusedName: '', accusedAddress: '',
                shurityAmount: '', dateOfSurety: new Date().toISOString().slice(0, 10)
            });
            setShowModal(false);
            fetchSureties();
        } catch (err) {
            showMessage(err.response?.data?.msg || 'Failed to create surety record', 'error');
        }
    };

    // --- Filtering Logic (Memoized for Performance) ---
    const filteredSureties = useMemo(() => {
        // Helper to get year/month from date string
        const getYearMonth = (dateString) => {
            if (!dateString) return { year: null, month: null };
            const date = new Date(dateString);
            return {
                year: date.getFullYear().toString(),
                // Month is 1-indexed for filtering ease (padStart for '01', '02', etc.)
                month: (date.getMonth() + 1).toString().padStart(2, '0')
            };
        };

        return sureties.filter((s) => {
            const lowerSearchTerm = filters.searchTerm.toLowerCase();

            // Combined search check: Surety Name, Aadhar No., or Case/FIR No.
            const searchMatch = !lowerSearchTerm || (
                s.shurityName.toLowerCase().includes(lowerSearchTerm) ||
                s.aadharNo.includes(lowerSearchTerm) ||
                s.caseFirNo.toLowerCase().includes(lowerSearchTerm)
            );

            const policeStationMatch = !filters.policeStation || s.policeStation === filters.policeStation;

            // Date checks
            const dateParts = getYearMonth(s.dateOfSurety);
            const yearMatch = !filters.filterYear || dateParts.year === filters.filterYear;
            const monthMatch = !filters.filterMonth || dateParts.month === filters.filterMonth;

            return searchMatch && policeStationMatch && yearMatch && monthMatch;
        });
    }, [sureties, filters]);

    // --- Export Logic ---
    const exportToExcel = () => {
        const excelHeaders = [
            "Surety Name", "Address", "Aadhar No.", "Police Station", "Case/FIR No.",
            "Act Name", "Section", "Accused Name", "Accused Address",
            "Surety Amount", "Date of Surety", "Court City", "Assigned To"
        ];
        const dataForExcel = filteredSureties.map(surety => [
            surety.shurityName,
            surety.address,
            surety.aadharNo,
            surety.policeStation,
            surety.caseFirNo,
            surety.actName,
            surety.section,
            surety.accusedName,
            surety.accusedAddress,
            surety.shurityAmount,
            surety.dateOfSurety ? new Date(surety.dateOfSurety).toLocaleDateString('en-IN') : '',
            surety.courtCity || '',
            surety.assignedToUser?.fullName || surety.assignedToUser || ''
        ]);
        const finalData = [excelHeaders, ...dataForExcel];
        const ws = XLSX.utils.aoa_to_sheet(finalData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Surety List");
        const fileName = "Surety_List_" + new Date().toISOString().slice(0, 10) + ".xlsx";
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const dataBlob = new Blob([excelBuffer], { type: 'application/octet-stream' });
        saveAs(dataBlob, fileName);
    };

    // --- Render ---
    return (
        <div className="flex min-h-screen bg-gray-100 font-sans text-gray-800">
            {/* Sidebar */}
            <div
                className="w-56 hidden lg:flex bg-white border-r border-gray-200 p-6 flex-col shadow-2xl max-h-screen sticky top-0"
            >
                <div className="flex items-center mb-10 py-2">
                    <MdOutlineSecurity className="text-4xl text-indigo-700 mr-2" />
                    <h1 className="text-2xl font-extrabold text-indigo-800">SuretyApp</h1>
                </div>

                <div className="flex items-center p-4 bg-indigo-50 rounded-xl mb-8 border border-indigo-100 shadow-inner">
                    <FaUserCircle className="text-4xl text-indigo-600 mr-3" />
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-xs text-indigo-500">Logged in as</span>
                        <span className="font-bold text-base text-indigo-800 truncate">{user?.fullName || 'Court User'}</span>
                        <span className="font-bold text-base text-indigo-800 truncate">{user?.village || 'Court User'}</span>

                    </div>
                </div>

                <nav className="flex-1 space-y-2 overflow-y-auto">
                    <a href="#" className="flex items-center p-3 rounded-xl text-white bg-indigo-600 font-bold shadow-lg shadow-indigo-500/50 transition-colors duration-200 text-base">
                        <FaHome className="mr-3 text-xl" />
                        Dashboard
                    </a>
                </nav>

                <div className="mt-auto pt-6 border-t border-gray-200">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center p-3 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors duration-300 shadow-xl text-base"
                    >
                        <FaSignOutAlt className="mr-2" /> Logout
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-4 sm:p-8 lg:p-10">

                {/* Header and Buttons */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-gray-300">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900">Surety Records</h1>
                        <p className="text-gray-500 mt-1 text-sm">View and manage all bail/surety records for your jurisdiction.</p>
                    </div>

                    <div className="flex space-x-4 mt-4 md:mt-0">
                        <button
                            onClick={() => setShowModal(true)}
                            className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold flex items-center hover:bg-indigo-700 transition-all duration-300 shadow-xl shadow-indigo-400/50 text-base"
                        >
                            <FaPlus className="mr-2" /> Add New Record
                        </button>
                        <button
                            onClick={exportToExcel}
                            className="px-6 py-3 rounded-xl bg-green-600 text-white font-bold flex items-center hover:bg-green-700 transition-all duration-300 shadow-xl shadow-green-400/50 text-base"
                        >
                            <FaFileExcel className="mr-2" /> Export
                        </button>
                    </div>
                </header>

                <MessageComponent message={message} type={messageType} />

                {/* Filters (UPDATED FOR COMBINED SEARCH AND DATE) */}
                <div className="bg-white p-5 rounded-2xl shadow-xl mb-6 border border-gray-200">
                    <h3 className="text-lg font-bold mb-3 flex items-center text-indigo-700"><FaFilter className="mr-2 text-xl" /> Filter Records</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                        {/* 1. Combined Search Term Filter */}
                        <FormInput
                            label="Search (Name, Aadhar, or FIR No.)"
                            id="filterSearchTerm"
                            value={filters.searchTerm}
                            onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                        />

                        {/* 2. Police Station Filter */}
                        {/* <FormInput label="Police Station" id="filterPS">
                            <select
                                value={filters.policeStation}
                                onChange={(e) => setFilters({ ...filters, policeStation: e.target.value })}
                                className="w-full py-1.5 px-2 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-inner appearance-none bg-white pr-10"
                            >
                                <option value="">All Stations</option>
                                {policeStations.map((station) => (
                                    <option key={station} value={station}>{station}</option>
                                ))}
                            </select>
                        </FormInput> */}

                        {/* 3. Year Filter */}
                        <FormInput label="Surety Year" id="filterYear">
                            <select
                                value={filters.filterYear}
                                onChange={(e) => setFilters({ ...filters, filterYear: e.target.value })}
                                className="w-full py-1.5 px-2 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-inner appearance-none bg-white pr-10"
                            >
                                <option value="">All Years</option>
                                {YEARS.map((year) => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </FormInput>

                        {/* 4. Month Filter */}
                        <FormInput label="Surety Month" id="filterMonth">
                            <select
                                value={filters.filterMonth}
                                onChange={(e) => setFilters({ ...filters, filterMonth: e.target.value })}
                                className="w-full py-1.5 px-2 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-inner appearance-none bg-white pr-10"
                            >
                                <option value="">All Months</option>
                                {MONTHS.map((month) => (
                                    <option key={month.value} value={month.value}>{month.label}</option>
                                ))}
                            </select>
                        </FormInput>
                    </div>
                </div>

                {/* Table Container */}
                <div className="bg-white rounded-2xl shadow-2xl border border-gray-200">
                    <div
                        className="overflow-x-auto overflow-y-auto rounded-2xl"
                        style={{ maxHeight: "calc(100vh - 350px)" }}
                    >
                        <table className="min-w-full divide-y divide-gray-200 table-auto">
                            {/* Sticky Table Header */}
                            <thead className="bg-indigo-100 sticky top-0 z-10 shadow-md">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-extrabold text-indigo-800 uppercase tracking-wider">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-extrabold text-indigo-800 uppercase tracking-wider">Surety Name</th>
                                    <th className="px-4 py-3 text-left text-xs font-extrabold text-indigo-800 uppercase tracking-wider">Aadhar No.</th>
                                    <th className="px-4 py-3 text-left text-xs font-extrabold text-indigo-800 uppercase tracking-wider">P.S.</th>
                                    <th className="px-4 py-3 text-left text-xs font-extrabold text-indigo-800 uppercase tracking-wider">FIR No.</th>
                                    <th className="px-4 py-3 text-left text-xs font-extrabold text-indigo-800 uppercase tracking-wider">Amount</th>
                                    <th className="px-4 py-3 text-left text-xs font-extrabold text-indigo-800 uppercase tracking-wider">Accused Name</th>
                                    <th className="px-4 py-3 text-left text-xs font-extrabold text-indigo-800 uppercase tracking-wider">Act/Section</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {filteredSureties.map(surety => (
                                    <tr key={surety._id} className="hover:bg-indigo-50 transition-colors duration-200">
                                        <td className="px-4 py-3 text-sm font-medium text-gray-700">{surety.dateOfSurety ? new Date(surety.dateOfSurety).toLocaleDateString('en-IN') : 'N/A'}</td>
                                        <td className="px-4 py-3 text-sm text-gray-800 truncate max-w-[150px]">{surety.shurityName}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600 font-mono">{surety.aadharNo}</td>
                                        <td className="px-4 py-3 text-sm text-gray-800 truncate max-w-[100px]">{surety.policeStation}</td>
                                        <td className="px-4 py-3 text-sm text-gray-800">{surety.caseFirNo}</td>
                                        <td className="px-4 py-3 text-sm text-green-700 font-bold">₹{surety.shurityAmount}</td>
                                        <td className="px-4 py-3 text-sm text-gray-800 truncate max-w-[150px]">{surety.accusedName}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{`${surety.actName} / ${surety.section}`}</td>
                                    </tr>
                                ))}
                                {filteredSureties.length === 0 && (
                                    <tr>
                                        <td colSpan="8" className="text-center py-8 text-lg font-medium text-gray-500">
                                            No surety records found matching the current filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>


                {/* MODAL POPUP (WIDER, TWO-COLUMN COMPACT DESIGN) */}
                {showModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white p-6 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col">

                            {/* Modal Header & Close Button */}
                            <div className="flex justify-between items-start mb-3 border-b pb-3">
                                <h2 className="text-2xl font-extrabold text-indigo-700 flex items-center pt-1">
                                    <FaPlus className="mr-3 text-xl" /> Create New Surety Record
                                </h2>
                                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-600 transition-colors text-3xl p-1 ml-2">
                                    <FaTimesCircle />
                                </button>
                            </div>

                            {/* Form Body - Scrollable Area */}
                            <div className="flex-1 overflow-y-auto pr-2">
                                <form id="suretyForm" onSubmit={handleSubmitSurety} className="pb-4 space-y-4">

                                    {/* SECTION 1: SURETY DETAILS */}
                                    <div className="bg-indigo-50 p-4 rounded-xl shadow-inner border border-indigo-200">
                                        <h3 className="text-xl font-bold text-indigo-800 mb-3 border-b border-indigo-300 pb-2 flex items-center">
                                            <FaUserCircle className="mr-2" /> Surety/Bailor Information
                                        </h3>

                                        {/* Row 1: Name and Aadhar - 2 columns */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                                            <FormInput label="Surety Name" id="shurityName" name="shurityName" value={formData.shurityName} onChange={handleFormChange} required icon={FaUserCircle} />
                                            <FormInput
                                                label="Aadhar No. (12 digits)"
                                                id="aadharNo"
                                                name="aadharNo"
                                                value={formData.aadharNo}
                                                onChange={handleFormChange}
                                                required
                                                type="number"
                                                error={aadharError}
                                                icon={FaIdCard}
                                            />
                                        </div>

                                        {/* Row 2: Address - Full width */}
                                        <FormInput label="Address" id="address" name="address" value={formData.address} onChange={handleFormChange} required icon={FaMapMarkerAlt} />

                                        {/* Row 3: Police Station, Amount, Date - 2 columns (using nested grid for 3 inputs) */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                                            {/* Group 1: Police Station & Surety Amount (nested grid) */}
                                            <div className='grid grid-cols-1 md:grid-cols-2 gap-x-6'>
                                                {/* <FormInput label="Police Station" id="policeStation" name="policeStation" value={formData.policeStation} onChange={handleFormChange} required icon={FaBuilding}>
                                                    <select id="policeStation" name="policeStation" value={formData.policeStation} onChange={handleFormChange} required 
                                                        className="w-full py-1.5 px-2 border border-gray-300 rounded-lg transition-all duration-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm text-base appearance-none bg-white">
                                                        <option value="">Select Police Station</option>
                                                        {policeStations.map((station) => <option key={station} value={station}>{station}</option>)}
                                                    </select>
                                                </FormInput> */}
                                               
                                                    <FormInput label="Police Station" id="policeStation" name="policeStation"
                                                        value={policeStationSelectValue} // Use the calculated value for rendering
                                                        onChange={handleFormChange} required icon={FaBuilding}>

                                                        <select
                                                            id="policeStation"
                                                            name="policeStation"
                                                            value={policeStationSelectValue}
                                                            onChange={handleFormChange}
                                                            required
                                                            // APPLY THE LOGIC HERE
                                                            disabled={isPoliceStationDisabled}
                                                            className="w-full py-1.5 px-2 border border-gray-300 rounded-lg transition-all duration-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm text-base appearance-none bg-white">
                                                       
                                                            {!isPoliceStationDisabled && <option value="">Select Police Station</option>}
                                                        
                                                            {isPoliceStationDisabled && <option value={initialPoliceStationValue}>{initialPoliceStationValue}</option>}
                                                            {policeStations.map((station) => <option key={station} value={station}>{station}</option>)}

                                                        </select>
                                                    </FormInput>


                                                <FormInput
                                                    label="Surety Amount (₹)"
                                                    id="shurityAmount"
                                                    name="shurityAmount"
                                                    value={formData.shurityAmount}
                                                    onChange={handleFormChange}
                                                    required
                                                    type="number"
                                                    icon={FaMoneyBillWave}
                                                />
                                            </div>

                                            {/* Group 2: Date */}
                                            <FormInput
                                                label="Date of Surety"
                                                id="dateOfSurety"
                                                name="dateOfSurety"
                                                value={formData.dateOfSurety}
                                                onChange={handleFormChange}
                                                required
                                                type="date"
                                                icon={FaCalendarAlt}
                                            />
                                        </div>
                                    </div>

                                    {/* SECTION 2: CASE DETAILS */}
                                    <div className="bg-gray-50 p-4 rounded-xl shadow-inner border border-gray-200">
                                        <h3 className="text-xl font-bold text-gray-700 mb-3 border-b border-gray-300 pb-2 flex items-center">
                                            <FaFileContract className="mr-2" /> Case & Accused Information
                                        </h3>

                                        {/* Row 4: FIR, Act, Section - 2 columns (using nested grid for 3 inputs) */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                                            {/* Group 1: FIR No. and Act Name (nested grid) */}
                                            <div className='grid grid-cols-1 md:grid-cols-2 gap-x-6'>
                                                <FormInput label="Case/FIR No." id="caseFirNo" name="caseFirNo" value={formData.caseFirNo} onChange={handleFormChange} required icon={FaFileContract} />

                                                {/* Act Name - UPDATED TO USE DATALIST FOR SELECTION + MANUAL ENTRY */}
                                                <FormInput label="Act Name" id="actName" name="actName" value={formData.actName} onChange={handleFormChange} required icon={FaFileContract}>
                                                    <input
                                                        type="text"
                                                        id="actName"
                                                        name="actName"
                                                        value={formData.actName}
                                                        onChange={handleFormChange}
                                                        required
                                                        list="actNameOptions"
                                                        className="w-full py-1.5 px-2 border border-gray-300 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm text-base bg-white"
                                                    />
                                                    <datalist id="actNameOptions">
                                                        {ACT_OPTIONS.map((act) => (
                                                            <option key={act} value={act} />
                                                        ))}
                                                    </datalist>
                                                </FormInput>
                                            </div>

                                            {/* Group 2: Section */}
                                            <FormInput label="Section" id="section" name="section" value={formData.section} onChange={handleFormChange} required icon={FaFileContract} />
                                        </div>

                                        {/* Row 5: Accused Name and Address - 2 columns */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                                            <FormInput label="Accused Name" id="accusedName" name="accusedName" value={formData.accusedName} onChange={handleFormChange} required icon={FaUserFriends} />
                                            <FormInput label="Accused Address" id="accusedAddress" name="accusedAddress" value={formData.accusedAddress} onChange={handleFormChange} required icon={FaMapMarkerAlt} />
                                        </div>
                                    </div>

                                </form>
                            </div>

                            {/* Sticky Modal Footer for Actions */}
                            <div className="sticky bottom-0 bg-white pt-4 mt-2 border-t border-gray-200 flex justify-end space-x-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-3 bg-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-400 transition-colors shadow-md text-base"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    form="suretyForm"
                                    disabled={!!aadharError}
                                    className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors shadow-xl shadow-green-400/70 text-base disabled:bg-green-400 disabled:shadow-none"
                                >
                                    Submit Record
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserDashboard;
