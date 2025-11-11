import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'; // <-- ADDED useCallback
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import axios from 'axios';
import { FaUsers, FaClipboardList, FaFileExcel, FaSignOutAlt, FaEdit, FaTrash, FaFilter, FaTimes, FaPlus, FaFileImport, FaHome, FaUserCircle, FaUser, FaClipboard, FaCalendarAlt, FaBuilding } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import 'react-toastify/dist/ReactToastify.css';

// --- Constants for Filters (Moved outside the component for memoization) ---
const MONTHS = [
    { value: '01', label: 'January' }, { value: '02', label: 'February' }, 
    { value: '03', label: 'March' }, { value: '04', label: 'April' },
    { value: '05', label: 'May' }, { value: '06', label: 'June' }, 
    { value: '07', label: 'July' }, { value: '08', label: 'August' },
    { value: '09', label: 'September' }, { value: '10', label: 'October' }, 
    { value: '11', label: 'November' }, { value: '12', label: 'December' }
];

const getYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    // Generate current year and 4 years back
    for (let i = 0; i < 5; i++) { 
        years.push((currentYear - i).toString());
    }
    return years;
};
const YEARS = getYears();
// --- End of Constants ---


// --- Form Input Component (Reused/Defined for consistent styling) ---
const FormInput = ({ label, id, name, value, onChange, type = 'text', required = false, error, children, icon: Icon, disabled = false }) => (
    <div className="flex flex-col"> 
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
                    className={`w-full p-3 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-lg transition-all duration-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm text-base ${disabled ? 'bg-gray-200 cursor-not-allowed' : 'bg-white'}`}
                    maxLength={id === 'aadharNo' ? 12 : undefined}
                />
            )}
        </div>
        {error && <p className="text-red-500 text-xs mt-1 italic">{error}</p>}
    </div>
);
// --- End of Form Input Component ---


