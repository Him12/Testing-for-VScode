/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/file', 'N/log', 'N/record'], function(search, file, log, record) {

    function getInputData() {
        // Load the saved search which retrieves the list of scripts
        return search.load({
            id: 'customsearch_check_script_files' // The ID of your saved search
        });
    }

    function map(context) {
        // Parse the search result into a JSON object
        var result = JSON.parse(context.value);

        var fileId = result.id;
        var fileName = result.values.name;

        try {
            // Load the script file
            var scriptFile = file.load({ id: fileId });
            var content = scriptFile.getContents();

            // Use regular expression to find URLs
            var urlRegex = /https?:\/\/[^\s"]+\&h=[^\s"]+/g;
            //var urlRegex = /https?:\/\/[^\s"]+/g;
            var matches = content.match(urlRegex);

            if (matches) {
                matches.forEach(function(url) {
                    // Create a record in the custom record type to store the result
                    var urlRecord = record.create({
                        type: 'customrecord_script_urls', // Replace with your custom record type ID
                        isDynamic: true
                    });

                    urlRecord.setValue({ fieldId: 'custrecordcustrecord_script_name', value: fileName }); // Set script name
                    urlRecord.setValue({ fieldId: 'custrecordcustrecord_script_url', value: url }); // Set URL

                    urlRecord.save();
                });
            }
        } catch (error) {
            log.error('Error processing file', 'File ID: ' + fileId + ', Error: ' + error.message);
        }
    }

    function reduce(context) {
        // Not used in this case, but the reduce stage is available if you need to aggregate data
    }

    function summarize(summary) {
        // Log the summary of the Map/Reduce process
        summary.mapSummary.errors.iterator().each(function(key, value) {
            log.error('Map Error: ' + key, value);
            return true;
        });

        log.audit('Map/Reduce Script Complete', 'Total Usage: ' + summary.usage);
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});
