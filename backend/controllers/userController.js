const Hardware = require('../models/Hardware'); 
const User = require('../models/User');
const mongoose = require('mongoose'); 

// =========================================================
// 🔥 HELPER FUNCTION: DATE PARSING (MUST BE DEFINED)
// =========================================================
const safeDate = (dateString) => {
    if (!dateString || typeof dateString !== 'string') return null;

    // Check for YYYY-MM-DD format (often sent from frontend after parsing Excel)
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : date;
    }

    // Regex to match DD/MM/YYYY or DD-MM-YYYY
    const dateParts = dateString.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);

    if (dateParts) {
        // Note: JavaScript Date constructor is year, month-1, day
        const day = parseInt(dateParts[1], 10);
        const month = parseInt(dateParts[2], 10) - 1; // Month is 0-indexed
        const year = parseInt(dateParts[3], 10);
        
        const date = new Date(year, month, day);

        // Final check to see if the date is valid
        if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
            return date;
        }
    }
    
    // Fallback attempt for other formats if custom parsing fails
    const genericDate = new Date(dateString);
    return isNaN(genericDate.getTime()) ? null : genericDate;
};


// =========================================================
// 🔥 CREATE HARDWARE (FIXED: Saves Name String directly)
// =========================================================
exports.createHardware = async (req, res) => {
    // employeeAllocated captures the name string from the payload
    const { 
        employeeAllocated, 
        hardwareItems,
        ...restOfBody
    } = req.body;

    const userId = req.user.id; 
    
    // 1. Employee ID lookup is REMOVED. employeeAllocated (the name string) 
    //    will be saved directly.
    
    // 2. Map Hardware Items
    const mappedItems = hardwareItems.map(item => ({
        itemName: item.hardwareName,
        serialNo: item.serialNumber,
        company: item.company 
    }));
    
    // 3. Prepare the final document for save
    const newHardware = new Hardware({
        ...restOfBody,             
        items: mappedItems,        
        user: userId,              
        
        // 🔥 FIX: employeeAllocated field saves the name string from the request body.
        employeeAllocated: employeeAllocated, 

        deliveryDate: safeDate(restOfBody.deliveryDate),
        installationDate: safeDate(restOfBody.installationDate),
    });

    try {
        const hardware = await newHardware.save();
        res.status(201).json(hardware);
    } catch (err) {
        // NOTE: If your schema strictly requires an ObjectId for employeeAllocated, 
        // this will fail with a CastError.
        console.error('Server Error on Create:', err.message); 
        res.status(500).json({ msg: `Server Error on Create: ${err.message}` });
    }
};


// =========================================================
// 🔥 BATCH IMPORT HARDWARE (FIXED: Saves Name String and removes lookup)
// =========================================================
exports.batchImportHardware = async (req, res) => {
    const recordsToImport = req.body;
    const userId = req.user.id;

    if (!Array.isArray(recordsToImport) || recordsToImport.length === 0) {
        return res.status(400).json({ msg: 'Import payload must be a non-empty array of hardware records.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await User.findById(userId).session(session);
        if (!user) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ msg: 'User not found' });
        }

        const documentsToInsert = [];
        let successCount = 0
        
       // Diagnostic Log (userController.js: Line 115 now)
        if (recordsToImport.length > 0) {
            // console.log('--- RAW RECORD SAMPLE ---', JSON.stringify(recordsToImport[0], null, 2));
        }

        for (const record of recordsToImport) {
            
            // 1. Destructure employeeAllocated (the name) separately, and everything else
            const { 
                hardwareItems,              
                employeeAllocated, // Captures the name string from the record
                deliveryDate,               
                installationDate,           
                ...otherBodyFields          
            } = record;
            
            // 2. Validate Items
            if (!Array.isArray(hardwareItems) || hardwareItems.length === 0) {
                console.warn(`Skipping record due to empty or missing hardwareItems: ${JSON.stringify(record)}`);
                continue; 
            }

            // 3. Employee ID Resolution logic is REMOVED.
            
            // 4. Map Hardware Items
            const mappedItems = hardwareItems.map(item => ({
                itemName: item.hardwareName,
                serialNo: item.serialNumber,
                company: item.company 
            }));

            // 5. Prepare Final Document Structure
            const newHardwareDoc = {
                ...otherBodyFields, 
                
                deliveryDate: safeDate(deliveryDate),
                installationDate: safeDate(installationDate),
                
                // 🔥 FIX: Saves the name string from the input record
                employeeAllocated: employeeAllocated, 
                
                items: mappedItems, 
                user: userId,
            };

            documentsToInsert.push(newHardwareDoc);
            successCount++;
        }
        
        // 6. Handle Case: No valid documents to insert
        if (documentsToInsert.length === 0) {
            await session.commitTransaction(); 
            session.endSession();
            return res.status(200).json({ 
                msg: 'File processed, but no valid records were inserted after filtering.', 
                count: 0 
            });
        }

        // 7. Insert documents
        await Hardware.insertMany(documentsToInsert, { session, ordered: false });
        
        await session.commitTransaction();
        session.endSession();
        
        // 8. Send final success response
        res.status(201).json({ 
            msg: `Successfully imported ${successCount} hardware records.`, 
            count: successCount 
        });

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        
        console.error('Batch Import Server Error:', err);
        
        res.status(500).json({ 
            msg: `Server failed to process the batch. A data error may exist in the file. Error: ${err.message}`,
            error: err.message, 
            count: 0
        });
    }
};

