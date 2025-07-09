/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/log', 'N/search','N/runtime'],
    /**
     * @param {record} record
     * @param {search} search
     */
    function(record, log, search, runtime) {


function getInputData(context) {
  var selectedInvoices= runtime.getCurrentScript().getParameter({
    name:'custscript_selected_invoices'
  });

  log.debug('selectedInvoices',JSON.parse(selectedInvoices));
    return JSON.parse(selectedInvoices);
}


function map(context) {
    var invoiceData = JSON.parse(context.value);
  log.debug('invoiceData',invoiceData);
        // Use the customer as the key to group invoices
        context.write({
            key: invoiceData.customer,
            value: invoiceData
        });
}


function reduce(context) {
  var trandate= runtime.getCurrentScript().getParameter({
    name:'custscript_trandate'
  });
  log.debug('trandate',trandate);
        var invoices = context.values.map(function(value) {
         
            return JSON.parse(value);
        });
       if (invoices.length > 0) {
            var customer = context.key; // Get the customer for this group
           log.debug('customer',customer);
            // Create a new consolidated invoice for this customer
         try{
            var consolidatedInvoice = record.create({
                type: record.Type.INVOICE,
                isDynamic: true
            });
           consolidatedInvoice.setValue({
                fieldId: 'customform',
                value: 206  // OSM Late Fee Invoice form
            });
            consolidatedInvoice.setValue({
                fieldId: 'entity',
                value: customer
            });
           consolidatedInvoice.setText({
                fieldId: 'trandate',
                text: trandate
            });
           
           consolidatedInvoice.setValue({
                fieldId: 'memo',
                value: 'This is a late fee Invoice'
            });
           consolidatedInvoice.setValue({
                fieldId: 'custbody_osm_late_fee_invoice',
                value: true
            });
           
            invoices.forEach(function(invoice) {
                consolidatedInvoice.selectNewLine({
                    sublistId: 'item'
                });

                consolidatedInvoice.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: 17538 // Set your item ID for late fee
                });
                consolidatedInvoice.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: 1
                });
                consolidatedInvoice.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'amount',
                    value: parseFloat(invoice.lateFeeAmount)
                });
              consolidatedInvoice.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_osm_late_fee_invoice',
                    value: invoice.id
                });
                consolidatedInvoice.commitLine({
                    sublistId: 'item'
                });
              var id = record.submitFields({
    type: record.Type.INVOICE,
    id: invoice.id,
    values: {
        custbody_osm_late_fee_applied: true
    },
    options: {
        enableSourcing: false,
        ignoreMandatoryFields : true
    }
});
            });
            var invoiceId = consolidatedInvoice.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });
            log.debug('Consolidated Invoice Created',invoiceId);
        }
         catch(e){
           log.debug('error in creating Invoice', e.message );
         }
       }
}


function summarize(summary) {
    if (summary.error) {
        log.error('Error', summary.error);
    } else {
        log.audit('Summary', 'Map/Reduce script completed successfully.');
    }
}

return {
    getInputData: getInputData,
    map: map,
    reduce: reduce,
    summarize: summarize
};

});