const AdminDashboard = ({ setRole }) => {
    
    // --- Existing State ---
    const [view, setView] = useState('users');
    const [users, setUsers] = useState([]);
    const [sureties, setSureties] = useState([]);
    const [filter, setFilter] = useState(''); // Text search filter
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentRecord, setCurrentRecord] = useState(null);
    const [modalType, setModalType] = useState('user');
    const [isEditing, setIsEditing] = useState(false);
    const [loadingType, setLoadingType] = useState(null);
    const [adminUser, setAdminUser] = useState(null);

    // --- NEW Filter State ---
    const [suretyFilters, setSuretyFilters] = useState({ 
        policeStation: '', 
        filterYear: '', 
        filterMonth: '' 
    });

    // --- Environment & Refs ---
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const backend_Url = process.env.REACT_APP_BACKEND_URL

    const userFileInputRef = useRef(null);
    const suretyFileInputRef = useRef(null);
    const rawStations = process.env.REACT_APP_COURT_STATIONS || '';
    const policeStations = rawStations
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    const config = {
        headers: { 'x-auth-token': token },
    };
    // --- End Environment & Refs ---


    // ---------------------------------------------------------------------
    // 🌟 FIX: Wrap fetching functions in useCallback for stability 🌟
    // ---------------------------------------------------------------------
    const fetchUsers = useCallback(async () => {
        try {
            const response = await axios.get(backend_Url + '/api/admin/users', config);
            setUsers(response.data);
        } catch (error) {
            toast.error(error.response?.data?.msg || 'Failed to fetch users.');
        }
    }, [backend_Url, token]); // Dependencies: URL and token (used in config)

    const fetchSureties = useCallback(async () => {
        try {
            const response = await axios.get(backend_Url + '/api/admin/sureties', config);
            setSureties(response.data);
        } catch (error) {
            toast.error(error.response?.data?.msg || 'Failed to fetch sureties.');
        }
    }, [backend_Url, token]); // Dependencies: URL and token (used in config)

    // Note: If you have a fetchAdminData function, it also needs to be wrapped.

    // ---------------------------------------------------------------------
    // 🌟 FIX: Update useEffect dependencies 🌟
    // Now that fetchUsers and fetchSureties are stable, we can safely use them.
    // ---------------------------------------------------------------------
    useEffect(() => {
        if (view === 'users') {
            fetchUsers();
            // Reset surety filters when switching view
            setSuretyFilters({ policeStation: '', filterYear: '', filterMonth: '' }); 
        } else if (view === 'sureties') {
            fetchSureties();
        }
    }, [view, fetchUsers, fetchSureties]); // <-- ADDED fetchUsers, fetchSureties

    const handleLogout = () => {
        localStorage.clear();
        localStorage.removeItem('role');
        navigate('/');
        toast.info('Logged out successfully!');
    };
    // ... (End of unchanged functions) ...


    const handleCreate = (type) => {
        setModalType(type);
        setIsEditing(false);
        if (type === 'user') {
            setCurrentRecord({
                fullName: '', dob: '', mobileNo: '', village: '', emailId: '',
            });
        } else {
            setCurrentRecord({
                shurityName: '', address: '', aadharNo: '', policeStation: '', caseFirNo: '',
                actName: '', section: '', accusedName: '', accusedAddress: '',
                shurityAmount: '', dateOfSurety: new Date().toISOString().slice(0, 10), // Set default date for new records
            });
        }
        setIsModalOpen(true);
    };

    const handleEditClick = (record, type) => {
        setModalType(type);
        setIsEditing(true);
        if (type === 'user' && record.dob) {
            const formattedDob = record.dob.split('T')[0];
            setCurrentRecord({ ...record, dob: formattedDob });
        } else if (type === 'surety' && record.dateOfSurety) {
            // ✅ Correctly format the ISO date string to YYYY-MM-DD for the date input field
            const formattedSuretyDate = record.dateOfSurety.split('T')[0];
            setCurrentRecord({ ...record, dateOfSurety: formattedSuretyDate });
        }
        else {
            setCurrentRecord(record);
        }
        setIsModalOpen(true);
    };

    // ... (handleUpdate and handleDelete remain unchanged) ...
    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            if (modalType === 'user') {
                const url = isEditing
                    ? `${backend_Url}/api/admin/users/${currentRecord._id}`
                    : `${backend_Url}/api/admin/users`;
                const method = isEditing ? 'put' : 'post';
                await axios[method](url, currentRecord, config);
                toast.success(`User ${isEditing ? 'updated' : 'created'} successfully!`);
                fetchUsers();
            } else {
                const url = isEditing
                    ? `${backend_Url}/api/admin/sureties/${currentRecord._id}`
                    : `${backend_Url}/api/admin/sureties`;
                const method = isEditing ? 'put' : 'post';
                await axios[method](url, currentRecord, config);
                toast.success(`Surety ${isEditing ? 'updated' : 'created'} successfully!`);
                fetchSureties();
            }
            setIsModalOpen(false);
        } catch (error) {
            toast.error(error.response?.data?.msg || 'Update failed.');
        }
    };

    const handleDelete = async (id, type) => {
        if (window.confirm('Are you sure you want to delete this record?')) {
            try {
                if (type === 'user') {
                    await axios.delete(`${backend_Url}/api/admin/users/${id}`, config);
                    toast.success('User deleted successfully!');
                    fetchUsers();
                } else {
                    await axios.delete(`${backend_Url}/api/admin/sureties/${id}`, config);
                    toast.success('Surety deleted successfully!');
                    fetchSureties();
                }
            } catch (error) {
                toast.error(error.response?.data?.msg || 'Delete failed.');
            }
        }
    };
    // ... (handleUserFileImport and handleSuretyFileImport remain unchanged) ...
    const handleUserFileImport = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLoadingType('user');
            const formData = new FormData();
            formData.append('file', file);

            axios.post(backend_Url + '/api/admin/users/import', formData, {
                headers: {
                    'x-auth-token': token,
                    'Content-Type': 'multipart/form-data',
                },
            })
                .then(response => {
                    toast.success(response.data.msg);
                    fetchUsers();
                })
                .catch(error => {
                    toast.error(error.response?.data?.msg || 'Import failed. Check file format and server.');
                    console.error('Import error:', error);
                })
                .finally(() => {
                    setLoadingType(null);
                    if (userFileInputRef.current) {
                        userFileInputRef.current.value = null;
                    }
                });
        }
    };

    const handleSuretyFileImport = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLoadingType('surety');
            const formData = new FormData();
            formData.append('file', file);

            axios.post(backend_Url + '/api/admin/sureties/import', formData, {
                headers: {
                    'x-auth-token': token,
                    'Content-Type': 'multipart/form-data',
                },
            })
                .then(response => {
                    toast.success(response.data.msg);
                    fetchSureties();
                })
                .catch(error => {
                    toast.error(error.response?.data?.msg || 'Import failed. Check file format and server.');
                    console.error('Import error:', error);
                })
                .finally(() => {
                    setLoadingType(null);
                    if (suretyFileInputRef.current) {
                        suretyFileInputRef.current.value = null;
                    }
                });
        }
    };
    // ... (End of unchanged functions) ...

    
    // ... (handleExportUsers and handleExportSureties remain unchanged, except for using filtered data) ...
    const exportToExcel = (data, fileName) => {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const dataBlob = new Blob([excelBuffer], { type: 'application/octet-stream' });
        saveAs(dataBlob, fileName);
    };

    const handleExportUsers = () => {
        const usersData = filteredUsers.map(user => ({
            "Full Name": user.fullName,
            "Mobile No.": user.mobileNo,
            "DOB": user.dob.split('T')[0],
            "Village": user.village,
            "Email ID": user.emailId,
        }));
        exportToExcel(usersData, "User List.xlsx");
    };

    const handleExportSureties = () => {
        const suretiesData = filteredSureties.map(surety => {
            const formattedDate = surety.dateOfSurety
                ? new Date(surety.dateOfSurety).toLocaleDateString('en-IN')
                : '';
            
            return {
                "Surety Name": surety.shurityName,
                "Address": surety.address,
                "Aadhar No.": surety.aadharNo,
                "Police Station": surety.policeStation,
                "Case/FIR No.": surety.caseFirNo,
                "Act Name": surety.actName,
                "Section": surety.section,
                "Accused Name": surety.accusedName,
                "Accused Address": surety.accusedAddress,
                "Surety Amount": surety.shurityAmount,
                "Surety Date": formattedDate, // Use the locally formatted date
            }
        });
        exportToExcel(suretiesData, "Surety List.xlsx");
    };
    // ... (End of unchanged functions) ...


    // --- Filtering Logic (Memoized for Performance) ---
    const filteredUsers = useMemo(() => {
        return users.filter(user =>
            (user.mobileNo?.toLowerCase().includes(filter.toLowerCase())) ||
            (user.dob?.toLowerCase().includes(filter.toLowerCase())) ||
            (user.fullName?.toLowerCase().includes(filter.toLowerCase())) ||
            (user.emailId?.toLowerCase().includes(filter.toLowerCase()))
        );
    }, [users, filter]);

    const filteredSureties = useMemo(() => {
        // Helper to get year/month from date string
        const getYearMonth = (dateString) => {
            if (!dateString) return { year: null, month: null };
            const date = new Date(dateString);
            return {
                year: date.getFullYear().toString(),
                // Month is 1-indexed (padStart for '01', '02', etc.)
                month: (date.getMonth() + 1).toString().padStart(2, '0') 
            };
        };

        const lowerSearchTerm = filter.toLowerCase();
        
        return sureties.filter((s) => {
            // 1. Text Search Filter (Name or FIR No.)
            const textSearchMatch = !lowerSearchTerm || (
                s.shurityName.toLowerCase().includes(lowerSearchTerm) ||
                s.caseFirNo.toLowerCase().includes(lowerSearchTerm)
            );

            // 2. Police Station Filter
            const policeStationMatch = !suretyFilters.policeStation || s.policeStation === suretyFilters.policeStation;
            
            // 3. Date Filters
            const dateParts = getYearMonth(s.dateOfSurety);
            const yearMatch = !suretyFilters.filterYear || dateParts.year === suretyFilters.filterYear;
            const monthMatch = !suretyFilters.filterMonth || dateParts.month === suretyFilters.filterMonth;

            return textSearchMatch && policeStationMatch && yearMatch && monthMatch;
        });
    }, [sureties, filter, suretyFilters]);
    // --- End of Filtering Logic ---


    const renderModal = () => {
        if (!isModalOpen) return null;
        return (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-3xl p-8 shadow-xl relative w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                    <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-800 transition-colors">
                        <FaTimes size={24} />
                    </button>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">{isEditing ? `Edit ${modalType}` : `Add New ${modalType}`}</h2>

                    <form onSubmit={handleUpdate}>
                        {modalType === 'user' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gray-50 rounded-2xl shadow-inner border border-gray-200">
                                <div className="flex flex-col">
                                    <label htmlFor="fullName" className="text-sm font-medium text-gray-600">Full Name</label>
                                    <input type="text" id="fullName" name="fullName" placeholder="Full Name" value={currentRecord?.fullName || ''} onChange={(e) => setCurrentRecord({ ...currentRecord, fullName: e.target.value })} required className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div className="flex flex-col">
                                    <label htmlFor="mobileNo" className="text-sm font-medium text-gray-600">Mobile No.</label>
                                    <input type="text" id="mobileNo" name="mobileNo" placeholder="Mobile No." value={currentRecord?.mobileNo || ''} onChange={(e) => setCurrentRecord({ ...currentRecord, mobileNo: e.target.value })} required className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" maxLength="10" />
                                </div>
                                <div className="flex flex-col">
                                    <label htmlFor="dob" className="text-sm font-medium text-gray-600">Date of Birth</label>
                                    <input type="date" id="dob" name="dob" value={currentRecord?.dob || ''} onChange={(e) => setCurrentRecord({ ...currentRecord, dob: e.target.value })} required className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div className="flex flex-col">
                                    <label htmlFor="village" className="text-sm font-medium text-gray-600">Village / Court City</label>
                                    <select id="village" name="village" value={currentRecord?.village || ''} onChange={(e) => setCurrentRecord({ ...currentRecord, village: e.target.value })} required className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500">
                                        <option value="">Select Village / City</option>
                                        {policeStations.map(station => <option key={station} value={station}>{station}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col">
                                    <label htmlFor="emailId" className="text-sm font-medium text-gray-600">Email ID</label>
                                    <input type="email" id="emailId" name="emailId" placeholder="Email ID" value={currentRecord?.emailId || ''} onChange={(e) => setCurrentRecord({ ...currentRecord, emailId: e.target.value })} className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </div>
                        ) : (
                            // Surety Form
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-gray-50 p-6 rounded-2xl shadow-inner border border-gray-200">
                                    <h3 className="text-xl font-semibold text-gray-700 mb-4">Surety Information</h3>
                                    <div className="space-y-4">
                                        <div className="flex flex-col">
                                            <label htmlFor="shurityName" className="text-sm font-medium text-gray-600">Surety Name</label>
                                            <input type="text" id="shurityName" name="shurityName" value={currentRecord?.shurityName || ''} onChange={(e) => setCurrentRecord({ ...currentRecord, shurityName: e.target.value })} required className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                        </div>
                                        <div className="flex flex-col">
                                            <label htmlFor="address" className="text-sm font-medium text-gray-600">Address</label>
                                            <input type="text" id="address" name="address" value={currentRecord?.address || ''} onChange={(e) => setCurrentRecord({ ...currentRecord, address: e.target.value })} required className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                        </div>
                                        <div className="flex flex-col">
                                            <label htmlFor="aadharNo" className="text-sm font-medium text-gray-600">Aadhar No. (12 digits)</label>
                                            <input type="text" id="aadharNo" name="aadharNo" value={currentRecord?.aadharNo || ''} onChange={(e) => setCurrentRecord({ ...currentRecord, aadharNo: e.target.value })} required className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" maxLength="12" />
                                        </div>
                                        <div className="flex flex-col">
                                            <label htmlFor="policeStation" className="text-sm font-medium text-gray-600">Police Station</label>
                                            <select id="policeStation" name="policeStation" value={currentRecord?.policeStation || ''} onChange={(e) => setCurrentRecord({ ...currentRecord, policeStation: e.target.value })} required className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500">
                                                <option value="">Select Police Station</option>
                                                {policeStations.map(station => <option key={station} value={station}>{station}</option>)}
                                            </select>
                                        </div>
                                        {/* Surety Amount */}
                                        <div className="flex flex-col">
                                            <label htmlFor="shurityAmount" className="text-sm font-medium text-gray-600">Surety Amount (₹)</label>
                                            <input type="number" id="shurityAmount" name="shurityAmount" placeholder="e.g., 50000" value={currentRecord?.shurityAmount || ''} onChange={(e) => setCurrentRecord({ ...currentRecord, shurityAmount: e.target.value })} required className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                        </div>
                                        {/* Surety Date */}
                                        <div className="flex flex-col">
                                            <label htmlFor="dateOfSurety" className="text-sm font-medium text-gray-600">Surety Date</label>
                                            <input type="date" id="dateOfSurety" name="dateOfSurety" value={currentRecord?.dateOfSurety || ''} onChange={(e) => setCurrentRecord({ ...currentRecord, dateOfSurety: e.target.value })} required className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-6 rounded-2xl shadow-inner border border-gray-200">
                                    <h3 className="text-xl font-semibold text-gray-700 mb-4">Accused Information</h3>
                                    <div className="space-y-4">
                                        <div className="flex flex-col">
                                            <label htmlFor="caseFirNo" className="text-sm font-medium text-gray-600">Case/FIR No.</label>
                                            <input type="text" id="caseFirNo" name="caseFirNo" value={currentRecord?.caseFirNo || ''} onChange={(e) => setCurrentRecord({ ...currentRecord, caseFirNo: e.target.value })} required className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                        </div>
                                        <div className="flex flex-col">
                                            <label htmlFor="actName" className="text-sm font-medium text-gray-600">Act Name</label>
                                            <input type="text" id="actName" name="actName" value={currentRecord?.actName || ''} onChange={(e) => setCurrentRecord({ ...currentRecord, actName: e.target.value })} required className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                        </div>
                                        <div className="flex flex-col">
                                            <label htmlFor="section" className="text-sm font-medium text-gray-600">Section</label>
                                            <input type="text" id="section" name="section" value={currentRecord?.section || ''} onChange={(e) => setCurrentRecord({ ...currentRecord, section: e.target.value })} required className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                        </div>
                                        <div className="flex flex-col">
                                            <label htmlFor="accusedName" className="text-sm font-medium text-gray-600">Accused Name</label>
                                            <input type="text" id="accusedName" name="accusedName" value={currentRecord?.accusedName || ''} onChange={(e) => setCurrentRecord({ ...currentRecord, accusedName: e.target.value })} required className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                        </div>
                                        <div className="flex flex-col">
                                            <label htmlFor="accusedAddress" className="text-sm font-medium text-gray-600">Accused Address</label>
                                            <input type="text" id="accusedAddress" name="accusedAddress" value={currentRecord?.accusedAddress || ''} onChange={(e) => setCurrentRecord({ ...currentRecord, accusedAddress: e.target.value })} required className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-end space-x-4 mt-6">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors">Cancel</button>
                            <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                                {isEditing ? 'Save Changes' : 'Create'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans text-gray-800">
            <ToastContainer />
            {/* Sidebar (Unchanged) */}
            <div className="hidden md:flex w-64 bg-white border-r border-gray-200 p-6 flex-col shadow-lg">
                <div className="flex items-center mb-8">
                    <FaUsers className="text-3xl text-indigo-600 mr-3" />
                    <h1 className="text-2xl font-bold">Admin Panel</h1>
                </div>
                <div className="flex items-center p-4 bg-gray-100 rounded-lg mb-6">
                    <FaUserCircle className="text-4xl text-indigo-600 mr-3" />
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500">Logged in as</span>
                        <span className="font-semibold text-gray-800">{adminUser?.fullName || adminUser?.mobileNo || 'Admin'}</span>
                    </div>
                </div>
                <nav className="flex-1 space-y-2">
                    <button
                        onClick={() => setView('users')}
                        className={`w-full flex items-center p-3 rounded-lg font-medium transition-colors duration-200 ${view === 'users' ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        <FaUser className="mr-4 text-xl" />
                        Manage Users
                    </button>
                    <button
                        onClick={() => setView('sureties')}
                        className={`w-full flex items-center p-3 rounded-lg font-medium transition-colors duration-200 ${view === 'sureties' ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        <FaClipboard className="mr-4 text-xl" />
                        Manage Sureties
                    </button>
                </nav>
                <div className="mt-auto pt-6 border-t border-gray-200">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center p-3 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 transition-colors duration-300 shadow-lg"
                    >
                        <FaSignOutAlt className="mr-2" /> Logout
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-8 sm:p-10">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-extrabold text-gray-900">
                            {view === 'users' ? 'User Management' : 'Surety Management'}
                        </h1>
                        <p className="text-gray-500 mt-1">
                            {view === 'users' ? 'Manage and edit user accounts.' : 'Manage and view all surety records.'}
                        </p>
                    </div>
                    
                    <div className="flex space-x-3 mt-4 md:mt-0">
                        {view === 'users' ? (
                            <>
                                <button
                                    onClick={() => handleCreate('user')}
                                    className="px-6 py-2 rounded-xl bg-indigo-600 text-white font-semibold flex items-center hover:bg-indigo-700 transition-all duration-300 shadow-lg"
                                >
                                    <FaPlus className="mr-2" /> Add User
                                </button>
                                {/* Removed user import label as it's commented out in your original code */}
                                <button
                                    onClick={handleExportUsers}
                                    className="px-6 py-2 rounded-xl bg-blue-600 text-white font-semibold flex items-center hover:bg-blue-700 transition-all duration-300 shadow-lg"
                                >
                                    <FaFileExcel className="mr-2" /> Export
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => handleCreate('surety')}
                                    className="px-6 py-2 rounded-xl bg-indigo-600 text-white font-semibold flex items-center hover:bg-indigo-700 transition-all duration-300 shadow-lg"
                                >
                                    <FaPlus className="mr-2" /> Add Surety
                                </button>
                                <label htmlFor="surety-file-import" className="px-6 py-2 rounded-xl bg-green-600 text-white font-semibold flex items-center hover:bg-green-700 transition-all duration-300 shadow-lg cursor-pointer">
                                    <FaFileImport className="mr-2" /> Import
                                    <input type="file" id="surety-file-import" accept=".xlsx, .xls" onChange={handleSuretyFileImport} className="hidden" ref={suretyFileInputRef} />
                                </label>
                                <button
                                    onClick={handleExportSureties}
                                    className="px-6 py-2 rounded-xl bg-blue-600 text-white font-semibold flex items-center hover:bg-blue-700 transition-all duration-300 shadow-lg"
                                >
                                    <FaFileExcel className="mr-2" /> Export
                                </button>
                            </>
                        )}
                    </div>
                </header>

                <div className="bg-white p-6 rounded-3xl shadow-xl">
                    {/* --- Filter Section for Sureties (UNCHANGED DESIGN) --- */}
                    {view === 'sureties' && (
                        <div className="mb-6 border-b border-gray-200 pb-4">
                            <h3 className="text-xl font-semibold mb-4 flex items-center text-gray-700">
                                <FaFilter className="mr-2" /> Filter Sureties
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <FormInput 
                                    label="Police Station" 
                                    id="filterPoliceStation" 
                                    icon={FaBuilding}
                                >
                                    <select 
                                        value={suretyFilters.policeStation} 
                                        onChange={(e) => setSuretyFilters({...suretyFilters, policeStation: e.target.value})}
                                        className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                    >
                                        <option value="">All Stations</option>
                                        {policeStations.map(station => <option key={station} value={station}>{station}</option>)}
                                    </select>
                                </FormInput>
                                
                                <FormInput 
                                    label="Year" 
                                    id="filterYear" 
                                    icon={FaCalendarAlt}
                                >
                                    <select 
                                        value={suretyFilters.filterYear} 
                                        onChange={(e) => setSuretyFilters({...suretyFilters, filterYear: e.target.value})}
                                        className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                    >
                                        <option value="">All Years</option>
                                        {YEARS.map(year => <option key={year} value={year}>{year}</option>)}
                                    </select>
                                </FormInput>

                                <FormInput 
                                    label="Month" 
                                    id="filterMonth" 
                                    icon={FaCalendarAlt}
                                >
                                    <select 
                                        value={suretyFilters.filterMonth} 
                                        onChange={(e) => setSuretyFilters({...suretyFilters, filterMonth: e.target.value})}
                                        className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                    >
                                        <option value="">All Months</option>
                                        {MONTHS.map(month => <option key={month.value} value={month.value}>{month.label}</option>)}
                                    </select>
                                </FormInput>

                                {/* Combined Text Search Filter */}
                                <FormInput label="Search" id="textFilter" icon={FaFilter}>
                                    <input
                                        type="text"
                                        placeholder="Name or FIR No."
                                        value={filter}
                                        onChange={(e) => setFilter(e.target.value)}
                                        className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </FormInput>
                                
                            </div>
                            <button
                                onClick={() => setSuretyFilters({ policeStation: '', filterYear: '', filterMonth: '' })}
                                className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center"
                            >
                                <FaTimes className="mr-2" /> Clear Filters
                            </button>
                        </div>
                    )}
                    {/* --- Filter Section for Users (Old Simple Filter) --- */}
                    {view === 'users' && (
                        <>
                            <h3 className="text-xl font-semibold mb-4 flex items-center text-gray-700">
                                <FaFilter className="mr-2" /> Filter Records
                            </h3>
                            <div className="mb-6 relative">
                                <input
                                    type="text"
                                    placeholder="Filter by mobile number, DOB, name, or email..."
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                        </>
                    )}


                    <div className="overflow-x-auto rounded-xl shadow-inner-lg" style={{ maxHeight: "calc(100vh - 452px)" }}>
                        {view === 'users' && (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-100 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Full Name</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Mobile No.</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">DOB</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Village</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email ID</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredUsers.length > 0 ? (
                                        filteredUsers.map(user => (
                                            <tr key={user._id} className="hover:bg-gray-50 transition-colors duration-200">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{user.fullName}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{user.mobileNo}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{user.dob.split('T')[0]}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{user.village}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{user.emailId}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <div className="flex space-x-2">
                                                        <button onClick={() => handleEditClick(user, 'user')} className="p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors">
                                                            <FaEdit />
                                                        </button>
                                                        <button onClick={() => handleDelete(user._id, 'user')} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                                                            <FaTrash />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="py-4 px-6 text-center text-gray-500">No users found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}

                        {view === 'sureties' && (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-100 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Surety Name</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Aadhar No.</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Police Station</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Case/FIR No.</th>
                                        {/* 🌟 NEW TABLE HEADERS 🌟 */}
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Surety Amount</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Surety Date</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredSureties.length > 0 ? (
                                        filteredSureties.map(surety => (
                                            <tr key={surety._id} className="hover:bg-gray-50 transition-colors duration-200">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{surety.shurityName}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{surety.aadharNo}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{surety.policeStation}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{surety.caseFirNo}</td>
                                                {/* 🌟 NEW TABLE DATA 🌟 */}
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">₹{surety.shurityAmount ? surety.shurityAmount.toLocaleString('en-IN') : '-'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{surety.dateOfSurety ? surety.dateOfSurety.split('T')[0] : '-'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <div className="flex space-x-2">
                                                        <button onClick={() => handleEditClick(surety, 'surety')} className="p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors">
                                                            <FaEdit />
                                                        </button>
                                                        <button onClick={() => handleDelete(surety._id, 'surety')} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                                                            <FaTrash />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="8" className="py-4 px-6 text-center text-gray-500">No sureties found matching the current filters.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
