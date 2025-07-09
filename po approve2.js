/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
define(['N/search', 'N/record', 'N/log', 'N/redirect'],
    function(search, record, log, redirect) {

        function onRequest(context) {
            try {
                // Load the saved search
                var savedSearch = search.load({
                    id: 'customsearch_ng_po_status_update' // Saved Search ID
                });

                // Run the search and get the results
                var searchResult = savedSearch.run();
                var pagedData = searchResult.getRange({
                    start: 0,
                    end: 1000 // Adjust the range based on expected results
                });

                // Iterate through the results and approve the POs
                for (var i = 0; i < pagedData.length; i++) {
                    var purchaseOrderId = pagedData[i].id;

                    // Load the purchase order record
                    var poRecord = record.load({
                        type: record.Type.PURCHASE_ORDER,
                        id: purchaseOrderId
                    });

                    // Approve the purchase order
                    poRecord.setValue({
                        fieldId: 'approvalstatus',
                        value: 2 // 2 represents "Approved"
                    });

                    // Save the approved PO
                    poRecord.save();

                    log.debug({
                        title: 'PO Approved',
                        details: 'Purchase Order ID ' + purchaseOrderId + ' approved successfully.'
                    });
                }

                context.response.write('Purchase Orders approved successfully.');

            } catch (e) {
                log.error({
                    title: 'Error in approving PO',
                    details: e.message
                });
                context.response.write('Error occurred while approving Purchase Orders.');
            }
        }

        return {
            onRequest: onRequest
        };

    });
