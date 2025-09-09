/**
 * Copyright (c) 2025 Balsam, Inc.
 * All Rights Reserved.
 *
 * Script Name: BB|Create Fulfill and Reverse Inventory
 * Description: This Map/Reduce script automates the creation of Item Fulfillments and reverses inventory adjustments 
 *              for migrated Sales Orders where custbody_bpc_bb_migrated = 'Y', using JSON data from custcol_bpc_bb_if_json at line level.
 *              Matches Sales Order lines to Item Fulfillment lines using the SO's line field and fulfillment's orderline field, with fallback to item ID matching.
 *
 * Version History:
 * | Version | Date       | Author           | Remarks                                  |
 * |---------|------------|------------------|------------------------------------------|
 * | 1.0     | 2025-08-06 | Himanshu Kumar   | Create Fulfillment and Reverse Inventory Adjustments for migrated orders |
 */

/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/log', 'N/error', 'N/format'], function(record, search, log, error, format) {
    function getInputData() {
        log.audit({ title: 'getInputData Started', details: 'Loading saved search customsearch_bb_process_mig_odr' });
        try {
            var searchResult = search.load({ id: 'customsearch_bb_process_mig_odr' });
            return searchResult;
        } catch (e) {
            log.error({ title: 'getInputData Error', details: 'Error loading saved search: ' + e.message });
            throw error.create({ name: 'SEARCH_LOAD_ERROR', message: 'Failed to load saved search: ' + e.message });
        }
    }

    function parseISODateToNetSuiteFormat(isoDateStr) {
        try {
            var datePart = isoDateStr.split('T')[0];
            var dateParts = datePart.split('-');
            if (dateParts.length !== 3) throw new Error('Invalid date format: ' + isoDateStr);
            var year = parseInt(dateParts[0], 10);
            var month = parseInt(dateParts[1], 10);
            var day = parseInt(dateParts[2], 10);
            if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) throw new Error('Invalid date components: ' + isoDateStr);
            var formattedDate = month + '/' + day + '/' + year;
            return formattedDate;
        } catch (e) {
            log.error({ title: 'parseISODateToNetSuiteFormat Error', details: 'Error parsing date: ' + isoDateStr + ', Message: ' + e.message });
            throw e;
        }
    }

    function map(context) {
        log.audit({ title: 'map Started', details: 'Processing SO ID: ' + JSON.parse(context.value).id });
        try {
            var searchResult = JSON.parse(context.value);
            var salesOrderId = searchResult.id;

            var rec = record.load({ type: record.Type.SALES_ORDER, id: salesOrderId, isDynamic: true });
            var isMigrated = rec.getValue({ fieldId: 'custbody_bpc_bb_migrated' });

            if (isMigrated === 'Y' || isMigrated === true) {
                var lineCount = rec.getLineCount({ sublistId: 'item' });
                var hasUnfulfilledLines = false;

                for (var i = 0; i < lineCount; i++) {
                    var isFulfilled = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_bb_item_fullfillment_created', line: i });
                    if (!isFulfilled) {
                        hasUnfulfilledLines = true;
                        var jsonData = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_bpc_bb_if_json', line: i });
                        if (!jsonData) continue;

                        try {
                            var jsonObj = JSON.parse(jsonData);
                            var trackingNo = Array.isArray(jsonObj) && jsonObj.length > 0 ? jsonObj[0].trackingNo : jsonObj.trackingNo;
                            var shipDateStr = Array.isArray(jsonObj) && jsonObj.length > 0 ? jsonObj[0].shipDate : jsonObj.shipDate;
                            var narvarUrl = Array.isArray(jsonObj) && jsonObj.length > 0 ? jsonObj[0].narvarUrl : jsonObj.narvarUrl;
                            var shipmentId = Array.isArray(jsonObj) && jsonObj.length > 0 ? jsonObj[0].shipmentId : jsonObj.shipmentId;

                            if (!trackingNo) continue;

                            var soItemId = rec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                            var soQuantity = rec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i });
                            var soAmount = rec.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i }) || rec.getValue({ fieldId: 'total' }) || 0;
                            var soLineNumber = rec.getSublistValue({ sublistId: 'item', fieldId: 'line', line: i });
                            log.debug({ title: 'map - Sales Order Line', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', Line Number: ' + soLineNumber + ', Item ID: ' + soItemId + ', Quantity: ' + soQuantity + ', Amount: ' + soAmount });

                            if (!soItemId || soQuantity <= 0) continue;

                            var fulfillment = record.transform({
                                fromType: record.Type.SALES_ORDER,
                                fromId: salesOrderId,
                                toType: record.Type.ITEM_FULFILLMENT,
                                isDynamic: false
                            });
                            var fulfillLineCount = fulfillment.getLineCount({ sublistId: 'item' });
                            log.debug({ title: 'map - Transformed to Fulfillment', details: 'SO ID: ' + salesOrderId + ', Fulfillment Line Count: ' + fulfillLineCount });

                            if (fulfillLineCount === 0) {
                                log.error({ title: 'map - No Fulfillment Lines', details: 'SO ID: ' + salesOrderId + ', No lines available in fulfillment' });
                                continue;
                            }

                            if (shipDateStr) {
                                var dateParts = shipDateStr.split('T');
                                var dateComponent = dateParts[0].split('-');
                                var year = parseInt(dateComponent[0], 10);
                                var month = parseInt(dateComponent[1], 10) - 1;
                                var day = parseInt(dateComponent[2], 10);
                                var shipDate = new Date(year, month, day);
                                log.audit({ title: 'shipDate', details: shipDate });
                                fulfillment.setValue({ fieldId: 'trandate', value: shipDate });
                            }

                            var lineMarked = false;
                            var matchedFulfillItemId = null;
                            var matchedLineIndex = -1;

                            // Match by SO's line field and fulfillment's orderline
                            for (var j = 0; j < fulfillLineCount; j++) {
                                var orderLine = fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'orderline', line: j });
                                log.debug({ title: 'map - Fulfillment Line Check', details: 'SO ID: ' + salesOrderId + ', Fulfillment Line: ' + j + ', Order Line: ' + orderLine + ', SO Line Number: ' + soLineNumber });

                                if (orderLine == soLineNumber) {
                                    fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'itemreceive', line: j, value: true });
                                    fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: j, value: soQuantity });
                                    fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'location', line: j, value: 121 });
                                    fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: j, value: soAmount });
                                    if (trackingNo) {
                                        fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'custcol_bpc_bb_tracking_numbers', line: j, value: trackingNo });
                                    }
                                    if (narvarUrl) {
                                        fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'custcol_bb_bpc_narvar_url', line: j, value: narvarUrl });
                                    }
                                    lineMarked = true;
                                    matchedFulfillItemId = fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'item', line: j });
                                    matchedLineIndex = j;
                                    log.debug({ title: 'map - Line Marked by Line Number', details: 'SO ID: ' + salesOrderId + ', Fulfillment Line: ' + j + ', Order Line: ' + orderLine + ', Marked as received, Amount: ' + soAmount });
                                    break;
                                }
                            }

                            // Fallback: Match by item ID if line number doesn't match
                            if (!lineMarked) {
                                for (var j = 0; j < fulfillLineCount; j++) {
                                    var fulfillItemId = fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'item', line: j });
                                    if (fulfillItemId == soItemId) {
                                        fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'itemreceive', line: j, value: true });
                                        fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: j, value: soQuantity });
                                        fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'location', line: j, value: 121 });
                                        fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: j, value: soAmount });
                                        if (trackingNo) {
                                            fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'custcol_bpc_bb_tracking_numbers', line: j, value: trackingNo });
                                        }
                                        if (narvarUrl) {
                                            fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'custcol_bb_bpc_narvar_url', line: j, value: narvarUrl });
                                        }
                                        lineMarked = true;
                                        matchedFulfillItemId = fulfillItemId;
                                        matchedLineIndex = j;
                                        log.debug({ title: 'map - Line Marked by Item ID', details: 'SO ID: ' + salesOrderId + ', Fulfillment Line: ' + j + ', Item ID: ' + fulfillItemId + ', Marked as received, Amount: ' + soAmount });
                                        break;
                                    }
                                }
                            }

                            // Fallback for single-line fulfillment
                            if (!lineMarked && fulfillLineCount === 1) {
                                var j = 0;
                                log.audit({ title: 'map - Single Line Fallback', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', Using first fulfillment line due to single line' });
                                fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'itemreceive', line: j, value: true });
                                fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: j, value: soQuantity });
                                fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'location', line: j, value: 121 });
                                fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: j, value: soAmount });
                                if (trackingNo) {
                                    fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'custcol_bpc_bb_tracking_numbers', line: j, value: trackingNo });
                                }
                                if (narvarUrl) {
                                    fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'custcol_bb_bpc_narvar_url', line: j, value: narvarUrl });
                                }
                                lineMarked = true;
                                matchedFulfillItemId = fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'item', line: j });
                                matchedLineIndex = j;
                            }

                            if (lineMarked) {
                                fulfillment.setValue({ fieldId: 'shipstatus', value: 'C' });
                                if (shipmentId) {
                                    fulfillment.setValue({ fieldId: 'memo', value: shipmentId });
                                }

                                var totalAmount = rec.getValue({ fieldId: 'total' }) || soAmount;
                                fulfillment.setValue({ fieldId: 'total', value: totalAmount });
                                log.debug({ title: 'map - Set Header Amount', details: 'SO ID: ' + salesOrderId + ', Total Amount: ' + totalAmount });

                                try {
                                    var fulfillmentId = fulfillment.save();
                                    log.debug({ title: 'map - Fulfillment Created', details: 'SO ID: ' + salesOrderId + ', Fulfillment ID: ' + fulfillmentId });
                                    context.write({
                                        key: fulfillmentId,
                                        value: { salesOrderId: salesOrderId, lineCount: fulfillLineCount, lineIndex: i, itemId: soItemId, quantity: soQuantity, fulfillItemId: matchedFulfillItemId }
                                    });
                                } catch (saveError) {
                                    log.error({ title: 'map - Fulfillment Save Error', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', Error: ' + saveError.message });
                                    continue;
                                }
                            } else {
                                log.error({ title: 'map - No Matching Line', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', SO Line Number: ' + soLineNumber + ', SO Item ID: ' + soItemId + ', No matching orderline or item ID found in fulfillment' });
                            }
                        } catch (jsonError) {
                            log.error({ title: 'map - JSON Parse Error', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', Error: ' + jsonError.message });
                        }
                    }
                }

                if (!hasUnfulfilledLines) {
                    log.debug({ title: 'map - Skipped', details: 'SO ID: ' + salesOrderId + ' has no unfulfilled lines' });
                }
            }
        } catch (e) {
            log.error({ title: 'map Error', details: 'Error: ' + e.message + ', Stack: ' + e.stack });
        }
    }

    function reduce(context) {
        log.audit({ title: 'reduce Started', details: 'Processing Fulfillment ID: ' + context.key });
        try {
            var fulfillmentId = context.key;
            var value = JSON.parse(context.values[0]);
            var salesOrderId = value.salesOrderId;
            var fulfillLineCount = value.lineCount;
            var lineIndex = value.lineIndex;
            var itemId = value.itemId;
            var quantity = value.quantity;
            var fulfillItemId = value.fulfillItemId;

            var fulfillmentRec = record.load({ type: record.Type.ITEM_FULFILLMENT, id: fulfillmentId, isDynamic: true });
            var soRecord = record.load({ type: record.Type.SALES_ORDER, id: salesOrderId, isDynamic: true });
            var isMigrated = soRecord.getValue({ fieldId: 'custbody_bpc_bb_migrated' });

            if ((isMigrated === 'Y' || isMigrated === true) && !fulfillmentRec.getValue({ fieldId: 'custbody_inv_reversal_created' })) {
                var adjustment = record.create({ type: record.Type.INVENTORY_ADJUSTMENT, isDynamic: true });
                log.debug({ title: 'reduce - Adjustment Created', details: 'For Fulfillment ID: ' + fulfillmentId });

                var fulfillDate = fulfillmentRec.getValue({ fieldId: 'trandate' });
                adjustment.setValue({ fieldId: 'trandate', value: fulfillDate });
                adjustment.setValue({ fieldId: 'subsidiary', value: 4 });
                adjustment.setValue({ fieldId: 'account', value: 536 });
                adjustment.setValue({ fieldId: 'adjlocation', value: 121 });

                var soLineCount = soRecord.getLineCount({ sublistId: 'item' });
                var adjustmentMade = false;
                for (var i = 0; i < Math.min(fulfillLineCount, soLineCount); i++) {
                    soRecord.selectLine({ sublistId: 'item', line: i });
                    var soItem = soRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item' });
                    // Use fulfillItemId for adjustment to match fulfillment's item
                    if (i === lineIndex && (soItem === itemId || soItem === fulfillItemId)) {
                        adjustment.selectNewLine({ sublistId: 'inventory' });
                        adjustment.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'item', value: fulfillItemId || soItem });
                        adjustment.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'location', value: 121 });
                        adjustment.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'adjustqtyby', value: quantity });
                        adjustment.commitLine({ sublistId: 'inventory' });
                        log.debug({ title: 'reduce - Line Processed', details: 'Item: ' + (fulfillItemId || soItem) + ', Qty: ' + quantity });
                        adjustmentMade = true;

                        soRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_bb_item_fullfillment_created', value: true });
                        soRecord.commitLine({ sublistId: 'item' });
                    }
                }

                if (adjustmentMade) {
                    var adjustmentId = adjustment.save();
                    log.debug({ title: 'reduce - Adjustment Saved', details: 'Adjustment ID: ' + adjustmentId });
                    soRecord.save();
                    log.debug({ title: 'reduce - SO Updated', details: 'SO ID: ' + salesOrderId + ', Line: ' + lineIndex });
                    fulfillmentRec.setValue({ fieldId: 'custbody_inv_reversal_created', value: true });
                    fulfillmentRec.save();
                    log.debug({ title: 'reduce - Fulfillment Updated', details: 'Fulfillment ID: ' + fulfillmentId });
                } else {
                    log.debug({ title: 'reduce - Skipped Adjustment', details: 'No valid lines for adjustment, Fulfillment ID: ' + fulfillmentId });
                }
            }
        } catch (e) {
            log.error({ title: 'reduce Error', details: 'Error: ' + e.message + ', Stack: ' + e.stack });
        }
    }

    function summarize(summary) {
        log.audit({ title: 'summarize Started', details: 'Summarizing execution' });
        var skippedLines = 0;
        var noMatchingLines = 0;
        summary.mapSummary.errors.iterator().each(function(key, error) {
            if (error.includes('No JSON Data')) skippedLines++;
            else if (error.includes('No Matching Line')) noMatchingLines++;
            return true;
        });
        log.audit({ title: 'summarize Completed', details: 'Summary logged, Skipped Lines due to missing JSON: ' + skippedLines + ', No Matching Lines: ' + noMatchingLines });
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});


