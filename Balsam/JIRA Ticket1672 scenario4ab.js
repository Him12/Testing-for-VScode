/**
 * Copyright (c) 2025 Balsam, Inc.
 * All Rights Reserved.
 *
 * Script Name: BB|Create Fulfill and Reverse Inventory
 * Description: This Map/Reduce script automates the creation of Item Fulfillments and reverses inventory adjustments 
 *              for migrated Sales Orders where custbody_bpc_bb_migrated = 'Y', using JSON data from custcol_bpc_bb_if_json at line level.
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

define(['N/record', 'N/search', 'N/log', 'N/error', 'N/format'], function (record, search, log, error, format) {

    function getInputData() {
        log.audit({ title: 'getInputData Started', details: 'Loading saved search customsearch_bb_process_mig_odr' });
        try {
            var searchResult = search.load({
                id: 'customsearch_bb_process_mig_odr'
            });
            log.debug({ title: 'getInputData Completed', details: 'Saved search loaded successfully' });
            return searchResult;
        } catch (e) {
            log.error({ title: 'getInputData Error', details: 'Error loading saved search: ' + e.message });
            throw error.create({
                name: 'SEARCH_LOAD_ERROR',
                message: 'Failed to load saved search: ' + e.message
            });
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
            log.debug({ title: 'parseISODateToNetSuiteFormat', details: 'Input: ' + isoDateStr + ', Output: ' + formattedDate });
            return formattedDate;
        } catch (e) {
            log.error({ title: 'parseISODateToNetSuiteFormat Error', details: 'Error parsing date: ' + isoDateStr + ', Message: ' + e.message });
            throw e;
        }
    }

    function getKitComponents(itemId) {
        try {
            var itemRec = record.load({ type: record.Type.KIT_ITEM, id: itemId, isDynamic: false });
            var components = [];
            var lineCount = itemRec.getLineCount({ sublistId: 'member' });
            for (var i = 0; i < lineCount; i++) {
                var componentId = itemRec.getSublistValue({ sublistId: 'member', fieldId: 'item', line: i });
                components.push(componentId);
            }
            log.debug({ title: 'getKitComponents', details: 'Item ID: ' + itemId + ', Components: ' + JSON.stringify(components) });
            return components;
        } catch (e) {
            log.debug({ title: 'getKitComponents', details: 'Item ID: ' + itemId + ' is not a kit item or error: ' + e.message });
            return [];
        }
    }

    function normalizeItemName(itemName) {
        // Remove prefixes like "4003122 : 196041010600" and trim
        return itemName.replace(/^\d+\s*:\s*\d+\s*:/, '').replace(/:\s*Carton\s*\d+$/, '').trim();
    }

    function map(context) {
        log.audit({ title: 'map Started', details: 'Processing context: ' + JSON.stringify(context) });
        try {
            var searchResult = JSON.parse(context.value);
            var salesOrderId = searchResult.id;
            log.debug({ title: 'map - Parsed Search Result', details: 'SO ID: ' + salesOrderId });

            var rec = record.load({
                type: record.Type.SALES_ORDER,
                id: salesOrderId,
                isDynamic: true
            });
            log.debug({ title: 'map - Record Loaded', details: 'SO ID: ' + salesOrderId });

            var isMigrated = rec.getValue({ fieldId: 'custbody_bpc_bb_migrated' });
            log.debug({ title: 'map - Retrieved Header Fields', details: 'SO ID: ' + salesOrderId + ', isMigrated: ' + isMigrated });

            if (isMigrated === 'Y' || isMigrated === true) {
                var lineCount = rec.getLineCount({ sublistId: 'item' });
                var hasUnfulfilledLines = false;

                for (var i = 0; i < lineCount; i++) {
                    var isFulfilled = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_bb_item_fullfillment_created', line: i });
                    if (!isFulfilled) {
                        hasUnfulfilledLines = true;
                        var jsonData = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_bpc_bb_if_json', line: i });
                        log.debug({ title: 'map - Line Check', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', jsonData: ' + jsonData });

                        if (!jsonData) {
                            log.debug({ title: 'map - No JSON Data', details: 'SO ID: ' + salesOrderId + ', Line: ' + i });
                            continue;
                        }

                        try {
                            var jsonObj = JSON.parse(jsonData);
                            var trackingNo = Array.isArray(jsonObj) && jsonObj.length > 0 ? jsonObj[0].trackingNo : jsonObj.trackingNo;
                            var shipDateStr = Array.isArray(jsonObj) && jsonObj.length > 0 ? jsonObj[0].shipDate : jsonObj.shipDate;
                            var narvarUrl = Array.isArray(jsonObj) && jsonObj.length > 0 ? jsonObj[0].narvarUrl : jsonObj.narvarUrl;
                            var shipmentId = Array.isArray(jsonObj) && jsonObj.length > 0 ? jsonObj[0].shipmentId : jsonObj.shipmentId;
                            log.debug({ title: 'map - Parsed JSON', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', trackingNo: ' + trackingNo + ', narvarUrl: ' + narvarUrl + ', shipmentId: ' + shipmentId });

                            if (!trackingNo) {
                                log.debug({ title: 'map - Missing Tracking Number', details: 'SO ID: ' + salesOrderId + ', Line: ' + i });
                                continue;
                            }

                            var soItemId = rec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                            var soItemNameFull = rec.getSublistText({ sublistId: 'item', fieldId: 'item', line: i });
                            var soItemName = normalizeItemName(soItemNameFull);
                            var soQuantity = rec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i });
                            var soAmount = rec.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i }) || rec.getValue({ fieldId: 'total' }) || 0;
                            var createPO = rec.getSublistValue({ sublistId: 'item', fieldId: 'createpo', line: i });
                            log.debug({ title: 'map - Sales Order Line', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', Item ID: ' + soItemId + ', Item Name: ' + soItemName + ', Quantity: ' + soQuantity + ', Amount: ' + soAmount + ', Create PO: ' + createPO });

                            if (!soItemId || soQuantity <= 0) {
                                log.debug({ title: 'map - Invalid Line', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', Invalid item or quantity' });
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
                                log.audit('shipDate', shipDate);
                                fulfillment.setValue({ fieldId: 'trandate', value: shipDate });
                            }

                            var fulfillItems = [];
                            for (var j = 0; j < fulfillLineCount; j++) {
                                var fulfillItemId = fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'item', line: j });
                                var fulfillItemName = fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'displayname', line: j }) || '';
                                var fulfillQuantity = fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: j });
                                fulfillItems.push({ line: j, itemId: fulfillItemId, itemName: normalizeItemName(fulfillItemName), quantity: fulfillQuantity });
                            }
                            log.debug({ title: 'map - All Fulfillment Lines', details: 'SO ID: ' + salesOrderId + ', Fulfillment Items: ' + JSON.stringify(fulfillItems) });

                            var lineMarked = false;
                            var matchedFulfillItemId = null;
                            var matchedLineIndex = -1;

                            // Match by item name
                            for (var j = 0; j < fulfillLineCount; j++) {
                                var fulfillItemName = fulfillItems[j].itemName;
                                log.debug({ title: 'map - Fulfillment Line Check', details: 'SO ID: ' + salesOrderId + ', Fulfillment Line: ' + j + ', Item Name: ' + fulfillItemName + ', SO Item Name: ' + soItemName });

                                if (fulfillItemName === soItemName) {
                                    fulfillment.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'itemreceive',
                                        line: j,
                                        value: true
                                    });
                                    fulfillment.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'quantity',
                                        line: j,
                                        value: soQuantity
                                    });
                                    fulfillment.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'location',
                                        line: j,
                                        value: 121
                                    });
                                    fulfillment.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'amount',
                                        line: j,
                                        value: soAmount
                                    });
                                    if (trackingNo) {
                                        fulfillment.setSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'custcol_bpc_bb_tracking_numbers',
                                            line: j,
                                            value: trackingNo
                                        });
                                        var lineTrackingNo = fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'custcol_bpc_bb_tracking_numbers', line: j });
                                        log.debug({ title: 'map - Set Line Tracking Number', details: 'SO ID: ' + salesOrderId + ', Line: ' + j + ', Tracking Number: ' + trackingNo + ', Verified: ' + lineTrackingNo });
                                    }
                                    if (narvarUrl) {
                                        fulfillment.setSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'custcol_bb_bpc_narvar_url',
                                            line: j,
                                            value: narvarUrl
                                        });
                                        var lineNarvarUrl = fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'custcol_bb_bpc_narvar_url', line: j });
                                        log.debug({ title: 'map - Set Line Narvar URL', details: 'SO ID: ' + salesOrderId + ', Line: ' + j + ', Narvar URL: ' + narvarUrl + ', Verified: ' + lineNarvarUrl });
                                    }
                                    lineMarked = true;
                                    matchedFulfillItemId = fulfillItems[j].itemId;
                                    matchedLineIndex = j;
                                    log.debug({ title: 'map - Line Marked by Name', details: 'SO ID: ' + salesOrderId + ', Fulfillment Line: ' + j + ', Item Name: ' + fulfillItemName + ', Marked as received, Amount: ' + soAmount });
                                    break;
                                }
                            }

                            // Fallback: Use the first line if no match and drop-ship scenario
                            if (!lineMarked && fulfillLineCount === 1 && !createPO) {
                                log.audit({ title: 'map - Fallback Used', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', No matching item, using first fulfillment line (Item Name: ' + fulfillItems[0].itemName + ') due to drop-ship' });
                                var j = 0;
                                fulfillment.setSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'itemreceive',
                                    line: j,
                                    value: true
                                });
                                fulfillment.setSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'quantity',
                                    line: j,
                                    value: soQuantity
                                });
                                fulfillment.setSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'location',
                                    line: j,
                                    value: 121
                                });
                                fulfillment.setSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'amount',
                                    line: j,
                                    value: soAmount
                                });
                                if (trackingNo) {
                                    fulfillment.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'custcol_bpc_bb_tracking_numbers',
                                        line: j,
                                        value: trackingNo
                                    });
                                    var lineTrackingNo = fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'custcol_bpc_bb_tracking_numbers', line: j });
                                    log.debug({ title: 'map - Set Line Tracking Number (Fallback)', details: 'SO ID: ' + salesOrderId + ', Line: ' + j + ', Tracking Number: ' + trackingNo + ', Verified: ' + lineTrackingNo });
                                }
                                if (narvarUrl) {
                                    fulfillment.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'custcol_bb_bpc_narvar_url',
                                        line: j,
                                        value: narvarUrl
                                    });
                                    var lineNarvarUrl = fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'custcol_bb_bpc_narvar_url', line: j });
                                    log.debug({ title: 'map - Set Line Narvar URL (Fallback)', details: 'SO ID: ' + salesOrderId + ', Line: ' + j + ', Narvar URL: ' + narvarUrl + ', Verified: ' + lineNarvarUrl });
                                }
                                lineMarked = true;
                                matchedFulfillItemId = fulfillItems[j].itemId;
                                matchedLineIndex = j;
                            }

                            if (lineMarked) {
                                // Set header-level fields
                                fulfillment.setValue({ fieldId: 'shipstatus', value: 'C' });
                                if (shipmentId) {
                                    fulfillment.setValue({ fieldId: 'memo', value: shipmentId });
                                    var memoSet = fulfillment.getValue({ fieldId: 'memo' });
                                    log.debug({ title: 'map - Set Shipment ID', details: 'SO ID: ' + salesOrderId + ', Shipment ID: ' + shipmentId + ', Verified: ' + memoSet });
                                }

                                // Set header-level amount
                                var totalAmount = rec.getValue({ fieldId: 'total' }) || soAmount;
                                fulfillment.setValue({ fieldId: 'total', value: totalAmount });
                                log.debug({ title: 'map - Set Header Amount', details: 'SO ID: ' + salesOrderId + ', Total Amount: ' + totalAmount });

                                // Verify line-level fields before saving
                                var finalLineTrackingNo = fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'custcol_bpc_bb_tracking_numbers', line: matchedLineIndex });
                                var finalLineNarvarUrl = fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'custcol_bb_bpc_narvar_url', line: matchedLineIndex });
                                var finalLineAmount = fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: matchedLineIndex });
                                log.debug({ title: 'map - Pre-Save Line Verification', details: 'SO ID: ' + salesOrderId + ', Line: ' + matchedLineIndex + ', Tracking Number: ' + finalLineTrackingNo + ', Narvar URL: ' + finalLineNarvarUrl + ', Amount: ' + finalLineAmount });

                                var fulfillmentId = fulfillment.save();
                                log.debug({ title: 'map - Fulfillment Created', details: 'SO ID: ' + salesOrderId + ', Fulfillment ID: ' + fulfillmentId });

                                // Verify after save
                                var savedFulfillment = record.load({
                                    type: record.Type.ITEM_FULFILLMENT,
                                    id: fulfillmentId,
                                    isDynamic: false
                                });
                                var savedLineCount = savedFulfillment.getLineCount({ sublistId: 'item' });
                                var savedTrackingNo, savedNarvarUrl, savedAmount;
                                for (var k = 0; k < savedLineCount; k++) {
                                    if (savedFulfillment.getSublistValue({ sublistId: 'item', fieldId: 'item', line: k }) === matchedFulfillItemId) {
                                        savedTrackingNo = savedFulfillment.getSublistValue({ sublistId: 'item', fieldId: 'custcol_bpc_bb_tracking_numbers', line: k });
                                        savedNarvarUrl = savedFulfillment.getSublistValue({ sublistId: 'item', fieldId: 'custcol_bb_bpc_narvar_url', line: k });
                                        savedAmount = savedFulfillment.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: k });
                                        break;
                                    }
                                }
                                var savedMemo = savedFulfillment.getValue({ fieldId: 'memo' });
                                var savedTotal = savedFulfillment.getValue({ fieldId: 'total' });
                                log.debug({ title: 'map - Post-Save Verification', details: 'SO ID: ' + salesOrderId + ', Fulfillment ID: ' + fulfillmentId + ', Saved Line Tracking Number: ' + savedTrackingNo + ', Saved Line Narvar URL: ' + savedNarvarUrl + ', Saved Line Amount: ' + savedAmount + ', Saved Memo: ' + savedMemo + ', Saved Total: ' + savedTotal });

                                context.write({
                                    key: fulfillmentId,
                                    value: { salesOrderId: salesOrderId, lineCount: fulfillLineCount, lineIndex: i, itemId: soItemId, itemName: soItemName, quantity: soQuantity, fulfillItemId: matchedFulfillItemId }
                                });
                            } else {
                                log.error({ title: 'map - No Matching Line', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', SO Item ID: ' + soItemId + ', SO Item Name: ' + soItemName + ', Fulfillment Items: ' + JSON.stringify(fulfillItems) + ', No matching item found in fulfillment' });
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
        log.audit({ title: 'reduce Started', details: 'Processing context: ' + JSON.stringify(context) });
        try {
            var fulfillmentId = context.key;
            var value = JSON.parse(context.values[0]);
            var salesOrderId = value.salesOrderId;
            var fulfillLineCount = value.lineCount;
            var lineIndex = value.lineIndex;
            var itemId = value.itemId;
            var quantity = value.quantity;
            var fulfillItemId = value.fulfillItemId;
            log.debug({ title: 'reduce - Parsed Context', details: 'Fulfillment ID: ' + fulfillmentId + ', SO ID: ' + salesOrderId + ', Line Index: ' + lineIndex + ', Item ID: ' + itemId + ', Fulfill Item ID: ' + fulfillItemId + ', Quantity: ' + quantity });

            var fulfillmentRec = record.load({
                type: record.Type.ITEM_FULFILLMENT,
                id: fulfillmentId,
                isDynamic: true
            });
            var soRecord = record.load({
                type: record.Type.SALES_ORDER,
                id: salesOrderId,
                isDynamic: true
            });
            log.debug({ title: 'reduce - Records Loaded', details: 'Fulfillment ID: ' + fulfillmentId + ', SO ID: ' + salesOrderId });

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
                    if (i === lineIndex && soItem === itemId) {
                        adjustment.selectNewLine({ sublistId: 'inventory' });
                        adjustment.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'item', value: fulfillItemId || soItem });
                        adjustment.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'location', value: 121 });
                        adjustment.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'adjustqtyby', value: quantity });
                        adjustment.commitLine({ sublistId: 'inventory' });
                        log.debug({ title: 'reduce - Line Processed', details: 'Item: ' + (fulfillItemId || soItem) + ', Qty: ' + quantity });
                        adjustmentMade = true;

                        soRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_bb_item_fullfillment_created',
                            value: true
                        });
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
        summary.mapSummary.errors.iterator().each(function (key, error) {
            if (error.includes('No JSON Data')) {
                skippedLines++;
            } else if (error.includes('No Matching Line')) {
                noMatchingLines++;
            }
            return true;
        });
        log.audit({ title: 'Map/Reduce Summary', details: JSON.stringify(summary) });
        log.audit({ title: 'summarize Completed', details: 'Summary logged, Skipped Lines due to missing JSON: ' + skippedLines + ', No Matching Lines: ' + noMatchingLines });
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});