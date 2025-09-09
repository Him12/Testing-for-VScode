/**
 * Copyright (c) 2025 Balsam, Inc.
 * All Rights Reserved.
 *
 * Script Name: BB|Create Fulfill and Reverse Inventory
 * Description: This Map/Reduce script automates the creation of Item Fulfillments for migrated Sales Orders 
 *              where custbody_bpc_bb_migrated = 'Y', using JSON data from custcol_bpc_bb_if_json at line level.
 *              Groups Sales Order lines by their inventorylocation and creates one Item Fulfillment per unique 
 *              inventorylocation, matching lines to Item Fulfillment lines using the SO's line field and fulfillment's 
 *              orderline field, and populates fulfillment details for all lines with JSON data in one go per location.
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
                var allFulfilled = true;
                var linesByLocation = {};

                // Check if all lines are fulfilled
                for (var i = 0; i < lineCount; i++) {
                    var isFulfilled = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_bb_item_fullfillment_created', line: i });
                    if (!isFulfilled) {
                        allFulfilled = false;
                        break;
                    }
                }
                if (allFulfilled) {
                    log.debug({ title: 'map - Skipped', details: 'SO ID: ' + salesOrderId + ', All lines already fulfilled' });
                    return;
                }

                // Collect lines grouped by inventorylocation
                for (var i = 0; i < lineCount; i++) {
                    var isFulfilled = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_bb_item_fullfillment_created', line: i });
                    var jsonData = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_bpc_bb_if_json', line: i });
                    var locationId = rec.getSublistValue({ sublistId: 'item', fieldId: 'inventorylocation', line: i });

                    if (!isFulfilled && jsonData && locationId) {
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
                            var soAmount = rec.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i }) || 0;
                            var soLineNumber = rec.getSublistValue({ sublistId: 'item', fieldId: 'line', line: i });

                            if (!soItemId || soQuantity <= 0) {
                                log.debug({ title: 'map - Skipping Line', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', Invalid item ID or quantity' });
                                continue;
                            }

                            if (soAmount === 0) {
                                var itemName = rec.getSublistText({ sublistId: 'item', fieldId: 'item', line: i });
                                log.audit({ title: 'map - Warning', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', Item: ' + itemName + ', Amount is 0, verify if correct' });
                            }

                            // Initialize location group if not exists
                            if (!linesByLocation[locationId]) {
                                linesByLocation[locationId] = {
                                    lines: [],
                                    shipDate: null,
                                    shipmentId: null,
                                    totalAmount: 0
                                };
                            }

                            // Parse shipDate if available
                            if (shipDateStr && !linesByLocation[locationId].shipDate) {
                                var dateParts = shipDateStr.split('T');
                                var dateComponent = dateParts[0].split('-');
                                var year = parseInt(dateComponent[0], 10);
                                var month = parseInt(dateComponent[1], 10) - 1;
                                var day = parseInt(dateComponent[2], 10);
                                linesByLocation[locationId].shipDate = new Date(year, month, day);
                            }

                            // Set shipmentId if not already set
                            if (shipmentId && !linesByLocation[locationId].shipmentId) {
                                linesByLocation[locationId].shipmentId = shipmentId;
                            }

                            // Add to total amount
                            linesByLocation[locationId].totalAmount += soAmount;

                            // Add line to location group
                            linesByLocation[locationId].lines.push({
                                lineIndex: i,
                                soLineNumber: soLineNumber,
                                itemId: soItemId,
                                quantity: soQuantity,
                                amount: soAmount,
                                trackingNo: trackingNo,
                                narvarUrl: narvarUrl
                            });

                            log.debug({ title: 'map - Collected Line', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', Inventory Location: ' + locationId + ', Line Number: ' + soLineNumber + ', Item ID: ' + soItemId + ', Quantity: ' + soQuantity + ', Amount: ' + soAmount });
                        } catch (jsonError) {
                            log.error({ title: 'map - JSON Parse Error', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', Error: ' + jsonError.message });
                        }
                    } else {
                        log.debug({ title: 'map - Skipping Line', details: 'SO ID: ' + salesOrderId + ', Line: ' + i + ', Reason: ' + (!jsonData ? 'No JSON data' : 'No inventorylocation') });
                    }
                }

                if (Object.keys(linesByLocation).length === 0) {
                    log.debug({ title: 'map - Skipped', details: 'SO ID: ' + salesOrderId + ' has no unfulfilled lines with JSON data and inventorylocation' });
                    return;
                }

                // Create one fulfillment per inventorylocation
                for (var locationId in linesByLocation) {
                    var locationData = linesByLocation[locationId];
                    var fulfillmentLines = locationData.lines;

                    var fulfillment = record.transform({
                        fromType: record.Type.SALES_ORDER,
                        fromId: salesOrderId,
                        toType: record.Type.ITEM_FULFILLMENT,
                        isDynamic: true,
                        defaultValues: {
                            inventorylocation: locationId // Set inventory location dynamically for the fulfillment
                        }
                    });
                    var fulfillLineCount = fulfillment.getLineCount({ sublistId: 'item' });
                    log.debug({ title: 'map - Transformed to Fulfillment', details: 'SO ID: ' + salesOrderId + ', Inventory Location: ' + locationId + ', Fulfillment Line Count: ' + fulfillLineCount });

                    if (fulfillLineCount === 0) {
                        log.error({ title: 'map - No Fulfillment Lines', details: 'SO ID: ' + salesOrderId + ', Inventory Location: ' + locationId + ', No lines available in fulfillment' });
                        continue;
                    }

                    if (locationData.shipDate) {
                        fulfillment.setValue({ fieldId: 'trandate', value: locationData.shipDate });
                    }

                    var linesMarked = 0;
                    var matchedFulfillItemIds = [];

                    // Log fulfillment order lines for debugging
                    var fulfillmentOrderLines = [];
                    for (var j = 0; j < fulfillLineCount; j++) {
                        var orderLine = fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'orderline', line: j });
                        fulfillmentOrderLines.push(orderLine);
                    }
                    log.debug({ title: 'map - Fulfillment Order Lines', details: 'SO ID: ' + salesOrderId + ', Inventory Location: ' + locationId + ', Order Lines: ' + JSON.stringify(fulfillmentOrderLines) });

                    // Match and set all fulfillment lines for this location
                    for (var i = 0; i < fulfillmentLines.length; i++) {
                        var lineData = fulfillmentLines[i];
                        var soLineNumber = lineData.soLineNumber;

                        var lineMatched = false;
                        for (var j = 0; j < fulfillLineCount; j++) {
                            var orderLine = fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'orderline', line: j });
                            if (orderLine == soLineNumber) {
                                fulfillment.selectLine({ sublistId: 'item', line: j });
                                fulfillment.setCurrentSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: true });
                                fulfillment.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: lineData.quantity });
                                fulfillment.setCurrentSublistValue({ sublistId: 'item', fieldId: 'inventorylocation', value: locationId });
                                fulfillment.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: lineData.amount });
                                if (lineData.trackingNo) {
                                    fulfillment.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_bpc_bb_tracking_numbers', value: lineData.trackingNo });
                                }
                                if (lineData.narvarUrl) {
                                    fulfillment.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_bb_bpc_narvar_url', value: lineData.narvarUrl });
                                }
                                fulfillment.commitLine({ sublistId: 'item' });
                                matchedFulfillItemIds.push({
                                    soLineIndex: lineData.lineIndex,
                                    itemId: lineData.itemId,
                                    fulfillItemId: fulfillment.getSublistValue({ sublistId: 'item', fieldId: 'item', line: j }),
                                    quantity: lineData.quantity
                                });
                                linesMarked++;
                                lineMatched = true;
                                log.debug({ title: 'map - Line Marked', details: 'SO ID: ' + salesOrderId + ', Inventory Location: ' + locationId + ', Fulfillment Line: ' + j + ', Order Line: ' + orderLine + ', Marked as received, Amount: ' + lineData.amount });
                                break;
                            }
                        }
                        if (!lineMatched) {
                            log.error({ title: 'map - No Matching Line', details: 'SO ID: ' + salesOrderId + ', Inventory Location: ' + locationId + ', SO Line Number: ' + soLineNumber + ', No matching orderline found in fulfillment' });
                        }
                    }

                    if (linesMarked > 0) {
                        fulfillment.setValue({ fieldId: 'shipstatus', value: 'C' });
                        if (locationData.shipmentId) {
                            fulfillment.setValue({ fieldId: 'memo', value: locationData.shipmentId });
                        }
                        fulfillment.setValue({ fieldId: 'total', value: locationData.totalAmount });
                        log.debug({ title: 'map - Set Header Amount', details: 'SO ID: ' + salesOrderId + ', Inventory Location: ' + locationId + ', Total Amount: ' + locationData.totalAmount });

                        try {
                            var fulfillmentId = fulfillment.save();
                            log.debug({ title: 'map - Fulfillment Created', details: 'SO ID: ' + salesOrderId + ', Inventory Location: ' + locationId + ', Fulfillment ID: ' + fulfillmentId + ', Lines Processed: ' + linesMarked });
                            context.write({
                                key: fulfillmentId,
                                value: { salesOrderId: salesOrderId, locationId: locationId, lineCount: fulfillLineCount, lines: matchedFulfillItemIds }
                            });
                        } catch (saveError) {
                            log.error({ title: 'map - Fulfillment Save Error', details: 'SO ID: ' + salesOrderId + ', Inventory Location: ' + locationId + ', Error: ' + saveError.message });
                        }
                    } else {
                        log.error({ title: 'map - No Lines Marked', details: 'SO ID: ' + salesOrderId + ', Inventory Location: ' + locationId + ', No lines marked for fulfillment, skipping save' });
                    }
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
            var locationId = value.locationId;
            var lines = value.lines;

            var fulfillmentRec = record.load({ type: record.Type.ITEM_FULFILLMENT, id: fulfillmentId, isDynamic: true });
            var soRecord = record.load({ type: record.Type.SALES_ORDER, id: salesOrderId, isDynamic: true });
            var isMigrated = soRecord.getValue({ fieldId: 'custbody_bpc_bb_migrated' });

            if ((isMigrated === 'Y' || isMigrated === true) && !fulfillmentRec.getValue({ fieldId: 'custbody_inv_reversal_created' })) {
                var adjustment = record.create({ type: record.Type.INVENTORY_ADJUSTMENT, isDynamic: true });
                log.debug({ title: 'reduce - Adjustment Created', details: 'For Fulfillment ID: ' + fulfillmentId + ', Inventory Location: ' + locationId });

                var fulfillDate = fulfillmentRec.getValue({ fieldId: 'trandate' });
                adjustment.setValue({ fieldId: 'trandate', value: fulfillDate });
                var subsidiaryId = soRecord.getValue({ fieldId: 'subsidiary' });
                if (subsidiaryId) {
                    adjustment.setValue({ fieldId: 'subsidiary', value: subsidiaryId });
                } else {
                    log.audit({ title: 'reduce - Warning', details: 'No subsidiary found for SO ID: ' + salesOrderId + ', using default or skipping if required' });
                }
                adjustment.setValue({ fieldId: 'account', value: 952 }); // Account for inventory adjustment
                adjustment.setValue({ fieldId: 'adjlocation', value: locationId });

                // Set address fields from location or SO with fallback
                try {
                    var locationRec = record.load({ type: record.Type.LOCATION, id: locationId });
                    var locationAddress = locationRec.getValue({ fieldId: 'mainaddress_text' });
                    var locationName = locationRec.getText({ fieldId: 'name' });
                    if (locationAddress && locationName) {
                        adjustment.setValue({ fieldId: 'addressee', value: locationName });
                        adjustment.setValue({ fieldId: 'address', value: locationAddress });
                    } else {
                        var shipAddressRec = soRecord.getSubrecord({ fieldId: 'shippingaddress' });
                        var shipAddressee = shipAddressRec ? shipAddressRec.getValue({ fieldId: 'addressee' }) || 'Inventory Adjustment' : 'Inventory Adjustment';
                        var shipAddress = shipAddressRec ? shipAddressRec.getValue({ fieldId: 'addr1' }) || 'Default Adjustment Address' : 'Default Adjustment Address';
                        adjustment.setValue({ fieldId: 'addressee', value: shipAddressee });
                        adjustment.setValue({ fieldId: 'address', value: shipAddress });
                        log.audit({ title: 'reduce - Warning', details: 'No valid address for location ID: ' + locationId + ', using SO shipping address or default for adjustment' });
                    }
                } catch (e) {
                    log.error({ title: 'reduce - Location Load Error', details: 'Location ID: ' + locationId + ', Error: ' + e.message });
                    var shipAddressRec = soRecord.getSubrecord({ fieldId: 'shippingaddress' });
                    var shipAddressee = shipAddressRec ? shipAddressRec.getValue({ fieldId: 'addressee' }) || 'Inventory Adjustment' : 'Inventory Adjustment';
                    var shipAddress = shipAddressRec ? shipAddressRec.getValue({ fieldId: 'addr1' }) || 'Default Adjustment Address' : 'Default Adjustment Address';
                    adjustment.setValue({ fieldId: 'addressee', value: shipAddressee });
                    adjustment.setValue({ fieldId: 'address', value: shipAddress });
                    log.audit({ title: 'reduce - Warning', details: 'Failed to load location address for ID: ' + locationId + ', using SO shipping address or default' });
                }

                var adjustmentMade = false;
                var soUpdated = false;
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i];
                    soRecord.selectLine({ sublistId: 'item', line: line.soLineIndex });
                    var soItem = soRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item' });

                    if (soItem === line.itemId || soItem === line.fulfillItemId) {
                        adjustment.selectNewLine({ sublistId: 'inventory' });
                        adjustment.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'item', value: line.fulfillItemId || soItem });
                        adjustment.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'location', value: locationId });
                        adjustment.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'adjustqtyby', value: line.quantity });
                        adjustment.commitLine({ sublistId: 'inventory' });
                        log.debug({ title: 'reduce - Line Processed', details: 'Item: ' + (line.fulfillItemId || soItem) + ', Qty: ' + line.quantity + ', Inventory Location: ' + locationId });

                        soRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_bb_item_fullfillment_created', value: true });
                        soRecord.commitLine({ sublistId: 'item' });
                        adjustmentMade = true;
                        soUpdated = true; // Track if SO was modified
                    }
                }

                if (adjustmentMade) {
                    try {
                        var adjustmentId = adjustment.save();
                        log.debug({ title: 'reduce - Adjustment Saved', details: 'Adjustment ID: ' + adjustmentId + ', Inventory Location: ' + locationId });

                        // Populate mandatory fields if blank
                        var addrAddressee = soRecord.getValue({ fieldId: 'custbody_bpc_bb_addr_addressee' });
                        var addrAddr1 = soRecord.getValue({ fieldId: 'custbody_bpc_bb_addr_addr1' });
                        var shipAddressRec = soRecord.getSubrecord({ fieldId: 'shippingaddress' });
                        if (!addrAddressee && shipAddressRec) {
                            var shipAddressee = shipAddressRec.getValue({ fieldId: 'addressee' }) || 'Default Addressee';
                            soRecord.setValue({ fieldId: 'custbody_bpc_bb_addr_addressee', value: shipAddressee });
                            log.audit({ title: 'reduce - Populated Field', details: 'SO ID: ' + salesOrderId + ', Field: custbody_bpc_bb_addr_addressee, Value: ' + shipAddressee });
                        }
                        if (!addrAddr1 && shipAddressRec) {
                            var shipAddr1 = shipAddressRec.getValue({ fieldId: 'addr1' }) || 'Default Address 1';
                            soRecord.setValue({ fieldId: 'custbody_bpc_bb_addr_addr1', value: shipAddr1 });
                            log.audit({ title: 'reduce - Populated Field', details: 'SO ID: ' + salesOrderId + ', Field: custbody_bpc_bb_addr_addr1, Value: ' + shipAddr1 });
                        }

                        if (soUpdated) {
                            var soId = soRecord.save();
                            log.debug({ title: 'reduce - SO Updated', details: 'SO ID: ' + soId + ', Inventory Location: ' + locationId });
                        }
                        fulfillmentRec.setValue({ fieldId: 'custbody_inv_reversal_created', value: true });
                        var fulfillId = fulfillmentRec.save();
                        log.debug({ title: 'reduce - Fulfillment Updated', details: 'Fulfillment ID: ' + fulfillId + ', Inventory Location: ' + locationId });
                    } catch (saveError) {
                        log.error({ title: 'reduce - Save Error', details: 'Fulfillment ID: ' + fulfillmentId + ', Inventory Location: ' + locationId + ', Error: ' + saveError.message });
                    }
                } else {
                    log.debug({ title: 'reduce - Skipped Adjustment', details: 'No valid lines for adjustment, Fulfillment ID: ' + fulfillmentId + ', Inventory Location: ' + locationId });
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
        var invalidFulfillments = 0;
        var adjustmentErrors = 0;
        var soUpdateErrors = 0;

        summary.mapSummary.errors.iterator().each(function(key, error) {
            if (error.includes('No JSON data') || error.includes('No inventorylocation')) {
                skippedLines++;
            } else if (error.includes('No Matching Line')) {
                noMatchingLines++;
            } else if (error.includes('No valid line item for this transaction') || error.includes('No lines marked')) {
                invalidFulfillments++;
            }
            return true;
        });

        summary.reduceSummary.errors.iterator().each(function(key, error) {
            if (error.includes('Addressee, Address 1')) {
                adjustmentErrors++;
            } else if (error.includes('Error saving SO')) {
                soUpdateErrors++;
            }
            return true;
        });

        log.audit({
            title: 'summarize Completed',
            details: 'Summary logged, Skipped Lines due to missing JSON or inventorylocation: ' + skippedLines +
                     ', No Matching Lines: ' + noMatchingLines +
                     ', Invalid Fulfillments: ' + invalidFulfillments +
                     ', Adjustment Address Errors: ' + adjustmentErrors +
                     ', SO Update Errors: ' + soUpdateErrors
        });
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});