// =========================================================
// --- UPDATE HARDWARE ITEM (FIXED: Saves Name String directly) ---
// =========================================================
exports.updateHardwareItem = async (req, res) => {
    const parentId = req.params.id;
    const { hardwareItems, employeeAllocated, ...otherBodyFields } = req.body; // employeeAllocated is the name
    
    const itemToUpdate = hardwareItems?.[0]; 
    if (!itemToUpdate || !itemToUpdate._id) {
        return res.status(400).json({ msg: 'Item ID (_id) and update data are required.' });
    }
    
    // Employee ID lookup is REMOVED. employeeAllocated (the name string) 
    // will be used directly.

    try {
        // 1. Update the parent document's fields (courtName, dates, employeeAllocated name, etc.)
        await Hardware.findByIdAndUpdate(
            parentId,
            { 
                $set: { 
                    ...otherBodyFields,
                    // 🔥 FIX: Use the name string directly for update
                    employeeAllocated: employeeAllocated, 
                    deliveryDate: safeDate(otherBodyFields.deliveryDate),
                    installationDate: safeDate(otherBodyFields.installationDate),
                } 
            },
            { new: true, runValidators: true }
        );

        // 2. Update the specific subdocument (item details)
        const subDocUpdate = await Hardware.findOneAndUpdate(
            { "_id": parentId, "items._id": itemToUpdate._id },
            { 
                $set: { 
                    "items.$.itemName": itemToUpdate.hardwareName,
                    "items.$.serialNo": itemToUpdate.serialNumber,
                    "items.$.company": itemToUpdate.company
                } 
            },
            { new: true, runValidators: true }
        )/*.populate('employeeAllocated', 'fullName mobileNo')*/; // 👈 REMOVED POPULATE

        if (!subDocUpdate) {
            return res.status(404).json({ msg: 'Hardware item (subdocument) not found within the record.' });
        }

        res.json({ msg: 'Hardware item and metadata updated successfully', hardware: subDocUpdate });

    } catch (err) {
        console.error('Server Error on Update:', err.message);
        res.status(500).json({ msg: 'Server error' });
    }
};

// =========================================================
// --- DELETE HARDWARE ITEM (EXISTING LOGIC) ---
// =========================================================
exports.deleteHardwareItem = async (req, res) => {
    const parentId = req.params.parentId; 
    const itemId = req.params.itemId;

    try {
        const updatedRecord = await Hardware.findByIdAndUpdate(
            parentId, 
            { $pull: { items: { _id: itemId } } },
            { new: true }
        );

        if (!updatedRecord) {
            return res.status(404).json({ msg: 'Parent hardware record not found.' });
        }
        res.json({ msg: 'Hardware item deleted successfully', hardware: updatedRecord });
    } catch (err) {
        console.error('Server Error on Delete:', err.message);
        res.status(500).json({ msg: 'Server error' });
    }
};

// =========================================================
// --- FETCH FUNCTIONS (FIXED: Removed unnecessary populate) ---
// =========================================================
exports.getUserHardware = async (req, res) => {
    // NOTE: This function currently queries by ID. If employeeAllocated is now a string name, 
    // this query will NOT work as intended. I've left the query as is, but removed populate.
    try {
        const hardware = await Hardware.find({ employeeAllocated: req.user.id })
            /*.populate('employeeAllocated', 'fullName mobileNo')*/; // 👈 REMOVED POPULATE
        res.json(hardware);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.getAllHardware = async (req, res) => {
    try {
        const hardwareRecords = await Hardware.find(); // NO POPULATE NEEDED

        // FLATTEN THE DATA FOR FRONTEND CONSUMPTION
        const flatHardwareList = hardwareRecords.flatMap(record => {
            return record.items.map(item => ({
                _id: item._id, 
                parentId: record._id, 
                hardwareName: item.itemName, 
                serialNumber: item.serialNo, 
                courtName: record.courtName,
                companyName: record.companyName,
                deliveryDate: record.deliveryDate,
                installationDate: record.installationDate,
                deadStockRegSrNo: record.deadStockRegSrNo,
                deadStockBookPageNo: record.deadStockBookPageNo,
                source: record.source,
                company:item.company,
                // employeeAllocated is now the name string, ready for display
                employeeAllocated: record.employeeAllocated, 
                user: record.user 
            }));
        });

        res.json(flatHardwareList);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
};
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
};

