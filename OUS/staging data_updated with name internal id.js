/**
 * Copyright (c) 2025 Osmose, Inc.
 * All Rights Reserved.
 *
 * Script Name: Staging Data Integration
 * Description: This script fetches data from the CSV file 'Book1.csv' in the file cabinet (folder ID 2777783),
 * compares item location data using a saved search 'customsearch_ous_location_data' for location names,
 * creates a JSON of locations from the item's locations sublist, uses it to populate location data fields,
 * performs calculations for matched locations, and creates/updates custom records for staging data attached to the Staging Data subtab.
 * Uses native JavaScript for CSV parsing and includes detailed logging.
 *
 * Version History:
 * | Version | Date       | Author           | Remarks                                  |
 * |---------|------------|------------------|------------------------------------------|
 * | 1.00    | 2025-06-18 | Yogesh Bhurley   | Initial version                          |
 */

/**
 * @NApiVersion 2.0
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/file', 'N/record', 'N/search', 'N/runtime', 'N/format'], function(file, record, search, runtime, format) {
    
    // Helper function to format and validate date to MM/DD/YYYY
    function formatDateToString(dateValue) {
        if (!dateValue) {
            log.debug('Date Validation', 'Date value is null or empty: ' + dateValue);
            return null;
        }
        try {
            var dateObj = new Date(dateValue);
            if (isNaN(dateObj.getTime())) {
                log.error('Invalid Date Object', 'Date value is invalid: ' + dateValue);
                return null;
            }
            // Ensure date is within a reasonable range (2000 to 2030)
            var year = dateObj.getFullYear();
            if (year < 2000 || year > 2030) {
                log.error('Date Out of Range', 'Date year ' + year + ' is outside valid range (2000-2030): ' + dateValue);
                return null;
            }
            var formattedDate = format.format({
                value: dateObj,
                type: format.Type.DATE,
                timezone: format.Timezone.AMERICA_NEW_YORK
            });
            // Validate the formatted date by parsing it back
            var parsedDate = format.parse({
                value: formattedDate,
                type: format.Type.DATE
            });
            if (isNaN(parsedDate.getTime())) {
                log.error('Invalid Formatted Date', 'Formatted date is invalid: ' + formattedDate);
                return null;
            }
            // Ensure the format is strictly MM/DD/YYYY
            var dateParts = formattedDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (!dateParts) {
                log.error('Invalid Date Format', 'Formatted date does not match MM/DD/YYYY: ' + formattedDate);
                return null;
            }
            log.debug('Formatted Date', 'Input: ' + dateValue + ', Output: ' + formattedDate);
            return formattedDate;
        } catch (e) {
            log.error('Date Processing Error', 'Failed to process date: ' + dateValue + ', Error: ' + e.message);
            return null;
        }
    }

    function getInputData() {
        try {
            var folderId = 2777783;
            var fileSearch = search.create({
                type: 'file',
                filters: [
                    ['folder', 'is', folderId],
                    'AND',
                    ['name', 'is', 'Book1.csv']
                ],
                columns: ['internalid']
            });
            var fileId = fileSearch.run().getRange({ start: 0, end: 1 })[0].getValue('internalid');
            var csvFile = file.load({ id: fileId });
            log.debug('CSV File Loaded', 'File ID: ' + csvFile.id + ', Name: Book1.csv, Folder: ' + folderId);

            var csvContent = csvFile.getContents();
            log.debug('CSV Content', 'Raw Content: ' + csvContent);
            var csvLines = csvContent.split(/\r?\n/);
            var headers = csvLines[0].split(',').map(function(header) {
                return header.trim();
            });
            var data = [];

            var locationReductions = {};
            for (var i = 1; i < csvLines.length; i++) {
                if (!csvLines[i]) continue;
                var fields = csvLines[i].split(',').map(function(field) {
                    return field.trim();
                });
                var rowData = {};
                for (var j = 0; j < headers.length; j++) {
                    rowData[headers[j]] = fields[j] || '';
                }
                var itemId = rowData['MEMBER_INTERNAL_ID'];
                var locationName = rowData['LOCATION'];
                log.debug('Location Name in File', 'Item ID: ' + itemId + ', Location Name: ' + locationName);
                var netSuiteReduction = parseFloat(rowData['Staging Data']) || 0;
                if (itemId && locationName) {
                    var key = itemId + '_' + locationName;
                    locationReductions[key] = netSuiteReduction;
                }
                data.push(rowData);
                log.debug('Parsed CSV Row', 'Row ' + i + ': ' + JSON.stringify(rowData));
            }

            data.forEach(function(row) {
                row.locationReductions = locationReductions;
            });

            log.audit('Input Data Prepared', 'Total Rows: ' + data.length);
            return data.length > 0 ? data : [{ 'MEMBER_INTERNAL_ID': '6585' }];
        } catch (e) {
            log.error('GetInputData Error', 'Error in getInputData: ' + e.message + ', Stack: ' + e.stack);
            return [{ 'MEMBER_INTERNAL_ID': '6585' }];
        }
    }
    
    function map(context) {
        try {
            var row = JSON.parse(context.value);
            log.debug('Map Start', 'Processing Row Data: ' + JSON.stringify(row));

            var itemId = row['MEMBER_INTERNAL_ID'];
            var csvLocationName = row['LOCATION'];
            var locationReductions = row.locationReductions;

            if (!itemId) {
                log.error('Invalid Row', 'Row missing item ID: ' + JSON.stringify(row));
                return;
            }

            log.debug('Data Extracted', 'Item ID: ' + itemId + ', CSV Location Name: ' + csvLocationName);

            var itemRecord = record.load({
                type: record.Type.INVENTORY_ITEM,
                id: itemId,
                isDynamic: false
            });

            var lineCount = itemRecord.getLineCount({ sublistId: 'locations' });
            log.debug('Location Check', 'Item ID: ' + itemId + ', Location sublist lines: ' + lineCount);

            var itemLocationsMap = {};
            var processedLocations = [];
            for (var j = 0; j < lineCount; j++) {
                var locId = itemRecord.getSublistValue({
                    sublistId: 'locations',
                    fieldId: 'location',
                    line: j
                });
                var locationName = itemRecord.getSublistValue({
                    sublistId: 'locations',
                    fieldId: 'locationname',
                    line: j
                }) || locId;
                log.debug('Sublist Location', 'Item ID: ' + itemId + ', Location ID: ' + locId + ', Name: ' + locationName + ' at line ' + j);
                processedLocations.push(locId);

                var lastInvtCountDate = itemRecord.getSublistValue({
                    sublistId: 'locations',
                    fieldId: 'lastinvtcountdate',
                    line: j
                });
                var nextInvtCountDate = itemRecord.getSublistValue({
                    sublistId: 'locations',
                    fieldId: 'nextinvtcountdate',
                    line: j
                });

                var formattedLastInvtCountDate = formatDateToString(lastInvtCountDate);
                var formattedNextInvtCountDate = formatDateToString(nextInvtCountDate);

                log.debug('Raw and Formatted Dates', 'Item ID: ' + itemId + ', Location ID: ' + locId + 
                    ', Raw Last Count Date: ' + (lastInvtCountDate || 'null') + 
                    ', Formatted Last Count Date: ' + (formattedLastInvtCountDate || 'null') + 
                    ', Raw Next Count Date: ' + (nextInvtCountDate || 'null') + 
                    ', Formatted Next Count Date: ' + (formattedNextInvtCountDate || 'null'));

                try {
                    itemLocationsMap[locId] = {
                        locationId: locId,
                        locationName: locationName,
                        onHand: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'quantityonhand', line: j }) || 0).toFixed(2)),
                        available: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'quantityavailable', line: j }) || 0).toFixed(2)),
                        onOrder: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'quantityonorder', line: j }) || 0).toFixed(2)),
                        committed: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'quantitycommitted', line: j }) || 0).toFixed(2)),
                        backOrdered: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'quantitybackordered', line: j }) || 0).toFixed(2)),
                        inTransit: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'quantityintransit', line: j }) || 0).toFixed(2)),
                        reorderPoint: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'savedreorderpoint', line: j }) || 0).toFixed(2)),
                        preferredStockLevel: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'preferredstocklevel', line: j }) || 0).toFixed(2)),
                        stockUnit: itemRecord.getValue({ fieldId: 'stockunit' }) || '',
                        value: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'onhandvaluemli', line: j }) || 0).toFixed(2)),
                        averageCost: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'averagecostmli', line: j }) || 0).toFixed(2)),
                        lastPurchasePrice: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'lastpurchasepricekey', line: j }) || 0).toFixed(2)),
                        leadTime: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'leadtime', line: j }) || 0).toFixed(2)),
                        safetyStockLevel: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'safetystocklevel', line: j }) || 0).toFixed(2)),
                        defaultReturnCost: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'defaultreturncost', line: j }) || 0).toFixed(2)),
                        quantityAvailableBase: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'quantityavailablebase', line: j }) || 0).toFixed(2)),
                        lastInvtCountDate: formattedLastInvtCountDate,
                        nextInvtCountDate: formattedNextInvtCountDate,
                        invtCountInterval: Number((itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'invtcountinterval', line: j }) || 0).toFixed(2)),
                        invtClassification: itemRecord.getSublistValue({ sublistId: 'locations', fieldId: 'invtclassification', line: j }) || ''
                    };
                } catch (e) {
                    log.error('Error Building itemLocationsMap', 'Item ID: ' + itemId + ', Location ID: ' + locId + ', Error: ' + e.message + ', Stack: ' + e.stack);
                    continue;
                }
            }
            log.debug('Item Locations JSON', 'Item ID: ' + itemId + ', Locations Map: ' + JSON.stringify(itemLocationsMap));

            if (lineCount === 0) {
                log.error('No Locations', 'No locations found for Item ID: ' + itemId);
                return;
            }

            var locationSearch = search.load({
                id: 'customsearch_ous_location_data'
            });
            var locationResults = locationSearch.run().getRange({ start: 0, end: 1000 });
            log.debug('Location Search Results', 'Number of results: ' + locationResults.length);
            var locationMap = {};
            if (locationResults.length === 0) {
                log.error('Empty Search Results', 'Saved search customsearch_ous_location_data returned no results. Please verify the search configuration.');
            } else {
                locationResults.forEach(function(result) {
                    log.debug('Raw Search Result', 'Result: ' + JSON.stringify(result));
                    var locId = result.getValue({ name: 'internalid' });
                    var locName = result.getValue({ name: 'formulatext' });
                    if (locId && locName) {
                        locationMap[locName] = parseInt(locId, 10);
                        log.debug('Mapped Location', 'Location Name: ' + locName + ', Internal ID: ' + locId);
                    } else {
                        log.debug('Invalid Mapping', 'Loc ID: ' + locId + ', Loc Name: ' + locName);
                    }
                });
            }
            log.debug('JSON Created', 'Location Map: ' + JSON.stringify(locationMap));

            var matchedLocId = locationMap[csvLocationName];
            if (!matchedLocId) {
                for (var locName in locationMap) {
                    if (locName.includes(csvLocationName) || (csvLocationName.match(/\d+/) && locName.includes(csvLocationName.match(/\d+/)[0]))) {
                        matchedLocId = locationMap[locName];
                        log.debug('Partial Match Found', 'CSV Location Name: ' + csvLocationName + ', Matched Location Name: ' + locName + ', Matched Location ID: ' + matchedLocId);
                        break;
                    }
                }
            }
            log.debug('Location Name Found from File', 'CSV Location Name: ' + csvLocationName + ', Matched Location ID: ' + matchedLocId);
            if (!matchedLocId) {
                log.debug('Location Not Found', 'No matching location ID found for name: ' + csvLocationName);
                return;
            }
            log.debug('Location Internal ID Found', 'Using Location ID: ' + matchedLocId + ' for Item ID: ' + itemId);

            var batchSize = 20;
            var usage = runtime.getCurrentScript().getRemainingUsage();
            log.debug('Initial Governance Usage', 'Remaining Units: ' + usage);
            for (var j = 0; j < lineCount; j += batchSize) {
                var end = Math.min(j + batchSize, lineCount);
                try {
                    usage = runtime.getCurrentScript().getRemainingUsage();
                    log.debug('Batch Start', 'Processing batch from line ' + j + ' to ' + (end - 1) + ', Remaining Units: ' + usage);
                    for (var k = j; k < end; k++) {
                        var locId = itemRecord.getSublistValue({
                            sublistId: 'locations',
                            fieldId: 'location',
                            line: k
                        });
                        var locationName = itemRecord.getSublistValue({
                            sublistId: 'locations',
                            fieldId: 'locationname',
                            line: k
                        }) || locId;
                        log.debug('Processing Location', 'Item ID: ' + itemId + ', Location ID: ' + locId + ', Name: ' + locationName + ' at line ' + k);

                        if (processedLocations.indexOf(locId) === -1) {
                            log.debug('Skipped Location', 'Location ID: ' + locId + ', Name: ' + locationName + ' was not in initial sublist scan for Item ID: ' + itemId);
                            continue;
                        }

                        var locationData = itemLocationsMap[locId];
                        if (!locationData) {
                            log.debug('No Location Data', 'No data found in itemLocationsMap for Location ID: ' + locId);
                            continue;
                        }

                        var netSuiteReduction = locationReductions[itemId + '_' + csvLocationName] || 0;
                        var isCsvMatch = (parseInt(locId, 10) === matchedLocId);

                        log.debug('Location Data', 'Item ID: ' + itemId + ', Location ID: ' + locId + ', Is CSV Match: ' + isCsvMatch + ', NetSuite Reduction: ' + netSuiteReduction);

                        locationData.itemId = itemId;
                        locationData.netSuiteReduction = Number((netSuiteReduction || 0).toFixed(2));
                        locationData.isCsvMatch = isCsvMatch;

                        if (isCsvMatch && netSuiteReduction > 0) {
                            locationData.stagedQty = Number((netSuiteReduction - locationData.onHand).toFixed(2));
                            locationData.availableQty = Number((locationData.onHand - locationData.stagedQty).toFixed(2));
                        } else {
                            locationData.stagedQty = 0.00;
                            locationData.availableQty = 0.00;
                            log.debug('Skipped Calculation', 'No calculations for non-matching location ID: ' + locId + ', Name: ' + locationName);
                        }

                        log.debug('Calculated Quantities', 'Item ID: ' + itemId + ', Location ID: ' + locId + ', Name: ' + locationName + ', Staged Quantity: ' + locationData.stagedQty + ', Available Quantity: ' + locationData.availableQty);
                        log.audit('Before Write', 'Item ID: ' + itemId + ', Location ID: ' + locId + ', Last Count Date: ' + (locationData.lastInvtCountDate || 'null') + ', Next Count Date: ' + (locationData.nextInvtCountDate || 'null'));

                        usage = runtime.getCurrentScript().getRemainingUsage();
                        if (usage < 500) {
                            log.debug('Governance Warning', 'Remaining Units: ' + usage + '. Yielding at line ' + k);
                            return;
                        }
                        try {
                            context.write({
                                key: itemId + '_' + locId,
                                value: JSON.stringify(locationData)
                            });
                            log.debug('After Write', 'Item ID: ' + itemId + ', Location ID: ' + locId);
                        } catch (writeError) {
                            log.error('Write Error', 'Failed to write context for Item ID: ' + itemId + ', Location ID: ' + locId + ', Message: ' + writeError.message + ', Stack: ' + writeError.stack);
                        }
                    }
                    log.debug('Batch Completed', 'Finished processing batch from line ' + j + ' to ' + (end - 1));
                } catch (batchError) {
                    log.error('Batch Error', 'Error processing batch from line ' + j + ' to ' + (end - 1) + ', Message: ' + batchError.message + ', Stack: ' + batchError.stack);
                }
                usage = runtime.getCurrentScript().getRemainingUsage();
                if (usage < 500) {
                    log.debug('Governance Warning', 'Remaining Units: ' + usage + '. Yielding after batch ending at line ' + (end - 1));
                    return;
                }
            }
            log.debug('Map Completed', 'Processed all ' + lineCount + ' locations for Item ID: ' + itemId);
        } catch (e) {
            log.error('Map Error', 'Error processing file ID: ' + (context.value ? JSON.parse(context.value).fileId : 'unknown') + ', Message: ' + e.message + ', Stack: ' + e.stack);
        }
    }
    
    function reduce(context) {
        try {
            var keyParts = context.key.split('_');
            var itemId = keyParts[0];
            var locationId = keyParts[1];
            var locationData = JSON.parse(context.values[0]);
            log.debug('Reduce Start', 'Processing Item ID: ' + itemId + ', Location ID: ' + locationId + ' (from key), Data: ' + JSON.stringify(locationData));

            locationData.locationId = locationId;

            var existingRecordId = null;
            var customRecordSearch = search.create({
                type: 'customrecord_ous__staging_data',
                filters: [
                    ['custrecordous_item_link', 'is', itemId],
                    'AND',
                    ['custrecordous_location', 'is', locationId]
                ],
                columns: ['internalid']
            });
            
            var searchResults = customRecordSearch.run().getRange({ start: 0, end: 1 });
            if (searchResults.length > 0) {
                existingRecordId = searchResults[0].getValue('internalid');
                log.debug('Existing Record Found', 'Found existing custom record ID: ' + existingRecordId + ' for Item ID: ' + itemId + ', Location ID: ' + locationId);
            } else {
                log.debug('No Existing Record', 'No custom record found for Item ID: ' + itemId + ', Location ID: ' + locationId);
            }
            
            var customRecord;
            if (existingRecordId) {
                customRecord = record.load({
                    type: 'customrecord_ous__staging_data',
                    id: existingRecordId,
                    isDynamic: true
                });
                log.debug('Loading Existing Record', 'Loaded custom record ID: ' + existingRecordId);
                
                if (locationData.isCsvMatch) {
                    var fieldsToCompare = [
                        { standard: 'onHand', custom: 'custrecordous_on_hand', type: 'number' },
                        { standard: 'available', custom: 'custrecordous_available', type: 'number' },
                        { standard: 'onOrder', custom: 'custrecordous_on_order', type: 'number' },
                        { standard: 'committed', custom: 'custrecordous_committed', type: 'number' },
                        { standard: 'backOrdered', custom: 'custrecordous_back_ordered', type: 'number' },
                        { standard: 'inTransit', custom: 'custrecordous_in_transit', type: 'number' },
                        { standard: 'reorderPoint', custom: 'custrecordous_reorder_point', type: 'number' },
                        { standard: 'preferredStockLevel', custom: 'custrecordous_pref_stock_level', type: 'number' },
                        { standard: 'value', custom: 'custrecordous_value', type: 'number' },
                        { standard: 'averageCost', custom: 'custrecordous_averagecostmli', type: 'number' },
                        { standard: 'lastPurchasePrice', custom: 'custrecordous_lastpurchasepricekey', type: 'number' },
                        { standard: 'leadTime', custom: 'custrecordous_leadtime', type: 'number' },
                        { standard: 'safetyStockLevel', custom: 'custrecordous_safetystocklevel', type: 'number' },
                        { standard: 'defaultReturnCost', custom: 'custrecordous_defaultreturncost', type: 'number' },
                        { standard: 'quantityAvailableBase', custom: 'custrecordous_quantityavailablebase', type: 'number' },
                        { standard: 'invtCountInterval', custom: 'custrecordous_invtcountinterval', type: 'number' },
                        { standard: 'stockUnit', custom: 'custrecordous_stock_unit', type: 'string' },
                        { standard: 'invtClassification', custom: 'custrecordous_invtclassification', type: 'string' },
                        { standard: 'lastInvtCountDate', custom: 'custrecordous_lastinvtcountdate', type: 'date' },
                        { standard: 'nextInvtCountDate', custom: 'custrecordous_nextinvtcountdate', type: 'date' }
                    ];

                    fieldsToCompare.forEach(function(field) {
                        var standardValue = locationData[field.standard];
                        var customValue = customRecord.getValue({ fieldId: field.custom });
                        var shouldUpdate = false;

                        if (field.type === 'number') {
                            standardValue = Number(standardValue) || 0;
                            customValue = Number(customValue) || 0;
                            shouldUpdate = standardValue.toFixed(2) !== customValue.toFixed(2);
                        } else if (field.type === 'date') {
                            shouldUpdate = (standardValue || '') !== (customValue || '');
                        } else {
                            shouldUpdate = (standardValue || '') !== (customValue || '');
                        }

                        if (shouldUpdate) {
                            log.debug('Updating Field', 'Field: ' + field.custom + ', Old Value: ' + customValue + ', New Value: ' + standardValue);
                            if (field.type === 'date') {
                                customRecord.setText({ fieldId: field.custom, text: standardValue || null });
                            } else {
                                customRecord.setValue({ fieldId: field.custom, value: standardValue || (field.type === 'number' ? 0 : '') });
                            }
                        } else {
                            log.debug('Field Unchanged', 'Field: ' + field.custom + ', Value: ' + customValue);
                        }
                    });
                }
            } else {
                customRecord = record.create({
                    type: 'customrecord_ous__staging_data',
                    isDynamic: true
                });
                log.debug('Creating New Record', 'Creating new custom record for Item ID: ' + itemId + ', Location ID: ' + locationId);
                customRecord.setValue({ fieldId: 'custrecordous_location', value: locationId });
                customRecord.setValue({ fieldId: 'custrecordous_item_link', value: itemId });
                customRecord.setValue({ fieldId: 'custrecordous_on_hand', value: locationData.onHand || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_staged_qty', value: locationData.stagedQty || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_available_qty', value: locationData.availableQty || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_on_order', value: locationData.onOrder || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_committed', value: locationData.committed || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_available', value: locationData.available || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_back_ordered', value: locationData.backOrdered || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_in_transit', value: locationData.inTransit || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_reorder_point', value: locationData.reorderPoint || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_pref_stock_level', value: locationData.preferredStockLevel || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_stock_unit', value: locationData.stockUnit || '' });
                customRecord.setValue({ fieldId: 'custrecordous_value', value: locationData.value || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_averagecostmli', value: locationData.averageCost || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_lastpurchasepricekey', value: locationData.lastPurchasePrice || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_leadtime', value: locationData.leadTime || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_safetystocklevel', value: locationData.safetyStockLevel || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_defaultreturncost', value: locationData.defaultReturnCost || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_quantityavailablebase', value: locationData.quantityAvailableBase || 0 });

                // Log date values before setting
                log.debug('Setting Date Fields', 'Item ID: ' + itemId + ', Location ID: ' + locationId + 
                    ', Last Count Date: ' + (locationData.lastInvtCountDate || 'null') + 
                    ', Next Count Date: ' + (locationData.nextInvtCountDate || 'null'));

                // Use setText for date fields in dynamic mode
                customRecord.setText({ fieldId: 'custrecordous_lastinvtcountdate', text: locationData.lastInvtCountDate || null });
                customRecord.setText({ fieldId: 'custrecordous_nextinvtcountdate', text: locationData.nextInvtCountDate || null });
                customRecord.setValue({ fieldId: 'custrecordous_invtcountinterval', value: locationData.invtCountInterval || 0 });
                customRecord.setValue({ fieldId: 'custrecordous_invtclassification', value: locationData.invtClassification || '' });
            }
            
            log.debug('Setting Staged Qty', 'Value: ' + locationData.stagedQty);
            customRecord.setValue({ fieldId: 'custrecordous_staged_qty', value: locationData.stagedQty || 0 });
            log.debug('Setting Available Qty', 'Value: ' + locationData.availableQty);
            customRecord.setValue({ fieldId: 'custrecordous_available_qty', value: locationData.availableQty || 0 });
            log.debug('Setting NetSuite Reduction', 'Value: ' + locationData.netSuiteReduction);
            customRecord.setValue({ fieldId: 'custrecordous_net_suite_reduction', value: locationData.netSuiteReduction || 0 });

            try {
                var customRecordId = customRecord.save();
                log.debug('Record Saved', 'Custom Record ID: ' + customRecordId + ', Staged Qty: ' + customRecord.getValue({ fieldId: 'custrecordous_staged_qty' }) + ', Available Qty: ' + customRecord.getValue({ fieldId: 'custrecordous_available_qty' }));
            } catch (saveError) {
                log.error('Save Error', 'Failed to save custom record for Item ID: ' + itemId + ', Location ID: ' + locationId + ', Message: ' + saveError.message + ', Stack: ' + saveError.stack);
            }
            
            if (!existingRecordId) {
                try {
                    record.attach({
                        record: { type: 'customrecord_ous__staging_data', id: customRecordId },
                        to: { type: record.Type.INVENTORY_ITEM, id: locationData.itemId },
                        attributes: { subtab: 'custtab_staging_data' }
                    });
                    log.debug('Record Attached', 'Custom Record ID: ' + customRecordId + ' attached to Item ID: ' + locationData.itemId + ' on subtab custtab_staging_data');
                } catch (attachError) {
                    log.error('Attachment Error', 'Failed to attach record: Item ID: ' + locationData.itemId + ', Custom Record ID: ' + customRecordId + ', Message: ' + attachError.message + ', Stack: ' + attachError.stack);
                }
            } else {
                log.debug('Record Attachment Skipped', 'Custom Record ID: ' + customRecordId + ' already attached to Item ID: ' + locationData.itemId);
            }
        } catch (e) {
            log.error('Reduce Error', 'Error processing Item ID: ' + (locationData ? locationData.itemId : 'unknown') + ', Location ID: ' + (locationData ? locationData.locationId : 'unknown') + ', Message: ' + e.message + ', Stack: ' + e.stack);
        }
    }
    
    function summarize(summary) {
        try {
            if (summary.mapErrors && Array.isArray(summary.mapErrors)) {
                summary.mapErrors.forEach(function(error) {
                    log.error('Map Error', 'Map error: ' + JSON.stringify(error));
                });
            } else {
                log.debug('Summarize', 'No map errors found.');
            }
            
            if (summary.reduceErrors && Array.isArray(summary.reduceErrors)) {
                summary.reduceErrors.forEach(function(error) {
                    log.error('Reduce Error', 'Reduce error: ' + JSON.stringify(error));
                });
            } else {
                log.debug('Summarize', 'No reduce errors found.');
            }
            
            log.audit('Summary', 'Processing completed. Total records processed: ' + (summary.inputSummary.total || 0));
        } catch (e) {
            log.error('Summarize Error', 'Error in summarize: ' + e.message + ', Stack: ' + e.stack);
        }
    }
    
    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});