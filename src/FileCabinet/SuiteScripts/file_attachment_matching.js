/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/file', 'N/log', 'N/runtime'], function (search, record, file, log, runtime) {

    const CUSTOM_RECORD_ID = 'customrecord_record_attachment';
    const ATTACHMENT_FIELD_ID = 'custrecord_imc_bill_file_attachment';
    const RELATED_TRANSACTION_FIELD_ID = 'custrecord_imc_bill_related_transaction';

    let csvRows = [];

    const getInputData = () => {
        return search.create({
            type: CUSTOM_RECORD_ID,
            filters: [],
            columns: [
                'internalid',
                ATTACHMENT_FIELD_ID,
                RELATED_TRANSACTION_FIELD_ID
            ]
        });
    };

    const map = (context) => {
        const result = JSON.parse(context.value);
        const customRecordId = result.id;
        const attachmentFileName = result.values[ATTACHMENT_FIELD_ID];
        const relatedTxnId = result.values[RELATED_TRANSACTION_FIELD_ID]?.value;

        let matchResult = 'false';

        if (!relatedTxnId || !attachmentFileName) {
            log.debug(`Skipping record ${customRecordId}`, 'Missing related transaction or attachment name');
        } else {
            try {
                const txnRecord = record.load({
                    type: record.Type.VENDOR_BILL,
                    id: relatedTxnId
                });

                const lineCount = txnRecord.getLineCount({ sublistId: 'file' });

                for (let i = 0; i < lineCount; i++) {
                    const fileName = txnRecord.getSublistValue({
                        sublistId: 'file',
                        fieldId: 'name',
                        line: i
                    });

                    if (fileName && fileName.trim() === attachmentFileName.trim()) {
                        matchResult = 'true';
                        break;
                    }
                }

            } catch (error) {
                log.error(`Error loading vendor bill ${relatedTxnId}`, error.message);
            }
        }

        // Send CSV row to reduce stage
        context.write({
            key: customRecordId,
            value: `${customRecordId},${attachmentFileName},${relatedTxnId},${matchResult}`
        });
    };

    const reduce = (context) => {
        csvRows.push(context.values[0]); // values is an array, we take the first since we only output 1 row per key
    };

    const summarize = (summary) => {
        const header = 'Custom Record ID,Attachment Name,Related Transaction ID,Match Result';
        const csvContent = [header, ...csvRows].join('\n');

        const outputFile = file.create({
            name: `Attachment_Match_Report_${new Date().toISOString().slice(0, 10)}.csv`,
            fileType: file.Type.CSV,
            contents: csvContent,
            folder: -15 // SuiteScripts folder
        });

        const fileId = outputFile.save();

        log.audit('CSV Report Saved', `File ID: ${fileId}`);
    };

    return { getInputData, map, reduce, summarize };
});