//---------------------//

/**
 * Copyright (c) 2025 Balsam, Inc.
 * All Rights Reserved.
 *
 * Script Name: BB|Create Fulfill and Reverse Inventory
 * Description: This Map/Reduce script automates the creation of Item Fulfillments and reverses inventory adjustments 
 *              for migrated Sales Orders where custbody_bpc_bb_migrated = 'Y', using JSON data from custcol_bpc_bb_if_json at line level.
 *              Matches Sales Order lines to Item Fulfillment lines using the SO's line field and fulfillment's orderline field, 
 *              and populates fulfillment details only for lines with JSON data.
 *
 * Version History:
 * | Version | Date       | Author           | Remarks                                  |
 * |---------|------------|------------------|------------------------------------------|
 * | 1.0     | 2025-08-06 | Himanshu Kumar   | Create Fulfillment and Reverse Inventory Adjustments for migrated orders |
 */

/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/log', 'N/error', 'N/format'], function(record, search, log, error, format) {
    function getInputData() {
        log.audit({ title: 'getInputData Started', details: 'Loading saved search customsearch_bb_process_mig_odr' });
        try {
            var searchResult = search.load({ id: 'customsearch_bb_process_mig_odr' });
            return searchResult;
        } catch (e) {
            log.error({ title: 'getInputData Error', details: 'Error loading saved search: ' + e.message });
            throw error.create({ name: 'SEARCH_LOAD_ERROR', message: 'Failed to load saved search: ' + e.message });
        }
    }

    function parseISODateToNetSuiteFormat(isoDateStr) {
        try {
            var datePart = isoDateStr.split('T')[0];
            var dateParts = datePart.split('-');
            if (dateParts.length !== 3) throw new Error('Invalid date format: ' + isoDateStr);
            var year = parseInt(dateParts[0], 10);
            var month = parseInt(dateParts[1], 10);
            var day = parseInt(dateParts[2], 10);
            if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) throw new Error('Invalid date components: ' + isoDateStr);
            var formattedDate = month + '/' + day + '/' + year;
            return formattedDate;
        } catch (e) {
            log.error({ title: 'parseISODateToNetSuiteFormat Error', details: 'Error parsing date: ' + isoDateStr + ', Message: ' + e.message });
            throw e;
        }
    }

    function map(context) {
        log.audit({ title: 'map Started', details: 'Processing SO ID: ' + JSON.parse(context.value).id });
        try {
            var searchResult = JSON.parse(context.value);
            var salesOrderId = searchResult.id;

            var rec = record.load({ type: record.Type.SALES_ORDER, id: salesOrderId, isDynamic: true });
            var isMigrated = rec.getValue({ fieldId: 'custbody_bpc_bb_migrated' });

            if (isMigrated === 'Y' || isMigrated === true) {
                var lineCount = rec.getLineCount({ sublistId: 'item' });
                var hasUnfulfilledLines = false;

                for (var i = 0; i < lineCount; i++) {
                    var isFulfilled = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_bb_item_fullfillment_created', line: i });
                    var jsonData = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_bpc_bb_if_json', line: i });

                    // Only process lines that are unfulfilled and have JSON data
                    if (!isFulfilled && jsonData) {
                        hasUnfulfilledLines = true;
                        try {
                            var jsonObj = JSON.parse(jsonData);
                            var trackingNo = Array.isArray(jsonObj) && jsonObj.length > 0 ? jsonObj[0].trackingNo : jsonObj.trackingNo;
                            var shipDateStr = Array.isArray(jsonObj) && jsonObj.length > 0 ? jsonObj[0].shipDate : jsonObj.shipDate;
                            var narvarUrl = Array.isArray(jsonObj) && jsonObj.length > 0 ? jsonObj[0].narvarUrl : jsonObj.narvarUrl;
                            var shipmentId = Array.isArray(jsonObj) && jsonObj.length > 0 ? jsonObj[0].shipmentId : jsonObj.shipmentId;

                            if (!trackingNo) {
                                log.debug({ title: 'map - Skipping Line', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', No tracking number found in JSON' });
                                continue;
                            }

                            var soItemId = rec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                            var soQuantity = rec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i });
                            var soAmount = rec.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i }) || rec.getValue({ fieldId: 'total' }) || 0;
                            var soLineNumber = rec.getSublistValue({ sublistId: 'item', fieldId: 'line', line: i });
                            log.debug({ title: 'map - Sales Order Line', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', Line Number: ' + soLineNumber + ', Item ID: ' + soItemId + ', Quantity: ' + soQuantity + ', Amount: ' + soAmount });

                            if (!soItemId || soQuantity <= 0) {
                                log.debug({ title: 'map - Skipping Line', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', Invalid item ID or quantity' });
                                continue;
                            }

                            var fulfillment = record.transform({
                                fromType: record.Type.SALES_ORDER,
                                fromId: salesOrderId,
                                toType: record.Type.ITEM_FULFILLMENT,
                                isDynamic: false
                            });
                            var fulfillLineCount = fulfillment.getLineCount({ sublistId: 'item' });
                            log.debug({ title: 'map - Transformed to Fulfillment', details: 'SO ID: ' + salesOrderId + ', Fulfillment Line Count: ' + fulfillLineCount });

                            if (fulfillLineCount === 0) {
                                log.error({ title: 'map - No Fulfillment Lines', details: 'SO ID: ' + salesOrderId + ', No lines available in fulfillment' });
                                continue;
                            }

                            if (shipDateStr) {
                                var dateParts = shipDateStr.split('T');
                                var dateComponent = dateParts[0].split('-');
                                var year = parseInt(dateComponent[0], 10);
                                var month = parseInt(dateComponent[1], 10) - 1;
                                var day = parseInt(dateComponent[2], 10);
                                var shipDate = new Date(year, month, day);
                                log.audit({ title: 'shipDate', details: shipDate });
                                fulfillment.setValue({ fieldId: 'trandate', value: shipDate });
                            }

                            var lineMarked = false;
                            var matchedFulfillItemId = null;
                            var matchedLineIndex = -1;

                            // Match SO line to fulfillment line by line ID only
                            for (var j = 0; j < fulfillLineCount; j++) {
                                var orderLine = fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'orderline', line: j });
                                log.debug({ title: 'map - Fulfillment Line Check', details: 'SO ID: ' + salesOrderId + ', Fulfillment Line: ' + j + ', Order Line: ' + orderLine + ', SO Line Number: ' + soLineNumber });

                                if (orderLine == soLineNumber) {
                                    fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'itemreceive', line: j, value: true });
                                    fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'quantity', line: j, value: soQuantity });
                                    fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'location', line: j, value: 121 });
                                    fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'amount', line: j, value: soAmount });
                                    if (trackingNo) {
                                        fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'custcol_bpc_bb_tracking_numbers', line: j, value: trackingNo });
                                    }
                                    if (narvarUrl) {
                                        fulfillment.setSublistValue({ sublistId: 'item', fieldId: 'custcol_bb_bpc_narvar_url', line: j, value: narvarUrl });
                                    }
                                    lineMarked = true;
                                    matchedFulfillItemId = fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'item', line: j });
                                    matchedLineIndex = j;
                                    log.debug({ title: 'map - Line Marked by Line Number', details: 'SO ID: ' + salesOrderId + ', Fulfillment Line: ' + j + ', Order Line: ' + orderLine + ', Marked as received, Amount: ' + soAmount });
                                    break;
                                }
                            }

                            if (lineMarked) {
                                fulfillment.setValue({ fieldId: 'shipstatus', value: 'C' });
                                if (shipmentId) {
                                    fulfillment.setValue({ fieldId: 'memo', value: shipmentId });
                                }

                                var totalAmount = rec.getValue({ fieldId: 'total' }) || soAmount;
                                fulfillment.setValue({ fieldId: 'total', value: totalAmount });
                                log.debug({ title: 'map - Set Header Amount', details: 'SO ID: ' + salesOrderId + ', Total Amount: ' + totalAmount });

                                try {
                                    var fulfillmentId = fulfillment.save();
                                    log.debug({ title: 'map - Fulfillment Created', details: 'SO ID: ' + salesOrderId + ', Fulfillment ID: ' + fulfillmentId });
                                    context.write({
                                        key: fulfillmentId,
                                        value: { salesOrderId: salesOrderId, lineCount: fulfillLineCount, lineIndex: i, itemId: soItemId, quantity: soQuantity, fulfillItemId: matchedFulfillItemId }
                                    });
                                } catch (saveError) {
                                    log.error({ title: 'map - Fulfillment Save Error', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', Error: ' + saveError.message });
                                    continue;
                                }
                            } else {
                                log.error({ title: 'map - No Matching Line', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', SO Line Number: ' + soLineNumber + ', SO Item ID: ' + soItemId + ', No matching orderline found in fulfillment' });
                            }
                        } catch (jsonError) {
                            log.error({ title: 'map - JSON Parse Error', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', Error: ' + jsonError.message });
                        }
                    }
                }

                if (!hasUnfulfilledLines) {
                    log.debug({ title: 'map - Skipped', details: 'SO ID: ' + salesOrderId + ' has no unfulfilled lines with JSON data' });
                }
            }
        } catch (e) {
            log.error({ title: 'map Error', details: 'Error: ' + e.message + ', Stack: ' + e.stack });
        }
    }

    function reduce(context) {
        log.audit({ title: 'reduce Started', details: 'Processing Fulfillment ID: ' + context.key });
        try {
            var fulfillmentId = context.key;
            var value = JSON.parse(context.values[0]);
            var salesOrderId = value.salesOrderId;
            var fulfillLineCount = value.lineCount;
            var lineIndex = value.lineIndex;
            var itemId = value.itemId;
            var quantity = value.quantity;
            var fulfillItemId = value.fulfillItemId;

            var fulfillmentRec = record.load({ type: record.Type.ITEM_FULFILLMENT, id: fulfillmentId, isDynamic: true });
            var soRecord = record.load({ type: record.Type.SALES_ORDER, id: salesOrderId, isDynamic: true });
            var isMigrated = soRecord.getValue({ fieldId: 'custbody_bpc_bb_migrated' });

            if ((isMigrated === 'Y' || isMigrated === true) && !fulfillmentRec.getValue({ fieldId: 'custbody_inv_reversal_created' })) {
                var adjustment = record.create({ type: record.Type.INVENTORY_ADJUSTMENT, isDynamic: true });
                log.debug({ title: 'reduce - Adjustment Created', details: 'For Fulfillment ID: ' + fulfillmentId });

                var fulfillDate = fulfillmentRec.getValue({ fieldId: 'trandate' });
                adjustment.setValue({ fieldId: 'trandate', value: fulfillDate });
                adjustment.setValue({ fieldId: 'subsidiary', value: 4 });
                adjustment.setValue({ fieldId: 'account', value: 536 });
                adjustment.setValue({ fieldId: 'adjlocation', value: 121 });

                var soLineCount = soRecord.getLineCount({ sublistId: 'item' });
                var adjustmentMade = false;
                for (var i = 0; i < Math.min(fulfillLineCount, soLineCount); i++) {
                    soRecord.selectLine({ sublistId: 'item', line: i });
                    var soItem = soRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item' });
                    if (i === lineIndex && (soItem === itemId || soItem === fulfillItemId)) {
                        adjustment.selectNewLine({ sublistId: 'inventory' });
                        adjustment.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'item', value: fulfillItemId || soItem });
                        adjustment.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'location', value: 121 });
                        adjustment.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'adjustqtyby', value: quantity });
                        adjustment.commitLine({ sublistId: 'inventory' });
                        log.debug({ title: 'reduce - Line Processed', details: 'Item: ' + (fulfillItemId || soItem) + ', Qty: ' + quantity });
                        adjustmentMade = true;

                        soRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_bb_item_fullfillment_created', value: true });
                        soRecord.commitLine({ sublistId: 'item' });
                    }
                }

                if (adjustmentMade) {
                    var adjustmentId = adjustment.save();
                    log.debug({ title: 'reduce - Adjustment Saved', details: 'Adjustment ID: ' + adjustmentId });
                    soRecord.save();
                    log.debug({ title: 'reduce - SO Updated', details: 'SO ID: ' + salesOrderId + ', Line: ' + lineIndex });
                    fulfillmentRec.setValue({ fieldId: 'custbody_inv_reversal_created', value: true });
                    fulfillmentRec.save();
                    log.debug({ title: 'reduce - Fulfillment Updated', details: 'Fulfillment ID: ' + fulfillmentId });
                } else {
                    log.debug({ title: 'reduce - Skipped Adjustment', details: 'No valid lines for adjustment, Fulfillment ID: ' + fulfillmentId });
                }
            }
        } catch (e) {
            log.error({ title: 'reduce Error', details: 'Error: ' + e.message + ', Stack: ' + e.stack });
        }
    }

    function summarize(summary) {
        log.audit({ title: 'summarize Started', details: 'Summarizing execution' });
        var skippedLines = 0;
        var noMatchingLines = 0;
        summary.mapSummary.errors.iterator().each(function(key, error) {
            if (error.includes('No JSON Data')) skippedLines++;
            else if (error.includes('No Matching Line')) noMatchingLines++;
            return true;
        });
        log.audit({ title: 'summarize Completed', details: 'Summary logged, Skipped Lines due to missing JSON: ' + skippedLines + ', No Matching Lines: ' + noMatchingLines });
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});