/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
define(['N/search', 'N/file', 'N/ui/serverWidget', 'N/log'], function(search, file, serverWidget, log) {
    function onRequest(context) {
        // Get Search Results
        var scriptsSearch = search.load({
            id: 'customsearch_check_script_files'
        });

        // Create the form
        var form = serverWidget.createForm({
            title: 'Affected Scripts'
        });

        // Add a sublist to display the results
        var sublist = form.addSublist({
            id: 'results',
            type: serverWidget.SublistType.LIST,
            label: 'Scripts with Hardcoded URLs'
        });

        sublist.addField({
            id: 'scriptname',
            type: serverWidget.FieldType.TEXT,
            label: 'Script Name'
        });

        sublist.addField({
            id: 'url',
            type: serverWidget.FieldType.TEXT,
            label: 'URL'
        });

        var line = 0;

        // Process each search result
        scriptsSearch.run().each(function(result) {
            var fileId = result.getValue({
                name: 'internalid'
            });
            var fileName = result.getValue({
                name: 'name'
            });
            var script;

            // Attempt to load the script file
            try {
                script = file.load({
                    id: fileId
                });
            } catch (error) {
                log.error({
                    title: 'Error loading file',
                    details: 'File ID: ' + fileId + ', Error: ' + error.message
                });
                return true; // Skip to the next file
            }

            // Get content of file as a string
            var content = String(script.getContents());

            // Use regular expression to find URLs with &h= parameter
            var urlRegex = /https?:\/\/[^\s"]+\&h=[^\s"]+/g;
            //var urlRegex = /https?:\/\/[^\s"]+/g; // Match any URL
            var matches = content.match(urlRegex);

            if (matches) {
                matches.forEach(function(url) {
                    sublist.setSublistValue({
                        id: 'scriptname',
                        line: line,
                        value: fileName
                    });

                    sublist.setSublistValue({
                        id: 'url',
                        line: line,
                        value: url
                    });

                    line++;
                });
            }

            return true;
        });

        // Display the form
        context.response.writePage(form);
    }

    return {
        onRequest: onRequest
    };
});