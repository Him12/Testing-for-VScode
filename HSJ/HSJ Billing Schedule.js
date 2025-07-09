/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log', 'N/runtime'], function(search, record, log, runtime) {

    function getInputData() {
        const savedSearchId = runtime.getCurrentScript().getParameter({
            name: 'custscript_ng_billing_sch_search'
        });

        log.audit('Map/Reduce Start', 'Loading input data from saved search: ' + savedSearchId);
        return search.load({ id: savedSearchId });
    }

    function map(context) {
        var result = JSON.parse(context.value);
        var soId = result.id;

        log.debug('Map Stage - Writing SO ID', soId);
        context.write({ key: soId, value: soId });
    }

    function reduce(context) {
        const billingDoneCheckbox = runtime.getCurrentScript().getParameter({
            name: 'custscript_ng_billing_done_checkbox'
        });

        const lineDateField = runtime.getCurrentScript().getParameter({
            name: 'custscript_ng_line_level_date'
        });

        var soId = context.key;

        try {
            log.audit('Reduce Stage - Start Processing SO', soId);

            var soRec = record.load({
                type: record.Type.SALES_ORDER,
                id: soId,
                isDynamic: true
            });

            var soNumber = soRec.getValue({ fieldId: 'tranid' });
            var itemCount = soRec.getLineCount({ sublistId: 'item' });

            for (var i = 0; i < itemCount; i++) {
                soRec.selectLine({ sublistId: 'item', line: i });

                var lineAmount = soRec.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'amount'
                });

                var invDate = soRec.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: lineDateField
                });

                var lineId = soRec.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'line'
                });

                if (!invDate || !lineAmount || lineId === undefined || lineId === null) {
                    log.debug('Skipping line due to missing data', {
                        lineIndex: i,
                        invDate: invDate,
                        lineAmount: lineAmount,
                        lineId: lineId
                    });
                    soRec.commitLine({ sublistId: 'item' });
                    continue;
                }

                var billingName = soNumber + '_' + lineId;

                var billingRec = record.create({
                    type: 'billingschedule',
                    isDynamic: true
                });

                billingRec.setValue({ fieldId: 'name', value: billingName });
                billingRec.setValue({ fieldId: 'initialamount', value: 0 });
                billingRec.setValue({ fieldId: 'frequency', value: 'CUSTOM' });
                billingRec.setValue({ fieldId: 'repeatcount', value: 1 });

                billingRec.selectNewLine({ sublistId: 'recurrence' });
                billingRec.setCurrentSublistValue({ sublistId: 'recurrence', fieldId: 'units', value: 'CUSTOM' });
                billingRec.setCurrentSublistValue({ sublistId: 'recurrence', fieldId: 'recurrencedate', value: invDate });
                billingRec.setCurrentSublistValue({ sublistId: 'recurrence', fieldId: 'amount', value: lineAmount });
                billingRec.commitLine({ sublistId: 'recurrence' });

                var billingId = billingRec.save();

                log.audit('Billing Schedule Created', {
                    salesOrder: soNumber,
                    lineId: lineId,
                    billingScheduleId: billingId,
                    billingName: billingName,
                    invoiceDate: invDate,
                    amount: lineAmount
                });

                soRec.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'billingschedule',
                    value: billingId
                });

                soRec.commitLine({ sublistId: 'item' });
            }

            // Mark SO as processed
            soRec.setValue({ fieldId: billingDoneCheckbox, value: true });
            soRec.save();

            log.audit('Sales Order Processed', {
                salesOrderId: soId,
                salesOrderNumber: soNumber,
                status: 'Billing schedules created and marked as done.'
            });

        } catch (e) {
            log.error('Error processing SO ID: ' + soId, e);
        }
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce
    };
});
