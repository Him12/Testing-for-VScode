/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/file', 'N/search', 'N/log'], function(file, search, log) {

    function getInputData() {
        // Load the saved search
        return search.load({
            id: 'customsearch_invoice_file_manipulation' // Ensure this is the correct search ID
        });
    }

    function map(context) {
        var searchResult = JSON.parse(context.value);
        log.debug("Search Result", searchResult);

        // Extract values from search result
        var transactionInternalID = searchResult.id; // Transaction Internal ID
        var documentNumber = searchResult.values.tranid; // Document Number (verify if this is correct)
        var fileInternalID = (searchResult.values['internalid.file']).value; // File Internal ID
        

        log.debug({
            title: "Processing Transaction",
            details: "Transaction Internal ID: " + transactionInternalID + 
                     ", Document Number: " + documentNumber + 
                     ", File Internal ID: " + fileInternalID
        });

        // if (!fileInternalID) {
        //     log.error("Missing fileInternalID", "fileInternalID is undefined or null for transactionInternalID: " + transactionInternalID);
        //     return; // Skip processing if fileInternalID is missing
        // }

        try {
            // Load the file using the fileInternalID
            var loadedFile = file.load({
                id: fileInternalID
            });

            // Prepare the object for the file description from the saved search results
            var fileDescriptionObj = {
                transactionType: "INVOICE",
                documentNumber: documentNumber,
                internalID: transactionInternalID
            };

            // Check the file description
            var fileDescription = loadedFile.description || '[]'; // Default to an empty array if no description
            var fileDescriptionArray = JSON.parse(fileDescription);

            if (Array.isArray(fileDescriptionArray) && fileDescriptionArray.length > 0) {
                // Check if the object already exists in the description array
                var objectExists = fileDescriptionArray.some(function(descObj) {
                    return compareObjects(descObj, fileDescriptionObj); // Use compareObjects for deep comparison
                });

                if (!objectExists) {
                    // If the object does not exist, push it to the array
                    fileDescriptionArray.push(fileDescriptionObj);
                }
            } else {
                // If the description is not an array, initialize it as an array and add the object
                fileDescriptionArray = [fileDescriptionObj];
            }

            // Update the file description with the new array
            loadedFile.description = "";

            // Set the checkbox "Available for SuiteBundles" to true
            loadedFile.bundleable = true;  // Changed to the proper property

            // Save the updated file
            loadedFile.save();
            
            log.debug("File Updated", "File ID: " + fileInternalID + " successfully updated.");

        } catch (error) {
            log.error("Error loading or updating file", error.message);
        }
    }

    function compareObjects(x, y) {
        var xkeys = Object.keys(x).sort();
        var ykeys = Object.keys(y).sort();

        // Check if the number of keys is different
        if (xkeys.length !== ykeys.length) {
            return false;
        }

        // Compare keys and values
        for (var i = 0; i < xkeys.length; i++) {
            if (xkeys[i] !== ykeys[i]) {
                return false;
            }

            // Check if both are objects, then recurse
            if (typeof x[xkeys[i]] === 'object' && typeof y[ykeys[i]] === 'object') {
                if (!compareObjects(x[xkeys[i]], y[ykeys[i]])) {
                    return false;
                }
            } else if (x[xkeys[i]] !== y[ykeys[i]]) {
                // Check for primitive values
                return false;
            }
        }
        return true;
    }

    function summarize(summary) {
        log.audit({
            title: 'Map/Reduce Summary',
            details: JSON.stringify(summary)
        });

        summary.mapSummary.errors.iterator().each(function(key, error) {
            log.error({
                title: 'Map Error for key: ' + key,
                details: error
            });
            return true;
        });
    }

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };
});
