/**
 * @NApiVersion 2.x
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
        var documentNumber = searchResult.values.tranid; // Document Number
        var fileInternalID = searchResult.values['internalid.file'] ? searchResult.values['internalid.file'].value : null; // File Internal ID

        log.debug({
            title: "Processing Transaction",
            details: "Transaction Internal ID: " + transactionInternalID + 
                     ", Document Number: " + documentNumber + 
                     ", File Internal ID: " + fileInternalID
        });

        if (!fileInternalID) {
            log.error("Missing fileInternalID", "fileInternalID is undefined or null for transactionInternalID: " + transactionInternalID);
            return; // Skip processing if fileInternalID is missing
        }

        try {
            // Load the file using the fileInternalID
            var loadedFile = file.load({
                id: fileInternalID
            });

            // Prepare the description text from the saved search results
            var descriptionText = 
                "transactionType: INVOICE\n" +
                "documentNumber: " + documentNumber + "\n" +
                "internalID: " + transactionInternalID;

            // Update the file description with the new text
            loadedFile.description = descriptionText;

            // Save the updated file
            loadedFile.save();
            
            log.debug("File Updated", "File ID: " + fileInternalID + " successfully updated with new description format.");

        } catch (error) {
            log.error("Error loading or updating file", error.message);
        }
    }

    function reduce(context) {
        // Not needed for this script, leave empty
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

        summary.reduceSummary.errors.iterator().each(function(key, error) {
            log.error({
                title: 'Reduce Error for key: ' + key,
                details: error
            });
            return true;
        });
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});
